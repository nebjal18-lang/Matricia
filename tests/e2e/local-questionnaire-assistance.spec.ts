import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_ASSISTANCE_MANIFEST;
if(!path)throw new Error('ASSISTANCE_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('ASSISTANCE_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const){
 test(`MAT-FUNC-057/058 ${locale} ${manifest.phase} prefill and contextual help`,async({browser},info)=>{
  test.setTimeout(90_000);
  const mobile=info.project.name.includes('mobile'),item=manifest.items.find((i:{locale:string;device:string})=>i.locale===locale&&i.device===(mobile?'M':'D'));
  if(!item)throw new Error('ASSISTANCE_CASE_REQUIRED');
  const context=await browser.newContext({storageState:item.state,viewport:mobile?{width:360,height:800}:{width:1280,height:900}});
  try{
   const page=await context.newPage();await page.goto(`/${locale}/client/questionnaires?organizationId=${item.organizationId}&session=${item.sessionId}`);await settleVisualState(page);
   const form=page.locator('form').filter({has:page.locator('[name="questionVersionId"]')}),input=form.locator('[name="answerValue"]');
   await expect(form.getByText(locale==='fr'?'Exemple : 1 signifie que votre processus est prêt, 0 qu’il reste à préparer.':'مثال: 1 يعني أن العملية جاهزة، و0 أنها تحتاج إلى إعداد.',{exact:true})).toBeVisible();
   await form.locator('summary').click();await expect(form.getByText(locale==='fr'?'Cette réponse permet de proposer une amélioration adaptée à votre situation.':'تساعد هذه الإجابة على اقتراح تحسين يناسب وضعكم.',{exact:true})).toBeVisible();
   const submit=page.getByRole('button',{name:locale==='fr'?'Soumettre':'إرسال',exact:true});await expect(submit).toBeDisabled();
   if(manifest.phase==='fresh'){
    await expect(input).toHaveValue('1');
    await expect(form.getByText(locale==='fr'?'Donnée préremplie — vérifiez-la avant confirmation':'بيانات معبأة مسبقاً — راجعها قبل التأكيد',{exact:true}).first()).toBeVisible();
    await form.getByRole('button',{name:locale==='fr'?'Confirmer cette réponse':'تأكيد هذه الإجابة',exact:true}).click();
   }else{
    await expect(input).toHaveValue('');await input.fill('0');
    // The real autosave supplies the new answer; do not race a second submit.
   }
   await expect(form.locator('[name="expectedAnswerRowVersion"]')).toHaveValue('1');await expect(submit).toBeEnabled();await submit.click();
   const terminal=locale==='fr'?'Cette session a été soumise et reste consultable en lecture seule.':'أُرسلت هذه الجلسة وتبقى متاحة للقراءة فقط.';
   await expect(page.getByText(terminal,{exact:true})).toBeVisible();await page.reload();await expect(page.getByText(terminal,{exact:true})).toBeVisible();
  }finally{await context.close();}
 });
}
