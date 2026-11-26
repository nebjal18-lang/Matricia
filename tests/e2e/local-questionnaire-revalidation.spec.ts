import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_REVALIDATION_MANIFEST;
if(!path)throw new Error('REVALIDATION_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('REVALIDATION_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const){
 test(`MAT-FUNC-005 ${locale} expired answer requires confirmation before submission`,async({browser},info)=>{
  test.setTimeout(90_000);
  const mobile=info.project.name.includes('mobile'),item=manifest.items.find((i:{locale:string;device:string})=>i.locale===locale&&i.device===(mobile?'M':'D'));
  if(!item)throw new Error('REVALIDATION_CASE_REQUIRED');
  const context=await browser.newContext({storageState:item.state,viewport:mobile?{width:360,height:800}:{width:1280,height:900}});
  try{
   const page=await context.newPage();
   await page.goto(`/${locale}/client/questionnaires?organizationId=${item.organizationId}&session=${item.sessionId}`);await settleVisualState(page);
   const answer=page.locator('form').filter({has:page.locator('[name="questionVersionId"]')});
   const submit=page.getByRole('button',{name:locale==='fr'?'Soumettre':'إرسال',exact:true});
   await expect(answer.locator('[name="answerValue"]')).toHaveValue('1');await expect(submit).toBeDisabled();
   await answer.getByRole('button',{name:locale==='fr'?'Revalider cette réponse':'إعادة تأكيد هذه الإجابة',exact:true}).click();
   await expect(answer.locator('[name="expectedAnswerRowVersion"]')).toHaveValue('2');
   await expect(submit).toBeEnabled();await submit.click();
   await expect(page.getByText(locale==='fr'?'Cette session a été soumise et reste consultable en lecture seule.':'أُرسلت هذه الجلسة وتبقى متاحة للقراءة فقط.',{exact:true})).toBeVisible();
   await page.reload();await expect(page.locator('form').filter({has:page.locator('[name="questionVersionId"]')})).toHaveCount(0);
   await expect(page.getByText(locale==='fr'?'Cette session a été soumise et reste consultable en lecture seule.':'أُرسلت هذه الجلسة وتبقى متاحة للقراءة فقط.',{exact:true})).toBeVisible();
  }finally{await context.close();}
 });
}
