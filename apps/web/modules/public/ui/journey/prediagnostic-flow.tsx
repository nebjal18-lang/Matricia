"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Factory, Lock, Monitor, MoreHorizontal, ShieldCheck, ShoppingCart } from "lucide-react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { getPublicJourneyCopy } from "@/modules/public/data/journey/copy";
import { diagnosticOptionIds as optionIds } from "@/modules/public/data/journey/diagnostic-contract";
import { diagnosticQuestionIds as questionIds, parseStoredDiagnostic, type DiagnosticAnswer as Answer, type DiagnosticQuestionId as QuestionId, type StoredDiagnostic as Stored } from "./diagnostic-storage";
import { AnalyzingView, DetailView, HonestStatesView, RecapView, RecoveryStatesView, ResultView, SaveView, computePriorities, type OrganizationOption, type PriorityKey, type SaveState } from "./prediagnostic-phases";
import styles from "./diagnostic-premium.module.css";

const storageKey = "matricia.public-diagnostic.v2";
const legacyKeys = ["matricia.public-diagnostic", "matricia.public-diagnostic.fr", "matricia.public-diagnostic.ar"];
const legacyQuestionIds = ["goals", "sector", "team_size", "priority_tracking", "sales_tracking", "backup_restore", "decision_trace", "next_action"] as const;
type Phase = "questions" | "recap" | "analyzing" | "result" | "detail" | "save" | "honest" | "recovery";

const initial = (): Stored => ({ version: 2, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, step: 0, answers: {} });

function convertLegacy(raw: string, locale: Locale): Stored | null {
  try {
    const value = JSON.parse(raw) as { expiresAt?: number; step?: number; answers?: Record<string, Answer>; locale?: Locale };
    if (!value.expiresAt || value.expiresAt <= Date.now() || !value.answers) return null;
    const source = getPublicJourneyCopy(value.locale === "ar" ? "ar" : locale).diagnostic.questions;
    const answers: Partial<Record<QuestionId, Answer>> = {};
    for (const [rawIndex, rawAnswer] of Object.entries(value.answers)) {
      const index = Number(rawIndex), id = legacyQuestionIds[index];
      if (!id || !(typeof rawAnswer === "string" || Array.isArray(rawAnswer) && rawAnswer.every((entry) => typeof entry === "string"))) continue;
      if (id === "next_action") answers[id] = rawAnswer;
      else {
        const labels = source[questionIds.indexOf(id)]?.[2] ?? [];
        const ids = optionIds[id];
        const convert = (label: string) => ids[labels.indexOf(label)] ?? "";
        const converted = Array.isArray(rawAnswer) ? rawAnswer.map(convert).filter(Boolean) : convert(rawAnswer);
        if (Array.isArray(converted) ? converted.length : converted) answers[id] = converted;
      }
    }
    return { version: 2, expiresAt: value.expiresAt, step: Math.min(Math.max(value.step ?? 0, 0), questionIds.length), answers };
  } catch { return null; }
}

export function PrediagnosticFlow({ locale, organizations = [], authenticated = false, resumeSave = false, saveAction }: { locale: Locale; organizations?: OrganizationOption[]; authenticated?: boolean; resumeSave?: boolean; saveAction?: (state: SaveState, data: FormData) => Promise<SaveState> }) {
  const copy = getPublicJourneyCopy(locale).diagnostic;
  const router = useRouter();
  const [state, setState] = useState<Stored>(initial);
  const [phase, setPhase] = useState<Phase>("questions");
  const [detailKey, setDetailKey] = useState<PriorityKey>("organization");
  const [analyzeKey, setAnalyzeKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const clearStored = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
      for (const key of legacyKeys) {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
      }
    } catch { setStorageAvailable(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        let restored = parseStoredDiagnostic(window.localStorage.getItem(storageKey));
        if (!restored) {
          for (const key of legacyKeys) {
            const raw = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
            if (raw) {
              restored = convertLegacy(raw, locale);
              if (restored) break;
            }
          }
        }
        if (restored) {
          setState(restored);
          if (restored.step >= questionIds.length) setPhase(resumeSave ? "save" : "result");
        }
      } catch { setStorageAvailable(false); }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [locale, resumeSave]);

  useEffect(() => {
    if (!loaded || !storageAvailable) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch { window.setTimeout(() => { setStorageAvailable(false); setPhase("recovery"); }, 0); }
  }, [state, loaded, storageAvailable]);

  const goQuestions = useCallback((step = 0) => {
    setPhase("questions");
    setState((current) => ({ ...current, step, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  }, []);

  if (!loaded) {
    return (
      <main id="contenu-principal" className={`${styles.page} diagnostic-premium-page`} dir={locale === "ar" ? "rtl" : "ltr"} aria-busy="true">
        <div className={styles.shell}>
          <p className={styles.eyebrow}><span className={styles.eyebrowMark} aria-hidden="true" />{copy.eyebrow}</p>
          <h1 className={styles.heroTitle}>{copy.title}</h1>
          <p className={styles.loading}>{locale === "fr" ? "Chargement de votre bilan…" : "جارٍ تحميل تقييمكم…"}</p>
        </div>
      </main>
    );
  }

  if (phase === "recap") {
    return (
      <RecapView
        locale={locale}
        answers={state.answers}
        onEdit={(step) => goQuestions(step)}
        onBack={() => goQuestions(questionIds.length - 1)}
        onAnalyze={() => { setAnalyzeKey((value) => value + 1); setPhase("analyzing"); }}
      />
    );
  }

  if (phase === "analyzing") {
    return (
      <AnalyzingView
        key={analyzeKey}
        locale={locale}
        answers={state.answers}
        onDone={() => {
          setPhase("result");
          router.push(`/${locale}/diagnostic/resultat`);
        }}
        onRetry={() => setAnalyzeKey((value) => value + 1)}
        onBack={() => setPhase("recap")}
      />
    );
  }

  if (phase === "detail") {
    return <DetailView locale={locale} priority={detailKey} answers={state.answers} onBack={() => setPhase("result")} />;
  }

  if (phase === "save") {
    return (
      <SaveView
        locale={locale}
        answers={state.answers}
        organizations={organizations}
        authenticated={authenticated}
        saveAction={saveAction}
        onSaved={clearStored}
        onBack={() => setPhase("result")}
      />
    );
  }

  if (phase === "honest") {
    return (
      <HonestStatesView
        locale={locale}
        onEdit={() => goQuestions(0)}
        onAssist={() => router.push(`/${locale}/besoin?source=diagnostic`)}
      />
    );
  }

  if (phase === "recovery") {
    return (
      <RecoveryStatesView
        locale={locale}
        onRetry={() => { setStorageAvailable(true); setPhase(state.step >= questionIds.length ? "result" : "questions"); }}
        onContinue={() => setPhase(state.step >= questionIds.length ? "result" : "questions")}
        onReconnect={() => router.push(`/${locale}/connexion?next=${encodeURIComponent(`/${locale}/diagnostic`)}`)}
      />
    );
  }

  if (phase === "result" || state.step >= questionIds.length) {
    const priorities = computePriorities(state.answers);
    if (!priorities.length) {
      return (
        <HonestStatesView
          locale={locale}
          onEdit={() => goQuestions(0)}
          onAssist={() => router.push(`/${locale}/besoin?source=diagnostic`)}
        />
      );
    }
    return (
      <ResultView
        locale={locale}
        answers={state.answers}
        storageAvailable={storageAvailable}
        onEdit={() => goQuestions(0)}
        onDetail={(key) => { setDetailKey(key); setPhase("detail"); }}
        onSave={() => setPhase("save")}
        onErase={() => {
          clearStored();
          setState(initial());
          setPhase("questions");
        }}
      />
    );
  }

  const questionId = questionIds[state.step]!;
  const question = copy.questions[state.step];
  const answer = state.answers[questionId];
  const choices = questionId === "next_action" ? [] : optionIds[questionId].map((id, index) => ({ id, label: question[2][index] ?? id }));
  const canProceed = choices.length ? Boolean(Array.isArray(answer) ? answer.length : answer) : typeof answer === "string" && answer.trim().length >= 3;
  const setAnswer = (value: Answer) => setState((current) => ({
    ...current,
    answers: Object.fromEntries([...Object.entries(current.answers).filter(([key]) => questionIds.indexOf(key as QuestionId) <= current.step), [questionId, value]]),
  }));
  const progressPct = ((state.step + 1) / questionIds.length) * 100;
  const trustIcons = [Lock, Monitor, ShieldCheck] as const;

  return (
    <main id="contenu-principal" className={`${styles.page} diagnostic-premium-page`} dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.eyebrowMark} aria-hidden="true" />{copy.eyebrow}</p>
            <h1 className={styles.heroTitle}>{copy.title}</h1>
            <p className={styles.heroIntro}>{copy.intro}</p>
          </div>
          <p className={styles.script} aria-hidden="true">{copy.scriptNote}</p>
        </header>

        <div className={styles.board}>
          <section className={styles.card} aria-labelledby="diagnostic-question">
            <div className={styles.cardHead}>
              <p className={styles.cardEyebrow}>{copy.questionLabels[questionId]}</p>
              <p className={styles.progressMeta} aria-live="polite">{copy.progress(state.step + 1, questionIds.length)}</p>
            </div>
            <div className={styles.progressTrack} aria-hidden="true"><span className={styles.progressFill} style={{ width: `${progressPct}%` }} /></div>
            <p className={styles.progressPct} style={{ ["--progress" as string]: progressPct }}>{copy.percent(state.step + 1, questionIds.length)}</p>
            {!storageAvailable ? <p role="status" className={styles.note}>{locale === "fr" ? "La sauvegarde locale est indisponible. Vous pouvez continuer en gardant cette page ouverte." : "الحفظ المحلي غير متاح. يمكنكم المتابعة مع إبقاء الصفحة مفتوحة."}</p> : null}
            <h2 id="diagnostic-question" className={styles.question}>{question[0]}</h2>
            <p className={styles.questionHelp}>{question[1]}</p>
            {choices.length ? (
              <Choices label={String(question[0])} choices={choices} value={answer} multi={questionId === "goals"} icons={questionId === "sector"} onChange={setAnswer} />
            ) : (
              <textarea aria-labelledby="diagnostic-question" className={styles.textarea} autoFocus value={typeof answer === "string" ? answer : ""} onChange={(event) => setAnswer(event.target.value.slice(0, 500))} rows={5} maxLength={500} />
            )}
            <div className={styles.actions}>
              {state.step > 0 ? (
                <button type="button" className={styles.back} onClick={() => setState((current) => ({ ...current, step: current.step - 1 }))}>
                  <ArrowLeft className="rtl-mirror" aria-hidden="true" size={16} />{copy.back}
                </button>
              ) : (
                <Link className={styles.back} href={`/${locale}`}>
                  <ArrowLeft className="rtl-mirror" aria-hidden="true" size={16} />{copy.back}
                </Link>
              )}
              <button
                type="button"
                className={styles.continue}
                disabled={!canProceed}
                onClick={() => {
                  const next = { ...state, step: state.step + 1, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 };
                  setState(next);
                  try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* keep on-page if storage is blocked */ }
                  if (next.step >= questionIds.length) setPhase("recap");
                }}
              >
                {state.step === questionIds.length - 1 ? copy.next : copy.next}
                <ArrowRight className="rtl-mirror" aria-hidden="true" size={18} />
              </button>
            </div>
          </section>

          <aside className={styles.side}>
            <div className={styles.rail}>
              <p className={styles.railTitle}>{copy.railTitle}</p>
              <ol className={styles.steps}>
                {copy.steps.map((label, index) => (
                  <li key={label} className={index === state.step ? `${styles.step} ${styles.stepCurrent}` : index < state.step ? `${styles.step} ${styles.stepDone}` : styles.step}>
                    <span className={styles.stepNum}>{index < state.step ? "✓" : index + 1}</span>
                    <strong>
                      {label}
                      {index === state.step ? <em className={styles.stepStatus}>{copy.currentStep}</em> : null}
                    </strong>
                  </li>
                ))}
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
        </div>
      </div>
      <footer className={styles.pageFooter}>
        <p className={styles.pageFooterBrand}>{copy.footerBrand}</p>
        <p className={styles.pageFooterTag}>{copy.footerTag}</p>
      </footer>
    </main>
  );
}

function Choices({ label, choices, value, multi, icons = false, onChange }: { label: string; choices: readonly { id: string; label: string }[]; value: Answer | undefined; multi: boolean; icons?: boolean; onChange: (value: Answer) => void }) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const sectorIcons = [Factory, ShoppingCart, Monitor, Building2, MoreHorizontal];
  return (
    <div className={styles.choices} role={multi ? "group" : "radiogroup"} aria-label={label}>
      {choices.map((choice, index) => {
        const checked = selected.includes(choice.id);
        const Icon = icons ? sectorIcons[index] ?? MoreHorizontal : null;
        return (
          <button
            key={choice.id}
            type="button"
            role={multi ? undefined : "radio"}
            aria-pressed={multi ? checked : undefined}
            aria-checked={multi ? undefined : checked}
            tabIndex={multi || checked || !selected.length && index === 0 ? 0 : -1}
            className={checked ? `${styles.choice} ${styles.choiceSelected}` : styles.choice}
            onKeyDown={(event) => {
              if (multi || !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const direction = event.key === "Home" ? -index : event.key === "End" ? choices.length - 1 - index : ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
              const nextIndex = (index + direction + choices.length) % choices.length;
              onChange(choices[nextIndex]!.id);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=radio]")[nextIndex]?.focus();
            }}
            onClick={() => multi ? onChange(checked ? selected.filter((item) => item !== choice.id) : [...selected, choice.id]) : onChange(choice.id)}
          >
            {Icon ? (
              <span className={styles.choiceLabel}>
                <Icon className={styles.choiceIcon} aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>{choice.label}</span>
              </span>
            ) : (
              <span>{choice.label}</span>
            )}
            <span className={styles.choiceRadio} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
