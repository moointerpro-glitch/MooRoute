/**
 * Reads a request body but stops as soon as it exceeds maxBytes, so an oversized body — including a chunked
 * one without Content-Length — is refused without being buffered whole. Returns null when the limit is exceeded.
 */
export async function readBodyWithin(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel().catch(() => undefined); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** UTF-16 code units never need more than three UTF-8 bytes, so this byte cap keeps an existing character limit exact. */
export const utf8BytesFor = (characters: number) => characters * 3;
