import { useEffect, useState } from 'react'
import PageShell from '@/components/layout/PageShell'
import SectionHeading from '@/components/layout/SectionHeading'
import GlowCard from '@/components/layout/GlowCard'
import OwnerGate from '@/components/owner/OwnerGate'
import {
  markConversationRead,
  ownerSignOut,
  sendOwnerReply,
  subscribeToConversations,
  subscribeToMessages,
} from '@/lib/chatBackend'
import type { ConversationSummary, LiveChatMessage } from '@/lib/types'

function Inbox() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<LiveChatMessage[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => subscribeToConversations(setConversations), [])

  useEffect(() => {
    if (!selected) return
    markConversationRead(selected)
    return subscribeToMessages(selected, setMessages)
  }, [selected])

  async function handleReply() {
    if (!selected || !reply.trim()) return
    setSending(true)
    try {
      await sendOwnerReply(selected, reply.trim())
      setReply('')
    } finally {
      setSending(false)
    }
  }

  const active = conversations.find((c) => c.conversationId === selected)

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <SectionHeading eyebrow="Private" title="Inbox" />
        <button onClick={() => ownerSignOut()} className="text-sm text-ink-900/50 hover:text-ink-900">
          Sign out
        </button>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[320px,1fr]">
        <div className="space-y-2">
          {conversations.length === 0 && (
            <GlowCard className="!p-4 text-sm text-ink-900/50">No messages yet.</GlowCard>
          )}
          {conversations.map((c) => (
            <button
              key={c.conversationId}
              onClick={() => setSelected(c.conversationId)}
              className={`block w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                selected === c.conversationId
                  ? 'border-fuchsia-300 bg-fuchsia-400/10'
                  : 'border-ink-900/10 bg-white hover:bg-ink-900/[0.03]'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-900">{c.name || 'Anonymous'}</p>
                {c.unreadForOwner && <span className="h-2 w-2 rounded-full bg-fuchsia-400" />}
              </div>
              <p className="truncate text-xs text-ink-900/50">{c.email}</p>
              <p className="mt-1 truncate text-xs text-ink-900/60">{c.lastMessage}</p>
            </button>
          ))}
        </div>

        <GlowCard className="flex min-h-[24rem] flex-col">
          {!active ? (
            <p className="m-auto text-sm text-ink-900/40">Pick a conversation</p>
          ) : (
            <>
              <div>
                <p className="font-display text-sm font-bold text-ink-900">{active.name}</p>
                <p className="text-xs text-ink-900/50">{active.email}</p>
              </div>
              <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      m.from === 'owner'
                        ? 'ml-auto rounded-tr-sm bg-lavender-50 text-right text-ink-900/80'
                        : 'mr-auto rounded-tl-sm bg-fuchsia-50 text-ink-900/80'
                    }`}
                  >
                    {m.body}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                  placeholder="Type a reply…"
                  className="flex-1 rounded-xl border border-ink-900/15 bg-ink-900/5 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-900/30 outline-none focus:border-fuchsia-300"
                />
                <button
                  onClick={handleReply}
                  disabled={sending || !reply.trim()}
                  className="rounded-xl bg-gradient-to-r from-sky-400 to-fuchsia-400 px-4 py-2 text-sm font-semibold text-ink-950 disabled:opacity-40"
                >
                  Reply
                </button>
              </div>
            </>
          )}
        </GlowCard>
      </div>
    </PageShell>
  )
}

export default function InboxPage() {
  return (
    <OwnerGate>
      <Inbox />
    </OwnerGate>
  )
}
