import { expect, test, type Page } from "@playwright/test";
import { getPublicJourneyCopy } from "../../../apps/web/modules/public/data/journey/copy";
import { diagnosticQuestionIds } from "../../../apps/web/modules/public/data/journey/diagnostic-contract";

test.setTimeout(90_000);

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
}

for (const locale of ["fr", "ar"] as const) {
  test(`M12/M13/M14/M23/M24: diagnostic réel et besoin conservé ${locale}, sans soumission`, async ({ page, baseURL }, testInfo) => {
    expect(new URL(baseURL!).hostname, "Cette recette est réservée au serveur local isolé").toMatch(/^(localhost|127\.0\.0\.1|\[::1\])$/u);
    const copy = getPublicJourneyCopy(locale);
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    });

    await page.goto(`/${locale}/diagnostic`);
    await page.evaluate(() => {
      localStorage.removeItem("matricia.public-diagnostic.v2");
      localStorage.removeItem("matricia.public-need");
    });
    await page.reload();
    const choices = [3, 1, 1, 2, 1, 4, 1] as const;
    for (const [index, choice] of choices.entries()) {
      const question = copy.diagnostic.questions[index]!;
      await expect(page.getByRole("heading", { level: 2, name: String(question[0]), exact: true })).toBeVisible();
      await page.getByRole(index === 2 ? "button" : "radio", { name: question[2][choice]!, exact: true }).click();
      await page.getByRole("button", { name: copy.diagnostic.next, exact: true }).click();
    }
    const declaredAction = "Organiser mon chantier — خطتي الأصلية";
    await page.getByRole("textbox", { name: String(copy.diagnostic.questions[7]![0]) }).fill(declaredAction);
    await page.getByRole("button", { name: copy.diagnostic.next, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: copy.diagnostic.recapTitle })).toBeVisible();
    const expectedAnswers = [...choices.map((choice, index) => copy.diagnostic.questions[index]![2][choice]!), declaredAction];
    for (const [index, id] of diagnosticQuestionIds.entries()) {
      const row = page.locator(`[data-question="${id}"]`);
      await expect(row).toContainText(copy.diagnostic.questionLabels[id]);
      await expect(row).toContainText(expectedAnswers[index]!);
    }
    await page.getByRole("button", { name: copy.diagnostic.analyze, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: copy.diagnostic.resultTitle })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(copy.diagnostic.priorities.security[0], { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: copy.diagnostic.viewDetail, exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: copy.diagnostic.priorities.organization[0] })).toBeVisible();
    const trace = page.locator("[data-answer-trace]");
    await expect(trace.locator('[data-question="priority_tracking"]')).toContainText(copy.diagnostic.questions[3]![0]);
    await expect(trace.locator('[data-question="priority_tracking"]')).toContainText(copy.diagnostic.questions[3]![2][2]!);
    await expect(trace).not.toContainText(copy.diagnostic.priorities.organization[3]);
    const plan = page.getByRole("region", { name: copy.diagnostic.detailPlanTitle });
    await expect(plan.locator("[data-action-step]")).toHaveCount(3);
    for (const [index, action] of copy.diagnostic.actionPlans.organization.entries()) {
      const step = plan.locator(`[data-action-step="${index + 1}"]`);
      await expect(step).toContainText(action.action);
      await expect(step).toContainText(action.deliverable);
      await expect(step).toContainText(action.owner);
      await expect(step).toContainText(action.done);
    }
    await expect(page.getByRole("link", { name: copy.diagnostic.detailHelp })).toHaveAttribute("href", `/${locale}/a-propos`);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("link", { name: copy.diagnostic.prepareNeed, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/besoin\\?`));

    // Create the same French free-text draft first, then verify its Arabic
    // continuation. Only catalogue labels change language, never user input.
    await page.goto("/fr/besoin");
    const originalNeed = "Rénover un local et suivre les travaux à Casablanca.";
    await page.getByRole("textbox", { name: "1. Décrire le besoin", exact: true }).fill(originalNeed);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Continuer", exact: true }).first().click();
    await page.locator("#need-library").selectOption("BTP");
    await page.locator("#need-service").selectOption("BTP-RENOV");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("matricia.public-need") ?? "{}").classification?.serviceCode)).toBe("BTP-RENOV");
    if (locale === "ar") await page.goto("/ar/besoin");
    await expect(page.locator("#need-service")).toHaveValue("BTP-RENOV");
    if (locale === "ar") {
      await expect(page.locator('#need-service option[value="BTP-RENOV"]')).toContainText("الاسم العربي غير متاح");
      await expect(page.getByRole("note")).toContainText("أسماء عربية معتمدة");
    }
    await expect(page.getByText(originalNeed, { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: copy.need.continue, exact: true }).first().click();
    await page.locator("#need-location").fill("Casablanca — الدار البيضاء");
    await page.locator("#need-timing").fill("Trois mois");
    await page.locator("#need-constraints").fill("Accès uniquement en journée");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: copy.need.continue, exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 2, name: `4. ${copy.need.stages.complete[0]}`, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: copy.need.docsStepTitle, exact: true })).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "5");
    await expectNoHorizontalOverflow(page);
    const seeRecap = locale === "fr" ? "Voir le récapitulatif" : "عرض الملخص";
    await page.getByRole("button", { name: seeRecap, exact: true }).first().click();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "5");
    await expect(page.getByText(originalNeed, { exact: true })).toBeVisible();
    await expect(page.getByText("Trois mois", { exact: true })).toBeVisible();
    await expect(page.getByText("Accès uniquement en journée", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({path:testInfo.outputPath("need-recap-verified.png"),fullPage:true});
    await page.getByRole("button", { name: copy.need.back, exact: true }).click();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
    await page.getByRole("button", { name: copy.need.back, exact: true }).click();
    await expect(page.locator("#need-location")).toHaveValue("Casablanca — الدار البيضاء");
    await expect(page.locator("#need-timing")).toHaveValue("Trois mois");
    await expect(page.locator("#need-constraints")).toHaveValue("Accès uniquement en journée");
    await expectNoHorizontalOverflow(page);
    expect(mutations, "La recette ne soumet ni diagnostic, ni demande, ni mutation métier").toEqual([]);
  });
}
