-- Required extensions (pg_trgm for fuzzy search, unaccent for normalization).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'DATA_ADMIN', 'COSMETIC_CHEMIST', 'RESEARCH_SCIENTIST', 'DERMATOLOGIST_REVIEWER', 'TRICHOLOGIST_REVIEWER', 'REGULATORY_REVIEWER', 'PATENT_REVIEWER', 'DATA_ANNOTATOR', 'SUPPLIER_PARTNER', 'BRAND_PARTNER', 'READ_ONLY_RESEARCHER');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('INTERNAL', 'BRAND', 'SUPPLIER', 'RESEARCH', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'LOCKED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('SHARED', 'ORGANIZATION', 'RESTRICTED', 'CONFIDENTIAL_IP');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'SECOND_REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'EXPIRED', 'RE_REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "EntryMode" AS ENUM ('IMPORTED', 'AI_EXTRACTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('CHEMICAL_DATABASE', 'COSMETIC_INVENTORY', 'REGULATORY', 'SAFETY_REVIEW', 'LITERATURE', 'PATENT', 'SUPPLIER', 'MANUFACTURER_LABEL', 'INTERNAL', 'CURATOR', 'AI_EXTRACTION', 'HAIR_PASSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "RightsStatus" AS ENUM ('APPROVED_INTERNAL', 'APPROVED_COMMERCIAL', 'APPROVED_WITH_ATTRIBUTION', 'METADATA_ONLY', 'LINK_ONLY', 'MANUAL_REVIEW_REQUIRED', 'LICENSE_REQUIRED', 'RESTRICTED', 'PROHIBITED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IdentityType" AS ENUM ('DEFINED_SUBSTANCE', 'SALT', 'ESTER', 'DERIVATIVE', 'ISOMER', 'POLYMER', 'COPOLYMER', 'PEPTIDE', 'PROTEIN', 'HYDROLYSATE', 'BOTANICAL_EXTRACT', 'BOTANICAL_FRACTION', 'ESSENTIAL_OIL', 'FIXED_OIL', 'WAX', 'FERMENT', 'LYSATE', 'FILTRATE', 'MINERAL', 'PROPRIETARY_BLEND', 'FRAGRANCE_MIXTURE', 'DELIVERY_SYSTEM', 'RAW_MATERIAL_BLEND', 'UVCB', 'UNKNOWN_COMPOSITION', 'OTHER_COMPLEX');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('SMALL_MOLECULE', 'BOTANICAL_EXTRACT', 'BOTANICAL_FRACTION', 'PEPTIDE', 'PROTEIN', 'AMINO_ACID', 'LIPID', 'OIL', 'WAX', 'SURFACTANT', 'POLYMER', 'SILICONE', 'MINERAL', 'FERMENTATION_DERIVED', 'MICROBIOME_RELATED', 'PRESERVATIVE', 'FRAGRANCE_MATERIAL', 'COLORANT', 'UV_FILTER', 'DELIVERY_TECHNOLOGY', 'COMPLEX_MIXTURE', 'OTHER');

-- CreateEnum
CREATE TYPE "OriginType" AS ENUM ('NATURAL', 'NATURALLY_DERIVED', 'SYNTHETIC', 'BIOTECH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IngredientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MERGED');

-- CreateEnum
CREATE TYPE "NameType" AS ENUM ('INCI', 'CHEMICAL', 'IUPAC', 'COMMON', 'TRADE', 'BOTANICAL', 'DISPLAY');

-- CreateEnum
CREATE TYPE "AliasType" AS ENUM ('SYNONYM', 'ABBREVIATION', 'MISSPELLING', 'LEGACY_NAME', 'LABEL_DISPLAY_NAME', 'TRADE_NAME');

-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('CAS', 'EC', 'PUBCHEM_CID', 'DTXSID', 'INCHI', 'INCHIKEY', 'SMILES', 'MOLECULAR_FORMULA', 'COSING_REF', 'UNII');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW', 'CONFLICT', 'REJECTED');

-- CreateEnum
CREATE TYPE "IngredientRelationType" AS ENUM ('PARENT_OF', 'DERIVATIVE_OF', 'SALT_OF', 'ESTER_OF', 'ISOMER_OF', 'GRADE_OF', 'BLEND_COMPONENT_OF', 'CARRIER_OF', 'PRESERVATIVE_OF', 'BOTANICAL_SOURCE_OF', 'PROCESSING_VARIANT_OF', 'SUPPLIER_VERSION_OF', 'RELATED_TO', 'POSSIBLY_SAME_AS');

-- CreateEnum
CREATE TYPE "IdentityDecision" AS ENUM ('SAME_INGREDIENT', 'RELATED_INGREDIENT', 'SALT_OR_DERIVATIVE', 'MIXTURE_CONTAINING', 'DIFFERENT_INGREDIENT', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "IdentityEventType" AS ENUM ('MERGE', 'UNMERGE', 'RELATE', 'DECIDE_DIFFERENT', 'ALIAS_ADDED', 'IDENTIFIER_CORRECTED', 'IDENTIFIER_REJECTED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('MOLECULAR_WEIGHT', 'MOLECULAR_FORMULA', 'EXACT_MASS', 'SOLUBILITY', 'DISPERSIBILITY', 'PARTITION_COEFFICIENT', 'MELTING_POINT', 'BOILING_POINT', 'DENSITY', 'VISCOSITY', 'CHARGE', 'PKA', 'REFRACTIVE_INDEX', 'HLB', 'SURFACE_ACTIVITY', 'CRITICAL_MICELLE_CONCENTRATION', 'TOPOLOGICAL_POLAR_SURFACE_AREA', 'H_BOND_DONOR_COUNT', 'H_BOND_ACCEPTOR_COUNT', 'PH_RANGE', 'PROCESSING_TEMPERATURE', 'STABILITY_RANGE', 'LIGHT_SENSITIVITY', 'OXIDATION_SENSITIVITY', 'HYDROLYSIS_SENSITIVITY', 'STORAGE_REQUIREMENTS', 'INCOMPATIBILITIES', 'DEGRADATION_PATHWAYS', 'HUMECTANT_BEHAVIOR', 'OCCLUSIVE_BEHAVIOR', 'EMOLLIENT_BEHAVIOR', 'SURFACTANT_BEHAVIOR', 'CONDITIONING_BEHAVIOR', 'FILM_FORMING_BEHAVIOR', 'CHELATING_BEHAVIOR', 'PRESERVATION_FUNCTION', 'PROTEIN_INTERACTION', 'KERATIN_INTERACTION', 'SCALP_INTERACTION', 'ALLERGEN_INFORMATION', 'SENSITIZATION_INFORMATION', 'IRRITATION_INFORMATION', 'CONCENTRATION_RANGE', 'RINSE_OFF_USE', 'LEAVE_ON_USE', 'SUPPLIER_RECOMMENDATION', 'REGULATORY_RESTRICTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ConcentrationType" AS ENUM ('SUPPLIER_RECOMMENDATION', 'LITERATURE_TESTED', 'REGULATORY_MAXIMUM', 'INTERNAL_RANGE', 'OBSERVED_COMMERCIAL_USE');

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('RINSE_OFF', 'LEAVE_ON', 'BOTH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ApplicationSite" AS ENUM ('SCALP', 'HAIR_SHAFT', 'GENERAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RegulatoryStatus" AS ENUM ('ALLOWED', 'RESTRICTED', 'PROHIBITED', 'CONDITIONALLY_PERMITTED', 'NOT_LISTED', 'NOT_A_COSMETIC_INGREDIENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SafetyEndpoint" AS ENUM ('OVERALL_CONCLUSION', 'SENSITIZATION', 'IRRITATION', 'PHOTOALLERGY', 'REPRODUCTIVE_TOXICITY', 'GENOTOXICITY', 'CARCINOGENICITY', 'INHALATION', 'OCULAR', 'SCALP_DERMAL', 'VULNERABLE_POPULATIONS', 'OTHER');

-- CreateEnum
CREATE TYPE "FormulaStatus" AS ENUM ('CONCEPT', 'RESEARCH_CANDIDATE', 'CHEMIST_REVIEW', 'PROTOTYPE', 'STABILITY_TESTING', 'COMPATIBILITY_TESTING', 'SAFETY_ASSESSMENT', 'APPROVED_FOR_CONTROLLED_STUDY', 'APPROVED_FOR_MANUFACTURING', 'RETIRED');

-- CreateEnum
CREATE TYPE "StudyType" AS ENUM ('PEER_REVIEWED_STUDY', 'REVIEW', 'SYSTEMATIC_REVIEW', 'META_ANALYSIS', 'IN_VITRO', 'EX_VIVO', 'ANIMAL', 'HUMAN_OBSERVATIONAL', 'CONTROLLED_HUMAN', 'PROFESSIONAL_CONSENSUS', 'REGULATORY_ASSESSMENT', 'SUPPLIER_STUDY', 'INTERNAL_STUDY', 'CASE_REPORT', 'PATENT_EXAMPLE', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceDirection" AS ENUM ('SUPPORTS', 'CONTRADICTS', 'NEUTRAL', 'MIXED', 'UNCLEAR');

-- CreateEnum
CREATE TYPE "QualityCategory" AS ENUM ('VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'NOT_YET_ASSESSED');

-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('Ingredient', 'IngredientFamily', 'RawMaterial', 'Supplier', 'Formula', 'Product', 'Patent', 'Study', 'EvidenceClaim', 'HairPhenotype', 'ScalpPhenotype', 'Function', 'Mechanism', 'Intervention', 'Outcome', 'UserCohort', 'Regulation', 'ResearchCandidate');

-- CreateEnum
CREATE TYPE "EdgeType" AS ENUM ('ALIAS_OF', 'DERIVED_FROM', 'MEMBER_OF', 'CONTAINS', 'SUPPLIED_BY', 'USED_IN', 'HAS_FUNCTION', 'HAS_PROPERTY', 'COMPATIBLE_WITH', 'INCOMPATIBLE_WITH', 'STUDIED_IN', 'ASSOCIATED_WITH', 'TESTED_AT', 'PRODUCED_OUTCOME', 'TARGETS_PHENOTYPE', 'RESTRICTED_BY', 'PROHIBITED_BY', 'REVIEWED_BY', 'CLAIMED_IN_PATENT', 'CITED_BY', 'SUPPORTS', 'CONTRADICTS', 'REQUIRES_REVIEW', 'GENERATED_HYPOTHESIS');

-- CreateEnum
CREATE TYPE "EdgeStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('IDENTITY', 'CHEMICAL_PROPERTY', 'COSMETIC_FUNCTION', 'EVIDENCE', 'SAFETY', 'REGULATORY', 'PATENT', 'FORMULA', 'STATISTICAL', 'AI_ANSWER', 'RESEARCH_SIGNAL', 'IP', 'SOURCE_RIGHTS', 'PRODUCT_INGREDIENTS', 'GRAPH_RELATIONSHIP');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "QuarantineQueue" AS ENUM ('UNRESOLVED_IDENTITY', 'IDENTIFIER_MISMATCH', 'CONFLICTING_CAS', 'MISSING_UNIT', 'IMPOSSIBLE_VALUE', 'MALFORMED_FORMULA', 'REGULATORY_CONFLICT', 'LOW_CONFIDENCE_AI', 'DUPLICATE_PATENT', 'DUPLICATE_PUBLICATION', 'UNMAPPED_TERM', 'CONSENT_VIOLATION');

-- CreateEnum
CREATE TYPE "QueueItemStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('CSV', 'JSON', 'CONNECTOR', 'SEED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportOutcome" AS ENUM ('CREATED', 'UPDATED', 'UNCHANGED', 'DUPLICATE', 'REJECTED', 'QUARANTINED', 'WARNING');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SDS', 'TDS', 'COA', 'SPECIFICATION', 'FORMULATION_GUIDE', 'REGULATORY', 'LABEL_IMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'NOT_SCANNED');

-- CreateEnum
CREATE TYPE "ObservationSource" AS ENUM ('SELF_REPORTED', 'CLINICIAN_OBSERVED', 'PROFESSIONAL_OBSERVED', 'INSTRUMENT_MEASURED', 'IMAGE_DERIVED', 'AI_ESTIMATE', 'SYSTEM_DERIVED');

-- CreateEnum
CREATE TYPE "ExposureConfidence" AS ENUM ('EXACT_INTERNAL_FORMULA', 'MANUFACTURER_CONFIRMED_FORMULA', 'SUPPLIER_CONFIRMED_ACTIVE', 'STUDY_CONFIRMED_CONCENTRATION', 'ESTIMATED_RANGE', 'LABEL_CONFIRMED_PRESENCE', 'USER_REPORTED_PRODUCT', 'INFERRED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IntegrationRecordStatus" AS ENUM ('ACCEPTED', 'QUARANTINED', 'REJECTED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "entitlements" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "organizationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" UUID,
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewerProfile" (
    "userId" UUID NOT NULL,
    "profession" TEXT,
    "qualifications" TEXT,
    "credential" TEXT,
    "expertise" TEXT[],
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "coiDeclaration" TEXT,
    "coiDeclaredAt" TIMESTAMP(3),
    "trainingCompleted" TEXT[],
    "protocolVersions" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID,
    "actorType" TEXT NOT NULL,
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "sourceId" UUID,
    "requestId" TEXT,
    "ip" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "userId" UUID,
    "email" TEXT,
    "ip" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT,
    "type" "SourceType" NOT NULL,
    "authority" TEXT,
    "url" TEXT,
    "accessMethod" TEXT,
    "apiStatus" TEXT,
    "license" TEXT,
    "termsUrl" TEXT,
    "rightsStatus" "RightsStatus" NOT NULL DEFAULT 'UNKNOWN',
    "commercialUse" TEXT,
    "internalUse" TEXT,
    "redistribution" TEXT,
    "derivativeWork" TEXT,
    "attributionRequirements" TEXT,
    "rateLimits" TEXT,
    "storagePermission" BOOLEAN NOT NULL DEFAULT false,
    "cachingPermission" BOOLEAN NOT NULL DEFAULT false,
    "fullTextStoragePermission" BOOLEAN NOT NULL DEFAULT false,
    "documentSharingPermission" BOOLEAN NOT NULL DEFAULT false,
    "allowExport" BOOLEAN NOT NULL DEFAULT false,
    "allowExternalApi" BOOLEAN NOT NULL DEFAULT false,
    "allowModelTraining" BOOLEAN NOT NULL DEFAULT false,
    "allowPartnerSharing" BOOLEAN NOT NULL DEFAULT false,
    "refreshFrequency" TEXT,
    "lastSuccessfulImportAt" TIMESTAMP(3),
    "lastAttemptedImportAt" TIMESTAMP(3),
    "termsReviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "lastTermsReviewAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "reviewNotes" TEXT,
    "approvedUses" TEXT[],
    "prohibitedUses" TEXT[],
    "reReviewDueAt" TIMESTAMP(3),
    "parserVersion" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalRef" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientFamily" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" UUID,

    CONSTRAINT "IngredientFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "inciName" TEXT,
    "displayName" TEXT NOT NULL,
    "chemicalName" TEXT,
    "commonName" TEXT,
    "description" TEXT,
    "identityType" "IdentityType" NOT NULL,
    "materialType" "MaterialType" NOT NULL,
    "originType" "OriginType" NOT NULL DEFAULT 'UNKNOWN',
    "familyId" UUID,
    "status" "IngredientStatus" NOT NULL DEFAULT 'ACTIVE',
    "mergedIntoId" UUID,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "priorityTier" INTEGER,
    "priorityReason" TEXT,
    "identityNote" TEXT,
    "structureImageUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplexMaterialProfile" (
    "ingredientId" UUID NOT NULL,
    "botanicalSourceId" UUID,
    "plantPart" TEXT,
    "geographicOrigin" TEXT,
    "harvestConditions" TEXT,
    "extractionSolvent" TEXT,
    "extractionMethodId" UUID,
    "fermentationSourceId" UUID,
    "processingMethod" TEXT,
    "purificationLevel" TEXT,
    "standardizationMarker" TEXT,
    "markerRange" TEXT,
    "carrier" TEXT,
    "preservative" TEXT,
    "waterContent" TEXT,
    "batchVariability" TEXT,
    "supplierGrade" TEXT,
    "mwDistribution" TEXT,
    "degreeOfPolymerization" TEXT,
    "degreeOfHydrolysis" TEXT,
    "activeContentRange" TEXT,
    "sourceId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplexMaterialProfile_pkey" PRIMARY KEY ("ingredientId")
);

-- CreateTable
CREATE TABLE "BotanicalSource" (
    "id" UUID NOT NULL,
    "genus" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "cultivar" TEXT,
    "commonName" TEXT,
    "plantFamily" TEXT,

    CONSTRAINT "BotanicalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionMethod" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "ExtractionMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FermentationSource" (
    "id" UUID NOT NULL,
    "organism" TEXT NOT NULL,
    "substrate" TEXT,
    "description" TEXT,

    CONSTRAINT "FermentationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientName" (
    "id" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "nameType" "NameType" NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'en',
    "sourceId" UUID,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientAlias" (
    "id" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "aliasType" "AliasType" NOT NULL DEFAULT 'SYNONYM',
    "sourceId" UUID,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientIdentifier" (
    "id" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "type" "IdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "isRepresentative" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" UUID,
    "sourceLocation" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "confidence" DOUBLE PRECISION,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "IngredientIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientRelation" (
    "id" UUID NOT NULL,
    "fromId" UUID NOT NULL,
    "toId" UUID NOT NULL,
    "relationType" "IngredientRelationType" NOT NULL,
    "interchangeable" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" UUID,
    "notes" TEXT,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityResolutionCandidate" (
    "id" UUID NOT NULL,
    "ingredientAId" UUID NOT NULL,
    "ingredientBId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "status" "QueueItemStatus" NOT NULL DEFAULT 'OPEN',
    "decision" "IdentityDecision",
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityResolutionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityResolutionEvent" (
    "id" UUID NOT NULL,
    "type" "IdentityEventType" NOT NULL,
    "primaryIngredientId" UUID NOT NULL,
    "secondaryIngredientId" UUID,
    "candidateId" UUID,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,

    CONSTRAINT "IdentityResolutionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientFact" (
    "id" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "valueText" TEXT,
    "originalValue" TEXT,
    "originalUnit" TEXT,
    "valueNumeric" DECIMAL(20,8),
    "valueMin" DECIMAL(20,8),
    "valueMax" DECIMAL(20,8),
    "isRange" BOOLEAN NOT NULL DEFAULT false,
    "normalizedValue" DECIMAL(20,8),
    "normalizedMin" DECIMAL(20,8),
    "normalizedMax" DECIMAL(20,8),
    "normalizedUnit" TEXT,
    "conversionMethod" TEXT,
    "conversionVersion" TEXT,
    "significantFigures" INTEGER,
    "uncertainty" TEXT,
    "detectionLimit" TEXT,
    "qualityFlags" TEXT[],
    "testConditions" TEXT,
    "temperatureC" DECIMAL(8,3),
    "phConditions" TEXT,
    "medium" TEXT,
    "formulationContext" TEXT,
    "jurisdiction" TEXT,
    "sourceId" UUID NOT NULL,
    "sourceLocation" TEXT,
    "quotedText" TEXT,
    "extractionMethod" TEXT,
    "entryMode" "EntryMode" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "supersededById" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunctionTerm" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "parentId" UUID,

    CONSTRAINT "FunctionTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientFunction" (
    "id" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "functionId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "basis" TEXT,
    "entryMode" "EntryMode" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientFunction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OntologyTerm" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "consumerDefinition" TEXT,
    "researchDefinition" TEXT,
    "measurementMethod" TEXT,
    "allowedValues" JSONB,
    "parentId" UUID,
    "synonyms" TEXT[],
    "ontologyVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT_FOR_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OntologyTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcentrationRecord" (
    "id" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "recordType" "ConcentrationType" NOT NULL,
    "minValue" DECIMAL(12,6),
    "maxValue" DECIMAL(12,6),
    "typicalValue" DECIMAL(12,6),
    "unit" TEXT NOT NULL,
    "basis" TEXT,
    "productCategory" TEXT,
    "applicationType" "ApplicationType" NOT NULL DEFAULT 'UNKNOWN',
    "applicationSite" "ApplicationSite" NOT NULL DEFAULT 'UNKNOWN',
    "intendedFunction" TEXT,
    "sourceId" UUID NOT NULL,
    "sourceLocation" TEXT,
    "jurisdiction" TEXT,
    "restriction" TEXT,
    "testConditions" TEXT,
    "entryMode" "EntryMode" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "effectiveDate" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConcentrationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryRecord" (
    "id" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "regulationRef" TEXT,
    "status" "RegulatoryStatus" NOT NULL,
    "maxConcentration" DECIMAL(12,6),
    "maxConcentrationUnit" TEXT,
    "productRestrictions" TEXT,
    "warningRequirements" TEXT,
    "labelingRequirements" TEXT,
    "colorAdditiveStatus" TEXT,
    "preservativeStatus" TEXT,
    "uvFilterStatus" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "sourceId" UUID NOT NULL,
    "sourceUrl" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "staleAfterDays" INTEGER NOT NULL DEFAULT 180,
    "entryMode" "EntryMode" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "supersededAt" TIMESTAMP(3),
    "supersededById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatoryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyReview" (
    "id" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "reviewBody" TEXT NOT NULL,
    "endpoint" "SafetyEndpoint" NOT NULL,
    "conclusion" TEXT NOT NULL,
    "exposureRoute" TEXT,
    "vulnerablePopulations" TEXT,
    "evidenceStrength" TEXT,
    "sourceId" UUID NOT NULL,
    "url" TEXT,
    "publishedAt" TIMESTAMP(3),
    "highRisk" BOOLEAN NOT NULL DEFAULT false,
    "entryMode" "EntryMode" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "type" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMaterial" (
    "id" UUID NOT NULL,
    "tradeName" TEXT NOT NULL,
    "supplierId" UUID,
    "manufacturer" TEXT,
    "distributor" TEXT,
    "declaredComposition" TEXT,
    "activePercent" DECIMAL(9,5),
    "activePercentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "carrier" TEXT,
    "preservationSystem" TEXT,
    "countryOfOrigin" TEXT,
    "moq" TEXT,
    "leadTime" TEXT,
    "priceRange" TEXT,
    "sampleAvailable" BOOLEAN,
    "certifications" TEXT[],
    "veganStatus" TEXT,
    "naturalOriginIndex" DECIMAL(6,4),
    "allergenStatement" TEXT,
    "internalApprovalStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "ownerOrgId" UUID NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'ORGANIZATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMaterialComponent" (
    "id" UUID NOT NULL,
    "rawMaterialId" UUID NOT NULL,
    "ingredientId" UUID NOT NULL,
    "declaredName" TEXT,
    "percentMin" DECIMAL(9,5),
    "percentMax" DECIMAL(9,5),
    "role" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RawMaterialComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "ownerOrgId" UUID NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'RESTRICTED',
    "docType" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "version" TEXT,
    "documentDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reviewDueAt" TIMESTAMP(3),
    "rawMaterialId" UUID,
    "supplierId" UUID,
    "supplierProvided" BOOLEAN NOT NULL DEFAULT true,
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formula" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerOrgId" UUID NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'RESTRICTED',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "productCategory" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "duplicatedFromId" UUID,

    CONSTRAINT "Formula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormulaVersion" (
    "id" UUID NOT NULL,
    "formulaId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "FormulaStatus" NOT NULL DEFAULT 'CONCEPT',
    "intendedPhenotypeCodes" TEXT[],
    "intendedGoals" TEXT[],
    "applicationType" "ApplicationType" NOT NULL DEFAULT 'UNKNOWN',
    "targetPh" DECIMAL(4,2),
    "measuredPh" DECIMAL(4,2),
    "viscosity" TEXT,
    "batchSize" DECIMAL(12,4),
    "batchUnit" TEXT,
    "manufacturingProcess" TEXT,
    "processingTemperature" TEXT,
    "phaseStructure" TEXT,
    "preservationSystem" TEXT,
    "packagingCompatibility" TEXT,
    "stabilityStatus" TEXT NOT NULL DEFAULT 'NOT_TESTED',
    "safetyReviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "chemistReviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "studyStatus" TEXT NOT NULL DEFAULT 'NONE',
    "commercialStatus" TEXT NOT NULL DEFAULT 'NOT_COMMERCIAL',
    "qsTolerance" DECIMAL(6,4) NOT NULL DEFAULT 0.001,
    "notes" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "approvedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormulaVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormulaIngredient" (
    "id" UUID NOT NULL,
    "formulaVersionId" UUID NOT NULL,
    "ingredientId" UUID,
    "rawMaterialId" UUID,
    "displayName" TEXT NOT NULL,
    "phase" TEXT,
    "percent" DECIMAL(9,5),
    "isQs" BOOLEAN NOT NULL DEFAULT false,
    "functionalRole" TEXT,
    "additionOrder" INTEGER,
    "processingNotes" TEXT,
    "supplierId" UUID,
    "lot" TEXT,
    "activeConcentration" DECIMAL(9,5),

    CONSTRAINT "FormulaIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "market" TEXT,
    "applicationType" "ApplicationType" NOT NULL DEFAULT 'UNKNOWN',
    "isSupernatural" BOOLEAN NOT NULL DEFAULT false,
    "barcode" TEXT,
    "purchaseUrl" TEXT,
    "sourceImageUrl" TEXT,
    "discontinued" BOOLEAN NOT NULL DEFAULT false,
    "ownerOrgId" UUID,
    "verificationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVersion" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "ingredientListRaw" TEXT NOT NULL,
    "ingredientListSource" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceId" UUID,
    "contentHash" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "formulaVersionId" UUID,
    "marketingExcerpts" TEXT[],
    "claimFlags" JSONB NOT NULL DEFAULT '[]',
    "dataQualityNotes" TEXT[],
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductIngredient" (
    "id" UUID NOT NULL,
    "productVersionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "displayedName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "ingredientId" UUID,
    "identityConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matchMethod" TEXT,
    "parsingStatus" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',

    CONSTRAINT "ProductIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "doi" TEXT,
    "pmid" TEXT,
    "pmcid" TEXT,
    "citation" TEXT,
    "authors" TEXT,
    "journal" TEXT,
    "publicationDate" TIMESTAMP(3),
    "studyType" "StudyType" NOT NULL,
    "evidenceLevel" INTEGER,
    "population" TEXT,
    "phenotypeDescription" TEXT,
    "sampleSize" INTEGER,
    "comparator" TEXT,
    "duration" TEXT,
    "concentrationText" TEXT,
    "outcomesText" TEXT,
    "measurementMethod" TEXT,
    "statisticalResult" TEXT,
    "limitations" TEXT,
    "coiInfo" TEXT,
    "fundingSource" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "fullTextAvailable" BOOLEAN,
    "extractionStatus" TEXT NOT NULL DEFAULT 'METADATA_ONLY',
    "sourceConclusion" TEXT,
    "aiSummary" TEXT,
    "aiSummaryModel" TEXT,
    "reviewedInterpretation" TEXT,
    "internalRelevance" TEXT,
    "qualityPreliminary" JSONB,
    "qualityPreliminaryCategory" "QualityCategory" NOT NULL DEFAULT 'NOT_YET_ASSESSED',
    "qualityReviewerCategory" "QualityCategory" NOT NULL DEFAULT 'NOT_YET_ASSESSED',
    "qualityAdjustmentReason" TEXT,
    "rubricVersion" TEXT,
    "texturedHairRelevant" BOOLEAN,
    "medicalContext" BOOLEAN NOT NULL DEFAULT false,
    "safetyRelevant" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" UUID NOT NULL,
    "entryMode" "EntryMode" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceLink" (
    "id" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "ingredientId" UUID,
    "formulaId" UUID,
    "ontologyTermId" UUID,
    "role" TEXT NOT NULL,
    "direction" "EvidenceDirection" NOT NULL DEFAULT 'UNCLEAR',
    "concentrationText" TEXT,
    "statement" TEXT,
    "entryMode" "EntryMode" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patent" (
    "id" UUID NOT NULL,
    "publicationNumber" TEXT NOT NULL,
    "applicationNumber" TEXT,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "applicants" TEXT[],
    "assignees" TEXT[],
    "inventors" TEXT[],
    "priorityDate" TIMESTAMP(3),
    "filingDate" TIMESTAMP(3),
    "publicationDate" TIMESTAMP(3),
    "grantDate" TIMESTAMP(3),
    "jurisdiction" TEXT NOT NULL,
    "jurisdictions" TEXT[],
    "cpcClassifications" TEXT[],
    "legalStatus" TEXT,
    "familyMembers" TEXT[],
    "claimsSummary" TEXT,
    "examples" TEXT,
    "citedPatents" TEXT[],
    "citingPatents" TEXT[],
    "topics" TEXT[],
    "officialUrl" TEXT NOT NULL,
    "sourceId" UUID NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "entryMode" "EntryMode" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatentLink" (
    "id" UUID NOT NULL,
    "patentId" UUID NOT NULL,
    "ingredientId" UUID,
    "formulaId" UUID,
    "relation" TEXT NOT NULL,
    "mechanism" TEXT,
    "entryMode" "EntryMode" NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphEdge" (
    "id" UUID NOT NULL,
    "fromType" "NodeType" NOT NULL,
    "fromId" TEXT NOT NULL,
    "toType" "NodeType" NOT NULL,
    "toId" TEXT NOT NULL,
    "edgeType" "EdgeType" NOT NULL,
    "sourceId" UUID,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidenceType" TEXT,
    "status" "EdgeStatus" NOT NULL DEFAULT 'PROPOSED',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "properties" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRequirement" (
    "id" UUID NOT NULL,
    "recordType" TEXT NOT NULL,
    "reviewType" "ReviewType" NOT NULL,
    "requiredRoles" "Role"[],
    "approvalsRequired" INTEGER NOT NULL DEFAULT 1,
    "secondReviewer" BOOLEAN NOT NULL DEFAULT false,
    "blind" BOOLEAN NOT NULL DEFAULT false,
    "dueInDays" INTEGER NOT NULL DEFAULT 14,
    "notes" TEXT,

    CONSTRAINT "ReviewRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTask" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reviewType" "ReviewType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "requiredRoles" "Role"[],
    "approvalsRequired" INTEGER NOT NULL DEFAULT 1,
    "blind" BOOLEAN NOT NULL DEFAULT false,
    "assignedToId" UUID,
    "submittedById" UUID,
    "dueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewDecision" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "decision" "ReviewStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuarantineItem" (
    "id" UUID NOT NULL,
    "queue" "QuarantineQueue" NOT NULL,
    "importJobId" UUID,
    "entityType" TEXT,
    "entityId" TEXT,
    "dedupeKey" TEXT,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "QueueItemStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuarantineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "kind" "ImportKind" NOT NULL,
    "entityType" TEXT NOT NULL,
    "filename" TEXT,
    "fileSha256" TEXT,
    "sourceVersion" TEXT,
    "parserVersion" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'QUEUED',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "unresolvedCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "rows" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "externalKey" TEXT,
    "outcome" "ImportOutcome" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "message" TEXT,

    CONSTRAINT "ImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionQueueItem" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "ingredientId" UUID,
    "priorityTier" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "supernaturalProducts" TEXT[],
    "hairPassportAppearances" INTEGER NOT NULL DEFAULT 0,
    "texturedProductAppearances" INTEGER NOT NULL DEFAULT 0,
    "hairGoals" TEXT[],
    "evidenceAvailability" TEXT NOT NULL,
    "regulatoryReviewPriority" TEXT NOT NULL,
    "importStatus" TEXT NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchCandidate" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "candidateType" TEXT NOT NULL,
    "origin" TEXT,
    "discoveryMethod" TEXT,
    "associatedSignal" TEXT,
    "hypothesis" TEXT,
    "literatureNotes" TEXT,
    "priorArtNotes" TEXT,
    "proposedMechanism" TEXT,
    "targetPhenotypeCodes" TEXT[],
    "experiments" TEXT,
    "results" TEXT,
    "collaborators" TEXT[],
    "researchStatus" TEXT NOT NULL DEFAULT 'HYPOTHESIS',
    "safetyStatus" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "testingStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "ipStatus" TEXT NOT NULL DEFAULT 'NOT_REVIEWED',
    "ownershipReviewStatus" TEXT NOT NULL DEFAULT 'NOT_REVIEWED',
    "visibility" "Visibility" NOT NULL DEFAULT 'CONFIDENTIAL_IP',
    "ownerOrgId" UUID NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchEntry" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "termKind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SearchEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "query" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "resultCount" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "zeroResult" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationBatch" (
    "id" UUID NOT NULL,
    "externalSystem" TEXT NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "apiKeyId" UUID,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "quarantinedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IntegrationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationRecord" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "externalSystem" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "externalRecordId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "participantRef" TEXT,
    "rawPayload" JSONB,
    "status" "IntegrationRecordStatus" NOT NULL,
    "messages" TEXT[],
    "normalizedEntityType" TEXT,
    "normalizedEntityId" TEXT,
    "mappingVersion" TEXT,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxonomyMapping" (
    "id" UUID NOT NULL,
    "externalSystem" TEXT NOT NULL,
    "externalTaxonomy" TEXT NOT NULL,
    "externalVersion" TEXT NOT NULL,
    "externalCode" TEXT NOT NULL,
    "ontologyTermId" UUID NOT NULL,
    "mappingVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxonomyMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldMapping" (
    "id" UUID NOT NULL,
    "externalSystem" TEXT NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "externalPath" TEXT NOT NULL,
    "internalField" TEXT NOT NULL,
    "transform" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchParticipant" (
    "id" UUID NOT NULL,
    "researchId" TEXT NOT NULL,
    "externalSystem" TEXT NOT NULL,
    "participantRef" TEXT NOT NULL,
    "ageBand" TEXT,
    "regionCoarse" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "deletionScheduledAt" TIMESTAMP(3),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "modelTrainingEligible" BOOLEAN NOT NULL DEFAULT false,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentSnapshot" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "researchUse" BOOLEAN NOT NULL,
    "healthDataUse" BOOLEAN NOT NULL,
    "imageDerivedUse" BOOLEAN NOT NULL,
    "modelTrainingUse" BOOLEAN NOT NULL,
    "protocolVersion" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhenotypeObservation" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "integrationRecordId" UUID NOT NULL,
    "ontologyTermId" UUID,
    "externalTermSystem" TEXT NOT NULL,
    "externalTermCode" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "sourceType" "ObservationSource" NOT NULL,
    "methodCode" TEXT NOT NULL,
    "methodVersion" TEXT,
    "modelVersion" TEXT,
    "confidence" DOUBLE PRECISION,
    "qualityFlags" TEXT[],
    "observedAt" TIMESTAMP(3) NOT NULL,
    "datePrecision" TEXT NOT NULL,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhenotypeObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutcomeObservation" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "integrationRecordId" UUID NOT NULL,
    "ontologyTermId" UUID,
    "externalTermSystem" TEXT NOT NULL,
    "externalTermCode" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "sourceType" "ObservationSource" NOT NULL,
    "methodCode" TEXT NOT NULL,
    "methodVersion" TEXT,
    "modelVersion" TEXT,
    "confidence" DOUBLE PRECISION,
    "qualityFlags" TEXT[],
    "observedAt" TIMESTAMP(3) NOT NULL,
    "datePrecision" TEXT NOT NULL,
    "baselineRecordRef" TEXT,
    "followUpDays" INTEGER,
    "exposureEventRefs" TEXT[],
    "concurrentChanges" TEXT[],
    "context" JSONB,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutcomeObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExposureEvent" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "integrationRecordId" UUID NOT NULL,
    "externalRecordId" TEXT NOT NULL,
    "productId" UUID,
    "productVersionId" UUID,
    "formulaVersionId" UUID,
    "productRefRaw" TEXT,
    "exposureConfidence" "ExposureConfidence" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "frequency" JSONB,
    "applicationQuantity" JSONB,
    "contactDuration" JSONB,
    "applicationType" "ApplicationType" NOT NULL DEFAULT 'UNKNOWN',
    "applicationSites" TEXT[],
    "coverage" TEXT,
    "adherence" JSONB,
    "details" JSONB NOT NULL DEFAULT '{}',
    "sourceType" "ObservationSource" NOT NULL,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExposureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensitivityFactor" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "integrationRecordId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "codeSystem" TEXT,
    "code" TEXT,
    "present" TEXT NOT NULL,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensitivityFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalNotice" (
    "id" UUID NOT NULL,
    "externalSystem" TEXT NOT NULL,
    "participantRef" TEXT NOT NULL,
    "participantId" UUID,
    "scope" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "affectedAnalyses" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "isMock" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WithdrawalNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefix_key" ON "ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "SecurityEvent_type_at_idx" ON "SecurityEvent"("type", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");

-- CreateIndex
CREATE INDEX "ExternalRef_entityType_entityId_idx" ON "ExternalRef"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRef_sourceId_entityType_externalId_key" ON "ExternalRef"("sourceId", "entityType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientFamily_slug_key" ON "IngredientFamily"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_slug_key" ON "Ingredient"("slug");

-- CreateIndex
CREATE INDEX "Ingredient_status_idx" ON "Ingredient"("status");

-- CreateIndex
CREATE INDEX "Ingredient_familyId_idx" ON "Ingredient"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "BotanicalSource_genus_species_key" ON "BotanicalSource"("genus", "species");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionMethod_name_key" ON "ExtractionMethod"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FermentationSource_organism_substrate_key" ON "FermentationSource"("organism", "substrate");

-- CreateIndex
CREATE INDEX "IngredientName_normalized_idx" ON "IngredientName"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientName_ingredientId_nameType_normalized_key" ON "IngredientName"("ingredientId", "nameType", "normalized");

-- CreateIndex
CREATE INDEX "IngredientAlias_normalized_idx" ON "IngredientAlias"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientAlias_ingredientId_normalized_key" ON "IngredientAlias"("ingredientId", "normalized");

-- CreateIndex
CREATE INDEX "IngredientIdentifier_type_normalized_idx" ON "IngredientIdentifier"("type", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientIdentifier_ingredientId_type_normalized_key" ON "IngredientIdentifier"("ingredientId", "type", "normalized");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientRelation_fromId_toId_relationType_key" ON "IngredientRelation"("fromId", "toId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityResolutionCandidate_ingredientAId_ingredientBId_key" ON "IdentityResolutionCandidate"("ingredientAId", "ingredientBId");

-- CreateIndex
CREATE INDEX "IngredientFact_ingredientId_propertyType_idx" ON "IngredientFact"("ingredientId", "propertyType");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionTerm_code_key" ON "FunctionTerm"("code");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientFunction_ingredientId_functionId_sourceId_key" ON "IngredientFunction"("ingredientId", "functionId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "OntologyTerm_code_key" ON "OntologyTerm"("code");

-- CreateIndex
CREATE INDEX "ConcentrationRecord_ingredientId_recordType_idx" ON "ConcentrationRecord"("ingredientId", "recordType");

-- CreateIndex
CREATE INDEX "RegulatoryRecord_ingredientId_jurisdiction_idx" ON "RegulatoryRecord"("ingredientId", "jurisdiction");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RawMaterial_ownerOrgId_tradeName_supplierId_key" ON "RawMaterial"("ownerOrgId", "tradeName", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "RawMaterialComponent_rawMaterialId_ingredientId_key" ON "RawMaterialComponent"("rawMaterialId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Formula_ownerOrgId_code_key" ON "Formula"("ownerOrgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FormulaVersion_formulaId_versionNumber_key" ON "FormulaVersion"("formulaId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVersion_productId_versionNumber_key" ON "ProductVersion"("productId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductIngredient_productVersionId_position_key" ON "ProductIngredient"("productVersionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_doi_key" ON "Evidence"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_pmid_key" ON "Evidence"("pmid");

-- CreateIndex
CREATE INDEX "EvidenceLink_ingredientId_idx" ON "EvidenceLink"("ingredientId");

-- CreateIndex
CREATE INDEX "EvidenceLink_ontologyTermId_idx" ON "EvidenceLink"("ontologyTermId");

-- CreateIndex
CREATE UNIQUE INDEX "Patent_publicationNumber_key" ON "Patent"("publicationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PatentLink_patentId_ingredientId_relation_key" ON "PatentLink"("patentId", "ingredientId", "relation");

-- CreateIndex
CREATE INDEX "GraphEdge_fromType_fromId_idx" ON "GraphEdge"("fromType", "fromId");

-- CreateIndex
CREATE INDEX "GraphEdge_toType_toId_idx" ON "GraphEdge"("toType", "toId");

-- CreateIndex
CREATE INDEX "GraphEdge_edgeType_idx" ON "GraphEdge"("edgeType");

-- CreateIndex
CREATE UNIQUE INDEX "GraphEdge_fromType_fromId_toType_toId_edgeType_key" ON "GraphEdge"("fromType", "fromId", "toType", "toId", "edgeType");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRequirement_recordType_key" ON "ReviewRequirement"("recordType");

-- CreateIndex
CREATE INDEX "ReviewTask_status_reviewType_idx" ON "ReviewTask"("status", "reviewType");

-- CreateIndex
CREATE INDEX "ReviewTask_entityType_entityId_idx" ON "ReviewTask"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "QuarantineItem_dedupeKey_key" ON "QuarantineItem"("dedupeKey");

-- CreateIndex
CREATE INDEX "QuarantineItem_queue_status_idx" ON "QuarantineItem"("queue", "status");

-- CreateIndex
CREATE INDEX "ImportRecord_jobId_outcome_idx" ON "ImportRecord"("jobId", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionQueueItem_ingredientId_key" ON "IngestionQueueItem"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchCandidate_code_key" ON "ResearchCandidate"("code");

-- CreateIndex
CREATE INDEX "SearchEntry_normalized_idx" ON "SearchEntry"("normalized");

-- CreateIndex
CREATE INDEX "SearchEntry_entityType_entityId_idx" ON "SearchEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SearchLog_userId_createdAt_idx" ON "SearchLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationRecord_externalSystem_recordType_externalRecordI_key" ON "IntegrationRecord"("externalSystem", "recordType", "externalRecordId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyMapping_externalSystem_externalTaxonomy_externalVer_key" ON "TaxonomyMapping"("externalSystem", "externalTaxonomy", "externalVersion", "externalCode");

-- CreateIndex
CREATE UNIQUE INDEX "FieldMapping_externalSystem_contractVersion_recordType_exte_key" ON "FieldMapping"("externalSystem", "contractVersion", "recordType", "externalPath");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchParticipant_researchId_key" ON "ResearchParticipant"("researchId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchParticipant_externalSystem_participantRef_key" ON "ResearchParticipant"("externalSystem", "participantRef");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerProfile" ADD CONSTRAINT "ReviewerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientFamily" ADD CONSTRAINT "IngredientFamily_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "IngredientFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "IngredientFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplexMaterialProfile" ADD CONSTRAINT "ComplexMaterialProfile_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplexMaterialProfile" ADD CONSTRAINT "ComplexMaterialProfile_botanicalSourceId_fkey" FOREIGN KEY ("botanicalSourceId") REFERENCES "BotanicalSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplexMaterialProfile" ADD CONSTRAINT "ComplexMaterialProfile_extractionMethodId_fkey" FOREIGN KEY ("extractionMethodId") REFERENCES "ExtractionMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplexMaterialProfile" ADD CONSTRAINT "ComplexMaterialProfile_fermentationSourceId_fkey" FOREIGN KEY ("fermentationSourceId") REFERENCES "FermentationSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientName" ADD CONSTRAINT "IngredientName_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientAlias" ADD CONSTRAINT "IngredientAlias_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientIdentifier" ADD CONSTRAINT "IngredientIdentifier_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientRelation" ADD CONSTRAINT "IngredientRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientRelation" ADD CONSTRAINT "IngredientRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientFact" ADD CONSTRAINT "IngredientFact_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientFunction" ADD CONSTRAINT "IngredientFunction_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientFunction" ADD CONSTRAINT "IngredientFunction_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "FunctionTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OntologyTerm" ADD CONSTRAINT "OntologyTerm_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OntologyTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcentrationRecord" ADD CONSTRAINT "ConcentrationRecord_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryRecord" ADD CONSTRAINT "RegulatoryRecord_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyReview" ADD CONSTRAINT "SafetyReview_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterial" ADD CONSTRAINT "RawMaterial_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterial" ADD CONSTRAINT "RawMaterial_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialComponent" ADD CONSTRAINT "RawMaterialComponent_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialComponent" ADD CONSTRAINT "RawMaterialComponent_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Formula" ADD CONSTRAINT "Formula_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulaVersion" ADD CONSTRAINT "FormulaVersion_formulaId_fkey" FOREIGN KEY ("formulaId") REFERENCES "Formula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulaIngredient" ADD CONSTRAINT "FormulaIngredient_formulaVersionId_fkey" FOREIGN KEY ("formulaVersionId") REFERENCES "FormulaVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulaIngredient" ADD CONSTRAINT "FormulaIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulaIngredient" ADD CONSTRAINT "FormulaIngredient_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_formulaVersionId_fkey" FOREIGN KEY ("formulaVersionId") REFERENCES "FormulaVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductIngredient" ADD CONSTRAINT "ProductIngredient_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductIngredient" ADD CONSTRAINT "ProductIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_ontologyTermId_fkey" FOREIGN KEY ("ontologyTermId") REFERENCES "OntologyTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatentLink" ADD CONSTRAINT "PatentLink_patentId_fkey" FOREIGN KEY ("patentId") REFERENCES "Patent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatentLink" ADD CONSTRAINT "PatentLink_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ReviewTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRecord" ADD CONSTRAINT "ImportRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchCandidate" ADD CONSTRAINT "ResearchCandidate_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationBatch" ADD CONSTRAINT "IntegrationBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationRecord" ADD CONSTRAINT "IntegrationRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IntegrationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxonomyMapping" ADD CONSTRAINT "TaxonomyMapping_ontologyTermId_fkey" FOREIGN KEY ("ontologyTermId") REFERENCES "OntologyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentSnapshot" ADD CONSTRAINT "ConsentSnapshot_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ResearchParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhenotypeObservation" ADD CONSTRAINT "PhenotypeObservation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ResearchParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeObservation" ADD CONSTRAINT "OutcomeObservation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ResearchParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExposureEvent" ADD CONSTRAINT "ExposureEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ResearchParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensitivityFactor" ADD CONSTRAINT "SensitivityFactor_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ResearchParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
