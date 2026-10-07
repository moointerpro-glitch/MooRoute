/**
 * Least-privilege grants for the web application's database account. Single source for local
 * development and staging rehearsals. History tables are INSERT-only; nothing grants DELETE on
 * history, DDL, or access outside the application schema.
 */
const groups: Array<[string, string[]]> = [
  // Aggregates with a mutable pointer, version or lifecycle column.
  ["INSERT, UPDATE", ["Route", "ScheduleTemplate", "DailyPlan", "PlanRevision", "Trip", "VehicleReservation", "ImportBatch", "ImportRow", "Consignment", "ConsignmentPackage", "LabelVersion", "IdempotencyRecord"]],
  // Append-only history and ledgers.
  ["INSERT", ["RouteRevision", "RouteStop", "TemplateRevision", "TemplateWeekday", "TemplateStopCategory", "TripRevision", "TripStop", "TripStopCategory", "PlanBranch", "ConsignmentAssignment", "ConsignmentEvent",
    "ConsignmentItem", "AddressSnapshot", "ReceiptLine", "ReturnLine", "Attachment", "LabelPackage", "PrintEvent", "AuditLog"]],
  // Master data edited through audited services (delete falls back to archive when referenced).
  ["INSERT, UPDATE, DELETE", ["Vehicle", "VehicleType", "Driver", "Branch", "BranchAlias", "ProductCategory", "StorageCondition", "ConsignmentCategory", "Warehouse", "Department"]],
  // Authentication runtime state.
  ["INSERT, UPDATE, DELETE", ["AuthSession", "AuthRateLimit", "AuthVerification"]],
  ["UPDATE", ["AuthAccount", "EligibilityGuard"]],
  // Self-service contact defaults (D220).
  ["INSERT, UPDATE", ["UserProfile"]],
  // Administrator user management (D223): accounts are created and disabled, never deleted; the current role and
  // scope rows are replaced on change while AuditLog keeps the before/after history.
  ["INSERT, UPDATE", ["User"]],
  ["INSERT", ["AuthAccount"]],
  ["INSERT, DELETE", ["UserRole", "UserScope"]],
];
const identifier = (value: string) => { if (!/^[A-Za-z0-9_]{1,64}$/.test(value)) throw new Error("INVALID_IDENTIFIER"); return value; };

export function runtimeGrants(database: string, user: string, host = "127.0.0.1") {
  const db = identifier(database), account = `'${identifier(user)}'@'${host.replace(/[^0-9a-zA-Z.:%]/g, "")}'`;
  return [`GRANT SELECT ON \`${db}\`.* TO ${account};`, ...groups.flatMap(([privileges, tables]) => tables.map((t) => `GRANT ${privileges} ON \`${db}\`.\`${identifier(t)}\` TO ${account};`))];
}
