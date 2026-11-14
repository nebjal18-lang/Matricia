import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  reviewFranchiseApplication: async () => ({ status: "idle" }),
  linkFranchiseApplicationOrganization: async () => ({ status: "idle" }),
  bindFranchiseApplicationMandate: async () => ({ status: "idle" }),
  proposeFranchiseFromApplication: async () => ({ status: "idle" }),
  decideFranchiseApplicationMandate: async () => ({ status: "idle" }),
  resendFranchiseInvitationCode: async () => ({ status: "idle" }),
}));

import { FranchiseApplicationReview, type FranchiseApplicationReviewCopy, type FranchiseApplicationReviewModel } from "./review-forms";

const copy: FranchiseApplicationReviewCopy = {
  reason: "Motif",
  reasonHint: "Motif de la décision",
  company: "Passer en revue société",
  documents: "Demander les pièces",
  close: "Clore",
  link: "Lier l’organisation",
  organization: "Organisation du candidat",
  noOrganization: "Pas encore de société",
  bind: "Rattacher ce mandat existant",
  franchise: "Mandat déjà proposé",
  pending: "Enregistrement…",
  denied: "Refusé",
  conflict: "Conflit",
  unavailable: "Indisponible",
  saved: "Enregistré",
  mfa: "MFA",
  mailed: "Mailé",
  notMailed: "Non mailé",
  propose: "Proposer",
  proposeTitle: "Mandat proposé",
  itRule: "Règle IT",
  entryFee: "Droit d’entrée",
  entryFeeMode: "Modalité",
  entryFeeTerm: "Durée",
  mandateTerm: "Mandat",
  conditions: "Conditions",
  modes: { UPFRONT: "Comptant", INSTALLMENT: "Échelonnement", REVENUE_WITHHOLDING: "Retenue" },
  approveTitle: "Approbation",
  approve: "Approuver",
  reject: "Refuser",
  fourEyes: "Quatre yeux",
  resend: "Renvoyer",
  resendTitle: "Code",
};

const base: FranchiseApplicationReviewModel = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "REGISTERED",
  rowVersion: 1,
  organizationId: null,
  franchiseId: null,
  isIt: true,
  organizations: [],
  franchises: [],
  approval: null,
  invitationId: null,
  invitationPending: false,
};

describe("FranchiseApplicationReview", () => {
  it("keeps the REGISTERED review action compact and labeled", () => {
    const html = renderToStaticMarkup(
      <FranchiseApplicationReview
        locale="fr"
        application={base}
        copy={copy}
        keys={{ propose: "p", approve: "a", resend: "r" }}
      />,
    );
    expect(html).toContain("Passer en revue société");
    expect(html).toContain("Clore");
    expect(html).toContain('for="review-11111111-1111-4111-8111-111111111111-reason"');
    expect(html).toContain("admin-franchise-review__primary");
  });

  it("collapses secondary invitation resend behind a closed details", () => {
    const html = renderToStaticMarkup(
      <FranchiseApplicationReview
        locale="fr"
        application={{
          ...base,
          status: "LIBRARY_ASSIGNED",
          organizationId: "22222222-2222-4222-8222-222222222222",
          franchiseId: "33333333-3333-4333-8333-333333333333",
          invitationId: "44444444-4444-4444-8444-444444444444",
          invitationPending: true,
        }}
        copy={copy}
        keys={{ propose: "p", approve: "a", resend: "r" }}
      />,
    );
    expect(html).toMatch(/<details class="admin-franchise-action">\s*<summary>Code<\/summary>/);
    expect(html).not.toMatch(/<details class="admin-franchise-action" open>\s*<summary>Code<\/summary>/);
  });

  it("renders nothing for an active franchise application", () => {
    const html = renderToStaticMarkup(
      <FranchiseApplicationReview
        locale="fr"
        application={{
          ...base,
          status: "ACTIVE",
          organizationId: "22222222-2222-4222-8222-222222222222",
          franchiseId: "33333333-3333-4333-8333-333333333333",
        }}
        copy={copy}
        keys={{ propose: "p", approve: "a", resend: "r" }}
      />,
    );
    expect(html).toBe("");
    expect(html).not.toContain("Motif");
    expect(html).not.toContain("Demander les pièces");
  });

  it("shows a single organization truth when company review has no linked org", () => {
    const html = renderToStaticMarkup(
      <FranchiseApplicationReview
        locale="fr"
        application={{ ...base, status: "COMPANY_REVIEW", organizationId: null }}
        copy={copy}
        keys={{ propose: "p", approve: "a", resend: "r" }}
      />,
    );
    expect(html).toContain("Demander les pièces");
    expect(html).toContain("Pas encore de société");
    expect(html).not.toContain("Organisation rattachée");
  });
});
