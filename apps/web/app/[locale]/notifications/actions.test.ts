vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));import{beforeEach,describe,expect,it,vi}from"vitest";const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}));vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));vi.mock("@/modules/shared/lib/i18n/locale",()=>({isLocale:(v:string)=>v==="fr"||v==="ar"}));vi.mock("@/modules/shared/lib/notifications/model",async()=>await import("@/modules/shared/lib/notifications/model"));import{markNotificationRead,saveNotificationPreference,type NotificationActionState}from"./actions";const idle:NotificationActionState={status:"idle"},org="11111111-1111-4111-8111-111111111111",notification="22222222-2222-4222-8222-222222222222",key="33333333-3333-4333-8333-333333333333";function base(){const f=new FormData();f.set("uiLocale","fr");f.set("idempotencyKey",key);return f}beforeEach(()=>{mocks.getUser.mockReset().mockResolvedValue({data:{user:{id:"user"}}});mocks.rpc.mockReset().mockResolvedValue({data:{outcome:"OK"},error:null})});describe("notification actions",()=>{it("maps a digest preference to the user RPC",async()=>{const f=base();f.set("organizationId",org);f.set("categoryCode","MISSION");f.set("channel","EMAIL");f.set("deliveryMode","DIGEST");f.set("digestFrequency","DAILY");f.set("notificationLocale","fr-MA");f.set("expectedRowVersion","0");await saveNotificationPreference(idle,f);expect(mocks.rpc).toHaveBeenCalledWith("set_notification_preference",expect.objectContaining({p_delivery_mode:"DIGEST",p_digest_frequency:"DAILY"}))});it("calls only mark_notification_read for inbox state",async()=>{const f=base();f.set("notificationId",notification);f.set("expectedRowVersion","1");await markNotificationRead(idle,f);expect(mocks.rpc).toHaveBeenCalledWith("mark_notification_read",expect.objectContaining({p_notification_id:notification}))});it("does not expose a service RPC on invalid input",async()=>{const f=base();await saveNotificationPreference(idle,f);expect(mocks.rpc).not.toHaveBeenCalled()})});

describe("notification failure truth",()=>{
 function validRead(){const f=base();f.set("notificationId",notification);f.set("expectedRowVersion","1");return f}
 it("does not report a transient authentication service outage as logout",async()=>{
  mocks.getUser.mockResolvedValue({data:{user:null},error:{status:503,name:"AuthRetryableFetchError"}});
  expect(await markNotificationRead(idle,validRead())).toEqual({status:"error",reason:"FAILED"});
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("separates expired session, required MFA and denied permission",async()=>{
  mocks.getUser.mockResolvedValueOnce({data:{user:null},error:{status:401,name:"AuthSessionMissingError"}});
  expect(await markNotificationRead(idle,validRead())).toEqual({status:"error",reason:"UNAUTHENTICATED"});
  mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"42501",message:"NOTIFICATION_AAL2_REQUIRED"}});
  expect(await markNotificationRead(idle,validRead())).toEqual({status:"error",reason:"MFA_REQUIRED"});
  mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"42501",message:"NOTIFICATION_READ_DENIED"}});
  expect(await markNotificationRead(idle,validRead())).toEqual({status:"error",reason:"FORBIDDEN"});
 });
 it("reports optimistic-concurrency conflict without a false saved state",async()=>{
  mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"40001",message:"STALE_NOTIFICATION"}});
  expect(await markNotificationRead(idle,validRead())).toEqual({status:"error",reason:"CONFLICT"});
 });
});
