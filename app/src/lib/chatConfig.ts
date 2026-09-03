// Kept separate from firebase.ts (which pulls in the ~500KB Firebase SDK) so
// checking "is chat configured?" never costs regular visitors that download —
// the SDK is only fetched on demand once it's actually needed.
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}

export function chatBackendConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId)
}

export const OWNER_EMAIL = 'tiyahsvision@gmail.com'
