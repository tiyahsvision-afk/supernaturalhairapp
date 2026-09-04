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
