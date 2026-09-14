# Turning on the two-way chat

The chat bubble and Inbox page are already built. They just need a free
Firebase project to actually store and sync messages. Takes about 10 minutes,
one time.

## 1. Create the project

1. Go to https://console.firebase.google.com and sign in with
   tiyahsvision@gmail.com.
2. Click **Add project**, name it anything (e.g. "supernatural-hair-app"),
   and finish the setup wizard (Google Analytics is optional — skip it).

## 2. Add a web app

1. On the project's home page, click the **</>** (web) icon to add a web app.
2. Give it any nickname. You don't need Firebase Hosting — skip that step.
3. It'll show you a `firebaseConfig` object with values like `apiKey`,
   `authDomain`, `projectId`, etc. **Copy the whole object** — send it to
   Claude, or paste it directly into `app/src/lib/chatConfig.ts` in place of
   the empty `FIREBASE_CONFIG` values.

## 3. Turn on Firestore (the database)

1. In the left sidebar, click **Build → Firestore Database**.
2. Click **Create database**. Choose any location close to you. Start in
   **production mode**.
3. Once it's created, go to the **Rules** tab and replace everything with:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function isOwner() {
         return request.auth != null && request.auth.token.email == 'tiyahsvision@gmail.com';
       }
       match /conversations/{convId} {
         allow read, write: if isOwner() || (request.auth != null && request.auth.uid == convId);
         match /messages/{messageId} {
           allow read: if isOwner() || (request.auth != null && request.auth.uid == convId);
           allow create: if request.auth != null && (request.auth.uid == convId || isOwner());
         }
       }
       match /users/{uid} {
         allow read, write: if isOwner() || (request.auth != null && request.auth.uid == uid);
       }
     }
   }
   ```

   This means: each customer can only ever see their own conversation, and
   only your email can see and reply to all of them. Click **Publish**.

## 4. Turn on sign-in methods

1. In the left sidebar, click **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Anonymous** (this is what lets a
   customer chat without creating an account).
3. Also enable **Email/Password** — this is how *you* sign into the Inbox.
4. Go to the **Users** tab and click **Add user**. Use
   tiyahsvision@gmail.com and a password you'll remember — that's your
   Inbox login.

## 5. Send the config over

Once steps 1–4 are done, send Claude the `firebaseConfig` object from step 2
(or paste it into `app/src/lib/chatConfig.ts` yourself, replacing the empty
strings). After that's pushed, the chat bubble goes live for real, and you
can sign in at `/inbox` with the email and password from step 4.

# Turning on the AI Journey Assistant

The chat now has a real AI ("Journey Assistant") that answers customer
questions using Tia's book and the product catalog (see
`app/functions/knowledge.js`). It runs as a Firebase Cloud Function, which
needs a couple of things enabled — all doable in the browser, no terminal
required. GitHub Actions deploys the function automatically once these are
set.

## 1. Upgrade Firebase to the "Blaze" plan

Cloud Functions require this. It's still pay-as-you-go with a large free
tier — for a small chat volume this should cost close to nothing, but it
needs a card on file.

1. In the Firebase console, click **Upgrade** (bottom-left, next to the
   "Spark" plan name) or go to Project Settings → Usage and billing.
2. Choose **Blaze**, attach a billing account (or create one), and confirm.

## 2. Get an Anthropic API key

This is what actually powers the AI's answers — a separate account from
regular Claude.ai.

1. Go to https://console.anthropic.com and sign in or create an account.
2. Go to **API Keys** → **Create Key**. Copy the key (starts with `sk-ant-`).
3. Add billing there too (Settings → Billing) — usage-based, small per-message cost.

## 3. Generate a Firebase service account key

This lets GitHub deploy the function on your behalf, without you ever
touching a terminal.

1. In the Firebase console: **Project Settings** (gear icon) → **Service
   accounts** tab.
2. Click **Generate new private key** → **Generate key**. A `.json` file
   downloads.
3. Open that file in a text editor and copy its *entire* contents.

## 4. Add both as GitHub secrets

1. Go to the repo on GitHub → **Settings** → **Secrets and variables** →
   **Actions**.
2. Click **New repository secret**, name it `ANTHROPIC_API_KEY`, paste the
   key from step 2, save.
3. Click **New repository secret** again, name it `FIREBASE_SERVICE_ACCOUNT`,
   paste the *entire JSON file contents* from step 3, save.

## 5. Done — it deploys itself

Once both secrets are saved, go to the repo's **Actions** tab, find
"Deploy AI chat assistant (Firebase Functions)," and click **Run workflow**
(or just push any change to `app/functions/**` — it deploys automatically
from then on). After it finishes, every new customer message gets a real
AI-generated reply, and you'll see it labeled "AI" in your Inbox so you
can tell it apart from your own replies.

To change what the assistant knows (add products, correct something,
adjust its tone), edit `app/functions/knowledge.js` and push — no other
setup needed after that, it redeploys on its own.
