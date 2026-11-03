"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { ArrowRight, CheckCircle2, Pencil, Plus, ShieldCheck } from "lucide-react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { getPublicJourneyCopy } from "@/modules/public/data/journey/copy";
import { canonicalizePublicNeedClassification, formatNeedScoreBasisPoints, publicNeedRequestHref, rankPublicNeedServices, type NeedDiscovery, type PublicNeedClassification } from "@/modules/public/data/need-intent/model";
import { getPublicProviderTaxonomy } from "@/modules/public/data/provider-intent/model";
import { publicCatalogueTranslationNotice } from "@/modules/public/data/catalogue/localized-label";
import { getNeedStages, needRecapStep, needStageForStep, needStageIds } from "@/modules/public/data/journey/need-stages";

type Draft = {
  version: 3;
  step: number;
  need: string;
  location: string;
  timing: string;
  constraints: string;
  tags: string[];
  unlisted: boolean;
  classification: PublicNeedClassification | null;
  categoryCode: string;
  confirmed: boolean;
  answers: Record<string, string>;
  expiresAt: number;
};
type Organization = { id: string; name: string };
type SaveNeedState = { status: "idle" } | { status: "success"; intakeId: string } | { status: "error"; reason: "VALIDATION" | "FORBIDDEN" | "UNAVAILABLE" };
type DiscoverNeedState = { status: "success"; value: NeedDiscovery } | { status: "error"; reason: "VALIDATION" | "FORBIDDEN" | "UNAUTHENTICATED" | "UNAVAILABLE" };
type DiscoverAction = (input: { locale: "fr" | "ar"; organizationId: string; inputText: string }) => Promise<DiscoverNeedState>;

const storageKey = "matricia.public-need";
const legacyKeys = ["matricia.public-need.fr", "matricia.public-need.ar"];
const retentionMs = 7 * 86_400_000;
const tagCatalog = {
  fr: ["Stratégie", "Management", "Transformation digitale", "Conformité", "Formation", "Maroc"],
  ar: ["استراتيجية", "تدبير", "تحول رقمي", "امتثال", "تكوين", "المغرب"],
} as const;

const blank = (initialNeed = "", classification: PublicNeedClassification | null = null): Draft => ({
  version: 3,
  step: 0,
  need: initialNeed,
  location: "",
  timing: "",
  constraints: "",
  tags: [],
  unlisted: false,
  classification,
  categoryCode: "",
  confirmed: false,
  answers: {},
  expiresAt: Date.now() + retentionMs,
});
const unavailable = async (): Promise<SaveNeedState> => ({ status: "error", reason: "UNAVAILABLE" });

export function needComposerSection(step: number) {
  return needStageForStep(step);
}

export function needProgressPercent(stageCurrent: number, stageTotal: number) {
  if (stageTotal < 1 || stageCurrent < 0) return 0;
  return Math.trunc((Math.min(stageCurrent, stageTotal) * 100) / stageTotal);
}

function NeedStageProgress({
  authenticated,
  stageCurrent,
  stageTotal,
}: {
  authenticated: boolean;
  stageCurrent: number;
  stageTotal: number;
}) {
  const percent = needProgressPercent(stageCurrent, stageTotal);
  return (
    <div
      className={authenticated ? "client-progress" : "journey-progressbar"}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={stageTotal}
      aria-valuenow={stageCurrent}
      aria-label={`${stageCurrent}/${stageTotal}`}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0 && item.length <= 80).slice(0, 12);
}

function asAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const answers: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[A-Za-z][A-Za-z0-9_.-]{1,159}$/u.test(key) || typeof item !== "string" || item.length > 1200) continue;
    answers[key] = item;
    if (Object.keys(answers).length >= 20) break;
  }
  return answers;
}

export function parseNeedDraft(
  raw: string | null,
  locale: Locale,
  initialNeed = "",
  initialClassification: PublicNeedClassification | null = null,
  now = Date.now(),
): { draft: Draft | null; status: "empty" | "valid" | "expired" | "invalid" } {
  if (!raw) return { draft: null, status: "empty" };
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (typeof value.expiresAt !== "number") return { draft: null, status: "invalid" };
    if (value.expiresAt <= now) return { draft: null, status: "expired" };
    const fields = [value.need, value.location, value.timing, value.constraints];
    if (fields.some((item) => typeof item !== "string" || item.length > 1200)) return { draft: null, status: "invalid" };
    const storedClassification =
      (value.version === 3 || value.version === 4) && value.classification
        ? canonicalizePublicNeedClassification(value.classification as { libraryCode?: unknown; serviceCode?: unknown }, locale)
        : null;
    if ((value.version === 3 || value.version === 4) && value.classification && !storedClassification) return { draft: null, status: "invalid" };
    const classification = initialClassification ?? storedClassification;
    const classificationChanged = Boolean(initialClassification) && JSON.stringify(initialClassification) !== JSON.stringify(storedClassification);
    return {
      status: "valid",
      draft: {
        version: 3,
        step: Math.min(needRecapStep, Math.max(0, Number.isInteger(value.step) ? (value.step as number) : 0)),
        need: (value.need as string) || initialNeed,
        location: value.location as string,
        timing: value.timing as string,
        constraints: value.constraints as string,
        tags: asStringArray(value.tags),
        unlisted: value.unlisted === true,
        classification,
        categoryCode: typeof value.categoryCode === "string" ? value.categoryCode.slice(0, 40) : "",
        confirmed: classificationChanged ? false : value.confirmed === true,
        answers: asAnswers(value.answers),
        expiresAt: value.expiresAt,
      },
    };
  } catch {
    return { draft: null, status: "invalid" };
  }
}

export function NeedFlow({
  locale,
  initialNeed = "",
  initialClassification = null,
  invalidSelection = false,
  authenticated = false,
  organizations = [],
  saveAction,
  discoverAction,
}: {
  locale: Locale;
  initialNeed?: string;
  initialClassification?: PublicNeedClassification | null;
  invalidSelection?: boolean;
  authenticated?: boolean;
  organizations?: Organization[];
  saveAction?: (state: SaveNeedState, data: FormData) => Promise<SaveNeedState>;
  discoverAction?: DiscoverAction;
}) {
  const copy = getPublicJourneyCopy(locale).need;
  const [draft, setDraft] = useState<Draft>(() => blank(initialNeed, initialClassification));
  const [loaded, setLoaded] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [storageNotice, setStorageNotice] = useState<"expired" | "invalid" | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        let parsed = parseNeedDraft(window.localStorage.getItem(storageKey), locale, initialNeed, initialClassification);
        if (!parsed.draft) {
          for (const key of legacyKeys) {
            const legacy = parseNeedDraft(window.localStorage.getItem(key), locale, initialNeed, initialClassification);
            if (legacy.draft) {
              parsed = legacy;
              break;
            }
            if (legacy.status !== "empty") parsed = legacy;
          }
        }
        setStorageNotice(parsed.status === "expired" || parsed.status === "invalid" ? parsed.status : null);
        setDraft(parsed.draft ?? blank(initialNeed, initialClassification));
      } catch {
        setStorageAvailable(false);
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialClassification, initialNeed, locale]);

  useEffect(() => {
    if (!loaded || !storageAvailable) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      window.setTimeout(() => setStorageAvailable(false), 0);
    }
  }, [draft, loaded, storageAvailable]);

  const erase = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
      for (const key of legacyKeys) window.localStorage.removeItem(key);
    } catch {
      setStorageAvailable(false);
    }
  }, []);

  const goRecap = useCallback(() => {
    setDraft((current) => ({ ...current, step: needRecapStep, confirmed: false, expiresAt: Date.now() + retentionMs }));
  }, []);

  if (!loaded) {
    return (
      <main id="contenu-principal" className="journey-shell" dir={locale === "ar" ? "rtl" : "ltr"} aria-busy="true">
        <section className="journey-card">
          <p className="journey-eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <NeedStageProgress authenticated={authenticated} stageCurrent={1} stageTotal={needStageIds.length} />
          <p role="status">{locale === "fr" ? "Reprise de votre brouillon…" : "جارٍ استعادة مسودتكم…"}</p>
        </section>
      </main>
    );
  }

  if (draft.step >= needRecapStep) {
    return (
      <NeedResult
        locale={locale}
        draft={draft}
        authenticated={authenticated}
        organizations={organizations}
        saveAction={saveAction}
        storageAvailable={storageAvailable}
        storageNotice={storageNotice}
        invalidSelection={invalidSelection}
        erase={erase}
        edit={() => setDraft((current) => ({ ...current, step: 0, confirmed: false }))}
        back={() => setDraft((current) => ({ ...current, step: needRecapStep - 1, confirmed: false }))}
        confirm={() => setDraft((current) => ({ ...current, confirmed: true, expiresAt: Date.now() + retentionMs }))}
        updateClassification={(classification) =>
          setDraft((current) => ({ ...current, classification, confirmed: false, expiresAt: Date.now() + retentionMs }))
        }
      />
    );
  }

  return (
    <NeedComposer
      locale={locale}
      draft={draft}
      setDraft={setDraft}
      storageNotice={storageNotice}
      storageAvailable={storageAvailable}
      invalidSelection={invalidSelection}
      authenticated={authenticated}
      organizations={organizations}
      discoverAction={discoverAction}
      goRecap={goRecap}
    />
  );
}

export function NeedComposer({
  locale,
  draft,
  setDraft,
  storageNotice,
  storageAvailable,
  invalidSelection,
  authenticated,
  organizations = [],
  discoverAction,
  goRecap,
}: {
  locale: Locale;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  storageNotice: "expired" | "invalid" | null;
  storageAvailable: boolean;
  invalidSelection: boolean;
  authenticated: boolean;
  organizations?: Organization[];
  discoverAction?: DiscoverAction;
  goRecap: () => void;
}) {
  const copy = getPublicJourneyCopy(locale).need;
  const taxonomy = useMemo(() => getPublicProviderTaxonomy(locale), [locale]);
  const [customTag, setCustomTag] = useState("");
  const [selectedOrganizationId, setOrganizationId] = useState("");
  const organizationId = organizations.some((item) => item.id === selectedOrganizationId) ? selectedOrganizationId : organizations[0]?.id ?? "";
  const discoveryText = draft.need.trim();
  const discoveryKey = JSON.stringify([locale, organizationId, discoveryText]);
  const canDiscover = authenticated && Boolean(discoverAction) && Boolean(organizationId) && discoveryText.length >= 10;
  const [discoveryResult, setDiscoveryResult] = useState<{ key: string; value: NeedDiscovery | null } | null>(null);
  const discovery = canDiscover && discoveryResult?.key === discoveryKey ? discoveryResult.value : null;
  const discovering = canDiscover && discoveryResult?.key !== discoveryKey;
  const tooShort = draft.need.length > 0 && draft.need.trim().length < 10;
  const canContinue = draft.need.trim().length >= 10;
  const libraryCode = draft.classification?.libraryCode ?? "";
  const library = taxonomy.libraries.find((item) => item.code === libraryCode);
  const categories = library?.categories ?? [];
  const services = categories.find((item) => item.code === draft.categoryCode)?.services ?? library?.categories.flatMap((item) => item.services) ?? [];
  const tags = tagCatalog[locale];
  const localSuggestions = useMemo(
    () => (draft.need.trim().length >= 10 ? rankPublicNeedServices(draft.need, locale, 5) : []),
    [draft.need, locale],
  );
  const suggestions = discovery?.services.length ? discovery.services : localSuggestions;
  const selectedServiceId = discovery?.services.find((item) => item.serviceCode === draft.classification?.serviceCode)?.serviceId;
  const missingQuestions = (discovery?.questions ?? []).filter((item) => !selectedServiceId || item.serviceId === selectedServiceId);
  const unansweredRequired = missingQuestions.filter((item) => item.requiredForQuote && !draft.answers[item.dataKey]?.trim() && !["FILE", "MULTI_FILE", "IMAGE", "TABLE", "REPEATER"].includes(item.answerType));
  const section = needComposerSection(draft.step);
  const stages = getNeedStages(locale);
  const stageIndex = stages.findIndex((stage) => stage.id === section);
  const stageTotal = stages.length;
  const stageCurrent = stageIndex + 1;
  const missing = [
    draft.need.trim() ? null : locale === "ar" ? "وصف الاحتياج" : "Description du besoin",
    draft.classification || draft.unlisted ? null : locale === "ar" ? "المجال أو الخدمة" : "Domaine ou service",
    unansweredRequired.length ? unansweredRequired.map((item) => item.label).join(" · ") : null,
    draft.location.trim() || draft.timing.trim() || draft.constraints.trim() || draft.tags.length ? null : locale === "ar" ? "تفاصيل تكميلية" : "Précisions complémentaires",
  ].filter(Boolean);

  useEffect(() => {
    if (!canDiscover || !discoverAction) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void discoverAction({ locale, organizationId, inputText: discoveryText }).then((result) => {
        if (cancelled) return;
        const value = result.status === "success" ? result.value : null;
        setDiscoveryResult({ key: discoveryKey, value });
        if (!value) return;
        setDraft((current) => {
          const answers = { ...current.answers };
          let changed = false;
          let location = current.location;
          if (!location.trim() && value.locationPrefill) {
            location = value.locationPrefill;
            changed = true;
          }
          for (const question of value.questions) {
            if (question.prefill && !answers[question.dataKey]) {
              answers[question.dataKey] = question.prefill.value;
              changed = true;
            }
          }
          return changed ? { ...current, answers, location, expiresAt: Date.now() + retentionMs } : current;
        });
      }).catch(() => {
        if (!cancelled) setDiscoveryResult({ key: discoveryKey, value: null });
      });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canDiscover, discoverAction, discoveryKey, discoveryText, locale, organizationId, setDraft]);

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next, confirmed: false, expiresAt: Date.now() + retentionMs }));
  }

  function confirmSuggestion(library: string, serviceCode: string) {
    const classification = canonicalizePublicNeedClassification({ libraryCode: library, serviceCode }, locale);
    if (!classification) return;
    patch({ classification, categoryCode: "" });
  }

  function setLibrary(code: string) {
    if (!code) {
      patch({ classification: null, categoryCode: "" });
      return;
    }
    patch({ classification: canonicalizePublicNeedClassification({ libraryCode: code, serviceCode: null }, locale), categoryCode: "" });
  }

  function setCategory(code: string) {
    patch({ categoryCode: code, classification: canonicalizePublicNeedClassification({ libraryCode, serviceCode: null }, locale) });
  }

  function setService(code: string) {
    if (!libraryCode) return;
    patch({ classification: canonicalizePublicNeedClassification({ libraryCode, serviceCode: code || null }, locale) });
  }

  function toggleTag(tag: string) {
    patch({ tags: draft.tags.includes(tag) ? draft.tags.filter((item) => item !== tag) : [...draft.tags, tag].slice(0, 12) });
  }

  function addCustomTag() {
    const value = customTag.trim().slice(0, 80);
    if (!value) return;
    patch({ tags: draft.tags.includes(value) ? draft.tags : [...draft.tags, value].slice(0, 12) });
    setCustomTag("");
  }

  function setAnswer(dataKey: string, value: string) {
    patch({ answers: { ...draft.answers, [dataKey]: value.slice(0, 1200) } });
  }

  function continueToNextStep() {
    if (needStageForStep(draft.step + 1) === "recap") goRecap();
    else patch({ step: draft.step + 1 });
  }
  const continueLabel = needStageForStep(draft.step + 1) === "recap"
    ? locale === "fr" ? "Voir le récapitulatif" : "عرض الملخص"
    : copy.continue;

  return (
    <main id="contenu-principal" className={authenticated ? "client-page client-need-shell" : "journey-shell"} dir={locale === "ar" ? "rtl" : "ltr"}>
      {authenticated ? null : (
        <p className="public-wrap">
          <Link className="journey-known" href={`/${locale}`}>
            {copy.back}
          </Link>
        </p>
      )}
      <div className="journey-need">
        <section className={authenticated ? "client-card" : "journey-card"}>
          {authenticated ? null : <p className="journey-eyebrow">{copy.eyebrow}</p>}
          {invalidSelection ? (
            <p role="status" className="journey-field-help">
              {locale === "fr"
                ? "La sélection de service n’était pas valide. Décrivez votre besoin pour continuer."
                : "اختيار الخدمة غير صالح. صف احتياجك للمتابعة."}
            </p>
          ) : null}
          {storageNotice ? (
            <p role="status" className="journey-field-help">
              {storageNotice === "expired"
                ? locale === "fr"
                  ? "L’ancien brouillon avait expiré ; un nouveau parcours a commencé."
                  : "انتهت صلاحية المسودة السابقة؛ بدأت مسودة جديدة."
                : locale === "fr"
                  ? "L’ancien brouillon était illisible ; un nouveau parcours a commencé."
                  : "تعذرت قراءة المسودة السابقة؛ بدأت مسودة جديدة."}
            </p>
          ) : null}
          {authenticated ? null : <h1>{copy.title}</h1>}
          {authenticated ? null : <p className="journey-intro">{copy.intro}</p>}
          <ol className="journey-need-stages" aria-label={copy.title}>
            {stages.map(({ id, title, detail }, index) => (
              <li key={id} aria-current={index === stageIndex ? "step" : undefined} data-state={index === stageIndex ? "current" : index < stageIndex ? "done" : "todo"}>
                <span>{index + 1}</span>
                <strong>{title}</strong>
                <em>{detail}</em>
              </li>
            ))}
          </ol>
          <NeedStageProgress authenticated={authenticated} stageCurrent={stageCurrent} stageTotal={stageTotal} />
          <h2 id="need-step-title">{stageCurrent}. {stages[stageIndex]!.title}</h2>
          {section === "describe" ? (
          <>
          <p id="need-help" className="journey-intro">{copy.help}</p>
          <textarea
            aria-labelledby="need-step-title"
            aria-describedby={["need-help", "need-example", tooShort ? "need-guidance" : null].filter(Boolean).join(" ")}
            className="journey-textarea"
            autoFocus
            value={draft.need}
            onChange={(event) => patch({ need: event.target.value.slice(0, 1000) })}
            rows={5}
            maxLength={1000}
            placeholder={copy.placeholder}
          />
          <p className="journey-charcount">{draft.need.length}/1000</p>
          <p id="need-example" className="journey-field-help">
            {locale === "fr" ? "Ex. : Contexte, objectifs, livrables attendus, délais, budget indicatif, informations utiles…" : "مثال: السياق، الأهداف، المخرجات، الآجال، الميزانية الإرشادية…"}
          </p>
          <p id="need-guidance" role={tooShort ? "status" : undefined} className="journey-field-help">
            {tooShort ? (locale === "fr" ? "Décrivez votre besoin en au moins 10 caractères." : "صف حاجتك في 10 أحرف على الأقل.") : ""}
          </p>
          {authenticated && organizations.length > 1 ? (
            <label>
              {locale === "fr" ? "Entreprise concernée" : "المؤسسة المعنية"}
              <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          </>
          ) : null}

          {section === "understand" ? (
          <>
          <p className="public-muted">{copy.suggestLead}</p>
          {locale === "ar" ? <p className="journey-field-help" role="note">{publicCatalogueTranslationNotice.ar}</p> : null}
          {discovering ? <p role="status" className="journey-field-help">{copy.discovering}</p> : null}
          {canContinue && !suggestions.length && !discovering ? <p className="journey-field-help">{copy.suggestEmpty}</p> : null}
          {suggestions.length ? (
            <ul className="journey-need-candidates">
              {suggestions.map((item) => (
                <li key={item.serviceCode}>
                  <button type="button" aria-pressed={draft.classification?.serviceCode === item.serviceCode} onClick={() => confirmSuggestion(item.libraryCode, item.serviceCode)}>
                    <strong lang={locale}>{item.serviceName}</strong>
                    <small>{item.libraryName} · {copy.suggestScore} {formatNeedScoreBasisPoints(item.scoreBasisPoints, locale)}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {discovery?.knownCount ? (
            <p className="journey-need-prefill">{discovery.knownCount} {copy.knownCount}</p>
          ) : null}

          <h2>{locale === "ar" ? "أو اختاروا يدوياً مجالاً وفئة وخدمة" : "Ou choisissez manuellement un domaine, une catégorie et un service"}</h2>
          <p className="public-muted">{locale === "ar" ? "تقترح الاقتراحات وفق وصفكم." : "Nos suggestions s’adaptent à votre description."}</p>
          <div className="journey-need-taxonomy">
            <label>
              {locale === "ar" ? "المجال" : "Domaine"}
              <select id="need-library" value={libraryCode} onChange={(event) => setLibrary(event.target.value)}>
                <option value="">{locale === "ar" ? "اختيار مجال…" : "Choisir un domaine…"}</option>
                {taxonomy.libraries.map((item) => (
                  <option key={item.code} value={item.code}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              {locale === "ar" ? "الفئة" : "Catégorie"}
              <select id="need-category" value={draft.categoryCode} onChange={(event) => setCategory(event.target.value)} disabled={!libraryCode}>
                <option value="">{locale === "ar" ? "اختيار فئة…" : "Choisir une catégorie…"}</option>
                {categories.map((item) => (
                  <option key={item.code} value={item.code} lang={locale}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              {locale === "ar" ? "الخدمة" : "Service"}
              <select id="need-service" value={draft.classification?.serviceCode ?? ""} onChange={(event) => setService(event.target.value)} disabled={!libraryCode}>
                <option value="">{locale === "ar" ? "اختيار خدمة…" : "Choisir un service…"}</option>
                {services.map((item) => (
                  <option key={item.code} value={item.code} lang={locale}>{item.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="journey-need-unlisted">
            <input type="checkbox" checked={draft.unlisted} onChange={(event) => patch({ unlisted: event.target.checked })} />
            <span>
              <strong>{locale === "ar" ? "خدمة غير مدرجة" : "Service non répertorié"}</strong>
              <em>{locale === "ar" ? "إن لم تجدوا الخدمة المقترحة، يمكنكم وصفها في الخطوات التالية." : "Si aucun service ne correspond, vous pourrez le préciser dans les étapes suivantes."}</em>
            </span>
          </label>
          </>
          ) : null}

          {section === "questions" ? (
          <>
          <p className="public-muted">{copy.questionsLead}</p>
          {!draft.classification && !draft.unlisted ? <p className="journey-field-help">{copy.questionsWait}</p> : null}
          {draft.classification || draft.unlisted ? (
            <div className="journey-need-questions">
              {missingQuestions.map((question) => {
                const value = draft.answers[question.dataKey] ?? "";
                const fileType = ["FILE", "MULTI_FILE", "IMAGE", "TABLE", "REPEATER"].includes(question.answerType);
                const fieldId = `need-q-${question.questionVersionId}`;
                return (
                  <label key={question.questionVersionId} htmlFor={fieldId}>
                    {question.label}{question.requiredForQuote ? " *" : ""}
                    {question.help ? <em className="journey-field-help">{question.help}</em> : null}
                    {question.prefill ? <span className="journey-need-prefill">{copy.knownPrefill}</span> : null}
                    {fileType ? (
                      <p id={fieldId} className="journey-field-help">{copy.docsStepLead}</p>
                    ) : question.answerType === "YES_NO" ? (
                      <select id={fieldId} value={value} onChange={(event) => setAnswer(question.dataKey, event.target.value)}>
                        <option value="">{copy.optional}</option>
                        <option value="true">{locale === "fr" ? "Oui" : "نعم"}</option>
                        <option value="false">{locale === "fr" ? "Non" : "لا"}</option>
                      </select>
                    ) : question.answerType === "SINGLE_CHOICE" && question.options.length ? (
                      <select id={fieldId} value={value} onChange={(event) => setAnswer(question.dataKey, event.target.value)}>
                        <option value="">{copy.optional}</option>
                        {question.options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : question.answerType === "LONG_TEXT" ? (
                      <textarea id={fieldId} value={value} rows={3} maxLength={1200} onChange={(event) => setAnswer(question.dataKey, event.target.value)} />
                    ) : (
                      <input id={fieldId} value={value} maxLength={1200} onChange={(event) => setAnswer(question.dataKey, event.target.value)} />
                    )}
                  </label>
                );
              })}
              <label htmlFor="need-location">{copy.location}<input id="need-location" value={draft.location} maxLength={1200} onChange={(event) => patch({ location: event.target.value.slice(0, 1200) })} />{discovery?.locationPrefill && draft.location === discovery.locationPrefill ? <span className="journey-need-prefill">{copy.knownPrefill}</span> : null}</label>
              <label htmlFor="need-timing">{copy.timing}<input id="need-timing" value={draft.timing} maxLength={1200} onChange={(event) => patch({ timing: event.target.value.slice(0, 1200) })} /></label>
              <label htmlFor="need-constraints">{copy.constraints}<textarea id="need-constraints" value={draft.constraints} rows={3} maxLength={1200} onChange={(event) => patch({ constraints: event.target.value.slice(0, 1200) })} /></label>
            </div>
          ) : null}
          </>
          ) : null}

          {section === "complete" ? (
          <>
          <h3>{locale === "ar" ? "عناصر تكميلية (اختياري)" : "Sélectionnez des éléments complémentaires (optionnel)"}</h3>
          <div className="journey-need-tags">
            {tags.map((tag) => (
              <button key={tag} type="button" className={draft.tags.includes(tag) ? "is-selected" : undefined} aria-pressed={draft.tags.includes(tag)} onClick={() => toggleTag(tag)}>
                {tag} <Plus size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="journey-need-add">
            <label htmlFor="need-custom-tag">{locale === "ar" ? "إضافة عنصر" : "Ajouter un élément"}</label>
            <input id="need-custom-tag" value={customTag} maxLength={80} onChange={(event) => setCustomTag(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomTag(); } }} />
            <button type="button" onClick={addCustomTag}>{locale === "ar" ? "إضافة" : "Ajouter"}</button>
          </div>
          <h3>{copy.docsStepTitle}</h3>
          <p className="journey-intro">{copy.docsStepLead}</p>
          {authenticated ? <Link className="client-text-link" href={`/${locale}/client/documents`}>{locale === "fr" ? "Ouvrir Documents" : "فتح الوثائق"}</Link> : null}
          <p className="journey-login-note">
            {storageAvailable
              ? locale === "fr" ? "Brouillon enregistré automatiquement · il y a quelques secondes" : "تُحفظ المسودة تلقائياً · منذ لحظات"
              : locale === "fr" ? "Ce brouillon n’est pas sauvegardé sur cet appareil." : "هذه المسودة غير محفوظة على هذا الجهاز."}
          </p>
          <p className="journey-field-help">{copy.humanConfirm}</p>
          </>
          ) : null}
          <div className="journey-actions">
            {section === "describe" ? (
              <Link className="journey-secondary" href={authenticated ? `/${locale}/client/demandes` : `/${locale}`}>{copy.back}</Link>
            ) : (
              <button className="journey-secondary" type="button" onClick={() => patch({ step: Math.max(0, draft.step - 1) })}>{copy.back}</button>
            )}
            <button className="journey-secondary" type="button" onClick={() => patch({})}>{copy.saveDraft}</button>
            <button className="journey-primary" type="button" disabled={section === "describe" && !canContinue} onClick={continueToNextStep}>
              {continueLabel}
              <ArrowRight className="rtl-mirror" size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
        {section === "describe" ? null : <aside className="journey-understood" aria-live="polite">
          <p className="journey-eyebrow">{copy.understoodTitle}</p>
          <h2>{copy.readyTitle}</h2>
          <p className="public-muted">{copy.understoodLead}</p>
          <dl>
            <div>
              <dt>{locale === "ar" ? "هدف المشروع" : "Objectif du projet"}</dt>
              <dd>{draft.need.trim() || "—"}</dd>
            </div>
            <div>
              <dt>{locale === "ar" ? "المخرجات المتوقعة" : "Livrables attendus"}</dt>
              <dd>{draft.classification?.serviceName ?? (draft.tags[0] || "—")}</dd>
            </div>
            <div>
              <dt>{locale === "ar" ? "القيود المحددة" : "Contraintes identifiées"}</dt>
              <dd>{draft.tags.join(" · ") || draft.constraints.trim() || "—"}</dd>
            </div>
            <div className="is-missing">
              <dt>{locale === "ar" ? "معلومات ناقصة" : "Informations manquantes"}</dt>
              <dd>{missing.length ? missing.join(" · ") : "—"}</dd>
            </div>
          </dl>
          <div className="journey-actions">
            <button className="journey-secondary" type="button" onClick={() => patch({ step: 0, confirmed: false })}>
              <Pencil size={16} aria-hidden="true" /> {locale === "fr" ? "Modifier" : "تعديل"}
            </button>
            <button className="journey-primary" type="button" disabled={!canContinue} onClick={continueToNextStep}>
              {continueLabel}
            </button>
          </div>
        </aside>}
      </div>
    </main>
  );
}

export function NeedResult({
  locale,
  draft,
  authenticated,
  organizations,
  saveAction,
  storageAvailable,
  storageNotice,
  invalidSelection,
  erase,
  edit,
  back = edit,
  confirm,
  updateClassification,
}: {
  locale: Locale;
  draft: Draft;
  authenticated: boolean;
  organizations: Organization[];
  saveAction?: (state: SaveNeedState, data: FormData) => Promise<SaveNeedState>;
  storageAvailable: boolean;
  storageNotice: "expired" | "invalid" | null;
  invalidSelection: boolean;
  erase: () => void;
  edit: () => void;
  back?: () => void;
  confirm: () => void;
  updateClassification: (classification: PublicNeedClassification | null) => void;
}) {
  const copy = getPublicJourneyCopy(locale).need;
  const stages = getNeedStages(locale);
  const [state, action, pending] = useActionState(saveAction ?? unavailable, { status: "idle" } as SaveNeedState);
  useEffect(() => {
    if (state.status === "success") erase();
  }, [state.status, erase]);
  const next = `/${locale}/besoin?resume=1`;
  const taxonomy = useMemo(() => getPublicProviderTaxonomy(locale), [locale]);
  const libraryCode = draft.classification?.libraryCode ?? "";
  const services = useMemo(() => {
    const library = taxonomy.libraries.find((item) => item.code === libraryCode);
    return library?.categories.flatMap((category) => category.services) ?? [];
  }, [libraryCode, taxonomy.libraries]);
  const labels = locale === "ar"
    ? { domain: "المجال", service: "الخدمة", none: "بدون خدمة محددة", clear: "مسح التصنيف", understood: "هذا ما فهمته ماتريسيا — يمكنكم التعديل قبل التأكيد" }
    : { domain: "Domaine", service: "Service", none: "Sans service précis", clear: "Effacer la classification", understood: "Voici ce que Matricia a compris — modifiable avant confirmation" };
  const extraConstraints = [
    draft.constraints,
    draft.tags.join(", "),
    draft.unlisted ? (locale === "fr" ? "Service non répertorié" : "خدمة غير مدرجة") : "",
    ...Object.entries(draft.answers).filter(([, value]) => value.trim()).map(([key, value]) => `${key}: ${value}`),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1200);

  function setLibrary(code: string) {
    if (!code) {
      updateClassification(null);
      return;
    }
    updateClassification(canonicalizePublicNeedClassification({ libraryCode: code, serviceCode: null }, locale));
  }

  function setService(code: string) {
    if (!libraryCode) return;
    updateClassification(canonicalizePublicNeedClassification({ libraryCode, serviceCode: code || null }, locale));
  }

  return (
    <main id="contenu-principal" className={authenticated ? "client-page client-need-shell" : "journey-shell"} dir={locale === "ar" ? "rtl" : "ltr"}>
      <section className={authenticated ? "client-card journey-result" : "journey-card journey-result"}>
        {authenticated ? null : <p className="journey-eyebrow">{copy.eyebrow}</p>}
        <ol className="journey-need-stages" aria-label={copy.connectedTitle}>
          {stages.map(({ id, title, detail }, index) => (
            <li key={id} aria-current={id === "recap" ? "step" : undefined} data-state={id === "recap" ? "current" : "done"}>
              <span>{index + 1}</span>
              <strong>{title}</strong>
              <em>{detail}</em>
            </li>
          ))}
        </ol>
        <NeedStageProgress authenticated={authenticated} stageCurrent={needRecapStep + 1} stageTotal={stages.length} />
        <h1>{copy.readyTitle}</h1>
        <h2>{needRecapStep + 1}. {stages[needRecapStep]!.title}</h2>
        <p className="journey-intro">{copy.readyText}</p>
        <p className="journey-field-help">{labels.understood}</p>
        {locale === "ar" ? <p className="journey-field-help" role="note">{publicCatalogueTranslationNotice.ar}</p> : null}
        <div className="grid gap-3 rounded-xl border bg-blue-50 p-4">
          <label className="grid gap-2">
            <strong>{labels.domain}</strong>
            <select className="min-h-11 rounded-md border bg-white px-3" value={libraryCode} onChange={(event) => setLibrary(event.target.value)} disabled={draft.confirmed && authenticated}>
              <option value="">{locale === "ar" ? "غير محدد" : "Non précisé"}</option>
              {taxonomy.libraries.map((library) => (
                <option key={library.code} value={library.code}>{library.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <strong>{labels.service}</strong>
            <select className="min-h-11 rounded-md border bg-white px-3" value={draft.classification?.serviceCode ?? ""} onChange={(event) => setService(event.target.value)} disabled={!libraryCode || (draft.confirmed && authenticated)}>
              <option value="">{labels.none}</option>
              {services.map((service) => (
                <option key={service.code} value={service.code} lang={locale}>{service.name}</option>
              ))}
            </select>
          </label>
          {draft.classification ? (
            <button type="button" className="justify-self-start text-sm font-semibold text-blue-800 underline" onClick={() => updateClassification(null)} disabled={draft.confirmed && authenticated}>
              {labels.clear}
            </button>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-3 rounded-xl border bg-white p-4">
          <div>
            <dt className="font-semibold">{copy.prompt}</dt>
            <dd>{draft.need}</dd>
          </div>
          {draft.tags.length ? (
            <div>
              <dt className="font-semibold">{locale === "fr" ? "Éléments complémentaires" : "عناصر تكميلية"}</dt>
              <dd>{draft.tags.join(" · ")}</dd>
            </div>
          ) : null}
          {Object.entries(draft.answers)
            .filter(([, value]) => value.trim())
            .map(([key, value]) => (
              <div key={key}>
                <dt className="font-semibold">{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          {(["location", "timing", "constraints"] as const)
            .filter((key) => draft[key])
            .map((key) => (
              <div key={key}>
                <dt className="font-semibold">{copy[key]}</dt>
                <dd>{draft[key]}</dd>
              </div>
            ))}
        </dl>
        {invalidSelection ? (
          <p role="status" className="journey-login-note">
            {locale === "fr"
              ? "La sélection initiale a été ignorée car elle ne correspondait pas au référentiel Matricia."
              : "تم تجاهل الاختيار الأولي لأنه لا يطابق مرجع Matricia."}
          </p>
        ) : null}
        {storageNotice ? (
          <p role="status" className="journey-login-note">
            {locale === "fr"
              ? "Un nouveau brouillon a remplacé une ancienne sauvegarde invalide ou expirée."
              : "حلت مسودة جديدة محل حفظ سابق غير صالح أو منتهي الصلاحية."}
          </p>
        ) : null}
        {!storageAvailable ? (
          <p role="status" className="journey-login-note">
            {locale === "fr" ? "Ce brouillon n’est pas sauvegardé sur cet appareil." : "هذه المسودة غير محفوظة على هذا الجهاز."}
          </p>
        ) : null}
        {!draft.confirmed ? (
          <div className="journey-actions">
            <button className="journey-secondary" type="button" onClick={back}>{copy.back}</button>
            <button className="journey-secondary" type="button" onClick={edit}>{locale === "fr" ? "Modifier" : "تعديل"}</button>
            <button className="journey-primary" type="button" onClick={confirm}>
              {locale === "fr" ? "Valider" : "تأكيد"}
              <ArrowRight className="rtl-mirror" size={18} aria-hidden="true" />
            </button>
          </div>
        ) : !authenticated ? (
          <>
            <p className="journey-login-note">{copy.localOnly}</p>
            <div className="journey-actions">
              <button className="journey-secondary" type="button" onClick={edit}>{locale === "fr" ? "Modifier" : "تعديل"}</button>
              <Link className="journey-primary" href={`/${locale}/connexion?next=${encodeURIComponent(next)}`}>
                {copy.login}
                <ArrowRight className="rtl-mirror" size={18} aria-hidden="true" />
              </Link>
            </div>
          </>
        ) : organizations.length && saveAction ? (
          <form action={action} className="journey-login-note">
            <input type="hidden" name="locale" value={locale} />
            <input
              type="hidden"
              name="payload"
              value={JSON.stringify({
                need: draft.need,
                location: draft.location,
                timing: draft.timing,
                constraints: extraConstraints,
                classification: draft.classification
                  ? { libraryCode: draft.classification.libraryCode, serviceCode: draft.classification.serviceCode }
                  : null,
              })}
            />
            {organizations.length === 1 ? (
              <input type="hidden" name="organizationId" value={organizations[0]!.id} />
            ) : (
              <label className="grid gap-2">
                <strong>{locale === "fr" ? "Entreprise concernée" : "المؤسسة المعنية"}</strong>
                <select name="organizationId" required className="min-h-11 rounded-md border bg-white px-3">
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </label>
            )}
            {state.status === "error" ? (
              <p role="alert" className="mt-3 text-red-700">
                {state.reason === "FORBIDDEN"
                  ? locale === "fr" ? "Vous n’avez plus l’autorisation pour cette entreprise." : "لم يعد لديكم إذن لهذه المؤسسة."
                  : locale === "fr" ? "L’enregistrement a échoué ; votre brouillon est conservé." : "تعذر الحفظ؛ تم الاحتفاظ بالمسودة."}
              </p>
            ) : null}
            {state.status === "success" ? (
              <p role="status" className="mt-3">
                <CheckCircle2 className="inline" size={18} aria-hidden="true" /> {copy.accountSaved}{" "}
                {draft.classification?.serviceCode ? (
                  <Link className="font-semibold underline" href={publicNeedRequestHref(locale, state.intakeId, draft.classification.serviceCode)}>{copy.createRequest}</Link>
                ) : (
                  <Link className="font-semibold underline" href={`/${locale}/client/demandes`}>{copy.seeRequests}</Link>
                )}
              </p>
            ) : (
              <div className="journey-actions mt-4">
                <button className="journey-secondary" type="button" onClick={edit}>{locale === "fr" ? "Modifier" : "تعديل"}</button>
                <button type="submit" className="journey-primary" disabled={pending}>
                  {pending ? (locale === "fr" ? "Enregistrement…" : "جارٍ الحفظ…") : locale === "fr" ? "Enregistrer ce besoin" : "حفظ هذا الاحتياج"}
                </button>
              </div>
            )}
          </form>
        ) : (
          <p className="journey-login-note">{locale === "fr" ? "Aucune organisation Client autorisée n’est disponible." : "لا توجد مؤسسة عميلة مخولة."}</p>
        )}
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-600">
          <ShieldCheck size={16} aria-hidden="true" />
          {locale === "fr" ? "Vos informations sont confidentielles et sécurisées." : "معلوماتكم سرية ومؤمّنة."}
        </p>
      </section>
    </main>
  );
}
