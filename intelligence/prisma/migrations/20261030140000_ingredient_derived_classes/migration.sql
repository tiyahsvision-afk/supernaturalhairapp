-- Rule-derived classification cache (screening aid; not measured data).
ALTER TABLE "Ingredient" ADD COLUMN "derivedClasses" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "derivedVersion" TEXT;

CREATE INDEX "Ingredient_derivedClasses_idx" ON "Ingredient" USING GIN ("derivedClasses");
