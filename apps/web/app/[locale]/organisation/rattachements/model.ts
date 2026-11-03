import{z}from"zod";
export const joinRole=z.enum(["CLIENT_VIEWER","PROVIDER_VIEWER"]),uuid=z.string().uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const joinRequestSchema=z.object({ice:z.string().trim().regex(/^[0-9]{15}$/),role:joinRole,message:z.string().trim().min(10).max(1000),key:uuid});
export const joinDecisionSchema=z.object({id:uuid,accept:z.enum(["yes","no"]),version:z.coerce.number().int().positive(),hash,reason:z.string().trim().min(10).max(1000),key:uuid});
const mine=z.object({id:uuid,role_code:joinRole,status:z.enum(["PENDING","APPROVED","REJECTED","CANCELLED","EXPIRED"]),created_at:z.string()});
const review=z.object({id:uuid,organization_id:uuid,organization_name:z.string(),requester_email:z.string().email(),message:z.string(),role_code:joinRole,row_version:z.number().int().positive(),request_hash:hash,created_at:z.string()});
export const joinWorkspaceSchema=z.object({page:z.number().int().positive(),page_size:z.literal(25),my_total:z.number().int().nonnegative(),review_total:z.number().int().nonnegative(),my_requests:z.array(mine),review_requests:z.array(review)});
export type JoinWorkspace=z.infer<typeof joinWorkspaceSchema>;
export type JoinState={status:"idle"}|{status:"success";outcome:"JOIN_REQUEST_RECORDED"|"JOIN_REQUEST_APPROVED"|"JOIN_REQUEST_REJECTED"}|{status:"error";reason:"VALIDATION"|"FORBIDDEN"|"CONFLICT"|"RATE_LIMIT"|"UNAVAILABLE"};
