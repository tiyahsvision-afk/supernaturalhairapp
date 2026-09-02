# Supernatural Journey

A companion web app for customers who've bought the **Supernatural Hair Care Journey Kit** (shcbeauty.com). Built as a single-page React app — digital consultation, a routine scheduler, reminders, progress photos, one-tap Shopify reorder, a rewards program, a Members Club, and a community forum.

## Stack

- **React 19 + TypeScript + Vite**
- **Tailwind CSS v4** — theme tokens (sky blue / fuchsia / light fuchsia / lavender / white on a deep-space "ink" background) live in `src/index.css` under `@theme`
- **react-router-dom** for routing
- **zustand** (with `persist`) as the single client-side store — see `src/store/useAppStore.ts`
- **IndexedDB** (a tiny hand-rolled wrapper, `src/lib/photoStore.ts`) for progress-photo blobs, kept separate from the localStorage-persisted app state so that state snapshot stays small

No backend exists yet — this is a fully working front-end MVP. Every feature is real and interactive; data lives in the browser (localStorage + IndexedDB). See **Going to production** below for what a real backend adds.

## Live site

Every push to `claude/supernatural-journey-app-wxdict` that touches `app/` automatically publishes to:

**https://tiyahsvision-afk.github.io/supernaturalhairapp/**

via `.github/workflows/deploy-pages.yml` (build with Vite, deploy with GitHub Pages). No manual steps needed after the first-ever deploy, which may need "Settings → Pages → Source: GitHub Actions" turned on once for this repository if it isn't already.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-checks + production build to dist/
```

## Feature map

| Feature | Where | Notes |
|---|---|---|
| Digital consultation | `/consultation` | Rule-based engine in `src/lib/consultation.ts` maps hair type/porosity/scalp/goal answers to a per-product frequency plan for the 5 core Journey Kit steps. Fully re-takeable/editable; history is kept. |
| Scheduler | `/scheduler` | Month calendar, per-day product + hairstyle assignment, one-tap "fill next 7 days from my consultation". |
| Reminders | Site-wide (`useReminderEngine`) + `/profile` toggle | Browser Notification API, best-effort while the tab is open. Also a "Today" checklist on the dashboard people can check off regardless of notification permission. |
| Progress photos | `/progress` | Camera/file capture, stored in IndexedDB, timeline gallery. |
| Reorder | `/reorder` | Real Shopify catalog data (`src/lib/shopify.ts`) with cart permalinks — one tap goes straight to a pre-filled checkout on shcbeauty.com. Supports full-kit, consultation-recommended, and custom multi-select reorders. |
| Rewards | `/rewards` | Points ledger for sharing photos, referrals, consultations, joining the club; redeemable tiers. |
| Members Club | `/members` | Benefits pulled from the real "MEMBERS ONLY" product (journey coaching, meetups, Bible study, creator spotlights/magazine). |
| Forum | `/forum` | Categories, threads, replies — seeded with brand-voice example content. |

## Real Shopify data

`src/lib/shopify.ts` and `src/lib/seedData.ts` are grounded in the live shcbeauty.com catalog (pulled via the Shopify Admin API at build time): DETOX Shampoo, REMEDY Conditioner, GROW Hair Growth Oil, REST Scalp Massage Oil, NOURISH Moisturizer, the Massaging Brush, the $70 Journey Kit, the Discovery Kit, the Members Only product, and recent Journey Magazine issues — including real prices, images, and variant IDs.

Reorder buttons use **Shopify cart permalinks** (`https://shcbeauty.com/cart/{variantId}:{qty}`), which requires no API keys or Storefront token — just a link.

## Going to production

This app intentionally ships as a self-contained MVP. To take it further:

1. **Backend + accounts.** Replace the zustand/localStorage store with a real backend (e.g. a small API + Postgres, or a BaaS like Supabase) so profiles, schedules, and photos sync across devices and don't live only in one browser. Gate it behind real auth (email/password or Shopify customer accounts via the Shopify Customer Account API) instead of the current lightweight profile-only onboarding.
2. **True push notifications.** The current reminder engine (`src/hooks/useReminderEngine.ts`) fires `Notification`s only while the tab is open. For notifications when the app/browser is closed, add a service worker with a `push` handler plus a backend that stores push subscriptions and sends them on a schedule (or reuse an email/SMS provider, e.g. via Klaviyo, which SHC likely already has for the Shopify store).
3. **Rewards ↔ Shopify.** `RedeemTiers.tsx` currently generates a demo code client-side. Wire it to a real Shopify discount (Admin API `discountCodeBasicCreate`) created server-side, or to a rewards app like Smile.io/Yotpo, so codes are real and single-use.
4. **Forum & UGC moderation.** The forum and testimonials are currently seed data plus local posts. A production version needs a backend datastore, basic moderation, and (optionally) pulling real UGC from Shopify product reviews or Instagram.
5. **Shopify customer linking.** To auto-detect "this person owns a Journey Kit," link the app account to the customer's Shopify order history via the Storefront/Customer Account API rather than trusting self-reported onboarding.

## Design system

Palette (see `@theme` in `src/index.css`): `sky-*` (light blue), `fuchsia-*` / light fuchsia, `lavender-*`, and white on a white background, with `ink-*` (a deep space navy/violet) reserved for text and subtle dark-tinted borders/fills. Cards use the `glass-panel`/`glow-border` utility classes (soft elevation shadow + a pastel gradient border), gradient headings/buttons, and softly animated pastel glow blobs behind the hero for the "futuristic, high-tech" feel requested. A dark theme toggle is a natural next iteration; the current build ships one considered light theme.
