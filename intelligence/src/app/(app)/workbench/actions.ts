'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ResearchWorkflow } from '@prisma/client'
import { requirePermission } from '@/lib/auth/next'
import { EntitlementError } from '@/lib/entitlements'
import { parseFormulaText } from '@/lib/research/formulation'
import { addMember, createProject, generateReport, ProjectError, requestProjectReview, rerunProject, updateProject, WORKFLOWS } from '@/lib/research/projects'

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const all = (f: FormData, k: string) => f.getAll(k).map(String).map((x) => x.trim()).filter(Boolean)
const num = (f: FormData, k: string) => { const v = str(f, k); return v ? Number(v) : null }

async function inputsFrom(workflow: ResearchWorkflow, f: FormData) {
  switch (workflow) {
    case 'SUBSTITUTES': {
      const ingredientId = str(f, 'ingredient')
      if (!ingredientId) throw new ProjectError('Choose the ingredient you want to replace.')
      return { ingredientId, reason: str(f, 'reason'), avoidClasses: all(f, 'avoid'), keepFunctions: all(f, 'keep'), applicationType: (str(f, 'application') || 'UNKNOWN') as 'RINSE_OFF' | 'LEAVE_ON' | 'UNKNOWN' }
    }
    case 'FORMULATION': {
      const formulaId = str(f, 'formulaId') || undefined
      let text = str(f, 'lines')
      const file = f.get('file')
      if (!text && file instanceof File && file.size > 0) {
        if (file.size > 512 * 1024) throw new ProjectError('Formula files must be under 512 KB (CSV or plain text).')
        if (!/\.(csv|txt)$/i.test(file.name)) throw new ProjectError('Upload a .csv or .txt file with one ingredient per line.')
        text = (await file.text()).split(/\r?\n/).map((l) => l.replace(/[;,]\s*(?=\d|q\.?s)/i, ' ').replace(/"/g, '')).join('\n')
      }
      const lines = text ? parseFormulaText(text) : undefined
      if (!formulaId && !lines?.length) throw new ProjectError('Paste formula lines, upload a file, or choose a saved formula.')
      return { formulaId, lines, targetPh: num(f, 'ph'), markets: all(f, 'market'), applicationType: (str(f, 'application') || 'UNKNOWN') as 'RINSE_OFF' | 'LEAVE_ON' | 'UNKNOWN' }
    }
    case 'CLAIM':
      if (str(f, 'claim').length < 5) throw new ProjectError('Enter the claim wording.')
      return { claim: str(f, 'claim'), ingredientIds: all(f, 'ingredient'), markets: all(f, 'market'), applicationType: (str(f, 'application') || 'UNKNOWN') as 'RINSE_OFF' | 'LEAVE_ON' | 'UNKNOWN' }
    case 'SUPPLIERS':
      if (!str(f, 'ingredient') && !str(f, 'rawMaterialId')) throw new ProjectError('Choose an ingredient or a raw material.')
      return { ingredientId: str(f, 'ingredient') || undefined, rawMaterialId: str(f, 'rawMaterialId') || undefined, requirements: str(f, 'requirements') }
    case 'COMPARISON':
      if (all(f, 'ingredient').length < 2) throw new ProjectError('Choose at least two ingredients to compare.')
      return { ingredientIds: all(f, 'ingredient') }
    case 'PRODUCT_BRIEF':
      if (!str(f, 'category')) throw new ProjectError('Choose a product category.')
      return { category: str(f, 'category'), targetCustomer: str(f, 'targetCustomer'), performance: str(f, 'performance'), concerns: all(f, 'concern'), preferences: all(f, 'preference'), investigate: str(f, 'investigate'), avoid: str(f, 'avoid'), texture: str(f, 'texture'), markets: all(f, 'market'), retailPrice: str(f, 'retailPrice'), constraints: str(f, 'constraints') }
    case 'GENERAL':
      if (str(f, 'question').length < 8) throw new ProjectError('Ask a fuller research question.')
      return { question: str(f, 'question') }
  }
}

function friendly(e: unknown) {
  if (e instanceof ProjectError || e instanceof EntitlementError) return e.message
  const m = (e as Error)?.message ?? ''
  if (/not found|not visible|Choose|Enter|Ask|Provide/.test(m)) return m
  console.error(e)
  return 'The research could not be completed. Please check your inputs and try again.'
}

export async function startResearchAction(_p: { error?: string } | undefined, f: FormData): Promise<{ error?: string } | undefined> {
  const s = await requirePermission('research:write', 'start research')
  const workflow = str(f, 'workflow') as ResearchWorkflow
  if (!WORKFLOWS[workflow]) return { error: 'Unknown workflow.' }
  let id: string
  try {
    const inputs = await inputsFrom(workflow, f)
    const project = await createProject(s.principal, { title: str(f, 'title') || WORKFLOWS[workflow].label, objective: str(f, 'objective'), workflow, inputs, visibility: str(f, 'visibility') === 'RESTRICTED' ? 'RESTRICTED' : 'ORGANIZATION' })
    id = project.id
  } catch (e) { return { error: friendly(e) } }
  redirect(`/workbench/${id}`)
}

export async function rerunAction(_p: { error?: string } | undefined, f: FormData): Promise<{ error?: string } | undefined> {
  const s = await requirePermission('research:write', 'rerun research')
  const id = str(f, 'projectId')
  try {
    const changed = str(f, 'workflow') ? await inputsFrom(str(f, 'workflow') as ResearchWorkflow, f) : undefined
    await rerunProject(s.principal, id, changed)
  } catch (e) { return { error: friendly(e) } }
  redirect(`/workbench/${id}`)
}

export async function updateProjectAction(f: FormData) {
  const s = await requirePermission('research:write', 'update research project')
  const id = str(f, 'projectId')
  await updateProject(s.principal, id, { title: str(f, 'title') || undefined, objective: f.has('objective') ? str(f, 'objective') : undefined, status: (str(f, 'status') || undefined) as never, visibility: (str(f, 'visibility') || undefined) as never })
  revalidatePath(`/workbench/${id}`)
}

export async function addMemberAction(_p: { error?: string } | undefined, f: FormData): Promise<{ error?: string } | undefined> {
  const s = await requirePermission('research:write', 'project members')
  const id = str(f, 'projectId')
  try { await addMember(s.principal, id, str(f, 'email'), str(f, 'role') === 'VIEWER' ? 'VIEWER' : 'EDITOR') } catch (e) { return { error: friendly(e) } }
  revalidatePath(`/workbench/${id}`)
  return undefined
}

export async function requestReviewAction(f: FormData) {
  const s = await requirePermission('research:write', 'request research review')
  const id = str(f, 'projectId')
  await requestProjectReview(s.principal, id, str(f, 'notes') || undefined)
  revalidatePath(`/workbench/${id}`)
}

export async function generateReportAction(_p: { error?: string } | undefined, f: FormData): Promise<{ error?: string } | undefined> {
  const s = await requirePermission('research:read', 'generate report')
  let rid: string
  try { rid = (await generateReport(s.principal, str(f, 'projectId'), str(f, 'runId') || undefined)).id } catch (e) { return { error: friendly(e) } }
  redirect(`/reports/${rid}`)
}
