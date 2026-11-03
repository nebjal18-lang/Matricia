import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({request:vi.fn(),rpc:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/modules/admin/screens/command-center/actions",()=>({requestAdminAction:mocks.request}));
vi.mock("@/modules/franchise/screens/gouvernance/actions",()=>({decideGovernance:vi.fn()}));
vi.mock("@/modules/admin/screens/providers/actions",()=>({decideCompany:vi.fn(),decideQualification:vi.fn(),reviewDocument:vi.fn()}));
import { requestSpaceMutation } from "./space-actions";
beforeEach(()=>{mocks.request.mockReset().mockResolvedValue({status:"success",outcome:"ADMIN_ACTION_APPROVAL_REQUIRED"});mocks.rpc.mockReset().mockResolvedValue({data:"STAGING",error:null});});
describe("contrats des décisions Admin",()=>{
 it("conserve destinataires, contexte, date et canal dans le payload approuvé",async()=>{
  const f=new FormData();for(const[k,v]of Object.entries({locale:"fr",space:"matching",view:"consultation",resourceType:"MATCHING",resourceId:"11111111-1111-4111-8111-111111111111",note:"Objet documenté",context:"Contraintes précises",dueAt:"2026-12-01",channel:"platform",decision:"SEND",targetEnvironment:"DEVELOPMENT"}))f.set(k,v);
  f.append("providerIds","22222222-2222-4222-8222-222222222222");f.append("providerIds","11111111-1111-4111-8111-111111111111");f.append("providerIds","11111111-1111-4111-8111-111111111111");
  await requestSpaceMutation({status:"idle"},f);
  const captured=mocks.request.mock.calls[0]![1]as FormData;
  expect(JSON.parse(String(captured.get("redactedSummary")))).toMatchObject({providerIds:["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222"],context:"Contraintes précises",dueAt:"2026-12-01",channel:"platform",decision:"SEND"});
  expect(captured.get("targetEnvironment")).toBe("STAGING");
 });
 it("refuse les actions lorsque l’environnement DB est absent",async()=>{
  mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"55000"}});
  expect(await requestSpaceMutation({status:"idle"},new FormData())).toEqual({status:"error",reason:"FORBIDDEN"});expect(mocks.request).not.toHaveBeenCalled();
 });
});
