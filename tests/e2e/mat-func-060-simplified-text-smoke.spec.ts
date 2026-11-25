import { expect, test } from "@playwright/test";

for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-060 ${locale.toUpperCase()} public copy stays plain-language`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      locale === "fr" ? "freine votre entreprise" : "يعيق تطور مؤسستك",
    );
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/\b(lorem|TODO|TBD)\b/i);
    await page.goto(`/${locale}/abonnements`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      locale === "fr" ? "formules adaptées" : "صيغ مناسبة",
    );
  });
}
