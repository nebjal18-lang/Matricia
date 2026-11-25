import { expect, test } from "@playwright/test";
import { getPublicJourneyCopy } from "../../../apps/web/modules/public/data/journey/copy";

test.setTimeout(90_000);

for (const locale of ["fr", "ar"] as const) {
  test(`eight-answer diagnostic carries the chosen sales priority into an editable need (${locale})`, async ({ page, baseURL }) => {
    expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1|\[::1\])$/u);
    const copy = getPublicJourneyCopy(locale);
    await page.goto(`/${locale}/diagnostic`);
    await page.evaluate(() => {
      localStorage.removeItem("matricia.public-diagnostic.v2");
      localStorage.removeItem("matricia.public-need");
    });
    await page.reload();

    const choices = [3, 1, null, 1, 1, 2, 2] as const;
    for (const [index, choice] of choices.entries()) {
      const question = copy.diagnostic.questions[index]!;
      await expect(page.getByRole("heading", { level: 2, name: String(question[0]) })).toBeVisible();
      if (index === 2) {
        await page.getByRole("button", { name: question[2][1]!, exact: true }).click();
        await page.getByRole("button", { name: question[2][2]!, exact: true }).click();
      } else if (choice !== null) {
        await page.getByRole("radio", { name: question[2][choice]!, exact: true }).click();
      }
      await page.getByRole("button", { name: copy.diagnostic.next, exact: true }).click();
    }
    const action = "Améliorer le suivi des devis et la rentabilité des chantiers.";
    await page.getByRole("textbox", { name: String(copy.diagnostic.questions[7]![0]) }).fill(action);
    await page.getByRole("button", { name: copy.diagnostic.next, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: copy.diagnostic.recapTitle })).toBeVisible();
    await page.getByRole("button", { name: copy.diagnostic.analyze, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: copy.diagnostic.resultTitle })).toBeVisible();
    await expect(page.getByRole("note")).toContainText(locale === "fr" ? "rentabilité par chantier reste à mesurer" : "ربحية كل ورش ما زالت بحاجة إلى قياس");
    await page.getByRole("radio", { name: copy.diagnostic.priorities.sales[0] }).click();
    await page.reload();
    await expect(page.getByRole("radio", { name: copy.diagnostic.priorities.sales[0] })).toBeChecked();
    await page.getByRole("link", { name: copy.diagnostic.assist, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/besoin\\?source=diagnostic&priority=sales`));
    const need = page.getByRole("textbox", { name: `1. ${copy.need.stages.describe[0]}` });
    await expect(need).toHaveValue(new RegExp(action));
    await expect(need).toHaveValue(new RegExp(copy.diagnostic.priorities.sales[0]));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("matricia.public-need") ?? "{}") as { constraints?: string; classification?: unknown; diagnosticPriority?: string });
    expect(saved.diagnosticPriority).toBe("sales");
    expect(saved.constraints).toContain(copy.diagnostic.questions[0]![2][3]);
    expect(saved.constraints).toContain(copy.diagnostic.questions[2]![2][1]);
    expect(saved.constraints).toContain(copy.diagnostic.questions[2]![2][2]);
    expect(saved.constraints).toContain(copy.diagnostic.questions[4]![2][1]);
    expect(saved.classification).toBeNull();
    await need.fill(`${action} Devis de rénovation et coûts par chantier.`);
    await page.reload();
    await expect(need).toHaveValue(/Devis de rénovation et coûts par chantier/u);
  });
}

test("an existing need draft is not replaced without the user's choice", async ({ page, baseURL }) => {
  expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1|\[::1\])$/u);
  await page.goto("/fr/besoin");
  await page.evaluate(() => {
    localStorage.setItem("matricia.public-need", JSON.stringify({ version: 3, step: 0, need: "Mon ancien projet de rénovation", location: "Rabat", timing: "", constraints: "", expiresAt: Date.now() + 86_400_000 }));
    localStorage.setItem("matricia.public-diagnostic.v2", JSON.stringify({ version: 2, step: 8, answers: { sector: "construction", team_size: "small", goals: ["grow_sales"], priority_tracking: "partial", sales_tracking: "manual", backup_restore: "no", decision_trace: "no", next_action: "Suivre les devis des chantiers" }, expiresAt: Date.now() + 86_400_000 }));
  });
  await page.goto("/fr/besoin?source=diagnostic&priority=sales");
  await expect(page.getByRole("heading", { name: "Vous avez déjà un brouillon de besoin" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("matricia.public-need") ?? "{}") as { need?: string })).toMatchObject({ need: "Mon ancien projet de rénovation" });
  await page.getByRole("button", { name: "Reprendre mon brouillon" }).click();
  await expect(page.getByRole("textbox", { name: "1. Décrire le besoin" })).toHaveValue("Mon ancien projet de rénovation");
  await expect(page).toHaveURL(/\/fr\/besoin$/u);
  await page.goto("/fr/besoin?source=diagnostic&priority=sales");
  await page.getByRole("button", { name: "Commencer depuis le diagnostic" }).click();
  await expect(page.getByRole("textbox", { name: "1. Décrire le besoin" })).toHaveValue(/Suivre les devis des chantiers/u);
});
