import { z } from "zod";
const count = z.string().regex(/^\d+$/u);
const label = z.string().regex(/^[A-Z][A-Za-z0-9_]{1,159}$/u);
const counts = z.array(z.object({ status: label, count }));
const schema = z.object({ outbox: z.array(z.object({ event: label, status: label, count, oldest_seconds: count })), notifications: counts, publications: counts, refunds: counts, signatures: counts, social_media:counts.default([]), subscription_credit_grants:z.array(z.object({status:label,count,oldest_seconds:count})).default([]), privacy_file_scans:z.array(z.object({status:label,count,oldest_seconds:count})).default([]), message_attachment_scans:z.array(z.object({status:label,count,oldest_seconds:count})).default([]), services: z.array(z.object({ service: label, healthy: z.boolean(), age_seconds: count, duration_ms: z.number().int().nonnegative().nullable() })) });
export function prometheusMetrics(raw: unknown): string {
  const data = schema.parse(raw), lines: string[] = [];
  for (const row of data.outbox) { lines.push(`matricia_outbox_events{event="${row.event}",status="${row.status}"} ${row.count}`); if (row.status !== "PUBLISHED") lines.push(`matricia_outbox_oldest_seconds{event="${row.event}",status="${row.status}"} ${row.oldest_seconds}`); }
  for (const queue of ["notifications", "publications", "refunds", "signatures", "social_media"] as const) for (const row of data[queue]) lines.push(`matricia_queue_items{queue="${queue}",status="${row.status}"} ${row.count}`);
  for (const [key,queue]of[["subscription_credit_grants","subscription_credits"],["message_attachment_scans","message_attachments"],["privacy_file_scans","privacy_files"]]as const)for (const row of data[key]) {lines.push(`matricia_queue_items{queue="${queue}",status="${row.status}"} ${row.count}`);if (!["CLEAN","REJECTED","HISTORICAL_ERROR"].includes(row.status)) lines.push(`matricia_queue_oldest_seconds{queue="${queue}",status="${row.status}"} ${row.oldest_seconds}`);}
  for (const row of data.services) { lines.push(`matricia_service_healthy{service="${row.service}"} ${row.healthy ? 1 : 0}`, `matricia_service_age_seconds{service="${row.service}"} ${row.age_seconds}`); if (row.duration_ms !== null) lines.push(`matricia_job_last_duration_seconds{service="${row.service}"} ${row.duration_ms / 1000}`); }
  return lines.join("\n") + "\n";
}
