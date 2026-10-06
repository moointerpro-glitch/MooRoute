-- Phase 8 review: planning history reads audit rows by entityId only; the existing index leads with entityType.
CREATE INDEX `AuditLog_entityId_createdAt_idx` ON `AuditLog`(`entityId`, `createdAt`);
