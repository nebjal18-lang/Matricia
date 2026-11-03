import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
import{manageNotificationTemplate}from"./actions";
const id="11111111-1111-4111-8111-111111111111";
function form(values:Record<string,string>){const data=new FormData();for(const[key,value]of Object.entries({locale:"fr",idempotencyKey:id,...values}))data.set(key,value);return data;}
beforeEach(()=>{mocks.rpc.mockReset();mocks.getUser.mockResolvedValue({data:{user:{id}}});});
describe("notification template editor",()=>{
 it("previews through authoritative renderer without claiming delivery",async()=>{
  mocks.rpc.mockResolvedValue({data:{outcome:"NOTIFICATION_TEMPLATE_PREVIEW",delivery_sent:false,rendered:[{locale:"fr-MA",subject:"TEST title",body:"TEST body",cta_path:"/fr/client"}]},error:null});
  const result=await manageNotificationTemplate({status:"idle"},form({intent:"preview",templateCode:"SYSTEM_ALERT",sourcePairHash:"a".repeat(64),frSubject:"FR {{title}}",frBody:"FR {{message}}",arSubject:"AR {{title}}",arBody:"AR {{message}}","variable:title":"TEST title","variable:message":"TEST body"}));
  expect(result).toMatchObject({status:"success",rendered:[{body:"TEST body"}]});expect(mocks.rpc).toHaveBeenCalledWith("preview_notification_template_pair_v1",expect.objectContaining({p_variables:{title:"TEST title",message:"TEST body"}}));
 });
 it("does not propose a revision without author confirmation",async()=>{
  expect(await manageNotificationTemplate({status:"idle"},form({intent:"propose",templateCode:"SYSTEM_ALERT",sourcePairHash:"a".repeat(64),frSubject:"FR sujet",frBody:"FR contenu",arSubject:"AR sujet",arBody:"AR contenu",reason:"Test bilingual revision"}))).toEqual({status:"error",reason:"VALIDATION"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("requires explicit independent bilingual review",async()=>{
  expect(await manageNotificationTemplate({status:"idle"},form({intent:"approve",proposalId:id,contentHash:"a".repeat(64),reason:"Independent bilingual review"}))).toEqual({status:"error",reason:"VALIDATION"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("keeps approval pending rather than inventing activation",async()=>{
  mocks.rpc.mockResolvedValue({data:{outcome:"NOTIFICATION_TEMPLATE_PAIR_APPROVAL_RECORDED"},error:null});
  expect(await manageNotificationTemplate({status:"idle"},form({intent:"approve",proposalId:id,contentHash:"a".repeat(64),reason:"Independent bilingual review",reviewConfirmed:"on"}))).toEqual({status:"success",reason:"NOTIFICATION_TEMPLATE_PAIR_APPROVAL_RECORDED"});
 });
 it("does not fulfil an old tracked review without explicit linked execution confirmation",async()=>{
  expect(await manageNotificationTemplate({status:"idle"},form({intent:"fulfil",actionId:id,proposalId:id,reason:"Link actual activation proof"}))).toEqual({status:"error",reason:"VALIDATION"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
});
