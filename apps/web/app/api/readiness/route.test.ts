import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc }) }));
import { GET } from "./route";
beforeEach(() => { rpc.mockReset(); vi.stubEnv("READINESS_REQUIRED_SERVICES", "MATRICIA_WORKER"); rpc.mockImplementation(async (name: string,args?:{p_environment?:string}) => name === "readiness_status" ? { data: [{ database_ok: true, outbox_ok: true }], error: null } : name === "operational_health_v1" ? { data: { dependencies_ok: true }, error: null } : name === "check_platform_privacy_readiness_v1" ? {data:{environment:args?.p_environment,required:args?.p_environment === "PRODUCTION",ready:false},error:null} : { data: null, error: { code: "55000", message: "private legal metadata" } }); });
afterEach(() => vi.unstubAllEnvs());
it("fails production readiness when the trusted platform-controller register is unavailable", async () => {
 vi.stubEnv("APP_ENV", "production"); const response = await GET(); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private legal metadata"); expect(rpc).toHaveBeenCalledWith("check_platform_privacy_readiness_v1", { p_environment: "PRODUCTION" });
});
it("requires required=true and exact production context in the authoritative result", async () => {
 vi.stubEnv("APP_ENV", "production"); rpc.mockImplementation(async (name: string) => name === "check_platform_privacy_readiness_v1" ? { data: { environment: "STAGING", required: false, ready: true }, error: null } : name === "readiness_status" ? { data: [{ database_ok: true, outbox_ok: true }], error: null } : { data: { dependencies_ok: true }, error: null });
 expect((await GET()).status).toBe(503);
});
it("can report ready only after authoritative production privacy approval and service checks", async () => {
 vi.stubEnv("APP_ENV", "production"); rpc.mockImplementation(async (name: string) => name === "check_platform_privacy_readiness_v1" ? { data: { environment: "PRODUCTION", required: true, ready: true }, error: null } : name === "readiness_status" ? { data: [{ database_ok: true, outbox_ok: true }], error: null } : { data: { dependencies_ok: true }, error: null });
 expect((await GET()).status).toBe(200);
});
it("does not demand a platform-controller register from each development client", async () => {
 vi.stubEnv("APP_ENV", "development"); expect((await GET()).status).toBe(200); expect(rpc).toHaveBeenCalledWith("check_platform_privacy_readiness_v1", {p_environment:"DEVELOPMENT"});
});
it("fails closed when production has no explicit application environment", async () => {
 vi.stubEnv("APP_ENV", ""); vi.stubEnv("NODE_ENV", "production"); expect((await GET()).status).toBe(503);
});

it("requires the configured HTTP scanner heartbeat in the default production service set",async()=>{
 vi.stubEnv("READINESS_REQUIRED_SERVICES","");vi.stubEnv("APP_ENV","production");await GET();expect(rpc).toHaveBeenCalledWith("operational_health_v1",expect.objectContaining({p_required_services:expect.arrayContaining(["MATRICIA_WORKER","CLAMAV","SCANNER_HTTP"])}));
});
it("requires bounded media execution heartbeat only when marketing is enabled",async()=>{
 vi.stubEnv("READINESS_REQUIRED_SERVICES","");vi.stubEnv("APP_ENV","production");vi.stubEnv("MARKETING_AUTOPILOT_ENABLED","true");await GET();expect(rpc).toHaveBeenCalledWith("operational_health_v1",expect.objectContaining({p_required_services:expect.arrayContaining(["MARKETING_MEDIA"])}));
 rpc.mockClear();vi.stubEnv("MARKETING_AUTOPILOT_ENABLED","false");await GET();expect(rpc.mock.calls.find(([name])=>name==="operational_health_v1")?.[1]?.p_required_services).not.toContain("MARKETING_MEDIA");
});

it("refuses a staging app pointed at a production-tagged database instead of skipping legal checks",async()=>{
 vi.stubEnv("APP_ENV","staging");rpc.mockImplementation(async(name:string)=>name==="check_platform_privacy_readiness_v1"?{data:null,error:{code:"42501",message:"ADMIN_DEPLOYMENT_ENVIRONMENT_MISMATCH"}}:name==="readiness_status"?{data:[{database_ok:true,outbox_ok:true}],error:null}:{data:{dependencies_ok:true},error:null});
 const response=await GET();expect(response.status).toBe(503);expect(rpc).toHaveBeenCalledWith("check_platform_privacy_readiness_v1",{p_environment:"STAGING"});expect(await response.text()).not.toContain("ADMIN_DEPLOYMENT_ENVIRONMENT_MISMATCH");
});

it("includes the independent DSR file scanner in the production service contract",async()=>{vi.stubEnv("READINESS_REQUIRED_SERVICES","");vi.stubEnv("APP_ENV","production");await GET();expect(rpc).toHaveBeenCalledWith("operational_health_v1",expect.objectContaining({p_required_services:expect.arrayContaining(["PRIVACY_FILE_SCANNER"])}));});
