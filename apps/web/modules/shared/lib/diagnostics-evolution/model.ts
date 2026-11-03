import { z } from "zod";

export const exactScoreSchema = z.string().regex(/^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/u);
export const evolutionRatingSchema = z.enum(["GOOD", "ATTENTION", "IMPORTANT", "CRITICAL"]);

export type EvolutionPoint = {
  id: string;
  libraryId: string;
  libraryCode: string;
  score: string;
  scoreHundredths: number;
  deltaHundredths: number | null;
  rating: z.infer<typeof evolutionRatingSchema>;
  status: "COMPLETED" | "SUPERSEDED";
  completedAt: string;
  comparisonCompletedAt?: string | null;
  openAnomalies: number;
  criticalAnomalies: number;
};

export type EvolutionSeries = { libraryId: string; libraryCode: string; points: EvolutionPoint[] };
export type EvolutionDashboard = { series: EvolutionSeries[]; truncated: boolean };
export type EvolutionResult = { status: "success"; value: EvolutionDashboard } | { status: "error"; reason: "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE" | "INVALID_RESPONSE" };

export function scoreToHundredths(value: string): number {
  const parsed = exactScoreSchema.parse(value);
  const [whole, decimals = ""] = parsed.split(".");
  return Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
}

export function formatHundredths(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const absolute = Math.abs(value);
  return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

/** JSON policy object key order does not change scoring semantics. */
export function scoringPolicyKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(scoringPolicyKey).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${scoringPolicyKey(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function summarizeLatestEvolution(series: ReadonlyArray<{ points: ReadonlyArray<{ deltaHundredths: number | null }> }>) {
  const latest = series.flatMap(item => item.points.slice(0,1));
  const improved = latest.filter(point => (point.deltaHundredths ?? 0)>0).length;
  const declined = latest.filter(point => (point.deltaHundredths ?? 0)<0).length;
  const stable = latest.filter(point => point.deltaHundredths===0).length;
  const status = improved+declined+stable===0 ? "INSUFFICIENT" : declined>improved ? "DECLINING" : improved>declined ? "IMPROVING" : "STABLE";
  return { improved,declined,stable,status };
}
