import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_LINKED_COMMERCIAL_MANIFEST;
if(!path)throw new Error('FAVORITE_CHAIN_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('FAVORITE_CHAIN_MANIFEST_INVALID');
const paused=process.env.E2E_FAVORITE_PHASE==='paused';
for(const locale of ['fr','ar'] as const){
 test(`MAT-FUNC-048 ${locale} favorite eligibility ${paused?'after provider pause':'with qualified provider'}`,async({browser},info)=>{
  test.setTimeout(120_000);
  const item=manifest.chains[locale];
  const context=await browser.newContext({storageState:item.state,viewport:info.project.name.includes('mobile')?{width:360,height:800}:{width:1280,height:900}});
  try{
   const page=await context.newPage(),url=`/${locale}/client/favoris?organizationId=${item.clientOrganizationId}`;
   await page.goto(url);await settleVisualState(page);
   const card=page.locator('[data-slot="card"]').filter({has:page.locator(`input[name="providerOrganizationId"][value="${item.providerOrganizationId}"]`)});
   if(!paused&&await card.count()===0){
    const create=page.locator('form').filter({has:page.locator('select[name="providerOrganizationId"]')});
    await create.locator('[name="providerOrganizationId"]').selectOption(item.providerOrganizationId);
    await create.locator('[name="note"]').fill(`E2E reusable favorite ${locale}`);
    await create.getByRole('button').click();
   }
   await expect(card).toHaveCount(1);
   if(!paused){
    await card.getByRole('button',{name:locale==='fr'?'Retirer':'إزالة',exact:true}).click();
    await expect(card.getByRole('button',{name:locale==='fr'?'Réactiver':'إعادة التفعيل',exact:true})).toBeVisible();
    await page.reload();
    await card.getByRole('button',{name:locale==='fr'?'Réactiver':'إعادة التفعيل',exact:true}).click();
    await expect(card.locator('select[name="requestId"]')).toBeVisible();
   }
   const expected=locale==='fr'?(paused?'Non éligible lors du dernier contrôle':'Éligible lors du dernier contrôle'):(paused?'غير مؤهل في آخر تحقق':'مؤهل في آخر تحقق');
   const checkForm=card.locator('form').filter({has:page.locator('select[name="requestId"]')});
   for(let check=0;check<3;check++){
    const commandKey=await checkForm.locator('[name="idempotencyKey"]').inputValue();
    await checkForm.locator('[name="requestId"]').selectOption(item.requestId);
    await checkForm.getByRole('button').click();
    await expect(checkForm.locator('[name="idempotencyKey"]')).not.toHaveValue(commandKey);
    await expect(card.getByText(expected,{exact:false})).toBeVisible();
   }
   await page.reload();
   await expect(card.getByText(expected,{exact:false})).toBeVisible();
   await expect(card.getByText(`E2E reusable favorite ${locale}`,{exact:true})).toBeVisible();
  }finally{await context.close();}
 });
}
