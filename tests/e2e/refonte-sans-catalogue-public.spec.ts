import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const locale of ["fr", "ar"] as const) {
  test("parcours public " + locale + ": diagnostic, bilan, besoin et URL historique", async ({ page }, testInfo) => {
    await page.goto("/" + locale);
    await page.evaluate(() => window.localStorage.clear());
    const diagnosticEntry = page.locator(`a[href="/${locale}/diagnostic"]`).first();
    await expect(diagnosticEntry).toBeVisible();
    await expect(page.getByText(/200 services|200 خدمة/)).toHaveCount(0);
    await diagnosticEntry.click();
    await expect(page).toHaveURL(new RegExp("/" + locale + "/diagnostic"));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (let index = 0; index < 7; index += 1) {
      await page.locator('[role="radiogroup"] [role="radio"], [role="group"] > button').first().click();
      await page.locator("main").getByRole("button").last().click();
    }
    await page.locator("textarea").first().fill(locale === "fr" ? "Mettre en place un suivi d’actions." : "تنظيم متابعة الإجراءات.");
    await page.locator("main").getByRole("button").last().click();
    await page.locator("main").getByRole("button").last().click();
    await expect(page).toHaveURL(new RegExp("/" + locale + "/diagnostic/resultat"), { timeout: 10_000 });
    await expect(page.getByText("100", { exact: true })).toHaveCount(0);
    await page.goto(`/${locale}/besoin?source=diagnostic`);
    await expect(page).toHaveURL(new RegExp("/" + locale + "/besoin"));
    await page.locator("textarea").first().fill(locale === "fr" ? "Sécuriser le Wi-Fi de notre bureau de quinze personnes." : "تأمين شبكة الواي فاي في مكتبنا.");
    await page.getByRole("button", { name: locale === "fr" ? "Continuer" : "متابعة" }).click();
    await expect(page.locator("main h1")).toBeVisible();
    for (let step = 0; step < 3; step += 1) await page.locator("main").getByRole("button").last().click();
    await page.locator("main").getByRole("button", { name: /Valider|تأكيد/ }).click();
    await expect(page.locator(`main a[href*="/${locale}/connexion"]`).first()).toBeVisible();
    await page.goto("/" + locale + "/services?q=wifi");
    await expect(page).toHaveURL(new RegExp("/" + locale + "/services\\?q=wifi"));
    await expect(page.getByRole("heading", { level: 1, name: locale === "fr" ? "Trouvez le bon point de départ pour votre besoin." : "اعثر على نقطة الانطلاق المناسبة لاحتياجك." })).toBeVisible();
    await expect(page.getByRole("link", { name: locale === "fr" ? "Décrire ce besoin" : "وصف هذا الاحتياج" })).toHaveAttribute("href", new RegExp("/" + locale + "/besoin\\?"));
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(audit.violations.map(value => ({ id: value.id, targets: value.nodes.map(node => node.target) }))).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("public-" + locale + ".png"), fullPage: true });
  });
}
