import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  load: vi.fn(),
}));

vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/modules/franchise/data/library/workspace", () => ({
  loadFranchiseLibraryWorkspace: mocks.load,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createFranchiseServiceAction,
  saveFranchiseServiceDraftAction,
  simulateFranchiseQuestionnaireAction,
  simulateFranchiseServiceImpactAction,
  submitFranchiseCatalogPublicationAction,
  submitFranchiseCatalogQuestionnaireAction,
  submitFranchiseCatalogRuleAction,
  submitFranchiseCatalogServiceAction,
  publishFranchiseQuestionnaireAction,
  duplicateFranchiseCatalogServiceAction,
  archiveFranchiseCatalogServiceAction,
  cloneFranchiseCatalogQuestionnaireAction,
  createFranchiseCategoryAction,
  createFranchiseSubcategoryAction,
  submitFranchiseHierarchyAction,
  type FranchiseServiceActionState,
} from "./actions";

const idle: FranchiseServiceActionState = { status: "idle" };
const libraryId = "22222222-2222-4222-8222-222222222222";
const serviceId = "33333333-3333-4333-8333-333333333333";
const versionId = "44444444-4444-4444-8444-444444444444";
const subcategoryId = "55555555-5555-4555-8555-555555555555";
const key = "11111111-1111-4111-8111-111111111111";

const workspace = {
  status: "success" as const,
  workspace: {
    mandate: { libraryId, libraryCode: "IT", libraryName: "Informatique", franchiseId: key, operatorCode: "IT", type: "IT" as const, libraryStatus: "DRAFT", libraryRowVersion: 1, currentReleaseId: null },
    counts: { drafts: 1, inReview: 0, published: 0, returns: 0 },
    categories: [{ id: "66666666-6666-4666-8666-666666666666", title: "Infra", children: [{ id: subcategoryId, title: "Backup" }] }],
    services: [{
      id: serviceId,
      kind: "SERVICE" as const,
      title: "Backup",
      code: "IT_BACKUP",
      status: "DRAFT",
      versionLabel: "v1",
      href: "/fr/franchise/services/" + serviceId,
      category: "Infra",
      subcategory: "Backup",
      subcategoryId,
      description: "desc",
      nameFr: "Backup",
      nameAr: "نسخ",
      command: {
        draftVersionId: versionId,
        identityRowVersion: 1,
        versionRowVersion: 1,
        slug: "it-backup",
        descriptionFr: "desc",
        descriptionAr: "وصف",
        longDescriptionFr: "desc",
        longDescriptionAr: "وصف",
        serviceType: "ADVISORY",
        unitLabelFr: "unité",
        unitLabelAr: "وحدة",
        creditEligible: false,
        volumeEligible: false,
        recurringEligible: false,
        trialEligible: false,
        rfqRequired: true,
        fixedFulfillmentAllowed: false,
        baseCurrency: "MAD",
        sortOrder: 1,
        fulfillmentConfig: { schema_version: 1 },
        visibilityRules: { schema_version: 1 },
        sensitive: false,
      },
    }],
    questionnaires: [{
      id: "66666666-6666-4666-8666-666666666666",
      kind: "QUESTIONNAIRE" as const,
      title: "Diag",
      code: "IT_DIAG",
      status: "DRAFT",
      versionLabel: "v1",
      href: "/fr/franchise/questionnaires/q",
      category: null,
      subcategory: null,
      subcategoryId: null,
      description: null,
      nameFr: "Diag",
      nameAr: "تشخيص",
      questionnaireVersionId: "77777777-7777-4777-8777-777777777777",
      draftVersionId: "77777777-7777-4777-8777-777777777777",
      identityRowVersion: 1,
      versionRowVersion: 1,
    }],
    rules: [{
      id: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      kind: "RULE" as const,
      title: "BACKUP_TESTED",
      code: "BACKUP_TESTED",
      status: "DRAFT",
      versionLabel: "v1",
      href: "/fr/franchise/regles/r",
      category: null,
      subcategory: null,
      subcategoryId: null,
      description: null,
      nameFr: null,
      nameAr: null,
      draftVersionId: "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      identityRowVersion: 1,
      versionRowVersion: 1,
    }],
    questions: [{
      id: "88888888-8888-4888-8888-888888888888",
      key: "HAS_BACKUP",
      status: "DRAFT",
      label: "Backup?",
      help: "",
      versionId: "99999999-9999-4999-8999-999999999999",
      answerType: "YES_NO",
      required: true,
      questionnaireId: "66666666-6666-4666-8666-666666666666",
    }],
    compositionQuestions:[{versionId:"77777777-7777-4777-8777-777777777777",questionVersionId:"99999999-9999-4999-8999-999999999999",sectionKey:"GENERAL",required:true,sortOrder:1}],
    questionVersionBank:[{id:"99999999-9999-4999-8999-999999999999",questionId:"88888888-8888-4888-8888-888888888888",labelFr:"Backup?",labelAr:"نسخ؟",answerType:"YES_NO",status:"PUBLISHED"}],
    releases: [],
  },
};

function form(entries: Record<string, string>) {
  const value = new FormData();
  Object.entries(entries).forEach(([name, content]) => value.set(name, content));
  return value;
}

beforeEach(() => {
  mocks.rpc.mockReset().mockResolvedValue({ data: { outcome: "OK", service_id: serviceId, library_id: libraryId, blocking_dependencies: [], can_archive_immediately: true, triggered_actions: [], score_basis_points: 0, engine_version:"RULE_ENGINE_V1" }, error: null });
  mocks.load.mockReset().mockResolvedValue(workspace);
});

describe("franchise library catalog actions", () => {
  it("crée un brouillon FR/AR dans la bibliothèque mandatée", async () => {
    const result = await createFranchiseServiceAction(idle, form({
      locale: "fr", libraryId, subcategoryId, code: "IT_NEW", nameFr: "Nouveau", nameAr: "جديد",
      descriptionFr: "Description", descriptionAr: "وصف الخدمة", changeReason: "Création contrôlée",
      confirmed: "yes", idempotencyKey: key, correlationId: key,
    }));
    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("create_catalog_service", expect.objectContaining({ p_library_id: libraryId, p_code: "IT_NEW" }));
  });

  it("laisse le RPC rejouer une sauvegarde dont la réponse réseau a été perdue",async()=>{
    const latest=structuredClone(workspace);latest.workspace.services[0]!.command!.draftVersionId="44444444-4444-4444-8444-444444444445";
    mocks.load.mockResolvedValueOnce(latest);mocks.rpc.mockResolvedValueOnce({data:{version_id:latest.workspace.services[0]!.command!.draftVersionId,identity_row_version:2,version_row_version:1},error:null});
    const result=await saveFranchiseServiceDraftAction(idle,form({locale:"fr",libraryId,serviceId,subcategoryId,code:"IT_BACKUP",nameFr:"Backup",nameAr:"نسخ احتياطي",descriptionFr:"Description",descriptionAr:"وصف الخدمة",changeReason:"Mise à jour bilingue",draftVersionId:versionId,identityRowVersion:"1",versionRowVersion:"1",idempotencyKey:key,correlationId:key}));
    expect(result.status).toBe("success");expect(mocks.rpc).toHaveBeenCalledWith("save_catalog_service_draft",expect.objectContaining({p_version_id:versionId,p_idempotency_key:key}));
  });

  it("enregistre le brouillon via save_catalog_service_draft", async () => {
    mocks.rpc.mockResolvedValueOnce({data:{version_id:versionId,identity_row_version:2,version_row_version:2},error:null});
    const result = await saveFranchiseServiceDraftAction(idle, form({
      locale: "fr", libraryId, serviceId, subcategoryId, code: "IT_BACKUP", nameFr: "Backup", nameAr: "نسخ احتياطي",
      descriptionFr: "Description", descriptionAr: "وصف الخدمة", changeReason: "Mise à jour bilingue",
      draftVersionId: versionId, identityRowVersion: "1", versionRowVersion: "1",
      idempotencyKey: key, correlationId: key,
    }));
    expect(result).toEqual({ status: "success", serviceId, outcome: "SAVED",command:{draftVersionId:versionId,identityRowVersion:2,versionRowVersion:2} });
    expect(mocks.rpc).toHaveBeenCalledWith("save_catalog_service_draft", expect.objectContaining({
      p_service_id: serviceId,
      p_version_id: versionId,
      p_expected_identity_row_version: 1,
      p_name_ar: "نسخ احتياطي",
    }));
  });

  it("simule l’impact sans payload d’attaque", async () => {
    const result = await simulateFranchiseServiceImpactAction(idle, form({
      locale: "fr", libraryId, serviceId, idempotencyKey: key, correlationId: key,
    }));
    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("simulate_catalog_service_impact", expect.objectContaining({ p_service_id: serviceId, p_max_items: 25 }));
  });

  it("soumet le service DRAFT à Matricia", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "CATALOG_CHANGE_SUBMITTED" }, error: null });
    const result = await submitFranchiseCatalogServiceAction(idle, form({
      locale: "fr", libraryId, serviceId, draftVersionId: versionId, identityRowVersion: "1", versionRowVersion: "1",
      confirmed: "yes", idempotencyKey: key, correlationId: key,
    }));
    expect(result).toEqual({ status: "success", serviceId, outcome: "SUBMITTED" });
    expect(mocks.rpc).toHaveBeenCalledWith("submit_franchise_catalog_service", expect.objectContaining({
      p_service_id: serviceId,
      p_version_id: versionId,
    }));
  });

  it("refuse une soumission hors mandat", async () => {
    mocks.load.mockResolvedValueOnce({ status: "error", reason: "FORBIDDEN" });
    const result = await submitFranchiseCatalogServiceAction(idle, form({
      locale: "fr", libraryId, serviceId, draftVersionId: versionId, identityRowVersion: "1", versionRowVersion: "1",
      confirmed: "yes", idempotencyKey: key, correlationId: key,
    }));
    expect(result).toEqual({ status: "error", reason: "FORBIDDEN" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("simule le questionnaire publié dans le bac à sable", async () => {
    const result = await simulateFranchiseQuestionnaireAction({ status: "idle" }, form({
      locale: "fr",
      libraryId,
      questionnaireId: "66666666-6666-4666-8666-666666666666",
      questionnaireVersionId: "77777777-7777-4777-8777-777777777777",
      questionVersionId: "99999999-9999-4999-8999-999999999999",
      answer: "true",
    }));
    expect(result.status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("simulate_questionnaire_rule_engine", expect.objectContaining({
      p_questionnaire_version_id: "77777777-7777-4777-8777-777777777777",
      p_answers: { "99999999-9999-4999-8999-999999999999": true },
    }));
  });

  it("soumet le questionnaire DRAFT à Matricia", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "CATALOG_CHANGE_SUBMITTED" }, error: null });
    const result = await submitFranchiseCatalogQuestionnaireAction(idle, form({
      locale: "fr",
      libraryId,
      questionnaireId: "66666666-6666-4666-8666-666666666666",
      draftVersionId: "77777777-7777-4777-8777-777777777777",
      identityRowVersion: "1",
      versionRowVersion: "1",
      confirmed: "yes",
      idempotencyKey: key,
      correlationId: key,
    }));
    expect(result).toEqual({ status: "success", serviceId: "66666666-6666-4666-8666-666666666666", outcome: "SUBMITTED" });
    expect(mocks.rpc).toHaveBeenCalledWith("submit_franchise_catalog_questionnaire", expect.objectContaining({
      p_questionnaire_id: "66666666-6666-4666-8666-666666666666",
      p_version_id: "77777777-7777-4777-8777-777777777777",
    }));
  });

  it("soumet la règle DRAFT à Matricia", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "CATALOG_CHANGE_SUBMITTED" }, error: null });
    const result = await submitFranchiseCatalogRuleAction(idle, form({
      locale: "fr",
      libraryId,
      ruleId: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      draftVersionId: "bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      identityRowVersion: "1",
      versionRowVersion: "1",
      confirmed: "yes",
      idempotencyKey: key,
      correlationId: key,
    }));
    expect(result).toEqual({ status: "success", serviceId: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1", outcome: "SUBMITTED" });
    expect(mocks.rpc).toHaveBeenCalledWith("submit_franchise_catalog_rule", expect.objectContaining({
      p_rule_id: "aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    }));
  });

  it("refuse de publier sans service APPROVED", async () => {
    const result = await submitFranchiseCatalogPublicationAction(idle, form({
      locale: "fr", libraryId, libraryRowVersion: "1", confirmed: "yes", idempotencyKey: key, correlationId: key,
    }));
    expect(result).toEqual({ status: "error", reason: "LOCKED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("planifie la publication immuable des services APPROVED", async () => {
    mocks.load.mockResolvedValueOnce({
      ...workspace,
      workspace: {
        ...workspace.workspace,
        services: [{ ...workspace.workspace.services[0]!, status: "APPROVED" }],
      },
    });
    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "CATALOG_RELEASE_SCHEDULED", release_id: key, status: "SCHEDULED" }, error: null });
    const result = await submitFranchiseCatalogPublicationAction(idle, form({
      locale: "fr", libraryId, libraryRowVersion: "1", confirmed: "yes", idempotencyKey: key, correlationId: key,
    }));
    expect(result).toEqual({ status: "success", serviceId: key, outcome: "SCHEDULED" });
    expect(mocks.rpc).toHaveBeenCalledWith("submit_franchise_catalog_publication", expect.objectContaining({
      p_library_id: libraryId,
      p_expected_library_row_version: 1,
    }));
  });

  it("publie un questionnaire APPROVED", async () => {
    mocks.load.mockResolvedValueOnce({
      ...workspace,
      workspace: {
        ...workspace.workspace,
        questionnaires: [{ ...workspace.workspace.questionnaires[0]!, status: "APPROVED" }],
      },
    });
    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "QUESTIONNAIRE_VERSION_PUBLISHED" }, error: null });
    const result = await publishFranchiseQuestionnaireAction(idle, form({
      locale: "fr",
      libraryId,
      questionnaireId: "66666666-6666-4666-8666-666666666666",
      draftVersionId: "77777777-7777-4777-8777-777777777777",
      versionRowVersion: "1",
      confirmed: "yes",
      idempotencyKey: key,
      correlationId: key,
    }));
    expect(result).toEqual({ status: "success", serviceId: "66666666-6666-4666-8666-666666666666", outcome: "PUBLISHED" });
    expect(mocks.rpc).toHaveBeenCalledWith("publish_questionnaire_version", expect.objectContaining({
      p_questionnaire_version_id: "77777777-7777-4777-8777-777777777777",
      p_expected_row_version: 1,
    }));
  });

  it("duplique un service de la bibliothèque mandatée", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "CATALOG_SERVICE_DUPLICATED", service_id: key }, error: null });
    const result = await duplicateFranchiseCatalogServiceAction(idle, form({
      locale: "fr",
      libraryId,
      serviceId,
      draftVersionId: versionId,
      subcategoryId,
      code: "IT_BACKUP_COPY",
      slug: "it-backup-copy",
      nameFr: "Backup",
      nameAr: "نسخ احتياطي",
      changeReason: "Duplication du service",
      confirmed: "yes",
      idempotencyKey: key,
      correlationId: key,
    }));
    expect(result).toEqual({ status: "success", serviceId: key, outcome: "DUPLICATED" });
    expect(mocks.rpc).toHaveBeenCalledWith("duplicate_catalog_service", expect.objectContaining({
      p_source_service_id: serviceId,
      p_code: "IT_BACKUP_COPY",
    }));
  });

  it("archive un service hors revue", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "CATALOG_SERVICE_ARCHIVED" }, error: null });
    const result = await archiveFranchiseCatalogServiceAction(idle, form({
      locale: "fr",
      libraryId,
      serviceId,
      draftVersionId: versionId,
      identityRowVersion: "1",
      versionRowVersion: "1",
      changeReason: "Archivage du service",
      confirmed: "yes",
      idempotencyKey: key,
      correlationId: key,
    }));
    expect(result).toEqual({ status: "success", serviceId, outcome: "ARCHIVED" });
    expect(mocks.rpc).toHaveBeenCalledWith("archive_catalog_service", expect.objectContaining({
      p_service_id: serviceId,
    }));
  });

  it("clone un questionnaire vers un snapshot DRAFT", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "CATALOG_QUESTIONNAIRE_CLONED", questionnaire_id: key }, error: null });
    const result = await cloneFranchiseCatalogQuestionnaireAction(idle, form({
      locale: "fr",
      libraryId,
      questionnaireId: "66666666-6666-4666-8666-666666666666",
      draftVersionId: "77777777-7777-4777-8777-777777777777",
      targetReleaseId: key,
      code: "IT_DIAG_COPY",
      changeReason: "Clonage du questionnaire",
      confirmed: "yes",
      idempotencyKey: key,
      correlationId: key,
    }));
    expect(result).toEqual({ status: "success", serviceId: key, outcome: "CLONED" });
    expect(mocks.rpc).toHaveBeenCalledWith("clone_catalog_questionnaire", expect.objectContaining({
      p_source_version_id: "77777777-7777-4777-8777-777777777777",
      p_target_release_id: key,
    }));
  });

  it("crée une catégorie dans la bibliothèque mandatée", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "CATALOG_CATEGORY_CREATED", category_id: key, library_id: libraryId }, error: null });
    const result = await createFranchiseCategoryAction(idle, form({
      locale: "fr", libraryId, code: "IT_CAT", nameFr: "Infrastructure", nameAr: "بنية",
      descriptionFr: "Catégorie infrastructure", descriptionAr: "فئة البنية", changeReason: "Arborescence initiale",
      confirmed: "yes", idempotencyKey: key, correlationId: key,
    }));
    expect(result).toEqual({ status: "success", serviceId: key, outcome: "CATEGORY_CREATED" });
    expect(mocks.rpc).toHaveBeenCalledWith("create_catalog_category", expect.objectContaining({
      p_library_id: libraryId,
      p_code: "IT_CAT",
      p_name_ar: "بنية",
    }));
  });

  it("crée une sous-catégorie rattachée à la catégorie mandatée", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "CATALOG_SUBCATEGORY_CREATED", subcategory_id: subcategoryId, library_id: libraryId }, error: null });
    const result = await createFranchiseSubcategoryAction(idle, form({
      locale: "fr", libraryId, categoryId: "66666666-6666-4666-8666-666666666666",
      code: "IT_SUB", nameFr: "Sauvegarde", nameAr: "نسخ",
      descriptionFr: "Sous-catégorie sauvegarde", descriptionAr: "فئة فرعية للنسخ", changeReason: "Rattachement service",
      confirmed: "yes", idempotencyKey: key, correlationId: key,
    }));
    expect(result).toEqual({ status: "success", serviceId: subcategoryId, outcome: "SUBCATEGORY_CREATED" });
    expect(mocks.rpc).toHaveBeenCalledWith("create_catalog_subcategory", expect.objectContaining({
      p_category_id: "66666666-6666-4666-8666-666666666666",
      p_code: "IT_SUB",
    }));
  });

  it("soumet une catégorie DRAFT à Matricia", async () => {
    mocks.load.mockResolvedValueOnce({
      ...workspace,
      workspace: {
        ...workspace.workspace,
        categories: [{
          id: "66666666-6666-4666-8666-666666666666",
          title: "Infra",
          status: "DRAFT",
          draftVersionId: versionId,
          identityRowVersion: 1,
          versionRowVersion: 1,
          children: [{ id: subcategoryId, title: "Backup" }],
        }],
      },
    });
    mocks.rpc.mockResolvedValueOnce({ data: { outcome: "CATALOG_CHANGE_SUBMITTED" }, error: null });
    const result = await submitFranchiseHierarchyAction(idle, form({
      locale: "fr", libraryId, objectType: "CATEGORY", objectId: "66666666-6666-4666-8666-666666666666",
      draftVersionId: versionId, identityRowVersion: "1", versionRowVersion: "1",
      confirmed: "yes", idempotencyKey: key, correlationId: key,
    }));
    expect(result).toEqual({ status: "success", serviceId: "66666666-6666-4666-8666-666666666666", outcome: "SUBMITTED" });
    expect(mocks.rpc).toHaveBeenCalledWith("submit_catalog_change", expect.objectContaining({
      p_object_type: "CATEGORY",
      p_object_id: "66666666-6666-4666-8666-666666666666",
    }));
  });
});
