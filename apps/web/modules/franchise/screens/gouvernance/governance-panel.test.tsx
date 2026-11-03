import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FranchiseDashboard } from "@/modules/franchise/data/governance/model";
const state = vi.hoisted(() => ({ reason: "MFA_REQUIRED" }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useActionState: () => [{ status: "error", reason: state.reason }, () => {}, false] }));
vi.mock("./invitation-activation-form", () => ({ FranchiseInvitationActivationForm: () => null }));
vi.mock("./immutable-history", () => ({ ApprovalHistory: () => null, GovernanceHistory: () => null, FinanceHistory: () => null }));
import { GovernancePanel } from "./governance-panel";
import { getFranchiseMessages } from "./messages";

const id = "11111111-1111-4111-8111-111111111111";
const dashboard: FranchiseDashboard = { canApprove: false, canManageFinance: true, franchises: [], approvals: [], invitations: [], rules: [], books: [{ id, libraryId: id, organizationId: id, type: "IT", operatorCode: "HATIM_AHMITECH", currency: "MAD", ruleVersionId: id, status: "OPEN", entryFee: null, latestClosure: null, closures: [], allocations: [], balances: [], ledgerEntries: [], entryFeeLedger: [] }] };
beforeEach(() => { state.reason = "MFA_REQUIRED"; });
describe("governance action recovery", () => {
  it.each(["fr", "ar"] as const)("links MFA to account security and the exact %s organization return", locale => {
    const html = renderToStaticMarkup(<GovernancePanel dashboard={dashboard} locale={locale} m={getFranchiseMessages(locale)} keys={{}} />);
    const links = [...html.matchAll(/href="([^"]+)"/gu)].map(match => new URL(match[1]!.replaceAll("&amp;", "&"), "https://matricia.invalid"));
    expect(links.filter(link => link.pathname === `/${locale}/securite/compte`)).toHaveLength(3);
    expect(links[0]!.searchParams.get("next")).toBe(`/${locale}/franchise/gouvernance?organizationId=${id}`);
  });
  it("preserves the selected mandate and organization through MFA recovery", () => {
    const returnPath = `/fr/franchise/gouvernance?organizationId=${id}&franchiseId=${id}`;
    const html = renderToStaticMarkup(<GovernancePanel dashboard={dashboard} locale="fr" m={getFranchiseMessages("fr")} keys={{}} returnPath={returnPath} />);
    const links = [...html.matchAll(/href="([^"]+)"/gu)].map(match => new URL(match[1]!.replaceAll("&amp;", "&"), "https://matricia.invalid"));
    expect(links[0]!.searchParams.get("next")).toBe(returnPath);
  });
  it("does not promise MFA will grant a missing finance role", () => {
    state.reason = "FORBIDDEN";
    const html = renderToStaticMarkup(<GovernancePanel dashboard={dashboard} locale="fr" m={getFranchiseMessages("fr")} keys={{}} />);
    expect(html).toContain("Cette opération dépasse votre périmètre."); expect(html).not.toContain("/securite/compte");
  });
  it("offers a login return for an actually expired session", () => {
    state.reason = "UNAUTHENTICATED";
    const html = renderToStaticMarkup(<GovernancePanel dashboard={dashboard} locale="ar" m={getFranchiseMessages("ar")} keys={{}} />);
    expect(html).toContain("انتهت الجلسة"); expect(html).toContain("/ar/connexion?next="); expect(html).not.toContain("/securite/compte");
  });
});
