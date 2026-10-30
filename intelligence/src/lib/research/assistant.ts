// Formulation Research Assistant: retrieval from the platform's own records, then (when ANTHROPIC_API_KEY is set) a
// model-written answer that may only cite the retrieved records. Every citation is checked; statements whose
// citations do not resolve to a retrieved record are removed. Without a key, the retrieved records are returned.
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../db'
import { dimensionsFor, loadIntel } from '../dimensions'
import { meter } from '../entitlements'
import { can, type Principal } from '../permissions'
import { search } from '../search'
import { ENGINE_VERSION, STANDARD_LIMITATIONS, type Certainty, type Citation, type Finding, type WorkflowResult } from './types'

export const ASSISTANT_MODEL = 'claude-opus-5-5'

interface Retrieved { ref: string; citation: Citation; text: string }

export async function retrieve(principal: Principal, question: string, limit = 24): Promise<Retrieved[]> {
  const res = await search(principal, question, { limit: 40 })
  // Also search individual significant words, so multi-concept questions still retrieve relevant records.
  const words = question.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 4 && !STOP.has(w))
  const extra = (await Promise.all(words.slice(0, 6).map((w) => search(principal, w, { limit: 8 })))).flatMap((r) => r.hits)
  const hits = [...res.hits, ...extra]
  const seen = new Set<string>()
  const out: Retrieved[] = []
  const ingIds = [...new Set(hits.filter((h) => h.entityType === 'ingredient').map((h) => h.entityId))].slice(0, 8)
  const intel = ingIds.length ? (await loadIntel(principal, ingIds)).map(dimensionsFor) : []
  for (const [k, id] of ingIds.entries()) {
    const it = intel[k]
    if (!it) continue
    const ing = await prisma.ingredient.findUnique({ where: { id }, select: { displayName: true, inciName: true } })
    const facts = it.dims.filter((d) => d.value).map((d) => `${d.label} [${d.status.toLowerCase()}]: ${d.value}`).join('; ')
    const missing = it.dims.filter((d) => d.status === 'MISSING').map((d) => d.label).join(', ')
    out.push({ ref: '', citation: { id: `ing:${id}`, kind: 'ingredient', label: ing?.displayName ?? id, href: `/ingredients/${id}` }, text: `Ingredient ${ing?.displayName} (INCI ${ing?.inciName ?? 'n/a'}). ${facts}. Rule-based classes: ${it.derived.map((d) => d.label).join(', ') || 'none'}. No data for: ${missing || 'nothing'}.` })
    seen.add(`ingredient:${id}`)
  }
  const evIds = [...new Set(hits.filter((h) => h.entityType === 'evidence').map((h) => h.entityId))]
  if (can(principal, 'evidence:read')) {
    const linked = ingIds.length ? await prisma.evidenceLink.findMany({ where: { ingredientId: { in: ingIds } }, select: { evidenceId: true }, take: 30 }) : []
    const ids = [...new Set([...evIds, ...linked.map((l) => l.evidenceId)])].slice(0, 14)
    const evs = await prisma.evidence.findMany({ where: { id: { in: ids } }, include: { links: { include: { ingredient: { select: { displayName: true } }, ontologyTerm: { select: { label: true } } } } } })
    for (const e of evs) {
      out.push({ ref: '', citation: { id: `ev:${e.id}`, kind: 'evidence', label: `${e.title}${e.pmid ? ` (PMID ${e.pmid})` : ''}`, href: `/evidence/${e.id}` }, text: `Evidence record: "${e.title}". Design: ${e.studyType.replace(/_/g, ' ').toLowerCase()} (${e.entryMode === 'AI_EXTRACTED' ? 'AI-proposed, unreviewed' : e.reviewStatus.toLowerCase()}). Level: ${e.evidenceLevel ?? 'unrated'}. Medical context: ${e.medicalContext ? 'yes' : 'no'}. Links: ${e.links.map((l) => [l.ingredient?.displayName, l.ontologyTerm?.label, l.direction.toLowerCase()].filter(Boolean).join(' / ')).join('; ')}. Only the title and metadata are stored, not the full text.` })
    }
  }
  if (ingIds.length) {
    const regs = await prisma.regulatoryRecord.findMany({ where: { ingredientId: { in: ingIds }, supersededAt: null }, include: { ingredient: { select: { displayName: true } } }, take: 20 })
    for (const r of regs) out.push({ ref: '', citation: { id: `reg:${r.id}`, kind: 'regulatory', label: `${r.ingredient.displayName}: ${r.jurisdiction} ${r.status.toLowerCase().replace(/_/g, ' ')}`, href: `/ingredients/${r.ingredientId}?tab=regulatory` }, text: `Regulatory record (${r.lastCheckedAt ? `checked ${r.lastCheckedAt.toISOString().slice(0, 10)}` : 'never verified against official text'}; ${r.reviewStatus.toLowerCase()}): ${r.ingredient.displayName} — ${r.jurisdiction} ${r.status.toLowerCase().replace(/_/g, ' ')}${r.maxConcentration ? `, max ${r.maxConcentration}${r.maxConcentrationUnit ?? ''}` : ''}. ${r.regulationRef ?? ''} ${r.notes ?? ''}` })
  }
  for (const h of hits.filter((x) => x.entityType === 'patent' || x.entityType === 'product')) {
    const key = `${h.entityType}:${h.entityId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ref: '', citation: { id: `${h.entityType === 'patent' ? 'pat' : 'prod'}:${h.entityId}`, kind: h.entityType as 'patent' | 'product', label: h.label, href: `/${h.entityType}s/${h.entityId}` }, text: `${h.entityType === 'patent' ? 'Patent publication (research aid, not a legal opinion)' : 'Product with declared ingredient list'}: ${h.label}${h.detail ? ` — ${h.detail}` : ''}.` })
  }
  return out.slice(0, limit).map((r, k) => ({ ...r, ref: `R${k + 1}` }))
}

const STOP = new Set(['which', 'should', 'would', 'could', 'about', 'there', 'their', 'these', 'those', 'where', 'what', 'formulation', 'ingredient', 'ingredients', 'product', 'products', 'investigate', 'improve', 'improved', 'factors', 'influence', 'evidence', 'support', 'supports', 'particular', 'warrant', 'systems', 'alternatives', 'exist'])

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'points', 'open_questions', 'not_answerable'],
  properties: {
    summary: { type: 'string', description: 'Two to four sentences answering the question from the records only.' },
    points: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['title', 'detail', 'kind', 'refs'],
        properties: {
          title: { type: 'string' }, detail: { type: 'string' },
          kind: { type: 'string', enum: ['RECORDED_FACT', 'RESEARCH_SUGGESTION', 'NEEDS_TESTING', 'NEEDS_SPECIALIST_REVIEW'] },
          refs: { type: 'array', items: { type: 'string' }, description: 'Record ids such as R3 that support this point.' },
        },
      },
    },
    open_questions: { type: 'array', items: { type: 'string' } },
    not_answerable: { type: 'string', description: 'What the records cannot answer.' },
  },
} as const

const SYSTEM = `You are a cosmetic formulation research assistant inside a private research platform. Answer ONLY from the numbered records supplied in the user message. Every point must cite the record ids (R1, R2, ...) that support it. If the records do not support an answer, say so in not_answerable instead of using general knowledge. Never invent studies, test results, ingredient properties, concentrations, prices or regulatory approvals. Distinguish recorded facts (what a record states) from research suggestions (what is worth investigating) and from questions only laboratory testing or a specialist can answer. Records carry their data status (verified, source-reported, rule-derived, hypothesis, missing); preserve that uncertainty in your wording. Never describe a substitution as performing equivalently, never describe an ingredient as safe or approved, and never make drug or medical claims.`

const KIND_TO_CERTAINTY: Record<string, Certainty> = { RECORDED_FACT: 'SUPPORTED', RESEARCH_SUGGESTION: 'UNCERTAIN', NEEDS_TESTING: 'NEEDS_TESTING', NEEDS_SPECIALIST_REVIEW: 'REVIEW_REQUIRED' }

export async function runAssistant(principal: Principal, question: string): Promise<{ result: WorkflowResult; aiUsed: boolean; aiModel: string | null }> {
  const q = question.trim()
  if (q.length < 8) throw new Error('Ask a fuller research question.')
  const records = await retrieve(principal, q)
  const citations = records.map((r) => ({ ...r.citation, note: r.ref }))
  const base = {
    tables: [{ title: 'Records retrieved', caption: 'The assistant may only cite these records.', columns: ['Ref', 'Record', 'Type'], rows: records.map((r) => [r.ref, { text: r.citation.label, href: r.citation.href }, r.citation.kind]) }],
    nextSteps: ['Open the cited records and check their review status before acting on them.', 'Turn promising directions into a Workbench project (substitutes, formulation or claim) for a structured, saved analysis.'],
    limitations: [...STANDARD_LIMITATIONS, 'Answers are limited to records in this database; absence of a record is not evidence of absence.', 'Evidence records hold titles and metadata only, not full text.'],
    citations,
  }
  if (!records.length) {
    return { aiUsed: false, aiModel: null, result: { headline: q, summary: 'No records in the database match this question. Try naming specific ingredients, INCI names or outcomes.', findings: [], openQuestions: [], methodology: `Retrieval only (no matches). Engine ${ENGINE_VERSION}.`, verification: {}, ...base } }
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      aiUsed: false, aiModel: null,
      result: {
        headline: q,
        summary: `${records.length} relevant record(s) were retrieved. AI analysis is not enabled on this deployment (set ANTHROPIC_API_KEY), so the records are listed for you to review directly.`,
        findings: records.map((r) => ({ title: `${r.ref} · ${r.citation.label}`, detail: r.text, certainty: 'INFO' as Certainty, citations: [r.citation.id] })),
        openQuestions: [], methodology: `Keyword and identifier retrieval across ingredients, evidence, regulatory records, patents and products visible to your organization. AI synthesis disabled. Engine ${ENGINE_VERSION}.`, verification: {}, ...base,
      },
    }
  }
  await meter(principal, 'ai.call', { purpose: 'assistant' })
  const client = new Anthropic()
  const response = await client.beta.messages.create({
    model: ASSISTANT_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Question: ${q}\n\nRecords:\n${records.map((r) => `[${r.ref}] ${r.text}`).join('\n')}` }],
  })
  if (response.stop_reason === 'refusal') {
    return { aiUsed: true, aiModel: response.model, result: { headline: q, summary: 'The model declined to answer this question. The retrieved records are listed below.', findings: [], openQuestions: [], methodology: `Retrieval + ${response.model} (declined). Engine ${ENGINE_VERSION}.`, verification: {}, ...base } }
  }
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  let parsed: { summary: string; points: { title: string; detail: string; kind: string; refs: string[] }[]; open_questions: string[]; not_answerable: string }
  try { parsed = JSON.parse(text) } catch { throw new Error('The assistant returned an unreadable answer; try again.') }
  const byRef = new Map(records.map((r) => [r.ref, r]))
  const findings: Finding[] = []
  let removed = 0
  for (const p of parsed.points) {
    const refs = p.refs.filter((x) => byRef.has(x))
    if (!refs.length) { removed++; continue } // uncited or citing unknown records: dropped
    findings.push({ title: p.title, detail: `${p.detail} [${refs.join(', ')}]`, certainty: KIND_TO_CERTAINTY[p.kind] ?? 'UNCERTAIN', citations: refs.map((x) => byRef.get(x)!.citation.id) })
  }
  return {
    aiUsed: true, aiModel: response.model,
    result: {
      headline: q,
      summary: `${parsed.summary}${parsed.not_answerable ? ` Not answerable from the records: ${parsed.not_answerable}` : ''}`,
      findings, openQuestions: parsed.open_questions,
      methodology: `Retrieval across ingredients, evidence, regulatory records, patents and products visible to your organization (${records.length} records), then ${response.model} constrained to cite only those records (structured output). Citation check: ${findings.length} point(s) kept, ${removed} removed for missing or unknown citations. AI-generated text — verify against the cited records. Engine ${ENGINE_VERSION}.`,
      verification: {}, ...base,
    },
  }
}
