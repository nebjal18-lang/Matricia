import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_SOLUTIONS_MANIFEST,output=process.env.E2E_LOCAL_SOLUTIONS_RECEIPTS;
if(!path||!output)throw new Error('LOCAL_SOLUTIONS_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('LOCAL_SOLUTIONS_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-009 ${locale} compares three levels and persists accept reject defer`,async({browser},info)=>{
 test.setTimeout(120000);
 const mobile=info.project.name.includes('mobile'),key=`${locale}_${mobile?'M':'D'}`,item=manifest.items[key];
 const context=await browser.newContext({storageState:item.state,viewport:mobile?{width:360,height:800}:{width:1280,height:900}});
 try{
  const page=await context.newPage();await page.goto(`/${locale}/client/diagnostics/solutions?organizationId=${item.organizationId}&anomalyId=${item.anomalyId}`);
  const article=page.getByRole('article').filter({has:page.getByRole('heading',{name:item.code,exact:true})});
  await expect(article).toBeVisible();await expect(article.locator('section')).toHaveCount(3);
  const proof=[];
  for(const [level,decision] of [['ESSENTIAL','ACCEPTED'],['STANDARD','REJECTED'],['ADVANCED','DEFERRED']]){
   const form=article.locator('form').filter({has:page.locator(`[name="level"][value="${level}"]`)});
   await expect(form).toHaveCount(1);const commandKey=await form.locator('[name="idempotencyKey"]').inputValue();
   await form.locator('[name="decision"]').selectOption(decision);
   const reason=`Human decision ${key} ${level}`;await form.locator('[name="reason"]').fill(reason);
   if(decision==='DEFERRED')await form.locator('[name="deferredUntil"]').fill(item.deferredDate);
   await form.getByRole('button',{name:locale==='fr'?'Enregistrer la décision':'تسجيل القرار',exact:true}).click();
   await expect(form.getByRole('status')).toHaveText(locale==='fr'?'Décision enregistrée, auditée et historisée.':'تم تسجيل القرار وتدقيقه وحفظ تاريخه.');
   proof.push({level,decision,reason,key:commandKey});
  }
  writeFileSync(resolve(output,`${key}.json`),JSON.stringify(proof),{mode:0o600});
  await settleVisualState(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  if(accessibility.violations.length)throw new Error(`SOLUTION_ACCESSIBILITY_${accessibility.violations.map(v=>`${v.id}:${v.nodes.map(n=>n.target.join(' ')).join(',')}`).join(';')}`);
 }finally{await context.close();}
});
