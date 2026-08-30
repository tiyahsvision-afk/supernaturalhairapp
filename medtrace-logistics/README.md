# MedTrace Logistics

A local duplicate of the **MedTrace Logistics** app from your Base44 account —
a pharmacy courier / chain-of-custody delivery tracker for a logistics
company. Base44's sandbox-bridge tools (which expose an app's actual source
files) require the Builder plan, so this rebuild was generated from the six
entity schemas pulled from the Base44 app (`Company`, `User`, `Driver`,
`Order`, `ChainOfCustodyEvent`, `DriverMessage`), reimplemented as a
standalone full-stack app: an Express API plus a React dispatcher/driver
frontend, with the same multi-tenant, role-based shape as the original.

## What it does

- **Multi-tenant companies** — each logistics company has its own drivers,
  orders and messages, isolated by `company_id` (mirroring the original
  app's row-level-security rules). A platform admin can create companies; new
  users join one with a shareable join code.
- **Dispatcher view** — a dispatch board with live stats, order creation
  (patient info, pickup/delivery, priority, package type — including
  cold-chain, controlled-substance, and DOT-specimen handling), driver
  assignment, and a chain-of-custody timeline per order.
- **Driver portal** — a driver's assigned deliveries with one-tap status
  progression (picked up → in transit → arrived → delivered), temperature
  logging with automatic excursion detection against the order's allowed
  range, dual-signature capture for controlled substances, and exception
  reporting.
- **Messaging** — a lightweight thread between dispatch and each driver.
- **Installable PWA** — a web manifest and service worker (`vite-plugin-pwa`,
  `injectManifest` strategy) give it a home-screen icon, standalone launch,
  and offline app-shell caching (API `GET`s are cached network-first so the
  last-seen data still shows up offline).
- **Live updates** — a WebSocket (`ws`) broadcasts a per-topic "changed"
  event on every mutation; every open tab refetches automatically, so a
  dispatcher assigning a driver shows up on that driver's phone with no
  reload. The header's Live/Offline pill reflects the socket's state.
- **Map view** — drivers and active deliveries plotted on an OpenStreetMap
  / Leaflet map, color-coded by status. Drivers can tap **Share my location**
  to stream their real position (`navigator.geolocation.watchPosition`) to
  the map via `PATCH /api/drivers/:id`.
- **Push notifications** — Web Push (`web-push` + VAPID, keys auto-generated
  into `server/data/vapid.json` on first run) notifies a driver when they're
  assigned a delivery and notifies dispatch when a driver reports a problem
  or sends a message — even when the tab is closed, once a user opts in via
  **Enable notifications**.
- **Real signature + photo capture** — an actual `<canvas>` signature pad
  (mouse/touch) for dual-signature deliveries, and a camera-capable file
  input for an optional proof-of-delivery photo; both are stored as data
  URLs and shown back to dispatch on the order.

## Stack

- `server/` — Node.js + Express, JSON-file storage (`server/data/db.json`,
  auto-seeded on first run), JWT auth, a `ws` WebSocket server for live
  updates, and `web-push` for push notifications.
- `client/` — React + TypeScript + Vite + Tailwind CSS v4 + React Router,
  `vite-plugin-pwa` for the installable app shell, and Leaflet for the map.

## Running it

```bash
# API (http://localhost:4000)
cd server
npm install
npm run dev

# Frontend (http://localhost:5173, proxies /api to the server above)
cd client
npm install
npm run dev
```

## Demo accounts

Seeded on first run for **Great Lakes Pharmacy Courier** (join code
`GLRX-2026`), password `password123` for all:

| Email | Role |
|---|---|
| `dispatch@greatlakesrx.com` | Dispatcher (company admin) |
| `j.rivera@greatlakesrx.com` | Driver |
| `s.okafor@greatlakesrx.com` | Driver |
| `admin@medtrace.app` | Platform admin (can create new companies) |

New users can sign up and join an existing company with its join code.
Creating a new company is restricted to the platform admin account, matching
the original app's Company entity rules — sign in as `admin@medtrace.app` to
do that via `POST /api/companies`.

## Notes

- Push notifications and the service worker need either `localhost` or
  HTTPS — both work in dev (`localhost:5173`) but a real deployment needs
  TLS.
- **Enable notifications** and **Share my location** each prompt for a
  browser permission the first time they're used.
