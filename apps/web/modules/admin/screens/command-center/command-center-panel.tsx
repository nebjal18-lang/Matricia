"use client";

import { useActionState, useId, useMemo, useState, type ReactNode } from "react";
import { Eye, FileText, MoreHorizontal, Shield } from "lucide-react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { Textarea } from "@/modules/shared/ui/textarea";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { AdminActionRequest, AdminCommandCenter, AdminWorkItem } from "@/modules/admin/data/command-center/model";
import {
  actionResourceLabel,
  actionStatusTone,
  compactDateTime,
  formatAdminDateTime,
  humanizeActionReason,
  isWorkOverdue,
  summarizeAdminWork,
  workItemMotif,
  workItemNextAction,
  workItemOrganizationLabel,
  RESOLUTION_CODES,
  dossierHref,
  shortReference,
} from "@/modules/admin/data/command-center/view-model";
import Link from "next/link";
import { claimAdminWork, decideAdminAction, requestActionFromCenter, resolveAdminWork, sweepExceptionsFromCenter, type AdminActionState } from "./actions";
import { getCommandCenterCodeLabel, type CommandCenterMessages, type CommandCodeGroup } from "./messages";

const idle: AdminActionState = { status: "idle" };
const control = "min-h-11 w-full rounded-md border border-[var(--client-line,var(--mat-border))] bg-background px-3 text-base";
type WorkEnrichment = Record<string, { organization_name: string | null; assignee_label: string | null }>;

type TriageRow =
  | { kind: "work"; key: string; sort: number; item: AdminWorkItem }
  | { kind: "action"; key: string; sort: number; action: AdminActionRequest };

function Feedback({ state, m }: { state: AdminActionState; m: CommandCenterMessages }) {
  const text = state.status === "success" ? m.success : state.status === "error" ? m[state.reason.toLowerCase()] ?? m.failed : "";
  return (
    <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={state.status === "error" ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-[var(--client-cta)]"}>
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
    <button type="submit" disabled={pending} className="admin-primary-cta min-h-11 w-full sm:w-auto">
      {pending ? wait : label}
    </button>
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

function priorityChipTone(priority: AdminWorkItem["priority"] | "APPROVAL", overdue: boolean): "coral" | "peach" | "sky" | "violet" | "mint" {
  if (overdue || priority === "CRITICAL") return "coral";
  if (priority === "HIGH" || priority === "APPROVAL") return "peach";
  if (priority === "MEDIUM") return "sky";
  return "mint";
}

function workSortRank(item: AdminWorkItem, currentTime: string): number {
  const overdue = isWorkOverdue(item.dueAt, currentTime) ? 0 : 1;
  const priority = item.priority === "CRITICAL" ? 0 : item.priority === "HIGH" ? 1 : item.priority === "MEDIUM" ? 2 : 3;
  return overdue * 10 + priority;
}

function actionSortRank(action: AdminActionRequest): number {
  if (action.status === "PENDING_APPROVAL") return 0;
  if (action.status === "AUTHORIZED" || action.status === "REQUEST_TRACKED") return 4;
  if (action.status === "FAILED") return 5;
  return 8;
}

function buildTriageRows(dashboard: AdminCommandCenter, currentTime: string): TriageRow[] {
  const workRows: TriageRow[] = dashboard.workItems.map((item) => ({
    kind: "work",
    key: `work:${item.id}`,
    sort: workSortRank(item, currentTime),
    item,
  }));
  const actionRows: TriageRow[] = dashboard.actions.map((action) => ({
    kind: "action",
    key: `action:${action.id}`,
    sort: actionSortRank(action),
    action,
  }));
  return [...workRows, ...actionRows].sort((a, b) => {
    if (a.sort !== b.sort) return a.sort - b.sort;
    if (a.kind !== b.kind) return a.kind === "work" ? -1 : 1;
    return a.key.localeCompare(b.key);
  });
}

function WorkActionForms({
  item,
  locale,
  m,
  keys,
}: {
  item: AdminWorkItem;
  locale: Locale;
  m: CommandCenterMessages;
  keys: [string, string];
}) {
  const p = useId();
  const [claim, claimAction, claiming] = useActionState(claimAdminWork, idle);
  const [resolve, resolveAction, resolving] = useActionState(resolveAdminWork, idle);
  const canClaim = item.canClaim !== false && item.status === "OPEN";
  const canResolve = item.canResolve !== false && item.status !== "OPEN";
  const next = workItemNextAction(item, locale);

  return (
    <div className="admin-triage-forms space-y-4">
      <p className="text-sm text-muted-foreground">{next}</p>
      {canClaim ? (
        <form action={claimAction} className="grid gap-3">
          <Hidden locale={locale} keyValue={keys[0]}>
            <input type="hidden" name="workItemId" value={item.id} />
            <input type="hidden" name="expectedRowVersion" value={item.rowVersion} />
          </Hidden>
          <Field id={`${p}-claim`} label={m.reason}>
            <Input id={`${p}-claim`} name="reason" required minLength={3} className={control} />
          </Field>
          <Submit pending={claiming} label={m.claim} wait={m.processing} />
          <Feedback state={claim} m={m} />
        </form>
      ) : null}
      {canResolve ? (
        <form action={resolveAction} className="grid gap-3">
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
            <Textarea id={`${p}-resolve-reason`} name="reason" required minLength={10} className={control} />
          </Field>
          <Submit pending={resolving} label={m.resolve} wait={m.processing} />
          <Feedback state={resolve} m={m} />
        </form>
      ) : null}
      {!canClaim && !canResolve ? <p className="text-sm text-muted-foreground">{m.readOnlyCommandCenter}</p> : null}
    </div>
  );
}

function ActionDecisionForm({
  action,
  locale,
  m,
  keyValue,
}: {
  action: AdminActionRequest;
  locale: Locale;
  m: CommandCenterMessages;
  keyValue: string;
}) {
  const p = useId();
  const [state, formAction, pending] = useActionState(decideAdminAction, idle);
  const actionLabel = getCommandCenterCodeLabel(locale, "action", action.actionType);
  const statusLabel = getCommandCenterCodeLabel(locale, "status", action.status);
  const resourceLabel = actionResourceLabel(action.resourceType, locale);
  const reason = humanizeActionReason(action.reason, locale);
  const requestedAt = formatAdminDateTime(action.requestedAt, locale);
  const executedAt = action.executedAt ? formatAdminDateTime(action.executedAt, locale) : null;
  const proof = action.resultHash ? shortReference(action.resultHash, 10) : null;
  const statusTone = actionStatusTone(action.status);
  const canDecide = action.status === "PENDING_APPROVAL" && action.canDecide !== false;

  return (
    <div className="admin-triage-forms space-y-4">
      <div>
        <h3 className="font-semibold">{actionLabel}</h3>
        <p className="text-sm text-muted-foreground">{reason}</p>
      </div>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">{locale === "ar" ? "المورد" : "Cible"}</dt>
          <dd title={action.resourceId}>{resourceLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{m.approvalsRequired}</dt>
          <dd dir="ltr">{action.approvalsRequired}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{locale === "ar" ? "طُلبت في" : "Demandée le"}</dt>
          <dd><time dateTime={compactDateTime(action.requestedAt)} dir="ltr">{requestedAt}</time></dd>
        </div>
        {executedAt ? (
          <div>
            <dt className="text-muted-foreground">{locale === "ar" ? "نُفذت في" : "Exécutée le"}</dt>
            <dd><time dateTime={compactDateTime(action.executedAt!)} dir="ltr">{executedAt}</time></dd>
          </div>
        ) : null}
      </dl>
      {canDecide ? (
        <form action={formAction} className="grid gap-3">
          <Hidden locale={locale} keyValue={keyValue}>
            <input type="hidden" name="actionRequestId" value={action.id} />
            <input type="hidden" name="expectedRowVersion" value={action.rowVersion} />
          </Hidden>
          <Field id={`${p}-decision-reason`} label={m.decisionReason}>
            <Input id={`${p}-decision-reason`} name="reason" required minLength={3} className={control} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="decision" value="APPROVE" disabled={pending} className="admin-primary-cta min-h-11 w-full sm:w-auto">
              {m.approve}
            </button>
            <Button type="submit" name="decision" value="REJECT" variant="destructive" disabled={pending} className="min-h-11 w-full sm:w-auto">
              {m.reject}
            </Button>
          </div>
          <Feedback state={state} m={m} />
        </form>
      ) : (
        <div className="text-sm" data-tone={statusTone}>
          <p>{action.status === "PENDING_APPROVAL" ? m.readOnlyDecision : statusLabel}</p>
          {proof ? (
            <p>
              <span>{locale === "ar" ? "إثبات التنفيذ" : "Preuve d’exécution"}</span>{" "}
              <code className="admin-ref" dir="ltr" title={action.resultHash ?? undefined}>{proof}</code>
            </p>
          ) : null}
        </div>
      )}
    </div>
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
  query?: string;
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
  const context = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const rows = useMemo(() => buildTriageRows(dashboard, currentTime), [dashboard, currentTime]);
  const defaultKey = rows[0]?.key ?? null;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const activeKey = selectedKey && rows.some((row) => row.key === selectedKey) ? selectedKey : defaultKey;
  const selected = rows.find((row) => row.key === activeKey) ?? null;

  const workKeyIndex = (id: string) => dashboard.workItems.findIndex((item) => item.id === id);
  const actionKeyValue = (id: string) => {
    const index = dashboard.actions.findIndex((action) => action.id === id);
    return keys[dashboard.workItems.length * 2 + index]!;
  };

  const totalCount = rows.length;
  const pendingApprovals = dashboard.actions.filter((action) => action.status === "PENDING_APPROVAL").length;

  return (
    <div className="admin-command-center space-y-6">
      <section id="command-today" className="admin-org-layout" aria-label={m.today}>
        <article className="client-card" id="command-work-items">
          <div className="admin-table-tools">
            <div>
              <h2 id={`${p}-today`}>{m.today}</h2>
              <p>{m.triageLead}</p>
            </div>
            <p className="admin-result-count" role="status">
              {locale === "ar"
                ? `${totalCount} للمعالجة`
                : `${totalCount} à traiter`}
              {summary.overdue > 0 ? ` · ${summary.overdue} ${m.overdue}` : null}
              {pendingApprovals > 0 ? ` · ${pendingApprovals} ${m.pending}` : null}
            </p>
          </div>

          {summary.humanReview > 0 ? <p role="note" className="client-access-note">{m.humanReviewNotice}</p> : null}

          {rows.length === 0 ? (
            <div className="admin-empty-card">
              <FileText className="size-6" aria-hidden />
              <h3>{m.emptyWork}</h3>
            </div>
          ) : (
            <div className="client-table-wrap" tabIndex={0} role="region" aria-label={m.today}>
              <table className="client-space-table admin-org-table">
                <thead>
                  <tr>
                    <th>{m.folder}</th>
                    <th>{m.typeColumn}</th>
                    <th>{m.critical}</th>
                    <th>{m.assignee}</th>
                    <th>{m.due}</th>
                    <th>
                      <span className="sr-only">{m.openDossier}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    if (row.kind === "work") {
                      const item = row.item;
                      const title = locale === "ar" ? item.titleAr : item.titleFr;
                      const queue = locale === "ar" ? item.queueLabelAr : item.queueLabelFr;
                      const priority = getCommandCenterCodeLabel(locale, "priority", item.priority);
                      const overdue = isWorkOverdue(item.dueAt, currentTime);
                      const orgName = workItemOrganizationLabel(item, locale, enrichment?.[item.id]?.organization_name);
                      const assignee = enrichment?.[item.id]?.assignee_label;
                      const chipTone = priorityChipTone(item.priority, overdue);
                      const href = dossierHref(locale, item, query);
                      const selectedRow = activeKey === row.key;
                      return (
                        <tr
                          key={row.key}
                          id={`work-${item.id}`}
                          data-overdue={overdue ? "true" : undefined}
                          data-priority={item.priority}
                          data-selected={selectedRow ? "true" : undefined}
                          data-kind="work"
                        >
                          <td>
                            <button
                              type="button"
                              className="admin-triage-select"
                              aria-pressed={selectedRow}
                              onClick={() => setSelectedKey(row.key)}
                            >
                              <span className="client-doc-cell">
                                <span className="client-avatar" data-tone={chipTone}>{orgName.slice(0, 1)}</span>
                                <span>
                                  <strong>{title}</strong>
                                  <small>{orgName}</small>
                                </span>
                              </span>
                            </button>
                          </td>
                          <td>
                            <span className="client-status-chip" data-tone="violet">{m.typeFile}</span>
                            <small className="mt-1 block text-muted-foreground">{queue}</small>
                          </td>
                          <td>
                            {overdue ? <span className="client-status-chip" data-tone="coral">{m.overdue}</span> : null}{" "}
                            <span className="client-status-chip" data-tone={chipTone}>{priority}</span>
                          </td>
                          <td>
                            <span className="client-status-chip" data-tone={assignee ? "mint" : "peach"}>
                              {assignee ?? m.unassigned}
                            </span>
                          </td>
                          <td>
                            <time dateTime={item.dueAt} dir="ltr">{formatAdminDateTime(item.dueAt, locale)}</time>
                          </td>
                          <td>
                            <details className="admin-row-menu" suppressHydrationWarning>
                              <summary aria-label={m.openDossier} suppressHydrationWarning>
                                <MoreHorizontal className="size-4" aria-hidden />
                              </summary>
                              <div>
                                <button type="button" className="admin-row-menu-button" onClick={() => setSelectedKey(row.key)}>
                                  {m.nextStep}
                                </button>
                                <Link href={href}>
                                  <Eye className="size-3.5" aria-hidden />
                                  {m.openDossier}
                                </Link>
                                <Link href={`/${locale}/administration/support/${item.id}`}>
                                  <Shield className="size-3.5" aria-hidden />
                                  {m.supportAccess}
                                </Link>
                              </div>
                            </details>
                          </td>
                        </tr>
                      );
                    }

                    const action = row.action;
                    const actionLabel = getCommandCenterCodeLabel(locale, "action", action.actionType);
                    const statusLabel = getCommandCenterCodeLabel(locale, "status", action.status);
                    const resourceLabel = actionResourceLabel(action.resourceType, locale);
                    const reason = humanizeActionReason(action.reason, locale);
                    const selectedRow = activeKey === row.key;
                    const statusTone = actionStatusTone(action.status);
                    const chipTone = statusTone === "ok" ? "mint" : statusTone === "critical" ? "coral" : "peach";
                    return (
                      <tr
                        key={row.key}
                        id={`admin-action-${action.id}`}
                        data-selected={selectedRow ? "true" : undefined}
                        data-kind="action"
                        data-tone={statusTone}
                      >
                        <td>
                          <button
                            type="button"
                            className="admin-triage-select"
                            aria-pressed={selectedRow}
                            onClick={() => setSelectedKey(row.key)}
                          >
                            <span className="client-doc-cell">
                              <span className="client-avatar" data-tone={chipTone}>{actionLabel.slice(0, 1)}</span>
                              <span>
                                <strong>{actionLabel}</strong>
                                <small>{reason}</small>
                              </span>
                            </span>
                          </button>
                        </td>
                        <td>
                          <span className="client-status-chip" data-tone="peach">{m.typeApproval}</span>
                          <small className="mt-1 block text-muted-foreground" title={action.resourceId}>{resourceLabel}</small>
                        </td>
                        <td>
                          <span className="client-status-chip" data-tone={chipTone}>{statusLabel}</span>
                        </td>
                        <td>
                          <span className="client-status-chip" data-tone="violet">—</span>
                        </td>
                        <td>
                          <time dateTime={compactDateTime(action.requestedAt)} dir="ltr">
                            {formatAdminDateTime(action.requestedAt, locale)}
                          </time>
                        </td>
                        <td>
                          <details className="admin-row-menu" suppressHydrationWarning>
                            <summary aria-label={m.nextStep} suppressHydrationWarning>
                              <MoreHorizontal className="size-4" aria-hidden />
                            </summary>
                            <div>
                              <button type="button" className="admin-row-menu-button" onClick={() => setSelectedKey(row.key)}>
                                {m.nextStep}
                              </button>
                            </div>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <aside className="client-card admin-treat-rail" aria-label={m.focusToday}>
          <h2>{m.focusToday}</h2>
          {!selected ? (
            <>
              <p>{m.selectPrompt}</p>
              <p className="client-access-note">{m.selectLead}</p>
            </>
          ) : selected.kind === "work" ? (
            <>
              <p>{m.focusTodayLead}</p>
              <div className="admin-triage-selected">
                <span className="client-status-chip" data-tone="violet">{m.typeFile}</span>
                <strong>{locale === "ar" ? selected.item.titleAr : selected.item.titleFr}</strong>
                <small>{workItemMotif(selected.item, locale)}</small>
                <Link href={dossierHref(locale, selected.item, query)} className="client-ghost-link">{m.openDossier}</Link>
              </div>
              <WorkActionForms
                item={selected.item}
                locale={locale}
                m={m}
                keys={[
                  keys[workKeyIndex(selected.item.id) * 2]!,
                  keys[workKeyIndex(selected.item.id) * 2 + 1]!,
                ]}
              />
            </>
          ) : (
            <>
              <p>{m.focusTodayLead}</p>
              <div className="admin-triage-selected">
                <span className="client-status-chip" data-tone="peach">{m.typeApproval}</span>
              </div>
              <ActionDecisionForm
                action={selected.action}
                locale={locale}
                m={m}
                keyValue={actionKeyValue(selected.action.id)}
              />
            </>
          )}
          <p className="client-access-note">{m.platformPathNote}</p>
          <p className="client-actions">
            <Link href={`/${locale}/administration/preparation${query}`} className="client-text-link">{m.platformPrep}</Link>
            {" · "}
            <Link href={`/${locale}/administration/configuration${query}`} className="client-text-link">{m.platformConfig}</Link>
            {" · "}
            <Link href={`/${locale}/administration/parcours${query}`} className="client-text-link">{m.platformFilm}</Link>
          </p>
        </aside>
      </section>

      <details className="client-card p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">{m.secondaryTools}</summary>
        <div className="mt-4 space-y-4">
          <form method="get" action={`/${locale}/administration/command-center`} className="admin-filters" data-layout="orgs">
            {(["organizationId", "q"] as const).map((name) => (context.get(name) ? <input key={name} type="hidden" name={name} value={context.get(name)!} /> : null))}
            <div className="admin-filters-tools">
              <label>
                <span className="sr-only">{locale === "ar" ? "حالة الطلب" : "État de la demande"}</span>
                <select name="actionStatus" defaultValue={dashboard.actionStatus ?? "ALL"} className={control}>
                  {["ALL", "PENDING_APPROVAL", "AUTHORIZED", "REQUEST_TRACKED", "EXECUTED", "FAILED", "REJECTED", "CANCELLED"].map((status) => (
                    <option key={status} value={status}>
                      {status === "ALL" ? (locale === "ar" ? "الكل" : "Tous") : getCommandCenterCodeLabel(locale, "status", status)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="admin-soft-cta min-h-11 w-full sm:w-auto">{locale === "ar" ? "تصفية" : "Filtrer"}</button>
            </div>
          </form>

          {(dashboard.actionPage ?? 1) > 1 || dashboard.hasMoreActions ? (
            <nav aria-label={locale === "ar" ? "صفحات الطلبات" : "Pages des demandes"} className="flex flex-wrap gap-3">
              {(dashboard.actionPage ?? 1) > 1 ? (
                <Link href={`/${locale}/administration/command-center?${new URLSearchParams({ ...Object.fromEntries(context), actionPage: String((dashboard.actionPage ?? 1) - 1), actionStatus: dashboard.actionStatus ?? "ALL" })}`} className="client-ghost-link">
                  {locale === "ar" ? "السابق" : "Précédent"}
                </Link>
              ) : null}
              <span dir="ltr">{dashboard.actionPage ?? 1}</span>
              {dashboard.hasMoreActions ? (
                <Link href={`/${locale}/administration/command-center?${new URLSearchParams({ ...Object.fromEntries(context), actionPage: String((dashboard.actionPage ?? 1) + 1), actionStatus: dashboard.actionStatus ?? "ALL" })}`} className="client-ghost-link">
                  {locale === "ar" ? "التالي" : "Suivant"}
                </Link>
              ) : null}
            </nav>
          ) : null}

          {dashboard.capabilities?.requestAction !== false ? (
            <>
              <details>
                <summary className="min-h-11 cursor-pointer font-semibold">{m.sweep}</summary>
                <form action={sweepAction} className="mt-3 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="locale" value={locale} />
                  <p className="min-w-0 flex-1 text-sm text-muted-foreground">{m.sweepHint}</p>
                  <button type="submit" disabled={sweeping} className="admin-soft-cta min-h-11 w-full sm:w-auto">
                    {sweeping ? m.processing : m.sweepSubmit}
                  </button>
                  <div className="w-full"><Feedback state={sweep} m={m} /></div>
                </form>
              </details>

              <details>
                <summary className="min-h-11 cursor-pointer font-semibold">{m.newAction}</summary>
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
                          <Textarea id={`${p}-reason`} name="reason" required minLength={10} className={control} />
                        </Field>
                      </div>
                    </div>
                    <button type="submit" disabled={requesting} className="admin-primary-cta min-h-11 w-full sm:w-auto">
                      {requesting ? m.processing : m.request}
                    </button>
                    <Feedback state={request} m={m} />
                  </form>
                )}
              </details>
            </>
          ) : (
            <p className="text-muted-foreground">{m.readOnlyCommandCenter}</p>
          )}
        </div>
      </details>
    </div>
  );
}
