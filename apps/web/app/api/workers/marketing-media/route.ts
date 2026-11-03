import { timingSafeEqual } from "node:crypto";
import { resolveSocialCredentialReference } from "@/modules/shared/lib/marketing-autopilot/credential-resolver";
import { getMetaAdminClient } from "@/modules/shared/lib/marketing-autopilot/meta-admin-client";
import { runMetaMediaStep } from "@/modules/shared/lib/marketing-autopilot/meta-media-runner";
import { withOperationalHeartbeat } from "@/modules/shared/lib/operations/heartbeat";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"cache-control":"no-store"};
export const GET=POST;
export async function POST(request:Request){
 const expected=Buffer.from(process.env.CRON_SECRET??"");const supplied=Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/iu,"")??"");
 if(expected.length<32||expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return Response.json({code:"UNAUTHORIZED"},{status:401,headers});
 return withOperationalHeartbeat("MARKETING_MEDIA",180,async()=>{
  if(process.env.MARKETING_PUBLISH_MODE!=="live")return Response.json({code:"MEDIA_LIVE_MODE_DISABLED"},{headers});
  try{const state=await runMetaMediaStep({client:getMetaAdminClient(),request:fetch,resolveCredential:reference=>resolveSocialCredentialReference(reference,process.env),liveEnabled:process.env.MARKETING_LIVE_PUBLISHING_ENABLED==="true"});return Response.json({code:"MEDIA_CYCLE_COMPLETED",state},{headers});}
  catch{return Response.json({code:"MEDIA_CYCLE_FAILED"},{status:503,headers});}
 });
}
