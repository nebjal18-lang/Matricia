import { z } from "zod";

const id = z.string().uuid();
const queue = z.object({ id, queue_key: z.string(), label_fr: z.string(), label_ar: z.string() });
const work = z.object({
  id,
  queue_version_id: id,
  organization_id: id.nullable(),
  source_kind: z.string(),
  resource_type: z.string(),
  resource_id: z.string(),
  title_fr: z.string(),
  title_ar: z.string(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  status: z.string(),
  due_at: z.string(),
  assigned_to: id.nullable(),
  row_version: z.number().int().positive(),
});
const action = z.object({
  id,
  work_item_id: id.nullable(),
  organization_id: id.nullable(),
  action_type: z.string(),
  target_environment: z.string(),
  resource_type: z.string(),
  resource_id: z.string(),
  reason: z.string(),
  approvals_required: z.number().int().positive(),
  status: z.string(),
  requested_by: id,
  requested_at: z.string(),
  executed_at:z.string().nullable().optional(),
  execution_result_hash:z.string().nullable().optional(),
  row_version: z.number().int().positive(),
});

export const commandCenterReadSchemas = {
  queues: z.array(queue),
  workItems: z.array(work),
  actions: z.array(action),
};
