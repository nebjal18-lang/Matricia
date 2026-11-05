import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BoxFormulaForm, PreparationField } from "@/modules/admin/screens/delivery-preparation/forms";
import { loadDeliveryPreparationWorkspace } from "@/modules/admin/screens/delivery-preparation/load";
import { type PreparationItem, type PreparationSection } from "@/modules/admin/screens/delivery-preparation/model";
import { AdminAppShell } from "@/modules/admin/ui/admin-app-shell";
import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { PLATFORM_ADMIN_ROLES } from "@/modules/shared/lib/connected-space/workspace-landing";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";

const pageSize = 20;

export default async function DeliveryPreparationPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ serviceQ?: string; servicePage?: string; categoryQ?: string; categoryPage?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const access = await loadMyPlatformAccess();
  const fr = locale === "fr";
  const selfPath = `/${locale}/administration/preparation`;
  if (access.status === "error" && access.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: selfPath }));
  if (access.status === "error" || !hasPlatformRole(access.roles, PLATFORM_ADMIN_ROLES)) {
    return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto max-w-3xl p-6"><WorkspaceFailure locale={locale} reason={access.status === "error" ? access.reason : "FORBIDDEN"} returnPath={selfPath} /></main>;
  }
  const shell = {
    locale,
    selectedQuery: "",
    selectedOrganizationId: null,
    userEmail: access.email,
    active: "settings" as const,
    alternateHref: `/${fr ? "ar" : "fr"}/administration/preparation`,
    title: fr ? "Préparation de la livraison" : "إعداد التسليم",
    lead: fr ? "Saisissez ici les éléments qui manquent encore. Chaque enregistrement reste un brouillon : rien n’est publié." : "أدخلوا هنا العناصر التي لا تزال ناقصة. كل حفظ يبقى مسودة: لا يُنشر شيء.",
  };
  if (!access.requirementSatisfied) return <AdminAppShell {...shell}><WorkspaceFailure locale={locale} reason="MFA_REQUIRED" returnPath={selfPath} /></AdminAppShell>;
  const loaded = await loadDeliveryPreparationWorkspace(access.client, query);
  const servicePage = loaded.status === "success" ? loaded.workspace.servicePage : loaded.servicePage;
  const categoryPage = loaded.status === "success" ? loaded.workspace.categoryPage : loaded.categoryPage;
  const workspace = loaded.status === "success" ? loaded.workspace : null;
  const loadFailure = loaded.status === "error" ? loaded.reason : "QUERY_FAILED";
  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { serviceQ: query.serviceQ, servicePage: String(servicePage), categoryQ: query.categoryQ, categoryPage: String(categoryPage), ...patch };
    for (const [key, value] of Object.entries(merged)) if (value && value !== "1" && value !== "") next.set(key, value);
    const suffix = next.toString();
    return suffix ? `${selfPath}?${suffix}` : selfPath;
  };
  return (
    <AdminAppShell {...shell}>
      <main className="client-page">
        <p className="text-sm text-muted-foreground">{fr ? "Les brouillons ne changent pas les pages légales, les noms publiés du catalogue, les prix, les quotas en vigueur, ni les prestataires réellement branchés." : "لا تغيّر المسودات الصفحات القانونية ولا أسماء الدليل المنشورة ولا الأسعار ولا الحصص السارية ولا المزوّدين المرتبطين فعلياً."}</p>
        <nav className="mt-4 flex flex-wrap gap-3 text-sm" aria-label={fr ? "Sections de préparation" : "أقسام الإعداد"}>
          <a href="#catalogue">{fr ? "Noms arabes" : "الأسماء العربية"}</a>
          <a href="#legal">{fr ? "Identité légale" : "الهوية القانونية"}</a>
          <a href="#box">{fr ? "Formules Box" : "صيغ الصناديق"}</a>
          <a href="#integrations">{fr ? "Intégrations" : "التكاملات"}</a>
          <a href="#release">{fr ? "Décisions de livraison" : "قرارات التسليم"}</a>
        </nav>
        {!workspace ? <WorkspaceFailure locale={locale} reason={loadFailure} returnPath={selfPath} /> : (
          <>
            {workspace.unavailableSections.length ? <p role="alert" className="mt-4 text-sm">{fr ? `Certaines sections sont temporairement indisponibles : ${workspace.unavailableSections.join(", ")}.` : `بعض الأقسام غير متاحة مؤقتاً: ${workspace.unavailableSections.join(", ")}.`}</p> : null}
            <p className="mt-4 text-sm">{fr ? `Services encore en français dans le champ arabe : ${workspace.overview.services_pending}. Brouillons de services : ${workspace.overview.services_drafted}. Catégories encore copiées : ${workspace.overview.categories_pending}. Brouillons de catégories : ${workspace.overview.categories_drafted}. Identité : ${workspace.overview.legal_drafted}/${workspace.overview.legal_total}. Formules : ${workspace.overview.box_drafted}. Intégrations décrites : ${workspace.overview.integrations_drafted}/${workspace.overview.integrations_total}, secrets enregistrés : ${workspace.overview.integrations_secret}. Décisions : ${workspace.overview.release_drafted}/${workspace.overview.release_total}.` : `خدمات ما زال حقلها العربي فرنساً: ${workspace.overview.services_pending}. مسودات الخدمات: ${workspace.overview.services_drafted}. فئات ما زالت منسوخة: ${workspace.overview.categories_pending}. مسودات الفئات: ${workspace.overview.categories_drafted}. الهوية: ${workspace.overview.legal_drafted}/${workspace.overview.legal_total}. الصيغ: ${workspace.overview.box_drafted}. تكاملات موصوفة: ${workspace.overview.integrations_drafted}/${workspace.overview.integrations_total}، أسرار محفوظة: ${workspace.overview.integrations_secret}. قرارات: ${workspace.overview.release_drafted}/${workspace.overview.release_total}.`}</p>
            <section id="catalogue" className="mt-8 grid gap-4">
              <h2>{fr ? "Noms arabes du catalogue" : "الأسماء العربية للدليل"}</h2>
              <p className="text-sm text-muted-foreground">{fr ? "Seuls les services et catégories dont l’arabe est encore la copie du français sont listés. Le nom arabe doit contenir des lettres arabes." : "تُعرض فقط الخدمات والفئات التي ما زالت عربيتها نسخة من الفرنسية. يجب أن يحتوي الاسم العربي على حروف عربية."}</p>
              <CatalogueList locale={locale} title={fr ? "Services" : "الخدمات"} queryName="serviceQ" pageName="servicePage" queryValue={query.serviceQ ?? ""} page={servicePage} total={workspace.services.total} items={workspace.services.items} section="CATALOG_SERVICE_AR" href={href} preserve={{ categoryQ: query.categoryQ, categoryPage: String(categoryPage) }} />
              <CatalogueList locale={locale} title={fr ? "Catégories" : "الفئات"} queryName="categoryQ" pageName="categoryPage" queryValue={query.categoryQ ?? ""} page={categoryPage} total={workspace.categories.total} items={workspace.categories.items} section="CATALOG_CATEGORY_AR" href={href} preserve={{ serviceQ: query.serviceQ, servicePage: String(servicePage) }} />
            </section>
            <DraftSection id="legal" locale={locale} title={fr ? "Identité légale" : "الهوية القانونية"} lead={fr ? "Ces onze champs alimenteront plus tard les pages légales. Les enregistrer ici ne les publie pas." : "ستغذّي هذه الحقول الأحد عشر الصفحات القانونية لاحقاً. حفظها هنا لا ينشرها."} section="LEGAL" items={workspace.legal.items} multilineKeys={["LEGAL_ENTITY_ADDRESS", "LEGAL_HOST_ADDRESS", "LEGAL_RETENTION_FR", "LEGAL_RETENTION_AR", "LEGAL_TERMS_APPROVAL_REFERENCE"]} />
            <section id="box" className="mt-8 grid gap-4">
              <h2>{fr ? "Formules Box" : "صيغ الصناديق"}</h2>
              <p className="text-sm text-muted-foreground">{fr ? "Décrivez les quotas, privilèges et conditions de chaque formule. Aucun montant n’est créé." : "صفوا حصص كل صيغة وامتيازاتها وشروطها. لا يُنشأ أي مبلغ."}</p>
              <BoxFormulaForm locale={locale} idempotencyKeys={{ quota: randomUUID(), privileges: randomUUID(), conditions: randomUUID() }} />
              {workspace.box.items.map((item) => <PreparationField key={item.key} locale={locale} section="BOX" item={item} idempotencyKey={randomUUID()} multiline />)}
            </section>
            <DraftSection id="integrations" locale={locale} title={fr ? "Intégrations réelles" : "التكاملات الفعلية"} lead={fr ? "Indiquez le prestataire et, quand vous l’avez, sa clé. La clé n’est jamais réaffichée et ne branche pas le prestataire." : "حدّدوا المزوّد ومفتاحه عندما يتوفر. لا يُعاد عرض المفتاح ولا يُربط المزوّد."} section="INTEGRATION" items={workspace.integrations.items} secret />
            <DraftSection id="release" locale={locale} title={fr ? "Décisions de livraison" : "قرارات التسليم"} lead={fr ? "Consignez la décision CNDP, la fiscalité validée, l’adresse de préproduction et la référence du procès-verbal. Un texte enregistré ne vaut pas la décision signée." : "سجّلوا قرار اللجنة الوطنية والضرائب المعتمدة وعنوان ما قبل الإنتاج ومرجع محضر الاستلام. النص المحفوظ لا يغني عن القرار الموقّع."} section="RELEASE" items={workspace.release.items} multiline />
          </>
        )}
      </main>
    </AdminAppShell>
  );
}

function CatalogueList({ locale, title, queryName, pageName, queryValue, page, total, items, section, href, preserve }: { locale: "fr" | "ar"; title: string; queryName: string; pageName: string; queryValue: string; page: number; total: number; items: PreparationItem[]; section: PreparationSection; href: (patch: Record<string, string | undefined>) => string; preserve: Record<string, string | undefined> }) {
  const fr = locale === "fr";
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="grid gap-3">
      <h3>{title}</h3>
      <form className="flex flex-wrap items-end gap-2" action={`/${locale}/administration/preparation`}>
        <label htmlFor={queryName} className="text-sm font-medium">{fr ? "Recherche" : "بحث"}</label>
        <input id={queryName} name={queryName} defaultValue={queryValue} className="min-h-11 rounded-md border bg-background px-3" />
        {Object.entries(preserve).map(([key, value]) => value && value !== "1" ? <input key={key} type="hidden" name={key} value={value} /> : null)}
        <button className="client-text-link">{fr ? "Filtrer" : "تصفية"}</button>
      </form>
      {items.length === 0 ? <p>{fr ? "Aucun élément à préparer dans cette liste." : "لا يوجد عنصر لإعداده في هذه القائمة."}</p> : items.map((item) => <PreparationField key={item.key} locale={locale} section={section} item={item} idempotencyKey={randomUUID()} />)}
      {pages > 1 ? <p className="flex gap-3 text-sm"><span>{page} / {pages}</span>{page > 1 ? <Link href={href({ [pageName]: String(page - 1) })}>{fr ? "Page précédente" : "الصفحة السابقة"}</Link> : null}{page < pages ? <Link href={href({ [pageName]: String(page + 1) })}>{fr ? "Page suivante" : "الصفحة التالية"}</Link> : null}</p> : null}
    </div>
  );
}

function DraftSection({ id, locale, title, lead, section, items, secret = false, multiline = false, multilineKeys = [] }: { id: string; locale: "fr" | "ar"; title: string; lead: string; section: PreparationSection; items: PreparationItem[]; secret?: boolean; multiline?: boolean; multilineKeys?: string[] }) {
  return (
    <section id={id} className="mt-8 grid gap-4">
      <h2>{title}</h2>
      <p className="text-sm text-muted-foreground">{lead}</p>
      {items.map((item) => <PreparationField key={item.key} locale={locale} section={section} item={item} idempotencyKey={randomUUID()} secret={secret} multiline={multiline || multilineKeys.includes(item.key)} />)}
    </section>
  );
}
