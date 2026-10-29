import { requireUser } from '@/lib/auth/next'
import { Card, PageHeader } from '@/components/ui'
import { OPENAPI } from '@/lib/api/openapi'

export default async function ApiDocs() {
  await requireUser()
  const paths = Object.entries(OPENAPI.paths) as [string, Record<string, { summary: string; 'x-scope'?: string }>][]
  return (
    <>
      <PageHeader eyebrow="Private, versioned REST API" title="API v1" subtitle={<>Machine-readable spec: <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>. Authenticate with <code>Authorization: Bearer sii_…</code> (keys in Settings → API keys) or a signed-in session.</>} />
      <Card title="Conventions" className="mb-4"><ul className="list-disc pl-5 text-sm text-ink-2"><li>Pagination: <code>?limit=</code> (max 100) and <code>?cursor=</code>; responses include <code>nextCursor</code>.</li><li>Errors: <code>{'{ "error": { "code", "message", "details" } }'}</code> with HTTP status.</li><li>Rate limit: 120-request burst, 2 req/s refill per key; <code>429</code> with <code>Retry-After</code>.</li><li>API-key requests never return records from sources whose rights block external API use, private records of other organizations, or participant-level data without the outcome scope and consent.</li><li>Every write is audit-logged.</li></ul></Card>
      <Card title="Endpoints"><table><thead><tr><th>Method</th><th>Path</th><th>Summary</th><th>Scope</th></tr></thead><tbody>
        {paths.flatMap(([p, ops]) => Object.entries(ops).map(([m, o]) => <tr key={p + m}><td className="mono text-xs uppercase">{m}</td><td className="mono text-xs">{p}</td><td className="text-sm">{o.summary}</td><td className="mono text-xs">{o['x-scope']}</td></tr>))}
      </tbody></table></Card>
    </>
  )
}
