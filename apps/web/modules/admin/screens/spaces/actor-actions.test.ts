import { describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({request:vi.fn(),rpc:vi.fn(),getUser:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({rpc:mocks.rpc,auth:{getUser:mocks.getUser}})}));
vi.mock("@/modules/admin/screens/command-center/actions",()=>({requestAdminAction:mocks.request}));
vi.mock("@/app/[locale]/invitations/actions",()=>({createInvitation:vi.fn()}));
import { requestActorMutation, submitActorInvitation } from "./actor-actions";
import { organizationRoleGates } from "@/modules/admin/data/spaces/role-preview";
describe("droits canoniques",()=>{
 it.each([{error:{status:503,name:"AuthRetryableFetchError"},reason:"UNAVAILABLE"},{error:{status:401,name:"AuthApiError"},reason:"UNAUTHENTICATED"}])("does not submit an invitation after Auth failure $reason",async({error,reason})=>{vi.clearAllMocks();mocks.getUser.mockResolvedValue({data:{user:null},error});const form=new FormData();for(const[key,value]of Object.entries({canInvite:"yes",intent:"INVITE_USER",organizationId:"11111111-1111-4111-8111-111111111111",invitedEmail:"provider@example.invalid",roleCode:"PROVIDER_VIEWER",idempotencyKey:"provider-invitation-test",invitationExpiresAt:"2099-11-02T12:00:00.000Z"}))form.set(key,value);await expect(submitActorInvitation({status:"idle"},form)).resolves.toEqual({status:"error",reason});expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.request).not.toHaveBeenCalled();});
 it("montre l’effet du changement OWNER vers VIEWER sans privilège plateforme",()=>{
  expect(organizationRoleGates("CLIENT_OWNER")).toContain("CLIENT_REQUEST_MANAGE");
  expect(organizationRoleGates("CLIENT_VIEWER")).not.toContain("CLIENT_REQUEST_MANAGE");
  expect(organizationRoleGates("CLIENT_OWNER")).not.toContain("PLATFORM_ADMINISTRATION");
 });
 it("refuse une capacité hors modèle avant tout appel",async()=>{
  const f=new FormData();f.append("capabilities","SUPER_ADMIN_BYPASS");
  expect(await requestActorMutation({status:"idle"},f)).toEqual({status:"error",reason:"VALIDATION"});
  expect(mocks.request).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
 });
});
