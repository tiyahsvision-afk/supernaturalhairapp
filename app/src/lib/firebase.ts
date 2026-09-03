// Firebase powers the real two-way chat (a shared database so a reply typed
// in the owner's Inbox shows up live in the customer's chat window). Firebase
// is free at this scale and the web config is *meant* to be public — it's not
// a secret, it just tells the browser which project to talk to. Access is
// locked down by the Firestore security rules instead (see
// app/FIREBASE_SETUP.md). This module is only ever loaded on demand (via
// dynamic import) once chat is actually used, so it never weighs down the
// initial page load for everyone else.
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { FIREBASE_CONFIG } from './chatConfig'

let app: FirebaseApp | undefined
let authInstance: Auth | undefined
let dbInstance: Firestore | undefined

function ensureApp(): FirebaseApp {
  if (!app) app = initializeApp(FIREBASE_CONFIG)
  return app
}

export function getAuthInstance(): Auth {
  if (!authInstance) authInstance = getAuth(ensureApp())
  return authInstance
}

export function getDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(ensureApp())
  return dbInstance
}
