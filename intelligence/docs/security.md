# Security, backup, environments, retention and incident response

## 1. Threat model (summary)

The assets are:
- private formulas and supplier documents, which are trade secrets
- potential IP (research candidates)
- participant-derived observations: de-identified, but sensitive and consent-bound
- the integrity of review decisions and audit history

The main threats are:
- cross-organization data leakage
- account takeover
- over-scoped API keys
- re-identification of participants
- tampering with history
- licence violations through redistribution of third-party content

## 2. Controls implemented in Phase 1

| Area | Control | Where |
|---|---|---|
| Passwords | argon2id; policy of at least 12 characters with mixed classes and common-password rejection | `src/lib/auth/password.ts` |
| Login | Generic error messages (no account enumeration); lockout for 15 minutes after 5 failures; rate limit on the login action | `src/lib/auth/session.ts`, `src/app/login/actions.ts` |
| Sessions | 256-bit random token in an httpOnly, SameSite=Lax, Secure (production) cookie; only the SHA-256 hash is stored; sliding expiry (`SESSION_TTL_HOURS`); revocation on sign-out | `session.ts`, `auth/next.ts` |
| MFA | RFC 6238 TOTP, **required for privileged roles** when `MFA_ENFORCEMENT=required`; secrets encrypted at rest (AES-256-GCM, key derived from `APP_SECRET`) | `auth/totp.ts`, `src/lib/crypto.ts` |
| Authorization | 12 roles × 46 permissions matrix; checks on every page, action and API route; denials logged as `PERMISSION_DENIED` security events | `src/lib/permissions.ts` |
| Record isolation | `ownerOrgId` + `visibility` on formulas, raw materials, documents, research candidates and search entries; **no cross-organization bypass, including super admin**; out-of-org IDs return 404 | `canViewRecord`, `visibilityWhere` |
| API keys | `sii_<prefix>_<secret>`, stored hashed; effective permissions = scopes ∩ matrix; expiry, revocation, last-used tracking; automated clients cannot set gated formula statuses | `auth/api-keys.ts`, `services/formulas.ts` |
| CSRF | Server actions (framework origin check); API cookie writes require a same-origin `Origin` header; API keys are not cookies | `api/http.ts` |
| Rate limiting | Token bucket per principal (API) and per IP (login) | `rate-limit.ts` (in-memory; see limitations) |
| Input validation | zod schemas on API bodies; structured 4xx errors; no stack traces returned | `api/http.ts` |
| Headers | CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS | `next.config.ts` |
| Uploads | Size limit; magic-byte type check (PDF, PNG, JPEG, CSV, plain text; the client-declared type is never trusted); optional ClamAV scan; files not scanned are admin-only; downloads via short-lived HMAC-signed URLs; storage keys confined to the storage root | `src/lib/storage.ts`, `api/files/[id]` |
| Audit | Every write records actor, before/after, reason and source; the database trigger rejects UPDATE/DELETE on `AuditLog` | `audit.ts`, migration `…_phase1_search_audit_guards` |
| Data rights | Imports gated on source rights; partner API responses withhold records from sources not cleared for external use | `import/engine.ts`, `api/http.ts` |
| Participant data | Direct identifiers rejected and payload discarded; consent gating per record; health context stripped without health consent; withdrawal stops intake and schedules deletion; mock data excluded by default | `integration/hair-passport.ts` |
| Organization workspaces | Research projects, reports, review tasks for org-owned entities, products (`ownerOrgId`) and audit history (`AuditLog.organizationId`) are scoped to the user's organization. Restricted projects are limited to the creator and members; members can only be added from the same organization, with one generic error. The platform audit view redacts other organizations' confidential entities. | `research/projects.ts`, `services/review.ts`, `audit.ts` |
| Signup and plans | `/signup` is off unless `ALLOW_SELF_SIGNUP=true`; rate-limited; generic duplicate message; creates a trial organization with a Brand partner user (no privileged roles). Plan limits are enforced per organization per month. | `src/app/signup`, `entitlements.ts` |
| Secrets | Only `.env.example` is committed; `.env`, `storage/` and `private-data/` are git-ignored; demo users refused in production | `.gitignore`, `seed/seed.ts` |

**Repository visibility.** This code lives in a public repository. That is acceptable for the code itself. Private formulas, supplier documents and any participant data must only ever enter through the database or storage, never as committed files. The seed contains only public or clearly labelled sample data.

## 3. Known gaps (to close before production)

- **Rate limiter and import runner are in-process.** Use Redis or a database-backed limiter and a job queue for multi-instance deployments.
- **TOTP lacks replay protection** within the ±1-step window (store the last used step per user). There are no recovery codes or WebAuthn yet.
- **No password-reset flow.** Admins reset passwords. An email-based reset with rate limits is a Phase 2 item.
- **Research assistant sends retrieved records to the Anthropic API** when `ANTHROPIC_API_KEY` is set. Only records the user may already see are sent; do not enable it for organizations whose agreements forbid third-party processing.
- **Malware scanning is optional.** Without `CLAMD_HOST`, uploads stay "not scanned" and visible to admins only.
- **Encryption at rest relies on the database provider.** Only TOTP secrets are field-encrypted. Consider field encryption for supplier documents' metadata.
- **`npm audit` reports a high-severity issue in a Prisma CLI transitive dependency** (`deepmerge-ts`; development tooling only, not shipped in the runtime). It is resolved by upgrading to Prisma 7, which requires migration work.

## 4. Environments

| Environment | Database | Data | MFA | Demo users |
|---|---|---|---|---|
| development | `sii_dev` (local) | Seed only | optional | yes |
| test | `sii_test` (dedicated; **truncated and reseeded by every integration run**) | Seed + synthetic fixtures | required | yes |
| staging | Separate managed instance | Seed + anonymized samples. **Never production personal data.** | required | no |
| production | Managed Postgres with point-in-time recovery | Real | required | refused |

Each environment has its own `APP_SECRET`, database and storage bucket. Production data is never copied downward.

## 5. Backup and disaster recovery

- **Database backups.** Managed point-in-time recovery (7–30 days), plus a nightly logical dump (`pg_dump -Fc`) to separate, encrypted object storage in another region with 35-day retention.
- **Storage.** Bucket versioning enabled, with cross-region replication for supplier documents.
- **Targets.** RPO ≤ 24 h (≤ 5 min with PITR); RTO ≤ 4 h.
- **Restore tests.** Quarterly, into staging: run `npm run db:migrate`, verify `/completion` counts and audit-log continuity, and record the result in the audit log.
- **`APP_SECRET`** is stored in the hosting provider's secret manager with a sealed offline copy. Losing it invalidates signed URLs and TOTP enrolments; data is otherwise unaffected.

## 6. Retention

This is the retention **policy**. Phase 1 enforces the parts marked ✓ in code. The time-based purges (sessions, security events, search logs, withdrawn participants) need a scheduled job, which is a Phase 2 item. Until then they are run manually.

| Data | Retention |
|---|---|
| Audit log | Permanent (append-only) ✓ |
| Security events | 2 years |
| Sessions | Deleted 30 days after expiry |
| Search logs | 13 months, then aggregated |
| Import job rows (raw payload) | Cleared when the job completes; per-row outcomes kept ✓ |
| Supplier documents | For the life of the supplier relationship + 7 years, or as the supplier agreement specifies |
| Hair Passport records | As set by consent and protocol; withdrawal schedules deletion after 30 days unless under legal hold (scheduling ✓, purge job Phase 2); rejected payloads are never stored ✓ |
| Mock integration data | May be purged at any time |

## 7. Incident response

1. **Detect.** Watch for security events (spikes in `LOGIN_LOCKED`, `PERMISSION_DENIED`, `API_KEY_INVALID`), hosting alerts and user reports.
2. **Contain.**
   - Revoke the affected sessions and API keys (Settings → API keys).
   - Disable the affected accounts.
   - Rotate `APP_SECRET` if signed URLs or TOTP secrets may be exposed; users must then re-enrol MFA.
3. **Assess.** Use the audit log (append-only) to establish what was read or changed, by whom and when. Check organization boundaries.
4. **Notify.**
   - Internal owner within 24 h.
   - Affected partner organizations.
   - For participant data: privacy counsel, and regulators within statutory deadlines (e.g. GDPR 72 h) where applicable.
5. **Recover.** Restore from backup if integrity is in doubt, then re-verify review decisions made during the incident window.
6. **Review.** Run a post-incident review within 10 working days and record follow-up actions.
