"use server";
import{revalidatePath}from"next/cache";
import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{joinDecisionSchema,joinRequestSchema,type JoinState}from"./model";
const localeSchema=z.enum(["fr","ar"]);
function failure(code?:string):JoinState{return{status:"error",reason:code==="42501"?"FORBIDDEN":code==="54000"?"RATE_LIMIT":["40001","22000","55000"].includes(code??"")?"CONFLICT":"UNAVAILABLE"};}
export async function requestJoin(_:JoinState,form:FormData):Promise<JoinState>{
 const locale=localeSchema.safeParse(form.get("locale")),p=joinRequestSchema.safeParse(Object.fromEntries(form));if(!locale.success||!p.success)return{status:"error",reason:"VALIDATION"};
 const client=await getSupabaseServerClient(),r=await client.rpc("request_organization_join_v1",{p_ice:p.data.ice,p_requested_role_code:p.data.role,p_message:p.data.message,p_idempotency_key:p.data.key});
 if(r.error)return failure(r.error.code);
 if(!z.object({outcome:z.literal("JOIN_REQUEST_RECORDED"),receipt_id:z.string().uuid()}).safeParse(r.data).success)return failure();
 revalidatePath(`/${locale.data}/organisation/rattachements`);return{status:"success",outcome:"JOIN_REQUEST_RECORDED"};
}
export async function decideJoin(_:JoinState,form:FormData):Promise<JoinState>{
 const locale=localeSchema.safeParse(form.get("locale")),p=joinDecisionSchema.safeParse(Object.fromEntries(form));if(!locale.success||!p.success)return{status:"error",reason:"VALIDATION"};
 const client=await getSupabaseServerClient(),r=await client.rpc("decide_organization_join_v1",{p_receipt_id:p.data.id,p_accept:p.data.accept==="yes",p_expected_row_version:p.data.version,p_expected_request_hash:p.data.hash,p_reason:p.data.reason,p_idempotency_key:p.data.key});
 if(r.error)return failure(r.error.code);
 const parsed=z.object({outcome:z.enum(["JOIN_REQUEST_APPROVED","JOIN_REQUEST_REJECTED"]),receipt_id:z.string().uuid()}).safeParse(r.data);if(!parsed.success)return failure();
 revalidatePath(`/${locale.data}/organisation/rattachements`);revalidatePath(`/${locale.data}/organisation`);return{status:"success",outcome:parsed.data.outcome};
}
