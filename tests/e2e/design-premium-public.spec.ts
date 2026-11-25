import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1440, height: 1000 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];

for (const locale of ["fr", "ar"] as const) {
  for (const viewport of viewports) {
    test(`${locale} premium ${viewport.width}px reste lisible et accessible`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const route of ["", "/diagnostic", "/besoin", "/fournisseur", "/connexion", "/a-propos", "/franchise", "/contact"]) {
        await page.goto(`/${locale}${route}`);
        await expect(page.locator("h1")).toHaveCount(1, { timeout: 15_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
        await page.waitForTimeout(100);
        const width = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        expect(width.scroll).toBeLessThanOrEqual(width.client);
        const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(audit.violations.map(item => item.id)).toEqual([]);
      }
    });
  }
}

test("le menu mobile se ferme avec Escape et rend le focus au déclencheur", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fr");
  const trigger = page.locator('button[aria-controls="public-mobile-navigation"]');
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("le changement de langue conserve la route, les paramètres et le brouillon", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/fr/diagnostic?source=design-test");
  await page.getByRole("radiogroup").getByRole("radio").first().click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.goto("/ar/diagnostic?source=design-test");
  await expect(page).toHaveURL(/\/ar\/diagnostic\?source=design-test/);
  await expect(page.locator('p[aria-live="polite"]')).toHaveText(/2.*8/);
});

test("les choix simples et les champs libres exposent leur sémantique", async ({ page }) => {
  await page.goto("/fr/diagnostic");
  await page.evaluate(() => {
    localStorage.removeItem("matricia.public-diagnostic.v2");
    localStorage.removeItem("matricia.public-diagnostic");
  });
  await page.reload();
  const firstGroup = page.getByRole("radiogroup");
  await expect(firstGroup).toHaveAccessibleName(/secteur/i);
  await firstGroup.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Continuer" }).click();
  const group = page.getByRole("radiogroup");
  await expect(group).toHaveAccessibleName(/équipe/i);
  await expect(group.getByRole("radio").first()).toHaveAttribute("aria-checked", /true|false/);
  await page.goto("/fr/besoin");
  await expect(page.locator("textarea")).toHaveAttribute("aria-labelledby", "need-step-title");
});

test("l’inscription Client et Sous-traitant est visible et conserve le rôle", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fr/connexion");
  await expect(page.getByRole("link", { name: "Compte Client" })).toHaveAttribute("href", "/fr/inscription?role=client");
  await page.getByRole("link", { name: "Compte Sous-traitant" }).click();
  await expect(page).toHaveURL(/\/fr\/inscription\?role=fournisseur/);
  await expect(page.locator("h1")).toHaveCount(1);
  await page.goto("/ar/inscription?role=fournisseur");
  await expect(page).toHaveURL(/\/ar\/inscription\?role=fournisseur/);
});
