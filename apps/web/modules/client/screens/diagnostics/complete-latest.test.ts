import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), complete: vi.fn(), listServices: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/modules/shared/lib/diagnostics-opportunities/server-repository", () => ({
  createServerDiagnosticsRepository: async () => ({ list: mocks.list, complete: mocks.complete }),
}));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
 getSupabaseServerClient:async()=>({from:(table:string)=>{const chain:Record<string,unknown>={};for(const method of["select","eq","not","order"])chain[method]=vi.fn(()=>chain);chain.limit=table==="questionnaire_sessions"?mocks.list:mocks.listServices;return chain;}}),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("node:crypto", () => ({ randomUUID: () => "99999999-9999-4999-8999-999999999999" }));

import { completeLatestAction } from "./actions";

const sessionId = "11111111-1111-4111-8111-111111111111";
const libraryId = "22222222-2222-4222-8222-222222222222";
const serviceId = "33333333-3333-4333-8333-333333333333";
const organizationId = "55555555-5555-4555-8555-555555555555";

function form() {
  const value = new FormData();
  value.set("locale", "fr");
  value.set("idempotencyKey", "44444444-4444-4444-8444-444444444444");
  value.set("confirmSnapshot", "CONFIRMED");
  value.set("organizationId", organizationId);
  return value;
}

describe("latest client analysis", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the submitted assessment and published engine without inferring a service", async () => {
    mocks.list.mockResolvedValue({data:[{id:sessionId,library_id:libraryId,organization_id:organizationId}],error:null});
    mocks.listServices.mockResolvedValue({ data: [{ id: serviceId }], error: null });
    mocks.complete.mockResolvedValue({ status: "success", value: {diagnostic_run_id:sessionId,opportunity_created:false} });

    await expect(completeLatestAction({ status: "idle" }, form())).resolves.toEqual({ status: "success",diagnosticRunId:sessionId,organizationId });
    expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({ sessionId, serviceId:null }));
    expect(mocks.revalidate).toHaveBeenCalledWith("/fr/client/diagnostics");
  });

  it("does not invent a result when no submitted assessment exists", async () => {
    mocks.list.mockResolvedValue({data:[],error:null});
    await expect(completeLatestAction({ status: "idle" }, form())).resolves.toEqual({ status: "error", reason: "NO_SUBMITTED_ASSESSMENT" });
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("reports missing published policy without fabricating a result",async()=>{
    mocks.list.mockResolvedValue({data:[{id:sessionId,library_id:libraryId,organization_id:organizationId}],error:null});
    mocks.complete.mockResolvedValue({status:"error",reason:"POLICY_REQUIRED"});
    expect(await completeLatestAction({status:"idle"},form())).toEqual({status:"error",reason:"PUBLISHED_POLICY_REQUIRED"});
    expect(mocks.listServices).not.toHaveBeenCalled();
  });

  it("uses an explicit published service choice only after its scoped lookup",async()=>{
    mocks.list.mockResolvedValue({data:[{id:sessionId,library_id:libraryId,organization_id:organizationId}],error:null});
    mocks.listServices.mockResolvedValue({data:[{id:serviceId}],error:null});mocks.complete.mockResolvedValue({status:"success",value:{diagnostic_run_id:sessionId,opportunity_created:false}});
    const value=form();value.set("analysisServiceId",serviceId);
    expect(await completeLatestAction({status:"idle"},value)).toEqual({status:"success",diagnosticRunId:sessionId,organizationId});expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({serviceId}));
    mocks.complete.mockClear();mocks.listServices.mockResolvedValue({data:[],error:null});
    expect(await completeLatestAction({status:"idle"},value)).toEqual({status:"error",reason:"ANALYSIS_SCOPE_REQUIRED"});expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("never falls back to a session from another authorized organization", async () => {
    mocks.list.mockResolvedValue({data:[{id:sessionId,library_id:libraryId,organization_id:"66666666-6666-4666-8666-666666666666"}],error:null});
    await expect(completeLatestAction({ status: "idle" }, form())).resolves.toEqual({ status: "error", reason: "NO_SUBMITTED_ASSESSMENT" });
    expect(mocks.listServices).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
