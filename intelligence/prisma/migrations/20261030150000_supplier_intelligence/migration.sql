-- AlterTable
ALTER TABLE "RawMaterial" ADD COLUMN     "grade" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "regions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "RawMaterialSpec" (
    "id" UUID NOT NULL,
    "rawMaterialId" UUID NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "method" TEXT,
    "documentId" UUID,
    "entryMode" "EntryMode" NOT NULL DEFAULT 'MANUAL',
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawMaterialSpec_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RawMaterialSpec_rawMaterialId_idx" ON "RawMaterialSpec"("rawMaterialId");

-- AddForeignKey
ALTER TABLE "RawMaterialSpec" ADD CONSTRAINT "RawMaterialSpec_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

