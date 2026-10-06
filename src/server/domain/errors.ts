export class DomainError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
    this.name = "DomainError";
  }
}
export function requireCondition(value: unknown, code: string, message: string): asserts value {
  if (!value) throw new DomainError(code, message);
}
export function versionMatches(actual: number, expected: number) {
  requireCondition(Number.isInteger(expected) && actual === expected, "VERSION_CONFLICT", "ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดใหม่แล้วลองอีกครั้ง");
}
