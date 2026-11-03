import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { totp } from '../../scripts/p05-e2e/totp.mjs';

type Locale='fr'|'ar';
type Fixture={schemaVersion:number;runtimeMode:string;expiresAt:string;mailSink:string;mailBackend:"mailpit"|"inbucket";otpLength:number;registrationEmails:Record<Locale,string>;centralEmails:Record<Locale,string>;centralTotp:Record<Locale,{factorId:string;secret:string;verifiedCounter?:number}>;registrationStatePaths?:Record<Locale,string>;centralStatePaths?:Record<Locale,string>};
const path=process.env.E2E_LOCAL_UI_AUTH_MANIFEST;
if (!path || process.env.E2E_LOCAL_ISOLATED!=='1') throw new Error('Verified local UI authentication fixture is required');
const fixture=JSON.parse(readFileSync(path,'utf8')) as Fixture;
if(fixture.schemaVersion!==1||fixture.runtimeMode!=='isolated-local-docker'||Date.parse(fixture.expiresAt)<=Date.now()||fixture.mailSink!=='http://127.0.0.1:54324'||![6,7,8].includes(fixture.otpLength))throw new Error('Invalid local UI authentication fixture');

async function retainPrivateState(page:Page,path:string|undefined){
 if(!path)return;
 const root=resolve(process.cwd(),'artifacts/test-results');
 if(!resolve(path).startsWith(`${root}/.local-client-journey-`)||!path.endsWith('.json'))throw new Error('LOCAL_PRIVATE_STATE_PATH_INVALID');
 await writeFile(path,JSON.stringify(await page.context().storageState()),{mode:0o600,flag:'wx'});
}

async function mailboxOtp(request:APIRequestContext,email:string):Promise<string|null>{
 const mailbox=email.split('@')[0]!;
 if(!/^p05-e2e-[a-z0-9-]+$/u.test(mailbox)||!email.endsWith('@example.invalid'))throw new Error('Local mailbox scope refused');
 const response=await request.get(fixture.mailBackend==='mailpit'?`${fixture.mailSink}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`:`${fixture.mailSink}/api/v1/mailbox/${encodeURIComponent(mailbox)}`);
 if(!response.ok())return null;
 const body=await response.json();
 const rows:Array<{id:string;date:string}> = fixture.mailBackend==='mailpit'?(body.messages??[]).filter((row:{To?:Array<{Address:string}>})=>(row.To??[]).some(to=>to.Address.toLowerCase()===email.toLowerCase())).map((row:{ID:string;Created:string})=>({id:row.ID,date:row.Created})):body;
 for(const row of rows.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))){
  if(!/^[a-zA-Z0-9_.-]+$/u.test(row.id))continue;
  const message=await request.get(fixture.mailBackend==='mailpit'?`${fixture.mailSink}/api/v1/message/${encodeURIComponent(row.id)}`:`${fixture.mailSink}/api/v1/mailbox/${encodeURIComponent(mailbox)}/${encodeURIComponent(row.id)}`);
  if(!message.ok())continue;
  const value=await message.json() as {Text?:string;HTML?:string;body?:{text?:string;html?:string}};
  const text=(value.Text??value.body?.text??value.HTML??value.body?.html??'').replace(/https?:\/\/[^\s"<>]+/gu,'');
  const match=new RegExp(`(?<![A-Za-z0-9])([0-9]{${fixture.otpLength}})(?![A-Za-z0-9])`,'u').exec(text);
  if(match)return match[1]!;
 }
 return null;
}
async function confirmEmailOtp(page:Page,email:string){
 await page.locator('main input[name=email]').fill(email);
 await page.locator('main form').filter({has:page.locator('input[name=email]')}).getByRole('button',{name:/./}).last().click();
 await expect(page.locator('input[name=otp]')).toBeAttached();
 let code:string|null=null;
 await expect.poll(async()=>Boolean(code=await mailboxOtp(page.request,email)),{message:'A numeric OTP must be delivered to the verified local mailbox',timeout:20_000}).toBe(true);
 const boxes=page.locator('.public-otp-boxes input');
 await expect(boxes).toHaveCount(fixture.otpLength);
 // Fill the visible controls; never generate a session or inject a JWT.
 await boxes.first().fill(code!);
 await page.locator('main form').filter({has:page.locator('input[name=otp]')}).locator('button[type=submit]').click();
}
for(const locale of ['fr','ar'] as const){
 test(`${locale.toUpperCase()} real registration OTP persists consent and resumes a deep internal route`,async({page})=>{
  test.setTimeout(90_000);
  const target=`/${locale}/securite/compte?source=local-auth-acceptance`;
  await page.goto(`/${locale}/inscription?next=${encodeURIComponent(target)}`);
  await expect(page.locator('main input[name=email]')).toHaveCount(0);
  const consent=page.locator('main input[type=checkbox]').first();
  await expect(consent).not.toBeChecked();
  await consent.check();
  await confirmEmailOtp(page,fixture.registrationEmails[locale]);
  await expect(page).toHaveURL(url=>url.pathname===`/${locale}/securite/compte`&&url.searchParams.get('source')==='local-auth-acceptance');
  await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr');
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await retainPrivateState(page,fixture.registrationStatePaths?.[locale]);
 });
 test(`${locale.toUpperCase()} organization-free administrator follows real email OTP and TOTP before the protected deep route`,async({page})=>{
  test.setTimeout(90_000);
  const target=`/${locale}/administration/command-center?source=local-auth-mfa`;
  await page.goto(`/${locale}/connexion?next=${encodeURIComponent(target)}`);
  await confirmEmailOtp(page,fixture.centralEmails[locale]);
  await expect(page).toHaveURL(url=>url.pathname===`/${locale}/securite/compte`&&url.searchParams.get('next')===target);
  const factor=fixture.centralTotp[locale];
  const form=page.locator('form').filter({has:page.locator(`input[name=factorId][value="${factor.factorId}"]`)}).filter({has:page.locator('input[name=code]')});
  await expect(form).toBeVisible();
  if (factor.verifiedCounter !== undefined) await expect.poll(()=>Math.floor(Date.now()/30_000)>factor.verifiedCounter!,{message:'A fresh TOTP time window is required',timeout:65_000}).toBe(true);
  await form.locator('input[name=code]').fill(totp(factor.secret));
  await form.getByRole('button').click();
  await expect(page).toHaveURL(url=>url.pathname===`/${locale}/administration/command-center`&&url.searchParams.get('source')==='local-auth-mfa');
  await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr');
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await retainPrivateState(page,fixture.centralStatePaths?.[locale]);
 });
}
