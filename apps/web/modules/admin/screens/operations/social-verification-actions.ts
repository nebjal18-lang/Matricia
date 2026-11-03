"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
export type SocialVerificationState = { status: "idle" | "success" | "error" };
export async function requestSocialVerification(_state: SocialVerificationState, form: FormData): Promise<SocialVerificationState> {
 const access = await loadMyPlatformAccess();
 if (access.status !== "ok" || !access.requirementSatisfied || !hasPlatformRole(access.roles, ["SUPER_ADMIN", "MATRICIA_ADMIN"])) return { status: "error" };
 const input = z.object({ locale: z.enum(["fr", "ar"]), jobId: z.string().uuid(), publicationId: z.string().min(3).max(300).regex(/^[A-Za-z0-9:_-]+$/u), key: z.string().uuid() }).safeParse(Object.fromEntries(form));
 if (!input.success) return { status: "error" };
 const result = await access.client.rpc("request_social_native_verification_v1", { p_job_id: input.data.jobId, p_provider_publication_id: input.data.publicationId, p_idempotency_key: input.data.key });
 if (result.error || !z.string().uuid().safeParse(result.data).success) return { status: "error" };
 revalidatePath(`/${input.data.locale}/administration/operations`); return { status: "success" };
}
export async function requestMediaInvestigation(_state:SocialVerificationState,form:FormData):Promise<SocialVerificationState>{
 const access=await loadMyPlatformAccess();if(access.status!=="ok"||!access.requirementSatisfied||!hasPlatformRole(access.roles,["SUPER_ADMIN","MATRICIA_ADMIN"]))return {status:"error"};
 const input=z.object({locale:z.enum(["fr","ar"]),executionId:z.string().uuid(),reason:z.string().trim().min(20).max(1000)}).safeParse(Object.fromEntries(form));if(!input.success)return {status:"error"};
 const result=await access.client.rpc("request_social_media_investigation_v1",{p_execution_id:input.data.executionId,p_reason:input.data.reason});if(result.error||!z.string().uuid().safeParse(result.data).success)return {status:"error"};
 revalidatePath(`/${input.data.locale}/administration/operations`);return {status:"success"};
}
