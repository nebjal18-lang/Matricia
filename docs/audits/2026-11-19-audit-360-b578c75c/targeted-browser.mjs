import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const evidence = fileURLToPath(new URL('./evidence/', import.meta.url));
const browser = await chromium.launch({ headless: true });
const records = [];
try {
  for (const locale of ['fr', 'ar']) {
    const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
    for (const path of ['', '/diagnostic']) {
      await page.goto(`http://127.0.0.1:5175/${locale}${path}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      records.push({ locale, path, width: 1024, ...await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth,
        overflowing: [...document.querySelectorAll('header *,main *,footer *')].filter(node => {
          const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
          return rect.width > 0 && style.visibility !== 'hidden' && style.display !== 'none' && (rect.right > innerWidth + 2 || rect.left < -2);
        }).slice(0, 10).map(node => ({ tag: node.tagName, class: typeof node.className === 'string' ? node.className : '', text: node.textContent?.trim().slice(0, 100) })),
      })) });
      await page.screenshot({ path: join(evidence, 'screenshots', `${locale}-${path ? 'diagnostic' : 'home'}-1024-targeted.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`http://127.0.0.1:5175/${locale}`, { waitUntil: 'load' });
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
    const afterSkipNextTab = await page.evaluate(() => ({ tag: document.activeElement.tagName, text: document.activeElement.textContent.trim().slice(0, 100), href: document.activeElement.getAttribute('href') }));
    const trigger = page.getByRole('button', { name: locale === 'fr' ? 'Ouvrir le menu' : 'فتح القائمة', exact: true });
    await trigger.click();
    const expanded = await page.getByRole('button', { name: locale === 'fr' ? 'Fermer le menu' : 'إغلاق القائمة', exact: true }).getAttribute('aria-expanded');
    await page.keyboard.press('Escape');
    const menu = { expanded, afterEscapeExpanded: await trigger.getAttribute('aria-expanded'), focusReturned: await trigger.evaluate(node => node === document.activeElement) };
    records.push({ locale, width: 360, afterSkipNextTab, menu });
    await page.close();
  }
} finally {
  await browser.close();
  await writeFile(join(evidence, 'targeted-browser.json'), JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2));
  console.log(JSON.stringify(records, null, 2));
}
