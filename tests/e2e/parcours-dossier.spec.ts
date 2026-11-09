import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const host = new URL(process.env.E2E_BASE_URL ?? "http://localhost:5173").hostname;
test.skip(!["localhost", "127.0.0.1", "::1"].includes(host), "restricted to a local server");

const requestDescription = "Demande parcours IT — automatisation, devis comparés, signature simulée et réception scannée.";
const changeReason = "Génération du contrat parcours à partir de l offre sélectionnée";
const simulation = "Simulation de signature non contractuelle";
const contractualProof = "Une preuve de signature vérifiée a été enregistrée";
const clientOrganization = "Client · Parcours IT";
const providerOrganization = "Prestataire · Parcours IT";

function loadParcoursEnv() {
  const parsed = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    return [[match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]];
  }));
  const clientEmail = parsed.MATRICIA_PARCOURS_CLIENT_EMAIL;
  const providerEmail = parsed.MATRICIA_PARCOURS_PROVIDER_EMAIL;
  const franchiseEmail = parsed.MATRICIA_PARCOURS_FRANCHISE_EMAIL;
  const clientPassword = parsed.MATRICIA_PARCOURS_CLIENT_PASSWORD;
  const providerPassword = parsed.MATRICIA_PARCOURS_PROVIDER_PASSWORD;
  const franchisePassword = parsed.MATRICIA_PARCOURS_FRANCHISE_PASSWORD;
  if (!clientEmail || !providerEmail || !franchiseEmail || !clientPassword || !providerPassword || !franchisePassword) {
    throw new Error("PARCOURS_CREDENTIALS_MISSING");
  }
  return { clientEmail, providerEmail, franchiseEmail, clientPassword, providerPassword, franchisePassword };
}

function watchHydration(page: Page, sink: string[]) {
  page.on("console", (message) => {
    const text = message.text();
    if (/hydration|did not match|server rendered html/i.test(text)) sink.push(text.slice(0, 400));
  });
}

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.goto("/fr/connexion", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Mot de passe", exact: true }).click();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(/\/fr\/(tableau-de-bord|client\/|sous-traitant\/|franchise\/)/, { timeout: 90_000 });
  await expect(page.locator('[data-workspace-failure="MFA_REQUIRED"]')).toHaveCount(0);
}

async function selectClientOrganization(page: Page, name: string) {
  const switcher = page.locator("details.client-org-switch");
  if (await switcher.count()) {
    await switcher.locator("summary").click();
    const current = switcher.locator("[data-selected='true']");
    if ((await current.textContent())?.trim() !== name) {
      await switcher.getByRole("link", { name, exact: true }).click();
      await page.waitForURL(/organizationId=/);
    }
  }
  await page.goto("/fr/client/demandes", { waitUntil: "domcontentloaded" });
  const organizationId = new URL(page.url()).searchParams.get("organizationId")
    ?? await page.locator('input[name="organizationId"]').first().getAttribute("value");
  expect(organizationId, `organization ${name}`).toBeTruthy();
  return organizationId!;
}

async function selectProviderOrganization(page: Page, name: string) {
  const select = page.locator("#provider-organization-selector");
  await expect(select).toBeVisible();
  await select.selectOption({ label: name });
  await page.getByRole("button", { name: "Afficher", exact: true }).click();
  await page.waitForURL(/organizationId=/);
  const organizationId = new URL(page.url()).searchParams.get("organizationId");
  expect(organizationId).toBeTruthy();
  return organizationId!;
}

test("the parcours IT actors keep the signed dossier from request through rating", async ({ browser }) => {
  test.setTimeout(240_000);
  const credentials = loadParcoursEnv();
  const hydration: string[] = [];
  const clientContext = await browser.newContext({ locale: "fr-MA", timezoneId: "Africa/Casablanca", viewport: { width: 1280, height: 800 } });
  const providerContext = await browser.newContext({ locale: "fr-MA", timezoneId: "Africa/Casablanca", viewport: { width: 1280, height: 800 } });
  const franchiseContext = await browser.newContext({ locale: "fr-MA", timezoneId: "Africa/Casablanca", viewport: { width: 1280, height: 800 } });
  const page = await clientContext.newPage();
  const provider = await providerContext.newPage();
  const franchise = await franchiseContext.newPage();
  for (const current of [page, provider, franchise]) {
    current.setDefaultTimeout(20_000);
    current.setDefaultNavigationTimeout(45_000);
    watchHydration(current, hydration);
  }
  try {
    await signInWithPassword(page, credentials.clientEmail, credentials.clientPassword);
    const clientOrganizationId = await selectClientOrganization(page, clientOrganization);
    const query = new URLSearchParams({ organizationId: clientOrganizationId, q: requestDescription });
    await page.goto(`/fr/client/demandes?${query}`, { waitUntil: "domcontentloaded" });
    const requestRow = page.getByRole("row", { name: requestDescription });
    await expect(requestRow).toBeVisible();
    await requestRow.getByRole("link", { name: "Ouvrir" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("body")).toContainText(requestDescription);
    await page.getByRole("link", { name: "Consulter le contrat déjà lié au devis retenu" }).click();
    await page.waitForURL(/\/fr\/client\/contrats/);

    const contract = page.locator("li.client-card", { hasText: changeReason });
    await expect(contract).toBeVisible();
    await expect(contract).toContainText(simulation);
    await expect(contract).toContainText("Signatures 2/2");
    await expect(contract).toContainText("Terminé");
    await expect(contract).not.toContainText(contractualProof);
    await expect(contract.getByText("Contrat signé", { exact: true })).toHaveCount(0);

    const missionHref = await contract.getByRole("link", { name: "Ouvrir la mission" }).getAttribute("href");
    expect(missionHref).toMatch(/\/fr\/client\/missions\/[0-9a-f-]{36}/i);
    await contract.getByRole("link", { name: "Ouvrir la mission" }).click();
    await page.waitForURL(/\/fr\/client\/missions\/[0-9a-f-]{36}/i);
    const missionUrl = new URL(page.url());
    await page.goto(`${missionUrl.pathname}/jalons${missionUrl.search}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Noter la prestation" })).toBeVisible();
    await expect(page.locator("body")).toContainText(/Qualité\s+100\s*%/);
    await expect(page.locator("body")).toContainText(/Conformité\s+100\s*%/);
    await page.locator("details.client-ops > summary").click();
    const missionFacts = page.locator("details.client-ops");
    await expect(missionFacts).toContainText("Accepté");
    await expect(missionFacts).toContainText(simulation);
    await expect(missionFacts).not.toContainText(contractualProof);

    const missionPath = missionUrl.pathname;
    await signInWithPassword(provider, credentials.providerEmail, credentials.providerPassword);
    await provider.goto("/fr/sous-traitant/missions", { waitUntil: "domcontentloaded" });
    const providerOrganizationId = await selectProviderOrganization(provider, providerOrganization);
    await provider.goto(`${missionPath.replace("/client/", "/sous-traitant/")}?organizationId=${providerOrganizationId}`, { waitUntil: "domcontentloaded" });
    await expect(provider.getByRole("heading", { level: 3, name: "Livrable 1" }).first()).toBeVisible();
    await expect(provider.getByText("Terminé", { exact: true }).first()).toBeVisible();
    await expect(provider.getByText("Contrat signé", { exact: true })).toHaveCount(0);

    await signInWithPassword(franchise, credentials.franchiseEmail, credentials.franchisePassword);
    await franchise.goto("/fr/franchise/accueil", { waitUntil: "domcontentloaded" });
    await expect(franchise.locator('[data-workspace-failure="FORBIDDEN"]')).toHaveCount(0);
    await expect(franchise.locator("body")).not.toContainText("MANDATE_REQUIRED");
    expect(hydration, "hydration mismatch").toEqual([]);
  } finally {
    await Promise.all([clientContext.close(), providerContext.close(), franchiseContext.close()]);
  }
});
