import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'

// Storage adapter. Local disk for development; swap for Supabase Storage / S3 (same interface) in production.
export interface StorageAdapter { put(key: string, data: Buffer): Promise<void>; get(key: string): Promise<Buffer> }

const root = () => path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? './storage')
/** Resolves a storage key inside the storage root; rejects keys that would escape it. */
function keyPath(key: string): string {
  const r = root()
  const p = path.resolve(/*turbopackIgnore: true*/ r, key)
  if (!p.startsWith(r + path.sep)) throw new Error('Invalid storage key.')
  return p
}
export const localStorageAdapter: StorageAdapter = {
  async put(key, data) { const p = keyPath(key); await mkdir(/*turbopackIgnore: true*/ path.dirname(p), { recursive: true }); await writeFile(/*turbopackIgnore: true*/ p, data, { mode: 0o600 }) },
  async get(key) { return readFile(/*turbopackIgnore: true*/ keyPath(key)) },
}

const ALLOWED: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'application/pdf', ext: 'pdf', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'text/csv', ext: 'csv', test: (b) => isText(b) },
  { mime: 'text/plain', ext: 'txt', test: (b) => isText(b) },
]
function isText(b: Buffer) { const s = b.subarray(0, 4096); return !s.includes(0) }

/** Validates by magic bytes (never trusts the client-declared type) and size. */
export function validateUpload(name: string, data: Buffer, declaredMime: string): { ok: true; mime: string; ext: string } | { ok: false; error: string } {
  const max = Number(process.env.MAX_UPLOAD_MB ?? 20) * 1024 * 1024
  if (data.length === 0) return { ok: false, error: 'Empty file.' }
  if (data.length > max) return { ok: false, error: `File exceeds ${process.env.MAX_UPLOAD_MB ?? 20} MB.` }
  const ext = name.toLowerCase().split('.').pop() ?? ''
  const match = ALLOWED.find((a) => a.ext === (ext === 'jpeg' ? 'jpg' : ext) && a.test(data))
  if (!match) return { ok: false, error: 'Unsupported or mismatched file type. Allowed: PDF, PNG, JPEG, CSV, TXT.' }
  if (declaredMime && declaredMime !== match.mime && !(match.ext === 'csv' && declaredMime.startsWith('text/'))) return { ok: false, error: 'Declared content type does not match file contents.' }
  return { ok: true, mime: match.mime, ext: match.ext }
}

export const sha256Hex = (b: Buffer) => createHash('sha256').update(b).digest('hex')
export const newStorageKey = (ext: string) => `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`

/** ClamAV INSTREAM scan when CLAMD_HOST is configured; otherwise the file stays NOT_SCANNED (admin-only download). */
export async function scanBuffer(data: Buffer): Promise<'CLEAN' | 'INFECTED' | 'NOT_SCANNED'> {
  const host = process.env.CLAMD_HOST
  if (!host) return 'NOT_SCANNED'
  const [h, p] = host.split(':')
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: h, port: Number(p ?? 3310) }, () => {
      sock.write('zINSTREAM\0')
      for (let i = 0; i < data.length; i += 64 * 1024) { const chunk = data.subarray(i, i + 64 * 1024); const len = Buffer.alloc(4); len.writeUInt32BE(chunk.length); sock.write(len); sock.write(chunk) }
      sock.write(Buffer.alloc(4))
    })
    let out = ''
    sock.on('data', (d) => { out += d.toString() })
    sock.on('end', () => resolve(/FOUND/.test(out) ? 'INFECTED' : /OK/.test(out) ? 'CLEAN' : 'NOT_SCANNED'))
    sock.on('error', () => resolve('NOT_SCANNED'))
    sock.setTimeout(30_000, () => { sock.destroy(); resolve('NOT_SCANNED') })
  })
}

function secret() { const s = process.env.APP_SECRET; if (!s || s.length < 32) throw new Error('APP_SECRET must be set (≥32 chars).'); return s }

/** Short-lived signed URL for a document download. The route still re-checks the session and visibility. */
export function signDownload(documentId: string, ttlSeconds = 300) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const sig = createHmac('sha256', secret()).update(`${documentId}.${exp}`).digest('base64url')
  return `/api/files/${documentId}?exp=${exp}&sig=${sig}`
}

export function verifyDownload(documentId: string, exp: string | null, sig: string | null) {
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false
  const expected = createHmac('sha256', secret()).update(`${documentId}.${exp}`).digest('base64url')
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
}
