import "server-only";

// Confirmed business requirements; transactional enforcement belongs to Phase 2.
export const branchDeliveryPolicy = Object.freeze({
  requiredRounds: Object.freeze([1, 2, 3] as const),
  requiredCategoryCodes: Object.freeze(["PORK", "CHICKEN"] as const),
  timeZone: "Asia/Bangkok" as const,
});
