# Phase 2 field dictionary

Reviewed 2026-10-06 before migration generation. Exact physical fields follow; `?` means nullable, all other fields are NOT NULL. All ids are stable opaque UUID strings except deterministic synthetic ids. `createdAt` is UTC. DATETIME(3) is UTC by application convention; DATE is the local service/effective calendar date. DECIMAL(14,3) requires its explicit unit. All FK deletion/update rules are RESTRICT. Prisma relations are shown in ER_DIAGRAM.md. Additional CHECK/triggers are reviewed in PHASE2_DESIGN.md and the SQL migration. JSON payload contracts are described in API_CONTRACTS.md.

## User

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| subject | String | @unique @db.VarChar(191) |
| displayName | String | @db.VarChar(191) |
| active | Boolean | @default(true) |
| version | Int | @default(1) |
| updatedAt | DateTime | @updatedAt @db.DateTime(3) |

Keys: Primary id only.

## Role

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |
| name | String | @db.VarChar(191) |

Keys: Primary id only.

## Permission

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |

Keys: Primary id only.

## UserRole

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| userId | String | @db.VarChar(36) |
| roleId | String | @db.VarChar(36) |

Keys: @@unique([userId, roleId])

## RolePermission

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| roleId | String | @db.VarChar(36) |
| permissionId | String | @db.VarChar(36) |

Keys: @@unique([roleId, permissionId])

## Department

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |
| name | String | @db.VarChar(191) |
| active | Boolean | @default(true) |

Keys: Primary id only.

## Warehouse

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |
| name | String | @db.VarChar(191) |
| address | String | @db.Text |
| active | Boolean | @default(true) |

Keys: Primary id only.

## UserScope

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| userId | String | @db.VarChar(36) |
| kind | ScopeKind | — |
| branchId | String? | @db.VarChar(36) |
| departmentId | String? | @db.VarChar(36) |
| warehouseId | String? | @db.VarChar(36) |

Keys: @@index([userId, kind])

## EligibilityGuard

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| key | String | @unique @db.VarChar(32) |
| version | Int | @default(1) |

Keys: Primary id only.

## Branch

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |
| name | String | @db.VarChar(191) |
| destinationType | DestinationType | @default(BRANCH) |
| addressLine | String | @db.VarChar(500) |
| subdistrict | String | @db.VarChar(100) |
| district | String | @db.VarChar(100) |
| province | String | @db.VarChar(100) |
| postalCode | String | @db.VarChar(10) |
| contactName | String? | @db.VarChar(191) |
| contactPhone | String? | @db.VarChar(32) |
| receivingFromMinute | Int? | — |
| receivingToMinute | Int? | — |
| activeFrom | DateTime | @db.Date |
| activeTo | DateTime? | @db.Date |
| archived | Boolean | @default(false) |
| version | Int | @default(1) |
| updatedAt | DateTime | @updatedAt @db.DateTime(3) |

Keys: @@index([destinationType, activeFrom, activeTo])

## BranchAlias

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| branchId | String | @db.VarChar(36) |
| name | String | @db.VarChar(191) |

Keys: @@unique([branchId, name]); @@index([name])

## VehicleType

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |
| name | String | @db.VarChar(191) |
| wheelCount | Int | — |

Keys: Primary id only.

## StorageCondition

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |
| name | String | @db.VarChar(191) |

Keys: Primary id only.

## Vehicle

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| plateNormalized | String | @db.VarChar(32) |
| province | String | @db.VarChar(100) |
| typeId | String | @db.VarChar(36) |
| storageConditionId | String | @db.VarChar(36) |
| brand | String? | @db.VarChar(100) |
| model | String? | @db.VarChar(100) |
| color | String? | @db.VarChar(64) |
| bodyDescription | String? | @db.VarChar(191) |
| ownerName | String? | @db.VarChar(191) |
| capacity | Decimal? | @db.Decimal(14,3) |
| capacityUnit | String? | @db.VarChar(32) |
| active | Boolean | @default(true) |
| availableFrom | DateTime? | @db.DateTime(3) |
| availableTo | DateTime? | @db.DateTime(3) |
| version | Int | @default(1) |
| updatedAt | DateTime | @updatedAt @db.DateTime(3) |

Keys: @@unique([plateNormalized, province])

## Driver

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |
| name | String | @db.VarChar(191) |
| phone | String? | @db.VarChar(32) |
| active | Boolean | @default(true) |

Keys: Primary id only.

## ProductCategory

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |
| name | String | @db.VarChar(191) |
| parentId | String? | @db.VarChar(36) |
| active | Boolean | @default(true) |

Keys: Primary id only.

## ConsignmentCategory

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |
| name | String | @db.VarChar(191) |
| active | Boolean | @default(true) |

Keys: Primary id only.

## Route

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |
| active | Boolean | @default(true) |
| version | Int | @default(1) |

Keys: Primary id only.

## RouteRevision

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| routeId | String | @db.VarChar(36) |
| number | Int | — |
| name | String | @db.VarChar(191) |
| effectiveFrom | DateTime | @db.Date |
| effectiveTo | DateTime? | @db.Date |
| createdById | String | @db.VarChar(36) |

Keys: @@unique([routeId, number])

## RouteStop

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| routeRevisionId | String | @db.VarChar(36) |
| branchId | String | @db.VarChar(36) |
| sequence | Int | — |

Keys: @@unique([routeRevisionId, sequence])

## ScheduleTemplate

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |
| active | Boolean | @default(true) |
| version | Int | @default(1) |

Keys: Primary id only.

## TemplateRevision

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| templateId | String | @db.VarChar(36) |
| number | Int | — |
| routeRevisionId | String | @db.VarChar(36) |
| effectiveFrom | DateTime | @db.Date |
| effectiveTo | DateTime? | @db.Date |
| roundNo | Int | — |
| loadingMinute | Int? | — |
| departureMinute | Int? | — |
| arrivalMinute | Int? | — |
| createdById | String | @db.VarChar(36) |

Keys: @@unique([templateId, number])

## TemplateWeekday

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| templateRevisionId | String | @db.VarChar(36) |
| weekday | Int | — |

Keys: @@unique([templateRevisionId, weekday])

## TemplateStopCategory

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| templateRevisionId | String | @db.VarChar(36) |
| routeStopId | String | @db.VarChar(36) |
| categoryId | String | @db.VarChar(36) |

Keys: @@unique([templateRevisionId, routeStopId, categoryId])

## DailyPlan

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| serviceDate | DateTime | @unique @db.Date |
| version | Int | @default(1) |
| publishedRevisionId | String? | @unique @db.VarChar(36) |
| updatedAt | DateTime | @updatedAt @db.DateTime(3) |

Keys: Primary id only.

## PlanRevision

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| planId | String | @db.VarChar(36) |
| number | Int | — |
| status | RevisionStatus | @default(DRAFT) |
| eligibilityVersion | Int? | — |
| createdById | String | @db.VarChar(36) |
| publishedById | String? | @db.VarChar(36) |
| publishedAt | DateTime? | @db.DateTime(3) |

Keys: @@unique([planId, number]); @@unique([id, planId])

## PlanBranch

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| planRevisionId | String | @db.VarChar(36) |
| branchId | String | @db.VarChar(36) |

Keys: @@unique([planRevisionId, branchId])

## Trip

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| planId | String | @db.VarChar(36) |
| code | String | @unique @db.VarChar(64) |
| version | Int | @default(1) |

Keys: @@unique([id, planId])

## TripRevision

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| tripId | String | @db.VarChar(36) |
| planId | String | @db.VarChar(36) |
| planRevisionId | String | @db.VarChar(36) |
| templateRevisionId | String? | @db.VarChar(36) |
| routeRevisionId | String? | @db.VarChar(36) |
| kind | TripKind | @default(BRANCH_DELIVERY) |
| roundNo | Int? | — |
| cancelled | Boolean | @default(false) |
| vehicleId | String? | @db.VarChar(36) |
| driverId | String? | @db.VarChar(36) |
| loadingAt | DateTime? | @db.DateTime(3) |
| departureAt | DateTime? | @db.DateTime(3) |
| arrivalAt | DateTime? | @db.DateTime(3) |
| occupancyStart | DateTime? | @db.DateTime(3) |
| occupancyEnd | DateTime? | @db.DateTime(3) |
| bufferMinutes | Int | @default(0) |

Keys: @@unique([planRevisionId, tripId]); @@unique([id, tripId]); @@index([planRevisionId, departureAt, tripId])

## TripStop

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| tripRevisionId | String | @db.VarChar(36) |
| branchId | String | @db.VarChar(36) |
| sequence | Int | — |
| nameSnapshot | String | @db.VarChar(191) |
| arrivalAt | DateTime? | @db.DateTime(3) |

Keys: @@unique([tripRevisionId, sequence]); @@unique([id, tripRevisionId]); @@index([branchId, tripRevisionId])

## TripStopCategory

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| stopId | String | @db.VarChar(36) |
| categoryId | String | @db.VarChar(36) |

Keys: @@unique([stopId, categoryId]); @@index([categoryId, stopId])

## VehicleReservation

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| vehicleId | String | @db.VarChar(36) |
| tripRevisionId | String | @db.VarChar(36) |
| startAt | DateTime | @db.DateTime(3) |
| endAt | DateTime | @db.DateTime(3) |
| bufferMinutes | Int | — |
| active | Boolean | @default(true) |
| releasedAt | DateTime? | @db.DateTime(3) |

Keys: @@unique([tripRevisionId]); @@index([vehicleId, active, startAt, endAt])

## Consignment

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| code | String | @unique @db.VarChar(64) |
| requesterId | String | @db.VarChar(36) |
| departmentId | String | @db.VarChar(36) |
| sourceWarehouseId | String | @db.VarChar(36) |
| destinationBranchId | String | @db.VarChar(36) |
| receiptMode | ReceiptMode | @default(PACKAGES) |
| status | ConsignmentStatus | @default(DRAFT) |
| currentAssignmentId | String? | @unique @db.VarChar(36) |
| hasOpenIssue | Boolean | @default(false) |
| version | Int | @default(1) |
| updatedAt | DateTime | @updatedAt @db.DateTime(3) |

Keys: @@index([destinationBranchId, status, createdAt]); @@index([requesterId, createdAt])

## ConsignmentItem

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| consignmentId | String | @db.VarChar(36) |
| categoryId | String | @db.VarChar(36) |
| name | String | @db.VarChar(191) |
| sentQuantity | Decimal | @db.Decimal(14,3) |
| unit | String | @db.VarChar(32) |

Keys: @@unique([id, consignmentId])

## ConsignmentPackage

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| consignmentId | String | @db.VarChar(36) |
| sequence | Int | — |
| total | Int | — |
| weight | Decimal? | @db.Decimal(14,3) |
| weightUnit | String? | @db.VarChar(32) |
| custody | CustodyState | @default(SENDER) |

Keys: @@unique([consignmentId, sequence]); @@unique([id, consignmentId])

## AddressSnapshot

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| schemaVersion | Int | @default(1) |
| branchId | String? | @db.VarChar(36) |
| payload | Json | — |
| createdById | String | @db.VarChar(36) |

Keys: Primary id only.

## ConsignmentAssignment

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| consignmentId | String | @db.VarChar(36) |
| tripId | String | @db.VarChar(36) |
| tripRevisionId | String | @db.VarChar(36) |
| stopId | String | @db.VarChar(36) |
| senderSnapshotId | String | @db.VarChar(36) |
| recipientSnapshotId | String | @db.VarChar(36) |
| transportSnapshot | Json | — |
| previousAssignmentId | String? | @unique @db.VarChar(36) |
| reason | String | @db.VarChar(500) |
| approvedById | String | @db.VarChar(36) |
| approvedAt | DateTime | @db.DateTime(3) |

Keys: @@unique([id, consignmentId]); @@index([tripId, consignmentId])

## IdempotencyRecord

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| actorId | String | @db.VarChar(36) |
| operation | String | @db.VarChar(64) |
| key | String | @db.VarChar(100) |
| requestHash | String | @db.Char(64) |
| response | Json? | — |

Keys: @@unique([actorId, operation, key])

## ConsignmentEvent

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| consignmentId | String | @db.VarChar(36) |
| actorId | String | @db.VarChar(36) |
| kind | EventKind | — |
| occurredAt | DateTime | @db.DateTime(3) |
| payload | Json | — |
| idempotencyId | String? | @db.VarChar(36) |
| compensatesEventId | String? | @db.VarChar(36) |

Keys: @@index([consignmentId, occurredAt, id]); @@unique([id, consignmentId])

## ReceiptLine

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| eventId | String | @db.VarChar(36) |
| consignmentId | String | @db.VarChar(36) |
| itemId | String? | @db.VarChar(36) |
| packageId | String? | @unique @db.VarChar(36) |
| quantity | Decimal | @db.Decimal(14,3) |
| unit | String | @db.VarChar(32) |
| note | String? | @db.VarChar(500) |

Keys: @@index([itemId, eventId])

## Attachment

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| consignmentId | String | @db.VarChar(36) |
| uploaderId | String | @db.VarChar(36) |
| storageKey | String | @unique @db.VarChar(191) |
| displayName | String | @db.VarChar(191) |
| contentType | String | @db.VarChar(64) |
| sizeBytes | Int | — |
| sha256 | String | @db.Char(64) |
| accessClass | String | @default("PRIVATE") @db.VarChar(32) |
| retainedUntil | DateTime? | @db.DateTime(3) |
| deletedAt | DateTime? | @db.DateTime(3) |

Keys: @@index([consignmentId, createdAt])

## LabelVersion

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| assignmentId | String | @db.VarChar(36) |
| number | Int | — |
| lookupToken | String | @unique @db.VarChar(64) |
| payload | Json | — |
| revokedAt | DateTime? | @db.DateTime(3) |
| revocationReason | String? | @db.VarChar(500) |

Keys: @@unique([assignmentId, number])

## LabelPackage

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| labelVersionId | String | @db.VarChar(36) |
| packageId | String | @db.VarChar(36) |

Keys: @@unique([labelVersionId, packageId])

## PrintEvent

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| labelVersionId | String | @db.VarChar(36) |
| actorId | String | @db.VarChar(36) |
| format | String | @db.VarChar(32) |
| copies | Int | — |
| reason | String? | @db.VarChar(500) |

Keys: Primary id only.

## ImportBatch

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| sourceHash | String | @db.Char(64) |
| sourceName | String | @db.VarChar(191) |
| sourceEdition | String | @db.VarChar(100) |
| status | ImportStatus | @default(STAGED) |
| createdById | String | @db.VarChar(36) |
| committedAt | DateTime? | @db.DateTime(3) |

Keys: @@unique([sourceHash, sourceEdition])

## ImportRow

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| batchId | String | @db.VarChar(36) |
| rowNumber | Int | — |
| raw | Json | — |
| validation | Json | — |
| resolvedEntityId | String? | @db.VarChar(36) |

Keys: @@unique([batchId, rowNumber])

## AuditLog

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| actorId | String | @db.VarChar(36) |
| action | String | @db.VarChar(64) |
| entityType | String | @db.VarChar(64) |
| entityId | String | @db.VarChar(36) |
| before | Json? | — |
| after | Json? | — |
| reason | String? | @db.VarChar(500) |
| idempotencyId | String? | @db.VarChar(36) |

Keys: @@index([entityType, entityId, createdAt])

## SeedManifest

| Field | Type / nullability | Constraints / default |
| --- | --- | --- |
| id | String | @id @default(uuid()) @db.VarChar(36) |
| createdAt | DateTime | @default(now()) @db.DateTime(3) |
| key | String | @unique @db.VarChar(100) |
| version | Int | — |
| checksum | String | @db.Char(64) |
| payload | Json | — |

Keys: Primary id only.


## Reviewed cross-field and lifecycle rules

- Branch eligibility dates are inclusive; only BRANCH destinations with archived=false count. Snapshot PlanBranch rows freeze the publication's eligible set. Aliases may be shared across different branches and require ambiguity handling in the later master/search service.
- UserScope requires exactly the target selected by its kind; GLOBAL has no target.
- Branch/template local minute fields are 0–1439. Branch-delivery rounds must be 1–3. Service DATE is separate from UTC DATETIME(3).
- Positive measured quantities use DECIMAL(14,3); capacity/weight require their paired explicit unit. ReceiptLine has exactly one item or package target; a package line is exactly 1 PACKAGE. Sent item units/amounts freeze after draft.
- Vehicle reservation start < end; bufferMinutes is 0–1440 and included in stored endAt. Old reservations only transition active to released; their intervals never change.
- TripRevision composite FKs keep trip and revision in the same daily plan. DailyPlan's published pointer belongs to that plan. Consignment's current assignment belongs to it. Assignment's trip/stop revision and receipt's event/item/package ownership use composite FKs. Additional assignment/label/event ownership triggers are in migration 002.
- Route/template versions, snapshots, assignments, events, receipts, audit and print rows reject mutation/deletion. Referenced route/template membership cannot be appended after use. Published planning membership rejects inserts/updates, and revisions permit only the explicit publish/supersede transition.
- Private attachments require JPEG/PNG/PDF metadata, 1–10 MB size, PRIVATE access and a unique opaque key. Actual signature validation, upload limits and private download handlers are later-phase services.
- Indexes support branch/date eligibility, published departure ordering, same-stop category EXISTS, active vehicle overlaps, consignment scope/status lists, event timelines, quantity ledgers and entity audit history. Large-dataset query-plan/load benchmarks are not claimed.
- Immutable JSON evidence and versioned payload contracts are described in API_CONTRACTS.md; raw imports and source evidence never execute. IDs/numeric codes/unit codes are technical values; UI must translate labels into Thai.

The exact CHECK and trigger SQL in the two committed migrations supplements this field list; Prisma does not express those features in its schema language.
