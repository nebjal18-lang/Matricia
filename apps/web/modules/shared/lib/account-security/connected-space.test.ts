import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({from:vi.fn(),getUser:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({from:mocks.from,auth:{getUser:mocks.getUser}})}));
vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("NOT_FOUND");}}));
import { resolveConnectedSpace } from "./connected-space";
function response(data:unknown){const q={select:vi.fn(),eq:vi.fn(),order:vi.fn(),maybeSingle:vi.fn(),then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data,error:null}).then(resolve)};for(const f of[q.select,q.eq,q.order,q.maybeSingle])f.mockReturnValue(q);return q;}
beforeEach(() => vi.clearAllMocks());
describe("role independent account workspace",()=>{
 it("keeps a technical auth outage distinct from an expired session", async () => {
   mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } });
   await expect(resolveConnectedSpace({ locale: "fr" })).rejects.toThrow("WORKSPACE_CONTEXT_UNAVAILABLE");
   expect(mocks.from).not.toHaveBeenCalled();
 });
 it.each([401, 403])("requests reconnection for a verified invalid session (%s)", async status => {
   mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status } });
   await expect(resolveConnectedSpace({ locale: "ar" })).resolves.toEqual({ status: "unauthenticated" });
   expect(mocks.from).not.toHaveBeenCalled();
 });
 it.each(["aal1","aal2"])("allows administrator without an organization at %s",async aal=>{mocks.getUser.mockResolvedValue({data:{user:{id:"admin",email:"admin@example.invalid",aal}}});mocks.from.mockReturnValue(response([]));await expect(resolveConnectedSpace({locale:"fr"})).resolves.toMatchObject({status:"success",selectedOrganizationId:null,selectedQuery:""});});
 it.each(["PROVIDER_OWNER","FRANCHISE_OWNER","CLIENT_OWNER"])("preserves authorized organization for %s",async role=>{mocks.getUser.mockResolvedValue({data:{user:{id:role}}});mocks.from.mockImplementation((name:string)=>response(name==="organization_memberships"?[{organization_id:"own"}]:{display_name:"Own company"}));await expect(resolveConnectedSpace({locale:"ar",organizationId:"own"})).resolves.toMatchObject({status:"success",selectedOrganizationId:"own"});});
 it("retains verified personal access when the membership directory fails without inventing an organization", async () => {
   mocks.getUser.mockResolvedValue({ data: { user: { id: "actor", email: "actor@example.invalid" } }, error: null });
   const failed = response([]);
   failed.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: { code: "08006" } }).then(resolve);
   mocks.from.mockReturnValue(failed);
   await expect(resolveConnectedSpace({ locale: "fr", organizationId: "unverified-selection", allowDirectoryFailure: true })).resolves.toMatchObject({ status: "success", selectedOrganizationId: null, selectedQuery: "", directoryUnavailable: true });
 });
 it("does not silently clear the selected organization on a directory failure by default", async () => {
   mocks.getUser.mockResolvedValue({ data: { user: { id: "actor" } }, error: null });
   const failed = response([]);
   failed.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: { code: "08006" } }).then(resolve);
   mocks.from.mockReturnValue(failed);
   await expect(resolveConnectedSpace({ locale: "fr", organizationId: "selected" })).rejects.toThrow("WORKSPACE_CONTEXT_UNAVAILABLE");
 });
 it("never falls back on an unauthorized explicit organization",async()=>{mocks.getUser.mockResolvedValue({data:{user:{id:"actor"}}});mocks.from.mockReturnValue(response([{organization_id:"own"}]));await expect(resolveConnectedSpace({locale:"fr",organizationId:"foreign"})).rejects.toThrow("NOT_FOUND");});
});
