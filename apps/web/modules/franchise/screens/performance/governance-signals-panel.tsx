import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { GovernanceSignalResult } from "@/modules/franchise/data/governance-signals/repository";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { GovernanceReviewForm } from "./governance-review-form";
export function FranchiseGovernanceSignalsPanel({ locale, result, returnPath }: { locale: Locale; result: GovernanceSignalResult; returnPath: string }) {
  const ar = locale === "ar", absent = ar ? "غير مقاس" : "Non mesuré";
  if (result.status === "error") return <WorkspaceFailure locale={locale} reason={result.reason} returnPath={returnPath} supportReference="FRANCHISE_GOVERNANCE_SIGNALS"/>;
  if (result.status === "NOT_AVAILABLE") return <section className="client-card"><h2>{ar ? "وقائع توزيع النشاط والحكامة" : "Répartition d’activité et faits de gouvernance"}</h2><p role="status">{ar ? "الملاحظات غير متاحة بعد لهذا التكليف. تواصلوا مع المسؤول إذا استمر ذلك." : "Les observations ne sont pas encore disponibles pour ce mandat. Contactez votre responsable si cela persiste."}</p></section>;
  const { snapshot, benchmark } = result, s = snapshot.summary;
  const percent = (value: number | null) => value === null ? absent : new Intl.NumberFormat(ar ? "ar-MA" : "fr-MA", { style: "percent", maximumFractionDigits: 2 }).format(value / 10000);
  const number = (value: number | null) => value === null ? absent : new Intl.NumberFormat(ar ? "ar-MA" : "fr-MA").format(value);
  const rows = [
    [ar ? "المهام غير الملغاة" : "Missions hors annulations", number(s.missionCount)], [ar ? "مقدمو الخدمات المعنيون" : "Prestataires concernés", number(s.assignedProviderCount)],
    [ar ? "أكبر حصة لمقدم خدمات" : "Part du prestataire le plus sollicité", percent(s.largestProviderShareBps)], [ar ? "عمليات المطابقة" : "Exécutions du matching", number(s.matchingRunCount)],
    [ar ? "طلبات مع إعادة تنفيذ المطابقة" : "Demandes avec plusieurs exécutions", number(s.requestsWithSeveralRuns)], [ar ? "اقتراحات يدوية للائحة ضمن الحكامة" : "Propositions gouvernées de panel", number(s.governedPanelProposalCount)],
    [ar ? "دعوات الاستشارة" : "Invitations en consultation", number(s.panelInvitationCount)], [ar ? "تنوع مقدمي الخدمات الحالي" : "Prestataires distincts du panel", number(s.panelDistinctProviders)],
    [ar ? "التنوع في الفترة السابقة" : "Prestataires distincts, période précédente", number(s.previousPanelDistinctProviders)], [ar ? "تغير تنوع اللائحة" : "Évolution du nombre de prestataires", number(s.panelDiversityDelta)],
    [ar ? "أقصر مدة قرار تأهيل بالثواني" : "Délai minimal d’une décision de qualification, secondes", number(s.qualificationShortestSeconds)], [ar ? "أقصر مدة مراجعة المحتوى بالثواني" : "Délai minimal d’une revue de catalogue, secondes", number(s.catalogReviewShortestSeconds)],
  ];
  return <section className="client-card space-y-4" aria-label={ar ? "وقائع الحكامة" : "Faits de gouvernance"}><h2 className="text-2xl font-semibold">{ar ? "وقائع توزيع النشاط والحكامة" : "Répartition d’activité et faits de gouvernance"}</h2>
    <p><span dir="ltr">{snapshot.period_start} — {snapshot.period_end}</span> · <time dateTime={snapshot.collected_at}>{snapshot.collected_at.slice(0, 10)}</time></p>
    <p>{ar ? "تغطي الأرقام المكتبة المسندة ككل، دون إسناد إلى الإقليم أو إلى شخص. إعادة تشغيل المطابقة ليست دليلاً على تدخل يدوي. لا تثبت هذه الوقائع مخالفة أو استحقاقاً مالياً." : "Ces agrégats couvrent la bibliothèque mandatée, sans attribution au territoire ni à une personne. Une relance du matching ne prouve pas une intervention manuelle. Ces faits ne prouvent ni faute ni attribution financière."}</p>
    <p role="note">{ar ? "عتبات تصنيف التركيز وسرعة المراجعة وانخفاض التنوع غير معتمدة بعد. لا يُصدر حكم أو تصنيف خطر آلي؛ يمكن طلب فحص بشري مبرر." : "Les seuils de concentration, de rapidité et de baisse de diversité restent à faire approuver. Aucun verdict ni classement de risque automatique n’est produit ; un examen humain motivé peut être demandé."}</p>
    <dl className="grid gap-3 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded border p-3"><dt>{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
    {benchmark.status === "AVAILABLE" ? <p>{ar ? "وسيط حصة المورد الأكبر في مجموعة مجهولة مقارنة" : "Part médiane du prestataire le plus sollicité, cohorte comparable anonymisée"} : {percent(benchmark.medianLargestShareBps ?? null)} ({benchmark.cohortSize})</p> : benchmark.status === "INSUFFICIENT_COHORT" ? <p>{ar ? "المقارنة محجوبة: يلزم خمسة امتيازات أخرى قابلة للمقارنة على الأقل." : "Comparaison masquée : cinq autres franchises comparables au minimum sont nécessaires."}</p> : null}
    {result.capabilities.canRequestReview ? <GovernanceReviewForm locale={locale} kind="request" objectId={snapshot.id}/> : result.capabilities.requestRestriction === "MFA_REQUIRED" ? <Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/securite/compte`}>{ar ? "تأكيد العامل الثاني لطلب المراجعة" : "Confirmer le second facteur pour demander un examen"}</Link> : null}
    <h3>{ar ? "طلبات الفحص البشري" : "Demandes d’examen humain"} ({result.reviewCount})</h3><ul>{result.reviews.map(review => <li key={review.id}>{review.status === "HUMAN_REVIEW_RECORDED" ? ar ? "مراجعة بشرية مسجلة" : "Examen humain enregistré" : ar ? "مراجعة Matricia مطلوبة" : "Examen Matricia requis"} · {review.createdAt.slice(0, 10)}{result.capabilities.canInspect ? <Link className="inline-flex min-h-11 items-center px-3 underline" href={`/${locale}/administration/gouvernance-franchise/signalements/${review.id}`}>{ar ? "فتح الملف الإداري" : "Ouvrir le dossier administratif"}</Link> : null}</li>)}</ul>
    {result.reviewCount > result.reviews.length ? <p>{ar ? "تُعرض أحدث 25 مراجعة؛ يتوفر باقي السجل لدى الإدارة." : "Les 25 derniers examens sont affichés ; l’administration conserve l’historique complet."}</p> : null}
    <p className="text-sm">{ar ? "المنهجية" : "Méthode"} : NATIVE_GOVERNANCE_SIGNALS_V1 · {ar ? "بصمة المصادر المجمدة" : "Empreinte des sources figées"} <span dir="ltr" className="break-all">{snapshot.source_evidence_hash}</span></p>
  </section>;
}
