import { createHash } from "node:crypto";
import { isDemoClientHomeEnabled } from "@/modules/client/data/home/demo-scenario";
import type { RuleValidationWorkspace } from "@/modules/shared/lib/rule-validation/model";

export function canApplyAdminDemoCatalogQuestions() {
  return isDemoClientHomeEnabled();
}

function demoId(seed: string): string {
  const hex = createHash("sha256").update(`DEMO_CATALOG_QUESTIONS_V1:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const DEMO_LIBRARY_ID = demoId("library:IT");
const DEMO_VERSION_ID = demoId("version:diagnostic-it");

const DEMO_QUESTIONS: RuleValidationWorkspace["questions"] = [
  {
    id: demoId("q:backup"),
    sortOrder: 1,
    labelFr: "Disposez-vous d’une sauvegarde externalisée ?",
    labelAr: "هل تتوفر لديكم نسخة احتياطية خارجية؟",
    answerType: "YES_NO",
    dataKey: "it.backup.exists",
    required: true,
  },
  {
    id: demoId("q:mfa"),
    sortOrder: 2,
    labelFr: "L’authentification multifacteur est-elle activée ?",
    labelAr: "هل التحقق بعوامل متعددة مفعّل؟",
    answerType: "YES_NO",
    dataKey: "it.security.mfa",
    required: true,
  },
  {
    id: demoId("q:sites"),
    sortOrder: 3,
    labelFr: "Combien de sites informatiques gérez-vous ?",
    labelAr: "كم عدد المواقع المعلوماتية التي تديرونها؟",
    answerType: "INTEGER",
    dataKey: "it.sites.count",
    required: true,
  },
  {
    id: demoId("q:budget"),
    sortOrder: 4,
    labelFr: "Quel est le budget annuel cybersécurité (MAD) ?",
    labelAr: "ما الميزانية السنوية للأمن السيبراني (درهم)؟",
    answerType: "MONEY",
    dataKey: "it.security.budget_mad",
    required: false,
  },
  {
    id: demoId("q:notes"),
    sortOrder: 5,
    labelFr: "Décrivez les incidents récents à surveiller.",
    labelAr: "صفوا الحوادث الأخيرة الواجب مراقبتها.",
    answerType: "LONG_TEXT",
    dataKey: "it.incidents.notes",
    required: false,
  },
];

export function buildDemoCatalogQuestionWorkspace(): RuleValidationWorkspace {
  const versionId = DEMO_VERSION_ID;
  return {
    versions: [
      {
        id: versionId,
        version: 1,
        status: "LOCAL_TEST",
        titleFr: "Diagnostic IT — démo Matricia (simulation de secours)",
        titleAr: "تشخيص تقنية المعلومات — عرض ماتريسيا (محاكاة احتياطية)",
        audience: "CLIENT",
        engineVersion: "engine-demo-v1",
        policyVersion: "policy-demo-v1",
        libraryId: DEMO_LIBRARY_ID,
        libraryCode: "IT",
      },
    ],
    selectedVersionId: versionId,
    questions: DEMO_QUESTIONS,
  };
}

export function isDemoCatalogQuestionWorkspace(workspace: RuleValidationWorkspace): boolean {
  return workspace.versions.some((version) => version.id === DEMO_VERSION_ID || version.libraryId === DEMO_LIBRARY_ID);
}

/**
 * Remplace un workspace totalement vide quand le flag démo est actif.
 * Ne mélange jamais des questions IT de secours dans une version native hors IT.
 */
export function applyDemoCatalogQuestionsWorkspace(
  workspace: RuleValidationWorkspace,
): { workspace: RuleValidationWorkspace; demoFallback: boolean } {
  if (!canApplyAdminDemoCatalogQuestions()) return { workspace, demoFallback: false };
  if (workspace.versions.length === 0) {
    return { workspace: buildDemoCatalogQuestionWorkspace(), demoFallback: true };
  }
  // Empty questions on a native version: keep the native shell visible; do not inject IT demo questions.
  return { workspace, demoFallback: false };
}

/**
 * Sur un environnement démo, un échec de chargement « service / données »
 * (pas un refus de droit) expose le workspace de validation de démonstration
 * au lieu d’un message bloquant sans contenu. Toujours identifiable.
 */
export function resolveDemoCatalogQuestionsWorkspace(input: {
  status: "success" | "error";
  reason?: string;
  value?: RuleValidationWorkspace;
}): { workspace: RuleValidationWorkspace; demoFallback: boolean } | null {
  if (input.status === "success" && input.value) {
    return applyDemoCatalogQuestionsWorkspace(input.value);
  }
  if (
    canApplyAdminDemoCatalogQuestions()
    && input.status === "error"
    && (input.reason === "UNAVAILABLE" || input.reason === "INVALID_RESPONSE")
  ) {
    return { workspace: buildDemoCatalogQuestionWorkspace(), demoFallback: true };
  }
  return null;
}

export function demoCatalogQuestionCounts() {
  return {
    versions: 1,
    questions: DEMO_QUESTIONS.length,
  };
}
