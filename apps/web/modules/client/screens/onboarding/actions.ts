"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { organizationLegalProfileSchema as profilePayloadSchema } from "@/modules/shared/lib/organization-identity/profile";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const uuidSchema = z.string().uuid();
const complianceStatusSchema = z.enum([
  "PROFILE_IN_PROGRESS", "DOCUMENTS_REQUIRED", "UNDER_REVIEW", "QUESTION_REQUIRED",
  "RESPONSE_RECEIVED", "VERIFIED", "REJECTED", "SUSPENDED",
]);
const clientRoleSchema = z.enum(["CLIENT_OWNER", "CLIENT_ADMIN"]);


const membershipRowSchema = z.object({ id: uuidSchema, organization_id: uuidSchema });
const roleRowSchema = z.object({
  membership_id: uuidSchema,
  role_code: clientRoleSchema,
  revoked_at: z.string().nullable(),
});
const organizationRowSchema = z.object({
  id: uuidSchema,
  legal_name: z.string().min(2).max(200),
  display_name: z.string().min(2).max(200),
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"]),
});
const identifierRowSchema = z.object({
  organization_id: uuidSchema,
  identifier_type: z.literal("ICE"),
  normalized_value: z.string().min(1).max(64),
  verification_status: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]),
});
const caseRowSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  status: complianceStatusSchema,
  current_profile_version: z.number().int().positive().nullable(),
  submitted_at: z.string().nullable(),
  decision_reason_public: z.string().nullable(),
  verified_at: z.string().nullable(),
  activated_at: z.string().nullable(),
  updated_at: z.string(),
});
const profileRowSchema = z.object({
  compliance_case_id: uuidSchema,
  organization_id: uuidSchema,
  version: z.number().int().positive(),
  profile_data: profilePayloadSchema,
  created_at: z.string(),
});
const evidenceRowSchema = z.object({
  compliance_case_id: uuidSchema,
  organization_id: uuidSchema,
  evidence_type: z.enum(["REGISTRATION_DOCUMENT", "REPRESENTATIVE_AUTHORITY", "TAX_DOCUMENT"]),
  review_status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
});
const documentTypeSchema = z.enum(["REGISTRATION_DOCUMENT", "REPRESENTATIVE_AUTHORITY", "TAX_DOCUMENT"]);
const documentStatusSchema = z.enum(["UPLOAD_PENDING", "PENDING_REVIEW", "VERIFIED", "REJECTED", "QUARANTINED", "SUPERSEDED"]);
const documentRowSchema = z.object({
  organization_id: uuidSchema,
  document_type: documentTypeSchema,
  version: z.number().int().positive(),
  document_number: z.string().nullable(),
  issuer: z.string().nullable(),
  issued_on: z.string().nullable(),
  expires_on: z.string().nullable(),
  original_file_name: z.string().min(1),
  status: documentStatusSchema,
  rejection_reason_public: z.string().nullable(),
  uploaded_at: z.string().nullable(),
});
const anomalyRowSchema = z.object({
  organization_id: uuidSchema,
  client_message_fr: z.string().min(3).max(500),
  client_message_ar: z.string().min(3).max(500),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
  blocking: z.boolean(),
  status: z.enum(["OPEN", "QUESTIONED", "RESOLVED", "ACCEPTED_EXCEPTION"]),
  created_at: z.string(),
});
const questionRowSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  question_text_fr: z.string().min(3).max(1000),
  question_text_ar: z.string().min(3).max(1000),
  expected_document_type: z.string().nullable(),
  due_at: z.string(),
  status: z.enum(["OPEN", "ANSWERED", "ACCEPTED", "CLOSED"]),
  created_at: z.string(),
});
const responseVersionRowSchema = z.object({
  question_id: uuidSchema,
  organization_id: uuidSchema,
  version: z.number().int().positive(),
  submitted_at: z.string(),
});
const trialRowSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  compliance_case_id: uuidSchema,
  effective_status: z.enum(["TRIAL_ACTIVE", "TRIAL_EXPIRED"]),
  trial_started_at: z.string(),
  trial_ends_at: z.string(),
});

const actionBaseSchema = z.object({
  organizationId: uuidSchema,
  locale: z.string().refine(isLocale),
  idempotencyKey: uuidSchema,
});
const saveProfileSchema = actionBaseSchema.extend({
  legalForm: z.string().trim().min(2).max(120),
  incorporationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activity: z.string().trim().min(2).max(500),
  sector: z.string().trim().min(2).max(120),
  employeeCount: z.coerce.number().int().min(0).max(100_000_000),
  registeredCity: z.string().trim().min(2).max(120),
  addressLine1: z.string().trim().min(3).max(300),
  postalCode: z.string().trim().max(20),
  contactPhone: z.string().trim().min(6).max(40),
  contactEmail: z.string().trim().email().max(320),
  representativeFirstName: z.string().trim().min(2).max(120),
  representativeLastName: z.string().trim().min(2).max(120),
  representativeTitle: z.string().trim().min(2).max(160),
  representativeEmail: z.string().trim().email().max(320),
  representativePhone: z.string().trim().min(6).max(40),
  representativePower: z.string().trim().min(2).max(500),
  ifNumber: z.string().trim().min(3).max(40),
  rcNumber: z.string().trim().min(3).max(40),
  website: z.union([z.literal(""), z.string().trim().url().max(500)]),
  accuracyConfirmed: z.literal("yes"),
  representationAuthorized: z.literal("yes"),
});
const submitSchema = z.object({
  complianceCaseId: uuidSchema,
  locale: z.string().refine(isLocale),
  idempotencyKey: uuidSchema,
  confirmed: z.literal("yes"),
});
const CLIENT_DOCUMENT_MAX_BYTES = 10_485_760;
const allowedDocumentFiles = new Map([
  ["application/pdf", new Set(["pdf"])],
  ["image/jpeg", new Set(["jpg", "jpeg"])],
  ["image/png", new Set(["png"])],
]);
const documentUploadSchema = z.object({
  complianceCaseId: uuidSchema,
  locale: z.string().refine(isLocale),
  idempotencyKey: uuidSchema,
  documentType: documentTypeSchema,
  documentNumber: z.string().trim().min(2).max(120),
  issuer: z.string().trim().min(2).max(200),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiresOn: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
});
const beginDocumentOutcomeSchema = z.object({
  outcome: z.literal("DOCUMENT_UPLOAD_RESERVED"),
  document_id: uuidSchema,
  version: z.number().int().positive(),
  bucket: z.literal("client-compliance"),
  object_path: z.string().min(1).max(1000),
  status: z.literal("UPLOAD_PENDING"),
}).passthrough();
const finalizeDocumentOutcomeSchema = z.object({
  outcome: z.literal("DOCUMENT_UPLOADED"),
  status: z.literal("PENDING_REVIEW"),
}).passthrough();
const questionResponseSchema = z.object({
  questionId: uuidSchema,
  locale: z.string().refine(isLocale),
  idempotencyKey: uuidSchema,
  responseText: z.string().trim().min(3).max(4000),
});
const questionResponseOutcomeSchema = z.object({
  outcome: z.literal("COMPLIANCE_RESPONSE_RECEIVED"),
  version: z.number().int().positive(),
}).passthrough();
const saveOutcomeSchema = z.object({
  outcome: z.literal("CLIENT_PROFILE_VERSION_CREATED"),
  profile_version: z.number().int().positive(),
}).passthrough();
const submitOutcomeSchema = z.object({
  outcome: z.literal("CLIENT_COMPLIANCE_SUBMITTED"),
  status: z.literal("UNDER_REVIEW"),
}).passthrough();

export type ComplianceStatus = z.infer<typeof complianceStatusSchema>;
export type ClientProfileDraft = z.infer<typeof profilePayloadSchema>;
export type SafeEvidence = {
  type: "REGISTRATION_DOCUMENT" | "REPRESENTATIVE_AUTHORITY" | "TAX_DOCUMENT";
  status: "PENDING" | "VERIFIED" | "REJECTED";
};
export type SafeComplianceDocument = {
  type: z.infer<typeof documentTypeSchema>;
  version: number;
  documentNumber: string | null;
  issuer: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  originalFileName: string;
  status: z.infer<typeof documentStatusSchema>;
  rejectionReasonPublic: string | null;
  uploadedAt: string | null;
};
export type SafeAdministrativeAnomaly = {
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  blocking: boolean;
  status: "OPEN" | "QUESTIONED" | "RESOLVED" | "ACCEPTED_EXCEPTION";
  createdAt: string;
};
export type SafeComplianceQuestion = {
  id: string;
  text: string;
  expectedDocumentType: string | null;
  dueAt: string;
  status: "OPEN" | "ANSWERED" | "ACCEPTED" | "CLOSED";
  createdAt: string;
  latestResponseVersion: number | null;
  latestResponseAt: string | null;
};
export type SafeTrial = {
  id: string;
  status: "TRIAL_ACTIVE" | "TRIAL_EXPIRED";
  startedAt: string;
  endsAt: string;
};
export type ClientOnboardingOrganization = {
  id: string;
  legalName: string;
  displayName: string;
  organizationStatus: "PENDING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  ice: string | null;
  iceVerificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" | null;
  complianceCase: {
    id: string;
    status: ComplianceStatus;
    currentProfileVersion: number | null;
    submittedAt: string | null;
    decisionReasonPublic: string | null;
    verifiedAt: string | null;
    activatedAt: string | null;
    updatedAt: string;
  } | null;
  latestProfile: { version: number; data: ClientProfileDraft; createdAt: string } | null;
  evidence: SafeEvidence[];
  documents: SafeComplianceDocument[];
  anomalies: SafeAdministrativeAnomaly[];
  questions: SafeComplianceQuestion[];
  trial: SafeTrial | null;
};
export type ClientOnboardingQueryResult =
  | { status: "success"; organizations: ClientOnboardingOrganization[] }
  | { status: "error"; reason: "UNAUTHENTICATED" | "UNAVAILABLE" };
export type ProfileActionState =
  | { status: "idle" }
  | { status: "success"; profileVersion: number }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "UNAVAILABLE" };
export type SubmitActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "UNAVAILABLE" };
export type DocumentUploadActionState =
  | { status: "idle" }
  | { status: "success"; documentType: z.infer<typeof documentTypeSchema>; version: number }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "UPLOAD" | "UNAVAILABLE" };
export type QuestionResponseActionState =
  | { status: "idle" }
  | { status: "success"; version: number }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "UNAVAILABLE" };

function formValue(formData: FormData, key: string) {
  return formData.get(key);
}

export async function listClientOnboarding(locale: "fr" | "ar" = "fr"): Promise<ClientOnboardingQueryResult> {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { status: "error", reason: "UNAUTHENTICATED" };

  const { data: rawMemberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("id,organization_id")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE");
  if (membershipError) return { status: "error", reason: "UNAVAILABLE" };
  const memberships = z.array(membershipRowSchema).safeParse(rawMemberships);
  if (!memberships.success) return { status: "error", reason: "UNAVAILABLE" };
  if (memberships.data.length === 0) return { status: "success", organizations: [] };

  const membershipIds = memberships.data.map((membership) => membership.id);
  const { data: rawRoles, error: roleError } = await supabase
    .from("organization_member_roles")
    .select("membership_id,role_code,revoked_at")
    .in("membership_id", membershipIds)
    .in("role_code", ["CLIENT_OWNER", "CLIENT_ADMIN"]);
  if (roleError) return { status: "error", reason: "UNAVAILABLE" };
  const roles = z.array(roleRowSchema).safeParse(rawRoles);
  if (!roles.success) return { status: "error", reason: "UNAVAILABLE" };
  const eligibleMembershipIds = new Set(roles.data.filter((role) => role.revoked_at === null).map((role) => role.membership_id));
  const organizationIds = [...new Set(memberships.data
    .filter((membership) => eligibleMembershipIds.has(membership.id))
    .map((membership) => membership.organization_id))];
  if (organizationIds.length === 0) return { status: "success", organizations: [] };

  const [organizationsResult, identifiersResult, casesResult, profilesResult, evidenceResult, documentsResult, anomaliesResult, questionsResult, responsesResult, trialsResult] = await Promise.all([
    supabase.from("organizations").select("id,legal_name,display_name,status").in("id", organizationIds),
    supabase.from("organization_identifiers")
      .select("organization_id,identifier_type,normalized_value,verification_status")
      .in("organization_id", organizationIds).eq("identifier_type", "ICE").eq("is_active", true),
    supabase.from("client_compliance_cases")
      .select("id,organization_id,status,current_profile_version,submitted_at,decision_reason_public,verified_at,activated_at,updated_at")
      .in("organization_id", organizationIds),
    supabase.from("client_profile_versions")
      .select("compliance_case_id,organization_id,version,profile_data,created_at")
      .in("organization_id", organizationIds).order("version", { ascending: false }),
    supabase.from("client_compliance_evidence")
      .select("compliance_case_id,organization_id,evidence_type,review_status")
      .in("organization_id", organizationIds),
    supabase.from("client_compliance_documents")
      .select("organization_id,document_type,version,document_number,issuer,issued_on,expires_on,original_file_name,status,rejection_reason_public,uploaded_at")
      .in("organization_id", organizationIds),
    supabase.from("client_administrative_anomalies")
      .select("organization_id,client_message_fr,client_message_ar,severity,blocking,status,created_at")
      .in("organization_id", organizationIds),
    supabase.from("client_compliance_questions")
      .select("id,organization_id,question_text_fr,question_text_ar,expected_document_type,due_at,status,created_at")
      .in("organization_id", organizationIds),
    supabase.from("client_compliance_response_versions")
      .select("question_id,organization_id,version,submitted_at")
      .in("organization_id", organizationIds).order("version", { ascending: false }),
    supabase.rpc("list_my_client_trials"),
  ]);
  if (organizationsResult.error || identifiersResult.error || casesResult.error
      || profilesResult.error || evidenceResult.error || documentsResult.error || anomaliesResult.error
      || questionsResult.error || responsesResult.error || trialsResult.error) {
    return { status: "error", reason: "UNAVAILABLE" };
  }
  const organizations = z.array(organizationRowSchema).safeParse(organizationsResult.data);
  const identifiers = z.array(identifierRowSchema).safeParse(identifiersResult.data);
  const cases = z.array(caseRowSchema).safeParse(casesResult.data);
  const profiles = z.array(profileRowSchema).safeParse(profilesResult.data);
  const evidence = z.array(evidenceRowSchema).safeParse(evidenceResult.data);
  const documents = z.array(documentRowSchema).safeParse(documentsResult.data);
  const anomalies = z.array(anomalyRowSchema).safeParse(anomaliesResult.data);
  const questions = z.array(questionRowSchema).safeParse(questionsResult.data);
  const responses = z.array(responseVersionRowSchema).safeParse(responsesResult.data);
  const trials = z.array(trialRowSchema).safeParse(trialsResult.data);
  if (!organizations.success || !identifiers.success || !cases.success
      || !profiles.success || !evidence.success || !documents.success || !anomalies.success
      || !questions.success || !responses.success || !trials.success) {
    return { status: "error", reason: "UNAVAILABLE" };
  }

  const caseByOrganization = new Map(cases.data.map((complianceCase) => [complianceCase.organization_id, complianceCase]));
  const profileByOrganization = new Map<string, z.infer<typeof profileRowSchema>>();
  for (const profile of profiles.data) if (!profileByOrganization.has(profile.organization_id)) profileByOrganization.set(profile.organization_id, profile);
  const identifierByOrganization = new Map(identifiers.data.map((identifier) => [identifier.organization_id, identifier]));
  const trialByOrganization = new Map(trials.data.map((trial) => [trial.organization_id, trial]));
  const latestResponseByQuestion = new Map<string, z.infer<typeof responseVersionRowSchema>>();
  for (const response of responses.data) if (!latestResponseByQuestion.has(response.question_id)) latestResponseByQuestion.set(response.question_id, response);

  return {
    status: "success",
    organizations: organizations.data.map((organization) => {
      const complianceCase = caseByOrganization.get(organization.id) ?? null;
      const profile = profileByOrganization.get(organization.id) ?? null;
      const identifier = identifierByOrganization.get(organization.id) ?? null;
      const trial = trialByOrganization.get(organization.id) ?? null;
      return {
        id: organization.id,
        legalName: organization.legal_name,
        displayName: organization.display_name,
        organizationStatus: organization.status,
        ice: identifier?.normalized_value ?? null,
        iceVerificationStatus: identifier?.verification_status ?? null,
        complianceCase: complianceCase ? {
          id: complianceCase.id,
          status: complianceCase.status,
          currentProfileVersion: complianceCase.current_profile_version,
          submittedAt: complianceCase.submitted_at,
          decisionReasonPublic: complianceCase.decision_reason_public,
          verifiedAt: complianceCase.verified_at,
          activatedAt: complianceCase.activated_at,
          updatedAt: complianceCase.updated_at,
        } : null,
        latestProfile: profile ? { version: profile.version, data: profile.profile_data, createdAt: profile.created_at } : null,
        evidence: evidence.data
          .filter((item) => item.organization_id === organization.id)
          .map((item) => ({ type: item.evidence_type, status: item.review_status })),
        documents: documents.data
          .filter((item) => item.organization_id === organization.id)
          .map((item) => ({
            type: item.document_type,
            version: item.version,
            documentNumber: item.document_number,
            issuer: item.issuer,
            issuedOn: item.issued_on,
            expiresOn: item.expires_on,
            originalFileName: item.original_file_name,
            status: item.status,
            rejectionReasonPublic: item.rejection_reason_public,
            uploadedAt: item.uploaded_at,
          })),
        anomalies: anomalies.data
          .filter((item) => item.organization_id === organization.id)
          .map((item) => ({
            message: locale === "ar" ? item.client_message_ar : item.client_message_fr,
            severity: item.severity,
            blocking: item.blocking,
            status: item.status,
            createdAt: item.created_at,
          })),
        questions: questions.data
          .filter((item) => item.organization_id === organization.id)
          .map((item) => {
            const latestResponse = latestResponseByQuestion.get(item.id) ?? null;
            return {
              id: item.id,
              text: locale === "ar" ? item.question_text_ar : item.question_text_fr,
              expectedDocumentType: item.expected_document_type,
              dueAt: item.due_at,
              status: item.status,
              createdAt: item.created_at,
              latestResponseVersion: latestResponse?.version ?? null,
              latestResponseAt: latestResponse?.submitted_at ?? null,
            };
          }),
        trial: trial ? { id: trial.id, status: trial.effective_status, startedAt: trial.trial_started_at, endsAt: trial.trial_ends_at } : null,
      };
    }),
  };
}

export async function respondClientComplianceQuestion(
  _previousState: QuestionResponseActionState,
  formData: FormData,
): Promise<QuestionResponseActionState> {
  const parsed = questionResponseSchema.safeParse({
    questionId: formData.get("questionId"),
    locale: formData.get("locale"),
    idempotencyKey: formData.get("idempotencyKey"),
    responseText: formData.get("responseText"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { status: "error", reason: "UNAUTHENTICATED" };
  const { data, error } = await supabase.rpc("respond_client_compliance_question", {
    p_question_id: parsed.data.questionId,
    p_response_text: parsed.data.responseText,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: randomUUID(),
  });
  if (error) return { status: "error", reason: "UNAVAILABLE" };
  const outcome = questionResponseOutcomeSchema.safeParse(data);
  if (!outcome.success) return { status: "error", reason: "UNAVAILABLE" };
  revalidatePath(`/${parsed.data.locale}/client/onboarding`);
  return { status: "success", version: outcome.data.version };
}

function validDocumentFile(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value === "string" || typeof value.arrayBuffer !== "function") return false;
  const extension = value.name.split(".").pop()?.toLowerCase() ?? "";
  return value.size > 0
    && value.size <= CLIENT_DOCUMENT_MAX_BYTES
    && Boolean(allowedDocumentFiles.get(value.type)?.has(extension));
}

function hasDocumentSignature(mimeType: string, bytes: Uint8Array): boolean {
  const signatures: Record<string, number[]> = {
    "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  };
  const expected = signatures[mimeType];
  return Boolean(expected && bytes.length >= expected.length
    && expected.every((value, index) => bytes[index] === value));
}

export async function uploadClientComplianceDocument(
  _previousState: DocumentUploadActionState,
  formData: FormData,
): Promise<DocumentUploadActionState> {
  const parsed = documentUploadSchema.safeParse({
    complianceCaseId: formData.get("complianceCaseId"),
    locale: formData.get("locale"),
    idempotencyKey: formData.get("idempotencyKey"),
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber"),
    issuer: formData.get("issuer"),
    issuedOn: formData.get("issuedOn"),
    expiresOn: formData.get("expiresOn"),
  });
  const file = formData.get("file");
  if (!parsed.success || !validDocumentFile(file)) return { status: "error", reason: "VALIDATION" };

  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { status: "error", reason: "UNAUTHENTICATED" };

  let fileBytes: Buffer;
  try {
    fileBytes = Buffer.from(await file.arrayBuffer());
  } catch {
    return { status: "error", reason: "VALIDATION" };
  }
  if (!hasDocumentSignature(file.type, fileBytes)) return { status: "error", reason: "VALIDATION" };

  const sha256 = createHash("sha256").update(fileBytes).digest("hex");
  const correlationId = randomUUID();
  const { data: reservedData, error: reserveError } = await supabase.rpc("begin_client_compliance_document_upload", {
    p_compliance_case_id: parsed.data.complianceCaseId,
    p_document_type: parsed.data.documentType,
    p_document_number: parsed.data.documentNumber,
    p_issuer: parsed.data.issuer,
    p_issued_on: parsed.data.issuedOn,
    p_expires_on: parsed.data.expiresOn || null,
    p_original_file_name: file.name,
    p_mime_type: file.type,
    p_size_bytes: file.size,
    p_sha256: sha256,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: correlationId,
  });
  if (reserveError) return { status: "error", reason: "UNAVAILABLE" };
  const reserved = beginDocumentOutcomeSchema.safeParse(reservedData);
  if (!reserved.success) return { status: "error", reason: "UNAVAILABLE" };

  const { error: uploadError } = await supabase.storage.from(reserved.data.bucket).upload(
    reserved.data.object_path,
    fileBytes,
    { contentType: file.type, upsert: false },
  );
  const conflict = uploadError && ("statusCode" in uploadError) && String(uploadError.statusCode) === "409";
  if (uploadError && !conflict) return { status: "error", reason: "UPLOAD" };

  const { data: finalizedData, error: finalizeError } = await supabase.rpc("finalize_client_compliance_document_upload", {
    p_document_id: reserved.data.document_id,
    p_idempotency_key: `${parsed.data.idempotencyKey}:finalize`,
    p_correlation_id: correlationId,
  });
  if (finalizeError || !finalizeDocumentOutcomeSchema.safeParse(finalizedData).success) {
    return { status: "error", reason: "UNAVAILABLE" };
  }
  revalidatePath(`/${parsed.data.locale}/client/onboarding`);
  return { status: "success", documentType: parsed.data.documentType, version: reserved.data.version };
}

export async function saveClientProfile(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parsed = saveProfileSchema.safeParse({
    organizationId: formValue(formData, "organizationId"),
    locale: formValue(formData, "locale"),
    idempotencyKey: formValue(formData, "idempotencyKey"),
    legalForm: formValue(formData, "legalForm"),
    incorporationDate: formValue(formData, "incorporationDate"),
    activity: formValue(formData, "activity"),
    sector: formValue(formData, "sector"),
    employeeCount: formValue(formData, "employeeCount"),
    registeredCity: formValue(formData, "registeredCity"),
    addressLine1: formValue(formData, "addressLine1"),
    postalCode: formValue(formData, "postalCode"),
    contactPhone: formValue(formData, "contactPhone"),
    contactEmail: formValue(formData, "contactEmail"),
    representativeFirstName: formValue(formData, "representativeFirstName"),
    representativeLastName: formValue(formData, "representativeLastName"),
    representativeTitle: formValue(formData, "representativeTitle"),
    representativeEmail: formValue(formData, "representativeEmail"),
    representativePhone: formValue(formData, "representativePhone"),
    representativePower: formValue(formData, "representativePower"),
    ifNumber: formValue(formData, "ifNumber"),
    rcNumber: formValue(formData, "rcNumber"),
    website: formValue(formData, "website"),
    accuracyConfirmed: formValue(formData, "accuracyConfirmed"),
    representationAuthorized: formValue(formData, "representationAuthorized"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { status: "error", reason: "UNAUTHENTICATED" };
  const value = parsed.data;
  const profile: ClientProfileDraft = {
    legal_form: value.legalForm,
    incorporation_date: value.incorporationDate,
    activity: value.activity,
    sector: value.sector,
    employee_count: value.employeeCount,
    registered_city: value.registeredCity,
    registered_address: {
      line1: value.addressLine1,
      ...(value.postalCode ? { postal_code: value.postalCode } : {}),
      country_code: "MA",
    },
    contact: { phone: value.contactPhone, email: value.contactEmail.toLowerCase() },
    representative: {
      first_name: value.representativeFirstName,
      last_name: value.representativeLastName,
      title: value.representativeTitle,
      email: value.representativeEmail.toLowerCase(),
      phone: value.representativePhone,
      power: value.representativePower,
    },
    declarations: { accuracy_confirmed: true, representation_authorized: true },
    if_number: value.ifNumber,
    rc_number: value.rcNumber,
    ...(value.website ? { website: value.website } : {}),
  };
  const { data, error } = await supabase.rpc("save_client_profile_draft", {
    p_organization_id: value.organizationId,
    p_profile: profile,
    p_idempotency_key: value.idempotencyKey,
    p_correlation_id: randomUUID(),
  });
  if (error) return { status: "error", reason: "UNAVAILABLE" };
  const outcome = saveOutcomeSchema.safeParse(data);
  if (!outcome.success) return { status: "error", reason: "UNAVAILABLE" };
  revalidatePath(`/${value.locale}/client/onboarding`);
  return { status: "success", profileVersion: outcome.data.profile_version };
}

export async function submitClientCompliance(
  _previousState: SubmitActionState,
  formData: FormData,
): Promise<SubmitActionState> {
  const parsed = submitSchema.safeParse({
    complianceCaseId: formData.get("complianceCaseId"),
    locale: formData.get("locale"),
    idempotencyKey: formData.get("idempotencyKey"),
    confirmed: formData.get("confirmed"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { status: "error", reason: "UNAUTHENTICATED" };
  const { data, error } = await supabase.rpc("submit_client_compliance", {
    p_compliance_case_id: parsed.data.complianceCaseId,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: randomUUID(),
  });
  if (error) return { status: "error", reason: "UNAVAILABLE" };
  const outcome = submitOutcomeSchema.safeParse(data);
  if (!outcome.success) return { status: "error", reason: "UNAVAILABLE" };
  revalidatePath(`/${parsed.data.locale}/client/onboarding`);
  return { status: "success" };
}
