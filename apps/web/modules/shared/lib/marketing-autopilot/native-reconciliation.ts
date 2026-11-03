import { createHash } from "node:crypto";
import { z } from "zod";
import { publicationMessage, type PublicationJob } from "./publisher";
import { resolveSocialCredentialReference } from "./credential-resolver";
export type SocialVerificationWork = { job: PublicationJob; accountReference: string; publicationId: string; claimedAt: string; leaseExpiresAt: string };
async function readBounded(response: Response): Promise<{ data: unknown; hash: string }> {
  const reader = response.body?.getReader(); if (!reader) throw new Error("SOCIAL_PROOF_MISSING");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 262144) { await reader.cancel(); throw new Error("SOCIAL_PROOF_TOO_LARGE"); } chunks.push(value); }
  const raw = Buffer.concat(chunks); return { data: JSON.parse(raw.toString("utf8")) as unknown, hash: createHash("sha256").update(raw).digest("hex") };
}
/** Confirms an existing post only; never creates, deletes, edits or requeues a publication. */
export async function verifyNativeSocialPublication(work: SocialVerificationWork, dependencies: { env: Readonly<Record<string, string | undefined>>; fetch: typeof fetch }): Promise<{ responseHash: string; createdAt: string }> {
  const credential = resolveSocialCredentialReference(work.job.credential_reference, dependencies.env);
  if (!credential) throw new Error("SOCIAL_PROOF_CREDENTIAL_UNAVAILABLE");
  const raw: unknown = JSON.parse(credential);
  let endpoint: URL, headers: Record<string, string>;
  if (work.job.provider === "LINKEDIN" && work.job.channel === "LINKEDIN") {
    const config = z.object({ accessToken: z.string().min(20), authorUrn: z.string(), apiVersion: z.string().regex(/^20\d{4}$/u) }).parse(raw);
    if (!/^urn:li:(?:share|ugcPost):[A-Za-z0-9_-]+$/u.test(work.publicationId) || config.authorUrn !== work.accountReference) throw new Error("SOCIAL_PROOF_ACCOUNT_MISMATCH");
    endpoint = new URL(`https://api.linkedin.com/rest/posts/${encodeURIComponent(work.publicationId)}`);
    headers = { authorization: `Bearer ${config.accessToken}`, "linkedin-version": config.apiVersion, "x-restli-protocol-version": "2.0.0" };
  } else if (work.job.provider === "META" && work.job.channel === "FACEBOOK") {
    const config = z.object({ accessToken: z.string().min(20), targetId: z.string().regex(/^\d{3,40}$/u), graphVersion: z.string().regex(/^v\d{2,3}\.\d$/u) }).parse(raw);
    if (!/^\d{3,40}(?:_\d{3,40})?$/u.test(work.publicationId) || config.targetId !== work.accountReference) throw new Error("SOCIAL_PROOF_ACCOUNT_MISMATCH");
    endpoint = new URL(`https://graph.facebook.com/${config.graphVersion}/${work.publicationId}`);
    endpoint.searchParams.set("fields", "id,message,from,created_time,is_published"); headers = { authorization: `Bearer ${config.accessToken}` };
  } else throw new Error("SOCIAL_NATIVE_MEDIA_PROOF_REQUIRED");
  const response = await dependencies.fetch(endpoint, { method: "GET", headers, redirect: "error", signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!response.ok) throw new Error("SOCIAL_NATIVE_PROOF_UNAVAILABLE");
  const proof = await readBounded(response);
  const data = z.record(z.string(), z.unknown()).parse(proof.data);
  let createdAt: number;
  if (work.job.provider === "LINKEDIN") {
    if (data.id !== work.publicationId || data.author !== work.accountReference || data.commentary !== publicationMessage(work.job) || data.lifecycleState !== "PUBLISHED" || typeof data.createdAt !== "number" || !Number.isSafeInteger(data.createdAt)) throw new Error("SOCIAL_NATIVE_PROOF_MISMATCH");
    createdAt = data.createdAt;
  } else {
    const owner = z.object({ id: z.string() }).safeParse(data.from);
    if (data.id !== work.publicationId || !owner.success || owner.data.id !== work.accountReference || data.message !== publicationMessage(work.job) || data.is_published !== true || typeof data.created_time !== "string") throw new Error("SOCIAL_NATIVE_PROOF_MISMATCH");
    createdAt = Date.parse(data.created_time);
  }
  const claim = Date.parse(work.claimedAt), end = Date.parse(work.leaseExpiresAt);
  if (![createdAt, claim, end].every(Number.isFinite) || createdAt < claim - 5000 || createdAt > end + 5000) throw new Error("SOCIAL_NATIVE_PROOF_TIME_MISMATCH");
  return { responseHash: proof.hash, createdAt: new Date(createdAt).toISOString() };
}
