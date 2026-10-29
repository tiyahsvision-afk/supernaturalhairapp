import { describe, expect, it } from 'vitest'
import { screenClaimText } from '@/lib/claims-guard'
import { can, canViewRecord, permissionsFor, type Principal } from '@/lib/permissions'
import { hotp, totp, verifyTotp, base32Encode } from '@/lib/auth/totp'
import { passwordPolicyErrors } from '@/lib/auth/password'
import { nextReviewStatus, eligibleReviewer } from '@/lib/services/review'
import { computeCompleteness } from '@/lib/completeness'
import { isStale } from '@/lib/regulatory'

const user = (roles: Principal['roles'], org = 'org-a'): Principal => ({ id: 'u', organizationId: org, roles, kind: 'USER', label: 'u' })

describe('claims guard', () => {
  it('flags drug, proof, regulatory and systemic claims', () => {
    for (const t of ['Treats alopecia fast', 'cures psoriasis', 'clinically proven results', 'FDA approved formula', 'globally approved', 'gets absorbed through the scalp and supports body chemistry', 'the best herbs for hair growth', 'safe to manufacture']) {
      expect(screenClaimText(t).length, t).toBeGreaterThan(0)
    }
  })
  it('does not flag ordinary cosmetic appearance language', () => {
    expect(screenClaimText('Helps hair look smoother and feel softer.')).toEqual([])
  })
})

describe('permissions', () => {
  it('denies private formulas across organizations, even for super admins', () => {
    const rec = { ownerOrgId: 'org-b', visibility: 'RESTRICTED' as const }
    expect(canViewRecord(user(['SUPER_ADMIN'], 'org-a'), rec)).toBe(false)
    expect(canViewRecord(user(['COSMETIC_CHEMIST'], 'org-b'), rec)).toBe(true)
    expect(canViewRecord(user(['READ_ONLY_RESEARCHER'], 'org-b'), rec)).toBe(false)
  })
  it('keeps potential IP restricted to ip:read holders', () => {
    const rec = { ownerOrgId: 'org-a', visibility: 'CONFIDENTIAL_IP' as const }
    expect(canViewRecord(user(['DATA_ANNOTATOR']), rec)).toBe(false)
    expect(canViewRecord(user(['DATA_ADMIN']), rec)).toBe(false)
    expect(canViewRecord(user(['RESEARCH_SCIENTIST']), rec)).toBe(true)
  })
  it('limits API keys to their scopes', () => {
    const key: Principal = { id: 'k', organizationId: 'org-a', roles: ['SUPER_ADMIN'], kind: 'API_KEY', scopes: ['ingredient:read'], label: 'k' }
    expect([...permissionsFor(key)]).toEqual(['ingredient:read'])
    expect(can(key, 'formula:read')).toBe(false)
  })
  it('gives read-only researchers no write permissions', () => {
    expect([...permissionsFor(user(['READ_ONLY_RESEARCHER']))].some((p) => /write|approve|merge|manage|run/.test(p))).toBe(false)
  })
})

describe('TOTP (RFC 4226 / 6238 vectors)', () => {
  const secret = Buffer.from('12345678901234567890')
  it('matches RFC 4226 HOTP vectors', () => {
    expect(hotp(secret, 0)).toBe('755224')
    expect(hotp(secret, 9)).toBe('520489')
  })
  it('matches RFC 6238 at T=59s (last six digits of 94287082)', () => {
    expect(totp(base32Encode(secret), 59_000)).toBe('287082')
  })
  it('accepts ±1 step drift only', () => {
    const b32 = base32Encode(secret)
    const now = 1_700_000_000_000
    expect(verifyTotp(b32, totp(b32, now - 30_000), now)).toBe(true)
    expect(verifyTotp(b32, totp(b32, now - 120_000), now)).toBe(false)
  })
})

describe('password policy', () => {
  it('rejects short or simple passwords', () => {
    expect(passwordPolicyErrors('short')).not.toEqual([])
    expect(passwordPolicyErrors('alllowercaseletters')).not.toEqual([])
    expect(passwordPolicyErrors('Correct-Horse-9-Battery')).toEqual([])
  })
})

describe('review state machine', () => {
  it('approves with enough distinct approvals', () => {
    expect(nextReviewStatus([], 'APPROVED', 1)).toBe('APPROVED')
    expect(nextReviewStatus([], 'APPROVED', 2)).toBe('SECOND_REVIEW_REQUIRED')
    expect(nextReviewStatus(['APPROVED'], 'APPROVED', 2)).toBe('APPROVED')
  })
  it('routes disagreement to adjudication and lets the adjudicator decide', () => {
    expect(nextReviewStatus(['APPROVED'], 'REJECTED', 2)).toBe('SECOND_REVIEW_REQUIRED')
    expect(nextReviewStatus(['APPROVED', 'REJECTED'], 'APPROVED', 2)).toBe('APPROVED')
  })
  it('requires a qualified role', () => {
    expect(eligibleReviewer(['DATA_ANNOTATOR'], ['REGULATORY_REVIEWER'])).toBe(false)
    expect(eligibleReviewer(['REGULATORY_REVIEWER'], ['REGULATORY_REVIEWER'])).toBe(true)
  })
})

describe('completeness and staleness', () => {
  it('does not require identifiers for complex materials', () => {
    const base = { inciName: 'X', description: null, familyId: 'f', verifiedIdentifierCount: 0, functionCount: 1, factCount: 0, regulatoryJurisdictions: 0, safetyReviewCount: 0, evidenceCount: 0, concentrationCount: 0, hasComplexProfile: true }
    const botanical = computeCompleteness({ ...base, identityType: 'BOTANICAL_EXTRACT' })
    expect(botanical.items.find((i) => i.key === 'identifier')?.applicable).toBe(false)
    const molecule = computeCompleteness({ ...base, identityType: 'DEFINED_SUBSTANCE' })
    expect(molecule.items.find((i) => i.key === 'identifier')?.applicable).toBe(true)
  })
  it('marks never-checked regulatory records as stale', () => {
    expect(isStale({ lastCheckedAt: null, staleAfterDays: 180 })).toBe(true)
    expect(isStale({ lastCheckedAt: new Date(), staleAfterDays: 180 })).toBe(false)
  })
})
