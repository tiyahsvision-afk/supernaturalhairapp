// OpenAPI 3.1 description of the private v1 API (served at /api/v1/openapi.json).
const op = (summary: string, scope: string, extra: Record<string, unknown> = {}) => ({ summary, 'x-scope': scope, security: [{ bearer: [] }, { session: [] }], responses: { '200': { description: 'OK' }, '401': { $ref: '#/components/responses/Error' }, '403': { $ref: '#/components/responses/Error' }, '429': { $ref: '#/components/responses/Error' } }, ...extra })
const q = (name: string, description: string) => ({ name, in: 'query', required: false, schema: { type: 'string' }, description })
const page = [q('limit', 'Page size (1–100, default 25)'), q('cursor', 'Opaque cursor from nextCursor')]

export const OPENAPI = {
  openapi: '3.1.0',
  info: { title: 'Supernatural Ingredient Intelligence API', version: '1.0.0-phase1', description: 'Private research API. Records carry provenance (source, entry mode, review status). Records whose source rights block external use are withheld from partner keys (see "withheld" in responses). Regulatory data is jurisdiction-specific; patents are research aids, not legal opinions; observational data does not establish causation.' },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer', description: 'API key (sii_…)' }, session: { type: 'apiKey', in: 'cookie', name: 'sii_session' } },
    responses: { Error: { description: 'Structured error', content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} } } } } } } } },
  },
  paths: {
    '/ingredients': { get: op('List / search canonical ingredients', 'ingredient:read', { parameters: [q('q', 'Name, synonym, INCI, CAS, CID, InChIKey'), q('function', 'Function code'), q('jurisdiction', 'Has regulatory record in jurisdiction'), ...page] }), post: op('Create a canonical ingredient (enters identity review)', 'ingredient:write') },
    '/ingredients/{id}': { get: op('Ingredient identity, names, identifiers, functions, completeness', 'ingredient:read') },
    '/ingredients/{id}/facts': { get: op('Property facts with provenance and conflicts', 'ingredient:read'), post: op('Add a sourced fact (submitted for review)', 'fact:write') },
    '/ingredients/{id}/evidence': { get: op('Linked evidence', 'evidence:read') },
    '/ingredients/{id}/regulatory': { get: op('Jurisdiction-specific regulatory records incl. stale flags', 'ingredient:read') },
    '/ingredients/{id}/patents': { get: op('Patent mentions (research aid only)', 'patent:read') },
    '/formulas': { get: op('Formulas visible to the caller’s organization', 'formula:read', { parameters: page }) },
    '/formulas/{id}': { get: op('Formula with versions and validation summary', 'formula:read') },
    '/products': { get: op('Products with current ingredient-list version', 'product:read', { parameters: page }), post: op('Create product + parse ingredient list', 'product:write') },
    '/raw-materials': { get: op('Raw materials visible to the caller’s organization', 'rawmaterial:read', { parameters: page }) },
    '/evidence': { get: op('Evidence records', 'evidence:read', { parameters: [q('q', 'Title/PMID/DOI'), ...page] }) },
    '/patents': { get: op('Patent records', 'patent:read', { parameters: [q('q', 'Title/number'), ...page] }) },
    '/outcomes': { get: op('Consent-eligible, de-identified outcome observations (mock excluded by default)', 'outcome:participant:read', { parameters: [q('includeMock', 'true to include mock data'), ...page] }) },
    '/graph/query': { post: op('Neighborhood of a node: { type, id, edgeTypes?, limit? }', 'graph:read') },
    '/search': { get: op('Ranked search with match explanation', 'search:read', { parameters: [q('q', 'Query'), q('type', 'Entity type: ingredient, product, patent, evidence, supplier, raw_material, formula, research_candidate')] }) },
    '/imports': { get: op('Import jobs', 'import:run'), post: op('Create + start an import job: { sourceKey, entityType, format: csv|json, content }', 'import:run') },
    '/research-candidates': { get: op('Confidential research candidates of the caller’s organization', 'ip:read') },
    '/sources': { get: op('Source registry with data-rights fields', 'ingredient:read') },
    '/integrations/hair-passport/batches': { post: op('Hair Passport batch (contract hp-ii/0.1.0-draft) — mock/unvalidated', 'integration:manage') },
    '/integrations/hair-passport/withdrawals': { post: op('Participant withdrawal notice', 'integration:manage') },
  },
}
