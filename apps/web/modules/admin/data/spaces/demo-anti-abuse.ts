import { createHash } from "node:crypto";
import { listDemoRegionalTerritories } from "@/app/[locale]/connexion/demo-regional-directory";
import { isDemoClientHomeEnabled } from "@/modules/client/data/home/demo-scenario";

export function canApplyAdminDemoAntiAbuse() {
  return isDemoClientHomeEnabled();
}

function demoId(seed: string): string {
  const hex = createHash("sha256").update(`DEMO_ANTI_ABUSE_V1:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function subjectHash(seed: string) {
  return createHash("sha256").update(`DEMO_ABUSE_SUBJECT:${seed}`).digest("hex");
}

export type DemoAbuseRule = {
  id: string;
  rule_code: string;
  version: number;
  event_type: string;
  window_seconds: number;
  max_events: number;
  review_score: number;
  block_score: number;
  status: string;
};

export type DemoAbuseCase = {
  id: string;
  subject_type: string;
  subject_hash: string;
  risk_score: number;
  event_count: number;
  recommended_action: string;
  status: string;
  row_version: number;
  opened_at: string;
};

const RULE_SPECS = [
  {
    code: "LOGIN_BURST",
    event: "AUTH.LOGIN_FAILURE",
    window: 900,
    max: 8,
    review: 45,
    block: 80,
    status: "ACTIVE",
  },
  {
    code: "INVITE_FLOOD",
    event: "NETWORK.INVITATION_CREATE",
    window: 3600,
    max: 20,
    review: 50,
    block: 85,
    status: "ACTIVE",
  },
  {
    code: "QUOTE_SPAM",
    event: "RFQ.QUOTE_SUBMIT",
    window: 1800,
    max: 12,
    review: 55,
    block: 90,
    status: "ACTIVE",
  },
  {
    code: "DOC_TAMPER",
    event: "KYC.DOCUMENT_UPLOAD",
    window: 7200,
    max: 6,
    review: 60,
    block: 95,
    status: "DRAFT",
  },
] as const;

export function buildDemoAbuseRules(): DemoAbuseRule[] {
  return RULE_SPECS.map((spec, index) => ({
    id: demoId(`rule:${spec.code}`),
    rule_code: spec.code,
    version: index + 1,
    event_type: spec.event,
    window_seconds: spec.window,
    max_events: spec.max,
    review_score: spec.review,
    block_score: spec.block,
    status: spec.status,
  }));
}

export function buildDemoAbuseCases(): DemoAbuseCase[] {
  const territories = listDemoRegionalTerritories().slice(0, 5);
  const actions = ["REVIEW", "REVIEW", "BLOCK", "REVIEW", "DISMISS"] as const;
  const subjects = ["ACCOUNT", "ORGANIZATION", "ACCOUNT", "ORGANIZATION", "IP"] as const;
  return territories.map((territory, index) => ({
    id: demoId(`case:${territory.code}`),
    subject_type: subjects[index % subjects.length]!,
    subject_hash: subjectHash(territory.code),
    risk_score: 55 + index * 8,
    event_count: 4 + index * 3,
    recommended_action: actions[index % actions.length]!,
    status: "OPEN",
    row_version: 1,
    opened_at: `2026-09-${String(12 + index).padStart(2, "0")}T10:00:00.000Z`,
  }));
}
