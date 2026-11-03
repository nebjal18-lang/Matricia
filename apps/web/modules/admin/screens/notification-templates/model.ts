import {z} from "zod";
const id = z.string().uuid(), hash = z.string().regex(/^[a-f0-9]{64}$/u);
const template = z.object({id, locale:z.enum(["fr-MA","ar-MA"]), template_code:z.string(), version:z.number().int(), event_type:z.string(), category_code:z.string(), subject_template:z.string(), body_template:z.string(), cta_path_template:z.string().nullable(), channels:z.array(z.string()), variable_keys:z.array(z.string()), priority:z.string(), mandatory:z.boolean(), status:z.string()});
export const notificationEditorSchema = z.object({pairs:z.array(z.object({code:z.string(),source_pair_hash:hash,templates:z.array(template)})), proposals:z.array(z.object({id,template_code:z.string(),version:z.number().int(),content_hash:hash,target_environment:z.string(),approvals_required:z.number().int(),created_by:id,created_at:z.string(),reason:z.string(),templates:z.array(template),decisions:z.array(z.object({decided_by:id,decision:z.enum(["APPROVE","REJECT"]),reason:z.string()})),activated:z.boolean(),stale:z.boolean()})),page:z.number().int(),has_next:z.boolean(),can_edit:z.boolean()});
export type NotificationEditor = z.infer<typeof notificationEditorSchema>;
export type NotificationEditorState = {status:"idle"|"success"|"error";reason?:string;rendered?:Array<{locale:string;subject:string;body:string;cta_path:string|null}>};

export const notificationReviewRequestsSchema=z.object({requests:z.array(z.object({actionId:id,templateCode:z.string(),sourceVersion:z.number().int(),reason:z.string(),requestedAt:z.string(),latestActivatedProposal:z.object({id,version:z.number().int(),createdAt:z.string()}).nullable()})),has_next:z.boolean()});
export type NotificationReviewRequests=z.infer<typeof notificationReviewRequestsSchema>;
