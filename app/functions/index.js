import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from './knowledge.js'

initializeApp()
const db = getFirestore()

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_HISTORY_MESSAGES = 20
const FALLBACK_REPLY =
  "Sorry, I'm having trouble responding right now — Tia will follow up with you personally soon."

// Claude requires alternating user/assistant turns — collapse any
// consecutive same-role messages (e.g. two quick customer texts in a row)
// into one turn so the API call doesn't reject the request.
function toClaudeTurns(messages) {
  const turns = []
  for (const m of messages) {
    const role = m.from === 'customer' ? 'user' : 'assistant'
    const last = turns[turns.length - 1]
    if (last && last.role === role) {
      last.content += '\n' + m.body
    } else {
      turns.push({ role, content: String(m.body ?? '') })
    }
  }
  return turns
}

export const replyToCustomerMessage = onDocumentCreated(
  {
    document: 'conversations/{convId}/messages/{messageId}',
    secrets: [ANTHROPIC_API_KEY],
  },
  async (event) => {
    const message = event.data?.data()
    if (!message || message.from !== 'customer') return

    const convId = event.params.convId
    const messagesRef = db.collection('conversations').doc(convId).collection('messages')

    const historySnap = await messagesRef.orderBy('createdAt', 'asc').limitToLast(MAX_HISTORY_MESSAGES).get()
    const turns = toClaudeTurns(historySnap.docs.map((d) => d.data()))

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() })

    let replyText = ''
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: turns,
      })
      replyText = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim()
    } catch (err) {
      console.error('Anthropic call failed:', err)
    }

    if (!replyText) replyText = FALLBACK_REPLY

    await messagesRef.add({ from: 'ai', body: replyText, createdAt: FieldValue.serverTimestamp() })
    await db
      .collection('conversations')
      .doc(convId)
      .set({ lastMessage: replyText, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  },
)
