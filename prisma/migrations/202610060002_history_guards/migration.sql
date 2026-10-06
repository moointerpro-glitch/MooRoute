-- Additional reviewed lifecycle restrictions; never rewrite the applied initial migration.
CREATE TRIGGER RouteStop_no_append_after_use BEFORE INSERT ON RouteStop FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM TemplateRevision WHERE routeRevisionId=NEW.routeRevisionId)
     OR EXISTS (SELECT 1 FROM TripRevision WHERE routeRevisionId=NEW.routeRevisionId) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_HISTORY';
  END IF;
END;

CREATE TRIGGER TemplateWeekday_no_append_after_use BEFORE INSERT ON TemplateWeekday FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM TripRevision WHERE templateRevisionId=NEW.templateRevisionId) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_HISTORY';
  END IF;
END;

CREATE TRIGGER TemplateStopCategory_validate BEFORE INSERT ON TemplateStopCategory FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM TripRevision WHERE templateRevisionId=NEW.templateRevisionId)
     OR NOT EXISTS (SELECT 1 FROM TemplateRevision t JOIN RouteStop s ON s.routeRevisionId=t.routeRevisionId WHERE t.id=NEW.templateRevisionId AND s.id=NEW.routeStopId) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_OR_WRONG_ROUTE';
  END IF;
END;

CREATE TRIGGER VehicleReservation_release_only BEFORE UPDATE ON VehicleReservation FOR EACH ROW
BEGIN
  IF NOT (NEW.id <=> OLD.id) OR NOT (NEW.vehicleId <=> OLD.vehicleId)
     OR NOT (NEW.tripRevisionId <=> OLD.tripRevisionId) OR NOT (NEW.createdAt <=> OLD.createdAt)
     OR NOT (NEW.startAt <=> OLD.startAt) OR NOT (NEW.endAt <=> OLD.endAt)
     OR NOT (NEW.bufferMinutes <=> OLD.bufferMinutes)
     OR OLD.active <> 1 OR NEW.active <> 0 OR NEW.releasedAt IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_RESERVATION';
  END IF;
END;

CREATE TRIGGER Trip_identity_immutable BEFORE UPDATE ON Trip FOR EACH ROW
BEGIN
  IF NOT (NEW.id <=> OLD.id) OR NOT (NEW.planId <=> OLD.planId)
     OR NOT (NEW.code <=> OLD.code) OR NOT (NEW.createdAt <=> OLD.createdAt) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_TRIP_IDENTITY';
  END IF;
END;

CREATE TRIGGER ConsignmentItem_no_append_after_submission BEFORE INSERT ON ConsignmentItem FOR EACH ROW
BEGIN
  IF (SELECT status FROM Consignment WHERE id=NEW.consignmentId) <> 'DRAFT' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_SENT_ITEMS';
  END IF;
END;

CREATE TRIGGER ConsignmentPackage_no_append_after_submission BEFORE INSERT ON ConsignmentPackage FOR EACH ROW
BEGIN
  IF (SELECT status FROM Consignment WHERE id=NEW.consignmentId) <> 'DRAFT' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='IMMUTABLE_SENT_PACKAGES';
  END IF;
END;

CREATE TRIGGER ConsignmentAssignment_validate_owner BEFORE INSERT ON ConsignmentAssignment FOR EACH ROW
BEGIN
  IF NOT EXISTS (SELECT 1 FROM Consignment c JOIN TripStop s ON s.branchId=c.destinationBranchId
    WHERE c.id=NEW.consignmentId AND s.id=NEW.stopId)
    OR (NEW.previousAssignmentId IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM ConsignmentAssignment a WHERE a.id=NEW.previousAssignmentId AND a.consignmentId=NEW.consignmentId)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ASSIGNMENT_OWNERSHIP';
  END IF;
END;

CREATE TRIGGER LabelPackage_validate_owner BEFORE INSERT ON LabelPackage FOR EACH ROW
BEGIN
  IF NOT EXISTS (SELECT 1 FROM LabelVersion l JOIN ConsignmentAssignment a ON a.id=l.assignmentId
    JOIN ConsignmentPackage p ON p.consignmentId=a.consignmentId WHERE l.id=NEW.labelVersionId AND p.id=NEW.packageId) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='LABEL_PACKAGE_OWNERSHIP';
  END IF;
END;

CREATE TRIGGER ConsignmentEvent_validate_compensation BEFORE INSERT ON ConsignmentEvent FOR EACH ROW
BEGIN
  IF NEW.compensatesEventId IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM ConsignmentEvent e WHERE e.id=NEW.compensatesEventId AND e.consignmentId=NEW.consignmentId) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='EVENT_OWNERSHIP';
  END IF;
END;
