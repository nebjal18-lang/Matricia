import { createScannerHttpHandler } from "./scanner-http";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { buildHealthReport, createJsonLogger } from "@matricia/observability";
import {
  createClamAvTcpScanner,
  createClamAvTcpHealthCheck,
  createDocumentScanLogger,
  createDocumentScanOutboxConsumer,
  createDocumentScanProcessor,
  createSupabaseDocumentScanRecorder,
  createSupabasePrivateDocumentStore,
  createSupabaseScanJobRepository,
  readClamAvTcpConfig,
} from "./client-compliance";
import { createWorkerDispatcher } from "./dispatcher";
import { createSupabaseOutboxRepository } from "./outbox-repository";
import { pollOutboxOnce } from "./poller";
import { readWorkerRuntimeConfig } from "./worker-config";
import { buildWorkerReadiness, createWorkerCycle } from "./worker-cycle";
import { createFranchiseFollowupScheduler } from "./franchise-followups";

async function start(): Promise<void> {
  const config = readWorkerRuntimeConfig(process.env);
  const workerId = randomUUID();
  const log = createJsonLogger((record) => process.stderr.write(`${record}\n`));
  const serviceClient = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const repository = createSupabaseOutboxRepository(serviceClient);
  const documentScanConsumer = createDocumentScanOutboxConsumer(createDocumentScanProcessor({
    jobs: createSupabaseScanJobRepository(serviceClient),
    documents: createSupabasePrivateDocumentStore(serviceClient),
    antivirus: createClamAvTcpScanner(readClamAvTcpConfig(process.env)),
    recorder: createSupabaseDocumentScanRecorder(serviceClient),
    log: createDocumentScanLogger((record) => process.stderr.write(`${record}\n`)),
  }));
  const antivirusHealth = createClamAvTcpHealthCheck(readClamAvTcpConfig(process.env));
  const runFranchiseFollowups = createFranchiseFollowupScheduler(serviceClient, workerId);

  let antivirusAvailable = false;
  const dispatcher = createWorkerDispatcher({
    documentScanConsumer,
    dispatchUrl: config.dispatchUrl,
    webhookSecret: config.webhookSecret,
    canScanDocuments: () => antivirusAvailable,
  });

  const cycle = createWorkerCycle({
    checkAntivirus: async () => {
      try { await antivirusHealth.check(); antivirusAvailable = true; }
      catch (error) { antivirusAvailable = false; throw error; }
    },
    pollOutbox: () => pollOutboxOnce(repository, dispatcher, workerId),
    onFailure: (dependency) => log("error", {
      requestId: randomUUID(),
      correlationId: randomUUID(),
      event: dependency === "antivirus" ? "antivirus.health" : "outbox.poll",
      outcome: "failure",
      actorId: workerId,
      errorCode: dependency === "antivirus" ? "ANTIVIRUS_UNAVAILABLE" : "OUTBOX_POLL_FAILED",
    }),
  });

  const scannerConfig=readClamAvTcpConfig(process.env);
  const scanHttp=createScannerHttpHandler({token:process.env.MALWARE_SCANNER_TOKEN??"",available:()=>antivirusAvailable,scanner:createClamAvTcpScanner({...scannerConfig,timeoutMs:Math.min(scannerConfig.timeoutMs,12_000)})});
  const server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.setHeader("cache-control", "no-store");
    if (request.url === "/scan") { void scanHttp(request,response); return; }
    if (request.url === "/health") {
      response.end(JSON.stringify(buildHealthReport("matricia-worker")));
      return;
    }
    if (request.url === "/readiness") {
      const report = buildWorkerReadiness(cycle.getState());
      response.statusCode = report.status === "ready" ? 200 : 503;
      response.end(JSON.stringify(report));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ status: "not_found" }));
  });
  server.headersTimeout=5_000;server.requestTimeout=20_000;
  server.listen(config.port);
  void runFranchiseFollowups().catch(() => log("error", { requestId: randomUUID(), correlationId: randomUUID(), event: "franchise.followup.scheduler", outcome: "failure", actorId: workerId, errorCode: "FRANCHISE_FOLLOWUP_CYCLE_FAILED" }));
  const recordHeartbeat = async () => {
    const state = cycle.getState();
    const result = await serviceClient.rpc("record_operational_heartbeat_v1", { p_service_code: "MATRICIA_WORKER", p_healthy: Boolean(state.outbox?.ok), p_expires_after_seconds: 60 });
    if (result.error) log("error", { requestId: randomUUID(), correlationId: randomUUID(), event: "worker.heartbeat", outcome: "failure", errorCode: "HEARTBEAT_RECORD_FAILED" });
    await serviceClient.rpc("record_operational_heartbeat_v1", { p_service_code: "CLAMAV", p_healthy: Boolean(state.antivirus?.ok), p_expires_after_seconds: 60 });
    await serviceClient.rpc("record_operational_heartbeat_v1", { p_service_code: "SCANNER_HTTP", p_healthy: Boolean(state.antivirus?.ok) && (process.env.MALWARE_SCANNER_TOKEN?.length ?? 0) >= 32, p_expires_after_seconds: 60 });
  };
  void cycle.run().then(recordHeartbeat).catch(() => {});
  const timer = setInterval(() => void cycle.run().then(recordHeartbeat).catch(() => {}), 5_000);
  timer.unref();
  const followupTimer = setInterval(() => void runFranchiseFollowups().catch(() => log("error", { requestId: randomUUID(), correlationId: randomUUID(), event: "franchise.followup.scheduler", outcome: "failure", actorId: workerId, errorCode: "FRANCHISE_FOLLOWUP_CYCLE_FAILED" })), 30_000);
  followupTimer.unref();
}

void start().catch(() => {
  createJsonLogger((record) => process.stderr.write(`${record}\n`))("error", {
    requestId: randomUUID(), correlationId: randomUUID(), event: "worker.start", outcome: "failure", errorCode: "WORKER_START_FAILED",
  });
  process.exitCode = 1;
});
