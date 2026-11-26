import { existsSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { workspaceUrl } from "./helpers/workspace-url";
import { settleVisualState } from "./helpers/settled-visual-state";

type Locale = "fr" | "ar";
type Surface = { route: string; heading: Record<Locale, string>; evidence?: Record<Locale, string> };

const clientSurfaces: Surface[] = [
  { route: "client/documents", heading: { fr: "Documents", ar: "الوثائق" }, evidence: { fr: "Liaisons et historique", ar: "الروابط والسجل" } },
  { route: "client/portefeuille", heading: { fr: "Portefeuille Client", ar: "محفظة العميل" }, evidence: { fr: "Centres de coûts", ar: "مراكز التكلفة" } },
  { route: "client/recompenses", heading: { fr: "Récompenses, parrainage et ROI", ar: "المكافآت والإحالة والعائد" }, evidence: { fr: "Tous les montants et crédits restent en entiers exacts", ar: "تبقى جميع المبالغ والأرصدة أعداداً صحيحة دقيقة" } },
  { route: "client/questionnaires", heading: { fr: "Mes questionnaires", ar: "استبياناتي" }, evidence: { fr: "Enregistrement sécurisé", ar: "حفظ آمن" } },
];

const franchiseSurfaces: Surface[] = [
  { route: "franchise/relances", heading: { fr: "Relances et pipeline", ar: "المتابعات والمسار" }, evidence: { fr: "Ce moteur ne change jamais le pipeline", ar: "لا يغيّر هذا المحرك مسار التحويل" } },
  { route: "franchise/digest", heading: { fr: "Résumé quotidien", ar: "الملخص اليومي" }, evidence: { fr: "Ce résumé n’affiche aucun nom", ar: "لا يعرض هذا الملخص أي اسم" } },
];

const adminSurfaces: Surface[] = [
  { route: "administration/command-center", heading: { fr: "Centre de pilotage", ar: "مركز القيادة" }, evidence: { fr: "Répertoire plateforme", ar: "دليل المنصة" } },
  { route: "administration/approbations-finance", heading: { fr: "Approbations métier et commissions", ar: "موافقات الأعمال والعمولات" }, evidence: { fr: "Réconcilier au payable réel", ar: "مطابقة حدث الدفع" } },
  { route: "administration/finance", heading: { fr: "Finance du jour : paiements et sorties", ar: "مالية اليوم: المدفوعات والمصروفات" }, evidence: { fr: "À traiter aujourd’hui", ar: "للمعالجة اليوم" } },
  { route: "administration/incitations", heading: { fr: "Récompenses, badges et parrainage", ar: "المكافآت والشارات والإحالة" }, evidence: { fr: "Les créations et décisions exigent AAL2.", ar: "تتطلب الإنشاءات والقرارات AAL2." } },
  { route: "administration/clonage", heading: { fr: "Clonage de contenu avec provenance", ar: "استنساخ المحتوى مع المصدر" }, evidence: { fr: "Cloner une checklist de service", ar: "استنساخ قائمة تحقق للخدمة" } },
  { route: "administration/questionnaires/analytique", heading: { fr: "Abandons des questionnaires", ar: "التخلي عن الاستبيانات" }, evidence: { fr: "Confidentialité garantie", ar: "خصوصية مضمونة" } },
  { route: "administration/anti-abus", heading: { fr: "Contrôle des abus", ar: "مراقبة إساءة الاستخدام" }, evidence: { fr: "File de revue", ar: "قائمة المراجعة" } },
  { route: "administration/operations", heading: { fr: "Notifications, audit et file d’événements", ar: "الإشعارات والتدقيق وطابور الأحداث" } },
];

async function openAuthenticated(browser: Browser, storageState: string, locale: Locale, mobile: boolean) {
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    storageState,
    locale: locale === "ar" ? "ar-MA" : "fr-MA",
    timezoneId: "Africa/Casablanca",
    viewport: mobile ? { width: 360, height: 800 } : { width: 1280, height: 900 },
  });
  return { context, page: await context.newPage() };
}

async function assertSurface(page: Page, locale: Locale, surface: Surface) {
  const url = workspaceUrl(locale, surface.route);
  await page.goto(url);
  await expect(page).toHaveURL(url);
  await expect(page.locator('[data-workspace-failure], [data-error-reason]')).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  await expect(page.getByRole("heading", { level: 1, name: surface.heading[locale] })).toBeVisible();
  for (const summary of await page.locator("details.client-ops:not([open]) > summary, #admin-directory:not([open]) > summary, #commissions:not([open]) > summary").all()) await summary.click();
  if (surface.evidence) await expect(page.getByText(surface.evidence[locale], { exact: false }).first()).toBeVisible();
  const foreignOrganization = process.env.E2E_FOREIGN_ORGANIZATION_NAME;
  if (foreignOrganization) await expect(page.locator("body")).not.toContainText(foreignOrganization);
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await page.getByRole("link").first().focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await settleVisualState(page);
  const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const violations=audit.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({target,failureSummary})=>({target,failureSummary})) }));
  expect(violations,JSON.stringify({route:surface.route,violations})).toEqual([]);
}

for (const locale of ["fr", "ar"] as const) {
  test(`${locale.toUpperCase()} Client transversal controls are isolated, responsive and accessible`, async ({ browser }, testInfo) => {
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_CLIENT_STORAGE_STATE must reference a generated authenticated state");
    const { context, page } = await openAuthenticated(browser, state!, locale, testInfo.project.name.includes("mobile"));
    try { for (const surface of clientSurfaces) await test.step(surface.route, () => assertSurface(page, locale, surface)); }
    finally { await context.close(); }
  });

  test(`${locale.toUpperCase()} Franchise CRM and digest are isolated, responsive and accessible`, async ({ browser }, testInfo) => {
    const state = process.env.E2E_FRANCHISE_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_FRANCHISE_STORAGE_STATE must reference a generated authenticated state");
    const { context, page } = await openAuthenticated(browser, state!, locale, testInfo.project.name.includes("mobile"));
    try { for (const surface of franchiseSurfaces) await test.step(surface.route, () => assertSurface(page, locale, surface)); }
    finally { await context.close(); }
  });

  test(`${locale.toUpperCase()} Admin transversal queues are least-privilege, responsive and accessible`, async ({ browser }, testInfo) => {
    const state = process.env.E2E_ADMIN_STORAGE_STATE;
    test.skip(!state || !existsSync(state), "E2E_ADMIN_STORAGE_STATE must reference a generated authenticated state");
    const { context, page } = await openAuthenticated(browser, state!, locale, testInfo.project.name.includes("mobile"));
    try { for (const surface of adminSurfaces) await test.step(surface.route, () => assertSurface(page, locale, surface)); }
    finally { await context.close(); }
  });
}
