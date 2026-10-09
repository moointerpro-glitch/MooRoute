/**
 * Version 4 identifier for idempotency keys and client-created records. crypto.randomUUID exists only in secure
 * contexts (HTTPS or loopback), so on a plain-HTTP network address (D240) the same identifier is built from
 * crypto.getRandomValues, which browsers provide everywhere.
 */
export function newUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte, index) => index === 6 ? (byte & 0x0f) | 0x40 : index === 8 ? (byte & 0x3f) | 0x80 : byte);
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
