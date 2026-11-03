import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ access: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({ loadMyPlatformAccess: m.access, hasPlatformRole: (roles: Set<string>, allowed: string[]) => allowed.some(role => roles.has(role)) }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
import { loadDisputeDecisionContext } from "./server";
import { caseId, economics, evidenceId } from "./fixtures.test-support";
let memberships: { data: unknown; error: unknown }, status: string;
function query(result: () => unknown) { const q: Record<string, unknown> = {}; for (const method of ["select", "eq", "in", "order", "range"]) q[method] = () => q; q.maybeSingle = async () => result(); q.then = (resolve: (value: unknown) => void) => Promise.resolve(result()).then(resolve); return q; }
beforeEach(() => {
 vi.resetAllMocks(); memberships = { data: [], error: null }; status = "MEDIATION_REVIEW";
 m.access.mockResolvedValue({ status: "ok", userId: evidenceId, roles: new Set(["DISPUTE_MANAGER"]), requirementSatisfied: true, client: { from: m.from, rpc: m.rpc } });
 m.rpc.mockResolvedValue({ data: economics, error: null });
 m.from.mockImplementation(table => query(() => table === "dispute_cases" ? { data: { id: caseId, status, response_due_at: "2026-01-01T00:00:00Z", client_organization_id: caseId, provider_organization_id: evidenceId, policy_snapshot: { version: "frozen", content_hash: "a".repeat(64) } }, error: null } : table === "organization_memberships" ? memberships : { data: [{ id: evidenceId, statement: "Motif utilisateur inchangé", evidence_type: "DOCUMENT" }], error: null }));
});
it("allows the independent AAL2 manager with authoritative context and real evidence", async () => { const result = await loadDisputeDecisionContext(caseId); expect(result).toMatchObject({ status: "ready", authorized: true, canDecide: true, policy: { version: "frozen" }, evidence: [{ statement: "Motif utilisateur inchangé" }] }); expect(m.rpc).toHaveBeenCalledWith("get_mission_dispute_economic_context_v1", { p_dispute_case_id: caseId }); });
it("does not offer a decision to a manager who is also a party member", async () => { memberships = { data: [{ id: evidenceId }], error: null }; expect(await loadDisputeDecisionContext(caseId)).toMatchObject({ status: "ready", authorized: false, canDecide: false, restriction: "PARTY_MEMBER" }); });
it("keeps the auditor read-only even with an economic projection", async () => { const access = await m.access(); m.access.mockResolvedValue({ ...access, roles: new Set(["READ_ONLY_AUDITOR"]) }); expect(await loadDisputeDecisionContext(caseId)).toMatchObject({ status: "ready", authorized: false, canDecide: false, restriction: "READ_ONLY" }); });
it("requires MFA before reading the decision payload", async () => { const access = await m.access(); m.access.mockResolvedValue({ ...access, requirementSatisfied: false }); expect(await loadDisputeDecisionContext(caseId)).toEqual({ status: "error", reason: "MFA_REQUIRED" }); expect(m.from).not.toHaveBeenCalled(); });
it("never infers independence from a failed membership lookup", async () => { memberships = { data: null, error: { code: "503" } }; expect(await loadDisputeDecisionContext(caseId)).toEqual({ status: "error", reason: "UNAVAILABLE" }); });
it("keeps an economic lookup failure distinct from an absent signed rule", async () => { m.rpc.mockResolvedValue({ data: null, error: { code: "503" } }); expect(await loadDisputeDecisionContext(caseId)).toEqual({ status: "error", reason: "UNAVAILABLE" }); });
it("accepts explicit missing economics without inventing a zero", async () => { m.rpc.mockResolvedValue({ data: { ...economics, economic_status: "APPROVED_SIGNED_ECONOMIC_RULE_REQUIRED", rule: null }, error: null }); expect(await loadDisputeDecisionContext(caseId)).toMatchObject({ status: "ready", canDecide: true, economics: { rule: null } }); });
it("hides a new decision after closure while retaining authorization for idempotent replay", async () => { status = "CLOSED"; expect(await loadDisputeDecisionContext(caseId)).toMatchObject({ status: "ready", authorized: true, canDecide: false, restriction: "STATE" }); });
it("does not turn unexpected read errors into empty evidence", async () => { m.from.mockImplementation(() => { throw new Error("network"); }); expect(await loadDisputeDecisionContext(caseId)).toEqual({ status: "error", reason: "UNAVAILABLE" }); });
