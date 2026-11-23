import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';

const path=process.env.E2E_LOCAL_TEMPLATE_MANIFEST;
if(!path)throw new Error('LOCAL_TEMPLATE_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('LOCAL_TEMPLATE_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const){
 test(`MAT-FUNC-039 ${locale} bilingual preview and independent template activation`,async({browser},info)=>{
  test.setTimeout(120_000);
  const suffix=`${locale}_${info.project.name.includes('mobile')?'M':'D'}`;
  const item=manifest.items.find((row:{suffix:string})=>row.suffix===suffix);
  const viewport=info.project.name.includes('mobile')?{width:360,height:800}:{width:1280,height:900};
  const author=await browser.newContext({storageState:manifest.states.centralAal2.path,viewport});
  const reviewer=await browser.newContext({storageState:manifest.reviewerState,viewport});
  try{
   const page=await author.newPage();
   await page.goto(`/${locale}/administration/notifications/modeles`);
   await settleVisualState(page);
   const editor=page.locator('details').filter({has:page.locator(`input[name="templateCode"][value="${item.code}"]`)});
   await editor.locator('summary').click();
   for(const name of ['frSubject','frBody','arSubject','arBody'])await editor.locator(`[name="${name}"]`).fill(item[name]);
   await editor.locator('[name="variable:reference"]').fill(item.reference);
   await editor.locator('button[value="preview"]').click();
   await expect(editor.getByRole('heading',{name:item.frSubject.replace('{{reference}}',item.reference),exact:true})).toBeVisible();
   await expect(editor.getByRole('heading',{name:item.arSubject.replace('{{reference}}',item.reference),exact:true})).toBeVisible();
   for(const name of ['frSubject','frBody','arSubject','arBody'])await expect(editor.locator(`[name="${name}"]`)).toHaveValue(item[name]);
   await editor.locator('[name="reason"]').fill(`E2E bilingual revision ${suffix}`);
   await editor.locator('[name="authorConfirmed"]').check();
   await editor.locator('button[value="propose"]').click();
   const proposal=page.locator('article').filter({has:page.getByRole('heading',{name:`${item.code} · v2`,exact:true})});
   await expect(proposal).toBeVisible();
   await expect(proposal.locator('button[value="approve"]')).toHaveCount(0);
   await page.reload();
   await expect(proposal).toBeVisible();
   const review=await reviewer.newPage();
   await review.goto(`/${locale}/administration/notifications/modeles`);
   await settleVisualState(review);
   const decision=review.locator('article').filter({has:review.getByRole('heading',{name:`${item.code} · v2`,exact:true})});
   await decision.locator('[name="reason"]').fill(`E2E independent bilingual approval ${suffix}`);
   await decision.locator('[name="reviewConfirmed"]').check();
   await decision.locator('button[value="approve"]').click();
   await expect(decision.locator('button[value="approve"]')).toHaveCount(0);
   await expect(review.locator('summary').filter({hasText:`${item.code} · v2/2`})).toBeVisible();
   await review.reload();
   await expect(review.locator('summary').filter({hasText:`${item.code} · v2/2`})).toBeVisible();
  }finally{await author.close();await reviewer.close();}
 });
}
