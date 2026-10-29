'use server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/next'
import { audit } from '@/lib/audit'

/** Adds a taxonomy mapping row — Hair Passport vocabulary changes need data, not migrations. */
export async function addMappingAction(f: FormData) {
  const s = await requirePermission('integration:manage', 'taxonomy mapping')
  const term = await prisma.ontologyTerm.findUniqueOrThrow({ where: { code: String(f.get('termCode')) } })
  const m = await prisma.taxonomyMapping.create({ data: { externalSystem: 'hair-passport', externalTaxonomy: String(f.get('taxonomy')), externalVersion: String(f.get('version')), externalCode: String(f.get('code')), ontologyTermId: term.id, mappingVersion: String(f.get('mappingVersion') || 'mapping-0.1.0') } })
  await audit(s.principal, { action: 'integration.mapping.create', entityType: 'TaxonomyMapping', entityId: m.id, after: m })
  revalidatePath('/integrations')
}
