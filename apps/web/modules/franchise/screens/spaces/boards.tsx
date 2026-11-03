import { matchesFranchiseNetwork, networkFilterOptions, networkStateLabel, type FranchiseNetworkFilters } from "@/modules/franchise/data/network/filters";
import{renewalCivilDate,renewalCalendarCounts}from"@/modules/franchise/data/spaces/calendar";
import { moroccoRegions } from "@/modules/shared/lib/geo/morocco-regions";
import Link from "next/link";
import { ArrowRight, Bell, Briefcase, CheckCircle2, FileText, LineChart, Lock, MapPin, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";
import { PIPELINE_STAGES } from "@/modules/franchise/data/crm/model";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { franchiseStageLabel } from "@/modules/franchise/data/spaces/labels";
import { canApplyFranchiseSpaceDemo, demoFranchiseSpaces, type FranchiseSpaceBoardData } from "@/modules/franchise/data/spaces/demo";
import { emptyFranchiseSpaces } from "@/modules/franchise/data/spaces/live";
import { MandateBanner } from "@/modules/franchise/screens/library/library-boards";
import { FranchiseMandateRail } from "@/modules/franchise/screens/library/library-chrome";
import { canMutateFranchiseFolder } from "@/modules/franchise/screens/network/folder-guards";
import { FranchiseFolderActivityForm, FranchiseFolderAdvanceForm, FranchiseFolderTimeline, FranchiseProviderLinkForm } from "@/modules/franchise/screens/network/folder-forms";
import {
  FranchiseAnomalyDefinitionForm,
  FranchiseIncidentInstructForm,
  FranchiseMandateInviteForm,
  FranchiseQualificationDecisionForm,
  FranchiseRecommendationDefinitionForm,
  FranchiseRiskDefinitionForm,
  FranchiseVolumeProposeForm,
} from "@/modules/franchise/screens/spaces/command-forms";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

type SpaceBoardProps = {
  locale: Locale;
  query: string;
  mandateName?: string | null;
  view?: string | null;
  itemId?: string | null;
  search?: string;
  stageFilter?: string;
  ownerFilter?: string;
  page?: string;
  board?: FranchiseSpaceBoardData;
  libraryId?: string | null;
  organizationId?: string | null;
  services?: Array<{ id: string; title: string }>;
  networkFilters?:FranchiseNetworkFilters;
};

const PAGE_SIZE = 8;

function integerShare(part: number, whole: number, locale: Locale): string {
  if (whole <= 0) return locale === "ar" ? "0 من 0" : "0 / 0";
  return locale === "ar" ? `${part} من ${whole}` : `${part} / ${whole}`;
}

function documentAccess(locale:Locale){return{label:locale==="ar"?"وصول مقيد بالتفويض":"Accès limité au mandat",tone:"peach"as const};}
function documentNeedsReview(status:string){return["SUBMITTED","PENDING","PENDING_REVIEW","IN_REVIEW","INFORMATION_REQUIRED","INFO_REQUIRED"].includes(status);}

function RenewalCalendar({ locale, dueDates }: { locale: Locale; dueDates: string[] }) {
  const c = franchiseCopy(locale);
  const {year,month,weekCount,monthCount,nextCount}=renewalCalendarCounts(dueDates);
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startPad = (first.getUTCDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const dueDays = new Set(
    dueDates.map(value=>renewalCivilDate(value)??"")
      .map((value) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
        if (!match) return null;
        const y = Number(match[1]);
        const m = Number(match[2]) - 1;
        const d = Number(match[3]);
        if (y !== year || m !== month) return null;
        return d;
      })
      .filter((value): value is number => value != null),
  );
  const weekDays = locale === "ar"
    ? ["إث", "ثل", "أر", "خم", "جم", "سب", "أح"]
    : ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const cells: Array<number | null> = [...Array.from({ length: startPad }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div className="franchise-mini-calendar" aria-label={monthLabel}>
      <header><strong>{monthLabel}</strong></header>
      <div className="franchise-cal-grid" role="group" aria-label={monthLabel}>
        {weekDays.map((day) => <span key={day} className="franchise-cal-head">{day}</span>)}
        {cells.map((day, index) => (
          <span
            key={`${day ?? "e"}-${index}`}
            className="franchise-cal-day"
            data-due={day && dueDays.has(day) ? "true" : undefined}
            data-muted={!day ? "true" : undefined}
          >
            {day ?? ""}
          </span>
        ))}
      </div>
      <ul className="franchise-dot-list franchise-cal-legend">
        <li><span className="franchise-dot" data-tone="peach" /><strong>{c.calendarLegendWeek}</strong><small dir="ltr">{weekCount}</small></li>
        <li><span className="franchise-dot" data-tone="violet" /><strong>{c.calendarLegendMonth}</strong><small dir="ltr">{monthCount}</small></li>
        <li><span className="franchise-dot" data-tone="sky" /><strong>{c.calendarLegendNext}</strong><small dir="ltr">{nextCount}</small></li>
      </ul>
    </div>
  );
}

function pageNumber(page?: string) {
  const value = Number.parseInt(page ?? "1", 10);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function withPage(query: string, page: number) {
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  const next = params.toString();
  return next ? `?${next}` : "";
}

function paginate<T>(rows: T[], page?: string) {
  const current = pageNumber(page);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE) || 1);
  const safe = Math.min(current, pageCount);
  return { rows: rows.slice((safe - 1) * PAGE_SIZE, safe * PAGE_SIZE), page: safe, pageCount };
}

function PaginationNav({ path, query, page, pageCount, label }: { path: string; query: string; page: number; pageCount: number; label: string }) {
  return (
    <nav className="franchise-pagination" aria-label={label}>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((n) => (
        n === page ? <span key={n} aria-current="page">{n}</span> : <Link key={n} href={`${path}${withPage(query, n)}`}>{n}</Link>
      ))}
    </nav>
  );
}

function organizationIdFromQuery(query: string) {
  return new URLSearchParams(query.startsWith("?") ? query.slice(1) : query).get("organizationId") ?? "";
}

function ScopeInputs({query}:{query:string}){
  const params=new URLSearchParams(query.replace(/^\?/,""));
  return <>{["organizationId","franchiseId"].map(name=>params.get(name)?<input key={name} type="hidden" name={name} value={params.get(name)!}/>:null)}</>;
}
function filterQuery(query:string,values:Record<string,string|undefined|null>){
 const params=new URLSearchParams(query.replace(/^\?/,""));
 for(const[name,value]of Object.entries(values))if(value&&value!=="all")params.set(name,value);else params.delete(name);
 const result=params.toString();return result?`?${result}`:"";
}

function folderEvidence(row: { activities?: Array<{ evidence: string[] }>; pipelineEvents?: Array<{ evidence: string[] }> }) {
  return [...(row.activities ?? []), ...(row.pipelineEvents ?? [])].flatMap((item) => item.evidence);
}

function matchesNetworkFilter(view: string | null | undefined, stage?: string,dossier?:FranchiseSpaceBoardData["people"][number]["dossier"]) {
  if(dossier&&view&&view!=="all"&&view!=="inviter"){
    if(view==="qualifies")return dossier.qualifications.some(q=>q.status==="APPROVED")&&dossier.status!=="SUSPENDED"&&dossier.status!=="REJECTED";
    if(view==="inactifs")return["SUSPENDED","REJECTED","INACTIVE"].includes(dossier.status);
    if(view==="incomplets")return dossier.companyStatus!=="VERIFIED"||dossier.qualifications.some(q=>["PENDING","INFO_REQUIRED","EXPIRED"].includes(q.status));
    if(view==="accompagnement")return dossier.status!=="ACTIVE"||dossier.qualifications.some(q=>q.status!=="APPROVED");
  }
  if (!view || view === "all" || view === "inviter") return true;
  if (view === "accompagnement") return stage === "SENT" || stage === "OPENED";
  if (view === "incomplets") return stage === "REGISTERED" || stage === "PROFILE_STARTED" || stage === "DIAGNOSTIC_STARTED";
  if (view === "qualifies") return stage === "VERIFIED" || stage === "OPPORTUNITY_CREATED" || stage === "RFQ_STARTED" || stage === "CONTRACT_SIGNED";
  if (view === "inactifs") return stage === "INACTIVE";
  return true;
}

function resolveBoard(props: SpaceBoardProps): FranchiseSpaceBoardData {
  if (props.board) return props.board;
  return canApplyFranchiseSpaceDemo() ? demoFranchiseSpaces(props.locale, props.query) : emptyFranchiseSpaces(props.locale, props.query);
}

function Cta({ href, children, soft = false }: { href: string; children: ReactNode; soft?: boolean }) {
  return <Link href={href} className={soft ? "client-soft-link" : "franchise-tool"}>{children}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link>;
}

function Banner({ locale, mandateName,board }: SpaceBoardProps) {
  const n = libraryCopy(locale);
  return <><MandateBanner locale={locale} name={mandateName ?? n.mandate} />{board?.unavailableSections?.length?<p className="client-card" role="alert">{locale==="ar"?"بعض الأقسام غير متاحة مؤقتاً. أعيدوا تحميل الصفحة للمحاولة.":"Certaines sections sont temporairement indisponibles. Rechargez la page pour réessayer."} <bdi dir="ltr">{board.unavailableSections.join(", ")}</bdi></p>:null}</>;
}

export function FranchiseHomeBoard({ locale, query, mandateName, board }: SpaceBoardProps) {
  const c = franchiseCopy(locale);
  const demo = resolveBoard({ locale, query, board });
  return (
    <main className="client-page">
      <Banner locale={locale} query={query} mandateName={mandateName} board={demo} />
      <section className="franchise-treat">
        {demo.treat.map((item) => (
          <Link key={item.id} href={item.href} className="franchise-kpi-tile" data-tone={item.tone}>
            <span className="franchise-kpi-icon" data-tone={item.tone}><FileText className="size-4" aria-hidden /></span>
            <span><strong>{item.title}</strong><small>{item.detail}</small></span>
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        ))}
      </section>
      <section className="franchise-workbench">
        <article className="client-card">
          <header><h2>{c.viewPerimeter}</h2></header>
          <ol className="franchise-pipeline">
            {demo.pipeline.map((step, index) => {
              const Icon = [Users, FileText, Briefcase, ShieldCheck, LineChart][index] ?? Users;
              return (
                <li key={step.id}>
                  <span className="franchise-pipe-row">
                    <span className="franchise-pipe-icon" data-tone={step.tone}><Icon className="size-4" aria-hidden /></span>
                    {index < demo.pipeline.length - 1 ? <span className="franchise-pipe-arrow" aria-hidden /> : null}
                  </span>
                  <strong>{step.title}</strong>
                  <small>{step.detail}</small>
                  <em className="client-status-chip" data-tone={step.tone}>{step.status}</em>
                </li>
              );
            })}
          </ol>
          <p className="client-access-note">{c.scopeNote}</p>
        </article>
        <article className="client-card">
          <header className="client-priority-head"><h2>{c.treatNow}</h2></header>
          <ul className="franchise-dot-list">
            {demo.attention.map((item) => (
              <li key={item.id}>
                <span className="franchise-dot" data-tone="peach" />
                <strong>{item.title}</strong>
                <Cta href={item.href} soft>{c.open}</Cta>
              </li>
            ))}
          </ul>
        </article>
        <FranchiseMandateRail locale={locale} name={mandateName} />
      </section>
    </main>
  );
}

export function PerimeterBoard({ locale, query, mandateName, view, board, organizationId }: SpaceBoardProps) {
  const c = franchiseCopy(locale);
  const demo = resolveBoard({ locale, query, board });
  if(sourceUnavailable(board,['GOVERNANCE']))return <UnavailableSection locale={locale} query={query}/>;
  return (
    <main className="client-page">
      <Banner locale={locale} query={query} mandateName={mandateName} board={demo} />
      <section className="franchise-workbench">
        <article className="client-card">
          <header><h2>{view === "utilisateurs" ? c.users : c.authorized}</h2></header>
          <nav className="franchise-inspector-tabs" aria-label={c.authorized}>
            <Link href={`/${locale}/franchise/perimetre${query}`} data-active={!view ? "true" : undefined}>{c.authorized}</Link>
            <Link href={`/${locale}/franchise/perimetre/utilisateurs${query}`} data-active={view === "utilisateurs" ? "true" : undefined}>{c.users}</Link>
          </nav>
          {view === "utilisateurs" ? (
            <>
              {demo.users.length === 0 ? <p>{c.emptyUsers}</p> : (
                <ul className="client-feed">
                  {demo.users.map((row) => (
                    <li key={row.id}><span><strong>{row.title}</strong><small>{row.meta}</small></span><em className="client-status-chip">{networkStateLabel(row.status,locale)}</em></li>
                  ))}
                </ul>
              )}
              {demo.canWrite && (organizationId || organizationIdFromQuery(query)) ? (
                <FranchiseMandateInviteForm locale={locale} organizationId={organizationId || organizationIdFromQuery(query)} />
              ) : null}
            </>
          ) : (
            <ul className="client-feed">
              <li><MapPin className="size-4" aria-hidden /><span><strong>{c.territory}</strong><small>{demo.perimeter.territory}</small></span></li>
              <li><FileText className="size-4" aria-hidden /><span><strong>{c.domains}</strong><small>{demo.perimeter.domains}</small></span></li>
              <li><ShieldCheck className="size-4" aria-hidden /><span><strong>{c.mandate}</strong><small>{demo.perimeter.mandate}</small></span></li>
              <li><span><strong>{c.state}</strong></span><em className="client-status-chip" data-tone="mint">{demo.perimeter.status}</em></li>
            </ul>
          )}
          <div className="franchise-map" aria-hidden><span className="franchise-compass">✧</span></div>
        </article>
        <div className="client-stack">
          <article className="client-card">
            <header><h2>{c.canDo}</h2></header>
            {demo.canDo.length === 0
              ? <p className="client-access-note">{locale === "ar" ? "ستظهر هنا صلاحيات تفويضكم عند توفرها." : "Les droits de votre mandat apparaîtront ici lorsqu’ils seront disponibles."}</p>
              : <ul className="franchise-can">{demo.canDo.map((item) => <li key={item}>{item}</li>)}</ul>}
          </article>
          <article className="client-card">
            <header><h2>{c.needsVal}</h2></header>
            {demo.needsValidation.length === 0
              ? <p className="client-access-note">{locale === "ar" ? "لا توجد عمليات معلّقة تتطلب مصادقة إضافية." : "Aucune action en attente de validation supplémentaire."}</p>
              : <ul className="franchise-cannot">{demo.needsValidation.map((item) => <li key={item}>{item}</li>)}</ul>}
          </article>
          <p className="client-access-note">{c.periNote}</p>
        </div>
        <FranchiseMandateRail locale={locale} name={mandateName} />
      </section>
    </main>
  );
}

function UnavailableSection({locale,query,title,message}:{locale:Locale;query:string;title?:string;message?:string}){return <main className="client-page"><article className="client-card" role="alert"><h2>{title??(locale==="ar"?"البيانات غير متاحة مؤقتاً":"Données temporairement indisponibles")}</h2><p>{message??(locale==="ar"?"تعذر تحميل هذا القسم. لا يمكن تأكيد العدد أو عدم وجود عناصر حالياً.":"Le chargement de cette section a échoué. Le nombre d’éléments et leur absence ne peuvent pas être confirmés.")}</p><a className="franchise-tool" href={query||"?"}>{locale==="ar"?"إعادة المحاولة":"Réessayer"}</a></article></main>;}
function sourceUnavailable(board:FranchiseSpaceBoardData|undefined,sources:string[]){return Boolean(board?.unavailableSections.some(source=>sources.includes(source)));}

export function NetworkBoard({ locale, query, mandateName, view, itemId, search, page, board, organizationId,networkFilters={} }: SpaceBoardProps) {
  const c = franchiseCopy(locale);
  const demo = resolveBoard({ locale, query, board });
  if(sourceUnavailable(demo,['CRM','OPERATIONS']))return <UnavailableSection locale={locale} query={query}/>;
  const selected = itemId ? demo.people.find((row) => row.id === itemId) ?? null : null;
  const needle = (search ?? "").trim().toLocaleLowerCase();
  const filtered = demo.people.filter((row) => matchesNetworkFilter(view, row.stage,row.dossier) && matchesFranchiseNetwork(row,networkFilters) && (!needle || `${row.name} ${row.services} ${networkStateLabel(row.status,locale)}`.toLocaleLowerCase().includes(needle)));
  const paged = paginate(filtered, page);
  const people = paged.rows;
  const filterOptions=networkFilterOptions(demo.people);
  const networkPath=`/${locale}/franchise/fournisseurs${view&&view!=="inviter"?`/${view}`:""}`;
  const networkQuery=filterQuery(query,{q:search,...networkFilters});
  const network=demo.metrics?.network;
  const activeCount=network?.activeProviders??null;
  const qualifiedCount=network?.qualifiedProviders??null;
  const supportCount=network?.inProgressProviders??null;
  const incompleteCount=network?.incompleteProviders??null;
  const docsWatch=network?.documentsExpiring??null;
  const networkShare=(count:number|null)=>count===null||!network?"—":integerShare(count,network.providers,locale);
  const tab = (href: string, label: string, active: boolean) => <Link href={href} data-active={active ? "true" : undefined}>{label}</Link>;
  if (selected) {
    const dossier=selected.dossier;
    const unknown=locale==="ar"?"غير موثق":"Non renseigné";
    const docs=(dossier?.documents??[]).map((d)=>({id:d.id,title:d.code,status:d.status}));
    const qualifications=(dossier?.qualifications??[]).map((r)=>({id:r.id,title:r.serviceCode,status:r.status,rowVersion:r.rowVersion,meta:r.serviceCode}));
    const availability=dossier?.capacities.map((c)=>`${c.serviceCode} : ${c.status}${c.availableUnits===null?"":` (${c.availableUnits})`}`).join(" · ")||unknown;
    const regions=dossier?.regions.map((code)=>{const r=moroccoRegions.find((r)=>r.code===code);return r?(locale==="ar"?r.nameAr:r.nameFr):code;}).join(", ")||unknown;
    const decisionNote = selected.activities?.find((item) => /qualif|décision|decision|تأهيل/i.test(`${item.type} ${item.summary}`));
    return (
      <main className="client-page franchise-network-page franchise-provider-dossier">
        <Banner locale={locale} query={query} mandateName={mandateName} board={demo} />
        <article className="client-card franchise-provider-hero-card">
          <div className="franchise-provider-hero">
            <span className="franchise-kpi-icon" data-tone={selected.tone}><Briefcase className="size-4" aria-hidden /></span>
            <div>
              <strong>{selected.name}</strong>
              <em className="client-status-chip" data-tone="sky">{dossier?networkStateLabel(dossier.status,locale):unknown}</em>
              <p>{selected.email ?? selected.services}</p>
            </div>
            <Link href={`/${locale}/franchise/fournisseurs/${selected.id}${query}`} className="franchise-tool franchise-tool-primary">{c.openProviderFolder}</Link>
          </div>
          <dl className="franchise-props franchise-provider-meta">
            <div><dt>{c.providerType}</dt><dd>{c.serviceTypeLabel}</dd></div>
            <div><dt>{c.relationSince}</dt><dd dir="ltr">{selected.createdAt ? selected.createdAt.slice(0, 10) : "—"}</dd></div>
            <div><dt>{c.globalStatus}</dt><dd className="client-status-chip" data-tone={selected.tone}>{networkStateLabel(selected.status,locale)}</dd></div>
            <div><dt>{c.services}</dt><dd>{selected.services || "—"}</dd></div>
            <div><dt>{c.capacityLevel}</dt><dd>{dossier?.teamSize??unknown}</dd></div>
            <div><dt>{c.zoneIntervention}</dt><dd>{regions}</dd></div>
            <div><dt>{c.availability}</dt><dd>{availability}</dd></div>
          </dl>
        </article>
        <nav className="franchise-pill-tabs" aria-label={selected.name}>
          <Link href={`/${locale}/franchise/fournisseurs/${selected.id}${query}`} className="franchise-pill-tab" data-active={!view || view === "qualification" ? "true" : undefined}><span>{c.stepQual}</span></Link>
          <Link href={`/${locale}/franchise/fournisseurs/${selected.id}${query}`} className="franchise-pill-tab"><span>{c.servicesTab}</span></Link>
          <Link href={`/${locale}/franchise/fournisseurs/${selected.id}/capacite${query}`} className="franchise-pill-tab" data-active={view === "capacite" ? "true" : undefined}><span>{c.capacityAvailability}</span></Link>
          <Link href={`/${locale}/franchise/fournisseurs/${selected.id}/documents${query}`} className="franchise-pill-tab" data-active={view === "documents" ? "true" : undefined}><span>{c.providerDocs}</span></Link>
          <Link href={`/${locale}/franchise/fournisseurs/${selected.id}${query}`} className="franchise-pill-tab"><span>{c.historyTab}</span></Link>
        </nav>
        <section className="franchise-dossier-grid">
          <article className="client-card">
            {!selected.linkedOrganizationId?<p role="status">{locale==="ar"?"هذا عميل محتمل غير مرتبط بعد بمنظمة مقدم خدمة. لا تُنسب إليه أي وثيقة أو قدرة.":"Ce prospect n’est pas encore relié à une organisation prestataire. Aucune qualification, pièce ou disponibilité ne lui est attribuée."}</p>:null}
            {demo.canWrite&&selected.rowVersion?<FranchiseProviderLinkForm locale={locale} prospectId={selected.id} rowVersion={selected.rowVersion} organizationId={organizationId||organizationIdFromQuery(query)||null} options={demo.providerDossiers}/>:null}
            <header><h2>{c.stepQual}</h2></header>
            {qualifications.length === 0 ? <p className="franchise-empty-panel">{c.emptyQualifications}</p> : (
              <div tabIndex={0} className="client-table-wrap">
                <table className="client-space-table franchise-dense-table">
                  <thead><tr><th>{c.servicesTab}</th><th>{c.proofs}</th><th>{c.state}</th><th>{c.action}</th></tr></thead>
                  <tbody>
                    {qualifications.map((row) => (
                      <tr key={row.id}>
                        <td>{row.title}</td>
                        <td>{row.meta ?? "—"}</td>
                        <td><span className="client-status-chip">{networkStateLabel(row.status,locale)}</span></td>
                        <td><Cta href={`/${locale}/franchise/fournisseurs/${selected.id}${query}`} soft>{c.open}</Cta></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {view === "capacite" || !view || view === "qualification" ? (
              <section className="franchise-capacity-block">
                <header><h3>{c.capacityAvailability}</h3></header>
                <p>{availability}</p><ul>{dossier?.capacities.map((item)=><li key={item.id}>{item.serviceCode} · {item.leadTimeDays} {locale==="ar"?"أيام":"jours"}</li>)}</ul>
              </section>
            ) : null}
            {view === "documents" ? (
              <>
                <p className="client-access-note">{locale==="ar"?"وثائق المنظمة المرتبطة فقط.":"Uniquement les documents de l’organisation explicitement reliée."}</p>
                {docs.length?<ul className="client-feed">{docs.map(document=><li key={document.id}><Link className="client-soft-link" href={`/${locale}/franchise/documents/${document.id}${query}`}>{document.title}</Link><span>{networkStateLabel(document.status,locale)}</span></li>)}</ul>:null}
                {folderEvidence(selected).length ? (
                  <ul className="client-feed">
                    {folderEvidence(selected).map((ref) => (
                      <li key={ref}><span><strong>{ref}</strong><small>{c.evidence}</small></span></li>
                    ))}
                  </ul>
                 ) : docs.length?null:<p className="franchise-empty-panel">{c.noEvidence}</p>}
              </>
            ) : null}
            {!view || view === "qualification" ? (
              <>
                <FranchiseFolderTimeline locale={locale} activities={selected.activities} events={selected.pipelineEvents} />
                {canMutateFranchiseFolder(selected.id, demo.canWrite&&Boolean(selected.rowVersion)) && selected.rowVersion ? (
                  <FranchiseFolderAdvanceForm locale={locale} organizationId={organizationIdFromQuery(query) || null} prospectId={selected.id} stage={selected.stage ?? "SENT"} rowVersion={selected.rowVersion} />
                ) : null}
                {canMutateFranchiseFolder(selected.id, demo.canWrite&&Boolean(selected.rowVersion)) ? (
                  <FranchiseFolderActivityForm locale={locale} organizationId={organizationIdFromQuery(query) || null} prospectId={selected.id} defaultType="NOTE" />
                ) : null}
                {demo.permissions.canDecideQualifications ? (
                  <FranchiseQualificationDecisionForm
                    locale={locale}
                    organizationId={organizationId || organizationIdFromQuery(query) || null}
                    qualifications={qualifications.filter((row) => row.rowVersion)}
                  />
                ) : null}
              </>
            ) : null}
            {view === "capacite" && canMutateFranchiseFolder(selected.id, demo.canWrite&&Boolean(selected.rowVersion)) ? (
              <FranchiseFolderActivityForm locale={locale} organizationId={organizationIdFromQuery(query) || null} prospectId={selected.id} defaultType="FOLLOW_UP" />
            ) : null}
            {view === "documents" && canMutateFranchiseFolder(selected.id, demo.canWrite&&Boolean(selected.rowVersion)) ? (
              <FranchiseFolderActivityForm locale={locale} organizationId={organizationIdFromQuery(query) || null} prospectId={selected.id} defaultType="NOTE" />
            ) : null}
          </article>
          <aside className="franchise-home-rail">
            <article className="client-card">
              <header><h2>{c.decisionTitle}</h2></header>
              {decisionNote || selected.status ? (
                <>
                  <p className="franchise-decision-status"><CheckCircle2 className="size-5" aria-hidden /><strong>{networkStateLabel(selected.status,locale)}</strong></p>
                  <p className="client-access-note">{c.decisionReadonly}</p>
                  {decisionNote ? <blockquote className="franchise-decision-quote">{decisionNote.summary}</blockquote> : <p className="franchise-empty-panel">{c.emptyDecision}</p>}
                  <Link href={`/${locale}/franchise/qualite${query}`} className="franchise-tool franchise-tool-primary">{c.requestRevision}</Link>
                </>
              ) : (
                <p className="franchise-empty-panel">{c.emptyDecision}</p>
              )}
            </article>
            <article className="client-card">
              <header className="client-priority-head"><h2>{c.providerDocs}</h2><Link href={`/${locale}/franchise/fournisseurs/${selected.id}/documents${query}`} className="client-soft-link">{c.seeAllDocs}</Link></header>
              {docs.length === 0 && folderEvidence(selected).length === 0 ? (
                <p className="franchise-empty-panel">{c.emptyProviderDocs}</p>
              ) : (
                <ul className="franchise-dot-list">
                  {(docs.length ? docs.map((row) => ({ id: row.id, title: row.title, status: row.status })) : folderEvidence(selected).map((ref) => ({ id: ref, title: ref, status: c.evidence }))).map((row) => (
                    <li key={row.id}><span className="franchise-dot" data-tone="mint" /><span><strong>{row.title}</strong><small>{networkStateLabel(row.status,locale)}</small></span></li>
                  ))}
                </ul>
              )}
            </article>
            <article className="client-card">
              <header><h2>{c.capacityTitle}</h2></header>
              <ul className="franchise-dot-list">
                <li><span className="franchise-dot" data-tone="mint" /><strong>{c.capacityLevel}</strong><small>{dossier?.teamSize??unknown}</small></li>
                <li><span className="franchise-dot" data-tone="sky" /><strong>{regions}</strong><small>{regions}</small></li>
                <li><span className="franchise-dot" data-tone="violet" /><strong>{c.availability}</strong><small>{availability}</small></li>
              </ul>
            </article>
          </aside>
        </section>
      </main>
    );
  }
  return (
    <main className="client-page franchise-network-page">
      <Banner locale={locale} query={query} mandateName={mandateName} board={demo} />
      <section className="franchise-treat franchise-net-kpis">
        <article className="franchise-kpi-tile" data-tone="sky"><span className="franchise-kpi-icon" data-tone="sky"><Users className="size-4" aria-hidden /></span><span><strong dir="ltr">{activeCount??"—"}</strong><small>{c.netActive}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="mint"><span className="franchise-kpi-icon" data-tone="mint"><ShieldCheck className="size-4" aria-hidden /></span><span><strong dir="ltr">{qualifiedCount??"—"}</strong><small>{c.qualified} · {networkShare(qualifiedCount)} {c.netQualifiedShare}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="peach"><span className="franchise-kpi-icon" data-tone="peach"><Briefcase className="size-4" aria-hidden /></span><span><strong dir="ltr">{supportCount??"—"}</strong><small>{c.netInProgress} · {networkShare(supportCount)} {c.netQualifiedShare}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="violet"><span className="franchise-kpi-icon" data-tone="violet"><FileText className="size-4" aria-hidden /></span><span><strong dir="ltr">{incompleteCount??"—"}</strong><small>{c.netToQualify} · {networkShare(incompleteCount)} {c.netQualifiedShare}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="violet"><span className="franchise-kpi-icon" data-tone="violet"><Bell className="size-4" aria-hidden /></span><span><strong dir="ltr">{docsWatch??"—"}</strong><small>{c.netDocsExpiring}</small></span></article>
      </section>
      <form action={networkPath} method="get" className="franchise-filters franchise-net-filters">
        <ScopeInputs query={query}/>
        <label><span className="sr-only">{c.searchPro}</span><input name="q" defaultValue={search} placeholder={c.searchPro} /></label>
        <select name="service" defaultValue={networkFilters.service||"all"} aria-label={c.allServicesFilter}><option value="all">{c.allServicesFilter}</option>{filterOptions.services.map(value=><option key={value} value={value}>{value}</option>)}</select>
        <select name="status" defaultValue={networkFilters.status||"all"} aria-label={c.allStatusesFilter}><option value="all">{c.allStatusesFilter}</option>{filterOptions.statuses.map(value=><option key={value} value={value}>{networkStateLabel(value,locale)}</option>)}</select>
        <select name="capacity" defaultValue={networkFilters.capacity||"all"} aria-label={c.allCapacitiesFilter}><option value="all">{c.allCapacitiesFilter}</option>{filterOptions.capacities.map(value=><option key={value} value={value}>{networkStateLabel(value,locale)}</option>)}</select>
        <select name="zone" defaultValue={networkFilters.zone||"all"} aria-label={c.allZonesFilter}><option value="all">{c.allZonesFilter}</option>{filterOptions.zones.map(value=>{const region=moroccoRegions.find(region=>region.code===value);return<option key={value} value={value}>{region?(locale==="ar"?region.nameAr:region.nameFr):value}</option>;})}</select>
        <select name="docs" defaultValue={networkFilters.docs||"all"} aria-label={c.allDocStatusesFilter}><option value="all">{c.allDocStatusesFilter}</option>{filterOptions.documents.map(value=><option key={value} value={value}>{networkStateLabel(value,locale)}</option>)}</select>
        <button type="submit" className="franchise-scope-chip">{c.filter}</button>
        <Link href={`/${locale}/franchise/fournisseurs${query}`} className="franchise-tool">{c.resetFilters}</Link>
      </form>
      <div className="franchise-net-invite-row" aria-label={c.netInviteRow}>
        <Link href={`/${locale}/franchise/fournisseurs/inviter${query}`} className="franchise-tool">{c.inviteProvider}</Link>
        <Link href={`/${locale}/franchise/clients/inviter${query}`} className="franchise-tool">{c.inviteClient}</Link>
      </div>
      <section className="franchise-workbench franchise-network-workbench">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.listPros}</h2>
            <span className="client-access-note">{c.exportList}</span>
          </header>
          <nav className="franchise-inspector-tabs" aria-label={c.netPeople}>
            {tab(`/${locale}/franchise/fournisseurs${query}`, c.all, !view || view === "all")}
            {tab(`/${locale}/franchise/fournisseurs/accompagnement${query}`, c.toSupport, view === "accompagnement")}
            {tab(`/${locale}/franchise/fournisseurs/incomplets${query}`, c.incomplete, view === "incomplets")}
            {tab(`/${locale}/franchise/fournisseurs/qualifies${query}`, c.qualified, view === "qualifies")}
            {tab(`/${locale}/franchise/fournisseurs/inactifs${query}`, c.inactive, view === "inactifs")}
          </nav>
          <div tabIndex={0} className="client-table-wrap" id="reseau">
            <table className="client-space-table franchise-dense-table">
              <thead><tr><th>{c.profile}</th><th>{c.services}</th><th>{c.folderState}</th><th>{c.capacityLevel}</th><th>{c.availability}</th><th>{c.document}</th><th>{c.qualityScore}</th><th>{c.action}</th></tr></thead>
              <tbody>
                {people.length === 0 ? (
                  <tr><td colSpan={8}>{c.emptyPeople}</td></tr>
                ) : people.map((row) => (
                  <tr key={row.id} data-selected={itemId != null && itemId === row.id ? "true" : undefined}>
                    <td><span className="franchise-row-title"><span className="franchise-kpi-icon" data-tone={row.tone}>{row.name.slice(0, 1)}</span>{row.name}</span></td>
                    <td><em className="franchise-kind-chip">{row.services}</em></td>
                    <td><span className="client-status-chip" data-tone={row.tone}>{networkStateLabel(row.status,locale)}</span></td>
                    <td>{row.dossier?.teamSize??"—"}</td>
                    <td>{row.dossier?.capacities.map((c)=>`${c.serviceCode}: ${c.status}`).join(" · ")||"—"}</td>
                    <td>{row.dossier?.documents.map((d)=>d.status).join(" · ")||"—"}</td>
                    <td dir="ltr">—</td>
                    <td><Cta href={`/${locale}/franchise/fournisseurs/${row.id}${query}`} soft>{c.openFolder}</Cta></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationNav path={networkPath} query={networkQuery} page={paged.page} pageCount={paged.pageCount} label={c.netPeople} />
        </article>
        <article className="client-card">
          <header><h2>{c.prioritize}</h2></header>
          <ul className="franchise-dot-list">
            {people.slice(0, 5).map((row) => (
              <li key={`prio-${row.id}`}>
                <span className="franchise-dot" data-tone={row.tone} />
                <span><strong>{row.name}</strong><small>{networkStateLabel(row.status,locale)}</small></span>
                <Cta href={`/${locale}/franchise/fournisseurs/${row.id}${query}`} soft>{c.openProviderFolder}</Cta>
              </li>
            ))}
          </ul>
          <p className="client-access-note">{c.privacyLead}</p>
        </article>
      </section>
    </main>
  );
}

export function FranchiseRequestsBoard({ locale, query, mandateName, view, itemId, search, stageFilter, ownerFilter, page, board }: SpaceBoardProps) {
  const c = franchiseCopy(locale);
  const demo = resolveBoard({ locale, query, board });
  if(sourceUnavailable(demo,['CRM','OPERATIONS']))return <UnavailableSection locale={locale} query={query}/>;
  const href = `/${locale}/franchise/demandes${query}`;
  const selected = itemId ? demo.requests.find((row) => row.id === itemId) ?? null : null;
  const needle = (search ?? "").trim().toLocaleLowerCase();
  const owners = [...new Set(demo.requests.map((row) => row.owner))];
  const filtered = demo.requests.filter((row) => {
    if (stageFilter && stageFilter !== "all" && row.stageCode !== stageFilter) return false;
    if (ownerFilter && ownerFilter !== "all" && row.owner !== ownerFilter) return false;
    return !needle || `${row.title} ${row.owner} ${row.stage} ${row.flag}`.toLocaleLowerCase().includes(needle);
  });
  const supervision = view === "devis" ? demo.quotes : view === "missions" ? demo.missions : null;
  const paged = paginate(filtered, page);
  const requests = paged.rows;
  const org = organizationIdFromQuery(query);
  const openCount = demo.requests.filter((row) => row.tone === "violet").length;
  const waitingCount = demo.requests.filter((row) => row.tone === "peach").length;
  const matchingCount = demo.requests.filter((row) => (row.matching?.length ?? 0) > 0).length;
  const followCount = demo.requests.filter((row) => row.tone === "mint" || row.tone === "sky").length;
  return (
    <main className="client-page">
      <Banner locale={locale} query={query} mandateName={mandateName} board={demo} />
      <section className="franchise-treat">
        <article className="franchise-kpi-tile" data-tone="violet"><span className="franchise-kpi-icon" data-tone="violet"><FileText className="size-4" aria-hidden /></span><span><strong dir="ltr">{openCount}</strong><small>{c.reqKpiOpen}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="peach"><span className="franchise-kpi-icon" data-tone="peach"><Bell className="size-4" aria-hidden /></span><span><strong dir="ltr">{waitingCount}</strong><small>{c.reqKpiWaiting}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="sky"><span className="franchise-kpi-icon" data-tone="sky"><Users className="size-4" aria-hidden /></span><span><strong dir="ltr">{matchingCount}</strong><small>{c.reqKpiMatching}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="mint"><span className="franchise-kpi-icon" data-tone="mint"><LineChart className="size-4" aria-hidden /></span><span><strong dir="ltr">{followCount}</strong><small>{c.reqKpiFollow}</small></span></article>
      </section>
      <form action={`/${locale}/franchise/demandes`} method="get" className="franchise-filters">
        <ScopeInputs query={query}/>
        <label><span className="sr-only">{c.search}</span><input name="q" defaultValue={search} placeholder={c.search} /></label>
        <label>
          <span className="sr-only">{c.allStages}</span>
          <select name="stage" defaultValue={stageFilter || "all"}>
            <option value="all">{c.allStages}</option>
            {PIPELINE_STAGES.map((stage) => <option key={stage} value={stage}>{franchiseStageLabel(stage, locale)}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">{c.allOwners}</span>
          <select name="owner" defaultValue={ownerFilter || "all"}>
            <option value="all">{c.allOwners}</option>
            {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
          </select>
        </label>
        <button type="submit" className="franchise-scope-chip">{c.filter}</button>
        <Link href={href} className="franchise-tool">{c.reset}</Link>
        <Link href={`/${locale}/franchise/clients/inviter${query}`} className="franchise-tool franchise-tool-primary">{c.inviteClient}</Link>
      </form>
      <section className="franchise-workbench">
        <article className="client-card">
          <header><h2>{view === "devis" ? c.quotes : view === "missions" ? c.missions : c.folders}</h2></header>
          <nav className="franchise-inspector-tabs" aria-label={c.folders}>
            <Link href={`/${locale}/franchise/demandes${query}`} data-active={!view || (view !== "devis" && view !== "missions") ? "true" : undefined}>{c.folders}</Link>
            <Link href={`/${locale}/franchise/demandes/devis${query}`} data-active={view === "devis" ? "true" : undefined}>{c.quotes}</Link>
            <Link href={`/${locale}/franchise/demandes/missions${query}`} data-active={view === "missions" ? "true" : undefined}>{c.missions}</Link>
          </nav>
          <div tabIndex={0} className="client-table-wrap">
            <table className="client-space-table">
              <thead><tr><th>{c.folder}</th><th>{c.stage}</th><th>{c.owner}</th><th>{c.flag}</th><th>{c.action}</th></tr></thead>
              <tbody>
                {supervision ? (
                  supervision.length === 0 ? (
                    <tr><td colSpan={5}>{view === "devis" ? c.emptyQuotes : c.emptyMissions}</td></tr>
                  ) : supervision.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td><span className="client-status-chip">{networkStateLabel(row.status,locale)}</span></td>
                      <td>{row.meta ?? "—"}</td>
                      <td>—</td>
                      <td><Cta href={row.href} soft>{c.open}</Cta></td>
                    </tr>
                  ))
                ) : requests.length === 0 ? (
                  <tr><td colSpan={5}>{c.emptyRequests}</td></tr>
                ) : requests.map((row) => (
                  <tr key={row.id}>
                    <td><span className="franchise-row-title"><span className="franchise-kpi-icon" data-tone={row.tone}><FileText className="size-4" aria-hidden /></span>{row.title}</span></td>
                    <td><span className="client-status-chip" data-tone={row.tone}>{row.stage}</span></td>
                    <td>{row.owner}</td>
                    <td>{row.flag}</td>
                    <td><Cta href={`/${locale}/franchise/demandes/${row.id}${query}`} soft>{c.open}</Cta></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {supervision ? null : <PaginationNav path={`/${locale}/franchise/demandes`} query={filterQuery(query,{q:search,stage:stageFilter,owner:ownerFilter})} page={paged.page} pageCount={paged.pageCount} label={c.folders} />}
        </article>
        <article className="client-card">
          <header><h2>{selected ? selected.title : c.orient}</h2></header>
          <nav className="franchise-inspector-tabs" aria-label={c.orient}>
            <Link href={itemId ? `/${locale}/franchise/demandes/${itemId}${query}` : href} data-active={!view ? "true" : undefined}>{c.openFolder}</Link>
            <Link href={itemId ? `/${locale}/franchise/demandes/${itemId}/matching${query}` : href} data-active={view === "matching" ? "true" : undefined}>{c.matching}</Link>
            <Link href={itemId ? `/${locale}/franchise/demandes/${itemId}/consultation${query}` : href} data-active={view === "consultation" ? "true" : undefined}>{c.consult}</Link>
            <Link href={itemId ? `/${locale}/franchise/demandes/${itemId}/suivi${query}` : href} data-active={view === "suivi" ? "true" : undefined}>{c.follow}</Link>
          </nav>
          {selected && view === "matching" ? (
            <section className="franchise-matching-layout">
              <div>
                <header className="client-priority-head">
                  <h2>{c.matchingEligible} <small dir="ltr">({selected.matching?.length ?? 0})</small></h2>
                </header>
                <p>{c.matchingLead}</p>
                {selected.matching?.length ? (
                  <div tabIndex={0} className="client-table-wrap">
                    <table className="client-space-table">
                      <thead>
                        <tr>
                          <th>{c.netPeople}</th>
                          <th>{c.stepQual}</th>
                          <th>{c.state}</th>
                          <th>{c.action}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.matching.map((row, index) => (
                          <tr key={row.id} data-selected={index < 2 ? "true" : undefined}>
                            <td>
                              <label className="franchise-check-row">
                                <input type="checkbox" defaultChecked={index < 2} readOnly aria-label={row.name} />
                                <strong>{row.name}</strong>
                              </label>
                            </td>
                            <td><em className="client-status-chip" data-tone={row.tone}>{networkStateLabel(row.status,locale)}</em></td>
                            <td><em className="client-status-chip" data-tone="mint">{locale === "ar" ? "متاح" : "Disponible"}</em></td>
                            <td><Cta href={row.href} soft>{c.openFolder}</Cta></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="franchise-empty-panel">{c.emptyMatching}</p>}
                <ol className="franchise-mini-pipe franchise-consult-steps">
                  <li data-active="true"><em>1</em><strong>{c.matchingStepPrepare}</strong><small>{c.needLead}</small></li>
                  <li><em>2</em><strong>{c.matchingStepConfirm}</strong><small>{c.structureLead}</small></li>
                  <li><em>3</em><strong>{c.matchingStepSend}</strong><small>{c.consultLead}</small></li>
                  <li><em>4</em><strong>{c.matchingStepFollow}</strong><small>{c.followLead}</small></li>
                </ol>
              </div>
              <aside className="client-card franchise-basket">
                <header className="client-priority-head">
                  <h2>{c.matchingBasket} <small dir="ltr">({Math.min(selected.matching?.length ?? 0, 2)})</small></h2>
                  <span className="client-soft-link">{c.matchingClear}</span>
                </header>
                <ul className="client-feed">
                  {(selected.matching ?? []).slice(0, 2).map((row) => (
                    <li key={row.id}><span><strong>{row.name}</strong><small>{networkStateLabel(row.status,locale)}</small></span></li>
                  ))}
                </ul>
                <p className="client-access-note">{c.matchingNoAmount}</p>
                <p className="franchise-mandate-banner" role="note">{c.privacyLead}</p>
                <Link href={`/${locale}/franchise/demandes/${selected.id}/consultation${query}`} className="franchise-cta">
                  {c.matchingSubmit} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
                <p className="client-access-note">{c.matchingSubmitNote}</p>
              </aside>
            </section>
          ) : selected && view === "consultation" ? (
            <>
              <FranchiseFolderTimeline locale={locale} activities={selected.activities} />
              {canMutateFranchiseFolder(selected.id, demo.canWrite&&Boolean(selected.rowVersion)) ? <FranchiseFolderActivityForm locale={locale} organizationId={org || null} prospectId={selected.id} defaultType="NOTE" /> : null}
            </>
          ) : selected && view === "suivi" ? (
            <>
              <FranchiseFolderTimeline locale={locale} events={selected.pipelineEvents} activities={selected.activities} />
              <p>{selected.nextFollowupAt ? selected.nextFollowupAt.slice(0, 10) : c.suiviEmpty}</p>
              {canMutateFranchiseFolder(selected.id, demo.canWrite&&Boolean(selected.rowVersion)) && selected.rowVersion && selected.stageCode ? (
                <FranchiseFolderAdvanceForm locale={locale} organizationId={org || null} prospectId={selected.id} stage={selected.stageCode} rowVersion={selected.rowVersion} />
              ) : null}
            </>
          ) : (
            <>
              <header className="franchise-section-head"><h2>{c.reqJourney}</h2></header>
              <ol className="franchise-mini-pipe">
                <li data-active="true"><em>1</em><strong>{c.need}</strong><small>{c.needLead}</small></li>
                <li><em>2</em><strong>{c.structure}</strong><small>{c.structureLead}</small></li>
                <li><em>3</em><strong>{c.consult}</strong><small>{c.consultLead}</small></li>
                <li><em>4</em><strong>{c.offer}</strong><small>{c.offerLead}</small></li>
                <li><em>5</em><strong>{c.mission}</strong><small>{c.missionLead}</small></li>
                <li><em>6</em><strong>{c.follow}</strong><small>{c.followLead}</small></li>
              </ol>
            </>
          )}
        </article>
        <FranchiseMandateRail locale={locale} name={mandateName} />
      </section>
    </main>
  );
}

export function QualityBoard({ locale, query, mandateName, view, search, page, board, libraryId, organizationId, services }: SpaceBoardProps) {
  const c = franchiseCopy(locale);
  const demo = resolveBoard({ locale, query, board });
  if(sourceUnavailable(demo,['QUALITY','CRM','OPERATIONS']))return <UnavailableSection locale={locale} query={query}/>;
  const needle = (search ?? "").trim().toLocaleLowerCase();
  const matches = (value: string) => !needle || value.toLocaleLowerCase().includes(needle);
  const qualityPath = view ? `/${locale}/franchise/qualite/${view}` : `/${locale}/franchise/qualite`;
  const supervision = view === "anomalies" ? demo.anomalies
    : view === "recommandations" ? demo.recommendations
      : view === "opportunites" ? demo.opportunities
        : view === "definitions" ? demo.definitions
          : view === "risques" ? demo.risks
            : view === "incidents" ? demo.incidents
              : null;
  const pagedSupervision = paginate(supervision?.filter((row) => matches(`${row.title} ${networkStateLabel(row.status,locale)} ${row.meta ?? ""}`)) ?? [], page);
  const pagedQuality = paginate(demo.quality.filter((row) => matches(`${row.title} ${row.type} ${networkStateLabel(row.status,locale)}`)), page);
  const supervisionEmpty = view === "anomalies" ? c.emptyAnomalies
    : view === "recommandations" ? c.emptyRecommendations
      : view === "opportunites" ? c.emptyOpportunities
        : view === "definitions" ? c.emptyDefinitions
          : view === "risques" ? c.emptyRisks
            : c.emptyIncidents;
  const steps = [
    { t: c.stepConsult, d: c.stepConsultLead },
    { t: c.stepExam, d: c.stepExamLead },
    { t: c.stepMotive, d: c.stepMotiveLead },
    { t: c.stepControl, d: c.stepControlLead },
  ];
  const reviewsCount = demo.quality.length;
  const nonConfCount = demo.quality.filter((row) => row.tone === "peach").length;
  const correctiveCount = demo.corrective.filter(row=>!["COMPLETED","CANCELLED"].includes(row.status)).length;
  const lateCount = demo.corrective.filter(row=>!["COMPLETED","CANCELLED"].includes(row.status)&&row.due<(renewalCivilDate(new Date().toISOString())??"")).length;
  const selectedReview = pagedQuality.rows[0] ?? demo.quality[0] ?? null;
  return (
    <main className="client-page franchise-quality-page">
      <Banner locale={locale} query={query} mandateName={mandateName} board={demo} />
      <section className="franchise-treat">
        <article className="franchise-kpi-tile" data-tone="sky"><span className="franchise-kpi-icon" data-tone="sky"><FileText className="size-4" aria-hidden /></span><span><strong dir="ltr">{reviewsCount}</strong><small>{c.reviewsDue}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="peach"><span className="franchise-kpi-icon" data-tone="peach"><Bell className="size-4" aria-hidden /></span><span><strong dir="ltr">{nonConfCount}</strong><small>{c.nonConformities}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="mint"><span className="franchise-kpi-icon" data-tone="mint"><ShieldCheck className="size-4" aria-hidden /></span><span><strong dir="ltr">{correctiveCount}</strong><small>{c.correctiveInProgress}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="peach"><span className="franchise-kpi-icon" data-tone="peach"><Bell className="size-4" aria-hidden /></span><span><strong dir="ltr">{lateCount}</strong><small>{c.lateItems}</small></span></article>
      </section>
      <form action={qualityPath} method="get" className="franchise-filters">
        <ScopeInputs query={query}/>
        <label><span className="sr-only">{c.search}</span><input name="q" defaultValue={search} placeholder={c.search} /></label>
        <button type="submit" className="franchise-scope-chip">{c.filter}</button>
      </form>
      <section className="franchise-workbench franchise-quality-workbench">
        <article className="client-card">
          <nav className="franchise-pill-tabs" aria-label={c.toExamine}>
            <Link href={`/${locale}/franchise/qualite/revues${query}`} className="franchise-pill-tab" data-active={!view || view === "revues" ? "true" : undefined}><span>{c.reviewsTab}</span><em dir="ltr">{reviewsCount}</em></Link>
            <Link href={`/${locale}/franchise/qualite/non-conformites${query}`} className="franchise-pill-tab" data-active={view === "non-conformites" ? "true" : undefined}><span>{c.nonConformities}</span><em dir="ltr">{nonConfCount}</em></Link>
            <Link href={`/${locale}/franchise/qualite/actions${query}`} className="franchise-pill-tab" data-active={view === "actions" ? "true" : undefined}><span>{c.corrective}</span><em dir="ltr">{correctiveCount}</em></Link>
          </nav>
          <nav className="franchise-inspector-tabs franchise-quality-subnav" aria-label={c.toExamine}>
            <Link href={`/${locale}/franchise/qualite${query}`} data-active={!view ? "true" : undefined}>{c.toExamine}</Link>
            <Link href={`/${locale}/franchise/qualite/anomalies${query}`} data-active={view === "anomalies" ? "true" : undefined}>{c.anomalies}</Link>
            <Link href={`/${locale}/franchise/qualite/recommandations${query}`} data-active={view === "recommandations" ? "true" : undefined}>{c.recommendations}</Link>
            <Link href={`/${locale}/franchise/qualite/opportunites${query}`} data-active={view === "opportunites" ? "true" : undefined}>{c.opportunities}</Link>
            <Link href={`/${locale}/franchise/qualite/definitions${query}`} data-active={view === "definitions" ? "true" : undefined}>{c.definitions}</Link>
            <Link href={`/${locale}/franchise/qualite/risques${query}`} data-active={view === "risques" ? "true" : undefined}>{c.risks}</Link>
            <Link href={`/${locale}/franchise/qualite/incidents${query}`} data-active={view === "incidents" ? "true" : undefined}>{c.incidents}</Link>
          </nav>
          {view === "definitions" || view === "risques" || view === "recommandations" || view === "incidents" ? (
            <p className="client-access-note">{c.ruleModelsLead}</p>
          ) : null}
          <div tabIndex={0} className="client-table-wrap">
            <table className="client-space-table franchise-dense-table">
              <thead><tr><th>{c.folder}</th><th>{c.type}</th><th>{c.severity}</th><th>{c.proofs}</th><th>{c.state}</th><th>{c.nextActionCol}</th><th>{c.action}</th></tr></thead>
              <tbody>
                {view === "actions" ? (
                  demo.corrective.length === 0 ? (
                    <tr><td colSpan={7}>{c.emptyCorrective}</td></tr>
                  ) : demo.corrective.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>{c.corrective}</td>
                      <td colSpan={2}><span className="client-access-note">{locale === "ar" ? "المالك والتواريخ غير متاحين هنا." : "Propriétaire et dates non disponibles ici."}</span></td>
                      <td><span className="client-status-chip" data-tone="peach">{networkStateLabel(row.status,locale)}</span></td>
                      <td>{row.due}</td>
                      <td><Cta href={`/${locale}/franchise/qualite/actions${query}`} soft>{c.open}</Cta></td>
                    </tr>
                  ))
                ) : view === "anomalies" || view === "recommandations" || view === "opportunites" || view === "definitions" || view === "risques" || view === "incidents" ? (
                  pagedSupervision.rows.length === 0 ? (
                    <tr><td colSpan={7}>{supervisionEmpty}</td></tr>
                  ) : pagedSupervision.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>{row.meta ?? row.status}</td>
                      <td>—</td>
                      <td dir="ltr">—</td>
                      <td><span className="client-status-chip">{networkStateLabel(row.status,locale)}</span></td>
                      <td>—</td>
                      <td><Cta href={row.href} soft>{c.open}</Cta></td>
                    </tr>
                  ))
                ) : pagedQuality.rows.length === 0 ? (
                  <tr><td colSpan={7}>{c.emptyQuality}</td></tr>
                ) : pagedQuality.rows.map((row, index) => (
                  <tr key={row.id} data-selected={index === 0 ? "true" : undefined}>
                    <td>{row.title}</td>
                    <td>{row.type}</td>
                    <td><span className="franchise-dot" data-tone={row.tone} /> {row.tone === "peach" ? (locale === "ar" ? "حرجة" : "Critique") : (locale === "ar" ? "مرتفعة" : "Élevée")}</td>
                    <td dir="ltr">—</td>
                    <td><span className="client-status-chip" data-tone={row.tone}>{networkStateLabel(row.status,locale)}</span></td>
                    <td>{row.next}</td>
                    <td><Cta href={row.href ?? `/${locale}/franchise/qualite${query}`} soft>{c.open}</Cta></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {view === "actions" ? null : <PaginationNav path={qualityPath} query={filterQuery(query,{q:search})} page={supervision ? pagedSupervision.page : pagedQuality.page} pageCount={supervision ? pagedSupervision.pageCount : pagedQuality.pageCount} label={c.toExamine} />}
        </article>
        <article className="client-card">
          <header><h2>{selectedReview ? selectedReview.title : c.reviewDetail}</h2></header>
          {view === "definitions" && libraryId && demo.permissions.canMaintainDefinitions ? (
            <FranchiseAnomalyDefinitionForm locale={locale} libraryId={libraryId} organizationId={organizationId || organizationIdFromQuery(query) || null} />
          ) : view === "risques" && libraryId && demo.permissions.canMaintainDefinitions ? (
            <FranchiseRiskDefinitionForm locale={locale} libraryId={libraryId} organizationId={organizationId || organizationIdFromQuery(query) || null} />
          ) : view === "recommandations" && libraryId && demo.permissions.canMaintainDefinitions ? (
            <FranchiseRecommendationDefinitionForm locale={locale} libraryId={libraryId} organizationId={organizationId || organizationIdFromQuery(query) || null} services={services ?? []} anomalies={demo.definitions} />
          ) : view === "incidents" && demo.permissions.canInstructDisputes ? (
            <>
              <p>{c.openingClientOnly}</p>
              <FranchiseIncidentInstructForm locale={locale} organizationId={organizationId || organizationIdFromQuery(query) || null} incidents={demo.incidents} />
            </>
          ) : (
            <>
              {selectedReview ? (
                <>
                  <em className="client-status-chip" data-tone={selectedReview.tone}>{selectedReview.status}</em>
                  <dl className="franchise-props"><div><dt>{c.type}</dt><dd>{selectedReview.type}</dd></div><div><dt>{c.state}</dt><dd>{networkStateLabel(selectedReview.status,locale)}</dd></div><div><dt>{c.nextAction}</dt><dd>{selectedReview.next}</dd></div></dl>
                  <h3>{c.requiredProofs}</h3>
                  {selectedReview.evidence?.length?<ul className="client-feed">{selectedReview.evidence.map(reference=><li key={reference}><bdi dir="auto">{reference}</bdi></li>)}</ul>:<p>{locale==="ar"?"لا تتضمن هذه القراءة إثباتات تحقق موثقة لهذا التنبيه.":"Cette lecture ne contient pas de preuves de contrôle documentées pour ce signalement."}</p>}
                  <h3>{locale==="ar"?"خطط التصحيح في نطاق التفويض":"Plans correctifs du mandat"}</h3>
                  {demo.corrective.length?<ul className="client-feed">{demo.corrective.map(plan=><li key={plan.id}><strong>{plan.title}</strong><span>{networkStateLabel(plan.status,locale)} · <time dateTime={plan.due}>{plan.due}</time></span></li>)}</ul>:<p>{locale==="ar"?"لا توجد خطة تصحيح مسجلة في هذا النطاق.":"Aucun plan correctif enregistré dans ce périmètre."}</p>}
                  <Link className="client-soft-link" href={`/${locale}/franchise/messages${query}`}>{locale==="ar"?"متابعة المعالجة عبر المراسلة":"Poursuivre l’instruction dans la messagerie"}</Link>

                </>
              ) : (
                <>
                  <p>{c.treatLead}</p>
                  <ol className="franchise-process">
                    {steps.map((step, index) => (
                      <li key={step.t}><span className="client-num">{index + 1}</span><span><strong>{step.t}</strong><small>{step.d}</small></span></li>
                    ))}
                  </ol>
                </>
              )}
              <p className="franchise-warning" role="note">{c.noSelf}</p>
              <Link href={`/${locale}/franchise/gouvernance${query}`} className="franchise-tool">{c.seeTrace}</Link>
            </>
          )}
        </article>
      </section>
    </main>
  );
}

export function PerformanceBoard({ locale, query, mandateName, view, board }: SpaceBoardProps) {
  const c = franchiseCopy(locale);
  const demo = resolveBoard({ locale, query, board });
  if(sourceUnavailable(board,['OPERATIONS']))return <UnavailableSection locale={locale} query={query}/>;
  const alertsUnavailable=sourceUnavailable(demo,["CRM","QUALITY"]);
  const metrics=demo.metrics;
  const requestCount=metrics?.requestCount??null;
  const missionDone=metrics?.completedMissions??null;
  const conversionLabel=metrics&&metrics.conversionDenominator>0?integerShare(metrics.convertedRequests,metrics.conversionDenominator,locale):"—";
  const capacityLabel=metrics&&metrics.capacityProviders>0?integerShare(metrics.availableProviders,metrics.capacityProviders,locale):"—";
  const serviceRows=(metrics?.byService??[]).map((row)=>({id:row.id,title:locale==="ar"?row.titleAr:row.titleFr,demandes:row.requests,status:metrics!.methodologyVersion,href:`/${locale}/franchise/demandes${query}`}));
  const maxDemandes=Math.max(1,...serviceRows.map((r)=>r.demandes));
  const shareRows=(metrics?.byProvider??[]).map((r)=>({id:r.organizationId,name:r.name,count:r.missions}));
  const shareTotal = shareRows.reduce((sum, row) => sum + row.count, 0);
  const shareColors = ["#642bef", "#3b82f6", "#14b8a6", "#f59e0b", "#ef4444"];
  return (
    <main className="client-page franchise-performance-page">
      <Banner locale={locale} query={query} mandateName={mandateName} board={demo} />
      <div className="franchise-section-head franchise-section-head-actions">
        <Link href={`/${locale}/franchise/gouvernance${query}`} className="franchise-tool">{c.perfMethodology}</Link>
      </div>
      <section className="franchise-treat franchise-perf-kpis">
        <article className="franchise-kpi-tile" data-tone="violet"><span className="franchise-kpi-icon" data-tone="violet"><FileText className="size-4" aria-hidden /></span><span><strong dir="ltr">{requestCount??"—"}</strong><small>{c.perfVolume}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="sky"><span className="franchise-kpi-icon" data-tone="sky"><LineChart className="size-4" aria-hidden /></span><span><strong dir="ltr">{metrics?.responseAverageSeconds==null?"—":`${new Intl.NumberFormat(locale==="ar"?"ar-MA":"fr-MA",{maximumFractionDigits:1}).format(metrics.responseAverageSeconds/3600)} h`}</strong><small>{c.perfResponseDelay}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="mint"><span className="franchise-kpi-icon" data-tone="mint"><ShieldCheck className="size-4" aria-hidden /></span><span><strong dir="ltr">{conversionLabel}</strong><small>{c.perfConversion}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="peach"><span className="franchise-kpi-icon" data-tone="peach"><Briefcase className="size-4" aria-hidden /></span><span><strong dir="ltr">{missionDone??"—"} / {metrics?.missionCount??"—"}</strong><small>{c.perfMissions}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="mint"><span className="franchise-kpi-icon" data-tone="mint"><CheckCircle2 className="size-4" aria-hidden /></span><span><strong dir="ltr">{metrics?.qualitySnapshot?`${new Intl.NumberFormat(locale==="ar"?"ar-MA":"fr-MA",{maximumFractionDigits:2}).format(metrics.qualitySnapshot.scoreBasisPoints/100)} %`:"—"}</strong><small>{c.perfQualityNote}</small></span></article>
        <article className="franchise-kpi-tile" data-tone="sky"><span className="franchise-kpi-icon" data-tone="sky"><Users className="size-4" aria-hidden /></span><span><strong dir="ltr">{capacityLabel}</strong><small>{c.perfCapacity} · {c.servicesCovered}</small></span></article>
      </section>
      <p className="client-access-note">{locale==="ar"?"النطاق: المكتبة التابعة للتفويض المحدد، كامل السجل حتى وقت القياس. التحويل: طلبات اختير لها مقدم خدمة / طلبات لها استشارة. القدرة: منظمات لها قدرة متاحة / منظمات صرحت بقدرة. الرسم: مهام فعلية غير ملغاة حسب منظمة مقدم الخدمة.":"Périmètre : bibliothèque du mandat sélectionné, historique complet jusqu’à la mesure. Conversion : demandes avec prestataire sélectionné / demandes ayant une consultation. Capacité : organisations disponibles / organisations ayant déclaré une capacité. Répartition : missions réelles hors annulations par organisation prestataire."} {metrics?<><bdi dir="ltr">{metrics.methodologyVersion} · {metrics.asOf}</bdi>{metrics.qualitySnapshot?<span> · {metrics.qualitySnapshot.modelVersion} · {metrics.qualitySnapshot.periodStart} — {metrics.qualitySnapshot.periodEnd}</span>:null}</>:<span role="status">{locale==="ar"?"القياسات غير متاحة حالياً.":"Mesures indisponibles pour le moment."}</span>}</p>
      {demo.performance.length?<section className="client-card"><h2>{c.objectives}</h2><ul className="client-feed">{demo.performance.map((item)=><li key={item.id}><span><strong>{item.title}</strong><small>{item.status} · {item.next}</small></span></li>)}</ul></section>:null}
      <section className="franchise-perf-mid">
        <article className="client-card">
          <header><h2>{c.perfVolume}</h2></header>
          <ul className="franchise-bar-chart" aria-label={c.perfVolume}>
            {serviceRows.length === 0 ? <li>{c.emptyPerformance}</li> : serviceRows.map((row) => (
              <li key={`vol-${row.id}`}>
                <span>{row.title}</span>
                <span className="franchise-bar-track"><span style={{ width: `${Math.round((row.demandes * 100) / maxDemandes)}%` }} /></span>
                <em dir="ltr">{row.demandes}</em>
              </li>
            ))}
          </ul>
        </article>
        <article className="client-card">
          <header><h2>{c.perfResponseDelay}</h2></header>
          <p className="franchise-empty-panel" role="status">{c.perfDelayUnavailable}</p>
        </article>
        <article className="client-card">
          <header className="client-priority-head"><h2>{c.alerts}</h2><em className="client-status-chip" data-tone="peach">{alertsUnavailable?"—":demo.attention.length}</em></header>
          <ul className="franchise-dot-list">
            {alertsUnavailable?<li role="status">{locale==="ar"?"التنبيهات غير متاحة حالياً.":"Alertes indisponibles pour le moment."}</li>:(demo.attention.length ? demo.attention : [{ id: "empty", title: c.noOut, href: `/${locale}/franchise/performance${query}` }]).map((item) => (
              <li key={item.id}><span className="franchise-dot" data-tone="peach" /><strong>{item.title}</strong><Cta href={item.href} soft>{c.open}</Cta></li>
            ))}
          </ul>
          <p className="client-access-note">{alertsUnavailable?(locale==="ar"?"لا يمكن تأكيد عدم وجود تنبيهات.":"L’absence d’alertes ne peut pas être confirmée."):c.noOut}</p>
        </article>
      </section>
      <section className="franchise-workbench franchise-perf-bottom">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.perfByService}</h2>
            <nav className="franchise-inspector-tabs" aria-label={c.objectives}>
              <Link href={`/${locale}/franchise/performance${query}`} data-active={!view ? "true" : undefined}>{c.objectives}</Link>
              <Link href={`/${locale}/franchise/performance/indicateurs${query}`} data-active={view === "indicateurs" ? "true" : undefined}>{c.object}</Link>
              <Link href={`/${locale}/franchise/performance/reseau${query}`} data-active={view === "reseau" ? "true" : undefined}>{c.netPeople}</Link>
              <Link href={`/${locale}/franchise/performance/tendances${query}`} data-active={view === "tendances" ? "true" : undefined}>{c.trendsTitle}</Link>
            </nav>
          </header>
          <div tabIndex={0} className="client-table-wrap">
            <table className="client-space-table franchise-dense-table">
              <thead><tr><th>{c.object}</th><th>{c.perfRequestsCol}</th><th>{c.state}</th><th>{c.nextAction}</th><th>{c.action}</th></tr></thead>
              <tbody>
                {view === "tendances" ? (
                  demo.quality.length === 0 ? <tr><td colSpan={5}>{c.emptyQuality}</td></tr> : demo.quality.map((row) => (
                    <tr key={row.id}><td>{row.title}</td><td dir="ltr">—</td><td><span className="client-status-chip" data-tone={row.tone}>{networkStateLabel(row.status,locale)}</span></td><td>{row.next}</td><td><Cta href={`/${locale}/franchise/qualite${query}`} soft>{c.perfSeeDetail}</Cta></td></tr>
                  ))
                ) : view === "reseau" ? (
                  demo.people.length === 0 ? <tr><td colSpan={5}>{c.emptyPeople}</td></tr> : demo.people.map((row) => (
                    <tr key={row.id}><td>{row.name}</td><td dir="ltr">—</td><td><span className="client-status-chip" data-tone={row.tone}>{networkStateLabel(row.status,locale)}</span></td><td>{row.next}</td><td><Cta href={`/${locale}/franchise/fournisseurs/${row.id}${query}`} soft>{c.openFolder}</Cta></td></tr>
                  ))
                ) : view === "indicateurs" && demo.corrective.length ? (
                  demo.corrective.map((row) => (
                    <tr key={row.id}><td>{row.title}</td><td dir="ltr">—</td><td><span className="client-status-chip" data-tone="peach">{networkStateLabel(row.status,locale)}</span></td><td>{row.due}</td><td><Cta href={`/${locale}/franchise/qualite/actions${query}`} soft>{c.open}</Cta></td></tr>
                  ))
                ) : serviceRows.length === 0 ? (
                  <tr><td colSpan={5}>{c.emptyPerformance}</td></tr>
                ) : serviceRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td dir="ltr">{row.demandes}</td>
                    <td><span className="client-status-chip" data-tone="sky">{networkStateLabel(row.status,locale)}</span></td>
                    <td>—</td>
                    <td><Cta href={row.href} soft>{c.perfSeeDetail}</Cta></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="client-card franchise-share-card">
          <header><h2>{c.perfShareTitle}</h2></header>
          {shareRows.length === 0 || shareTotal === 0 ? (
            <p className="franchise-empty-panel">{c.perfShareEmpty}</p>
          ) : (
            <div className="franchise-share-layout">
              <div
                className="franchise-donut"
                style={{
                  background: `conic-gradient(${shareRows.map((row, index) => {
                    const start = shareRows.slice(0, index).reduce((sum, item) => sum + item.count, 0);
                    const end = start + row.count;
                    return `${shareColors[index % shareColors.length]} ${(start * 100) / shareTotal}% ${(end * 100) / shareTotal}%`;
                  }).join(", ")})`,
                }}
                role="img"
                aria-label={`${shareTotal} ${c.perfShareCenter}`}
              >
                <span><strong dir="ltr">{shareTotal}</strong><small>{c.perfShareCenter}</small></span>
              </div>
              <ul className="franchise-share-legend">
                {shareRows.map((row, index) => (
                  <li key={row.id}>
                    <i style={{ background: shareColors[index % shareColors.length] }} aria-hidden />
                    <span><strong>{row.name}</strong><small dir="ltr">{row.count} · {integerShare(row.count, shareTotal, locale)}</small></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

export function FollowupsBoard({ locale, query, mandateName, view, page, board }: SpaceBoardProps) {
  const c = franchiseCopy(locale);
  const n = libraryCopy(locale);
  const demo = resolveBoard({ locale, query, board });
  if(sourceUnavailable(board,['FOLLOWUPS']))return <UnavailableSection locale={locale} query={query}/>;
  const followPath = view ? `/${locale}/franchise/relances/${view}` : `/${locale}/franchise/relances`;
  const pagedFollowups = paginate(demo.followups, page);
  const pagedJournal = paginate(demo.journal, page);
  const pipeline = view === "pipeline";
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);
  const dueMs = (row: { due: string }) => {
    const ms = Date.parse(row.due);
    return Number.isFinite(ms) ? ms : null;
  };
  const stages = [
    { id: "overdue", label: c.overdue, tone: "peach" as const, rows: demo.followups.filter((row) => { const ms = dueMs(row); return ms != null && ms < startOfToday.getTime(); }) },
    { id: "today", label: c.today, tone: "violet" as const, rows: demo.followups.filter((row) => { const ms = dueMs(row); return ms != null && ms >= startOfToday.getTime() && ms < endOfToday.getTime(); }) },
    { id: "upcoming", label: c.upcoming, tone: "mint" as const, rows: demo.followups.filter((row) => { const ms = dueMs(row); return ms != null && ms >= endOfToday.getTime(); }) },
    { id: "unscheduled", label: locale === "ar" ? "بدون موعد" : "Sans échéance", tone: "sky" as const, rows: demo.followups.filter((row) => dueMs(row) == null) },
  ];
  const overdue = stages[0]!.rows.length;
  const today = stages[1]!.rows.length;
  const upcoming = stages[2]!.rows.length;
  return (
    <main className="client-page">
      <Banner locale={locale} query={query} mandateName={mandateName} board={demo} />
      <section className="franchise-treat">
        <article className="franchise-kpi-tile" data-tone="violet" data-active={!view || view === "pipeline" ? "true" : undefined}>
          <span className="franchise-kpi-icon" data-tone="violet"><Bell className="size-4" aria-hidden /></span>
          <span><strong>{locale === "ar" ? "الكل" : "Toutes"}</strong><small dir="ltr">{demo.followups.length}</small></span>
        </article>
        <article className="franchise-kpi-tile" data-tone="peach">
          <span className="franchise-kpi-icon" data-tone="peach"><Bell className="size-4" aria-hidden /></span>
          <span><strong>{c.overdue}</strong><small dir="ltr">{overdue}</small></span>
        </article>
        <article className="franchise-kpi-tile" data-tone="peach">
          <span className="franchise-kpi-icon" data-tone="peach"><Bell className="size-4" aria-hidden /></span>
          <span><strong>{c.today}</strong><small dir="ltr">{today}</small></span>
        </article>
        <article className="franchise-kpi-tile" data-tone="mint">
          <span className="franchise-kpi-icon" data-tone="mint"><Bell className="size-4" aria-hidden /></span>
          <span><strong>{c.upcoming}</strong><small dir="ltr">{upcoming}</small></span>
        </article>
      </section>
      <div className="franchise-toolbar">
        <Link href={`/${locale}/franchise/relances/pipeline${query}`} className="franchise-tool" data-active={pipeline ? "true" : undefined}>{c.pipelineView}</Link>
        <Link href={`/${locale}/franchise/relances${query}`} className="franchise-tool" data-active={!pipeline && view !== "historique" ? "true" : undefined}>{c.listView}</Link>
        <Link href={`/${locale}/franchise/relances/historique${query}`} className="franchise-tool" data-active={view === "historique" ? "true" : undefined}>{c.govHistory}</Link>
      </div>
      <section className={pipeline ? "franchise-pipeline-layout" : "franchise-workbench"}>
        {pipeline ? (
          <>
            <div className="franchise-kanban" aria-label={c.pipelineView}>
              {stages.map((stage) => (
                <section key={stage.id} className="franchise-kanban-col" data-tone={stage.tone}>
                  <header>
                    <strong>{stage.label}</strong>
                    <em dir="ltr">{stage.rows.length}</em>
                  </header>
                  <ul>
                    {stage.rows.length === 0 ? (
                      <li className="franchise-kanban-card franchise-kanban-empty">
                        <small className="client-access-note">{n.emptyColumn}</small>
                      </li>
                    ) : stage.rows.map((row) => (
                      <li key={`${stage.id}-${row.id}`} className="franchise-kanban-card">
                        <strong>{row.title}</strong>
                        <small>{row.action}</small>
                        <em className="client-status-chip" data-tone={row.tone}>{row.due}</em>
                        <Cta href={row.href ?? `/${locale}/franchise/fournisseurs${query}`} soft>{c.open}</Cta>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <aside className="franchise-home-rail">
              <article className="client-card">
                <header><h2>{c.dailySummary}</h2></header>
                <ul className="franchise-dot-list">
                  <li><span className="franchise-dot" data-tone="peach" /><strong>{overdue} {c.overdue}</strong></li>
                  <li><span className="franchise-dot" data-tone="violet" /><strong>{today} {c.today}</strong></li>
                  <li><span className="franchise-dot" data-tone="mint" /><strong>{upcoming} {c.upcoming}</strong></li>
                </ul>
                <Link href={`/${locale}/franchise/digest${query}`} className="franchise-cta">{c.prepareFollowups}</Link>
              </article>
              <article className="client-card">
                <header className="client-priority-head"><h2>{c.govHistory}</h2></header>
                <ol className="franchise-activity">
                  {demo.journal.slice(0, 5).map((row) => (
                    <li key={row.id}><span className="franchise-dot" data-tone="violet" /><span><strong>{row.doc}</strong><small>{row.event} · {row.date}</small></span></li>
                  ))}
                </ol>
              </article>
            </aside>
          </>
        ) : (
          <>
            <article className="client-card">
              <div tabIndex={0} className="client-table-wrap">
                {view === "historique" ? (
                  <table className="client-space-table">
                    <thead><tr><th>{c.document}</th><th>{c.govHistory}</th><th>{c.dueWhen}</th></tr></thead>
                    <tbody>
                      {pagedJournal.rows.length === 0 ? (
                        <tr><td colSpan={3}>{c.emptyFollowups}</td></tr>
                      ) : pagedJournal.rows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.doc}</td>
                          <td>{row.event}</td>
                          <td>{row.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="client-space-table">
                    <thead><tr><th>{c.profile}</th><th>{c.dueWhen}</th><th>{c.followAction}</th><th>{c.action}</th></tr></thead>
                    <tbody>
                      {pagedFollowups.rows.length === 0 ? (
                        <tr><td colSpan={4}>{c.emptyFollowups}</td></tr>
                      ) : pagedFollowups.rows.map((row) => (
                        <tr key={row.id}>
                          <td><span className="franchise-row-title"><span className="franchise-kpi-icon" data-tone={row.tone}><Bell className="size-4" aria-hidden /></span>{row.title}</span></td>
                          <td><span className="client-status-chip" data-tone={row.tone}>{row.due}</span></td>
                          <td>{row.action}</td>
                          <td><Cta href={row.href ?? `/${locale}/franchise/fournisseurs${query}`} soft>{c.open}</Cta></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <PaginationNav path={followPath} query={query} page={view === "historique" ? pagedJournal.page : pagedFollowups.page} pageCount={view === "historique" ? pagedJournal.pageCount : pagedFollowups.pageCount} label={c.due} />
            </article>
            <FranchiseMandateRail locale={locale} name={mandateName} />
          </>
        )}
      </section>
    </main>
  );
}

export function GovernanceBoard({ locale, query, mandateName, view, board }: SpaceBoardProps) {
  const c = franchiseCopy(locale);
  const demo = resolveBoard({ locale, query, board });
  if(sourceUnavailable(board,['GOVERNANCE']))return <UnavailableSection locale={locale} query={query}/>;
  return (
    <main className="client-page">
      <Banner locale={locale} query={query} mandateName={mandateName} board={demo} />
      <section className="franchise-treat franchise-gov-summary">
        <article className="franchise-kpi-tile" data-tone="violet">
          <span className="franchise-kpi-icon" data-tone="violet"><ShieldCheck className="size-4" aria-hidden /></span>
          <span><strong>{mandateName ?? c.liveMandate}</strong><small>{c.liveMandate}</small></span>
        </article>
        <article className="franchise-kpi-tile" data-tone="sky">
          <span className="franchise-kpi-icon" data-tone="sky"><MapPin className="size-4" aria-hidden /></span>
          <span><strong>{demo.perimeter.territory}</strong><small>{c.territory}</small></span>
        </article>
        <article className="franchise-kpi-tile" data-tone="mint">
          <span className="franchise-kpi-icon" data-tone="mint"><FileText className="size-4" aria-hidden /></span>
          <span><strong>{demo.perimeter.mandate}</strong><small>{c.mandate}</small></span>
        </article>
        <article className="franchise-kpi-tile" data-tone="mint">
          <span className="franchise-kpi-icon" data-tone="mint"><ShieldCheck className="size-4" aria-hidden /></span>
          <span><strong>{c.canDo}</strong><small>{demo.perimeter.domains}</small></span>
        </article>
        <article className="franchise-kpi-tile" data-tone="peach">
          <span className="franchise-kpi-icon" data-tone="peach"><ShieldCheck className="size-4" aria-hidden /></span>
          <span><strong>{c.privacy}</strong><small>{c.scopeNote}</small></span>
        </article>
      </section>
      <section className="franchise-workbench">
        <article className="client-card">
          <header className="client-priority-head">
            <div>
              <h2>{c.decisions}</h2>
              <p>{c.decisionsLead}</p>
            </div>
          </header>
          <nav className="franchise-inspector-tabs" aria-label={c.decisions}>
            <Link href={`/${locale}/franchise/gouvernance/perimetre${query}`} data-active={view === "perimetre" ? "true" : undefined}>{c.authorized}</Link>
            <Link href={`/${locale}/franchise/gouvernance/approbations${query}`} data-active={view === "approbations" || !view ? "true" : undefined}>{c.inValidation}</Link>
            <Link href={`/${locale}/franchise/documents${query}`} data-active={undefined}>{locale === "ar" ? "الوثائق" : "Documents"}</Link>
            <Link href={`/${locale}/franchise/gouvernance/historique${query}`} data-active={view === "historique" ? "true" : undefined}>{c.govHistory}</Link>
          </nav>
          <div tabIndex={0} className="client-table-wrap" id="decisions">
            <table className="client-space-table">
              <thead><tr><th>{c.object}</th><th>{c.type}</th><th>{c.state}</th><th>{c.action}</th></tr></thead>
              <tbody>
                {demo.decisions.length === 0 ? (
                  <tr><td colSpan={4}>{c.emptyDecisions}</td></tr>
                ) : demo.decisions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{row.type}</td>
                    <td><span className="client-status-chip" data-tone="peach">{networkStateLabel(row.status,locale)}</span></td>
                    <td>
                      {view === "approbations"
                        ? row.status
                        : <Cta href={`/${locale}/franchise/gouvernance/approbations${query}#decisions`} soft>{c.prepare}</Cta>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <header className="franchise-section-head"><h2>{c.mandates}</h2></header>
          <ul className="client-feed">
            {demo.mandates.map((row) => (
              <li key={row.id}><span><strong>{row.title}</strong><small>{row.type}</small></span><em className="client-status-chip" data-tone="mint">{networkStateLabel(row.status,locale)}</em></li>
            ))}
          </ul>
        </article>
        <aside className="franchise-home-rail">
          <article className="client-card">
            <header><h2>{c.govTimeline}</h2></header>
            <ol className="franchise-activity">
              {demo.govHistory.map((item) => (
                <li key={item.id}><span className="franchise-dot" data-tone="mint" /><span><strong>{item.title}</strong><small>{item.actor}</small></span></li>
              ))}
              {demo.govHistory.length === 0 ? <li><span>{c.emptyGovernanceHistory}</span></li> : null}
            </ol>
          </article>
          <article className="client-card franchise-mandate-ok">
            <header><h2>{c.securityReminder}</h2></header>
            <p className="client-access-note">{c.scopeNote}</p>
          </article>
          <article className="client-card franchise-reminders">
            <header><h2>{c.requestModification}</h2></header>
            <p>{c.prepareDecLead}</p>
            <Link href={`/${locale}/franchise/messages${query}`} className="franchise-cta">{c.requestModification}</Link>
          </article>
        </aside>
      </section>
    </main>
  );
}

export function FranchiseFinanceBoard({ locale, query, mandateName, view, board, libraryId, organizationId }: SpaceBoardProps) {
  const c = franchiseCopy(locale);
  const demo = resolveBoard({ locale, query, board });
  if(sourceUnavailable(demo,view==='volume'?['OPERATIONS']:['GOVERNANCE']))return <UnavailableSection locale={locale} query={query}/>;
  if(view!=="volume"&&demo.financeBindingStatus==="UNAVAILABLE")return <UnavailableSection locale={locale} query={query} title={locale==="ar"?"التحقق المالي غير متاح":"Vérification financière indisponible"} message={locale==="ar"?"لم يتم تأكيد التحقق من ربط الدفاتر بالتفويض. لا يمكن استنتاج وجود رصيد أو غيابه. أعيدوا المحاولة أو اطلبوا المراجعة من الإدارة.":"La vérification du rattachement des livres au mandat n’est pas confirmée. Aucun solde ni absence de données ne peut être certifié. Réessayez ou demandez une revue à l’administration."}/>;
  const bindingReview=view!=="volume"&&demo.financeBindingStatus==="REVIEW_REQUIRED";
  const statements = demo.finance.filter((row) => row.kind !== "entryFee" && row.kind !== "payout" && row.title !== c.entryFee);
  const fees = demo.finance.filter((row) => row.kind === "entryFee" || row.title === c.entryFee);
  const payouts = demo.finance.filter((row) => row.kind === "payout");
  const preStatements = demo.finance.filter((row) => row.kind === "preStatement");
  const rows = view === "volume" ? demo.volume
    : view === "droit-entree" ? fees
      : view === "paiements" ? payouts
        : view === "pre-releve" ? preStatements
          : statements.length ? statements : demo.finance;
  const empty = bindingReview?(locale==="ar"?"يلزم التحقق من ربط الدفتر بالتفويض. لا يمكن تأكيد المبالغ غير المطابقة.":"Le rattachement du livre au mandat doit être rapproché. Les montants non rapprochés ne peuvent pas être certifiés."): view === "volume" ? c.emptyVolume
    : view === "droit-entree" ? c.emptyFinance
      : view === "paiements" ? c.emptyPayments
        : view === "pre-releve" ? c.emptyPreStatement
          : c.emptyFinance;
  const heading = view === "volume" ? c.volume
    : view === "droit-entree" ? c.entryFee
      : view === "paiements" ? c.payments
        : view === "pre-releve" ? c.preStatement
          : c.finItems;
  return (
    <main className="client-page">
      <Banner locale={locale} query={query} mandateName={mandateName} board={demo} />
      {bindingReview?<section className="client-card" role="alert"><h2>{locale==="ar"?"يلزم التحقق من ربط الدفتر بالتفويض":"Rapprochement du mandat requis"}</h2><p>{locale==="ar"?"تُعرض أدناه الكشوف المصرح بقراءتها والمتسقة فقط. لا يمكن تأكيد المجاميع أو صرف مبالغ من دفتر غير مربوط.":"Seuls les relevés cohérents et autorisés en lecture sont présentés ci-dessous. Les totaux et les versements d’un livre non rattaché ne peuvent pas être certifiés."}</p><Link className="client-soft-link" href={`/${locale}/franchise/gouvernance${query}`}>{locale==="ar"?"مراجعة التفويض":"Consulter le mandat"}</Link> · <Link className="client-soft-link" href={`/${locale}/franchise/messages${query}`}>{locale==="ar"?"طلب المعالجة":"Demander le rapprochement"}</Link></section>:null}
      <section className="franchise-treat">
        <article className="franchise-kpi-tile" data-tone="sky">
          <span className="franchise-kpi-icon" data-tone="sky"><FileText className="size-4" aria-hidden /></span>
          <span><strong dir="ltr">{bindingReview?"—":statements.length}</strong><small>{c.statements}</small></span>
        </article>
        <article className="franchise-kpi-tile" data-tone="peach">
          <span className="franchise-kpi-icon" data-tone="peach"><ShieldCheck className="size-4" aria-hidden /></span>
          <span><strong dir="ltr">{bindingReview?"—":fees.length}</strong><small>{c.entryFee}</small></span>
        </article>
        <article className="franchise-kpi-tile" data-tone="mint">
          <span className="franchise-kpi-icon" data-tone="mint"><FileText className="size-4" aria-hidden /></span>
          <span><strong dir="ltr">{bindingReview?"—":payouts.length}</strong><small>{c.payments}</small></span>
        </article>
      </section>
      <section className="franchise-workbench">
        <article className="client-card">
          <header><h2>{heading}</h2></header>
          <nav className="franchise-inspector-tabs" aria-label={c.finItems}>
            <Link href={`/${locale}/franchise/finance${query}`} data-active={!view ? "true" : undefined}>{c.statements}</Link>
            <Link href={`/${locale}/franchise/finance/pre-releve${query}`} data-active={view === "pre-releve" ? "true" : undefined}>{c.preStatement}</Link>
            <Link href={`/${locale}/franchise/finance/paiements${query}`} data-active={view === "paiements" ? "true" : undefined}>{c.payments}</Link>
            <Link href={`/${locale}/franchise/finance/volume${query}`} data-active={view === "volume" ? "true" : undefined}>{c.volume}</Link>
            <Link href={`/${locale}/franchise/finance/droit-entree${query}`} data-active={view === "droit-entree" ? "true" : undefined}>{c.entryFee}</Link>
          </nav>
          {view === "volume" ? (
            <>
              {rows.length === 0 ? <p>{empty}</p> : (
                <ul className="client-feed">
                  {rows.map((row) => (
                    <li key={row.id}><span><strong>{row.title}</strong><small>{"meta" in row ? row.meta : row.status}</small></span><em className="client-status-chip">{networkStateLabel(row.status,locale)}</em></li>
                  ))}
                </ul>
              )}
              <p className="client-access-note">{c.proposeVolume}</p>
              {demo.permissions.canProposeVolume && libraryId ? (
                <FranchiseVolumeProposeForm
                  locale={locale}
                  libraryId={libraryId}
                  franchiseId={new URLSearchParams(query.replace(/^\?/,"")).get("franchiseId")??demo.franchiseId??""}
                  organizationId={organizationId || organizationIdFromQuery(query) || null}
                  skus={demo.volume.filter((row) => row.status === "ACTIVE").map((row) => ({ id: row.id, title: row.title }))}
                />
              ) : null}
            </>
          ) : (
            <div tabIndex={0} className="client-table-wrap">
              <table className="client-space-table">
                <thead><tr><th>{c.document}</th><th>{c.linked}</th><th>{c.state}</th><th>{locale==="ar"?"المبلغ":"Montant"}</th></tr></thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={4}>{empty}</td></tr>
                  ) : rows.map((row) => (
                    <tr key={row.id}>
                      <td>{"href"in row&&row.href?<Link href={row.href} prefetch={false} className="client-soft-link">{row.title}</Link>:row.title}{"executionNotice"in row&&row.executionNotice?<small className="client-access-note">{row.executionNotice}</small>:null}</td>
                      <td>{"object" in row ? row.object : "—"}</td>
                      <td><span className="client-status-chip" data-tone={"tone" in row ? row.tone : "sky"}>{networkStateLabel(row.status,locale)}</span></td>
                      <td>{"auth" in row ? row.auth : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
        <article className="client-card">
          <header><h2>{c.understand}</h2></header>
          <p>{c.understandLead}</p>
          <p>{bindingReview?empty:demo.finance.some((row) => row.amount) ? c.yourShareLead : c.noAmount}</p>
          {view === "paiements" || view === "pre-releve" ? <p className="client-access-note">{c.paymentPlatformNote}</p> : <p className="client-access-note">{c.goodToKnowLead}</p>}
        </article>
        <FranchiseMandateRail locale={locale} name={mandateName} />
      </section>
    </main>
  );
}

export function DocumentsBoard({ locale, query, view, search, page, board }: SpaceBoardProps) {
  const c = franchiseCopy(locale);
  const n = libraryCopy(locale);
  const demo = resolveBoard({ locale, query, board });
  if(sourceUnavailable(demo,["OPERATIONS"]))return <UnavailableSection locale={locale} query={query}/>;
  const needle = (search ?? "").trim().toLocaleLowerCase();
  const source = view === "renouvellements"
    ? demo.renewals
    : view === "verifier"
      ? demo.documents.filter((row) => documentNeedsReview(row.status))
      : demo.documents;
  const filtered = source.filter((row) => !needle || `${row.title} ${row.owner} ${networkStateLabel(row.status,locale)}`.toLocaleLowerCase().includes(needle));
  const paged = paginate(filtered, page);
  const rows = paged.rows;
  const selected = rows[0] ?? null;
  const docsPath = view === "renouvellements" ? `/${locale}/franchise/documents/renouvellements` : `/${locale}/franchise/documents`;
  const toVerify = demo.documents.filter((row) => documentNeedsReview(row.status)).length;
  const expiring = demo.renewals.length;
  const dueDates = demo.renewals.map((row) => ("due" in row && row.due ? row.due : "")).filter(Boolean);
  return (
    <main className="client-page franchise-docs-page"><Banner locale={locale} query={query} board={demo}/>
      <div className="franchise-section-head franchise-section-head-actions">
        <span className="client-access-note franchise-secure-chip"><Lock className="size-4" aria-hidden /> {c.secureStorage}</span>
        <p className="client-access-note">{locale === "ar" ? "يودع مقدمو الخدمات الوثائق. تعرض هذه الخزنة الوثائق المرتبطة بخدمات التفويض المصرح به." : "Les prestataires déposent les pièces. Ce coffre présente les documents liés aux services du mandat autorisé."}</p>
      </div>
      <nav className="franchise-pill-tabs" aria-label={n.documentsTitle}>
        <Link href={`/${locale}/franchise/documents${query}`} className="franchise-pill-tab" data-active={!view ? "true" : undefined}><span>{c.allDocuments}</span><em dir="ltr">{sourceUnavailable(board,["OPERATIONS"])?"—":demo.documents.length}</em></Link>
        <Link href={`/${locale}/franchise/documents${query}${query?"&":"?"}vue=verifier`} className="franchise-pill-tab" data-active={view === "verifier" ? "true" : undefined}><span>{c.toVerify}</span><em dir="ltr">{sourceUnavailable(board,["OPERATIONS"])?"—":toVerify}</em></Link>
        <Link href={`/${locale}/franchise/documents/renouvellements${query}`} className="franchise-pill-tab" data-active={view === "renouvellements" ? "true" : undefined}><span>{c.expiringSoon}</span><em dir="ltr">{sourceUnavailable(board,["OPERATIONS"])?"—":expiring}</em></Link>
      </nav>
      <div className="franchise-toolbar">
        <form action={docsPath} method="get" className="franchise-search">
          <ScopeInputs query={query}/>{view==="verifier"?<input type="hidden" name="vue" value="verifier"/>:null}
          <label><span className="sr-only">{c.search}</span><input name="q" defaultValue={search} placeholder={c.search} /></label>
          <button type="submit" className="franchise-scope-chip">{c.search}</button>
        </form>
        <span className="franchise-sort-chip">{c.documentType}</span>
        <span className="franchise-sort-chip">{c.sensitivity}</span>
        <span className="franchise-sort-chip">{locale === "ar" ? "الحالة" : "État"}</span>
        <Link href={`/${locale}/franchise/documents${query}`} className="franchise-tool">{c.resetFilters}</Link>
      </div>
      <section className="franchise-docs-layout">
        <article className="client-card">
          <header><h2>{view === "renouvellements" ? n.renewals : n.documentsTitle}</h2></header>
          <div tabIndex={0} className="client-table-wrap">
            <table className="client-space-table franchise-docs-table franchise-dense-table">
              <thead>
                <tr>
                  <th>{c.document}</th>
                  <th>{c.folderProvider}</th>
                  <th>{c.documentType}</th>
                  <th>{c.sensitivity}</th>
                  <th>{c.ownerCol}</th>
                  <th>{c.expiresOn}</th>
                  <th>{c.state}</th>
                  <th>{c.action}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8}>{sourceUnavailable(board,view==="renouvellements"?["OPERATIONS"]:["CRM","OPERATIONS"])?(locale==="ar"?"القراءة غير مكتملة؛ لا يمكن تأكيد عدم وجود عناصر.":"La lecture est incomplète ; l’absence d’éléments ne peut pas être confirmée."):view === "renouvellements" ? c.emptyRenewals : n.noDocuments}</td></tr>
                ) : rows.map((row, index) => {
                  const sensitivity = documentAccess(locale);
                  return (
                    <tr key={row.id} data-selected={index === 0 ? "true" : undefined}>
                      <td><span className="franchise-row-title"><FileText className="size-4" aria-hidden />{row.title}</span></td>
                      <td>{row.owner}</td>
                      <td>{row.kind === "renewal" ? c.renewal : c.evidence}</td>
                      <td><em className="franchise-sensitivity" data-tone={sensitivity.tone}>{sensitivity.label}</em></td>
                      <td><span className="franchise-owner-chip">{row.owner.slice(0, 2).toUpperCase()}</span> {row.owner}</td>
                      <td dir="ltr">{"due" in row && row.due ? row.due : "—"}</td>
                      <td><span className="client-status-chip" data-tone={row.status.toLowerCase().includes("vérif") || row.status.toLowerCase().includes("examiner") ? "peach" : row.status.toLowerCase().includes("expire") ? "peach" : "mint"}>{networkStateLabel(row.status,locale)}</span></td>
                      <td><Cta href={row.href} soft>{c.open}</Cta></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationNav path={docsPath} query={filterQuery(query,{q:search,vue:view==="verifier"?"verifier":null})} page={paged.page} pageCount={paged.pageCount} label={n.documentsTitle} />
        </article>
        <aside className="franchise-home-rail">
          <article className="client-card franchise-renewal-calendar">
            <header><h2>{c.upcomingRenewals}</h2></header>
            {sourceUnavailable(board,["OPERATIONS"])?<p role="alert">{locale==="ar"?"مواعيد الوثائق والعقود غير متاحة مؤقتاً.":"Les échéances documentaires et contractuelles sont temporairement indisponibles."}</p>:<RenewalCalendar locale={locale} dueDates={dueDates} />}
          </article>
          <article className="client-card">
            <header><h2>{c.documentDetail}</h2></header>
            {selected ? (
              <dl className="franchise-props">
                <div><dt>{c.document}</dt><dd>{selected.title}</dd></div>
                <div><dt>{c.owner}</dt><dd>{selected.owner}</dd></div>
                <div><dt>{c.sensitivity}</dt><dd className="franchise-sensitivity" data-tone={documentAccess(locale).tone}>{documentAccess(locale).label}</dd></div>
                <div><dt>{c.state}</dt><dd className="client-status-chip" data-tone="mint">{networkStateLabel(selected.status,locale)}</dd></div>
                <div><dt>{c.documentKind}</dt><dd>{selected.kind === "renewal" ? c.renewal : c.evidence}</dd></div>
              </dl>
            ) : <p>{n.emptyDocumentsLead}</p>}
            <p className="client-access-note">{c.scopeNote}</p>
          </article>
          <article className="client-card">
            <header><h2>{c.accessHistory}</h2></header>
            <p className="franchise-empty-panel">{locale === "ar" ? "لا سجل وصول متاح هنا بعد." : "Aucun historique d’accès disponible ici pour le moment."}</p>
          </article>
        </aside>
      </section>
    </main>
  );
}

export function MessagesBoard({ locale, query, mandateName, view, search, page, board }: SpaceBoardProps) {
  const c = franchiseCopy(locale);
  const n = libraryCopy(locale);
  const demo = resolveBoard({ locale, query, board });
  if(sourceUnavailable(demo,view==='notifications'?['CRM','FOLLOWUPS','DIGEST']:['OPERATIONS']))return <UnavailableSection locale={locale} query={query}/>;
  const needle = (search ?? "").trim().toLocaleLowerCase();
  const filteredThreads = demo.messages.filter((row) => !needle || `${row.title} ${row.meta}`.toLocaleLowerCase().includes(needle));
  const filteredNotices = demo.notifications.filter((row) => !needle || `${row.title} ${row.meta}`.toLocaleLowerCase().includes(needle));
  const pagedThreads = paginate(filteredThreads, page);
  const pagedNotices = paginate(filteredNotices, page);
  const threads = pagedThreads.rows;
  const notices = pagedNotices.rows;
  return (
    <main className="client-page franchise-messages-page">
      <div className="franchise-section-head franchise-section-head-actions">
        <Link href={`/${locale}/franchise/notifications${query}`} className="franchise-tool">{c.notificationPrefs}</Link>
        <Link href={`/${locale}/franchise/gouvernance/historique${query}`} className="franchise-tool">{c.seeAuditHistory}</Link>
      </div>
      <div className="franchise-toolbar">
        <form action={`/${locale}/franchise/${view === "notifications" ? "notifications" : "messages"}`} method="get" className="franchise-search">
          <ScopeInputs query={query}/>
          <label><span className="sr-only">{c.search}</span><input name="q" defaultValue={search} placeholder={c.search} /></label>
          <button type="submit" className="franchise-scope-chip">{c.search}</button>
        </form>
        <Link href={`/${locale}/franchise/messages${query}`} className="franchise-tool franchise-tool-primary" data-active={!view || view !== "notifications" ? "true" : undefined}>{n.messagesTitle}</Link>
        <Link href={`/${locale}/franchise/notifications${query}`} className="franchise-tool" data-active={view === "notifications" ? "true" : undefined}>{n.notifications}</Link>
      </div>
      {view === "notifications" ? (
        <section className="franchise-workbench">
          <article className="client-card">
            <header><h2>{n.notifications}</h2></header>
            {notices.length === 0 ? <p className="franchise-empty-panel">{c.emptyNotifications}</p> : (
              <ul className="client-feed">
                {notices.map((row) => (
                  <li key={row.id}><Bell className="size-4" aria-hidden /><span><strong>{row.title}</strong><small>{row.meta}</small></span><Cta href={row.href} soft>{c.open}</Cta></li>
                ))}
              </ul>
            )}
            <PaginationNav path={`/${locale}/franchise/notifications`} query={filterQuery(query,{q:search})} page={pagedNotices.page} pageCount={pagedNotices.pageCount} label={n.notifications} />
          </article>
          <FranchiseMandateRail locale={locale} name={mandateName} />
        </section>
      ) : (
        <section className="client-card franchise-messages-layout space-y-4"><h2>{c.conversations}</h2><Link href={`/${locale}/franchise/messages${query}`} className="franchise-tool franchise-tool-primary">{c.newMessage}</Link>
          {threads.length===0?<p>{n.noMessages}</p>:<ul className="client-feed">{threads.map((row)=><li key={row.id}><span><strong>{row.title}</strong><small>{row.meta}</small></span><Cta href={row.href} soft>{c.open}</Cta></li>)}</ul>}
          <PaginationNav path={`/${locale}/franchise/messages`} query={filterQuery(query,{q:search})} page={pagedThreads.page} pageCount={pagedThreads.pageCount} label={n.messagesTitle}/>
        </section>
      )}
    </main>
  );
}
