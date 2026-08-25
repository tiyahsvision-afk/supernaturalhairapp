import { useState } from 'react'
import PageShell from '@/components/layout/PageShell'
import SectionHeading from '@/components/layout/SectionHeading'
import ThreadCard from '@/components/forum/ThreadCard'
import NewThreadForm from '@/components/forum/NewThreadForm'
import { useAppStore } from '@/store/useAppStore'
import type { ForumCategory } from '@/lib/types'

const CATEGORIES: (ForumCategory | 'All')[] = [
  'All',
  'Hair Journey Wins',
  'Identity & Faith',
  'Style Swap',
  'Ask the Community',
]

export default function ForumPage() {
  const threads = useAppStore((s) => s.forumThreads)
  const onboarded = useAppStore((s) => s.onboarded)
  const [filter, setFilter] = useState<ForumCategory | 'All'>('All')
  const [showForm, setShowForm] = useState(false)

  const visible = filter === 'All' ? threads : threads.filter((t) => t.category === filter)

  return (
    <PageShell>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <SectionHeading
          eyebrow="Community"
          title="Talk about your supernatural experiences"
          description="Wins, identity & faith reflections, style swaps, and open questions."
        />
        {onboarded && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="shrink-0 rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:scale-105 transition-transform"
          >
            {showForm ? 'Close' : '+ New Post'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-8">
          <NewThreadForm onPosted={() => setShowForm(false)} />
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              filter === c ? 'bg-ink-900/10 text-ink-900 border border-ink-900/20' : 'text-ink-900/50 hover:text-ink-900'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {visible.map((t) => (
          <ThreadCard key={t.id} thread={t} />
        ))}
      </div>
    </PageShell>
  )
}
