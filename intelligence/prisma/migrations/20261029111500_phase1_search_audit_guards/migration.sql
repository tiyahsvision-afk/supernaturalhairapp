-- Search: trigram indexes for fuzzy matching on the unified search index and on names/aliases.
CREATE INDEX IF NOT EXISTS "SearchEntry_normalized_trgm" ON "SearchEntry" USING gin ("normalized" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "IngredientAlias_normalized_trgm" ON "IngredientAlias" USING gin ("normalized" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "IngredientName_normalized_trgm" ON "IngredientName" USING gin ("normalized" gin_trgm_ops);

-- Audit log is append-only: history must never be rewritten.
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only (% rejected)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON "AuditLog";
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

-- Integrity guards that Prisma cannot express.
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_level_range" CHECK ("evidenceLevel" IS NULL OR ("evidenceLevel" BETWEEN 1 AND 7));
ALTER TABLE "FormulaIngredient" ADD CONSTRAINT "FormulaIngredient_percent_range" CHECK ("percent" IS NULL OR ("percent" >= 0 AND "percent" <= 100));
ALTER TABLE "FormulaIngredient" ADD CONSTRAINT "FormulaIngredient_has_material" CHECK ("ingredientId" IS NOT NULL OR "rawMaterialId" IS NOT NULL);
ALTER TABLE "RawMaterial" ADD CONSTRAINT "RawMaterial_active_range" CHECK ("activePercent" IS NULL OR ("activePercent" > 0 AND "activePercent" <= 100));
ALTER TABLE "ConcentrationRecord" ADD CONSTRAINT "Concentration_min_le_max" CHECK ("minValue" IS NULL OR "maxValue" IS NULL OR "minValue" <= "maxValue");
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_confidence_range" CHECK ("confidence" >= 0 AND "confidence" <= 1);
ALTER TABLE "ProductIngredient" ADD CONSTRAINT "ProductIngredient_position_positive" CHECK ("position" >= 1);
