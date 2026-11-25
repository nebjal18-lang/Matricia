import { expect, test, type Page } from "@playwright/test";

/**
 * Walks the development dossier created for the IT client and provider.
 * The mock circuit is non-contractual: the screen must say so, and this test
 * must not describe the two recorded steps as a legal signature.
 */
const host = new URL(process.env.E2E_BASE_URL ?? "http://localhost:5173").hostname;
test.skip(!["localhost", "127.0.0.1", "::1"].includes(host), "restricted to a local server");

const requestDescription = "Nouvelle demande informatique de développement, avec périmètre, délai et réception.";
const changeReason = "Génération du contrat brouillon à partir de l offre sélectionnée";
const simulation = "Simulation de signature non contractuelle";
const contractualProof = "Une preuve de signature vérifiée a été enregistrée";
const clientOrganization = "Client · Informatique, cybersécurité et data";
const providerOrganization = "Prestataire · Informatique, cybersécurité et data";

function watchHydration(page: Page, sink: string[]) {
  page.on("console", (message) => {
    const text = message.text();
    if (/hydration|did not match|server rendered html/i.test(text)) sink.push(text.slice(0, 400));
  });
}

async function signIn(page: Page, persona: "client" | "provider", destination: RegExp) {
  await page.goto("/fr/connexion", { waitUntil: "domcontentloaded" });
  await page.locator(`form:has(input[name="persona"][value="${persona}"]) button[type="submit"]`).click();
  await page.waitForURL(destination, { timeout: 90_000 });
  await expect(page.locator('[data-workspace-failure="MFA_REQUIRED"]')).toHaveCount(0);
}

async function selectClientOrganization(page: Page, name: string) {
  const switcher = page.locator("details.client-org-switch");
  await switcher.locator("summary").click();
  await switcher.getByRole("link", { name, exact: true }).click();
  await page.waitForURL(/organizationId=/);
  const organizationId = new URL(page.url()).searchParams.get("organizationId");
  expect(organizationId).toBeTruthy();
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

test("the new IT dossier stays visible from request through reception and rating", async ({ browser }) => {
  test.setTimeout(180_000);
  const hydration: string[] = [];
  const clientContext = await browser.newContext({ locale: "fr-MA", timezoneId: "Africa/Casablanca", viewport: { width: 1280, height: 800 } });
  const providerContext = await browser.newContext({ locale: "fr-MA", timezoneId: "Africa/Casablanca", viewport: { width: 1280, height: 800 } });
  const page = await clientContext.newPage();
  const provider = await providerContext.newPage();
  for (const current of [page, provider]) {
    current.setDefaultTimeout(20_000);
    current.setDefaultNavigationTimeout(45_000);
    watchHydration(current, hydration);
  }
  try {
    await signIn(page, "client", /\/fr\/tableau-de-bord/);
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
    await expect(contract).toContainText("2/2");
    await expect(contract).toContainText("Terminé");
    await expect(contract).toContainText("Livrable 1");
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
    await expect(missionFacts).toContainText("Livrable 1");
    await expect(missionFacts).toContainText("Accepté");
    await expect(missionFacts).toContainText(simulation);
    await expect(missionFacts).not.toContainText(contractualProof);

    const missionPath = missionUrl.pathname;
    await signIn(provider, "provider", /\/fr\/tableau-de-bord/);
    await provider.goto("/fr/sous-traitant/missions", { waitUntil: "domcontentloaded" });
    const providerOrganizationId = await selectProviderOrganization(provider, providerOrganization);
    await provider.goto(`${missionPath.replace("/client/", "/sous-traitant/")}?organizationId=${providerOrganizationId}`, { waitUntil: "domcontentloaded" });
    await expect(provider.getByRole("heading", { level: 3, name: "Livrable 1" }).first()).toBeVisible();
    await expect(provider.getByText("Terminé", { exact: true }).first()).toBeVisible();
    await expect(provider.getByText("Contrat signé", { exact: true })).toHaveCount(0);
    await expect(provider.locator("body")).toContainText("Livrable 1");
    expect(hydration, "hydration mismatch").toEqual([]);
  } finally {
    await Promise.all([clientContext.close(), providerContext.close()]);
  }
});
