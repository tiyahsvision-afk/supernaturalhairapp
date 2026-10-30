# Governance — data rights, units, evidence, statistics, review and claims

All seeded classifications are drafts for qualified review. This document defines the rules the software enforces, and the human decisions it cannot make on its own.

## 1. Data-rights matrix

Generated from `seed/data/sources.json` (the live registry is at `/sources`). "External API" means records from the source may be returned to **partner-organization** API keys. Internal callers receive any source whose status is not PROHIBITED or UNKNOWN. Every source starts with a `termsReviewStatus` review task. The statuses below are the curator's preliminary reading of published terms, **not legal advice**, and each requires review by someone qualified to interpret licences.

| Source | Type | Rights status | Store | Full text | External API | Model training | Use in Phase 1 |
|---|---|---|---|---|---|---|---|
| PubChem PUG REST | CHEMICAL_DATABASE | APPROVED_WITH_ATTRIBUTION | yes | yes | no | no | identifier verification; computed property facts |
| PubMed bibliographic metadata | LITERATURE | METADATA_ONLY | yes | no | no | no | citation metadata; links |
| Patent search (discovery via Google Patents pages) | PATENT | LINK_ONLY | yes | no | no | no | discovery of publication numbers and titles |
| Espacenet (European Patent Office) | PATENT | MANUAL_REVIEW_REQUIRED | yes | no | no | no | official record links |
| Manufacturer product pages (ingredient declarations) | MANUFACTURER_LABEL | MANUAL_REVIEW_REQUIRED | yes | no | no | no | internal research on declared ingredients |
| Supernatural Hair Care (shcbeauty.com) product data | INTERNAL | APPROVED_INTERNAL | yes | yes | no | no | internal research; product records |
| Curator seed (AI-assisted curation, pending review) | CURATOR | APPROVED_INTERNAL | yes | yes | no | no | proposals for human review |
| Regulation (EC) No 1223/2009 (EU Cosmetics Regulation) and Annexes | REGULATORY | APPROVED_WITH_ATTRIBUTION | yes | yes | no | no | regulatory records |
| REACH Regulation (EC) No 1907/2006 Annex XVII restrictions | REGULATORY | APPROVED_WITH_ATTRIBUTION | yes | no | no | no | regulatory records |
| U.S. Code of Federal Regulations, Title 21 (eCFR) | REGULATORY | APPROVED_COMMERCIAL | yes | yes | no | no | regulatory records |
| FDA cosmetics guidance and resources | REGULATORY | APPROVED_COMMERCIAL | yes | yes | no | no | regulatory records |
| Health Canada Cosmetic Ingredient Hotlist | REGULATORY | MANUAL_REVIEW_REQUIRED | yes | no | no | no | — |
| UK Cosmetics Regulation (retained Regulation 1223/2009, as amended) | REGULATORY | MANUAL_REVIEW_REQUIRED | yes | no | no | no | — |
| European Commission CosIng database | COSMETIC_INVENTORY | MANUAL_REVIEW_REQUIRED | yes | no | no | no | — |
| EU CosIng inventory via Open Beauty Facts taxonomy | COSMETIC_INVENTORY | APPROVED_WITH_ATTRIBUTION (preliminary) | yes | no | no | no | INCI names, CosIng reference, CAS/EC (unverified), official functions, annex references |
| Cosmetic Ingredient Review (CIR) reports | SAFETY_REVIEW | LINK_ONLY | yes | no | no | no | links; conclusion summaries after review |
| Scientific Committee on Consumer Safety (SCCS) opinions | SAFETY_REVIEW | APPROVED_WITH_ATTRIBUTION | yes | no | no | no | safety review records |
| EPA CompTox Chemicals Dashboard / CTX APIs | CHEMICAL_DATABASE | MANUAL_REVIEW_REQUIRED | yes | no | no | no | — |
| USPTO PatentsView / Open Data | PATENT | MANUAL_REVIEW_REQUIRED | yes | no | no | no | — |
| Values stated in literature titles/index snippets | LITERATURE | METADATA_ONLY | yes | no | no | no | concentration tested in a cited study |
| Internal sample formulas and raw materials (illustrative) | INTERNAL | APPROVED_INTERNAL | yes | yes | no | no | testing and demonstration |
| Hair Passport integration (contract hp-ii/0.1.0-draft) | HAIR_PASSPORT | RESTRICTED | yes | no | no | no | consent-eligible de-identified research |

Enforcement points:
- **Imports** are refused (in the import engine, so for UI, API and seed alike) for sources with PROHIBITED or UNKNOWN rights, no storage permission, or RESTRICTED status (except internal and consent-governed Hair Passport sources).
- **The API** withholds records whose source is not cleared for the caller (`withhold()` in `src/lib/api/http.ts`) and reports the withheld count.
- **Metadata-only and link-only sources** store identifiers, titles and links, never abstracts, claims or full text.
- **Scraping.** No source is scraped merely because it is publicly viewable. Phase 1 used a web-fetch relay only for PubChem (public-domain data) and PubMed and patent *metadata*. That is recorded in each source's review notes.

## 2. Units ontology

`src/lib/units.ts` is a controlled unit table with mathjs conversions. Each unit has a category, a canonical unit and a factor.

| Rule | Behaviour |
|---|---|
| Original value and unit are always kept | `originalValue`, `originalUnit` stored next to `normalizedValue`/`normalizedUnit`, plus `conversionMethod` and `conversionVersion` |
| No conversion across concentration bases | % w/w, % v/v and % w/v are different quantities; converting needs density, so it is refused and flagged |
| Bare "%", "ppm", "ppb" | Ambiguous basis, so not converted and flagged `AMBIGUOUS_PERCENTAGE` / `UNKNOWN_BASIS` (ppm w/w → % w/w is converted) |
| Impossible values | Checked after conversion (e.g. > 100 % w/w), flagged `IMPOSSIBLE_VALUE` and the fact is quarantined; also `UNPARSEABLE_VALUE`, `MISSING_UNIT`, `INCOMPATIBLE_UNIT`, `RANGE_INVERTED`, `UNSUPPORTED_CONVERSION` |
| Ranges and detection limits | Stored as min/max (`isRange`) or `detectionLimit`; significant figures and uncertainty retained |
| Dimensionless / special | log P (dimensionless), charge (e), TPSA (Å²), counts |

Concentration records are split into five types that must never be compared as if they were one: **SUPPLIER_RECOMMENDATION, LITERATURE_TESTED, REGULATORY_MAXIMUM, INTERNAL_RANGE, OBSERVED_COMMERCIAL_USE**.

## 3. Evidence ladder and quality rubric (kept separate)

**Evidence level** (1–7) describes *what kind* of evidence it is:

| Level | Meaning |
|---|---|
| 1 | Consumer self-report |
| 2 | Longitudinal observational association |
| 3 | Standardized image or measurement signal |
| 4 | Professional observation |
| 5 | Controlled laboratory evidence |
| 6 | Controlled human study |
| 7 | Independent replication / strong supporting evidence |

**Quality** describes *how good* that piece of evidence is. The rubric (`src/lib/evidence-rubric.ts`, version recorded on each grading) has 24 criteria scored 0–2:

- **Design:** design, sample size, control, randomization, blinding
- **Measurement and analysis:** outcome validity, statistics
- **Conflicts:** conflict of interest
- **Relevance:** relevance to textured hair, population, concentration, formulation context, duration, effect size
- **Robustness:** replication, missing data, and others

At least 8 criteria must be scored before a category is proposed. The preliminary category comes from the mean score: HIGH ≥ 0.75, MODERATE ≥ 0.5, LOW ≥ 0.3, otherwise VERY_LOW. A reviewer records their own category; if it differs, an adjustment reason is required. A high level never implies high quality, or the reverse.

Seeded study types and levels for the 79 PubMed records were proposed from titles only (`AI_EXTRACTED`). None is reviewed.

## 4. Statistics governance (applies from Phase 3)

- **Association is not causation.** Every observational output is labelled *"Observational signal — does not establish causation."* (the API outcomes notice and the UI).
- **Pre-registration.** Before a cohort analysis is run, record the hypothesis, outcome, exposure definition, covariates, minimum cell size and analysis plan (as a review record).
- **Multiple comparisons** are controlled (false-discovery rate) and reported. Exploratory findings are labelled exploratory.
- **Confounders recorded with each observation** include protective styling, chemical services, heat, season, concurrent product changes and, with consent only, health context.
- **Data sources are not pooled.** User-reported, clinician, instrument, image-derived and AI-estimated observations are not pooled without an explicit, reviewed harmonization.
- **Small-cell suppression.** No output reports cohorts below the minimum cell size (default 10). Mock data is excluded unless explicitly requested and is always flagged.
- **Withdrawal.** Withdrawn participants are excluded from all future analyses. Completed analyses are not silently altered; they are annotated.

## 5. Exposure model

An exposure event links a participant to a product **and to the product ingredient-list version valid on the exposure start date** (`versionAt`). It carries a confidence level, from strongest to weakest:

`EXACT_INTERNAL_FORMULA` > `MANUFACTURER_CONFIRMED_FORMULA` > `SUPPLIER_CONFIRMED_ACTIVE` > `STUDY_CONFIRMED_CONCENTRATION` > `ESTIMATED_RANGE` > `LABEL_CONFIRMED_PRESENCE` > `USER_REPORTED_PRODUCT` > `INFERRED` > `UNKNOWN`.

Ingredient *concentration* is computed only from an exact formula version with confirmed raw-material active levels. A label position is never treated as a concentration. Frequency, quantity, contact duration, rinse-off or leave-on, sites, coverage and adherence are optional fields; missing values stay missing.

## 6. Review matrix

| Record type | Eligible reviewer roles | Approvals | Second reviewer |
|---|---|---|---|
| Ingredient (identity) | Data admin, cosmetic chemist, research scientist | 1 | — |
| Ingredient fact | Cosmetic chemist, research scientist | 1 | — |
| Ingredient function | Cosmetic chemist | 1 | — |
| Evidence | Research scientist, dermatologist, trichologist | 1 | — |
| Regulatory record | Regulatory reviewer | 1 | — |
| Safety review | Dermatologist, regulatory reviewer, cosmetic chemist | 1 | **yes** |
| Patent | Patent reviewer | 1 | — |
| Formula version | Cosmetic chemist | 1 | — |
| Research signal / candidate | Research scientist (+ patent reviewer for candidates) | 1 | **yes** |
| AI answer (Phase 4) | Research scientist | 1 | — |
| Source rights | Regulatory reviewer, data admin | 1 | — |
| Product version change | Data admin, cosmetic chemist, data annotator | 1 | — |
| Graph edge | Research scientist, cosmetic chemist | 1 | — |

Rules enforced in `services/review.ts`:
- nobody approves their own submission
- each reviewer decides once
- a rejection or change request needs a reason
- disagreement escalates to an adjudicating reviewer
- blind tasks hide other reviewers' decisions

Requirements are rows in `ReviewRequirement`, shown at Settings → Review requirements. They change by data update, with no code or migration. An in-app editor is a Phase 2 item.

## 7. Claims workflow

1. **Screening.** The claims guard (`src/lib/claims-guard.ts`) screens marketing excerpts, AI text and user-entered claims for:
   - drug or medical language (treats, cures, regrowth, hair growth, hormonal)
   - proof language (clinically proven, proven to work)
   - regulatory-status language (FDA approved, globally approved)
   - systemic-effect language (body chemistry, absorbed into the bloodstream)
   - absolute safety
2. **Flags.** Flagged text is stored as `claimFlags` on the product version and shown with a warning. It is a screening aid, not a legal classification.
3. **Vocabulary.** The software only ever produces:
   - *"Evidence-supported candidate"*
   - *"Candidate for cosmetic-chemist review"*
   - *"Research aid — not a legal opinion"* (patents)
   - *"Observational signal — does not establish causation"*
   - *"Draft for qualified review"* (SOPs and formulas)

   It never produces "Proven to work", "Safe to manufacture" or "globally approved".
4. **Finding on current copy.** The current Supernatural REST and DETOX marketing copy is flagged (systemic-effect, body-chemistry and hair-growth language). This needs regulatory review before reuse in any claim.

## 8. Professional review required

| Professional | Needed for |
|---|---|
| Cosmetic chemist | Formula versions, ingredient functions, compatibility, raw-material active levels, product-line identity corrections |
| Regulatory specialist (EU/UK/US/CA) | All 54 regulatory drafts, claim copy, source rights interpretation |
| Dermatologist / trichologist | Evidence grading, safety reviews, phenotype ontology definitions (`ii-hair-scalp/0.1.0-draft`) |
| Toxicologist / safety assessor | Safety reviews, margin-of-safety calculations before any human use |
| Patent attorney / agent | Patent relevance, freedom to operate, research-candidate ownership |
| Biostatistician | Phase 3 analysis plans, cohort definitions, multiplicity control |
| Privacy / data-protection counsel | Hair Passport consent text, de-identification protocol, retention schedule |
| Licensing counsel | Source terms (especially manufacturer pages, Google Patents, CosIng, CIR) |

## 9. Data status labels (research workbench)

Every value in comparisons, profiles and reports carries one status. Unverified data is never converted to verified silently; verification needs a named reviewer (and, for supplier specifications, a second person and a source document).

| Status | Meaning |
|---|---|
| Verified | Checked by a qualified reviewer against the cited source |
| Source-reported | Stated by a cited source; not yet reviewed |
| Supplier-reported | From a supplier document (TDS, SDS, COA, specification) |
| Rule-derived | Computed by a published rule from INCI naming or official functions; a screening aid |
| Hypothesis | A proposal that needs testing |
| Missing | No source on file. Shown instead of an estimate. |
| N/A | Does not apply to this material |

Certainty levels for findings: Established, Supported, Uncertain, Unsupported, Needs testing, Review required, Information. A substitution, formulation or claim finding is never more than "Supported" without reviewed human studies, and medical-context studies never support a cosmetic claim.
