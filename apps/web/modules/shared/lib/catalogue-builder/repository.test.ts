import { describe, expect, it, vi } from "vitest";
import { createCatalogBuilderRepository, type BuilderRepositoryDependencies } from "./repository";

const library = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "IT",
  status: "PUBLISHED",
  row_version: 4,
  current_release_id: null,
  published: { name_fr: "Informatique", name_ar: "المعلوميات" },
  draft: null,
};
const commandIdentity = { idempotencyKey: "33333333-3333-4333-8333-333333333333", correlationId: "44444444-4444-4444-8444-444444444444" };
function dependencies(overrides: Partial<BuilderRepositoryDependencies> = {}): BuilderRepositoryDependencies {
  return {
    authenticated: async () => true,
    libraries: async () => ({ data: [library], error: null }),
    library: async (libraryId) => ({ data: libraryId === library.id ? [library] : [], error: null }),
    services: async () => ({ data: [{ id: "22222222-2222-4222-8222-222222222222", library_id: library.id, code: "IT_AUDIT", slug: "it-audit", status: "PUBLISHED", published: { name_fr: "Audit SI", name_ar: "تدقيق نظم المعلومات" }, draft: null }], error: null }),
    draftReleases: async () => ({ data: [], error: null }),
    approvedServiceVersions: async () => ({ data: [], error: null }),
    release: async () => ({ data: [], error: null }),
    serviceVersion: async () => ({ data: [], error: null }),
    lastReleaseItem: async () => ({ data: [], error: null }),
    rpc: vi.fn(async () => ({ data: null, error: { code: "42501" } })),
    ...overrides,
  };
}

describe("catalogue builder repository", () => {
  it("loads at most the selected service subset", async () => {
    const deps = dependencies(); const result = await createCatalogBuilderRepository(deps).loadWorkspace(library.id);
    expect(result.status).toBe("success");
    if (result.status === "success") expect(result.value.services).toHaveLength(1);
  });
  it("hides scratch and fixture libraries from the operator picker", async () => {
    const scratch = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      code: "TMP_SAVE",
      status: "DRAFT",
      row_version: 1,
      current_release_id: null,
      published: null,
      draft: { name_fr: "Bibliothèque sauvée", name_ar: "مكتبة محفوظة" },
    };
    const shortJunk = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      code: "CC",
      status: "DRAFT",
      row_version: 1,
      current_release_id: null,
      published: null,
      draft: { name_fr: "Cc", name_ar: "Cc" },
    };
    const fixture = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      code: "A_P08_10B6E982",
      status: "PUBLISHED",
      row_version: 1,
      current_release_id: null,
      published: { name_fr: "Fixture IT", name_ar: "اختبار" },
      draft: null,
    };
    const domain = {
      ...library,
      published: { name_fr: "Informatique, cybersécurité et data", name_ar: "المعلوميات والأمن السيبراني" },
    };
    const result = await createCatalogBuilderRepository(dependencies({
      libraries: async () => ({ data: [scratch, shortJunk, fixture, domain], error: null }),
    })).loadWorkspace(null);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.value.libraries.map((item) => item.id)).toEqual([domain.id]);
      expect(result.value.libraries[0]?.nameFr).toBe("Informatique, cybersécurité et data");
    }
  });
  it("fails closed on malformed status and excess library/service cardinality", async () => {
    const malformed = await createCatalogBuilderRepository(dependencies({ libraries: async () => ({ data: [{ ...library, status: "UNKNOWN" }], error: null }) })).loadWorkspace(null);
    expect(malformed).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
    const tooManyLibraries = await createCatalogBuilderRepository(dependencies({ libraries: async () => ({ data: Array.from({ length: 81 }, () => library), error: null }) })).loadWorkspace(null);
    expect(tooManyLibraries).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
    const service = { id: "22222222-2222-4222-8222-222222222222", library_id: library.id, code: "IT_AUDIT", slug: "it-audit", status: "PUBLISHED", published: { name_fr: "Audit SI", name_ar: "تدقيق نظم المعلومات" }, draft: null };
    const tooManyServices = await createCatalogBuilderRepository(dependencies({ services: async () => ({ data: Array.from({ length: 201 }, () => service), error: null }) })).loadWorkspace(library.id);
    expect(tooManyServices).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
  });
  it("does not invent a questionnaire persistence mutation", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const repo = createCatalogBuilderRepository(dependencies({ rpc }));
    const result = await repo.persistQuestionnaireDraft({} as never);
    expect(result).toEqual({ status: "error", reason: "INVALID_INPUT" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reports the missing write contract without emulating questionnaire persistence", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const repo = createCatalogBuilderRepository(dependencies({ rpc }));
    const result = await repo.persistQuestionnaireDraft({
      libraryId: library.id, serviceId: "22222222-2222-4222-8222-222222222222", code: "SECURITY_BASE", version: 1,
      title: { fr: "Sécurité", ar: "الأمن" }, description: { fr: "Questionnaire sécurité", ar: "استبيان الأمن" },
      questions: [{ key: "MFA", label: { fr: "MFA active ?", ar: "هل التحقق مفعل؟" }, answerType: "YES_NO", required: true, options: [] }],
      rules: [],
    });
    expect(result).toEqual({ status: "error", reason: "MISSING_QUESTIONNAIRE_WRITE_RPC" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not call a release command without an authenticated session", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const repo = createCatalogBuilderRepository(dependencies({ authenticated: async () => false, rpc }));
    const result = await repo.submitRelease({ releaseId: "22222222-2222-4222-8222-222222222222", expectedRowVersion: 1, ...commandIdentity });
    expect(result).toEqual({ status: "error", reason: "UNAUTHENTICATED" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("maps catalogue command authorization failures", async () => {
    const result = await createCatalogBuilderRepository(dependencies()).createRelease({ libraryId: library.id, releaseKey: "IT.V2", sourceBundleHash: "a".repeat(64), requiresCentralApproval: false, expectedLibraryRowVersion: 4, ...commandIdentity });
    expect(result).toEqual({ status: "error", reason: "FORBIDDEN" });
  });
  it("creates a versioned service question through the exact RPC contract", async () => {
    const questionId = "55555555-5555-4555-8555-555555555555";
    const versionId = "66666666-6666-4666-8666-666666666666";
    const rpc = vi.fn(async () => ({
      data: {
        outcome: "CATALOG_QUESTION_CREATED", question_id: questionId, library_id: library.id, version_id: versionId,
        identity_row_version: 1, version_row_version: 1, content_hash: "b".repeat(64), command_id: "77777777-7777-4777-8777-777777777777",
      },
      error: null,
    }));
    const result = await createCatalogBuilderRepository(dependencies({ rpc })).createQuestion({
      libraryId: library.id, serviceId: "22222222-2222-4222-8222-222222222222", questionKey: "IT_SECURITY_MFA",
      labelFr: "Le MFA est-il activé ?", labelAr: "هل المصادقة متعددة العوامل مفعلة؟", helpFr: "", helpAr: "",
      answerType: "YES_NO", dataKey: "security.mfa.enabled", requiredByDefault: true, requiredForQuote: true,
      sensitivity: "BUSINESS", changeReason: "Création du contrôle MFA", ...commandIdentity,
    });
    expect(result).toEqual({ status: "success", value: {
      questionId, versionId, identityRowVersion: 1, versionRowVersion: 1, contentHash: "b".repeat(64),
    } });
    expect(rpc).toHaveBeenCalledWith("create_catalog_question", {
      p_library_id: library.id, p_question_key: "IT_SECURITY_MFA", p_scope: "SERVICE",
      p_payload: {
        label_fr: "Le MFA est-il activé ?", label_ar: "هل المصادقة متعددة العوامل مفعلة؟",
        answer_type: "YES_NO", data_key: "security.mfa.enabled", required_by_default: true, required_for_quote: true,
        required_for_publication: false, options: [], validation_schema: {}, sensitivity: "BUSINESS", nullable: false,
        weight: 0, maximum_score: 0, source_service_id: "22222222-2222-4222-8222-222222222222",
      },
      p_change_reason: "Création du contrôle MFA", p_idempotency_key: commandIdentity.idempotencyKey,
      p_correlation_id: commandIdentity.correlationId,
    });
  });
  it("fails closed on a malformed question response", async () => {
    const rpc = vi.fn(async () => ({ data: { outcome: "CATALOG_QUESTION_CREATED", injected: true }, error: null }));
    const result = await createCatalogBuilderRepository(dependencies({ rpc })).createQuestion({
      libraryId: library.id, serviceId: "22222222-2222-4222-8222-222222222222", questionKey: "IT_SECURITY_MFA",
      labelFr: "Le MFA est-il activé ?", labelAr: "هل المصادقة متعددة العوامل مفعلة؟", helpFr: "", helpAr: "",
      answerType: "YES_NO", dataKey: "security.mfa.enabled", requiredByDefault: true, requiredForQuote: true,
      sensitivity: "BUSINESS", changeReason: "Création du contrôle MFA", ...commandIdentity,
    });
    expect(result).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
  });
  it("creates a deterministic boolean rule through the exact RPC contract", async () => {
    const ruleId = "88888888-8888-4888-8888-888888888888";
    const versionId = "99999999-9999-4999-8999-999999999999";
    const rpc = vi.fn(async () => ({ data: { outcome: "CATALOG_RULE_CREATED", rule_id: ruleId, library_id: library.id, version_id: versionId, identity_row_version: 1, version_row_version: 1, compiled_hash: "e".repeat(64), command_id: "77777777-7777-4777-8777-777777777777" }, error: null }));
    const result = await createCatalogBuilderRepository(dependencies({ rpc })).createRule({ libraryId: library.id, ruleKey: "MFA_REQUIRED", questionKey: "HAS_MFA", expectedBoolean: false, actionType: "CREATE_RISK", actionTarget: "MFA_MISSING", priority: 20, sensitive: true, changeReason: "Création de la règle MFA", ...commandIdentity });
    expect(result).toEqual({ status: "success", value: { ruleId, versionId, identityRowVersion: 1, versionRowVersion: 1, compiledHash: "e".repeat(64) } });
    expect(rpc).toHaveBeenCalledWith("create_catalog_rule", { p_library_id: library.id, p_rule_key: "MFA_REQUIRED", p_payload: { condition_ast: { kind: "PREDICATE", operator: "EQ", questionKey: "HAS_MFA", operand: false }, actions: [{ type: "CREATE_RISK", target: "MFA_MISSING" }], dependency_graph: { HAS_MFA: ["MFA_REQUIRED"] }, priority: 20, sensitive: true }, p_change_reason: "Création de la règle MFA", p_idempotency_key: commandIdentity.idempotencyKey, p_correlation_id: commandIdentity.correlationId });
  });
  it("creates a bilingual questionnaire and first section through the exact RPC", async () => {
    const questionnaireId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", versionId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", sectionId="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const rpc=vi.fn(async()=>({data:{outcome:"CATALOG_QUESTIONNAIRE_CREATED",questionnaire_id:questionnaireId,library_id:library.id,version_id:versionId,section_id:sectionId,identity_row_version:1,version_row_version:1,snapshot_hash:"f".repeat(64),command_id:"77777777-7777-4777-8777-777777777777"},error:null}));
    const result=await createCatalogBuilderRepository(dependencies({rpc})).createQuestionnaire({libraryId:library.id,catalogReleaseId:"55555555-5555-4555-8555-555555555555",code:"SECURITY",titleFr:"Diagnostic sécurité",titleAr:"تشخيص الأمان",descriptionFr:"Questionnaire initial de sécurité",descriptionAr:"استبيان الأمان الأولي",audience:"CLIENT",engineVersion:"1.0.0",policyVersion:"P06-1",sensitive:false,sectionKey:"GENERAL",sectionLabelFr:"Général",sectionLabelAr:"عام",sectionHelpFr:"",sectionHelpAr:"",changeReason:"Création questionnaire",...commandIdentity});
    expect(result).toEqual({status:"success",value:{questionnaireId,versionId,sectionId,identityRowVersion:1,versionRowVersion:1,snapshotHash:"f".repeat(64)}});
    expect(rpc).toHaveBeenCalledWith("create_catalog_questionnaire",expect.objectContaining({p_library_id:library.id,p_code:"SECURITY",p_idempotency_key:commandIdentity.idempotencyKey}));
  });
  it("forwards stable command identities and parses the release response", async () => {
    const rpc = vi.fn(async () => ({
      data: { outcome: "CATALOG_RELEASE_CREATED", release_id: "55555555-5555-4555-8555-555555555555", status: "DRAFT", library_row_version: 5 },
      error: null,
    }));
    const result = await createCatalogBuilderRepository(dependencies({ rpc })).createRelease({
      libraryId: library.id, releaseKey: "IT.V2", sourceBundleHash: "a".repeat(64), requiresCentralApproval: false,
      expectedLibraryRowVersion: 4, ...commandIdentity,
    });
    expect(result).toEqual({ status: "success", value: { id: "55555555-5555-4555-8555-555555555555", rowVersion: 1 } });
    expect(rpc).toHaveBeenCalledWith("create_catalog_release", expect.objectContaining({
      p_idempotency_key: commandIdentity.idempotencyKey,
      p_correlation_id: commandIdentity.correlationId,
    }));
  });
  it("fails closed on an augmented command response DTO", async () => {
    const rpc = vi.fn(async () => ({
      data: { outcome: "CATALOG_RELEASE_CREATED", release_id: "55555555-5555-4555-8555-555555555555", status: "DRAFT", library_row_version: 5, injected: true },
      error: null,
    }));
    const result = await createCatalogBuilderRepository(dependencies({ rpc })).createRelease({
      libraryId: library.id, releaseKey: "IT.V2", sourceBundleHash: "a".repeat(64), requiresCentralApproval: false,
      expectedLibraryRowVersion: 4, ...commandIdentity,
    });
    expect(result).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
  });
  it("adds and submits through exact response contracts", async () => {
    const releaseId = "55555555-5555-4555-8555-555555555555";
    const rpc = vi.fn(async (name: string) => name === "add_catalog_release_item"
      ? { data: { outcome: "CATALOG_RELEASE_ITEM_ADDED", release_id: releaseId, release_row_version: 2 }, error: null }
      : { data: { outcome: "CATALOG_RELEASE_SUBMITTED", release_id: releaseId, status: "APPROVED", snapshot_hash: "d".repeat(64) }, error: null });
    const repo = createCatalogBuilderRepository(dependencies({ rpc }));
    const added = await repo.addReleaseItem({ releaseId, objectType: "SERVICE", objectId: "22222222-2222-4222-8222-222222222222", versionId: "66666666-6666-4666-8666-666666666666", contentHash: "c".repeat(64), sortOrder: 1, expectedRowVersion: 1, ...commandIdentity });
    const submitted = await repo.submitRelease({ releaseId, expectedRowVersion: 2, ...commandIdentity });
    expect(added).toEqual({ status: "success", value: { rowVersion: 2 } });
    expect(submitted).toEqual({ status: "success", value: { releaseId, status: "APPROVED", snapshotHash: "d".repeat(64) } });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("derives release integrity, order and row version from authorized records", async () => {
    const releaseId = "55555555-5555-4555-8555-555555555555", versionId = "66666666-6666-4666-8666-666666666666", serviceId = "22222222-2222-4222-8222-222222222222";
    const repo = createCatalogBuilderRepository(dependencies({
      release: async () => ({ data: [{ id: releaseId, library_id: library.id, row_version: 7, status: "DRAFT" }], error: null }),
      serviceVersion: async () => ({ data: [{ id: versionId, service_id: serviceId, library_id: library.id, content_hash: "c".repeat(64), status: "APPROVED" }], error: null }),
      lastReleaseItem: async () => ({ data: [{ sort_order: 12 }], error: null }),
    }));
    await expect(repo.resolveApprovedServiceItem(releaseId, versionId)).resolves.toEqual({ status: "success", value: { releaseId, objectType: "SERVICE", objectId: serviceId, versionId, contentHash: "c".repeat(64), sortOrder: 13, expectedRowVersion: 7 } });
    await expect(repo.resolveDraftRelease(releaseId)).resolves.toEqual({ status: "success", value: { releaseId, rowVersion: 7 } });
  });
});
