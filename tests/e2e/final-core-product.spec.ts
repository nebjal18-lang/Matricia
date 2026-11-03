import { expect, test, type Browser } from "@playwright/test";
import { loadFinalCoreProductFixture } from "./helpers/final-core-product-fixture";

const fixture = loadFinalCoreProductFixture();
if (!fixture) throw new Error("A fresh E2E_FINAL_CORE_PRODUCT_MANIFEST for TEST is required; use final-core-product-run.mjs");
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
test.describe.configure({ timeout: 45_000 });

async function pageFor(browser: Browser, storageState: string) {
  const context = await browser.newContext({ baseURL, storageState, locale: "fr-MA", timezoneId: "Africa/Casablanca" });
  return { context, page: await context.newPage() };
}

test("MAT-FUNC-007 dossier messaging is readable by a participant and denied to a foreign tenant", async ({ browser }) => {
  const allowed = await pageFor(browser, fixture.clientState);
  try {
    await allowed.page.goto(`/fr/messagerie?fil=${fixture.messaging.threadId}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await expect(allowed.page.getByRole("heading", { level: 1, name: "Messagerie sécurisée" })).toBeVisible();
    if (await allowed.page.getByText("Impossible de charger la messagerie.", { exact: true }).isVisible()) throw new Error("Messaging repository rejected the provisioned participant fixture");
    if (await allowed.page.getByText("Sélectionnez une conversation pour lire les échanges.", { exact: true }).isVisible()) throw new Error("Messaging repository omitted the provisioned conversation");
    await expect(allowed.page.getByRole("region", { name: fixture.messaging.subject })).toBeVisible();
    await expect(allowed.page.getByText(fixture.messaging.message, { exact: true })).toBeVisible();
    const sentMessage = `${fixture.messaging.message} — réponse persistée`;
    const sendForm = allowed.page.locator('form').filter({ has: allowed.page.locator('textarea[name="body"]') });
    await sendForm.locator('[name="body"]').fill(sentMessage);
    await sendForm.getByRole("button", { name: "Envoyer", exact: true }).click();
    await expect(allowed.page.getByText(sentMessage, { exact: true })).toBeVisible();
    await allowed.page.reload();
    await expect(allowed.page.getByText(sentMessage, { exact: true })).toBeVisible();
    await expect(allowed.page.locator("body")).not.toContainText(fixture.messaging.foreignMarker);
  } finally { await allowed.context.close(); }
  const denied = await pageFor(browser, fixture.foreignClientState);
  try {
    await denied.page.goto(`/fr/messagerie?fil=${fixture.messaging.threadId}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await expect(denied.page.locator("body")).not.toContainText(fixture.messaging.subject);
    await expect(denied.page.locator("body")).not.toContainText(fixture.messaging.message);
    await expect(denied.page.locator("body")).not.toContainText(`${fixture.messaging.message} — réponse persistée`);
  } finally { await denied.context.close(); }
});

test("MAT-FUNC-013 frozen comparison contains two selected quotes and denies a foreign client", async ({ browser }) => {
  const allowed = await pageFor(browser, fixture.clientState);
  try {
    await allowed.page.goto(`/fr/client/demandes/${fixture.comparison.requestId}/comparaison?rfq=${fixture.comparison.rfqId}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await expect(allowed.page.getByRole("heading", { level: 1, name: "Comparer les offres" })).toBeVisible();
    if (await allowed.page.getByText("Aucune comparaison figée n’est encore disponible.", { exact: true }).isVisible()) throw new Error("Comparison repository omitted the provisioned snapshot");
    await expect(allowed.page.getByRole("heading", { name: /Offre 1/u })).toBeVisible();
    await expect(allowed.page.getByRole("heading", { name: /Offre 2/u })).toBeVisible();
    await expect(allowed.page.locator("body")).not.toContainText(fixture.comparison.foreignMarker);
  } finally { await allowed.context.close(); }
  const denied = await pageFor(browser, fixture.foreignClientState);
  try {
    await denied.page.goto(`/fr/client/demandes/${fixture.comparison.requestId}/comparaison?rfq=${fixture.comparison.rfqId}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await expect(denied.page.getByRole("heading", { level: 1, name: "Comparer les offres" })).toHaveCount(0);
  } finally { await denied.context.close(); }
});

test("MAT-FUNC-018/019 exposes explainable and immutable matching history to the owning client", async ({ browser }) => {
  const allowed = await pageFor(browser, fixture.clientState);
  try {
    await allowed.page.goto(`/fr/client/demandes/${fixture.matching.requestId}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    const history = allowed.page.getByTestId("matching-history");
    await expect(history.getByRole("heading", { name: "Historique de recherche des prestataires" })).toBeVisible();
    await expect(history.getByTestId("matching-run")).toHaveCount(fixture.matching.minimumRuns);
    await expect(history.getByText(`Règle de sélection : ${fixture.matching.policyVersion}`, { exact: true }).first()).toBeVisible();
    await expect(history.getByText("Adéquation avec le service demandé", { exact: true })).toBeVisible();
    await expect(history.getByText(/Capacité indisponible/u)).toBeVisible();
  } finally { await allowed.context.close(); }

  const denied = await pageFor(browser, fixture.foreignClientState);
  try {
    await denied.page.goto(`/fr/client/demandes/${fixture.matching.requestId}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await expect(denied.page.getByTestId("matching-history")).toHaveCount(0);
  } finally { await denied.context.close(); }
});

test("MAT-FUNC-020 provider capacity drives matching inclusion and exclusion through the qualification UI", async ({ browser }) => {
  test.setTimeout(45_000);
  const provider = await pageFor(browser, fixture.providerState);
  try {
    provider.page.setDefaultTimeout(10_000);
    await provider.page.goto(`/fr/sous-traitant/qualification?organizationId=${fixture.providerQualification.organizationId}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await expect(provider.page.getByRole("heading", { level: 1, name: "Votre qualification" })).toBeVisible();
    if (await provider.page.getByText("Impossible de charger l’espace qualification.", { exact: true }).isVisible()) { const reason=await provider.page.getByRole("alert").getAttribute("data-error-reason");throw new Error(`Provider qualification repository rejected the provisioned fixture: ${reason??"UNKNOWN"}`); }
    if (await provider.page.getByText("Aucune organisation Prestataire active n’est associée à ce compte.", { exact: true }).isVisible()) throw new Error("Provider qualification membership was not resolved");

    const serviceSection = provider.page.getByRole("heading", { name: "Services demandés" }).locator("xpath=ancestor::section[1]");
    const serviceCard = serviceSection.locator("li").filter({ hasText: fixture.providerQualification.serviceLabelFr }).last();
    await expect(serviceCard).toContainText("Qualification : Approuvé · État de capacité : Non déclarée");
    await expect(serviceCard).toContainText("Non éligible aux nouvelles consultations");

    const capacitySection = provider.page.getByRole("heading", { name: "Déclarer une capacité" }).locator("xpath=ancestor::section[1]");
    const form = capacitySection.locator("form");
    const service = form.getByLabel("Service", { exact: true });
    const status = form.getByLabel("État de capacité", { exact: true });
    const units = form.getByLabel("Unités disponibles", { exact: true });
    const leadTime = form.getByLabel("Délai de démarrage (jours)", { exact: true });
    const reason = form.getByLabel("Motif de cette déclaration", { exact: true });
    const save = form.getByRole("button", { name: "Enregistrer la capacité" });
    await service.selectOption(fixture.providerQualification.serviceId);
    await leadTime.fill("3");

    const declare = async (value: "AVAILABLE" | "LIMITED" | "FULL" | "PAUSED", availableUnits: string, expectedLabel: string) => {
      await status.selectOption(value);
      if (value === "PAUSED") {
        await expect(units).toBeDisabled();
        await expect(units).toHaveValue("");
      } else {
        await expect(units).toBeEnabled();
        await units.fill(availableUnits);
      }
      await reason.fill(`Transition contrôlée ${value}`);
      await save.click();
      await expect(capacitySection.getByText("Opération enregistrée. L’état affiché va être actualisé.", { exact: true })).toBeVisible();
      await expect(serviceCard).toContainText(`Qualification : Approuvé · État de capacité : ${expectedLabel}`);
    };

    await declare("AVAILABLE", "8", "Disponible");
    await expect(serviceCard).toContainText("Éligible aux nouvelles consultations");
    await expect(serviceCard).toContainText("Toutes les conditions obligatoires sont satisfaites.");

    await declare("LIMITED", "2", "Capacité limitée");
    await expect(serviceCard).toContainText("Éligible aux nouvelles consultations");
    await expect(serviceCard).toContainText("Toutes les conditions obligatoires sont satisfaites.");

    await declare("FULL", "0", "Capacité complète");
    await expect(serviceCard).toContainText("Non éligible aux nouvelles consultations");
    await expect(serviceCard).toContainText("Capacité complète");

    await declare("PAUSED", "", "En pause");
    await expect(serviceCard).toContainText("Non éligible aux nouvelles consultations");
    await expect(serviceCard).toContainText("Capacité mise en pause");
  } finally { await provider.context.close(); }
});
