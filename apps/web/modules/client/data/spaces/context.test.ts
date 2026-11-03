import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ from: mocks.from, auth: { getUser: mocks.getUser } }) }));
import { resolveClientSpace } from "./context";
const org = "11111111-1111-4111-8111-111111111111";
function table(data: unknown[], error: unknown = null) {
 const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), is: vi.fn(), like: vi.fn(), limit: vi.fn(), then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data,error }).then(resolve) };
 for (const method of [query.select,query.eq,query.in,query.is,query.like,query.limit]) method.mockReturnValue(query);
 return query;
}
describe("selected client organization", () => {
 beforeEach(() => { mocks.from.mockReset(); mocks.getUser.mockResolvedValue({ data: { user: { id: "actor", email: "owner@example.invalid" } } }); });
 it("rejects a membership without a Client role instead of falling back to another tenant", async () => {
  mocks.from.mockImplementation((name: string) => name === "organization_memberships" ? table([{ id:"member1",organization_id:org }, { id:"member2",organization_id:"other-org" }]) : table([{ membership_id:"member1" }]));
  await expect(resolveClientSpace({ locale:"fr",organizationId:"other-org" })).rejects.toThrow("NOT_FOUND");
 });
 it("preserves the authorized explicit tenant", async () => {
  mocks.from.mockImplementation((name: string) => name === "organization_memberships" ? table([{id:"member1",organization_id:org}]) : name === "organization_member_roles" ? table([{membership_id:"member1"}]) : table([{display_name:"Entreprise"}]));
  const result=await resolveClientSpace({locale:"fr",organizationId:org});
  expect(result).toMatchObject({status:"success",selectedOrganizationId:org,selectedQuery:`?organizationId=${org}`,organizationName:"Entreprise"});
 });
 it("keeps an auth service outage distinct from an expired session", async () => {
  mocks.getUser.mockResolvedValue({data:{user:null},error:{status:503,name:"AuthRetryableFetchError"}});
  await expect(resolveClientSpace({locale:"fr"})).rejects.toThrow("CLIENT_CONTEXT_UNAVAILABLE");
  expect(mocks.from).not.toHaveBeenCalled();
 });
 it("rejects an organization projection error instead of displaying an unnamed tenant", async () => {
  mocks.from.mockImplementation((name:string)=>name==="organization_memberships"?table([{id:"member1",organization_id:org}]):name==="organization_member_roles"?table([{membership_id:"member1"}]):table([],{code:"503"}));
  await expect(resolveClientSpace({locale:"ar",organizationId:org})).rejects.toThrow("CLIENT_CONTEXT_UNAVAILABLE");
 });
 it("surfaces membership read failure", async () => { mocks.from.mockReturnValue(table([],{code:"503"})); await expect(resolveClientSpace({locale:"fr"})).rejects.toThrow("CLIENT_CONTEXT_UNAVAILABLE"); });
});
