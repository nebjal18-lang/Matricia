import { FranchiseAccessPage } from "@/modules/franchise/ui/franchise-access-page";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { messageCursorSchema } from "@/modules/shared/lib/internal-messaging/model";
import { loadFranchiseDashboard } from "@/modules/franchise/data/governance/repository";
import { GovernancePanel } from "@/modules/franchise/screens/gouvernance/governance-panel";
import { getFranchiseMessages } from "@/modules/franchise/screens/gouvernance/messages";
import { loadFranchiseFollowups } from "@/modules/franchise/data/followups/repository";
import { FollowupPanel } from "@/modules/franchise/screens/relances/panel";
import { getFollowupMessages } from "@/modules/franchise/screens/relances/messages";
import { loadFranchiseMessaging } from "@/modules/franchise/data/messaging/repository";
import { FranchiseMessagesWorkspace } from "@/modules/franchise/screens/messages/messages-workspace";
import { loadFranchiseCrm } from "@/modules/franchise/data/crm/repository";
import { FranchisePerformancePanel } from "@/modules/franchise/screens/performance/performance-panel";
import { getFranchiseCrmMessages } from "@/modules/franchise/screens/performance/messages";
import { loadNativeFranchiseControl } from "@/modules/franchise/data/performance/native-control";
import { FranchiseNativePerformancePanel } from "@/modules/franchise/screens/performance/native-control-panel";
import { loadFranchiseGovernanceSignals } from "@/modules/franchise/data/governance-signals/repository";
import { FranchiseGovernanceSignalsPanel } from "@/modules/franchise/screens/performance/governance-signals-panel";
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
  type FranchiseNetworkBase,
  PerformanceBoard,
  PerimeterBoard,
  QualityBoard,
} from "@/modules/franchise/screens/spaces/boards";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { isLocale, type Locale } from "@/modules/shared/lib/i18n/locale";
import type { ReactNode } from "react";

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
  searchParams: Promise<{ organizationId?: string; franchiseId?: string; q?: string; stage?: string; owner?: string; page?: string; bucket?: string; type?: string; category?: string; selected?: string; service?: string; status?: string; capacity?: string; zone?: string; docs?: string; before?: string; beforeId?: string; eventPlanId?: string; afterEventId?: string; fil?: string }>;
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
  const networkBase: FranchiseNetworkBase = slug[0] === "reseau" ? "reseau" : "fournisseurs";
  const networkListBase = `/${locale}/franchise/${networkBase}`;
  const shellActions = nested.kind === "network" && nested.itemId ? (
    <Link href={`${networkListBase}${space.selectedQuery}`} className="franchise-tool">{franchiseCopy(locale).providerFolderBack}</Link>
  ) : undefined;
  const fc = franchiseCopy(locale);
  let performancePanels: ReactNode = null;
  let performanceCrmPanel: ReactNode = null;
  let governanceOpsPanel: ReactNode = null;
  let followupsOpsPanel: ReactNode = null;
  let messagingWorkspace: ReactNode = null;
  if (result.status === "success") {
    const franchiseId = result.workspace.mandate.franchiseId;
    if (nested.kind === "performance") {
      const [nativeControl, governanceSignals, crm] = await Promise.all([
        loadNativeFranchiseControl(franchiseId, { before: query.before, id: query.beforeId, eventPlanId: query.eventPlanId, afterEventId: query.afterEventId }),
        loadFranchiseGovernanceSignals(franchiseId),
        loadFranchiseCrm(franchiseId),
      ]);
      if ([nativeControl, governanceSignals, crm].some((load) => load.status === "error" && load.reason === "UNAUTHENTICATED")) {
        redirect(connexionHref(locale, { next: space.currentPath }));
      }
      const crmMessages = getFranchiseCrmMessages(locale);
      const crmKeys: Record<string, string> = {};
      if (crm.status === "success") {
        crm.dashboard.franchises.forEach((f) => {
          crmKeys[`create:${f.id}`] = randomUUID();
          crmKeys[`snapshot:${f.id}`] = randomUUID();
        });
        crm.dashboard.prospects.forEach((p) => {
          crmKeys[`activity:${p.id}`] = randomUUID();
          crmKeys[`advance:${p.id}`] = randomUUID();
        });
      }
      performancePanels = (
        <>
          <FranchiseNativePerformancePanel locale={locale} result={nativeControl} returnPath={space.currentPath} />
          <FranchiseGovernanceSignalsPanel locale={locale} result={governanceSignals} returnPath={space.currentPath} />
        </>
      );
      performanceCrmPanel = (
        <details id="performance" className="client-ops">
          <summary>{fc.opsPerf}</summary>
          {crm.status === "error" ? (
            <WorkspaceFailure locale={locale} reason={crm.reason} returnPath={space.currentPath} supportReference="FRANCHISE_PERFORMANCE_CRM" />
          ) : (
            <FranchisePerformancePanel dashboard={crm.dashboard} locale={locale} m={crmMessages} keys={crmKeys} />
          )}
        </details>
      );
    }
    if (nested.kind === "governance") {
      const governanceMessages = getFranchiseMessages(locale);
      const governanceResult = await loadFranchiseDashboard(locale, {
        franchiseId,
        organizationId: result.workspace.mandate.operatorOrganizationId ?? undefined,
        libraryId: result.workspace.mandate.libraryId,
      });
      if (governanceResult.status === "error" && governanceResult.reason === "UNAUTHENTICATED") {
        redirect(connexionHref(locale, { next: space.currentPath }));
      }
      const governanceKeys: Record<string, string> = { invitation: randomUUID() };
      if (governanceResult.status === "success") {
        governanceResult.dashboard.approvals.forEach((value) => {
          governanceKeys[`approval:${value.id}`] = randomUUID();
        });
        governanceResult.dashboard.books.forEach((value) => {
          governanceKeys[`fee:${value.id}`] = randomUUID();
          governanceKeys[`close:${value.id}`] = randomUUID();
          governanceKeys[`payout:${value.id}`] = randomUUID();
        });
      }
      governanceOpsPanel = (
        <details id="gouvernance" className="client-ops" open>
          <summary>{fc.opsGov}</summary>
          {governanceResult.status === "error" ? (
            <WorkspaceFailure locale={locale} reason={governanceResult.reason} returnPath={space.currentPath} supportReference="FRANCHISE_GOVERNANCE" />
          ) : (
            <GovernancePanel returnPath={space.currentPath} dashboard={governanceResult.dashboard} locale={locale} m={governanceMessages} keys={governanceKeys} />
          )}
        </details>
      );
    }
    if (nested.kind === "followups") {
      const followupMessages = getFollowupMessages(locale);
      const followupsResult = await loadFranchiseFollowups(franchiseId);
      if (followupsResult.status === "error" && followupsResult.reason === "UNAUTHENTICATED") {
        redirect(connexionHref(locale, { next: space.currentPath }));
      }
      followupsOpsPanel = (
        <details id="relances" className="client-ops" open>
          <summary>{fc.opsFollow}</summary>
          {followupsResult.status === "error" ? (
            <Alert variant="destructive">
              <AlertTitle>{followupsResult.reason === "FORBIDDEN" ? followupMessages.accessDenied : followupMessages.loadFailed}</AlertTitle>
              <AlertDescription>{followupsResult.reason}</AlertDescription>
            </Alert>
          ) : (
            <FollowupPanel
              dashboard={followupsResult.dashboard}
              locale={locale}
              m={followupMessages}
              keys={{
                propose: Object.fromEntries(followupsResult.dashboard.franchises.filter((f) => f.canWrite).map((f) => [f.id, randomUUID()])),
                preference: Object.fromEntries(followupsResult.dashboard.prospects.map((p) => [p.id, randomUUID()])),
                decision: Object.fromEntries(
                  followupsResult.dashboard.policies
                    .filter((p) => p.status === "PENDING_APPROVAL" && p.proposedBy !== followupsResult.dashboard.currentUserId)
                    .map((p) => [p.id, randomUUID()]),
                ),
              }}
            />
          )}
        </details>
      );
    }
    if (nested.kind === "messages") {
      const messagePage = Number(query.page ?? 1);
      const parsedCursor = messageCursorSchema.safeParse({ createdAt: query.before, id: query.beforeId });
      const cursorInvalid = Boolean(query.before || query.beforeId) && !parsedCursor.success;
      const loaded = !cursorInvalid
        ? await loadFranchiseMessaging({
            franchiseId,
            threadId: query.fil,
            search: (query.q ?? "").trim(),
            page: messagePage,
            cursor: parsedCursor.success ? parsedCursor.data : undefined,
          })
        : null;
      const scope = {
        locale,
        organizationId: result.workspace.mandate.operatorOrganizationId!,
        franchiseId,
        commandKey: randomUUID(),
      };
      const messagePath = `/${locale}/franchise/${slug.join("/")}`;
      const messageLink = (updates: Record<string, string | null>) => {
        const values = new URLSearchParams(space.selectedQuery.replace(/^\?/, ""));
        if (query.q) values.set("q", query.q);
        if (query.fil) values.set("fil", query.fil);
        if (query.page) values.set("page", query.page);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null) values.delete(k);
          else values.set(k, v);
        }
        const qs = values.toString();
        return qs ? `${messagePath}?${qs}` : messagePath;
      };
      messagingWorkspace =
        !loaded || loaded.status === "error" ? (
          <main className="client-page">
            <p role="alert">
              {locale === "ar"
                ? "تعذر تحميل المراسلة. تحققوا من الرابط وأعيدوا المحاولة."
                : "La messagerie n’a pas pu être chargée. Vérifiez le lien et réessayez."}
            </p>
          </main>
        ) : (
          <FranchiseMessagesWorkspace
            locale={locale}
            scope={scope}
            loaded={loaded}
            link={messageLink}
            searchQuery={query.q}
            queryFil={query.fil}
            queryBefore={query.before}
          />
        );
    }
  }
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
        <NetworkBoard networkBase={networkBase} networkFilters={query} locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} itemId={nested.itemId} search={query.q} page={query.page} board={board} organizationId={commandScope.organizationId} />
      ) : nested.kind === "requests" ? (
        <FranchiseRequestsBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} itemId={nested.itemId} search={query.q} stageFilter={query.stage} ownerFilter={query.owner} page={query.page} board={board} />
      ) : nested.kind === "quality" ? (
        <QualityBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} search={query.q} page={query.page} board={board} libraryId={commandScope.libraryId} organizationId={commandScope.organizationId} services={commandScope.services} />
      ) : nested.kind === "performance" ? (
        <>
          {performancePanels}
          <PerformanceBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} board={board} />
          {performanceCrmPanel}
        </>
      ) : nested.kind === "followups" ? (
        <>
          <FollowupsBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} page={query.page} board={board} />
          {followupsOpsPanel}
        </>
      ) : nested.kind === "documents" ? (
        <DocumentsBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} search={query.q} page={query.page} board={board} />
      ) : nested.kind === "messages" ? (
        messagingWorkspace ?? (
          <MessagesBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} search={query.q} page={query.page} board={board} />
        )
      ) : nested.kind === "governance" ? (
        <>
          <GovernanceBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} view={nested.view} board={board} />
          {governanceOpsPanel}
        </>
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
