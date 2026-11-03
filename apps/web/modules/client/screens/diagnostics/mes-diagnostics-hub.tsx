import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Headset, Lightbulb, ListChecks, Target } from "lucide-react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

type DiagnosticCard = {
  id: string;
  title: string;
  href: string;
  status: "completed" | "in_progress" | "draft";
  meta: string;
  description?: string;
  progressLabel?: string;
  progressPct?: number;
  scores?: Array<{ label: string; value: string; tone: "mint" | "violet" | "coral" }>;
};

type TodoItem = { id: string; title: string; description: string; href: string; tone: "coral" | "violet" | "lavender" };
type ResourceItem = { id: string; title: string; href: string };

const copy = {
  fr: {
    title: "Mes diagnostics",
    lead: "Comprenez vos priorités, puis passez à l’action.",
    quote: "Mieux se connaître pour aller plus loin.",
    completed: "Diagnostic complet versionné",
    inProgress: "Diagnostic en cours",
    draft: "Brouillon enregistré",
    seeAnalysis: "Voir mon analyse",
    resume: "Reprendre le questionnaire",
    history: "Historique de mes diagnostics",
    all: "Tous",
    complete: "Diagnostic complet",
    indicative: "Prédiagnostic importé",
    sort: "Plus récent en premier",
    view: "Voir",
    todo: "À faire maintenant",
    assist: "Demander une assistance",
    assistLead: "Un expert Matricia peut relire votre analyse avec vous.",
    contact: "Nous contacter",
    resources: "Mes ressources utiles",
    overview: "Aperçu de votre situation",
    empty: "Aucun diagnostic complet sur cette page.",
  },
  ar: {
    title: "تشخيصاتي",
    lead: "افهموا أولوياتكم ثم انتقلوا إلى التنفيذ.",
    quote: "معرفة أفضل بالنفس للمضي أبعد.",
    completed: "تشخيص كامل بإصدار",
    inProgress: "تشخيص جارٍ",
    draft: "مسودة محفوظة",
    seeAnalysis: "عرض تحليلي",
    resume: "استئناف الاستبيان",
    history: "سجل تشخيصاتي",
    all: "الكل",
    complete: "تشخيص كامل",
    indicative: "تقييم أولي مستورد",
    sort: "الأحدث أولاً",
    view: "عرض",
    todo: "للقيام الآن",
    assist: "طلب مساعدة",
    assistLead: "يمكن لخبير ماتريسيا مراجعة تحليلكم معكم.",
    contact: "تواصلوا معنا",
    resources: "مواردي المفيدة",
    overview: "نظرة على وضعكم",
    empty: "لا يوجد تشخيص كامل في هذه الصفحة.",
  },
} as const;

export function MesDiagnosticsHub({
  locale,
  cards,
  history,
  todos,
  resources,
  assistanceHref,
  historyFilter = "all",
  filterHrefs,
  indicativeHistory,
  historyFailed = false,
}: {
  locale: Locale;
  cards: DiagnosticCard[];
  history: Array<{ id: string; title: string; meta: string; status: DiagnosticCard["status"]; href: string }>;
  todos: TodoItem[];
  resources: ResourceItem[];
  assistanceHref: string;
  historyFilter?: "all" | "complete" | "indicative";
  filterHrefs?: Record<"all" | "complete" | "indicative", string>;
  indicativeHistory?: ReactNode;
  historyFailed?: boolean;
}) {
  const t = copy[locale];
  return (
    <main className="client-page diag-hub">
      <header className="diag-hub-hero">
        <div>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </div>
        <p className="diag-hub-quote" aria-hidden="true">« {t.quote} »</p>
      </header>

      <div className="diag-hub-layout">
        <div className="diag-hub-main">
          <section className="diag-hub-cards" aria-label={t.title}>
            {cards.map((card) => (
              <article key={card.id} className="diag-hub-card" data-status={card.status}>
                <div className="diag-hub-card-top">
                  <span className="diag-hub-status">
                    {card.status === "completed" ? <CheckCircle2 size={14} aria-hidden /> : <Clock3 size={14} aria-hidden />}
                    {card.status === "completed" ? t.completed : card.status === "in_progress" ? t.inProgress : t.draft}
                  </span>
                  <small>{card.meta}</small>
                </div>
                <h2>{card.title}</h2>
                {card.description ? <p>{card.description}</p> : null}
                {typeof card.progressPct === "number" ? (
                  <div className="diag-hub-progress">
                    <div className="diag-hub-progress-track"><span style={{ width: `${card.progressPct}%` }} /></div>
                    <small>{card.progressLabel}</small>
                  </div>
                ) : null}
                {card.scores?.length ? (
                  <div className="diag-hub-scores">
                    <p>{t.overview}</p>
                    <ul>
                      {card.scores.map((score) => (
                        <li key={score.label} data-tone={score.tone}>
                          <span>{score.label}</span>
                          <strong>{score.value}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <Link href={card.href} className={card.status === "completed" ? "diag-hub-cta" : "diag-hub-cta-outline"}>
                  {card.status === "completed" ? t.seeAnalysis : t.resume}
                  <ArrowRight className="rtl-mirror" size={16} aria-hidden />
                </Link>
              </article>
            ))}
          </section>

          <section className="diag-hub-history" aria-labelledby="diag-history-title">
            <div className="diag-hub-history-head">
              <h2 id="diag-history-title">{t.history}</h2>
              {filterHrefs ? <nav className="diag-hub-filters" aria-label={t.history}>
                {(["all", "complete", "indicative"] as const).map((filter) => <Link key={filter} href={filterHrefs[filter]} aria-current={historyFilter === filter ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-3 focus-visible:outline-2 focus-visible:outline-offset-2 ${historyFilter === filter ? "is-active" : ""}`}>{t[filter]}</Link>)}
              </nav> : null}
              <small>{t.sort}</small>
            </div>
            {historyFilter !== "indicative" ? <><ul>
              {history.map((row) => (
                <li key={row.id}>
                  <span className="diag-hub-status" data-status={row.status}>
                    {row.status === "completed" ? <CheckCircle2 size={14} aria-hidden /> : <Clock3 size={14} aria-hidden />}
                    {row.status === "completed" ? t.completed : row.status === "in_progress" ? t.inProgress : t.draft}
                  </span>
                  <div>
                    <strong>{row.title}</strong>
                    <small>{row.meta}</small>
                  </div>
                  <Link href={row.href}>{row.status === "completed" ? t.view : t.resume}<ArrowRight className="rtl-mirror" size={14} aria-hidden /></Link>
                </li>
              ))}
            </ul>{!history.length && !historyFailed ? <p role="status">{t.empty}</p> : null}</> : null}
            {historyFilter !== "complete" ? indicativeHistory : null}
          </section>
        </div>

        <aside className="diag-hub-side">
          <section className="diag-hub-panel">
            <h2><ListChecks size={16} aria-hidden />{t.todo}</h2>
            <ol>
              {todos.map((item, index) => (
                <li key={item.id} data-tone={item.tone}>
                  <Link href={item.href}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </div>
                    <ArrowRight className="rtl-mirror" size={14} aria-hidden />
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <section className="diag-hub-panel diag-hub-assist">
            <h2><Headset size={16} aria-hidden />{t.assist}</h2>
            <p>{t.assistLead}</p>
            <Link href={assistanceHref} className="diag-hub-cta-outline">{t.contact}</Link>
          </section>

          <section className="diag-hub-panel">
            <h2><Lightbulb size={16} aria-hidden />{t.resources}</h2>
            <ul className="diag-hub-resources">
              {resources.map((item) => (
                <li key={item.id}>
                  <Link href={item.href}>
                    <Target size={15} aria-hidden />
                    <span>{item.title}</span>
                    <ArrowRight className="rtl-mirror" size={14} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
