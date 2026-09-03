import { useState } from 'react'
import { sendContactMessage } from '@/lib/contact'
import { useAppStore } from '@/store/useAppStore'

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const profile = useAppStore((s) => s.profile)
  const chatMessages = useAppStore((s) => s.chatMessages)
  const addChatMessage = useAppStore((s) => s.addChatMessage)

  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSend() {
    if (!name.trim() || !email.trim() || !message.trim()) return
    setSending(true)
    setNotice(null)
    try {
      const result = await sendContactMessage({ name: name.trim(), email: email.trim(), message: message.trim() })
      addChatMessage({
        name: name.trim(),
        email: email.trim(),
        body: message.trim(),
        deliveryMethod: result.method,
      })
      setMessage('')
      setNotice(
        result.method === 'email'
          ? "Sent! We'll reply to your email soon."
          : 'Opened your email app to finish sending — just hit send there.',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-x-4 bottom-40 z-50 mx-auto flex max-h-[65vh] w-auto max-w-sm flex-col overflow-hidden rounded-3xl border border-ink-900/10 bg-white shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-24 sm:w-96">
      <div className="flex items-center justify-between border-b border-ink-900/10 bg-gradient-to-r from-sky-50 via-fuchsia-50 to-lavender-50 px-5 py-4">
        <div>
          <p className="font-display text-sm font-bold text-ink-900">Message Tia</p>
          <p className="text-xs text-ink-900/50">Usually replies within a day</p>
        </div>
        <button
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-900/50 hover:bg-ink-900/5 hover:text-ink-900"
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>

      {chatMessages.length > 0 && (
        <div className="max-h-40 overflow-y-auto border-b border-ink-900/10 px-5 py-3">
          {chatMessages.map((m) => (
            <div key={m.id} className="mb-2 ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-fuchsia-50 px-3 py-2 text-right">
              <p className="text-xs text-ink-900/80">{m.body}</p>
              <p className="mt-0.5 text-[10px] text-ink-900/40">{new Date(m.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 px-5 py-4">
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
          rows={3}
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
