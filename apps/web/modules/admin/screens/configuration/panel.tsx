"use client";

import { useActionState, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronRight, CreditCard, FileSignature, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { sectionFields, type ConfigurationActionState } from "@/modules/shared/lib/platform-configuration/model";
import { managePlatformConfiguration } from "./actions";
import { actionMessage, configurationCopy, environmentLabel, sectionCopy } from "./copy";
import { activeRevision, clearSecretFields, configurationProgress, displayTimestamp, editableRevision, mayReview, probeFresh, visibleFieldValue, type ConfigurationDashboardView, type ConfigurationRevision, type ConfigurationSection, type ConfigurationSectionData } from "./view-model";

const control = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-50";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-800";
const card = "min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900";
const defaults: Record<string, string> = { country: "MA", currency: "MAD", defaultLocale: "fr", timezone: "Africa/Casablanca", PAYPAL_ENV: "sandbox", YOUSIGN_ENVIRONMENT: "sandbox" };
const sectionIcons = { COMPANY: Building2, RESEND: Mail, PAYPAL: CreditCard, YOUSIGN: FileSignature, SCANNER: ShieldCheck };

function useConfigurationCommand(locale: Locale, initialIntent: string, formId: string) {
  const [state, action, pending] = useActionState(managePlatformConfiguration, { status: "idle" } as ConfigurationActionState);
  const [intent, setIntent] = useState(initialIntent);
  const router = useRouter();
  useEffect(() => {
    if (!pending && state.status !== "idle") {
      const form = document.getElementById(formId);
      clearSecretFields(form instanceof HTMLFormElement ? form : null);
      document.getElementById(`${formId}-notice`)?.focus();
      if (state.status === "success") router.refresh();
    }
  }, [state, pending, router, formId]);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.value) setIntent(submitter.value);
  }
  const notice = <p id={`${formId}-notice`} tabIndex={-1} role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={`min-h-6 rounded-lg text-sm outline-none ${state.status === "error" ? "text-red-800 dark:text-red-300" : "text-blue-800 dark:text-blue-200"}`}>{actionMessage(state.status, state.reason, intent, locale)}</p>;
  return { state, action, pending, formId, onSubmit, notice };
}

function Hidden({ locale, section, keyValue, revision }: { locale: Locale; section: ConfigurationSection; keyValue: string; revision?: ConfigurationRevision }) {
  return <><input type="hidden" name="locale" value={locale}/><input type="hidden" name="section" value={section}/><input type="hidden" name="idempotencyKey" value={keyValue}/>{revision ? <><input type="hidden" name="revisionId" value={revision.id}/><input type="hidden" name="contentHash" value={revision.content_hash}/></> : null}</>;
}
function SectionStatus({ value, locale }: { value: ConfigurationRevision["status"] | null; locale: Locale }) {
  const c = configurationCopy(locale), text = value === "ACTIVE" ? c.active : value === "DRAFT" ? c.draft : value === "REJECTED" ? c.rejected : value === "RETIRED" ? c.retired : c.missing;
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${value === "ACTIVE" ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"}`}>{text}</span>;
}
function Field({ section, field, settings, saved, locale, disabled, onChange }: { section: ConfigurationSection; field: (typeof sectionFields)[ConfigurationSection][number]; settings: Record<string, string>; saved: boolean; locale: Locale; disabled: boolean; onChange: (key: string, value: string) => void }) {
  const c = configurationCopy(locale), id = `configuration-${section}-${field.key}`, label = locale === "fr" ? field.labelFr : field.labelAr;
  const required = field.required && !(field.secret && saved), name = `${field.secret ? "secret" : "settings"}:${field.key}`;
  const common = { id, name, required, disabled, className: control, "aria-describedby": field.secret ? `${id}-hint` : undefined };
  const selected = visibleFieldValue(settings, field, defaults);
  let input: ReactNode;
  if (field.key === "defaultLocale") input = <select {...common} value={selected} onChange={event => onChange(field.key, event.currentTarget.value)}><option value="fr">Français</option><option value="ar">العربية</option></select>;
  else if (field.key === "PAYPAL_ENV" || field.key === "YOUSIGN_ENVIRONMENT") input = <select {...common} value={selected} onChange={event => onChange(field.key, event.currentTarget.value)}><option value="sandbox">{locale === "fr" ? "Test · sandbox" : "اختبار · sandbox"}</option><option value="live">{locale === "fr" ? "Production · réel" : "الإنتاج · فعلي"}</option></select>;
  else if (field.secret) input = <input {...common} type="password" data-configuration-secret="true" autoComplete="new-password" spellCheck={false} dir="ltr" maxLength={field.key.includes("CERTIFICATE") ? 48000 : 4000}/>;
  else input = <input {...common} type={field.type === "email" || field.type === "url" || field.type === "tel" ? field.type : "text"} value={selected} onChange={event => onChange(field.key, event.currentTarget.value)} maxLength={field.key === "EMAIL_RECIPIENT_ALLOWLIST" ? 4000 : field.key === "address" ? 1000 : 500} dir={field.type === "email" || field.type === "url" || field.key.includes("URL") || field.key.includes("ID") ? "ltr" : undefined}/>;
  return <div className="min-w-0"><label htmlFor={id} className="text-sm font-semibold">{label}{required ? <span aria-hidden="true"> *</span> : null}</label>{input}{field.secret ? <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600 dark:text-slate-300">{saved ? `${c.secretSaved} · ${c.secretReplace}` : c.secretMissing}</p> : null}</div>;
}
function SectionEditor({ locale, section, keyValue, canWrite }: { locale: Locale; section: ConfigurationSectionData; keyValue: string; canWrite: boolean }) {
  const c = configurationCopy(locale), copy = sectionCopy(section.section, locale), Icon = sectionIcons[section.section], source = editableRevision(section), active = activeRevision(section);
  const command = useConfigurationCommand(locale, "save", `form-save-${section.section}`);
  const [settings, setSettings] = useState<Record<string, string>>(source?.settings ?? {}), [reason, setReason] = useState("");
  return <section id={`configuration-${section.section.toLowerCase()}`} aria-labelledby={`title-${section.section}`} className={`${card} scroll-mt-24`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-800 dark:bg-blue-950 dark:text-blue-200"><Icon aria-hidden="true" className="size-5"/></span><div className="min-w-0"><h3 id={`title-${section.section}`} className="text-lg font-semibold">{copy.title}</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{copy.lead}</p></div></div><SectionStatus value={source?.status ?? null} locale={locale}/></div>
    {active ? <p className="mt-3 text-sm text-emerald-900 dark:text-emerald-200">{c.current} · {displayTimestamp(active.approved_at ?? active.created_at)}</p> : null}
    {section.section === "COMPANY" ? <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{c.companyHint}</p> : <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 dark:bg-slate-800">{c.secretsHint}</p>}
    {command.notice}
    {command.state.status === "error" && section.section !== "COMPANY" ? <p className="text-sm leading-6">{c.secretCleared}</p> : null}
    <form id={command.formId} action={command.action} onSubmit={command.onSubmit} aria-busy={command.pending} className="mt-3 space-y-5">
      <Hidden locale={locale} section={section.section} keyValue={keyValue}/><input type="hidden" name="intent" value="save"/><input type="hidden" name="expectedActiveId" value={section.active_revision_id ?? ""}/>{source ? <><input type="hidden" name="sourceRevisionId" value={source.id}/><input type="hidden" name="sourceHash" value={source.content_hash}/></> : null}
      <fieldset disabled={command.pending || !canWrite}><legend className="sr-only">{copy.title}</legend><div className="grid min-w-0 gap-4 sm:grid-cols-2">{sectionFields[section.section].map(field => <Field key={field.key} section={section.section} field={field} settings={settings} saved={source?.secret_keys.includes(field.key) ?? false} locale={locale} disabled={!canWrite} onChange={(key, value) => setSettings(previous => ({ ...previous, [key]: value }))}/>)}</div></fieldset>
      {canWrite ? <><div><label className="text-sm font-semibold" htmlFor={`reason-${section.section}`}>{c.reason}</label><textarea id={`reason-${section.section}`} name="reason" value={reason} onChange={event => setReason(event.currentTarget.value)} required minLength={10} maxLength={2000} rows={2} className={control} disabled={command.pending} aria-describedby={`reason-help-${section.section}`}/><p id={`reason-help-${section.section}`} className="mt-1 text-xs text-slate-600 dark:text-slate-300">{c.reasonHelp}</p></div><div className="flex flex-wrap items-center gap-3"><button className={button} disabled={command.pending}>{command.pending ? c.saving : c.save}</button><p className="max-w-xl text-xs leading-5 text-slate-600 dark:text-slate-300">{c.saveHint}</p></div></> : <p className="text-sm">{c.readOnly}</p>}
    </form>
  </section>;
}
function RevisionReview({ locale, revision, data, keyValue, now }: { locale: Locale; revision: ConfigurationRevision; data: ConfigurationDashboardView; keyValue: string; now: number }) {
  const c = configurationCopy(locale), s = sectionCopy(revision.section, locale), command = useConfigurationCommand(locale, "test", `form-review-${revision.id}`), reviewer = mayReview(revision, data), fresh = probeFresh(revision, now), provider = revision.section !== "COMPANY";
  const [decisionReason, setDecisionReason] = useState("");
  const probeLabel = !revision.probe ? c.notTested : revision.probe.status === "FAIL" ? c.testFailed : fresh ? c.tested : c.staleTest;
  return <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
    <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">{s.title} · {displayTimestamp(revision.created_at)}</h4><SectionStatus value={revision.status} locale={locale}/></div>
    {provider ? <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800"><p className="font-medium">{probeLabel}</p>{revision.probe ? <><p>{c.checkedAt} : <bdi>{displayTimestamp(revision.probe.checked_at)}</bdi></p><p>{c.validUntil} : <bdi>{displayTimestamp(revision.probe.valid_until)}</bdi></p></> : null}<p className="mt-1 text-xs leading-5">{c.testHint}</p></div> : null}
    <details className="mt-3 text-sm"><summary className="cursor-pointer py-2 font-medium">{locale === "fr" ? "Examiner les paramètres de cette version" : "مراجعة إعدادات هذه النسخة"}</summary><dl className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-800">{sectionFields[revision.section].map(field => <div key={field.key} className="min-w-0"><dt className="font-semibold">{locale === "fr" ? field.labelFr : field.labelAr}</dt><dd className="break-words">{field.secret ? revision.secret_keys.includes(field.key) ? c.secretSaved : c.secretMissing : revision.settings[field.key] || "—"}</dd></div>)}</dl></details>
    {command.notice}
    {data.can_write && (revision.status === "DRAFT" || revision.status === "ACTIVE") ? <form id={command.formId} action={command.action} onSubmit={command.onSubmit} aria-busy={command.pending} className="mt-3 space-y-3">
      <Hidden locale={locale} section={revision.section} keyValue={keyValue} revision={revision}/>
      {provider ? <button name="intent" value="test" className={secondary} disabled={command.pending} formNoValidate>{c.test}</button> : null}
      {revision.status === "DRAFT" ? reviewer ? <><label htmlFor={`decision-${revision.id}`} className="block text-sm font-semibold">{c.decisionReason}<textarea id={`decision-${revision.id}`} name="reason" value={decisionReason} onChange={event => setDecisionReason(event.currentTarget.value)} required minLength={10} maxLength={2000} rows={2} className={control} disabled={command.pending}/></label><label className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" name="reviewConfirmed" required className="mt-1 size-5 shrink-0 accent-blue-700" disabled={command.pending}/><span>{c.confirmReview}</span></label><div className="flex flex-wrap gap-3"><button name="intent" value="approve" disabled={command.pending || provider && !fresh} className={button}>{c.approve}</button><button name="intent" value="reject" disabled={command.pending} className={secondary}>{c.reject}</button></div>{provider && !fresh ? <p className="text-sm text-amber-900 dark:text-amber-200">{c.probeRequired}</p> : null}</> : <p className="text-sm leading-6">{c.ownRevision}</p> : <><label htmlFor={`disable-${revision.id}`} className="block text-sm font-semibold">{c.decisionReason}<textarea id={`disable-${revision.id}`} name="reason" value={decisionReason} onChange={event => setDecisionReason(event.currentTarget.value)} required minLength={10} maxLength={2000} rows={2} className={control} disabled={command.pending}/></label><button name="intent" value="disable" className={secondary} disabled={command.pending}>{c.disable}</button></>}
    </form> : null}
  </article>;
}
function ModuleLinks({ locale, links }: { locale: Locale; links: [string, string, string][] }) {
  const c = configurationCopy(locale);
  return <ul className="mt-4 grid gap-3 sm:grid-cols-2">{links.map(([path, fr, ar]) => <li key={path}><Link href={`/${locale}/${path}`} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-600"><span className="min-w-0"><span className="block font-medium">{locale === "fr" ? fr : ar}</span><span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{c.unknown}</span></span><ChevronRight className={`size-4 shrink-0 ${locale === "ar" ? "rotate-180" : ""}`} aria-hidden="true"/></Link></li>)}</ul>;
}
export function ConfigurationPanel({ locale, data, keys, observedAt }: { locale: Locale; data: ConfigurationDashboardView; keys: Record<string, string>; observedAt: string }) {
  const c = configurationCopy(locale), progress = configurationProgress(data), router = useRouter(), now = Date.parse(observedAt);
  const company = data.sections.find(section => section.section === "COMPANY"), integrations = data.sections.filter(section => section.section !== "COMPANY"), revisions = data.sections.flatMap(section => section.revisions);
  const steps: [string, string][] = [["company", c.company], ["integrations", c.integrations], ["business", c.business], ["team", c.team], ["review", c.review]];
  return <div className="min-w-0 space-y-8" dir={locale === "ar" ? "rtl" : "ltr"}>
    <section className="overflow-hidden rounded-2xl border border-blue-800 bg-slate-950 p-5 text-white sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-blue-100">{c.environment} · {environmentLabel(data.environment, locale)}</p><h2 className="mt-2 text-xl font-semibold sm:text-2xl">{c.progress}</h2></div><p className="text-3xl font-semibold tabular-nums" aria-label={`${progress.active} / ${progress.total}`}><bdi>{progress.active} / {progress.total}</bdi></p></div><progress max={progress.total} value={progress.active} aria-label={c.progress} className="mt-5 h-2 w-full accent-blue-400"/><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">{c.progressHint}</p></section>
    <nav aria-label={c.stepsLabel} className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{steps.map(([id, label], index) => <a key={id} href={`#configuration-step-${id}`} className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:border-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-100">{index + 1}</span>{label}</a>)}</nav>
    <section id="configuration-step-company" className="scroll-mt-24 space-y-4"><h2 className="text-xl font-semibold">1. {c.company}</h2>{company ? <SectionEditor key={`COMPANY:${company.latest_revision_id}:${company.active_revision_id}`} locale={locale} section={company} keyValue={keys["save:COMPANY"]!} canWrite={data.can_write}/> : null}</section>
    <section id="configuration-step-integrations" className="scroll-mt-24 space-y-4"><h2 className="text-xl font-semibold">2. {c.connectedServices}</h2>{integrations.map(section => <SectionEditor key={`${section.section}:${section.latest_revision_id}:${section.active_revision_id}`} locale={locale} section={section} keyValue={keys[`save:${section.section}`]!} canWrite={data.can_write}/>)}</section>
    <section id="configuration-step-business" className={`${card} scroll-mt-24`}><h2 className="text-xl font-semibold">3. {c.business}</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{c.businessHint}</p><ModuleLinks locale={locale} links={[["administration/finance", "Plans, tarifs, packs et promotions", "الخطط والأسعار والحزم والعروض"], ["administration/fiscalite-maroc", "Fiscalité et règles datées", "الضرائب والقواعد المؤرخة"], ["administration/politiques-contrats", "Contrats et commissions FR/AR", "العقود والعمولات بالفرنسية والعربية"], ["administration/catalogue", "Services et catalogue", "الخدمات والكتالوج"], ["administration/notifications/modeles", "Textes des notifications FR/AR", "نصوص الإشعارات بالفرنسية والعربية"], ["administration/signatures", "Politiques de signature", "سياسات التوقيع"]]}/></section>
    <section id="configuration-step-team" className={`${card} scroll-mt-24`}><h2 className="text-xl font-semibold">4. {c.team}</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{c.teamHint}</p><ModuleLinks locale={locale} links={[["administration/utilisateurs", "Administrateurs et utilisateurs", "المسؤولون والمستخدمون"], ["administration/utilisateurs/inviter", "Inviter une personne", "دعوة شخص"], ["securite/compte", "Configurer le second facteur", "إعداد عامل المصادقة الثاني"], ["securite/sessions", "Sessions et accès", "الجلسات والوصول"]]}/></section>
    <section id="configuration-step-review" className={`${card} scroll-mt-24 space-y-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">5. {c.reviewTitle}</h2><button type="button" onClick={() => router.refresh()} className={secondary}><RefreshCw className="size-4" aria-hidden="true"/>{c.refresh}</button></div><p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{c.noDelivery}</p>{revisions.length ? revisions.map(revision => <RevisionReview key={`${revision.id}:${revision.status}:${revision.probe?.checked_at ?? "none"}`} locale={locale} revision={revision} data={data} keyValue={keys[`revision:${revision.id}`]!} now={now}/>) : <p>{c.noVersion}</p>}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"><h3 className="flex items-center gap-2 font-semibold"><Check aria-hidden="true" className="size-5"/>{c.awaitingChecks}</h3><p className="mt-2 text-sm leading-6">{c.launchHint}</p><ModuleLinks locale={locale} links={[["administration/preparation", "Recette et préparation de livraison", "الاختبار وإعداد التسليم"], ["administration/confidentialite", "Données personnelles et conservation", "البيانات الشخصية والاحتفاظ"], ["administration/operations", "État opérationnel des services", "الحالة التشغيلية للخدمات"]]}/></div>
    </section>
  </div>;
}
