import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { createApiKey } from '@/lib/auth/api-keys'
import * as ingredients from '@/app/api/v1/ingredients/route'
import * as ingredientFacts from '@/app/api/v1/ingredients/[id]/facts/route'
import * as formulas from '@/app/api/v1/formulas/route'
import * as formula from '@/app/api/v1/formulas/[id]/route'
import * as outcomes from '@/app/api/v1/outcomes/route'
import * as rc from '@/app/api/v1/research-candidates/route'
import * as products from '@/app/api/v1/products/route'
import { ingredientBySlug, internalOrgId, uid } from './fixtures'

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
async function call(h: Handler, key: string | null, path: string, init: RequestInit = {}, params: Record<string, string> = {}) {
  const headers = new Headers(init.headers)
  if (key) headers.set('authorization', `Bearer ${key}`)
  if (init.body) headers.set('content-type', 'application/json')
  const res = await h(new Request(`http://localhost/api/v1${path}`, { ...init, headers }), { params: Promise.resolve(params) })
  return { status: res.status, body: await res.json() }
}
const key = async (org: string, scopes: string[]) => (await createApiKey({ name: `t-${uid()}`, organizationId: org === 'supernatural' ? await internalOrgId() : (await prisma.organization.findUniqueOrThrow({ where: { slug: org } })).id, scopes })).key

describe('versioned API', () => {
  it('requires authentication and the right scope', async () => {
    expect((await call(ingredients.GET, null, '/ingredients')).status).toBe(401)
    expect((await call(ingredients.GET, 'sii_00000000_bogus', '/ingredients')).status).toBe(401)
    const k = await key('supernatural', ['search:read'])
    const r = await call(ingredients.GET, k, '/ingredients')
    expect(r.status).toBe(403)
    expect(r.body.error.code).toBe('FORBIDDEN')
  })

  it('lists and searches ingredients with cursor pagination and match explanations', async () => {
    const k = await key('supernatural', ['ingredient:read'])
    const p1 = await call(ingredients.GET, k, '/ingredients?limit=5')
    expect(p1.body.data).toHaveLength(5)
    const p2 = await call(ingredients.GET, k, `/ingredients?limit=5&cursor=${p1.body.nextCursor}`)
    expect(p2.body.data[0].id).not.toBe(p1.body.data[0].id)
    const s = await call(ingredients.GET, k, '/ingredients?q=glycerine')
    expect(s.body.data[0].slug).toBe('glycerin')
    expect(s.body.data[0].match.why).toBeTruthy()
  })

  it('withholds facts from sources that do not permit external API use', async () => {
    const gly = await ingredientBySlug('glycerin')
    const internal = await call(ingredientFacts.GET, await key('supernatural', ['ingredient:read']), `/ingredients/${gly.id}/facts`, {}, { id: gly.id })
    const partner = await call(ingredientFacts.GET, await key('sample-brand-partner', ['ingredient:read']), `/ingredients/${gly.id}/facts`, {}, { id: gly.id })
    expect(internal.body.data.length).toBeGreaterThan(0)
    expect(partner.body.withheld).toBe(internal.body.data.length)
    expect(partner.body.data).toHaveLength(0)
  })

  it('validates request bodies and returns structured errors', async () => {
    const gly = await ingredientBySlug('glycerin')
    const k = await key('supernatural', ['fact:write', 'ingredient:read'])
    const bad = await call(ingredientFacts.POST, k, `/ingredients/${gly.id}/facts`, { method: 'POST', body: JSON.stringify({ propertyType: 'NOT_A_PROPERTY' }) }, { id: gly.id })
    expect(bad.status).toBe(422)
    expect(bad.body.error.code).toBe('VALIDATION_FAILED')
    const dup = await call(ingredients.POST, await key('supernatural', ['ingredient:write']), '/ingredients', { method: 'POST', body: JSON.stringify({ canonicalName: 'Glycerin', identityType: 'DEFINED_SUBSTANCE', materialType: 'SMALL_MOLECULE' }) })
    expect(dup.status).toBe(409)
    expect(dup.body.error.details.existingId).toBe(gly.id)
  })

  it('formulas: partner keys see none of Supernatural’s; a direct id returns 404, not 403', async () => {
    const internal = await call(formulas.GET, await key('supernatural', ['formula:read', 'formula:private:read']), '/formulas?limit=100')
    expect(internal.body.data.length).toBeGreaterThan(0)
    const pk = await key('sample-brand-partner', ['formula:read', 'formula:private:read'])
    const partner = await call(formulas.GET, pk, '/formulas?limit=100')
    expect(partner.body.data.filter((f: { id: string }) => internal.body.data.some((g: { id: string }) => g.id === f.id))).toHaveLength(0)
    const id = internal.body.data[0].id
    expect((await call(formula.GET, pk, `/formulas/${id}`, {}, { id })).status).toBe(404)
  })

  it('research candidates are scoped to the caller’s organization', async () => {
    const internal = await call(rc.GET, await key('supernatural', ['ip:read']), '/research-candidates')
    expect(internal.body.data.map((r: { code: string }) => r.code)).toContain('SN-001')
    const partner = await call(rc.GET, await key('sample-brand-partner', ['ip:read']), '/research-candidates')
    expect(partner.body.data).toHaveLength(0)
  })

  it('outcomes exclude mock data by default and always carry the non-causal notice', async () => {
    const k = await key('supernatural', ['outcome:participant:read'])
    const def = await call(outcomes.GET, k, '/outcomes?limit=100')
    expect(def.body.data.every((o: { isMock: boolean }) => !o.isMock)).toBe(true)
    expect(def.body.notice).toMatch(/does not establish causation/)
    const mock = await call(outcomes.GET, k, '/outcomes?includeMock=true&limit=100')
    expect(mock.body.data.length).toBeGreaterThan(0)
    expect(JSON.stringify(mock.body)).not.toMatch(/participantRef|hp-mock-participant/)
  })

  it('product creation detects duplicates', async () => {
    const k = await key('supernatural', ['product:write', 'product:read'])
    const body = { brand: 'API Test', name: `API product ${uid()}`, ingredientList: 'Water, Glycerin' }
    expect((await call(products.POST, k, '/products', { method: 'POST', body: JSON.stringify(body) })).status).toBe(201)
    const again = await call(products.POST, k, '/products', { method: 'POST', body: JSON.stringify(body) })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('POSSIBLE_DUPLICATE')
  })
})
