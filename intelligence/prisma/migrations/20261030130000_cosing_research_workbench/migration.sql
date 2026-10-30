-- CreateEnum
CREATE TYPE "ResearchWorkflow" AS ENUM ('SUBSTITUTES', 'FORMULATION', 'CLAIM', 'SUPPLIERS', 'COMPARISON', 'PRODUCT_BRIEF', 'GENERAL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'COMPLETE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "FormulaIngredient" ADD COLUMN     "unitCostPerKg" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "FormulaVersion" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "unitSizeG" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "cosingDescription" TEXT,
ADD COLUMN     "cosingFunctions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cosingRef" TEXT,
ADD COLUMN     "cosingRestriction" TEXT,
ADD COLUMN     "cosingUpdated" TEXT,
ADD COLUMN     "wikidataId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "workspaceMode" TEXT;

-- CreateTable
CREATE TABLE "ResearchProject" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" UUID,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "workflow" "ResearchWorkflow" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'OPEN',
    "visibility" "Visibility" NOT NULL DEFAULT 'ORGANIZATION',
    "inputs" JSONB NOT NULL DEFAULT '{}',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchProjectMember" (
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',

    CONSTRAINT "ResearchProjectMember_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "ResearchRun" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workflow" "ResearchWorkflow" NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "engineVersion" TEXT NOT NULL,
    "aiUsed" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchReport" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdById" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'ORGANIZATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "note" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID,
    "kind" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchProject_organizationId_updatedAt_idx" ON "ResearchProject"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "ResearchRun_projectId_createdAt_idx" ON "ResearchRun"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ResearchReport_organizationId_createdAt_idx" ON "ResearchReport"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Collection_organizationId_idx" ON "Collection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_entityType_entityId_key" ON "CollectionItem"("collectionId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "UsageEvent_organizationId_kind_at_idx" ON "UsageEvent"("organizationId", "kind", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_cosingRef_key" ON "Ingredient"("cosingRef");

-- CreateIndex
CREATE INDEX "Ingredient_cosingFunctions_idx" ON "Ingredient" USING GIN ("cosingFunctions");

-- AddForeignKey
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProjectMember" ADD CONSTRAINT "ResearchProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchRun" ADD CONSTRAINT "ResearchRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchReport" ADD CONSTRAINT "ResearchReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

