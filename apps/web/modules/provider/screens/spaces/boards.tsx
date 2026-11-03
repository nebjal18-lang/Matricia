import {capacitySummaryStatus} from "@/modules/provider/data/qualification/capacity-summary";
import {interventionModeLabel,type InterventionMode} from "@/modules/provider/data/qualification/intervention-modes";
import {moroccoRegionLabel} from "@/modules/shared/lib/geo/morocco-regions";
import Link from "next/link";
import { ArrowRight, CheckSquare, ClipboardList, Cloud, FileText, Paperclip, Plus, Search, Sprout, Star, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { formatMinor, type BillingDashboard } from "@/modules/provider/data/billing/model";
import { providerCopy } from "@/modules/provider/data/spaces/copy";
import { providerSearchQuery, type ProviderListRow } from "@/modules/provider/data/spaces/list-rows";
import { canApplyProviderSpaceDemo, demoProviderSpaces } from "@/modules/provider/data/spaces/demo";
import type { ProviderHomeSnapshot } from "@/modules/provider/data/home/repository";
import { toProviderPriorityRows, type ProviderPrioritySituation } from "@/modules/provider/data/home/view-model";
import type { ProviderDashboard, ProviderDocument, ProviderService } from "@/modules/provider/data/qualification/model";
import type { ProviderReputationDashboard } from "@/modules/provider/data/reputation/model";
import { getEligibilityReason, getProviderStatusLabel } from "@/modules/provider/screens/qualification/messages";
import type { UserActionItem } from "@/modules/shared/lib/action-center/model";
import { JourneyGlyph } from "@/modules/shared/ui/journey-glyph";
import { ProviderProfileRail } from "@/modules/provider/ui/provider-profile-rail";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function capacityStatusLabel(status: string, locale: Locale, fallback: string) {
  if(status==="UNAVAILABLE")return locale==="ar"?"حالة التوافر غير متاحة":"Disponibilité indisponible";
  const normalized = status.trim().toUpperCase();
  if (!status || status === "—" || status === fallback) return fallback;
  if (normalized === "AVAILABLE" || normalized === "OPEN" || normalized === "OPEN_TO_OPPORTUNITIES") {
    return locale === "ar" ? "مفتوح للفرص" : "Ouvert aux opportunités";
  }
  if (normalized === "LIMITED" || normalized === "PARTIAL") {
    return locale === "ar" ? "قدرة محدودة" : "Capacité limitée";
  }
  if(normalized==="MIXED")return locale==="ar"?"تختلف حسب الخدمة":"Variable selon le service";
  if(normalized==="NOT_DECLARED")return locale==="ar"?"غير معلنة":"Non déclarée";
  if(normalized==="FULL")return locale==="ar"?"ممتلئة":"Complète";
  if(normalized==="PAUSED")return locale==="ar"?"متوقفة":"En pause";
  if (normalized === "UNAVAILABLE" || normalized === "CLOSED") {
    return locale === "ar" ? "غير متاح" : "Indisponible";
  }
  return status;
}

function SearchForm({
  locale,
  path,
  query,
  label,
  value,
}: {
  locale: Locale;
  path: string;
  query: string;
  label: string;
  value?: string;
}) {
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const organizationId = params.get("organizationId");
  const tab = params.get("tab");
  const domain = params.get("domain");
  return (
    <form className="client-top-search" action={`/${locale}/sous-traitant/${path}`} method="get" role="search">
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      {tab ? <input type="hidden" name="tab" value={tab} /> : null}
      {domain ? <input type="hidden" name="domain" value={domain} /> : null}
      <Search className="size-4" aria-hidden />
      <label className="sr-only" htmlFor={`provider-search-${path}`}>{label}</label>
      <input id={`provider-search-${path}`} name="q" defaultValue={value ?? params.get("q") ?? ""} placeholder={label} />
    </form>
  );
}

function TabLink({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
  return <a href={href} aria-current={current ? "page" : undefined}>{children}</a>;
}

function Cta({ href, children, soft = false }: { href: string; children: ReactNode; soft?: boolean }) {
  return <Link href={href} className={soft ? "client-soft-link" : "client-ghost-link"}>{children}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link>;
}

const treatIcons = [ClipboardList, FileText, Paperclip, CheckSquare] as const;

function treatBadge(situation: ProviderPrioritySituation, locale: Locale) {
  const fr = locale === "fr";
  if (situation === "CONSULTATION") return fr ? "Nouvelle" : "جديدة";
  if (situation === "QUOTE_DRAFT" || situation === "QUOTE_DUE") return fr ? "À finaliser" : "للإنهاء";
  if (situation === "DOCUMENT") return fr ? "Pièce demandée" : "وثيقة مطلوبة";
  if (situation === "MILESTONE" || situation === "DELIVERABLE_REJECTED") return fr ? "À préparer" : "للتحضير";
  return fr ? "À traiter" : "للمعالجة";
}

function treatTone(situation: ProviderPrioritySituation): "sky" | "peach" | "mint" | "violet" {
  if (situation === "CONSULTATION") return "sky";
  if (situation === "QUOTE_DRAFT" || situation === "QUOTE_DUE") return "peach";
  if (situation === "DOCUMENT") return "mint";
  return "violet";
}

export function ProviderHomeBoard({
  locale,
  query,
  actionItems,
  snapshot,
}: {
  locale: Locale;
  query: string;
  actionItems?: readonly UserActionItem[];
  snapshot?: ProviderHomeSnapshot;
  organizationName?: string | null;
}) {
  const c = providerCopy(locale);
  const demo = demoProviderSpaces(locale, query);
  const live = actionItems !== undefined || !canApplyProviderSpaceDemo();
  const liveTreat = toProviderPriorityRows((actionItems ?? []).slice(0, 4), locale, query).map((row, index) => ({
    id: row.id,
    title: row.title,
    badge: treatBadge(row.situation, locale),
    detail: row.dossier,
    href: row.href,
    tone: treatTone(row.situation),
    icon: treatIcons[index] ?? FileText,
  }));
  const treatRows = live
    ? liveTreat
    : demo.treat.map((item, index) => ({ ...item, icon: treatIcons[index] ?? FileText }));
  const consultRows = live
    ? (snapshot?.status === "success" ? snapshot.consultations : [])
    : demo.consultations;
  const capacity = live
    ? (snapshot?.status === "success" ? snapshot.capacity : { status: c.capacityUnset, domains: c.capacityUnset, zones: c.capacityUnset })
    : demo.capacity;
  const capacityStatus = capacityStatusLabel(capacity.status, locale, c.capacityUnset);
  const showProfileCallout =
    snapshot === undefined ||
    (snapshot.status === "success" && snapshot.stage!==null && snapshot.stage !== "qualified");
  const journey = (() => {
    const fr = locale === "fr";
    const stage = snapshot?.status === "success" ? snapshot.stage : null;
    const pending = fr ? "À venir" : "قادمة";
    const done = fr ? "Complété" : "مكتمل";
    const current = fr ? "En cours" : "جارٍ";
    const unknown = fr ? "Non disponible" : "غير متاح";
    type JourneyState = "done" | "current" | "todo";
    return [
      { id: "j1", title: fr ? "Profil" : "الملف", detail: stage ? done : unknown, state: (stage ? "done" : "todo") as JourneyState },
      {
        id: "j2",
        title: fr ? "Qualification" : "التأهيل",
        detail: stage === "qualified" ? done : stage === "blocked" || stage === "new" ? current : unknown,
        state: (stage === "qualified" ? "done" : stage ? "current" : "todo") as JourneyState,
      },
      {
        id: "j3",
        title: fr ? "Opportunités" : "الفرص",
        detail: stage === "qualified" ? current : pending,
        state: (stage === "qualified" ? "current" : "todo") as JourneyState,
      },
      { id: "j4", title: fr ? "Devis" : "العروض", detail: pending, state: "todo" as JourneyState },
      { id: "j5", title: fr ? "Missions" : "المهام", detail: pending, state: "todo" as JourneyState },
      { id: "j6", title: fr ? "Réputation" : "السمعة", detail: pending, state: "todo" as JourneyState },
    ];
  })();
  return (
    <main className="client-page provider-home">{snapshot?.status==="success"&&snapshot.stage===null?<p role="alert" className="client-card">{locale==="ar"?"ملف التأهيل غير متاح. أعيدوا المحاولة من قسم التأهيل.":"Qualification indisponible. Réessayez depuis la rubrique Qualification."}</p>:null}
      {showProfileCallout ? (
      <section className="provider-profile-callout" aria-label={c.profileBanner}>
        <Sprout className="size-5" aria-hidden />
        <div>
          <strong>{c.profileBanner}</strong>
          <p>{c.profileBannerLead}</p>
        </div>
        <Link href={`/${locale}/sous-traitant/qualification${query}`} className="client-cta">{c.completeProfile} →</Link>
      </section>
      ) : null}

      <article className="client-card provider-home-treat" aria-labelledby="provider-treat-now">
        <header className="client-priority-head">
          <div>
            <h2 id="provider-treat-now"><Zap aria-hidden className="size-4" />{c.treatNow}</h2>
            <p>{c.treatLead}</p>
          </div>
          <Link href={`/${locale}/sous-traitant/consultations${query}`} className="client-text-link">{c.seeAll} →</Link>
        </header>
        <div className="provider-treat">
          {treatRows.length === 0 ? <p role="status">{c.treatEmpty}</p> : treatRows.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.id} href={item.href} className="provider-treat-card">
                <span className="client-feed-icon" data-tone={item.tone}><Icon className="size-4" aria-hidden /></span>
                <div>
                  <span className="provider-treat-badge" data-tone={item.tone}>{item.badge}</span>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            );
          })}
        </div>
      </article>

      <article className="client-card provider-journey-card">
        <header className="client-priority-head">
          <div>
            <h2>{c.journey}</h2>
            <p>{c.journeyLead}</p>
          </div>
          <Cta href={`/${locale}/sous-traitant/qualification${query}`} soft>{c.seeProfile}</Cta>
        </header>
        <ol className="client-journey">
          {journey.map((step, index) => (
            <li key={step.id} data-state={step.state}>
              <span><JourneyGlyph index={index} /></span>
              <small>{step.title}<em>{step.detail}</em></small>
            </li>
          ))}
        </ol>
      </article>

      <section className="client-board provider-home-grid">
        <article className="client-card">
          <header className="client-priority-head">
            <div>
              <h2>{c.adapted}</h2>
              <p>{c.adaptedLead}</p>
            </div>
            <Link href={`/${locale}/sous-traitant/consultations${query}`} className="client-text-link">{c.seeAllConsult}</Link>
          </header>
          {consultRows.length === 0 ? <p role="status">{c.adaptedEmpty}</p> : (
          <ul className="client-feed">
            {consultRows.map((row) => (
              <li key={row.id}>
                <span className="client-feed-icon" data-tone={row.tone}><FileText className="size-4" aria-hidden /></span>
                <span><strong>{row.title}</strong></span>
                <em data-tone={row.tone}>{row.status}</em>
                <Cta href={row.href}>{c.openFolder}</Cta>
              </li>
            ))}
          </ul>
          )}
        </article>
        <article className="client-card">
          <header><h2>{c.capacity}</h2></header>
          <p>{c.capacityLead}</p>
          <ul className="client-feed provider-capacity-feed">
            <li>
              <span>
                <strong>{c.availability}</strong>
                <small className="provider-capacity-status" data-open={capacityStatus === c.capacityOpen || /ouvert|مفتوح/i.test(capacityStatus) ? "true" : undefined}>
                  <i aria-hidden />
                  {capacityStatus}
                </small>
              </span>
            </li>
            <li><span><strong>{c.domains}</strong><small>{capacity.domains}</small></span></li>
            <li><span><strong>{c.zones}</strong><small>{capacity.zones}</small></span></li><li><span><strong>{c.modalities}</strong><small>{"modalities"in capacity?String(capacity.modalities??c.capacityUnset):c.capacityUnset}</small></span></li>
          </ul>
          <Cta href={`/${locale}/sous-traitant/qualification${query}#capacite`} soft>{c.refresh}</Cta>
        </article>
        <article className="client-card provider-reputation-card">
          <header><h2><Star aria-hidden className="size-4" />{c.reputation}</h2></header>
          <p>{c.reputationLead}</p>
          {live&&snapshot?.status==="success"&&snapshot.reputation.published===null?<p role="alert">{locale==="ar"?"السمعة غير متاحة. أعيدوا المحاولة من قسم السمعة.":"Réputation indisponible. Réessayez depuis la rubrique Réputation."}</p>:live && snapshot?.status === "success" && snapshot.reputation.published!==null&&snapshot.reputation.published > 0 ? (
            <p>{snapshot.reputation.latest ?? c.received}</p>
          ) : (
            <div className="provider-reputation-empty">
              <span className="provider-reputation-glyph" aria-hidden>
                <FileText className="size-8" />
                <Star className="size-4" />
              </span>
              <p>{c.reputationEmpty}</p>
            </div>
          )}
          <p className="provider-reputation-foot"><Sprout className="size-4" aria-hidden />{c.reputationFoot}</p>
          <Cta href={`/${locale}/sous-traitant/reputation${query}`} soft>{c.seeAll}</Cta>
        </article>
      </section>
    </main>
  );
}

export function QualificationBoard({ locale, query, dashboard }: { locale: Locale; query: string; dashboard?: ProviderDashboard | null }) {
  const c = providerCopy(locale);
  const demo = demoProviderSpaces(locale, query);
  const live = dashboard !== undefined || !canApplyProviderSpaceDemo();
  const services = dashboard?.services ?? [];
  const documents = dashboard?.documents ?? [];
  const overall = dashboard?.profile?.overallStatus;
  const statusLabel = overall ? getProviderStatusLabel(locale, overall) : c.underReview;
  const blocking = services.flatMap((service) => service.eligibility.reasons);
  const profileReady = Boolean(dashboard?.profile);
  const servicesReady = services.length > 0;
  const docsReady = documents.length > 0;
  const capacityReady = services.length>0&&services.every(service=>service.capacityStatus!=="NOT_DECLARED");
  const checklist = live
    ? [
        { id: "profile", title: c.checkActivity, status: profileReady ? c.statusSent : c.statusOpen, tone: profileReady ? "mint" : "peach", href: `/${locale}/sous-traitant/qualification${query}#qualification`, action: profileReady ? "open" : "complete" },
        { id: "services", title: c.checkServices, status: servicesReady ? c.statusSent : c.statusOpen, tone: servicesReady ? "mint" : "peach", href: `/${locale}/sous-traitant/services${query}`, action: "open" as const },
        { id: "capacity", title: c.checkCapacity, status: capacityReady ? c.statusSent : c.statusOpen, tone: capacityReady ? "mint" : "peach", href: `/${locale}/sous-traitant/services${query}`, action: capacityReady ? "open" : "complete" },
        { id: "docs", title: c.checkDocs, status: docsReady ? c.statusSent : c.statusOpen, tone: docsReady ? "mint" : "peach", href: `/${locale}/sous-traitant/documents${query}`, action: docsReady ? "open" : "complete" },
        { id: "decision", title: c.checkDecision, status: c.statusReview, tone: "violet" as const, href: `/${locale}/sous-traitant/qualification${query}`, action: "open" as const },
      ]
    : demo.checklist;
  const verifiedCategories = [c.verifiedIdentity, c.verifiedDocuments, c.verifiedServices, c.verifiedCapacity, c.verifiedRules];
  const verified = live
    ? (documents.filter((item) => item.status === "VERIFIED").map((item) => item.code).length
        ? documents.filter((item) => item.status === "VERIFIED").map((item) => item.code)
        : verifiedCategories)
    : demo.verified;
  const history = live
    ? documents.map((item) => ({ id: item.id, title: item.code, detail: `${item.kind} · ${item.status}` }))
    : demo.history;
  return (
    <main className="client-page provider-qualify">
      <section className="client-board">
        <article className="client-card provider-identity-card">
          <div className="provider-identity-main">
            <p className="client-space-label">{c.space}</p>
            <h2>{live && dashboard?.organizationName ? dashboard.organizationName : (locale === "ar" ? "ملفكم المهني" : "Votre profil professionnel")}</h2>
            <p>{live && dashboard?.profile?.activitySummary
              ? dashboard.profile.activitySummary.slice(0, 220)
              : (locale === "ar" ? "صفوا نشاطكم وكفاءاتكم لاستكمال الملف." : "Décrivez votre activité et vos compétences pour compléter le dossier.")}</p>
            <div className="provider-chip-row">
              <span className="client-status-chip" data-tone={profileReady ? "mint" : "peach"}>{statusLabel}</span>
              {live && dashboard?.profile ? (
                <span className="provider-meta-chip">{locale === "ar" ? `فريق: ${dashboard.profile.teamSize}` : `Équipe : ${dashboard.profile.teamSize}`}</span>
              ) : null}
            </div>
          </div>
          <Cta href={`/${locale}/sous-traitant/qualification${query}#qualification`}>{c.completeFolder}</Cta>
        </article>
      </section>
      <section className="client-board provider-qualify-status">
        <article className="client-card client-priority-head">
          <div>
            <h2>{c.folderState}</h2>
            <p className="client-status">{statusLabel}</p>
            <p>{c.reviewNote}</p>
            {blocking.length > 0 ? (
              <ul className="client-feed" aria-label={c.verified}>
                {[...new Set(blocking)].map((reason) => <li key={reason}><span>{getEligibilityReason(locale, reason)}</span></li>)}
              </ul>
            ) : null}
          </div>
          <aside className="provider-process-note">
            <strong>{c.processTransparent}</strong>
            <p>{c.processNote}</p>
            <Cta href={`/${locale}/sous-traitant/qualification/certifications${query}`} soft>
              {locale === "ar" ? "الشهادات والمراجع" : "Certifications et références"}
            </Cta>
          </aside>
        </article>
      </section>
      <section className="client-board client-board-compare">
        <article className="client-card">
          <header><h2>{c.checklist}</h2></header>
          <p>{c.checklistLead}</p>
          <ul className="client-feed">
            {checklist.map((item) => (
              <li key={item.id}>
                <span><strong>{item.title}</strong></span>
                <em data-tone={item.tone}>{item.status}</em>
                <Cta href={item.href} soft={item.action === "complete"}>{item.action === "complete" ? c.complete : c.open}</Cta>
              </li>
            ))}
          </ul>
        </article>
        <article className="client-card">
          <header><h2>{c.verified}</h2></header>
          <p>{c.verifiedLead}</p>
          <ul className="client-feed">
            {verified.map((item) => (
              <li key={item}><FileText className="size-4" aria-hidden /><span>{item}</span></li>
            ))}
          </ul>
          <p className="client-access-note">{c.notCert}</p>
        </article>
      </section>
      <section className="client-board">
        <article className="client-card">
          <header className="client-priority-head"><h2>{c.pieces}</h2><Cta href={`/${locale}/sous-traitant/qualification${query}#qualification`} soft>{c.addPiece}</Cta></header>
          <div className="provider-pieces-row">
            <Link href={`/${locale}/sous-traitant/qualification${query}#qualification`} className="client-drop">
              <Cloud className="size-6" aria-hidden />
              <p>{c.drop}</p>
              <small>{c.formats}</small>
            </Link>
            <p className="client-verified"><strong>{c.secureAccess}</strong><span>{c.secureLead}</span></p>
          </div>
        </article>
        <article className="client-card">
          <header><h2>{c.history}</h2></header>
          <p>{c.historyLead}</p>
          {history.length === 0 ? <p role="status">{locale === "ar" ? "لا سجل متاح بعد." : "Aucun historique disponible pour le moment."}</p> : (
            <>
              <ol className="client-journey">
                {history.map((item, index) => (
                  <li key={item.id} data-state={index === 0 ? "current" : "todo"}><span><JourneyGlyph index={index} /></span><small>{item.title}</small></li>
                ))}
              </ol>
              <ul className="client-feed">
                {history.map((item) => (
                  <li key={`${item.id}-d`}><span><strong>{item.title}</strong><small>{item.detail}</small></span></li>
                ))}
              </ul>
            </>
          )}
        </article>
      </section>
    </main>
  );
}

export function ServicesBoard({ locale, query, services, domain,regions,interventionModes }: { locale: Locale; query: string; services?: readonly ProviderService[]; domain?: string;regions?:readonly string[];interventionModes?:readonly InterventionMode[] }) {
  const c = providerCopy(locale);
  const demo = demoProviderSpaces(locale, query);
  const live = services !== undefined || !canApplyProviderSpaceDemo();
  const declared = services ?? [];
  const groups = live
    ? [...declared.reduce((map, service) => {
        const label = locale === "ar" ? service.libraryLabel.ar : service.libraryLabel.fr;
        const current = map.get(label) ?? [];
        current.push(service);
        map.set(label, current);
        return map;
      }, new Map<string, ProviderService[]>())].map(([label, items]) => ({ id: label, domain: label, items }))
    : [];
  const visibleGroups = live && domain ? groups.filter((group) => group.domain === domain) : groups;
  const capacityLead = live
    ? capacityStatusLabel(capacitySummaryStatus(declared), locale, c.capacityUnset)
    : demo.capacity.status;
  const delayLead = live
    ? (declared[0]?.leadTimeDays !== null && declared[0] ? `${declared[0].leadTimeDays} j` : c.capacityUnset)
    : c.indicativeDelay;
  const zonesLead = live ? regions?.map(code=>moroccoRegionLabel(code,locale)).join(" · ")||c.capacityUnset : demo.capacity.zones;
  const modalitiesLead = live ? interventionModes?.map(mode=>interventionModeLabel(mode,locale)).join(" · ")||c.capacityUnset : c.presentialRemote;
  const capacityByServiceLead = live
    ? (declared.length ? String(declared.length) : c.capacityUnset)
    : String(demo.services.reduce((n, g) => n + g.items.length, 0));
  const skillOptions = live
    ? declared.map((item) => ({ id: item.id, title: locale === "ar" ? item.label.ar : item.label.fr, href: `/${locale}/sous-traitant/qualification${query}#capacite` }))
    : demo.services.flatMap((group) => group.items.map((item) => ({ id: item.id, title: item.title, href: `/${locale}/sous-traitant/qualification${query}#capacite` })));
  const capacityHref = `/${locale}/sous-traitant/qualification${query}#capacite`;
  return (
    <main className="client-page provider-services">
      <div className="provider-settings-layout">
        <ProviderProfileRail locale={locale} query={query} active="services" />
        <div className="client-stack">
      <p className="client-safety">{c.svcExamined}</p>
      <section className="client-board client-board-compare">
        <article className="client-card">
          <header>
            <h2>{c.declared}</h2>
            <div className="client-table-tools">
              <SearchForm locale={locale} path="services" query={query} label={c.searchService} />
            </div>
          </header>
          <nav className="client-tabs" aria-label={c.declared}>
            <TabLink href={`/${locale}/sous-traitant/services${providerSearchQuery(query, { domain: undefined })}`} current={!domain}>{c.all}</TabLink>
            {(live ? groups : demo.services).map((group) => (
              <TabLink key={group.id} href={`/${locale}/sous-traitant/services${providerSearchQuery(query, { domain: group.domain })}`} current={domain === group.domain}>{group.domain}</TabLink>
            ))}
          </nav>
          {live && visibleGroups.length === 0 ? (
            <div>
              <p role="status">{c.svcEmpty}</p>
              <p className="client-access-note">{locale === "ar" ? "اختاروا مجالاً للبدء في التصريح بخدماتكم عبر التأهيل." : "Choisissez un domaine pour commencer à déclarer vos services via la qualification."}</p>
              <div className="provider-domain-empty">
                {[
                  { code: "IT", label: locale === "ar" ? "معلوميات" : "Informatique" },
                  { code: "COM", label: locale === "ar" ? "تواصل" : "Communication" },
                  { code: "ACC", label: locale === "ar" ? "محاسبة" : "Comptabilité" },
                  { code: "LEGAL", label: locale === "ar" ? "قانوني" : "Juridique" },
                  { code: "HR", label: locale === "ar" ? "موارد بشرية" : "Ressources humaines" },
                  { code: "INS", label: locale === "ar" ? "تأمين" : "Assurance" },
                  { code: "LOG", label: locale === "ar" ? "لوجستيك" : "Logistique" },
                  { code: "BTP", label: locale === "ar" ? "بناء" : "BTP" },
                  { code: "QHSE", label: locale === "ar" ? "جودة" : "Qualité / HSE" },
                  { code: "SALES", label: locale === "ar" ? "تجاري" : "Commercial" },
                ].map((domainItem) => (
                  <Link key={domainItem.code} href={`/${locale}/sous-traitant/qualification${providerSearchQuery(query, {})}#qualification`}>
                    <span aria-hidden>{domainItem.code.slice(0, 1)}</span>
                    {domainItem.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
          <ul className="client-feed" id="services-declares">
            {live
              ? visibleGroups.map((group) => (
                  <li key={group.id} className="provider-service-group">
                    <span><strong>{group.domain}</strong></span>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <span><strong>{locale === "ar" ? item.label.ar : item.label.fr}</strong><small>{capacityStatusLabel(item.capacityStatus, locale, c.capacityUnset)} · {item.requestStatus}</small></span>
                          <Cta href={capacityHref}>{c.edit}</Cta>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))
              : demo.services.map((group) => (
                  <li key={group.id} className="provider-service-group">
                    <span><strong>{group.domain}</strong></span>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <span><strong>{item.title}</strong><small>{item.path}</small></span>
                          <Cta href={capacityHref}>{c.edit}</Cta>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
          </ul>
          )}
        </article>
        <article className="client-card">
          <header><h2>{c.capacity}</h2></header>
          <p>{c.capacityLead}</p>
          <ul className="client-feed provider-capacity-feed">
            <li>
              <span>
                <strong>{c.availability}</strong>
                <small className="provider-capacity-status" data-open={/ouvert|مفتوح/i.test(capacityLead) ? "true" : undefined}>
                  <i aria-hidden />
                  {capacityLead}
                </small>
              </span>
              <Cta href={capacityHref}>{c.refresh}</Cta>
            </li>
            <li><span><strong>{c.zones}</strong><small>{zonesLead}</small></span><Cta href={capacityHref}>{c.refresh}</Cta></li>
            <li><span><strong>{c.modalities}</strong><small>{modalitiesLead}</small></span><Cta href={capacityHref}>{c.refresh}</Cta></li>
            <li><span><strong>{c.delays}</strong><small>{delayLead}</small></span><Cta href={capacityHref}>{c.refresh}</Cta></li>
            <li><span><strong>{c.capacityByService}</strong><small>{capacityByServiceLead}</small></span><Cta href={capacityHref}>{c.refresh}</Cta></li>
          </ul>
          <p className="client-access-note">{c.publicNote}</p>
        </article>
      </section>
      <article className="client-card">
        <header><h2>{c.skills}</h2></header>
        <p>{c.skillsLead}</p>
        {skillOptions.length === 0 ? <p role="status">{c.svcEmpty}</p> : (
        <ul className="client-feed">
          {skillOptions.map((item) => (
            <li key={item.id}><span><strong>{item.title}</strong></span><Cta href={item.href} soft>{c.addSkill}</Cta></li>
          ))}
        </ul>
        )}
      </article>
        </div>
      </div>
    </main>
  );
}

export function ConsultationsBoard({ locale, query, rows, empty, tab }: { locale: Locale; query: string; rows?: readonly ProviderListRow[]; empty?: string; tab?: string }) {
  const c = providerCopy(locale);
  const demo = demoProviderSpaces(locale, query);
  const list = rows ?? (canApplyProviderSpaceDemo() ? demo.consultRows : []);
  const current = tab || "all";
  return (
    <main className="client-page">
      <section className="client-board client-board-compare">
        <article className="client-card">
          <header>
            <SearchForm locale={locale} path="consultations" query={query} label={c.searchConsult} />
            <nav className="client-tabs" aria-label={c.consultTitle}>
              <TabLink href={`/${locale}/sous-traitant/consultations${providerSearchQuery(query, { tab: undefined })}`} current={current === "all"}>{c.all}</TabLink>
              <TabLink href={`/${locale}/sous-traitant/consultations${providerSearchQuery(query, { tab: "answer" })}`} current={current === "answer"}>{c.toAnswer}</TabLink>
              <TabLink href={`/${locale}/sous-traitant/consultations${providerSearchQuery(query, { tab: "preparing" })}`} current={current === "preparing"}>{c.preparing}</TabLink>
              <TabLink href={`/${locale}/sous-traitant/consultations${providerSearchQuery(query, { tab: "done" })}`} current={current === "done"}>{c.done}</TabLink>
            </nav>
          </header>
          <div className="client-table-wrap" id="consultations">
            <table className="client-space-table">
              <thead><tr><th>{c.consultation}</th><th>{c.scope}</th><th>{c.deadline}</th><th>{c.status}</th><th>{c.action}</th></tr></thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={5}><p role="status">{empty ?? (locale === "ar" ? "لا استشارة في الملف." : "Aucune consultation dans votre périmètre.")}</p></td></tr>
                ) : list.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{row.scope}</td>
                    <td>{row.deadline}</td>
                    <td><span className="client-status-chip" data-tone={row.tone}>{row.status}</span></td>
                    <td><Cta href={row.href}>{c.openFolder}</Cta></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="client-card">
          <header><h2>{c.beforeReply}</h2></header>
          <p>{c.beforeReplyLead}</p>
          <ul className="client-feed">
            <li><span><strong>{c.objective}</strong><small>{locale === "ar" ? "سياق الاستشارة وعناصرها" : "Le contexte et les éléments attendus de la consultation"}</small></span></li>
            <li><span><strong>{c.deliverables}</strong><small>{locale === "ar" ? "قائمة التسليمات المطلوبة" : "La liste des livrables demandés"}</small></span></li>
            <li><span><strong>{c.constraints}</strong><small>{locale === "ar" ? "القيود التقنية والتنظيمية" : "Les contraintes techniques, organisationnelles ou réglementaires"}</small></span></li>
            <li><span><strong>{c.allowedPieces}</strong><small>{locale === "ar" ? "أنواع الوثائق التي يمكن تقديمها" : "Les types de documents que vous pouvez fournir"}</small></span></li>
            <li><span><strong>{c.delay}</strong><small>{locale === "ar" ? "الأجل المتاح لردكم" : "Le délai dont vous disposez pour votre réponse"}</small></span></li>
          </ul>
          <p className="client-access-note">{c.consultPrivacy}</p>
        </article>
      </section>
      <section className="client-board">
        <article className="client-card">
          <header><h2>{c.prepare}</h2></header>
          <p>{c.prepareLead}</p>
          <ol className="client-journey">
            <li data-state="current"><span><JourneyGlyph index={0} /></span><small>1. {c.stepNeed}<em>{c.stepNeedLead}</em></small></li>
            <li data-state="todo"><span><JourneyGlyph index={1} /></span><small>2. {c.stepScope}<em>{c.stepScopeLead}</em></small></li>
            <li data-state="todo"><span><JourneyGlyph index={2} /></span><small>3. {c.stepQuote}<em>{c.stepQuoteLead}</em></small></li>
          </ol>
        </article>
        <article className="client-card">
          <header><h2>{c.linkedQ}</h2></header>
          <p>{c.linkedQLead}</p>
          <Cta href={`/${locale}/sous-traitant/messages${query}`} soft>{c.ask}</Cta>
        </article>
      </section>
    </main>
  );
}

export function QuotesBoard({ locale, query, rows, empty, tab }: { locale: Locale; query: string; rows?: readonly ProviderListRow[]; empty?: string; tab?: string }) {
  const c = providerCopy(locale);
  const demo = demoProviderSpaces(locale, query);
  const list = rows ?? (canApplyProviderSpaceDemo() ? demo.quotes : []);
  const current = tab || "all";
  return (
    <main className="client-page">
      <section className="client-board client-board-compare">
        <article className="client-card">
          <header>
            <h2>{c.proposals}</h2>
            <p className="client-access-note">{locale === "ar" ? "تتبعوا عروضكم مثل مسار ترشيحات: مسودات، إرسال، مراجعة ونتيجة." : "Suivez vos devis comme un parcours de candidatures : brouillons, envoi, révision et issue."}</p>
            <div className="client-table-tools">
              <SearchForm locale={locale} path="devis" query={query} label={c.searchQuote} />
              <nav className="client-tabs" aria-label={c.proposals}>
                <TabLink href={`/${locale}/sous-traitant/devis${providerSearchQuery(query, { tab: undefined })}`} current={current === "all"}>{c.all}</TabLink>
                <TabLink href={`/${locale}/sous-traitant/devis${providerSearchQuery(query, { tab: "drafts" })}`} current={current === "drafts"}>{c.drafts}</TabLink>
                <TabLink href={`/${locale}/sous-traitant/devis${providerSearchQuery(query, { tab: "submit" })}`} current={current === "submit"}>{c.toSubmit}</TabLink>
                <TabLink href={`/${locale}/sous-traitant/devis${providerSearchQuery(query, { tab: "submitted" })}`} current={current === "submitted"}>{c.submitted}</TabLink>
                <TabLink href={`/${locale}/sous-traitant/devis${providerSearchQuery(query, { tab: "revise" })}`} current={current === "revise"}>{c.toRevise}</TabLink>
                <TabLink href={`/${locale}/sous-traitant/devis${providerSearchQuery(query, { tab: "finished" })}`} current={current === "finished"}>{c.finished}</TabLink>
              </nav>
            </div>
          </header>
          <div className="client-table-wrap" id="devis">
            <table className="client-space-table">
              <thead><tr><th>{c.consultation}</th><th>{c.scope}</th><th>{c.status}</th><th>{c.nextAction}</th><th>{c.action}</th></tr></thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={5}><p role="status">{empty ?? (locale === "ar" ? "لا عرض مسجّل." : "Aucun devis enregistré.")}</p></td></tr>
                ) : list.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{row.scope}</td>
                    <td><span className="client-status-chip" data-tone={row.tone}>{row.status}</span></td>
                    <td>{row.next}</td>
                    <td><Cta href={row.href}>{row.action}</Cta></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="client-card">
          <header><h2>{c.structured}</h2></header>
          <p>{c.structuredLead}</p>
          <ol className="client-feed">
            {[{ t: c.s1, d: c.s1lead }, { t: c.s2, d: c.s2lead }, { t: c.s3, d: c.s3lead }, { t: c.s4, d: c.s4lead }, { t: c.s5, d: c.s5lead }].map((step, index) => (
              <li key={step.t}><span className="client-num">{index + 1}</span><span><strong>{step.t}</strong><small>{step.d}</small></span></li>
            ))}
          </ol>
          <Cta href={`/${locale}/sous-traitant/devis/nouveau${query}`} soft><Plus className="size-4" aria-hidden />{c.createQuote}</Cta>
        </article>
      </section>
      <article className="client-card">
        <header><h2>{c.beforeSubmit}</h2></header>
        <p>{c.beforeSubmitLead}</p>
        <ul className="client-feed">
          <li><span>{c.chk1}</span></li>
          <li><span>{c.chk2}</span></li>
          <li><span>{c.chk3}</span></li>
        </ul>
        <p>{c.taxNote}</p>
        <p className="client-access-note">{c.draftNote}</p>
      </article>
    </main>
  );
}

export function ProviderMissionsBoard({ locale, query, rows }: { locale: Locale; query: string; rows?: readonly ProviderListRow[] }) {
  const c = providerCopy(locale);
  const demo = demoProviderSpaces(locale, query);
  const live = rows !== undefined || !canApplyProviderSpaceDemo();
  const list = rows ?? (canApplyProviderSpaceDemo() ? demo.missions : []);
  return (
    <main className="client-page">
      <section className="client-board client-board-compare">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.currentMissions}</h2>
            <div className="client-table-tools">
              <SearchForm locale={locale} path="missions" query={query} label={c.searchGlobal} />
              <Link href={`/${locale}/sous-traitant/missions${query}`} className="client-text-link">{c.seeAllMissions}</Link>
            </div>
          </header>
          <div className="client-table-wrap">
            <table className="client-space-table">
              <thead><tr><th>{c.missions}</th><th>{c.stage}</th><th>{c.nextAction}</th><th>{c.access}</th><th>{c.action}</th></tr></thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={5}><p role="status">{locale === "ar" ? "لا مهمة جارية." : "Aucune mission en cours."}</p></td></tr>
                ) : list.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td><span className="client-status-chip" data-tone={row.tone}>{row.status}</span></td>
                    <td>{row.next}</td>
                    <td>{c.open}</td>
                    <td><Cta href={row.href}>{c.open}</Cta></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <header><h2>{c.prepareDeliverable}</h2></header>
          <p>{c.prepareDeliverableLead}</p>
          <p className="client-access-note" role="status">
            {locale === "ar"
              ? "إيداع الإثبات يتم من ملف المهمة، وليس من منطقة السحب هنا."
              : "Le dépôt de preuve se fait depuis le dossier de mission, pas depuis une zone de dépôt ici."}
          </p>
          <Cta href={`/${locale}/sous-traitant/missions${query}`}>{c.seeAllMissions}</Cta>
        </article>
        <div className="client-stack">
          <article className="client-card">
            <header><h2>{c.follow}</h2></header>
            {live ? (
              <>
                <p>{c.prepareDeliverableLead}</p>
                {list[0] ? <Cta href={list[0].href}>{c.open}</Cta> : <p role="status">{locale === "ar" ? "لا مهمة جارية." : "Aucune mission en cours."}</p>}
              </>
            ) : (
              <>
                <ol className="client-journey">
                  {demo.missionSteps.map((step, index) => (
                    <li key={step.id} data-state={step.state}><span><JourneyGlyph index={index} /></span><small>{step.title}</small></li>
                  ))}
                </ol>
                <ul className="client-feed">
                  {demo.missionSteps.map((step) => (
                    <li key={`${step.id}-d`}><span className="client-feed-icon" data-tone={step.state === "done" ? "mint" : step.state === "current" ? "violet" : "peach"} /><span><strong>{step.title}</strong><small>{step.detail}</small></span></li>
                  ))}
                </ul>
              </>
            )}
            <p className="client-access-note">{c.youAre}</p>
          </article>
          <article className="client-card">
            <header><h2>{c.amendments}</h2></header>
            <p>{c.amendmentsLead}</p>
            <p className="client-access-note">{c.noAmendment}</p>
          </article>
        </div>
      </section>
    </main>
  );
}

function documentTone(status: string): "mint" | "peach" | "violet" {
  if (status === "VERIFIED" || status === "APPROVED" || status === "ACTIVE") return "mint";
  if (status === "EXPIRED" || status === "INVALID" || status === "REJECTED") return "peach";
  return "violet";
}

export function ProviderDocumentsBoard({
  locale,
  query,
  documents,
  loadError = false,
  search = "",
  view = "all",
  page=1,
  hasMore=false,
}: {
  locale: Locale;
  query: string;
  documents?: readonly ProviderDocument[];
  loadError?: boolean;
  search?: string;
  view?: "all" | "qualification";
  page?:number;
  hasMore?:boolean;
}) {
  const c = providerCopy(locale);
  const qualifyHref = `/${locale}/sous-traitant/qualification${query}#documents`;
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const organizationId = params.get("organizationId");
  const tabHref = (next: "all" | "qualification") => {
    const nextParams = new URLSearchParams(params);
    if (next === "all") nextParams.delete("vue");
    else nextParams.set("vue", next);
    if (search.trim()) nextParams.set("q", search.trim());
    else nextParams.delete("q");
    const qs = nextParams.toString();
    return `/${locale}/sous-traitant/documents${qs ? `?${qs}` : ""}`;
  };
  const pageHref=(next:number)=>{const p=new URLSearchParams(params);p.set("page",String(next));if(search.trim())p.set("q",search.trim());if(view!=="all")p.set("vue",view);return `/${locale}/sous-traitant/documents?${p}`;};
  const needle = search.trim().toLocaleLowerCase();
  const rows = (documents ?? []).filter((document) => {
    if (view === "qualification" && !/LEGAL|FISCAL|INSURANCE|CERTIFICATION|LICENSE|ACCREDITATION|QUALIF|COMPLIANCE|IDENTITY/i.test(document.kind)) return false;
    if (!needle) return true;
    return `${document.code} ${document.kind} ${document.status}`.toLocaleLowerCase().includes(needle);
  });
  const renew = (documents ?? []).filter((document) => document.expiresOn);
  return (
    <main className="client-page">
      <section className="client-board client-board-compare">
        <article className="client-card">
          <header>
            <nav className="client-tabs" aria-label={c.docsTitle}>
              <Link href={tabHref("all")} aria-current={view === "all" ? "page" : undefined}>{c.all}</Link>
              <Link href={tabHref("qualification")} aria-current={view === "qualification" ? "page" : undefined}>{c.qualification}</Link>
            </nav>
            <form className="client-top-search" action={`/${locale}/sous-traitant/documents`} method="get">
              {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
              {view === "qualification" ? <input type="hidden" name="vue" value="qualification" /> : null}
              <Search className="size-4" aria-hidden />
              <label className="sr-only" htmlFor="provider-doc-search">{c.searchDoc}</label>
              <input id="provider-doc-search" name="q" defaultValue={search} placeholder={c.searchDoc} />
            </form>
          </header>
          {loadError ? <p role="alert">{c.docsLoadError}</p> : null}
          <nav aria-label={locale==="ar"?"صفحات الوثائق":"Pages des documents"}>{page>1?<Link href={pageHref(page-1)} className="client-ghost-link">{locale==="ar"?"السابق":"Précédente"}</Link>:null} <span>{locale==="ar"?"الصفحة":"Page"} {page}</span> {hasMore?<Link href={pageHref(page+1)} className="client-ghost-link">{locale==="ar"?"التالي":"Suivante"}</Link>:null}</nav>
          {!loadError && rows.length === 0 ? <p role="status">{c.docsEmpty}</p> : null}
          {rows.length > 0 ? (
          <div className="client-table-wrap" id="docs">
            <table className="client-space-table">
              <thead><tr><th>{c.document}</th><th>{c.usage}</th><th>{c.status}</th><th>{c.access}</th><th>{c.action}</th></tr></thead>
              <tbody>
                {rows.map((document) => (
                  <tr key={document.id}>
                    <td><Link className="client-text-link" href={`/${locale}/sous-traitant/documents/${document.id}${query}`}>{document.code} · v{document.version}</Link></td>
                    <td>{getProviderStatusLabel(locale,document.kind)}</td>
                    <td><span className="client-status-chip" data-tone={documentTone(document.status)}>{getProviderStatusLabel(locale, document.status)}</span></td>
                    <td>{c.docsPrivate}</td>
                    <td>{document.scanStatus === "CLEAN" ? <a href={`/api/provider/documents/${document.id}`} className="client-ghost-link">{c.open}</a> : <span role="status">{document.scanStatus === "PENDING" ? (locale === "ar" ? "الفحص جارٍ" : "Analyse en attente") : (locale === "ar" ? "في الحجر" : "En quarantaine")}</span>} <Cta href={qualifyHref}>{c.replace}</Cta></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : null}
        </article>
        <div className="client-stack">
          <article className="client-card">
            <header><h2>{c.renew}</h2></header>
            <p>{c.renewLead}</p>
            {renew.length === 0 ? <p>{c.docsNoneRenew}</p> : (
            <ul className="client-feed">
              {renew.map((item) => (
                <li key={item.id}><span>{item.code}<small dir="ltr">{item.expiresOn}</small></span><Cta href={qualifyHref} soft>{c.add}</Cta></li>
              ))}
            </ul>
            )}
          </article>
          <article className="client-card">
            <header><h2>{c.accessConf}</h2></header>
            <p>{c.accessConfLead}</p>
            <p>{c.youControl}</p>
          </article>
        </div>
      </section>
      <article className="client-card">
        <header><h2>{c.addFromComputer}</h2></header>
        <p>{c.docFormats}</p>
        <Cta href={qualifyHref}>{c.addPiece}</Cta>
      </article>
    </main>
  );
}

export function BillingBoard({ locale, query, dashboard }: { locale: Locale; query: string; dashboard?: BillingDashboard | null }) {
  const c = providerCopy(locale);
  const demo = demoProviderSpaces(locale, query);
  const live = dashboard !== undefined || !canApplyProviderSpaceDemo();
  return (
    <main className="client-page">
      <section className="client-space-kpis">
        <Link href={`/${locale}/sous-traitant/facturation/pre-releve${query}`} className="client-card client-insight"><span className="client-feed-icon" data-tone="violet"><FileText className="size-4" aria-hidden /></span><div><h3>{c.toPrepare}</h3><p>{c.toPrepareLead}</p></div><ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link>
        <Link href={`/${locale}/sous-traitant/facturation/factures-matricia${query}`} className="client-card client-insight"><span className="client-feed-icon" data-tone="peach"><FileText className="size-4" aria-hidden /></span><div><h3>{c.toSend}</h3><p>{c.toSendLead}</p></div><ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link>
        <Link href={`/${locale}/sous-traitant/facturation/echeancier${query}`} className="client-card client-insight"><span className="client-feed-icon" data-tone="mint"><FileText className="size-4" aria-hidden /></span><div><h3>{c.toFollow}</h3><p>{c.toFollowLead}</p></div><ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link>
      </section>
      <section className="client-board client-board-compare">
        <article className="client-card">
          <header><h2>{c.finDocs}</h2></header>
          {live && (!dashboard || dashboard.invoices.length === 0) ? <p>{c.finFoot}</p> : (
          <table className="client-space-table">
            <thead><tr><th>{c.document}</th><th>{c.linkedMission}</th><th>{c.status}</th><th>{c.nextAction}</th><th>{c.action}</th></tr></thead>
            <tbody>
              {(live && dashboard ? dashboard.invoices.map((row) => ({ id: row.id, title: row.number, mission: row.dueOn, tone: "sky" as const, status: row.paymentStatus.replaceAll("_", " "), next: row.outstandingMinor === "0" ? "—" : row.dueOn, action: c.seeDetail })) : demo.invoices).map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.mission}</td>
                  <td><span className="client-status-chip" data-tone={row.tone}>{row.status}</span></td>
                  <td>{row.next}</td>
                  <td><Cta href={`/${locale}/sous-traitant/facturation/${row.id}${query}`}>{row.action}</Cta></td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </article>
        <article className="client-card">
          <header><h2>{c.beforeSend}</h2></header>
          <p>{c.beforeSendLead}</p>
          <ul className="client-feed">
            <li><span><strong>{c.b1}</strong><small>{c.b1lead}</small></span></li>
            <li><span><strong>{c.b2}</strong><small>{c.b2lead}</small></span></li>
            <li><span><strong>{c.b3}</strong><small>{c.b3lead}</small></span></li>
          </ul>
          <p className="client-access-note">{c.moneyNote}</p>
        </article>
      </section>
      <article className="client-card">
        <header className="client-priority-head"><h2>{c.reconcil}</h2><Cta href={`/${locale}/sous-traitant/facturation/commissions${query}`}>{c.seeDetail}</Cta></header>
        <p>{c.reconcilLead}</p>
        {live && (!dashboard || (dashboard.payments.length === 0 && dashboard.allocations.length === 0)) ? <p>{c.finFoot}</p> : (
        <table className="client-space-table">
          <thead><tr><th>{c.document}</th><th>{c.linkedMission}</th><th>{c.recStatus}</th><th>{c.payStatus}</th><th>{c.nextAction}</th></tr></thead>
          <tbody>
            {(live && dashboard ? dashboard.payments.map((row) => ({ id: row.id, title: row.reference, mission: row.paidOn, rec: formatMinor(row.allocatedMinor, row.currency, locale), pay: formatMinor(row.unallocatedMinor, row.currency, locale), next: row.paidOn })) : demo.reconcil).map((row) => (
              <tr key={row.id}>
                <td>{row.title}</td>
                <td>{row.mission}</td>
                <td>{row.rec}</td>
                <td>{row.pay}</td>
                <td>{row.next}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        <p className="client-access-note">{c.finFoot}</p>
      </article>
    </main>
  );
}

export function ReputationBoard({ locale, query, dashboard }: { locale: Locale; query: string; dashboard?: ProviderReputationDashboard | null }) {
  const c = providerCopy(locale);
  const demo = demoProviderSpaces(locale, query);
  const live = dashboard !== undefined || !canApplyProviderSpaceDemo();
  const reviews = live
    ? (dashboard?.feedback ?? []).map((item, index) => ({
        id: `${item.publishedAt}-${index}`,
        title: locale === "ar" ? (item.axes[0]?.messageAr ?? c.received) : (item.axes[0]?.messageFr ?? c.received),
        status: `${item.rankingPosition}/${item.rankedQuoteCount}`,
        action: "detail" as const,
      }))
    : demo.reviews;
  const badges = live
    ? (dashboard?.badges ?? []).filter((badge) => badge.decision === "PUBLISHED").map((badge) => ({
        id: badge.evaluationId,
        title: locale === "ar" ? badge.labelAr : badge.labelFr,
        detail: badge.rationale ?? badge.code,
      }))
    : demo.badges;
  return (
    <main className="client-page">
      <article className="client-card">
        <header><h2>{c.howReviews}</h2></header>
        <p>{c.howReviewsLead}</p>
        <ol className="client-journey">
          <li data-state="done"><span><JourneyGlyph index={0} /></span><small>{c.stepClosed}</small></li>
          <li data-state="current"><span><JourneyGlyph index={1} /></span><small>{c.stepAsked}</small></li>
          <li data-state="todo"><span><JourneyGlyph index={2} /></span><small>{c.stepChecked}</small></li>
          <li data-state="todo"><span><JourneyGlyph index={3} /></span><small>{c.stepVisible}</small></li>
        </ol>
        <p>{c.authentic}</p>
      </article>
      <section className="client-board client-board-compare">
        <article className="client-card" id="retours">
          <header className="client-priority-head">
            <div>
              <h2>{c.received}</h2>
              <p>{c.receivedLead}</p>
            </div>
            <nav className="client-tabs" aria-label={c.received}>
              <a href="#retours" aria-current="page">{c.received}</a>
              <a href="#badges">{c.badges}</a>
            </nav>
          </header>
          {reviews.length === 0 && live ? <p role="status">{c.reviewsEmpty}</p> : (
          <ul className="client-feed">
            {reviews.map((row) => (
              <li key={row.id}>
                <span><strong>{row.title}</strong><small>{row.status}</small></span>
                <Cta href={row.action === "reply" ? `/${locale}/sous-traitant/messages${query}` : `/${locale}/sous-traitant/reputation${query}#retours`} soft={row.action === "reply"}>{row.action === "reply" ? c.reply : c.seeDetail}</Cta>
              </li>
            ))}
          </ul>
          )}
        </article>
        <article className="client-card" id="badges">
          <header><h2>{c.badges}</h2></header>
          <p>{c.badgesLead}</p>
          <ul className="provider-badge-grid">
            {badges.map((badge) => (
              <li key={badge.id} className="provider-badge-card"><span><strong>{badge.title}</strong><small>{badge.detail}</small></span></li>
            ))}
          </ul>
          <p className="client-access-note">{c.badgesNote}</p>
        </article>
      </section>
      <article className="client-card">
        <header><h2>{c.improve}</h2></header>
        <p>{c.improveLead}</p>
        <section className="client-space-kpis">
          <Link href={`/${locale}/sous-traitant/documents${query}`} className="client-insight"><span><strong>{c.addMissing}</strong><small>{c.addMissingLead}</small></span><em>{c.addPiece}</em></Link>
          <Link href={`/${locale}/sous-traitant/services${query}`} className="client-insight"><span><strong>{c.updateCapacity}</strong><small>{c.updateCapacityLead}</small></span><em>{c.refresh}</em></Link>
          <Link href={`/${locale}/sous-traitant/missions${query}`} className="client-insight"><span><strong>{c.soigner}</strong><small>{c.soignerLead}</small></span><em>{c.seeTips}</em></Link>
        </section>
        <p className="client-access-note">{c.reviewsFoot}</p>
      </article>
    </main>
  );
}
