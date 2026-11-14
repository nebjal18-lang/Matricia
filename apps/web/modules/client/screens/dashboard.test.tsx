import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentPropsWithoutRef<"a"> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/modules/shared/ui/button", () => ({
  Button: ({ children, ...props }: ComponentPropsWithoutRef<"button">) => <button {...props}>{children}</button>,
}));
vi.mock("@/modules/shared/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

import { ClientDashboardHome } from "./dashboard";

const summary = {
  total: 2,
  overdue: 0,
  followUpScore: 80,
  byPriority: { CRITICAL: 0, HIGH: 1, MEDIUM: 1, LOW: 0 },
  byKind: { NOTIFICATION: 0, MESSAGE: 1, APPROVAL: 0, EXCEPTION: 0, RISK_REVIEW: 0, WORK_ITEM: 1 },
};

describe("ClientDashboardHome", () => {
  it("compose l’accueil marché avec les données réelles, sans exemple illustratif", () => {
    const html = renderToStaticMarkup(
      <ClientDashboardHome
        locale="fr"
        userEmail="client@example.invalid"
        organizationName="Epitaphe Market"
        selectedOrganizationId="11111111-1111-4111-8111-111111111111"
        selectedQuery="?organizationId=11111111-1111-4111-8111-111111111111"
        alternate="ar"
        search=""
        searchedItems={[{
          id: "a1",
          kind: "WORK_ITEM",
          title: "Comparer 3 propositions",
          detail: "Déploiement de la marque",
          organizationName: "Epitaphe Market",
          organizationId: "11111111-1111-4111-8111-111111111111",
          priority: "HIGH",
          mandatory: true,
          href: "/fr/client/demandes/r1",
          occurredAt: "2026-09-16T08:00:00Z",
          dueAt: null,
          requiresHumanReview: false,
        }]}
        summary={summary as never}
        snapshot={{
          status: "success",
          stage: "active",
          counts: { openRequests: 1, quotesToReview: 2, activeMissions: 0, pendingDecisions: 1, upcomingDue: 1 },
          lastRequestId: "r1",
          organizationName: "Epitaphe Market",
          featuredProject: {
            requestId: "r1",
            title: "Déploiement de la marque",
            status: "QUOTES_RECEIVED",
            createdAt: "2025-03-12T00:00:00Z",
            quoteCount: 2,
            href: "/fr/client/demandes/r1",
            steps: [
              { id: "need", current: false, done: true },
              { id: "consultation", current: false, done: true },
              { id: "quotes", current: true, done: false },
              { id: "contract", current: false, done: false },
              { id: "mission", current: false, done: false },
              { id: "delivery", current: false, done: false },
            ],
          },
          comparison: {
            requestId: "r1",
            href: "/fr/client/demandes/r1",
            description: "Identité et support de lancement",
            columns: [
              { quoteId: "q1", label: "Offre A", durationDays: 42, deliverablesCount: 3, totalMinor: "100000", currency: "MAD", priceRank: 1 },
              { quoteId: "q2", label: "Offre B", durationDays: 56, deliverablesCount: 2, totalMinor: "120000", currency: "MAD", priceRank: 2 },
            ],
          },
          insights: { documentsToReview: 3, nextMilestoneTitle: "Choisir un prestataire", nextMilestoneDue: "2025-03-25T00:00:00Z", messagesToHandle: 2 },
        }}
        membershipSwitcher={<p>Epitaphe Market</p>}
        actionCenterError={false}
        showSignoutError={false}
        contextRejected={false}
        signOutAction={async () => undefined}
        now="2026-09-19T10:00:00Z"
      />,
    );

    expect(html).toContain("Bonjour, Epitaphe Market.");
    expect(html).toContain("À traiter maintenant");
    expect(html).toContain("Déploiement de la marque");
    expect(html).toContain("Comparer ce qui compte");
    expect(html).toContain("Offre A");
    expect(html).toContain("Périmètre");
    expect(html).toContain("Conditions");
    expect(html).toContain("De l’ambition aux réalisations");
    expect(html).toContain("Propulsons le savoir-faire marocain.");
    expect(html).toContain("Prochain jalon");
    expect(html).toContain("Documents à examiner");
    expect(html).toContain("Messages non lus");
    expect(html).toContain("L’avancement de vos projets");
    expect(html).toContain("client-home-spark");
    expect(html).toContain("Bilans");
    expect(html).toContain("Récompenses");
    expect(html).not.toMatch(/exemple illustratif/i);
    expect(html).toContain("/fr/client/diagnostics");
    expect(html).toContain("/fr/client/actions");
    expect(html).toContain("/fr/client/contrats");
    expect(html).toContain("/fr/client/portefeuille");
    expect(html).toContain("/fr/client/credits");
    expect(html).toContain("/fr/client/favoris");
    expect(html).toContain("/fr/client/recherche");
    expect(html).toContain("À traiter");
    expect(html).toContain("Portefeuille");
  });
});
