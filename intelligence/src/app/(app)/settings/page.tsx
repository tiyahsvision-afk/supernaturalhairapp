import type { Role } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/auth/next'
import { can, PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS } from '@/lib/permissions'
import { Badge, Card, KeyValue, PageHeader, TableWrap, Tabs } from '@/components/ui'
import { revokeApiKeyAction, setRolesAction, setUserStatusAction } from './actions'
import { ApiKeyForm, CreateUserForm, PasswordForm } from './Forms'

export const dynamic = 'force-dynamic'
const ROLES = Object.keys(ROLE_LABELS) as Role[]

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireUser()
  const { tab = 'account' } = await searchParams
  const tabs = [{ key: 'account', label: 'My account' }, ...(can(s.principal, 'user:manage') ? [{ key: 'users', label: 'Users & roles' }] : []), ...(can(s.principal, 'apikey:manage') ? [{ key: 'keys', label: 'API keys' }] : []), { key: 'matrix', label: 'Permission matrix' }, { key: 'reviews', label: 'Review requirements' }]
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs active={tab} base="/settings" tabs={tabs} />
      {tab === 'account' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Account"><KeyValue items={[['Name', s.user.name], ['Email', s.user.email], ['Organization', s.user.organizationName], ['Roles', s.principal.roles.map((r) => ROLE_LABELS[r]).join(', ')], ['Two-factor authentication', s.user.mfaEnabled ? <Badge key="m" tone="good">enabled</Badge> : <a key="m" href="/mfa?enroll=1">Enable</a>]]} /></Card>
          <Card title="Change password"><PasswordForm /></Card>
        </div>
      )}
      {tab === 'users' && can(s.principal, 'user:manage') && <Users />}
      {tab === 'keys' && can(s.principal, 'apikey:manage') && <Keys />}
      {tab === 'matrix' && (
        <TableWrap><table><thead><tr><th>Permission</th>{ROLES.map((r) => <th key={r} className="whitespace-nowrap">{ROLE_LABELS[r]}</th>)}</tr></thead><tbody>
          {PERMISSIONS.map((p) => <tr key={p}><td className="mono text-xs">{p}</td>{ROLES.map((r) => <td key={r} className="text-center">{ROLE_PERMISSIONS[r].includes(p) ? '✓' : ''}</td>)}</tr>)}
        </tbody></table></TableWrap>
      )}
      {tab === 'reviews' && <Reviews />}
    </>
  )

  async function Users() {
    const [users, orgs] = await Promise.all([prisma.user.findMany({ include: { roles: true, organization: true }, orderBy: { email: 'asc' } }), prisma.organization.findMany({ orderBy: { name: 'asc' } })])
    return (
      <>
        <Card title="Create user" className="mb-4"><CreateUserForm roles={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} /></Card>
        <TableWrap><table><thead><tr><th>User</th><th>Organization</th><th>Roles</th><th>MFA</th><th>Status</th><th>Last sign-in</th></tr></thead><tbody>
          {users.map((u) => (
            <tr key={u.id}><td>{u.name}<div className="text-xs text-ink-3">{u.email}</div></td><td className="text-xs">{u.organization.name}</td>
              <td><form action={setRolesAction}><input type="hidden" name="userId" value={u.id} /><div className="flex max-w-md flex-wrap gap-x-2 text-xs">{ROLES.map((r) => <label key={r} className="inline-flex items-center gap-1"><input type="checkbox" name="roles" value={r} defaultChecked={u.roles.some((x) => x.role === r)} />{ROLE_LABELS[r]}</label>)}</div><button className="text-xs underline">Save roles</button></form></td>
              <td>{u.mfaEnabled ? <Badge tone="good">on</Badge> : <Badge>off</Badge>}</td>
              <td><form action={setUserStatusAction}><input type="hidden" name="userId" value={u.id} /><button name="status" value={u.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED'} className="text-xs underline">{u.status === 'DISABLED' ? 'Re-enable' : 'Disable'}</button></form><div className="text-xs text-ink-3">{u.status.toLowerCase()}{u.lockedUntil && u.lockedUntil > new Date() ? ' · locked' : ''}</div></td>
              <td className="text-xs">{u.lastLoginAt?.toISOString().slice(0, 16).replace('T', ' ') ?? 'never'}</td></tr>
          ))}
        </tbody></table></TableWrap>
      </>
    )
  }

  async function Keys() {
    const keys = await prisma.apiKey.findMany({ where: { organizationId: s.user.organizationId }, orderBy: { createdAt: 'desc' } })
    return (
      <>
        <Card title="Create API key" className="mb-4"><ApiKeyForm scopes={[...PERMISSIONS]} /><p className="mt-2 text-xs text-ink-3">Keys are organization-scoped, expire, can be revoked, and grant only the selected scopes. Only a SHA-256 hash is stored.</p></Card>
        <TableWrap><table><thead><tr><th>Name</th><th>Prefix</th><th>Scopes</th><th>Expires</th><th>Last used</th><th /></tr></thead><tbody>
          {keys.map((k) => <tr key={k.id}><td>{k.name}</td><td className="mono text-xs">{k.prefix}</td><td className="text-xs">{k.scopes.join(', ')}</td><td className="text-xs">{k.expiresAt?.toISOString().slice(0, 10) ?? 'never'}</td><td className="text-xs">{k.lastUsedAt?.toISOString().slice(0, 16) ?? 'never'}</td><td>{k.revokedAt ? <Badge>revoked</Badge> : <form action={revokeApiKeyAction}><input type="hidden" name="id" value={k.id} /><button className="text-xs text-bad underline">Revoke</button></form>}</td></tr>)}
        </tbody></table></TableWrap>
      </>
    )
  }

  async function Reviews() {
    const reqs = await prisma.reviewRequirement.findMany({ orderBy: { recordType: 'asc' } })
    return (
      <TableWrap><table><thead><tr><th>Record type</th><th>Review type</th><th>Qualified roles</th><th>Approvals</th><th>Second reviewer</th><th>Blind</th><th>Due (days)</th><th>Notes</th></tr></thead><tbody>
        {reqs.map((r) => <tr key={r.id}><td>{r.recordType}</td><td className="text-xs">{r.reviewType.toLowerCase().replace(/_/g, ' ')}</td><td className="text-xs">{r.requiredRoles.map((x) => ROLE_LABELS[x]).join(', ')}</td><td>{r.approvalsRequired}</td><td>{r.secondReviewer ? 'yes' : 'no'}</td><td>{r.blind ? 'yes' : 'no'}</td><td>{r.dueInDays}</td><td className="text-xs text-ink-3">{r.notes}</td></tr>)}
      </tbody></table></TableWrap>
    )
  }
}
