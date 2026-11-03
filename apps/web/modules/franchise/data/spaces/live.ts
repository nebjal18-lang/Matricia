import { networkStateLabel } from "@/modules/franchise/data/network/filters";
import { franchiseInvitationLabel } from "@/modules/franchise/data/network/invitation-label";
import type { FranchiseCrmDashboard } from "@/modules/franchise/data/crm/model";
import type { FranchiseDigestDashboard } from "@/modules/franchise/data/digest/model";
import type { FollowupDashboard } from "@/modules/franchise/data/followups/model";
import { franchiseeAllocation, franchiseeBeneficiaryCode, formatMinor, type FranchiseDashboard } from "@/modules/franchise/data/governance/model";
import type { FranchiseOperationsSnapshot } from "@/modules/franchise/data/operations/repository";
import type { FranchiseCorrectivePlan } from "@/modules/franchise/data/quality/repository";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { franchiseStageLabel } from "@/modules/franchise/data/spaces/labels";
import { demoFranchiseSpaces, type FinanceRow, type FranchiseSpaceBoardData, type MessageRow, type PersonRow, type QualityRow, type RequestRow, type SupervisionRow } from "@/modules/franchise/data/spaces/demo";
import type { Locale } from "@/modules/shared/lib/i18n/locale";


function evidenceLabels(refs: unknown[]): string[] {
  return refs.flatMap((ref) => {
    if (typeof ref === "string" && ref.trim()) return [ref];
    if (ref && typeof ref === "object" && "reference" in ref && typeof (ref as { reference: unknown }).reference === "string") {
      const value = (ref as { reference: string }).reference.trim();
      return value ? [value] : [];
    }
    return [];
  });
}

function folderActivities(item: FranchiseCrmDashboard["prospects"][number]) {
  return item.activities.map((activity) => ({
    id: activity.id,
    type: activity.type,
    occurredAt: activity.occurredAt,
    summary: activity.summary,
    evidence: evidenceLabels(activity.evidenceRefs),
  }));
}

function folderEvents(item: FranchiseCrmDashboard["prospects"][number]) {
  return item.pipelineEvents.map((event) => ({
    id: event.id,
    from: event.from,
    to: event.to,
    reasonCode: event.reasonCode,
    occurredAt: event.occurredAt,
    evidence: evidenceLabels(event.evidenceRefs),
  }));
}

function providerTone(stage: string): "mint" | "peach" | "violet" | "sky" {
  if (stage === "VERIFIED" || stage === "CONTRACT_SIGNED") return "mint";
  if (stage === "PROFILE_STARTED" || stage === "REGISTERED") return "violet";
  if (stage === "SENT" || stage === "OPENED") return "peach";
  return "sky";
}

export function emptyFranchiseSpaces(locale: Locale, query: string): FranchiseSpaceBoardData {
  const demo = demoFranchiseSpaces(locale, query);
  return {
    ...demo,
    // Never leak invented narrative CTAs / rights from the demo seed.
    treat: [],
    pipeline: demo.pipeline.map((step) => ({ ...step, detail: "—", status: "—" })),
    attention: [],
    homeRequests: [],
    homePros: [],
    homeGov: [],
    canDo: [],
    needsValidation: [],
    rights: [],
    periHistory: [],
    perimeter: {
      territory: "—",
      domains: "—",
      mandate: "—",
      status: "—",
    },
    providerDossiers:[],
    canWrite: false,
    people: [] as PersonRow[],
    requests: [] as RequestRow[],
    documents: [],
    renewals: [],
    messages: [] as MessageRow[],
    notifications: [],
    quality: [] as QualityRow[],
    performance: [],
    followups: [],
    decisions: [],
    mandates: [],
    govHistory: [],
    finance: [] as FinanceRow[],
    journal: [],
    corrective: [],
    quotes: [] as SupervisionRow[],
    missions: [] as SupervisionRow[],
    users: [] as SupervisionRow[],
    volume: [] as SupervisionRow[],
    anomalies: [] as SupervisionRow[],
    recommendations: [] as SupervisionRow[],
    opportunities: [] as SupervisionRow[],
    qualifications: [] as SupervisionRow[],
    definitions: [] as SupervisionRow[],
    risks: [] as SupervisionRow[],
    incidents: [] as SupervisionRow[],
  };
}

export function buildFranchiseSpaceBoard(input: {
  locale: Locale;
  query: string;
  unavailableSections?:string[];
  libraryName?: string | null;
  crm?: FranchiseCrmDashboard | null;
  followups?: FollowupDashboard | null;
  governance?: FranchiseDashboard | null;
  plans?: FranchiseCorrectivePlan[] | null;
  digest?: FranchiseDigestDashboard | null;
  operations?: FranchiseOperationsSnapshot | null;
  volumeServices?: Array<{ id: string; title: string; status: string; href: string }>;
  catalogRules?: Array<{ id: string; title: string; status: string; href: string; actions?: Array<{ type: string; target?: string }> }>;
}): FranchiseSpaceBoardData {
  const empty = emptyFranchiseSpaces(input.locale, input.query);
  const c = franchiseCopy(input.locale);
  const q = input.query;
  const locale = input.locale;
  const franchise = input.crm?.franchises[0] ?? input.governance?.franchises[0] ?? null;
  const territory = input.crm?.franchises[0]?.territory
    ? (locale === "ar" ? input.crm.franchises[0].territory.nameAr : input.crm.franchises[0].territory.nameFr)
    : input.governance?.franchises[0]?.territoryVersions[0]?.name ?? empty.perimeter.territory;
  const providers = (input.crm?.prospects ?? []).filter((item) => item.type === "PROVIDER");
  const clients = (input.crm?.prospects ?? []).filter((item) => item.type === "CLIENT");
  const alerts = (input.crm?.alerts ?? []).filter((item) => item.status === "OPEN");
  const objectives = input.crm?.objectives ?? [];
  const followupRows = (input.followups?.prospects ?? []).filter((item) => item.nextFollowupAt);
  const jobs = input.followups?.jobs ?? [];
  const approvals = input.governance?.approvals ?? [];
  const mandates = (input.governance?.franchises ?? []).flatMap((item) => item.mandateVersions.map((mandate) => ({
    id: mandate.id,
    title: `${c.liveMandate} v${mandate.version}`,
    type: item.libraryCode,
    status: mandate.status,
  })));
  const providerByOrganization=new Map((input.operations?.providerDossiers??[]).map(dossier=>[dossier.organizationId,dossier]));
  const people: PersonRow[] = providers.map((item) => {
    const dossier=providerByOrganization.get(item.linkedOrganizationId??"");
    return ({
    id: item.id,
    name: item.organizationName || item.displayName,
    linkedOrganizationId:item.linkedOrganizationId,
    createdAt:item.createdAt,
    dossier,
    services:dossier?.qualifications.map((q)=>q.serviceCode).join(", ")??(locale==="ar"?"خدمات غير موثقة":"Services non renseignés"),
    status: [dossier?networkStateLabel(dossier.status,locale):franchiseStageLabel(item.stage, locale),franchiseInvitationLabel(item.invitation,locale)].filter(Boolean).join(" · "),
    next: item.nextFollowupAt ? item.nextFollowupAt.slice(0, 10) : franchiseStageLabel(item.stage, locale),
    tone: providerTone(item.stage),
    stage: item.stage,
    email: item.contactEmail ?? undefined,
    source: item.sourceCode,
    rowVersion: item.rowVersion,
    nextFollowupAt: item.nextFollowupAt,
    activities: folderActivities(item),
    pipelineEvents: folderEvents(item),
  });});
  for(const dossier of input.operations?.providerDossiers??[]){
    if(people.some(row=>row.linkedOrganizationId===dossier.organizationId))continue;
    people.push({id:dossier.organizationId,linkedOrganizationId:dossier.organizationId,createdAt:dossier.createdAt,dossier,name:dossier.name,services:dossier.qualifications.map(q=>q.serviceCode).join(", "),status:networkStateLabel(dossier.status,locale),next:locale==="ar"?"ملف مقدم الخدمة":"Dossier prestataire",tone:dossier.status==="ACTIVE"?"mint":"sky",stage:dossier.status,source:"PROVIDER_PROFILE",activities:[],pipelineEvents:[]});
  }
  const operationalMatching = (input.operations?.matching ?? []).map((item) => ({
    id: item.id,
    name: item.eligible
      ? (locale === "ar" ? `مرشح مؤهل · ${item.scoreBps}` : `Candidat éligible · ${item.scoreBps} bps`)
      : (locale === "ar" ? "مرشح غير مؤهل" : "Candidat non éligible"),
    status: item.eligible ? (locale === "ar" ? "مؤهل" : "Éligible") : (locale === "ar" ? "مستبعد" : "Exclu"),
    href: `/${locale}/franchise/demandes/${item.requestId}/matching${q}`,
    tone: item.eligible ? "mint" as const : "peach" as const,
    requestId: item.requestId,
  }));
  const crmRequests = clients.map((item) => ({
    id: item.id,
    title: item.organizationName || item.displayName,
    stage: franchiseStageLabel(item.stage, locale),
    owner: item.displayName,
    flag: [item.nextFollowupAt ? item.nextFollowupAt.slice(0, 10) : item.sourceCode,franchiseInvitationLabel(item.invitation,locale)].filter(Boolean).join(" · "),
    tone: providerTone(item.stage),
    stageCode: item.stage,
    email: item.contactEmail ?? undefined,
    source: item.sourceCode,
    rowVersion: item.rowVersion,
    nextFollowupAt: item.nextFollowupAt,
    activities: folderActivities(item),
    pipelineEvents: folderEvents(item),
    matching: [], // A CRM prospect is not a service request or a matching run.
  }));
  const operationalRequests = (input.operations?.requests ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    stage: item.status,
    owner: c.reqTitle,
    flag: item.urgency ?? item.status,
    tone: "sky" as const,
    stageCode: item.status,
    matching: operationalMatching.filter((row) => row.requestId === item.id).map((row) => ({ id: row.id, name: row.name, status: row.status, href: row.href, tone: row.tone })),
  }));
  const requests = [...operationalRequests, ...crmRequests];
  const documents = [
    // CRM references remain in the folder timeline; only native documents enter the private vault.
    ...(input.operations?.providerDossiers??[]).flatMap((provider)=>provider.documents.map((item)=>({id:item.id,title:item.code,owner:provider.name,status:item.expiresOn&&item.expiresOn<new Date().toISOString().slice(0,10)?"EXPIRED":item.status,href:`/${locale}/franchise/documents/${item.id}${q}`,kind:"evidence"as const,due:item.expiresOn??undefined}))),
  ];
  const renewals: FranchiseSpaceBoardData["renewals"] = (input.operations?.providerDossiers??[]).flatMap((provider)=>[...provider.documents.filter((d)=>d.expiresOn).map((d)=>({id:d.id,title:d.code,owner:provider.name,status:d.expiresOn!<new Date().toISOString().slice(0,10)?"EXPIRED":d.status,href:`/${locale}/franchise/documents/${d.id}${q}`,kind:"renewal"as const,due:d.expiresOn!})),...(provider.partnerContract?.expiresAt?[{id:provider.partnerContract.id,title:locale==="ar"?"عقد الشراكة · نسخة "+provider.partnerContract.version:"Contrat partenaire · v"+provider.partnerContract.version,owner:provider.name,status:provider.partnerContract.status,href:`/${locale}/franchise/fournisseurs/contrats/${provider.partnerContract.id}${q}`,kind:"renewal"as const,due:provider.partnerContract.expiresAt}]:[])]).sort((a,b)=>a.due.localeCompare(b.due));
  const messages = [
    ...(input.operations?.threads ?? []).map((item) => ({
      id: item.id,
      title: item.subject,
      meta: item.status,
      href: `/${locale}/franchise/messages${q}${q ? "&" : "?"}fil=${item.id}`,
      tone: "sky" as const,
    })),
  ];
  const notifications = [
    ...alerts.map((item) => ({
      id: item.id,
      title: locale === "ar" ? item.explanationAr : item.explanationFr,
      meta: item.severity,
      href: `/${locale}/franchise/qualite${q}`,
    })),
    ...followupRows.map((item) => ({
      id: item.id,
      title: item.displayName,
      meta: (item.nextFollowupAt ?? "").slice(0, 10),
      href: `/${locale}/franchise/relances${q}`,
    })),
    ...(input.digest?.jobs ?? []).map((job) => ({
      id: job.id,
      title: locale === "ar" ? "ملخص تشغيلي" : "Digest opérationnel",
      meta: job.status,
      href: `/${locale}/franchise/digest${q}`,
    })),
  ];
  const journal = [...providers, ...clients].flatMap((item) => item.pipelineEvents.map((event) => ({
    id: event.id,
    date: event.occurredAt.slice(0, 10),
    event: `${event.from ?? "—"} → ${event.to}`,
    doc: item.organizationName || item.displayName,
  })));
  const quality: QualityRow[] = [
    ...alerts.map((item) => ({
      id: item.id,
      title: locale === "ar" ? item.explanationAr : item.explanationFr,
      type: item.type,
      severity:item.severity,
      status: item.status,
      evidence:evidenceLabels(item.evidenceRefs),
      next: item.metricCode ?? item.status,
      tone: item.severity === "CRITICAL" ? "peach" as const : item.severity === "WARNING" ? "violet" as const : "sky" as const,
      href: `/${locale}/franchise/qualite${q}`,
    })),
    ...(input.operations?.anomalies ?? []).map((item) => ({
      id: item.id,
      title: locale === "ar" ? item.titleAr : item.titleFr,
      type: c.anomalies,
      severity:item.severity,
      status: item.status,
      next: item.status,
      tone: item.severity === "CRITICAL" || item.severity === "HIGH" ? "peach" as const : "violet" as const,
      href: `/${locale}/franchise/qualite/anomalies${q}`,
    })),
  ];
  const performance = objectives.map((item) => ({
    id: item.id,
    title: locale === "ar" ? item.titleAr : item.titleFr,
    status: item.status,
    next: item.dueOn,
  }));
  const followups = (followupRows.length ? followupRows : jobs.map((job) => {
    const prospect = input.followups?.prospects.find((item) => item.id === job.prospectId);
    return { id: job.id, displayName: prospect?.displayName ?? job.prospectId, nextFollowupAt: job.nextAttemptAt };
  })).map((item, index) => {
    const prospect = input.followups?.prospects.find((row) => row.id === item.id);
    const href = prospect?.type === "PROVIDER"
      ? `/${locale}/franchise/fournisseurs/${prospect.id}${q}`
      : prospect?.type === "CLIENT"
        ? `/${locale}/franchise/demandes/${prospect.id}${q}`
        : `/${locale}/franchise/fournisseurs${q}`;
    const dueAt = item.nextFollowupAt ?? null;
    const dueMs = dueAt ? Date.parse(dueAt) : Number.NaN;
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);
    let tone: FranchiseSpaceBoardData["followups"][number]["tone"] = "sky";
    if (Number.isFinite(dueMs)) {
      if (dueMs < startOfToday.getTime()) tone = "peach";
      else if (dueMs < endOfToday.getTime()) tone = "violet";
      else tone = "sky";
    }
    void now;
    return {
      id: "id" in item && typeof item.id === "string" ? item.id : String(index),
      title: "displayName" in item ? item.displayName : "",
      due: (dueAt ?? "").slice(0, 10) || "—",
      action: c.contact,
      tone,
      href,
    };
  });
  const decisions = approvals.map((item) => ({
    id: item.id,
    title: item.requestType,
    type: item.status,
    status: item.decision?.decision ?? item.status,
  }));
  const govHistory = approvals.filter((item) => item.decidedAt).map((item) => ({
    id: item.id,
    title: item.requestType,
    actor: item.decision?.decision ?? item.status,
  }));
  const governanceBinding=input.governance&&"bookBindingReviewRequired"in input.governance?input.governance.bookBindingReviewRequired:null;
  const financeBindingStatus:FranchiseSpaceBoardData["financeBindingStatus"]=governanceBinding!==true&&governanceBinding!==false?"UNAVAILABLE":governanceBinding===true?"REVIEW_REQUIRED":(input.governance?.books??[]).some(book=>!("bindingReviewRequired"in book)||book.bindingReviewRequired!==false)?"UNAVAILABLE":"READY";
  const finance: FinanceRow[] = [
    ...(input.governance?.books ?? []).filter(book=>"bindingReviewRequired"in book&&book.bindingReviewRequired===false).flatMap((book) => {
      const beneficiary = franchiseeBeneficiaryCode(book.type);
      const executionMode=book.entryFee&&"executionMode"in book.entryFee?book.entryFee.executionMode:null;
      const executionEnvironment=book.entryFee&&"executionEnvironment"in book.entryFee?book.entryFee.executionEnvironment:null;
      const environmentLabel=executionEnvironment==="DEVELOPMENT"?(locale==="ar"?"التطوير":"développement"):executionEnvironment==="STAGING"?(locale==="ar"?"الاختبار المرحلي":"staging"):executionEnvironment==="PRODUCTION"?(locale==="ar"?"الإنتاج":"production"):null;
      const executionNotice=executionMode==="NON_CONTRACTUAL_DEMO"&&environmentLabel?(locale==="ar"?`محاكاة غير تعاقدية · ${environmentLabel}`:`Simulation non contractuelle · ${environmentLabel}`):executionMode==="CONTRACTUAL"&&environmentLabel?(locale==="ar"?`تنفيذ تعاقدي · ${environmentLabel}`:`Exécution contractuelle · ${environmentLabel}`):(locale==="ar"?"الأساس التعاقدي غير معتمد · يلزم تحقق الإدارة":"Base contractuelle non certifiée · validation administrative requise");
      const fee = book.entryFee
        ? [{
          id: `${book.id}-entry`,
          title: c.entryFee,
          object: book.entryFee.mode,
          status: book.entryFee.mode,
          auth: formatMinor(book.entryFee.principalMinor, book.currency, locale),
          tone: "sky" as const,
          amount: formatMinor(book.entryFee.principalMinor, book.currency, locale),
          kind: "entryFee" as const,
          executionNotice,
        }]
        : [];
      const feeLedger = (book.entryFeeLedger ?? []).map((entry) => ({
        id: `${book.id}-fee-${entry.id}`,
        title: c.entryFee,
        object: entry.entryType,
        status: entry.entryType,
        auth: formatMinor(entry.amountMinor, book.currency, locale),
        tone: entry.entryType === "PAYMENT" ? "mint" as const : "sky" as const,
        amount: formatMinor(entry.amountMinor, book.currency, locale),
        kind: "entryFee" as const,
        executionNotice,
      }));
      const closures = book.closures.flatMap((closure) => {
        const share = franchiseeAllocation(book.type, closure.allocations);
        if (!share) return [];
        return [{
          id: closure.id,
          href:`/${locale}/franchise/finance/releves/${closure.id}${q}`,
          title: (locale === "ar" ? `كشف ${closure.periodStart} — ${closure.periodEnd}` : `Relevé ${closure.periodStart} — ${closure.periodEnd}`),
          object: c.yourShare,
          status: c.periodClosed,
          auth: formatMinor(share.amountMinor, book.currency, locale),
          tone: "mint" as const,
          amount: formatMinor(share.amountMinor, book.currency, locale),
          kind: "statement" as const,
        }];
      });
      const payouts = book.ledgerEntries
        .filter((entry) => entry.beneficiaryCode === beneficiary && entry.entryType === "PAYOUT")
        .map((entry) => ({
          id: `${book.id}-payout-${entry.id}`,
          title: c.payments,
          object: c.yourShare,
          status: entry.entryType,
          auth: formatMinor(entry.amountMinor, book.currency, locale),
          tone: "mint" as const,
          amount: formatMinor(entry.amountMinor, book.currency, locale),
          kind: "payout" as const,
        }));
      return [...fee, ...feeLedger, ...closures, ...payouts];
    }),
  ];
  const corrective = (input.plans ?? []).map((item) => ({
    id: item.id,
    title: item.key,
    status: item.status,
    due: item.dueOn,
  }));
  const quotes: SupervisionRow[] = (input.operations?.quotes ?? []).map((item) => ({
    id: item.id,
    title: item.status,
    status: item.status,
    meta: item.totalMinor && item.currency ? formatMinor(item.totalMinor, item.currency, locale) : item.status,
    href: `/${locale}/franchise/demandes/${item.requestId}${q}`,
  }));
  const missions: SupervisionRow[] = (input.operations?.missions ?? []).map((item) => ({
    id: item.id,
    title: item.status,
    status: item.status,
    meta: item.startedAt ? item.startedAt.slice(0, 10) : item.status,
    href: `/${locale}/franchise/demandes/missions${q}`,
  }));
  const users: SupervisionRow[] = [
    ...(input.operations?.members ?? []).map((item) => ({
      id: item.id,
      title: item.roles[0] ?? item.status,
      status: item.status,
      meta: item.roles.join(" · ") || item.status,
      href: `/${locale}/franchise/perimetre/utilisateurs${q}`,
    })),
    ...(input.governance?.invitations ?? []).map((item) => ({
      id: item.id,
      title: item.email,
      status: item.status,
      meta: item.expiresAt.slice(0, 10),
      href: `/${locale}/franchise/perimetre/utilisateurs${q}`,
    })),
  ];
  const volume: SupervisionRow[] = [
    ...(input.volumeServices ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      href: item.href,
    })),
    ...(input.operations?.skus ?? []).map((item) => ({
      id: item.id,
      title: item.code,
      status: item.status,
      href: `/${locale}/franchise/finance/volume${q}`,
    })),
    ...(input.operations?.volumeProposals ?? []).map((item) => ({
      id: item.id,
      title: item.paymentModel,
      status: item.status,
      meta: item.skuId.slice(0, 8),
      href: `/${locale}/franchise/finance/volume${q}`,
    })),
  ];
  const anomalies: SupervisionRow[] = (input.operations?.anomalies ?? []).map((item) => ({
    id: item.id,
    title: locale === "ar" ? item.titleAr : item.titleFr,
    status: item.status,
    meta: [item.severity, item.code, item.blocking ? "BLOCKING" : null].filter(Boolean).join(" · "),
    href: `/${locale}/franchise/qualite/anomalies${q}`,
    tone: item.severity === "CRITICAL" || item.severity === "HIGH" ? "peach" as const : "violet" as const,
  }));
  const recommendations: SupervisionRow[] = [
    ...(input.operations?.recommendations ?? []).map((item) => ({
      id: item.id,
      title: locale === "ar" ? item.titleAr : item.titleFr,
      status: item.solutionLevel,
      meta: [item.solutionLevel, item.serviceCode].filter(Boolean).join(" · ") || item.solutionLevel,
      href: `/${locale}/franchise/qualite/recommandations${q}`,
    })),
    ...(input.operations?.recommendationDefinitions ?? []).map((item) => ({
      id: item.id,
      title: locale === "ar" ? item.titleAr : item.titleFr,
      status: item.solutionLevel,
      meta: item.serviceId.slice(0, 8),
      href: `/${locale}/franchise/qualite/recommandations${q}`,
    })),
  ];
  const opportunities: SupervisionRow[] = (input.operations?.opportunities ?? []).map((item) => ({
    id: item.id,
    title: item.status,
    status: item.solutionLevel,
    meta: [item.solutionLevel, item.serviceCode, String(item.priority)].filter(Boolean).join(" · ") || String(item.priority),
    href: `/${locale}/franchise/qualite/opportunites${q}`,
  }));
  const definitions: SupervisionRow[] = [
    ...(input.operations?.anomalyDefinitions ?? []).map((item) => ({
      id: item.id,
      title: locale === "ar" ? item.titleAr : item.titleFr,
      status: item.status,
      meta: item.severity,
      href: `/${locale}/franchise/qualite/definitions${q}`,
    })),
    ...(input.catalogRules ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      meta: (item.actions ?? []).map((action) => action.type).join(" · ") || item.status,
      href: item.href,
    })),
  ];
  const riskModels: SupervisionRow[] = [
    ...(input.operations?.riskDefinitions ?? []).map((item) => ({
      id: item.id,
      title: locale === "ar" ? item.titleAr : item.titleFr,
      status: item.status,
      meta: item.criticality,
      href: `/${locale}/franchise/qualite/risques${q}`,
      tone: item.criticality === "CRITICAL" || item.criticality === "HIGH" ? "peach" as const : "violet" as const,
    })),
    ...(input.catalogRules ?? []).flatMap((rule) =>
      (rule.actions ?? []).filter((action) => action.type === "CREATE_RISK").map((action, index) => ({
        id: `${rule.id}-risk-${index}`,
        title: action.target ?? rule.title,
        status: rule.status,
        meta: rule.title,
        href: rule.href,
        tone: "peach" as const,
      })),
    ),
  ];
  const risks: SupervisionRow[] = [
    ...riskModels,
    ...(input.operations?.anomalies ?? [])
      .filter((item) => item.severity === "HIGH" || item.severity === "CRITICAL")
      .map((item) => ({
        id: item.id,
        title: locale === "ar" ? item.titleAr : item.titleFr,
        status: item.status,
        meta: item.code ? `${item.severity} · ${item.code}` : item.severity,
        href: `/${locale}/franchise/qualite/risques${q}`,
        tone: "peach" as const,
      })),
  ];
  const incidents: SupervisionRow[] = (input.operations?.disputes ?? []).map((item) => ({
    id: item.id,
    title: item.obligationKey,
    status: item.status,
    meta: item.urgency,
    href: `/${locale}/franchise/qualite/incidents${q}`,
    tone: item.urgency === "URGENT" ? "peach" as const : "violet" as const,
  }));
  const qualifications: SupervisionRow[] = [
    ...(input.operations?.qualifications ?? []).map((item) => ({
      id: item.id,
      title: item.serviceCode ?? item.serviceId,
      status: item.status,
      rowVersion: item.rowVersion,
      href: `/${locale}/franchise/fournisseurs${q}`,
    })),
    ...(input.operations?.capacities ?? []).map((item) => ({
      id: item.id,
      title: item.serviceId ?? item.status,
      status: item.status,
      meta: item.availableUnits == null ? item.status : String(item.availableUnits),
      href: `/${locale}/franchise/fournisseurs${q}`,
    })),
  ];
  const treat = [
    requests[0] ? { id: "t-req", title: c.homeRequests, detail: requests[0].title, href: `/${locale}/franchise/demandes${q}`, tone: "sky" as const } : null,
    people[0] ? { id: "t-pro", title: c.homePros, detail: people[0].name, href: `/${locale}/franchise/fournisseurs${q}`, tone: "peach" as const } : null,
    quality[0] ? { id: "t-qual", title: c.toExamine, detail: quality[0].title, href: `/${locale}/franchise/qualite${q}`, tone: "mint" as const } : null,
    followups[0] ? { id: "t-fol", title: c.due, detail: followups[0].title, href: `/${locale}/franchise/relances${q}`, tone: "violet" as const } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const live: FranchiseSpaceBoardData = {
    ...empty,
    providerDossiers:input.operations?.providerDossiers??[],
    metrics:input.operations?.metrics??null,
    unavailableSections:input.unavailableSections??[],
    treat,
    pipeline:empty.pipeline.map((step,index)=>{const metrics=input.operations?.metrics;const net=metrics?.network;const values=[net?.providers,metrics?.requestCount,metrics?.missionCount,metrics?.qualitySnapshot?`${metrics.qualitySnapshot.scoreBasisPoints/100}%`:null,metrics?.completedMissions];const labels=locale==="ar"?["مزودون مرتبطون بالخدمات","طلبات · كامل التاريخ","مهام · كامل التاريخ","آخر تقييم مؤرخ","مهام مكتملة"]:["Prestataires liés aux services","Demandes · historique complet","Missions · historique complet","Dernière évaluation datée","Missions terminées"];return{...step,title:labels[index]??step.title,detail:values[index]==null?"—":String(values[index]),status:metrics?new Date(metrics.asOf).toLocaleDateString(locale==="ar"?"ar-MA":"fr-MA"):"—"};}),
    attention: [
      ...quality.slice(0, 2).map((item) => ({ id: item.id, title: item.title, href: `/${locale}/franchise/qualite${q}` })),
      ...followups.slice(0, 2).map((item) => ({ id: item.id, title: item.title, href: `/${locale}/franchise/relances${q}` })),
    ],
    perimeter: {
      territory,
      domains: input.libraryName
        ?? (input.locale === "ar"
          ? input.governance?.franchises[0]?.libraryNameAr
          : input.governance?.franchises[0]?.libraryNameFr)
        ?? input.governance?.franchises[0]?.libraryCode
        ?? empty.perimeter.domains,
      mandate: franchise && "operatorCode" in franchise ? franchise.operatorCode : empty.perimeter.mandate,
      status: input.governance?.franchises[0]?.status ?? (franchise ? "ACTIVE" : empty.perimeter.status),
    },
    franchiseId:franchise?.id??null,
    permissions:input.operations?.permissions??empty.permissions,
    canWrite: Boolean(input.crm?.canWrite),
    people,
    requests,
    documents,
    renewals,
    messages,
    notifications,
    journal,
    quality,
    performance,
    followups,
    decisions,
    mandates,
    govHistory,
    financeBindingStatus,
    finance,
    corrective,
    quotes,
    missions,
    users,
    volume,
    anomalies,
    recommendations,
    opportunities,
    qualifications,
    definitions,
    risks,
    incidents,
  };
  return live;
}
