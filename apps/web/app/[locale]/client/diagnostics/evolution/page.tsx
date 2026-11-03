import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { ArrowRight, Flag } from "lucide-react";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { getEvolutionMessages } from "@/modules/client/screens/diagnostics/evolution/messages";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { summarizeLatestEvolution, formatHundredths } from "@/modules/shared/lib/diagnostics-evolution/model";
import { loadDiagnosticsEvolution } from "@/modules/shared/lib/diagnostics-evolution/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import "@/modules/client/screens/diagnostics/diagnostic-connected.css";

export const dynamic = "force-dynamic";

export default async function DiagnosticsEvolutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/diagnostics/evolution` }));
  const result = await loadDiagnosticsEvolution(space.selectedOrganizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/diagnostics/evolution` }));
  const messages = getEvolutionMessages(locale);
  const c = spaceCopy(locale);
  const t = locale === "fr"
    ? {
        crumb: "Mes diagnostics > Évolution de mes diagnostics",
        title: "Évolution de mes diagnostics",
        lead: "Comparez vos diagnostics dans le temps pour mesurer vos progrès et identifier vos prochains leviers d’action.",
        quote: "Des diagnostics au service d’un Maroc qui entreprend.",
        period: "Période de comparaison",
        summary: "Synthèse des évolutions",
        progress: "bibliothèques progressent",
        stable: "dimension stable",
        watch: "bibliothèques à surveiller",
        overall: "Globalement, une trajectoire positive",
        detail: "Détail par dimension",
        detailLead: "Consultez l’évolution de vos scores et les explications associées.",
        understand: "Comprendre l’évolution",
        next: "Prochaines étapes",
        plan: "Planifier un prochain diagnostic",
        changed: "Ce qui a changé",
      }
    : {
        crumb: "تشخيصاتي > تطور التشخيصات",
        title: "تطور تشخيصاتي",
        lead: "قارنوا تشخيصاتكم عبر الزمن لقياس التقدم وتحديد روافع العمل التالية.",
        quote: "تشخيصات في خدمة مغرب يبادر.",
        period: "فترة المقارنة",
        summary: "ملخص التطورات",
        progress: "أبعاد تتقدم",
        stable: "بعد مستقر",
        watch: "أبعاد للمراقبة",
        overall: "مسار إيجابي إجمالاً",
        detail: "التفصيل حسب البعد",
        detailLead: "اطلعوا على تطور النتائج والتفسيرات المرتبطة.",
        understand: "فهم التطور",
        next: "الخطوات التالية",
        plan: "تخطيط تشخيص قادم",
        changed: "ما الذي تغيّر",
      };

  const points = result.status === "success" ? result.value.series.flatMap((series) => series.points) : [];
  const summary = summarizeLatestEvolution(result.status === "success" ? result.value.series : []);
  const latest = [...points].sort((a,b) => b.completedAt.localeCompare(a.completedAt))[0];
  const previousAt = latest?.comparisonCompletedAt;
  const {improved,declined,stable} = summary;

  return (
    <ClientAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="needs" kicker={c.kicker}>
      <main className="client-page">
        <div className="diag-conn">
          <header className="diag-conn-hero">
            <div>
              <p className="diag-conn-crumb">{t.crumb}</p>
              <h1>{t.title}</h1>
              <p>{t.lead}</p>
            </div>
            <p className="diag-conn-quote">« {t.quote} »</p>
          </header>

          {result.status === "error" ? (
            <p className="diag-conn-card" role="alert">{result.reason === "FORBIDDEN" ? messages.forbidden : messages.unavailable}</p>
          ) : result.value.series.length === 0 ? (
            <p className="diag-conn-card">{messages.empty}</p>
          ) : (
            <>
              <section className="diag-conn-card">
                <div className="diag-conn-item-foot">
                  <strong>{t.period}</strong>
                  <span>
                    {previousAt ? <time dateTime={previousAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" }).format(new Date(previousAt))}</time> : "—"}
                    {" vs "}
                    {latest ? <time dateTime={latest.completedAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" }).format(new Date(latest.completedAt))}</time> : "—"}
                  </span>
                </div>
              </section>

              <section className="diag-conn-evo-summary" aria-label={t.summary}>
                <article data-tone="mint"><small>{t.progress}</small><strong>{improved}</strong><p>{messages.timeline}</p></article>
                <article data-tone="sky"><small>{t.stable}</small><strong>{stable}</strong><p>{messages.first}</p></article>
                <article data-tone="amber"><small>{t.watch}</small><strong>{declined}</strong><p>{messages.critical}</p></article>
                <article data-tone="violet"><small>{(summary.status === "INSUFFICIENT" ? (locale === "fr" ? "Données comparables insuffisantes" : "بيانات مقارنة غير كافية") : summary.status === "DECLINING" ? (locale === "fr" ? "Dégradation à examiner" : "تراجع يحتاج مراجعة") : summary.status === "IMPROVING" ? (locale === "fr" ? "Progression observée" : "تقدم ملحوظ") : (locale === "fr" ? "Trajectoire stable" : "مسار مستقر"))}</small><p>{messages.intro}</p></article>
              </section>

              <div className="diag-conn-split">
                <section className="diag-conn-card">
                  <h2>{t.detail}</h2>
                  <p style={{ marginTop: 6, color: "var(--diag-muted)" }}>{t.detailLead}</p>
                  <div style={{ overflowX: "auto", marginTop: 12 }}>
                    <table className="diag-conn-table">
                      <thead>
                        <tr>
                          <th>{messages.score}</th>
                          <th>{messages.delta}</th>
                          <th>{messages.open}</th>
                          <th>{messages.details}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.value.series.map((series) => series.points.map((point) => (
                          <tr key={point.id}>
                            <td>
                              <strong><bdi dir="ltr">{series.libraryCode}</bdi></strong>
                              <div dir="ltr">{formatHundredths(point.scoreHundredths)}/100 · {messages.ratings[point.rating]}</div>
                            </td>
                            <td dir="ltr">{point.deltaHundredths === null ? (locale === "fr" ? "Aucun point antérieur de même base de calcul" : "لا توجد نقطة سابقة بأساس حساب مماثل") : formatHundredths(point.deltaHundredths)}</td>
                            <td><bdi dir="ltr">{point.openAnomalies}</bdi>{point.criticalAnomalies ? ` · ${point.criticalAnomalies} ${messages.critical}` : ""}</td>
                            <td><Link href={`/${locale}/client/diagnostics/${point.id}${space.selectedQuery}`} style={{ color: "var(--diag-violet)", fontWeight: 720 }}>{t.understand} →</Link></td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <aside className="diag-conn-stack">
                  <section className="diag-conn-card">
                    <h2><Flag size={16} aria-hidden />{t.changed}</h2>
                    <ul className="diag-conn-list" style={{ marginTop: 12 }}>
                      <li><span>✓</span><span>{messages.current}</span></li>
                      <li><span>✓</span><span>{messages.timeline}</span></li>
                      <li><span>✓</span><span>{result.value.truncated ? messages.truncated : messages.intro}</span></li>
                    </ul>
                  </section>
                  <section className="diag-conn-card">
                    <h2>{t.next}</h2>
                    <ol className="diag-conn-plan" style={{ marginTop: 12 }}>
                      <li><span>1</span><div><strong>{locale === "fr" ? "Approfondir les bibliothèques à surveiller" : "تعميق المكتبات للمراقبة"}</strong></div></li>
                      <li><span>2</span><div><strong>{locale === "fr" ? "Mettre en place les actions recommandées" : "تنفيذ الإجراءات الموصى بها"}</strong></div></li>
                      <li><span>3</span><div><strong>{locale === "fr" ? "Planifier un nouveau diagnostic" : "تخطيط تشخيص جديد"}</strong></div></li>
                    </ol>
                    <Link href={`/${locale}/client/questionnaires${space.selectedQuery}`} className="diag-conn-btn-grad" style={{ marginTop: 12, justifyContent: "center" }}>
                      {t.plan}<ArrowRight className="rtl-mirror" size={16} aria-hidden />
                    </Link>
                  </section>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </ClientAppShell>
  );
}
