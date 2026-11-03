"use server";
import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
const input=z.object({franchiseId:z.string().uuid(),kind:z.enum(["QUESTION","RULE"]),search:z.string().trim().max(120),page:z.number().int().positive().max(100000)});
const item=z.object({id:z.string().uuid(),objectId:z.string().uuid(),code:z.string(),labelFr:z.string(),labelAr:z.string(),answerType:z.string().nullable(),status:z.string(),version:z.number().int()});
export type BankItem=z.infer<typeof item>;
export async function searchFranchiseBank(raw:z.infer<typeof input>):Promise<{status:"error"}|{status:"success";items:BankItem[];total:number;page:number}>{const parsed=input.safeParse(raw);if(!parsed.success)return{status:"error"};const value=parsed.data;const client=await getSupabaseServerClient();const result=await client.rpc("franchise_catalog_bank",{p_franchise_id:value.franchiseId,p_kind:value.kind,p_search:value.search,p_page:value.page});const response=z.object({items:z.array(item),total:z.number().int().nonnegative(),page:z.number().int().positive()}).safeParse(result.data);return result.error||!response.success?{status:"error"}:{status:"success",...response.data};}
