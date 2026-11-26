import { CreationPreparation, DocumentSharePreparation, governedPreparationSpaces } from "./creation-preparation";
import { ProviderInvitationWorkspace } from "./provider-invitation";
import{loadAdminHistoryPage}from"@/modules/admin/screens/history/actions";
import Link from "next/link";
import{loadAdminConversationPage}from"@/modules/admin/screens/conversations/actions";
import { notFound, redirect } from "next/navigation";
import { mfaRequiredMessage } from "@/modules/shared/lib/account-security/platform-access";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { AdminReadError } from "@/modules/admin/ui/admin-read-error";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { isAdminSpaceId, isReservedView, type AdminSpaceId } from "@/modules/admin/data/spaces/admin-nav";
import { spaceSpec, statusTone } from "@/modules/admin/data/spaces/screen-catalog";
import { findSpaceRow, loadAdminSpaceSnapshot } from "@/modules/admin/data/spaces/space-data";
import { localizeStatus } from "@/modules/admin/data/spaces/view-model";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { specialBoardCopy } from "@/modules/admin/data/spaces/special-copy";
import {
  SpaceCompareBoard,
  SpaceDecisionBoard,
  SpaceDetailBoard,
  SpaceHeaderActions,
  SpaceQueueBoard,
  SpaceWizardBoard,
} from "./queue-kit";
import { ConsultationSendBoard, DocumentReuseBoard, NotificationPreferencesBoard, SpecialBoardActions } from "./special-boards";
import { ProvidersPanel } from "@/modules/admin/screens/providers/providers-panel";
import { getAdminProviderMessages } from "@/modules/admin/screens/providers/messages";
import { GovernanceDashboard } from "@/modules/admin/screens/gouvernance-franchise/governance-dashboard";
import { getAdminGovernanceMessages } from "@/modules/admin/screens/gouvernance-franchise/messages";
import { DocumentVaultPanel } from "./document-vault-panel";
import { adminFilmForSpace } from "@/modules/admin/data/spaces/admin-film";
import { buildSpaceHubMetrics } from "@/modules/admin/data/spaces/hub-metrics";
import { AdminFilmStrip } from "@/modules/admin/ui/admin-film-strip";
import { AdminStep2Gate } from "@/modules/admin/ui/admin-step2-gate";
import { AdminStep5Gate } from "@/modules/admin/ui/admin-step5-gate";
import { AdminCommerceGate } from "@/modules/admin/ui/admin-commerce-gate";
import { AdminStep11Gate } from "@/modules/admin/ui/admin-step11-gate";

export async function renderAdminSpacePage({
  locale: localeParam,
  space: spaceParam,
  itemId,
  action,
  organizationId,
  q,
  vue,
  fixtures,
}: {
  locale: string;
  space: string;
  itemId?: string;
  action?: string;
  organizationId?: string;
  q?: string;
  vue?: string;
  fixtures?: string;
}) {
  if (!isLocale(localeParam) || !isAdminSpaceId(spaceParam)) notFound();
  const locale = localeParam;
  const includeFixtures = fixtures === "1" || fixtures === "true";
  const returnParams = new URLSearchParams();
  if (organizationId) returnParams.set("organizationId", organizationId);
  if (q) returnParams.set("q", q);
  if (vue) returnParams.set("vue", vue);
  if (includeFixtures) returnParams.set("fixtures", "1");
  const returnPath = `/${locale}/administration/${spaceParam}${itemId ? `/${encodeURIComponent(itemId)}` : ""}${action ? `/${encodeURIComponent(action)}` : ""}${returnParams.size ? `?${returnParams.toString()}` : ""}`;
  const space: AdminSpaceId = spaceParam === "territoires" && itemId === "validations" ? "gouvernance" : spaceParam;
  if (space === "gouvernance" && spaceParam === "territoires") {
    itemId = undefined;
    action = undefined;
  }
  // Passing the full destination lets the shared account-security guard retain
  // the dossier and filters through an MFA challenge, before any data is read.
  const scopeInput = { locale, organizationId, returnPath };
  const admin = await resolveAdminSpace(scopeInput);
  if (admin.status === "unauthenticated") redirect(connexionHref(locale, { next: returnPath }));
  const snapshot = await loadAdminSpaceSnapshot(locale, space, admin.selectedQuery);
  const spec = spaceSpec(space);
  const uiParams=new URLSearchParams(admin.selectedQuery);if(q)uiParams.set("q",q);if(vue)uiParams.set("vue",vue);if(includeFixtures)uiParams.set("fixtures","1");const uiQuery=uiParams.size?`?${uiParams.toString()}`:"";
  const alternate = locale === "ar" ? "fr" : "ar";
  const failureReason = snapshot.reason;
  const currentHref = `/${locale}/administration/${space}${itemId ? `/${itemId}` : ""}${action ? `/${action}` : ""}${uiQuery}`;
  if (failureReason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: currentHref }));
  if (snapshot.detailsReason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: currentHref }));
  const reserved = itemId && isReservedView(itemId) ? itemId : null;
  // Franchise creation is candidature → revue → gouvernance → activation — never a free admin form.
  if (space === "franchises" && (reserved === "nouvelle" || reserved === "preparer")) {
    redirect(`/${locale}/administration/candidatures-franchise${uiQuery}`);
  }
  const view = action ?? reserved ?? (itemId ? "detail" : "queue");
  const row = itemId && !reserved ? findSpaceRow(snapshot, itemId) : null;
  if (row && (!snapshot.reason || snapshot.reason === "OK")) {
    const history=await loadAdminHistoryPage(row.id,row.organizationId);
    row.historyPage=history.status==="success"?history.page:null;
    if(space==="messagerie"&&row.extras?.kind!=="NOTIFICATION"){const chat=await loadAdminConversationPage(row.id);row.conversation=chat.status==="success"?chat.page:null;}
  }


  const groupLabel = spec.nav === "actors"
    ? (locale === "ar" ? "الفاعلون" : "Acteurs")
    : (locale === "ar" ? "المسار المهني" : "Parcours métier");
  const groupHref = spec.nav === "actors"
    ? `/${locale}/administration/acteurs${admin.selectedQuery}`
    : `/${locale}/administration/parcours${admin.selectedQuery}`;

  const crumbItems: Array<{ href?: string; label: string }> = [
    { href: groupHref, label: groupLabel },
    { href: view === "queue" ? undefined : `/${locale}/administration/${space}${admin.selectedQuery}`, label: spec.title(locale) },
  ];
  if (row) crumbItems.push({ label: row.title });
  if (reserved === "nouvelle" || reserved === "preparer") crumbItems.push({ label: spec.createLabel?.(locale) ?? spec.title(locale) });
  if (reserved === "comparer") crumbItems.push({ label: locale === "ar" ? "مقارنة" : "Comparer" });
  if (reserved === "preferences") crumbItems.push({ label: specialBoardCopy(locale, "preferences").crumb });
  if (action) crumbItems.push({ label: action === "consultation" ? specialBoardCopy(locale, "consultation").crumb : action === "reutilisation" ? specialBoardCopy(locale, "reuse").crumb : actionLabel(locale, action) });

  const specialKind = action === "consultation"
    ? "consultation"
    : reserved === "reutilisation" || action === "reutilisation"
      ? "reuse"
      : reserved === "preferences" || action === "preferences"
        ? "preferences"
        : null;
  const special = specialKind ? specialBoardCopy(locale, specialKind) : null;

  let body;
  if (failureReason && failureReason !== "OK") {
    body = null;
  } else if (view === "queue") {
    body = (
      <SpaceQueueBoard
        locale={locale}
        query={uiQuery}
        space={space}
        rows={snapshot.rows}
        treat={snapshot.treat}
        search={q}
        vue={vue}
        includeFixtures={includeFixtures}
        metrics={spec.nav === "parcours" ? buildSpaceHubMetrics(space, snapshot.supervision, locale) : undefined}
      >
        {space === "providers" && snapshot.providers ? (
          <details className="client-ops">
            <summary>{getAdminProviderMessages(locale).title}</summary>
            <ProvidersPanel dashboard={snapshot.providers} locale={locale} messages={getAdminProviderMessages(locale)} keys={providerKeys(snapshot.providers)} />
          </details>
        ) : null}
        {space === "documents" ? <DocumentVaultPanel locale={locale} /> : null}
        {(space === "territoires" || space === "gouvernance" || space === "franchises") && snapshot.governance ? (
          <details className="client-ops">
            <summary>{getAdminGovernanceMessages(locale).title}</summary>
            <GovernanceDashboard dashboard={snapshot.governance} locale={locale} messages={getAdminGovernanceMessages(locale)} />
          </details>
        ) : null}
      </SpaceQueueBoard>
    );
  } else if (reserved === "comparer") {
    body = <SpaceCompareBoard locale={locale} query={uiQuery} space={space} rows={snapshot.rows} />;
  } else if (reserved === "preferences" || action === "preferences") {
    body = <NotificationPreferencesBoard locale={locale} query={uiQuery} templates={snapshot.supervision?.templates ?? []} />;
  } else if (reserved === "reutilisation" || action === "reutilisation") {
    body = row ? <DocumentReuseBoard locale={locale} query={uiQuery} row={row} /> : <DocumentSharePreparation locale={locale} query={uiQuery} snapshot={snapshot} />;
  } else if (action === "modifier") {
    body = governedPreparationSpaces.has(space)
      ? <CreationPreparation locale={locale} query={uiQuery} space={space} snapshot={snapshot} />
      : row
        ? <SpaceWizardBoard locale={locale} query={uiQuery} space={space} itemId={row.id} row={row} />
        : <MissingRecord locale={locale} space={space} query={uiQuery} />;
  } else if (reserved === "nouvelle" || reserved === "preparer") {
    // Never fall through to the empty wizard ("Création non disponible ici") for create entrypoints.
    body = space === "documents" ? <DocumentSharePreparation locale={locale} query={uiQuery} snapshot={snapshot} />
      : space === "providers" ? await ProviderInvitationWorkspace({ locale, query: uiQuery, snapshot })
        : <CreationPreparation locale={locale} query={uiQuery} space={space} snapshot={snapshot} />;
  } else if (action === "consultation") {
    body = row
      ? <ConsultationSendBoard locale={locale} query={uiQuery} row={row} />
      : <MissingRecord locale={locale} space={space} query={uiQuery} />;
  } else if (action === "decision" || action === "revue" || action === "activation" || action === "activer" || action === "cycle") {
    body = row
      ? <SpaceDecisionBoard locale={locale} query={uiQuery} space={space} row={row} />
      : <MissingRecord locale={locale} space={space} query={uiQuery} />;
  } else if (row) {
    body = <SpaceDetailBoard locale={locale} query={uiQuery} space={space} row={row} />;
  } else {
    body = <MissingRecord locale={locale} space={space} query={uiQuery} />;
  }

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={admin.selectedQuery}
      selectedOrganizationId={admin.selectedOrganizationId}
      userEmail={admin.userEmail}
      active={spec.nav}
      actorCurrent={spec.nav === "actors" ? spec.current : undefined}
      parcoursCurrent={spec.nav === "parcours" ? spec.current : undefined}
      searchAction={`/${locale}/administration/${space}`}
      searchPlaceholder={spec.search(locale)}
      alternateHref={`/${alternate}/administration/${space}${itemId ? `/${itemId}` : ""}${action ? `/${action}` : ""}${uiQuery}`}
      crumb={<AdminCrumb locale={locale} query={uiQuery} items={crumbItems} />}
      title={
        special
          ? special.title
          : reserved === "nouvelle" || reserved === "preparer"
            ? (spec.createLabel?.(locale) ?? spec.title(locale))
            : reserved === "comparer"
              ? (locale === "ar" ? "مقارنة العروض" : "Comparer les offres")
              : row && view !== "queue"
                ? `${spec.title(locale)} — ${row.title}`
                : spec.title(locale)
      }
      lead={special?.lead ?? spec.lead(locale)}
      kicker={row ? localizeStatus(row.status, locale) : undefined}
      kickerTone={row ? statusTone(row.status) : undefined}
      actions={snapshot.reason && snapshot.reason !== "OK" ? undefined : specialKind ? <SpecialBoardActions locale={locale} kind={specialKind} /> : <SpaceHeaderActions locale={locale} query={uiQuery} spec={spec} mode={row && view !== "queue" ? "detail" : "queue"} />}
    >
      {failureReason && failureReason !== "OK" ? (
        <div className="client-page">
          {failureReason === "MFA_REQUIRED" ? <Alert variant="destructive">
            <AlertTitle>{mfaRequiredMessage(locale)}</AlertTitle>
            <AlertDescription>{locale === "ar" ? "البيانات مخفية حتى إتمام التحقق الأمني." : "Les données restent masquées jusqu’à la vérification de sécurité."}</AlertDescription>
          </Alert> : <AdminReadError locale={locale} reason={failureReason} retryHref={currentHref} />}
        </div>
      ) : <>
        {view === "queue" && (space === "franchises" || space === "gouvernance" || space === "territoires") ? (
          <AdminStep2Gate
            locale={locale}
            query={uiQuery}
            current={space === "franchises" ? "franchises" : space === "gouvernance" ? "gouvernance" : "territoires"}
          />
        ) : null}
        {view === "queue" && (space === "providers" || space === "qualification" || space === "capacite") ? (
          <AdminStep5Gate
            locale={locale}
            query={uiQuery}
            current={space === "providers" ? "providers" : space === "qualification" ? "qualification" : "capacite"}
          />
        ) : null}
        {view === "queue" && (space === "diagnostics" || space === "demandes" || space === "matching" || space === "devis" || space === "contrats" || space === "missions") ? (
          <AdminCommerceGate locale={locale} query={uiQuery} current={space} />
        ) : null}
        {view === "queue" && space === "litiges" ? <AdminStep11Gate locale={locale} query={uiQuery} current="litiges" /> : null}
        {(() => {
          const film = adminFilmForSpace(locale, space, uiQuery);
          if (!film) return null;
          // Fiche : une seule prochaine action. Liste : film complet 1→11.
          return <AdminFilmStrip locale={locale} film={film} compact={Boolean(row && view !== "queue")} />;
        })()}
        {snapshot.detailsReason ? <aside className="client-page"><Alert>
          <AlertTitle>{locale === "ar" ? "بعض التفاصيل غير متاحة" : "Certains détails sont indisponibles"}</AlertTitle>
          <AlertDescription><p>{locale === "ar" ? "تظل القائمة المسترجعة متاحة. لم تحمل لوحات التشغيل الإضافية؛ لا يعني ذلك عدم وجود إجراءات معلقة." : "La liste récupérée reste consultable. Les panneaux opérationnels complémentaires n’ont pas été chargés ; cela ne signifie pas qu’aucune action n’est en attente."}</p><a href={currentHref}>{locale === "ar" ? "إعادة تحميل التفاصيل" : "Recharger les détails"}</a></AlertDescription>
        </Alert></aside> : null}
        {body}
      </>}

    </AdminAppShell>
  );
}

function MissingRecord({ locale, space, query }: { locale: "fr" | "ar"; space: string; query: string }) {
  return (
    <div className="client-page">
      <article className="client-empty">
        <p>{locale === "ar" ? "تعذر فتح هذا الملف." : "Ce dossier n’est pas accessible avec vos droits actuels."}</p>
        <Link href={`/${locale}/administration/${space}${query}`} className="client-ghost-link">{locale === "ar" ? "العودة إلى القائمة" : "Retour à la liste"}</Link>
      </article>
    </div>
  );
}

function actionLabel(locale: "fr" | "ar", action: string) {
  const map: Record<string, [string, string]> = {
    decision: ["Décision", "قرار"],
    revue: ["Revue", "مراجعة"],
    activation: ["Activation", "تفعيل"],
    activer: ["Activer", "تفعيل"],
    consultation: ["Consultation", "استشارة"],
    cycle: ["Démarrage et clôture", "الانطلاق والإغلاق"],
    modifier: ["Modifier", "تعديل"],
    reutilisation: ["Réutilisation", "إعادة استخدام"],
  };
  const pair = map[action];
  return pair ? (locale === "ar" ? pair[1] : pair[0]) : action;
}

function providerKeys(dashboard: { providers: Array<{ organizationId: string }>; documents: Array<{ id: string }>; services: Array<{ id: string }> }) {
  const keys: Record<string, string> = {
    statement: crypto.randomUUID(),
    invoice: crypto.randomUUID(),
    payment: crypto.randomUUID(),
    reconcile: crypto.randomUUID(),
    credit: crypto.randomUUID(),
    plan: crypto.randomUUID(),
    collection: crypto.randomUUID(),
    advance: crypto.randomUUID(),
  };
  for (const provider of dashboard.providers) keys[`company:${provider.organizationId}`] = crypto.randomUUID();
  for (const document of dashboard.documents) keys[`document:${document.id}`] = crypto.randomUUID();
  for (const service of dashboard.services) keys[`qualification:${service.id}`] = crypto.randomUUID();
  return keys;
}
