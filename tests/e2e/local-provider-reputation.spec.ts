import {readFileSync} from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_REPUTATION_MANIFEST;
if(!path)throw new Error('REPUTATION_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('REPUTATION_MANIFEST_INVALID');
const phase=process.env.E2E_REPUTATION_PHASE;
if(!['refresh','publish','provider'].includes(phase??''))throw new Error('REPUTATION_PHASE_REQUIRED');
for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-016/017 ${locale} event-derived reputation ${phase}`,async({browser},info)=>{
 test.setTimeout(90_000);const r=manifest.reputation,mobile=info.project.name.includes('mobile');
 const context=await browser.newContext({storageState:phase==='provider'?r.providerState:r.adminState,viewport:mobile?{width:360,height:800}:{width:1280,height:900}});
 try{
  const page=await context.newPage();page.setDefaultTimeout(15_000);
  await page.goto(`/${locale}/${phase==='provider'?'sous-traitant/reputation':'administration/incitations'}`);
  if(phase==='refresh'){
   const form=page.locator('form').filter({has:page.locator('select[name="providerId"]')});
   await expect(form).toBeVisible();
   await expect(form.locator(`[name="providerId"] option[value="${r.providerId}"]`),'Provider remains selectable').toHaveCount(1);
   await expect(form.locator(`[name="serviceId"] option[value="${r.serviceId}"]`),'Service remains selectable').toHaveCount(1);
   await expect(form.locator('[name="policyVersion"] option').filter({hasText:'PROVIDER-REPUTATION-V1'}),'Reputation policy remains selectable').toHaveCount(1);
   await form.locator('[name="providerId"]').selectOption(r.providerId);await form.locator('[name="serviceId"]').selectOption(r.serviceId);await form.locator('[name="policyVersion"]').selectOption('PROVIDER-REPUTATION-V1');
   await form.getByRole('button').click();await expect(form.getByRole('status')).toHaveText(locale==='fr'?'Opération enregistrée.':'تم تسجيل العملية.');
  }else if(phase==='publish'){
   const item=r.items.find((x:{locale:string;device:string})=>x.locale===locale&&x.device===(mobile?'M':'D'));expect(item).toBeTruthy();
   const form=page.locator('form').filter({has:page.locator(`input[name="evaluationId"][value="${item.id}"]`)});
   await expect(form).toBeVisible();await form.locator('[name="rationale"]').fill(`Human verified mission evidence ${locale} ${mobile?'M':'D'}`);await form.locator('button[value="PUBLISHED"]').click();
   await expect(form.getByRole('status')).toHaveText(locale==='fr'?'Opération enregistrée.':'تم تسجيل العملية.');await expect(form.locator('button[value="REVOKED"]')).toBeVisible();
  }else{
   await page.locator('details.client-ops > summary').click();
   const badges=page.locator('section[aria-labelledby="provider-badges"]'),scores=page.locator('section[aria-labelledby="reputation-scores"]');
   await expect(badges.getByText(r.code,{exact:true})).toHaveCount(4);
   await expect(scores.getByRole('progressbar')).toHaveCount(30);
   for(const bar of await scores.getByRole('progressbar').all())expect(Number(await bar.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(80);
  }
  await settleVisualState(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 }finally{await context.close();}
});
