import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { statementExport,statementCsv } from "@/modules/franchise/data/documents/model";
export async function GET(request:Request,{params}:{params:Promise<{closureId:string}>}){
 const{closureId}=await params;const franchiseId=new URL(request.url).searchParams.get("franchiseId");
 if(!z.string().uuid().safeParse(closureId).success||!z.string().uuid().safeParse(franchiseId).success)return new Response("INVALID_STATEMENT_REFERENCE",{status:400});
 const client=await getSupabaseServerClient();const response=await client.rpc("franchise_statement_export",{p_franchise_id:franchiseId,p_closure_id:closureId,p_format:"CSV"});const result=statementExport.safeParse(response.data);
 if(response.error||!result.success)return new Response("STATEMENT_ACCESS_DENIED",{status:403,headers:{"Cache-Control":"private, no-store"}});
 return new Response(statementCsv(result.data),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="releve-${closureId}-v${result.data.version}.csv"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
