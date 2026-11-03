"use server";
import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
const schema=z.object({beforeVersion:z.number().int().nullable(),afterVersion:z.number().int(),beforeHash:z.string().nullable(),afterHash:z.string().nullable(),requestedBy:z.string().uuid(),reviewedBy:z.string().uuid().nullable(),changes:z.array(z.object({field:z.string(),before:z.unknown(),after:z.unknown()}))});
export type ReviewDiff=z.infer<typeof schema>;
export async function loadFranchiseReviewDiff(franchiseId:string,requestId:string):Promise<ReviewDiff|null>{if(!z.string().uuid().safeParse(franchiseId).success||!z.string().uuid().safeParse(requestId).success)return null;const client=await getSupabaseServerClient();const response=await client.rpc("franchise_catalog_review_diff",{p_franchise_id:franchiseId,p_change_request_id:requestId});const parsed=schema.safeParse(response.data);return response.error||!parsed.success?null:parsed.data;}
