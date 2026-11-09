export type ConfigurationSection = "COMPANY" | "RESEND" | "PAYPAL" | "YOUSIGN" | "SCANNER";
export type ConfigurationProbe = { status: "PASS" | "FAIL"; code: string; checked_at: string; valid_until: string };
export type ConfigurationRevision = {
  id: string; section: ConfigurationSection; environment: string; settings: Record<string, string>; secret_keys: string[];
  content_hash: string; status: "DRAFT" | "ACTIVE" | "REJECTED" | "RETIRED";
  created_by: string; created_at: string; approved_by: string | null; approved_at: string | null; probe: ConfigurationProbe | null;
};
export type ConfigurationSectionData = { section: ConfigurationSection; active_revision_id: string | null; latest_revision_id: string | null; revisions: ConfigurationRevision[] };
export type ConfigurationDashboardView = { environment: string; actor_id: string; can_write: boolean; sections: ConfigurationSectionData[] };

export function activeRevision(section: ConfigurationSectionData) {
  return section.revisions.find(row => row.id === section.active_revision_id && row.status === "ACTIVE") ?? null;
}
export function editableRevision(section: ConfigurationSectionData) {
  return section.revisions.find(row => row.id === section.latest_revision_id && row.status === "DRAFT") ?? activeRevision(section);
}
export function probeFresh(revision: ConfigurationRevision, now: number) {
  return revision.probe?.status === "PASS" && Number.isFinite(Date.parse(revision.probe.valid_until)) && Date.parse(revision.probe.valid_until) > now;
}
export function configurationProgress(data: ConfigurationDashboardView) {
  const sections = new Set<ConfigurationSection>(["COMPANY", "RESEND", "PAYPAL", "YOUSIGN", "SCANNER"]);
  const active = [...sections].filter(key => data.sections.some(section => section.section === key && activeRevision(section))).length;
  return { active, total: sections.size, percent: Math.round(active * 100 / sections.size) };
}
export function mayReview(revision: ConfigurationRevision, data: ConfigurationDashboardView) {
  return data.can_write && revision.status === "DRAFT" && revision.created_by !== data.actor_id;
}
/** A saved password is deliberately never a form default, even if an invalid
 * upstream DTO accidentally includes an unrecognised private property. */
export function visibleFieldValue(settings: Record<string, string>, field: { key: string; secret: boolean }, defaults: Record<string, string> = {}) {
  return field.secret ? "" : settings[field.key] ?? defaults[field.key] ?? "";
}
export function clearSecretFields(form: HTMLFormElement | null) {
  for (const control of form?.querySelectorAll<HTMLInputElement>("input[data-configuration-secret]") ?? []) control.value = "";
}
export function displayTimestamp(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? `${parsed.toISOString().slice(0, 16).replace("T", " ")} UTC` : "—";
}
