import { randomUUID } from "node:crypto";
import { buildReadinessReport, type DependencyReadiness } from "@matricia/observability";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  const environment = process.env.APP_ENV?.trim().toLowerCase() || (process.env.NODE_ENV === "production" ? undefined : "development");
  let database: DependencyReadiness;
  let outbox: DependencyReadiness;
  try {
    const { data, error } = await getSupabaseAdminClient().rpc("readiness_status");
    const probe = Array.isArray(data) ? data[0] : data;
    const required = (process.env.READINESS_REQUIRED_SERVICES?.trim() || (environment === "production" || process.env.NODE_ENV === "production" ? "MATRICIA_WORKER,CLAMAV,SCANNER_HTTP,NOTIFICATIONS,DOMAIN_SCHEDULERS,DELIVERY_PROOF_SCANNER,PROVIDER_DOCUMENT_SCANNER,INTERNAL_MESSAGE_ATTACHMENT_SCANNER,PRIVACY_FILE_SCANNER,SUBSCRIPTION_CREDIT_GRANTS" + (process.env.MARKETING_AUTOPILOT_ENABLED === "true" ? ",MARKETING_CONTENT,MARKETING_PUBLICATIONS,MARKETING_MEDIA" : "") : "")).split(",").map(x => x.trim()).filter(Boolean);
    const health = required.length ? await getSupabaseAdminClient().rpc("operational_health_v1", { p_required_services: required }) : null;
    const dependenciesHealthy = !health || (!health.error && health.data?.dependencies_ok === true);
    const latencyMs = performance.now() - startedAt;
    database = error || probe?.database_ok !== true
      ? { status: "down", latencyMs, code: "DATABASE_UNAVAILABLE" }
      : { status: "up", latencyMs };
    outbox = !error && probe?.database_ok === true && probe?.outbox_ok === true && dependenciesHealthy
      ? { status: "up", latencyMs }
      : { status: "down", latencyMs, code: error || probe?.database_ok !== true ? "OUTBOX_STATUS_UNAVAILABLE" : "OUTBOX_BACKLOG" };
  } catch {
    database = { status: "down", latencyMs: performance.now() - startedAt, code: "DATABASE_UNAVAILABLE" };
    outbox = { status: "down", latencyMs: performance.now() - startedAt, code: "OUTBOX_STATUS_UNAVAILABLE" };
  }

  let privacy: DependencyReadiness | undefined;
  if (environment && !["development", "staging", "production"].includes(environment)) {
    privacy = { status: "down", latencyMs: 0, code: "APP_ENV_INVALID" };
  } else if (!environment && process.env.NODE_ENV === "production") {
    privacy = { status: "down", latencyMs: 0, code: "APP_ENV_REQUIRED" };
  } else if (environment) {
    const privacyStarted = performance.now();
    try {
      const result = await getSupabaseAdminClient().rpc("check_platform_privacy_readiness_v1", { p_environment: environment.toUpperCase() });
      privacy = !result.error && result.data?.environment === environment.toUpperCase() && result.data?.required === (environment === "production") && typeof result.data?.ready === "boolean" && (environment !== "production" || result.data.ready === true)
        ? { status: "up", latencyMs: performance.now() - privacyStarted }
        : { status: "down", latencyMs: performance.now() - privacyStarted, code: "PLATFORM_PRIVACY_NOT_READY" };
    } catch { privacy = { status: "down", latencyMs: performance.now() - privacyStarted, code: "PLATFORM_PRIVACY_NOT_READY" }; }
  }
  const report = buildReadinessReport("matricia-web", { database, outbox, ...(privacy ? { privacy } : {}) });
  return Response.json(report, {
    status: report.status === "ready" ? 200 : 503,
    headers: { "x-correlation-id": randomUUID(), "cache-control": "no-store" },
  });
}
