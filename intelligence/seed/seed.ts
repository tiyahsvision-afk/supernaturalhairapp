/* Seed loader for Supernatural Ingredient Intelligence.
 *
 * Idempotent: re-running does not create duplicates (ExternalRef keys, unique codes and import-engine hashing).
 * Every seeded record carries provenance; nothing seeded is marked APPROVED — approval requires a human reviewer.
 * Run: npm run db:seed
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { AliasType, IdentityType, MaterialType, OriginType, Role } from '@prisma/client'
import { prisma } from '../src/lib/db'
import { hashPassword, passwordPolicyErrors } from '../src/lib/auth/password'
import type { Principal } from '../src/lib/permissions'
import { createIngredient, addIdentifier } from '../src/lib/services/ingredients'
import { createFact } from '../src/lib/services/facts'
import { upsertEdge } from '../src/lib/services/graph'
import { createFormula } from '../src/lib/services/formulas'
import { requestReview } from '../src/lib/services/review'
import { merge, proposeDuplicates } from '../src/lib/services/identity'
import { createImportJob, runImportJob } from '../src/lib/import/engine'
import { processBatch } from '../src/lib/integration/hair-passport'
import { createApiKey } from '../src/lib/auth/api-keys'
import { normalizeName, slugify } from '../src/lib/normalize'
import { importCosing, refreshDerivedClasses } from './cosing'
import { rematchUnresolvedLines } from '../src/lib/services/products'
import { reindexIngredient, reindexRawMaterial, reindexResearchCandidate, reindexSupplier } from '../src/lib/search-index'

const DATA = path.join(__dirname, 'data')
const load = <T>(f: string): T => JSON.parse(readFileSync(path.join(DATA, f), 'utf8'))
const log = (...a: unknown[]) => console.log('[seed]', ...a)

// ─── Controlled vocabularies ───
const FUNCTIONS: [string, string, string?][] = [
  ['humectant', 'Humectant'], ['occlusive', 'Occlusive'], ['emollient', 'Emollient'], ['conditioner', 'Conditioner'],
  ['cationic-conditioner', 'Cationic conditioner', 'conditioner'], ['detangler', 'Detangler'], ['antistatic', 'Antistatic'], ['film-former', 'Film former'],
  ['surfactant', 'Surfactant'], ['cleansing-agent', 'Cleansing agent', 'surfactant'], ['co-surfactant', 'Co-surfactant', 'surfactant'], ['emulsifier', 'Emulsifier'],
  ['solubilizer', 'Solubilizer'], ['thickener', 'Thickener'], ['rheology-modifier', 'Rheology modifier'], ['preservative', 'Preservative'],
  ['preservative-booster', 'Preservative booster'], ['chelator', 'Chelator'], ['antioxidant', 'Antioxidant'], ['fragrance', 'Fragrance'], ['colorant', 'Colorant'],
  ['uv-absorber', 'UV absorber'], ['ph-adjuster', 'pH adjuster'], ['buffer', 'Buffer'], ['protein', 'Protein'], ['strengthening-agent', 'Strengthening agent'],
  ['deposition-aid', 'Deposition aid'], ['penetration-enhancer', 'Penetration enhancer'], ['delivery-carrier', 'Delivery carrier'], ['scalp-soothing', 'Scalp-soothing material'],
  ['exfoliant', 'Exfoliant'], ['sebum-modulating', 'Sebum-modulating material'], ['microbiome-related', 'Microbiome-related material'], ['botanical-active', 'Botanical active'],
  ['peptide-active', 'Peptide active'], ['other', 'Other'],
]

const REVIEW_REQUIREMENTS: { recordType: string; reviewType: string; roles: Role[]; approvals?: number; second?: boolean; blind?: boolean; days?: number; notes?: string }[] = [
  { recordType: 'Ingredient', reviewType: 'IDENTITY', roles: ['DATA_ADMIN', 'COSMETIC_CHEMIST', 'RESEARCH_SCIENTIST'], notes: 'Identity / alias merge: one qualified data reviewer.' },
  { recordType: 'IngredientFact', reviewType: 'CHEMICAL_PROPERTY', roles: ['COSMETIC_CHEMIST', 'RESEARCH_SCIENTIST'] },
  { recordType: 'IngredientFunction', reviewType: 'COSMETIC_FUNCTION', roles: ['COSMETIC_CHEMIST'] },
  { recordType: 'Evidence', reviewType: 'EVIDENCE', roles: ['RESEARCH_SCIENTIST', 'DERMATOLOGIST_REVIEWER', 'TRICHOLOGIST_REVIEWER'], notes: 'Evidence synthesis requires a scientific reviewer.' },
  { recordType: 'RegulatoryRecord', reviewType: 'REGULATORY', roles: ['REGULATORY_REVIEWER'], notes: 'Regulatory interpretation requires a regulatory reviewer.' },
  { recordType: 'SafetyReview', reviewType: 'SAFETY', roles: ['DERMATOLOGIST_REVIEWER', 'REGULATORY_REVIEWER', 'COSMETIC_CHEMIST'], second: true, notes: 'High-risk safety records require a second reviewer.' },
  { recordType: 'Patent', reviewType: 'PATENT', roles: ['PATENT_REVIEWER'] },
  { recordType: 'FormulaVersion', reviewType: 'FORMULA', roles: ['COSMETIC_CHEMIST'], notes: 'Formula approval for testing: cosmetic chemist plus required safety review.' },
  { recordType: 'ResearchSignal', reviewType: 'STATISTICAL', roles: ['RESEARCH_SCIENTIST'], second: true, notes: 'Statistical signal: analyst plus scientific reviewer (Phase 3).' },
  { recordType: 'ResearchCandidate', reviewType: 'IP', roles: ['RESEARCH_SCIENTIST', 'PATENT_REVIEWER'], second: true, notes: 'Potential patent candidate: scientific reviewer plus IP review.' },
  { recordType: 'AIAnswer', reviewType: 'AI_ANSWER', roles: ['RESEARCH_SCIENTIST'], notes: 'Phase 4.' },
  { recordType: 'Source', reviewType: 'SOURCE_RIGHTS', roles: ['REGULATORY_REVIEWER', 'DATA_ADMIN'], notes: 'Licensing / data-rights review.' },
  { recordType: 'ProductVersion', reviewType: 'PRODUCT_INGREDIENTS', roles: ['DATA_ADMIN', 'COSMETIC_CHEMIST', 'DATA_ANNOTATOR'] },
  { recordType: 'GraphEdge', reviewType: 'GRAPH_RELATIONSHIP', roles: ['RESEARCH_SCIENTIST', 'COSMETIC_CHEMIST'] },
  { recordType: 'ResearchProject', reviewType: 'EVIDENCE', roles: ['RESEARCH_SCIENTIST', 'COSMETIC_CHEMIST', 'REGULATORY_REVIEWER'], notes: 'Workbench research findings: one qualified reviewer signs off before a report is treated as reviewed.' },
]

const FAMILY_NAMES: Record<string, string> = {
  'solvents': 'Solvents', 'humectants': 'Humectants', 'salts': 'Salts', 'ph-adjusters': 'pH adjusters & buffers', 'anionic-surfactants': 'Anionic surfactants',
  'amphoteric-surfactants': 'Amphoteric surfactants', 'nonionic-surfactants': 'Nonionic surfactants & emulsifiers', 'opacifiers': 'Opacifiers & pearlizers', 'fatty-alcohols': 'Fatty alcohols',
  'cationic-surfactants': 'Cationic surfactants (quats)', 'cationic-polymers': 'Cationic polymers', 'silicones': 'Silicones', 'emollient-oils': 'Oils & emollient esters', 'lipids': 'Biomimetic lipids',
  'butters-waxes': 'Butters & waxes', 'proteins-hydrolysates': 'Proteins & hydrolysates', 'amino-acids': 'Amino acids', 'peptides': 'Peptides', 'botanical-extracts': 'Botanical extracts',
  'essential-oils': 'Essential oils', 'preservatives': 'Preservatives & boosters', 'chelators': 'Chelators', 'antioxidants-vitamins': 'Antioxidants & vitamins', 'scalp-actives': 'Scalp-care actives',
  'anti-dandruff-actives': 'Anti-flaking actives', 'drug-actives': 'Drug actives (reference only — not cosmetic ingredients)', 'chemical-treatment-agents': 'Chemical treatment agents',
  'hair-dye-agents': 'Hair dye & bleach agents', 'bond-repair': 'Bond-repair chemistry', 'polymers-thickeners': 'Polymers & thickeners', 'film-formers': 'Film formers',
  'other-functional': 'Other functional', 'minerals': 'Minerals', 'fragrance': 'Fragrance', 'fragrance-allergens': 'Fragrance allergens (EU-labelled)',
  'fermentation-derived': 'Fermentation-derived & microbiome-related', 'delivery-systems': 'Delivery systems',
}

// Label names used on products with common names only — linked with low confidence and routed to identity review.
const LABEL_ALIASES: Record<string, string[]> = {
  'sweet-almond-oil': ['Almond Oil', 'Almond'], 'jojoba-seed-oil': ['Jojoba'], 'burdock-root-extract': ['Burdock Extract', 'Burdock'],
  'tocopherol': ['Vitamin E oil'], 'horsetail-extract': ['Horsetail'], 'nettle-extract': ['Nettles'], 'kelp-extract': ['Kelp'], 'fenugreek-seed-extract': ['Fenugreek'],
  'comfrey-extract': ['Comfrey', 'Comfrey Extract'], 'alfalfa-extract': ['Alfalfa', 'Alfalfa Extract'], 'oatstraw-extract': ['Oatstraw', 'Oatstraw Extract'],
  'ginger-root-extract': ['Ginger', 'Ginger Extract'], 'matricaria-flower-extract': ['Chamomile'], 'anthemis-nobilis-flower-extract': ['Chamomile'],
}
const MISSPELLINGS = new Set(['linium usitatissium (flax) extract', 'eucalyptus globolus (eucalyptus) leaf oil', 'melalueca alternifolia (tea tree) leaf oil', 'ocimum, basilicum (basil) oil', 'saccharum ofcinarum (sugarcane) extract'])
const REPRESENTATIVE = new Set(['glyceryl-stearate', 'sorbitan-laurate', 'tocopherol', 'menthol', 'ketoconazole'])
const DEFINED = new Set(['DEFINED_SUBSTANCE', 'SALT', 'ESTER', 'ISOMER', 'DERIVATIVE'])

const RELATIONS: [string, string, string, string][] = [
  ['dexpanthenol', 'panthenol', 'ISOMER_OF', 'D-isomer of racemic panthenol; not interchangeable without review.'],
  ['potassium-sorbate', 'sorbic-acid', 'SALT_OF', 'Potassium salt.'],
  ['sodium-benzoate', 'benzoic-acid', 'SALT_OF', 'Sodium salt.'],
  ['sodium-hyaluronate', 'hyaluronic-acid', 'SALT_OF', 'Sodium salt; molecular-weight distribution differs by grade.'],
  ['tocopheryl-acetate', 'tocopherol', 'ESTER_OF', 'Acetate ester.'],
  ['ammonium-thioglycolate', 'thioglycolic-acid', 'SALT_OF', 'Ammonium salt.'],
  ['guar-hydroxypropyltrimonium-chloride', 'guar-gum', 'DERIVATIVE_OF', 'Cationically modified guar.'],
  ['glyceryl-stearate-se', 'glyceryl-stearate', 'GRADE_OF', 'Self-emulsifying grade containing added soap.'],
  ['disodium-edta', 'edta', 'SALT_OF', 'Disodium salt.'], ['tetrasodium-edta', 'edta', 'SALT_OF', 'Tetrasodium salt.'], ['trisodium-edta', 'edta', 'SALT_OF', 'Trisodium salt.'],
  ['comfrey-leaf-extract', 'comfrey-extract', 'RELATED_TO', 'Label "Comfrey Extract" does not state plant part; leaf and root differ in pyrrolizidine alkaloids.'],
  ['peg-40-castor-oil', 'castor-seed-oil', 'DERIVATIVE_OF', 'Ethoxylated derivative.'],
  ['hydrolyzed-jojoba-esters', 'jojoba-seed-oil', 'DERIVATIVE_OF', 'Hydrolysis product.'],
  ['flax-extract', 'linseed-seed-oil', 'RELATED_TO', 'Same botanical source, different material (extract vs fixed oil).'],
  ['coconut-fruit-extract', 'coconut-oil', 'RELATED_TO', 'Same botanical source, different material.'],
  ['ginger-root-oil', 'ginger-root-extract', 'RELATED_TO', 'Essential oil vs extract of same plant part.'],
  ['rosemary-leaf-oil', 'rosemary-leaf-extract', 'RELATED_TO', 'Essential oil vs extract of same plant part.'],
  ['capsaicin', 'capsicum-extract', 'BLEND_COMPONENT_OF', 'Marker compound of capsicum extract.'],
  ['bisabolol', 'matricaria-flower-extract', 'BLEND_COMPONENT_OF', 'Marker compound of German chamomile.'],
  ['methylchloroisothiazolinone', 'methylisothiazolinone', 'RELATED_TO', 'Used together as a 3:1 mixture.'],
]

interface SeedIngredient { k: string; n: string; c?: string; t: string; m: string; f: string; fn: string[]; p?: number; r?: string; o: string; cid?: number; cidOrigin?: string; a?: string[]; b?: [string, string, string]; identityNote?: string }

async function main() {
  const env = process.env.APP_ENV ?? 'development'
  const demoUsers = process.env.SEED_DEMO_USERS === 'true'
  if (env === 'production' && demoUsers) throw new Error('Refusing to seed demo users in production (SEED_DEMO_USERS=true).')
  const t0 = Date.now()

  // ─── Organizations & users ───
  const internal = await prisma.organization.upsert({ where: { slug: 'supernatural' }, update: {}, create: { name: 'Supernatural (internal research)', slug: 'supernatural', type: 'INTERNAL', entitlements: { research: true, api: true } } })
  const partnerBrand = await prisma.organization.upsert({ where: { slug: 'sample-brand-partner' }, update: {}, create: { name: 'Sample Brand Partner (demo org)', slug: 'sample-brand-partner', type: 'BRAND' } })
  const partnerSupplier = await prisma.organization.upsert({ where: { slug: 'sample-supplier-partner' }, update: {}, create: { name: 'Sample Supplier Partner (demo org)', slug: 'sample-supplier-partner', type: 'SUPPLIER' } })
  const integrationOrg = await prisma.organization.upsert({ where: { slug: 'hair-passport-integration' }, update: {}, create: { name: 'Hair Passport integration (mock)', slug: 'hair-passport-integration', type: 'INTEGRATION' } })

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.test').toLowerCase()
  let adminPassword = process.env.SEED_ADMIN_PASSWORD
  let generated = false
  if (!adminPassword) { adminPassword = `Sii-${randomBytes(12).toString('base64url')}!9`; generated = true }
  const policy = passwordPolicyErrors(adminPassword)
  if (policy.length) throw new Error(`SEED_ADMIN_PASSWORD rejected: ${policy.join(' ')}`)
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    admin = await prisma.user.create({ data: { email: adminEmail, name: 'Platform administrator', passwordHash: await hashPassword(adminPassword), organizationId: internal.id, roles: { create: [{ role: 'SUPER_ADMIN' }] } } })
    log(`admin user created: ${adminEmail}${generated ? ` — generated password (shown once): ${adminPassword}` : ' (password from SEED_ADMIN_PASSWORD)'}`)
  }
  const actor: Principal = { id: admin.id, organizationId: internal.id, roles: ['SUPER_ADMIN'], kind: 'USER', label: adminEmail }

  if (demoUsers) {
    const demoPw = await hashPassword(process.env.SEED_DEMO_PASSWORD ?? 'DemoUser!2026-local')
    const roles: Role[] = ['DATA_ADMIN', 'COSMETIC_CHEMIST', 'RESEARCH_SCIENTIST', 'DERMATOLOGIST_REVIEWER', 'TRICHOLOGIST_REVIEWER', 'REGULATORY_REVIEWER', 'PATENT_REVIEWER', 'DATA_ANNOTATOR', 'READ_ONLY_RESEARCHER']
    for (const role of roles) {
      const email = `${role.toLowerCase().replace(/_/g, '-')}@demo.sii.local`
      const u = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name: `Demo ${role.toLowerCase().replace(/_/g, ' ')}`, passwordHash: demoPw, organizationId: internal.id, roles: { create: [{ role }] } } })
      if (role.endsWith('REVIEWER') || role === 'COSMETIC_CHEMIST' || role === 'RESEARCH_SCIENTIST') {
        await prisma.reviewerProfile.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, profession: 'DEMO ACCOUNT — not a real reviewer', verificationStatus: 'UNVERIFIED', expertise: [] } })
      }
    }
    await prisma.user.upsert({ where: { email: 'brand-partner@demo.sii.local' }, update: {}, create: { email: 'brand-partner@demo.sii.local', name: 'Demo brand partner', passwordHash: demoPw, organizationId: partnerBrand.id, roles: { create: [{ role: 'BRAND_PARTNER' }] } } })
    await prisma.user.upsert({ where: { email: 'supplier-partner@demo.sii.local' }, update: {}, create: { email: 'supplier-partner@demo.sii.local', name: 'Demo supplier partner', passwordHash: demoPw, organizationId: partnerSupplier.id, roles: { create: [{ role: 'SUPPLIER_PARTNER' }] } } })
    log('demo users ready (development only): <role>@demo.sii.local / password from SEED_DEMO_PASSWORD or the documented dev default')
  }

  // ─── Sources ───
  const { sources } = load<{ sources: Record<string, unknown>[] }>('sources.json')
  const S: Record<string, string> = {}
  for (const s of sources) {
    const { key, ...rest } = s as { key: string } & Record<string, unknown>
    const row = await prisma.source.upsert({ where: { key }, update: {}, create: { key, ...(rest as object), approvedUses: (rest.approvedUses as string[]) ?? [], prohibitedUses: (rest.prohibitedUses as string[]) ?? [] } as never })
    S[key] = row.id
    await requestReview(actor, { entityType: 'Source', entityId: row.id, recordType: 'Source', title: `Data-rights review: ${row.name}` })
  }
  log(`sources: ${sources.length}`)

  for (const r of REVIEW_REQUIREMENTS) {
    await prisma.reviewRequirement.upsert({ where: { recordType: r.recordType }, update: {}, create: { recordType: r.recordType, reviewType: r.reviewType as never, requiredRoles: r.roles, approvalsRequired: r.approvals ?? 1, secondReviewer: r.second ?? false, blind: r.blind ?? false, dueInDays: r.days ?? 14, notes: r.notes } })
  }

  // ─── Taxonomies ───
  for (const [code, label] of FUNCTIONS) await prisma.functionTerm.upsert({ where: { code }, update: {}, create: { code, label } })
  for (const [code, , parent] of FUNCTIONS) if (parent) {
    const p = await prisma.functionTerm.findUniqueOrThrow({ where: { code: parent } })
    await prisma.functionTerm.update({ where: { code }, data: { parentId: p.id } })
  }
  for (const [slug, name] of Object.entries(FAMILY_NAMES)) await prisma.ingredientFamily.upsert({ where: { slug }, update: {}, create: { slug, name } })

  const onto = load<{ _meta: { ontologyVersion: string }; terms: Record<string, unknown>[] }>('ontology.json')
  for (const t of onto.terms) {
    const { parent, synonyms, allowedValues, ...rest } = t as { parent?: string; synonyms?: string[]; allowedValues?: object } & Record<string, unknown>
    await prisma.ontologyTerm.upsert({ where: { code: rest.code as string }, update: {}, create: { ...(rest as Record<string, unknown>), synonyms: synonyms ?? [], allowedValues: allowedValues ?? undefined, ontologyVersion: onto._meta.ontologyVersion } as never })
  }
  for (const t of onto.terms as { code: string; parent?: string }[]) if (t.parent) {
    const p = await prisma.ontologyTerm.findUniqueOrThrow({ where: { code: t.parent } })
    await prisma.ontologyTerm.update({ where: { code: t.code }, data: { parentId: p.id } })
  }
  log(`ontology terms: ${onto.terms.length}`)

  // ─── Ingredients ───
  const { ingredients } = load<{ ingredients: SeedIngredient[] }>('ingredients.json')
  const ING: Record<string, string> = {}
  let createdIng = 0
  for (const i of ingredients) {
    const ref = await prisma.externalRef.findUnique({ where: { sourceId_entityType_externalId: { sourceId: S['curator-seed'], entityType: 'ingredient', externalId: i.k } } })
    if (ref) { ING[i.k] = ref.entityId; continue }
    const aliases: { alias: string; type: AliasType }[] = (i.a ?? []).map((a) => ({ alias: a, type: MISSPELLINGS.has(normalizeName(a)) ? 'MISSPELLING' : /^[A-Z0-9]{2,6}$/.test(a) ? 'ABBREVIATION' : 'SYNONYM' }))
    for (const la of LABEL_ALIASES[i.k] ?? []) if (!aliases.some((x) => normalizeName(x.alias) === normalizeName(la))) aliases.push({ alias: la, type: 'LABEL_DISPLAY_NAME' })
    for (const x of aliases) if (LABEL_ALIASES[i.k]?.some((la) => normalizeName(la) === normalizeName(x.alias))) x.type = 'LABEL_DISPLAY_NAME'
    const isInci = !/\(.*unspecified\)|^Kelp Extract/.test(i.n)
    const ing = await prisma.$transaction(async (tx) => {
      const created = await createIngredient(actor, {
        slug: i.k, canonicalName: i.n, inciName: isInci ? i.n : null, displayName: i.c ? `${i.c}` : i.n, commonName: i.c ?? null,
        identityType: i.t as IdentityType, materialType: i.m as MaterialType, originType: i.o as OriginType, familySlug: i.f,
        priorityTier: i.p ?? null, priorityReason: i.r ?? null, identityNote: i.identityNote ?? null, aliases, sourceId: S['curator-seed'],
      }, tx)
      if (i.b) {
        const bs = await tx.botanicalSource.upsert({ where: { genus_species: { genus: i.b[0], species: i.b[1] } }, update: {}, create: { genus: i.b[0], species: i.b[1] } })
        await tx.complexMaterialProfile.create({ data: { ingredientId: created.id, botanicalSourceId: bs.id, plantPart: i.b[2], sourceId: S['curator-seed'] } })
      }
      for (const code of i.fn) {
        const fn = await tx.functionTerm.findUniqueOrThrow({ where: { code } })
        await tx.ingredientFunction.create({ data: { ingredientId: created.id, functionId: fn.id, sourceId: S['curator-seed'], basis: 'CURATOR_PROPOSED', entryMode: 'AI_EXTRACTED', confidence: 0.6 } })
      }
      await tx.externalRef.create({ data: { sourceId: S['curator-seed'], entityType: 'ingredient', externalId: i.k, entityId: created.id, contentHash: 'seed' } })
      return created
    }, { timeout: 60_000 })
    ING[i.k] = ing.id
    createdIng++
  }
  log(`ingredients: ${ingredients.length} (${createdIng} created this run)`)

  for (const [from, to, type, notes] of RELATIONS) {
    if (!ING[from] || !ING[to]) continue
    await prisma.ingredientRelation.upsert({ where: { fromId_toId_relationType: { fromId: ING[from], toId: ING[to], relationType: type as never } }, update: {}, create: { fromId: ING[from], toId: ING[to], relationType: type as never, interchangeable: false, notes, sourceId: S['curator-seed'] } })
    await upsertEdge(actor, { fromType: 'Ingredient', fromId: ING[from], toType: 'Ingredient', toId: ING[to], edgeType: 'DERIVED_FROM', sourceId: S['curator-seed'], confidence: 0.6, evidenceType: 'CURATOR_PROPOSED', properties: { relationType: type }, notes })
  }

  // ─── PubChem verification ───
  const snapshot = load<{ properties: Record<string, string | number>[] }>('pubchem-snapshot-2026-10-29.json').properties
  const rejected = load<{ rejectedCuratorCandidates: Record<string, number> }>('pubchem-rejected-candidates.json').rejectedCuratorCandidates
  const byCid = new Map(snapshot.map((p) => [Number(p.CID), p]))
  let verified = 0, needsReview = 0, facts = 0
  for (const i of ingredients) {
    if (!i.cid) continue
    const p = byCid.get(i.cid)
    if (!p) continue
    const ingId = ING[i.k]
    if (await prisma.ingredientIdentifier.findFirst({ where: { ingredientId: ingId, type: 'PUBCHEM_CID' } })) continue
    const names = [i.n, i.c, ...(i.a ?? [])].filter(Boolean).map((x) => normalizeName(x!))
    const title = normalizeName(String(p.Title))
    const nameMatches = names.some((n) => n === title || title.includes(n) || n.includes(title))
    const status = i.cidOrigin === 'PUBCHEM_NAME_LOOKUP' || nameMatches ? 'VERIFIED' : 'NEEDS_REVIEW'
    status === 'VERIFIED' ? verified++ : needsReview++
    const representative = REPRESENTATIVE.has(i.k) || !DEFINED.has(i.t)
    const loc = `PUG REST property table, CID ${i.cid} (PubChem title: "${p.Title}")`
    const base = { ingredientId: ingId, sourceId: S['pubchem'], sourceLocation: loc, isRepresentative: representative }
    await addIdentifier(actor, { ...base, type: 'PUBCHEM_CID', value: String(i.cid), verificationStatus: status, confidence: status === 'VERIFIED' ? 0.95 : 0.6 })
    await addIdentifier(actor, { ...base, type: 'INCHIKEY', value: String(p.InChIKey), verificationStatus: status, confidence: 0.95 })
    if (p.InChI) await addIdentifier(actor, { ...base, type: 'INCHI', value: String(p.InChI), verificationStatus: status })
    if (p.SMILES) await addIdentifier(actor, { ...base, type: 'SMILES', value: String(p.SMILES), verificationStatus: status })
    await addIdentifier(actor, { ...base, type: 'MOLECULAR_FORMULA', value: String(p.MolecularFormula), verificationStatus: status })
    const fact = (propertyType: Parameters<typeof createFact>[1]['propertyType'], value: unknown, unit: string, cond: string) =>
      value === undefined || value === null || value === '' ? null : createFact(actor, { ingredientId: ingId, propertyType, value: String(value), unit, sourceId: S['pubchem'], sourceLocation: loc, entryMode: 'IMPORTED', confidence: 0.9, testConditions: cond, extractionMethod: 'PubChem computed property' }).then(() => facts++)
    await fact('MOLECULAR_WEIGHT', p.MolecularWeight, 'g/mol', representative ? 'Computed for the representative structure only' : 'Computed by PubChem')
    await fact('EXACT_MASS', p.ExactMass, 'g/mol', 'Computed monoisotopic mass')
    await fact('PARTITION_COEFFICIENT', p.XLogP, 'dimensionless', 'XLogP3 computed descriptor — not a measured log P')
    await fact('CHARGE', p.Charge, 'e', 'Formal charge of the deposited structure')
    await fact('TOPOLOGICAL_POLAR_SURFACE_AREA', p.TPSA, 'Å²', 'Computed descriptor')
    await fact('H_BOND_DONOR_COUNT', p.HBondDonorCount, 'count', 'Computed descriptor')
    await fact('H_BOND_ACCEPTOR_COUNT', p.HBondAcceptorCount, 'count', 'Computed descriptor')
    if (status === 'NEEDS_REVIEW') {
      await prisma.quarantineItem.upsert({ where: { dedupeKey: `pubchem-title:${i.k}` }, update: {}, create: { queue: 'IDENTIFIER_MISMATCH', entityType: 'Ingredient', entityId: ingId, dedupeKey: `pubchem-title:${i.k}`, payload: { cid: i.cid, pubchemTitle: p.Title, ingredient: i.n }, reason: `PubChem title "${p.Title}" does not textually match "${i.n}"; reviewer must confirm the CID represents this ingredient.` } })
    }
  }
  for (const [k, badCid] of Object.entries(rejected)) {
    if (!ING[k]) continue
    const exists = await prisma.identityResolutionEvent.findFirst({ where: { primaryIngredientId: ING[k], type: 'IDENTIFIER_REJECTED' } })
    if (exists) continue
    await prisma.identityResolutionEvent.create({ data: { type: 'IDENTIFIER_REJECTED', primaryIngredientId: ING[k], snapshot: { type: 'PUBCHEM_CID', rejectedValue: badCid, reason: 'Curator-proposed CID resolved to a different compound in PubChem; replaced by a PubChem name lookup.' }, reason: 'PubChem verification mismatch', actorId: admin.id } })
    await prisma.quarantineItem.upsert({ where: { dedupeKey: `rejected-cid:${k}` }, update: {}, create: { queue: 'IDENTIFIER_MISMATCH', entityType: 'Ingredient', entityId: ING[k], dedupeKey: `rejected-cid:${k}`, payload: { rejectedCid: badCid }, reason: `Candidate CID ${badCid} did not match this ingredient in PubChem.`, status: 'RESOLVED', resolution: 'Rejected; replaced by PubChem name-lookup CID (verified by title).', resolvedAt: new Date() } })
  }
  log(`pubchem: ${verified} verified, ${needsReview} need review, ${facts} facts, ${Object.keys(rejected).length} rejected candidate CIDs recorded`)

  // ─── EU CosIng inventory (22k INCI; batched, idempotent) ───
  const cos = await importCosing(actor, S['eu-cosing-obf'])
  log(`cosing: ${cos.rows} rows, ${cos.skipped} already present (${cos.refreshed} refreshed), ${cos.linked} linked to curated records, ${cos.created} created, ${cos.identifiers} identifiers, ${cos.casRejected} CAS failed checksum, ${cos.regulatory} EU annex records (${cos.seconds.toFixed(1)}s)`)
  // Official 2016 CosIng export: only the records missing from the snapshot above (see scripts/convert-cosing-export.py).
  const sup = await importCosing(actor, S['eu-cosing-export-2016'], path.join(__dirname, 'data', 'cosing', 'cosing-export-2016-supplement.json.gz'))
  log(`cosing 2016 export supplement: ${sup.rows} rows, ${sup.skipped} already present, ${sup.linked} linked to existing records, ${sup.created} created, ${sup.regulatory} EU annex records`)
  log(`derived classes refreshed: ${await refreshDerivedClasses()}`)

  // CosIng lists the same substance (CAS 7732-18-5) under AQUA (EU INCI) and WATER (US INCI name). Curator decision:
  // merge WATER into AQUA. Reversible via identity unmerge; recorded as an identity event and in the audit log.
  const [aqua, water] = await Promise.all([prisma.ingredient.findFirst({ where: { cosingRef: '31959' } }), prisma.ingredient.findFirst({ where: { cosingRef: '92472' } })])
  if (aqua && water && aqua.status === 'ACTIVE' && water.status === 'ACTIVE') {
    await merge(actor, aqua.id, water.id, 'Same substance (CAS 7732-18-5): WATER is the US INCI name for AQUA. Curator decision; reversible.')
    log('identity: merged WATER (CosIng 92472) into AQUA (CosIng 31959)')
  }

  // ─── Functions & families in the graph ───
  for (const i of ingredients) {
    const fam = await prisma.ingredientFamily.findUnique({ where: { slug: i.f } })
    if (fam) await upsertEdge(actor, { fromType: 'Ingredient', fromId: ING[i.k], toType: 'IngredientFamily', toId: fam.id, edgeType: 'MEMBER_OF', sourceId: S['curator-seed'], confidence: 0.7, evidenceType: 'CURATOR_PROPOSED' })
    for (const code of i.fn) {
      const fn = await prisma.functionTerm.findUniqueOrThrow({ where: { code } })
      await upsertEdge(actor, { fromType: 'Ingredient', fromId: ING[i.k], toType: 'Function', toId: fn.id, edgeType: 'HAS_FUNCTION', sourceId: S['curator-seed'], confidence: 0.6, evidenceType: 'CURATOR_PROPOSED' })
    }
  }

  // ─── Products, evidence, patents, regulatory — through the import engine ───
  const run = async (sourceKey: string, entityType: string, rows: object[], filename: string) => {
    const job = await createImportJob(actor, { sourceId: S[sourceKey], kind: 'SEED', entityType, filename, content: JSON.stringify(rows) })
    const done = await runImportJob(job.id, actor)
    log(`import ${entityType}/${sourceKey}: ${done.status} created=${done.createdCount} updated=${done.updatedCount} unchanged=${done.unchangedCount} dup=${done.duplicateCount} rejected=${done.rejectedCount} unresolved=${done.unresolvedCount} warnings=${done.warningCount}`)
  }
  const products = load<{ products: Record<string, unknown>[] }>('products.json').products
  const productRows = (sn: boolean) => products.filter((p) => Boolean(p.isSupernatural) === sn).map((p) => ({
    slug: p.key, brand: p.brand, name: p.name, category: p.category, market: p.market, application_type: p.applicationType, is_supernatural: p.isSupernatural, barcode: p.barcode ?? '',
    purchase_url: p.purchaseUrl ?? p.sourceUrl, source_url: p.sourceUrl, ingredient_list: p.ingredientList, ingredient_list_source: p.ingredientListSource, valid_from: '2026-10-29',
    marketing_excerpts: (p.marketingExcerpts as string[] | undefined) ?? [], data_quality_notes: (p.dataQualityNotes as string[] | undefined) ?? [],
  }))
  await run('shcbeauty', 'product', productRows(true), 'products.json#supernatural')
  await run('manufacturer-labels', 'product', productRows(false), 'products.json#textured-hair')
  const rm = await rematchUnresolvedLines(actor)
  log(`product lines re-matched: ${rm.upgraded} of ${rm.checked} unresolved lines now matched exactly`)

  const evidence = load<{ evidence: Record<string, unknown>[] }>('evidence.json').evidence
  await run('pubmed-metadata', 'evidence', evidence.map((e) => ({
    title: e.title, pmid: e.pmid, doi: e.doi ?? '', pmcid: e.pmcid ?? '', study_type: e.studyType, evidence_level: e.level ?? '', ingredients: e.ingredients, outcomes: e.outcomes, direction: e.direction,
    textured_hair: e.texturedHair === true, medical_context: e.medicalContext === true, safety_relevant: e.safetyRelevant === true, entry_mode: 'AI_EXTRACTED',
    limitations: [e.limitationsNote, e.fundingNote, e.statementNote, e.medicalContext ? 'Medical/drug-context study: findings cannot support cosmetic claims.' : null].filter(Boolean).join(' '),
  })), 'evidence.json')

  const patents = load<{ patents: Record<string, unknown>[] }>('patents.json').patents
  await run('patent-search-discovery', 'patent', patents.map((p) => ({ publication_number: p.number, title: p.title, ingredients: p.ingredients, topics: p.topics, entry_mode: 'IMPORTED' })), 'patents.json')

  const reg = load<{ rows: Record<string, unknown>[] }>('regulatory.json').rows
  for (const src of [...new Set(reg.map((r) => r.source as string))]) await run(src, 'regulatory', reg.filter((r) => r.source === src), `regulatory.json#${src}`)

  // ─── Literature-tested concentrations (verbatim from cited titles/snippets) ───
  const tested: [string, number, string, string, string][] = [
    ['tea-tree-leaf-oil', 5, 'shampoo', '12451368', 'Treatment of dandruff with 5% tea tree oil shampoo.'],
    ['zinc-pyrithione', 1, 'shampoo', '18498517', '1% zinc pyrithione shampoo (comparator arm).'],
    ['piroctone-olamine', 1, 'shampoo', '18498517', '1% piroctone olamine shampoo.'],
    ['piroctone-olamine', 0.75, 'shampoo', '18503415', '0.75% piroctone olamine with 2% salicylic acid.'],
    ['salicylic-acid', 2, 'shampoo', '18503415', '2% salicylic acid with 0.75% piroctone olamine.'],
    ['piroctone-olamine', 0.5, 'shampoo', '21272039', '0.5% piroctone olamine with 0.45% climbazole.'],
    ['climbazole', 0.45, 'shampoo', '21272039', '0.45% climbazole with 0.5% piroctone olamine.'],
    ['peppermint-oil', 3, 'topical (animal study)', '25584150', '3% peppermint oil applied topically in mice.'],
  ]
  for (const [k, v, cat, pmid, note] of tested) {
    const ev = await prisma.evidence.findUnique({ where: { pmid } })
    const exists = await prisma.concentrationRecord.findFirst({ where: { ingredientId: ING[k], recordType: 'LITERATURE_TESTED', sourceLocation: `PMID ${pmid}`, typicalValue: v } })
    if (exists || !ev) continue
    await prisma.concentrationRecord.create({ data: { ingredientId: ING[k], recordType: 'LITERATURE_TESTED', typicalValue: v, unit: '% (basis not stated in metadata)', basis: 'UNKNOWN', productCategory: cat, applicationType: cat === 'shampoo' ? 'RINSE_OFF' : 'UNKNOWN', applicationSite: 'SCALP', sourceId: S['literature-derived'], sourceLocation: `PMID ${pmid}`, testConditions: note, entryMode: 'AI_EXTRACTED', notes: 'Tested level in a cited study — not a recommendation, not a regulatory limit.' } })
  }

  // ─── Safety review records (literature-derived; not official panel conclusions unless stated) ───
  const safety: [string, string, string, string, string, boolean][] = [
    ['panthenol', 'CIR', 'OVERALL_CONCLUSION', '36177798', 'CIR Expert Panel safety assessment of panthenol, pantothenic acid and derivatives as used in cosmetics. Conclusion text not extracted — consult the source.', false],
    ['methylisothiazolinone', 'LITERATURE', 'SENSITIZATION', '21504436', 'Published patch-test data document contact allergy to MI, including dose–response studies.', true],
    ['methylisothiazolinone', 'LITERATURE', 'SENSITIZATION', '26536492', 'Patch-test series reporting MI and MCI/MI contact allergy prevalence.', true],
    ['methylchloroisothiazolinone', 'LITERATURE', 'SENSITIZATION', '26536492', 'Patch-test series reporting MCI/MI contact allergy prevalence.', true],
    ['limonene', 'LITERATURE', 'SENSITIZATION', '27896835', 'Oxidized limonene (hydroperoxides) reported as a common contact allergen in patch-test studies.', false],
    ['linalool', 'LITERATURE', 'SENSITIZATION', '24702129', 'Oxidized linalool (hydroperoxides) reported as a frequent contact allergen in the UK.', false],
    ['cocamidopropyl-betaine', 'LITERATURE', 'SENSITIZATION', '22364510', 'Contact allergy attributed largely to manufacturing impurities (DMAPA, amidoamine); raw-material purity matters.', false],
    ['comfrey-extract', 'LITERATURE', 'OTHER', '37630423', 'Comfrey contains hepatotoxic pyrrolizidine alkaloids; content varies by plant part and source. Plant part on Supernatural labels is unspecified.', true],
    ['comfrey-leaf-extract', 'LITERATURE', 'OTHER', '37630423', 'Pyrrolizidine alkaloid content measured in comfrey roots and leaves; topical safety question unresolved.', true],
    ['sodium-lauryl-sulfate', 'LITERATURE', 'IRRITATION', '27332687', 'SLS is a standard model irritant in human skin-irritation studies.', false],
  ]
  for (const [k, body, endpoint, pmid, conclusion, high] of safety) {
    if (await prisma.safetyReview.findFirst({ where: { ingredientId: ING[k], url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` } })) continue
    const sr = await prisma.safetyReview.create({ data: { ingredientId: ING[k], reviewBody: body, endpoint: endpoint as never, conclusion, exposureRoute: 'Dermal / scalp (topical)', evidenceStrength: 'Not assessed', sourceId: S['pubmed-metadata'], url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, highRisk: high, entryMode: 'AI_EXTRACTED' } })
    await requestReview(actor, { entityType: 'SafetyReview', entityId: sr.id, recordType: 'SafetyReview', title: `Safety review: ${k} (${endpoint.toLowerCase()})`, priority: high ? 'HIGH' : 'NORMAL' })
  }

  // ─── Sample suppliers, raw materials, formulas ───
  const sample = load<{ formulas: { code: string; name: string; productCategory: string; applicationType: string; targetPh: number | null; intendedGoals: string[]; intendedPhenotypeCodes: string[]; notes: string; lines: { ref: string; percent: number | 'qs'; phase: string; role: string }[] }[]; rawMaterials: { key: string; tradeName: string; activePercent: number | null; activePercentConfirmed: boolean; declaredComposition: string; components: [string, number | null, number | null, string][] }[] }>('sample-formulas.json')
  const supplier = await prisma.supplier.upsert({ where: { name: 'Sample Supplier A (placeholder, not a real company)' }, update: {}, create: { name: 'Sample Supplier A (placeholder, not a real company)', type: 'BOTH', notes: 'Placeholder for testing supplier workflows.' } })
  await reindexSupplier(supplier.id)
  const RM: Record<string, string> = {}
  for (const r of sample.rawMaterials) {
    const existing = await prisma.rawMaterial.findFirst({ where: { ownerOrgId: internal.id, tradeName: r.tradeName } })
    const rm = existing ?? await prisma.rawMaterial.create({ data: { tradeName: r.tradeName, supplierId: supplier.id, declaredComposition: r.declaredComposition, activePercent: r.activePercent, activePercentConfirmed: r.activePercentConfirmed, isSample: true, ownerOrgId: internal.id, visibility: 'RESTRICTED', internalApprovalStatus: 'DRAFT', components: { create: r.components.map(([k, min, max, role]) => ({ ingredientId: ING[k], percentMin: min, percentMax: max, role, confirmed: false })) } } })
    RM[r.key] = rm.id
    if (!existing) {
      for (const [k] of r.components) await upsertEdge(actor, { fromType: 'RawMaterial', fromId: rm.id, toType: 'Ingredient', toId: ING[k], edgeType: 'CONTAINS', sourceId: S['internal-sample-data'], confidence: 0.5, evidenceType: 'SAMPLE_DATA' })
      await upsertEdge(actor, { fromType: 'RawMaterial', fromId: rm.id, toType: 'Supplier', toId: supplier.id, edgeType: 'SUPPLIED_BY', sourceId: S['internal-sample-data'], confidence: 0.5, evidenceType: 'SAMPLE_DATA' })
      await reindexRawMaterial(rm.id)
    }
  }
  for (const f of sample.formulas) {
    if (await prisma.formula.findUnique({ where: { ownerOrgId_code: { ownerOrgId: internal.id, code: f.code } } })) continue
    const { formula, validation } = await createFormula(actor, {
      code: f.code, name: f.name, isSample: true, visibility: 'RESTRICTED', productCategory: f.productCategory, applicationType: f.applicationType as never, targetPh: f.targetPh,
      intendedGoals: f.intendedGoals, intendedPhenotypeCodes: f.intendedPhenotypeCodes, notes: f.notes,
      lines: f.lines.map((l) => {
        const isRm = l.ref.startsWith('rm:')
        const name = isRm ? sample.rawMaterials.find((r) => r.key === l.ref.slice(3))!.tradeName : ingredients.find((x) => x.k === l.ref)!.n
        return { ingredientId: isRm ? null : ING[l.ref], rawMaterialId: isRm ? RM[l.ref.slice(3)] : null, displayName: name, percent: l.percent === 'qs' ? null : l.percent, isQs: l.percent === 'qs', phase: l.phase, functionalRole: l.role }
      }),
    })
    if (!validation.valid) log(`WARNING sample formula ${f.code} invalid: ${validation.errors.join('; ')}`)
    for (const code of f.intendedPhenotypeCodes) {
      const term = await prisma.ontologyTerm.findUnique({ where: { code } })
      if (term) await upsertEdge(actor, { fromType: 'Formula', fromId: formula.id, toType: term.domain === 'SCALP' ? 'ScalpPhenotype' : 'HairPhenotype', toId: term.id, edgeType: 'TARGETS_PHENOTYPE', sourceId: S['internal-sample-data'], confidence: 0.3, evidenceType: 'SAMPLE_DATA', notes: 'Intended target of an illustrative sample formula — not evidence of effect.' })
    }
  }
  log(`sample raw materials: ${sample.rawMaterials.length}, sample formulas: ${sample.formulas.length}`)

  // ─── Demo research candidate (confidential) ───
  const rc = await prisma.researchCandidate.upsert({
    where: { code: 'SN-001' }, update: {},
    create: { code: 'SN-001', title: 'DEMO — illustrative record for testing IP access controls', description: 'Demonstration record only. Not a real research candidate, hypothesis or discovery.', candidateType: 'ingredient combination', origin: 'demo', discoveryMethod: 'none (demo)', hypothesis: 'None — demo record.', ownerOrgId: internal.id, visibility: 'CONFIDENTIAL_IP', createdById: admin.id },
  })
  await reindexResearchCandidate(rc.id)

  // ─── Hair Passport mock batch ───
  const mock = load<{ contractVersion: string; isMock: boolean; taxonomyMappings: { externalTaxonomy: string; externalVersion: string; externalCode: string; term: string }[]; records: unknown[] }>('mock-hair-passport-batch.json')
  for (const m of mock.taxonomyMappings) {
    const term = await prisma.ontologyTerm.findUniqueOrThrow({ where: { code: m.term } })
    await prisma.taxonomyMapping.upsert({ where: { externalSystem_externalTaxonomy_externalVersion_externalCode: { externalSystem: 'hair-passport', externalTaxonomy: m.externalTaxonomy, externalVersion: m.externalVersion, externalCode: m.externalCode } }, update: {}, create: { externalSystem: 'hair-passport', externalTaxonomy: m.externalTaxonomy, externalVersion: m.externalVersion, externalCode: m.externalCode, ontologyTermId: term.id, mappingVersion: 'mapping-0.1.0', notes: 'Mock mapping (Hair Passport schema not final).' } })
  }
  if ((await prisma.integrationBatch.count()) === 0) {
    const key = await createApiKey({ name: 'Hair Passport mock integration (seed)', organizationId: integrationOrg.id, scopes: ['integration:manage'], createdById: admin.id })
    const integrationActor: Principal = { id: key.id, organizationId: integrationOrg.id, roles: ['SUPER_ADMIN'], kind: 'API_KEY', scopes: ['integration:manage'], label: `api-key:${key.prefix}` }
    const res = await processBatch(integrationActor, { contractVersion: mock.contractVersion, isMock: true, records: mock.records })
    log(`mock Hair Passport batch: ${res.results.map((r) => r.status).join(', ')}`)
  }

  // ─── Identity-resolution candidates ───
  const proposed = await proposeDuplicates()
  for (const [a, b, reason] of [['comfrey-extract', 'comfrey-leaf-extract', 'Label "Comfrey Extract" (part unspecified) vs Symphytum Officinale Leaf Extract'], ['matricaria-flower-extract', 'anthemis-nobilis-flower-extract', 'Both appear as "Chamomile" on labels; different species']] as const) {
    const [x, y] = [ING[a], ING[b]].sort()
    await prisma.identityResolutionCandidate.upsert({ where: { ingredientAId_ingredientBId: { ingredientAId: x, ingredientBId: y } }, update: {}, create: { ingredientAId: x, ingredientBId: y, reason, score: null } })
  }
  log(`identity candidates proposed: ${proposed}`)

  // ─── Priority tiers & ingestion queue ───
  const lines = await prisma.productIngredient.findMany({ where: { ingredientId: { not: null }, productVersion: { validTo: null } }, include: { productVersion: { include: { product: true } } } })
  const appearances = new Map<string, { sn: Set<string>; other: Set<string> }>()
  for (const l of lines) {
    const a = appearances.get(l.ingredientId!) ?? { sn: new Set(), other: new Set() }
    ;(l.productVersion.product.isSupernatural ? a.sn : a.other).add(l.productVersion.product.name)
    appearances.set(l.ingredientId!, a)
  }
  for (const i of ingredients) {
    const id = ING[i.k]
    const a = appearances.get(id)
    const tier = a?.sn.size ? 1 : a?.other.size ? 3 : (i.p ?? 4)
    const reason = a?.sn.size ? `Used in Supernatural product(s): ${[...a.sn].join(', ')}` : a?.other.size ? `Appears in textured-hair product(s): ${[...a.other].join(', ')}` : (i.r ?? 'Priority category ingredient')
    await prisma.ingredient.update({ where: { id }, data: { priorityTier: tier, priorityReason: reason } })
    const ev = await prisma.evidenceLink.count({ where: { ingredientId: id } })
    const regs = await prisma.regulatoryRecord.findMany({ where: { ingredientId: id, supersededAt: null } })
    const ids = await prisma.ingredientIdentifier.count({ where: { ingredientId: id, verificationStatus: 'VERIFIED' } })
    const factsN = await prisma.ingredientFact.count({ where: { ingredientId: id } })
    const data = {
      label: i.n, priorityTier: tier, reason, supernaturalProducts: [...(a?.sn ?? [])], hairPassportAppearances: 0, texturedProductAppearances: a?.other.size ?? 0,
      hairGoals: [], evidenceAvailability: ev ? 'METADATA' : 'NONE', regulatoryReviewPriority: tier === 6 || regs.some((r) => r.status !== 'ALLOWED') ? 'HIGH' : tier === 1 ? 'HIGH' : 'NORMAL',
      importStatus: factsN ? 'FACTS_IMPORTED' : ids ? 'IDENTIFIERS_VERIFIED' : 'IDENTITY_ONLY',
    }
    await prisma.ingestionQueueItem.upsert({ where: { ingredientId: id }, update: data, create: { ingredientId: id, ...data } })
    await reindexIngredient(id)
  }
  log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
