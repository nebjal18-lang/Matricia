import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_FOLLOWUPS_MANIFEST;if(!path)throw new Error('FOLLOWUPS_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('FOLLOWUPS_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-038 ${locale} ${manifest.phase}`,async({browser},info)=>{
 test.setTimeout(150_000);const mobile=info.project.name.includes('mobile'),device=mobile?'M':'D';
 const context=await browser.newContext({storageState:manifest.phase==='approve'?manifest.states.centralAal2.path:manifest.reference.state,viewport:mobile?{width:360,height:800}:{width:1280,height:900}});
 try{
  const page=await context.newPage();page.setDefaultTimeout(15_000);
  const query=new URLSearchParams({organizationId:manifest.reference.organizationId,franchiseId:manifest.reference.franchiseId});
  const group=manifest.groups.find((g:{locale:string;device:string})=>g.locale===locale&&g.device===device);
  if(manifest.phase==='approve'){
   await page.goto(`/${locale}/administration/relances-franchise`);await settleVisualState(page);
   const form=page.locator('form').filter({has:page.locator(`[name="policyVersionId"][value="${group.policyId}"]`)});
   await expect(form).toBeVisible();await form.locator('[name="reason"]').fill(group.reviewReason);
   await form.locator('button[value="APPROVE"]').click();await expect(form).toHaveCount(0);await page.reload();await expect(form).toHaveCount(0);
  }else{
   await page.goto(`/${locale}/franchise/relances?${query}`);await settleVisualState(page);
   if(manifest.phase==='configure'){
    const form=page.locator('form').filter({has:page.locator('[name="reminderDelaysMinutes"]')});
    await expect(form).toBeVisible();
    for(const input of await form.locator('[name="eligibleStages"]').all())await input.setChecked(await input.inputValue()==='SENT');
    for(const [name,value] of Object.entries({reminderDelaysMinutes:'0',retryDelaysMinutes:'1,5',maximumAttempts:'3',maximumRemindersPer7Days:'2',leaseSeconds:'120',effectiveFrom:manifest.effectiveFrom,changeReason:group.reason}))await form.locator(`[name="${name}"]`).fill(String(value));
    await form.getByRole('button').click();await expect(form.locator('[aria-live="polite"]')).toContainText(locale==='fr'?'Opération enregistrée':'تم تسجيل العملية');
   }
   for(const item of manifest.items.filter((i:{locale:string;device:string;type:string})=>i.locale===locale&&i.device===device&&(manifest.phase==='configure'||i.type==='PROVIDER'))){
    const form=page.locator('form').filter({has:page.locator(`[name="prospectId"][value="${item.prospectId}"]`)});
    await expect(form).toBeVisible();
    await form.locator('[name="emailAllowed"]').setChecked(manifest.phase==='configure');await form.locator('[name="contactAllowed"]').setChecked(manifest.phase==='configure');
    await form.locator('[name="timeZone"]').fill('UTC');await form.locator('[name="quietHoursStart"]').fill(manifest.quietStart);await form.locator('[name="quietHoursEnd"]').fill(manifest.quietEnd);
    await form.locator('[name="notificationLocale"]').selectOption(locale);await form.locator('[name="maximumRemindersPer7Days"]').fill('2');await form.locator('[name="changeReason"]').fill(`${group.reason} ${manifest.phase}`);
    await form.getByRole('button').click();await expect(form.locator('[aria-live="polite"]')).toContainText(locale==='fr'?'Opération enregistrée':'تم تسجيل العملية');
    await page.reload();await expect(form.locator('[name="contactAllowed"]')).toBeChecked({checked:manifest.phase==='configure'});await expect(form.locator('[name="emailAllowed"]')).toBeChecked({checked:manifest.phase==='configure'});
   }
  }
 }finally{await context.close();}
});
