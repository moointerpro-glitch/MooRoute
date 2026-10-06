-- Additive Phase 4 planning metadata. Existing immutable revisions remain intact.
ALTER TABLE TripRevision MODIFY kind ENUM('BRANCH_DELIVERY','INBOUND_DC','OTHER','VAN_SALES') NOT NULL DEFAULT 'BRANCH_DELIVERY',
 ADD notes VARCHAR(2000) NULL, ADD plannedLoad DECIMAL(14,3) NULL, ADD loadUnit VARCHAR(32) NULL,
 ADD CONSTRAINT TripRevision_load_check CHECK ((plannedLoad IS NULL AND loadUnit IS NULL) OR (plannedLoad > 0 AND loadUnit IS NOT NULL AND CHAR_LENGTH(loadUnit)>0));
ALTER TABLE TemplateRevision
 ADD kind ENUM('BRANCH_DELIVERY','INBOUND_DC','OTHER','VAN_SALES') NOT NULL DEFAULT 'BRANCH_DELIVERY',
 ADD vehicleId VARCHAR(36) NULL, ADD driverId VARCHAR(36) NULL,
 ADD occupancyStartMinute INTEGER NULL, ADD occupancyEndMinute INTEGER NULL,
 ADD arrivalDayOffset INTEGER NOT NULL DEFAULT 0, ADD bufferMinutes INTEGER NOT NULL DEFAULT 0,
 ADD notes VARCHAR(2000) NULL,
 ADD CONSTRAINT TemplateRevision_vehicleId_fkey FOREIGN KEY(vehicleId) REFERENCES Vehicle(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD CONSTRAINT TemplateRevision_driverId_fkey FOREIGN KEY(driverId) REFERENCES Driver(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD CONSTRAINT TemplateRevision_occupancy_check CHECK ((occupancyStartMinute IS NULL OR occupancyStartMinute BETWEEN 0 AND 4319) AND (occupancyEndMinute IS NULL OR occupancyEndMinute BETWEEN 0 AND 4319) AND (occupancyStartMinute IS NULL OR occupancyEndMinute IS NULL OR occupancyStartMinute<occupancyEndMinute)),
 ADD CONSTRAINT TemplateRevision_offset_check CHECK (arrivalDayOffset BETWEEN 0 AND 2 AND bufferMinutes BETWEEN 0 AND 1440);
