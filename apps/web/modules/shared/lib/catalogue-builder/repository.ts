import { z } from "zod";
import type { BuilderResult, CatalogBuilderRepository, ReleaseDraft, ReleaseItemInput } from "./contracts";
import {
  builderDraftSchema,
  catalogEntityStatusSchema,
  isCatalogFixtureCode,
  isCatalogOperatorLibrary,
  isCatalogScratchLabel,
  questionnaireDraftInputSchema,
  questionDraftInputSchema,
  ruleDraftInputSchema,
  type BuilderDraft,
  type BuilderLibrary,
  type BuilderService,
  type BuilderWorkspace,
  uuidSchema,
} from "./model";

const versionNameRow = z.object({ name_fr: z.string().min(2).max(240), name_ar: z.string().min(2).max(240) }).strict();
const embeddedName = z.preprocess((value) => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}, versionNameRow.nullable());
const libraryRow = z.object({
  id: uuidSchema,
  code: z.string().min(2).max(80),
  status: catalogEntityStatusSchema,
  row_version: z.number().int().positive(),
  current_release_id: uuidSchema.nullable(),
  published: embeddedName.optional(),
  draft: embeddedName.optional(),
}).strict();
const serviceRow = z.object({
  id: uuidSchema,
  library_id: uuidSchema,
  code: z.string().min(2).max(80),
  slug: z.string().min(1).max(80),
  status: catalogEntityStatusSchema,
  published: embeddedName.optional(),
  draft: embeddedName.optional(),
}).strict();

function mapLibrary(library: z.infer<typeof libraryRow>): BuilderLibrary {
  const named = library.published ?? library.draft ?? null;
  return {
    id: library.id,
    code: library.code,
    status: library.status,
    rowVersion: library.row_version,
    currentReleaseId: library.current_release_id,
    nameFr: named?.name_fr ?? null,
    nameAr: named?.name_ar ?? null,
    fixture: isCatalogFixtureCode(library.code),
  };
}

function mapService(service: z.infer<typeof serviceRow>): BuilderService {
  const named = service.published ?? service.draft ?? null;
  return {
    id: service.id,
    libraryId: service.library_id,
    code: service.code,
    slug: service.slug,
    status: service.status,
    nameFr: named?.name_fr ?? null,
    nameAr: named?.name_ar ?? null,
    fixture: isCatalogFixtureCode(service.code),
  };
}

function libraryDisplayKey(library: BuilderLibrary): string {
  return (library.nameFr ?? library.nameAr ?? library.code).normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

function preferOperationalLibraries(libraries: BuilderLibrary[], selectedId: string | null): BuilderLibrary[] {
  const selected = selectedId ? libraries.find((item) => item.id === selectedId) : undefined;
  const operational = libraries.filter((item) => isCatalogOperatorLibrary(item));
  const published = operational.filter((item) => item.status === "PUBLISHED" || item.status === "APPROVED");
  const pool = published.length ? published : operational;
  const ranked = [...pool].sort((left, right) => {
    const rank = (item: BuilderLibrary) => (item.status === "PUBLISHED" ? 0 : item.status === "APPROVED" ? 1 : 2);
    const byStatus = rank(left) - rank(right);
    if (byStatus !== 0) return byStatus;
    return (left.nameFr ?? left.code).localeCompare(right.nameFr ?? right.code, "fr");
  });
  const unique: BuilderLibrary[] = [];
  const seen = new Set<string>();
  for (const item of ranked) {
    const key = libraryDisplayKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  const limited = unique.slice(0, 20);
  if (selected && !limited.some((item) => item.id === selected.id)) {
    if (isCatalogOperatorLibrary(selected) || selectedId) return [selected, ...limited.slice(0, 19)];
  }
  return limited;
}
const draftReleaseRow = z.object({ id: uuidSchema, library_id: uuidSchema, release_key: z.string().min(3), row_version: z.number().int().positive(), status: z.literal("DRAFT") }).strict();
const approvedServiceVersionRow = z.object({ id: uuidSchema, service_id: uuidSchema, library_id: uuidSchema, version: z.number().int().positive(), status: z.literal("APPROVED"), name_fr: z.string().min(2), name_ar: z.string().min(2) }).strict();
const releaseContextRow = z.object({ id: uuidSchema, library_id: uuidSchema, row_version: z.number().int().positive(), status: z.literal("DRAFT") }).strict();
const serviceVersionContextRow = z.object({ id: uuidSchema, service_id: uuidSchema, library_id: uuidSchema, content_hash: z.string().regex(/^[0-9a-f]{64}$/u), status: z.literal("APPROVED") }).strict();
const releaseOrderRow = z.object({ sort_order: z.number().int().positive() }).strict();
const createdRelease = z.object({ outcome: z.literal("CATALOG_RELEASE_CREATED"), release_id: uuidSchema, status: z.literal("DRAFT"), library_row_version: z.number().int().positive() }).strict();
const addedItem = z.object({ outcome: z.literal("CATALOG_RELEASE_ITEM_ADDED"), release_id: uuidSchema, release_row_version: z.number().int().positive() }).strict();
const submittedRelease = z.object({ outcome: z.literal("CATALOG_RELEASE_SUBMITTED"), release_id: uuidSchema, status: z.enum(["APPROVED", "IN_REVIEW"]), snapshot_hash: z.string().regex(/^[0-9a-f]{64}$/u) }).strict();
const createdQuestion = z.object({
  outcome: z.literal("CATALOG_QUESTION_CREATED"), question_id: uuidSchema, library_id: uuidSchema, version_id: uuidSchema,
  identity_row_version: z.number().int().positive(), version_row_version: z.number().int().positive(),
  content_hash: z.string().regex(/^[0-9a-f]{64}$/u), command_id: uuidSchema,
}).strict();
const createdRule = z.object({
  outcome: z.literal("CATALOG_RULE_CREATED"), rule_id: uuidSchema, library_id: uuidSchema, version_id: uuidSchema,
  identity_row_version: z.number().int().positive(), version_row_version: z.number().int().positive(),
  compiled_hash: z.string().regex(/^[0-9a-f]{64}$/u), command_id: uuidSchema,
}).strict();
const createdQuestionnaire = z.object({
  outcome: z.literal("CATALOG_QUESTIONNAIRE_CREATED"), questionnaire_id: uuidSchema, library_id: uuidSchema,
  version_id: uuidSchema, section_id: uuidSchema, identity_row_version: z.number().int().positive(), version_row_version: z.number().int().positive(),
  snapshot_hash: z.string().regex(/^[0-9a-f]{64}$/u), command_id: uuidSchema,
}).strict();

type QueryResponse = { data: unknown; error: { code?: string } | null };
export type BuilderRepositoryDependencies = {
  authenticated(): Promise<boolean>;
  libraries(): Promise<QueryResponse>;
  library(libraryId: string): Promise<QueryResponse>;
  services(libraryId: string): Promise<QueryResponse>;
  draftReleases(libraryId: string): Promise<QueryResponse>;
  approvedServiceVersions(libraryId: string): Promise<QueryResponse>;
  release(releaseId: string): Promise<QueryResponse>;
  serviceVersion(versionId: string): Promise<QueryResponse>;
  lastReleaseItem(releaseId: string): Promise<QueryResponse>;
  rpc(name: string, input: Record<string, unknown>): Promise<QueryResponse>;
};

function failure(error: { code?: string } | null): BuilderResult<never> {
  return { status: "error", reason: error?.code === "42501" ? "FORBIDDEN" : "UNAVAILABLE" };
}

export function createCatalogBuilderRepository(dependencies: BuilderRepositoryDependencies): CatalogBuilderRepository {
  return {
    async loadWorkspace(libraryId) {
      if (!await dependencies.authenticated()) return { status: "error", reason: "UNAUTHENTICATED" };
      const librariesResponse = await dependencies.libraries();
      if (librariesResponse.error) return failure(librariesResponse.error);
      const parsedLibraries = z.array(libraryRow).max(80).safeParse(librariesResponse.data);
      if (!parsedLibraries.success) return { status: "error", reason: "INVALID_RESPONSE" };
      let libraries = preferOperationalLibraries(parsedLibraries.data.map(mapLibrary), libraryId);
      let services: BuilderWorkspace["services"] = [], draftReleases: BuilderWorkspace["draftReleases"] = [], approvedServiceVersions: BuilderWorkspace["approvedServiceVersions"] = [];
      if (libraryId) {
        if (!uuidSchema.safeParse(libraryId).success) return { status: "error", reason: "INVALID_INPUT" };
        if (!libraries.some((library) => library.id === libraryId)) {
          const selectedResponse = await dependencies.library(libraryId);
          if (selectedResponse.error) return failure(selectedResponse.error);
          const selected = z.array(libraryRow).max(1).safeParse(selectedResponse.data);
          if (!selected.success) return { status: "error", reason: "INVALID_RESPONSE" };
          if (selected.data.length !== 1 || selected.data[0].id !== libraryId) return { status: "error", reason: "INVALID_INPUT" };
          libraries = preferOperationalLibraries([mapLibrary(selected.data[0]), ...libraries], libraryId);
        }
        const servicesResponse = await dependencies.services(libraryId);
        if (servicesResponse.error) return failure(servicesResponse.error);
        const parsed = z.array(serviceRow).max(200).safeParse(servicesResponse.data);
        if (!parsed.success || parsed.data.some((service) => service.library_id !== libraryId)) return { status: "error", reason: "INVALID_RESPONSE" };
        const mappedServices = parsed.data.map(mapService);
        const operationalServices = mappedServices.filter((service) => (
          !service.fixture
          && !isCatalogScratchLabel(service.nameFr)
          && !isCatalogScratchLabel(service.nameAr)
          && Boolean(service.nameFr?.trim() || service.nameAr?.trim())
        ));
        const publishedServices = operationalServices.filter(
          (service) => service.status === "PUBLISHED" || service.status === "APPROVED",
        );
        const servicePool = publishedServices.length
          ? publishedServices
          : (operationalServices.length ? operationalServices : mappedServices.filter((service) => !service.fixture));
        services = servicePool
          .slice()
          .sort((left, right) => (left.nameFr ?? left.code).localeCompare(right.nameFr ?? right.code, "fr"));
        const [releaseResponse, versionResponse] = await Promise.all([dependencies.draftReleases(libraryId), dependencies.approvedServiceVersions(libraryId)]);
        if (releaseResponse.error || versionResponse.error) return failure(releaseResponse.error ?? versionResponse.error);
        const releases = z.array(draftReleaseRow).max(100).safeParse(releaseResponse.data), versions = z.array(approvedServiceVersionRow).max(500).safeParse(versionResponse.data);
        if (!releases.success || !versions.success || releases.data.some(item => item.library_id !== libraryId) || versions.data.some(item => item.library_id !== libraryId)) return { status: "error", reason: "INVALID_RESPONSE" };
        draftReleases = releases.data.map(item => ({ id: item.id, libraryId: item.library_id, key: item.release_key, rowVersion: item.row_version }));
        approvedServiceVersions = versions.data.map(item => ({ id: item.id, serviceId: item.service_id, libraryId: item.library_id, version: item.version, nameFr: item.name_fr, nameAr: item.name_ar }));
      }
      return { status: "success", value: {
        libraries,
        services, draftReleases, approvedServiceVersions,
        questionnairePersistenceAvailable: false,
      } };
    },
    async persistQuestionnaireDraft(draft: BuilderDraft) {
      if (!builderDraftSchema.safeParse(draft).success) return { status: "error", reason: "INVALID_INPUT" };
      return { status: "error", reason: "MISSING_QUESTIONNAIRE_WRITE_RPC" };
    },
    async createQuestion(input) {
      const parsedInput = questionDraftInputSchema.safeParse(input);
      if (!parsedInput.success) return { status: "error", reason: "INVALID_INPUT" };
      if (!await dependencies.authenticated()) return { status: "error", reason: "UNAUTHENTICATED" };
      const value = parsedInput.data;
      const response = await dependencies.rpc("create_catalog_question", {
        p_library_id: value.libraryId,
        p_question_key: value.questionKey,
        p_scope: "SERVICE",
        p_payload: {
          label_fr: value.labelFr, label_ar: value.labelAr,
          ...(value.helpFr ? { help_fr: value.helpFr } : {}), ...(value.helpAr ? { help_ar: value.helpAr } : {}),
          answer_type: value.answerType, data_key: value.dataKey,
          required_by_default: value.requiredByDefault, required_for_quote: value.requiredForQuote, required_for_publication: false,
          options: [], validation_schema: value.answerType === "INTEGER" ? { precision: 18, scale: 0, rounding: "HALF_EVEN" } : {},
          sensitivity: value.sensitivity, nullable: !value.requiredByDefault, weight: 0, maximum_score: 0,
          source_service_id: value.serviceId,
        },
        p_change_reason: value.changeReason, p_idempotency_key: value.idempotencyKey, p_correlation_id: value.correlationId,
      });
      if (response.error) return failure(response.error);
      const parsed = createdQuestion.safeParse(response.data);
      return parsed.success && parsed.data.library_id === value.libraryId
        ? { status: "success", value: { questionId: parsed.data.question_id, versionId: parsed.data.version_id, identityRowVersion: parsed.data.identity_row_version, versionRowVersion: parsed.data.version_row_version, contentHash: parsed.data.content_hash } }
        : { status: "error", reason: "INVALID_RESPONSE" };
    },
    async createRule(input) {
      const parsedInput = ruleDraftInputSchema.safeParse(input);
      if (!parsedInput.success) return { status: "error", reason: "INVALID_INPUT" };
      if (!await dependencies.authenticated()) return { status: "error", reason: "UNAUTHENTICATED" };
      const value = parsedInput.data;
      const response = await dependencies.rpc("create_catalog_rule", {
        p_library_id: value.libraryId, p_rule_key: value.ruleKey,
        p_payload: {
          condition_ast: { kind: "PREDICATE", operator: "EQ", questionKey: value.questionKey, operand: value.expectedBoolean },
          actions: [{ type: value.actionType, target: value.actionTarget }],
          dependency_graph: { [value.questionKey]: [value.ruleKey] }, priority: value.priority, sensitive: value.sensitive,
        },
        p_change_reason: value.changeReason, p_idempotency_key: value.idempotencyKey, p_correlation_id: value.correlationId,
      });
      if (response.error) return failure(response.error);
      const parsed = createdRule.safeParse(response.data);
      return parsed.success && parsed.data.library_id === value.libraryId
        ? { status: "success", value: { ruleId: parsed.data.rule_id, versionId: parsed.data.version_id, identityRowVersion: parsed.data.identity_row_version, versionRowVersion: parsed.data.version_row_version, compiledHash: parsed.data.compiled_hash } }
        : { status: "error", reason: "INVALID_RESPONSE" };
    },
    async createQuestionnaire(input) {
      const parsedInput = questionnaireDraftInputSchema.safeParse(input);
      if (!parsedInput.success) return { status: "error", reason: "INVALID_INPUT" };
      if (!await dependencies.authenticated()) return { status: "error", reason: "UNAUTHENTICATED" };
      const value = parsedInput.data;
      const response = await dependencies.rpc("create_catalog_questionnaire", {
        p_library_id: value.libraryId, p_catalog_release_id: value.catalogReleaseId, p_code: value.code,
        p_payload: { title_fr: value.titleFr, title_ar: value.titleAr, description_fr: value.descriptionFr, description_ar: value.descriptionAr,
          audience: value.audience, engine_version: value.engineVersion, policy_version: value.policyVersion, sensitive: value.sensitive,
          section_key: value.sectionKey, section_label_fr: value.sectionLabelFr, section_label_ar: value.sectionLabelAr,
          ...(value.sectionHelpFr ? { section_help_fr: value.sectionHelpFr } : {}), ...(value.sectionHelpAr ? { section_help_ar: value.sectionHelpAr } : {}) },
        p_change_reason: value.changeReason, p_idempotency_key: value.idempotencyKey, p_correlation_id: value.correlationId,
      });
      if (response.error) return failure(response.error);
      const parsed = createdQuestionnaire.safeParse(response.data);
      return parsed.success && parsed.data.library_id === value.libraryId
        ? { status: "success", value: { questionnaireId: parsed.data.questionnaire_id, versionId: parsed.data.version_id, sectionId: parsed.data.section_id, identityRowVersion: parsed.data.identity_row_version, versionRowVersion: parsed.data.version_row_version, snapshotHash: parsed.data.snapshot_hash } }
        : { status: "error", reason: "INVALID_RESPONSE" };
    },
    async createRelease(input): Promise<BuilderResult<ReleaseDraft>> {
      if (!await dependencies.authenticated()) return { status: "error", reason: "UNAUTHENTICATED" };
      if (!uuidSchema.safeParse(input.libraryId).success || !/^[A-Z][A-Z0-9_.-]{2,119}$/u.test(input.releaseKey)
          || !/^[0-9a-f]{64}$/u.test(input.sourceBundleHash) || !Number.isSafeInteger(input.expectedLibraryRowVersion) || input.expectedLibraryRowVersion < 1
          || !uuidSchema.safeParse(input.idempotencyKey).success || !uuidSchema.safeParse(input.correlationId).success) {
        return { status: "error", reason: "INVALID_INPUT" };
      }
      const response = await dependencies.rpc("create_catalog_release", {
        p_library_id: input.libraryId, p_release_key: input.releaseKey, p_source_bundle_hash: input.sourceBundleHash,
        p_requires_central_approval: input.requiresCentralApproval, p_expected_library_row_version: input.expectedLibraryRowVersion,
        p_idempotency_key: input.idempotencyKey, p_correlation_id: input.correlationId,
      });
      if (response.error) return failure(response.error);
      const parsed = createdRelease.safeParse(response.data);
      return parsed.success ? { status: "success", value: { id: parsed.data.release_id, rowVersion: 1 } } : { status: "error", reason: "INVALID_RESPONSE" };
    },
    async addReleaseItem(input: ReleaseItemInput) {
      if (!await dependencies.authenticated()) return { status: "error", reason: "UNAUTHENTICATED" };
      if (!uuidSchema.safeParse(input.releaseId).success || !uuidSchema.safeParse(input.objectId).success || !uuidSchema.safeParse(input.versionId).success
          || !["LIBRARY", "CATEGORY", "SUBCATEGORY", "SERVICE", "SERVICE_SUBCATEGORY_LINK"].includes(input.objectType)
          || !/^[0-9a-f]{64}$/u.test(input.contentHash) || !Number.isSafeInteger(input.sortOrder) || input.sortOrder < 1
          || !Number.isSafeInteger(input.expectedRowVersion) || input.expectedRowVersion < 1
          || !uuidSchema.safeParse(input.idempotencyKey).success || !uuidSchema.safeParse(input.correlationId).success) return { status: "error", reason: "INVALID_INPUT" };
      const response = await dependencies.rpc("add_catalog_release_item", {
        p_release_id: input.releaseId, p_object_type: input.objectType, p_object_id: input.objectId, p_version_id: input.versionId,
        p_content_hash: input.contentHash, p_sort_order: input.sortOrder, p_expected_release_row_version: input.expectedRowVersion,
        p_idempotency_key: input.idempotencyKey, p_correlation_id: input.correlationId,
      });
      if (response.error) return failure(response.error);
      const parsed = addedItem.safeParse(response.data);
      return parsed.success && parsed.data.release_id === input.releaseId
        ? { status: "success", value: { rowVersion: parsed.data.release_row_version } }
        : { status: "error", reason: "INVALID_RESPONSE" };
    },
    async submitRelease(input) {
      if (!await dependencies.authenticated()) return { status: "error", reason: "UNAUTHENTICATED" };
      if (!uuidSchema.safeParse(input.releaseId).success || !Number.isSafeInteger(input.expectedRowVersion) || input.expectedRowVersion < 1
          || !uuidSchema.safeParse(input.idempotencyKey).success || !uuidSchema.safeParse(input.correlationId).success) return { status: "error", reason: "INVALID_INPUT" };
      const response = await dependencies.rpc("submit_catalog_release", {
        p_release_id: input.releaseId, p_expected_row_version: input.expectedRowVersion,
        p_idempotency_key: input.idempotencyKey, p_correlation_id: input.correlationId,
      });
      if (response.error) return failure(response.error);
      const parsed = submittedRelease.safeParse(response.data);
      return parsed.success && parsed.data.release_id === input.releaseId
        ? { status: "success", value: { releaseId: parsed.data.release_id, status: parsed.data.status, snapshotHash: parsed.data.snapshot_hash } }
        : { status: "error", reason: "INVALID_RESPONSE" };
    },
    async resolveApprovedServiceItem(releaseId, versionId) {
      if (!await dependencies.authenticated()) return { status: "error", reason: "UNAUTHENTICATED" };
      if (!uuidSchema.safeParse(releaseId).success || !uuidSchema.safeParse(versionId).success) return { status: "error", reason: "INVALID_INPUT" };
      const [releaseResponse, versionResponse, orderResponse] = await Promise.all([dependencies.release(releaseId), dependencies.serviceVersion(versionId), dependencies.lastReleaseItem(releaseId)]);
      if (releaseResponse.error || versionResponse.error || orderResponse.error) return failure(releaseResponse.error ?? versionResponse.error ?? orderResponse.error);
      const release = z.array(releaseContextRow).max(1).safeParse(releaseResponse.data), version = z.array(serviceVersionContextRow).max(1).safeParse(versionResponse.data), order = z.array(releaseOrderRow).max(1).safeParse(orderResponse.data);
      if (!release.success || !version.success || !order.success || release.data.length !== 1 || version.data.length !== 1 || release.data[0]!.library_id !== version.data[0]!.library_id) return { status: "error", reason: "INVALID_INPUT" };
      return { status: "success", value: { releaseId, objectType: "SERVICE", objectId: version.data[0]!.service_id, versionId, contentHash: version.data[0]!.content_hash, sortOrder: (order.data[0]?.sort_order ?? 0) + 1, expectedRowVersion: release.data[0]!.row_version } };
    },
    async resolveDraftRelease(releaseId) {
      if (!await dependencies.authenticated()) return { status: "error", reason: "UNAUTHENTICATED" };
      if (!uuidSchema.safeParse(releaseId).success) return { status: "error", reason: "INVALID_INPUT" };
      const response = await dependencies.release(releaseId); if (response.error) return failure(response.error);
      const parsed = z.array(releaseContextRow).max(1).safeParse(response.data);
      return parsed.success && parsed.data.length === 1 ? { status: "success", value: { releaseId, rowVersion: parsed.data[0]!.row_version } } : { status: "error", reason: "INVALID_INPUT" };
    },
  };
}
