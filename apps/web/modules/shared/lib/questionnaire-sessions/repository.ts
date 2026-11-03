import { z } from "zod";
import { resolveClientOrganizationContext } from "@/modules/shared/client-organization-context";
import type { QuestionnaireFailure, QuestionnaireResult, QuestionnaireSessionsRepository } from "./contracts";
import { answerType, databaseLocale, questionnaireUuid, saveAnswerInput, sessionStatus, startSessionInput, submitSessionInput, type QuestionnaireDashboard } from "./model";

type Query = { data: unknown; error: { code?: string; message?: string } | null };
export type QuestionnaireSessionSource = {
  user(): Promise<string | null>;
  memberships(userId: string): Promise<Query>;
  roles(membershipIds: string[]): Promise<Query>;
  organizations(ids: string[]): Promise<Query>;
  documents(organizationIds: string[]): Promise<Query>;
  publishedVersions(): Promise<Query>;
  sessions(userId: string, organizationId: string): Promise<Query>;
  versions(ids: string[]): Promise<Query>;
  session(id: string): Promise<Query>;
  sections(versionId: string): Promise<Query>;
  questionLinks(versionId: string): Promise<Query>;
  questions(ids: string[]): Promise<Query>;
  answers(sessionId: string): Promise<Query>;
  revisions(ids: string[]): Promise<Query>;
  prefills?(sessionId: string): Promise<Query>;
  rpc(name: string, input: Record<string, unknown>): Promise<Query>;
};

const membershipRow = z.object({ id: questionnaireUuid, organization_id: questionnaireUuid }).strict();
const roleRow = z.object({ membership_id: questionnaireUuid, role_code: z.enum(["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER"]), revoked_at: z.string().nullable() }).strict();
const organizationRow = z.object({ id: questionnaireUuid, display_name: z.string().min(1).max(240) }).strict();
const documentRow = z.object({
  id: questionnaireUuid,
  organization_id: questionnaireUuid,
  original_file_name: z.string().min(1).max(255),
  document_type: z.enum(["REGISTRATION_DOCUMENT", "REPRESENTATIVE_AUTHORITY", "TAX_DOCUMENT"]),
  declared_mime_type: z.string().min(3).max(120),
  status: z.enum(["PENDING_REVIEW", "VERIFIED"]),
}).strict();
const versionRow = z.object({ id: questionnaireUuid, version: z.number().int().positive(), status: z.enum(["PUBLISHED", "SUPERSEDED"]), audience: z.literal("CLIENT"), title_fr: z.string().min(1), title_ar: z.string().min(1), description_fr: z.string().min(1), description_ar: z.string().min(1) }).strict();
const sessionRow = z.object({ id: questionnaireUuid, organization_id: questionnaireUuid, actor_user_id: questionnaireUuid, questionnaire_version_id: questionnaireUuid, status: sessionStatus, locale: databaseLocale, updated_at: z.string(), submitted_at: z.string().nullable(), row_version: z.number().int().positive() }).strict();
const sectionRow = z.object({ id: questionnaireUuid, label_fr: z.string().min(1), label_ar: z.string().min(1), help_fr: z.string().nullable(), help_ar: z.string().nullable(), sort_order: z.number().int().positive() }).strict();
const linkRow = z.object({ section_id: questionnaireUuid, question_version_id: questionnaireUuid, sort_order: z.number().int().positive(), required_override: z.boolean().nullable() }).strict();
const questionRow = z.object({ id: questionnaireUuid, label_fr: z.string().min(1), label_ar: z.string().min(1), help_fr: z.string().nullable(), help_ar: z.string().nullable(), why_we_ask_fr: z.string().nullable(), why_we_ask_ar: z.string().nullable(), answer_type: answerType, data_key:z.string().default("unknown"),prefill_source:z.enum(["PROFILE","ORGANIZATION","SITE","PREVIOUS_ANSWER","DOCUMENT"]).nullable().default(null),sensitivity:z.enum(["PUBLIC","BUSINESS","CONFIDENTIAL","RESTRICTED"]).default("BUSINESS"),required_by_default: z.boolean(), options: z.array(z.string()).max(1000), validation_schema: z.record(z.string(), z.unknown()), structured_schema: z.record(z.string(), z.unknown()).nullable(), nullable: z.boolean() }).strict();
const answerRow = z.object({ id: questionnaireUuid, question_version_id: questionnaireUuid, current_revision_id: questionnaireUuid.nullable(), row_version: z.number().int().positive() }).strict();
const revisionRow = z.object({ id: questionnaireUuid, value: z.unknown(), answered_at: z.string(), expires_at: z.string().nullable() }).strict();
const prefillRow=z.object({question_version_id:questionnaireUuid,value:z.unknown(),source:z.enum(["PROFILE","ORGANIZATION","SITE","PREVIOUS_ANSWER","DOCUMENT"]),source_updated_at:z.string(),fresh_until:z.string(),requires_confirmation:z.boolean()}).strict();
const hash = z.string().regex(/^[0-9a-f]{64}$/u);
const startedResponse = z.object({ outcome: z.literal("QUESTIONNAIRE_SESSION_STARTED"), session_id: questionnaireUuid, row_version: z.number().int().positive(), questionnaire_version_id: questionnaireUuid, session_snapshot_id: questionnaireUuid, session_snapshot_hash: hash }).strict();
const acceptedAnswer = z.object({ question_version_id: questionnaireUuid, answer_row_version: z.number().int().positive() }).strict();
const conflictedAnswer = z.object({ question_version_id: questionnaireUuid, answer_row_version: z.number().int().nonnegative() }).strict();
const saveResponse = z.object({ outcome: z.enum(["AUTOSAVE_SAVED", "AUTOSAVE_PARTIAL_CONFLICT", "AUTOSAVE_CONFLICT"]), session_id: questionnaireUuid, server_row_version: z.number().int().positive(), accepted: z.array(acceptedAnswer).optional(), conflicts: z.array(conflictedAnswer) }).strict();
const submittedResponse = z.object({ outcome: z.literal("QUESTIONNAIRE_SESSION_SUBMITTED"), session_id: questionnaireUuid, row_version: z.number().int().positive(), answer_manifest_hash: hash, evaluation_id: questionnaireUuid, score_basis_points: z.number().int(), reproducibility_hash: hash }).strict();

function failure(error: Query["error"]): QuestionnaireResult<never> {
  const message = error?.message ?? "";
  const known: Array<[string, QuestionnaireFailure]> = [["SESSION_NOT_EDITABLE", "NOT_EDITABLE"], ["SESSION_NOT_SUBMITTABLE", "NOT_SUBMITTABLE"], ["REQUIRED_ANSWERS_MISSING", "REQUIRED_MISSING"], ["STALE_SESSION_VERSION", "CONFLICT"], ["IDEMPOTENCY_KEY_REUSED", "CONFLICT"], ["AUTOSAVE_CONFLICT", "CONFLICT"], ["SESSION_SCOPE_DENIED", "FORBIDDEN"], ["ORGANIZATION_SCOPE_DENIED", "FORBIDDEN"], ["SITE_SCOPE_DENIED", "FORBIDDEN"], ["QUESTIONNAIRE_NOT_AVAILABLE", "FORBIDDEN"], ["SITE_NOT_APPLICABLE", "INVALID_INPUT"]];
  const match = known.find(([code]) => message.includes(code));
  if (match) return { status: "error", reason: match[1] };
  if (error?.code === "42501") return { status: "error", reason: "FORBIDDEN" };
  if (error?.code === "40001" || error?.code === "23505") return { status: "error", reason: "CONFLICT" };
  if (error?.code === "22023" || error?.code === "23514") return { status: "error", reason: "INVALID_INPUT" };
  return { status: "error", reason: "UNAVAILABLE" };
}

function rows<T>(schema: z.ZodType<T>, query: Query, max: number): QuestionnaireResult<T[]> {
  if (query.error) return failure(query.error);
  const parsed = z.array(schema).max(max).safeParse(query.data);
  return parsed.success ? { status: "success", value: parsed.data } : { status: "error", reason: "INVALID_RESPONSE" };
}

export function createQuestionnaireSessionsRepository(source: QuestionnaireSessionSource): QuestionnaireSessionsRepository {
  return {
    async load(selectedSessionId, requestedOrganizationId) {
      if (selectedSessionId && !questionnaireUuid.safeParse(selectedSessionId).success) return { status: "error", reason: "INVALID_INPUT" };
      const userId = await source.user();
      if (!userId) return { status: "error", reason: "UNAUTHENTICATED" };
      const memberships = rows(membershipRow, await source.memberships(userId), 100);
      if (memberships.status === "error") return memberships;
      const roles = rows(roleRow, await source.roles(memberships.value.map((item) => item.id)), 300);
      if (roles.status === "error") return roles;
      const allowedMemberships = new Set(roles.value.filter((role) => role.revoked_at === null).map((role) => role.membership_id));
      const authorized = memberships.value.filter((membership) => allowedMemberships.has(membership.id));
      const context = resolveClientOrganizationContext(authorized, requestedOrganizationId);
      if (context.status === "error") {
        if (context.reason === "NO_CLIENT_ORGANIZATION") return { status: "error", reason: "NO_CLIENT_ORGANIZATION" };
        if (context.reason === "ORGANIZATION_SELECTION_REQUIRED") {
          const organizationIds = [...new Set(authorized.map((membership) => membership.organization_id))];
          const organizations = rows(organizationRow, await source.organizations(organizationIds), 100);
          return {
            status: "error",
            reason: "ORGANIZATION_SELECTION_REQUIRED",
            organizations: organizations.status === "success" ? organizations.value.map((organization) => ({ id: organization.id, name: organization.display_name })) : [],
          };
        }
        return { status: "error", reason: "FORBIDDEN" };
      }
      const organizationIds = [context.membership.organization_id];
      const [organizationsQuery, documentsQuery, availableQuery, sessionsQuery] = await Promise.all([source.organizations(organizationIds), source.documents(organizationIds), source.publishedVersions(), source.sessions(userId, organizationIds[0]!)]);
      const organizations = rows(organizationRow, organizationsQuery, 100), documents = rows(documentRow, documentsQuery, 100), available = rows(versionRow, availableQuery, 50), sessions = rows(sessionRow, sessionsQuery, 100);
      if (organizations.status === "error") return organizations;
      if (documents.status === "error") return documents;
      if (available.status === "error") return available;
      if (sessions.status === "error") return sessions;
      const sessionVersionIds = [...new Set(sessions.value.map((session) => session.questionnaire_version_id))];
      const historical = rows(versionRow, await source.versions(sessionVersionIds), 100);
      if (historical.status === "error") return historical;
      const versionById = new Map([...available.value, ...historical.value].map((version) => [version.id, version]));
      const summaries = sessions.value.flatMap((session) => {
        const version = versionById.get(session.questionnaire_version_id);
        return version ? [{ id: session.id, organizationId: session.organization_id, questionnaireVersionId: session.questionnaire_version_id, status: session.status, locale: session.locale, updatedAt: session.updated_at, submittedAt: session.submitted_at, rowVersion: session.row_version, titleFr: version.title_fr, titleAr: version.title_ar }] : [];
      });
      let selected: QuestionnaireDashboard["selected"] = null;
      if (selectedSessionId) {
        const sessionResult = rows(sessionRow, await source.session(selectedSessionId), 1);
        if (sessionResult.status === "error") return sessionResult;
        const session = sessionResult.value[0];
        if (!session || session.actor_user_id !== userId || session.organization_id !== organizationIds[0]) return { status: "error", reason: "FORBIDDEN" };
        const versionResult = rows(versionRow, await source.versions([session.questionnaire_version_id]), 1);
        if (versionResult.status === "error") return versionResult;
        const version = versionResult.value[0];
        if (!version) return { status: "error", reason: "INVALID_RESPONSE" };
        const [sectionsQuery, linksQuery, answersQuery] = await Promise.all([source.sections(version.id), source.questionLinks(version.id), source.answers(session.id)]);
        const sections = rows(sectionRow, sectionsQuery, 101), links = rows(linkRow, linksQuery, 101), answers = rows(answerRow, answersQuery, 100);
        if (sections.status === "error") return sections;
        if (links.status === "error") return links;
        if (answers.status === "error") return answers;
        if (sections.value.length > 100 || links.value.length > 100) return { status: "error", reason: "BOUNDS_EXCEEDED" };
        const questions = rows(questionRow, await source.questions(links.value.map((link) => link.question_version_id)), 100);
        if (questions.status === "error") return questions;
        const revisions = rows(revisionRow, await source.revisions(answers.value.flatMap((answer) => answer.current_revision_id ? [answer.current_revision_id] : [])), 100);
        if (revisions.status === "error") return revisions;
        const prefills=source.prefills?rows(prefillRow,await source.prefills(session.id),100):{status:"success",value:[]}as const;
        if(prefills.status==="error")return prefills;
        const questionById = new Map(questions.value.map((question) => [question.id, question]));
        const revisionById = new Map(revisions.value.map((revision) => [revision.id, revision]));
        const answerByQuestion = new Map(answers.value.map((answer) => [answer.question_version_id, answer])),prefillByQuestion=new Map(prefills.value.map(item=>[item.question_version_id,item]));
        const sectionModels = sections.value.map((section) => ({ id: section.id, labelFr: section.label_fr, labelAr: section.label_ar, helpFr: section.help_fr, helpAr: section.help_ar, sortOrder: section.sort_order, questions: links.value.filter((link) => link.section_id === section.id).flatMap((link) => {
          const question = questionById.get(link.question_version_id);
          if (!question) return [];
          const answer = answerByQuestion.get(question.id), revision = answer?.current_revision_id ? revisionById.get(answer.current_revision_id) : undefined,prefill=prefillByQuestion.get(question.id);
          const expiresAt = revision?.expires_at ?? null;
          return [{ id: question.id, sectionId: section.id, sortOrder: link.sort_order, labelFr: question.label_fr, labelAr: question.label_ar, helpFr: question.help_fr, helpAr: question.help_ar, whyFr: question.why_we_ask_fr, whyAr: question.why_we_ask_ar, type: question.answer_type, required: link.required_override ?? question.required_by_default, nullable: question.nullable, options: question.options, validation: question.validation_schema, structured: question.structured_schema, answer: answer && revision ? { value: revision.value, rowVersion: answer.row_version, answeredAt: revision.answered_at, expiresAt, requiresRevalidation: expiresAt !== null && Date.parse(expiresAt) <= Date.now() } : prefill?{value:prefill.value,rowVersion:0,answeredAt:prefill.source_updated_at,expiresAt:prefill.fresh_until,requiresRevalidation:true,prefilled:true,source:prefill.source}:null }];
        }).sort((a, b) => a.sortOrder - b.sortOrder) })).sort((a, b) => a.sortOrder - b.sortOrder);
        const summary = { id: session.id, organizationId: session.organization_id, questionnaireVersionId: session.questionnaire_version_id, status: session.status, locale: session.locale, updatedAt: session.updated_at, submittedAt: session.submitted_at, rowVersion: session.row_version, titleFr: version.title_fr, titleAr: version.title_ar };
        const allQuestions = sectionModels.flatMap((section) => section.questions);
        selected = { ...summary, descriptionFr: version.description_fr, descriptionAr: version.description_ar, sections: sectionModels, answeredCount: allQuestions.filter((question) => question.answer !== null && !question.answer.requiresRevalidation).length, expiringAnswerCount: allQuestions.filter((question) => question.answer?.expiresAt != null).length, expiredAnswerCount: allQuestions.filter((question) => question.answer?.requiresRevalidation).length, questionCount: links.value.length };
      }
      return { status: "success", value: { organizations: organizations.value.map((organization) => ({ id: organization.id, name: organization.display_name })), documents: documents.value.filter((document) => document.organization_id === organizationIds[0]).map((document) => ({ id: document.id, organizationId: document.organization_id, name: document.original_file_name, type: document.document_type, mimeType: document.declared_mime_type, status: document.status })), questionnaires: available.value.map((version) => ({ id: version.id, version: version.version, titleFr: version.title_fr, titleAr: version.title_ar, descriptionFr: version.description_fr, descriptionAr: version.description_ar })), sessions: summaries.filter((session) => session.organizationId === organizationIds[0]), selected } };
    },
    async start(input) {
      const parsed = startSessionInput.safeParse({ ...input, dueAt: input.dueAt ?? "" });
      if (!parsed.success) return { status: "error", reason: "INVALID_INPUT" };
      const response = await source.rpc("start_questionnaire_session", { p_organization_id: parsed.data.organizationId, p_questionnaire_version_id: parsed.data.questionnaireVersionId, p_locale: parsed.data.locale === "ar" ? "ar-MA" : "fr-MA", p_due_at: parsed.data.dueAt ? `${parsed.data.dueAt}T23:59:59Z` : null, p_site_id: parsed.data.siteId ? parsed.data.siteId : null, p_idempotency_key: parsed.data.idempotencyKey, p_correlation_id: parsed.data.correlationId });
      if (response.error) return failure(response.error);
      const result = startedResponse.safeParse(response.data);
      return result.success ? { status: "success", value: { sessionId: result.data.session_id, rowVersion: result.data.row_version } } : { status: "error", reason: "INVALID_RESPONSE" };
    },
    async save(input) {
      if (!saveAnswerInput.safeParse(input).success) return { status: "error", reason: "INVALID_INPUT" };
      const response = await source.rpc("autosave_questionnaire_answers", { p_session_id: input.sessionId, p_expected_row_version: input.expectedSessionRowVersion, p_answers: [{ question_version_id: input.questionVersionId, value: input.value, expected_answer_row_version: input.expectedAnswerRowVersion }], p_idempotency_key: input.idempotencyKey, p_correlation_id: input.correlationId });
      if (response.error) return failure(response.error);
      const result = saveResponse.safeParse(response.data);
      if (!result.success) return { status: "error", reason: "INVALID_RESPONSE" };
      if (result.data.outcome !== "AUTOSAVE_SAVED") return { status: "error", reason: "CONFLICT" };
      const accepted = result.data.accepted?.find((item) => item.question_version_id === input.questionVersionId);
      return accepted ? { status: "success", value: { sessionId: result.data.session_id, serverRowVersion: result.data.server_row_version, answerRowVersion: accepted.answer_row_version } } : { status: "error", reason: "INVALID_RESPONSE" };
    },
    async submit(input) {
      if (!submitSessionInput.safeParse(input).success) return { status: "error", reason: "INVALID_INPUT" };
      const response = await source.rpc("submit_questionnaire_session", { p_session_id: input.sessionId, p_expected_row_version: input.expectedSessionRowVersion, p_idempotency_key: input.idempotencyKey, p_correlation_id: input.correlationId });
      if (response.error) return failure(response.error);
      const result = submittedResponse.safeParse(response.data);
      return result.success ? { status: "success", value: { sessionId: result.data.session_id, rowVersion: result.data.row_version, manifestHash: result.data.answer_manifest_hash } } : { status: "error", reason: "INVALID_RESPONSE" };
    },
  };
}
