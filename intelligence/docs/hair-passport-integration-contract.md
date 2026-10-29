# Hair Passport ↔ Ingredient Intelligence — Integration Contract

**Contract version:** `hp-ii/0.1.0-draft`
**Status:** DRAFT — not validated, not live. No Hair Passport system has sent data to this contract. All integration data in this repository is **mock data** and is labelled as such in the database (`IntegrationBatch.isMock = true`).
**Owner:** Ingredient Intelligence (II) data governance. Changes follow the change-control process in `docs/governance.md`.

---

## 1. Principles

1. **Ingredient Intelligence runs without Hair Passport.** Every II feature (ingredients, sources, evidence, regulatory, patents, raw materials, formulas, products, graph, review, imports, search, API) works with zero Hair Passport data.
2. **Inbound, de-identified, consent-filtered.** Hair Passport (HP) pushes records to II. II never pulls from HP, never stores names, emails, phone numbers, addresses, account IDs, device IDs, raw image files or free-text that has not passed HP's de-identification step.
3. **External IDs, not copies.** II stores HP's opaque identifiers (`hp:*` refs) and never copies identifiable records. HP stays authoritative for identity, consent, assessments and images.
4. **Raw payload first, mapping second.** Every inbound record is stored verbatim (JSONB) with its contract version *before* normalization. Taxonomy and field mappings live in data tables (`TaxonomyMapping`, `FieldMapping`), so HP vocabulary changes require **new mapping rows, not database migrations**. Normalized rows keep a pointer to the raw record and to the mapping version that produced them, so they can be recomputed.
5. **Source type is never collapsed.** User-reported, clinician-observed, instrument-measured, image-derived and AI-estimated observations are separate `sourceType` values and are never merged into one "truth" value.
6. **Association ≠ causation.** Nothing received through this contract becomes a recommendation automatically. Downstream use goes through the signal-review workflow (Phase 3).
7. **HairFM boundary.** Until sufficient representative data and scientific validation exist, every model-derived output is labelled `AI_ESTIMATE`, carries a `modelVersion`, and may only feed *research hypotheses* or *evidence-ranked candidates* — never diagnoses, treatment recommendations or validated personalized predictions.

## 2. Which components operate independently

| Component | Needs HP? | Notes |
|---|---|---|
| Auth, roles, organizations, API keys | No | Separate research login. |
| Source registry & data-rights | No | |
| Canonical ingredients, identity resolution, aliases, identifiers | No | |
| Facts, units, concentrations, regulatory, safety, functions | No | |
| Evidence, patents, raw materials, suppliers, formulas, products | No | |
| Knowledge graph, search, review queues, audit, imports | No | |
| Hair/scalp ontology (II-owned) | No | HP terms map *to* it. |
| Integration staging (batches, raw records, validation) | Only to receive data | Works today with mock data. |
| Participant/exposure/outcome research tables | Only for real data | Populated today by mock data only. |
| Cohort builder, signal detection, statistical review | Phase 3 | Will read only consent-eligible, non-mock records. |

## 3. Integration boundary

```
HAIR PASSPORT (authoritative)                 │  INGREDIENT INTELLIGENCE
──────────────────────────────────────────────┼───────────────────────────────────────────
user identity, contact, auth                  │  (never received)
consent ledger                                │  consent SNAPSHOT per record (scopes + asOf)
assessments, phenotype, photos                │  de-identified observations + image-derived
routines, product use                         │  measurements (no image files)
                                              │
de-identification service  ──── HTTPS POST ──►│  /api/v1/integrations/hair-passport/batches
  • pseudonymous participantRef (HMAC)        │    1. authenticate org API key, scope
  • date shifting / coarsening per protocol   │       `integration:hair-passport:write`
  • free text removed or reviewed             │    2. store IntegrationBatch + raw records
  • rare-combination review                   │    3. validate against contract JSON schema
                                              │    4. consent gate (drop / quarantine)
                                              │    5. map taxonomy via TaxonomyMapping
                                              │    6. resolve product / formula / ingredient
                                              │    7. write normalized research rows
                                              │    8. per-record status returned to HP
◄──────── withdrawal / deletion notices ──────│  /api/v1/integrations/hair-passport/withdrawals
```

II returns a per-record result (`ACCEPTED`, `QUARANTINED`, `REJECTED`, `DUPLICATE`) so HP can reconcile.

## 4. Data Hair Passport would eventually send

Every record shares an **envelope**:

| Field | Type | Required | Notes |
|---|---|---|---|
| `contractVersion` | string | yes | e.g. `hp-ii/0.1.0-draft` |
| `recordType` | enum | yes | `PARTICIPANT`, `CONSENT`, `PHENOTYPE_OBSERVATION`, `EXPOSURE_EVENT`, `OUTCOME_OBSERVATION`, `SENSITIVITY_FACTOR` |
| `externalRecordId` | string | yes | HP's stable record ID (idempotency key with `recordType`) |
| `participantRef` | string | yes* | Pseudonymous, HP-generated; **not** the consumer account ID |
| `consent` | object | yes | `{ researchUse, healthDataUse, imageDerivedUse, modelTrainingUse, asOf, protocolVersion }` booleans + date |
| `sourceType` | enum | yes | `SELF_REPORTED`, `CLINICIAN_OBSERVED`, `PROFESSIONAL_OBSERVED` (trichologist/stylist), `INSTRUMENT_MEASURED`, `IMAGE_DERIVED`, `AI_ESTIMATE`, `SYSTEM_DERIVED` |
| `observedAt` | date / date-time | yes | After HP's date handling; `datePrecision` states `DAY`/`WEEK`/`MONTH` |
| `method` | object | yes | `{ code, version, description }` — questionnaire item, instrument, image protocol or model |
| `confidence` | number 0–1 or null | yes | null when not applicable |
| `qualityFlags` | string[] | yes | e.g. `MISSING_BASELINE`, `LOW_ADHERENCE`, `IMAGE_LIGHTING`, `RECALL_PERIOD_LONG`, `PARTIAL_ANSWER` |
| `deidentification` | object | yes | `{ protocolVersion, dateShifted, geoPrecision }` |
| `payload` | object | yes | record-type-specific, below |

### 4.1 `PHENOTYPE_OBSERVATION` payload
`{ termCode, termSystem, termSystemVersion, value, unit?, scale?, bodySite? ('scalp'|'hair_shaft'|'hairline'|...), assessmentRef? }`

### 4.2 `EXPOSURE_EVENT` payload
`{ productRef? {system: 'hp'|'gtin'|'ii', code}, productVersionRef?, formulaVersionRef?, ingredientRefs?[], exposureConfidence, startDate, endDate?, frequency? {count, per}, applicationQuantity? {value, unit}, contactDuration? {value, unit}, rinseOffOrLeaveOn?, applicationSites?[], coverage? ('full_head'|'localized'), adherence? {value, method}, layeringOrder?, washFrequency?, removalMethod?, concurrentProductRefs?[], routineRef? }`

`exposureConfidence` ∈ `EXACT_INTERNAL_FORMULA`, `MANUFACTURER_CONFIRMED_FORMULA`, `SUPPLIER_CONFIRMED_ACTIVE`, `STUDY_CONFIRMED_CONCENTRATION`, `ESTIMATED_RANGE`, `LABEL_CONFIRMED_PRESENCE`, `USER_REPORTED_PRODUCT`, `INFERRED`, `UNKNOWN`. II never invents a concentration; concentration is only computed when a formula version with confirmed percentages is linked.

### 4.3 `OUTCOME_OBSERVATION` payload
`{ termCode, termSystem, termSystemVersion, value, unit?, scale?, baselineRecordRef?, followUpDays?, exposureEventRefs?[], concurrentChanges?[], context? { hairstyle?, protectiveStyle?, heatUse?, chemicalService?, climate?, season?, waterHardness? } }`

### 4.4 `SENSITIVITY_FACTOR` payload (optional, consent-gated)
`{ category, codeSystem?, code?, present: true|false|'unknown' }` where `category` is coarse (`CONTACT_ALLERGY_REPORTED`, `FRAGRANCE_SENSITIVITY`, `NUT_ALLERGY`, `MEDICATION_CLASS_PHOTOSENSITIZING`, `HORMONAL_LIFE_STAGE`, `PREGNANCY_POSTPARTUM`, `DERMATOLOGIC_CONDITION_REPORTED`, `OTHER`). Accepted **only** when `consent.healthDataUse = true`; otherwise rejected and never stored. No free-text diagnoses or drug names in v0.1.

### 4.5 `PARTICIPANT` and `CONSENT`
`PARTICIPANT`: `{ ageBand?, regionCoarse?, cohortRefs?[] }` — no birthdates, no precise geography.
`CONSENT`: a full consent snapshot; latest snapshot wins for eligibility. A withdrawal sets all scopes false and triggers the withdrawal workflow.

## 5. IDs and taxonomies both systems must share

| Shared item | Owner | Format |
|---|---|---|
| `participantRef` | HP | opaque string, HMAC-derived, ≥ 128 bits |
| `externalRecordId` | HP | opaque string, stable per record |
| Product reference | II canonical product ID **or** GTIN/barcode | `ii:product:<uuid>` / `gtin:<digits>` |
| Product version | II | `ii:product-version:<uuid>` (ingredient list valid for a date range) |
| Formula version | II | `ii:formula-version:<uuid>` (only for Supernatural/partner formulas) |
| Ingredient | II | `ii:ingredient:<uuid>` (+ INCI name for display) |
| Hair/scalp ontology | II owns `ii-hair-scalp` codes; HP may keep its own codes and map them | `termSystem` + `termCode` + `termSystemVersion` |
| Source-type enum | Contract | section 4 |
| Exposure-confidence enum | Contract | section 4.2 |
| Quality-flag vocabulary | Contract (extensible) | unknown flags are stored and surfaced, not rejected |
| Consent scopes | HP defines, contract lists | `researchUse`, `healthDataUse`, `imageDerivedUse`, `modelTrainingUse` |
| Units | UCUM-style codes | `mm`, `um`, `mL`, `g`, `d`, `%`, `{score}` |

## 6. Fields that stay adaptable until HP's schema is finalized

- **Phenotype and outcome term codes** — mapped through `TaxonomyMapping` (`externalSystem`, `externalCode`, `externalVersion` → II ontology term). Unmapped codes are quarantined (`UNMAPPED_TERM`), not dropped.
- **Value shapes** — `value` is stored as JSON with optional `unit`/`scale`; new scales need a mapping row, not a migration.
- **Quality-flag vocabulary** — free-form string array.
- **Context fields** in outcomes (hairstyle, heat, climate…) — JSON, mapped later.
- **Method codes** (questionnaire item IDs, image protocols, model names).
- **Sensitivity-factor categories** — extensible enum held in a mapping table.
- **Field paths** — `FieldMapping` lets a contract minor version rename/move payload fields without migrations.
- **Date precision** and de-identification protocol versions.

Fixed now (breaking changes require a major contract version): the envelope, `recordType`, `sourceType`, `exposureConfidence`, consent scopes, and the rule that no direct identifiers are accepted.

## 7. Consent, withdrawal, deletion and corrections

- Records without `consent.researchUse = true` are rejected and not stored beyond a minimal rejection log entry (no payload).
- `healthDataUse = false` ⇒ `SENSITIVITY_FACTOR` records rejected; health-related context keys stripped.
- `modelTrainingUse = false` ⇒ `modelTrainingEligible = false` on every row for that participant.
- **Withdrawal:** HP posts `{participantRef, effectiveAt, scope}`. II marks the participant withdrawn, excludes them from all future cohorts and exports, schedules deletion of raw and normalized rows (unless a recorded legal-hold or research-retention exception applies), and lists completed analyses that included the participant. Completed analyses and previously trained models are **not** silently altered; the withdrawal is recorded against them. Removing data from an already trained model is not technically possible for the current architecture; withdrawal applies to unused data and future training.
- **Corrections:** HP re-sends the record with the same `externalRecordId` and a higher `revision`. II keeps the prior revision, re-normalizes, and flags affected analyses for re-review.
- **Product-version changes:** exposure dates select the product version whose validity range contains them; historical exposure is never rewritten.

## 8. What is implemented now (Phase 1)

- Contract JSON-schema validation (zod) for v0.1.0-draft.
- `POST /api/v1/integrations/hair-passport/batches` and `POST /api/v1/integrations/hair-passport/withdrawals` (API-key + scope protected).
- Staging tables (`IntegrationBatch`, `IntegrationRecord`), mapping tables (`TaxonomyMapping`, `FieldMapping`), and research tables (`ResearchParticipant`, `ConsentSnapshot`, `PhenotypeObservation`, `ExposureEvent`, `OutcomeObservation`, `SensitivityFactor`).
- A **mock** batch (`seed/data/mock-hair-passport-batch.json`) clearly flagged `isMock`.
- Tests for consent gating, health-data gating, unmapped-term quarantine, idempotent re-submission and withdrawal.

Not implemented: HP-side de-identification, live connection, cohort builder, signal detection (Phase 3).
