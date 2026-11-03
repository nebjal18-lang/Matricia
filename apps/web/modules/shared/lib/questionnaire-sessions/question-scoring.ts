const SCALE = 1_000_000n;
const SCORE = /^(0|[1-9]\d{0,13})(\.\d{1,6})?$/u;
const CHOICE = new Set(["SINGLE_CHOICE", "MULTIPLE_CHOICE"]);

export type QuestionChoice = { value: string; labelFr: string; labelAr: string };
export type ScoredChoice = QuestionChoice & { score: string };

export function parseScore(value: unknown): bigint | null {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!SCORE.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
}

export function formatScore(value: bigint): string {
  const whole = value / SCALE;
  const fraction = (value % SCALE).toString().padStart(6, "0").replace(/0+$/u, "");
  return fraction ? `${whole}.${fraction}` : `${whole.toString()}`;
}

export function toQuestionChoices(options: unknown): QuestionChoice[] {
  if (!Array.isArray(options)) return [];
  return options.flatMap((item, index) => {
    if (typeof item === "string" && item.trim()) {
      const label = item.trim();
      return [{ value: label, labelFr: label, labelAr: label }];
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const value = typeof record.value === "string" ? record.value.trim() : "";
    const labelFr = typeof record.label_fr === "string" ? record.label_fr.trim() : "";
    const labelAr = typeof record.label_ar === "string" ? record.label_ar.trim() : "";
    if (!value || !labelFr || !labelAr) return [];
    return [{ value, labelFr, labelAr }];
  }).slice(0, 1000).filter((item, index, all) => all.findIndex((candidate) => candidate.value === item.value) === index && index >= 0);
}

export function scoredChoices(options: unknown): ScoredChoice[] {
  if (!Array.isArray(options)) return [];
  return options.map((item, index) => {
    if (typeof item === "string") {
      const label = item.trim();
      return { value: `OPT_${index + 1}`, labelFr: label, labelAr: label, score: "" };
    }
    const record = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
    const parsed = parseScore(record.score);
    return {
      value: typeof record.value === "string" && record.value.trim() ? record.value.trim() : `OPT_${index + 1}`,
      labelFr: typeof record.label_fr === "string" ? record.label_fr : "",
      labelAr: typeof record.label_ar === "string" ? record.label_ar : "",
      score: parsed === null ? "" : formatScore(parsed),
    };
  }).slice(0, 100);
}

export function weightedPercentage(items: { weight: unknown; maximumScore: unknown; answerScore: unknown }[]): string | null {
  let points = 0n;
  let maximum = 0n;
  let counted = 0;
  for (const item of items) {
    const weight = parseScore(item.weight);
    const max = parseScore(item.maximumScore);
    const answer = parseScore(item.answerScore);
    if (weight === null || max === null || answer === null || answer < 0n || (max > 0n && answer > max)) return null;
    if (weight === 0n || max === 0n) continue;
    points += answer * weight;
    maximum += max * weight;
    counted += 1;
  }
  if (counted === 0 || maximum <= 0n || points > maximum) return null;
  const scaled = (points * 10_000n + maximum / 2n) / maximum;
  return `${scaled / 100n}.${(scaled % 100n).toString().padStart(2, "0")}`;
}

export function normalizeQuestionPayload(payload: Record<string, unknown>): { ok: true; payload: Record<string, unknown> } | { ok: false } {
  const weight = parseScore(payload.weight);
  const maximum = parseScore(payload.maximum_score);
  if (weight === null || maximum === null) return { ok: false };
  const answerType = String(payload.answer_type ?? "");
  if (!CHOICE.has(answerType)) {
    return Array.isArray(payload.options) && payload.options.length === 0
      ? { ok: true, payload: { ...payload, weight: formatScore(weight), maximum_score: formatScore(maximum), options: [] } }
      : { ok: false };
  }
  const choices = scoredChoices(payload.options);
  if (choices.length < 1 || choices.length > 100 || weight <= 0n || maximum <= 0n) return { ok: false };
  let total = 0n;
  const seen = new Set<string>();
  const options = choices.map((choice, index) => {
    const score = parseScore(choice.score);
    const value = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/u.test(choice.value) ? choice.value : `OPT_${index + 1}`;
    if (score === null || score > maximum || !choice.labelFr.trim() || !choice.labelAr.trim() || seen.has(value)) return null;
    seen.add(value);
    total += score;
    return { value, label_fr: choice.labelFr.trim(), label_ar: choice.labelAr.trim(), score: formatScore(score) };
  });
  if (options.some((option) => option === null) || (answerType === "MULTIPLE_CHOICE" && total > maximum)) return { ok: false };
  return { ok: true, payload: { ...payload, weight: formatScore(weight), maximum_score: formatScore(maximum), options } };
}
