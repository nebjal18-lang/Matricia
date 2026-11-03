import {existsSync,readFileSync,writeFileSync}from'node:fs';
import {expect,test,type Page,type Locator}from'@playwright/test';
import {validFixtureProject}from'./helpers/fixture-project.mjs';
const path=process.env.E2E_LOCAL_BENEFIT_FULFILLMENT_MANIFEST;
if(!path||!existsSync(path))throw new Error('LOCAL_BENEFIT_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now()||!manifest.uiProofPath)throw new Error('LOCAL_BENEFIT_MANIFEST_INVALID');
function localMinute(instant:number){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant);const v=(kind:string)=>parts.find(part=>part.type===kind)?.value;return`${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;}
for(const locale of['fr','ar']as const){
 test(`${locale.toUpperCase()} governed benefit execution is independently rejected corrected accepted and consumed`,async({browser})=>{
  test.setTimeout(180_000);const item=manifest.cases[locale],ar=locale==='ar';
  for(const state of[item.state,item.operatorState,item.foreignState])if(!existsSync(state))throw new Error('LOCAL_BENEFIT_STATE_REQUIRED');
  const operator=await browser.newContext({storageState:item.operatorState,locale:`${locale}-MA`,timezoneId:'Africa/Casablanca'}),client=await browser.newContext({storageState:item.state,locale:`${locale}-MA`,timezoneId:'Africa/Casablanca'}),foreign=await browser.newContext({storageState:item.foreignState});
  try{
   const op=await operator.newPage(),owner=await client.newPage();
   const adminUrl=`/${locale}/administration/avantages/livraisons?organizationId=${item.organizationId}`,clientUrl=`/${locale}/client/avantages/livraisons?organizationId=${item.organizationId}`;
   const card=(page:Page)=>page.locator('article').filter({has:page.getByRole('heading',{name:item.benefitName,exact:true})});
   const confirm=(article:Locator)=>article.locator('input[name="confirmed"]').check();
   const status=(article:Locator,text:string)=>expect(article.getByRole('status').filter({hasText:text})).toBeVisible();
   await op.goto(adminUrl);let article=card(op);await expect(article).toBeVisible();await expect(article).toContainText(item.organizationName);
   // Minute precision is the real product contract. When close to the next
   // minute, schedule that minute and wait at most fifteen real seconds.
   const now=Date.now(),minute=Math.floor(now/60_000)*60_000,scheduled=now-minute>45_000?minute+60_000:minute;
   await article.locator('input[name="scheduledFor"]').fill(localMinute(scheduled));await article.locator('textarea[name="reason"]').fill('TEST local appointment agreed for this synthetic service');await confirm(article);
   await article.getByRole('button',{name:ar?'حفظ الموعد':'Enregistrer le rendez-vous',exact:true}).click();await status(article,ar?'تم حفظ الموعد.':'Le rendez-vous est enregistré.');
   while(Date.now()<scheduled)await op.waitForTimeout(Math.min(1000,scheduled-Date.now()));
   await op.reload();article=card(op);await article.locator('textarea[name="reason"]').fill('TEST actual local start of the synthetic execution');await confirm(article);await article.getByRole('button',{name:ar?'بدء التنفيذ':'Commencer l’exécution',exact:true}).click();await status(article,ar?'بدأ التنفيذ.':'L’exécution a commencé.');
   const submitReport=async(label:string)=>{await op.reload();article=card(op);await article.locator('textarea[name="summary"]').fill(`TEST ${label}: synthetic consultation and independent receipt exercise only`);await article.locator('input[name="reference"]').fill(`TEST_${locale.toUpperCase()}_${label}`);await confirm(article);await article.getByRole('button',{name:ar?'تقديم التقرير للعميل':'Soumettre le compte rendu au client',exact:true}).click();await status(article,ar?'تم تقديم التقرير إلى العميل للتأكيد.':'Le compte rendu est soumis à la réception du client.');};
   await submitReport('INITIAL_REPORT');
   await owner.goto(clientUrl);let receipt=card(owner);await expect(receipt).toBeVisible();await receipt.locator('textarea[name="reason"]').fill('TEST independent client requests a correction before acceptance');await confirm(receipt);await receipt.getByRole('button',{name:ar?'طلب استكمال':'Demander un complément',exact:true}).click();await status(receipt,ar?'تم حفظ الرفض؛ تبقى الخدمة قيد التنفيذ.':'Le refus est enregistré ; la prestation reste en cours.');
   await submitReport('CORRECTED_REPORT');
   await owner.reload();receipt=card(owner);await receipt.locator('textarea[name="reason"]').fill('TEST independent client confirms the corrected synthetic report');await confirm(receipt);await receipt.getByRole('button',{name:ar?'تأكيد الاستلام':'Confirmer la réception',exact:true}).click();await status(receipt,ar?'تم تأكيد الاستلام وحفظ الإيصال.':'La réception et son accusé sont enregistrés.');
   await op.reload();article=card(op);const consumeKey=await article.locator('input[name="idempotencyKey"]').inputValue();await confirm(article);await article.getByRole('button',{name:ar?'احتساب الرصيد المقبول':'Consommer les crédits réceptionnés',exact:true}).click();await status(article,ar?'تم احتساب الرصيد وفق الإيصال المقبول.':'Les crédits ont été consommés sur l’accusé accepté.');
   await op.reload();await expect(card(op)).toContainText(ar?'تم احتساب الرصيد':'Crédits consommés');await expect(card(op).getByRole('button',{name:ar?'احتساب الرصيد المقبول':'Consommer les crédits réceptionnés',exact:true})).toHaveCount(0);
   await owner.reload();await expect(card(owner)).toContainText(ar?'تم احتساب الرصيد':'Crédits consommés');await expect(owner.locator('html')).toHaveAttribute('dir',ar?'rtl':'ltr');
   const denied=await foreign.newPage();await denied.goto(clientUrl);await expect(denied).not.toHaveURL(/\/connexion(?:\?|$)/u);await expect(denied.locator('body')).not.toContainText(item.organizationName);
   const proofs=existsSync(manifest.uiProofPath)?JSON.parse(readFileSync(manifest.uiProofPath,'utf8')):{};proofs[locale]={redemptionId:item.redemptionId,consumeKey,rejectedThenAccepted:true,foreignReadDenied:true};writeFileSync(manifest.uiProofPath,JSON.stringify(proofs),{mode:0o600});
  }finally{await Promise.all([operator.close(),client.close(),foreign.close()]);}
 });
}
