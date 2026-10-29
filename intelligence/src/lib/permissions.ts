import type { Role, Visibility } from '@prisma/client'

// Permission strings are coarse capabilities. Record-level rules (organization ownership, visibility) are applied
// on top by canViewRecord(). Neither layer alone grants access to private formulas, participant data or potential IP.
export const PERMISSIONS = [
  'search:read',
  'ingredient:read', 'ingredient:write', 'ingredient:approve', 'ingredient:merge',
  'fact:write', 'fact:approve',
  'evidence:read', 'evidence:write', 'evidence:approve',
  'regulatory:write', 'regulatory:approve',
  'safety:write', 'safety:approve',
  'patent:read', 'patent:write', 'patent:approve',
  'product:read', 'product:write',
  'supplier:read', 'supplier:write',
  'rawmaterial:read', 'rawmaterial:write',
  'document:upload', 'document:read',
  'formula:read', 'formula:write', 'formula:private:read', 'formula:approve_testing',
  'graph:read', 'graph:write', 'graph:approve',
  'review:read', 'review:act',
  'import:run', 'source:manage', 'source:rights_review',
  'outcome:participant:read', 'integration:manage',
  'ip:read', 'ip:write',
  'export:data',
  'user:manage', 'apikey:manage', 'org:manage', 'audit:read',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const READ_REFERENCE: Permission[] = [
  'search:read', 'ingredient:read', 'evidence:read', 'patent:read', 'product:read', 'supplier:read', 'graph:read', 'review:read',
]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  DATA_ADMIN: [
    ...READ_REFERENCE, 'ingredient:write', 'ingredient:approve', 'ingredient:merge', 'fact:write', 'evidence:write',
    'product:write', 'supplier:write', 'rawmaterial:read', 'rawmaterial:write', 'document:upload', 'document:read',
    'formula:read', 'graph:write', 'review:act', 'import:run', 'source:manage', 'integration:manage', 'export:data',
    'user:manage', 'apikey:manage', 'org:manage', 'audit:read',
  ],
  COSMETIC_CHEMIST: [
    ...READ_REFERENCE, 'ingredient:write', 'fact:write', 'fact:approve', 'evidence:write', 'product:write',
    'rawmaterial:read', 'rawmaterial:write', 'document:upload', 'document:read', 'formula:read', 'formula:write',
    'formula:private:read', 'formula:approve_testing', 'graph:write', 'review:act', 'ip:read',
  ],
  RESEARCH_SCIENTIST: [
    ...READ_REFERENCE, 'ingredient:write', 'fact:write', 'fact:approve', 'evidence:write', 'evidence:approve',
    'graph:write', 'graph:approve', 'formula:read', 'formula:private:read', 'rawmaterial:read', 'document:read',
    'outcome:participant:read', 'review:act', 'ip:read', 'ip:write', 'export:data', 'audit:read',
  ],
  DERMATOLOGIST_REVIEWER: [...READ_REFERENCE, 'evidence:approve', 'safety:write', 'safety:approve', 'review:act'],
  TRICHOLOGIST_REVIEWER: [...READ_REFERENCE, 'evidence:approve', 'safety:approve', 'review:act'],
  REGULATORY_REVIEWER: [...READ_REFERENCE, 'regulatory:write', 'regulatory:approve', 'safety:write', 'review:act', 'source:rights_review'],
  PATENT_REVIEWER: [...READ_REFERENCE, 'patent:write', 'patent:approve', 'ip:read', 'review:act'],
  DATA_ANNOTATOR: [...READ_REFERENCE, 'ingredient:write', 'fact:write', 'evidence:write', 'product:write', 'graph:write', 'patent:write'],
  SUPPLIER_PARTNER: ['search:read', 'ingredient:read', 'supplier:read', 'rawmaterial:read', 'rawmaterial:write', 'document:upload', 'document:read'],
  BRAND_PARTNER: ['search:read', 'ingredient:read', 'product:read', 'product:write', 'formula:read', 'formula:write', 'formula:private:read'],
  READ_ONLY_RESEARCHER: [...READ_REFERENCE],
}

/** Roles whose accounts must have MFA enabled when MFA_ENFORCEMENT=required. */
export const PRIVILEGED_ROLES: Role[] = [
  'SUPER_ADMIN', 'DATA_ADMIN', 'COSMETIC_CHEMIST', 'RESEARCH_SCIENTIST', 'REGULATORY_REVIEWER', 'PATENT_REVIEWER',
  'DERMATOLOGIST_REVIEWER', 'TRICHOLOGIST_REVIEWER',
]

export interface Principal {
  id: string
  organizationId: string
  roles: Role[]
  kind: 'USER' | 'API_KEY'
  /** API keys carry explicit scopes; their effective permissions are the intersection with these scopes. */
  scopes?: string[]
  label: string
}

export function permissionsFor(p: Pick<Principal, 'roles' | 'scopes' | 'kind'>): Set<Permission> {
  const out = new Set<Permission>()
  for (const r of p.roles) for (const perm of ROLE_PERMISSIONS[r] ?? []) out.add(perm)
  if (p.kind === 'API_KEY') {
    const scopes = new Set(p.scopes ?? [])
    for (const perm of [...out]) if (!scopes.has(perm)) out.delete(perm)
  }
  return out
}

export function can(p: Pick<Principal, 'roles' | 'scopes' | 'kind'>, perm: Permission): boolean {
  return permissionsFor(p).has(perm)
}

export interface OwnedRecord {
  ownerOrgId: string | null
  visibility: Visibility
}

/**
 * Record-level visibility. There is no cross-organization bypass — not even for SUPER_ADMIN — so one organization's
 * private formulas, documents and research candidates can never be read by another organization.
 */
export function canViewRecord(p: Principal, rec: OwnedRecord, restrictedPerm: Permission = 'formula:private:read'): boolean {
  if (rec.visibility === 'SHARED') return true
  if (!rec.ownerOrgId || rec.ownerOrgId !== p.organizationId) return false
  if (rec.visibility === 'ORGANIZATION') return true
  if (rec.visibility === 'RESTRICTED') return can(p, restrictedPerm)
  if (rec.visibility === 'CONFIDENTIAL_IP') return can(p, 'ip:read')
  return false
}

/** Prisma where-clause equivalent of canViewRecord, for list queries. */
export function visibilityWhere(p: Principal, restrictedPerm: Permission = 'formula:private:read') {
  const allowed: Visibility[] = ['ORGANIZATION']
  if (can(p, restrictedPerm)) allowed.push('RESTRICTED')
  if (can(p, 'ip:read')) allowed.push('CONFIDENTIAL_IP')
  return { OR: [{ visibility: 'SHARED' as Visibility }, { ownerOrgId: p.organizationId, visibility: { in: allowed } }] }
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super admin',
  DATA_ADMIN: 'Data admin',
  COSMETIC_CHEMIST: 'Cosmetic chemist',
  RESEARCH_SCIENTIST: 'Research scientist',
  DERMATOLOGIST_REVIEWER: 'Dermatologist reviewer',
  TRICHOLOGIST_REVIEWER: 'Trichologist reviewer',
  REGULATORY_REVIEWER: 'Regulatory reviewer',
  PATENT_REVIEWER: 'Patent reviewer',
  DATA_ANNOTATOR: 'Data annotator',
  SUPPLIER_PARTNER: 'Supplier partner',
  BRAND_PARTNER: 'Brand partner',
  READ_ONLY_RESEARCHER: 'Read-only researcher',
}
