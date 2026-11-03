import { randomUUID } from "node:crypto";
import { loadDisputeDecisionContext } from "@/modules/shared/lib/dispute-economics/server";
import{AdminDecisionHistory}from"@/modules/admin/screens/history/panel";
import { adminPillCode, filterAdminRows } from "@/modules/admin/data/spaces/filters";
import Link from "next/link";
import{AdminConversationMessages}from"@/modules/admin/screens/conversations/messages";
import {
  ArrowRight, Download, Eye, MoreHorizontal, Pencil, Plus, Search, ShieldAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { ActorIntentForm } from "@/modules/admin/screens/spaces/actor-forms";
import type { AdminSpaceId } from "@/modules/admin/data/spaces/admin-nav";
import {
  dataColumns,
  decisionChoices,
  decisionGuards,
  detailNote,
  spaceDetailCards,
  spaceLayoutFamily,
  spaceSectionCards,
  wizardFields,
} from "@/modules/admin/data/spaces/layout-blueprint";
import { spaceHref, spaceSpec, statusTone, type SpaceSpec } from "@/modules/admin/data/spaces/screen-catalog";
import type { SpaceRow } from "@/modules/admin/data/spaces/space-data";
import { PipelineGlyph } from "./pipeline-step";
import {
  CompanyDecisionForm,
  DocumentDecisionForm,
  DisputeDecisionForm,
  GovernanceDecisionForm,
  QualificationDecisionForm,
  SpaceMutationForm,
  SpaceSensitiveActions,
} from "./space-forms";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function t(locale: Locale, fr: string, ar: string) {
  return locale === "ar" ? ar : fr;
}

function Cta({ href, children, tone = "ghost", download = false }: { href: string; children: ReactNode; tone?: "ghost" | "primary" | "soft" | "white"; download?: boolean }) {
  const className = tone === "primary" ? "admin-primary-cta" : tone === "soft" ? "admin-soft-cta" : tone === "white" ? "admin-dir-action" : "client-ghost-link";
  if (download) return <a href={href} className={className} data-tone={tone === "white" ? "white" : undefined}>{children}</a>;
  return <Link href={href} className={className} data-tone={tone === "white" ? "white" : undefined}>{children}</Link>;
}

export function SpaceQueueBoard({
  locale,
  query,
  space,
  rows,
  treat,
  search,
  vue,
  children,
}: {
  locale: Locale;
  query: string;
  space: AdminSpaceId;
  rows: SpaceRow[];
  treat: SpaceRow[];
  search?: string;
  vue?: string;
  children?: ReactNode;
}) {
  const spec = spaceSpec(space);
  const family = spaceLayoutFamily(space);
  const pills = spec.pills(locale);
  const pipeline = spec.pipeline(locale);
  const columns = dataColumns(spec.columns(locale));
  const orgId = query.includes("organizationId=") ? new URLSearchParams(query.replace("?", "")).get("organizationId") : null;
  const statuses = [...new Set(rows.map((row) => row.status).filter(Boolean))];
  const visibleRows = filterAdminRows(rows, space, vue, search);
  const visibleTreat=filterAdminRows(treat,space,vue,search);
  const pillHref = (_pill: string, index: number) => {
    if(space==="messagerie"&&index===6)return spaceHref(locale,space,query,"preferences");
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    void _pill;
    const code = adminPillCode(space, index);
    if (!code) params.delete("vue");
    else params.set("vue", code);
    if(search)params.set("q",search);
    const qs = params.toString();
    return `/${locale}/administration/${space}${qs ? `?${qs}` : ""}`;
  };
  return (
    <main className="client-page" data-admin-layout="queue" data-admin-space={space} data-admin-family={family.list}>
      <section className="admin-two">
        <article className="client-card">
          {pills.length ? (
            <nav className="admin-pills" aria-label={spec.title(locale)}>
              {pills.map((pill, index) => (
                <Link key={pill} href={pillHref(pill, index)} aria-current={(!adminPillCode(space, index) && !vue) || vue === adminPillCode(space, index) ? "page" : undefined}>{pill}</Link>
              ))}
            </nav>
          ) : null}
          <form className="admin-filters" method="get" action={`/${locale}/administration/${space}`}>
            {orgId ? <input type="hidden" name="organizationId" value={orgId} /> : null}
            {statuses.length > 0 ? (
              <label>{t(locale, "Statut", "الحالة")}
                <select name="vue" defaultValue={vue ?? ""}>
                  <option value="">{t(locale, "Tous", "الكل")}</option>
                  {vue&&!statuses.includes(vue)?<option value={vue}>{pills.find((_,index)=>adminPillCode(space,index)===vue)??vue}</option>:null}
                  {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            ) : vue ? <input type="hidden" name="vue" value={vue} /> : null}
            <label className="client-top-search">
              <Search className="size-4" aria-hidden />
              <span className="sr-only">{spec.search(locale)}</span>
              <input name="q" defaultValue={search} placeholder={spec.search(locale)} />
            </label>
            <button type="submit" className="admin-soft-cta">{t(locale, "Filtrer", "تصفية")}</button>
            <Link href={`/${locale}/administration/${space}${orgId ? `?organizationId=${orgId}` : ""}`} className="client-ghost-link">{t(locale, "Réinitialiser les filtres", "إعادة تعيين عوامل التصفية")}</Link>
          </form>
          <p role="status">{visibleRows.length} {t(locale,"résultats filtrés","نتائج مصفاة")}</p>
          {visibleRows.length === 0 ? null : (
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead>
                  <tr>
                    {columns.map((column) => <th key={column}>{column}</th>)}
                    <th>{t(locale, "Actions", "إجراءات")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id}>
                      {columns.map((column, index) => (
                        <td key={`${row.id}-${column}`}>
                          {index === 0 ? (
                            <Link href={row.href}><strong>{row.title}</strong></Link>
                          ) : columnLooksLikeStatus(column) ? (
                            <span className="client-status-chip" data-tone={statusTone(row.cells[index] ?? row.status)}>{row.cells[index] ?? "—"}</span>
                          ) : (row.cells[index] ?? "—")}
                        </td>
                      ))}
                      <td>
                        <RowMenu locale={locale} query={query} space={space} row={row} resourceType={spec.resourceType} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {visibleRows.length === 0 ? (
            <div className="admin-empty-card">
              <h3>{spec.empty(locale)}</h3>
              <div className="admin-empty-actions">
                <Link href={`/${locale}/administration/${space}${query}`} className="client-ghost-link">{t(locale, "Réinitialiser les filtres", "إعادة تعيين عوامل التصفية")}</Link>
                {spec.createLabel ? <Cta href={spaceHref(locale, space, query, spec.createView)} tone="primary">{spec.createLabel(locale)}</Cta> : null}
              </div>
            </div>
          ) : null}
        </article>
        <aside className="client-stack">
          <article className="client-card admin-treat-rail">
            <header className="client-priority-head">
              <div>
                <h2><ShieldAlert className="size-4" aria-hidden /> {spec.treatTitle(locale)}</h2>
              </div>
            </header>
            {visibleTreat.length === 0 ? <p className="client-access-note">{t(locale, "Aucun élément prioritaire.", "لا يوجد عنصر ذو أولوية.")}</p> : (
              <ul className="admin-treat">
                {visibleTreat.slice(0, 6).map((row) => (
                  <li key={row.id}>
                    <span>
                      <strong>{row.title}</strong>
                      <small>{row.status}</small>
                    </span>
                    <Link href={row.href}>{t(locale, "Ouvrir", "فتح")}</Link>
                  </li>
                ))}
              </ul>
            )}
            <Cta href={`/${locale}/administration/${space}${query}`}>{t(locale, "Voir tout", "عرض الكل")}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Cta>
          </article>
          {family.list === "parcours-cycle" && pipeline.length ? (
            <article className="client-card">
              <header><h2>{spec.cycleTitle(locale)}</h2></header>
              <ol className="admin-cycle">
                {pipeline.map((step, index) => (
                  <li key={step.label}>
                    <PipelineGlyph index={index} tone={step.tone} />
                    <div><strong>{index + 1}. {step.label}</strong><small>{step.hint}</small></div>
                  </li>
                ))}
              </ol>
            </article>
          ) : null}
          <article className="admin-note">
            <p>{detailNote(locale, space)}</p>
          </article>
        </aside>
      </section>
      {family.list === "actor-pipeline" && pipeline.length ? (
        <article className="client-card">
          <h2>{spec.cycleTitle(locale)}</h2>
          <ol className="admin-pipeline" data-count={String(pipeline.length)}>
            {pipeline.map((step, index) => (
              <li key={step.label}>
                <PipelineGlyph index={index} tone={step.tone} />
                <strong>{step.label}</strong>
                <small>{step.hint}</small>
              </li>
            ))}
          </ol>
        </article>
      ) : null}
      {children}
    </main>
  );
}

function columnLooksLikeStatus(column: string) {
  return /état|statut|state|حالة|status|qualification|conformité|risque|validation/i.test(column);
}

function RowMenu({ locale, query, space, row, resourceType }: { locale: Locale; query: string; space: AdminSpaceId; row: SpaceRow; resourceType: string }) {
  const examineHref = decisionHref(locale, space, query, row);
  return (
    <details className="admin-row-menu">
      <summary aria-label={t(locale, "Actions", "إجراءات")}><MoreHorizontal className="size-4" /></summary>
      <div>
        <Link href={row.href}><Eye className="size-3.5" aria-hidden />{t(locale, "Consulter", "عرض")}</Link>
        <Link href={spaceHref(locale, space, query, row.id, "modifier")}><Pencil className="size-3.5" aria-hidden />{t(locale, "Modifier", "تعديل")}</Link>
        <Link href={examineHref}><Search className="size-3.5" aria-hidden />{t(locale, "Examiner", "معاينة")}</Link>
        <ActorIntentForm locale={locale} organizationId={row.organizationId} resourceId={row.id} resourceType={resourceType} intent="SUSPEND_ENTITY" reason="Suspension demandée depuis la liste d’administration." label={t(locale, "Suspendre", "تعليق")} />
        <ActorIntentForm locale={locale} organizationId={row.organizationId} resourceId={row.id} resourceType={resourceType} intent="RESTRICT_ENTITY" reason="Restriction / archivage demandé depuis la liste d’administration. Aucune suppression définitive." label={t(locale, "Archiver", "أرشفة")} tone="danger" />
      </div>
    </details>
  );
}

function decisionHref(locale: Locale, space: AdminSpaceId, query: string, row: SpaceRow) {
  if (space === "qualification") return spaceHref(locale, space, query, row.id, "decision");
  if (space === "gouvernance") return spaceHref(locale, space, query, row.id, "decision");
  if (space === "diagnostics") return spaceHref(locale, space, query, row.id, "revue");
  if (space === "matching") return spaceHref(locale, space, query, row.id, "consultation");
  if (space === "litiges") return spaceHref(locale, space, query, row.id, "decision");
  if (space === "jalons") return spaceHref(locale, space, query, row.id, "revue");
  if (space === "contrats") return spaceHref(locale, space, query, row.id, "activation");
  if (space === "avenants") return spaceHref(locale, space, query, row.id, "activer");
  if (space === "missions") return spaceHref(locale, space, query, row.id, "cycle");
  if (space === "documents") return spaceHref(locale, space, query, row.id, "reutilisation");
  return row.href;
}

export function SpaceHeaderActions({ locale, query, spec }: { locale: Locale; query: string; spec: SpaceSpec }) {
  return (
    <>
      {spec.id === "territoires" ? <Cta href={spaceHref(locale, "gouvernance", query)} tone="soft">{t(locale, "Validations", "المصادقات")}</Cta> : null}
      {spec.createLabel && spec.createView ? (
        <Cta href={spaceHref(locale, spec.id, query, spec.createView)} tone="primary"><Plus className="size-4" aria-hidden />{spec.createLabel(locale)}</Cta>
      ) : null}
      {spec.exportable ? (
        <Cta href={`/${locale}/administration/export/${spec.id}${query}`} tone="white" download><Download className="size-4" aria-hidden />{t(locale, "Exporter les résultats filtrés", "تصدير النتائج المصفاة")}</Cta>
      ) : null}
      {spec.id === "devis" ? <Cta href={spaceHref(locale, spec.id, query, "comparer")} tone="soft">{t(locale, "Comparer", "مقارنة")}</Cta> : null}
      {spec.id === "diagnostics" ? <Cta href={`/${locale}/administration/operations${query}`} tone="soft">{t(locale, "Archiver / restaurer", "أرشفة / استعادة")}</Cta> : null}
    </>
  );
}

export function SpaceDetailBoard({
  locale,
  query,
  space,
  row,
  children,
}: {
  locale: Locale;
  query: string;
  space: AdminSpaceId;
  row: SpaceRow;
  children?: ReactNode;
}) {
  const spec = spaceSpec(space);
  const family = spaceLayoutFamily(space);
  const tabs = spec.tabs(locale);
  const kpis = spaceDetailCards(locale, space, row);
  const sections = spaceSectionCards(locale, space, row);
  return (
    <main className="client-page" data-admin-layout="detail" data-admin-space={space} data-admin-family={family.detail}>
      <nav className="admin-pills" aria-label={spec.title(locale)}>
        {tabs.map((tab, index) => (
          <a key={tab} href={`#${tab}`} aria-current={index === 0 ? "page" : undefined}>{tab}</a>
        ))}
      </nav>
      {family.detail === "thread" ? (
        <ConversationLayout locale={locale} query={query} space={space} row={row} />
      ) : family.detail === "document" ? (
        <DocumentLayout locale={locale} query={query} space={space} row={row} />
      ) : (
        <>
          <section className="admin-kpi-strip" data-count={String(kpis.length)}>
            {kpis.map((card) => (
              <article key={card.title} className="client-card" data-tone={card.tone}>
                <header><h2>{card.title}</h2></header>
                <p><strong>{card.items[0]?.value}</strong></p>
                {card.items[1] ? <small>{card.items[1].label}</small> : null}
              </article>
            ))}
          </section>
          <section className="admin-fiche-lower">
            {sections.map((card) => (
              <article key={card.title} className="client-card" data-tone={card.tone}>
                <header className="client-priority-head"><h2>{card.title}</h2></header>
                <dl className="admin-dl">
                  {card.items.map((item) => (
                    <div key={`${card.title}-${item.label}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                  ))}
                </dl>
              </article>
            ))}
          </section>
        </>
      )}
      <section className="admin-two">
        <article className="client-card">
          <header><h2>{t(locale, "Actions", "إجراءات")}</h2></header>
          <div className="client-offer-actions">
            <Cta href={spaceHref(locale, space, query, row.id, "modifier")} tone="soft"><Pencil className="size-4" aria-hidden />{t(locale, "Modifier", "تعديل")}</Cta>
            <Cta href={decisionHref(locale, space, query, row)} tone="primary"><Eye className="size-4" aria-hidden />{t(locale, "Examiner", "معاينة")}</Cta>
          </div>
        </article>
        <SpaceSensitiveActions locale={locale} organizationId={row.organizationId} resourceId={row.id} resourceType={spec.resourceType} />
      </section>
      <p className="admin-note">{detailNote(locale, space)}</p>
      {children}
    </main>
  );
}

function ConversationLayout({ locale, query, space, row }: { locale: Locale; query: string; space: AdminSpaceId; row: SpaceRow }) {
  if(row.extras?.kind==="NOTIFICATION")return <article className="client-card"><h2>{row.title}</h2><p>{row.status}</p><p>{t(locale,"Tentatives","المحاولات")} : {row.extras.attemptCount}</p>{row.extras.errorCode?<p>{t(locale,"Erreur de livraison","خطأ التسليم")} : {row.extras.errorCode}</p>:null}<p>{row.cells[3]} · {row.cells[4]}</p></article>;
  return (
    <section className="admin-two">
      <article className="client-card">
        <header><h2>{t(locale, "Conversation du dossier", "محادثة الملف")}</h2></header>
        <AdminConversationMessages threadId={row.id} locale={locale} initial={row.conversation}/>
      </article>
      <aside className="client-stack">
        <article className="client-card">
          <h2>{t(locale, "Participants", "المشاركون")}</h2>
          <p>{row.cells[1] ?? row.title}</p>
          <Cta href={row.organizationId ? `/${locale}/administration/entreprises/${row.organizationId}${query}` : row.href}>{t(locale, "Ouvrir la fiche liée", "فتح البطاقة المرتبطة")}</Cta>
        </article>
        <article className="client-card">
          <h2>{t(locale, "Contexte", "السياق")}</h2>
          <p>{row.cells[2] ?? spaceSpec(space).title(locale)}</p>
        </article>
      </aside>
    </section>
  );
}

function DocumentLayout({ locale, query, space, row }: { locale: Locale; query: string; space: AdminSpaceId; row: SpaceRow }) {
  const spec = spaceSpec(space);
  const columns = dataColumns(spec.columns(locale));
  return (
    <section className="admin-two">
      <article className="client-card">
        <header><h2>{t(locale, "Aperçu et versions", "المعاينة والنسخ")}</h2></header>
        <div className="admin-doc-preview">{row.title}</div>
        <div className="client-table-wrap">
          <table className="client-space-table">
            <thead>
              <tr>
                <th>{t(locale, "Version", "النسخة")}</th>
                <th>{t(locale, "Type", "النوع")}</th>
                <th>{t(locale, "État", "الحالة")}</th>
                <th>{t(locale, "Expiration", "الانتهاء")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{row.extras?.version ?? "1"}</td>
                <td>{row.extras?.kind ?? columns[2] ?? "—"}</td>
                <td><span className="client-status-chip" data-tone={row.tone}>{row.status}</span></td>
                <td>{row.cells[6] ?? row.cells[4] ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
      <aside className="client-stack">
        <article className="client-card">
          <h2>{t(locale, "Métadonnées", "البيانات")}</h2>
          <dl className="admin-dl">
            {columns.slice(0, 6).map((column, index) => (
              <div key={column}><dt>{column}</dt><dd>{row.cells[index] ?? "—"}</dd></div>
            ))}
          </dl>
          <Cta href={spaceHref(locale, space, query, row.id, "reutilisation")} tone="soft">{t(locale, "Réutilisation et partage", "إعادة الاستخدام والمشاركة")}</Cta>
        </article>
      </aside>
    </section>
  );
}

export async function SpaceDecisionBoard({
  locale,
  query,
  space,
  row,
}: {
  locale: Locale;
  query: string;
  space: AdminSpaceId;
  row: SpaceRow;
}) {
  const spec = spaceSpec(space);
  const family = spaceLayoutFamily(space);
  const kpis = spaceDetailCards(locale, space, row).slice(0, 3);
  const choices = decisionChoices(locale, space);
  const guards = decisionGuards(locale, space);
  const pipeline = spec.pipeline(locale);
  const decisionContext = family.decision === "dispute" ? await loadDisputeDecisionContext(row.id) : null;
  return (
    <main className="client-page" data-admin-layout="decision" data-admin-space={space} data-admin-family={family.decision}>
      <section className="admin-kpi-strip" data-count={String(kpis.length)}>
        {kpis.map((card) => (
          <article key={card.title} className="client-card" data-tone={card.tone}>
            <header><h2>{card.title}</h2></header>
            <dl className="admin-dl">
              {card.items.slice(0, 1).map((item) => (
                <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
              ))}
            </dl>
          </article>
        ))}
      </section>
      {family.decision === "dispute" ? (
        <section className="admin-two">
          <article className="client-card">
            <header><h2>{t(locale, "Décision sur le litige", "القرار بشأن النزاع")}</h2></header>
            <DisputeDecisionForm locale={locale} query={query} caseId={row.id} context={decisionContext!} commandKey={randomUUID()} />
          </article>
          <aside className="client-stack">
            <article className="admin-banner" data-tone="danger">
              <strong>{t(locale, "Décision irréversible", "قرار غير قابل للتراجع")}</strong>
              <p>{t(locale, "Une fois soumise et approuvée, la décision est immuable.", "بعد الإرسال والمصادقة يصبح القرار غير قابل للتعديل.")}</p>
            </article>
            <article className="client-card">
              <header><h2>{t(locale, "Plan de réaffectation contrôlée", "خطة إعادة التعيين المراقبة")}</h2></header>
              <ol className="admin-cycle">
                {pipeline.map((step, index) => (
                  <li key={step.label}>
                    <PipelineGlyph index={index} tone={step.tone} />
                    <div><strong>{index + 1}. {step.label}</strong><small>{step.hint}</small></div>
                  </li>
                ))}
              </ol>
            </article>
          </aside>
        </section>
      ) : (
        <section className="admin-form-layout">
          <div className="client-stack">
            {space === "qualification" ? (
              <QualificationDecisionForm locale={locale} query={query} qualificationId={row.id} organizationId={row.organizationId} />
            ) : space === "gouvernance" ? (
              <GovernanceDecisionForm locale={locale} query={query} approvalRequestId={row.id} rowVersion={row.extras?.rowVersion ?? "1"} />
            ) : space === "providers" ? (
              <CompanyDecisionForm locale={locale} organizationId={row.organizationId ?? row.id} rowVersion={row.extras?.rowVersion ?? "1"} partnerStatus={row.extras?.partner ?? "PENDING"} />
            ) : space === "documents" || space === "capacite" ? (
              <DocumentDecisionForm locale={locale} documentVersionId={row.id} />
            ) : (
              <DecisionForm locale={locale} query={query} space={space} row={row} choices={choices} />
            )}
          </div>
          <aside className="client-stack">
            {guards.map((guard) => (
              <article key={guard.title} className="admin-banner" data-tone={guard.tone}>
                <strong>{guard.title}</strong>
                <p>{guard.body}</p>
              </article>
            ))}
            <article className="client-card">
              <h2>{t(locale, "Historique des décisions", "تاريخ القرارات")}</h2>
              <AdminDecisionHistory resourceId={row.id}organizationId={row.organizationId}locale={locale}initial={row.historyPage}/>
            </article>
            <SpaceSensitiveActions locale={locale} organizationId={row.organizationId} resourceId={row.id} resourceType={spec.resourceType} />
          </aside>
        </section>
      )}
    </main>
  );
}

function DecisionForm({
  locale,
  query,
  space,
  row,
  choices,
}: {
  locale: Locale;
  query: string;
  space: AdminSpaceId;
  row: SpaceRow;
  choices: ReturnType<typeof decisionChoices>;
}) {
  const spec = spaceSpec(space);
  return (
    <SpaceMutationForm
      locale={locale}
      query={query}
      space={space}
      itemId={row.id}
      organizationId={row.organizationId}
      resourceType={spec.resourceType}
      title={t(locale, "Votre décision", "قرارك")}
      submitLabel={t(locale, "Soumettre la décision", "إرسال القرار")}
      fields={
        <div className="admin-field" data-span="2">
          <div className="admin-radio-row" data-cards="true">
          {choices.map((choice) => (
            <label key={choice.value} data-tone={choice.tone}>
              <input type="radio" name="decision" value={choice.value} defaultChecked={choice.value === "APPROVE" || choice.value === "START"} />
              <strong>{choice.label}</strong>
              <small>{choice.hint}</small>
            </label>
          ))}
          </div>
        </div>
      }
    />
  );
}

export function SpaceWizardBoard({
  locale,
  query,
  space,
}: {
  locale: Locale;
  query: string;
  space: AdminSpaceId;
}) {
  const spec = spaceSpec(space);
  const steps = spec.pipeline(locale);
  const fields = wizardFields(locale, space);
  return (
    <main className="client-page admin-form-layout" data-admin-layout="wizard" data-admin-space={space}>
      <section className="client-stack">
        {steps.length ? (
          <ol className="admin-pipeline" data-count={String(steps.length)}>
            {steps.map((step, index) => (
              <li key={step.label} data-current={index === 0 ? "true" : undefined}>
                <PipelineGlyph index={index} tone={step.tone} />
                <strong>{index + 1}. {step.label}</strong>
                <small>{step.hint}</small>
              </li>
            ))}
          </ol>
        ) : null}
        <SpaceMutationForm
          locale={locale}
          query={query}
          space={space}
          itemId={crypto.randomUUID()}
          resourceType={spec.resourceType}
          title={spec.createLabel?.(locale) ?? spec.title(locale)}
          submitLabel={t(locale, "Soumettre à validation", "إرسال للمصادقة")}
          fields={
            <>
              {fields.map((field) => (
                <div key={field.id} className="admin-field" data-span={field.multiline ? "2" : undefined}>
                  <label htmlFor={field.id}>{field.label}{field.required ? " *" : ""}</label>
                  {field.multiline ? (
                    <textarea id={field.id} name={field.name} required={field.required} minLength={3} defaultValue={field.value} />
                  ) : (
                    <input id={field.id} name={field.name} required={field.required} minLength={3} defaultValue={field.value} />
                  )}
                </div>
              ))}
              <div className="admin-field">
                <label htmlFor={`${space}-view`}>{t(locale, "Vue", "العرض")}</label>
                <input id={`${space}-view`} name="view" defaultValue={spec.createView ?? "nouvelle"} readOnly />
              </div>
            </>
          }
        />
      </section>
      <aside className="client-stack">
        <article className="client-card">
          <h2>{t(locale, "Résumé", "ملخص")}</h2>
          <p>{spec.lead(locale)}</p>
        </article>
        <article className="admin-note">
          <p>{detailNote(locale, space)}</p>
        </article>
      </aside>
    </main>
  );
}

export function SpaceCompareBoard({
  locale,
  query,
  space,
  rows,
}: {
  locale: Locale;
  query: string;
  space: AdminSpaceId;
  rows: SpaceRow[];
}) {
  const spec = spaceSpec(space);
  const offers = rows.slice(0, 3);
  const columns = dataColumns(spec.columns(locale)).slice(0, 8);
  return (
    <main className="client-page" data-admin-layout="compare" data-admin-space={space}>
      <article className="admin-banner" data-tone="sky">
        <strong>{t(locale, "La décision appartient au client.", "القرار يعود للعميل.")}</strong>
        <p>{t(locale, "Cette comparaison est un support d’aide. Vérifiez l’équivalence des périmètres avant de conclure.", "هذه المقارنة أداة مساعدة. تحقق من تكافؤ النطاقات قبل الحسم.")}</p>
      </article>
      <div className="client-table-wrap">
        <table className="client-space-table">
          <thead>
            <tr>
              <th>{t(locale, "Critères de comparaison", "معايير المقارنة")}</th>
              {offers.map((row, index) => <th key={row.id}>{t(locale, `Offre ${String.fromCharCode(65 + index)}`, `العرض ${String.fromCharCode(65 + index)}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {columns.map((column, index) => (
              <tr key={column}>
                <th>{column}</th>
                {offers.map((row) => <td key={`${row.id}-${column}`}>{row.cells[index] ?? "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="client-offer-actions">
        {offers[0] ? <Cta href={offers[0].href}>{t(locale, "Voir le détail", "عرض التفاصيل")}</Cta> : null}
        <Cta href={spaceHref(locale, space, query)}>{t(locale, "Retour à la liste", "العودة إلى القائمة")}</Cta>
        <SpaceMutationForm
          locale={locale}
          query={query}
          space={space}
          itemId={offers[0]?.id ?? crypto.randomUUID()}
          organizationId={offers[0]?.organizationId}
          resourceType={spec.resourceType}
          title={t(locale, "Confirmer le choix", "تأكيد الاختيار")}
          submitLabel={t(locale, "Confirmer le choix avec récapitulatif", "تأكيد الاختيار مع الملخص")}
        />
      </div>
    </main>
  );
}
