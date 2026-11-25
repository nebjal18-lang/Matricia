import { type Browser, type Page } from "@playwright/test";

export type MatFuncLocale = "fr" | "ar";

export async function openMatFuncSession(
  browser: Browser,
  storageState: string,
  locale: MatFuncLocale,
  mobile: boolean,
) {
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    storageState,
    locale: locale === "ar" ? "ar-MA" : "fr-MA",
    timezoneId: "Africa/Casablanca",
    viewport: mobile ? { width: 360, height: 800 } : { width: 1280, height: 900 },
  });
  return { context, page: await context.newPage() };
}

export async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  if (dimensions.content > dimensions.viewport) {
    throw new Error(`Horizontal overflow: content=${dimensions.content} viewport=${dimensions.viewport}`);
  }
}
