import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { ContractMissionDashboard } from "@/modules/shared/lib/contracts-missions/model";
import type { MissionMessages } from "./messages";
import { MilestoneDecisionForm } from "./milestone-decision-form";

export function MilestoneDecisions({ dashboard, locale, messages }: {
  dashboard: ContractMissionDashboard;
  locale: Locale;
  messages: MissionMessages;
}) {
  const submitted = dashboard.missions.filter(mission=>!mission.scopeReconciliationRequired).flatMap((mission) => mission.milestones.filter((milestone) => !milestone.retired&&milestone.status === "SUBMITTED"));
  if (submitted.length === 0) return null;
  return <section aria-labelledby="milestone-decisions-title" className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
    <h2 id="milestone-decisions-title" className="text-xl font-semibold">{locale === "ar" ? "مراحل تنتظر قرارك" : "Jalons en attente de décision"}</h2>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {submitted.map((milestone) => <article key={milestone.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{milestone.title}</h3><span className="text-sm text-muted-foreground" dir="ltr">{milestone.key}</span></div><MilestoneDecisionForm milestone={milestone} locale={locale} messages={messages}/></article>)}
    </div>
  </section>;
}
