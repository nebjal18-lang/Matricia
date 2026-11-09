import { existsSync } from "node:fs";
import { expect, test, type Browser } from "@playwright/test";
import { assertNoHorizontalOverflow, openMatFuncSession, type MatFuncLocale } from "./mat-func-session";

export type MatFuncAtomicRole = "client" | "provider" | "franchise" | "admin";

const stateVariables: Record<MatFuncAtomicRole, string> = {
  client: "E2E_CLIENT_STORAGE_STATE",
  provider: "E2E_PROVIDER_STORAGE_STATE",
  franchise: "E2E_FRANCHISE_STORAGE_STATE",
  admin: "E2E_ADMIN_STORAGE_STATE",
};

export type MatFuncAtomicSurface = {
  requirementId: string;
  role: MatFuncAtomicRole;
  route: string;
  heading: Record<MatFuncLocale, string | RegExp>;
  evidenceText?: Record<MatFuncLocale, string | RegExp>;
  mobile?: boolean;
};

function requireState(role: MatFuncAtomicRole): string | null {
  const variable = stateVariables[role];
  const path = process.env[variable];
  if (!path || !existsSync(path)) return null;
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
  try {
    const target = new URL(baseURL);
    if (!["localhost", "127.0.0.1", "::1"].includes(target.hostname)) return null;
  } catch {
    return null;
  }
  return path;
}

export function registerMatFuncAtomicUiSmoke(surface: MatFuncAtomicSurface) {
  for (const locale of ["fr", "ar"] as const) {
    test(`MAT-FUNC-${surface.requirementId} ${locale.toUpperCase()} surface smoke`, async ({ browser }) => {
      const storageState = requireState(surface.role);
      test.skip(!storageState, `${stateVariables[surface.role]} must reference a local sandbox authentication state`);
      const mobile = surface.mobile ?? true;
      const { context, page } = await openMatFuncSession(browser, storageState!, locale, mobile);
      try {
        const response = await page.goto(`/${locale}/${surface.route}`, { waitUntil: "domcontentloaded" });
        expect(response).not.toBeNull();
        expect(response!.status()).toBeLessThan(500);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        await expect(page.getByRole("heading", { level: 1, name: surface.heading[locale] })).toBeVisible();
        if (surface.evidenceText) {
          await expect(page.getByText(surface.evidenceText[locale]).first()).toBeVisible();
        }
        await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error|ChunkLoadError/u);
        await assertNoHorizontalOverflow(page);
      } finally {
        await context.close();
      }
    });
  }
}

export async function openRoleSession(browser: Browser, role: MatFuncAtomicRole, locale: MatFuncLocale, mobile: boolean) {
  const storageState = requireState(role);
  if (!storageState) return null;
  return openMatFuncSession(browser, storageState, locale, mobile);
}
