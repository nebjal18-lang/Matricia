import { z } from "zod";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const allowedMime = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxBytes = 10_485_760;
const noStore = {
  "cache-control": "no-store, private",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
} as const;

const authorization = z.object({
  outcome: z.literal("CLIENT_DOCUMENT_AUTHORIZED"),
  document_id: uuid,
  bucket: z.literal("client-compliance"),
  object_path: z.string().min(32).max(500).refine((value) => !/(^|\/)\.\.(\/|$)/u.test(value)),
  file_name: z.string().min(3).max(255).refine((value) => !/[\\/\x00-\x1f]/u.test(value)),
  mime_type: z.string().refine((value) => allowedMime.has(value)),
  size_bytes: z.union([z.number().int().positive().max(maxBytes), z.string().regex(/^\d{1,12}$/u)]).transform((value) => Number(value)),
}).strict();

function json(code: string, status: number) {
  return Response.json({ code }, { status, headers: noStore });
}

function contentDisposition(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7E]/gu, "_").replace(/["\\]/gu, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string; documentId: string }> },
) {
  const params = await context.params;
  const requestId = uuid.safeParse(params.requestId);
  if (!requestId.success) return json("CLIENT_DOCUMENT_INVALID", 400);
  const documentId = uuid.safeParse(params.documentId);
  if (!documentId.success) return json("CLIENT_DOCUMENT_INVALID", 400);

  const userClient = await getSupabaseServerClient();
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json("UNAUTHENTICATED", 401);

  const authorized = await userClient.rpc("authorize_client_assistance_document", {
    p_request_id: requestId.data,
    p_document_id: documentId.data,
  });
  if (authorized.error) {
    const denied = authorized.error.code === "42501" || /UNAUTHENTICATED|CLIENT_DOCUMENT_DENIED/u.test(authorized.error.message);
    return json(denied ? "CLIENT_DOCUMENT_DENIED" : "CLIENT_DOCUMENT_UNAVAILABLE", denied ? 403 : 503);
  }

  const grant = authorization.safeParse(authorized.data);
  if (!grant.success || grant.data.document_id !== documentId.data || grant.data.size_bytes > maxBytes) {
    return json("CLIENT_DOCUMENT_DENIED", 403);
  }

  const downloaded = await getSupabaseAdminClient().storage.from(grant.data.bucket).download(grant.data.object_path);
  if (downloaded.error || !downloaded.data) return json("CLIENT_DOCUMENT_UNAVAILABLE", 503);

  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (bytes.byteLength < 1 || bytes.byteLength > maxBytes || bytes.byteLength !== grant.data.size_bytes) {
    return json("CLIENT_DOCUMENT_UNAVAILABLE", 503);
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      ...noStore,
      "content-type": grant.data.mime_type,
      "content-length": String(bytes.byteLength),
      "content-disposition": contentDisposition(grant.data.file_name),
    },
  });
}
