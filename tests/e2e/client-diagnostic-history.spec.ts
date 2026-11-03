import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Run only with a native test identity and a tenant containing both a completed
// diagnostic and an imported intake. No application or API response is mocked.
for (const locale of ["fr", "ar"] as const) {
  test(`${locale} Client history filters retain the organization and survive reload`, async ({ browser }) => {
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    const organizationId = process.env.E2E_CLIENT_ORGANIZATION_ID;
    test.skip(!state || !existsSync(state) || !organizationId, "Native Client storage state and explicit test organization required");
    const context = await browser.newContext({ storageState: state!, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await page.goto(`/${locale}/client/diagnostics?organizationId=${organizationId}`);
      await expect(page.getByRole("heading", { level: 1, name: locale === "fr" ? "Mes diagnostics" : "تشخيصاتي" })).toBeVisible();
      const section = page.locator(".diag-hub-history");
      const navigation = section.getByRole("navigation");
      await expect(section.locator(":scope > ul > li").first(), "Fixture must contain a real completed diagnostic").toBeVisible();
      await expect(section.locator("#indicative-intakes time").first(), "Fixture must contain a real imported intake").toBeVisible();
      const filters = [
        ["complete", locale === "fr" ? "Diagnostic complet" : "تشخيص كامل"],
        ["indicative", locale === "fr" ? "Prédiagnostic importé" : "تقييم أولي مستورد"],
        ["all", locale === "fr" ? "Tous" : "الكل"],
      ] as const;
      for (const [kind, label] of filters) {
        const link = navigation.getByRole("link", { name: label, exact: true });
        await link.focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL((url) => url.searchParams.get("organizationId") === organizationId && url.searchParams.get("kind") === kind && url.searchParams.get("page") === "1");
        await expect(navigation.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
        await page.reload();
        await expect(navigation.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
        if (kind === "complete") await expect(section.locator("#indicative-intakes")).toHaveCount(0);
        if (kind === "indicative") await expect(section.getByRole("heading", { name: locale === "fr" ? "Bilans indicatifs enregistrés" : "التقييمات الإرشادية المحفوظة" })).toBeVisible();
      }
      for (const width of [375, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    } finally { await context.close(); }
  });
}
