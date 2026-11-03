import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, Lightbulb, Share2, Sparkles, Target } from "lucide-react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { formatExactScore, type DiagnosticDetail } from "@/modules/shared/lib/diagnostics-opportunities/model";
import { formatDimensionKey, labelSolutionLevel } from "./journey";
import type { Messages } from "./messages";
import {labelDiagnosticPriority,labelDiagnosticSeverity}from"./journey";
import { OpportunityActions } from "./opportunity-actions";
import { DiagnosticSnapshot,OpportunityContext } from "./diagnostic-snapshot";
import "./diagnostic-connected.css";

type Props = {
  detail: DiagnosticDetail;
  locale: Locale;
  m: Messages;
  solutionsHref: string;
  assistanceHref: string;
  evolutionHref: string;
  listHref: string;
  anomalyId?: string;
  decisionKeys: string[];
  scopeName?:string|null;
};

export function AnalyseDetailleeView({ detail, locale, m, solutionsHref, assistanceHref, evolutionHref, listHref, anomalyId, decisionKeys,scopeName }: Props) {
  const pct = Math.max(0, Math.min(100, Number(formatExactScore(detail.score))));
  const findings = detail.anomalies;
  const strengths = findings.filter((item) => item.severity === "INFO" || item.status === "RESOLVED");
  const anomalies = findings.filter((item) => item.severity !== "INFO"&&item.status!=="RESOLVED");
  const opportunities = [...detail.opportunities].sort((a,b)=>(b.priority??-1)-(a.priority??-1)||a.id.localeCompare(b.id));
  const plan = [...detail.recommendations].sort((a,b)=>(b.priority??-1)-(a.priority??-1)||a.id.localeCompare(b.id));
  const focused = anomalyId ? findings.find((item) => item.id === anomalyId) : null;
  const focusedRecs = focused ? detail.recommendations.filter((item) => item.anomalyId === focused.id) : [];
  const focusedOpp = focused ? detail.opportunities.find((item) => item.anomalyId === focused.id) : null;
  const questionnaireHref=`/${locale}/client/questionnaires?${new URLSearchParams({session:detail.sessionId,organizationId:detail.organizationId})}`;
  const findingHref=(id:string)=>`?${new URLSearchParams({organizationId:detail.organizationId,anomalyId:id})}`;
  const reportHref=`/api/client/diagnostics/${detail.id}/report?${new URLSearchParams({locale,organizationId:detail.organizationId})}`;
  const sourceLabel=detail.scoringPolicySnapshot.score_source==="FINAL_PUBLISHED_RULE_EVALUATION"?(locale==="fr"?"Règle publiée":"قاعدة منشورة"):(locale==="fr"?"Méthode conservée":"منهجية محفوظة");
  const publishedText=(item:DiagnosticDetail["anomalies"][number])=>{const metadata=item.explanation.metadata;const text=metadata&&typeof metadata==="object"&&!Array.isArray(metadata)?(metadata as Record<string,unknown>)[locale==="fr"?"client_text_fr":"client_text_ar"]:null;return typeof text==="string"?text:typeof item.explanation.summary==="string"?item.explanation.summary:"";};
  const opportunityTitle=(item:DiagnosticDetail["opportunities"][number])=>{const metadata=item.knownData.published_opportunity;const title=metadata&&typeof metadata==="object"&&!Array.isArray(metadata)?(metadata as Record<string,unknown>)[locale==="fr"?"title_fr":"title_ar"]:null;return typeof title==="string"&&title.trim()?title:(locale==="ar"?item.serviceNameAr:item.serviceNameFr)??`${m.priority} ${labelDiagnosticPriority(locale,item.priority)}`;};
  const t = locale === "fr"
    ? {
        crumb: "Bilan & besoins > Analyse détaillée",
        title: "Analyse détaillée",
        lead: "Votre diagnostic complet pour identifier vos priorités et passer à l’action.",
        quote: "Des diagnostics clairs, des décisions plus sereines.",
        validated: "Calculé à partir des réponses soumises",
        scope: "Périmètre",
        date: "Date d’analyse",
        method: "Méthodologie",
        understand: "Comprendre le calcul",
        mastery: detail.rating === "GOOD" ? "Bonne maîtrise" : detail.rating === "ATTENTION" ? "Maîtrise intermédiaire" : detail.rating === "IMPORTANT" ? "Points importants" : "Situation critique",
        scoreNote: "Ce score est basé sur vos réponses confirmées et sur les règles de la méthode versionnée.",
        dims: "Vos scores par dimension",
        synth: "Synthèse",
        details: "Détails",
        answers: "Réponses",
        methodTab: "Méthodologie",
        history: "Historique",
        download: "Télécharger le rapport",
        share: "Demander une revue du bilan",
        constats: "Informations et constats résolus",
        constatsLead: "Les informations et résolutions effectivement conservées dans ce bilan.",
        anomaliesTitle: "Anomalies à vérifier",
        anomaliesLead: "Des points d’attention qui méritent une analyse approfondie.",
        opps: "Opportunités",
        oppsLead: "Des leviers concrets pour accélérer votre développement.",
        planTitle: "Plan d’action recommandé",
        planLead: "Nos recommandations, priorisées selon votre contexte.",
        act: "Passer à l’action",
        seeExplain: "Voir l’explication",
        proofs: "preuves",
        decision: "Votre décision",
        decisionLead: "Une validation humaine reste nécessaire avant toute suite engageante.",
        decisionWarn: "Prenez le temps de relire les informations ci-contre avant de confirmer ce constat.",
        confirm: "Examiner les actions proposées",
        correct: "Corriger mes réponses",
        review: "Demander une revue humaine",
        reco: "Notre recommandation",
        createOpp: "Examiner les solutions",
        seeSolutions: "Voir les solutions adaptées",
        help: "Besoin d’accompagnement ? Échangez avec un expert Matricia.",
        back: "Retour aux diagnostics",
        confidenceHigh: "Confiance élevée",
        confidenceMid: "Confiance moyenne",
        priorityHigh: "Priorité haute",
        priorityMid: "Priorité moyenne",
        observed: "Ce que l’analyse a observé",
        why: "Pourquoi cela compte",
        how: "Comment le résultat a été calculé",
        missing: "Informations encore nécessaires",
      }
    : {
        crumb: "التشخيص والاحتياجات > تحليل مفصل",
        title: "تحليل مفصل",
        lead: "تشخيصكم الكامل لتحديد الأولويات والانتقال إلى التنفيذ.",
        quote: "تشخيصات واضحة وقرارات أكثر اطمئناناً.",
        validated: "محسوب من الإجابات المرسلة",
        scope: "النطاق",
        date: "تاريخ التحليل",
        method: "المنهجية",
        understand: "فهم الحساب",
        mastery: m.ratings[detail.rating],
        scoreNote: "هذه النتيجة مبنية على إجاباتكم المؤكدة وقواعد المنهج ذي الإصدار.",
        dims: "نتائجكم حسب البعد",
        synth: "ملخص",
        details: "تفاصيل",
        answers: "إجابات",
        methodTab: "المنهجية",
        history: "السجل",
        download: "تحميل التقرير",
        share: "طلب مراجعة التشخيص",
        constats: "معلومات وملاحظات تمت معالجتها",
        constatsLead: "المعلومات والمعالجات المحفوظة فعلياً في هذا التشخيص.",
        anomaliesTitle: "اختلالات للتحقق",
        anomaliesLead: "نقاط انتباه تستحق تحليلاً أعمق.",
        opps: "فرص",
        oppsLead: "روافع ملموسة لتسريع التطور.",
        planTitle: "خطة العمل الموصى بها",
        planLead: "توصياتنا مرتبة حسب سياقكم.",
        act: "الانتقال إلى التنفيذ",
        seeExplain: "عرض التفسير",
        proofs: "أدلة",
        decision: "قراركم",
        decisionLead: "تبقى مصادقة بشرية لازمة قبل أي خطوة ملزمة.",
        decisionWarn: "خذوا وقتاً لمراجعة المعلومات قبل تأكيد هذه الملاحظة.",
        confirm: "مراجعة الإجراءات المقترحة",
        correct: "تصحيح إجاباتي",
        review: "طلب مراجعة بشرية",
        reco: "توصيتنا",
        createOpp: "مراجعة الحلول",
        seeSolutions: "عرض الحلول المناسبة",
        help: "تحتاجون مرافقة؟ تواصلوا مع خبير ماتريسيا.",
        back: "العودة إلى التشخيصات",
        confidenceHigh: "ثقة مرتفعة",
        confidenceMid: "ثقة متوسطة",
        priorityHigh: "أولوية عالية",
        priorityMid: "أولوية متوسطة",
        observed: "ما لاحظه التحليل",
        why: "لماذا يهم ذلك",
        how: "كيف حُسبت النتيجة",
        missing: "معلومات ما زالت لازمة",
      };

  if (focused) {
    return (
      <div className="diag-conn">
        <header className="diag-conn-hero">
          <div>
            <p className="diag-conn-crumb">{t.crumb}</p>
            <h1>{locale === "ar" ? focused.titleAr : focused.titleFr}</h1>
            <p>{t.decisionLead}</p>
          </div>
          <p className="diag-conn-quote">« {t.quote} »</p>
        </header>
        <div className="diag-conn-split">
          <div className="diag-conn-stack">
            <section className="diag-conn-card">
              <div className="diag-conn-item-foot">
                <span className="diag-conn-badge" data-tone={focused.severity === "CRITICAL" || focused.severity === "HIGH" ? "coral" : "amber"}>
                  {labelDiagnosticSeverity(locale,focused.severity)}{focused.blocking ? ` · ${m.blocking}` : ""}
                </span>
                <time dateTime={detail.completedAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium",timeZone:"Africa/Casablanca" }).format(new Date(detail.completedAt))}</time>
              </div>
              <h2 style={{ marginTop: 12 }}>{locale === "ar" ? focused.titleAr : focused.titleFr}</h2>
            </section>
            <section className="diag-conn-card">
              <h2><CheckCircle2 size={18} color="#1e7a5c" aria-hidden />{t.observed}</h2>
              <p style={{ marginTop: 10, color: "var(--diag-muted)" }}>{publishedText(focused)||m.explanation}</p>
            </section>
            <section className="diag-conn-card">
              <h2><Lightbulb size={18} color="#642bef" aria-hidden />{t.why}</h2>
              <p style={{ marginTop: 10, color: "var(--diag-muted)" }}>{String(focused.explanation.impact ?? focused.explanation.why ?? m.whyOpportunity)}</p>
            </section>
            <section className="diag-conn-card">
              <h2><Target size={18} color="#2a3a8c" aria-hidden />{t.how}</h2>
              <p style={{ marginTop: 10, color: "var(--diag-muted)" }}>{m.policyVersion}: {String(detail.scoringPolicySnapshot.version ?? "—")}</p>
              <p style={{ marginTop: 6, color: "var(--diag-muted)" }}>{m.ruleSnapshot}: {String(focused.ruleSnapshot.code ?? focused.code)}</p>
            </section>
            {focusedOpp ? (
              <section className="diag-conn-card">
                <h2>{m.opportunities}</h2>
                <div style={{ marginTop: 12 }}>
                  <OpportunityContext opportunity={focusedOpp} detail={detail} locale={locale} m={m} />
                  <OpportunityActions locale={locale} runId={detail.id} organizationId={detail.organizationId} o={focusedOpp} m={m} keys={decisionKeys} />
                </div>
              </section>
            ) : null}
          </div>
          <aside className="diag-conn-stack">
            <section className="diag-conn-card">
              <h2>{t.decision}</h2>
              <p style={{ marginTop: 8, color: "var(--diag-muted)" }}>{t.decisionLead}</p>
              <div className="diag-conn-callout" data-tone="amber" style={{ marginTop: 12 }}>
                <AlertTriangle size={16} aria-hidden />
                <p>{t.decisionWarn}</p>
              </div>
              <div className="diag-conn-stack" style={{ marginTop: 14 }}>
                <Link href={solutionsHref} className="diag-conn-btn"><CheckCircle2 size={16} aria-hidden />{t.confirm}</Link>
                <Link href={questionnaireHref} className="diag-conn-btn-outline">{t.correct}</Link>
                <Link href={assistanceHref} className="diag-conn-btn-outline">{t.review}</Link>
              </div>
            </section>
            <section className="diag-conn-card">
              <h2>{t.reco}</h2>
              {!focusedRecs.length?<p>{locale==="fr"?"Aucune recommandation reliée à ce constat.":"لا توجد توصية مرتبطة بهذه الملاحظة."}</p>:null}
              <ol className="diag-conn-plan" style={{ marginTop: 12 }}>
                {focusedRecs.map((item, index) => (
                  <li key={item.id}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{locale === "ar" ? item.titleAr : item.titleFr}</strong>
                      <small>{labelSolutionLevel(locale, item.solutionLevel)} · {m.priority} {labelDiagnosticPriority(locale,item.priority)}</small>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="diag-conn-stack" style={{ marginTop: 14 }}>
                <Link href={solutionsHref} className="diag-conn-btn-grad">{t.createOpp}<ArrowRight className="rtl-mirror" size={16} aria-hidden /></Link>
                <Link href={solutionsHref} className="diag-conn-btn-outline">{t.seeSolutions}</Link>
              </div>
            </section>
          </aside>
        </div>
        <p className="diag-conn-footer-help"><span>{t.help}</span><Link href={listHref}>{t.back}</Link></p>
      </div>
    );
  }

  return (
    <div className="diag-conn">
      <header className="diag-conn-hero">
        <div>
          <p className="diag-conn-crumb">{t.crumb}</p>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </div>
        <p className="diag-conn-quote">« {t.quote} »</p>
      </header>

      <section id="diagnostic-summary" className="diag-conn-score" style={{ ["--pct" as string]: pct }}>
        <div className="diag-conn-donut" aria-label={`${m.score} ${formatExactScore(detail.score)}/100`}>
          <span dir="ltr">{formatExactScore(detail.score)} / 100</span>
        </div>
        <div>
          <div className="diag-conn-item-foot">
            <h2>{locale === "fr" ? "Diagnostic organisationnel" : "تشخيص تنظيمي"}</h2>
            <span className="diag-conn-badge" data-tone="mint"><CheckCircle2 size={12} aria-hidden />{t.validated}</span>
          </div>
          <strong style={{ display: "block", marginTop: 8 }}>{t.mastery}</strong>
          <p style={{ marginTop: 6, color: "var(--diag-muted)", fontSize: "0.9rem" }}>{t.scoreNote}</p>
          <div className="diag-conn-meta">
            <div><small>{t.scope}</small><strong>{scopeName??(locale==="fr"?"Nom du questionnaire indisponible":"اسم الاستبيان غير متاح")}</strong></div>
            <div><small>{t.date}</small><strong><time dateTime={detail.completedAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium",timeZone:"Africa/Casablanca" }).format(new Date(detail.completedAt))}</time></strong></div>
            <div><small>{t.method}</small><strong>{String(detail.scoringPolicySnapshot.version ?? "—")} · <a href="#diagnostic-snapshot" style={{ color: "var(--diag-violet)" }}>{t.understand}</a></strong></div>
          </div>
        </div>
        <div className="diag-conn-dims" aria-label={t.dims}>
          {detail.subscores.map((item) => {
            const value = Math.max(0, Math.min(100, Number(formatExactScore(item.score))));
            return (
              <div key={item.key} className="diag-conn-dim">
                <div className="diag-conn-item-foot"><span>{item.key==="OVERALL"?(locale==="fr"?"Score global":"النتيجة الإجمالية"):formatDimensionKey(item.key)}</span><strong dir="ltr">{formatExactScore(item.score)}</strong></div>
                <span><i style={{ width: `${value}%` }} /></span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="diag-conn-tabs">
        <nav aria-label={t.synth}>
          <a className="is-active" aria-current="page" href="#diagnostic-summary">{t.synth}</a>
          <a href="#diagnostic-findings">{t.details}</a>
          <Link href={questionnaireHref}>{t.answers}</Link>
          <a href="#diagnostic-snapshot">{t.methodTab}</a>
          <Link href={evolutionHref}>{t.history}</Link>
        </nav>
        <div className="diag-conn-actions">
          <a href={reportHref} className="diag-conn-btn-outline"><Download size={15} aria-hidden />{t.download}</a>
          <Link href={assistanceHref} className="diag-conn-btn"><Share2 size={15} aria-hidden />{t.share}</Link>
        </div>
      </div>

      <div id="diagnostic-findings" className="diag-conn-grid4">
        <section className="diag-conn-col">
          <header className="diag-conn-col-head" data-tone="mint">
            <h2><Sparkles size={16} aria-hidden />{t.constats}<span className="diag-conn-count">{strengths.length}</span></h2>
            <p>{t.constatsLead}</p>
          </header>
          {strengths.map((item) => (
            <article key={item.id} className="diag-conn-item">
              <h3>{locale === "ar" ? item.titleAr : item.titleFr}</h3>
              <span className="diag-conn-badge" data-tone="mint">{labelDiagnosticSeverity(locale,item.severity)}</span>
              <p>{publishedText(item)}</p>
              <div className="diag-conn-item-foot">
                <small>{sourceLabel}</small>
                <Link href={findingHref(item.id)}>{t.seeExplain} →</Link>
              </div>
            </article>
          ))}
          {!strengths.length ? <article className="diag-conn-item"><p>{locale==="fr"?"Aucune information ou résolution distincte n’est enregistrée dans ce bilan.":"لا توجد معلومة أو معالجة مستقلة مسجلة في هذا التشخيص."}</p></article> : null}
        </section>

        <section className="diag-conn-col">
          <header className="diag-conn-col-head" data-tone="coral">
            <h2><AlertTriangle size={16} aria-hidden />{t.anomaliesTitle}<span className="diag-conn-count">{anomalies.length}</span></h2>
            <p>{t.anomaliesLead}</p>
          </header>
          {!anomalies.length?<p>{locale==="fr"?"Aucun autre point d’attention enregistré.":"لا توجد نقطة انتباه إضافية مسجلة."}</p>:null}
          {anomalies.map((item) => (
            <article key={item.id} className="diag-conn-item">
              <h3>{locale === "ar" ? item.titleAr : item.titleFr}</h3>
              <span className="diag-conn-badge" data-tone={item.severity === "CRITICAL" || item.severity === "HIGH" ? "coral" : "amber"}>
                {labelDiagnosticSeverity(locale,item.severity)}
              </span>
              <p><strong>{locale === "fr" ? "Pourquoi : " : "لماذا: "}</strong>{publishedText(item)}</p>
              <div className="diag-conn-item-foot">
                <small>{sourceLabel}</small>
                <Link href={findingHref(item.id)}>{t.seeExplain} →</Link>
              </div>
            </article>
          ))}
        </section>

        <section className="diag-conn-col">
          <header className="diag-conn-col-head" data-tone="amber">
            <h2><Lightbulb size={16} aria-hidden />{t.opps}<span className="diag-conn-count">{opportunities.length}</span></h2>
            <p>{t.oppsLead}</p>
          </header>
          {!opportunities.length?<p>{locale==="fr"?"Aucune opportunité enregistrée.":"لا توجد فرصة مسجلة."}</p>:null}
          {opportunities.map((item) => (
            <article key={item.id} className="diag-conn-item">
              <h3>{opportunityTitle(item)}</h3>
              <span className="diag-conn-badge" data-tone="mint">{m.statuses[item.status]}</span>
              <p>{m.whyOpportunity}</p>
              <OpportunityContext opportunity={item} detail={detail} locale={locale} m={m}/><OpportunityActions locale={locale} runId={detail.id} organizationId={detail.organizationId} o={item} m={m} keys={decisionKeys}/>
              <div className="diag-conn-item-foot">
                <small>{labelSolutionLevel(locale, item.solutionLevel)}</small>
                <Link href={solutionsHref}>{t.seeExplain} →</Link>
              </div>
            </article>
          ))}
        </section>

        <section className="diag-conn-col">
          <header className="diag-conn-col-head" data-tone="violet">
            <h2><Target size={16} aria-hidden />{t.planTitle}</h2>
            <p>{t.planLead}</p>
          </header>
          {!plan.length?<p>{locale==="fr"?"Aucune recommandation enregistrée.":"لا توجد توصية مسجلة."}</p>:null}
          <ol className="diag-conn-plan">
            {plan.map((item, index) => (
              <li key={item.id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{locale === "ar" ? item.titleAr : item.titleFr}</strong>
                  <small>{m.priority}: {labelDiagnosticPriority(locale,item.priority)} · {labelSolutionLevel(locale, item.solutionLevel)}</small>
                </div>
                <span className="diag-conn-badge" data-tone="violet">{labelDiagnosticPriority(locale,item.priority)}</span>
              </li>
            ))}
          </ol>
          <Link href={solutionsHref} className="diag-conn-btn" style={{ justifyContent: "center" }}>{t.act}<ArrowRight className="rtl-mirror" size={16} aria-hidden /></Link>
        </section>
      </div>

      <DiagnosticSnapshot detail={detail} locale={locale} m={m}/>
      <p className="diag-conn-footer-help">
        <span>{t.help}</span>
        <Link href={listHref}>{t.back}</Link>
      </p>
    </div>
  );
}
