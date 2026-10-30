-- Organization of the acting principal, so customer organizations can be limited to their own audit entries.
ALTER TABLE "AuditLog" ADD COLUMN "organizationId" UUID;
CREATE INDEX "AuditLog_organizationId_at_idx" ON "AuditLog"("organizationId", "at");
