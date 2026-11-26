import {readFileSync} from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_ACTIONS_MANIFEST;if(!path)throw new Error('ACTIONS_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('ACTIONS_MANIFEST_INVALID');
for(const role of ['client','provider','franchise','admin'])for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-006 ${role} ${locale} universal actions`,async({browser},info)=>{
 test.setTimeout(120_000);const mobile=info.project.name.includes('mobile'),device=mobile?'M':'D';
 const actor=manifest.actors[role],item=manifest.items.find((i:{role:string;locale:string;device:string})=>i.role===role&&i.locale===locale&&i.device===device);
 const context=await browser.newContext({storageState:actor.state,viewport:mobile?{width:360,height:800}:{width:1280,height:900},timezoneId:'Africa/Casablanca'});
 try{
  const page=await context.newPage();page.setDefaultTimeout(15_000);await page.goto(`/${locale}/actions`);await settleVisualState(page);
  await expect(page.getByRole('heading',{level:1,name:locale==='fr'?'Actions requises':'الإجراءات المطلوبة'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr');
  const card=page.locator('article').filter({hasText:item.title});await expect(card).toHaveCount(1);
  if(role!=='admin')for(const foreign of manifest.items.filter((i:{role:string})=>i.role!==role))await expect(page.locator('article').filter({hasText:foreign.title})).toHaveCount(0);
  const width=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));expect(width.content).toBeLessThanOrEqual(width.viewport);
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(audit.violations.map(v=>({id:v.id,impact:v.impact}))).toEqual([]);
  await page.keyboard.press('Tab');await expect(page.locator(':focus')).toBeVisible();
  await card.getByRole('link').click();
  if(role==='admin')await expect(page).toHaveURL(new RegExp(`/${locale}/administration/command-center`));
  else{
   await expect(page).toHaveURL(new RegExp(`/${locale}/notifications`));
   const form=page.locator('form').filter({has:page.locator(`[name="notificationId"][value="${item.id}"]`)});
   await expect(form).toBeVisible();await form.getByRole('button').click();await expect(form).toHaveCount(0);
   await page.goto(`/${locale}/actions`);await expect(page.locator('article').filter({hasText:item.title})).toHaveCount(0);
  }
 }finally{await context.close();}
});
