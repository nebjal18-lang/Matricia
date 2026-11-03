import { z } from "zod";
import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { getMetaAdminClient } from "@/modules/shared/lib/marketing-autopilot/meta-admin-client";
import { mediaBytesValid, sha256 } from "@/modules/shared/lib/marketing-autopilot/meta-media";
const inputSchema=z.object({action:z.enum(["reserve","finalize"]),jobId:z.string().uuid(),sha256:z.string().regex(/^[0-9a-f]{64}$/u),mediaType:z.enum(["image/jpeg","video/mp4"]),byteLength:z.number().int().min(12).max(52428800),publicUseApproved:z.literal(true)}).refine(value=>value.mediaType!=="image/jpeg"||value.byteLength<=8388608);
const reservationSchema=z.object({asset_id:z.string().uuid(),storage_path:z.string().min(1),uploaded:z.boolean()});
const headers={"cache-control":"no-store"};
export const maxDuration=30;
export async function POST(request:Request){
 const access=await loadMyPlatformAccess();
 if(access.status!=="ok"||!access.requirementSatisfied||!hasPlatformRole(access.roles,["SUPER_ADMIN","MATRICIA_ADMIN"]))return Response.json({code:"FORBIDDEN"},{status:403,headers});
 const origin=request.headers.get("origin");if(!origin||origin!==new URL(request.url).origin)return Response.json({code:"ORIGIN_REQUIRED"},{status:403,headers});
 // Metadata only; media bytes go directly to a private, single-use signed Storage upload.
 if(Number(request.headers.get("content-length")??0)>4096)return Response.json({code:"BODY_TOO_LARGE"},{status:413,headers});
 let raw:string;
 try{const reader=request.body?.getReader();if(!reader)throw new Error("NO_BODY");const chunks:Uint8Array[]=[];let count=0;for(;;){const chunk=await reader.read();if(chunk.done)break;count+=chunk.value.length;if(count>4096){await reader.cancel();return Response.json({code:"BODY_TOO_LARGE"},{status:413,headers});}chunks.push(chunk.value);}raw=Buffer.concat(chunks).toString("utf8");}catch{return Response.json({code:"INVALID_REQUEST"},{status:400,headers});}
 let value:unknown;try{value=JSON.parse(raw) as unknown;}catch{return Response.json({code:"INVALID_REQUEST"},{status:400,headers});}
 const input=inputSchema.safeParse(value);if(!input.success)return Response.json({code:"INVALID_REQUEST"},{status:400,headers});const data=input.data;
 const reservation=await access.client.rpc("reserve_social_media_asset_v1",{p_job_id:data.jobId,p_sha256:data.sha256,p_media_type:data.mediaType,p_byte_length:data.byteLength,p_public_use_approved:data.publicUseApproved});const parsed=reservationSchema.safeParse(reservation.data);
 if(reservation.error||!parsed.success)return Response.json({code:"MEDIA_APPROVAL_DENIED"},{status:409,headers});const asset=parsed.data;const admin=getMetaAdminClient();
 if(data.action==="reserve"){
  if(asset.uploaded)return Response.json({code:"MEDIA_ALREADY_REGISTERED"},{status:200,headers});
  const signed=await admin.storage.from("marketing-media-source").createSignedUploadUrl(asset.storage_path,{upsert:false});
  if(signed.error||!signed.data)return Response.json({code:"MEDIA_UPLOAD_VERIFY_EXISTING"},{headers});
  return Response.json({code:"MEDIA_UPLOAD_RESERVED",path:asset.storage_path,token:signed.data.token},{headers});
 }
 const source=await admin.storage.from("marketing-media-source").download(asset.storage_path);
 if(source.error||!source.data)return Response.json({code:"MEDIA_SOURCE_UNAVAILABLE"},{status:503,headers});
 const bytes=new Uint8Array(await source.data.arrayBuffer());if(bytes.length!==data.byteLength||sha256(bytes)!==data.sha256||!mediaBytesValid(bytes,data.mediaType))return Response.json({code:"MEDIA_HASH_MISMATCH"},{status:422,headers});
 const completed=await admin.rpc("complete_social_media_asset_v1",{p_asset_id:asset.asset_id,p_sha256:data.sha256});
 return completed.error?Response.json({code:"MEDIA_REGISTRATION_FAILED"},{status:503,headers}):Response.json({code:"MEDIA_REGISTERED"},{headers});
}
