"use server";
import{revalidatePath}from"next/cache";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{reconcileAdminProviderPayment}from"@/modules/admin/data/finance/repository";
import{loadMyPlatformAccess,hasPlatformRole}from"@/modules/shared/lib/account-security/platform-access";
import{manualCreditConsole}from"./manual-credit-model";

export type FinanceActionState={status:"idle"}|{status:"success";batchId:string}|{status:"error";reason:"VALIDATION"|"UNAUTHENTICATED"|"FORBIDDEN"|"CONFLICT"|"FAILED"};
const text=(f:FormData,k:string)=>String(f.get(k)??"");

export async function reconcilePaymentAction(_:FinanceActionState,form:FormData):Promise<FinanceActionState>{
  const locale=text(form,"locale");
  if(!isLocale(locale)||text(form,"confirmed")!=="yes")return{status:"error",reason:"VALIDATION"};
  const result=await reconcileAdminProviderPayment({paymentId:text(form,"paymentId"),invoiceId:text(form,"invoiceId"),amountMinor:text(form,"amountMinor"),idempotencyKey:text(form,"idempotencyKey"),correlationId:text(form,"correlationId")});
  if(result.status==="error")return{status:"error",reason:result.reason==="INVALID_INPUT"||result.reason==="INVALID_RESPONSE"?"VALIDATION":result.reason==="UNAVAILABLE"||result.reason==="MFA_REQUIRED"?"FAILED":result.reason};
  revalidatePath(`/${locale}/administration/finance`);
  return{status:"success",batchId:result.value.batchId};
}

export async function loadManualCreditConsoleAction(input:{page:number;status:string}):Promise<
  {status:"success";value:ReturnType<typeof manualCreditConsole.parse>}
  |{status:"error";reason:"UNAUTHENTICATED"|"MFA_REQUIRED"|"FORBIDDEN"|"UNAVAILABLE"|"INVALID_RESPONSE"|"VALIDATION"}
>{
  const page=Number(input.page);
  const status=String(input.status??"ALL");
  if(!Number.isSafeInteger(page)||page<1||page>100000||!["ALL","PENDING_REVIEW","APPROVED","REJECTED","EXECUTED"].includes(status)){
    return{status:"error",reason:"VALIDATION"};
  }
  const access=await loadMyPlatformAccess();
  if(access.status==="error"){
    return{status:"error",reason:access.reason==="UNAUTHENTICATED"?"UNAUTHENTICATED":access.reason==="INVALID_RESPONSE"?"INVALID_RESPONSE":"UNAVAILABLE"};
  }
  if(!hasPlatformRole(access.roles,["SUPER_ADMIN","FINANCE_MANAGER"]))return{status:"error",reason:"FORBIDDEN"};
  if(!access.requirementSatisfied)return{status:"error",reason:"MFA_REQUIRED"};
  const response=await access.client.rpc("get_manual_credit_grant_console_v1",{p_page:page,p_status:status});
  if(response.error)return{status:"error",reason:response.error.code==="42501"?"FORBIDDEN":"UNAVAILABLE"};
  const parsed=manualCreditConsole.safeParse(response.data);
  if(!parsed.success)return{status:"error",reason:"INVALID_RESPONSE"};
  return{status:"success",value:parsed.data};
}
