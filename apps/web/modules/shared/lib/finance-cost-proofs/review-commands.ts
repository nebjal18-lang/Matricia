import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { financeCostHttpPrerequisite, financeCostComponentSchema, type FinanceCostComponent } from "./browser-upload";

export type FinanceCostReviewFailure = "VALIDATION" | "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "CONFLICT" | "EVIDENCE_REQUIRED" | "UNAVAILABLE" | "INVALID_RESPONSE";
export type FinanceCostCommandResult = { ok: true; proposalId: string; outcome: "PROPOSED" | "APPROVED" | "REJECTED" } | { ok: false; code: FinanceCostReviewFailure };
export type FinanceCostEvidence = { uploadId: string; fileName: string; sha256: string; mimeType: "application/pdf" | "image/jpeg" | "image/png"; sizeBytes: number };
export type FinanceCostTarget = { id: string; component: FinanceCostComponent; label: string };
export type FinanceCostReviewProposal = {
  id: string; component: FinanceCostComponent; targetId: string; targetLabel: string; sourceHash: string;
  currency: string; status: "PENDING" | "APPROVED" | "REJECTED"; canDecide: boolean; proof: FinanceCostEvidence;
};
export type FinanceCostProofWorkspace =
  | { status: "success"; targets: FinanceCostTarget[]; proposals?: FinanceCostReviewProposal[]; canUpload: boolean }
  | { status: "error"; reason: "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "QUERY_FAILED" | "INVALID_RESPONSE" };

const scopeSchema = z.object({ component: financeCostComponentSchema, targetId: z.string().uuid(), uploadId: z.string().uuid(), reason: z.string().trim().min(10).max(2000), idempotencyKey: z.string().min(8).max(200) });
const decisionSchema = z.object({ proposalId: z.string().uuid(), sourceHash: z.string().regex(/^[a-f0-9]{64}$/), approved: z.boolean(), reason: z.string().trim().min(10).max(2000) });
const evidenceSchema = z.object({ uploadId: z.string().uuid(), fileName: z.string().min(1).max(180), sha256: z.string().regex(/^[a-f0-9]{64}$/), mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]), sizeBytes: z.number().int().positive().max(10485760) });
const failure = (error: { code?: string; message?: string } | null): FinanceCostReviewFailure => {
  if (error?.code === "42501") return /MFA|AAL2/i.test(error.message ?? "") ? "MFA_REQUIRED" : "FORBIDDEN";
  if (["PGRST301", "PGRST303"].includes(error?.code ?? "")) return "UNAUTHENTICATED";
  if (["40001", "22000", "23505"].includes(error?.code ?? "")) return "CONFLICT";
  if (error?.code === "55000" && /PROOF|DOCUMENT|DOWNLOAD|READ_RECEIPT|CLEAN/i.test(error.message ?? "")) return "EVIDENCE_REQUIRED";
  if (error?.code === "55000") return "CONFLICT";
  return "UNAVAILABLE";
};

export async function proposeFinanceZeroCost(client: SupabaseClient, input: z.input<typeof scopeSchema>): Promise<FinanceCostCommandResult> {
  const parsed = scopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION" };
  try {
    const value = parsed.data;
    const response = await client.rpc("propose_credit_economic_zero_cost_v1", { p_component: value.component, p_target_id: value.targetId, p_upload_id: value.uploadId, p_reason: value.reason, p_idempotency_key: value.idempotencyKey });
    if (response.error) return { ok: false, code: failure(response.error) };
    const receipt = z.object({ outcome: z.literal("CREDIT_ECONOMIC_COST_PROPOSED"), proposal_id: z.string().uuid(), source_hash: z.string().regex(/^[a-f0-9]{64}$/), net_cost_minor: z.literal("0"), currency: z.string().regex(/^[A-Z]{3}$/) }).safeParse(response.data);
    return receipt.success ? { ok: true, proposalId: receipt.data.proposal_id, outcome: "PROPOSED" } : { ok: false, code: "INVALID_RESPONSE" };
  } catch { return { ok: false, code: "UNAVAILABLE" }; }
}

export async function decideFinanceZeroCost(client: SupabaseClient, input: z.input<typeof decisionSchema>): Promise<FinanceCostCommandResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "VALIDATION" };
  try {
    const value = parsed.data;
    const response = await client.rpc("decide_credit_economic_cost_v1", { p_proposal_id: value.proposalId, p_expected_source_hash: value.sourceHash, p_approved: value.approved, p_reason: value.reason });
    if (response.error) return { ok: false, code: failure(response.error) };
    const receipt = z.object({ outcome: z.enum(["CREDIT_ECONOMIC_COST_RECONCILED", "CREDIT_ECONOMIC_COST_REJECTED"]), proposal_id: z.string().uuid(), net_cost_minor: z.literal("0"), currency: z.string().regex(/^[A-Z]{3}$/) }).safeParse(response.data);
    const expected = value.approved ? "CREDIT_ECONOMIC_COST_RECONCILED" : "CREDIT_ECONOMIC_COST_REJECTED";
    return receipt.success && receipt.data.proposal_id === value.proposalId && receipt.data.outcome === expected
      ? { ok: true, proposalId: value.proposalId, outcome: value.approved ? "APPROVED" : "REJECTED" }
      : { ok: false, code: "INVALID_RESPONSE" };
  } catch { return { ok: false, code: "UNAVAILABLE" }; }
}

/** Access remains a server-side, audited download; no caller boolean is a review receipt. */
export async function downloadFinanceCostEvidence(evidence: FinanceCostEvidence, request: typeof fetch = fetch): Promise<{ok:true;blob:Blob}|{ok:false;code:FinanceCostReviewFailure}> {
  const parsed = evidenceSchema.safeParse(evidence);
  if (!parsed.success) return { ok: false, code: "VALIDATION" };
  try {
    const response = await request(`/api/finance/cost-proofs/${evidence.uploadId}`, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return { ok: false, code: await financeCostHttpPrerequisite(response) ?? (response.status === 409 ? "EVIDENCE_REQUIRED" : "UNAVAILABLE") };
    const blob = await response.blob();
    if (blob.size !== evidence.sizeBytes || blob.type.split(";")[0] !== evidence.mimeType) return { ok: false, code: "INVALID_RESPONSE" };
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, "0")).join("");
    return digest === evidence.sha256 ? { ok: true, blob } : { ok: false, code: "INVALID_RESPONSE" };
  } catch { return { ok: false, code: "UNAVAILABLE" }; }
}

export type FinanceCostProofDocument = FinanceCostEvidence & { status: "RESERVED" | "UPLOADED"; scanStatus: "PENDING" | "CLEAN" | "REJECTED" | "ERROR"; revoked: boolean; canRetry: boolean };
export type FinanceCostProofPage = { page: number; hasMore: boolean; documents: FinanceCostProofDocument[]; proposals: FinanceCostReviewProposal[] };
const documentDto = z.object({ upload_id: z.string().uuid(), file_name: z.string().min(1).max(180), sha256: z.string().regex(/^[a-f0-9]{64}$/), mime_type: z.enum(["application/pdf", "image/jpeg", "image/png"]), size_bytes: z.number().int().positive().max(10485760), status: z.enum(["RESERVED", "UPLOADED"]), scan_status: z.enum(["PENDING", "CLEAN", "REJECTED", "ERROR"]), revoked: z.boolean(), can_retry: z.boolean().optional() });
const proposalDto = z.object({ id: z.string().uuid(), component: financeCostComponentSchema, target_id: z.string().uuid(), source_hash: z.string().regex(/^[a-f0-9]{64}$/), currency: z.string().regex(/^[A-Z]{3}$/), status: z.enum(["PENDING", "APPROVED", "REJECTED"]), can_decide: z.boolean(), proof: documentDto.pick({ upload_id: true, file_name: true, sha256: true, mime_type: true, size_bytes: true }) });
const pageDto = z.object({ page: z.number().int().min(1).max(10000), page_size: z.literal(20), has_more: z.boolean(), documents: z.array(documentDto).max(20), proposals: z.array(proposalDto).max(20) });
export async function readFinanceCostProofPage(client: SupabaseClient, target: FinanceCostTarget, page: number): Promise<{ok:true;value:FinanceCostProofPage}|{ok:false;code:FinanceCostReviewFailure}> {
  if (!z.string().uuid().safeParse(target.id).success || !financeCostComponentSchema.safeParse(target.component).success || !Number.isSafeInteger(page) || page < 1 || page > 10000) return { ok: false, code: "VALIDATION" };
  try {
    const response = await client.rpc("get_finance_cost_documents_v1", { p_component: target.component, p_target_id: target.id, p_page: page });
    if (response.error) return { ok: false, code: failure(response.error) };
    const parsed = pageDto.safeParse(response.data);
    if (!parsed.success || parsed.data.page !== page || parsed.data.proposals.some(proposal => proposal.component !== target.component || proposal.target_id !== target.id)) return { ok: false, code: "INVALID_RESPONSE" };
    const evidence = (proof: z.infer<typeof proposalDto>["proof"]): FinanceCostEvidence => ({ uploadId: proof.upload_id, fileName: proof.file_name, sha256: proof.sha256, mimeType: proof.mime_type, sizeBytes: proof.size_bytes });
    return { ok: true, value: { page, hasMore: parsed.data.has_more,
      documents: parsed.data.documents.map(document => ({ ...evidence(document), status: document.status, scanStatus: document.scan_status, revoked: document.revoked, canRetry: document.can_retry === true })),
      proposals: parsed.data.proposals.map(proposal => ({ id: proposal.id, component: proposal.component, targetId: proposal.target_id, targetLabel: target.label, sourceHash: proposal.source_hash, currency: proposal.currency, status: proposal.status, canDecide: proposal.can_decide, proof: evidence(proposal.proof) })),
    } };
  } catch { return { ok: false, code: "UNAVAILABLE" }; }
}

/** A request that belongs to an earlier dossier selection never becomes current data. */
export function createLatestFinanceCostProofPageReader() {
  let generation=0;
  return Object.freeze({
    invalidate:()=>{generation+=1;},
    async read(client:SupabaseClient,target:FinanceCostTarget,page:number) {
      const ticket=++generation;
      const result=await readFinanceCostProofPage(client,target,page);
      return ticket===generation?result:null;
    },
  });
}
