import { Link } from 'react-router-dom'
import GlowCard from '@/components/layout/GlowCard'
import type { ForumThread } from '@/lib/types'

export default function ThreadCard({ thread }: { thread: ForumThread }) {
  return (
    <Link to={`/forum/${thread.id}`}>
      <GlowCard className="transition-transform hover:-translate-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">{thread.category}</p>
        <h3 className="mt-1.5 font-display text-base font-bold text-white">{thread.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-white/60">{thread.body}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-white/40">
          <span>{thread.author}</span>
          <span>·</span>
          <span>{new Date(thread.createdAt).toLocaleDateString()}</span>
          <span>·</span>
          <span>♡ {thread.likes}</span>
          <span>·</span>
          <span>{thread.replies.length} replies</span>
        </div>
      </GlowCard>
    </Link>
  )
}
