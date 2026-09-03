import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  addDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { getAuthInstance, getDb } from './firebase'
import type { ConversationSummary, LiveChatMessage } from './types'

/** Signs the visitor in anonymously (once) so they have a stable conversation ID. */
export async function ensureCustomerAuth(): Promise<string | null> {
  try {
    const auth = getAuthInstance()
    // Wait for Firebase to finish restoring the saved session from this
    // browser's storage before deciding there isn't one — otherwise every
    // page load looks "new" and starts a fresh, empty conversation.
    await auth.authStateReady()
    if (auth.currentUser) return auth.currentUser.uid
    const cred = await signInAnonymously(auth)
    return cred.user.uid
  } catch {
    return null
  }
}

/** Signs the visitor in with their Google account so they never have to type name/email. */
export async function signInWithGoogle(): Promise<{ name: string; email: string } | null> {
  try {
    const cred = await signInWithPopup(getAuthInstance(), new GoogleAuthProvider())
    return { name: cred.user.displayName ?? '', email: cred.user.email ?? '' }
  } catch {
    return null
  }
}

export function onAuthChanged(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(getAuthInstance(), cb)
}

export async function ownerSignIn(email: string, password: string): Promise<string | null> {
  try {
    await signInWithEmailAndPassword(getAuthInstance(), email, password)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not sign in.'
  }
}

export function ownerSignOut(): Promise<void> {
  return signOut(getAuthInstance())
}

async function upsertConversationSummary(
  conversationId: string,
  patch: { name?: string; email?: string; lastMessage: string; unreadForOwner: boolean },
) {
  await setDoc(
    doc(getDb(), 'conversations', conversationId),
    { conversationId, updatedAt: serverTimestamp(), ...patch },
    { merge: true },
  )
}

export async function sendCustomerMessage(
  conversationId: string,
  input: { name: string; email: string; body: string },
): Promise<void> {
  await addDoc(collection(getDb(), 'conversations', conversationId, 'messages'), {
    from: 'customer',
    body: input.body,
    createdAt: serverTimestamp(),
  })
  await upsertConversationSummary(conversationId, {
    name: input.name,
    email: input.email,
    lastMessage: input.body,
    unreadForOwner: true,
  })
}

export async function sendOwnerReply(conversationId: string, body: string): Promise<void> {
  await addDoc(collection(getDb(), 'conversations', conversationId, 'messages'), {
    from: 'owner',
    body,
    createdAt: serverTimestamp(),
  })
  await upsertConversationSummary(conversationId, { lastMessage: body, unreadForOwner: false })
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await setDoc(doc(getDb(), 'conversations', conversationId), { unreadForOwner: false }, { merge: true })
}

export function subscribeToMessages(
  conversationId: string,
  cb: (messages: LiveChatMessage[]) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc'),
  )
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          from: data.from,
          body: data.body,
          createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
        } satisfies LiveChatMessage
      }),
    )
  })
}

export function subscribeToConversations(cb: (conversations: ConversationSummary[]) => void): Unsubscribe {
  const q = query(collection(getDb(), 'conversations'), orderBy('updatedAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data()
        return {
          conversationId: d.id,
          name: data.name ?? 'Anonymous',
          email: data.email ?? '',
          lastMessage: data.lastMessage ?? '',
          updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
          unreadForOwner: Boolean(data.unreadForOwner),
        } satisfies ConversationSummary
      }),
    )
  })
}
