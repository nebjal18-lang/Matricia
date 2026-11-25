"use client";

import { useActionState } from "react";
import Link from "next/link";
import { publicNeedRequestHref } from "@/modules/public/data/need-intent/model";
import { actOnPublicDiagnosticOpportunity, promotePublicDiagnostic, type PublicDiagnosticState } from "./public-diagnostic-actions";

const idle: PublicDiagnosticState = { status: "idle" };
export type PublicFinding = { id: string; kind: "ANOMALY" | "RISK" | "RECOMMENDATION"; title: string; text: string };
export type PublicOpportunity = { id: string; findingId: string; priority: number; status: string; rowVersion: number; needIntakeId: string | null; serviceCode: string | null };

const opportunityStatus: Record<string, { fr: string; ar: string }> = {
  DETECTED: { fr: "À traiter", ar: "قيد المعالجة" },
  DEFERRED: { fr: "Reportée", ar: "مؤجلة" },
  CLOSED: { fr: "Ignorée", ar: "متجاهلة" },
  NEED_REQUESTED: { fr: "Demande de devis ouverte", ar: "طلب العروض مفتوح" },
};

function OpportunityForm({ locale, opportunity, finding, idempotencyKey, organizationQuery }: { locale: "fr" | "ar"; opportunity: PublicOpportunity; finding: PublicFinding | undefined; idempotencyKey: string; organizationQuery: string }) {
  const fr = locale === "fr";
  const [state, decide, deciding] = useActionState(actOnPublicDiagnosticOpportunity, idle);
  const decided = state.status === "success" && state.opportunityId === opportunity.id ? state : null;
  const needIntakeId = decided?.needIntakeId ?? opportunity.needIntakeId;
  const serviceCode = decided?.serviceCode ?? opportunity.serviceCode;
  const dateId = `report-${opportunity.id}`;
  const organizationId = new URLSearchParams(organizationQuery).get("organizationId");
  const requestHref = needIntakeId ? `${publicNeedRequestHref(locale, needIntakeId, serviceCode)}${organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : ""}` : null;
  return (
    <form action={decide} className="grid gap-2 rounded-xl border p-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="opportunityId" value={opportunity.id} />
      <input type="hidden" name="rowVersion" value={opportunity.rowVersion} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <p>{fr ? "Opportunité" : "فرصة"} {opportunity.priority}{finding ? ` · ${finding.title}` : ""} · {opportunityStatus[opportunity.status]?.[locale] ?? opportunity.status}</p>
      {opportunity.status === "DETECTED" && !decided ? (
        <>
          <label htmlFor={dateId} className="text-sm">{fr ? "Reporter jusqu’au" : "تأجيل حتى"}</label>
          <input id={dateId} type="date" name="deferredUntil" className="min-h-11 w-fit rounded-md border px-3" />
          <div className="flex flex-wrap gap-2">
            <button name="action" value="CLOSE" disabled={deciding} className="client-text-link">{fr ? "Ignorer" : "تجاهل"}</button>
            <button name="action" value="DEFER" disabled={deciding} className="client-text-link">{fr ? "Reporter" : "تأجيل"}</button>
            <button name="action" value="REQUEST_QUOTES" disabled={deciding} className="client-text-link">{fr ? "Demander des devis" : "طلب عروض"}</button>
          </div>
        </>
      ) : null}
      {decided && !decided.needIntakeId ? <p role="status">{fr ? "Décision enregistrée." : "تم حفظ القرار."}</p> : null}
      {requestHref ? <Link className="client-cta w-fit" href={requestHref}>{fr ? "Compléter la demande de devis" : "إتمام طلب العروض"}</Link> : null}
      {state.status === "error" ? <p role="alert">{fr ? "L’action n’a pas été enregistrée." : "لم يُحفظ الإجراء."}</p> : null}
    </form>
  );
}
export type PublicPromotion = { id: string; score: string; rating: string; findings: PublicFinding[]; opportunities: PublicOpportunity[] };

export function PublicDiagnosticPanel({ locale, intakeId, organizationQuery, promotion, idempotencyKey }: { locale: "fr" | "ar"; intakeId: string; organizationQuery: string; promotion: PublicPromotion | null; idempotencyKey: string }) {
  const fr = locale === "fr";
  const [promotionState, promote, promoting] = useActionState(promotePublicDiagnostic, idle);
  const key = idempotencyKey;
  if (!promotion) {
    return (
      <form action={promote} className="mt-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="intakeId" value={intakeId} />
        <input type="hidden" name="idempotencyKey" value={key} />
        <button className="client-text-link" disabled={promoting}>{promoting ? (fr ? "Analyse…" : "جارٍ التحليل…") : (fr ? "Lancer le diagnostic" : "بدء التشخيص")}</button>
        {promotionState.status === "error" ? <p role="alert">{fr ? "Le diagnostic n’a pas pu être lancé." : "تعذر بدء التشخيص."}</p> : null}
      </form>
    );
  }
  return (
    <div className="mt-4 grid gap-3">
      <p><strong>{fr ? "Score" : "النتيجة"}</strong> <span dir="ltr">{promotion.score}</span> · {promotion.rating}</p>
      <ul className="grid gap-2">
        {promotion.findings.map((finding) => <li key={finding.id}><strong>{finding.title}</strong><span className="mt-1 block text-sm text-muted-foreground">{finding.text}</span></li>)}
      </ul>
      {promotion.opportunities.length === 0 ? <p>{fr ? "Aucune action n’est requise sur ce résultat." : "لا إجراء مطلوب على هذه النتيجة."}</p> : promotion.opportunities.map((opportunity) => (
        <OpportunityForm key={opportunity.id} locale={locale} opportunity={opportunity} finding={promotion.findings.find((finding) => finding.id === opportunity.findingId)} idempotencyKey={`${key.slice(0, 24)}${opportunity.id.slice(24)}`} organizationQuery={organizationQuery} />
      ))}
    </div>
  );
}
