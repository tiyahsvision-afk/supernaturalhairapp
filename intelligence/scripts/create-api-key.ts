/**
 * Creates an API key from the command line (the key is printed once and stored only as a hash).
 *   npx tsx scripts/create-api-key.ts --org <slug> --name "<label>" --scopes ingredient:read,search:read [--days 90]
 */
try { process.loadEnvFile() } catch { /* .env is optional; environment variables may be set directly */ }
import { prisma } from '../src/lib/db'
import { createApiKey } from '../src/lib/auth/api-keys'
import { PERMISSIONS } from '../src/lib/permissions'

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const orgSlug = arg('org'), name = arg('name'), scopes = (arg('scopes') ?? '').split(',').filter(Boolean)
  if (!orgSlug || !name || !scopes.length) throw new Error('Usage: --org <slug> --name <label> --scopes a,b [--days N]')
  const unknown = scopes.filter((s) => !(PERMISSIONS as readonly string[]).includes(s))
  if (unknown.length) throw new Error(`Unknown scopes: ${unknown.join(', ')}`)
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: orgSlug } })
  const days = Number(arg('days') ?? 90)
  const k = await createApiKey({ name, organizationId: org.id, scopes, expiresAt: new Date(Date.now() + days * 86400_000) })
  console.log(`Created ${k.prefix} for ${org.name}, expires in ${days} days. Store it now — it will not be shown again:\n${k.key}`)
}

main().catch((e) => { console.error(e.message); process.exit(1) }).finally(() => prisma.$disconnect())
