import { expect, it } from "vitest";
import { prometheusMetrics } from "./metrics";
const snapshot = { outbox: [{ event: "DocumentUploadedV1", status: "DEAD_LETTER", count: "2", oldest_seconds: "300" }], notifications: [{ status: "SENT", count: "12" }], publications: [], refunds: [], signatures: [], services: [{ service: "CLAMAV", healthy: false, age_seconds: "180", duration_ms: 1500 }] };
it("exports safe numeric queue, service and duration metrics", () => {
  const text = prometheusMetrics(snapshot);
  expect(text).toContain('matricia_outbox_events{event="DocumentUploadedV1",status="DEAD_LETTER"} 2');
  expect(text).toContain('matricia_service_healthy{service="CLAMAV"} 0');
  expect(text).toContain('matricia_job_last_duration_seconds{service="CLAMAV"} 1.5');
  expect(text).not.toContain("payload");
});
it("rejects a label capable of injecting another metric line", () => {
  expect(() => prometheusMetrics({ ...snapshot, services: [{ ...snapshot.services[0], service: 'bad"} 1\nsecret' }] })).toThrow();
});

it("exports immediate media ambiguity counts without the frozen content or asset evidence",()=>{
 const text=prometheusMetrics({...snapshot,social_media:[{status:"UNKNOWN",count:"2",caption:"private-caption",asset_sha256:"a".repeat(64)}]});expect(text).toContain('matricia_queue_items{queue="social_media",status="UNKNOWN"} 2');expect(text).not.toContain("private-caption");expect(text).not.toContain("a".repeat(64));
});
it("exposes attachment retries, terminal failures and age without private file evidence",()=>{
 const text=prometheusMetrics({...snapshot,message_attachment_scans:[{status:"RETRY_PENDING",count:"2",oldest_seconds:"1900",storage_path:"private/path",organization_id:"private-org"},{status:"DEAD_LETTER",count:"1",oldest_seconds:"2400"}]});
 expect(text).toContain('matricia_queue_items{queue="message_attachments",status="DEAD_LETTER"} 1');expect(text).toContain('matricia_queue_oldest_seconds{queue="message_attachments",status="RETRY_PENDING"} 1900');expect(text).not.toContain("private/path");expect(text).not.toContain("private-org");
});

it("exposes only numeric DSR scan backlog and separates historical errors from active alerts",()=>{const text=prometheusMetrics({...snapshot,privacy_file_scans:[{status:"DEAD_LETTER",count:"2",oldest_seconds:"1900",request_id:"private-dsr",storage_path:"private-file"},{status:"HISTORICAL_ERROR",count:"3",oldest_seconds:"0"}]});expect(text).toContain('matricia_queue_items{queue="privacy_files",status="DEAD_LETTER"} 2');expect(text).toContain('matricia_queue_oldest_seconds{queue="privacy_files",status="DEAD_LETTER"} 1900');expect(text).toContain('matricia_queue_items{queue="privacy_files",status="HISTORICAL_ERROR"} 3');expect(text).not.toContain('matricia_queue_oldest_seconds{queue="privacy_files",status="HISTORICAL_ERROR"}');expect(text).not.toContain("private-dsr");expect(text).not.toContain("private-file");});
it("exports only numeric subscription credit queue failures",()=>{const text=prometheusMetrics({...snapshot,subscription_credit_grants:[{status:"DEAD_LETTER",count:"3",oldest_seconds:"1800",job_id:"private-job",payment_reference:"private-native-reference"}]});expect(text).toContain('matricia_queue_items{queue="subscription_credits",status="DEAD_LETTER"} 3');expect(text).not.toContain("private-job");expect(text).not.toContain("private-native-reference");});
