import {readFileSync} from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_ADMIN_SUMMARY_MANIFEST;if(!path)throw new Error('ADMIN_SUMMARY_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('ADMIN_SUMMARY_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-065 ${locale} actual priorities before metrics`,async({browser},info)=>{
 test.setTimeout(120_000);const mobile=info.project.name.includes('mobile'),suffix=`${locale}_${mobile?'M':'D'}`;
 const context=await browser.newContext({storageState:manifest.states.centralAal2.path,viewport:mobile?{width:360,height:800}:{width:1280,height:900}});
 try{
  const page=await context.newPage();page.setDefaultTimeout(15_000);await page.goto(`/${locale}/administration/command-center`);await settleVisualState(page);
  const today=page.locator('#command-today');await expect(today).toBeVisible();
  const pair=manifest.items.filter((i:{suffix:string})=>i.suffix===suffix),critical=pair.find((i:{priority:string})=>i.priority==='CRITICAL'),low=pair.find((i:{priority:string})=>i.priority==='LOW');
  const criticalRow=page.locator(`#work-${critical.id}`),lowRow=page.locator(`#work-${low.id}`);
  await expect(criticalRow).toContainText(critical.title);await expect(lowRow).toContainText(low.title);
  await expect(criticalRow).toHaveAttribute('data-priority','CRITICAL');await expect(lowRow).toHaveAttribute('data-priority','LOW');
  const order=await today.locator('tbody tr[data-kind="work"]').evaluateAll(rows=>rows.map(row=>row.id));expect(order.indexOf(`work-${critical.id}`)).toBeLessThan(order.indexOf(`work-${low.id}`));
  const sections=await page.locator('.admin-command-center').evaluate(root=>Array.from(root.children).map(child=>child.id));expect(sections[0]).toBe('command-today');
  const count=await today.locator('tbody tr').count();await expect(today.locator('.admin-result-count')).toContainText(String(count));
  await criticalRow.locator('button.admin-triage-select').click();await expect(criticalRow).toHaveAttribute('data-selected','true');
  await expect(page.locator('.admin-triage-selected').getByText(critical.title,{exact:true})).toBeVisible();
  await expect(page.locator('form').filter({has:page.locator(`[name="workItemId"][value="${critical.id}"]`)}).first()).toBeVisible();
  const width=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));expect(width.content).toBeLessThanOrEqual(width.viewport);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()).violations.map(v=>({id:v.id,impact:v.impact}))).toEqual([]);
 }finally{await context.close();}
});
