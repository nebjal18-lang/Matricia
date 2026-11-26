import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { validFixtureProject } from './helpers/fixture-project.mjs';
import { settleVisualState } from './helpers/settled-visual-state';

const path = process.env.E2E_LOCAL_CLIENT_JOURNEY_MANIFEST;
if (!path) throw new Error('LOCAL_RECURRING_MANIFEST_REQUIRED');
const manifest = JSON.parse(readFileSync(path, 'utf8'));
if (!validFixtureProject(manifest) || Date.parse(manifest.expiresAt) <= Date.now()) throw new Error('LOCAL_RECURRING_MANIFEST_INVALID');

for (const locale of ['fr', 'ar'] as const) {
  test(`MAT-FUNC-049/050 ${locale} clone and govern all three recurring cadences`, async ({ browser }, info) => {
    test.setTimeout(180_000);
    const item = manifest.cases[locale] as { state: string; organizationId: string; description: string };
    const context = await browser.newContext({ storageState: item.state, viewport: info.project.name.includes('mobile') ? { width: 360, height: 800 } : { width: 1280, height: 900 } });
    try {
      const page = await context.newPage();
      const url = `/${locale}/client/demandes/recurrence?organizationId=${item.organizationId}`;
      await page.goto(url);
      await settleVisualState(page);
      const clone = page.locator('form').filter({ has: page.locator('[name="sourceRequestId"]') });
      const source = await clone.locator('option').filter({ hasText: item.description }).first().getAttribute('value');
      if (!source) throw new Error('REAL_UI_SOURCE_REQUEST_REQUIRED');
      await clone.locator('[name="sourceRequestId"]').selectOption(source);
      await clone.locator('[name="reason"]').fill(`E2E clone ${info.project.name}`);
      await clone.getByRole('button').click();
      const draft = clone.getByRole('link');
      await expect(draft).toBeVisible();
      const href = await draft.getAttribute('href');
      expect(href).toMatch(/\/client\/demandes\/[a-f0-9-]{36}/);
      expect(href).not.toContain(source);
      expect(href).toContain(`organizationId=${item.organizationId}`);
      await draft.click();
      await expect(page.locator('body')).toContainText(item.description);
      await page.reload();
      await expect(page.locator('body')).toContainText(item.description);
      for (const cadence of ['MONTHLY', 'QUARTERLY', 'ANNUALLY']) {
        await page.goto(url);
        await settleVisualState(page);
        const create = page.locator('form').filter({ has: page.locator('[name="templateRequestId"]') });
        const before = new Set(await page.locator('input[name="planId"]').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value)));
        await create.locator('[name="templateRequestId"]').selectOption(source);
        await create.locator('[name="cadence"]').selectOption(cadence);
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date());
        await create.locator('[name="startsOn"]').fill(today);
        await create.locator('[name="reason"]').fill(`E2E ${cadence} ${info.project.name}`);
        await create.getByRole('button').click();
        await expect(create.getByRole('status')).toContainText(locale === 'fr' ? 'Le plan récurrent a été créé.' : 'تم إنشاء الخطة المتكررة.');
        await page.reload();
        const after = await page.locator('input[name="planId"]').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
        const added = [...new Set(after)].filter(id => !before.has(id));
        expect(added).toHaveLength(1);
        const plan = page.locator('article').filter({ has: page.locator(`input[name="planId"][value="${added[0]}"]`) });
        const generate = plan.locator('form').filter({ has: page.locator('[name="throughDate"]') });
        const horizon = await generate.locator('[name="throughDate"]').getAttribute('max');
        if (!horizon) throw new Error('BOUNDED_GENERATION_HORIZON_REQUIRED');
        await generate.locator('[name="throughDate"]').fill(horizon);
        await generate.locator('[name="maxOccurrences"]').fill('2');
        await generate.getByRole('button').click();
        await expect(generate.getByRole('status')).toContainText(/2\./);
        await page.reload();
        await expect(plan.locator('ol li')).toHaveCount(2);
        for (const action of ['PAUSE', 'RESUME', 'END']) {
          const transition = plan.locator('form').filter({ has: page.locator('[name="expectedRowVersion"]') });
          await transition.locator('[name="reason"]').fill('E2E governed transition');
          await transition.locator(`button[value="${action}"]`).click();
          if (action === 'END') {
            await expect(page.locator(`input[name="planId"][value="${added[0]}"]`)).toHaveCount(0);
          } else {
            await expect(transition.locator(`button[value="${action === 'PAUSE' ? 'RESUME' : 'PAUSE'}"]`)).toBeVisible();
            await expect(generate).toHaveCount(action === 'PAUSE' ? 0 : 1);
          }
          await page.reload();
        }
      }
    } finally { await context.close(); }
  });
}
