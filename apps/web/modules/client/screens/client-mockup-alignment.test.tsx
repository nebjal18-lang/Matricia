import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clientDashboardCopy } from "@/modules/client/data/home/copy";

const mockupDir = join(process.cwd(), "..", "..", "docs", "design", "client-dashboard-mockups");

describe("client dashboard mockups", () => {
  it("référence les PNG attendus et la navigation documentée", () => {
    const nav = readFileSync(join(mockupDir, "NAVIGATION.md"), "utf8");
    expect(nav).toContain("/client/diagnostics");
    expect(nav).toContain("/client/recompenses");
    expect(readFileSync(join(mockupDir, "00-accueil-client.png"))).toBeDefined();
  });

  it("aligne les libellés de navigation sur les maquettes", () => {
    expect(clientDashboardCopy.fr.navNeeds).toBe("Bilans");
    expect(clientDashboardCopy.fr.navDisputes).toBe("Litiges");
    expect(clientDashboardCopy.fr.navRewards).toBe("Récompenses");
    expect(clientDashboardCopy.fr.brandTagline).toBe("Des entreprises plus loin.");
    expect(clientDashboardCopy.fr.brandFooter).toBe("Propulsons le savoir-faire marocain.");
    expect(clientDashboardCopy.fr.ambitionScript).toBe("De l’ambition aux réalisations");
    expect(clientDashboardCopy.fr.languagePair).toBe("FR | AR");
    expect(clientDashboardCopy.fr.helloBonjour).toBe("Bonjour");
    expect(clientDashboardCopy.fr.projectProgress).toBe("L’avancement de vos projets");
    expect(clientDashboardCopy.fr.compareWhatMatters).toBe("Comparer ce qui compte");
    expect(clientDashboardCopy.fr.unreadMessages).toBe("Messages non lus");
    expect(clientDashboardCopy.fr.nextMilestone).toBe("Prochain jalon");
  });

  it("couvre les écrans 01–16 dans la navigation documentée", () => {
    const nav = readFileSync(join(mockupDir, "NAVIGATION.md"), "utf8");
    for (const path of [
      "/client/diagnostics",
      "/client/demandes",
      "/client/missions",
      "/client/documents",
      "/messagerie",
      "/client/finances",
      "/organisation",
      "/besoin",
      "/client/litiges",
      "/client/abonnement",
      "/client/recompenses",
      "/securite/compte",
    ]) {
      expect(nav).toContain(path);
    }
    for (const file of [
      "01-priorites-diagnostic.png",
      "02-demandes-devis.png",
      "03-detail-offre.png",
      "04-projets-missions.png",
      "05-suivi-projet.png",
      "06-documents.png",
      "07-messages.png",
      "08-finances.png",
      "09-mon-entreprise.png",
      "10-nouvelle-demande.png",
      "11-comparer-offres.png",
      "12-mission-jalons-livrables.png",
      "13-litiges-assistance.png",
      "14-abonnement-credits-boxes.png",
      "15-recompenses-parrainage-roi.png",
      "16-entreprise-acces-securite.png",
    ]) {
      expect(readFileSync(join(mockupDir, file))).toBeDefined();
    }
  });

  it("aligne les libellés des écrans détail 03/05/10/11/12", async () => {
    const { offerDetailCopy } = await import("@/modules/client/data/rfq/quote-detail-copy");
    const { clientSpaceCopy } = await import("@/modules/client/data/spaces/copy");
    expect(offerDetailCopy.fr.title).toBe("Détail de l’offre");
    expect(offerDetailCopy.fr.coverTitle).toBe("Ce que couvre cette offre");
    expect(offerDetailCopy.fr.summaryTitle).toBe("Résumé pour comparer");
    expect(clientSpaceCopy.fr.followTitle).toBe("Vos priorités et prochaines actions");
    expect(clientSpaceCopy.fr.newRequestTitle).toBe("Nouvelle demande");
    expect(clientSpaceCopy.fr.comparePageTitle).toBe("Comparer les offres");
    expect(clientSpaceCopy.fr.weighCriteria).toBe("Pondérez vos critères");
    expect(clientSpaceCopy.fr.jalonsTitle).toBe("Mission, jalons et livrables");
    expect(clientSpaceCopy.fr.tabJalons).toBe("Jalons et livrables");
  });
});
