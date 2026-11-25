import { z } from "zod";

type Organization = { id: string; display_name: string; legal_name: string; status: string };
export type FinanceOrganizationSource = { status: "success"; organizations: readonly Organization[] } | { status: "error" };
export type FinanceAuditOrganizationContext = {
  state: "READY" | "CHOOSE" | "EMPTY" | "INVALID" | "UNAVAILABLE";
  organizationId: string | null;
  organizations: readonly Organization[];
};

/** Audit scope is selected deliberately; financial records are never selection defaults. */
export function financeAuditOrganizationContext(requested: unknown, source: FinanceOrganizationSource): FinanceAuditOrganizationContext {
  if (source.status === "error") return { state: "UNAVAILABLE", organizationId: null, organizations: [] };
  const organizations = source.organizations.filter((row, index, all) => z.string().uuid().safeParse(row.id).success && all.findIndex(other => other.id === row.id) === index);
  if (requested !== undefined && requested !== null && requested !== "") {
    const parsed = z.string().uuid().safeParse(requested);
    const selected = parsed.success ? organizations.find(row => row.id === parsed.data) : undefined;
    return selected ? { state: "READY", organizationId: selected.id, organizations } : { state: "INVALID", organizationId: null, organizations };
  }
  return { state: organizations.length ? "CHOOSE" : "EMPTY", organizationId: null, organizations };
}
