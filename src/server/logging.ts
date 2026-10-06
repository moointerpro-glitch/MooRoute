/**
 * Operational logging for unexpected server failures.
 * Only the error class, a safe code and a source location are recorded. Error messages, SQL,
 * parameters, request bodies, cookies and connection strings are never written, because they can
 * contain personal data or secrets.
 */
export function describeError(error: unknown) {
  if (!(error instanceof Error)) return { name: typeof error };
  const candidate = error as Error & { code?: unknown; meta?: { code?: unknown } };
  const safe = (v: unknown) => (typeof v === "string" || typeof v === "number") && /^[A-Za-z0-9_]{1,40}$/.test(String(v)) ? String(v) : undefined;
  // First stack frame, reduced to "file:line" without absolute directories.
  const frame = error.stack?.split("\n").slice(1).map((l) => l.match(/([^\\/()\s]+\.[cm]?[jt]sx?):(\d+)/)).find(Boolean);
  return { name: error.name.replace(/[^A-Za-z0-9_]/g, "").slice(0, 60) || "Error", code: safe(candidate.code), driverCode: safe(candidate.meta?.code), at: frame ? `${frame[1]}:${frame[2]}` : undefined };
}

export function logUnexpected(event: string, error: unknown, sink: (line: string) => void = (line) => console.error(line)) {
  sink(JSON.stringify({ level: "error", time: new Date().toISOString(), event: event.replace(/[^a-z0-9_.-]/gi, "").slice(0, 60), ...describeError(error) }));
}
