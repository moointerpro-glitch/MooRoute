-- D220 (2026-10-07): additive only. No existing table or row is changed.
-- 1. UserProfile: self-service contact phone and default source warehouse, kept apart from User so the web
--    account never needs UPDATE rights on User (which holds the auth-critical `active` flag).
-- 2. Unit and IssueType: consignment units and issue types become managed master data instead of fixed code.
--    They are seeded with exactly the codes already used, so every existing record stays valid.

-- CreateTable
CREATE TABLE `UserProfile` (
    `userId` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `phone` VARCHAR(32) NULL,
    `defaultWarehouseId` VARCHAR(36) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserProfile_defaultWarehouseId_idx`(`defaultWarehouseId`),
    PRIMARY KEY (`userId`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Unit` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `usage` ENUM('ITEM', 'WEIGHT', 'BOTH') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Unit_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `IssueType` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `IssueType_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `UserProfile` ADD CONSTRAINT `UserProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `UserProfile` ADD CONSTRAINT `UserProfile_defaultWarehouseId_fkey` FOREIGN KEY (`defaultWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Seed the codes previously fixed in src/server/domain/consignment.ts (itemUnits, weightUnits, issueTypes).
INSERT INTO `Unit` (`id`, `code`, `name`, `usage`) VALUES
  ('unit-piece', 'PIECE', 'ชิ้น', 'ITEM'), ('unit-sheet', 'SHEET', 'แผ่น', 'ITEM'), ('unit-box', 'BOX', 'กล่อง', 'ITEM'),
  ('unit-pack', 'PACK', 'แพ็ก', 'ITEM'), ('unit-set', 'SET', 'ชุด', 'ITEM'), ('unit-roll', 'ROLL', 'ม้วน', 'ITEM'),
  ('unit-bottle', 'BOTTLE', 'ขวด', 'ITEM'), ('unit-bag', 'BAG', 'ถุง', 'ITEM'), ('unit-unit', 'UNIT', 'เครื่อง', 'ITEM'),
  ('unit-kg', 'KG', 'กิโลกรัม', 'BOTH');
INSERT INTO `IssueType` (`id`, `code`, `name`) VALUES
  ('issue-shortage', 'SHORTAGE', 'ของขาด'), ('issue-damage', 'DAMAGE', 'ของเสียหาย'), ('issue-wrong-item', 'WRONG_ITEM', 'ของไม่ตรงรายการ'),
  ('issue-delay', 'DELAY', 'ล่าช้า'), ('issue-other', 'OTHER', 'อื่น ๆ');
