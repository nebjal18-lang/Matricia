"use client";

import { useActionState } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Label } from "@/modules/shared/ui/label";
import { Textarea } from "@/modules/shared/ui/textarea";
import { StableIdempotencyField } from "@/modules/shared/ui/stable-idempotency-field";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { ContractMissionDashboard } from "@/modules/shared/lib/contracts-missions/model";
import { decideMilestone, type MissionActionState } from "./actions";
import type { MissionMessages } from "./messages";

const idle: MissionActionState = { status: "idle" };

export function MilestoneDecisionForm({ milestone, locale, messages }: {
  milestone: ContractMissionDashboard["missions"][number]["milestones"][number];
  locale: Locale;
  messages: MissionMessages;
}) {
  const [state, action, pending] = useActionState(decideMilestone, idle);
  if (milestone.status !== "SUBMITTED") return null;
  return <form action={action} className="mt-3 space-y-3 border-t pt-3">
    <input type="hidden" name="locale" value={locale}/>
    <input type="hidden" name="milestoneId" value={milestone.id}/>
    <input type="hidden" name="expectedRowVersion" value={milestone.rowVersion}/>
    <StableIdempotencyField rotateToken={state.status === "success" ? state.status : undefined}/>
    <Label htmlFor={`${milestone.id}-reason`}>{locale === "ar" ? "سبب القرار" : "Motif de la décision"}</Label>
    <Textarea id={`${milestone.id}-reason`} name="reason" required minLength={3} maxLength={1000}/>
    <div className="grid gap-2 sm:grid-cols-2">
      <Button name="decision" value="ACCEPTED" disabled={pending} className="min-h-11">{locale === "ar" ? "قبول المرحلة" : "Accepter le jalon"}</Button>
      <Button name="decision" value="REJECTED" disabled={pending} variant="outline" className="min-h-11">{locale === "ar" ? "رفض المرحلة" : "Refuser le jalon"}</Button>
    </div>
    {state.status !== "idle" ? <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>{state.status === "success" ? messages.success : state.reason === "FORBIDDEN" ? messages.forbidden : state.reason === "CONFLICT" ? messages.conflict : state.reason === "VALIDATION" ? messages.validation : messages.failed}</p> : null}
  </form>;
}
