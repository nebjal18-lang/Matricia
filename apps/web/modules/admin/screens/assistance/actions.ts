"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
export type AssistanceState={status:"idle"|"success"|"error"};
export async function replyAssistance(_:AssistanceState,form:FormData):Promise<AssistanceState>{
 const text=(key:string)=>String(form.get(key)??"");
 const locale=text("locale");
 const parsed=z.object({id:z.string().uuid(),body:z.string().trim().min(3).max(10000),key:z.string().uuid()}).safeParse({id:text("requestId"),body:text("body"),key:text("idempotencyKey")});
 if(!isLocale(locale)||!parsed.success)return{status:"error"};
 const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();if(!auth.user)return{status:"error"};
 const result=await client.rpc("reply_client_assistance",{p_request_id:parsed.data.id,p_body:parsed.data.body,p_close:form.get("close")==="on",p_idempotency_key:parsed.data.key});
 if(result.error||!z.string().uuid().safeParse(result.data).success)return{status:"error"};
 revalidatePath(`/${locale}/administration/assistance/${parsed.data.id}`);revalidatePath(`/${locale}/administration/command-center`);return{status:"success"};
}
