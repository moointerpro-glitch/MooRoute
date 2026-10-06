-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `subject` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_subject_key`(`subject`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Role_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,

    UNIQUE INDEX `Permission_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(36) NOT NULL,
    `roleId` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `UserRole_userId_roleId_key`(`userId`, `roleId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `roleId` VARCHAR(36) NOT NULL,
    `permissionId` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `RolePermission_roleId_permissionId_key`(`roleId`, `permissionId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Department_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Warehouse` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` TEXT NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Warehouse_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `UserScope` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(36) NOT NULL,
    `kind` ENUM('GLOBAL', 'BRANCH', 'DEPARTMENT', 'WAREHOUSE') NOT NULL,
    `branchId` VARCHAR(36) NULL,
    `departmentId` VARCHAR(36) NULL,
    `warehouseId` VARCHAR(36) NULL,

    INDEX `UserScope_userId_kind_idx`(`userId`, `kind`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `EligibilityGuard` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `key` VARCHAR(32) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `EligibilityGuard_key_key`(`key`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Branch` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `destinationType` ENUM('BRANCH', 'DC', 'FACTORY') NOT NULL DEFAULT 'BRANCH',
    `addressLine` VARCHAR(500) NOT NULL,
    `subdistrict` VARCHAR(100) NOT NULL,
    `district` VARCHAR(100) NOT NULL,
    `province` VARCHAR(100) NOT NULL,
    `postalCode` VARCHAR(10) NOT NULL,
    `contactName` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(32) NULL,
    `receivingFromMinute` INTEGER NULL,
    `receivingToMinute` INTEGER NULL,
    `activeFrom` DATE NOT NULL,
    `activeTo` DATE NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Branch_code_key`(`code`),
    INDEX `Branch_destinationType_activeFrom_activeTo_idx`(`destinationType`, `activeFrom`, `activeTo`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `BranchAlias` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `branchId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    INDEX `BranchAlias_name_idx`(`name`),
    UNIQUE INDEX `BranchAlias_branchId_name_key`(`branchId`, `name`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `VehicleType` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `wheelCount` INTEGER NOT NULL,

    UNIQUE INDEX `VehicleType_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `StorageCondition` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `StorageCondition_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Vehicle` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `plateNormalized` VARCHAR(32) NOT NULL,
    `province` VARCHAR(100) NOT NULL,
    `typeId` VARCHAR(36) NOT NULL,
    `storageConditionId` VARCHAR(36) NOT NULL,
    `brand` VARCHAR(100) NULL,
    `model` VARCHAR(100) NULL,
    `color` VARCHAR(64) NULL,
    `bodyDescription` VARCHAR(191) NULL,
    `ownerName` VARCHAR(191) NULL,
    `capacity` DECIMAL(14, 3) NULL,
    `capacityUnit` VARCHAR(32) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `availableFrom` DATETIME(3) NULL,
    `availableTo` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Vehicle_plateNormalized_province_key`(`plateNormalized`, `province`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Driver` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Driver_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ProductCategory` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(36) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `ProductCategory_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ConsignmentCategory` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `ConsignmentCategory_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Route` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `Route_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `RouteRevision` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `routeId` VARCHAR(36) NOT NULL,
    `number` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `createdById` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `RouteRevision_routeId_number_key`(`routeId`, `number`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `RouteStop` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `routeRevisionId` VARCHAR(36) NOT NULL,
    `branchId` VARCHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,

    UNIQUE INDEX `RouteStop_routeRevisionId_sequence_key`(`routeRevisionId`, `sequence`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ScheduleTemplate` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `ScheduleTemplate_code_key`(`code`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `TemplateRevision` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `templateId` VARCHAR(36) NOT NULL,
    `number` INTEGER NOT NULL,
    `routeRevisionId` VARCHAR(36) NOT NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `roundNo` INTEGER NOT NULL,
    `loadingMinute` INTEGER NULL,
    `departureMinute` INTEGER NULL,
    `arrivalMinute` INTEGER NULL,
    `createdById` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `TemplateRevision_templateId_number_key`(`templateId`, `number`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `TemplateWeekday` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `templateRevisionId` VARCHAR(36) NOT NULL,
    `weekday` INTEGER NOT NULL,

    UNIQUE INDEX `TemplateWeekday_templateRevisionId_weekday_key`(`templateRevisionId`, `weekday`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `TemplateStopCategory` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `templateRevisionId` VARCHAR(36) NOT NULL,
    `routeStopId` VARCHAR(36) NOT NULL,
    `categoryId` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `TemplateStopCategory_templateRevisionId_routeStopId_category_key`(`templateRevisionId`, `routeStopId`, `categoryId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `DailyPlan` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `serviceDate` DATE NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `publishedRevisionId` VARCHAR(36) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DailyPlan_serviceDate_key`(`serviceDate`),
    UNIQUE INDEX `DailyPlan_publishedRevisionId_key`(`publishedRevisionId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `PlanRevision` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `planId` VARCHAR(36) NOT NULL,
    `number` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
    `eligibilityVersion` INTEGER NULL,
    `createdById` VARCHAR(36) NOT NULL,
    `publishedById` VARCHAR(36) NULL,
    `publishedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PlanRevision_planId_number_key`(`planId`, `number`),
    UNIQUE INDEX `PlanRevision_id_planId_key`(`id`, `planId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `PlanBranch` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `planRevisionId` VARCHAR(36) NOT NULL,
    `branchId` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `PlanBranch_planRevisionId_branchId_key`(`planRevisionId`, `branchId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Trip` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `planId` VARCHAR(36) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `Trip_code_key`(`code`),
    UNIQUE INDEX `Trip_id_planId_key`(`id`, `planId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `TripRevision` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tripId` VARCHAR(36) NOT NULL,
    `planId` VARCHAR(36) NOT NULL,
    `planRevisionId` VARCHAR(36) NOT NULL,
    `templateRevisionId` VARCHAR(36) NULL,
    `routeRevisionId` VARCHAR(36) NULL,
    `kind` ENUM('BRANCH_DELIVERY', 'INBOUND_DC', 'OTHER') NOT NULL DEFAULT 'BRANCH_DELIVERY',
    `roundNo` INTEGER NULL,
    `cancelled` BOOLEAN NOT NULL DEFAULT false,
    `vehicleId` VARCHAR(36) NULL,
    `driverId` VARCHAR(36) NULL,
    `loadingAt` DATETIME(3) NULL,
    `departureAt` DATETIME(3) NULL,
    `arrivalAt` DATETIME(3) NULL,
    `occupancyStart` DATETIME(3) NULL,
    `occupancyEnd` DATETIME(3) NULL,
    `bufferMinutes` INTEGER NOT NULL DEFAULT 0,

    INDEX `TripRevision_planRevisionId_departureAt_tripId_idx`(`planRevisionId`, `departureAt`, `tripId`),
    UNIQUE INDEX `TripRevision_planRevisionId_tripId_key`(`planRevisionId`, `tripId`),
    UNIQUE INDEX `TripRevision_id_tripId_key`(`id`, `tripId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `TripStop` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tripRevisionId` VARCHAR(36) NOT NULL,
    `branchId` VARCHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `nameSnapshot` VARCHAR(191) NOT NULL,
    `arrivalAt` DATETIME(3) NULL,

    INDEX `TripStop_branchId_tripRevisionId_idx`(`branchId`, `tripRevisionId`),
    UNIQUE INDEX `TripStop_tripRevisionId_sequence_key`(`tripRevisionId`, `sequence`),
    UNIQUE INDEX `TripStop_id_tripRevisionId_key`(`id`, `tripRevisionId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `TripStopCategory` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `stopId` VARCHAR(36) NOT NULL,
    `categoryId` VARCHAR(36) NOT NULL,

    INDEX `TripStopCategory_categoryId_stopId_idx`(`categoryId`, `stopId`),
    UNIQUE INDEX `TripStopCategory_stopId_categoryId_key`(`stopId`, `categoryId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `VehicleReservation` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `vehicleId` VARCHAR(36) NOT NULL,
    `tripRevisionId` VARCHAR(36) NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `bufferMinutes` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `releasedAt` DATETIME(3) NULL,

    INDEX `VehicleReservation_vehicleId_active_startAt_endAt_idx`(`vehicleId`, `active`, `startAt`, `endAt`),
    UNIQUE INDEX `VehicleReservation_tripRevisionId_key`(`tripRevisionId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Consignment` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `code` VARCHAR(64) NOT NULL,
    `requesterId` VARCHAR(36) NOT NULL,
    `departmentId` VARCHAR(36) NOT NULL,
    `sourceWarehouseId` VARCHAR(36) NOT NULL,
    `destinationBranchId` VARCHAR(36) NOT NULL,
    `receiptMode` ENUM('PACKAGES', 'DETAILED') NOT NULL DEFAULT 'PACKAGES',
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'REJECTED', 'ASSIGNED', 'WAREHOUSE_RECEIVED', 'LOADED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'ISSUE', 'RECEIVED', 'CLOSED', 'CANCELLED', 'RETURNED') NOT NULL DEFAULT 'DRAFT',
    `currentAssignmentId` VARCHAR(36) NULL,
    `hasOpenIssue` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Consignment_code_key`(`code`),
    UNIQUE INDEX `Consignment_currentAssignmentId_key`(`currentAssignmentId`),
    INDEX `Consignment_destinationBranchId_status_createdAt_idx`(`destinationBranchId`, `status`, `createdAt`),
    INDEX `Consignment_requesterId_createdAt_idx`(`requesterId`, `createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ConsignmentItem` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `consignmentId` VARCHAR(36) NOT NULL,
    `categoryId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sentQuantity` DECIMAL(14, 3) NOT NULL,
    `unit` VARCHAR(32) NOT NULL,

    UNIQUE INDEX `ConsignmentItem_id_consignmentId_key`(`id`, `consignmentId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ConsignmentPackage` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `consignmentId` VARCHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `total` INTEGER NOT NULL,
    `weight` DECIMAL(14, 3) NULL,
    `weightUnit` VARCHAR(32) NULL,
    `custody` ENUM('SENDER', 'WAREHOUSE', 'VEHICLE', 'BRANCH', 'RETURNED') NOT NULL DEFAULT 'SENDER',

    UNIQUE INDEX `ConsignmentPackage_consignmentId_sequence_key`(`consignmentId`, `sequence`),
    UNIQUE INDEX `ConsignmentPackage_id_consignmentId_key`(`id`, `consignmentId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `AddressSnapshot` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `branchId` VARCHAR(36) NULL,
    `payload` JSON NOT NULL,
    `createdById` VARCHAR(36) NOT NULL,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ConsignmentAssignment` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `consignmentId` VARCHAR(36) NOT NULL,
    `tripId` VARCHAR(36) NOT NULL,
    `tripRevisionId` VARCHAR(36) NOT NULL,
    `stopId` VARCHAR(36) NOT NULL,
    `senderSnapshotId` VARCHAR(36) NOT NULL,
    `recipientSnapshotId` VARCHAR(36) NOT NULL,
    `transportSnapshot` JSON NOT NULL,
    `previousAssignmentId` VARCHAR(36) NULL,
    `reason` VARCHAR(500) NOT NULL,
    `approvedById` VARCHAR(36) NOT NULL,
    `approvedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConsignmentAssignment_previousAssignmentId_key`(`previousAssignmentId`),
    INDEX `ConsignmentAssignment_tripId_consignmentId_idx`(`tripId`, `consignmentId`),
    UNIQUE INDEX `ConsignmentAssignment_id_consignmentId_key`(`id`, `consignmentId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `IdempotencyRecord` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorId` VARCHAR(36) NOT NULL,
    `operation` VARCHAR(64) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `response` JSON NULL,

    UNIQUE INDEX `IdempotencyRecord_actorId_operation_key_key`(`actorId`, `operation`, `key`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ConsignmentEvent` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `consignmentId` VARCHAR(36) NOT NULL,
    `actorId` VARCHAR(36) NOT NULL,
    `kind` ENUM('SUBMITTED', 'ASSIGNED', 'WAREHOUSE_RECEIVED', 'LOADED', 'DEPARTED', 'RECEIPT', 'ISSUE', 'CORRECTION', 'RETURNED', 'CLOSED', 'CANCELLED') NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `payload` JSON NOT NULL,
    `idempotencyId` VARCHAR(36) NULL,
    `compensatesEventId` VARCHAR(36) NULL,

    INDEX `ConsignmentEvent_consignmentId_occurredAt_id_idx`(`consignmentId`, `occurredAt`, `id`),
    UNIQUE INDEX `ConsignmentEvent_id_consignmentId_key`(`id`, `consignmentId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ReceiptLine` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `eventId` VARCHAR(36) NOT NULL,
    `consignmentId` VARCHAR(36) NOT NULL,
    `itemId` VARCHAR(36) NULL,
    `packageId` VARCHAR(36) NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `unit` VARCHAR(32) NOT NULL,
    `note` VARCHAR(500) NULL,

    UNIQUE INDEX `ReceiptLine_packageId_key`(`packageId`),
    INDEX `ReceiptLine_itemId_eventId_idx`(`itemId`, `eventId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Attachment` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `consignmentId` VARCHAR(36) NOT NULL,
    `uploaderId` VARCHAR(36) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `contentType` VARCHAR(64) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `accessClass` VARCHAR(32) NOT NULL DEFAULT 'PRIVATE',
    `retainedUntil` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Attachment_storageKey_key`(`storageKey`),
    INDEX `Attachment_consignmentId_createdAt_idx`(`consignmentId`, `createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `LabelVersion` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignmentId` VARCHAR(36) NOT NULL,
    `number` INTEGER NOT NULL,
    `lookupToken` VARCHAR(64) NOT NULL,
    `payload` JSON NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `revocationReason` VARCHAR(500) NULL,

    UNIQUE INDEX `LabelVersion_lookupToken_key`(`lookupToken`),
    UNIQUE INDEX `LabelVersion_assignmentId_number_key`(`assignmentId`, `number`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `LabelPackage` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `labelVersionId` VARCHAR(36) NOT NULL,
    `packageId` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `LabelPackage_labelVersionId_packageId_key`(`labelVersionId`, `packageId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `PrintEvent` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `labelVersionId` VARCHAR(36) NOT NULL,
    `actorId` VARCHAR(36) NOT NULL,
    `format` VARCHAR(32) NOT NULL,
    `copies` INTEGER NOT NULL,
    `reason` VARCHAR(500) NULL,

    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ImportBatch` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sourceHash` CHAR(64) NOT NULL,
    `sourceName` VARCHAR(191) NOT NULL,
    `sourceEdition` VARCHAR(100) NOT NULL,
    `status` ENUM('STAGED', 'VALIDATED', 'COMMITTED', 'REJECTED') NOT NULL DEFAULT 'STAGED',
    `createdById` VARCHAR(36) NOT NULL,
    `committedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ImportBatch_sourceHash_sourceEdition_key`(`sourceHash`, `sourceEdition`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ImportRow` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `batchId` VARCHAR(36) NOT NULL,
    `rowNumber` INTEGER NOT NULL,
    `raw` JSON NOT NULL,
    `validation` JSON NOT NULL,
    `resolvedEntityId` VARCHAR(36) NULL,

    UNIQUE INDEX `ImportRow_batchId_rowNumber_key`(`batchId`, `rowNumber`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorId` VARCHAR(36) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `entityType` VARCHAR(64) NOT NULL,
    `entityId` VARCHAR(36) NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `reason` VARCHAR(500) NULL,
    `idempotencyId` VARCHAR(36) NULL,

    INDEX `AuditLog_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `SeedManifest` (
    `id` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `key` VARCHAR(100) NOT NULL,
    `version` INTEGER NOT NULL,
    `checksum` CHAR(64) NOT NULL,
    `payload` JSON NOT NULL,

    UNIQUE INDEX `SeedManifest_key_key`(`key`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `UserScope` ADD CONSTRAINT `UserScope_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `UserScope` ADD CONSTRAINT `UserScope_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `UserScope` ADD CONSTRAINT `UserScope_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `UserScope` ADD CONSTRAINT `UserScope_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `BranchAlias` ADD CONSTRAINT `BranchAlias_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `VehicleType`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_storageConditionId_fkey` FOREIGN KEY (`storageConditionId`) REFERENCES `StorageCondition`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ProductCategory` ADD CONSTRAINT `ProductCategory_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ProductCategory`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RouteRevision` ADD CONSTRAINT `RouteRevision_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `Route`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RouteRevision` ADD CONSTRAINT `RouteRevision_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RouteStop` ADD CONSTRAINT `RouteStop_routeRevisionId_fkey` FOREIGN KEY (`routeRevisionId`) REFERENCES `RouteRevision`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RouteStop` ADD CONSTRAINT `RouteStop_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TemplateRevision` ADD CONSTRAINT `TemplateRevision_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ScheduleTemplate`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TemplateRevision` ADD CONSTRAINT `TemplateRevision_routeRevisionId_fkey` FOREIGN KEY (`routeRevisionId`) REFERENCES `RouteRevision`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TemplateRevision` ADD CONSTRAINT `TemplateRevision_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TemplateWeekday` ADD CONSTRAINT `TemplateWeekday_templateRevisionId_fkey` FOREIGN KEY (`templateRevisionId`) REFERENCES `TemplateRevision`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TemplateStopCategory` ADD CONSTRAINT `TemplateStopCategory_templateRevisionId_fkey` FOREIGN KEY (`templateRevisionId`) REFERENCES `TemplateRevision`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TemplateStopCategory` ADD CONSTRAINT `TemplateStopCategory_routeStopId_fkey` FOREIGN KEY (`routeStopId`) REFERENCES `RouteStop`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TemplateStopCategory` ADD CONSTRAINT `TemplateStopCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ProductCategory`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `DailyPlan` ADD CONSTRAINT `DailyPlan_publishedRevisionId_id_fkey` FOREIGN KEY (`publishedRevisionId`, `id`) REFERENCES `PlanRevision`(`id`, `planId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PlanRevision` ADD CONSTRAINT `PlanRevision_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `DailyPlan`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PlanRevision` ADD CONSTRAINT `PlanRevision_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PlanRevision` ADD CONSTRAINT `PlanRevision_publishedById_fkey` FOREIGN KEY (`publishedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PlanBranch` ADD CONSTRAINT `PlanBranch_planRevisionId_fkey` FOREIGN KEY (`planRevisionId`) REFERENCES `PlanRevision`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PlanBranch` ADD CONSTRAINT `PlanBranch_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Trip` ADD CONSTRAINT `Trip_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `DailyPlan`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TripRevision` ADD CONSTRAINT `TripRevision_tripId_planId_fkey` FOREIGN KEY (`tripId`, `planId`) REFERENCES `Trip`(`id`, `planId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TripRevision` ADD CONSTRAINT `TripRevision_planRevisionId_planId_fkey` FOREIGN KEY (`planRevisionId`, `planId`) REFERENCES `PlanRevision`(`id`, `planId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TripRevision` ADD CONSTRAINT `TripRevision_templateRevisionId_fkey` FOREIGN KEY (`templateRevisionId`) REFERENCES `TemplateRevision`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TripRevision` ADD CONSTRAINT `TripRevision_routeRevisionId_fkey` FOREIGN KEY (`routeRevisionId`) REFERENCES `RouteRevision`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TripRevision` ADD CONSTRAINT `TripRevision_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TripRevision` ADD CONSTRAINT `TripRevision_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TripStop` ADD CONSTRAINT `TripStop_tripRevisionId_fkey` FOREIGN KEY (`tripRevisionId`) REFERENCES `TripRevision`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TripStop` ADD CONSTRAINT `TripStop_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TripStopCategory` ADD CONSTRAINT `TripStopCategory_stopId_fkey` FOREIGN KEY (`stopId`) REFERENCES `TripStop`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TripStopCategory` ADD CONSTRAINT `TripStopCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ProductCategory`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `VehicleReservation` ADD CONSTRAINT `VehicleReservation_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `VehicleReservation` ADD CONSTRAINT `VehicleReservation_tripRevisionId_fkey` FOREIGN KEY (`tripRevisionId`) REFERENCES `TripRevision`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Consignment` ADD CONSTRAINT `Consignment_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Consignment` ADD CONSTRAINT `Consignment_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Consignment` ADD CONSTRAINT `Consignment_sourceWarehouseId_fkey` FOREIGN KEY (`sourceWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Consignment` ADD CONSTRAINT `Consignment_destinationBranchId_fkey` FOREIGN KEY (`destinationBranchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Consignment` ADD CONSTRAINT `Consignment_currentAssignmentId_id_fkey` FOREIGN KEY (`currentAssignmentId`, `id`) REFERENCES `ConsignmentAssignment`(`id`, `consignmentId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentItem` ADD CONSTRAINT `ConsignmentItem_consignmentId_fkey` FOREIGN KEY (`consignmentId`) REFERENCES `Consignment`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentItem` ADD CONSTRAINT `ConsignmentItem_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ConsignmentCategory`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentPackage` ADD CONSTRAINT `ConsignmentPackage_consignmentId_fkey` FOREIGN KEY (`consignmentId`) REFERENCES `Consignment`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `AddressSnapshot` ADD CONSTRAINT `AddressSnapshot_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `AddressSnapshot` ADD CONSTRAINT `AddressSnapshot_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentAssignment` ADD CONSTRAINT `ConsignmentAssignment_consignmentId_fkey` FOREIGN KEY (`consignmentId`) REFERENCES `Consignment`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentAssignment` ADD CONSTRAINT `ConsignmentAssignment_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentAssignment` ADD CONSTRAINT `ConsignmentAssignment_tripRevisionId_tripId_fkey` FOREIGN KEY (`tripRevisionId`, `tripId`) REFERENCES `TripRevision`(`id`, `tripId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentAssignment` ADD CONSTRAINT `ConsignmentAssignment_stopId_tripRevisionId_fkey` FOREIGN KEY (`stopId`, `tripRevisionId`) REFERENCES `TripStop`(`id`, `tripRevisionId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentAssignment` ADD CONSTRAINT `ConsignmentAssignment_senderSnapshotId_fkey` FOREIGN KEY (`senderSnapshotId`) REFERENCES `AddressSnapshot`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentAssignment` ADD CONSTRAINT `ConsignmentAssignment_recipientSnapshotId_fkey` FOREIGN KEY (`recipientSnapshotId`) REFERENCES `AddressSnapshot`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentAssignment` ADD CONSTRAINT `ConsignmentAssignment_previousAssignmentId_fkey` FOREIGN KEY (`previousAssignmentId`) REFERENCES `ConsignmentAssignment`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentAssignment` ADD CONSTRAINT `ConsignmentAssignment_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `IdempotencyRecord` ADD CONSTRAINT `IdempotencyRecord_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentEvent` ADD CONSTRAINT `ConsignmentEvent_consignmentId_fkey` FOREIGN KEY (`consignmentId`) REFERENCES `Consignment`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentEvent` ADD CONSTRAINT `ConsignmentEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentEvent` ADD CONSTRAINT `ConsignmentEvent_idempotencyId_fkey` FOREIGN KEY (`idempotencyId`) REFERENCES `IdempotencyRecord`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ConsignmentEvent` ADD CONSTRAINT `ConsignmentEvent_compensatesEventId_fkey` FOREIGN KEY (`compensatesEventId`) REFERENCES `ConsignmentEvent`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ReceiptLine` ADD CONSTRAINT `ReceiptLine_eventId_consignmentId_fkey` FOREIGN KEY (`eventId`, `consignmentId`) REFERENCES `ConsignmentEvent`(`id`, `consignmentId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ReceiptLine` ADD CONSTRAINT `ReceiptLine_consignmentId_fkey` FOREIGN KEY (`consignmentId`) REFERENCES `Consignment`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ReceiptLine` ADD CONSTRAINT `ReceiptLine_itemId_consignmentId_fkey` FOREIGN KEY (`itemId`, `consignmentId`) REFERENCES `ConsignmentItem`(`id`, `consignmentId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ReceiptLine` ADD CONSTRAINT `ReceiptLine_packageId_consignmentId_fkey` FOREIGN KEY (`packageId`, `consignmentId`) REFERENCES `ConsignmentPackage`(`id`, `consignmentId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_consignmentId_fkey` FOREIGN KEY (`consignmentId`) REFERENCES `Consignment`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_uploaderId_fkey` FOREIGN KEY (`uploaderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `LabelVersion` ADD CONSTRAINT `LabelVersion_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `ConsignmentAssignment`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `LabelPackage` ADD CONSTRAINT `LabelPackage_labelVersionId_fkey` FOREIGN KEY (`labelVersionId`) REFERENCES `LabelVersion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `LabelPackage` ADD CONSTRAINT `LabelPackage_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `ConsignmentPackage`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PrintEvent` ADD CONSTRAINT `PrintEvent_labelVersionId_fkey` FOREIGN KEY (`labelVersionId`) REFERENCES `LabelVersion`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PrintEvent` ADD CONSTRAINT `PrintEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ImportBatch` ADD CONSTRAINT `ImportBatch_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ImportRow` ADD CONSTRAINT `ImportRow_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `ImportBatch`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_idempotencyId_fkey` FOREIGN KEY (`idempotencyId`) REFERENCES `IdempotencyRecord`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;


ALTER TABLE `UserScope` ADD CONSTRAINT `UserScope_valid` CHECK ((kind = 'GLOBAL' AND branchId IS NULL AND departmentId IS NULL AND warehouseId IS NULL) OR (kind = 'BRANCH' AND branchId IS NOT NULL AND departmentId IS NULL AND warehouseId IS NULL) OR (kind = 'DEPARTMENT' AND branchId IS NULL AND departmentId IS NOT NULL AND warehouseId IS NULL) OR (kind = 'WAREHOUSE' AND branchId IS NULL AND departmentId IS NULL AND warehouseId IS NOT NULL));

ALTER TABLE `Branch` ADD CONSTRAINT `Branch_valid` CHECK ((activeTo IS NULL OR activeTo >= activeFrom) AND (receivingFromMinute IS NULL OR receivingFromMinute BETWEEN 0 AND 1439) AND (receivingToMinute IS NULL OR receivingToMinute BETWEEN 0 AND 1439));

ALTER TABLE `VehicleType` ADD CONSTRAINT `VehicleType_valid` CHECK (wheelCount > 0);

ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_valid` CHECK (((capacity IS NULL AND capacityUnit IS NULL) OR (capacity > 0 AND capacityUnit IS NOT NULL)) AND (availableFrom IS NULL OR availableTo IS NULL OR availableTo > availableFrom));

ALTER TABLE `RouteRevision` ADD CONSTRAINT `RouteRevision_valid` CHECK (number > 0 AND (effectiveTo IS NULL OR effectiveTo >= effectiveFrom));

ALTER TABLE `RouteStop` ADD CONSTRAINT `RouteStop_valid` CHECK (sequence > 0);

ALTER TABLE `TemplateRevision` ADD CONSTRAINT `TemplateRevision_valid` CHECK (number > 0 AND roundNo BETWEEN 1 AND 3 AND (effectiveTo IS NULL OR effectiveTo >= effectiveFrom) AND (loadingMinute IS NULL OR loadingMinute BETWEEN 0 AND 1439) AND (departureMinute IS NULL OR departureMinute BETWEEN 0 AND 1439) AND (arrivalMinute IS NULL OR arrivalMinute BETWEEN 0 AND 1439));

ALTER TABLE `TemplateWeekday` ADD CONSTRAINT `TemplateWeekday_valid` CHECK (weekday BETWEEN 1 AND 7);

ALTER TABLE `PlanRevision` ADD CONSTRAINT `PlanRevision_valid` CHECK (number > 0);

ALTER TABLE `TripRevision` ADD CONSTRAINT `TripRevision_valid` CHECK ((kind <> 'BRANCH_DELIVERY' OR roundNo BETWEEN 1 AND 3) AND (kind <> 'BRANCH_DELIVERY' OR roundNo IS NOT NULL) AND (roundNo IS NULL OR roundNo BETWEEN 1 AND 3) AND bufferMinutes BETWEEN 0 AND 1440 AND (occupancyStart IS NULL OR occupancyEnd IS NULL OR occupancyEnd > occupancyStart) AND (loadingAt IS NULL OR departureAt IS NULL OR departureAt >= loadingAt) AND (departureAt IS NULL OR arrivalAt IS NULL OR arrivalAt >= departureAt));

ALTER TABLE `TripStop` ADD CONSTRAINT `TripStop_valid` CHECK (sequence > 0);

ALTER TABLE `VehicleReservation` ADD CONSTRAINT `VehicleReservation_valid` CHECK (endAt > startAt AND bufferMinutes BETWEEN 0 AND 1440);

ALTER TABLE `ConsignmentItem` ADD CONSTRAINT `ConsignmentItem_valid` CHECK (sentQuantity > 0 AND CHAR_LENGTH(TRIM(unit)) > 0);

ALTER TABLE `ConsignmentPackage` ADD CONSTRAINT `ConsignmentPackage_valid` CHECK (sequence > 0 AND total >= sequence AND ((weight IS NULL AND weightUnit IS NULL) OR (weight > 0 AND weightUnit IS NOT NULL)));

ALTER TABLE `ReceiptLine` ADD CONSTRAINT `ReceiptLine_valid` CHECK (quantity > 0 AND ((itemId IS NOT NULL AND packageId IS NULL) OR (itemId IS NULL AND packageId IS NOT NULL AND quantity = 1 AND unit = 'PACKAGE')));

ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_valid` CHECK (sizeBytes BETWEEN 1 AND 10485760 AND accessClass = 'PRIVATE' AND contentType IN ('image/jpeg','image/png','application/pdf'));

ALTER TABLE `LabelVersion` ADD CONSTRAINT `LabelVersion_valid` CHECK (number > 0);

ALTER TABLE `PrintEvent` ADD CONSTRAINT `PrintEvent_valid` CHECK (copies > 0);

ALTER TABLE `ImportRow` ADD CONSTRAINT `ImportRow_valid` CHECK (rowNumber > 0);
ALTER TABLE `IdempotencyRecord` MODIFY `key` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
ALTER TABLE `IdempotencyRecord` MODIFY `operation` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
ALTER TABLE `IdempotencyRecord` MODIFY `requestHash` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
ALTER TABLE `LabelVersion` MODIFY `lookupToken` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
ALTER TABLE `Attachment` MODIFY `storageKey` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;

CREATE TRIGGER `RouteRevision_no_update` BEFORE UPDATE ON `RouteRevision` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `RouteRevision_no_delete` BEFORE DELETE ON `RouteRevision` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `RouteStop_no_update` BEFORE UPDATE ON `RouteStop` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `RouteStop_no_delete` BEFORE DELETE ON `RouteStop` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `TemplateRevision_no_update` BEFORE UPDATE ON `TemplateRevision` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `TemplateRevision_no_delete` BEFORE DELETE ON `TemplateRevision` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `TemplateWeekday_no_update` BEFORE UPDATE ON `TemplateWeekday` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `TemplateWeekday_no_delete` BEFORE DELETE ON `TemplateWeekday` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `TemplateStopCategory_no_update` BEFORE UPDATE ON `TemplateStopCategory` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `TemplateStopCategory_no_delete` BEFORE DELETE ON `TemplateStopCategory` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `PlanBranch_no_update` BEFORE UPDATE ON `PlanBranch` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `PlanBranch_no_delete` BEFORE DELETE ON `PlanBranch` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `AddressSnapshot_no_update` BEFORE UPDATE ON `AddressSnapshot` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `AddressSnapshot_no_delete` BEFORE DELETE ON `AddressSnapshot` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `ConsignmentAssignment_no_update` BEFORE UPDATE ON `ConsignmentAssignment` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `ConsignmentAssignment_no_delete` BEFORE DELETE ON `ConsignmentAssignment` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `ConsignmentEvent_no_update` BEFORE UPDATE ON `ConsignmentEvent` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `ConsignmentEvent_no_delete` BEFORE DELETE ON `ConsignmentEvent` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `ReceiptLine_no_update` BEFORE UPDATE ON `ReceiptLine` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `ReceiptLine_no_delete` BEFORE DELETE ON `ReceiptLine` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `PrintEvent_no_update` BEFORE UPDATE ON `PrintEvent` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `PrintEvent_no_delete` BEFORE DELETE ON `PrintEvent` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `LabelPackage_no_update` BEFORE UPDATE ON `LabelPackage` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `LabelPackage_no_delete` BEFORE DELETE ON `LabelPackage` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `AuditLog_no_update` BEFORE UPDATE ON `AuditLog` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `AuditLog_no_delete` BEFORE DELETE ON `AuditLog` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `SeedManifest_no_update` BEFORE UPDATE ON `SeedManifest` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `SeedManifest_no_delete` BEFORE DELETE ON `SeedManifest` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `PlanRevision_no_delete` BEFORE DELETE ON `PlanRevision` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `TripRevision_no_delete` BEFORE DELETE ON `TripRevision` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `TripStop_no_delete` BEFORE DELETE ON `TripStop` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `TripStopCategory_no_delete` BEFORE DELETE ON `TripStopCategory` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `VehicleReservation_no_delete` BEFORE DELETE ON `VehicleReservation` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `Consignment_no_delete` BEFORE DELETE ON `Consignment` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `ConsignmentItem_no_delete` BEFORE DELETE ON `ConsignmentItem` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `ConsignmentPackage_no_delete` BEFORE DELETE ON `ConsignmentPackage` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `LabelVersion_no_delete` BEFORE DELETE ON `LabelVersion` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `IdempotencyRecord_no_delete` BEFORE DELETE ON `IdempotencyRecord` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY';

CREATE TRIGGER `TripRevision_draft_insert` BEFORE INSERT ON `TripRevision` FOR EACH ROW BEGIN IF (SELECT status FROM PlanRevision WHERE id = NEW.planRevisionId) <> 'DRAFT' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY'; END IF; END;

CREATE TRIGGER `TripRevision_draft_update` BEFORE UPDATE ON `TripRevision` FOR EACH ROW BEGIN IF (SELECT status FROM PlanRevision WHERE id = NEW.planRevisionId) <> 'DRAFT' OR (SELECT status FROM PlanRevision WHERE id = OLD.planRevisionId) <> 'DRAFT' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY'; END IF; END;

CREATE TRIGGER `TripStop_draft_insert` BEFORE INSERT ON `TripStop` FOR EACH ROW BEGIN IF (SELECT p.status FROM PlanRevision p JOIN TripRevision t ON t.planRevisionId=p.id WHERE t.id=NEW.tripRevisionId) <> 'DRAFT' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY'; END IF; END;

CREATE TRIGGER `TripStop_draft_update` BEFORE UPDATE ON `TripStop` FOR EACH ROW BEGIN IF (SELECT p.status FROM PlanRevision p JOIN TripRevision t ON t.planRevisionId=p.id WHERE t.id=NEW.tripRevisionId) <> 'DRAFT' OR (SELECT p.status FROM PlanRevision p JOIN TripRevision t ON t.planRevisionId=p.id WHERE t.id=OLD.tripRevisionId) <> 'DRAFT' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY'; END IF; END;

CREATE TRIGGER `TripStopCategory_draft_insert` BEFORE INSERT ON `TripStopCategory` FOR EACH ROW BEGIN IF (SELECT p.status FROM PlanRevision p JOIN TripRevision t ON t.planRevisionId=p.id JOIN TripStop s ON s.tripRevisionId=t.id WHERE s.id=NEW.stopId) <> 'DRAFT' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY'; END IF; END;

CREATE TRIGGER `TripStopCategory_draft_update` BEFORE UPDATE ON `TripStopCategory` FOR EACH ROW BEGIN IF (SELECT p.status FROM PlanRevision p JOIN TripRevision t ON t.planRevisionId=p.id JOIN TripStop s ON s.tripRevisionId=t.id WHERE s.id=NEW.stopId) <> 'DRAFT' OR (SELECT p.status FROM PlanRevision p JOIN TripRevision t ON t.planRevisionId=p.id JOIN TripStop s ON s.tripRevisionId=t.id WHERE s.id=OLD.stopId) <> 'DRAFT' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY'; END IF; END;

CREATE TRIGGER `PlanBranch_draft_insert` BEFORE INSERT ON `PlanBranch` FOR EACH ROW BEGIN IF (SELECT status FROM PlanRevision WHERE id=NEW.planRevisionId) <> 'DRAFT' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY'; END IF; END;

CREATE TRIGGER `PlanRevision_lifecycle` BEFORE UPDATE ON `PlanRevision` FOR EACH ROW BEGIN IF NOT (NEW.id <=> OLD.id) OR NOT (NEW.planId <=> OLD.planId) OR NOT (NEW.number <=> OLD.number) OR NOT (NEW.createdById <=> OLD.createdById) OR NOT (NEW.createdAt <=> OLD.createdAt) OR (OLD.status <> 'DRAFT' AND NOT (OLD.status='PUBLISHED' AND NEW.status='SUPERSEDED' AND NEW.publishedById <=> OLD.publishedById AND NEW.publishedAt <=> OLD.publishedAt AND NEW.eligibilityVersion <=> OLD.eligibilityVersion)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY'; END IF; END;

CREATE TRIGGER `LabelVersion_immutable` BEFORE UPDATE ON `LabelVersion` FOR EACH ROW BEGIN IF NOT (NEW.id <=> OLD.id) OR NOT (NEW.assignmentId <=> OLD.assignmentId) OR NOT (NEW.number <=> OLD.number) OR NOT (NEW.lookupToken <=> OLD.lookupToken) OR NOT (NEW.payload <=> OLD.payload) OR NOT (NEW.createdAt <=> OLD.createdAt) OR OLD.revokedAt IS NOT NULL OR NEW.revokedAt IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY'; END IF; END;

CREATE TRIGGER `ConsignmentItem_frozen` BEFORE UPDATE ON `ConsignmentItem` FOR EACH ROW BEGIN IF NOT (NEW.consignmentId <=> OLD.consignmentId) OR ((SELECT status FROM Consignment WHERE id=OLD.consignmentId) <> 'DRAFT') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY'; END IF; END;

CREATE TRIGGER `ConsignmentPackage_frozen` BEFORE UPDATE ON `ConsignmentPackage` FOR EACH ROW BEGIN IF NOT (NEW.consignmentId <=> OLD.consignmentId) OR (NOT (NEW.id <=> OLD.id) OR NOT (NEW.sequence <=> OLD.sequence) OR NOT (NEW.total <=> OLD.total) OR NOT (NEW.weight <=> OLD.weight) OR NOT (NEW.weightUnit <=> OLD.weightUnit)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_HISTORY'; END IF; END;

INSERT INTO EligibilityGuard (id, `key`, version) VALUES ('eligibility-global', 'GLOBAL', 1);
