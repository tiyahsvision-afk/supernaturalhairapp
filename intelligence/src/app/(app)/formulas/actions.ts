'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { FormulaStatus } from '@prisma/client'
import { requirePermission } from '@/lib/auth/next'
import { createFormula, duplicateFormula, newVersion, setStatus, FormulaError, type FormulaLineInput } from '@/lib/services/formulas'
import { prisma } from '@/lib/db'

function parseLines(f: FormData): FormulaLineInput[] {
  const lines: FormulaLineInput[] = []
  for (let i = 0; i < 80; i++) {
    const ref = String(f.get(`ref_${i}`) ?? '').trim()
    if (!ref) continue
    const pct = String(f.get(`pct_${i}`) ?? '').trim()
    const isQs = pct.toLowerCase() === 'qs' || pct.toLowerCase() === 'q.s.'
    lines.push({ ingredientId: ref.startsWith('ing:') ? ref.slice(4) : null, rawMaterialId: ref.startsWith('rm:') ? ref.slice(3) : null, displayName: String(f.get(`name_${i}`) ?? ref), percent: isQs || !pct ? null : Number(pct), isQs, phase: String(f.get(`phase_${i}`) ?? '') || null, functionalRole: String(f.get(`role_${i}`) ?? '') || null })
  }
  return lines
}

async function resolveNames(lines: FormulaLineInput[]) {
  const ing = await prisma.ingredient.findMany({ where: { id: { in: lines.map((l) => l.ingredientId).filter(Boolean) as string[] } } })
  const rm = await prisma.rawMaterial.findMany({ where: { id: { in: lines.map((l) => l.rawMaterialId).filter(Boolean) as string[] } } })
  return lines.map((l) => ({ ...l, displayName: ing.find((x) => x.id === l.ingredientId)?.canonicalName ?? rm.find((x) => x.id === l.rawMaterialId)?.tradeName ?? l.displayName }))
}

export async function createFormulaAction(_p: { error?: string } | undefined, f: FormData) {
  const s = await requirePermission('formula:write', 'create formula')
  let id: string
  try {
    const res = await createFormula(s.principal, {
      code: String(f.get('code')).trim(), name: String(f.get('name')).trim(), productCategory: String(f.get('category') ?? ''), applicationType: (String(f.get('applicationType') ?? 'UNKNOWN')) as never,
      targetPh: f.get('targetPh') ? Number(f.get('targetPh')) : null, visibility: (String(f.get('visibility') ?? 'RESTRICTED')) as never, isSample: f.get('isSample') === '1',
      intendedGoals: String(f.get('goals') ?? '').split(',').map((x) => x.trim()).filter(Boolean), notes: String(f.get('notes') ?? ''), lines: await resolveNames(parseLines(f)),
    })
    id = res.formula.id
  } catch (e) {
    if (e instanceof FormulaError) return { error: e.message }
    if ((e as { code?: string }).code === 'P2002') return { error: 'A formula with this code already exists in your organization.' }
    throw e
  }
  redirect(`/formulas/${id}`)
}

export async function newVersionAction(_p: { error?: string } | undefined, f: FormData) {
  const s = await requirePermission('formula:write', 'new formula version')
  const formulaId = String(f.get('formulaId'))
  try {
    const lines = parseLines(f)
    await newVersion(s.principal, formulaId, String(f.get('fromVersionId')), lines.length ? await resolveNames(lines) : undefined, String(f.get('notes') ?? '') || undefined)
  } catch (e) { if (e instanceof FormulaError) return { error: e.message }; throw e }
  revalidatePath(`/formulas/${formulaId}`)
  redirect(`/formulas/${formulaId}`)
}

export async function duplicateAction(f: FormData) {
  const s = await requirePermission('formula:write', 'duplicate formula')
  const res = await duplicateFormula(s.principal, String(f.get('formulaId')), String(f.get('code')).trim(), String(f.get('name')).trim())
  redirect(`/formulas/${res.formula.id}`)
}

export async function setStatusAction(_p: { error?: string; ok?: string } | undefined, f: FormData) {
  const s = await requirePermission('formula:write', 'formula status')
  try {
    await setStatus(s.principal, String(f.get('versionId')), String(f.get('status')) as FormulaStatus, String(f.get('reason') ?? 'Status change'))
  } catch (e) { if (e instanceof FormulaError) return { error: e.message }; throw e }
  revalidatePath(`/formulas/${String(f.get('formulaId'))}`)
  return { ok: 'Status updated.' }
}
