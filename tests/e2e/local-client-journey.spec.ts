import { existsSync,readFileSync } from 'node:fs';
import { expect,test } from '@playwright/test';
import { validFixtureProject } from './helpers/fixture-project.mjs';

type Journey={organizationId:string;intakeId:string;sessionId:string;serviceCode:string;serviceId:string;state:string;foreignState:string;description:string;activationVerified?:boolean;organizationName?:string};
const path=process.env.E2E_LOCAL_CLIENT_JOURNEY_MANIFEST;
if(!path||!existsSync(path))throw new Error('LOCAL_CLIENT_JOURNEY_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('LOCAL_CLIENT_JOURNEY_MANIFEST_INVALID');

for(const locale of ['fr','ar'] as const){
 test(`${locale.toUpperCase()} submitted questionnaire becomes a persisted diagnostic and exact-budget request`,async({browser})=>{
  test.setTimeout(120_000);
  const item=manifest.cases[locale] as Journey;
  if(!item||!existsSync(item.state)||!existsSync(item.foreignState))throw new Error('LOCAL_CLIENT_JOURNEY_STATE_REQUIRED');
  const context=await browser.newContext({storageState:item.state,locale:`${locale}-MA`,timezoneId:'Africa/Casablanca'});
  const page=await context.newPage();
  try{
   if(item.activationVerified){
    await page.goto(`/${locale}/client/onboarding?organizationId=${item.organizationId}`);
    await expect(page.getByRole('heading',{level:1})).toHaveText(locale==='fr'?'Profil et conformité de votre entreprise':'ملف مؤسستك وامتثالها');
    await expect(page.locator('body')).toContainText(item.organizationName!);
    await expect(page.locator('[data-slot="alert"].text-destructive')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('body')).toContainText(item.organizationName!);
    await expect(page.getByText(locale==='fr'?'Entreprise validée':'تم اعتماد المؤسسة',{exact:true}).first()).toBeVisible();
    await expect(page.getByText(locale==='fr'?'Essai actif':'التجربة نشطة',{exact:true}).first()).toBeVisible();
   }
   await page.goto(`/${locale}/client/diagnostics?organizationId=${item.organizationId}`);
   const analysis=page.locator('form').filter({has:page.locator('[name="confirmSnapshot"]')});
   const serviceChoice=analysis.locator('select[name="analysisServiceId"]');
   if(await serviceChoice.count())await serviceChoice.selectOption(item.serviceId);
   await analysis.locator('[name="confirmSnapshot"]').check();
   const actionResponse=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===`/${locale}/client/diagnostics`,{timeout:15_000});
   await analysis.getByRole('button').click();
   const response=await actionResponse;
   expect(response.status(),'Diagnostic server action must return a healthy response').toBeLessThan(500);
   const completionMessage=locale==='fr'?'Action enregistrée et auditée.':'تم تسجيل الإجراء وتدقيقه.';
   const reportLabel=locale==='fr'?'Consulter le rapport créé':'عرض التقرير الذي تم إنشاؤه';
   const receipt=page.getByRole('status').filter({has:page.getByRole('link',{name:reportLabel,exact:true})});
   await expect(receipt).toContainText(completionMessage);
   await expect(receipt).toBeVisible();
   await expect(receipt).toBeFocused();
   const detailHref=await receipt.getByRole('link',{name:reportLabel,exact:true}).getAttribute('href');
   expect(detailHref).toMatch(new RegExp(`^/${locale}/client/diagnostics/[a-f0-9-]{36}\\?organizationId=${item.organizationId}$`));
   await page.reload();
   const persistedReport=page.locator(`a[href="${detailHref}"]`).first();
   await expect(persistedReport,'The exact newly created diagnostic must remain visible after reloading').toBeVisible({timeout:10_000});
   await persistedReport.click();
   await expect(page.getByText(locale==='fr'?'Contrôle de processus requis (recette)':'مراجعة العملية مطلوبة (اختبار)',{exact:true}).first()).toBeVisible();
   const accept=page.locator('form').filter({has:page.locator('[name="action"][value="ACCEPT"]')});
   await accept.getByRole('button',{name:locale==='fr'?'Accepter':'قبول',exact:true}).click();
   await expect(accept).toHaveCount(0);
   const prepare=page.locator('form').filter({has:page.locator('[name="action"][value="REQUEST_RFQ"]')});
   await prepare.getByRole('button',{name:locale==='fr'?'Préparer une demande de devis':'إعداد طلب عروض',exact:true}).click();
   const continueRequest=page.getByRole('link',{name:locale==='fr'?'Continuer vers le brouillon de demande':'المتابعة إلى مسودة الطلب',exact:true});
   await expect(continueRequest).toBeVisible();await continueRequest.click();
   await expect(page).toHaveURL(url=>url.pathname===`/${locale}/client/demandes/nouvelle`&&url.searchParams.get('organizationId')===item.organizationId&&Boolean(url.searchParams.get('opportunityId')));
   const form=page.locator('form').filter({has:page.locator('textarea[name="description"]')});
   await form.locator('[name="description"]').fill(item.description);
   await form.locator('[name="regionCode"]').selectOption('CASABLANCA_SETTAT');
   await form.locator('[name="desiredDate"]').fill(new Date(Date.now()+14*86400_000).toISOString().slice(0,10));
   await form.locator('[name="budget"]').fill('1250,50');
   await form.locator('[name="urgency"]').selectOption('NORMAL');
   await form.locator('button[type="submit"]').last().click();
   // The consumed opportunity redirects to its persisted request after revalidation.
   await expect(page).toHaveURL(url=>new RegExp(`^/${locale}/client/demandes/[0-9a-f-]{36}$`).test(url.pathname)&&url.searchParams.get('organizationId')===item.organizationId,{timeout:15_000});
   const destination=new URL(page.url());
   const href=destination.pathname+destination.search;
   await page.reload();
   await expect(page.locator('body')).toContainText(item.description);
   const foreign=await browser.newContext({storageState:item.foreignState});
   try{const denied=await foreign.newPage();await denied.goto(href!);await expect(denied.locator('body')).not.toContainText(item.description);}finally{await foreign.close();}
  }finally{await context.close();}
 });
}
