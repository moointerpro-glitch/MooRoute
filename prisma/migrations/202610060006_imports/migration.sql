-- Additive Phase 7 staged-import metadata. Source rows and batch history become immutable.
ALTER TABLE `ImportBatch`
  ADD `kind` VARCHAR(32) NOT NULL DEFAULT 'branches',
  ADD `headers` JSON NULL,
  ADD `mapping` JSON NULL,
  ADD `summary` JSON NULL,
  ADD `rowCount` INTEGER NOT NULL DEFAULT 0,
  ADD `rejectionReason` VARCHAR(500) NULL,
  ADD `version` INTEGER NOT NULL DEFAULT 1,
  ADD `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD INDEX `ImportBatch_createdAt_idx`(`createdAt`),
  ADD CONSTRAINT `ImportBatch_kind_valid` CHECK (`kind` IN ('branches', 'vehicles', 'schedule'));

ALTER TABLE `ImportRow`
  ADD `decision` VARCHAR(16) NULL,
  ADD CONSTRAINT `ImportRow_decision_valid` CHECK (`decision` IS NULL OR `decision` IN ('UPDATE', 'SKIP'));

CREATE TRIGGER `ImportBatch_history` BEFORE UPDATE ON `ImportBatch` FOR EACH ROW
BEGIN
  IF NOT (NEW.id <=> OLD.id) OR NOT (NEW.sourceHash <=> OLD.sourceHash) OR NOT (NEW.sourceName <=> OLD.sourceName)
     OR NOT (NEW.sourceEdition <=> OLD.sourceEdition) OR NOT (NEW.kind <=> OLD.kind) OR NOT (NEW.createdById <=> OLD.createdById)
     OR NOT (NEW.createdAt <=> OLD.createdAt) OR NOT (NEW.headers <=> OLD.headers) OR NOT (NEW.rowCount <=> OLD.rowCount)
     OR OLD.status IN ('COMMITTED', 'REJECTED') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';
  END IF;
END;
CREATE TRIGGER `ImportBatch_no_delete` BEFORE DELETE ON `ImportBatch` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';
CREATE TRIGGER `ImportRow_no_delete` BEFORE DELETE ON `ImportRow` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';
CREATE TRIGGER `ImportRow_staged_insert` BEFORE INSERT ON `ImportRow` FOR EACH ROW
BEGIN
  IF (SELECT status FROM ImportBatch WHERE id = NEW.batchId) <> 'STAGED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';
  END IF;
END;
CREATE TRIGGER `ImportRow_source_frozen` BEFORE UPDATE ON `ImportRow` FOR EACH ROW
BEGIN
  IF NOT (NEW.id <=> OLD.id) OR NOT (NEW.batchId <=> OLD.batchId) OR NOT (NEW.rowNumber <=> OLD.rowNumber) OR NOT (NEW.raw <=> OLD.raw)
     OR (SELECT status FROM ImportBatch WHERE id = OLD.batchId) IN ('COMMITTED', 'REJECTED') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';
  END IF;
END;
