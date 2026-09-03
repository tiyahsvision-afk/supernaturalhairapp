// Kept separate from firebase.ts (which pulls in the ~500KB Firebase SDK) so
// checking "is chat configured?" never costs regular visitors that download —
// the SDK is only fetched on demand once it's actually needed.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCLVyPF57iM0j9OxWyuLduhcMvEwwiwaO4',
  authDomain: 'supernatural-hair-3ae91.firebaseapp.com',
  projectId: 'supernatural-hair-3ae91',
  storageBucket: 'supernatural-hair-3ae91.firebasestorage.app',
  messagingSenderId: '1066793662210',
  appId: '1:1066793662210:web:577308235a693753a3341b',
}

export function chatBackendConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId)
}

export const OWNER_EMAIL = 'tiyahsvision@gmail.com'
