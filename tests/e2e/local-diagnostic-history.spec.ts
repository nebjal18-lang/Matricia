import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_HISTORY_MANIFEST;if(!path)throw new Error('HISTORY_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('HISTORY_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-046/060 ${locale} compares durable scores and opens client and technical explanations`,async({browser},info)=>{
 test.setTimeout(120000);const item=manifest.items[locale],mobile=info.project.name.includes('mobile');
 const context=await browser.newContext({storageState:item.state,viewport:mobile?{width:360,height:800}:{width:1280,height:900}});
 let stage='history-navigation';
 try{
  const page=await context.newPage(),query=`?organizationId=${item.organizationId}`;
  page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);
  await page.goto(`/${locale}/client/diagnostics/evolution${query}`);
  stage='history-comparison';
  const current=page.locator('tr').filter({has:page.locator(`a[href="/${locale}/client/diagnostics/${item.newRunId}${query}"]`)}),previous=page.locator('tr').filter({has:page.locator(`a[href="/${locale}/client/diagnostics/${item.oldRunId}${query}"]`)});
  await expect(current).toBeVisible();await expect(previous).toBeVisible();await expect(current.locator('td').nth(0)).toContainText('0.00/100');await expect(current.locator('td').nth(1)).toHaveText('−50.00');await expect(previous.locator('td').nth(0)).toContainText('+50.00/100');
  await settleVisualState(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  stage='history-accessibility';const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();if(scan.violations.length)throw new Error(`HISTORY_ACCESSIBILITY_${scan.violations.map(v=>`${v.id}:${v.nodes.map(n=>n.target.join(' ')).join(',')}`).join(';')}`);
  stage='previous-snapshot';
  await previous.getByRole('link').click();const snapshot=page.locator('section[aria-labelledby="diagnostic-snapshot"]');await expect(snapshot).toBeVisible();
  stage='technical-disclosure';const technical=snapshot.locator('details');await expect(technical).not.toHaveAttribute('open');await technical.locator('summary').click();await expect(technical).toContainText(item.oldManifestHash);await expect(technical).toContainText(item.questionnaireVersionId);
  stage='client-explanation';await page.goto(`/${locale}/client/diagnostics/${item.oldRunId}${query}&anomalyId=${item.anomalyId}`);
  await expect(page.getByText(locale==='fr'?'La réponse publiée déclenche ce contrôle de recette.':'تؤدي الإجابة إلى هذا الفحص التجريبي.',{exact:true})).toBeVisible();
  stage='foreign-denial';const foreign=await browser.newContext({storageState:item.foreignState});try{const denied=await foreign.newPage();denied.setDefaultNavigationTimeout(30000);await denied.goto(`/${locale}/client/diagnostics/${item.oldRunId}${query}`);await expect(denied.locator('body')).not.toContainText(item.oldManifestHash);await expect(denied.locator('section[aria-labelledby="diagnostic-snapshot"]')).toHaveCount(0);}finally{await foreign.close();}
 }catch(error){const message=error instanceof Error?error.message:'FAILED';const flags=['intercepts pointer events','outside of the viewport','not visible','not stable','not enabled'].filter(flag=>message.includes(flag));throw new Error(`HISTORY_STAGE_${stage} ${flags.join(',')}: ${message}`);}finally{await context.close();}
});
