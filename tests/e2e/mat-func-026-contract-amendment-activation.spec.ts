import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openMatFuncSession } from "./helpers/mat-func-session";

const copy = {
  fr: {
    missions: "Contrats et missions",
    amend: "Demander un avenant",
    amendments: "Avenants",
    draftSuccess: "Opération enregistrée",
    submitSignature: "Envoyer à la signature",
    signatureSuccess: "Version transmise au circuit de signature",
  },
  ar: {
    missions: "العقود والمهام",
    amend: "طلب ملحق",
    amendments: "ملاحق العقود",
    draftSuccess: "تم تسجيل العملية",
    submitSignature: "إرسال للتوقيع",
    signatureSuccess: "تم إرسال النسخة إلى مسار التوقيع",
  },
} as const;

async function draftAmendment(page: import("@playwright/test").Page, locale: keyof typeof copy) {
  await page.goto(`/${locale}/client/missions`);
  await expect(page.getByRole("heading", { level: 1, name: copy[locale].missions })).toBeVisible();
  const details = page.locator("details").filter({ has: page.getByText(copy[locale].amend, { exact: true }) }).first();
  await expect(details, "an ACTIVE contract must expose amendment drafting").toBeVisible();
  await details.locator("summary").click();
  const form = details.locator("form");
  await form.getByLabel(locale === "fr" ? "Motif" : "السبب").fill("MAT-FUNC-026 : périmètre supplémentaire demandé par le Client");
  await form.getByLabel(locale === "fr" ? "Modification du périmètre à convenir" : "تعديل النطاق المطلوب الاتفاق عليه").fill(
    "Ajout d'un rapport d'audit complémentaire et d'une revue de sécurité.",
  );
  await form.getByLabel(locale === "fr" ? "Écart de prix en unités mineures" : "فرق السعر بالوحدة الصغرى").fill("5000");
  await form.getByLabel(locale === "fr" ? "Écart de délai en jours" : "فرق الأجل بالأيام").fill("7");
  await form.getByRole("button", { name: copy[locale].amend }).click();
  await expect(form.getByRole("status")).toContainText(copy[locale].draftSuccess);
}

test("FR drafts an amendment then reaches pending signature when allowed", async ({ browser }) => {
  const clientState = process.env.E2E_CLIENT_STORAGE_STATE;
  test.skip(!clientState || !existsSync(clientState), "E2E_CLIENT_STORAGE_STATE is required");
  const client = await openMatFuncSession(browser, clientState!, "fr", false);
  try {
    await draftAmendment(client.page, "fr");
    await client.page.reload();
    await expect(client.page.getByRole("heading", { name: copy.fr.amendments })).toBeVisible();
    const submit = client.page.getByRole("button", { name: copy.fr.submitSignature }).first();
    if (await submit.isVisible()) {
      await submit.click();
      await expect(client.page.getByRole("status").filter({ hasText: copy.fr.signatureSuccess })).toBeVisible();
    } else {
      await expect(client.page.getByText(/Brouillon|En attente|DRAFT|PENDING/i).first()).toBeVisible();
    }
  } finally {
    await client.context.close();
  }
});

test("AR amendment section is reachable on contracts and missions", async ({ browser }, testInfo) => {
  const clientState = process.env.E2E_CLIENT_STORAGE_STATE;
  test.skip(!clientState || !existsSync(clientState), "E2E_CLIENT_STORAGE_STATE is required");
  const mobile = testInfo.project.name.includes("mobile");
  const client = await openMatFuncSession(browser, clientState!, "ar", mobile);
  try {
    await client.page.goto("/ar/client/contrats");
    await expect(client.page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(client.page.getByRole("heading", { name: copy.ar.amendments })).toBeVisible();
  } finally {
    await client.context.close();
  }
});
