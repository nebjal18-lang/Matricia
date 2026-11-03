import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { AdminSpaceId } from "@/modules/admin/data/spaces/admin-nav";
import type { SpaceSnapshot } from "@/modules/admin/data/spaces/space-data";

export const governedPreparationSpaces: ReadonlySet<AdminSpaceId> = new Set(["devis", "contrats", "missions", "jalons", "territoires"]);
export function CreationPreparation({ locale, query, space, snapshot }: { locale: Locale; query: string; space: AdminSpaceId; snapshot: SpaceSnapshot }) {
  const ar = locale === "ar";
  const data = snapshot.supervision;
  const candidates: Array<{id:string;label:string;status:string;href:string;next?:string}> = [];
  let instructions = "";
  if (space === "devis") {
    instructions = ar ? "يُعدّ مقدم الخدمة المخوّل العرض من استشارة RFQ فعلية، مع البنود والسعر والضرائب والصلاحية. افتح الطلب لمراجعة الاستشارة؛ الإدارة لا تكتب عرضاً باسم مقدم الخدمة." : "Le prestataire habilité rédige le devis depuis une consultation RFQ réelle : lignes, prix, fiscalité et validité. Ouvrez la demande pour examiner sa consultation ; l’administration ne rédige pas à sa place.";
    for (const item of data?.requests ?? []) if (item.rfq_count > 0) candidates.push({id:item.id,label:item.organization_name,status:item.status,href:`/${locale}/administration/demandes/${item.id}${query}`});
  } else if (space === "contrats") {
    instructions = ar ? "يولّد العميل المخوّل مسودة العقد من العرض المختار، وفق الهويات المراجعة والقالب والعمولة المعتمدين. تبقى المصادقة والتوقيعات منفصلة عن التحضير الإداري." : "Le Client habilité génère le brouillon depuis le devis retenu, les identités vérifiées, le modèle et la commission approuvés. La validation et les signatures restent distinctes de cette préparation administrative.";
    for (const item of data?.quotes ?? []) if (item.status === "SELECTED") candidates.push({id:item.id,label:`${item.client_name} · ${item.provider_name}`,status:item.status,href:`/${locale}/administration/devis/${item.id}${query}`});
  } else if (space === "missions") {
    instructions = ar ? "ينشئ العميل المخوّل المهمة من عقد نشط موقّع، ويحدد موضوعها ومراحلها وآجالها. لا يُنشئ سبب المراجعة الإدارية مهمةً." : "Le Client habilité crée la mission depuis un contrat signé et actif, en précisant son objet, ses jalons et ses échéances. Un motif de revue administrative ne crée pas de mission.";
    for (const item of data?.contracts ?? []) if (item.status === "ACTIVE" && !item.mission_id) candidates.push({id:item.id,label:`${item.client_name} · ${item.provider_name}`,status:item.status,href:`/${locale}/administration/contrats/${item.id}${query}`,next:`/${locale}/client/contrats?organizationId=${encodeURIComponent(item.client_organization_id)}`});
  } else if (space === "jalons") {
    instructions = ar ? "تُحدد المراحل ضمن إنشاء المهمة من العقد. راجع المهمة وعقدها؛ إضافة مرحلة لا تتم بمجرد موافقة إدارية أو مرجع حر. يراجع العميل المخوّل التسليمات في مسار المهمة." : "Les jalons sont définis lors de la création de la mission depuis le contrat. Examinez la mission et son contrat ; une approbation administrative ou une référence libre n’ajoute pas de jalon. Le Client habilité examine les livraisons dans le parcours de la mission.";
    for (const item of data?.missions ?? []) candidates.push({id:item.id,label:`${item.client_name} · ${item.provider_name}`,status:item.status,href:`/${locale}/administration/missions/${item.id}${query}`,next:`/${locale}/client/missions/${item.id}/jalons?organizationId=${encodeURIComponent(item.client_organization_id)}`});
  } else if (space === "territoires") {
    instructions = ar ? "يحدد التفويض المؤسسة والمكتبة والإقليم والمدة والحقوق التعاقدية. راجع الملف في الحوكمة؛ هذه الصفحة لا تنشئ تفويضاً من نص حر. يتطلب الاقتراح والمراجعة المستقلة والتفعيل أدلتها الخاصة." : "Un mandat lie une organisation, une bibliothèque, un territoire, une durée et des droits contractuels. Examinez le dossier dans la gouvernance ; cette page ne crée pas de mandat à partir d’un texte libre. Proposition, revue indépendante et activation nécessitent leurs propres preuves.";
    for (const item of snapshot.rows) candidates.push({id:item.id,label:item.title,status:item.status,href:item.href});
  }
  return <main className="client-page" data-admin-layout="governed-preparation">
    <section className="client-card">
      <h2>{ar ? "تحضير ومراجعة الملف المصدر" : "Préparation et revue du dossier source"}</h2>
      <p>{instructions}</p>
      <p>{ar ? "لم يُنشأ أي عنصر هنا. يتطلب المسار المهني صلاحياته والتحقق متعدد العوامل؛ صلاحية الإدارة وحدها لا تمنح صفة العميل أو مقدم الخدمة." : "Aucun objet n’est créé ici. Le parcours métier conserve ses habilitations et la MFA ; le rôle Admin seul ne confère pas la qualité de Client ou de Prestataire."}</p>
      {space === "territoires" ? <Link href={`/${locale}/administration/gouvernance${query}`}>{ar ? "فتح حوكمة التفويضات" : "Ouvrir la gouvernance des mandats"}</Link> : null}
      <h3>{ar ? "الملفات المصدر المتاحة للمراجعة" : "Dossiers sources disponibles pour la revue"}</h3>
      {candidates.length ? <ul>{candidates.map(item=><li key={item.id}><Link href={item.href}>{item.label}</Link> · <span dir="ltr">{item.id}</span> · {item.status}{item.next ? <> · <Link href={item.next}>{ar ? "المسار المهني — للعميل المخوّل فقط" : "Parcours métier — Client habilité uniquement"}</Link></> : null}</li>)}</ul> : <p role="status">{ar ? "لا يوجد ملف مصدر يستوفي هذه الشروط في البيانات المحمّلة. راجع المرحلة السابقة من المسار." : "Aucun dossier source ne remplit ces prérequis dans les données chargées. Vérifiez l’étape précédente du parcours."}</p>}
      <Link href={`/${locale}/administration/${space}${query}`}>{ar ? "العودة إلى قائمة الملفات" : "Retourner à la file des dossiers"}</Link>
    </section>
  </main>;
}

export function DocumentSharePreparation({ locale, query, snapshot }: { locale: Locale; query: string; snapshot: SpaceSnapshot }) {
  const ar=locale==="ar";
  return <main className="client-page"><section className="client-card">
    <h2>{ar ? "اختيار وثيقة موجودة للمشاركة الخاضعة للرقابة" : "Choisir un document existant pour un partage contrôlé"}</h2>
    <p>{ar ? "تُعدّ هذه الصفحة مشاركة وثيقة موجودة، ولا ترفع ملفاً جديداً. يستورد المالك ملفاته من خزينته. تُراجع الوجهة والنطاق والفحص قبل طلب موافقته." : "Cette page prépare le partage d’un document existant ; elle n’importe aucun fichier. Le propriétaire importe ses pièces depuis son coffre. La destination, le périmètre et l’analyse du fichier sont vérifiés avant de demander son consentement."}</p>
    {snapshot.rows.length ? <ul>{snapshot.rows.map(row=><li key={row.id}><Link href={`/${locale}/administration/documents/${row.id}/reutilisation${query}`}>{row.title}</Link> · {row.status}</li>)}</ul> : <p role="status">{ar ? "لا توجد وثيقة متاحة في النطاق الحالي. يلزم أولاً استيراد وثيقة من خزينة مالكها." : "Aucun document disponible dans ce périmètre. Une pièce doit d’abord être importée dans le coffre de son propriétaire."}</p>}
    <Link href={`/${locale}/administration/documents${query}`}>{ar ? "العودة إلى الوثائق" : "Retourner aux documents"}</Link>
  </section></main>;
}
