export const FRANCHISE_APPLICATION_OPEN = ["REGISTERED", "COMPANY_REVIEW", "DOCUMENT_REVIEW"] as const;
export const FRANCHISE_APPLICATION_TREAT = ["REGISTERED", "COMPANY_REVIEW", "DOCUMENT_REVIEW", "CONTRACT_PENDING"] as const;
export const FRANCHISE_APPLICATION_SETTLED = ["ACTIVE", "CLOSED", "SUSPENDED", "TERMINATED", "FINANCIAL_RESTRICTED"] as const;

export type FranchiseApplicationListRow = {
  id: string;
  applicant_name: string;
  reply_email: string;
  territory_code: string;
  domain_label: string;
  status: string;
  organization_id: string | null;
  franchise_id: string | null;
  row_version: number;
  created_at: string;
};

export function isFranchiseApplicationOpen(status: string) {
  return (FRANCHISE_APPLICATION_OPEN as readonly string[]).includes(status);
}

export function isFranchiseApplicationTreat(status: string) {
  return (FRANCHISE_APPLICATION_TREAT as readonly string[]).includes(status);
}

export function isFranchiseApplicationSettled(status: string) {
  return (FRANCHISE_APPLICATION_SETTLED as readonly string[]).includes(status);
}

export function isFranchiseApplicationFixture(row: Pick<FranchiseApplicationListRow, "applicant_name" | "reply_email">) {
  const email = row.reply_email.trim().toLowerCase();
  const name = row.applicant_name.trim();
  const at = email.lastIndexOf("@");
  const local = at >= 0 ? email.slice(0, at) : email;
  const domain = at >= 0 ? email.slice(at + 1) : "";
  if (domain === "example.com" || domain === "example.invalid" || domain.endsWith(".invalid")) return true;
  if (/\b(test|audit|e2e|fixture)\b/iu.test(local)) return true;
  if (/^(TEST|AUDIT|E2E)\b/u.test(name)) return true;
  return false;
}

export function organizationDisplayName(
  organizationId: string | null,
  names: Map<string, string>,
  locale: "fr" | "ar",
): { linked: boolean; label: string } {
  if (!organizationId) {
    return { linked: false, label: locale === "ar" ? "غير مرتبطة" : "Non liée" };
  }
  const name = names.get(organizationId)?.trim();
  if (name) return { linked: true, label: name };
  return { linked: true, label: locale === "ar" ? "اسم غير متاح" : "Nom indisponible" };
}

export function filterFranchiseApplications<T extends FranchiseApplicationListRow>(
  rows: T[],
  options: { vue?: string; includeFixtures?: boolean },
) {
  const includeFixtures = Boolean(options.includeFixtures);
  const withoutFixtures = includeFixtures ? rows : rows.filter((row) => !isFranchiseApplicationFixture(row));
  const hiddenFixtures = rows.length - withoutFixtures.length;
  const vue = options.vue?.trim() || "all";
  const visible = vue === "treat"
    ? withoutFixtures.filter((row) => isFranchiseApplicationTreat(row.status))
    : vue === "all" || !vue
      ? withoutFixtures
      : withoutFixtures.filter((row) => row.status === vue);
  return { visible, hiddenFixtures, treatCount: withoutFixtures.filter((row) => isFranchiseApplicationTreat(row.status)).length };
}
