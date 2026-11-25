import {readFileSync} from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_REFERRAL_REWARDS_MANIFEST;
const phase=process.env.E2E_LOCAL_REFERRAL_REWARDS_PHASE;
if(!path||!['review','pending','execute','granted'].includes(phase??''))throw new Error('REFERRAL_REWARDS_CONFIGURATION_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('REFERRAL_REWARDS_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-034/035 ${locale} referral reward ${phase}`,async({browser},info)=>{
 test.setTimeout(120000);
 const item=manifest.reference.items[locale],admin=phase==='review'||phase==='execute';
 const context=await browser.newContext({storageState:admin?manifest.reference.financeState:item.clientState,viewport:info.project.name.includes('mobile')?{width:360,height:800}:{width:1280,height:900}});
 try{
  const page=await context.newPage();
  await page.goto(admin?`/${locale}/administration/finance/recompenses`:`/${locale}/client/recompenses?organizationId=${item.organizationId}`);
  if(admin){
   const form=page.locator('form').filter({has:page.locator(phase==='review'?`[name="sourceEventId"][value="${item.sourceEventId}"]`:`[name="approvalId"][value="${item.approvalId}"]`)});
   await expect(form).toHaveCount(1);
   const row=form.locator('xpath=ancestor::li[1]');
   await expect(row).toContainText(item.code);
   if(phase==='review'){
    await expect(form.locator('[name="ruleVersionId"]')).toHaveValue(item.ruleVersionId);
    await form.locator('[name="rationale"]').fill('Independent review of verified referral and governed bonus rule');
    await form.locator('[name="decision"]').selectOption('APPROVED');
   }
   await form.getByRole('button',{name:phase==='review'?(locale==='fr'?'Enregistrer la décision':'تسجيل القرار'):(locale==='fr'?'Attribuer les crédits':'منح الأرصدة'),exact:true}).click();
   await expect(form).toHaveCount(0);
   const updated=page.locator('li').filter({has:page.locator('bdi',{hasText:item.code})});
   await expect(updated).toContainText(phase==='review'?(locale==='fr'?'Approuvée — attribution financière en attente':'معتمدة — بانتظار التنفيذ المالي'):(locale==='fr'?'Crédits accordés':'أرصدة ممنوحة'));
  }else{
   const section=page.locator('section[aria-labelledby="referral-reward-decisions"]');
   for(const details of await section.locator('xpath=ancestor::details').all())if(!await details.evaluate(e=>(e as HTMLDetailsElement).open))await details.locator(':scope > summary').click();
   const row=section.locator('li').filter({hasText:item.code});
   await expect(row).toBeVisible();
   await expect(row.getByRole('heading')).toHaveText(phase==='pending'?(locale==='fr'?'Approuvée, crédits en attente d’émission':'موافقة بانتظار إصدار الرصيد'):(locale==='fr'?'Crédits effectivement émis':'تم إصدار الرصيد'));
   await expect(row.locator('strong')).toHaveText(new Intl.NumberFormat(locale==='ar'?'ar-MA':'fr-MA').format(17));
  }
  await settleVisualState(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 }finally{await context.close();}
});
