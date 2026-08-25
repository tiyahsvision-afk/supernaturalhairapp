import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import PageShell from '@/components/layout/PageShell'
import GlowCard from '@/components/layout/GlowCard'
import { useAppStore } from '@/store/useAppStore'

export default function ForumThreadPage() {
  const { threadId } = useParams()
  const thread = useAppStore((s) => s.forumThreads.find((t) => t.id === threadId))
  const likeThread = useAppStore((s) => s.likeThread)
  const addForumReply = useAppStore((s) => s.addForumReply)
  const onboarded = useAppStore((s) => s.onboarded)
  const [reply, setReply] = useState('')

  if (!thread) return <Navigate to="/forum" replace />

  function handleReply() {
    if (!thread || !reply.trim()) return
    addForumReply(thread.id, reply.trim())
    setReply('')
  }

  return (
    <PageShell className="max-w-3xl">
      <Link to="/forum" className="text-sm text-ink-900/50 hover:text-ink-900">
        ← Back to forum
      </Link>

      <GlowCard className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">{thread.category}</p>
        <h1 className="mt-1.5 font-display text-2xl font-bold text-ink-900">{thread.title}</h1>
        <p className="mt-3 whitespace-pre-line text-ink-900/75">{thread.body}</p>
        <div className="mt-4 flex items-center gap-4 text-sm text-ink-900/40">
          <span>{thread.author}</span>
          <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
          <button onClick={() => likeThread(thread.id)} className="flex items-center gap-1 hover:text-fuchsia-600">
            ♡ {thread.likes}
          </button>
        </div>
      </GlowCard>

      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-ink-900/70">{thread.replies.length} replies</h3>
        {thread.replies.map((r) => (
          <GlowCard key={r.id} className="!p-4">
            <div className="flex items-center gap-2 text-xs text-ink-900/40">
              <span className="font-semibold text-ink-900/70">{r.author}</span>
              <span>{new Date(r.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="mt-1.5 text-sm text-ink-900/80">{r.body}</p>
          </GlowCard>
        ))}
      </div>

      {onboarded ? (
        <div className="mt-6 flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Add a reply..."
            className="flex-1 rounded-xl border border-ink-900/15 bg-ink-900/5 px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-900/30 outline-none focus:border-fuchsia-300"
          />
          <button
            onClick={handleReply}
            className="rounded-xl bg-gradient-to-r from-sky-400 to-fuchsia-400 px-5 py-2.5 text-sm font-semibold text-ink-950"
          >
            Reply
          </button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-ink-900/50">
          <Link to="/onboarding" className="text-fuchsia-600 hover:underline">
            Start your journey
          </Link>{' '}
          to join the conversation.
        </p>
      )}
    </PageShell>
  )
}
