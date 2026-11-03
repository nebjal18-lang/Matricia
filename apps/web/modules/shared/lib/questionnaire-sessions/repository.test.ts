import { describe, expect, it, vi } from "vitest";
import { createQuestionnaireSessionsRepository, type QuestionnaireSessionSource } from "./repository";

const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const ok = (data: unknown) => ({ data, error: null });
function source(overrides: Partial<QuestionnaireSessionSource> = {}): QuestionnaireSessionSource {
  return {
    async user() { return id(1); }, async memberships() { return ok([{ id: id(2), organization_id: id(3) }]); }, async roles() { return ok([{ membership_id: id(2), role_code: "CLIENT_OWNER", revoked_at: null }]); }, async organizations() { return ok([{ id: id(3), display_name: "Atelier Atlas" }]); },
    async documents() { return ok([]); }, async publishedVersions() { return ok([{ id: id(4), version: 2, status: "PUBLISHED", audience: "CLIENT", title_fr: "Diagnostic", title_ar: "التشخيص", description_fr: "Diagnostic client", description_ar: "تشخيص العميل" }]); }, async sessions() { return ok([]); }, async versions() { return ok([]); }, async session() { return ok([]); }, async sections() { return ok([]); }, async questionLinks() { return ok([]); }, async questions() { return ok([]); }, async answers() { return ok([]); }, async revisions() { return ok([]); }, async presentation() { return ok({ session_id: id(5), row_version: 2, questions: [] }); }, async rpc() { return ok({}); }, ...overrides,
  };
}
describe("questionnaire sessions repository", () => {
  it("fails closed without authentication or Client role", async () => {
    expect(await createQuestionnaireSessionsRepository(source({ user: async () => null })).load()).toEqual({ status: "error", reason: "UNAUTHENTICATED" });
    expect(await createQuestionnaireSessionsRepository(source({ roles: async () => ok([]) })).load()).toEqual({ status: "error", reason: "NO_CLIENT_ORGANIZATION" });
  });
  it("asks for an explicit organization when several Client memberships exist", async () => {
    const result = await createQuestionnaireSessionsRepository(source({
      async memberships() { return ok([{ id: id(2), organization_id: id(3) }, { id: id(12), organization_id: id(13) }]); },
      async roles() { return ok([{ membership_id: id(2), role_code: "CLIENT_OWNER", revoked_at: null }, { membership_id: id(12), role_code: "CLIENT_BUYER", revoked_at: null }]); },
      async organizations() { return ok([{ id: id(3), display_name: "Atelier Atlas" }, { id: id(13), display_name: "Maison Nord" }]); },
    })).load();
    expect(result).toEqual({
      status: "error",
      reason: "ORGANIZATION_SELECTION_REQUIRED",
      organizations: [{ id: id(3), name: "Atelier Atlas" }, { id: id(13), name: "Maison Nord" }],
    });
  });
  it("loads only the bounded published dashboard", async () => {
    const result = await createQuestionnaireSessionsRepository(source()).load();
    expect(result).toEqual({ status: "success", value: { organizations: [{ id: id(3), name: "Atelier Atlas" }], documents: [], questionnaires: [expect.objectContaining({ id: id(4), version: 2 })], sessions: [], selected: null } });
  });
  it("uses exact autosave RPC payload and reports optimistic conflicts", async () => {
    const rpc = vi.fn(async () => ok({ outcome: "AUTOSAVE_CONFLICT", session_id: id(5), server_row_version: 3, conflicts: [] }));
    const result = await createQuestionnaireSessionsRepository(source({ rpc })).save({ sessionId: id(5), questionVersionId: id(6), expectedSessionRowVersion: 2, expectedAnswerRowVersion: 0, answerType: "DECIMAL", value: { kind: "DECIMAL", value: "1.25" }, idempotencyKey: "command-123", correlationId: id(7) });
    expect(result).toEqual({ status: "error", reason: "CONFLICT" });
    expect(rpc).toHaveBeenCalledWith("autosave_questionnaire_answers", expect.objectContaining({ p_answers: [{ question_version_id: id(6), value: { kind: "DECIMAL", value: "1.25" }, expected_answer_row_version: 0 }] }));
  });
  it("rejects RPC response extensions and accepts the final versioned start contract", async () => {
    const response = { outcome: "QUESTIONNAIRE_SESSION_STARTED", session_id: id(5), row_version: 1, questionnaire_version_id: id(4), session_snapshot_id: id(6), session_snapshot_hash: "a".repeat(64) };
    const accepted = await createQuestionnaireSessionsRepository(source({ rpc: async () => ok(response) })).start({ organizationId: id(3), questionnaireVersionId: id(4), locale: "fr", dueAt: null, idempotencyKey: "command-123", correlationId: id(7) });
    expect(accepted).toEqual({ status: "success", value: { sessionId: id(5), rowVersion: 1 } });
    const withSite = vi.fn(async () => ok(response));
    await createQuestionnaireSessionsRepository(source({ rpc: withSite })).start({ organizationId: id(3), questionnaireVersionId: id(4), locale: "fr", dueAt: null, siteId: id(9), idempotencyKey: "command-123", correlationId: id(7) });
    expect(withSite).toHaveBeenCalledWith("start_questionnaire_session", expect.objectContaining({ p_site_id: id(9) }));
    const withoutSite = vi.fn(async () => ok(response));
    await createQuestionnaireSessionsRepository(source({ rpc: withoutSite })).start({ organizationId: id(3), questionnaireVersionId: id(4), locale: "fr", dueAt: null, idempotencyKey: "command-123", correlationId: id(7) });
    expect(withoutSite).toHaveBeenCalledWith("start_questionnaire_session", expect.objectContaining({ p_site_id: null }));
    const denied = await createQuestionnaireSessionsRepository(source({ rpc: async () => ({ data: null, error: { code: "42501", message: "SITE_SCOPE_DENIED" } }) })).start({ organizationId: id(3), questionnaireVersionId: id(4), locale: "fr", dueAt: null, siteId: id(9), idempotencyKey: "command-123", correlationId: id(7) });
    expect(denied).toEqual({ status: "error", reason: "FORBIDDEN" });
    const rejected = await createQuestionnaireSessionsRepository(source({ rpc: async () => ok({ ...response, internal: "must-not-pass" }) })).start({ organizationId: id(3), questionnaireVersionId: id(4), locale: "fr", dueAt: null, idempotencyKey: "command-456", correlationId: id(8) });
    expect(rejected).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
  });
  it("resumes one immutable version and only its selected question subset", async () => {
    const sessions = [{ id: id(5), organization_id: id(3), actor_user_id: id(1), questionnaire_version_id: id(4), status: "IN_PROGRESS", locale: "fr-MA", updated_at: "2026-09-12T12:00:00Z", submitted_at: null, row_version: 2 }];
    const versions = [{ id: id(4), version: 2, status: "PUBLISHED", audience: "CLIENT", title_fr: "Diagnostic", title_ar: "التشخيص", description_fr: "Diagnostic client", description_ar: "تشخيص العميل" }];
    const questions = vi.fn(async () => ok([{ id: id(7), label_fr: "Budget", label_ar: "الميزانية", help_fr: null, help_ar: null, why_we_ask_fr: null, why_we_ask_ar: null, answer_type: "MONEY", required_by_default: true, options: [], validation_schema: {}, structured_schema: null, nullable: false }]));
    const result = await createQuestionnaireSessionsRepository(source({ async sessions() { return ok(sessions); }, async versions() { return ok(versions); }, async session() { return ok(sessions); }, async sections() { return ok([{ id: id(6), label_fr: "Contexte", label_ar: "السياق", help_fr: null, help_ar: null, sort_order: 1 }]); }, async questionLinks() { return ok([{ section_id: id(6), question_version_id: id(7), sort_order: 1, required_override: null }]); }, questions, async presentation() { return ok({ session_id: id(5), row_version: 2, questions: [{ question_version_id: id(7), visible: true, required: true }] }); }, async answers() { return ok([{ id: id(8), question_version_id: id(7), current_revision_id: id(9), row_version: 1 }]); }, async revisions() { return ok([{ id: id(9), value: { kind: "MONEY", amountMinor: "12500", currency: "MAD" }, answered_at: "2026-09-12T11:00:00Z", expires_at: "2026-09-12T11:30:00Z" }]); } })).load(id(5));
    expect(result.status).toBe("success");
    if (result.status === "success") expect(result.value.selected).toEqual(expect.objectContaining({ id: id(5), answeredCount: 0, expiringAnswerCount: 1, expiredAnswerCount: 1, questionCount: 1 }));
    expect(questions).toHaveBeenCalledWith([id(7)]);
  });
  it("fails closed before loading more than 100 questions", async () => {
    const session = { id: id(5), organization_id: id(3), actor_user_id: id(1), questionnaire_version_id: id(4), status: "IN_PROGRESS", locale: "fr-MA", updated_at: "2026-09-12T12:00:00Z", submitted_at: null, row_version: 2 };
    const questions = vi.fn(async () => ok([]));
    const result = await createQuestionnaireSessionsRepository(source({ async sessions() { return ok([session]); }, async versions() { return ok([{ id: id(4), version: 2, status: "PUBLISHED", audience: "CLIENT", title_fr: "Diagnostic", title_ar: "التشخيص", description_fr: "Diagnostic client", description_ar: "تشخيص العميل" }]); }, async session() { return ok([session]); }, async sections() { return ok([{ id: id(6), label_fr: "Contexte", label_ar: "السياق", help_fr: null, help_ar: null, sort_order: 1 }]); }, async questionLinks() { return ok(Array.from({ length: 101 }, (_, index) => ({ section_id: id(6), question_version_id: id(100 + index), sort_order: index + 1, required_override: null }))); }, questions })).load(id(5));
    expect(result).toEqual({ status: "error", reason: "BOUNDS_EXCEEDED" });
    expect(questions).not.toHaveBeenCalled();
  });
  it("never exposes a private document from another organization in a selected session", async () => {
    const session = { id: id(5), organization_id: id(3), actor_user_id: id(1), questionnaire_version_id: id(4), status: "IN_PROGRESS", locale: "fr-MA", updated_at: "2026-09-12T12:00:00Z", submitted_at: null, row_version: 2 };
    const document = (documentId: string, organizationId: string, name: string) => ({ id: documentId, organization_id: organizationId, original_file_name: name, document_type: "TAX_DOCUMENT", declared_mime_type: "application/pdf", status: "VERIFIED" });
    const result = await createQuestionnaireSessionsRepository(source({
      async sessions() { return ok([session]); },
      async versions() { return ok([{ id: id(4), version: 2, status: "PUBLISHED", audience: "CLIENT", title_fr: "Diagnostic", title_ar: "التشخيص", description_fr: "Diagnostic client", description_ar: "تشخيص العميل" }]); },
      async session() { return ok([session]); },
      async documents() { return ok([document(id(20), id(3), "own.pdf"), document(id(21), id(99), "foreign.pdf")]); },
    })).load(id(5));
    expect(result.status).toBe("success");
    if (result.status === "success") expect(result.value.documents).toEqual([expect.objectContaining({ id: id(20), organizationId: id(3), name: "own.pdf" })]);
  });
});

const version = { id: id(4), version: 2, status: "PUBLISHED", audience: "CLIENT", title_fr: "Diagnostic", title_ar: "التشخيص", description_fr: "Diagnostic client", description_ar: "تشخيص العميل" };
const ownDraft = { id: id(5), organization_id: id(3), actor_user_id: id(1), questionnaire_version_id: id(4), status: "IN_PROGRESS", locale: "fr-MA", updated_at: "2026-09-12T12:00:00Z", submitted_at: null, row_version: 2 };
function conditionalSource(overrides: Partial<QuestionnaireSessionSource> = {}) {
  return source({
    async sessions() { return ok([ownDraft]); }, async versions() { return ok([version]); }, async session() { return ok([ownDraft]); },
    async sections() { return ok([{ id: id(6), label_fr: "Contexte", label_ar: "السياق", help_fr: null, help_ar: null, sort_order: 1 }]); },
    async questionLinks() { return ok([7, 8].map((n, i) => ({ section_id: id(6), question_version_id: id(n), sort_order: i + 1, required_override: null }))); },
    async questions() { return ok([7, 8].map((n) => ({ id: id(n), label_fr: "Question", label_ar: "سؤال", help_fr: null, help_ar: null, why_we_ask_fr: null, why_we_ask_ar: null, answer_type: "YES_NO", required_by_default: false, options: [], validation_schema: {}, structured_schema: null, nullable: false }))); },
    async answers() { return ok([{ id: id(9), question_version_id: id(7), current_revision_id: id(10), row_version: 1 }]); },
    async revisions() { return ok([{ id: id(10), value: false, answered_at: "2026-09-12T11:00:00Z", expires_at: null }]); },
    async presentation() { return ok({ session_id: id(5), row_version: 2, questions: [{ question_version_id: id(7), visible: true, required: true }, { question_version_id: id(8), visible: false, required: false }] }); },
    ...overrides,
  });
}
describe("conditional presentation and exact draft resumption", () => {
  it("counts only visible questions and uses the required state evaluated by the server", async () => {
    const result = await createQuestionnaireSessionsRepository(conditionalSource()).load();
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.value.selected).toMatchObject({ id: id(5), questionCount: 1, answeredCount: 1 });
      expect(result.value.selected?.sections[0]?.questions).toEqual([expect.objectContaining({ id: id(7), required: true, answer: expect.objectContaining({ value: false }) })]);
    }
  });
  it("does not combine stale presentation with newer answers", async () => {
    const result = await createQuestionnaireSessionsRepository(conditionalSource({ async presentation() { return ok({ session_id: id(5), row_version: 3, questions: [] }); } })).load();
    expect(result).toEqual({ status: "error", reason: "CONFLICT" });
  });
  it("reports evaluator failure instead of showing all questions with false progress", async () => {
    const result = await createQuestionnaireSessionsRepository(conditionalSource({ async presentation() { return { data: null, error: { code: "P0001" } }; } })).load();
    expect(result).toEqual({ status: "error", reason: "UNAVAILABLE" });
  });
  it("requires a complete unambiguous server presentation", async () => {
    const result = await createQuestionnaireSessionsRepository(conditionalSource({ async presentation() { return ok({ session_id: id(5), row_version: 2, questions: [] }); } })).load();
    expect(result).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
  });
  it("finds the latest unfinished own draft even outside the history page", async () => {
    const session = vi.fn(async () => ok([ownDraft]));
    const latestDraft = vi.fn(async () => ok([ownDraft]));
    const result = await createQuestionnaireSessionsRepository(conditionalSource({ async sessions() { return ok([{ ...ownDraft, id: id(22), status: "SUBMITTED" }]); }, session, latestDraft })).load(undefined, id(3));
    expect(result.status).toBe("success");
    if (result.status === "success") expect(result.value.selected?.id).toBe(id(5));
    expect(latestDraft).toHaveBeenCalledWith(id(1), id(3));
    expect(session).toHaveBeenCalledWith(id(5));
  });
  it("never resumes a returned draft from a different organization or actor", async () => {
    const session = vi.fn(async () => ok([ownDraft]));
    for (const candidate of [{ ...ownDraft, organization_id: id(33) }, { ...ownDraft, actor_user_id: id(34) }]) {
      const result = await createQuestionnaireSessionsRepository(conditionalSource({ async sessions() { return ok([]); }, async latestDraft() { return ok([candidate]); }, session })).load(undefined, id(3));
      expect(result.status).toBe("success");
      if (result.status === "success") expect(result.value.selected).toBeNull();
    }
    expect(session).not.toHaveBeenCalled();
  });
});

describe("explicit Provider questionnaire audience",()=>{
 const providerVersion={...version,audience:"PROVIDER"};
 const providerSource=(overrides:Partial<QuestionnaireSessionSource>={})=>source({roles:async()=>ok([{membership_id:id(2),role_code:"PROVIDER_OWNER",revoked_at:null}]),publishedVersions:async()=>ok([providerVersion]),versions:async()=>ok([providerVersion]),...overrides});
 it.each(["PROVIDER_OWNER","PROVIDER_MANAGER","PROVIDER_SALES","PROVIDER_TECHNICIAN","PROVIDER_ACCOUNTING","PROVIDER_VIEWER"])("allows authorized %s to read Provider questionnaires",async role=>{
  const repository=createQuestionnaireSessionsRepository(providerSource({roles:async()=>ok([{membership_id:id(2),role_code:role,revoked_at:null}])}),"PROVIDER");
  expect((await repository.load(undefined,id(3))).status).toBe("success");
 });
 it("keeps Client defaults and rejects revoked or Client-only roles for Provider reads",async()=>{
  expect(await createQuestionnaireSessionsRepository(providerSource()).load()).toMatchObject({status:"error"});
  expect(await createQuestionnaireSessionsRepository(source(),"PROVIDER").load()).toMatchObject({status:"error"});
  expect(await createQuestionnaireSessionsRepository(providerSource({roles:async()=>ok([{membership_id:id(2),role_code:"PROVIDER_OWNER",revoked_at:"2026-01-01"}])}),"PROVIDER").load()).toMatchObject({status:"error"});
 });
 it("refuses cross-audience projections before loading private answer details",async()=>{
  const session=vi.fn(async()=>ok([]));
  expect(await createQuestionnaireSessionsRepository(providerSource({publishedVersions:async()=>ok([version]),session}),"PROVIDER").load()).toEqual({status:"error",reason:"FORBIDDEN"});
  expect(session).not.toHaveBeenCalled();
 });
 it("cannot start Client content through Provider action even for a multi-role actor",async()=>{
  const rpc=vi.fn(async()=>ok({}));
  const repository=createQuestionnaireSessionsRepository(providerSource({publishedVersions:async()=>ok([version]),versions:async()=>ok([version]),rpc}),"PROVIDER");
  expect(await repository.start({organizationId:id(3),questionnaireVersionId:id(4),locale:"fr",dueAt:null,idempotencyKey:"provider-start",correlationId:id(7)})).toEqual({status:"error",reason:"FORBIDDEN"});expect(rpc).not.toHaveBeenCalled();
 });
 it("cannot edit or submit a Client session through Provider commands",async()=>{
  const rpc=vi.fn(async()=>ok({})),repository=createQuestionnaireSessionsRepository(providerSource({session:async()=>ok([ownDraft]),versions:async()=>ok([version]),rpc}),"PROVIDER");
  expect(await repository.save({sessionId:id(5),questionVersionId:id(7),expectedSessionRowVersion:2,expectedAnswerRowVersion:0,answerType:"YES_NO",value:false,idempotencyKey:"provider-save",correlationId:id(8)})).toEqual({status:"error",reason:"FORBIDDEN"});
  expect(await repository.submit({sessionId:id(5),expectedSessionRowVersion:2,idempotencyKey:"provider-submit",correlationId:id(8)})).toEqual({status:"error",reason:"FORBIDDEN"});expect(rpc).not.toHaveBeenCalled();
 });
});
