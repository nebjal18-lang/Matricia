import {z} from "zod";
import {readAllPages} from "@/modules/shared/lib/data/read-pages";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
export type QuoteRevisionInProgress={quoteId:string;publishedVersionId:string};
export async function loadQuoteRevisionsInProgress(rfqId:string):Promise<{status:"success";revisions:QuoteRevisionInProgress[]}|{status:"error"}> {
 if(!z.string().uuid().safeParse(rfqId).success)return{status:"error"};
 const client=await getSupabaseServerClient();
 const result=await readAllPages((from,to)=>client.from("quotes").select("id,last_published_version_id").eq("rfq_id",rfqId).in("status",["REVISED","REVISION_REQUESTED"]).not("last_published_version_id","is",null).order("id").range(from,to));
 const parsed=z.array(z.object({id:z.string().uuid(),last_published_version_id:z.string().uuid()})).safeParse(result.data);
 return result.error||!parsed.success?{status:"error"}:{status:"success",revisions:parsed.data.map(row=>({quoteId:row.id,publishedVersionId:row.last_published_version_id}))};
}
