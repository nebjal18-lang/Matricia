import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
const headers={"Cache-Control":"private, no-store"};
export async function GET(_:Request,{params}:{params:Promise<{proofId:string}>}){
 const id=z.string().uuid().safeParse((await params).proofId);if(!id.success)return Response.json({error:"INVALID_REFERENCE"},{status:400,headers});
 const client=await getSupabaseServerClient(),auth=await client.auth.getUser();if(!auth.data.user)return Response.json({error:"UNAUTHENTICATED"},{status:401,headers});
 // User-bound RLS includes the current Technician assignment and both parties.
 const result=await client.from("delivery_proofs").select("storage_bucket,storage_path,scan_status,url").eq("id",id.data).maybeSingle();
 if(result.error)return Response.json({error:result.error.code==="42501"?"FORBIDDEN":"UNAVAILABLE"},{status:result.error.code==="42501"?403:503,headers});
 const parsed=z.object({storage_bucket:z.literal("delivery-proofs"),storage_path:z.string().nullable(),scan_status:z.string(),url:z.string().nullable()}).safeParse(result.data);
 if(!parsed.success)return Response.json({error:"NOT_FOUND_OR_FORBIDDEN"},{status:404,headers});
 if(parsed.data.scan_status!=="CLEAN")return Response.json({error:"SCAN_REQUIRED"},{status:409,headers});
 if(!parsed.data.storage_path)return Response.json({error:"NO_PRIVATE_FILE"},{status:404,headers});
 const signed=await client.storage.from(parsed.data.storage_bucket).createSignedUrl(parsed.data.storage_path,60,{download:true});
 if(signed.error||!signed.data?.signedUrl)return Response.json({error:"UNAVAILABLE"},{status:503,headers});
 return new Response(null,{status:303,headers:{...headers,Location:signed.data.signedUrl}});
}
