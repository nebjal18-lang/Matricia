import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
const path=process.env.E2E_LOCAL_CRM_MANIFEST;
if(!path)throw new Error('CRM_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('CRM_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const){
 test(`MAT-FUNC-036/037 ${locale} franchise CRM ${manifest.phase}`,async({browser},info)=>{
  test.setTimeout(150_000);
  const mobile=info.project.name.includes('mobile'),device=mobile?'M':'D';
  const context=await browser.newContext({storageState:manifest.reference.state,viewport:mobile?{width:360,height:800}:{width:1280,height:900}});
  const query=new URLSearchParams({organizationId:manifest.reference.organizationId,franchiseId:manifest.reference.franchiseId});
  try{
   const page=await context.newPage();page.setDefaultTimeout(15_000);
   for(const item of manifest.items.filter((i:{locale:string;device:string})=>i.locale===locale&&i.device===device)){
    if(manifest.phase==='invitations'){
     const url=`/${locale}/franchise/${item.type==='CLIENT'?'clients':'fournisseurs'}/inviter?${query}`;
     for(let attempt=0;attempt<2;attempt++){
      await page.goto(url);await settleVisualState(page);
      const form=page.locator('form').filter({has:page.locator('[name="contactEmail"]')});
      await form.locator('[name="displayName"]').fill(item.displayName);await form.locator('[name="contactEmail"]').fill(item.email);
      await form.locator('[name="organizationName"]').fill(item.organizationName);await form.locator('[name="sourceCode"]').selectOption('INVITE');
      await form.locator('[name="invitationLocale"]').selectOption(locale);await form.locator('[name="contactPermissionConfirmed"]').check();
      const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===new URL(page.url()).pathname);
      await form.locator('button[type="submit"]').click();const posted=await response;
      const feedback=form.locator('[role="status"], [role="alert"]');
      try{await expect(feedback).not.toBeEmpty();}catch{throw new Error(`CRM_SUBMIT_RESULT ${posted.status()} ${new URL(page.url()).pathname} ${JSON.stringify(await page.getByRole('heading').allTextContents())}`);}
      if(await form.getByRole('alert').count())throw new Error(`CRM_INVITATION_REFUSED: ${await feedback.innerText()}`);
      const status=form.getByRole('status');await expect(status).toContainText(locale==='fr'?'Demandes d’envoi enregistrées':'طلبات الإرسال المسجّلة');
      await expect(status).toContainText(attempt===0?': 1.':': 0.');
     }
    }else{
     const base=`/${locale}/franchise/${item.type==='CLIENT'?'demandes':'fournisseurs'}/${item.prospectId}`;
     await page.goto(`${base}${item.type==='CLIENT'?'/consultation':'/historique'}?${query}`);await settleVisualState(page);
     const form=page.locator('form').filter({has:page.locator('textarea[name="summary"]')});
     await expect(form).toBeVisible({timeout:15_000});
     for(let n=1;n<=2;n++){
      const key=await form.locator('[name="idempotencyKey"]').inputValue();
      await form.locator('[name="activityType"]').selectOption('NOTE');await form.locator('[name="occurredAt"]').fill(new Date(Date.now()-3600_000).toISOString().slice(0,16));
      await form.locator('[name="summary"]').fill(`${item.note} ${n}`);await form.locator('[name="evidenceReference"]').fill(`local-crm-${item.suffix}`);
      await form.locator('[name="nextFollowupAt"]').fill(new Date(Date.now()+86400_000).toISOString().slice(0,16));
      await form.locator('button[type="submit"]').click();
      await expect(form.locator('[role="status"], [role="alert"]')).not.toBeEmpty();
      if(await form.getByRole('alert').count())throw new Error(`CRM_ACTIVITY_REFUSED ${n}: ${await form.getByRole('alert').innerText()}`);
      await expect(form.locator('[name="idempotencyKey"]')).not.toHaveValue(key);
     }
     await page.reload();await expect(page.getByText(`${item.note} 1`,{exact:true}).first()).toBeVisible();await expect(page.getByText(`${item.note} 2`,{exact:true}).first()).toBeVisible();
     await page.goto(`${base}${item.type==='CLIENT'?'/suivi':'/qualification'}?${query}`);await settleVisualState(page);
     const advance=page.locator('form').filter({has:page.locator('[name="toStage"]')});
     await expect(advance.locator('[name="toStage"]')).toHaveValue('OPENED');
     await advance.locator('[name="reasonCode"]').selectOption('CONTACT_CONFIRMED');await advance.locator('[name="evidenceReference"]').fill(`local-crm-${item.suffix}`);
     await advance.locator('button[type="submit"]').click();await expect(advance.locator('[name="toStage"]')).toHaveValue('REGISTERED');
     await page.reload();await expect(advance.locator('[name="toStage"]')).toHaveValue('REGISTERED');
    }
   }
  }finally{await context.close();}
 });
}
