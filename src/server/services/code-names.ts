import "server-only";
import type { Transaction } from "./transaction";

/**
 * Display names for unit and issue-type codes (D220). Archived rows are included so history keeps its wording;
 * a code without a row is shown as stored.
 */
export async function codeNames(tx: Transaction) {
  const [units, issues] = await Promise.all([tx.unit.findMany({ select: { code: true, name: true } }), tx.issueType.findMany({ select: { code: true, name: true } })]);
  return { units: Object.fromEntries(units.map((u) => [u.code, u.name])) as Record<string, string>, issueTypes: Object.fromEntries(issues.map((i) => [i.code, i.name])) as Record<string, string> };
}
