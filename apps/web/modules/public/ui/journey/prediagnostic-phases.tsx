"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Download,
  ExternalLink,
  Flag,
  Info,
  Lightbulb,
  ListChecks,
  Loader2,
  Lock,
  Monitor,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { getPublicJourneyCopy } from "@/modules/public/data/journey/copy";
import { diagnosticOptionIds as optionIds } from "@/modules/public/data/journey/diagnostic-contract";
import { computePriorities, diagnosticPriorityTriggers, type PriorityKey } from "@/modules/public/data/journey/diagnostic-priorities";
export { computePriorities } from "@/modules/public/data/journey/diagnostic-priorities";
import { diagnosticQuestionIds as questionIds, type DiagnosticAnswer as Answer, type DiagnosticQuestionId as QuestionId, type StoredDiagnostic as Stored } from "./diagnostic-storage";
import styles from "./diagnostic-premium.module.css";

type SaveState = { status: "idle" } | { status: "success"; intakeId: string } | { status: "error"; reason: "VALIDATION" | "FORBIDDEN" | "UNAVAILABLE" };
type OrganizationOption = { id: string; name: string };
type Kind = "opportunity" | "declared" | "risk" | "verify";

const kinds: Record<PriorityKey, Kind> = { organization: "opportunity", sales: "declared", security: "risk", verify: "verify" };

function answerLabel(locale: Locale, id: QuestionId, answer: Answer | undefined): string {
  const copy = getPublicJourneyCopy(locale).diagnostic;
  const index = questionIds.indexOf(id);
  if (answer === undefined) return "—";
  if (id === "next_action") return typeof answer === "string" ? answer : "—";
  const labels = copy.questions[index]?.[2] ?? [];
  const ids = optionIds[id];
  if (Array.isArray(answer)) return answer.map((value) => labels[ids.indexOf(value)] ?? copy.answerUnavailable).join(locale === "ar" ? "، " : ", ") || "—";
  const choice = ids.indexOf(id === "sector" && answer === "health_social" ? "other" : answer);
  return labels[choice] ?? copy.answerUnavailable;
}

function observationLabel(locale: Locale, priority: PriorityKey, answers: Stored["answers"]): string {
  const copy = getPublicJourneyCopy(locale).diagnostic;
  if (priority === "verify") return copy.priorities.verify[1];
  const questions = { organization: "priority_tracking", sales: "sales_tracking", security: "backup_restore" } as const;
  const id = questions[priority];
  const value = answers[id] === undefined ? copy.answerNotProvided : answerLabel(locale, id, answers[id]);
  return `${copy.questionLabels[id]} : ${value}`;
}

function PageChrome({ locale, children, footer = true }: { locale: Locale; children: ReactNode; footer?: boolean }) {
  const copy = getPublicJourneyCopy(locale).diagnostic;
  return (
    <main id="contenu-principal" className={`${styles.page} diagnostic-premium-page`} dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className={styles.shell}>{children}</div>
      {footer ? (
        <footer className={styles.pageFooter}>
          <p className={styles.pageFooterBrand}>{copy.footerBrand}</p>
          <p className={styles.pageFooterTag}>{copy.footerTag}</p>
        </footer>
      ) : null}
    </main>
  );
}

function Hero({ eyebrow, title, intro, script }: { eyebrow: string; title: string; intro: string; script: string }) {
  return (
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><span className={styles.eyebrowMark} aria-hidden="true" />{eyebrow}</p>
        <h1 className={styles.heroTitle}>{title}</h1>
        <p className={styles.heroIntro}>{intro}</p>
      </div>
      <p className={styles.script} aria-hidden="true">{script}</p>
    </header>
  );
}

function TrustAside({ locale, completedThrough, current }: { locale: Locale; completedThrough: number; current: number }) {
  const copy = getPublicJourneyCopy(locale).diagnostic;
  const trustIcons = [Lock, Monitor, ShieldCheck] as const;
  return (
    <aside className={styles.side}>
      <div className={styles.rail}>
        <p className={styles.railTitle}>{copy.railTitle}</p>
        <ol className={styles.steps}>
          {copy.steps.map((label, index) => {
            const done = index < completedThrough;
            const active = index === current;
            return (
              <li key={label} className={active ? `${styles.step} ${styles.stepCurrent}` : done ? `${styles.step} ${styles.stepDone}` : styles.step}>
                <span className={styles.stepNum}>{done && !active ? <CheckCircle2 size={14} aria-hidden="true" /> : index + 1}</span>
                <strong>
                  {label}
                  {active ? <em className={styles.stepStatus}>{copy.currentStepLong}</em> : null}
                </strong>
              </li>
            );
          })}
        </ol>
      </div>
      <div className={styles.trust}>
        <span className={styles.trustRays} aria-hidden="true" />
        <p className={styles.trustTitle}>{copy.aboutTitle}</p>
        <ul className={styles.trustList}>
          {copy.aboutItems.map((item, index) => {
            const Icon = trustIcons[index] ?? ShieldCheck;
            return (
              <li key={item} className={styles.trustItem}>
                <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
                <span>{item}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

export function RecapView({
  locale,
  answers,
  onEdit,
  onBack,
  onAnalyze,
}: {
  locale: Locale;
  answers: Stored["answers"];
  onEdit: (step: number) => void;
  onBack: () => void;
  onAnalyze: () => void;
}) {
  const copy = getPublicJourneyCopy(locale).diagnostic;
  const recapIcons = [ClipboardList, Users, Target, Sparkles, Users, ListChecks, AlertTriangle, Pencil] as const;
  return (
    <PageChrome locale={locale}>
      <Hero eyebrow={copy.eyebrow} title={copy.recapTitle} intro={copy.recapIntro} script={copy.scriptNote} />
      <div className={styles.board}>
        <section className={styles.card}>
          <div className={styles.recapList}>
            {questionIds.map((id, index) => {
              const Icon = recapIcons[index] ?? ClipboardList;
              return (
                <div key={id} className={styles.recapRow} data-question={id}>
                  <span className={styles.recapIcon} aria-hidden="true"><Icon size={18} /></span>
                  <span className={styles.recapLabel}>{copy.questionLabels[id]}</span>
                  <span className={styles.recapValue}>{answerLabel(locale, id, answers[id])}</span>
                  <button type="button" className={styles.recapEdit} aria-label={`${copy.editAnswer} : ${copy.questionLabels[id]}`} onClick={() => onEdit(index)}>
                    <Pencil size={14} aria-hidden="true" />{copy.editAnswer}
                  </button>
                </div>
              );
            })}
          </div>
          <div className={styles.recapHint}>
            <Info size={18} aria-hidden="true" />
            <p>{copy.recapHint}</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.back} onClick={onBack}>
              <ArrowLeft className="rtl-mirror" aria-hidden="true" size={16} />{copy.back}
            </button>
            <button type="button" className={styles.continue} onClick={onAnalyze}>
              {copy.analyze}<ArrowRight className="rtl-mirror" aria-hidden="true" size={18} />
            </button>
          </div>
        </section>
        <TrustAside locale={locale} completedThrough={7} current={7} />
      </div>
    </PageChrome>
  );
}

export function AnalyzingView({
  locale,
  answers,
  onDone,
  onRetry,
  onBack,
}: {
  locale: Locale;
  answers: Stored["answers"];
  onDone: () => void;
  onRetry: () => void;
  onBack: () => void;
}) {
  const copy = getPublicJourneyCopy(locale).diagnostic;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timers = [
      window.setTimeout(() => setTick(1), 700),
      window.setTimeout(() => setTick(2), 1500),
      window.setTimeout(() => onDone(), 2400),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [onDone]);
  const summaryIds = ["sector", "team_size", "goals", "next_action"] as const;
  return (
    <PageChrome locale={locale}>
      <Hero eyebrow={copy.eyebrow} title={copy.analyzingTitle} intro={copy.analyzingIntro} script={copy.scriptNote} />
      <div className={styles.analyzeTrack} aria-hidden="true">
        {copy.analyzingSteps.map(([title, text], index) => (
          <div key={title} className={styles.analyzeStep}>
            <span className={index < tick ? styles.analyzeIconActive : index === tick ? `${styles.analyzeIcon} ${styles.analyzeIconCurrent}` : styles.analyzeIcon}>
              {index === 0 ? <ListChecks size={22} /> : index === 1 ? <Loader2 size={22} /> : <ClipboardList size={22} />}
            </span>
            <strong>{index + 1}. {title}</strong>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <div className={styles.analyzeBanner}>
        <ShieldCheck size={28} aria-hidden="true" />
        <div>
          <strong>{copy.analyzingBanner}</strong>
          <p>{copy.analyzingBannerText}</p>
        </div>
        <p><Sparkles size={16} aria-hidden="true" /> {copy.analyzingConfidential}</p>
      </div>
      <div className={styles.analyzeSplit}>
        <section className={styles.card}>
          <p className={styles.cardEyebrow}>{copy.recapTitle}</p>
          <div className={styles.recapList}>
            {summaryIds.map((id) => (
              <div key={id} className={styles.recapRow}>
                <span className={styles.recapIcon} aria-hidden="true"><ClipboardList size={18} /></span>
                <span className={styles.recapLabel}>{copy.questionLabels[id]}</span>
                <span className={styles.recapValue}>{answerLabel(locale, id, answers[id])}</span>
                <span />
              </div>
            ))}
          </div>
          <button type="button" className={styles.recapEdit} onClick={onBack} style={{ marginTop: 12 }}>
            <Pencil size={14} aria-hidden="true" />{copy.restart}
          </button>
        </section>
        <div>
          <div className={styles.statusCard} role="status" aria-live="polite">
            <span className={styles.statusSpin} aria-hidden="true"><Loader2 size={22} /></span>
            <div>
              <strong>{copy.analyzingStatus}</strong>
              <p className={styles.heroIntro} style={{ marginTop: 4 }}>{copy.analyzingStatusText}</p>
            </div>
            <MoreDots />
          </div>
          <div className={styles.troubleCard}>
            <strong><AlertTriangle size={16} aria-hidden="true" />{copy.analyzingTrouble}</strong>
            <p>{copy.analyzingTroubleText}</p>
            <div className={styles.troubleActions}>
              <button type="button" className={styles.ghostBtn} onClick={onRetry}><RefreshCw size={15} aria-hidden="true" />{copy.analyzingRetry}</button>
              <button type="button" className={styles.ghostBtn} onClick={onBack}><ArrowLeft className="rtl-mirror" size={15} aria-hidden="true" />{copy.analyzingBack}</button>
            </div>
          </div>
        </div>
      </div>
    </PageChrome>
  );
}

function MoreDots() {
  return <span aria-hidden="true" style={{ color: "#642bef", letterSpacing: 2 }}>•••</span>;
}

export function ResultView({
  locale,
  answers,
  storageAvailable,
  onEdit,
  onDetail,
  onSave,
  onErase,
}: {
  locale: Locale;
  answers: Stored["answers"];
  storageAvailable: boolean;
  onEdit: () => void;
  onDetail: (key: PriorityKey) => void;
  onSave: () => void;
  onErase: () => void;
}) {
  const copy = getPublicJourneyCopy(locale).diagnostic;
  const priorities = useMemo(() => computePriorities(answers), [answers]);
  const [openKey, setOpenKey] = useState<PriorityKey | null>(priorities[0] ?? null);
  const assistHref = `/${locale}/besoin?source=diagnostic&priority=${encodeURIComponent(priorities[0] ?? "")}`;
  const priorityTone = (key: PriorityKey, index: number) => {
    if (key === "organization" || kinds[key] === "risk") return { label: locale === "fr" ? "Priorité élevée" : "أولوية مرتفعة", className: styles.priorityBadgeAnalyze };
    if (index === 1) return { label: locale === "fr" ? "Priorité moyenne" : "أولوية متوسطة", className: styles.priorityBadgeMid };
    return { label: locale === "fr" ? "Priorité plus faible" : "أولوية أقل", className: styles.priorityBadgeLow };
  };
  return (
    <PageChrome locale={locale}>
      <Hero eyebrow={copy.resultEyebrow} title={copy.resultTitle} intro={copy.resultIntro} script={copy.scriptNote} />
      <div className={styles.resultBoard}>
        <div>
          {priorities.length ? (
            <div className={styles.resultCards}>
              {priorities.map((key, index) => {
                const item = copy.priorities[key];
                const kind = kinds[key];
                const analyze = kind === "risk" || kind === "opportunity";
                const Icon = kind === "risk" ? AlertTriangle : kind === "verify" ? CircleHelp : CheckCircle2;
                const tone = priorityTone(key, index);
                const expanded = openKey === key;
                return (
                  <article key={key} className={styles.priorityCard} data-expanded={expanded ? "true" : "false"}>
                    <button type="button" className={styles.priorityToggle} aria-expanded={expanded} onClick={() => setOpenKey((current) => current === key ? null : key)}>
                      <span className={styles.priorityToggleMain}>
                        <span className={styles.priorityIndex}>{index + 1}.</span>
                        <h2 className={styles.priorityTitle}>{item[0]}</h2>
                      </span>
                      <span className={`${styles.priorityBadge} ${tone.className}`}>
                        <Icon size={14} aria-hidden="true" />
                        {tone.label}
                      </span>
                    </button>
                    <div className={styles.priorityBody}>
                      <span className={`${styles.priorityBadge} ${analyze ? styles.priorityBadgeAnalyze : styles.priorityBadgeVerify} ${styles.priorityBadgeDesktop}`}>
                        <Icon size={14} aria-hidden="true" />
                        {copy.kindLabels[kind]}
                      </span>
                      <h2 className={`${styles.priorityTitle} ${styles.priorityTitleDesktop}`}>{item[0]}</h2>
                      <div className={styles.priorityMeta}>
                        <p className={styles.priorityRow}><Sparkles className={styles.priorityRowIcon} size={15} aria-hidden="true" /><span><strong>{copy.typeLabel} :</strong> {copy.typeLabels[key]}</span></p>
                        <div className={`${styles.priorityBlock} ${styles.priorityBlockMint}`}><CheckCircle2 size={16} aria-hidden="true" /><div><strong>{copy.constat}</strong><p>{observationLabel(locale, key, answers)}</p></div></div>
                        <div className={`${styles.priorityBlock} ${styles.priorityBlockViolet}`}><Lightbulb size={16} aria-hidden="true" /><div><strong>{copy.whyItMatters}</strong><p>{item[2]}</p></div></div>
                        <div className={`${styles.priorityBlock} ${styles.priorityBlockCoral}`}><Target size={16} aria-hidden="true" /><div><strong>{copy.recommendedAction}</strong><p>{item[3]}</p></div></div>
                      </div>
                      <button type="button" className={styles.detailCta} onClick={() => onDetail(key)}>
                        {copy.viewDetail}<ArrowRight className="rtl-mirror" size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p role="status" className={styles.emptyState}>
              {locale === "fr"
                ? "Aucune priorité particulière n’est ressortie du périmètre évalué. Ce résultat n’est pas une attestation."
                : "لم تظهر أولوية خاصة ضمن النطاق المقيم. هذه النتيجة ليست شهادة."}
            </p>
          )}
          <div className={styles.legend}>
            <p className={styles.legendTitle}>{copy.legendTitle}</p>
            <div className={styles.legendList}>
              <div className={styles.legendItem}><AlertTriangle size={16} color="#c0364a" aria-hidden="true" /><span><strong>{copy.legend.analyze[0]}</strong>{copy.legend.analyze[1]}</span></div>
              <div className={styles.legendItem}><CheckCircle2 size={16} color="#1e7a5c" aria-hidden="true" /><span><strong>{copy.legend.verify[0]}</strong>{copy.legend.verify[1]}</span></div>
              <div className={styles.legendItem}><CircleHelp size={16} color="#5e6a93" aria-hidden="true" /><span><strong>{copy.legend.none[0]}</strong>{copy.legend.none[1]}</span></div>
            </div>
          </div>
        </div>
        <aside className={styles.resultAside}>
          <div className={styles.planCard}>
            <p className={styles.planHead}><Target size={18} color="#642bef" aria-hidden="true" />{copy.planTitle}</p>
            <p className={styles.planSub}>{copy.planSubtitle}</p>
            <ol className={styles.planList}>
              {copy.planItems.map(([title, text], index) => (
                <li key={title} className={styles.planStep}>
                  <span className={styles.planNum}>{index + 1}</span>
                  <div><strong>{title}</strong><span>{text}</span></div>
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.knowBox}>
            <Info size={18} aria-hidden="true" />
            <div>
              <strong>{copy.goodToKnow}</strong>
              <p>{copy.goodToKnowText}</p>
            </div>
          </div>
          <div className={styles.stackActions}>
            <button type="button" className={styles.primaryWide} onClick={onSave}><Download size={16} aria-hidden="true" />{copy.save}</button>
            <Link className={styles.secondaryWide} href={assistHref}><Users size={16} aria-hidden="true" />{copy.assist}</Link>
            <button type="button" className={styles.secondaryWide} onClick={onEdit}><Pencil size={16} aria-hidden="true" />{copy.restart}</button>
          </div>
          {!storageAvailable ? <p role="status" className={styles.note} style={{ marginTop: 12 }}>{locale === "fr" ? "Ce bilan n’est pas sauvegardé sur cet appareil." : "هذا التقييم غير محفوظ على هذا الجهاز."}</p> : null}
          <button type="button" className={styles.back} style={{ marginTop: 12 }} onClick={onErase}>{copy.erase}</button>
        </aside>
      </div>
      <div className={styles.mobileBar}>
        <button type="button" className={styles.mobileEdit} onClick={onEdit}><Pencil size={16} aria-hidden="true" />{copy.restart}<ArrowRight className="rtl-mirror" size={16} aria-hidden="true" /></button>
        <button type="button" className={styles.primaryWide} onClick={onSave}><Download size={16} aria-hidden="true" />{copy.save}<ArrowRight className="rtl-mirror" size={16} aria-hidden="true" /></button>
        <Link className={styles.secondaryWide} href={assistHref}><Users size={16} aria-hidden="true" />{copy.assist}</Link>
        <p className={styles.mobilePrivacy}><Lock size={14} aria-hidden="true" />{copy.analyzingConfidential}</p>
      </div>
    </PageChrome>
  );
}

export function DetailView({
  locale,
  priority,
  answers,
  onBack,
}: {
  locale: Locale;
  priority: PriorityKey;
  answers: Stored["answers"];
  onBack: () => void;
}) {
  const copy = getPublicJourneyCopy(locale).diagnostic;
  const item = copy.priorities[priority];
  const needHref = `/${locale}/besoin?source=diagnostic&priority=${encodeURIComponent(priority)}`;
  const linked = diagnosticPriorityTriggers(answers)[priority].map((id) => ({
    id, label: copy.questions[questionIds.indexOf(id)]?.[0] ?? copy.questionLabels[id],
    quote: answerLabel(locale, id, answers[id]),
  }));
  return (
    <PageChrome locale={locale}>
      <p className={styles.breadcrumb}>{copy.detailBreadcrumb}</p>
      <Hero eyebrow={copy.resultEyebrow} title={item[0]} intro={copy.resultIntro} script={copy.scriptNote} />
      <div className={styles.detailGrid}>
        <div className={styles.detailStack}>
          <section className={styles.detailCard}>
            <div className={styles.detailCardHead}>
              <ClipboardList size={22} color="#e65290" aria-hidden="true" />
              <div>
                <h2>{copy.detailAnswersTitle}</h2>
                <p>{copy.detailAnswersLead}</p>
              </div>
            </div>
            {!linked.length ? <p role="status">{copy.detailNoEvidence}</p> : null}
            <div className={styles.linkedGrid} data-answer-trace>
              {linked.map((entry) => (
                <div key={entry.id} className={styles.linkedBox} data-question={entry.id}>
                  <small>{copy.detailLinked}</small>
                  <strong>{entry.label}</strong>
                  <p>« {entry.quote} »</p>
                </div>
              ))}
            </div>
          </section>
          <section className={styles.detailCard}>
            <div className={styles.detailCardHead}>
              <Lightbulb size={22} color="#d97706" aria-hidden="true" />
              <div>
                <h2>{copy.detailWhyTitle}</h2>
                <p><strong>{copy.constat} : </strong>{observationLabel(locale, priority, answers)}</p>
                <p>{item[2]}</p>
                <p><strong>{copy.recommendedAction} : </strong>{item[3]}</p>
              </div>
            </div>
          </section>
          <section className={styles.detailCard}>
            <div className={styles.detailCardHead}>
              <AlertTriangle size={22} color="#c0364a" aria-hidden="true" />
              <div>
                <h2>{copy.detailWatchTitle}</h2>
                <p>{copy.detailWatchText}</p>
              </div>
            </div>
          </section>
          {linked.length ? <section className={styles.detailCard} aria-labelledby="diagnostic-action-plan">
            <div className={styles.detailCardHead}>
              <Target size={22} color="#1e7a5c" aria-hidden="true" />
              <div>
                <h2 id="diagnostic-action-plan">{copy.detailPlanTitle}</h2>
                <p>{copy.detailPlanLead}</p>
                <p>{copy.detailEvidence} {linked.map((entry) => `${copy.questionLabels[entry.id]} : ${entry.quote}`).join(" · ")}</p>
              </div>
            </div>
            <div className={styles.actionSteps} role="list">
              {copy.actionPlans[priority].map((action, step) => (
                <div key={`${priority}-${step}`} className={styles.actionStep} role="listitem" data-action-step={step + 1}>
                  <span>{step + 1}</span>
                  <div>
                    <strong>{item[step + 4]}</strong>
                    <p>{action.action}</p>
                    <dl>
                      <div><dt>{copy.detailDeliverable}</dt><dd>{action.deliverable}</dd></div>
                      <div><dt>{copy.detailOwner}</dt><dd>{action.owner}</dd></div>
                      <div><dt>{copy.detailDone}</dt><dd>{action.done}</dd></div>
                    </dl>
                  </div>
                </div>
              ))}
            </div>
          </section> : null}
        </div>
        <aside className={styles.planCard}>
          <h2 className={styles.planHead}>{copy.detailAbout}</h2>
          <div className={styles.aboutMeta}>
            <div className={styles.aboutRow}>
              <span className={styles.recapIcon} aria-hidden="true"><Flag size={18} /></span>
              <div><small>{copy.detailType}</small><strong>{copy.typeLabels[priority]}</strong></div>
            </div>
            <div className={styles.aboutRow}>
              <span className={styles.recapIcon} aria-hidden="true"><Building2 size={18} /></span>
              <div><small>{copy.detailScope}</small><strong>{copy.detailScopeValue}</strong><p>{copy.detailScopeHint}</p></div>
            </div>
            <div className={styles.aboutRow}>
              <span className={styles.recapIcon} aria-hidden="true"><ShieldCheck size={18} /></span>
              <div><small>{copy.detailConfidence}</small><strong>{copy.detailConfidenceValue}</strong><p>{copy.detailConfidenceText}</p></div>
            </div>
          </div>
          <div className={styles.knowBox} style={{ marginTop: 18 }}>
            <CheckCircle2 size={18} aria-hidden="true" />
            <div><strong>{copy.detailRemember}</strong><p>{copy.detailRememberText}</p></div>
          </div>
          <div className={styles.stackActions}>
            <Link className={styles.primaryWide} href={needHref}>{copy.prepareNeed}<ArrowRight className="rtl-mirror" size={16} aria-hidden="true" /></Link>
            <button type="button" className={styles.secondaryWide} onClick={onBack}><ArrowLeft className="rtl-mirror" size={16} aria-hidden="true" />{copy.backToResult}</button>
          </div>
          <Link className={styles.helpLink} href={`/${locale}/a-propos`}>{copy.detailHelp}<ExternalLink size={14} aria-hidden="true" /></Link>
        </aside>
      </div>
    </PageChrome>
  );
}

export function SaveView({
  locale,
  answers,
  organizations,
  authenticated,
  saveAction,
  onSaved,
  onBack,
}: {
  locale: Locale;
  answers: Stored["answers"];
  organizations: OrganizationOption[];
  authenticated: boolean;
  saveAction?: (state: SaveState, data: FormData) => Promise<SaveState>;
  onSaved: () => void;
  onBack: () => void;
}) {
  const copy = getPublicJourneyCopy(locale).diagnostic;
  const priorities = useMemo(() => computePriorities(answers), [answers]);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [saveState, submitSave, savePending] = useActionState(saveAction ?? (async () => ({ status: "error", reason: "UNAVAILABLE" } as SaveState)), { status: "idle" } as SaveState);
  useEffect(() => { if (saveState.status === "success") onSaved(); }, [saveState.status, onSaved]);
  const selected = organizations.find((item) => item.id === organizationId);
  const completeAnswers = questionIds.every((id) => answers[id] !== undefined);

  if (!authenticated) {
    const resumeHref = `/${locale}/diagnostic?reprendre=enregistrer`;
    const signupHref = connexionHref(locale, { mode: "inscription", role: "client", next: resumeHref });
    const loginHref = connexionHref(locale, { next: resumeHref });
    return (
      <PageChrome locale={locale}>
        <Hero eyebrow={copy.resultEyebrow} title={copy.saveTitle} intro={copy.saveIntro} script={copy.scriptNote} />
        <section className={styles.card}>
          <p className={styles.heroIntro}>{copy.loginNote}</p>
          <p className={styles.heroIntro} style={{ marginTop: 12 }}>{copy.saveAuthChoice}</p>
          <div className={styles.stackActions} style={{ maxWidth: 420 }}>
            <Link className={styles.primaryWide} href={signupHref}>{copy.saveCreateAccount}<ArrowRight className="rtl-mirror" size={16} aria-hidden="true" /></Link>
            <Link className={styles.secondaryWide} href={loginHref}>{copy.saveExistingAccount}</Link>
            <button type="button" className={styles.secondaryWide} onClick={onBack}><ArrowLeft className="rtl-mirror" size={16} aria-hidden="true" />{copy.backToResult}</button>
          </div>
        </section>
      </PageChrome>
    );
  }

  if (!organizations.length || !saveAction) {
    return (
      <PageChrome locale={locale}>
        <Hero eyebrow={copy.resultEyebrow} title={copy.saveTitle} intro={copy.saveIntro} script={copy.scriptNote} />
        <section className={styles.card}>
          <p className={styles.heroIntro}>{locale === "fr" ? "Votre compte n’a aucune organisation Client autorisée pour cet enregistrement." : "لا يحتوي حسابكم على مؤسسة عميلة مخولة لهذا الحفظ."}</p>
          <div className={styles.stackActions} style={{ maxWidth: 420 }}>
            <Link className={styles.primaryWide} href={`/${locale}/organisation?role=client&next=${encodeURIComponent(`/${locale}/diagnostic?reprendre=enregistrer`)}`}>{locale === "fr" ? "Configurer mon organisation" : "إعداد مؤسستي"}</Link>
            <button type="button" className={styles.secondaryWide} onClick={onBack}>{copy.backToResult}</button>
          </div>
        </section>
      </PageChrome>
    );
  }

  return (
    <PageChrome locale={locale}>
      <Hero eyebrow={copy.resultEyebrow} title={copy.saveTitle} intro={copy.saveIntro} script={copy.scriptNote} />
      <div className={styles.resultBoard}>
        <section className={styles.card}>
          <p className={styles.planHead}><ClipboardList size={18} color="#642bef" aria-hidden="true" />{copy.saveReady}</p>
          <p className={styles.cardEyebrow} style={{ marginTop: 18 }}>{copy.savePrioritiesTitle}</p>
          <ol className={styles.priorityMeta} style={{ marginTop: 12 }}>
            {priorities.map((key, index) => (
              <li key={key} className={styles.priorityRow}>
                <span className={styles.planNum}>{index + 1}</span>
                <span><strong>{copy.priorities[key][0]}</strong></span>
              </li>
            ))}
          </ol>
          <p className={styles.heroIntro} style={{ marginTop: 22 }}>{copy.saveChooseOrg}</p>
          <div className={styles.orgGrid} role="radiogroup" aria-label={copy.saveChooseOrg}>
            {organizations.map((organization) => {
              const selectedOrg = organization.id === organizationId;
              return (
                <button
                  key={organization.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedOrg}
                  className={selectedOrg ? `${styles.orgCard} ${styles.orgCardSelected}` : styles.orgCard}
                  onClick={() => setOrganizationId(organization.id)}
                >
                  <strong>{organization.name}</strong>
                  {selectedOrg ? <span className={styles.orgBadge}>{copy.saveActiveOrg}</span> : null}
                </button>
              );
            })}
          </div>
          <form action={submitSave} className={styles.actions} style={{ marginTop: 22 }}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="answers" value={JSON.stringify(answers.sector === "health_social" ? { ...answers, sector: "other" } : answers)} />
            <input type="hidden" name="organizationId" value={organizationId} />
            <button type="button" className={styles.back} onClick={onBack}><ArrowLeft className="rtl-mirror" size={16} aria-hidden="true" />{copy.backToResult}</button>
            <button type="submit" className={styles.continue} disabled={savePending || !completeAnswers || !organizationId}>
              {savePending ? (locale === "fr" ? "Enregistrement…" : "جارٍ الحفظ…") : `${copy.saveIn} ${selected?.name ?? ""}`}
              <ArrowRight className="rtl-mirror" size={18} aria-hidden="true" />
            </button>
          </form>
          {saveState.status === "error" ? (
            <p role="alert" className={styles.note} style={{ marginTop: 12 }}>
              {saveState.reason === "FORBIDDEN"
                ? locale === "fr" ? "Vous n’avez plus l’autorisation d’enregistrer pour cette entreprise." : "لم يعد لديكم إذن الحفظ لهذه المؤسسة."
                : locale === "fr" ? "L’enregistrement a échoué. Vos réponses restent disponibles sur cet appareil." : "تعذر الحفظ. ما زالت إجاباتكم متاحة على هذا الجهاز."}
            </p>
          ) : null}
          {saveState.status === "success" ? (
            <p role="status" className={styles.note} style={{ marginTop: 12 }}>
              <CheckCircle2 aria-hidden="true" className="inline" size={18} /> {locale === "fr" ? "Orientation enregistrée." : "تم حفظ التوجيه."}{" "}
              <Link className={styles.recapEdit} href={`/${locale}/client/questionnaires`}>{copy.continueQuestionnaire}</Link>
            </p>
          ) : null}
        </section>
        <aside>
          <div className={styles.planCard}>
            <p className={styles.planHead}>{copy.saveOnceTitle}</p>
            <ul className={styles.planList} style={{ marginTop: 14 }}>
              {copy.saveOnceItems.map((item, index) => (
                <li key={item} className={styles.planStep}>
                  <span className={styles.planNum}>{index + 1}</span>
                  <strong>{item}</strong>
                </li>
              ))}
            </ul>
            <p className={styles.script} style={{ marginTop: 24, justifySelf: "start", textAlign: "start" }}>{copy.saveQuote}</p>
          </div>
        </aside>
      </div>
    </PageChrome>
  );
}

export type { PriorityKey, SaveState, OrganizationOption };

export function HonestStatesView({ locale, onEdit, onAssist }: { locale: Locale; onEdit: () => void; onAssist: () => void }) {
  const copy = getPublicJourneyCopy(locale).diagnostic;
  const title = locale === "fr" ? "Aucune priorité majeure détectée sur le périmètre évalué" : "لا أولوية كبرى ضمن النطاق المقيم";
  const body = locale === "fr"
    ? "Vos réponses ne font apparaître aucune des priorités suivies par cet éclairage. Ce n’est pas un score de santé, ni une certification. Vous pouvez revoir vos réponses ou décrire un besoin précis."
    : "لا تُظهر إجاباتكم أي أولوية يتتبعها هذا التقييم الأولي. هذه ليست نتيجة صحة ولا شهادة. يمكنكم مراجعة إجاباتكم أو وصف احتياج محدد.";
  return (
    <PageChrome locale={locale}>
      <Hero eyebrow={copy.resultEyebrow} title={title} intro={copy.resultIntro} script={copy.scriptNote} />
      <article className={styles.priorityCard}>
        <span className={`${styles.priorityBadge} ${styles.priorityBadgeVerify}`}><CheckCircle2 size={14} aria-hidden="true" />{locale === "fr" ? "Périmètre évalué" : "النطاق المقيم"}</span>
        <h2 className={styles.priorityTitle}>{title}</h2>
        <p className={styles.priorityRow}>{body}</p>
        <div className={styles.stackActions}>
          <button type="button" className={styles.primaryWide} onClick={onEdit}>{copy.restart}</button>
          <button type="button" className={styles.secondaryWide} onClick={onAssist}>{copy.assist}</button>
        </div>
      </article>
    </PageChrome>
  );
}

export function RecoveryStatesView({ locale, onRetry, onContinue, onReconnect }: { locale: Locale; onRetry: () => void; onContinue: () => void; onReconnect: () => void }) {
  const copy = getPublicJourneyCopy(locale).diagnostic;
  const title = locale === "fr" ? "Le brouillon n’a pas pu être conservé sur cet appareil" : "تعذر حفظ المسودة على هذا الجهاز";
  return (
    <PageChrome locale={locale}>
      <Hero eyebrow={copy.eyebrow} title={locale === "fr" ? "Reprendre mon diagnostic" : "استئناف تشخيصي"} intro={title} script={copy.scriptNote} />
      <article className={styles.priorityCard}>
        <span className={`${styles.priorityBadge} ${styles.priorityBadgeAnalyze}`}><AlertTriangle size={14} aria-hidden="true" />{title}</span>
        <h2 className={styles.priorityTitle}>{title}</h2>
        <p className={styles.priorityRow}>{locale === "fr" ? "Les réponses déjà saisies dans cette page restent affichées. Vous pouvez réessayer l’enregistrement local ou continuer sans sauvegarde sur cet appareil." : "تبقى الإجابات المدخلة في هذه الصفحة ظاهرة. يمكنكم إعادة الحفظ المحلي أو المتابعة دون حفظ على هذا الجهاز."}</p>
        <div className={styles.stackActions}>
          <button type="button" className={styles.primaryWide} onClick={onRetry}>{locale === "fr" ? "Réessayer l’enregistrement" : "إعادة الحفظ"}</button>
          <button type="button" className={styles.secondaryWide} onClick={onContinue}>{locale === "fr" ? "Continuer sans sauvegarde locale" : "المتابعة دون حفظ محلي"}</button>
          <button type="button" className={styles.secondaryWide} onClick={onReconnect}>{locale === "fr" ? "Se reconnecter" : "إعادة الاتصال"}</button>
        </div>
      </article>
    </PageChrome>
  );
}
