import { expect, test } from "@playwright/test";

const publicRoutes = [
  "",
  "/a-propos",
  "/abonnements",
  "/besoin",
  "/contact",
  "/diagnostic",
  "/entreprises",
  "/fournisseur",
  "/franchise",
  "/services",
] as const;

const protectedRoutes = [
  "/client/demandes",
  "/sous-traitant/qualification",
  "/franchise/performance",
  "/administration/command-center",
  "/administration/parcours",
  "/administration/entreprises",
  "/organisation",
  "/messagerie",
] as const;

for (const locale of ["fr", "ar"] as const) {
  test(`routes publiques ${locale}: rendu, direction et liens essentiels sans 404`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));

    for (const suffix of publicRoutes) {
      const response = await page.goto(`/${locale}${suffix}`, { waitUntil: "domcontentloaded" });
      expect(response, `absence de réponse pour /${locale}${suffix}`).not.toBeNull();
      expect(response!.status(), `statut de /${locale}${suffix}`).toBeLessThan(400);
      await expect(page.locator("h1").first(), `H1 de /${locale}${suffix}`).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.getByText(/404|page not found/i)).toHaveCount(0);
    }

    await page.goto(`/${locale}`, { waitUntil: "domcontentloaded" });
    const essentialDestinations = new Set([
      `/${locale}/diagnostic`,
      `/${locale}/besoin`,
      `/${locale}/fournisseur`,
      `/${locale}/entreprises`,
      `/${locale}/abonnements`,
      `/${locale}/connexion`,
    ]);
    const hrefs = await page.locator("a[href]").evaluateAll(elements => elements.map(element => element.getAttribute("href")));
    for (const destination of essentialDestinations) expect(hrefs, `lien ${destination}`).toContain(destination);
    expect(pageErrors).toEqual([]);
  });

  test(`protections anonymes ${locale}: espaces privés redirigés vers la connexion`, async ({ page }) => {
    for (const suffix of protectedRoutes) {
      await page.context().clearCookies();
      const response = await page.goto(`/${locale}${suffix}`, { waitUntil: "domcontentloaded" });
      expect(response, `absence de réponse pour /${locale}${suffix}`).not.toBeNull();
      expect(response!.status(), `statut final de /${locale}${suffix}`).toBeLessThan(400);
      await expect(page).toHaveURL(new RegExp(`/${locale}/connexion(?:\\?.*)?$`));
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });
}
