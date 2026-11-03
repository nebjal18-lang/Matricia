import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ decide: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/modules/shared/lib/solution-insights/server-repository", () => ({ createServerSolutionInsightsRepository: async () => ({ decide: mocks.decide }) }));
vi.mock("@/modules/shared/lib/solution-insights/model", async () => await import("@/modules/shared/lib/solution-insights/model"));
import{decideAction}from"./actions";import{idle}from"./state";
const id = "11111111-1111-4111-8111-111111111111";
function form() { const value = new FormData(); value.set("locale", "fr"); value.set("solutionSetId", id); value.set("level", "ESSENTIAL"); value.set("decision", "ACCEPTED"); value.set("reason", "Choix validé"); value.set("deferredUntil", ""); value.set("idempotencyKey", id); return value; }
beforeEach(() => { mocks.decide.mockReset(); mocks.revalidate.mockReset(); });
describe("solution decision action", () => {
  it.each(["UNAUTHENTICATED", "FORBIDDEN", "CONFLICT", "UNAVAILABLE"] as const)("propage l’état %s", async (reason) => { mocks.decide.mockResolvedValue({ status: "error", reason }); await expect(decideAction(idle, form())).resolves.toEqual({ status: "error", reason }); });
  it("refuse une date pour une décision immédiate", async () => { const value = form(); value.set("deferredUntil", "2026-12-01"); await expect(decideAction(idle, value)).resolves.toEqual({ status: "error", reason: "VALIDATION" }); expect(mocks.decide).not.toHaveBeenCalled(); });
  it("revalide uniquement après succès", async () => { mocks.decide.mockResolvedValue({ status: "success", value: { outcome: "SOLUTION_ACCEPTED", decisionId: id, solutionSetId: id, level: "ESSENTIAL" } }); await expect(decideAction(idle, form())).resolves.toEqual({ status: "success" }); expect(mocks.revalidate).toHaveBeenCalledWith("/fr/client/diagnostics/solutions"); });
});
