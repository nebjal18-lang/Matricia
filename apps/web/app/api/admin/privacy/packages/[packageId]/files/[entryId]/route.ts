import {z} from "zod";
import {privacyFileFailure,transferPrivateDsrFile} from "@/modules/shared/lib/privacy-files/server";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(_request:Request,{params}:{params:Promise<{packageId:string;entryId:string}>}){
 const {packageId,entryId}=await params;if(!z.string().uuid().safeParse(packageId).success||!/^[a-f0-9]{64}$/u.test(entryId))return privacyFileFailure("INVALID_FILE",400);
 return transferPrivateDsrFile("authorize_dsr_file_review_v1",{p_package_id:packageId,p_entry_id:entryId,p_redacted_upload_id:null});
}
