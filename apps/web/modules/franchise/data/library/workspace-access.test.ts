import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFranchiseLibraryWorkspace } from "./workspace";

const mocks = vi.hoisted(() => ({ franchises: [] as unknown[], memberships: [] as unknown[], error: null as unknown, authError: null as {name?:string;status?:number}|null, authUser: {id:"11111111-1111-4111-8111-111111111111"} as {id:string}|null, from: vi.fn(), rpc: vi.fn() }));
function choiceData(){return{complete:true,items:(mocks.franchises as Array<{id:string;operator_organization_id:string;library_id:string}>).map((f,index)=>({id:f.id,organization_id:f.operator_organization_id,library_id:f.library_id,territory_code:index===0?"TEST_NORD":"TEST_SUD",territory_fr:index===0?"Territoire Nord":"Territoire Sud",territory_ar:index===0?"النطاق الشمالي":"النطاق الجنوبي",library_code:"TEST_LIBRARY",library_fr:"Bibliothèque TEST",library_ar:"مكتبة اختبار",roles:[{code:"FRANCHISE_MANAGER",label_fr:"Responsable franchisé",label_ar:"مسؤول الامتياز"}]}))};}
const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const franchiseId = "33333333-3333-4333-8333-333333333333";
const libraryId = "44444444-4444-4444-8444-444444444444";
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: mocks.authUser }, error:mocks.authError }) }, rpc: (name:string,parameters:unknown)=>name==="franchise_mandate_choices_v1"?Promise.resolve({data:choiceData(),error:null}):mocks.rpc(name,parameters),
  from: (table: string) => {
    mocks.from(table);
    const response = { data: table === "franchises" ? mocks.franchises : mocks.memberships, error: mocks.error };
    const query: Record<string, unknown> = { then: (resolve: (response: unknown) => void) => Promise.resolve(response).then(resolve) };
    for (const method of ["select", "eq", "order", "range"]) query[method] = () => query;
    return query;
  },
}) }));
vi.mock("./demo-overlay", () => ({ overlayFranchiseLibraryDemo: vi.fn((workspace) => workspace) }));

beforeEach(() => { mocks.franchises = []; mocks.memberships = []; mocks.error = null; mocks.rpc.mockReset(); mocks.from.mockClear(); mocks.authError=null; mocks.authUser={id:userId}; });
for (const locale of ["fr", "ar"] as const) describe(`Franchise workspace access ${locale}`, () => {
  it.each([null,{id:userId}])("keeps an Auth outage technical even with cached user %j", async user => {
    mocks.authError={name:"AuthRetryableFetchError",status:503}; mocks.authUser=user;
    expect(await loadFranchiseLibraryWorkspace({locale})).toEqual({status:"error",reason:"QUERY_FAILED"});
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([{status:401},{name:"AuthSessionMissingError"}])("requires login only for a known missing/invalid session %j", async error=>{
    mocks.authError=error; mocks.authUser=null;
    expect(await loadFranchiseLibraryWorkspace({locale})).toEqual({status:"error",reason:"UNAUTHENTICATED"});
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("reports the absence of an active visible mandate without querying a fabricated franchise", async () => {
    expect(await loadFranchiseLibraryWorkspace({ locale })).toEqual({ status: "error", reason: "NO_MANDATE" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps a failed membership/mandate read distinct from absence", async () => {
    mocks.error = { code: "08006" };
    expect(await loadFranchiseLibraryWorkspace({ locale })).toEqual({ status: "error", reason: "QUERY_FAILED" });
  });
  it("requires an explicit mandate when two authorized mandates share one organization and library",async()=>{
    const second="33333333-3333-4333-8333-333333333334";
    mocks.franchises=[franchiseId,second].map(id=>({id,library_id:libraryId,operator_organization_id:organizationId,franchise_type:"STANDARD",operator_code:"FRANCHISEE",status:"ACTIVE"}));
    mocks.memberships=[{organization_id:organizationId,organization_member_roles:[{role_code:"FRANCHISE_MANAGER",franchise_id:franchiseId,revoked_at:null,organization_member_franchise_assignments:[{franchise_id:franchiseId,revoked_at:null},{franchise_id:second,revoked_at:null}]}]}];
    expect(await loadFranchiseLibraryWorkspace({locale,organizationId,libraryId})).toEqual({status:"error",reason:"MANDATE_REQUIRED",availableMandates:expect.arrayContaining([{id:franchiseId,organizationId,libraryId,label:locale==="ar"?"النطاق الشمالي (TEST_NORD) · مكتبة اختبار · مسؤول الامتياز":"Territoire Nord (TEST_NORD) · Bibliothèque TEST · Responsable franchisé"},{id:second,organizationId,libraryId,label:locale==="ar"?"النطاق الجنوبي (TEST_SUD) · مكتبة اختبار · مسؤول الامتياز":"Territoire Sud (TEST_SUD) · Bibliothèque TEST · Responsable franchisé"}])});
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({data:null,error:{code:"42501"}});
    expect(await loadFranchiseLibraryWorkspace({locale,organizationId,libraryId,franchiseId:second})).toEqual({status:"error",reason:"FORBIDDEN"});
    expect(mocks.rpc).toHaveBeenCalledWith("franchise_catalog_page",expect.objectContaining({p_franchise_id:second}));
  });
  it("keeps an authorized-context RPC denial distinct from a server failure", async () => {
    mocks.franchises = [{ id: franchiseId, library_id: libraryId, operator_organization_id: organizationId, franchise_type: "STANDARD", operator_code: "SYNTHETIC", status: "ACTIVE" }];
    mocks.memberships = [{ organization_id: organizationId, organization_member_roles: [{ role_code: "FRANCHISE_OWNER", franchise_id: franchiseId, revoked_at: null }] }];
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "FRANCHISE_CATALOG_SCOPE_DENIED" } });
    expect(await loadFranchiseLibraryWorkspace({ locale, organizationId })).toEqual({ status: "error", reason: "FORBIDDEN" });
    expect(mocks.rpc).toHaveBeenCalledWith("franchise_catalog_page", expect.objectContaining({ p_franchise_id: franchiseId }));
  });
});
