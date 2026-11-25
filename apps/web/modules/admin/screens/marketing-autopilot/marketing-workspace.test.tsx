import type { ComponentPropsWithoutRef } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/modules/shared/ui/button", () => ({ Button: ({ children, ...props }: ComponentPropsWithoutRef<"button">) => <button {...props}>{children}</button> }));
vi.mock("@/modules/shared/ui/input", () => ({ Input: (props: ComponentPropsWithoutRef<"input">) => <input {...props} /> }));
vi.mock("@/modules/shared/ui/label", () => ({ Label: ({ children, ...props }: ComponentPropsWithoutRef<"label">) => <label {...props}>{children}</label> }));
vi.mock("@/modules/shared/ui/textarea", () => ({ Textarea: (props: ComponentPropsWithoutRef<"textarea">) => <textarea {...props} /> }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({ loadMyPlatformAccess: async () => ({ status: "error", reason: "UNAUTHENTICATED" }) }));
vi.mock("./actions", () => ({ recordConsent: async () => ({ status: "idle" }), createCampaign: async () => ({ status: "idle" }), approveCampaign: async () => ({ status: "idle" }), scheduleCampaign: async () => ({ status: "idle" }), createScheduleRule: async () => ({ status: "idle" }), activateScheduleRule: async () => ({ status: "idle" }), approveAssistedCalendar: async () => ({ status: "idle" }), saveBrandKit: async () => ({ status: "idle" }), reviewBrandEvidence: async () => ({ status: "idle" }), initializeTemplates: async () => ({ status: "idle" }) }));
import type { MarketingDashboard } from "@/modules/shared/lib/marketing-autopilot/model";
import { scopeMarketingDashboard } from "@/modules/shared/lib/marketing-autopilot/repository";
import { MarketingPanel } from "./marketing-panel";
import { getMarketingMessages } from "./messages";

const own = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const ownCampaign = "33333333-3333-4333-8333-333333333333", otherCampaign = "44444444-4444-4444-8444-444444444444";
const library = "55555555-5555-4555-8555-555555555555", service = "66666666-6666-4666-8666-666666666666", actor = "77777777-7777-4777-8777-777777777777", content = "88888888-8888-4888-8888-888888888888";
const campaign = (id: string, organizationId: string, titleFr: string) => ({ id, organizationId, mode: "AUTOPILOT" as const, titleFr, titleAr: titleFr, status: "APPROVED", frequencyMaxWeekly: 8, riskThreshold: 20, rowVersion: 1, approvedAt: null });
const dimension = (organizationId: string, campaignId: string) => ({ organizationId, campaignId, actorUserId: actor, contentId: content, libraryId: library, serviceId: service, network: "LINKEDIN" as const, metricDate: "2026-09-21", metric: "CLICK", quantity: "4", valueMinor: "0", currency: null, providerOrganizationId: organizationId, franchiseId: null });
const dashboard: MarketingDashboard = {
  organizations: [{ id: own, name: "Atlas Services" }, { id: other, name: "Concurrent" }],
  consents: [], brandVersions: [], connections: [], socialAccounts: [], scheduleRules: [], calendars: [], calendar: [], exceptions: [],
  campaigns: [campaign(ownCampaign, own, "Rentrée maintenance"), campaign(otherCampaign, other, "Campagne concurrente")],
  contents: [{ id: content, campaignId: ownCampaign, channel: "LINKEDIN", versionId: content, language: "FR", hook: "Conseil", body: "Texte", cta: "Voir", hashtags: [], riskScore: 5, status: "APPROVED", expiresAt: null }],
  performance: [],
  performanceDimensions: [dimension(own, ownCampaign), dimension(other, otherCampaign)],
};
const keys = { consent: own, campaign: own, scheduleRule: own, brandKit: own, templates: own };

describe("espace Marketing prestataire et franchisé", () => {
  it.each(["fr", "ar"] as const)("renders scheduled instants identically across server and browser timezones (%s)", (locale) => {
    const scheduled: MarketingDashboard = {...dashboard,
      calendars:[{id:own,organizationId:own,scheduleRuleId:own,monthStart:"2026-11-01",status:"APPROVED",generatedAt:null,approvedAt:null,rowVersion:1}],
      calendar:[{id:content,calendarId:own,campaignId:ownCampaign,contentVersionId:content,scheduledAt:"2026-11-22T23:30:00Z",status:"SANDBOXED"}],
    };
    const render=()=>renderToStaticMarkup(<MarketingPanel workspace dashboard={scheduled} locale={locale} m={getMarketingMessages(locale)} keys={keys}/>);
    try {
      vi.stubEnv("TZ","America/Toronto");
      const server=render();
      vi.stubEnv("TZ","Africa/Casablanca");
      expect(render()).toBe(server);
      expect(server).toContain("23:30");
    } finally {vi.unstubAllEnvs();}
  });
  it("ne garde que l’organisation de l’espace", () => {
    const scoped = scopeMarketingDashboard(dashboard, own);
    expect(scoped.organizations.map((value) => value.id)).toEqual([own]);
    expect(scoped.campaigns.map((value) => value.id)).toEqual([ownCampaign]);
    expect(scoped.performanceDimensions.every((value) => value.organizationId === own)).toBe(true);
    expect(JSON.stringify(scoped)).not.toContain("Campagne concurrente");
  });

  it("préremplit le Brand Kit et n’affiche aucun identifiant technique dans les filtres", () => {
    const html = renderToStaticMarkup(<MarketingPanel workspace dashboard={scopeMarketingDashboard(dashboard, own)} locale="fr" m={getMarketingMessages("fr")} keys={keys} dimensionLabels={{ [own]: "Atlas Services", [library]: "Maintenance", [service]: "Maintenance CVC", [actor]: "Vous" }} brandDefaults={{ source: "PROFILE", primaryColor: "#121d58", tone: "PROFESSIONAL", primaryCta: "DIAGNOSTIC", trackedUrl: "https://matricia.ma/fr/diagnostic", allowedHost: "matricia.ma", hashtags: "#AtlasServices", forbiddenTerms: "" }} />);
    const options = [...html.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((match) => match[1] ?? "");
    expect(options.some((text) => /[0-9a-f]{8}-[0-9a-f]{4}-/i.test(text))).toBe(false);
    expect(options).toEqual(expect.arrayContaining(["Maintenance", "Maintenance CVC", "Vous", "Rentrée maintenance · LinkedIn · FR", "LinkedIn"]));
    expect(html).toContain('value="#AtlasServices"');
    expect(html).toContain('value="https://matricia.ma/fr/diagnostic"');
    expect(html).toContain("profil de votre organisation");
    expect(html).not.toContain("Revue des preuves Matricia");
    expect(html).not.toContain("Templates commerciaux");
  });

  it("branche les pages sur l’organisation résolue côté serveur", () => {
    for (const relative of ["sous-traitant/marketing/page.tsx", "franchise/marketing/page.tsx"]) {
      const code = readFileSync(join(process.cwd(), "app", "[locale]", relative), "utf8");
      expect(code).toContain("loadWorkspaceMarketingDashboard(space.selectedOrganizationId)");
      expect(code).toContain("<MarketingPanel workspace");
      expect(code).not.toContain("getSupabaseAdminClient");
    }
  });
});
