// Name/identifier normalization shared by search, identity matching and imports.
// Normalization is deliberately conservative: it removes case, accents, punctuation and spacing differences,
// but never synonyms or plant parts — "Burdock Extract" and "Arctium Lappa Root Extract" stay different strings.

export function normalizeName(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‐-―]/g, '-')
    .replace(/[*†‡§¹²³⁴]+/g, '')
    .replace(/[^a-z0-9()/%,.+\- ]+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Removes parenthetical content: "Olea Europaea (Olive) Fruit Oil" → "olea europaea fruit oil". */
export function stripParentheticals(input: string): string {
  return normalizeName(input.replace(/\([^)]*\)/g, ' '))
}

export function slugify(input: string): string {
  return normalizeName(input).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

const CAS_RE = /^(\d{2,7})-(\d{2})-(\d)$/

/** CAS check digit validation (weighted sum of digits mod 10). */
export function isValidCas(cas: string): boolean {
  const m = CAS_RE.exec(cas.trim())
  if (!m) return false
  const digits = (m[1] + m[2]).split('').reverse()
  const sum = digits.reduce((acc, d, i) => acc + Number(d) * (i + 1), 0)
  return sum % 10 === Number(m[3])
}

const EC_RE = /^(\d{3})-(\d{3})-(\d)$/

/** EC number check digit: weighted sum of first six digits (weights 1..6) mod 11. */
export function isValidEc(ec: string): boolean {
  const m = EC_RE.exec(ec.trim())
  if (!m) return false
  const d = (m[1] + m[2]).split('').map(Number)
  const check = d.reduce((acc, v, i) => acc + v * (i + 1), 0) % 11
  return check === Number(m[3])
}

export type IdentifierKind = 'CAS' | 'EC' | 'PUBCHEM_CID' | 'INCHIKEY' | 'DTXSID' | null

/** Detects whether a search string looks like a chemical identifier. */
export function detectIdentifier(q: string): IdentifierKind {
  const s = q.trim()
  if (CAS_RE.test(s)) return 'CAS'
  if (EC_RE.test(s)) return 'EC'
  if (/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/.test(s)) return 'INCHIKEY'
  if (/^DTXSID\d+$/i.test(s)) return 'DTXSID'
  if (/^(cid:?\s*)?\d{1,10}$/i.test(s)) return 'PUBCHEM_CID'
  return null
}

export function normalizeIdentifier(type: string, value: string): string {
  const v = value.trim()
  switch (type) {
    case 'PUBCHEM_CID':
      return v.replace(/^cid:?\s*/i, '')
    case 'INCHIKEY':
    case 'DTXSID':
      return v.toUpperCase()
    case 'SMILES':
    case 'INCHI':
      return v
    default:
      return v.toLowerCase()
  }
}
