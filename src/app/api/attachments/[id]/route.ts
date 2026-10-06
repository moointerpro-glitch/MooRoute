import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { safeFailure } from "@/server/http";
import { attachmentForDownload } from "@/server/services/consignments";
import { readPrivateFile } from "@/server/storage/attachments";

/** Authenticated, scoped download. There is no public URL for attachments. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await actorFromHeaders(request.headers), { id } = await params;
    const meta = await attachmentForDownload(getDatabase(), actor.id, id);
    const bytes = await readPrivateFile(meta.storageKey);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": meta.contentType, "Content-Length": String(bytes.length), "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(meta.displayName)}`,
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) { return safeFailure(error); }
}
