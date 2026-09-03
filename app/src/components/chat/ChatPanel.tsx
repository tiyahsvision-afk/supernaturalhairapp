import { useEffect, useRef, useState } from 'react'
import { sendContactMessage } from '@/lib/contact'
import { chatBackendConfigured } from '@/lib/chatConfig'
import type { LiveChatMessage } from '@/lib/types'
import { useAppStore } from '@/store/useAppStore'

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const profile = useAppStore((s) => s.profile)
  const chatMessages = useAppStore((s) => s.chatMessages)
  const addChatMessage = useAppStore((s) => s.addChatMessage)

  const live = chatBackendConfigured()
  const backendRef = useRef<typeof import('@/lib/chatBackend') | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [liveMessages, setLiveMessages] = useState<LiveChatMessage[]>([])
  const [connecting, setConnecting] = useState(live)
  const threadEndRef = useRef<HTMLDivElement>(null)

  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!live) return
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    import('@/lib/chatBackend').then(async (backend) => {
      if (cancelled) return
      backendRef.current = backend
      const uid = await backend.ensureCustomerAuth()
      if (cancelled) return
      if (!uid) {
        setConnecting(false)
        return
      }
      setConversationId(uid)
      unsubscribe = backend.subscribeToMessages(uid, (msgs) => {
        setLiveMessages(msgs)
        setConnecting(false)
      })
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [live])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [liveMessages.length])

  async function handleSend() {
    if (!name.trim() || !email.trim() || !message.trim()) return
    setSending(true)
    setNotice(null)
    const body = message.trim()
    try {
      if (live && conversationId && backendRef.current) {
        await backendRef.current.sendCustomerMessage(conversationId, { name: name.trim(), email: email.trim(), body })
        // Still ping the owner's email so she knows to check the inbox.
        sendContactMessage({ name: name.trim(), email: email.trim(), message: body }).catch(() => {})
        setMessage('')
      } else {
        const result = await sendContactMessage({ name: name.trim(), email: email.trim(), message: body })
        addChatMessage({ name: name.trim(), email: email.trim(), body, deliveryMethod: result.method })
        setMessage('')
        setNotice(
          result.method === 'email'
            ? "Sent! We'll reply to your email soon."
            : 'Opened your email app to finish sending — just hit send there.',
        )
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-x-4 bottom-40 z-50 mx-auto flex max-h-[65vh] w-auto max-w-sm flex-col overflow-hidden rounded-3xl border border-ink-900/10 bg-white shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-96">
      <div className="flex items-center justify-between border-b border-ink-900/10 bg-gradient-to-r from-sky-50 via-fuchsia-50 to-lavender-50 px-5 py-4">
        <div>
          <p className="font-display text-sm font-bold text-ink-900">Message Tia</p>
          <p className="text-xs text-ink-900/50">
            {live ? "You'll see her reply right here" : 'Usually replies within a day'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-900/50 hover:bg-ink-900/5 hover:text-ink-900"
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>

      {live ? (
        <div className="max-h-64 min-h-[3rem] overflow-y-auto px-5 py-3">
          {connecting && <p className="text-center text-xs text-ink-900/40">Connecting…</p>}
          {!connecting && liveMessages.length === 0 && (
            <p className="text-center text-xs text-ink-900/40">Say hello — Tia will see it here.</p>
          )}
          {liveMessages.map((m) => (
            <div
              key={m.id}
              className={`mb-2 max-w-[85%] rounded-2xl px-3 py-2 ${
                m.from === 'owner'
                  ? 'mr-auto rounded-tl-sm bg-lavender-50 text-left'
                  : 'ml-auto rounded-tr-sm bg-fuchsia-50 text-right'
              }`}
            >
              {m.from === 'owner' && <p className="text-[10px] font-semibold text-lavender-600">Tia</p>}
              <p className="text-xs text-ink-900/80">{m.body}</p>
              <p className="mt-0.5 text-[10px] text-ink-900/40">
                {new Date(m.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
          <div ref={threadEndRef} />
        </div>
      ) : (
        chatMessages.length > 0 && (
          <div className="max-h-40 overflow-y-auto border-b border-ink-900/10 px-5 py-3">
            {chatMessages.map((m) => (
              <div key={m.id} className="mb-2 ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-fuchsia-50 px-3 py-2 text-right">
                <p className="text-xs text-ink-900/80">{m.body}</p>
                <p className="mt-0.5 text-[10px] text-ink-900/40">{new Date(m.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )
      )}

      <div className="space-y-3 border-t border-ink-900/10 px-5 py-4">
        {!profile.name && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-900/30 outline-none focus:border-fuchsia-300"
          />
        )}
        {!profile.email && (
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Your email"
            className="w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-900/30 outline-none focus:border-fuchsia-300"
          />
        )}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={live ? 2 : 3}
          placeholder="What's on your mind?"
          className="w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-900/30 outline-none focus:border-fuchsia-300"
        />
        <button
          onClick={handleSend}
          disabled={sending || !name.trim() || !email.trim() || !message.trim()}
          className="w-full rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 py-2.5 text-sm font-semibold text-ink-950 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          {sending ? 'Sending…' : 'Send message'}
        </button>
        {notice && <p className="text-center text-xs text-ink-900/60">{notice}</p>}
      </div>
    </div>
  )
}
