import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { AdminSpaceId } from "@/modules/admin/data/spaces/admin-nav";
import { isAdminOrgDirectoryFixture } from "@/modules/admin/data/spaces/actor-presentation";
import { statusTone } from "@/modules/admin/data/spaces/screen-catalog";
import type { SpaceSnapshot } from "@/modules/admin/data/spaces/space-data";
import { localizeStatus } from "@/modules/admin/data/spaces/view-model";

/** Spaces whose /nouvelle|/preparer must never fall through to the empty wizard dead-end. */
export const governedPreparationSpaces: ReadonlySet<AdminSpaceId> = new Set([
  "devis", "contrats", "missions", "jalons", "territoires", "franchises", "gouvernance",
  "avenants", "diagnostics", "demandes", "matching", "litiges", "messagerie", "documents",
]);

type Candidate = { id: string; label: string; status: string; href: string; next?: string; nextLabel?: string };
type Pathway = { href: string; label: string; primary?: boolean };

function Pathways({ items }: { items: Pathway[] }) {
  if (!items.length) return null;
  return (
    <div className="admin-prep-pathways">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={item.primary ? "admin-primary-cta" : "admin-soft-cta"}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function CandidateTable({
  locale,
  candidates,
  empty,
}: {
  locale: Locale;
  candidates: Candidate[];
  empty?: string;
}) {
  const ar = locale === "ar";
  if (!candidates.length) {
    return (
      <p role="status" className="admin-prep-empty">
        {empty
          ?? (ar
            ? "لا يوجد ملف مصدر يستوفي هذه الشروط في البيانات المحمّلة. راجع المرحلة السابقة من المسار."
            : "Aucun dossier source ne remplit ces prérequis dans les données chargées. Vérifiez l’étape précédente du parcours.")}
      </p>
    );
  }

  return (
    <div className="client-table-wrap admin-prep-table-wrap">
      <table className="client-space-table admin-queue-table">
        <thead>
          <tr>
            <th>{ar ? "الملف المصدر" : "Dossier source"}</th>
            <th>{ar ? "الحالة" : "État"}</th>
            <th>{ar ? "إجراءات" : "Actions"}</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((item) => (
            <tr key={item.id}>
              <td>
                <Link href={item.href}>
                  <strong>{item.label}</strong>
                </Link>
              </td>
              <td>
                <span className="client-status-chip" data-tone={statusTone(item.status)}>
                  {localizeStatus(item.status, locale)}
                </span>
              </td>
              <td>
                <div className="admin-prep-row-actions">
                  <Link href={item.href} className="admin-soft-cta">
                    {ar ? "فتح الملف" : "Ouvrir le dossier"}
                  </Link>
                  {item.next ? (
                    <Link href={item.next} className="client-ghost-link">
                      {item.nextLabel ?? (ar ? "المسار المهني — للعميل المخوّل فقط" : "Parcours métier — Client habilité uniquement")}
                    </Link>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CreationPreparation({ locale, query, space, snapshot }: { locale: Locale; query: string; space: AdminSpaceId; snapshot: SpaceSnapshot }) {
  const ar = locale === "ar";
  const data = snapshot.supervision;
  const candidates: Candidate[] = [];
  const pathways: Pathway[] = [];
  let instructions = ar
    ? "لا يُنشأ أي عنصر بنموذج إداري حر هنا. افتح مسار الإيداع أو ملف المصدر المناسب."
    : "Aucun objet n’est créé ici avec un formulaire admin libre. Ouvrez le parcours de dépôt ou le dossier source adapté.";

  if (space === "franchises") {
    instructions = ar
      ? "يُنشأ الامتياز عبر إيداع ترشيح من مسار المترشح، ثم مراجعة الإدارة، واقتراح الحوكمة، والموافقة المستقلة، والتفعيل. هذه الصفحة لا تنشئ امتيازاً بنموذج إداري حر."
      : "Une franchise se crée par dépôt de candidature sur le parcours candidat, puis revue admin, proposition de gouvernance, approbation indépendante et activation. Cette page ne crée pas de franchise avec un formulaire admin libre.";
    pathways.push(
      { href: `/${locale}/franchise/candidature`, label: ar ? "فتح استمارة الترشيح (إيداع)" : "Ouvrir le formulaire de candidature (dépôt)", primary: true },
      { href: `/${locale}/administration/candidatures-franchise${query}`, label: ar ? "فتح ملف الترشيحات (مراجعة)" : "Ouvrir la file candidatures (revue)" },
      { href: `/${locale}/administration/gouvernance${query}`, label: ar ? "فتح الحوكمة" : "Ouvrir la gouvernance" },
    );
    for (const item of snapshot.rows) candidates.push({ id: item.id, label: item.title, status: item.status, href: item.href });
  } else if (space === "gouvernance") {
    instructions = ar
      ? "تُقترح المصادقة من ترشيح الامتياز أو مراجعة التفويض. هذه الصفحة لا تنشئ طلب حوكمة بنموذج حر."
      : "Une validation de gouvernance se propose depuis une candidature franchise ou la revue d’un mandat. Cette page ne crée pas de demande de gouvernance avec un formulaire libre.";
    pathways.push(
      { href: `/${locale}/administration/candidatures-franchise${query}`, label: ar ? "فتح ترشيحات الامتياز" : "Ouvrir les candidatures franchise", primary: true },
      { href: `/${locale}/administration/territoires${query}`, label: ar ? "فتح الأقاليم والتفويضات" : "Ouvrir territoires & mandats" },
      { href: `/${locale}/administration/franchises${query}`, label: ar ? "فتح دليل أصحاب الامتياز" : "Ouvrir l’annuaire franchisés" },
    );
    for (const item of snapshot.rows) candidates.push({ id: item.id, label: item.title, status: item.status, href: item.href });
  } else if (space === "devis") {
    instructions = ar
      ? "يُعدّ مقدم الخدمة المخوّل العرض من استشارة RFQ فعلية، مع البنود والسعر والضرائب والصلاحية. افتح الطلب لمراجعة الاستشارة؛ الإدارة لا تكتب عرضاً باسم مقدم الخدمة."
      : "Le prestataire habilité rédige le devis depuis une consultation RFQ réelle : lignes, prix, fiscalité et validité. Ouvrez la demande pour examiner sa consultation ; l’administration ne rédige pas à sa place.";
    pathways.push({ href: `/${locale}/administration/matching${query}`, label: ar ? "فتح المطابقة والاستشارات" : "Ouvrir matching & consultations", primary: true });
    for (const item of data?.requests ?? []) if (item.rfq_count > 0) candidates.push({ id: item.id, label: item.organization_name, status: item.status, href: `/${locale}/administration/demandes/${item.id}${query}` });
  } else if (space === "contrats") {
    instructions = ar
      ? "يولّد العميل المخوّل مسودة العقد من العرض المختار، وفق الهويات المراجعة والقالب والعمولة المعتمدين. تبقى المصادقة والتوقيعات منفصلة عن التحضير الإداري."
      : "Le Client habilité génère le brouillon depuis le devis retenu, les identités vérifiées, le modèle et la commission approuvés. La validation et les signatures restent distinctes de cette préparation administrative.";
    pathways.push({ href: `/${locale}/client/contrats`, label: ar ? "فتح مسار العقود (للعميل المخوّل)" : "Ouvrir le parcours contrats (Client habilité)", primary: true });
    for (const item of data?.quotes ?? []) if (item.status === "SELECTED") candidates.push({ id: item.id, label: `${item.client_name} · ${item.provider_name}`, status: item.status, href: `/${locale}/administration/devis/${item.id}${query}` });
  } else if (space === "missions") {
    instructions = ar
      ? "ينشئ العميل المخوّل المهمة من عقد نشط موقّع، ويحدد موضوعها ومراحلها وآجالها. لا يُنشئ سبب المراجعة الإدارية مهمةً."
      : "Le Client habilité crée la mission depuis un contrat signé et actif, en précisant son objet, ses jalons et ses échéances. Un motif de revue administrative ne crée pas de mission.";
    pathways.push({ href: `/${locale}/client/missions`, label: ar ? "فتح مسار المهام (للعميل المخوّل)" : "Ouvrir le parcours missions (Client habilité)", primary: true });
    for (const item of data?.contracts ?? []) if (item.status === "ACTIVE" && !item.mission_id) candidates.push({ id: item.id, label: `${item.client_name} · ${item.provider_name}`, status: item.status, href: `/${locale}/administration/contrats/${item.id}${query}`, next: `/${locale}/client/contrats?organizationId=${encodeURIComponent(item.client_organization_id)}` });
  } else if (space === "jalons") {
    instructions = ar
      ? "تُحدد المراحل ضمن إنشاء المهمة من العقد. راجع المهمة وعقدها؛ إضافة مرحلة لا تتم بمجرد موافقة إدارية أو مرجع حر. يراجع العميل المخوّل التسليمات في مسار المهمة."
      : "Les jalons sont définis lors de la création de la mission depuis le contrat. Examinez la mission et son contrat ; une approbation administrative ou une référence libre n’ajoute pas de jalon. Le Client habilité examine les livraisons dans le parcours de la mission.";
    pathways.push({ href: `/${locale}/client/missions`, label: ar ? "فتح مسار المهام (للعميل المخوّل)" : "Ouvrir le parcours missions (Client habilité)", primary: true });
    for (const item of data?.missions ?? []) candidates.push({ id: item.id, label: `${item.client_name} · ${item.provider_name}`, status: item.status, href: `/${locale}/administration/missions/${item.id}${query}`, next: `/${locale}/client/missions/${item.id}/jalons?organizationId=${encodeURIComponent(item.client_organization_id)}` });
  } else if (space === "territoires") {
    instructions = ar
      ? "يحدد التفويض المؤسسة والمكتبة والإقليم والمدة والحقوق التعاقدية. راجع الملف في الحوكمة؛ هذه الصفحة لا تنشئ تفويضاً من نص حر. يتطلب الاقتراح والمراجعة المستقلة والتفعيل أدلتها الخاصة."
      : "Un mandat lie une organisation, une bibliothèque, un territoire, une durée et des droits contractuels. Examinez le dossier dans la gouvernance ; cette page ne crée pas de mandat à partir d’un texte libre. Proposition, revue indépendante et activation nécessitent leurs propres preuves.";
    pathways.push(
      { href: `/${locale}/administration/gouvernance${query}`, label: ar ? "فتح حوكمة التفويضات" : "Ouvrir la gouvernance des mandats", primary: true },
      { href: `/${locale}/administration/candidatures-franchise${query}`, label: ar ? "فتح ترشيحات الامتياز" : "Ouvrir les candidatures franchise" },
    );
    for (const item of snapshot.rows) candidates.push({ id: item.id, label: item.title, status: item.status, href: item.href });
  } else if (space === "avenants") {
    instructions = ar
      ? "يُنشئ العميل المخوّل الملحق من عقد قائم. راجع العقد المصدر؛ الإدارة لا تكتب ملحقاً باسم الأطراف."
      : "Le Client habilité crée l’avenant depuis un contrat existant. Examinez le contrat source ; l’administration ne rédige pas d’avenant à la place des parties.";
    pathways.push({ href: `/${locale}/client/contrats`, label: ar ? "فتح مسار العقود (للعميل المخوّل)" : "Ouvrir le parcours contrats (Client habilité)", primary: true });
    for (const item of data?.contracts ?? []) candidates.push({ id: item.id, label: `${item.client_name} · ${item.provider_name}`, status: item.status, href: `/${locale}/administration/contrats/${item.id}${query}` });
  } else if (space === "diagnostics") {
    instructions = ar
      ? "يشغّل العميل المخوّل التشخيص من مساحة العميل فقط. من الإدارة افتحوا ملف المؤسسة أو طابور التشخيصات للإشراف؛ لا يوجد اختصار إداري يفتح مساحة العميل."
      : "Seul le Client habilité lance le diagnostic dans son espace. Depuis l’administration, ouvrez la fiche organisation ou la file diagnostics pour superviser ; aucun raccourci admin n’ouvre l’espace Client.";
    pathways.push(
      { href: `/${locale}/administration/diagnostics${query}`, label: ar ? "فتح طابور التشخيصات (إشراف)" : "Ouvrir la file diagnostics (supervision)", primary: true },
      { href: `/${locale}/administration/entreprises${query}`, label: ar ? "فتح دليل المنظمات" : "Ouvrir l’annuaire organisations" },
    );
    for (const item of data?.organizations ?? []) {
      const roles = item.role_codes ?? [];
      if (!roles.includes("CLIENT")) continue;
      if (/ARCHIVED|DISABLED|SUSPENDED|RETIRED/i.test(item.status)) continue;
      if (isAdminOrgDirectoryFixture(item.display_name, item.legal_name)) continue;
      const orgQuery = `?organizationId=${encodeURIComponent(item.id)}`;
      candidates.push({
        id: item.id,
        label: item.display_name,
        status: item.status,
        href: `/${locale}/administration/entreprises/${item.id}${query}`,
        next: `/${locale}/administration/diagnostics${orgQuery}`,
        nextLabel: ar ? "الإشراف على تشخيصات هذه المؤسسة" : "Superviser les diagnostics de cette organisation",
      });
    }
  } else if (space === "demandes" || space === "matching") {
    instructions = ar
      ? "ينشئ العميل المخوّل الطلب والمطابقة من مساره. راجع الطلبات الجارية؛ لا يُنشأ طلب من نموذج إداري حر."
      : "Le Client habilité crée la demande et le matching depuis son parcours. Examinez les demandes en cours ; aucun besoin n’est créé depuis un formulaire admin libre.";
    pathways.push(
      { href: `/${locale}/client/demandes/nouvelle`, label: ar ? "فتح إنشاء طلب (للعميل المخوّل)" : "Ouvrir la création de demande (Client habilité)", primary: true },
      { href: `/${locale}/client/demandes`, label: ar ? "فتح طلبات العميل" : "Ouvrir les demandes client" },
    );
    for (const item of data?.requests ?? []) candidates.push({ id: item.id, label: item.organization_name, status: item.status, href: `/${locale}/administration/demandes/${item.id}${query}` });
  } else if (space === "litiges") {
    instructions = ar
      ? "يُفتح النزاع من المهمة المعنية بأدلته. راجع المهام والمنازعات الجارية."
      : "Le litige s’ouvre depuis la mission concernée avec ses preuves. Examinez les missions et litiges en cours.";
    pathways.push({ href: `/${locale}/client/litiges`, label: ar ? "فتح مسار النزاعات (للعميل المخوّل)" : "Ouvrir le parcours litiges (Client habilité)", primary: true });
    for (const item of data?.missions ?? []) candidates.push({ id: item.id, label: `${item.client_name} · ${item.provider_name}`, status: item.status, href: `/${locale}/administration/missions/${item.id}${query}` });
  } else if (space === "messagerie") {
    instructions = ar
      ? "تُدار المراسلات من سياق الطلب أو المهمة. راجع المحادثات الموجودة؛ لا تُنشأ محادثة حرّة هنا."
      : "La messagerie s’administre depuis le contexte d’une demande ou d’une mission. Examinez les fils existants ; aucune conversation libre n’est créée ici.";
    for (const item of snapshot.rows) candidates.push({ id: item.id, label: item.title, status: item.status, href: item.href });
  } else if (space === "documents") {
    instructions = ar
      ? "يُستورد المستند من خزينة المالك ثم يُراجع. استخدم مسار المشاركة الخاضعة للرقابة."
      : "Le document est importé depuis le coffre du propriétaire puis revu. Utilisez le parcours de partage contrôlé.";
    for (const item of snapshot.rows) candidates.push({ id: item.id, label: item.title, status: item.status, href: `/${locale}/administration/documents/${item.id}/reutilisation${query}` });
  }

  return (
    <div className="client-page" data-admin-layout="governed-preparation">
      <section className="client-card admin-prep-board">
        <header className="admin-prep-head">
          <div>
            <h2>{ar ? "تحضير ومراجعة الملف المصدر" : "Préparation et revue du dossier source"}</h2>
            <p>{instructions}</p>
            <p className="client-access-note">
              {ar
                ? "لم يُنشأ أي عنصر هنا. يتطلب المسار المهني صلاحياته والتحقق متعدد العوامل؛ صلاحية الإدارة وحدها لا تمنح صفة العميل أو مقدم الخدمة."
                : "Aucun objet n’est créé ici. Le parcours métier conserve ses habilitations et la MFA ; le rôle Admin seul ne confère pas la qualité de Client ou de Prestataire."}
            </p>
          </div>
        </header>
        <Pathways items={pathways} />
        <div className="admin-prep-sources">
          <h3>{ar ? "الملفات المصدر المتاحة للمراجعة" : "Dossiers sources disponibles pour la revue"}</h3>
          <p className="client-access-note" role="status">
            {candidates.length
              ? (ar ? `${candidates.length} ملف مصدر` : `${candidates.length} dossier${candidates.length > 1 ? "s" : ""} source${candidates.length > 1 ? "s" : ""}`)
              : null}
          </p>
          <CandidateTable locale={locale} candidates={candidates} />
        </div>
        <p className="admin-prep-back">
          <Link href={`/${locale}/administration/${space}${query}`} className="client-ghost-link">
            {ar ? "العودة إلى قائمة الملفات" : "Retourner à la file des dossiers"}
          </Link>
        </p>
      </section>
    </div>
  );
}

export function DocumentSharePreparation({ locale, query, snapshot }: { locale: Locale; query: string; snapshot: SpaceSnapshot }) {
  const ar = locale === "ar";
  const candidates: Candidate[] = snapshot.rows.map((row) => ({
    id: row.id,
    label: row.title,
    status: row.status,
    href: `/${locale}/administration/documents/${row.id}/reutilisation${query}`,
  }));
  return (
    <div className="client-page">
      <section className="client-card admin-prep-board">
        <header className="admin-prep-head">
          <div>
            <h2>{ar ? "اختيار وثيقة موجودة للمشاركة الخاضعة للرقابة" : "Choisir un document existant pour un partage contrôlé"}</h2>
            <p>
              {ar
                ? "تُعدّ هذه الصفحة مشاركة وثيقة موجودة، ولا ترفع ملفاً جديداً. يستورد المالك ملفاته من خزينته. تُراجع الوجهة والنطاق والفحص قبل طلب موافقته."
                : "Cette page prépare le partage d’un document existant ; elle n’importe aucun fichier. Le propriétaire importe ses pièces depuis son coffre. La destination, le périmètre et l’analyse du fichier sont vérifiés avant de demander son consentement."}
            </p>
          </div>
        </header>
        <div className="admin-prep-sources">
          <h3>{ar ? "الوثائق المتاحة" : "Documents disponibles"}</h3>
          <CandidateTable
            locale={locale}
            candidates={candidates}
            empty={ar
              ? "لا توجد وثيقة متاحة في النطاق الحالي. يلزم أولاً استيراد وثيقة من خزينة مالكها."
              : "Aucun document disponible dans ce périmètre. Une pièce doit d’abord être importée dans le coffre de son propriétaire."}
          />
        </div>
        <p className="admin-prep-back">
          <Link href={`/${locale}/administration/documents${query}`} className="client-ghost-link">
            {ar ? "العودة إلى الوثائق" : "Retourner aux documents"}
          </Link>
        </p>
      </section>
    </div>
  );
}
