import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_LINKED_COMMERCIAL_MANIFEST,output=process.env.E2E_LOCAL_AMENDMENT_RECEIPTS;
if(!path||!output)throw new Error('AMENDMENT_EXECUTION_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('AMENDMENT_EXECUTION_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const)test(`${locale} signed amendment enters the mission and remains visible to both parties`,async({browser},info)=>{
 test.setTimeout(90000);const chain=manifest.chains[locale],item=manifest.amendmentExecutions[locale],mobile=info.project.name.includes('mobile');
 const viewport=mobile?{width:360,height:800}:{width:1280,height:900};
 const client=await browser.newContext({storageState:chain.state,viewport}),provider=await browser.newContext({storageState:chain.providerState,viewport});
 try{
  const page=await client.newPage();await page.goto(`/${locale}/client/contrats?organizationId=${chain.clientOrganizationId}`);
  const panel=page.locator(`#amendment-${item.amendmentId}`);await expect(panel).toHaveCount(1);
  for(const details of await panel.locator('xpath=ancestor-or-self::details').all())if(!await details.evaluate(e=>(e as HTMLDetailsElement).open))await details.locator(':scope > summary').click();
  if(!mobile){
   const form=panel.locator('form').filter({has:page.locator('[name="preparationHash"]')});await expect(form).toBeVisible();
   const key=await form.locator('[name="idempotencyKey"]').inputValue(),hash=await form.locator('[name="preparationHash"]').inputValue();
   const date=new Date(Date.now()+10*86400000).toISOString().slice(0,10)+'T14:30';
   await form.locator('input[type="datetime-local"]').fill(date);await form.locator('[name="scheduleConfirmed"]').check();
   await form.getByRole('button',{name:locale==='fr'?'Intégrer les travaux signés à la mission':'إدراج الأعمال الموقعة في المهمة',exact:true}).click();
   await expect(panel).toContainText(locale==='fr'?'Le périmètre signé est réconcilié':'تمت مطابقة النطاق الموقع');
   writeFileSync(resolve(output,`execution-${locale}.json`),JSON.stringify({key,hash,date}),{mode:0o600});
  }else await expect(panel).toContainText(locale==='fr'?'Le périmètre signé est réconcilié':'تمت مطابقة النطاق الموقع');
  for(const [context,role,organization]of [[client,'client',chain.clientOrganizationId],[provider,'sous-traitant',chain.providerOrganizationId]] as const){
   const view=await context.newPage();await view.goto(`/${locale}/${role}/missions/${chain.missionId}?organizationId=${organization}`);
   await expect(view.getByText(item.label,{exact:true}).first()).toBeVisible();
   await settleVisualState(view);expect(await view.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
   expect((await new AxeBuilder({page:view}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  }
 }finally{await client.close();await provider.close();}
});
