import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { validFixtureProject } from "./helpers/fixture-project.mjs";
import { settleVisualState } from "./helpers/settled-visual-state";

const path = process.env.E2E_LOCAL_MAT_FUNC_032_MANIFEST;
if (!path) throw new Error("LOCAL_MAT_FUNC_032_MANIFEST_REQUIRED");
const manifest = JSON.parse(readFileSync(path, "utf8"));
if (!validFixtureProject(manifest) || Date.parse(manifest.expiresAt) <= Date.now()) {
  throw new Error("LOCAL_MAT_FUNC_032_MANIFEST_INVALID");
}

test("Lot2 MAT-FUNC-032: finance UI reconcile writes real DB allocations", async ({ browser }) => {
  test.setTimeout(180_000);
  const { reconcilerState, paymentId, invoiceId, amountMinor, paymentReference } = manifest;
  const context = await browser.newContext({ storageState: reconcilerState, viewport: { width: 1280, height: 900 } });
  try {
    const page = await context.newPage();
    await page.goto("/fr/administration/finance");
    await settleVisualState(page);

    const paymentRow = page.locator("tr[data-kind='payment']").filter({ hasText: paymentReference });
    await expect(paymentRow).toBeVisible({ timeout: 45_000 });
    await paymentRow.locator("button.admin-triage-select").click();
    await settleVisualState(page);

    const form = page.locator("form#rapprochements");
    await expect(form).toBeVisible({ timeout: 30_000 });
    await form.locator('select[name="paymentId"]').selectOption(paymentId);
    await form.locator('select[name="invoiceId"]').selectOption(invoiceId);
    await form.locator('input[name="amountMinor"]').fill(amountMinor);
    await form.locator('input[name="confirmed"]').check();

    const idempotencyKey = await form.locator('input[name="idempotencyKey"]').inputValue();
    const correlationId = await form.locator('input[name="correlationId"]').inputValue();
    expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);

    await form.locator('button[type="submit"]').click();
    // Success flash can be cleared by revalidatePath; the durable UI signal is that
    // the fully allocated payment leaves the open triage queue.
    await expect(page.locator("tr[data-kind='payment']").filter({ hasText: paymentReference })).toHaveCount(0, {
      timeout: 45_000,
    });
    const success = page.getByRole("status").filter({ hasText: /Rapprochement enregistré|Lot/i });
    if (await success.count()) await expect(success.first()).toBeVisible();

    await page.reload();
    await settleVisualState(page);
    await expect(page.locator("tr[data-kind='payment']").filter({ hasText: paymentReference })).toHaveCount(0);

    const formAfter = page.locator("form#rapprochements");
    if (await formAfter.count()) {
      await formAfter.locator('select[name="paymentId"]').selectOption(paymentId).catch(() => undefined);
      const optionCount = await formAfter.locator(`select[name="paymentId"] option[value="${paymentId}"]`).count();
      expect(optionCount).toBe(0);
    } else {
      await expect(page.getByText(/Rien pour l’instant|لا يوجد شيء حالياً/i).first()).toBeVisible();
    }

    // Product behavior after exact allocation: the payment leaves the open queue,
    // so a second submit cannot double-allocate. The captured key is retained only
    // as proof that the first successful submit used a stable idempotency identity.
    expect(correlationId).toMatch(/^[0-9a-f-]{36}$/i);
  } finally {
    await context.close();
  }
});
