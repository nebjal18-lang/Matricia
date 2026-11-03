import { FranchiseAccessPage } from "@/modules/franchise/ui/franchise-access-page";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FranchiseAccessState, FranchiseOrganizationSelector } from "@/modules/franchise/ui/franchise-access-state";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { resolveFranchiseNestedView } from "@/modules/franchise/data/spaces/nested-views";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { FranchiseLibraryHomeBoard, FranchiseLibraryStructureBoard, FranchiseQuestionsBoard, FranchiseWorkQueueBoard } from "@/modules/franchise/screens/library/library-boards";
import {
  FranchiseClientPreviewBranches,
  FranchiseQuestionnaireConstructor,
  FranchiseRuleConstructor,
  FranchiseServiceConstructor,
} from "@/modules/franchise/screens/library/constructors";
import { FranchiseQuestionnairesWorkbench, FranchiseRulesWorkbench, FranchiseServicesWorkbench } from "@/modules/franchise/screens/library/library-workbenches";
import { FranchiseValidationsWorkbench, FRANCHISE_VALIDATION_BUCKETS } from "@/modules/franchise/screens/library/validations-workbench";
import { requireFranchiseLibrary, franchiseMandateName, loadFranchiseSpaceFromLibrary } from "@/modules/franchise/screens/library/page-helper";
import {
  DocumentsBoard,
  FollowupsBoard,
  FranchiseFinanceBoard,
  FranchiseRequestsBoard,
  GovernanceBoard,
  MessagesBoard,
  NetworkBoard,
  PerformanceBoard,
  PerimeterBoard,
  QualityBoard,
} from "@/modules/franchise/screens/spaces/boards";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { isLocale, type Locale } from "@/modules/shared/lib/i18n/locale";

function commandIdentity() {
  return { idempotencyKey: randomUUID(), correlationId: randomUUID() };
}

function titleFor(locale: Locale, nested: NonNullable<ReturnType<typeof resolveFranchiseNestedView>>) {
  const n = libraryCopy(locale);
  const c = franchiseCopy(locale);
  if (nested.kind === "home" && nested.view === "actions") return { title: n.queueTitle, lead: n.queueLead };
  if (nested.kind === "home" && nested.view === "activite") return { title: n.activity, lead: n.homeLead };
  if (nested.kind === "library") return { title: n.libraryTitle, lead: n.libraryLead };
  if (nested.kind === "services" && (nested.create || nested.itemId)) return { title: undefined, lead: undefined };
  if (nested.kind === "services") return { title: n.servicesTitle, lead: n.servicesLead };
  if (nested.kind === "questionnaires" && (nested.create || nested.itemId || nested.tool === "apercu" || nested.tool === "simulation" || nested.view === "apercu" || nested.view === "simulation")) {
    return { title: undefined, lead: undefined };
  }
  if (nested.kind === "questionnaires") return { title: n.questionnairesTitle, lead: n.questionnairesLead };
  if (nested.kind === "rules" && (nested.create || nested.itemId)) return { title: undefined, lead: undefined };
  if (nested.kind === "rules") return { title: n.rulesTitle, lead: n.rulesLead };
  if (nested.kind === "validations") return { title: n.validationsTitle, lead: n.validationsLead };
  if (nested.kind === "network" && nested.itemId) return { title: c.providerFolderTitle, lead: c.providerFolderLead };
  if (nested.kind === "network") return { title: c.netTitleRich, lead: c.netLeadRich };
  if (nested.kind === "requests") return { title: c.reqTitle, lead: c.reqLead };
  if (nested.kind === "quality") return { title: c.qualTitleRich, lead: c.qualLeadRich };
  if (nested.kind === "performance") return { title: c.perfTitleRich, lead: c.perfLeadRich };
  if (nested.kind === "followups") return { title: c.folTitle, lead: c.folLead };
  if (nested.kind === "documents") return { title: c.docsTitleRich, lead: c.docsLeadRich };
  if (nested.kind === "messages") return { title: nested.view === "notifications" ? n.notifications : c.messagesTitleRich, lead: c.messagesLeadRich };
  if (nested.kind === "governance") return { title: c.govTitle, lead: c.govLead };
  if (nested.kind === "perimeter") return { title: c.periTitle, lead: c.periLead };
  return { title: c.finTitle, lead: c.finLead };
}

export async function FranchiseNestedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
  searchParams: Promise<{ organizationId?: string; franchiseId?:string; q?: string; stage?: string; owner?: string; page?: string; bucket?: string;type?:string;category?:string;selected?:string;service?:string;status?:string;capacity?:string;zone?:string;docs?:string }>;
}) {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !slug?.length) notFound();
  const nested = resolveFranchiseNestedView(slug);
  if (!nested) notFound();
  const { space, result } = await requireFranchiseLibrary({ returnPath: `/${locale}/franchise/${slug.join("/")}`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId:query.franchiseId,catalog:{kind:nested.kind==="validations"?(query.type==="SERVICE"||query.type==="QUESTIONNAIRE"||query.type==="RULE"?query.type:"ALL"):nested.kind==="rules"?"RULE":nested.kind==="questionnaires"?"QUESTIONNAIRE":(nested.kind==="library"&&nested.view==="questions")?"QUESTION":"SERVICE",page:query.page,search:query.q,categoryId:nested.kind==="validations"?query.category:undefined,objectId:nested.itemId??query.selected,status:nested.kind==="validations"?({brouillons:"DRAFT","en-cours":"REVIEW",corrections:"RETURNS",approuves:"APPROVED",publications:"PUBLISHED",historique:"ALL"}[nested.view??""]??"DRAFT"):"ALL"} });
  const mandateName = franchiseMandateName(result);
  const heading = titleFor(locale, nested);
  const c = libraryCopy(locale);
  const needsLive = ["home", "network", "requests", "quality", "performance", "followups", "governance", "perimeter", "finance", "documents", "messages"].includes(nested.kind);
  const board = needsLive && nested.view !== "actions" ? await loadFranchiseSpaceFromLibrary({ locale, query: space.selectedQuery, result }) : undefined;
  const commandScope = result.status === "success"
    ? {
      libraryId: result.workspace.mandate.libraryId,
      organizationId: result.workspace.mandate.operatorOrganizationId ?? space.selectedOrganizationId,
      services: result.workspace.services.map((item) => ({ id: item.id, title: item.title })),
    }
    : { libraryId: null as string | null, organizationId: space.selectedOrganizationId, services: [] as Array<{ id: string; title: string }> };
  const queueBucket = query.bucket === "waiting" || query.bucket === "corrections" || query.bucket === "done" ? query.bucket : "todo";
  const shellActions = nested.kind === "network" && nested.itemId ? (
    <Link href={`/${locale}/franchise/fournisseurs${space.selectedQuery}`} className="franchise-tool">{franchiseCopy(locale).providerFolderBack}</Link>
  ) : undefined;
  return (
    <FranchiseAppShell languagePath={space.currentPath}
      locale={locale}
      selectedQuery={space.selectedQuery} mandates={space.mandates}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active={nested.active}
      title={heading.title}
      lead={heading.lead}
      kicker={c.scope}
      mandateName={mandateName}
      actions={shellActions}
    >
      <FranchiseOrganizationSelector locale={locale} organizations={space.organizations} selectedOrganizationId={space.selectedOrganizationId} returnPath={`/${locale}/franchise/${slug.join("/")}`} />
      {result.status === "error" ? (
        <FranchiseAccessState locale={locale} reason={result.reason} returnPath={`/${locale}/franchise/${slug.join("/")}${space.selectedQuery}`} />
      ) : nested.kind === "home" && nested.view === "actions" ? (
        <FranchiseWorkQueueBoard locale={locale} query={space.selectedQuery} workspace={result.workspace} bucket={queueBucket} />
      ) : nested.kind === "home" ? (
        <FranchiseLibraryHomeBoard locale={locale} query={space.selectedQuery} workspace={result.workspace} />
      ) : nested.kind === "library" && (nested.view === "categories" || nested.view === "version" || nested.view === "historique") ? (
        <FranchiseLibraryStructureBoard locale={locale} query={space.selectedQuery} workspace={result.workspace} view={nested.view} commandIdentity={commandIdentity()} organizationId={commandScope.organizationId} />
      ) : nested.kind === "services" && nested.create ? (
        <FranchiseServiceConstructor locale={locale} query={space.selectedQuery} workspace={result.workspace} service={null} createMode commandIdentity={commandIdentity()} organizationId={space.selectedOrganizationId} />
      ) : nested.kind === "services" && (nested.tool === "simulation" || nested.view === "simulation") && nested.itemId ? (
        <FranchiseServiceConstructor locale={locale} query={space.selectedQuery} workspace={result.workspace} service={result.workspace.services.find((row) => row.id === nested.itemId) ?? null} createMode={false} commandIdentity={commandIdentity()} organizationId={space.selectedOrganizationId} />
      ) : nested.kind === "services" ? (
        <FranchiseServicesWorkbench locale={locale} query={space.selectedQuery} workspace={result.workspace} selectedId={nested.itemId} createMode={nested.create} organizationId={space.selectedOrganizationId} commandIdentity={commandIdentity()} />
      ) : nested.kind === "questionnaires" && nested.view === "questions" ? (
        <main className="client-page"><FranchiseQuestionsBoard query={space.selectedQuery} locale={locale} questions={result.workspace.questions} /></main>
      ) : nested.kind === "questionnaires" && (nested.tool === "apercu" || nested.tool === "simulation" || nested.view === "apercu" || nested.view === "simulation") ? (
        <FranchiseClientPreviewBranches locale={locale} query={space.selectedQuery} workspace={result.workspace} questionnaireId={nested.itemId} organizationId={space.selectedOrganizationId} />
      ) : nested.kind === "questionnaires" && (nested.create || nested.itemId) ? (
        <FranchiseQuestionnaireConstructor locale={locale} query={space.selectedQuery} workspace={result.workspace} selectedId={nested.itemId} createMode={nested.create} commandIdentity={commandIdentity()} organizationId={space.selectedOrganizationId} />
      ) : nested.kind === "questionnaires" ? (
        <FranchiseQuestionnairesWorkbench locale={locale} query={space.selectedQuery} workspace={result.workspace} selectedId={nested.itemId} createMode={nested.create} commandIdentity={commandIdentity()} organizationId={space.selectedOrganizationId} />
      ) : nested.kind === "rules" && (nested.create || nested.itemId) ? (
        <FranchiseRuleConstructor locale={locale} query={space.selectedQuery} workspace={result.workspace} selectedId={nested.itemId} createMode={nested.create} commandIdentity={commandIdentity()} organizationId={space.selectedOrganizationId} />
      ) : nested.kind === "rules" ? (
        <FranchiseRulesWorkbench locale={locale} query={space.selectedQuery} workspace={result.workspace} selectedId={nested.itemId} createMode={nested.create} commandIdentity={commandIdentity()} organizationId={space.selectedOrganizationId} />
      ) : nested.kind === "validations" ? (
        <FranchiseValidationsWorkbench locale={locale} query={space.selectedQuery} workspace={result.workspace} filters={query} bucket={nested.view && nested.view in FRANCHISE_VALIDATION_BUCKETS ? nested.view : null} commandIdentity={commandIdentity()} organizationId={space.selectedOrganizationId} />
      ) : nested.kind === "network" ? (
        <NetworkBoard networkFilters={query} locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} itemId={nested.itemId} search={query.q} page={query.page} board={board} organizationId={commandScope.organizationId} />
      ) : nested.kind === "requests" ? (
        <FranchiseRequestsBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} itemId={nested.itemId} search={query.q} stageFilter={query.stage} ownerFilter={query.owner} page={query.page} board={board} />
      ) : nested.kind === "quality" ? (
        <QualityBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} search={query.q} page={query.page} board={board} libraryId={commandScope.libraryId} organizationId={commandScope.organizationId} services={commandScope.services} />
      ) : nested.kind === "performance" ? (
        <PerformanceBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} board={board} />
      ) : nested.kind === "followups" ? (
        <FollowupsBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} page={query.page} board={board} />
      ) : nested.kind === "documents" ? (
        <DocumentsBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} search={query.q} page={query.page} board={board} />
      ) : nested.kind === "messages" ? (
        <MessagesBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} search={query.q} page={query.page} board={board} />
      ) : nested.kind === "governance" ? (
        <GovernanceBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} board={board} />
      ) : nested.kind === "perimeter" ? (
        <PerimeterBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} board={board} organizationId={commandScope.organizationId} />
      ) : (
        <FranchiseFinanceBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} board={board} libraryId={commandScope.libraryId} organizationId={commandScope.organizationId} />
      )}
    </FranchiseAppShell>
  );
}

export async function FranchiseServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; serviceId: string }>;
  searchParams: Promise<{ organizationId?: string; franchiseId?:string;q?:string;type?:string;category?:string;selected?:string;service?:string;status?:string;capacity?:string;zone?:string;docs?:string }>;
}) {
  const [{ locale, serviceId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({ returnPath: `/${locale}/franchise/services/${serviceId}`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId:query.franchiseId,catalog:{kind:"SERVICE",objectId:serviceId} });
  if (result.status !== "success") return <FranchiseAccessPage locale={locale} space={space} reason={result.reason} active="services" returnPath={`/${locale}/franchise/services/${serviceId}${space.selectedQuery}`} />;
  const c = libraryCopy(locale);
  const item = result.workspace.services.find((row) => row.id === serviceId) ?? null;
  if (!item) notFound();
  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="services" title={item?.title ?? c.servicesTitle} lead={c.serviceConstructorLead} kicker={c.scope} mandateName={result.workspace.mandate.libraryName}>
      <FranchiseServiceConstructor locale={locale} query={space.selectedQuery} workspace={result.workspace} service={item} createMode={false} organizationId={space.selectedOrganizationId} commandIdentity={commandIdentity()} />
    </FranchiseAppShell>
  );
}

export async function FranchiseQuestionnaireToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; questionnaireId: string; tool: string }>;
  searchParams: Promise<{ organizationId?: string; franchiseId?:string;q?:string;type?:string;category?:string;selected?:string;service?:string;status?:string;capacity?:string;zone?:string;docs?:string }>;
}) {
  const [{ locale, questionnaireId, tool }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const nested = resolveFranchiseNestedView(["questionnaires", questionnaireId, tool]);
  if (!nested) notFound();
  const { space, result } = await requireFranchiseLibrary({ returnPath: `/${locale}/franchise/questionnaires/${questionnaireId}/${tool}`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId:query.franchiseId,catalog:{kind:"QUESTIONNAIRE",objectId:questionnaireId} });
  if (result.status !== "success") return <FranchiseAccessPage locale={locale} space={space} reason={result.reason} active="questionnaires" returnPath={`/${locale}/franchise/questionnaires/${questionnaireId}/${tool}${space.selectedQuery}`} />;
  if (!result.workspace.questionnaires.some(row => row.id === questionnaireId)) notFound();
  const c = libraryCopy(locale);
  if (tool === "validation") {
    return (
      <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="validations" title={c.validationsTitle} lead={c.validationsLead} kicker={c.scope} mandateName={result.workspace.mandate.libraryName}>
        <FranchiseValidationsWorkbench locale={locale} query={space.selectedQuery} workspace={result.workspace} filters={query} commandIdentity={commandIdentity()} organizationId={space.selectedOrganizationId} />
      </FranchiseAppShell>
    );
  }
  if (tool === "apercu" || tool === "simulation") {
    return (
      <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="questionnaires" title={c.clientPreviewBranchesTitle} lead={c.clientPreviewBranchesLead} kicker={c.scope} mandateName={result.workspace.mandate.libraryName}>
        <FranchiseClientPreviewBranches locale={locale} query={space.selectedQuery} workspace={result.workspace} questionnaireId={questionnaireId} organizationId={space.selectedOrganizationId} />
      </FranchiseAppShell>
    );
  }
  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="questionnaires" title={c.questionnaireConstructorTitle} lead={c.questionnaireConstructorLead} kicker={c.scope} mandateName={result.workspace.mandate.libraryName}>
      <FranchiseQuestionnaireConstructor locale={locale} query={space.selectedQuery} workspace={result.workspace} selectedId={questionnaireId} createMode={false} commandIdentity={commandIdentity()} organizationId={space.selectedOrganizationId} />
    </FranchiseAppShell>
  );
}
