import { useState } from 'react'
import GlowCard from '@/components/layout/GlowCard'
import { useAppStore } from '@/store/useAppStore'
import type { ForumCategory } from '@/lib/types'

const CATEGORIES: ForumCategory[] = ['Hair Journey Wins', 'Identity & Faith', 'Style Swap', 'Ask the Community']

export default function NewThreadForm({ onPosted }: { onPosted?: () => void }) {
  const addForumThread = useAppStore((s) => s.addForumThread)
  const [category, setCategory] = useState<ForumCategory>('Hair Journey Wins')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  function handleSubmit() {
    if (!title.trim() || !body.trim()) return
    addForumThread({ category, title: title.trim(), body: body.trim() })
    setTitle('')
    setBody('')
    onPosted?.()
  }

  return (
    <GlowCard>
      <h3 className="font-display text-base font-bold text-white">Share with the community</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              category === c ? 'bg-fuchsia-400 text-ink-950' : 'border border-white/15 text-white/60'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Give your post a title"
        className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-300"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Share your supernatural experience..."
        className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-300"
      />
      <button
        onClick={handleSubmit}
        className="mt-3 rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 px-5 py-2 text-sm font-semibold text-ink-950 hover:scale-105 transition-transform"
      >
        Post to the community
      </button>
    </GlowCard>
  )
}
