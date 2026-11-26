import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { validFixtureProject } from "./helpers/fixture-project.mjs";
import { settleVisualState } from "./helpers/settled-visual-state";

const path = process.env.E2E_LOCAL_ADMIN_AB_MANIFEST;
if (!path) throw new Error("LOCAL_ADMIN_AB_MANIFEST_REQUIRED");
const manifest = JSON.parse(readFileSync(path, "utf8"));
if (!validFixtureProject(manifest) || Date.parse(manifest.expiresAt) <= Date.now()) {
  throw new Error("LOCAL_ADMIN_AB_MANIFEST_INVALID");
}

async function selectAction(page: import("@playwright/test").Page, actionId: string) {
  const row = page.locator(`tr[data-action-request-id="${actionId}"]`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.locator("button.admin-triage-select").click();
  await settleVisualState(page);
  await expect(page.locator(`.admin-treat-rail [data-action-request-id="${actionId}"]`).first()).toBeVisible();
}

test("Lot1 A/B: refuse as requester UI, authorize B as independent validator", async ({ browser }, info) => {
  test.setTimeout(180_000);
  const mobile = info.project.name.includes("mobile");
  const viewport = mobile ? { width: 360, height: 800 } : { width: 1280, height: 900 };
  const { actionA, actionB, requesterState, validatorState } = manifest;

  const requester = await browser.newContext({ storageState: requesterState, viewport });
  try {
    const page = await requester.newPage();
    await page.goto("/fr/administration/command-center");
    await settleVisualState(page);
    await selectAction(page, actionA.id);
    await selectAction(page, actionB.id);
    const panel = page.locator(`.admin-triage-forms[data-action-request-id="${actionB.id}"]`);
    await expect(panel).toBeVisible();
    await expect(panel.locator('button[name="decision"][value="APPROVE"]')).toHaveCount(0);
    await expect(panel.getByText(/validateur distinct|quatre yeux|consultation uniquement/i)).toBeVisible();
  } finally {
    await requester.close();
  }

  const validator = await browser.newContext({ storageState: validatorState, viewport });
  try {
    const page = await validator.newPage();
    await page.goto("/fr/administration/command-center");
    await settleVisualState(page);
    await selectAction(page, actionA.id);
    await selectAction(page, actionB.id);
    const form = page.locator("form").filter({
      has: page.locator(`input[name="actionRequestId"][value="${actionB.id}"]`),
    });
    await expect(form).toHaveCount(1);
    await form.locator('[name="reason"]').fill("E2E independent validator approves B only");
    await form.locator('button[name="decision"][value="APPROVE"]').click();
    // revalidatePath may remount and clear the success flash — wait for B to leave the decide form.
    await expect(page.locator(`input[name="actionRequestId"][value="${actionB.id}"]`)).toHaveCount(0, {
      timeout: 45_000,
    });
    await page.reload();
    await settleVisualState(page);
    await expect(page.locator(`tr[data-action-request-id="${actionA.id}"]`)).toBeVisible();
    await expect(page.locator(`input[name="actionRequestId"][value="${actionB.id}"]`)).toHaveCount(0);
    await selectAction(page, actionA.id);
    await expect(page.locator(`.admin-triage-forms[data-action-request-id="${actionA.id}"]`)).toBeVisible();
  } finally {
    await validator.close();
  }
});
