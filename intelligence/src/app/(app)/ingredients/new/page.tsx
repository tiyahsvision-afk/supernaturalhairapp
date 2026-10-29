import { prisma } from '@/lib/db'
import { allowed, requireUser } from '@/lib/auth/next'
import { PageHeader, PermissionDenied, Notice } from '@/components/ui'
import { NewIngredientForm } from './Form'

export default async function NewIngredient() {
  const s = await requireUser()
  if (!(await allowed(s, 'ingredient:write', '/ingredients/new'))) return <PermissionDenied permission="ingredient:write" />
  const [families, sources] = await Promise.all([prisma.ingredientFamily.findMany({ orderBy: { name: 'asc' } }), prisma.source.findMany({ where: { active: true }, orderBy: { name: 'asc' } })])
  return (
    <>
      <PageHeader eyebrow="Ingredients" title="New canonical ingredient" subtitle="New ingredients are created as SUBMITTED and enter the identity-review queue. Exact name collisions are rejected; near matches are queued as possible duplicates." />
      <Notice title="Do not merge by similarity">If this may be a salt, ester, grade, blend or plant part of an existing ingredient, create it separately and record the relationship — related forms are never treated as interchangeable without review.</Notice>
      <NewIngredientForm families={families.map((f) => ({ slug: f.slug, name: f.name }))} sources={sources.map((x) => ({ key: x.key, name: x.name }))} />
    </>
  )
}
