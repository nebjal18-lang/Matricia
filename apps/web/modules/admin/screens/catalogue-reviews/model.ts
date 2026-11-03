import {z} from "zod";
export const editorialKinds = ["LIBRARY", "CATEGORY", "SUBCATEGORY", "SERVICE", "RULE", "RELEASE"] as const;
const kind = z.enum(editorialKinds), id = z.string().uuid(), row = z.record(z.string(), z.unknown());
export const editorialQueueSchema = z.object({total: z.number().int(), page: z.number().int(), pageSize: z.literal(25), items: z.array(z.object({id, libraryId: id, targetType: kind, targetId: id, versionId: id.nullable(), titleFr: z.string(), titleAr: z.string(), code: z.string(), rowVersion: z.number().int(), requestedAt: z.string(), requestedBy: id}))});
export const editorialDetailSchema = z.object({request: z.object({id, status: z.string().optional(), rowVersion: z.number().int(), requestedBy: id, requestedAt: z.string(), targetType: kind, targetId: id, versionId: id.nullable()}), identity: row, version: row, previousVersion: row.nullable(), releaseItems: z.array(z.object({item: row, identity: row, version: row})), reviewedSnapshot: row.nullable().optional(), snapshotHash: z.string().regex(/^[a-f0-9]{64}$/u).nullable().optional(), releaseRowVersion: z.number().int().nullable().optional()});
export type EditorialQueue = z.infer<typeof editorialQueueSchema>;
export type EditorialDetail = z.infer<typeof editorialDetailSchema>;
export type EditorialState = {status: "idle" | "success" | "error"; reason?: string; proofHash?: string};
