import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const locale of ["fr", "ar"] as const) {
  test(`public experience ${locale}: inscription, intentions, abonnements et accessibilité`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${locale}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(locale === "fr" ? "Découvrez ce qui freine votre entreprise" : "اكتشف ما يعيق تطور مؤسستك");
    await expect(page.getByRole("link", { name: locale === "fr" ? "Analyser mon entreprise" : "تحليل مؤسستي" }).first()).toHaveAttribute("href", `/${locale}/diagnostic`);
    await expect(page.getByRole("link", { name: locale === "fr" ? "Proposer mes services" : "تقديم خدماتي" }).first()).toHaveAttribute("href", `/${locale}/fournisseur`);
    await expect(page.getByRole("link", { name: locale === "fr" ? "J’ai déjà un besoin précis" : "لدي حاجة محددة" })).toHaveAttribute("href", `/${locale}/besoin`);
    const registration = page.getByRole("link", { name: locale === "fr" ? "Créer un compte" : "إنشاء حساب" });
    if (await registration.first().isVisible()) await expect(registration.first()).toHaveAttribute("href", new RegExp(`/${locale}/inscription`));
    else {
      await page.getByRole("button", { name: locale === "fr" ? "Ouvrir le menu" : "فتح القائمة" }).click();
      await expect(page.getByRole("link", { name: locale === "fr" ? "Créer un compte" : "إنشاء حساب" }).first()).toHaveAttribute("href", new RegExp(`/${locale}/inscription`));
    }
    const width = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(width.content).toBeLessThanOrEqual(width.viewport);
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(audit.violations.map(value => ({ id:value.id, targets:value.nodes.map(node => node.target) }))).toEqual([]);
    await page.screenshot({ path:testInfo.outputPath(`home-${locale}.png`), fullPage:true });
    await page.goto(`/${locale}/abonnements`);
    await expect(page.getByRole("heading", { level:1 })).toContainText(locale === "fr" ? "Des formules adaptées à vos besoins professionnels" : "صيغ مناسبة لاحتياجاتكم المهنية");
    await expect(page).toHaveURL(new RegExp(`/${locale}/abonnements$`));
    await page.goto(`/${locale}/contact`);
    await expect(page.getByRole("heading", { level:1 })).toBeVisible();
    await expect(page.getByRole("button", { name: locale === "fr" ? "Enregistrer ma demande" : "تسجيل طلبي" })).toBeVisible();
  });
}

test("registration preserves the internal journey across role and language changes", async ({ page }) => {
  const next = "/fr/besoin?source=diagnostic&priority=cash_visibility";
  await page.goto(`/fr/connexion?mode=inscription&role=client&next=${encodeURIComponent(next)}`);
  expect(await page.getByRole("link", { name:"Compte Sous-traitant" }).getAttribute("href")).toContain(`next=${encodeURIComponent(next)}`);
  const language = page.getByRole("link", { name:"العربية" });
  await expect(language).toHaveAttribute("href", /\/ar\/connexion\?mode=inscription&role=client&next=%2Far%2Fbesoin/);
  await language.click();
  await expect(page).toHaveURL(/\/ar\/connexion\?mode=inscription&role=client&next=%2Far%2Fbesoin/);
  await expect(page.getByRole("heading", { level:1 })).toBeVisible();
});
