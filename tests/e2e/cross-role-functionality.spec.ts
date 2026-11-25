import { expect, test, type Page } from "@playwright/test";

/**
 * The three development actors are the provisioned demo client, franchisee and
 * provider. Public registration needs a mailbox, so this test signs in through
 * the real demo action, then checks the commercial chain that already links
 * the IT client organization to the IT provider organization: one request,
 * one contract and one active mission. The franchisee must not see that
 * dossier. A failed read must not look like an empty dossier.
 */
const host = new URL(process.env.E2E_BASE_URL ?? "http://localhost:5173").hostname;
test.skip(!["localhost", "127.0.0.1", "::1"].includes(host), "restricted to a local server");

const clientOrganization = "Client · Informatique, cybersécurité et data";
const providerOrganization = "Prestataire · Informatique, cybersécurité et data";
const clientRoutes = ["client/demandes", "client/missions", "client/contrats", "client/finances", "client/documents", "messagerie"];
const providerRoutes = ["sous-traitant/devis", "sous-traitant/missions", "sous-traitant/qualification", "sous-traitant/messages"];
function watchHydration(page: Page, sink: string[]) {
  page.on("console", (message) => {
    const text = message.text();
    if (/hydration|did not match|server rendered html/i.test(text)) sink.push(text.slice(0, 400));
  });
}

async function signIn(page: Page, persona: "client" | "provider" | "franchise", destination: RegExp) {
  await page.goto("/fr/connexion", { waitUntil: "domcontentloaded" });
  await page.locator(`form:has(input[name="persona"][value="${persona}"]) button[type="submit"]`).click();
  await page.waitForURL(destination, { timeout: 90_000 });
  await expect(page.locator('[data-workspace-failure="MFA_REQUIRED"]')).toHaveCount(0);
}

async function expectReadable(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0, path).toBeLessThan(500);
  await expect(page.locator("h1").first(), path).toBeVisible();
  await expect(page.locator("[data-workspace-failure]"), path).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, path).toBeLessThanOrEqual(1);
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

async function expectMissionDenied(page: Page, missionPath: string) {
  const response = await page.goto(missionPath, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cette page n’est pas disponible");
  await expect(page.getByRole("link", { name: "Projets & missions" })).toHaveCount(0);
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

test.describe.configure({ mode: "serial" });

test("client, franchisee and provider keep the same mission and stay out of each other's workspaces", async ({ browser }) => {
  test.setTimeout(180_000);
  const hydration: string[] = [];
  const clientContext = await browser.newContext({ locale: "fr-MA", timezoneId: "Africa/Casablanca", viewport: { width: 1280, height: 800 } });
  const providerContext = await browser.newContext({ locale: "fr-MA", timezoneId: "Africa/Casablanca", viewport: { width: 1280, height: 800 } });
  const franchiseContext = await browser.newContext({ locale: "fr-MA", timezoneId: "Africa/Casablanca", viewport: { width: 390, height: 844 } });
  const client = await clientContext.newPage();
  const provider = await providerContext.newPage();
  const franchise = await franchiseContext.newPage();
  for (const page of [client, provider, franchise]) {
    page.setDefaultTimeout(20_000);
    page.setDefaultNavigationTimeout(45_000);
  }
  watchHydration(client, hydration);
  watchHydration(provider, hydration);
  watchHydration(franchise, hydration);
  try {
    await signIn(client, "client", /\/fr\/tableau-de-bord/);
    const clientOrganizationId = await selectClientOrganization(client, clientOrganization);
    const query = `?organizationId=${clientOrganizationId}`;
    for (const route of clientRoutes) await expectReadable(client, `/fr/${route}${query}`);

    await client.goto(`/fr/client/missions${query}`, { waitUntil: "domcontentloaded" });
    await client.locator("details.client-ops > summary").click();
    await expect(client.getByText("Les avenants sont momentanément indisponibles")).toHaveCount(0);
    const missionId = (await client.locator("section[aria-labelledby='missions-title'] span.font-mono").first().innerText()).trim();
    expect(missionId).toMatch(/^[0-9a-f-]{36}$/i);
    const missionPath = `/fr/client/missions/${missionId}${query}`;
    await expectReadable(client, missionPath);
    await expect(client.locator("body")).toContainText(missionId);

    await client.goto("/fr/franchise/gouvernance", { waitUntil: "domcontentloaded" });
    await expect(client.getByRole("alert").filter({ hasText: "Aucun mandat de bibliothèque actif accessible" })).toBeVisible();
    await expect(client.locator("body")).not.toContainText("Souss-Massa");
    await client.goto("/fr/administration/command-center", { waitUntil: "domcontentloaded" });
    await expect(client).not.toHaveURL(/\/administration\/command-center/);

    await signIn(provider, "provider", /\/fr\/tableau-de-bord/);
    await provider.goto("/fr/sous-traitant/missions", { waitUntil: "domcontentloaded" });
    const providerOrganizationId = await selectProviderOrganization(provider, providerOrganization);
    const providerQuery = `?organizationId=${providerOrganizationId}`;
    for (const route of providerRoutes) await expectReadable(provider, `/fr/${route}${providerQuery}`);
    await provider.goto(`/fr/sous-traitant/missions${providerQuery}`, { waitUntil: "domcontentloaded" });
    await expect(provider.locator("body")).toContainText(missionId);
    await expectReadable(provider, `/fr/sous-traitant/missions/${missionId}${providerQuery}`);

    await expectMissionDenied(provider, missionPath);

    await signIn(franchise, "franchise", /\/fr\/franchise\/accueil/);
    // The seeded franchise is active, but it has no native activation evidence
    // and therefore no catalogue mandate. The library must say so instead of
    // rendering an empty library as if the read had succeeded.
    await expect(franchise.locator("[data-workspace-failure='FORBIDDEN']")).toBeVisible();
    await expect(franchise.locator("body")).not.toContainText("Souss-Massa");
    await expectMissionDenied(franchise, missionPath);
    await franchise.goto("/ar/franchise/accueil", { waitUntil: "domcontentloaded" });
    await expect(franchise.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(franchise.locator("[data-workspace-failure='FORBIDDEN']")).toBeVisible();
    expect(hydration, "hydration mismatch").toEqual([]);
  } finally {
    await Promise.all([clientContext.close(), providerContext.close(), franchiseContext.close()]);
  }
});
