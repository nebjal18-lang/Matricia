import type { FranchiseDashboard } from "../governance/model";
import type { FranchiseCrmDashboard } from "../crm/model";
import type { FollowupDashboard } from "../followups/model";
import type { FranchiseDigestDashboard } from "../digest/model";
import type { FranchiseCorrectivePlan } from "../quality/repository";

/** A selection narrows authorized rows; it never changes the underlying permissions. */
export function scopeFranchiseDashboards(input: {
  organizationId?: string | null; libraryId?: string | null; franchiseId?: string | null;
  governance: FranchiseDashboard | null; crm: FranchiseCrmDashboard | null;
  followups: FollowupDashboard | null; digest: FranchiseDigestDashboard | null;
  plans: FranchiseCorrectivePlan[] | null;
}) {
  if (!input.organizationId && !input.libraryId && !input.franchiseId) return input;
  if (!input.governance&&!input.franchiseId) throw new Error("FRANCHISE_SCOPE_UNAVAILABLE");
  const franchises = (input.governance?.franchises??[]).filter((f) =>
    (!input.organizationId || f.organizationId === input.organizationId) && (!input.franchiseId || f.id === input.franchiseId));
  if (input.governance&&!franchises.length) throw new Error("FRANCHISE_SCOPE_FORBIDDEN");
  const ids = new Set(input.franchiseId?[input.franchiseId]:franchises.map((f) => f.id));
  const orgs = new Set(franchises.map((f) => f.organizationId));
  const prospects = input.followups?.prospects.filter((p) => ids.has(p.franchiseId)) ?? [];
  const prospectIds = new Set(prospects.map((p) => p.id));
  return {
    ...input,
    governance: input.governance ? { ...input.governance, franchises,
      books: input.governance.books.filter((b) => orgs.has(b.organizationId) && (!input.libraryId || b.libraryId === input.libraryId)),
      approvals: input.governance.approvals.filter((a) => ids.has(a.franchiseId)),
      invitations: input.governance.invitations.filter((i) => ids.has(i.franchiseId)) }:null,
    crm: input.crm ? { ...input.crm, franchises: input.crm.franchises.filter((f) => ids.has(f.id)),
      prospects: input.crm.prospects.filter((p) => ids.has(p.franchiseId)),
      snapshots: input.crm.snapshots.filter((p) => ids.has(p.franchiseId)),
      alerts: input.crm.alerts.filter((p) => ids.has(p.franchiseId)),
      objectives: input.crm.objectives.filter((p) => ids.has(p.franchiseId)) } : null,
    followups: input.followups ? { ...input.followups, franchises: input.followups.franchises.filter((f) => ids.has(f.id)), prospects,
      policies: input.followups.policies.filter((p) => ids.has(p.franchiseId)),
      jobs: input.followups.jobs.filter((j) => prospectIds.has(j.prospectId)) } : null,
    digest: input.digest ? { ...input.digest, franchises: input.digest.franchises.filter((f) => ids.has(f.id)),
      configurations: input.digest.configurations.filter((r) => ids.has(r.franchise_id)),
      digests: input.digest.digests.filter((r) => ids.has(r.franchise_id)), jobs: input.digest.jobs.filter((r) => ids.has(r.franchise_id)) } : null,
    plans: input.plans?.filter((p) => ids.has(p.franchiseId)) ?? null,
  };
}
