import {randomUUID} from "node:crypto";
import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {isLocale} from "@/modules/shared/lib/i18n/locale";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {AdminModulePage} from "@/modules/admin/ui/admin-module-page";
import {editorialDetailSchema, editorialKinds, editorialQueueSchema} from "@/modules/admin/screens/catalogue-reviews/model";
import {EditorialReviewDetail} from "@/modules/admin/screens/catalogue-reviews/detail";
export default async function EditorialReviewsPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{page?: string; kind?: string; reviewId?: string}>}) {
  const [{locale}, query] = await Promise.all([params, searchParams]); if (!isLocale(locale)) notFound();
  const ar = locale === "ar", client = await getSupabaseServerClient(), t = (fr: string, arabic: string) => ar ? arabic : fr;
  const pageNumber = Number(query.page ?? "1"), page = Number.isSafeInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const kind = z.enum(["ALL", ...editorialKinds]).catch("ALL").parse(query.kind);
  const selected = z.string().uuid().safeParse(query.reviewId);
  const [queueResult, detailResult] = await Promise.all([client.rpc("catalog_editorial_review_queue", {p_page: page, p_kind: kind}), selected.success ? client.rpc("catalog_editorial_review_detail", {p_change_request_id: selected.data}) : Promise.resolve(null)]);
  const queue = editorialQueueSchema.safeParse(queueResult.data), detail = editorialDetailSchema.safeParse(detailResult?.data);
  const href = (targetPage: number, id?: string) => `/${locale}/administration/catalogue/revues?kind=${kind}&page=${targetPage}${id ? `&reviewId=${id}` : ""}`;
  return <AdminModulePage locale={locale} active="catalog" path="catalogue/revues" querySuffix={`kind=${kind}&page=${page}${selected.success ? `&reviewId=${selected.data}` : ""}`} title={t("Revue éditoriale centrale du catalogue", "المراجعة التحريرية المركزية للفهرس")} lead={t("Examiner le contenu et les dépendances, approuver ou refuser, puis programmer séparément une publication approuvée.", "مراجعة المحتوى والاعتماديات والاعتماد أو الرفض ثم برمجة نشر النسخة المعتمدة بشكل منفصل.")}>
    <div className="client-stack"><Link href={`/${locale}/administration/catalogue/questionnaires/revues`}>{t("Revue des questionnaires et de leurs questions", "مراجعة الاستبيانات وأسئلتها")}</Link><form method="get"><label>{t("Nature de contenu", "نوع المحتوى")}<select name="kind" defaultValue={kind}>{["ALL", ...editorialKinds].map((value) => <option key={value}>{value}</option>)}</select></label><button>{t("Filtrer", "تصفية")}</button></form>
    {queueResult.error || !queue.success ? <p role="alert">{t("File indisponible ou accès refusé. Vérifiez la MFA et les droits de revue.", "قائمة المراجعة غير متاحة أو الوصول مرفوض. تحققوا من المصادقة والصلاحيات.")}</p> : <><p>{queue.data.total} {t("demandes en revue", "طلبات قيد المراجعة")}</p><ul>{queue.data.items.map((item) => <li key={item.id}><Link href={href(page, item.id)}>{item.targetType} · {ar ? item.titleAr : item.titleFr} · {item.code}</Link></li>)}</ul><nav className="flex gap-4">{page > 1 ? <Link href={href(page - 1)}>{t("Précédent", "السابق")}</Link> : null}<span>{page}</span>{page * 25 < queue.data.total ? <Link href={href(page + 1)}>{t("Suivant", "التالي")}</Link> : null}</nav></>}
    {selected.success ? detailResult?.error || !detail.success ? <p role="alert">{t("Détail indisponible ou hors périmètre.", "التفاصيل غير متاحة أو خارج النطاق.")}</p> : <EditorialReviewDetail key={detail.data.request.id} locale={locale} detail={detail.data} idempotencyKey={randomUUID()} scheduleKey={randomUUID()}/> : null}</div>
  </AdminModulePage>;
}
