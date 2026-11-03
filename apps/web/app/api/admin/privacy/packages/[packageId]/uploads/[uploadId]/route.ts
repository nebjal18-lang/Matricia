import {z} from "zod";
import {privacyFileFailure,transferPrivateDsrFile} from "@/modules/shared/lib/privacy-files/server";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(_request:Request,{params}:{params:Promise<{packageId:string;uploadId:string}>}){
 const {packageId,uploadId}=await params;if(!z.string().uuid().safeParse(packageId).success||!z.string().uuid().safeParse(uploadId).success)return privacyFileFailure("INVALID_FILE",400);
 return transferPrivateDsrFile("authorize_dsr_file_review_v1",{p_package_id:packageId,p_entry_id:"",p_redacted_upload_id:uploadId});
}
