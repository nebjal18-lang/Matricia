import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { openMatFuncSession } from "./helpers/mat-func-session";

const copy = {
  fr: {
    decide: "Décider le livrable",
    compliant: "Conforme",
    noncompliant: "Non conforme",
    comment: "Commentaire",
    success: "Opération enregistrée",
    scanCron: "/api/workers/delivery-proof-scans",
  },
  ar: {
    decide: "اتخاذ قرار بشأن التسليم",
    compliant: "مطابق",
    noncompliant: "غير مطابق",
    comment: "تعليق",
    success: "تم تسجيل العملية",
    scanCron: "/api/workers/delivery-proof-scans",
  },
} as const;

async function prepareSubmittedDeliverable(page: Page, locale: keyof typeof copy) {
  await page.goto(`/${locale}/client/missions`);
  const decideButton = page.getByRole("button", { name: copy[locale].decide }).first();
  if (!(await decideButton.isVisible())) return null;
  const form = decideButton.locator("xpath=ancestor::form");
  const fieldsets = form.locator("fieldset");
  const count = await fieldsets.count();
  return { form, fieldsets, count };
}

test("FR records a contradictory per-criterion delivery decision", async ({ browser, request }) => {
  const clientState = process.env.E2E_CLIENT_STORAGE_STATE;
  const providerState = process.env.E2E_PROVIDER_STORAGE_STATE;
  const cronSecret = process.env.E2E_CRON_SECRET;
  test.skip(
    !clientState || !providerState || !cronSecret || !existsSync(clientState) || !existsSync(providerState),
    "P25 authenticated workflow (client, provider, E2E_CRON_SECRET) is required",
  );

  const provider = await openMatFuncSession(browser, providerState!, "fr", false);
  try {
    await provider.page.goto("/fr/sous-traitant/missions");
    const operations = provider.page.locator("#missions-operation");
    if ((await operations.count()) && !(await operations.evaluate((node) => (node as HTMLDetailsElement).open))) {
      await operations.locator("summary").click();
    }
    const deliveryForm = provider.page.getByRole("button", { name: "Soumettre le livrable" }).first().locator("xpath=ancestor::form");
    if (await deliveryForm.isVisible()) {
      await deliveryForm.getByLabel("Description du livrable").fill("Livrable MAT-FUNC-025 pour décision critère par critère");
      await deliveryForm.getByLabel(/Fichier de preuve/).setInputFiles({
        name: "preuve-mat-func-025.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7\nMAT-FUNC-025 deterministic proof\n"),
      });
      await deliveryForm.getByLabel("Note de preuve").fill("Preuve déterministe MAT-FUNC-025");
      await deliveryForm.getByRole("button", { name: "Soumettre le livrable" }).click();
      await expect(deliveryForm.getByRole("status")).toContainText("Opération enregistrée et auditée");
    }
  } finally {
    await provider.context.close();
  }

  const client = await openMatFuncSession(browser, clientState!, "fr", false);
  try {
    await client.page.goto("/fr/client/missions");
    if (await client.page.getByText(/scan fiable CLEAN/).first().isVisible()) {
      const scan = await request.post(`${copy.fr.scanCron}?limit=10`, {
        headers: { authorization: `Bearer ${cronSecret}` },
      });
      expect(scan.status()).toBe(200);
      await client.page.reload();
    }
    const prepared = await prepareSubmittedDeliverable(client.page, "fr");
    expect(prepared, "client must have at least one deliverable awaiting decision").toBeTruthy();
    const { form, fieldsets, count } = prepared!;
    for (let index = 0; index < count; index += 1) {
      const status = index === count - 1 && count > 1 ? copy.fr.noncompliant : copy.fr.compliant;
      await fieldsets.nth(index).locator('select[name="criterionStatus"]').selectOption(status);
      if (status === copy.fr.noncompliant) {
        await fieldsets.nth(index).locator('input[name="criterionComment"]').fill("Écart constaté sur le critère MAT-FUNC-025");
      }
    }
    if (count === 1) {
      await fieldsets.first().locator('select[name="criterionStatus"]').selectOption(copy.fr.noncompliant);
      await fieldsets.first().locator('input[name="criterionComment"]').fill("Refus contrôlé MAT-FUNC-025");
    }
    await form.getByLabel(copy.fr.comment).first().fill("Décision contradictoire enregistrée par critère");
    await form.getByRole("button", { name: copy.fr.decide }).click();
    await expect(form.getByRole("status")).toContainText(copy.fr.success);
  } finally {
    await client.context.close();
  }
});

test("AR exposes criterion-by-criterion decision controls when a deliverable is submitted", async ({ browser }, testInfo) => {
  const clientState = process.env.E2E_CLIENT_STORAGE_STATE;
  test.skip(!clientState || !existsSync(clientState), "E2E_CLIENT_STORAGE_STATE is required");
  const mobile = testInfo.project.name.includes("mobile");
  const client = await openMatFuncSession(browser, clientState!, "ar", mobile);
  try {
    const prepared = await prepareSubmittedDeliverable(client.page, "ar");
    if (!prepared) {
      await expect(client.page.getByRole("heading", { level: 1, name: "العقود والمهام" })).toBeVisible();
      return;
    }
    await expect(prepared.fieldsets.first().locator('select[name="criterionStatus"]')).toBeVisible();
    await expect(prepared.form.getByRole("button", { name: copy.ar.decide })).toBeVisible();
  } finally {
    await client.context.close();
  }
});
