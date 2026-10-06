-- Additive Phase 6 consignment lifecycle metadata. Existing rows, migrations and history remain intact.
ALTER TABLE `Consignment`
  ADD `requestedServiceDate` DATE NULL,
  ADD `requestedRoundNo` INTEGER NULL,
  ADD `requestedTripId` VARCHAR(36) NULL,
  ADD `senderName` VARCHAR(191) NULL,
  ADD `senderPhone` VARCHAR(32) NULL,
  ADD `recipientName` VARCHAR(191) NULL,
  ADD `recipientPhone` VARCHAR(32) NULL,
  ADD `notes` VARCHAR(1000) NULL,
  ADD `packageCount` INTEGER NOT NULL DEFAULT 0,
  ADD `packageWeight` DECIMAL(14, 3) NULL,
  ADD `packageWeightUnit` VARCHAR(32) NULL,
  ADD `draftItems` JSON NULL,
  ADD `resumeStatus` ENUM('DRAFT', 'PENDING_REVIEW', 'REJECTED', 'ASSIGNED', 'WAREHOUSE_RECEIVED', 'LOADED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'ISSUE', 'RECEIVED', 'CLOSED', 'CANCELLED', 'RETURNED') NULL,
  ADD `submittedAt` DATETIME(3) NULL,
  ADD `closedAt` DATETIME(3) NULL,
  ADD INDEX `Consignment_status_createdAt_idx`(`status`, `createdAt`),
  ADD INDEX `Consignment_requestedServiceDate_idx`(`requestedServiceDate`),
  ADD INDEX `Consignment_requestedTripId_idx`(`requestedTripId`),
  ADD CONSTRAINT `Consignment_requestedTripId_fkey` FOREIGN KEY (`requestedTripId`) REFERENCES `Trip`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT `Consignment_request_valid` CHECK (
    (`requestedRoundNo` IS NULL OR `requestedRoundNo` BETWEEN 1 AND 3)
    AND `packageCount` BETWEEN 0 AND 500
    AND ((`packageWeight` IS NULL AND `packageWeightUnit` IS NULL) OR (`packageWeight` > 0 AND CHAR_LENGTH(`packageWeightUnit`) > 0))
    AND (`resumeStatus` IS NULL OR `status` = 'ISSUE'));

ALTER TABLE `ConsignmentEvent` MODIFY `kind` ENUM('SUBMITTED', 'ASSIGNED', 'WAREHOUSE_RECEIVED', 'LOADED', 'DEPARTED', 'RECEIPT', 'ISSUE', 'CORRECTION', 'RETURNED', 'CLOSED', 'CANCELLED', 'REJECTED', 'ISSUE_RESOLVED') NOT NULL;

-- Returned quantities and packages are a separate append-only ledger from receipts.
CREATE TABLE `ReturnLine` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `eventId` VARCHAR(36) NOT NULL,
    `consignmentId` VARCHAR(36) NOT NULL,
    `itemId` VARCHAR(36) NULL,
    `packageId` VARCHAR(36) NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `unit` VARCHAR(32) NOT NULL,
    `note` VARCHAR(500) NULL,

    UNIQUE INDEX `ReturnLine_packageId_key`(`packageId`),
    INDEX `ReturnLine_itemId_eventId_idx`(`itemId`, `eventId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `ReturnLine` ADD CONSTRAINT `ReturnLine_eventId_consignmentId_fkey` FOREIGN KEY (`eventId`, `consignmentId`) REFERENCES `ConsignmentEvent`(`id`, `consignmentId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `ReturnLine` ADD CONSTRAINT `ReturnLine_consignmentId_fkey` FOREIGN KEY (`consignmentId`) REFERENCES `Consignment`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `ReturnLine` ADD CONSTRAINT `ReturnLine_itemId_consignmentId_fkey` FOREIGN KEY (`itemId`, `consignmentId`) REFERENCES `ConsignmentItem`(`id`, `consignmentId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `ReturnLine` ADD CONSTRAINT `ReturnLine_packageId_consignmentId_fkey` FOREIGN KEY (`packageId`, `consignmentId`) REFERENCES `ConsignmentPackage`(`id`, `consignmentId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `ReturnLine` ADD CONSTRAINT `ReturnLine_valid` CHECK (quantity > 0 AND ((itemId IS NOT NULL AND packageId IS NULL) OR (itemId IS NULL AND packageId IS NOT NULL AND quantity = 1 AND unit = 'PACKAGE')));
CREATE TRIGGER `ReturnLine_no_update` BEFORE UPDATE ON `ReturnLine` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';
CREATE TRIGGER `ReturnLine_no_delete` BEFORE DELETE ON `ReturnLine` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

-- The submitted request is frozen: only lifecycle columns may change after DRAFT.
CREATE TRIGGER `Consignment_request_frozen` BEFORE UPDATE ON `Consignment` FOR EACH ROW
BEGIN
  IF NOT (NEW.id <=> OLD.id) OR NOT (NEW.code <=> OLD.code) OR NOT (NEW.requesterId <=> OLD.requesterId) OR NOT (NEW.createdAt <=> OLD.createdAt)
     OR (OLD.status <> 'DRAFT' AND (
       NOT (NEW.departmentId <=> OLD.departmentId) OR NOT (NEW.sourceWarehouseId <=> OLD.sourceWarehouseId)
       OR NOT (NEW.destinationBranchId <=> OLD.destinationBranchId) OR NOT (NEW.receiptMode <=> OLD.receiptMode)
       OR NOT (NEW.requestedServiceDate <=> OLD.requestedServiceDate) OR NOT (NEW.requestedRoundNo <=> OLD.requestedRoundNo)
       OR NOT (NEW.requestedTripId <=> OLD.requestedTripId) OR NOT (NEW.senderName <=> OLD.senderName)
       OR NOT (NEW.senderPhone <=> OLD.senderPhone) OR NOT (NEW.recipientName <=> OLD.recipientName)
       OR NOT (NEW.recipientPhone <=> OLD.recipientPhone) OR NOT (NEW.notes <=> OLD.notes)
       OR NOT (NEW.packageCount <=> OLD.packageCount) OR NOT (NEW.packageWeight <=> OLD.packageWeight)
       OR NOT (NEW.packageWeightUnit <=> OLD.packageWeightUnit) OR NOT (NEW.draftItems <=> OLD.draftItems)
       OR NOT (NEW.submittedAt <=> OLD.submittedAt)))
     OR (OLD.status IN ('CLOSED', 'CANCELLED', 'REJECTED') AND NOT (NEW.status <=> OLD.status)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';
  END IF;
END;

-- Warehouses and departments become versioned administrable masters.
ALTER TABLE `Warehouse` ADD `version` INTEGER NOT NULL DEFAULT 1, ADD `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
ALTER TABLE `Department` ADD `version` INTEGER NOT NULL DEFAULT 1, ADD `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- Consignment categories named in the confirmed requirements; separate from food ProductCategory.
INSERT IGNORE INTO `ConsignmentCategory` (`id`, `code`, `name`, `active`, `version`, `updatedAt`) VALUES
  (UUID(), 'MARKETING', 'สื่อการตลาด', 1, 1, CURRENT_TIMESTAMP(3)),
  (UUID(), 'DOCUMENT', 'เอกสาร', 1, 1, CURRENT_TIMESTAMP(3)),
  (UUID(), 'EQUIPMENT', 'อุปกรณ์', 1, 1, CURRENT_TIMESTAMP(3));
