import { useState } from 'react'
import ChatPanel from './ChatPanel'

export default function ChatBubble() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-24 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-sky-400 via-fuchsia-400 to-lavender-400 text-2xl text-ink-950 shadow-[0_8px_30px_rgba(232,121,249,0.45)] transition-transform hover:scale-105 sm:bottom-6"
        aria-label={open ? 'Close chat' : 'Message us'}
      >
        {open ? '✕' : '💬'}
      </button>
      {open && <ChatPanel onClose={() => setOpen(false)} />}
    </>
  )
}
