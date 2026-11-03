import Link from "next/link";
import{z}from"zod";
import {loadProviderPlanning}from"@/modules/provider/data/planning/repository";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import {
  addCalendarDays,
  mondayOnOrBefore,
  weekDays,
  ymdInZone,
} from "@/modules/provider/data/planning/events";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { PlanningWeekBoard } from "@/modules/provider/screens/planning/planning-board";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";

function requestedMonday(week: string | undefined, today: string): string {
  if (week && z.string().date().safeParse(week).success) return mondayOnOrBefore(week);
  return mondayOnOrBefore(today);
}

export default async function ProviderPlanningPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; week?: string;page?:string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/planning` }));
  const today = ymdInZone(new Date().toISOString());
  const monday = requestedMonday(query.week, today);
  const days = weekDays(monday);
  const rawPage=Number(query.page??"1"),page=Number.isSafeInteger(rawPage)&&rawPage>0&&rawPage<=100000?rawPage:1;
  const planning=await loadProviderPlanning(locale,space.selectedOrganizationId,monday,page),events=planning.status==="success"?planning.events:[];
  const org = space.selectedQuery;
  const weekQuery = (week: string,listPage=1) => {
    const params = new URLSearchParams(org.startsWith("?") ? org.slice(1) : org);
    params.set("week", week);
    if(listPage>1)params.set("page",String(listPage));
    const encoded = params.toString();
    return encoded ? `?${encoded}` : `?week=${week}`;
  };
  const copy =
    locale === "ar"
      ? { title: "التخطيط", eyebrow: "المواعيد الحقيقية", lead: "الاستشارات والعروض والمعالم والفواتير وتجديد الوثائق والعقود — كل حدث يفتح ملفه.", unavailable: "تعذر تحميل المواعيد. أعد المحاولة." }
      : { title: "Planning", eyebrow: "Échéances réelles", lead: "Consultations, devis, jalons, factures et renouvellements documentaires ou contractuels — chaque événement ouvre son dossier.", unavailable: "Impossible de charger les échéances. Réessayez." };
  const partialFail = planning.status === "error";

  return (
    <ProviderAppShell
      locale={locale}
      organizations={space.organizations} selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="planning"
      title={copy.title}
      lead={copy.lead}
      kicker={partialFail ? copy.unavailable : copy.eyebrow}
    >
      {partialFail?<p role="alert">{copy.unavailable}</p>:null}
      {planning.status==="success"&&!planning.billingVisible?<p>{locale==="ar"?"المواعيد المالية متاحة لأدوار المالك والمحاسبة فقط.":"Les échéances financières nécessitent un rôle propriétaire ou comptable."}</p>:null}
      {planning.status === "success" && planning.operationalScopeIncomplete ? <p role="status" className="client-card">{locale === "ar" ? "التخطيط جزئي: توجد مهام مقروءة ينتظر نطاقها التشغيلي التوفيق مع الملحق الموقّع. تظل المواعيد المعروفة معروضة، ولا يمكن تأكيد خلو الأسبوع من المواعيد." : "Planning partiel : le périmètre opérationnel de certaines missions accessibles doit être réconcilié avec l’avenant signé. Les échéances connues restent affichées ; l’absence d’autres échéances ne peut pas être confirmée."} <Link href={`/${locale}/sous-traitant/missions${org}`}>{locale === "ar" ? "مراجعة المهام" : "Consulter les missions"}</Link></p> : null}
      {planning.status === "success" ? <PlanningWeekBoard
        locale={locale}
        events={events}
        incomplete={planning.operationalScopeIncomplete}
        days={days}
        today={today}
        prevHref={`/${locale}/sous-traitant/planning${weekQuery(addCalendarDays(monday, -7))}`}
        nextHref={`/${locale}/sous-traitant/planning${weekQuery(addCalendarDays(monday, 7))}`}
        todayHref={`/${locale}/sous-traitant/planning${weekQuery(mondayOnOrBefore(today))}`}
      /> : <Link href={`/${locale}/sous-traitant/planning${weekQuery(monday, page)}`} className="client-ghost-link">{locale === "ar" ? "إعادة المحاولة" : "Réessayer"}</Link>}
      {planning.status==="success"&&(planning.hasMore||planning.page>1)?<nav aria-label={locale==="ar"?"صفحات مواعيد الأسبوع":"Pages des échéances de la semaine"} className="client-card flex flex-wrap gap-4"><p>{locale==="ar"?"توجد صفحات متعددة لمواعيد هذا الأسبوع":"Les échéances de cette semaine sont réparties sur plusieurs pages"} · {planning.page}</p>{planning.page>1?<Link href={`/${locale}/sous-traitant/planning${weekQuery(monday,planning.page-1)}`}>{locale==="ar"?"الصفحة السابقة":"Page précédente"}</Link>:null}{planning.hasMore?<Link href={`/${locale}/sous-traitant/planning${weekQuery(monday,planning.page+1)}`}>{locale==="ar"?"المواعيد التالية":"Échéances suivantes"}</Link>:null}</nav>:null}
    </ProviderAppShell>
  );
}
