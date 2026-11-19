import { formatAdminDateTime } from "@/modules/admin/data/command-center/view-model";
import type { AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { actorOrganizationLabel, isAdminOrgDirectoryFixture } from "./actor-presentation";
import {
  buildParcoursAriadneChain,
  buildParcoursFilmIndex,
  formatCompleteness,
  formatExclusionReasons,
  formatScoreBasisPoints,
  resolveParcoursFilmIds,
  type ParcoursChainLink,
  type ParcoursFilmIndex,
} from "./parcours-ariadne";
import {
  isOperationalFixtureName,
  presentChannel,
  presentDateOnly,
  presentDateTime,
  presentMinor,
  presentObligation,
  presentOrgName,
  presentPersonPair,
} from "./present-space-row";
import { spaceHref, statusTone, type SpaceTone } from "./screen-catalog";
import { formatDiagnosticProgress, localizeDiagnosticRating, localizeStatus } from "./view-model";

export type ParcoursSpaceRow = {
  id: string;
  href: string;
  title: string;
  cells: string[];
  status: string;
  tone: SpaceTone;
  organizationId?: string;
  treat?: boolean;
  fixture?: boolean;
  demoFilm?: boolean;
  chain?: ParcoursChainLink[];
  extras?: Record<string, string>;
};

function localizeTechnicalCode(value: string, locale: Locale): string {
  const key = value.trim();
  if (!key) return "—";
  const known: Record<string, [string, string]> = {
    REGISTRATION: ["Immatriculation", "التسجيل"],
    INSURANCE: ["Assurance", "تأمين"],
    CAPACITY: ["Capacité", "القدرة"],
    IDENTITY: ["Identité", "الهوية"],
    "quote.submitted": ["Devis soumis", "عرض مُقدَّم"],
    "mission.milestone.submitted": ["Jalon soumis", "معلم مُقدَّم"],
  };
  const hit = known[key];
  if (hit) return locale === "ar" ? hit[1] : hit[0];
  return key.replaceAll(".", " · ").replaceAll("_", " ");
}

function withChain(
  locale: Locale,
  query: string,
  index: ParcoursFilmIndex,
  seed: Parameters<typeof resolveParcoursFilmIds>[1],
  row: Omit<ParcoursSpaceRow, "chain">,
): ParcoursSpaceRow {
  const ids = resolveParcoursFilmIds(index, seed);
  const chain = buildParcoursAriadneChain(locale, query, ids);
  return {
    ...row,
    chain,
    extras: {
      ...row.extras,
      requestId: ids.requestId ?? row.extras?.requestId ?? "",
      matchingId: ids.matchingId ?? row.extras?.matchingId ?? "",
      quoteId: ids.quoteId ?? row.extras?.quoteId ?? "",
      contractId: ids.contractId ?? row.extras?.contractId ?? "",
      missionId: ids.missionId ?? row.extras?.missionId ?? "",
    },
  };
}

export function mapDiagnosticsRows(
  locale: Locale,
  query: string,
  dash: AdminSupervisionDashboard,
  demoFilm = false,
): ParcoursSpaceRow[] {
  const index = buildParcoursFilmIndex(dash);
  return dash.diagnostics.map((item) => {
    const orgName = actorOrganizationLabel(item.organization_name, locale);
    const score = formatDiagnosticProgress(item.overall_score, locale);
    const fixture = isAdminOrgDirectoryFixture(item.organization_name);
    const activity = item.completed_at
      ? formatAdminDateTime(item.completed_at, locale)
      : (locale === "ar" ? "بدون نشاط مسجّل" : "Aucune activité enregistrée");
    const diagnosticTitle = locale === "ar"
      ? (item.questionnaire_title_ar?.trim() || item.questionnaire_title_fr?.trim() || "تشخيص مؤسسي")
      : (item.questionnaire_title_fr?.trim() || item.questionnaire_title_ar?.trim() || "Diagnostic entreprise");
    const versionValue = item.questionnaire_version == null || item.questionnaire_version === ""
      ? null
      : Number(item.questionnaire_version);
    const versionLabel = versionValue != null && Number.isFinite(versionValue) ? `v${versionValue}` : "—";
    const request = dash.requests.find((entry) => entry.organization_id === item.organization_id);
    return withChain(locale, query, index, { requestId: request?.id }, {
      id: item.id,
      href: spaceHref(locale, "diagnostics", query, item.id),
      title: orgName,
      cells: [orgName, diagnosticTitle, versionLabel, score.label, localizeDiagnosticRating(item.rating, locale), activity, item.status],
      status: item.status,
      tone: statusTone(item.status),
      organizationId: item.organization_id,
      fixture,
      demoFilm,
      treat: !fixture && /DRAFT|IN_PROGRESS|STARTED|RUNNING|IN_REVIEW|STALE|SUBMITTED/i.test(item.status),
      extras: { scorePercent: String(Math.round(score.percent)), progressPercent: String(Math.round(score.percent)) },
    });
  });
}

export function mapDemandesRows(
  locale: Locale,
  query: string,
  dash: AdminSupervisionDashboard,
  demoFilm = false,
): ParcoursSpaceRow[] {
  const index = buildParcoursFilmIndex(dash);
  return dash.requests.map((item) => {
    const orgName = presentOrgName(item.organization_name, locale);
    const fixture = isOperationalFixtureName(item.organization_name);
    const needTitle = locale === "ar"
      ? (item.title_ar?.trim() || item.title_fr?.trim() || "طلب خدمة")
      : (item.title_fr?.trim() || item.title_ar?.trim() || "Demande de service");
    const domain = locale === "ar"
      ? (item.domain_label_ar?.trim() || item.domain_label_fr?.trim() || "—")
      : (item.domain_label_fr?.trim() || item.domain_label_ar?.trim() || "—");
    const source = item.source_code
      ? localizeTechnicalCode(item.source_code, locale)
      : (locale === "ar" ? "طلب عروض" : "Consultation RFQ");
    const completeness = formatCompleteness(item.completeness_percent ?? null, locale);
    return withChain(locale, query, index, { requestId: item.id }, {
      id: item.id,
      href: spaceHref(locale, "demandes", query, item.id),
      title: needTitle,
      cells: [
        orgName,
        needTitle,
        domain,
        source,
        completeness,
        String(item.rfq_count),
        String(item.quote_count),
        localizeStatus(item.status, locale),
      ],
      status: item.status,
      tone: statusTone(item.status),
      organizationId: item.organization_id,
      fixture,
      demoFilm,
      treat: !fixture && (item.matching_runs === 0 || /DRAFT|BLOCKED|INCOMPLETE/i.test(item.status)),
      extras: {
        serviceId: item.service_id,
        libraryId: item.library_id,
        completenessPercent: String(item.completeness_percent ?? ""),
        scorePercent: String(item.completeness_percent ?? ""),
      },
    });
  });
}

export function mapMatchingRows(
  locale: Locale,
  query: string,
  dash: AdminSupervisionDashboard,
  demoFilm = false,
): ParcoursSpaceRow[] {
  const index = buildParcoursFilmIndex(dash);
  const matching = dash.matching ?? [];
  if (!matching.length) {
    return dash.requests.map((item) => {
      const orgName = presentOrgName(item.organization_name, locale);
      const fixture = isOperationalFixtureName(item.organization_name);
      return withChain(locale, query, index, { requestId: item.id }, {
        id: item.id,
        href: spaceHref(locale, "matching", query, item.id),
        title: orgName,
        cells: [
          orgName,
          locale === "ar" ? "خدمة مرتبطة" : "Service lié",
          String(item.matching_runs),
          String(item.rfq_count),
          "—",
          item.matching_runs > 0 ? (locale === "ar" ? "مراجعة" : "Revue") : (locale === "ar" ? "بانتظار" : "En attente"),
          String(item.rfq_count),
          String(item.quote_count),
          localizeStatus(item.status, locale),
        ],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: item.organization_id,
        fixture,
        demoFilm,
        treat: !fixture && (item.matching_runs === 0 || /DRAFT|BLOCKED/i.test(item.status)),
        extras: { requestId: item.id, serviceId: item.service_id },
      });
    });
  }
  return matching.map((item) => {
    const orgName = presentOrgName(item.organization_name, locale);
    const fixture = isOperationalFixtureName(item.organization_name);
    const top = [...item.candidates].sort((a, b) => b.score_basis_points - a.score_basis_points)[0];
    const excluded = item.candidates.find((candidate) => !candidate.eligible || candidate.exclusion_reasons.length > 0);
    const scoreLabel = formatScoreBasisPoints(top?.score_basis_points, locale);
    const exclusionLabel = item.excluded_count > 0 || excluded
      ? formatExclusionReasons(excluded?.exclusion_reasons?.length ? excluded.exclusion_reasons : [locale === "ar" ? `${item.excluded_count} مستبعد` : `${item.excluded_count} exclus`], locale)
      : formatExclusionReasons([], locale);
    const request = dash.requests.find((entry) => entry.id === item.request_id);
    const domain = locale === "ar"
      ? (request?.domain_label_ar?.trim() || request?.domain_label_fr?.trim() || "—")
      : (request?.domain_label_fr?.trim() || request?.domain_label_ar?.trim() || "—");
    return withChain(locale, query, index, { requestId: item.request_id, matchingId: item.id }, {
      id: item.id,
      href: spaceHref(locale, "matching", query, item.id),
      title: orgName,
      cells: [
        orgName,
        domain,
        String(item.eligible_count),
        String(item.excluded_count),
        scoreLabel,
        exclusionLabel,
        item.eligible_count > 0 ? (locale === "ar" ? "مراجعة" : "Revue") : (locale === "ar" ? "بانتظار" : "En attente"),
        String(item.rfq_count),
        item.status,
      ],
      status: item.status,
      tone: statusTone(item.status),
      organizationId: item.organization_id,
      fixture,
      demoFilm,
      treat: !fixture && (item.rfq_count === 0 || item.eligible_count === 0 || item.excluded_count > 0),
      extras: {
        requestId: item.request_id,
        policy: item.policy_version,
        candidates: JSON.stringify(item.candidates),
        organizationName: orgName,
        scorePercent: top ? String(Math.round(top.score_basis_points / 100)) : "",
      },
    });
  });
}

export function mapDevisRows(
  locale: Locale,
  query: string,
  dash: AdminSupervisionDashboard,
  demoFilm = false,
): ParcoursSpaceRow[] {
  const index = buildParcoursFilmIndex(dash);
  return dash.quotes.map((item) => {
    const provider = presentOrgName(item.provider_name, locale);
    const client = presentOrgName(item.client_name, locale);
    const fixture = isOperationalFixtureName(item.provider_name, item.client_name);
    const currency = item.currency ?? "MAD";
    const lineCount = item.line_count == null ? "—" : String(item.line_count);
    const compliance = item.compliance_label
      ? localizeTechnicalCode(item.compliance_label, locale)
      : (item.status === "SELECTED" || item.status === "VALIDATED"
        ? (locale === "ar" ? "مطابق" : "Conforme")
        : (locale === "ar" ? "قيد التحقق" : "À vérifier"));
    return withChain(locale, query, index, { requestId: item.request_id, quoteId: item.id }, {
      id: item.id,
      href: spaceHref(locale, "devis", query, item.id),
      title: `${client} · ${provider}`,
      cells: [
        `${client} · ${provider}`,
        locale === "ar" ? "طلب مرتبط" : "Demande liée",
        provider,
        item.version_number?.toString() ?? "—",
        lineCount,
        presentMinor(item.subtotal_minor, currency, locale),
        presentMinor(item.tax_minor, currency, locale),
        presentMinor(item.total_minor, currency, locale),
        presentDateOnly(item.valid_until, locale),
        compliance,
        item.status,
      ],
      status: item.status,
      tone: statusTone(item.status),
      organizationId: item.provider_organization_id,
      fixture,
      demoFilm,
      treat: !fixture && /REVIEW|PENDING|RECEIVED|SUBMITTED/i.test(item.status),
      extras: { requestId: item.request_id, rfqId: item.rfq_id },
    });
  });
}

export function mapContratsRows(
  locale: Locale,
  query: string,
  dash: AdminSupervisionDashboard,
  demoFilm = false,
): ParcoursSpaceRow[] {
  const index = buildParcoursFilmIndex(dash);
  return dash.contracts.map((item) => {
    const title = presentPersonPair(item.client_name, item.provider_name, locale);
    const fixture = isOperationalFixtureName(item.client_name, item.provider_name);
    const signature = item.signature_count > 0
      ? (locale === "ar" ? `${item.signature_count} توقيع` : `${item.signature_count} signature(s)`)
      : (locale === "ar" ? "بانتظار التوقيع" : "En attente de signature");
    const activation = item.status === "ACTIVE"
      ? (locale === "ar" ? "مفعّل" : "Activé")
      : /SIGN|PENDING|DRAFT|READY/i.test(item.status)
        ? (locale === "ar" ? "بانتظار التفعيل" : "En attente d’activation")
        : "—";
    return withChain(locale, query, index, { contractId: item.id, missionId: item.mission_id }, {
      id: item.id,
      href: spaceHref(locale, "contrats", query, item.id),
      title,
      cells: [
        title,
        item.mission_id ? (locale === "ar" ? "مهمة مرتبطة" : "Mission liée") : (locale === "ar" ? "بدون مهمة" : "Sans mission"),
        presentOrgName(item.client_name, locale),
        presentOrgName(item.provider_name, locale),
        String(item.current_version),
        String(item.signature_count),
        signature,
        activation,
        item.status,
      ],
      status: item.status,
      tone: statusTone(item.status),
      organizationId: item.client_organization_id,
      fixture,
      demoFilm,
      extras: { missionId: item.mission_id ?? "", signatures: String(item.signature_count) },
      treat: !fixture && (/PENDING|DRAFT|SIGNATURE|READY/i.test(item.status) || (item.status === "ACTIVE" && !item.mission_id)),
    });
  });
}

export function mapAvenantsRows(
  locale: Locale,
  query: string,
  dash: AdminSupervisionDashboard,
  demoFilm = false,
): ParcoursSpaceRow[] {
  const index = buildParcoursFilmIndex(dash);
  return dash.amendments.map((item) => {
    const title = presentPersonPair(item.client_name, item.provider_name, locale);
    const fixture = isOperationalFixtureName(item.client_name, item.provider_name);
    const object = locale === "ar"
      ? (item.object_ar?.trim() || item.object_fr?.trim() || "تعديل تعاقدي")
      : (item.object_fr?.trim() || item.object_ar?.trim() || "Modification contractuelle");
    const delta = presentMinor(item.price_delta_minor, item.currency ?? "MAD", locale);
    const signed = /SIGNED|ACTIVE|ACTIV/i.test(item.status)
      ? (locale === "ar" ? "موقع" : "Signé")
      : (locale === "ar" ? "بانتظار التوقيع" : "En attente de signature");
    const activation = /ACTIVE|ACTIV/i.test(item.status)
      ? (locale === "ar" ? "مفعّل" : "Activé")
      : (locale === "ar" ? "بانتظار التفعيل" : "En attente d’activation");
    return withChain(locale, query, index, { contractId: item.contract_id }, {
      id: item.id,
      href: spaceHref(locale, "avenants", query, item.id),
      title,
      cells: [
        `${locale === "ar" ? "ملحق" : "Avenant"} #${item.amendment_number}`,
        locale === "ar" ? "عقد مصدر" : "Contrat source",
        object,
        delta,
        String(item.amendment_number),
        presentPersonPair(item.client_name, item.provider_name, locale),
        signed,
        activation,
        item.status,
      ],
      status: item.status,
      tone: statusTone(item.status),
      organizationId: item.client_organization_id,
      fixture,
      demoFilm,
      extras: { contractId: item.contract_id, amendment: String(item.amendment_number), priceDelta: item.price_delta_minor },
      treat: !fixture && /DRAFT|PENDING|IN_REVIEW/i.test(item.status),
    });
  });
}

export function mapMissionsRows(
  locale: Locale,
  query: string,
  dash: AdminSupervisionDashboard,
  demoFilm = false,
): ParcoursSpaceRow[] {
  const index = buildParcoursFilmIndex(dash);
  return dash.missions.map((item) => {
    const title = presentPersonPair(item.client_name, item.provider_name, locale);
    const fixture = isOperationalFixtureName(item.client_name, item.provider_name);
    const relatedMilestones = (dash.milestones ?? []).filter((milestone) => milestone.mission_id === item.id);
    const nextMilestone = relatedMilestones.find((milestone) => /PENDING|SUBMITTED|IN_PROGRESS/i.test(milestone.status))
      ?? relatedMilestones[0];
    const nextLabel = nextMilestone
      ? (locale === "ar" ? nextMilestone.title_ar : nextMilestone.title_fr)
      : item.milestone_count > 0
        ? (locale === "ar" ? `التالي ضمن ${item.milestone_count}` : `Prochain parmi ${item.milestone_count}`)
        : "—";
    const risk = /BLOCKED|SUSPEND|DISPUTE/i.test(item.status)
      ? (locale === "ar" ? "مخاطر مفتوحة" : "Risque ouvert")
      : relatedMilestones.some((milestone) => milestone.status === "REJECTED" || milestone.status === "OVERDUE")
        ? (locale === "ar" ? "تأخير / رفض" : "Retard / rejet")
        : (locale === "ar" ? "تحت السيطرة" : "Sous contrôle");
    return withChain(locale, query, index, { contractId: item.contract_id, missionId: item.id }, {
      id: item.id,
      href: spaceHref(locale, "missions", query, item.id),
      title,
      cells: [
        title,
        locale === "ar" ? "عقد مرتبط" : "Contrat lié",
        presentOrgName(item.client_name, locale),
        presentOrgName(item.provider_name, locale),
        `${item.milestone_count}`,
        nextLabel,
        String(item.deliverable_count),
        risk,
        item.status,
      ],
      status: item.status,
      tone: statusTone(item.status),
      organizationId: item.client_organization_id,
      fixture,
      demoFilm,
      extras: { contractId: item.contract_id, providerId: item.provider_organization_id },
      treat: !fixture && /BLOCKED|PENDING|START|CLOSUR|SUSPEND/i.test(item.status),
    });
  });
}

export function mapJalonsRows(
  locale: Locale,
  query: string,
  dash: AdminSupervisionDashboard,
  demoFilm = false,
): ParcoursSpaceRow[] {
  const index = buildParcoursFilmIndex(dash);
  return (dash.milestones ?? []).map((item) => {
    const title = locale === "ar" ? item.title_ar : item.title_fr;
    const fixture = isOperationalFixtureName(item.owner_name, title);
    const overdue = item.due_at && new Date(item.due_at) < new Date() && !["ACCEPTED", "REJECTED", "COMPLETED"].includes(item.status);
    const billing = /ACCEPTED|COMPLETED/i.test(item.status)
      ? (locale === "ar" ? "جاهز للفوترة" : "Prêt à facturer")
      : (locale === "ar" ? "غير مرتبط بعد" : "Pas encore lié");
    return withChain(locale, query, index, { missionId: item.mission_id }, {
      id: item.id,
      href: spaceHref(locale, "jalons", query, item.id),
      title,
      cells: [
        locale === "ar" ? "مهمة مرتبطة" : "Mission liée",
        title,
        item.deliverable_count > 0 ? (locale === "ar" ? `${item.deliverable_count} تسليم` : `${item.deliverable_count} livrable(s)`) : "—",
        presentOrgName(item.owner_name, locale),
        presentDateTime(item.due_at, locale),
        String(item.proof_count),
        localizeStatus(item.status, locale),
        billing,
        localizeStatus(item.status, locale),
      ],
      status: item.status,
      tone: statusTone(item.status),
      organizationId: item.organization_id,
      fixture,
      demoFilm,
      extras: {
        missionId: item.mission_id,
        statusCodes: overdue ? "OVERDUE" : "",
      },
      treat: !fixture && (item.status === "SUBMITTED" || item.status === "REJECTED" || Boolean(overdue)),
    });
  });
}

export function mapDocumentsRows(
  locale: Locale,
  query: string,
  dash: AdminSupervisionDashboard,
  demoFilm = false,
): ParcoursSpaceRow[] {
  const index = buildParcoursFilmIndex(dash);
  return dash.documents.map((item) => {
    const orgName = presentOrgName(item.organization_name, locale);
    const fixture = isOperationalFixtureName(item.organization_name);
    const kind = localizeTechnicalCode(item.kind, locale);
    const folder = item.folder_label
      ? localizeTechnicalCode(item.folder_label, locale)
      : (locale === "ar" ? "خزينة المنظمة" : "Coffre organisation");
    const sensitivity = item.sensitivity_label
      ? localizeTechnicalCode(item.sensitivity_label, locale)
      : (locale === "ar" ? "محدود" : "Restreint");
    const scan = item.scan_status
      ? localizeTechnicalCode(item.scan_status, locale)
      : /VERIFIED|CLEAN/i.test(item.status)
        ? (locale === "ar" ? "سليم" : "Propre")
        : (locale === "ar" ? "بانتظار المسح" : "Scan en attente");
    const access = item.access_label
      ? localizeTechnicalCode(item.access_label, locale)
      : (locale === "ar" ? "أعضاء المنظمة" : "Membres org");
    const request = dash.requests.find((entry) => entry.organization_id === item.organization_id);
    return withChain(locale, query, index, { requestId: request?.id }, {
      id: item.id,
      href: spaceHref(locale, "documents", query, item.id),
      title: `${kind} · ${item.code}`,
      cells: [item.code, orgName, kind, folder, sensitivity, `v${item.version}`, scan, access, presentDateOnly(item.expires_on, locale), item.status],
      status: item.status,
      tone: statusTone(item.status),
      organizationId: item.organization_id,
      fixture,
      demoFilm,
      extras: {
        kind: item.kind,
        version: String(item.version),
        statusCodes: item.expires_on && item.expires_on < new Date().toISOString().slice(0, 10)
          ? "EXPIRED"
          : item.expires_on && item.expires_on <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
            ? "EXPIRING"
            : "",
      },
      treat: !fixture && /PENDING|SUBMITTED|UNDER_REVIEW|EXPIRED|REJECTED|QUARANTINED|EXPIRING/i.test(item.status),
    });
  });
}

export function mapMessagerieRows(
  locale: Locale,
  query: string,
  dash: AdminSupervisionDashboard,
  demoFilm = false,
  mode: "all" | "messages" | "notifications" = "all",
): ParcoursSpaceRow[] {
  const index = buildParcoursFilmIndex(dash);
  const messages = mode === "notifications" ? [] : (dash.messages ?? []).map((item) => {
    const fixture = isOperationalFixtureName(item.client_name, item.provider_name);
    return withChain(locale, query, index, { requestId: item.service_request_id }, {
      id: item.id,
      href: spaceHref(locale, "messagerie", query, item.id),
      title: item.subject,
      cells: [
        item.subject,
        `${presentOrgName(item.client_name, locale)} / ${presentOrgName(item.provider_name, locale)}`,
        locale === "ar" ? "محادثة طلب" : "Conversation demande",
        presentChannel("in-app", locale),
        presentDateTime(item.created_at, locale),
        item.status === "OPEN" ? "1" : "0",
        item.status,
        item.status === "OPEN" ? (locale === "ar" ? "عالية" : "Haute") : (locale === "ar" ? "عادية" : "Normale"),
      ],
      status: item.status,
      tone: statusTone(item.status),
      organizationId: item.client_organization_id,
      fixture,
      demoFilm,
      treat: !fixture && item.status === "OPEN",
      extras: {
        kind: "MESSAGE",
        rfqId: item.object_id,
        requestId: item.service_request_id,
        providerId: item.provider_organization_id,
        statusCodes: item.status === "OPEN" ? "OPEN|UNREAD" : item.status,
      },
    });
  });
  const notifications = mode === "messages" ? [] : (dash.notifications ?? []).map((item) => {
    const orgName = presentOrgName(item.organization_name, locale);
    const fixture = isOperationalFixtureName(item.organization_name);
    return {
      id: item.id,
      href: spaceHref(locale, "messagerie", query, item.id),
      title: localizeTechnicalCode(item.event_type, locale),
      cells: [
        localizeTechnicalCode(item.event_type, locale),
        orgName,
        locale === "ar" ? "إشعار منصة" : "Notification plateforme",
        presentChannel(item.channel, locale),
        presentDateTime(item.updated_at, locale),
        item.read_at ? "0" : "1",
        item.status,
        localizeStatus(item.priority, locale),
      ],
      status: item.status,
      tone: statusTone(item.status),
      organizationId: item.organization_id,
      fixture,
      demoFilm,
      treat: !fixture && !item.read_at,
      extras: {
        kind: "NOTIFICATION",
        statusCodes: item.read_at ? item.status : `UNREAD|${item.status}`,
        errorCode: item.error_code ?? "",
        attemptCount: String(item.attempt_count),
      },
      chain: [],
    } satisfies ParcoursSpaceRow;
  });
  return [...messages, ...notifications];
}

export function mapLitigesExceptionRows(
  locale: Locale,
  query: string,
  dash: AdminSupervisionDashboard,
  demoFilm = false,
): ParcoursSpaceRow[] {
  const index = buildParcoursFilmIndex(dash);
  return (dash.exceptions ?? []).map((item) => {
    const title = locale === "ar" ? item.title_ar : item.title_fr;
    const missionId = item.resource_type.includes("mission") ? item.resource_id : null;
    return withChain(locale, query, index, { missionId }, {
      id: item.id,
      href: spaceHref(locale, "litiges", query, item.id),
      title,
      cells: [
        title,
        missionId ? (locale === "ar" ? "مهمة مرتبطة" : "Mission liée") : "—",
        item.organization_id ? presentOrgName(dash.work_enrichment?.[item.id]?.organization_name ?? "—", locale) : "—",
        title,
        "—",
        "—",
        localizeStatus(item.priority, locale),
        "—",
        item.status,
      ],
      status: item.status,
      tone: item.priority === "HIGH" || item.priority === "CRITICAL" ? "peach" : statusTone(item.status),
      organizationId: item.organization_id ?? undefined,
      demoFilm,
      treat: item.status === "OPEN",
      extras: { missionId: item.resource_id, policy: item.source_kind },
    });
  });
}

export function mapLitigesGovernanceRows(
  locale: Locale,
  query: string,
  rows: Array<{
    id: string;
    missionId: string;
    status: string;
    obligationKey: string;
    urgency?: string;
    latestDecision?: { evidenceCount: number; outcome?: string | null } | null;
    reassignment?: { status?: string | null } | null;
  }>,
  demoFilm = false,
): ParcoursSpaceRow[] {
  return rows.map((item) => {
    const obligation = presentObligation(item.obligationKey, locale);
    return {
      id: item.id,
      href: spaceHref(locale, "litiges", query, item.id),
      title: obligation,
      cells: [
        obligation,
        locale === "ar" ? "مهمة مرتبطة" : "Mission liée",
        "—",
        obligation,
        item.latestDecision ? String(item.latestDecision.evidenceCount) : "—",
        "—",
        item.reassignment?.status ? localizeStatus(item.reassignment.status, locale) : "—",
        item.latestDecision?.outcome ? localizeTechnicalCode(item.latestDecision.outcome, locale) : "—",
        item.status,
      ],
      status: item.status,
      tone: item.urgency === "URGENT" ? "peach" : statusTone(item.status),
      demoFilm,
      treat: item.urgency === "URGENT" || !item.latestDecision || /OPEN|MEDIATION|IN_REVIEW|UNDER_REVIEW/i.test(item.status),
      extras: { missionId: item.missionId },
      chain: buildParcoursAriadneChain(locale, query, { missionId: item.missionId }),
    };
  });
}
