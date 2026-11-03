import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requestWindowClosure, decideWindowClosure } from "./commands";
import { calendarRpcFailure, type WindowConflict, type WindowRequest } from "./model";
const id = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222", hash = "a".repeat(64), time = "2026-11-03T10:00:00+00:00";
export const conflict: WindowConflict = { releaseId: id, libraryId: other, libraryCode: "Catalogue TEST", releaseKey: "Ancienne publication TEST", expectedSnapshotHash: hash, rowVersion: 2, effectiveFrom: time, effectiveUntil: null, currentReleaseId: other, currentReleaseKey: "Publication courante TEST", canRequest: true };
export const review: WindowRequest = { id: other, libraryId: other, libraryCode: "Catalogue TEST", releaseId: id, releaseKey: "Ancienne publication TEST", currentReleaseKey: "Publication courante TEST", sourceHash: hash, reason: "Texte libre غير مترجم", requestedBy: id, requestedAt: time, status: "PENDING", canDecide: true, sourceChanged: false, decisionReason: null, closedAt: null };
const rpc = vi.fn(), client = { rpc } as unknown as SupabaseClient, key = "33333333-3333-4333-8333-333333333333";
beforeEach(() => { rpc.mockReset(); });
describe("native governed catalogue calendar commands", () => {
    it("requests closure against the exact selected immutable source with stable retry identity", async () => {
        rpc.mockResolvedValue({ data: { outcome: "CATALOG_RELEASE_WINDOW_CLOSURE_REQUESTED", request_id: other, source_hash: hash }, error: null });
        for (let n = 0; n < 2; n++)
            expect(await requestWindowClosure(client, conflict, "Motif libre عربي conservé", key)).toEqual({ ok: true });
        expect(rpc).toHaveBeenCalledWith("request_catalog_release_window_closure_v1", { p_release_id: id, p_expected_row_version: 2, p_expected_snapshot_hash: hash, p_reason: "Motif libre عربي conservé", p_idempotency_key: key });
    });
    it("keeps a lost response unconfirmed instead of inventing an approved outcome", async () => {
        rpc.mockRejectedValue(new Error("internal endpoint"));
        expect(await requestWindowClosure(client, conflict, "Motif suffisamment précis", key)).toEqual({ ok: false, reason: "QUERY_FAILED" });
    });
    it("prevents approval after source changes while still permitting an independent rejection", async () => {
        const changed = { ...review, sourceChanged: true };
        expect(await decideWindowClosure(client, changed, true, "Motif de la décision", key)).toEqual({ ok: false, reason: "VALIDATION" });
        expect(rpc).not.toHaveBeenCalled();
        rpc.mockResolvedValue({ data: { outcome: "CATALOG_RELEASE_WINDOW_CLOSURE_REJECTED", request_id: other, release_id: id, effective_until: null }, error: null });
        expect(await decideWindowClosure(client, changed, false, "Source modifiée, demande rejetée", key)).toEqual({ ok: true });
        expect(rpc).toHaveBeenCalledWith("decide_catalog_release_window_closure_v1", expect.objectContaining({ p_request_id: other, p_expected_source_hash: hash, p_approved: false }));
    });
    it("refuses a capability-free or terminal decision before mutation", async () => {
        for (const source of [{ ...review, canDecide: false }, { ...review, status: "CLOSED" as const }])
            expect(await decideWindowClosure(client, source, true, "Motif de la décision", key)).toMatchObject({ ok: false });
        expect(rpc).not.toHaveBeenCalled();
    });
    it("does not accept a receipt for a different release or decision", async () => {
        rpc.mockResolvedValue({ data: { outcome: "CATALOG_RELEASE_WINDOW_CLOSED", request_id: other, release_id: other, effective_until: time }, error: null });
        expect(await decideWindowClosure(client, review, true, "Clôture vérifiée indépendamment", key)).toEqual({ ok: false, reason: "INVALID_RESPONSE" });
    });
    it.each([["42501", "CENTRAL_MFA_REQUIRED", "MFA_REQUIRED"], ["42501", "CATALOG_SCOPE_DENIED", "FORBIDDEN"], ["42501", "CATALOG_AUTH_REQUIRED", "UNAUTHENTICATED"], ["40001", "SOURCE_CHANGED", "CONFLICT"], ["55000", "SOURCE_INELIGIBLE", "CONFLICT"], ["PGRST202", "MISSING", "CONFIGURATION"], ["08006", "CONNECTION", "QUERY_FAILED"]])("keeps %s/%s distinct", async (code, message, reason) => {
        expect(calendarRpcFailure({ code, message })).toBe(reason);
        rpc.mockResolvedValue({ data: null, error: { code, message } });
        expect(await requestWindowClosure(client, conflict, "Motif de la demande", key)).toEqual({ ok: false, reason });
    });
    it("validates justification and idempotency before request", async () => {
        expect(await requestWindowClosure(client, conflict, "court", key)).toMatchObject({ ok: false, reason: "VALIDATION" });
        expect(await requestWindowClosure(client, conflict, "Motif de la demande", "not-a-key")).toMatchObject({ ok: false });
        expect(rpc).not.toHaveBeenCalled();
    });
});
