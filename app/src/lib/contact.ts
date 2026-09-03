// Delivers a message from the chat bubble straight to the owner's inbox.
//
// This site is fully static (no server of its own), so a third-party form
// relay does the actual delivery: Formspree (https://formspree.io) accepts a
// POST from any public site and emails it on — with reply-to set to the
// customer, so replying is just replying to a normal email. It's free and
// takes about 2 minutes to set up:
//   1. Sign up at formspree.io with tiyahsvision@gmail.com
//   2. Create a new form, copy its form ID (the part after /f/ in the URL
//      Formspree gives you, e.g. "xanybkyz")
//   3. Paste it in as FORMSPREE_FORM_ID below
//
// Until that's set, sending falls back to opening a pre-addressed email in
// the visitor's own mail app — not as seamless, but never broken.
const FORMSPREE_FORM_ID = ''
const OWNER_EMAIL = 'tiyahsvision@gmail.com'

export interface ContactPayload {
  name: string
  email: string
  message: string
}

export async function sendContactMessage(
  payload: ContactPayload,
): Promise<{ ok: boolean; method: 'email' | 'mail-app' }> {
  if (FORMSPREE_FORM_ID) {
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_FORM_ID}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          message: payload.message,
          _replyto: payload.email,
        }),
      })
      if (res.ok) return { ok: true, method: 'email' }
    } catch {
      // network hiccup or the form ID is wrong — fall back to mail app below
    }
  }

  const subject = encodeURIComponent(`Message from ${payload.name} via Supernatural Hair App`)
  const body = encodeURIComponent(`${payload.message}\n\n— ${payload.name} (${payload.email})`)
  window.open(`mailto:${OWNER_EMAIL}?subject=${subject}&body=${body}`, '_blank')
  return { ok: true, method: 'mail-app' }
}
