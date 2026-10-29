import type { EdgeType, NodeType, Prisma } from '@prisma/client'
import { prisma } from '../db'
import { audit } from '../audit'
import type { Principal } from '../permissions'

// Graph abstraction. Phase 1 stores typed edges in PostgreSQL (GraphEdge) plus implicit edges derived from relational
// tables. All graph reads go through GraphStore so a graph database (e.g. Neo4j) can be added behind the same interface
// if traversal depth or volume later justifies it.

export interface GraphNode { type: NodeType; id: string; label: string; href?: string }
export interface GraphLink { id: string; from: string; to: string; edgeType: EdgeType | string; confidence: number; status: string; reviewStatus: string; source?: string | null; derived: boolean }

export interface GraphStore {
  neighborhood(principal: Principal, type: NodeType, id: string, opts?: { edgeTypes?: string[]; limit?: number }): Promise<{ nodes: GraphNode[]; links: GraphLink[] }>
}

type Tx = Prisma.TransactionClient | typeof prisma

export async function upsertEdge(actor: Principal | null, e: { fromType: NodeType; fromId: string; toType: NodeType; toId: string; edgeType: EdgeType; sourceId?: string | null; confidence: number; evidenceType?: string; notes?: string; properties?: Prisma.InputJsonValue }, tx: Tx = prisma) {
  if (e.confidence < 0 || e.confidence > 1) throw new Error('Edge confidence must be between 0 and 1.')
  const existing = await tx.graphEdge.findUnique({ where: { fromType_fromId_toType_toId_edgeType: { fromType: e.fromType, fromId: e.fromId, toType: e.toType, toId: e.toId, edgeType: e.edgeType } } })
  if (existing) return { edge: existing, created: false }
  const edge = await tx.graphEdge.create({ data: { ...e, createdById: actor?.kind === 'USER' ? actor.id : null, properties: e.properties ?? {} } })
  await audit(actor, { action: 'graph.edge.create', entityType: 'GraphEdge', entityId: edge.id, after: e, sourceId: e.sourceId ?? null }, tx)
  return { edge, created: true }
}

const href = (t: NodeType, id: string) => ({
  Ingredient: `/ingredients/${id}`, Product: `/products/${id}`, Formula: `/formulas/${id}`, Patent: `/patents/${id}`, Study: `/evidence/${id}`,
  RawMaterial: `/raw-materials/${id}`, Supplier: `/suppliers`, ResearchCandidate: `/research-candidates`,
} as Partial<Record<NodeType, string>>)[t]

async function labelsFor(nodes: { type: NodeType; id: string }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const by = (t: NodeType) => nodes.filter((n) => n.type === t).map((n) => n.id)
  const ing = await prisma.ingredient.findMany({ where: { id: { in: by('Ingredient') } }, select: { id: true, displayName: true } })
  ing.forEach((x) => out.set(`Ingredient:${x.id}`, x.displayName))
  const prod = await prisma.product.findMany({ where: { id: { in: by('Product') } }, select: { id: true, brand: true, name: true } })
  prod.forEach((x) => out.set(`Product:${x.id}`, `${x.brand} ${x.name}`))
  const pat = await prisma.patent.findMany({ where: { id: { in: by('Patent') } }, select: { id: true, publicationNumber: true } })
  pat.forEach((x) => out.set(`Patent:${x.id}`, x.publicationNumber))
  const ev = await prisma.evidence.findMany({ where: { id: { in: by('Study') } }, select: { id: true, title: true, pmid: true } })
  ev.forEach((x) => out.set(`Study:${x.id}`, x.pmid ? `PMID ${x.pmid}` : x.title.slice(0, 40)))
  const fn = await prisma.functionTerm.findMany({ where: { id: { in: by('Function') } }, select: { id: true, label: true } })
  fn.forEach((x) => out.set(`Function:${x.id}`, x.label))
  const fam = await prisma.ingredientFamily.findMany({ where: { id: { in: by('IngredientFamily') } }, select: { id: true, name: true } })
  fam.forEach((x) => out.set(`IngredientFamily:${x.id}`, x.name))
  const ont = await prisma.ontologyTerm.findMany({ where: { id: { in: [...by('HairPhenotype'), ...by('ScalpPhenotype'), ...by('Outcome')] } }, select: { id: true, label: true } })
  ont.forEach((x) => { for (const t of ['HairPhenotype', 'ScalpPhenotype', 'Outcome']) out.set(`${t}:${x.id}`, x.label) })
  const rm = await prisma.rawMaterial.findMany({ where: { id: { in: by('RawMaterial') } }, select: { id: true, tradeName: true } })
  rm.forEach((x) => out.set(`RawMaterial:${x.id}`, x.tradeName))
  const fo = await prisma.formula.findMany({ where: { id: { in: by('Formula') } }, select: { id: true, code: true } })
  fo.forEach((x) => out.set(`Formula:${x.id}`, x.code))
  return out
}

/** PostgreSQL implementation. Private nodes (formulas, raw materials) are only returned when the principal may see them. */
export const postgresGraphStore: GraphStore = {
  async neighborhood(principal, type, id, opts = {}) {
    const limit = opts.limit ?? 150
    const edges = await prisma.graphEdge.findMany({
      where: { supersededAt: null, OR: [{ fromType: type, fromId: id }, { toType: type, toId: id }], ...(opts.edgeTypes?.length ? { edgeType: { in: opts.edgeTypes as EdgeType[] } } : {}) },
      take: limit,
      orderBy: { confidence: 'desc' },
    })
    const nodeRefs = new Map<string, { type: NodeType; id: string }>()
    nodeRefs.set(`${type}:${id}`, { type, id })
    for (const e of edges) {
      nodeRefs.set(`${e.fromType}:${e.fromId}`, { type: e.fromType, id: e.fromId })
      nodeRefs.set(`${e.toType}:${e.toId}`, { type: e.toType, id: e.toId })
    }
    // Visibility filter for private node types.
    const formulaIds = [...nodeRefs.values()].filter((n) => n.type === 'Formula').map((n) => n.id)
    const rawIds = [...nodeRefs.values()].filter((n) => n.type === 'RawMaterial').map((n) => n.id)
    const { visibilityWhere } = await import('../permissions')
    const visibleFormulas = new Set((await prisma.formula.findMany({ where: { id: { in: formulaIds }, ...visibilityWhere(principal) }, select: { id: true } })).map((f) => f.id))
    const visibleRaw = new Set((await prisma.rawMaterial.findMany({ where: { id: { in: rawIds }, ...visibilityWhere(principal, 'rawmaterial:read') }, select: { id: true } })).map((f) => f.id))
    const hidden = (t: NodeType, nid: string) => (t === 'Formula' && !visibleFormulas.has(nid)) || (t === 'RawMaterial' && !visibleRaw.has(nid)) || t === 'ResearchCandidate'
    const labels = await labelsFor([...nodeRefs.values()])
    const nodes: GraphNode[] = [...nodeRefs.values()].filter((n) => !hidden(n.type, n.id)).map((n) => ({ ...n, label: labels.get(`${n.type}:${n.id}`) ?? n.id.slice(0, 8), href: href(n.type, n.id) }))
    const visibleKeys = new Set(nodes.map((n) => `${n.type}:${n.id}`))
    const links: GraphLink[] = edges
      .filter((e) => visibleKeys.has(`${e.fromType}:${e.fromId}`) && visibleKeys.has(`${e.toType}:${e.toId}`))
      .map((e) => ({ id: e.id, from: `${e.fromType}:${e.fromId}`, to: `${e.toType}:${e.toId}`, edgeType: e.edgeType, confidence: e.confidence, status: e.status, reviewStatus: e.reviewStatus, source: e.evidenceType, derived: false }))
    return { nodes, links }
  },
}
