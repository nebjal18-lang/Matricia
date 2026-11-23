import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_SIMULATION_MANIFEST;
if(!path)throw new Error('SIMULATION_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('SIMULATION_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-043 ${locale} franchise evaluates both branches without a real diagnostic`,async({browser},info)=>{
 test.setTimeout(120000);const mobile=info.project.name.includes('mobile');
 const context=await browser.newContext({storageState:manifest.reference.state,viewport:mobile?{width:360,height:800}:{width:1280,height:900}});
 try{
  const page=await context.newPage(),query=new URLSearchParams({organizationId:manifest.reference.organizationId,franchiseId:manifest.reference.franchiseId});
  await page.goto(`/${locale}/franchise/questionnaires/${manifest.questionnaire.questionnaire}/simulation?${query}`);
  const form=page.locator('form').filter({has:page.locator('[name="questionnaireVersionId"]')}),answer=form.locator(`[name="answer:${manifest.questionnaire.questionVersion}"]`);
  try{await expect(answer).toBeVisible();}catch{throw new Error(`SIMULATION_FORM_MISSING ${new URL(page.url()).pathname.replace(/[a-f0-9-]{36}/g,'[id]')} ${JSON.stringify(await page.getByRole('heading').allTextContents())} ${JSON.stringify(await page.getByRole('alert').allTextContents())}`);}
  for(const value of ['0','1']){
   await answer.fill(value);await form.locator('button[type="submit"]').click();
   const result=form.getByRole('region',{name:locale==='fr'?'Résultats de simulation':'نتائج المحاكاة'});
   try{await expect(result.locator('dd').first()).toHaveText(value==='0'?'0':'5000');}catch{throw new Error(`SIMULATION_RESULT_MISSING ${JSON.stringify(await form.locator('[role="alert"], [role="status"]').allTextContents())}`);}await expect(result.locator('dd').nth(1)).toHaveText('2.0.0');
   await expect(result.locator('li')).toHaveCount(value==='0'?0:6);
  }
  await answer.fill('invalid-number');await form.locator('button[type="submit"]').click();await expect(form.getByRole('alert')).toBeVisible();
  await expect(form.getByRole('region')).toHaveCount(0);
  await settleVisualState(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();if(scan.violations.length)throw new Error(`SIMULATION_ACCESSIBILITY_${scan.violations.map(v=>`${v.id}:${v.nodes.map(n=>n.target.join(' ')).join(',')}`).join(';')}`);
 }finally{await context.close();}
});
