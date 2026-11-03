"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { Textarea } from "@/modules/shared/ui/textarea";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { AdminCommandCenter, AdminWorkItem } from "@/modules/admin/data/command-center/model";
import { summarizeAdminWork, workItemMotif, workItemNextAction, RESOLUTION_CODES, dossierHref } from "@/modules/admin/data/command-center/view-model";
import Link from "next/link";
import { claimAdminWork, decideAdminAction, requestActionFromCenter, resolveAdminWork, sweepExceptionsFromCenter, type AdminActionState } from "./actions";
import { getCommandCenterCodeLabel, type CommandCenterMessages, type CommandCodeGroup } from "./messages";

const idle: AdminActionState = { status: "idle" };
const control = "min-h-11 w-full rounded-md border border-[var(--ad-border,var(--mat-border))] bg-background px-3 text-base";
type WorkEnrichment = Record<string, { organization_name: string | null; assignee_label: string | null }>;

function Feedback({ state, m }: { state: AdminActionState; m: CommandCenterMessages }) {
  const text = state.status === "success" ? m.success : state.status === "error" ? m[state.reason.toLowerCase()] ?? m.failed : "";
  return (
    <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={state.status === "error" ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-[var(--ad-forest,var(--mat-navy))]"}>
      {text}
    </p>
  );
}

function Field({ id, label, children, help }: { id: string; label: string; children: ReactNode; help?: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help ? <p id={`${id}-help`} className="text-xs leading-5 text-muted-foreground">{help}</p> : null}
    </div>
  );
}

function Hidden({ locale, keyValue, children }: { locale: Locale; keyValue: string; children?: ReactNode }) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="idempotencyKey" value={keyValue} />
      {children}
    </>
  );
}

function Submit({ pending, label, wait }: { pending: boolean; label: string; wait: string }) {
  return (
    <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto bg-[var(--ad-forest,var(--mat-navy))] text-white hover:bg-[var(--ad-forest-deep,var(--mat-navy-strong))]">
      {pending ? wait : label}
    </Button>
  );
}

function Text({ id, label, name, required = true, help }: { id: string; label: string; name: string; required?: boolean; help?: string }) {
  return (
    <Field id={id} label={label} help={help}>
      <Input id={id} name={name} required={required} className={control} dir="ltr" aria-describedby={help ? `${id}-help` : undefined} />
    </Field>
  );
}

function Select({ id, label, name, values, locale, group, m }: { id: string; label: string; name: string; values: string[]; locale: Locale; group: CommandCodeGroup; m: CommandCenterMessages }) {
  return (
    <Field id={id} label={label}>
      <select id={id} name={name} className={control} required>
        {values.map((value) => (
          <option key={value || "empty"} value={value}>
            {value ? getCommandCenterCodeLabel(locale, group, value) : m.none}
          </option>
        ))}
      </select>
    </Field>
  );
}

function WorkCard({ item, locale, m, keys, enrichment }: { item: AdminWorkItem; locale: Locale; m: CommandCenterMessages; keys: [string, string]; enrichment?: WorkEnrichment }) {
  const p = useId();
  const [claim, claimAction, claiming] = useActionState(claimAdminWork, idle);
  const [resolve, resolveAction, resolving] = useActionState(resolveAdminWork, idle);
  const title = locale === "ar" ? item.titleAr : item.titleFr;
  const queue = locale === "ar" ? item.queueLabelAr : item.queueLabelFr;
  const priority = getCommandCenterCodeLabel(locale, "priority", item.priority);
  const status = getCommandCenterCodeLabel(locale, "status", item.status);
  const tone = item.priority === "CRITICAL" ? "critical" : item.priority === "HIGH" ? "high" : "default";
  const orgName = enrichment?.[item.id]?.organization_name;
  const assignee = enrichment?.[item.id]?.assignee_label;
  const motif = workItemMotif(item, locale);
  const next = workItemNextAction(item, locale);
  const dateLocale = locale === "ar" ? "ar-MA" : "fr-MA";

  return (
    <article id={`work-${item.id}`} className="admin-work-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="admin-eyebrow !text-[var(--ad-forest)]">{queue}</p>
          <h3 className="mt-1 text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{motif}</p>
        </div>
        <span className="admin-badge" data-tone={tone}>{priority}</span>
      </div>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div><dt className="text-muted-foreground">{locale === "ar" ? "الملف" : "Dossier"}</dt><dd>{orgName ?? (locale === "ar" ? "منصة" : "Plateforme")}</dd></div>
        <div><dt className="text-muted-foreground">{locale === "ar" ? "المسؤول" : "Responsable"}</dt><dd>{assignee ?? (locale === "ar" ? "غير معيّن" : "Non assigné")}</dd></div>
        <div><dt className="text-muted-foreground">{m.due}</dt><dd dir="ltr">{new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(new Date(item.dueAt))}</dd></div>
        <div><dt className="text-muted-foreground">{locale === "ar" ? "الإجراء التالي" : "Prochaine action"}</dt><dd>{next}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/${locale}/administration/support/${item.id}`} className="admin-btn-outline !min-h-10 !px-3 !text-sm">{locale === "ar" ? "الوصول المؤقت" : "Accès support temporaire"}</Link>
        <Link href={dossierHref(locale, item)} className="admin-btn-outline !min-h-10 !px-3 !text-sm">{locale === "ar" ? "فتح الملف" : "Ouvrir le dossier"}</Link>
        <span className="admin-badge" data-tone="default">{status}</span>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {item.canClaim !== false ? (
          <form action={claimAction} className="space-y-3 rounded-xl border border-[var(--ad-border)] bg-[var(--mat-canvas)] p-3">
            <Hidden locale={locale} keyValue={keys[0]}>
              <input type="hidden" name="workItemId" value={item.id} />
              <input type="hidden" name="expectedRowVersion" value={item.rowVersion} />
            </Hidden>
            <Field id={`${p}-claim`} label={m.reason}>
              <Input id={`${p}-claim`} name="reason" required minLength={3} placeholder={locale === "ar" ? "سبب التولي" : "Motif de prise en charge"} />
            </Field>
            <Submit pending={claiming} label={m.claim} wait={m.processing} />
            <Feedback state={claim} m={m} />
          </form>
        ) : null}
        {item.canResolve !== false ? (
          <form action={resolveAction} className="space-y-3 rounded-xl border border-[var(--ad-border)] bg-[var(--mat-canvas)] p-3">
            <Hidden locale={locale} keyValue={keys[1]}>
              <input type="hidden" name="workItemId" value={item.id} />
              <input type="hidden" name="expectedRowVersion" value={item.rowVersion} />
              <input type="hidden" name="evidence" value="{}" />
            </Hidden>
            <Field id={`${p}-code`} label={m.resolutionCode}>
              <select id={`${p}-code`} name="resolutionCode" className={control} required>
                {RESOLUTION_CODES.map((entry) => (
                  <option key={entry.code} value={entry.code}>{locale === "ar" ? entry.ar : entry.fr}</option>
                ))}
              </select>
            </Field>
            <Field id={`${p}-resolve-reason`} label={m.reason}>
              <Textarea id={`${p}-resolve-reason`} name="reason" required minLength={10} />
            </Field>
            <Submit pending={resolving} label={m.resolve} wait={m.processing} />
            <Feedback state={resolve} m={m} />
          </form>
        ) : null}
      </div>
    </article>
  );
}

function ActionCard({ action, locale, m, keyValue }: { action: AdminCommandCenter["actions"][number]; locale: Locale; m: CommandCenterMessages; keyValue: string }) {
  const p = useId();
  const [state, formAction, pending] = useActionState(decideAdminAction, idle);
  const actionLabel = getCommandCenterCodeLabel(locale, "action", action.actionType);
  const environmentLabel = getCommandCenterCodeLabel(locale, "environment", action.targetEnvironment);
  const statusLabel = getCommandCenterCodeLabel(locale, "status", action.status);

  return (
    <article className="admin-work-card" id={`admin-action-${action.id}`}>
      <div className="flex flex-wrap justify-between gap-3">
        <h3 className="font-semibold">{actionLabel}</h3>
        <span className="admin-badge" data-tone="default">
          {environmentLabel} · {statusLabel}
        </span>
      </div>
      <p className="mt-2 break-all text-sm text-muted-foreground" dir="ltr">
        {action.resourceType}/{action.resourceId}
      </p>
      <p className="mt-2 text-sm">{action.reason}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {m.approvalsRequired}: <span dir="ltr">{action.approvalsRequired}</span>
      </p>
      {action.status === "PENDING_APPROVAL" && action.canDecide !== false ? (
        <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <Hidden locale={locale} keyValue={keyValue}>
            <input type="hidden" name="actionRequestId" value={action.id} />
            <input type="hidden" name="expectedRowVersion" value={action.rowVersion} />
          </Hidden>
          <Field id={`${p}-decision-reason`} label={m.decisionReason}>
            <Input id={`${p}-decision-reason`} name="reason" required minLength={3} />
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit" name="decision" value="APPROVE" disabled={pending} className="min-h-11 bg-[var(--ad-forest,var(--mat-navy))] text-white hover:bg-[var(--ad-forest-deep,var(--mat-navy-strong))]">
              {m.approve}
            </Button>
            <Button type="submit" name="decision" value="REJECT" variant="destructive" disabled={pending} className="min-h-11">
              {m.reject}
            </Button>
          </div>
          <div className="sm:col-span-2">
            <Feedback state={state} m={m} />
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground"><p>{action.status==="PENDING_APPROVAL"?m.readOnlyDecision:statusLabel}</p>{action.executedAt?<time>{action.executedAt}</time>:null}{action.resultHash?<p className="break-all"dir="ltr">{action.resultHash}</p>:null}</div>
      )}
    </article>
  );
}

export function CommandCenterPanel({
  dashboard,
  query = "",
  locale,
  m,
  keys,
  currentTime,
  enrichment = {},
}: {
  dashboard: AdminCommandCenter;
  query?:string;
  locale: Locale;
  m: CommandCenterMessages;
  keys: string[];
  currentTime: string;
  enrichment?: WorkEnrichment;
}) {
  const p = useId();
  const [request, requestAction, requesting] = useActionState(requestActionFromCenter, idle);
  const [actionType, setActionType] = useState("ASSIGN_CASE");
  const [environment, setEnvironment] = useState("DEVELOPMENT");
  const [sweep, sweepAction, sweeping] = useActionState(sweepExceptionsFromCenter, idle);
  const summary = summarizeAdminWork(dashboard.workItems, currentTime);

  return (
    <div className="space-y-7">
      <div className="admin-kpi-secondary">
        <div><span>{m.dueToday}</span><strong dir="ltr">{summary.dueToday}</strong></div>
        <div><span>{m.humanReview}</span><strong dir="ltr">{summary.humanReview}</strong></div>
        <div><span>{m.exceptions}</span><strong dir="ltr">{summary.exceptions}</strong></div>
        <div><span>{locale==="ar"?"طلبات هذه الصفحة":"Demandes de cette page"}</span><strong dir="ltr">{dashboard.actions.length}</strong></div>
      </div>

      {summary.humanReview > 0 ? <p role="note" className="admin-notice">{m.humanReviewNotice}</p> : null}

      {dashboard.capabilities?.requestAction !== false ? (
        <form action={sweepAction} className="admin-panel flex flex-wrap items-end gap-3">
          <input type="hidden" name="locale" value={locale} />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{m.sweep}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{m.sweepHint}</p>
          </div>
          <Button type="submit" disabled={sweeping} className="min-h-11">{sweeping ? m.processing : m.sweepSubmit}</Button>
          <div className="w-full"><Feedback state={sweep} m={m} /></div>
        </form>
      ) : null}

      <section id="command-today" aria-labelledby={`${p}-today`} className="space-y-4">
        <div className="admin-section-head">
          <h2 id={`${p}-today`}>{m.today}</h2>
        </div>
        {summary.ordered.length === 0 ? (
          <p className="admin-panel text-muted-foreground">{m.emptyWork}</p>
        ) : (
          summary.ordered.map((item, index) => (
            <WorkCard key={item.id} item={item} locale={locale} m={m} enrichment={enrichment} keys={[keys[index * 2]!, keys[index * 2 + 1]!]} />
          ))
        )}
      </section>

      <section aria-labelledby={`${p}-approvals`} className="space-y-4">
        <div className="admin-section-head">
          <h2 id={`${p}-approvals`}>{m.sensitive}</h2>
        </div>
        <form method="get"className="flex flex-wrap gap-3"><label>{locale==="ar"?"حالة الطلب":"État de la demande"}<select name="actionStatus"defaultValue={dashboard.actionStatus??"ALL"}>{["ALL","PENDING_APPROVAL","AUTHORIZED","REQUEST_TRACKED","EXECUTED","FAILED","REJECTED","CANCELLED"].map((status)=><option key={status}value={status}>{status==="ALL"?(locale==="ar"?"الكل":"Tous"):getCommandCenterCodeLabel(locale,"status",status)}</option>)}</select></label><button>{locale==="ar"?"تصفية":"Filtrer"}</button></form>
        {dashboard.actions.length === 0 ? (
          <p className="admin-panel text-muted-foreground">{m.emptyActions}</p>
        ) : (
          dashboard.actions.map((action, index) => <ActionCard key={action.id} action={action} locale={locale} m={m} keyValue={keys[dashboard.workItems.length * 2 + index]!} />)
        )}
        {(dashboard.actionPage??1)>1||dashboard.hasMoreActions?<nav aria-label={locale==="ar"?"صفحات الطلبات":"Pages des demandes"}className="flex flex-wrap gap-3">{(dashboard.actionPage??1)>1?<Link href={`/${locale}/administration/command-center?${new URLSearchParams({...Object.fromEntries(new URLSearchParams(query)),actionPage:String((dashboard.actionPage??1)-1),actionStatus:dashboard.actionStatus??"ALL"})}`}>{locale==="ar"?"السابق":"Précédent"}</Link>:null}<span>{dashboard.actionPage??1}</span>{dashboard.hasMoreActions?<Link href={`/${locale}/administration/command-center?${new URLSearchParams({...Object.fromEntries(new URLSearchParams(query)),actionPage:String((dashboard.actionPage??1)+1),actionStatus:dashboard.actionStatus??"ALL"})}`}>{locale==="ar"?"التالي":"Suivant"}</Link>:null}</nav>:null}
      </section>

      {dashboard.capabilities?.requestAction !== false ? (
        <details className="admin-panel open:shadow-[var(--ad-shadow)]">
          <summary className="min-h-11 cursor-pointer text-xl font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{m.newAction}</summary>
          {dashboard.workItems.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">{m.noWorkForAction}</p>
          ) : (
          <form action={requestAction} className="mt-5 space-y-4">
            <Hidden locale={locale} keyValue={keys.at(-1)!} />
            <p className="text-sm text-muted-foreground">{m.actionScopeHint}</p>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field id={`${p}-work`} label={m.workItemId}>
                <select id={`${p}-work`} name="workItemId" className={control} required>
                  {dashboard.workItems.map((item) => {
                    const org = enrichment[item.id]?.organization_name;
                    const title = locale === "ar" ? item.titleAr : item.titleFr;
                    return <option key={item.id} value={item.id}>{org ? `${title} — ${org}` : title}</option>;
                  })}
                </select>
              </Field>
              <Field id={`${p}-action`} label={m.actionType}>
                <select id={`${p}-action`} name="actionType" className={control} required value={actionType} onChange={(event) => setActionType(event.target.value)}>
                  {["ASSIGN_CASE", "CHANGE_CONFIGURATION", "GRANT_SUPPORT_ACCESS", "RESTRICT_ENTITY", "SUSPEND_ENTITY", "MANUAL_EXCEPTION", "AUTHORIZE_PRODUCTION_CHANGE"].map((value) => (
                    <option key={value} value={value}>{getCommandCenterCodeLabel(locale, "action", value)}</option>
                  ))}
                </select>
              </Field>
              <Field id={`${p}-env`} label={m.environment}>
                <select id={`${p}-env`} name="targetEnvironment" className={control} required value={environment} onChange={(event) => setEnvironment(event.target.value)}>
                  {["DEVELOPMENT", "STAGING", "PRODUCTION"].map((value) => (
                    <option key={value} value={value}>{getCommandCenterCodeLabel(locale, "environment", value)}</option>
                  ))}
                </select>
              </Field>
              {environment === "PRODUCTION" ? (
                <Text id={`${p}-prod`} label={m.productionReference} name="productionAuthorizationReference" help={m.productionHelp} />
              ) : null}
              {actionType === "GRANT_SUPPORT_ACCESS" ? (
                <>
                  <Select id={`${p}-support-mode`} label={m.supportMode} name="supportAccessMode" locale={locale} group="support" m={m} values={["READ_ONLY", "CASE_SCOPED"]} />
                  <Field id={`${p}-support-duration`} label={m.supportExpiry} help={m.supportHelp}>
                    <select id={`${p}-support-duration`} name="supportMinutes" className={control} required aria-describedby={`${p}-support-duration-help`}>
                      {["15", "30", "60"].map((value) => <option key={value} value={value}>{`${value} ${m.minutes}`}</option>)}
                    </select>
                  </Field>
                </>
              ) : null}
              <div className="sm:col-span-2">
                <Field id={`${p}-reason`} label={m.reason}>
                  <Textarea id={`${p}-reason`} name="reason" required minLength={10} />
                </Field>
              </div>
            </div>
            <Button type="submit" disabled={requesting} className="min-h-11 w-full sm:w-auto bg-[var(--ad-gold,var(--mat-rose-tint))] text-[var(--ad-forest-deep,var(--mat-navy-strong))] hover:bg-[var(--ad-gold-strong,var(--mat-rose-tint))]">
              {requesting ? m.processing : m.request}
            </Button>
            <Feedback state={request} m={m} />
          </form>
          )}
        </details>
      ) : (
        <p className="admin-panel text-muted-foreground">{m.readOnlyCommandCenter}</p>
      )}
    </div>
  );
}
