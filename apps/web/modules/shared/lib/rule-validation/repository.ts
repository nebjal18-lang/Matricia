import { z } from "zod";
import type { QueryResponse, RuleValidationDependencies, RuleValidationRepository, RuleValidationResult } from "./contracts";
import { questionnaireQuestionRowSchema, questionnaireVersionRowSchema, ruleSimulationSchema, ruleValidationSchema, simulationInputSchema, uuidSchema } from "./model";

function failure(error: QueryResponse["error"]): RuleValidationResult<never> {
  return { status: "error", reason: error?.code === "42501" ? "FORBIDDEN" : "UNAVAILABLE" };
}

function relation<T>(value: T | T[]): T {
  if (!Array.isArray(value)) return value;
  const first = value[0];
  if (first === undefined) throw new Error("INVALID_RELATION");
  return first;
}

export function createRuleValidationRepository(dependencies: RuleValidationDependencies): RuleValidationRepository {
  async function ensureAccess(): Promise<RuleValidationResult<true>> {
    const access = await dependencies.access();
    if (access === "AUTHORIZED") return { status: "success", value: true };
    if (access === "UNAUTHENTICATED") return { status: "error", reason: "UNAUTHENTICATED" };
    if (access === "FORBIDDEN") return { status: "error", reason: "FORBIDDEN" };
    return { status: "error", reason: "UNAVAILABLE" };
  }

  return {
    async loadWorkspace(selectedVersionId) {
      const auth = await ensureAccess();
      if (auth.status === "error") return auth;
      if (selectedVersionId !== null && !uuidSchema.safeParse(selectedVersionId).success) return { status: "error", reason: "INVALID_INPUT" };

      const versionsResponse = await dependencies.versions();
      if (versionsResponse.error) return failure(versionsResponse.error);
      const parsedVersions = z.array(questionnaireVersionRowSchema).max(100).safeParse(versionsResponse.data);
      if (!parsedVersions.success) return { status: "error", reason: "INVALID_RESPONSE" };
      const selected = selectedVersionId ?? parsedVersions.data[0]?.id ?? null;
      if (selected !== null && !parsedVersions.data.some((version) => version.id === selected)) return { status: "error", reason: "INVALID_INPUT" };

      let parsedQuestions: z.infer<typeof questionnaireQuestionRowSchema>[] = [];
      if (selected) {
        const questionsResponse = await dependencies.questions(selected);
        if (questionsResponse.error) return failure(questionsResponse.error);
        const parsed = z.array(questionnaireQuestionRowSchema).max(500).safeParse(questionsResponse.data);
        if (!parsed.success || parsed.data.some((question) => question.questionnaire_version_id !== selected)) return { status: "error", reason: "INVALID_RESPONSE" };
        parsedQuestions = parsed.data;
      }

      return {
        status: "success",
        value: {
          versions: parsedVersions.data.map((version) => ({
            id: version.id,
            version: version.version,
            status: version.status,
            titleFr: version.title_fr,
            titleAr: version.title_ar,
            audience: version.audience,
            engineVersion: version.engine_version,
            policyVersion: version.policy_version,
            libraryId: version.library_id,
            libraryCode: relation(version.catalog_libraries).code,
          })),
          selectedVersionId: selected,
          questions: parsedQuestions.map((row) => {
            const question = relation(row.question_versions);
            return {
              id: question.id,
              sortOrder: row.sort_order,
              labelFr: question.label_fr,
              labelAr: question.label_ar,
              answerType: question.answer_type,
              dataKey: question.data_key,
              required: row.required_override ?? question.required_by_default,
            };
          }),
        },
      };
    },

    async validate(questionnaireVersionId) {
      if (!uuidSchema.safeParse(questionnaireVersionId).success) return { status: "error", reason: "INVALID_INPUT" };
      const auth = await ensureAccess();
      if (auth.status === "error") return auth;
      const response = await dependencies.rpc("validate_questionnaire_rule_engine", { p_questionnaire_version_id: questionnaireVersionId });
      if (response.error) return failure(response.error);
      const parsed = ruleValidationSchema.safeParse(response.data);
      return parsed.success && parsed.data.questionnaire_version_id === questionnaireVersionId
        ? { status: "success", value: parsed.data }
        : { status: "error", reason: "INVALID_RESPONSE" };
    },

    async simulate(input) {
      const parsedInput = simulationInputSchema.safeParse(input);
      if (!parsedInput.success) return { status: "error", reason: "INVALID_INPUT" };
      const auth = await ensureAccess();
      if (auth.status === "error") return auth;
      const response = await dependencies.rpc("simulate_questionnaire_rule_engine", {
        p_questionnaire_version_id: parsedInput.data.questionnaireVersionId,
        p_answers: parsedInput.data.answers,
        p_previous_answers: parsedInput.data.previousAnswers,
      });
      if (response.error) return failure(response.error);
      const parsed = ruleSimulationSchema.safeParse(response.data);
      return parsed.success && parsed.data.questionnaire_version_id === parsedInput.data.questionnaireVersionId
        ? { status: "success", value: parsed.data }
        : { status: "error", reason: "INVALID_RESPONSE" };
    },
  };
}
