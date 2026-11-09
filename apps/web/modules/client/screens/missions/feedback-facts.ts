import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const rating = z.number().int().min(1).max(5);
const ratingsSchema = z.tuple([rating, rating, rating]);

export type FeedbackRatings = [number, number, number];

export function satisfactionBasisPoints(ratings: FeedbackRatings): number {
  const sum = ratings.reduce((total, value) => total + (value - 1) * 2500, 0);
  return Math.round(sum / ratings.length);
}

export function ratioBasisPoints(matched: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((10_000 * matched) / total);
}

export type MissionFeedbackFacts =
  | { status: "ready"; quality: number; compliance: number }
  | { status: "blocked"; reason: "NO_ACCEPTANCE" | "NO_CHECKLIST" | "UNAVAILABLE" };

const deliverableRow = z.object({
  id: z.string().uuid(),
  status: z.string(),
  current_version: z.number().int(),
});
const checkRow = z.object({
  deliverable_id: z.string().uuid(),
  delivery_version: z.number().int(),
  status: z.string(),
});
const itemRow = z.object({
  status: z.string(),
  milestone_id: z.string().uuid().nullable(),
});

export function feedbackFactsFromRows(input: {
  deliverables: Array<z.infer<typeof deliverableRow>>;
  checks: Array<z.infer<typeof checkRow>>;
  items: Array<z.infer<typeof itemRow>>;
  retiredMilestoneIds: string[];
}): MissionFeedbackFacts {
  const accepted = new Map(input.deliverables.filter((row) => row.status === "ACCEPTED").map((row) => [row.id, row.current_version]));
  const decisions = input.checks.filter((row) => accepted.get(row.deliverable_id) === row.delivery_version && (row.status === "COMPLIANT" || row.status === "NONCOMPLIANT"));
  const retired = new Set(input.retiredMilestoneIds);
  const items = input.items.filter((row) => row.milestone_id === null || !retired.has(row.milestone_id));
  if (decisions.length === 0) return { status: "blocked", reason: "NO_ACCEPTANCE" };
  if (items.length === 0) return { status: "blocked", reason: "NO_CHECKLIST" };
  return {
    status: "ready",
    quality: ratioBasisPoints(decisions.filter((row) => row.status === "COMPLIANT").length, decisions.length),
    compliance: ratioBasisPoints(items.filter((row) => row.status === "COMPLETED").length, items.length),
  };
}

export function parseFeedbackRatings(values: string[]): FeedbackRatings | null {
  const parsed = ratingsSchema.safeParse(values.map((value) => Number(value)));
  return parsed.success ? parsed.data : null;
}

export async function loadMissionFeedbackFacts(missionId: string): Promise<MissionFeedbackFacts> {
  if (!z.string().uuid().safeParse(missionId).success) return { status: "blocked", reason: "UNAVAILABLE" };
  const client = await getSupabaseServerClient();
  const [deliverables, checks, items, retirements] = await Promise.all([
    client.from("deliverables").select("id,status,current_version").eq("mission_id", missionId).limit(100),
    client.from("acceptance_checklists").select("deliverable_id,delivery_version,status").eq("mission_id", missionId).limit(500),
    client.from("mission_checklist_items").select("status,milestone_id").eq("mission_id", missionId).limit(200),
    client.from("mission_milestone_retirements_v1").select("milestone_id").eq("mission_id", missionId).limit(100),
  ]);
  if (deliverables.error || checks.error || items.error || retirements.error) return { status: "blocked", reason: "UNAVAILABLE" };
  const parsedDeliverables = z.array(deliverableRow).max(100).safeParse(deliverables.data);
  const parsedChecks = z.array(checkRow).max(500).safeParse(checks.data);
  const parsedItems = z.array(itemRow).max(200).safeParse(items.data);
  const parsedRetirements = z.array(z.object({ milestone_id: z.string().uuid() })).max(100).safeParse(retirements.data);
  if (!parsedDeliverables.success || !parsedChecks.success || !parsedItems.success || !parsedRetirements.success) return { status: "blocked", reason: "UNAVAILABLE" };
  return feedbackFactsFromRows({
    deliverables: parsedDeliverables.data,
    checks: parsedChecks.data,
    items: parsedItems.data,
    retiredMilestoneIds: parsedRetirements.data.map((row) => row.milestone_id),
  });
}
