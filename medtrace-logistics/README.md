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

## Stack

- `server/` — Node.js + Express, JSON-file storage (`server/data/db.json`,
  auto-seeded on first run), JWT auth.
- `client/` — React + TypeScript + Vite + Tailwind CSS v4 + React Router.

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
