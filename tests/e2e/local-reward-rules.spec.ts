import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_REWARD_RULES_MANIFEST,output=process.env.E2E_LOCAL_REWARD_RULES_RECEIPTS;
if(!path||!output)throw new Error('REWARD_RULES_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('REWARD_RULES_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-034 ${locale} versions exact reward quantities without issuing credits`,async({browser},info)=>{
 test.setTimeout(120000);const mobile=info.project.name.includes('mobile'),suffix=`${locale.toUpperCase()}_${mobile?'M':'D'}`,code=`LOCAL_${manifest.runId.replaceAll('-','').toUpperCase()}_${suffix}`;
 const context=await browser.newContext({storageState:manifest.states.centralAal2.path,viewport:mobile?{width:360,height:800}:{width:1280,height:900}});
 try{
  const page=await context.newPage();const receipts=[];
  for(const version of [1,2]){
   await page.goto(`/${locale}/administration/incitations`);
   const form=page.locator('form').filter({has:page.locator('[name="bonus"]')});await expect(form).toBeVisible();
   const key=await form.locator('[name="idempotencyKey"]').inputValue(),bonus=version===1?'9007199254740993':'9007199254740995';
   for(const [name,value]of Object.entries({code,trigger:`LOCAL.${manifest.runId.replaceAll('-','').toUpperCase()}`,bonus,recipientCap:'9007199254740997',globalCap:'9223372036854775807',window:'30',cooldown:'24',validity:'365',eligibility:JSON.stringify({local_run:manifest.runId}),from:manifest.from,until:manifest.until,reason:`Local reward rule ${suffix} version ${version}`}))await form.locator(`[name="${name}"]`).fill(value);
   await form.locator('[name="status"]').selectOption(version===1?'DRAFT':'ACTIVE');await form.locator('[name="audience"]').selectOption('REFERRED_CLIENT');await form.locator('[name="approval"]').check();
   await form.getByRole('button',{name:locale==='fr'?'Enregistrer':'حفظ',exact:true}).click();
   await expect(form.getByRole('status')).toContainText(locale==='fr'?'Opération enregistrée.':'تم تسجيل العملية.');
   receipts.push({key,code,version,bonus,reason:`Local reward rule ${suffix} version ${version}`});
  }
  await page.reload();
  const rules=page.locator('section').filter({has:page.getByRole('heading',{name:locale==='fr'?'Règles de récompense et parrainage':'قواعد المكافأة والإحالة',exact:true})});
  const cards=rules.locator('[data-slot="card"]').filter({has:page.getByText(code,{exact:true})});await expect(cards).toHaveCount(2);
  for(const receipt of receipts)await expect(cards.filter({hasText:receipt.bonus})).toBeVisible();
  writeFileSync(resolve(output,`${suffix}.json`),JSON.stringify(receipts),{mode:0o600});
  await settleVisualState(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
 }finally{await context.close();}
});
