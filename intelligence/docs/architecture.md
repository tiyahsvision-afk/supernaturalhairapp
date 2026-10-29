# Architecture — Supernatural Ingredient Intelligence (Phase 1)

## 1. Assessment of the existing system

The existing Supernatural app (`claude/supernatural-journey-app-wxdict` branch) is a consumer-facing journey and Hair Passport experience. Hair Passport currently keeps product use **in each customer's browser**: there is no server-side store of product logs, observations or outcomes to integrate with.

Ingredient Intelligence is therefore built as a separate application in `/intelligence`, with its own database, login and permissions. It does not modify or rebuild Hair Passport. The two systems meet only at the versioned contract described in `hair-passport-integration-contract.md`.

## 2. System architecture

```mermaid
flowchart LR
  subgraph Clients
    UI[Research web app<br/>Next.js server components]
    API[Partner / system clients<br/>Bearer API keys]
    HP[Hair Passport<br/>future, via contract]
  end
  subgraph App[Next.js application]
    RSC[Pages + server actions]
    V1["/api/v1 route handlers<br/>route(): auth · scope · rate limit · CSRF · errors"]
    SVC[Domain services<br/>ingredients · facts · identity · products · formulas · review · graph · search · imports · integration]
    LIB[Pure libraries<br/>units · INCI parser · formula math · claims guard · completeness · rubric]
  end
  DB[(PostgreSQL<br/>pg_trgm · unaccent<br/>append-only audit trigger · CHECK constraints)]
  FS[(Object storage<br/>local adapter → S3/Supabase)]
  AV[ClamAV optional]
  UI --> RSC --> SVC
  API --> V1 --> SVC
  HP -. hp-ii/0.1.0-draft .-> V1
  SVC --> LIB
  SVC --> DB
  SVC --> FS
  SVC --> AV
```

- **Single deployable.** Pages call services directly; external clients use `/api/v1`. Both share the same services, so permission and provenance rules are enforced in one place.
- **Services own the invariants.** For example, facts are never overwritten, product lists are versioned, formula versions lock, and reviews cannot be self-approved. UI and API layers only validate input shape.
- **Pure libraries are unit-tested without a database.** These cover unit conversion, INCI parsing, formula arithmetic (integer math at 1e-5 % precision), the claims guard, completeness and the review state machine.
- **Background work.** Imports run in-process with a resumable cursor (25-row chunks). This is adequate for Phase 1 volumes. A queue worker is planned for Phase 2.

## 3. Data model (core ERD)

68 Prisma models. This diagram shows the spine; the full schema is in `prisma/schema.prisma`.

```mermaid
erDiagram
  Organization ||--o{ User : has
  Organization ||--o{ Formula : owns
  Organization ||--o{ RawMaterial : owns
  Organization ||--o{ ResearchCandidate : owns
  Source ||--o{ IngredientFact : "provenance"
  Source ||--o{ RegulatoryRecord : "provenance"
  Source ||--o{ Evidence : "provenance"
  Ingredient ||--o{ IngredientName : names
  Ingredient ||--o{ IngredientAlias : aliases
  Ingredient ||--o{ IngredientIdentifier : "CAS/EC/CID/InChIKey"
  Ingredient ||--o| ComplexMaterialProfile : "botanical/UVCB"
  Ingredient ||--o{ IngredientFact : "sourced facts"
  Ingredient ||--o{ ConcentrationRecord : "5 distinct types"
  Ingredient ||--o{ RegulatoryRecord : "jurisdiction × time"
  Ingredient ||--o{ EvidenceLink : ""
  Evidence ||--o{ EvidenceLink : ""
  Ingredient ||--o{ PatentLink : ""
  Patent ||--o{ PatentLink : ""
  Supplier ||--o{ RawMaterial : supplies
  RawMaterial ||--o{ RawMaterialComponent : "declared composition"
  Ingredient ||--o{ RawMaterialComponent : ""
  Formula ||--o{ FormulaVersion : "locked history"
  FormulaVersion ||--o{ FormulaIngredient : lines
  Product ||--o{ ProductVersion : "validFrom/validTo"
  ProductVersion ||--o{ ProductIngredient : "label order"
  ProductIngredient }o--o| Ingredient : "matched (confidence)"
  ResearchParticipant ||--o{ ConsentSnapshot : ""
  ResearchParticipant ||--o{ PhenotypeObservation : ""
  ResearchParticipant ||--o{ ExposureEvent : ""
  ResearchParticipant ||--o{ OutcomeObservation : ""
  ExposureEvent }o--o| ProductVersion : "version valid at start date"
  OntologyTerm ||--o{ TaxonomyMapping : "external → internal"
  ReviewTask ||--o{ ReviewDecision : ""
  ImportJob ||--o{ ImportRecord : "per row"
```

Design rules encoded in the schema:

- **Provenance on every fact.** Each fact records `sourceId`, `sourceLocation`, `entryMode` (IMPORTED / AI_EXTRACTED / MANUAL), `confidence`, `reviewStatus` and `reviewedBy/At`. Measurements also keep the original value, unit and conditions alongside the normalized form.
- **Conflicts are preserved.** A new value never overwrites an old one. Supersession sets `supersededAt` and `supersededById`, and disagreeing current values are shown side by side.
- **Time.** Regulatory records carry `effectiveDate`, `lastCheckedAt` and `staleAfterDays`. Product lists carry `validFrom`/`validTo`; exposure resolves the version that applied on the exposure date.
- **Ownership.** Formulas, raw materials, documents and research candidates carry `ownerOrgId` and a `visibility` of SHARED, ORGANIZATION, RESTRICTED or CONFIDENTIAL_IP. There is no cross-organization bypass, not even for super admin.
- **Database guards.** The AuditLog has an append-only trigger. CHECK constraints cover evidence level 1–7, percentages 0–100, formula lines referencing a material, active % in (0, 100], concentration min ≤ max, edge confidence 0–1 and label position ≥ 1.

## 4. Knowledge graph

Edges live in `GraphEdge` (unique on from, to and type) with typed endpoints (`NodeType`) and 24 edge types, including CONTAINS, USED_IN, SUPPLIED_BY, HAS_FUNCTION, STUDIED_IN, ASSOCIATED_WITH, RESTRICTED_BY, PROHIBITED_BY, CLAIMED_IN_PATENT, SUPPORTS, CONTRADICTS and GENERATED_HYPOTHESIS. Each edge carries:

- source, confidence and evidence type
- status: PROPOSED, ACTIVE or DEPRECATED
- review status, and whether the edge is derived

Edges are created as side effects of domain operations (label parsing, formula creation, regulatory import, evidence linking). They start unreviewed and are drawn dashed in the explorer.

Access goes through a `GraphStore` interface. Phase 1 implements it in Postgres (`postgresGraphStore.neighborhood`, which applies the caller's visibility to endpoint records). The interface allows a dedicated graph database later without touching callers. With 1,421 edges, Postgres is appropriate; reconsider beyond about 10⁶ edges or for multi-hop path queries.

## 5. Identity resolution

- **Canonical record.** Each ingredient has a canonical record, plus names (INCI, common, chemical, trade) and aliases (synonym, misspelling, label display).
- **Identifiers are checksum-validated.** CAS and EC are verified by check digit. An identifier already attached to a different ingredient is stored as a CONFLICT and quarantined, never silently reassigned.
- **Complex materials** (botanicals, polymers, UVCB, ferments) are not forced into single-substance identifiers. A `ComplexMaterialProfile` holds the botanical source, plant part, extraction method and solvent, and completeness treats chemical identifiers as not applicable.
- **Matching never merges automatically.** Label matching (`services/matching.ts`) assigns a confidence by method:
  - exact: 1.0
  - synonym: 0.95
  - misspelling or parenthetical-stripped: 0.85
  - label display: 0.7

  Ambiguous or unmatched lines go to a quarantine queue. Near-duplicate canonical records become `IdentityResolutionCandidate`s.
- **Merges are reversible.** A merge snapshots the moved child rows so `unmerge` can restore them.

## 6. Search

Every searchable entity is written into `SearchEntry` (normalized term, kind, owner org and visibility), with GIN trigram indexes. A query is normalized (case, accents, whitespace, punctuation), then ranked in tiers:

1. exact canonical / INCI
2. identifier (CAS, EC, CID, InChIKey)
3. alias / synonym
4. prefix
5. trigram similarity
6. substring

Each hit returns a human-readable explanation (`why`), and results are filtered by permission and record visibility before ranking. `scripts/search-eval.ts` measures top-1 accuracy, recall@5 and MRR@5 on a labelled set; the current result is 45/45 top-1 at p95 10 ms. That set was written by the developer and is a regression baseline, not a real-user benchmark; it should be extended with logged queries (`SearchLog`).

## 7. AI architecture (planned for Phase 4; not built)

Phase 1 contains **no generative AI at runtime**. AI was used only offline, to propose seed classifications. Those carry `entryMode = AI_EXTRACTED` and remain `SUBMITTED` until reviewed.

The Phase 4 design:
- **Retrieval only over permitted sources.** Licensing fields such as `allowModelTraining` and `fullTextStoragePermission` gate what may be embedded (pgvector).
- **Answers cite records.** An answer without citations is not shown.
- **Answers are labelled.** They are "Evidence-supported candidate" or "Candidate for cosmetic-chemist review", never as conclusions.
- **Answers are reviewable.** Each is stored as an `AIAnswer` review record (a review requirement already exists).
- **HairFM outputs are hypotheses.** Outputs received via Hair Passport are stored as `AI_ESTIMATE` observations with a mandatory model version, and treated as research hypotheses.

## 8. Page map

| Area | Pages |
|---|---|
| Research | Dashboard `/`, Ingredients (list with 13 filters, detail with 17 tabs, new), Search, Knowledge graph, Formulas (list, detail with versions/validation/compare/status, new), Products (list, detail with versions and line identity, new), Raw materials and Suppliers, Evidence (list, detail with rubric grading, new), Patents, Research candidates |
| Data | Hair Passport (mock) integration (batches, records, mappings), Imports (upload, jobs, ingestion queue, templates), Review queue (tasks, quarantine, identity, licensing, stale), Sources & rights, Phase 1 completion |
| Admin | Audit history, Organizations, Settings (account, MFA, users and roles, API keys, permission matrix, review requirements), API docs |

Every navigation entry leads to a working page; there are no placeholder pages.

## 9. Phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Assessment, architecture, data-rights review, contract design | Done (this document; integration contract) |
| 1 | Canonical ingredient database, provenance, identity, search, products, formulas, evidence, patents, regulatory drafts, review workflows, imports, graph, API, Hair Passport mock contract | Built. Review-dependent targets are open; see `/completion`. |
| 2 | Connectors: CosIng (INCI/CAS/EC/functions), PubChem/CompTox live refresh, PubMed E-utilities, PatentsView/EPO OPS, Health Canada and UK lists; supplier-document OCR and extraction; queue worker; S3 storage; reviewer onboarding to work down the review backlog | Planned |
| 3 | Hair Passport live integration (after contract validation with that team), cohort builder, observational signal detection with pre-registered analysis plans and statistics governance | Planned |
| 4 | Retrieval-augmented assistant with citations, embeddings (pgvector), HairFM hypothesis intake | Planned |

## 10. Cost (indicative monthly, small team)

| Item | Phase 1 | Notes |
|---|---|---|
| Managed Postgres (2 vCPU, 4–8 GB) | US$25–100 | e.g. Supabase Pro / Neon / RDS small |
| App hosting (Node server) | US$0–50 | Vercel Pro or a small container |
| Object storage + backups | under US$10 | Supplier documents are small |
| ClamAV | US$0–20 | Sidecar container |
| Data sources | US$0 | All Phase 1 sources are free; CAS Registry and commercial databases would be licence decisions |
| AI (Phase 4) | Usage-based | Not incurred in Phase 1 |

The main cost is **qualified reviewer time**: cosmetic chemist, regulatory, dermatology/trichology and patent professionals (see `governance.md`).

## 11. Performance

Measured locally with 289 ingredients and 2,354 search entries:
- search p95 is 10 ms
- the ingredient detail page with 17 tabs is server-rendered with one primary query
- imports process about 25 rows per transaction chunk

Indexes: trigram GIN on search, alias and name terms; foreign-key indexes; unique constraints for idempotency (ExternalRef, IntegrationRecord revision, GraphEdge triple). Expected Phase 2 volume (around 30k CosIng ingredients and 10⁵ facts) fits comfortably in a single Postgres instance. Revisit at 10⁷ facts or for heavy graph traversal.
