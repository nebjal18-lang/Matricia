"use client";

import { useActionState } from "react";
import { Badge } from "@/modules/shared/ui/badge";
import { Button } from "@/modules/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { Input } from "@/modules/shared/ui/input";
import { Textarea } from "@/modules/shared/ui/textarea";
import {
  budgetConsumption,
  displayCalendarDate,
  exactMoney,
  formatProgressBasisPoints,
  netAllocatedMinor,
  progressBarPercent,
  type Portfolio,
} from "@/modules/client/data/portfolio/model";
import {
  createCostCenter,
  createProject,
  createSite,
  linkContract,
  recordAllocation,
  saveBudget,
  saveTask,
  scheduleEvent,
} from "./actions";
import type { Messages } from "./messages";

type Keys = { site: string; project: string; task: string; contract: string; budget: string; center: string; allocation: string; event: string };
type Props = { locale: "fr" | "ar"; data: Portfolio; m: Messages; keys: Keys; embedded?: boolean };
const portfolioEventLabels: Record<"fr" | "ar", Record<string, string>> = {
  fr: { CUSTOM: "Autre événement", PROJECT_DEADLINE: "Échéance du projet", APPROVAL: "Validation", DOCUMENT: "Document", INVOICE: "Facture", MISSION: "Mission", RFQ: "Consultation" },
  ar: { CUSTOM: "حدث آخر", PROJECT_DEADLINE: "موعد المشروع", APPROVAL: "اعتماد", DOCUMENT: "مستند", INVOICE: "فاتورة", MISSION: "مهمة تعاقدية", RFQ: "استشارة" },
};
const allocationLabels: Record<"fr" | "ar", Record<string, string>> = {
 fr: {COMMITMENT:"Engagement",ACTUAL:"Dépense réalisée",RELEASE:"Libération d’engagement"},
 ar: {COMMITMENT:"التزام",ACTUAL:"نفقة فعلية",RELEASE:"تحرير الالتزام"},
};
const taskStatuses = ["PENDING", "IN_PROGRESS", "BLOCKED", "SUBMITTED", "ACCEPTED", "CANCELLED"] as const;
const idle = { status: "idle" } as const;

function nameOf(locale: "fr" | "ar", fr: string, ar: string) {
  return locale === "ar" ? ar : fr;
}

function label(map: Record<string, string>, value: string) {
  return map[value] ?? value;
}

export function PortfolioPanel({ locale, data, m, keys, embedded = false }: Props) {
  const inner = data.organizations.length === 0
    ? <p>{m.empty}</p>
    : data.organizations.map((org) => (
      <OrganizationPortfolio key={org.id} locale={locale} data={data} m={m} keys={keys} organizationId={org.id} />
    ));
  if (embedded) return <div className="client-portfolio">{inner}</div>;
  return (
    <main className="client-page">
      <header>
        <h1>{m.title}</h1>
        <p>{m.intro}</p>
      </header>
      {inner}
    </main>
  );
}

function OrganizationPortfolio({ locale, data, m, keys, organizationId }: Props & { organizationId: string }) {
  const org = data.organizations.find((item) => item.id === organizationId)!;
  const projects = data.projects.filter((item) => item.organizationId === org.id);
  const contracts = data.contracts.filter((item) => item.organizationId === org.id);
  const sites = data.sites.filter((item) => item.organizationId === org.id);
  const budgets = data.budgets.filter((item) => item.organizationId === org.id);
  const centers = data.costCenters.filter((item) => item.organizationId === org.id);
  const allocations = data.allocations.filter((item) => item.organizationId === org.id);
  const calendar = data.calendar.filter((item) => item.organizationId === org.id);
  const canPortfolio = org.capabilities.includes("MANAGE_PORTFOLIO");
  const canBudget = org.capabilities.includes("MANAGE_BUDGET");
  const siteName = (id: string | null) => {
    const site = sites.find((item) => item.id === id);
    return site ? nameOf(locale, site.nameFr, site.nameAr) : m.none;
  };
  const projectCode = (id: string | null) => projects.find((item) => item.id === id)?.code ?? m.none;
  const libraryName = (id: string | null) => {
    const library = data.libraries.find((item) => item.id === id);
    return library ? nameOf(locale, library.nameFr, library.nameAr) : m.none;
  };
  const orgTasks = data.tasks.filter((task) => projects.some((project) => project.id === task.projectId));

  return (
    <section className="client-portfolio" aria-labelledby={`org-${org.id}`}>
      <h2 id={`org-${org.id}`} className="client-portfolio-org">{org.name}</h2>

      <article className="client-card">
        <header><h3>{m.sites}</h3></header>
        {sites.length === 0 ? <p>{m.noSite}</p> : (
          <ul className="client-portfolio-list">
            {sites.map((site) => (
              <li key={site.id}>
                <strong>{nameOf(locale, site.nameFr, site.nameAr)}</strong>
                <span>{site.code}</span>
              </li>
            ))}
          </ul>
        )}
      </article>
      {canPortfolio ? <SiteForm locale={locale} orgId={org.id} m={m} keyValue={keys.site} /> : null}

      <div className="client-portfolio-grid">
        <article className="client-card">
          <header><h3>{m.projects}</h3></header>
          {projects.length === 0 ? <p>{m.empty}</p> : projects.map((project) => (
            <article key={project.id} className="client-portfolio-item">
              <div className="client-portfolio-item-head">
                <strong>{nameOf(locale, project.nameFr, project.nameAr)}</strong>
                <Badge>{label(m.projectStatuses, project.status)}</Badge>
              </div>
              <p>{project.code} · {m.version} {project.version} · {m.site}: {siteName(project.siteId)}</p>
              <p>{nameOf(locale, project.descriptionFr, project.descriptionAr)}</p>
              <p>{m.progress}: <span dir="ltr">{formatProgressBasisPoints(project.progressBasisPoints, locale)}</span></p>
              <div className="client-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressBarPercent(project.progressBasisPoints)}>
                <span style={{ width: `${progressBarPercent(project.progressBasisPoints)}%` }} />
              </div>
            </article>
          ))}
        </article>
        <article className="client-card">
          <header><h3>{m.tasks}</h3></header>
          {orgTasks.length === 0 ? <p>{m.empty}</p> : orgTasks.map((task) => (
            <div key={task.id} className="client-portfolio-item">
              <div className="client-portfolio-item-head">
                <strong>{nameOf(locale, task.titleFr, task.titleAr)}</strong>
                <Badge variant="outline">{label(m.taskStatuses, task.status)}</Badge>
              </div>
              <p>{projects.find((item) => item.id === task.projectId)?.code} · {task.type}{task.dueAt ? ` · ${new Date(task.dueAt).toLocaleString(locale)}` : ""}</p>
            </div>
          ))}
        </article>
      </div>

      <article className="client-card">
        <header><h3>{m.contracts}</h3></header>
        {contracts.length === 0 ? <p>{m.empty}</p> : contracts.map((contract) => (
          <div key={contract.id} className="client-portfolio-item">
            <div className="client-portfolio-item-head">
              <strong>{m.contract} <span dir="ltr">{contract.id.slice(0, 8)}</span></strong>
              <Badge variant="outline">{contract.status}</Badge>
            </div>
            <p>{m.version} {contract.version} · {contract.projectId ? projectCode(contract.projectId) : m.unlinked}</p>
          </div>
        ))}
      </article>

      {canPortfolio ? (
        <div className="client-portfolio-forms">
          <ProjectForm locale={locale} orgId={org.id} sites={sites} m={m} keyValue={keys.project} />
          <TaskForm locale={locale} projects={projects} m={m} keyValue={keys.task} />
          <ContractForm locale={locale} projects={projects} contracts={contracts.filter((item) => !item.projectId)} m={m} keyValue={keys.contract} />
        </div>
      ) : <p className="client-card">{m.readOnly}</p>}

      <div className="client-portfolio-grid">
        <article className="client-card">
          <header><h3>{m.budgets}</h3></header>
          {budgets.length === 0 ? <p>{m.empty}</p> : budgets.map((budget) => {
            const net = netAllocatedMinor(allocations, budget.id);
            const approved = BigInt(budget.approvedAmountMinor ?? budget.amountMinor);
            const consumption = budgetConsumption(net, approved);
            return (
              <div key={budget.id} className="client-portfolio-item">
                <div className="client-portfolio-item-head">
                  <strong>{budget.fiscalYear} · {exactMoney(budget.amountMinor, budget.currency)}</strong>
                  <Badge>{label(m.budgetStatuses, budget.status)}</Badge>
                </div>
                <p>{m.library}: {libraryName(budget.libraryId)} · {m.site}: {siteName(budget.siteId)} · {m.project}: {projectCode(budget.projectId)}</p>
                <dl className="client-fact-grid">
                  <div><small>{m.used}</small><span dir="ltr">{exactMoney(net.toString(), budget.currency)}</span></div>
                  <div><small>{m.remaining}</small><span dir="ltr">{exactMoney(consumption.remainingMinor, budget.currency)}</span></div>
                  <div><small>{m.consumption}</small><span dir="ltr">{formatProgressBasisPoints(consumption.usedBasisPoints, locale)}</span></div>
                </dl>
                <p className="client-budget-alert" data-level={consumption.level} role={consumption.level === "ok" ? undefined : "status"}>
                  {m.alerts[consumption.level]}
                </p>
                <div className="client-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressBarPercent(consumption.usedBasisPoints)}>
                  <span style={{ width: `${progressBarPercent(consumption.usedBasisPoints)}%` }} />
                </div>
              </div>
            );
          })}
        </article>
        <article className="client-card">
          <header><h3>{m.centers}</h3></header>
          {centers.length === 0 ? <p>{m.empty}</p> : centers.map((center) => {
            const linked = allocations.filter((item) => item.costCenterId === center.id);
            return (
              <div key={center.id} className="client-portfolio-item">
                <div className="client-portfolio-item-head">
                  <span>{nameOf(locale, center.nameFr, center.nameAr)} · {center.code}</span>
                  <Badge variant="outline">{label(m.centerStatuses, center.status)}</Badge>
                </div>
                {linked.length === 0 ? null : (
                  <ul>
                    {linked.map((item) => (
                      <li key={item.id}>{label(allocationLabels[locale], item.type)} · {exactMoney(item.amountMinor, item.currency)} · {item.projectId ? projectCode(item.projectId) : m.none}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </article>
      </div>

      {canBudget ? (
        <div className="client-portfolio-forms">
          <BudgetForm locale={locale} orgId={org.id} projects={projects} sites={sites} data={data} m={m} keyValue={keys.budget} />
          <CenterForm locale={locale} orgId={org.id} m={m} keyValue={keys.center} />
          <AllocationForm locale={locale} orgId={org.id} projects={projects} tasks={orgTasks} contracts={contracts} targets={(data.allocationTargets ?? []).filter(item => item.organizationId === org.id)} targetsStatus={data.allocationTargetsStatus ?? "success"} targetsTruncated={data.allocationTargetsTruncated ?? false} invoiceError={data.allocationInvoiceError} budgets={budgets.filter((item) => item.status === "APPROVED")} centers={centers.filter((item) => item.status === "ACTIVE")} m={m} keyValue={keys.allocation} />
        </div>
      ) : null}

      <article className="client-card">
        <header><h3>{m.calendar}</h3></header>
        {calendar.length === 0 ? <p>{m.empty}</p> : (
          <ol className="client-portfolio-list">
            {calendar.map((item) => (
              <li key={`${item.sourceKind}-${item.itemId}-${item.projectId ?? "org"}`}>
                <strong>{nameOf(locale, item.titleFr, item.titleAr)}</strong>
                <span>{displayCalendarDate(item, locale)}{item.projectId ? ` · ${projectCode(item.projectId)}` : ""}</span>
                <Badge variant="outline">{label(m.calendarSources, item.sourceKind)}</Badge>
              </li>
            ))}
          </ol>
        )}
      </article>
      {canPortfolio ? <EventForm locale={locale} orgId={org.id} projects={projects} m={m} keyValue={keys.event} /> : null}
    </section>
  );
}

const Hidden = ({ locale, orgId, keyValue }: { locale: string; orgId?: string; keyValue: string }) => (
  <>
    <input type="hidden" name="locale" value={locale} />
    {orgId ? <input type="hidden" name="organizationId" value={orgId} /> : null}
    <input type="hidden" name="idempotencyKey" value={keyValue} />
  </>
);

function Feedback({ state, m }: { state: { status: string; reason?: string }; m: Messages }) {
  if (state.status === "idle") return null;
  const value = state.status === "success" ? m.success : state.reason === "VALIDATION" ? m.validation : state.reason === "FORBIDDEN" ? m.forbidden : m.unavailable;
  return <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>{value}</p>;
}

const Select = ({ name, label, children, required = true }: { name: string; label: string; children: React.ReactNode; required?: boolean }) => (
  <label className="grid gap-1 text-sm">{label}<select name={name} required={required} className="min-h-11 rounded-md border bg-background px-3">{children}</select></label>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="grid gap-1 text-sm">{label}{children}</label>
);

function SiteForm({ locale, orgId, m, keyValue }: { locale: "fr" | "ar"; orgId: string; m: Messages; keyValue: string }) {
  const [state, action, pending] = useActionState(createSite, idle);
  return (
    <Card>
      <CardHeader><CardTitle>{m.newSite}</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <Hidden locale={locale} orgId={orgId} keyValue={keyValue} />
          <Field label={m.code}><Input name="siteCode" pattern="[A-Z][A-Z0-9_-]+" required /></Field>
          <Field label={m.nameFr}><Input name="nameFr" required /></Field>
          <Field label={m.nameAr}><Input name="nameAr" dir="rtl" required /></Field>
          <Field label={m.city}><Input name="city" required /></Field>
          <Field label={m.addressLine}><Input name="addressLine" required minLength={3} /></Field>
          <Field label={m.regionCode}><Input name="regionCode" dir="ltr" pattern="[A-Z]{2}-[A-Z0-9_-]{1,37}" /></Field>
          <Field label={m.reason}><Input name="changeReason" required minLength={3} /></Field>
          <Button disabled={pending}>{m.save}</Button>
          <Feedback state={state} m={m} />
        </form>
      </CardContent>
    </Card>
  );
}

function ProjectForm({ locale, orgId, sites, m, keyValue }: { locale: "fr" | "ar"; orgId: string; sites: Portfolio["sites"]; m: Messages; keyValue: string }) {
  const [state, action, pending] = useActionState(createProject, idle);
  return (
    <Card>
      <CardHeader><CardTitle>{m.newProject}</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <Hidden locale={locale} orgId={orgId} keyValue={keyValue} />
          <Field label={m.code}><Input name="projectCode" pattern="[A-Z][A-Z0-9_-]+" required /></Field>
          <Select name="siteId" label={m.site} required={false}><option value="">{m.none}</option>{sites.map((item) => <option key={item.id} value={item.id}>{nameOf(locale, item.nameFr, item.nameAr)}</option>)}</Select>
          <Field label={m.nameFr}><Input name="nameFr" required /></Field>
          <Field label={m.nameAr}><Input name="nameAr" dir="rtl" required /></Field>
          <Field label={m.descriptionFr}><Textarea name="descriptionFr" required /></Field>
          <Field label={m.descriptionAr}><Textarea name="descriptionAr" dir="rtl" required /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={m.start}><Input name="startedOn" type="date" /></Field>
            <Field label={m.target}><Input name="targetEndOn" type="date" /></Field>
          </div>
          <Field label={m.reason}><Input name="changeReason" required minLength={3} /></Field>
          <Button disabled={pending}>{m.save}</Button>
          <Feedback state={state} m={m} />
        </form>
      </CardContent>
    </Card>
  );
}

function TaskForm({ locale, projects, m, keyValue }: { locale: "fr" | "ar"; projects: Portfolio["projects"]; m: Messages; keyValue: string }) {
  const [state, action, pending] = useActionState(saveTask, idle);
  return (
    <Card>
      <CardHeader><CardTitle>{m.newTask}</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <Hidden locale={locale} keyValue={keyValue} />
          <Select name="projectId" label={m.project}>{projects.map((item) => <option key={item.id} value={item.id}>{item.code} · {nameOf(locale, item.nameFr, item.nameAr)}</option>)}</Select>
          <Field label={m.code}><Input name="taskKey" pattern="[A-Z][A-Z0-9_-]+" required /></Field>
          <Select name="taskType" label={m.taskType}><option value="TASK">{locale === "ar" ? "مهمة" : "Tâche"}</option><option value="MILESTONE">{locale === "ar" ? "مرحلة" : "Jalon"}</option></Select>
          <Select name="status" label={m.status}>{taskStatuses.map((item) => <option key={item} value={item}>{label(m.taskStatuses, item)}</option>)}</Select>
          <Field label={m.due}><Input name="dueAt" type="datetime-local" /></Field>
          <Field label={m.nameFr}><Input name="titleFr" required /></Field>
          <Field label={m.nameAr}><Input name="titleAr" dir="rtl" required /></Field>
          <Field label={m.descriptionFr}><Textarea name="descriptionFr" /></Field>
          <Field label={m.descriptionAr}><Textarea name="descriptionAr" dir="rtl" /></Field>
          <Field label={m.reason}><Input name="changeReason" required minLength={3} /></Field>
          <Button disabled={pending || projects.length === 0}>{m.save}</Button>
          <Feedback state={state} m={m} />
        </form>
      </CardContent>
    </Card>
  );
}

function ContractForm({ locale, projects, contracts, m, keyValue }: { locale: "fr" | "ar"; projects: Portfolio["projects"]; contracts: Portfolio["contracts"]; m: Messages; keyValue: string }) {
  const [state, action, pending] = useActionState(linkContract, idle);
  return (
    <Card>
      <CardHeader><CardTitle>{m.linkContract}</CardTitle><CardDescription>{m.linkContractHelp}</CardDescription></CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <Hidden locale={locale} keyValue={keyValue} />
          <Select name="projectId" label={m.project}>{projects.map((item) => <option key={item.id} value={item.id}>{item.code} · {nameOf(locale, item.nameFr, item.nameAr)}</option>)}</Select>
          <Select name="contractId" label={m.contract}>{contracts.map((item) => <option key={item.id} value={item.id}>{item.id.slice(0, 8)} · {item.status}</option>)}</Select>
          <Button disabled={pending || projects.length === 0 || contracts.length === 0}>{m.link}</Button>
          <Feedback state={state} m={m} />
        </form>
      </CardContent>
    </Card>
  );
}

function BudgetForm({ locale, orgId, projects, sites, data, m, keyValue }: { locale: "fr" | "ar"; orgId: string; projects: Portfolio["projects"]; sites: Portfolio["sites"]; data: Portfolio; m: Messages; keyValue: string }) {
  const [state, action, pending] = useActionState(saveBudget, idle);
  return (
    <Card>
      <CardHeader><CardTitle>{m.newBudget}</CardTitle><CardDescription>{m.amountHelp}</CardDescription></CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <Hidden locale={locale} orgId={orgId} keyValue={keyValue} />
          <Field label={m.year}><Input name="fiscalYear" type="number" min="2000" max="2200" defaultValue={new Date().getFullYear()} required /></Field>
          <Field label={m.currency}><Input name="currency" value="MAD" readOnly /></Field>
          <Select name="libraryId" label={m.library} required={false}><option value="">{m.none}</option>{data.libraries.map((item) => <option key={item.id} value={item.id}>{nameOf(locale, item.nameFr, item.nameAr)}</option>)}</Select>
          <Select name="siteId" label={m.site} required={false}><option value="">{m.none}</option>{sites.map((item) => <option key={item.id} value={item.id}>{nameOf(locale, item.nameFr, item.nameAr)}</option>)}</Select>
          <Select name="projectId" label={m.project} required={false}><option value="">{m.none}</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</Select>
          <Field label={m.amount}><Input name="amount" inputMode="decimal" dir="ltr" required /></Field>
          <Field label={m.rationale}><Textarea name="rationale" required /></Field>
          <input type="hidden" name="approve" value="no" />
          <label className="flex min-h-11 items-center gap-2"><input name="approve" type="checkbox" value="yes" /><span>{m.approve}</span></label>
          <Button disabled={pending}>{m.save}</Button>
          <Feedback state={state} m={m} />
        </form>
      </CardContent>
    </Card>
  );
}

function CenterForm({ locale, orgId, m, keyValue }: { locale: "fr" | "ar"; orgId: string; m: Messages; keyValue: string }) {
  const [state, action, pending] = useActionState(createCostCenter, idle);
  return (
    <Card>
      <CardHeader><CardTitle>{m.newCenter}</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <Hidden locale={locale} orgId={orgId} keyValue={keyValue} />
          <Field label={m.code}><Input name="centerCode" pattern="[A-Z][A-Z0-9_-]+" required /></Field>
          <Field label={m.nameFr}><Input name="nameFr" required /></Field>
          <Field label={m.nameAr}><Input name="nameAr" dir="rtl" required /></Field>
          <Field label={m.reason}><Input name="changeReason" required minLength={3} /></Field>
          <Button disabled={pending}>{m.save}</Button>
          <Feedback state={state} m={m} />
        </form>
      </CardContent>
    </Card>
  );
}

function AllocationForm({ locale, orgId, projects, tasks, contracts, targets, targetsStatus, targetsTruncated, invoiceError, budgets, centers, m, keyValue }: { locale: "fr" | "ar"; orgId: string; projects: Portfolio["projects"]; tasks: Portfolio["tasks"]; contracts: Portfolio["contracts"]; targets: NonNullable<Portfolio["allocationTargets"]>; targetsStatus: "success" | "partial" | "unavailable"; targetsTruncated: boolean; invoiceError?: "FORBIDDEN" | "UNAVAILABLE" | "INVALID_RESPONSE"; budgets: Portfolio["budgets"]; centers: Portfolio["costCenters"]; m: Messages; keyValue: string }) {
  const [state, action, pending] = useActionState(recordAllocation, idle);
  return (
    <Card>
      <CardHeader><CardTitle>{m.newAllocation}</CardTitle><CardDescription>{m.referenceHelp}</CardDescription></CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3">
          <Hidden locale={locale} orgId={orgId} keyValue={keyValue} />
          <Select name="budgetId" label={m.budgets}>{budgets.map((item) => <option key={item.id} value={item.id}>{item.fiscalYear} · {exactMoney(item.amountMinor, item.currency)}</option>)}</Select>
          <Select name="costCenterId" label={m.center}>{centers.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</Select>
          <Select name="projectId" label={m.project} required={false}><option value="">{m.none}</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</Select>
          <Select name="allocationType" label={m.allocationType}><option value="COMMITMENT">{locale === "ar" ? "التزام" : "Engagement"}</option><option value="ACTUAL">{locale === "ar" ? "نفقة فعلية" : "Dépense réalisée"}</option><option value="RELEASE">{locale === "ar" ? "تحرير الالتزام" : "Libération d’engagement"}</option></Select>
          {targetsStatus === "unavailable" ? <p role="alert">{locale === "ar" ? "تعذر تحميل الملفات المتاحة للتخصيص. أعيدوا تحميل الصفحة." : "Les dossiers disponibles pour l’allocation n’ont pas pu être chargés. Rechargez la page."}</p> : null}
          {targetsTruncated ? <p role="status">{locale === "ar" ? "الاختيار محدود بأول 100 ملف من كل نوع. لا تعرض هذه القائمة جميع الملفات." : "Sélection limitée aux 100 premiers dossiers de chaque type. Cette liste n’est pas exhaustive."}</p> : null}
          {invoiceError ? <p role="alert">{invoiceError === "FORBIDDEN" ? (locale === "ar" ? "لا تتيح صلاحياتكم اختيار الفواتير في هذا السياق." : "Vos habilitations ne permettent pas de sélectionner des factures dans ce contexte.") : (locale === "ar" ? "اختيار الفواتير غير متاح مؤقتاً. تبقى الملفات الأخرى متاحة؛ أعيدوا التحميل للمحاولة مجدداً." : "La sélection des factures est momentanément indisponible. Les autres dossiers restent utilisables ; rechargez pour réessayer.")}</p> : null}
          <Select name="referenceChoice" label={m.referenceType}>
            <option value="MANUAL">{locale === "ar" ? "تسجيل يدوي مبرر" : "Saisie manuelle justifiée"}</option>
            <optgroup label={m.projects}>{projects.map(item => <option key={item.id} value={`PROJECT:${item.id}`}>{item.code} · {nameOf(locale, item.nameFr, item.nameAr)}</option>)}</optgroup>
            <optgroup label={m.tasks}>{tasks.map(item => <option key={item.id} value={`PROJECT_TASK:${item.id}`}>{item.key} · {nameOf(locale, item.titleFr, item.titleAr)}</option>)}</optgroup>
            <optgroup label={m.contracts}>{contracts.map(item => <option key={item.id} value={`CONTRACT:${item.id}`}>{m.contracts} · {item.id.slice(0, 8)} · v{item.version}</option>)}</optgroup>
            {targets.map(item => <option key={`${item.type}:${item.id}`} value={`${item.type}:${item.id}`}>{nameOf(locale, item.labelFr, item.labelAr)}</option>)}
          </Select>
          <Field label={m.amount}><Input name="amount" inputMode="decimal" dir="ltr" required /></Field>
          <Field label={m.evidence}><Input name="evidenceFile" type="file" accept="application/pdf,image/png,image/jpeg" required /></Field>
          <Button disabled={pending || targetsStatus === "unavailable" || budgets.length === 0 || centers.length === 0}>{m.save}</Button>
          <Feedback state={state} m={m} />
        </form>
      </CardContent>
    </Card>
  );
}

function EventForm({ locale, orgId, projects, m, keyValue }: { locale: "fr" | "ar"; orgId: string; projects: Portfolio["projects"]; m: Messages; keyValue: string }) {
  const [state, action, pending] = useActionState(scheduleEvent, idle);
  return (
    <Card>
      <CardHeader><CardTitle>{m.newEvent}</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3 md:grid-cols-2">
          <Hidden locale={locale} orgId={orgId} keyValue={keyValue} />
          <Select name="projectId" label={m.project} required={false}><option value="">{m.none}</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</Select>
          <Select name="eventType" label={m.eventType}>{["CUSTOM", "PROJECT_DEADLINE", "APPROVAL", "DOCUMENT", "INVOICE", "MISSION", "RFQ"].map((item) => <option key={item} value={item}>{portfolioEventLabels[locale][item] ?? item}</option>)}</Select>
          <Field label={m.nameFr}><Input name="titleFr" required /></Field>
          <Field label={m.nameAr}><Input name="titleAr" dir="rtl" required /></Field>
          <Field label={m.start}><Input name="startsAt" type="datetime-local" required /></Field>
          <Field label={m.ends}><Input name="endsAt" type="datetime-local" /></Field>
          <Button disabled={pending} className="md:col-span-2">{m.save}</Button>
          <Feedback state={state} m={m} />
        </form>
      </CardContent>
    </Card>
  );
}
