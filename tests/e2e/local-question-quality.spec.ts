import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_QUALITY_MANIFEST,output=process.env.E2E_LOCAL_QUALITY_RECEIPTS;
if(!path||!output)throw new Error('LOCAL_QUALITY_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('LOCAL_QUALITY_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-041/042 ${locale} reviews ambiguous duplicate and already-known questions`,async({browser},info)=>{
 test.setTimeout(120000);const mobile=info.project.name.includes('mobile'),suffix=`${locale}_${mobile?'M':'D'}`,item=manifest.cases[locale];
 const context=await browser.newContext({storageState:item.state,viewport:mobile?{width:360,height:800}:{width:1280,height:900}});
 try{
  const page=await context.newPage();await page.goto(`/${locale}/client/diagnostics/assistance?organizationId=${item.organizationId}`);
  const analysis=page.locator('form').filter({has:page.locator('[name="inputText"]')});
  const reveal=async()=>{for(const details of await analysis.locator('xpath=ancestor::details').all())if(!await details.evaluate(e=>(e as HTMLDetailsElement).open))await details.locator(':scope > summary').click();};
  await reveal();await expect(analysis).toBeVisible();
  const previous=new Set(await page.locator('[name="suggestionId"]').evaluateAll(inputs=>inputs.map(input=>(input as HTMLInputElement).value)));
  const key=await analysis.locator('[name="idempotencyKey"]').inputValue(),modelId=await analysis.locator('[name="modelVersionId"]').inputValue();
  await analysis.locator('[name="organizationId"]').selectOption(item.organizationId);await analysis.locator('[name="context"]').selectOption('QUESTIONNAIRE_QUALITY');
  await analysis.locator('[name="questionVersionIds"]').selectOption(manifest.questionVersionIds);await analysis.locator('[name="knownDataKeys"]').fill('local.quality');
  await analysis.getByRole('button').click();await expect(analysis.getByRole('status')).toContainText(locale==='fr'?'Analyse terminée':'اكتمل التحليل');
  await page.reload();await reveal();
  const ids=await page.locator('[name="suggestionId"]').evaluateAll(inputs=>inputs.map(input=>(input as HTMLInputElement).value)),suggestionId=ids.find(id=>!previous.has(id));
  if(!suggestionId)throw new Error('QUALITY_HUMAN_PROPOSAL_REQUIRED');
  const decision=page.locator('form').filter({has:page.locator(`[name="suggestionId"][value="${suggestionId}"]`)}),reason=`Local human quality review ${suffix}`;
  const decisionKey=await decision.locator('[name="idempotencyKey"]').inputValue();
  await decision.locator('[name="rationale"]').fill(reason);await decision.locator(`button[value="${locale==='fr'?'REJECTED':'ACCEPTED'}"]`).click();
  await expect(decision).toHaveCount(0);await page.reload();await reveal();await expect(page.locator(`[name="suggestionId"][value="${suggestionId}"]`)).toHaveCount(0);
  writeFileSync(resolve(output,`${suffix}.json`),JSON.stringify({key,modelId,suggestionId,reason,decisionKey}),{mode:0o600});
  await settleVisualState(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();if(scan.violations.length)throw new Error(`QUALITY_ACCESSIBILITY_${scan.violations.map(v=>`${v.id}:${v.nodes.map(n=>n.target.join(' ')).join(',')}`).join(';')}`);
 }finally{await context.close();}
});
