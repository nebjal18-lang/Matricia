import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { validFixtureProject } from './helpers/fixture-project.mjs';
import { settleVisualState } from './helpers/settled-visual-state';

const path = process.env.E2E_LOCAL_ADMIN_DECISIONS_MANIFEST;
if (!path) throw new Error('LOCAL_ADMIN_MANIFEST_REQUIRED');
const manifest = JSON.parse(readFileSync(path, 'utf8'));
if (!validFixtureProject(manifest) || Date.parse(manifest.expiresAt) <= Date.now()) throw new Error('LOCAL_ADMIN_MANIFEST_INVALID');
for (const locale of ['fr', 'ar'] as const) {
  test(`MAT-FUNC-066/068 ${locale} admin claims and resolves risk and exception with human reasons`, async ({ browser }, info) => {
    test.setTimeout(120_000);
    const suffix = `${locale}_${info.project.name.includes('mobile') ? 'M' : 'D'}`;
    const context = await browser.newContext({ storageState: manifest.states.centralAal2.path, viewport: info.project.name.includes('mobile') ? {width:360,height:800} : {width:1280,height:900} });
    try {
      const page = await context.newPage();
      for (const item of manifest.items.filter((item: {suffix:string}) => item.suffix === suffix)) {
        await page.goto(`/${locale}/administration/command-center`);
        await settleVisualState(page);
        const choice = page.getByRole('button').filter({hasText:item.title});
        await choice.filter({visible:true}).click();
        const form = page.locator('form').filter({has:page.locator(`input[name="workItemId"][value="${item.id}"]`)});
        await expect(form).toHaveCount(1);
        await form.locator('[name="reason"]').fill(`E2E human claim ${suffix}`);
        await form.locator('button[type="submit"]').click();
        await expect(form.locator('[name="resolutionCode"]')).toBeVisible();
        await page.reload();
        await page.getByRole('button').filter({hasText:item.title}).filter({visible:true}).click();
        await form.locator('[name="resolutionCode"]').selectOption(item.kind === 'RISK_FLAG' ? 'FALSE_POSITIVE' : 'COMPLETED');
        await form.locator('[name="reason"]').fill(`E2E reviewed evidence and human decision ${suffix}`);
        await form.locator('button[type="submit"]').click();
        await expect(page.getByRole('button').filter({hasText:item.title})).toHaveCount(0);
        await page.reload();
        await expect(page.getByRole('button').filter({hasText:item.title})).toHaveCount(0);
      }
      const foreign = await browser.newContext({storageState:manifest.states.clientB.path});
      try {
        const denied = await foreign.newPage();
        await denied.goto(`/${locale}/administration/command-center`);
        await expect(denied.locator('input[name="workItemId"]')).toHaveCount(0);
      } finally { await foreign.close(); }
    } finally { await context.close(); }
  });
}
