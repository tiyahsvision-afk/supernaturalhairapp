# Supernatural Ingredient Intelligence

A private research and decision-support system that connects **ingredient → raw material → formula → product → phenotype → intervention → outcome → time**, with provenance on every fact.

It is a standalone application. It integrates with Hair Passport only through a versioned, mock-tested contract (`docs/hair-passport-integration-contract.md`). That connection has **not** been validated against a live Hair Passport system.

> **What it is not.** It does not diagnose, establish causation from observational data, replace a cosmetic chemist, determine legal compliance, or authorize a formula for human use. Records awaiting review are labelled as such. Evidence ratings, regulatory records and graph edges seeded in Phase 1 are **drafts for qualified review**.

## Stack

- Next.js 16 (App Router, server components, server actions), React 19, TypeScript, Tailwind 4
- PostgreSQL 15+ via Prisma 6. Required extensions: `pg_trgm` and `unaccent` (both created by the first migration). `pgvector` is optional and planned for Phase 4.
- Separate research login: argon2id passwords, hashed session tokens, TOTP MFA (required for privileged roles), lockout and API keys
- Vitest for unit and integration tests; Playwright for the browser smoke test

## Setup

```bash
cd intelligence
cp .env.example .env          # then set APP_SECRET (openssl rand -base64 48) and DATABASE_URL
npm install
```

Create the databases (local example):

```bash
sudo -u postgres psql -c "CREATE ROLE sii LOGIN PASSWORD 'sii_dev' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE sii_dev OWNER sii;" -c "CREATE DATABASE sii_test OWNER sii;"
```

Apply migrations, load the seed, then run the app:

```bash
npm run db:migrate            # prisma migrate deploy
npm run db:seed               # idempotent; safe to re-run
npm run dev                   # http://localhost:3100
```

The seed prints the admin credentials. If `SEED_ADMIN_PASSWORD` is empty, it generates a random password and shows it once. With `SEED_DEMO_USERS=true`, it also creates one demo user per role (`<role>@demo.sii.local`); this is refused when `APP_ENV=production`.

### Seed contents and provenance

Everything is loaded through the same import engine that users use, so a second run reports every row as `UNCHANGED`.

| Data | Count | Source and status |
|---|---|---|
| Canonical ingredients | 289 | Curator seed (AI-assisted), all `SUBMITTED` for identity review |
| PubChem identifiers/properties | 126 compounds, 853 facts | PubChem snapshot 2026-10-29 (`seed/data/pubchem-snapshot-2026-10-29.json`). 9 recalled CIDs were wrong; they were rejected and recorded in `pubchem-rejected-candidates.json`. |
| Products | 273 (5 Supernatural, 268 from 49 textured-hair brands) | Verbatim manufacturer ingredient declarations with source URLs |
| Evidence | 79 | Real PubMed IDs, titles only. Study type and level are AI-proposed; **0 reviewed**. |
| Patents | 43 | Publication numbers linking to Espacenet. Research aid, not a legal opinion. |
| Regulatory records | 54 (48 ingredients; EU and US) | Drafts with `lastCheckedAt` empty, so all are shown as stale until verified against official text |
| Formulas / raw materials | 10 / 10 | Clearly labelled `SAMPLE` archetypes. Not Supernatural formulas; not for manufacture. |
| Hair Passport | 15 records | Mock batch exercising consent, mapping, quarantine and rejection paths |

| EU CosIng inventory | 22,176 rows → ~22,000 ingredients, ~41,700 identifiers, ~1,185 EU annex records | Open Beauty Facts snapshot of the CosIng inventory (`seed/data/cosing/cosing-ingredients.json.gz`, built with `scripts/convert-cosing-obf.py`). Identifiers are `UNVERIFIED`; CAS numbers that fail the checksum (130) are not stored. Annex records have `lastCheckedAt` empty and carry no maximum concentrations. |
| CosIng 2016 export supplement | 4,150 records (4,085 new, 65 linked) | Official Commission CSV export (last update 15/02/2016), used only for records missing from the snapshot above, such as Cocos Nucifera Oil and Hydroxyethylcellulose (`scripts/convert-cosing-export.py`). May be outdated for changes after 2016. WATER (US INCI) is merged into AQUA as a reversible curator decision. |

Not seeded: supplier documents, maximum concentrations from the Annexes, and reviewed evidence or graph edges. These depend on human review or on documents that have not been provided. The OBF snapshot omits some common INCI names (for example Coco-Glucoside and Hydroxyethylcellulose); these are filled from the 2016 export. About 94% of product label lines match an ingredient automatically; the rest (misspellings, common names, trade blends) wait in identity review.

### Research workbench (expansion)

- **Home** is research-first: search, start research by workspace mode (Founder, Chemist, Brand, Manufacturer), saved projects, monitoring of your formulas' ingredients and recent intelligence updates. Data operations moved to `/admin`.
- **Workflows** (`/workbench`): Substitutes, Formulation investigation (paste or upload CSV/TXT), Claim support, Supplier documentation, Ingredient comparison and the Founder product brief (`/founder`, 10 questions). Each project saves its runs, citations, objective, members and review status, and generates printable reports (`/reports`).
- **Every value has a status**: Verified, Source-reported, Supplier-reported, Rule-derived, Hypothesis, Missing or N/A. Technical values (HLB, pH range, solubility, …) are shown only when a source supports them; otherwise they read *Missing*. Rule-derived classes (sulfate surfactant, cationic, silicone, EU allergen, …) are screening aids that show the rule used.
- **Research assistant** (`/assistant`): answers only from retrieved records and drops any statement that does not cite one. Without `ANTHROPIC_API_KEY` it returns the retrieved records with no AI summary.
- **Organizations**: projects, reports, formulas, products, review tasks and audit history are scoped to the user's organization. Plans (`internal`, `trial`, `professional`, `team`) set monthly limits that are tracked in `UsageEvent`. There is no billing integration.
- **Self-service signup** (`/signup`) is off unless `ALLOW_SELF_SIGNUP=true`. It creates a trial organization with one Brand partner user.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Develop / production build / serve (port 3100) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Load or refresh seed data (idempotent) |
| `npm run db:reset` | **Destructive**: drop and recreate the schema, then seed (development only) |
| `npm test` | Unit and integration tests. Integration tests **truncate and reseed `TEST_DATABASE_URL`**. Writes `test-results/vitest.json`. |
| `npm run test:unit` | Unit tests only (no database) |
| `npm run test:e2e` | Browser smoke test against a running server (needs Playwright with Chromium; outside this environment run `npm i -D playwright && npx playwright install chromium`) |
| `npm run eval:search` | Search-quality evaluation (top-1, recall@5, MRR@5) |
| `npm run apikey:create -- --org <slug> --name <label> --scopes a,b [--days 90]` | Create an API key; the key is printed once |

## Environment variables

See `.env.example`. Required: `DATABASE_URL` and `APP_SECRET` (at least 32 characters). Recommended: `MFA_ENFORCEMENT=required` everywhere except local development. Optional: `CLAMD_HOST` (upload malware scanning), `STORAGE_DIR`, `MAX_UPLOAD_MB` and `SESSION_TTL_HOURS`. `ANTHROPIC_API_KEY` turns on AI summaries in the research assistant (cited answers only). `ALLOW_SELF_SIGNUP=true` turns on `/signup`. Connector keys (`NCBI_API_KEY`, `PATENTSVIEW_API_KEY`) are not used yet.

## API

Versioned REST API under `/api/v1`, with an OpenAPI document at `/api/v1/openapi.json` (also rendered at `/api-docs`). Authentication is `Authorization: Bearer sii_…` (API key) or a signed-in session; cookie-authenticated writes must be same-origin. A key's effective permissions are the intersection of its scopes and the permission matrix. For partner-organization keys, records whose source does not permit external API use are withheld, and the response reports how many were withheld.

## Documentation

- `docs/architecture.md`: assessment, architecture, data model (ERD), graph, provenance, identity resolution, search, page map, phases, cost and performance
- `docs/governance.md`: data-rights matrix, units, evidence rubric, statistics governance, exposure model, review matrix, claims workflow, professional review list
- `docs/security.md`: security controls, backup and disaster recovery, environments, retention, incident response
- `docs/hair-passport-integration-contract.md`: integration boundary, contract `hp-ii/0.1.0-draft`, shared IDs and adaptable mappings
