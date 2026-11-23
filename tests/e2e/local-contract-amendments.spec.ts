import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_LINKED_COMMERCIAL_MANIFEST,output=process.env.E2E_LOCAL_AMENDMENT_RECEIPTS;
if(!path||!output)throw new Error('AMENDMENT_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('AMENDMENT_MANIFEST_INVALID');
for(const role of ['client','provider'] as const)for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-026/027 ${locale} ${role} proposes an amendment without rewriting the signed contract`,async({browser},info)=>{
 test.setTimeout(90_000);const chain=manifest.chains[locale],device=info.project.name.includes('mobile')?'M':'D';
 const context=await browser.newContext({storageState:role==='client'?chain.state:chain.providerState,viewport:device==='M'?{width:360,height:800}:{width:1280,height:900}});
 try{
  const page=await context.newPage();page.setDefaultTimeout(15_000);
  await page.goto(role==='client'?`/${locale}/client/contrats?organizationId=${chain.clientOrganizationId}`:`/${locale}/sous-traitant/contrats/${chain.contractId}?organizationId=${chain.providerOrganizationId}`);
  const form=page.locator('form').filter({has:page.locator(`input[name="contractId"][value="${chain.contractId}"]`)}).filter({has:page.locator('[name="scopeDelta"]')});
  await expect(form).toHaveCount(1);
  for(const details of await form.locator('xpath=ancestor::details').all())if(!await details.evaluate(e=>(e as HTMLDetailsElement).open))await details.locator(':scope > summary').click();
  await expect(form).toBeVisible();
  const reason=`Amendment ${role} ${locale} ${device} ${manifest.runId.slice(0,8)}`,scope=`Additional review ${role} ${locale} ${device}`,label=`Additional deliverable ${locale} ${device}`,key=await form.locator('[name="idempotencyKey"]').inputValue();expect(key).toMatch(/^[a-f0-9-]{36}$/u);
  await form.locator('[name="reason"]').fill(reason);await form.locator('[name="scopeDelta"]').fill(scope);await form.locator('[name="deadlineDeltaDays"]').fill('7');
  if(role==='client'){
   await form.locator('[name="priceDeltaMinor"]').fill('5001');await form.getByRole('button').click();
  }else{
   await form.locator('[name="priceDelta"]').fill('50,01');
   await form.getByRole('button',{name:locale==='fr'?'Ajouter une modification de livrable':'إضافة تغيير التزام',exact:true}).click();
   await form.locator('[name="lineLabel"]').fill(label);await form.locator('[name="lineCriteria"]').fill('Evidence matches the agreed scope\nClient validates the additional review');
   await form.getByRole('button',{name:locale==='fr'?'Enregistrer la proposition':'حفظ الاقتراح',exact:true}).click();
  }
  await expect(form.getByRole('status')).toContainText(role==='client'?(locale==='fr'?'Opération enregistrée':'تم تسجيل العملية'):(locale==='fr'?'Brouillon d’avenant enregistré pour examen.':'تم حفظ مسودة الملحق للمراجعة.'));
  writeFileSync(resolve(output,`${role}-${locale}-${device}.json`),JSON.stringify({role,locale,device,reason,scope,label,key}),{mode:0o600});
  await settleVisualState(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 }finally{await context.close();}
});
