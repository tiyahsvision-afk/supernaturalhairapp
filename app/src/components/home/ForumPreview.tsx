import { Link } from 'react-router-dom'
import SectionHeading from '@/components/layout/SectionHeading'
import GlowCard from '@/components/layout/GlowCard'
import { useAppStore } from '@/store/useAppStore'

export default function ForumPreview() {
  const threads = useAppStore((s) => s.forumThreads).slice(0, 3)

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="The community"
            title="Talk about your supernatural experiences"
            description="Hair wins, identity & faith reflections, style swaps, and open questions — from people on the same journey."
          />
          <Link
            to="/forum"
            className="shrink-0 rounded-full border border-ink-900/20 px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-ink-900/10"
          >
            Visit the forum →
          </Link>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {threads.map((t) => (
            <Link key={t.id} to="/forum">
              <GlowCard className="h-full transition-transform hover:-translate-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">{t.category}</p>
                <h3 className="mt-2 font-display text-base font-bold text-ink-900">{t.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-ink-900/60">{t.body}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-ink-900/40">
                  <span>{t.author}</span>
                  <span>·</span>
                  <span>♡ {t.likes}</span>
                  <span>·</span>
                  <span>{t.replies.length} replies</span>
                </div>
              </GlowCard>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
