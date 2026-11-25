import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { workspaceUrl } from "./helpers/workspace-url";
import { settleVisualState } from "./helpers/settled-visual-state";

test.describe.configure({ timeout: 90_000 });
const run = process.env.E2E_P28_RUN_TOKEN;
if (!run) throw new Error("LOCAL_FUNCTIONAL_RUN_REQUIRED");

async function revealForms(page: Page) {
  const closed = page.locator("details:not([open]) > summary");
  while (await closed.count()) await closed.first().click();
  await settleVisualState(page);
}

async function fill(form: Locator, values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) await form.locator(`[name="${name}"]`).fill(value);
}

for (const locale of ["fr", "ar"] as const) {
  test(`MAT-FUNC-011/012/021/051/053 ${locale} creates linked projects, deadlines and approved exact budgets`, async ({ browser }, info) => {
    const state = process.env.E2E_CLIENT_STORAGE_STATE;
    if (!state) throw new Error("CLIENT_STATE_REQUIRED");
    const suffix = `${locale.toUpperCase()}_${info.project.name.includes("mobile") ? "M" : "D"}`;
    const code = `E2E_${run.slice(0, 8).toUpperCase()}_${suffix}`;
    const context = await browser.newContext({ storageState: state, baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173", viewport: info.project.name.includes("mobile") ? { width: 360, height: 800 } : { width: 1280, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(`/${locale}/client/portefeuille`);
      await revealForms(page);
      const site = page.locator("form").filter({ has: page.locator('[name="siteCode"]') });
      await fill(site, { siteCode: code, nameFr: `Site ${code}`, nameAr: `موقع ${code}`, city: "Casablanca", addressLine: "Adresse de recette locale", changeReason: `E2E ${run} ${suffix}` });
      await site.getByRole("button").click();
      await expect(site.getByRole("status")).toBeVisible();
      await page.reload();
      await revealForms(page);
      await expect(page.getByText(`${locale === "ar" ? "موقع" : "Site"} ${code}`, { exact: true }).first()).toBeVisible();
      const project = page.locator("form").filter({ has: page.locator('[name="projectCode"]') });
      await fill(project, { projectCode: code, nameFr: `Projet ${code}`, nameAr: `مشروع ${code}`, descriptionFr: "Projet de recette avec jalon mesurable", descriptionAr: "مشروع اختبار بمرحلة قابلة للقياس", startedOn: "2024-01-01", targetEndOn: "2027-12-31", changeReason: `E2E ${run} ${suffix}` });
      await project.locator('[name="siteId"]').selectOption({ label: `${locale === "ar" ? "موقع" : "Site"} ${code}` });
      await project.getByRole("button").click();
      await expect(project.getByRole("status")).toBeVisible();
      await page.reload();
      await revealForms(page);
      const task = page.locator("form").filter({ has: page.locator('[name="taskKey"]:not([readonly])') });
      await task.locator('[name="projectId"]').selectOption({ label: `${code} · ${locale === "ar" ? "مشروع" : "Projet"} ${code}` });
      await fill(task, { taskKey: code, titleFr: `Jalon ${code}`, titleAr: `مرحلة ${code}`, dueAt: "2024-11-01T10:00", descriptionFr: "Livraison vérifiable du projet", descriptionAr: "تسليم قابل للتحقق للمشروع", acceptanceCriteria: "Document reçu\nValidation du responsable", changeReason: `E2E ${run} ${suffix}` });
      await task.locator('[name="taskType"]').selectOption("MILESTONE");
      await task.locator('[name="status"]').selectOption("PENDING");
      await task.getByRole("button").click();
      await expect(task.getByRole("status")).toBeVisible();
      await page.reload();
      await revealForms(page);
      const savedTask = page.locator("form").filter({ has: page.locator(`[name="taskKey"][readonly][value="${code}"]`) });
      await expect(savedTask.locator('[name="taskType"]')).toHaveValue("MILESTONE");
      await expect(savedTask.locator('[name="status"]')).toHaveValue("PENDING");
      await expect(savedTask.locator('[name="acceptanceCriteria"]')).toHaveValue("Document reçu\nValidation du responsable");
      await expect(savedTask.locator('[name="dueAt"]')).toHaveValue("2024-11-01T10:00");
      const event = page.locator("form").filter({ has: page.locator('[name="startsAt"]') });
      await event.locator('[name="projectId"]').selectOption({ label: `${locale === "ar" ? "مشروع" : "Projet"} ${code} · ${code}` });
      await event.locator('[name="eventType"]').selectOption("CUSTOM");
      await fill(event, { titleFr: `Calendrier ${code}`, titleAr: `موعد ${code}`, startsAt: "2024-11-01T10:00", endsAt: "2024-11-01T11:00" });
      await event.getByRole("button").click();
      await expect(event.getByRole("status")).toBeVisible();
      await page.reload();
      await revealForms(page);
      const calendarEntry = page.locator("li").filter({ has: page.getByText(`${locale === "ar" ? "موعد" : "Calendrier"} ${code}`, { exact: true }) });
      await expect(calendarEntry).toContainText(new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(new Date("2024-11-01T09:00:00Z")));
      const center = page.locator("form").filter({ has: page.locator('[name="centerCode"]') });
      await fill(center, { centerCode: code, nameFr: `Centre ${code}`, nameAr: `مركز ${code}`, changeReason: `E2E ${run} ${suffix}` });
      await center.getByRole("button").click();
      await expect(center.getByRole("status")).toBeVisible();
      await page.reload();
      await revealForms(page);
      await expect(page.getByText(`${locale === "ar" ? "مركز" : "Centre"} ${code} · ${code}`, { exact: true }).first()).toBeVisible();
      const budget = page.locator("form").filter({ has: page.locator('[name="fiscalYear"]') });
      await budget.locator('[name="siteId"]').selectOption({ label: `${locale === "ar" ? "موقع" : "Site"} ${code}` });
      await budget.locator('[name="projectId"]').selectOption({ label: `${locale === "ar" ? "مشروع" : "Projet"} ${code} · ${code}` });
      await fill(budget, { fiscalYear: "2027", amount: "90071992547409,93", rationale: `E2E ${run} ${suffix}` });
      await budget.locator('input[type="checkbox"][name="approve"]').check();
      await budget.getByRole("button").click();
      await expect(budget.getByRole("status")).toBeVisible();
      await page.reload();
      await expect(page.locator(".client-portfolio-item").filter({ hasText: `${locale === "ar" ? "موقع" : "Site"} ${code}` }).filter({ hasText: "2027" })).toContainText(locale === "ar" ? "معتمد" : "Approuvé");
      await revealForms(page);
      const allocation = page.locator("form").filter({ has: page.locator('[name="evidenceFile"]') });
      const budgetOption = allocation.locator('[name="budgetId"] option').filter({ hasText: code });
      await expect(budgetOption).toHaveCount(1);
      await allocation.locator('[name="budgetId"]').selectOption(await budgetOption.evaluate(option => (option as HTMLOptionElement).value));
      await allocation.locator('[name="costCenterId"]').selectOption({ label: `${locale === "ar" ? "مركز" : "Centre"} ${code} · ${code}` });
      await allocation.locator('[name="projectId"]').selectOption({ label: `${locale === "ar" ? "مشروع" : "Projet"} ${code} · ${code}` });
      await allocation.locator('[name="referenceChoice"]').selectOption({ label: `${code} · ${locale === "ar" ? "مرحلة" : "Jalon"} ${code}` });
      await allocation.locator('[name="allocationType"]').selectOption("ACTUAL");
      await allocation.locator('[name="amount"]').fill("10,05");
      const evidence = await calendarEntry.screenshot();
      await writeFile(resolve("artifacts", "test-results", `p24-p26-completion-${run}`, `allocation-${suffix}.sha256`), createHash("sha256").update(evidence).digest("hex"));
      await allocation.locator('[name="evidenceFile"]').setInputFiles({ name: `recette-${suffix}.png`, mimeType: "image/png", buffer: evidence });
      await allocation.getByRole("button", { name: locale === "ar" ? "حفظ" : "Enregistrer", exact: true }).click();
      await expect(allocation.getByRole("status").filter({ hasText: locale === "ar" ? "تم تسجيل الإجراء" : "Action enregistrée" })).toBeVisible();
      await page.reload();
      await expect(page.locator("li").filter({ hasText: code }).filter({ hasText: locale === "ar" ? "نفقة فعلية" : "Dépense réalisée" })).toBeVisible();
      const progress = page.getByRole("progressbar").filter({ hasNot: page.locator("input") });
      const projectProgress = progress.and(page.locator(`[aria-label$="${locale === "ar" ? "مشروع" : "Projet"} ${code}"]`));
      await expect(projectProgress).toHaveAttribute("aria-valuenow", "0");
      for (const status of ["IN_PROGRESS", "SUBMITTED", "ACCEPTED"] as const) {
        await revealForms(page);
        await savedTask.locator('[name="status"]').selectOption(status);
        await savedTask.locator('[name="changeReason"]').fill(`E2E ${run} ${suffix} ${status}`);
        await savedTask.getByRole("button").click();
        await expect(savedTask.getByRole("status").filter({ hasText: locale === "ar" ? "تم تسجيل الإجراء" : "Action enregistrée" })).toBeVisible();
        await page.reload();
        await revealForms(page);
        await expect(savedTask.locator('[name="status"]')).toHaveValue(status);
        await expect(projectProgress).toHaveAttribute("aria-valuenow", status === "ACCEPTED" ? "100" : "0");
      }
    } finally { await context.close(); }
    const foreignState = process.env.E2E_CLIENT_B_STORAGE_STATE;
    if (!foreignState) throw new Error("FOREIGN_STATE_REQUIRED");
    const foreign = await browser.newContext({ storageState: foreignState, baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173" });
    try {
      const page = await foreign.newPage();
      await page.goto(`/${locale}/client/portefeuille`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(code);
    } finally { await foreign.close(); }
  });

  test(`MAT-FUNC-064 ${locale} saves and reloads versioned franchise digest preferences`, async ({ browser }, info) => {
    const state = process.env.E2E_FRANCHISE_STORAGE_STATE;
    if (!state) throw new Error("FRANCHISE_STATE_REQUIRED");
    const suffix = `${locale.toUpperCase()}_${info.project.name.includes("mobile") ? "M" : "D"}`;
    const context = await browser.newContext({ storageState: state, viewport: info.project.name.includes("mobile") ? { width: 360, height: 800 } : { width: 1280, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto(workspaceUrl(locale, "franchise/digest"));
      await settleVisualState(page);
      const form = page.locator("form").filter({ has: page.locator(`[name="franchiseId"][value="${process.env.E2E_FRANCHISE_ID}"]`) }).filter({ has: page.locator('[name="localSendTime"]') });
      await expect(form).toHaveCount(1);
      await form.locator('[name="frequency"]').selectOption("WEEKDAYS");
      await fill(form, { localSendTime: "09:15", timeZone: "Africa/Casablanca", changeReason: `E2E ${run} ${suffix}` });
      await form.locator('[name="notificationLocale"]').selectOption(`${locale}-MA`);
      await form.locator('[name="enabled"]').uncheck();
      await form.getByRole("button", { name: locale === "ar" ? "حفظ الإصدار" : "Enregistrer la version", exact: true }).click();
      await expect(form.getByRole("status")).toContainText(locale === "ar" ? "تم حفظ إعداد جديد" : "configuration");
      await page.reload();
      await expect(form.locator('[name="frequency"]')).toHaveValue("WEEKDAYS");
      await expect(form.locator('[name="localSendTime"]')).toHaveValue("09:15");
      await expect(form.locator('[name="timeZone"]')).toHaveValue("Africa/Casablanca");
      await expect(form.locator('[name="notificationLocale"]')).toHaveValue(`${locale}-MA`);
      await expect(form.locator('[name="enabled"]')).not.toBeChecked();
    } finally { await context.close(); }
  });
}
