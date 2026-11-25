import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),baseline:vi.fn(),rpc:vi.fn(),filters:[]as Array<[string,string]>}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.user},rpc:mocks.rpc,from:()=>{const q={select:()=>q,eq:(key:string,value:string)=>{mocks.filters.push([key,value]);return q;},maybeSingle:mocks.baseline};return q;}})}));
import { calculateRoi, createReferralLink, recordSavings, submitBaseline } from "./actions";
const id=(n:number)=>`a3290000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const idle={status:"idle"}as const;
const actual={uiLocale:"fr",baselineId:id(1),recommendationId:id(2),amount:"1,234",cost:"0,500",actualPeriodStart:"2026-01-01",actualPeriodEnd:"2026-01-31",actualSourceType:"INVOICE",actualSourceReference:"TEST-0329-INVOICE",documentId:id(3),formulaVersion:"ROI_V1",idempotencyKey:id(4)};
function form(values:Record<string,string>){const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,v);return f;}
beforeEach(()=>{vi.clearAllMocks();mocks.filters=[];mocks.user.mockResolvedValue({data:{user:{id:id(9)}},error:null});mocks.baseline.mockResolvedValue({data:{currency:"KWD"},error:null});mocks.rpc.mockResolvedValue({data:{outcome:"VERIFIED_RESULT"},error:null});});
describe("measurement currency authority",()=>{
 it("interprets referral expiry as Casablanca wall time independently of the host",async()=>{
  expect((await createReferralLink(idle,form({uiLocale:"fr",organizationId:id(5),referralCode:"TEST_REFERRAL",audienceType:"CLIENT",campaignReference:"TEST_CAMPAIGN",expiresAt:"2024-11-01T09:00",maxConversions:"10",idempotencyKey:id(4)}))).status).toBe("success");
  expect(mocks.rpc).toHaveBeenCalledWith("create_referral_link",expect.objectContaining({p_expires_at:"2024-11-01T08:00:00.000Z"}));
 });
 it.each(["2024-02-30T09:00","2024-04-14T02:30","2024-03-10T02:30"])("rejects impossible or ambiguous referral expiry %s",async expiresAt=>{
  expect(await createReferralLink(idle,form({uiLocale:"fr",organizationId:id(5),referralCode:"TEST_REFERRAL",audienceType:"CLIENT",campaignReference:"TEST_CAMPAIGN",expiresAt,maxConversions:"10",idempotencyKey:id(4)}))).toEqual({status:"error",reason:"VALIDATION"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it.each([["JPY","100","100"],["KWD","1,234","1234"],["KWD","١٫٢٣٤","1234"],["JPY","9007199254740993","9007199254740993"]])("submits an exact %s baseline",async(currency,amount,expected)=>{
  const f=form({uiLocale:"ar",organizationId:id(5),subjectChoice:`ORGANIZATION:${id(5)}`,metricCode:"ANNUAL_COST",amount,currency,periodStart:"2026-01-01",periodEnd:"2026-01-31",sourceType:"INVOICE",sourceReference:"TEST-0329-INVOICE",documentId:id(3),methodologyVersion:"BASELINE_V1",idempotencyKey:id(4)});
  expect((await submitBaseline(idle,f)).status).toBe("success");
  expect(mocks.rpc).toHaveBeenCalledWith("capture_client_baseline_with_document_v1",expect.objectContaining({p_baseline_amount_minor:expected,p_currency:currency}));
 });
 it("derives ROI amounts and costs from the verified baseline currency",async()=>{
  expect((await calculateRoi(idle,form({...actual,currency:"JPY"}))).status).toBe("success");
  expect(mocks.filters).toEqual([["id",id(1)],["verification_status","VERIFIED"]]);
  expect(mocks.rpc).toHaveBeenCalledWith("calculate_client_roi_with_document_v1",expect.objectContaining({p_actual_amount_minor:"1234",p_implementation_cost_minor:"500"}));
 });
 it.each([["JPY","100","100"],["KWD","1,234","1234"],["KWD","٩٠٠٧١٩٩٢٥٤٧٤٠٫٩٩٣","9007199254740993"]])("records %s savings without taking a hidden currency as authority",async(currency,amount,expected)=>{
  mocks.baseline.mockResolvedValue({data:{currency},error:null});
  expect((await recordSavings(idle,form({...actual,amount,currency:"MAD"}))).status).toBe("success");
  expect(mocks.rpc).toHaveBeenCalledWith("record_client_savings_with_document_v1",expect.objectContaining({p_actual_amount_minor:expected}));
 });
 it("refuses a fractional JPY amount instead of silently multiplying or rounding it",async()=>{
  mocks.baseline.mockResolvedValue({data:{currency:"JPY"},error:null});
  expect(await calculateRoi(idle,form({...actual,amount:"100.5",cost:"1"}))).toEqual({status:"error",reason:"VALIDATION"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("never falls back to MAD when the authorized baseline cannot be read",async()=>{
  mocks.baseline.mockResolvedValueOnce({data:null,error:null});
  expect(await recordSavings(idle,form(actual))).toEqual({status:"error",reason:"FORBIDDEN"});
  mocks.baseline.mockResolvedValueOnce({data:null,error:{code:"08006"}});
  expect(await recordSavings(idle,form(actual))).toEqual({status:"error",reason:"FAILED"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("keeps a missing session separate from an identity-service outage",async()=>{
  mocks.user.mockResolvedValueOnce({data:{user:null},error:{name:"AuthSessionMissingError",status:400}});
  expect(await recordSavings(idle,form(actual))).toEqual({status:"error",reason:"UNAUTHENTICATED"});
  mocks.user.mockResolvedValueOnce({data:{user:null},error:{name:"AuthRetryableFetchError",status:503}});
  expect(await recordSavings(idle,form(actual))).toEqual({status:"error",reason:"FAILED"});expect(mocks.rpc).not.toHaveBeenCalled();
 });

});
