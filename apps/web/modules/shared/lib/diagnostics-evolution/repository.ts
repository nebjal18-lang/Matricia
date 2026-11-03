import { z } from "zod";
import { readAllPages,readRelatedPages } from "@/modules/shared/lib/data/read-pages";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { evolutionRatingSchema, exactScoreSchema, scoreToHundredths, scoringPolicyKey, type EvolutionPoint, type EvolutionResult } from "./model";

const uuid = z.string().uuid();
const membershipRow = z.object({ id: uuid, organization_id: uuid }).strict();
const roleRow = z.object({ membership_id: uuid, role_code: z.enum(["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_EDITOR", "CLIENT_VIEWER"]) }).strict();
const runRow = z.object({ id: uuid, organization_id: uuid, library_id: uuid, overall_score: z.union([z.string(), z.number()]), rating: evolutionRatingSchema, status: z.enum(["COMPLETED", "SUPERSEDED"]), completed_at: z.string().min(10), scoring_policy_snapshot: z.record(z.string(), z.unknown()) }).strict();
const anomalyRow = z.object({ diagnostic_run_id: uuid, severity: z.enum(["INFO", "WARNING", "HIGH", "CRITICAL", "UNKNOWN"]), status: z.enum(["OPEN", "IGNORED", "RESOLVED"]) }).strict();
const libraryRow = z.object({ id: uuid, code: z.string().min(2).max(80) }).strict();
const clientRoles = ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_EDITOR", "CLIENT_VIEWER"] as const;

export async function loadDiagnosticsEvolution(requestedOrganizationId?: string | null): Promise<EvolutionResult> {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const membershipsQuery = await readAllPages((from,to)=>client.from("organization_memberships").select("id,organization_id").eq("user_id", auth.user.id).eq("status", "ACTIVE").order("id").range(from,to));
  if (membershipsQuery.error) return { status: "error", reason: "UNAVAILABLE" };
  const memberships = z.array(membershipRow).safeParse(membershipsQuery.data);
  if (!memberships.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const membershipIds = memberships.data.map((membership) => membership.id);
  if (membershipIds.length === 0) return { status: "error", reason: "FORBIDDEN" };
  const rolesQuery = await readRelatedPages(membershipIds,(ids,from,to)=>client.from("organization_member_roles").select("membership_id,role_code").in("membership_id", ids).is("revoked_at", null).in("role_code", [...clientRoles]).order("membership_id").order("role_code").range(from,to));
  if (rolesQuery.error) return { status: "error", reason: "UNAVAILABLE" };
  const roles = z.array(roleRow).safeParse(rolesQuery.data);
  if (!roles.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const clientMembershipIds = new Set(roles.data.map((role) => role.membership_id));
  let organizationIds = [...new Set(memberships.data.filter((membership) => clientMembershipIds.has(membership.id)).map((membership) => membership.organization_id))];
  if (organizationIds.length === 0) return { status: "error", reason: "FORBIDDEN" };

  if (requestedOrganizationId) {
    if (!organizationIds.includes(requestedOrganizationId)) return { status: "error", reason: "FORBIDDEN" };
    organizationIds = [requestedOrganizationId];
  }
  const runsQuery = await readRelatedPages(organizationIds,(ids,from,to)=>client.from("diagnostic_runs").select("id,organization_id,library_id,overall_score,rating,status,completed_at,scoring_policy_snapshot").in("organization_id", ids).order("completed_at", { ascending: false }).order("id").range(from,to));
  if (runsQuery.error) return { status: "error", reason: runsQuery.error.code === "42501" ? "FORBIDDEN" : "UNAVAILABLE" };
  const runs = z.array(runRow).safeParse(runsQuery.data);
  if (!runs.success || runs.data.some((run) => !organizationIds.includes(run.organization_id))) return { status: "error", reason: "INVALID_RESPONSE" };
  const visibleRuns = [...runs.data].sort((left,right)=>right.completed_at.localeCompare(left.completed_at)||left.id.localeCompare(right.id));
  const runIds = visibleRuns.map((run) => run.id);
  const libraryIds = [...new Set(visibleRuns.map((run) => run.library_id))];
  const [anomaliesQuery, librariesQuery] = await Promise.all([
    runIds.length === 0 ? Promise.resolve({ data: [], error: null }) : readRelatedPages(runIds,(ids,from,to)=>client.from("diagnostic_anomalies").select("diagnostic_run_id,severity,status").in("diagnostic_run_id", ids).order("diagnostic_run_id").order("id").range(from,to)),
    libraryIds.length === 0 ? Promise.resolve({ data: [], error: null }) : readRelatedPages(libraryIds,(ids,from,to)=>client.from("catalog_libraries").select("id,code").in("id", ids).order("id").range(from,to)),
  ]);
  if (anomaliesQuery.error || librariesQuery.error) return { status: "error", reason: "UNAVAILABLE" };
  const anomalies = z.array(anomalyRow).safeParse(anomaliesQuery.data);
  const libraries = z.array(libraryRow).safeParse(librariesQuery.data);
  if (!anomalies.success || !libraries.success || anomalies.data.some((anomaly) => !runIds.includes(anomaly.diagnostic_run_id))) return { status: "error", reason: "INVALID_RESPONSE" };
  const libraryCodes = new Map(libraries.data.map((library) => [library.id, library.code]));
  if (visibleRuns.some((run) => !libraryCodes.has(run.library_id))) return { status: "error", reason: "INVALID_RESPONSE" };
  const normalizedScores = new Map<string, string>();
  for (const run of visibleRuns) {
    const score = String(run.overall_score);
    if (!exactScoreSchema.safeParse(score).success) return { status: "error", reason: "INVALID_RESPONSE" };
    normalizedScores.set(run.id, score);
  }
  const anomalyCounts = new Map<string, { open: number; critical: number }>();
  for (const anomaly of anomalies.data) {
    const count = anomalyCounts.get(anomaly.diagnostic_run_id) ?? { open: 0, critical: 0 };
    if (anomaly.status === "OPEN") count.open += 1;
    if (anomaly.status === "OPEN" && anomaly.severity === "CRITICAL") count.critical += 1;
    anomalyCounts.set(anomaly.diagnostic_run_id, count);
  }
  const series = libraryIds.map((libraryId) => {
    const raw = visibleRuns.filter((run) => run.library_id === libraryId);
    const olderById=new Map<string,typeof raw[number]>(),lastByBasis=new Map<string,typeof raw[number]>();
    for(let index=raw.length-1;index>=0;index--){const run=raw[index]!,key=`${run.organization_id}:${scoringPolicyKey(run.scoring_policy_snapshot)}`,older=lastByBasis.get(key);if(older)olderById.set(run.id,older);lastByBasis.set(key,run);}
    const points: EvolutionPoint[] = raw.map((run) => {
      const score = normalizedScores.get(run.id)!;
      const scoreHundredths = scoreToHundredths(score);
      const older = olderById.get(run.id);
      const olderScore = older ? normalizedScores.get(older.id)! : null;
      const counts = anomalyCounts.get(run.id) ?? { open: 0, critical: 0 };
      return { id: run.id, libraryId, libraryCode: libraryCodes.get(libraryId)!, score, scoreHundredths, deltaHundredths: olderScore === null ? null : scoreHundredths - scoreToHundredths(olderScore), rating: run.rating, status: run.status, completedAt: run.completed_at, comparisonCompletedAt: older?.completed_at ?? null, openAnomalies: counts.open, criticalAnomalies: counts.critical };
    });
    return { libraryId, libraryCode: libraryCodes.get(libraryId)!, points };
  }).sort((left, right) => left.libraryCode.localeCompare(right.libraryCode));
  return { status: "success", value: { series, truncated: false } };
}
