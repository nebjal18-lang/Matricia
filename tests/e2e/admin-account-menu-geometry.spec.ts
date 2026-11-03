import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Synthetic layout regression only. The native audit separately verifies a real
// Admin session, role authorization and sign-out against the built application.
const shellStyles = ["client", "admin"].map(role => readFileSync(new URL(`../../apps/web/modules/${role}/ui/${role}-experience.css`, import.meta.url), "utf8")).join("\n");

for (const locale of ["fr", "ar"] as const) {
  for (const width of [375, 390, 768, 1440]) {
    test(`Admin account menu stays inside the viewport: ${locale}, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const rtl = locale === "ar";
      const account = rtl ? "القائمة الإدارية" : "Menu administrateur";
      const signOut = rtl ? "تسجيل الخروج" : "Se déconnecter";
      await page.setContent(`<!doctype html><html lang="${locale}" dir="${rtl ? "rtl" : "ltr"}"><head><style>
        *{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}button,input{font:inherit}
        ${shellStyles}
      </style></head><body><div class="client-workspace admin-workspace" dir="${rtl ? "rtl" : "ltr"}">
        <aside class="client-side"><a class="client-brand">Matricia</a></aside>
        <div class="client-frame"><div class="client-topbar">
          <form class="client-top-search admin-shell-search"><label for="search">⌕</label><input id="search" placeholder="Rechercher une page, un dossier ou une organisation"></form>
          <a class="admin-lang">FR | AR</a><a class="client-icon-btn">○</a><a class="client-icon-btn">?</a>
          <details class="client-account"><summary aria-label="${account}">A</summary><div>
            <p dir="ltr">synthetic-administrator-very-long-address-without-spaces@example.invalid</p>
            <a href="#account">${rtl ? "أمان الحساب" : "Compte et sécurité"}</a>
            <a href="#sessions">${rtl ? "جلساتي" : "Vérifier mes sessions"}</a>
            <form><button type="button" class="client-ghost-btn">${signOut}</button></form>
          </div></details>
        </div><header class="client-mast"><div><h1>${rtl ? "الإدارة" : "Administration"}</h1><p>Administration Matricia</p></div><div class="client-offer-actions"><button>Créer</button><button>Modifier</button><button>Exporter</button></div></header></div>
      </div></body></html>`);
      const trigger = page.getByLabel(account);
      await trigger.click();
      const menu = page.locator(".client-account[open] > div");
      await expect(menu).toBeVisible();
      const bounds = await menu.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(bounds!.width).toBeGreaterThan(200);
      const overflow = await menu.evaluate(node => node.scrollWidth > node.clientWidth + 1);
      expect(overflow, "the long email and all labels must wrap inside the menu").toBe(false);
      const logout = page.getByRole("button", { name: signOut });
      const logoutBounds = await logout.boundingBox();
      expect(logoutBounds!.x).toBeGreaterThanOrEqual(bounds!.x);
      expect(logoutBounds!.x + logoutBounds!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
      await trigger.focus();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: rtl ? "أمان الحساب" : "Compte et sécurité" })).toBeFocused();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expect(logout).toBeFocused();
      await logout.click();
      await trigger.click();
      await expect(menu).toHaveCount(0);
    });
  }
}
