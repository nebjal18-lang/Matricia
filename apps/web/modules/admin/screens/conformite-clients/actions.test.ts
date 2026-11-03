import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock("@/modules/shared/lib/i18n/locale", () => ({ isLocale: (value: string) => value === "fr" || value === "ar" }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("node:crypto", () => ({ randomUUID: () => "11111111-1111-4111-8111-111111111111" }));

import {
  createClientComplianceQuestion,
  decideClientCompliance,
  evaluateClientCompliance,
  listClientComplianceReviews,
  reviewClientComplianceResponse,
  type ComplianceDecisionState,
  type ComplianceWorkflowState,
} from "./actions";

const idle: ComplianceDecisionState = { status: "idle" };
const workflowIdle: ComplianceWorkflowState = { status: "idle" };
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const caseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const organizationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const idempotencyKey = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const anomalyId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const questionId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const trialId = "12121212-1212-4212-8212-121212121212";
const satisfied = {
  data: [{ requirement_satisfied: true, matched_role_codes: ["COMPLIANCE_MANAGER"] }],
  error: null,
};

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    complianceCaseId: caseId,
    decision: "VERIFIED",
    reasonPublic: "",
    idempotencyKey,
    locale: "fr",
    confirmed: "yes",
    ...overrides,
  })) data.set(key, value);
  return data;
}

describe("central compliance authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  });

  it("ne lit aucune donnée métier sans identité", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listClientComplianceReviews()).resolves.toEqual({ status: "error", reason: "UNAUTHENTICATED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("bloque toute lecture avant MFA satisfait", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ requirement_satisfied: false, matched_role_codes: ["COMPLIANCE_MANAGER"] }],
      error: null,
    });
    await expect(listClientComplianceReviews()).resolves.toEqual({ status: "error", reason: "MFA_REQUIRED" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("bloque toute lecture sans rôle central", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ requirement_satisfied: true, matched_role_codes: ["CLIENT_OWNER"] }], error: null });
    await expect(listClientComplianceReviews()).resolves.toEqual({ status: "error", reason: "FORBIDDEN" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("listClientComplianceReviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.rpc.mockResolvedValue(satisfied);
  });

  it("ouvre une fiche par identifiant sans chercher dans une première page", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "get_admin_client_compliance_page_v1" ? {data: {cases: [], page: 1, has_next: false, counts: {all:55,check:27,complement:0,review:0,decided:0}}, error:null} : satisfied);
    await expect(listClientComplianceReviews({caseId})).resolves.toMatchObject({status:"success",cases:[]});
    expect(mocks.rpc).toHaveBeenCalledWith("get_admin_client_compliance_page_v1", {p_page:1,p_filter:"all",p_case_id:caseId});
  });

  it("retourne un DTO minimal sans profil détaillé, chemin, hash ni identifiants tenant", async () => {
    const casesResult = { data: [{
      id: caseId,
      organization_id: organizationId,
      status: "UNDER_REVIEW",
      current_profile_version: 2,
      submitted_at: "2026-09-11T10:00:00Z",
      decision_reason_public: null,
      created_at: "2026-09-10T10:00:00Z",
      updated_at: "2026-09-11T10:00:00Z",
    }], error: null };
    mocks.rpc.mockImplementation(async (name: string) => name === "get_admin_client_compliance_page_v1" ? {data: {cases: casesResult.data, page: 1, has_next: false, counts: {all:1,check:1,complement:0,review:1,decided:0}}, error:null} : satisfied);
    const profilesResult = { data: [{
      compliance_case_id: caseId,
      version: 2,
      display_name: "Atlas Conseil",
      legal_name: "Atlas Conseil SARL",
      organization_snapshot: {
        display_name: "Atlas Conseil",
        legal_name: "Atlas Conseil SARL",
        identifiers: { ICE: "SECRET-ICE" },
      },
      profile_data: { representative: { email: "secret@example.invalid" } },
    }], error: null };
    const evidenceResult = { data: [{
      compliance_case_id: caseId,
      evidence_type: "REGISTRATION_DOCUMENT",
      review_status: "VERIFIED",
      object_path: "private/secret.pdf",
      file_sha256: "secret-hash",
    }], error: null };
    const anomaliesResult = { data: [{
      id: anomalyId,
      compliance_case_id: caseId,
      anomaly_code: "ICE_NOT_VERIFIED",
      field_path: "identifiers.ice",
      severity: "CRITICAL",
      blocking: true,
      status: "QUESTIONED",
      client_message_fr: "L’identifiant ICE doit être vérifié.",
      client_message_ar: "يجب التحقق من معرف ICE.",
      entered_value_digest: "secret-entered-digest",
      organization_id: organizationId,
    }], error: null };
    const questionsResult = { data: [{
      id: questionId,
      compliance_case_id: caseId,
      anomaly_id: anomalyId,
      question_text_fr: "Merci de transmettre un ICE vérifié.",
      question_text_ar: "يرجى إرسال معرف ICE متحقق منه.",
      expected_document_type: "REGISTRATION_DOCUMENT",
      due_at: "2026-09-18T10:00:00Z",
      status: "ANSWERED",
      created_by: userId,
      organization_id: organizationId,
    }], error: null };
    const responsesResult = { data: [{
      question_id: questionId,
      version: 1,
      response_text: "Ancienne réponse",
      submitted_at: "2026-09-11T11:00:00Z",
      submitted_by: userId,
      organization_id: organizationId,
    }, {
      question_id: questionId,
      version: 2,
      response_text: "Le justificatif demandé a été transmis.",
      submitted_at: "2026-09-11T12:00:00Z",
      submitted_by: userId,
      organization_id: organizationId,
    }], error: null };
    mocks.from.mockImplementation((table: string) => {
      if (table === "client_compliance_cases") {
        return { select: () => ({ order: () => ({ limit: async () => casesResult }) }) };
      }
      if (table === "client_profile_versions") return { select: () => ({ in: async () => profilesResult }) };
      if (table === "client_compliance_evidence") return { select: () => ({ in: async () => evidenceResult }) };
      if (table === "client_administrative_anomalies") return { select: () => ({ in: async () => anomaliesResult }) };
      if (table === "client_compliance_questions") return { select: () => ({ in: async () => questionsResult }) };
      if (table === "client_compliance_response_versions") return { select: () => ({ in: async () => responsesResult }) };
      throw new Error("unexpected table " + table);
    });
    const result = await listClientComplianceReviews();
    expect(result).toEqual({
      status: "success",
      page: 1, hasNext: false, counts: {all:1,check:1,complement:0,review:1,decided:0},
      cases: [{
        id: caseId,
        organizationName: "Atlas Conseil",
        status: "UNDER_REVIEW",
        profileVersion: 2,
        submittedAt: "2026-09-11T10:00:00Z",
        publicReason: null,
        createdAt: "2026-09-10T10:00:00Z",
        updatedAt: "2026-09-11T10:00:00Z",
        evidence: [{ type: "REGISTRATION_DOCUMENT", status: "VERIFIED" }],
        anomalies: [{
          id: anomalyId,
          code: "ICE_NOT_VERIFIED",
          severity: "CRITICAL",
          blocking: true,
          status: "QUESTIONED",
          messageFr: "L’identifiant ICE doit être vérifié.",
          messageAr: "يجب التحقق من معرف ICE.",
        }],
        questions: [{
          id: questionId,
          anomalyId,
          textFr: "Merci de transmettre un ICE vérifié.",
          textAr: "يرجى إرسال معرف ICE متحقق منه.",
          expectedDocumentType: "REGISTRATION_DOCUMENT",
          dueAt: "2026-09-18T10:00:00Z",
          status: "ANSWERED",
          latestResponse: { version: 2, text: "Le justificatif demandé a été transmis.", submittedAt: "2026-09-11T12:00:00Z" },
        }],
      }],
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("SECRET-ICE");
    expect(serialized).not.toContain("secret@example.invalid");
    expect(serialized).not.toContain("private/secret.pdf");
    expect(serialized).not.toContain("secret-hash");
    expect(serialized).not.toContain("secret-entered-digest");
    expect(serialized).not.toContain(userId);
    expect(serialized).not.toContain(organizationId);
  });
});

function workflowForm(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    idempotencyKey,
    locale: "fr",
    confirmed: "yes",
    ...values,
  })) data.set(key, value);
  return data;
}

function securedMutation(name: "create" | "review" | "decide") {
  if (name === "create") {
    return createClientComplianceQuestion(workflowIdle, workflowForm({
      anomalyId,
      questionFr: "Merci de transmettre le document vérifié.",
      questionAr: "يرجى إرسال الوثيقة التي تم التحقق منها.",
      expectedDocumentType: "NONE",
      dueDays: "7",
      requestAnchor: new Date().toISOString(),
    }));
  }
  if (name === "review") {
    return reviewClientComplianceResponse(workflowIdle, workflowForm({ questionId, accepted: "yes" }));
  }
  return decideClientCompliance(idle, form());
}

describe("administrative compliance workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "get_my_account_security_requirement") return satisfied;
      if (name === "evaluate_client_compliance") return { data: { outcome: "CLIENT_COMPLIANCE_EVALUATED", blocking_anomalies: 1 }, error: null };
      if (name === "create_client_compliance_question") return { data: questionId, error: null };
      if (name === "accept_client_compliance_response") return { data: true, error: null };
      return { data: null, error: { message: "unknown RPC" } };
    });
  });

  it("évalue un dossier avec une clé idempotente sans exposer le résultat SQL", async () => {
    const result = await evaluateClientCompliance(workflowIdle, workflowForm({ complianceCaseId: caseId }));
    expect(result).toEqual({ status: "success", outcome: "EVALUATED" });
    expect(mocks.rpc).toHaveBeenCalledWith("evaluate_client_compliance", {
      p_compliance_case_id: caseId,
      p_idempotency_key: idempotencyKey,
      p_correlation_id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("crée une question bilingue avec une échéance calculée côté serveur", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T12:00:00Z"));
    const result = await createClientComplianceQuestion(workflowIdle, workflowForm({
      anomalyId,
      questionFr: "Merci de transmettre le document vérifié.",
      questionAr: "يرجى إرسال الوثيقة التي تم التحقق منها.",
      expectedDocumentType: "REGISTRATION_DOCUMENT",
      dueDays: "7",
      requestAnchor: "2026-09-11T12:00:00.000Z",
    }));
    vi.useRealTimers();
    expect(result).toEqual({ status: "success", outcome: "QUESTION_CREATED" });
    expect(mocks.rpc).toHaveBeenCalledWith("create_client_compliance_question", {
      p_anomaly_id: anomalyId,
      p_question_text_fr: "Merci de transmettre le document vérifié.",
      p_question_text_ar: "يرجى إرسال الوثيقة التي تم التحقق منها.",
      p_expected_document_type: "REGISTRATION_DOCUMENT",
      p_due_at: "2026-09-18T12:00:00.000Z",
      p_idempotency_key: idempotencyKey,
      p_correlation_id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("conserve exactement la même échéance lors d’un retry avec la même clé", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T12:00:00Z"));
    const data = workflowForm({
      anomalyId,
      questionFr: "Merci de transmettre le document vérifié.",
      questionAr: "يرجى إرسال الوثيقة التي تم التحقق منها.",
      expectedDocumentType: "NONE",
      dueDays: "7",
      requestAnchor: "2026-09-11T12:00:00.000Z",
    });
    await createClientComplianceQuestion(workflowIdle, data);
    vi.setSystemTime(new Date("2026-09-11T13:00:00Z"));
    await createClientComplianceQuestion(workflowIdle, data);
    vi.useRealTimers();
    const calls = mocks.rpc.mock.calls.filter(([name]) => name === "create_client_compliance_question");
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[1].p_due_at).toBe("2026-09-18T12:00:00.000Z");
    expect(calls[1]?.[1].p_due_at).toBe(calls[0]?.[1].p_due_at);
  });

  it.each([["yes", true, "RESPONSE_ACCEPTED"], ["no", false, "RESPONSE_REJECTED"]] as const)(
    "enregistre l’examen accepté=%s via le RPC audité",
    async (value, accepted, outcome) => {
      mocks.rpc.mockImplementation(async (name: string) =>
        name === "get_my_account_security_requirement" ? satisfied
          : name === "accept_client_compliance_response" ? { data: accepted, error: null }
            : { data: null, error: { message: "unknown RPC" } });
      const result = await reviewClientComplianceResponse(workflowIdle, workflowForm({ questionId, accepted: value }));
      expect(result).toEqual({ status: "success", outcome });
      expect(mocks.rpc).toHaveBeenCalledWith("accept_client_compliance_response", expect.objectContaining({
        p_question_id: questionId,
        p_accepted: accepted,
        p_idempotency_key: idempotencyKey,
      }));
    },
  );

  it("valide les textes bilingues et la confirmation avant Auth", async () => {
    const result = await createClientComplianceQuestion(workflowIdle, workflowForm({
      anomalyId,
      questionFr: "x",
      questionAr: "س",
      expectedDocumentType: "NONE",
      dueDays: "7",
      requestAnchor: new Date().toISOString(),
      confirmed: "no",
    }));
    expect(result).toEqual({ status: "error", reason: "VALIDATION" });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("neutralise les erreurs internes des nouveaux workflows", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "get_my_account_security_requirement" ? satisfied : { data: null, error: { message: "secret identifier mismatch" } });
    const result = await evaluateClientCompliance(workflowIdle, workflowForm({ complianceCaseId: caseId }));
    expect(result).toEqual({ status: "error", reason: "UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it.each([
    [{ requirement_satisfied: false, matched_role_codes: ["COMPLIANCE_MANAGER"] }, "MFA_REQUIRED"],
    [{ requirement_satisfied: true, matched_role_codes: ["CLIENT_OWNER"] }, "FORBIDDEN"],
  ] as const)("interdit les mutations quand la sécurité centrale est insuffisante", async (requirement, reason) => {
    mocks.rpc.mockResolvedValueOnce({ data: [requirement], error: null });
    const result = await evaluateClientCompliance(workflowIdle, workflowForm({ complianceCaseId: caseId }));
    expect(result).toEqual({ status: "error", reason });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("get_my_account_security_requirement");
  });

  it.each(["create", "review", "decide"] as const)("DENY %s sans MFA satisfait", async (mutation) => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ requirement_satisfied: false, matched_role_codes: ["COMPLIANCE_MANAGER"] }],
      error: null,
    });
    await expect(securedMutation(mutation)).resolves.toEqual({ status: "error", reason: "MFA_REQUIRED" });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("get_my_account_security_requirement");
  });

  it.each(["create", "review", "decide"] as const)("DENY %s sans rôle central", async (mutation) => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ requirement_satisfied: true, matched_role_codes: ["CLIENT_OWNER"] }],
      error: null,
    });
    await expect(securedMutation(mutation)).resolves.toEqual({ status: "error", reason: "FORBIDDEN" });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("get_my_account_security_requirement");
  });
});

describe("decideClientCompliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.rpc.mockImplementation(async (name: string, args?: { p_decision?: string }) => {
      if (name === "get_my_account_security_requirement") return satisfied;
      const decision = args?.p_decision ?? "VERIFIED";
      return { data: {
        outcome: "CLIENT_COMPLIANCE_" + decision,
        compliance_case_id: caseId,
        organization_id: organizationId,
        status: decision,
        trial_id: decision === "VERIFIED" ? trialId : null,
      }, error: null };
    });
  });

  it("valide motif et confirmation avant toute lecture Auth", async () => {
    await expect(decideClientCompliance(idle, form({ decision: "REJECTED", reasonPublic: "", confirmed: "no" })))
      .resolves.toEqual({ status: "error", reason: "VALIDATION" });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it.each([
    ["VERIFIED", "", true],
    ["QUESTION_REQUIRED", "Merci de préciser le pouvoir du représentant.", false],
    ["REJECTED", "Les justificatifs fournis ne sont pas valides.", false],
  ] as const)("transmet la décision %s au RPC audité", async (decision, reason, approve) => {
    await expect(decideClientCompliance(idle, form({ decision, reasonPublic: reason })))
      .resolves.toEqual({ status: "success", decision });
    expect(mocks.rpc).toHaveBeenCalledWith("decide_client_compliance", {
      p_compliance_case_id: caseId,
      p_decision: decision,
      p_reason_public: reason || null,
      p_idempotency_key: idempotencyKey,
      p_correlation_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(Boolean(approve)).toBe(decision === "VERIFIED");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/fr/administration/conformite-clients");
  });

  it("neutralise les détails d’une preuve ou d’un identifiant manquant", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "get_my_account_security_requirement"
        ? satisfied
        : { data: null, error: { message: "VERIFIED_COMPLIANCE_EVIDENCE_REQUIRED at private path" } });
    const result = await decideClientCompliance(idle, form());
    expect(result).toEqual({ status: "error", reason: "UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toContain("EVIDENCE");
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("refuse une réponse RPC incohérente même sans erreur transport", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "get_my_account_security_requirement"
        ? satisfied
        : { data: {
          outcome: "CLIENT_COMPLIANCE_VERIFIED",
          compliance_case_id: "abababab-abab-4bab-8bab-abababababab",
          organization_id: organizationId,
          status: "VERIFIED",
          trial_id: trialId,
        }, error: null });
    await expect(decideClientCompliance(idle, form())).resolves.toEqual({ status: "error", reason: "UNAVAILABLE" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
