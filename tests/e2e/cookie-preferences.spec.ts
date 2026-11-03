import { expect, test } from "@playwright/test";

const storageKey = "matricia.cookie-preferences.v1";

for (const locale of ["fr", "ar"] as const) {
  const notifications = locale === "fr" ? "Gérer mes notifications" : "إدارة إشعاراتي";
  const necessary = locale === "fr" ? "Cookies nécessaires" : "ملفات ضرورية";

  test(`cookie preferences ${locale}: legacy browser choice never impersonates account consent`, async ({ page }) => {
    await page.addInitScript((key) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify({ serviceMessages: true })); }, storageKey);
    await page.goto(`/${locale}/cookies`);
    const accountLink = page.getByRole("link", { name: notifications, exact: true });
    const section = accountLink.locator("..");
    await expect(section.getByRole("heading", { name: necessary, exact: true })).toBeVisible();
    await expect(section.getByRole("checkbox")).toHaveCount(0);
    await expect(accountLink).toHaveAttribute("href", `/${locale}/notifications`);
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).serviceMessages, storageKey)).toBe(true);
    await page.reload();
    await expect(accountLink).toBeVisible();
    await expect(accountLink).toHaveAttribute("href", `/${locale}/notifications`);
    await expect(section.getByRole("checkbox")).toHaveCount(0);
  });

  test(`cookie preferences ${locale}: malformed legacy storage cannot change necessary-only information`, async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "invalid-json"), storageKey);
    await page.goto(`/${locale}/cookies`);
    const section = page.getByRole("link", { name: notifications, exact: true }).locator("..");
    await expect(section.getByRole("heading", { name: necessary, exact: true })).toBeVisible();
    await expect(section.getByRole("alert")).toHaveCount(0);
    await expect(section.getByRole("checkbox")).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe("invalid-json");
  });

  test(`cookie preferences ${locale}: unavailable storage remains usable without a false save receipt`, async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new DOMException("Storage unavailable", "SecurityError"); };
      Storage.prototype.setItem = () => { throw new DOMException("Storage unavailable", "QuotaExceededError"); };
    });
    await page.goto(`/${locale}/cookies`);
    const accountLink = page.getByRole("link", { name: notifications, exact: true });
    const section = accountLink.locator("..");
    await expect(section.getByRole("heading", { name: necessary, exact: true })).toBeVisible();
    await expect(accountLink).toHaveAttribute("href", `/${locale}/notifications`);
    await expect(section.getByRole("button")).toHaveCount(0);
    await expect(section.getByRole("status")).toHaveCount(0);
    await page.reload();
    await expect(accountLink).toBeVisible();
  });
}
