import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { formatDateTimeCasablanca } from "@/modules/shared/lib/format/display";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { sensitivePageContext } from "@/modules/admin/ui/sensitive-page-context";
import { AdminStep2Gate } from "@/modules/admin/ui/admin-step2-gate";
import { collectOperationPages } from "@/modules/franchise/data/operations/paging";
import { franchiseStageLabel } from "@/modules/franchise/data/spaces/labels";
import { Decision } from "@/modules/franchise/screens/relances/panel";
import { getFollowupMessages } from "@/modules/franchise/screens/relances/messages";

const policy = z.object({
  id:z.string().uuid(), version:z.number().int().positive(), proposed_by:z.string().uuid(),
  eligible_stages:z.array(z.string()), reminder_delays_minutes:z.array(z.number().int()),
  retry_delays_minutes:z.array(z.number().int()), maximum_attempts:z.number().int(),
  maximum_reminders_per_7_days:z.number().int(), lease_seconds:z.number().int(),
  effective_from:z.string(), effective_until:z.string().nullable(), change_reason:z.string(),
  franchises:z.object({operator_code:z.string(),territory_code:z.string()}),
});

export default async function FranchiseFollowupReviewPage({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;if(!isLocale(locale))notFound();const ar=locale==="ar";
  const context=await sensitivePageContext({locale,path:"relances-franchise",active:"actors",roles:["SUPER_ADMIN","MATRICIA_ADMIN"],
    title:ar?"مراجعة قواعد المتابعة":"Revue des règles de relance",
    lead:ar?"راجعوا الآجال والحدود قبل اعتماد قاعدة اقترحها شخص آخر.":"Examinez les délais et les limites avant d’approuver une règle proposée par une autre personne."});
  if(context.status==="blocked")return context.view;
  const result=await collectOperationPages((from,to)=>context.access.client.from("franchise_followup_policy_versions")
    .select("id,version,proposed_by,eligible_stages,reminder_delays_minutes,retry_delays_minutes,maximum_attempts,maximum_reminders_per_7_days,lease_seconds,effective_from,effective_until,change_reason,franchises(operator_code,territory_code)")
    .eq("status","PENDING_APPROVAL").order("created_at").order("id").range(from,to));
  const rows=z.array(policy).safeParse(result.data),m=getFollowupMessages(locale);
  if(result.error||!rows.success)return context.wrap(<WorkspaceFailure locale={locale} reason={result.error?"QUERY_FAILED":"INVALID_RESPONSE"} returnPath={context.selfPath}/>);
  return context.wrap(<div className="client-page"><AdminStep2Gate locale={locale} current="relances"/>
    <p>{m.noSanction}</p>
    {!rows.data.length?<p role="status">{ar?"لا توجد قاعدة تنتظر المراجعة.":"Aucune règle en attente de revue."}</p>:rows.data.map(row=><article key={row.id} className="client-card">
      <h2>{row.franchises.territory_code} · {m.policy} {row.version}</h2>
      <p>{row.change_reason}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt>{m.stages}</dt><dd>{row.eligible_stages.map(stage=>franchiseStageLabel(stage,locale)).join(" · ")}</dd></div>
        <div><dt>{m.delays}</dt><dd dir="ltr">{row.reminder_delays_minutes.join(", ")}</dd></div>
        <div><dt>{m.retries}</dt><dd dir="ltr">{row.retry_delays_minutes.join(", ")}</dd></div>
        <div><dt>{m.attempts}</dt><dd>{row.maximum_attempts}</dd></div>
        <div><dt>{m.weekly}</dt><dd>{row.maximum_reminders_per_7_days}</dd></div>
        <div><dt>{m.lease}</dt><dd>{row.lease_seconds}</dd></div>
        <div><dt>{m.effectiveFrom}</dt><dd>{formatDateTimeCasablanca(row.effective_from,locale)}</dd></div>
        {row.effective_until?<div><dt>{m.effectiveUntil}</dt><dd>{formatDateTimeCasablanca(row.effective_until,locale)}</dd></div>:null}
      </dl>
      {row.proposed_by===context.access.userId?<p>{ar?"يجب أن يراجع هذه القاعدة مسؤول آخر.":"Cette règle doit être revue par un autre administrateur."}</p>:<Decision id={row.id} locale={locale} m={m} keyValue={randomUUID()}/>}
    </article>)}
  </div>);
}
