import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { getPublicJourneyCopy } from "./copy";

export const needStageIds = ["describe", "understand", "questions", "complete", "recap"] as const;
export const needRecapStep = needStageIds.indexOf("recap");

export function needStageForStep(step: number) {
  return needStageIds[Math.min(needRecapStep, Math.max(0, Math.trunc(step) || 0))]!;
}

export function getNeedStages(locale: Locale) {
  const copy = getPublicJourneyCopy(locale).need;
  return needStageIds.map((id, index) => ({ id, index, title: copy.stages[id][0], detail: copy.stages[id][1] }));
}
