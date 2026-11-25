import { existsSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { openMatFuncSession, type MatFuncLocale } from "./helpers/mat-func-session";

type ProviderCase = { description: string; invitationId: string };

const copy = {
  fr: {
    heading: "Vos devis",
    organization: "Organisation prestataire",
    choose: "Afficher",
    accept: "Accepter",
    save: "Créer la nouvelle version",
    completeness: "Complétude avant création de version",
    validation: "Vérifiez les champs indiqués et les montants.",
  },
  ar: {
    heading: "عروضكم",
    organization: "منظمة مقدم الخدمات",
    choose: "عرض",
    accept: "قبول",
    save: "إنشاء نسخة جديدة",
    completeness: "الاكتمال قبل إنشاء النسخة",
    validation: "تحقق من الحقول والمبالغ.",
  },
} as const;

function p23Configuration() {
  const required = [
    "E2E_PROVIDER_STORAGE_STATE",
    "E2E_P23_TARGET_ORGANIZATION_ID",
    "E2E_P23_DECOY_ORGANIZATION_ID",
    "E2E_P23_CASES",
  ] as const;
  if (required.some((key) => !process.env[key])) return null;
  try {
    return {
      providerState: process.env.E2E_PROVIDER_STORAGE_STATE!,
      targetId: process.env.E2E_P23_TARGET_ORGANIZATION_ID!,
      decoyId: process.env.E2E_P23_DECOY_ORGANIZATION_ID!,
      cases: JSON.parse(process.env.E2E_P23_CASES!) as Record<string, ProviderCase>,
    };
  } catch {
    return null;
  }
}

async function openQuoteCard(page: Page, locale: MatFuncLocale, config: NonNullable<ReturnType<typeof p23Configuration>>, mobile: boolean) {
  const scenario = config.cases[`${locale}-${mobile ? "mobile" : "desktop"}`];
  expect(scenario, "P23 case key must exist for locale and viewport").toBeTruthy();
  await page.goto(`/${locale}/sous-traitant/devis?organizationId=${config.decoyId}`);
  await page.getByLabel(copy[locale].organization).selectOption(config.targetId);
  await page.getByRole("button", { name: copy[locale].choose }).click();
  await page.goto(`/${locale}/sous-traitant/devis?organizationId=${config.targetId}&invitationId=${scenario!.invitationId}`);
  const operations = page.locator("#devis-operation");
  if ((await operations.count()) && !(await operations.evaluate((node) => (node as HTMLDetailsElement).open))) {
    await operations.locator("summary").click();
  }
  const scenarioLabel = operations.getByText(scenario!.description, { exact: true });
  const card = operations.locator('[data-slot="card"]').filter({ has: scenarioLabel });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: copy[locale].accept }).click();
  await expect(card.locator('[name="solution"]')).toBeVisible();
  return card;
}

async function fillCompleteQuote(card: Locator) {
  await card.locator('[name="solution"]').fill("Solution E2E MAT-FUNC-014");
  await card.locator('[name="deliverables"]').fill("Livrable A\nLivrable B");
  await card.locator('[name="warranty"]').fill("Garantie douze mois");
  await card.locator('[name="correctionTerms"]').fill("Corrections incluses");
  await card.locator('[name="paymentTerms"]').fill("Paiement à réception");
  await card.locator('[name="proposedStartDate"]').fill(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));
  await card.locator('[name="durationDays"]').fill("10");
  await card.locator('[name="validUntil"]').fill(new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 16));
  await card.locator('[name="lineLabel"]').fill("Forfait E2E");
  await card.locator('[name="quantity"]').fill("1");
  await card.locator('[name="unitCode"]').fill("FORFAIT");
  await card.locator('[name="unitPrice"]').fill("1250,50");
  await card.locator('[name="taxRuleVersionId"]').selectOption({ index: 1 });
  await card.locator('[name="changeReason"]').fill("Version de recette MAT-FUNC-014");
}

type MandatoryCase = { id: string; label: string; breakField: (card: Locator) => Promise<void> };

const mandatoryCases: MandatoryCase[] = [
  { id: "solution", label: "solution", breakField: async (card) => card.locator('[name="solution"]').fill("") },
  { id: "deliverables", label: "deliverables", breakField: async (card) => card.locator('[name="deliverables"]').fill("") },
  { id: "paymentTerms", label: "paymentTerms", breakField: async (card) => card.locator('[name="paymentTerms"]').fill("") },
  { id: "warranty", label: "warranty", breakField: async (card) => card.locator('[name="warranty"]').fill("") },
  { id: "correctionTerms", label: "correctionTerms", breakField: async (card) => card.locator('[name="correctionTerms"]').fill("") },
  { id: "proposedStartDate", label: "proposedStartDate", breakField: async (card) => card.locator('[name="proposedStartDate"]').fill("") },
  { id: "durationDays", label: "durationDays", breakField: async (card) => card.locator('[name="durationDays"]').fill("") },
  { id: "validUntil", label: "validUntil", breakField: async (card) => card.locator('[name="validUntil"]').fill("") },
  { id: "lineLabel", label: "lineLabel", breakField: async (card) => card.locator('[name="lineLabel"]').fill("") },
  { id: "quantity", label: "quantity", breakField: async (card) => card.locator('[name="quantity"]').fill("") },
  { id: "unitCode", label: "unitCode", breakField: async (card) => card.locator('[name="unitCode"]').fill("") },
  { id: "unitPrice", label: "unitPrice", breakField: async (card) => card.locator('[name="unitPrice"]').fill("") },
  { id: "taxRuleVersionId", label: "taxRuleVersionId", breakField: async (card) => card.locator('[name="taxRuleVersionId"]').selectOption({ index: 0 }) },
  { id: "changeReason", label: "changeReason", breakField: async (card) => card.locator('[name="changeReason"]').fill("") },
];

for (const locale of ["fr", "ar"] as const) {
  test.describe(`MAT-FUNC-014 ${locale.toUpperCase()} quote completeness`, () => {
    test.beforeEach(({ browser }, testInfo) => {
      const config = p23Configuration();
      const state = config?.providerState;
      const mobile = testInfo.project.name.includes("mobile");
      test.skip(!config || !state || !existsSync(state), "P23 secured provider fixture (E2E_PROVIDER_STORAGE_STATE, E2E_P23_*) is required");
      test.skip(!config?.cases[`${locale}-${mobile ? "mobile" : "desktop"}`], "P23 case missing for locale/viewport");
    });

    test("empty revision form stays incomplete and blocks version creation", async ({ browser }, testInfo) => {
      const config = p23Configuration()!;
      const mobile = testInfo.project.name.includes("mobile");
      const { context, page } = await openMatFuncSession(browser, config.providerState, locale, mobile);
      try {
        const card = await openQuoteCard(page, locale, config, mobile);
        await expect(card.getByText(copy[locale].completeness)).toBeVisible();
        const progress = card.locator('progress[aria-label="' + copy[locale].completeness + '"]');
        await expect(progress).toHaveAttribute("value", "0");
        const saveButton = card.getByRole("button", { name: copy[locale].save });
        await expect(saveButton).toBeDisabled();
        await expect(card.getByText(copy[locale].validation)).toBeVisible();
      } finally {
        await context.close();
      }
    });

    for (const omission of mandatoryCases) {
      test(`omitting ${omission.id} keeps completeness below 100% and blocks save`, async ({ browser }, testInfo) => {
        const config = p23Configuration()!;
        const mobile = testInfo.project.name.includes("mobile");
        const { context, page } = await openMatFuncSession(browser, config.providerState, locale, mobile);
        try {
          const card = await openQuoteCard(page, locale, config, mobile);
          await fillCompleteQuote(card);
          await omission.breakField(card);
          await card.locator('[name="solution"]').dispatchEvent("input");
          const progress = card.locator('progress[aria-label="' + copy[locale].completeness + '"]');
          const value = Number(await progress.getAttribute("value"));
          expect(value, `completeness must stay below 10000 when ${omission.id} is empty`).toBeLessThan(10_000);
          const output = card.locator("output").first();
          const percent = Number(await output.innerText());
          expect(percent).toBeLessThan(100);
          await expect(card.getByRole("button", { name: copy[locale].save })).toBeDisabled();
        } finally {
          await context.close();
        }
      });
    }
  });
}
