import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_REFERRALS_MANIFEST,output=process.env.E2E_LOCAL_REFERRALS_RECEIPTS;
if(!path||!output)throw new Error('REFERRALS_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('REFERRALS_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-035 ${locale} creates and claims a consented referral without automatic activation`,async({browser},info)=>{
 test.setTimeout(120000);const mobile=info.project.name.includes('mobile'),suffix=`${locale}_${mobile?'M':'D'}`,target=manifest.targets[suffix],code=`REF_${manifest.runId.slice(0,8).toUpperCase()}_${suffix.toUpperCase()}`;
 const viewport=mobile?{width:360,height:800}:{width:1280,height:900},source=await browser.newContext({storageState:manifest.states.clientA.path,viewport}),recipient=await browser.newContext({storageState:manifest.states.clientB.path,viewport});
 try{
  const page=await source.newPage();await page.goto(`/${locale}/client/recompenses?organizationId=${manifest.fixtures.organizationA.id}`);
  const form=page.locator('form').filter({has:page.locator('[name="referralCode"]')});await expect(form).toHaveCount(1);
  for(const details of await form.locator('xpath=ancestor::details').all())if(!await details.evaluate(e=>(e as HTMLDetailsElement).open))await details.locator(':scope > summary').click();
  const key=await form.locator('[name="idempotencyKey"]').inputValue();
  await form.locator('[name="referralCode"]').fill(code);await form.locator('[name="campaignReference"]').fill(`Local campaign ${suffix}`);await form.locator('[name="audienceType"]').selectOption('CLIENT');await form.locator('[name="expiresAt"]').fill(manifest.expiry);await form.locator('[name="maxConversions"]').fill('1');
  await form.getByRole('button',{name:locale==='fr'?'Créer':'إنشاء',exact:true}).click();await expect(form.getByRole('status')).toContainText(locale==='fr'?'Opération enregistrée':'تم تسجيل العملية');
  await page.reload();const link=page.locator(`a[href="/${locale}/invitation/${code}"]`);await expect(link).toHaveCount(1);
  for(const details of await link.locator('xpath=ancestor::details').all())if(!await details.evaluate(e=>(e as HTMLDetailsElement).open))await details.locator(':scope > summary').click();await expect(link).toBeVisible();
  const href=await link.getAttribute('href');expect(href).toBe(`/${locale}/invitation/${code}`);
  if(!href)throw new Error('REFERRAL_INVITATION_LINK_MISSING');
  const claim=await recipient.newPage();await claim.goto(href);const claimForm=claim.locator('form').filter({has:claim.locator('[name="consent"]')});await expect(claimForm).toBeVisible();
  const claimKey=await claimForm.locator('[name="idempotencyKey"]').inputValue();await claimForm.locator('[name="organizationId"]').selectOption(target);await claimForm.locator('[name="consent"]').check();
  await claimForm.getByRole('button',{name:locale==='fr'?'Rattacher l’invitation':'ربط الدعوة',exact:true}).click();await expect(claimForm.getByRole('status')).toContainText(locale==='fr'?'Invitation rattachée.':'تم ربط الدعوة.');
  writeFileSync(resolve(output,`${suffix}.json`),JSON.stringify({code,key,claimKey,target,campaign:`Local campaign ${suffix}`}),{mode:0o600});
  for(const view of [page,claim]){await settleVisualState(view);expect(await view.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);expect((await new AxeBuilder({page:view}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);}
 }finally{await source.close();await recipient.close();}
});
