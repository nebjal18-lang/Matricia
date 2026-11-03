import {createHash} from "node:crypto";
import {z} from "zod";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
export const dynamic="force-dynamic";
const headers={"cache-control":"no-store","x-content-type-options":"nosniff"};
const archiveSchema=z.object({bucket:z.literal("private-message-attachments"),path:z.string().regex(/^internal-messages\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/u),sha256:z.string().regex(/^[0-9a-f]{64}$/u),mime_type:z.enum(["application/pdf","image/jpeg","image/png","text/plain"]),size_bytes:z.number().int().min(1).max(10485760),name:z.string().min(1).max(255)});
export async function GET(_request:Request,{params}:{params:Promise<{attachmentId:string}>}){
 try{
 const {attachmentId}=await params;if(!z.string().uuid().safeParse(attachmentId).success)return Response.json({code:"NOT_FOUND"},{status:404,headers});
 const client=await getSupabaseServerClient(),{data:auth}=await client.auth.getUser();if(!auth.user)return Response.json({code:"UNAUTHENTICATED"},{status:401,headers});
 const result=await client.rpc("get_internal_message_attachment_v1",{p_attachment_id:attachmentId}),parsed=archiveSchema.safeParse(result.data);
 if(result.error||!parsed.success)return Response.json({code:"MESSAGE_ATTACHMENT_NOT_AVAILABLE"},{status:result.error?.code==="42501"?404:503,headers});
 const archive=parsed.data,download=await getSupabaseAdminClient().storage.from(archive.bucket).download(archive.path);
 if(download.error||!download.data||download.data.size!==archive.size_bytes)return Response.json({code:"MESSAGE_ATTACHMENT_UNAVAILABLE"},{status:503,headers});
 const bytes=Buffer.from(await download.data.arrayBuffer());if(createHash("sha256").update(bytes).digest("hex")!==archive.sha256)return Response.json({code:"MESSAGE_ATTACHMENT_INTEGRITY_FAILED"},{status:503,headers});
 const fallback=archive.name.replace(/[^a-zA-Z0-9._-]/gu,"_").slice(0,120)||"document";
 return new Response(bytes,{headers:{...headers,"content-type":archive.mime_type,"content-security-policy":"default-src 'none'; sandbox","content-disposition":`attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(archive.name).replace(/['()]/gu,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,"content-length":String(bytes.length)}});
 }catch{return Response.json({code:"MESSAGE_ATTACHMENT_UNAVAILABLE"},{status:503,headers});}
}
