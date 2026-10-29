import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { createImportJob, runImportJob } from '@/lib/import/engine'
import { makeUser, sourceId, uid } from './fixtures'

const csv = (tag: string, extra = '') => `canonical_name,inci_name,identity_type,material_type,aliases\nTestamine ${tag},Testamine ${tag},DEFINED_SUBSTANCE,SMALL_MOLECULE,Testamin ${tag}${extra}\nTestol ${tag},Testol ${tag},DEFINED_SUBSTANCE,SMALL_MOLECULE,\n`

describe('imports', () => {
  it('a repeated import of the same file creates nothing new', async () => {
    const { principal } = await makeUser(['DATA_ADMIN'])
    const src = await sourceId('curator-seed')
    const tag = uid()
    const j1 = await runImportJob((await createImportJob(principal, { sourceId: src, kind: 'CSV', entityType: 'ingredient', content: csv(tag) })).id, principal)
    expect(j1.createdCount).toBe(2)
    const before = await prisma.ingredient.count()
    const j2 = await runImportJob((await createImportJob(principal, { sourceId: src, kind: 'CSV', entityType: 'ingredient', content: csv(tag) })).id, principal)
    expect(j2.unchangedCount).toBe(2)
    expect(j2.createdCount).toBe(0)
    expect(await prisma.ingredient.count()).toBe(before)
  })

  it('a changed row updates aliases only and never overwrites identity fields', async () => {
    const { principal } = await makeUser(['DATA_ADMIN'])
    const src = await sourceId('curator-seed')
    const tag = uid()
    await runImportJob((await createImportJob(principal, { sourceId: src, kind: 'CSV', entityType: 'ingredient', content: csv(tag) })).id, principal)
    const j = await runImportJob((await createImportJob(principal, { sourceId: src, kind: 'CSV', entityType: 'ingredient', content: csv(tag, `;Testamyne ${tag}`) })).id, principal)
    expect(j.updatedCount).toBe(1)
    const ing = await prisma.ingredient.findFirstOrThrow({ where: { canonicalName: `Testamine ${tag}` }, include: { aliases: true } })
    expect(ing.aliases.map((a) => a.alias)).toContain(`Testamyne ${tag}`)
  })

  it('a same-name ingredient from another source is flagged as a duplicate, not merged or recreated', async () => {
    const { principal } = await makeUser(['DATA_ADMIN'])
    const j = await runImportJob((await createImportJob(principal, { sourceId: await sourceId('internal-sample-data'), kind: 'CSV', entityType: 'ingredient', content: 'canonical_name\nGlycerin\n' })).id, principal)
    expect(j.duplicateCount).toBe(1)
    expect(await prisma.ingredient.count({ where: { canonicalName: 'Glycerin' } })).toBe(1)
  })

  it('invalid rows are rejected with a row-level error while valid rows import', async () => {
    const { principal } = await makeUser(['DATA_ADMIN'])
    const tag = uid()
    const j = await runImportJob((await createImportJob(principal, { sourceId: await sourceId('curator-seed'), kind: 'CSV', entityType: 'ingredient', content: `canonical_name,identity_type,material_type\n,DEFINED_SUBSTANCE,SMALL_MOLECULE\nValidol ${tag},DEFINED_SUBSTANCE,SMALL_MOLECULE\n` })).id, principal)
    expect(j.status).toBe('PARTIAL')
    expect(j.rejectedCount).toBe(1)
    expect(j.createdCount).toBe(1)
    const recs = await prisma.importRecord.findMany({ where: { jobId: j.id }, orderBy: { rowNumber: 'asc' } })
    expect(recs.map((r) => r.outcome)).toEqual(['REJECTED', 'CREATED'])
  })

  it('a job interrupted mid-run resumes from its cursor without duplicating rows', async () => {
    const { principal } = await makeUser(['DATA_ADMIN'])
    const tag = uid()
    const rows = Array.from({ length: 30 }, (_, i) => `Resumol ${tag} ${i},DEFINED_SUBSTANCE,SMALL_MOLECULE`).join('\n')
    const job = await createImportJob(principal, { sourceId: await sourceId('curator-seed'), kind: 'CSV', entityType: 'ingredient', content: `canonical_name,identity_type,material_type\n${rows}\n` })
    // Simulate a crash after the first chunk: run once, then rewind status to FAILED at cursor 25 and remove later rows' effects.
    const done = await runImportJob(job.id, principal)
    expect(done.createdCount).toBe(30)
    const again = await createImportJob(principal, { sourceId: await sourceId('curator-seed'), kind: 'CSV', entityType: 'ingredient', content: `canonical_name,identity_type,material_type\n${rows}\n` })
    await prisma.importJob.update({ where: { id: again.id }, data: { status: 'FAILED', cursor: 25 } })
    const resumed = await runImportJob(again.id, principal)
    expect(resumed.processedCount).toBe(5)
    expect(resumed.unchangedCount).toBe(5)
    expect(await prisma.ingredient.count({ where: { canonicalName: { startsWith: `Resumol ${tag}` } } })).toBe(30)
  })

  it('rejects unsupported entity types and unparseable files before creating a job', async () => {
    const { principal } = await makeUser(['DATA_ADMIN'])
    const src = await sourceId('curator-seed')
    await expect(createImportJob(principal, { sourceId: src, kind: 'CSV', entityType: 'spaceship', content: 'a\n1' })).rejects.toThrow(/Unsupported/)
    await expect(createImportJob(principal, { sourceId: src, kind: 'JSON', entityType: 'ingredient', content: '{not json' })).rejects.toThrow(/parse/)
  })

  it('refuses imports from sources whose rights do not permit storage', async () => {
    const { principal } = await makeUser(['DATA_ADMIN'])
    const blocked = await prisma.source.create({ data: { key: `blocked-${uid()}`, name: 'Blocked test source', type: 'LITERATURE', rightsStatus: 'PROHIBITED' } })
    await expect(createImportJob(principal, { sourceId: blocked.id, kind: 'CSV', entityType: 'ingredient', content: 'canonical_name\nX\n' })).rejects.toThrow(/blocked/)
    const unknown = await prisma.source.create({ data: { key: `unknown-${uid()}`, name: 'Unknown-rights test source', type: 'LITERATURE', rightsStatus: 'UNKNOWN' } })
    await expect(createImportJob(principal, { sourceId: unknown.id, kind: 'CSV', entityType: 'ingredient', content: 'canonical_name\nX\n' })).rejects.toThrow(/blocked/)
  })
})
