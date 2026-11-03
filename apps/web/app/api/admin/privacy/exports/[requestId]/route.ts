import{createHash}from"node:crypto";
import{NextResponse}from"next/server";
import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
export const dynamic="force-dynamic";
export async function GET(_:Request,{params}:{params:Promise<{requestId:string}>}){
 const{requestId}=await params;if(!z.string().uuid().safeParse(requestId).success)return NextResponse.json({error:"INVALID_REQUEST"},{status:400});const c=await getSupabaseServerClient();const{data:auth}=await c.auth.getUser();if(!auth.user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
 const r=await c.rpc("generate_admin_dsr_export_v1",{p_request_id:requestId});if(r.error)return NextResponse.json({error:r.error.code==="42501"?"FORBIDDEN":r.error.code==="55000"?"BOUNDED_EXPORT_UNAVAILABLE":"EXPORT_UNAVAILABLE"},{status:r.error.code==="42501"?403:503,headers:{"Cache-Control":"no-store"}});
 const parsed=z.object({export_json:z.string().max(16777216),sha256:z.string().regex(/^[a-f0-9]{64}$/u),proof_id:z.string().uuid()}).safeParse(r.data);if(!parsed.success)return NextResponse.json({error:"INVALID_EXPORT"},{status:503});const bytes=Buffer.from(parsed.data.export_json,"utf8");if(createHash("sha256").update(bytes).digest("hex")!==parsed.data.sha256)return NextResponse.json({error:"EXPORT_INTEGRITY_ERROR"},{status:503});
 return new NextResponse(bytes,{headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":`attachment; filename="privacy-${requestId}-${parsed.data.proof_id}.json"`,"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Matricia-Export-SHA256":parsed.data.sha256}});
}
