import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ execute: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/modules/shared/lib/dispute-economics/command", () => ({ executeDisputeDecision: mocks.execute }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { decideAdminDispute } from "./domain-actions";
import { decideAction } from "@/modules/client/screens/litiges/actions";
import { caseId, evidenceId } from "@/modules/shared/lib/dispute-economics/fixtures.test-support";
function form() { const f = new FormData(); for (const [k,v] of Object.entries({ locale: "ar", caseId, idempotencyKey: evidenceId, outcome: "NON_COMPLIANT_CONFIRMED", reason: "Motif libre à conserver.", evidenceIds: evidenceId, penalty: "99999", commission: "99999", ruleVersion: "FORGED", ruleHash: "f".repeat(64) })) f.set(k,v); return f; }
beforeEach(() => { vi.resetAllMocks(); });
it.each([decideAdminDispute, decideAction])("ignores browser economics and refreshes only after confirmed success", async action => { mocks.execute.mockResolvedValue({ status: "success" }); expect(await action({ status: "idle" }, form())).toEqual({ status: "success" }); expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ caseId, reason: "Motif libre à conserver.", evidenceIds: [evidenceId] })); expect(JSON.stringify(mocks.execute.mock.calls[0])).not.toMatch(/FORGED|99999|ruleHash/); expect(mocks.revalidate).toHaveBeenCalledWith("/ar/administration/litiges"); });
it.each([decideAdminDispute, decideAction])("keeps failed commands out of the success/refresh path", async action => { mocks.execute.mockResolvedValue({ status: "error", reason: "FORBIDDEN" }); expect((await action({ status: "idle" }, form())).status).toBe("error"); expect(mocks.revalidate).not.toHaveBeenCalled(); });
