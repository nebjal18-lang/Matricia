import { requireDevelopment, loadOwnState } from './safety.mjs';
requireDevelopment();
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const state=await loadOwnState(),actor=JSON.parse(await readFile(resolve(state.directory,'actors.private.json'))).find(actor=>actor.label==='owner');
const require=createRequire(resolve('apps/web/package.json')),{createServerClient}=require('@supabase/ssr'),{chromium,expect}=createRequire(resolve('package.json'))('@playwright/test');
const origin=`http://127.0.0.1:${state.appPort}`,api=`http://127.0.0.1:${state.gatewayPort}`,bag=new Map(),client=createServerClient(api,state.anonKey,{cookies:{getAll:()=>[...bag.values()],setAll:entries=>entries.forEach(entry=>bag.set(entry.name,entry))}});
if((await client.auth.setSession(actor.session)).error)throw new Error('NATIVE_SESSION_REQUIRED');
const directory=resolve(state.directory,'public-boundaries');await mkdir(directory,{recursive:true});
const proof={scope:'NATIVE_SIGNED_IN_CLIENT_PUBLIC_HEADER_BOUNDARIES',appTree:execFileSync('git',['rev-parse','HEAD:apps/web'],{encoding:'utf8'}).trim(),status:'RUNNING',cases:[],failures:[]};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium'});
try{for(const locale of['fr','ar'])for(const width of[700,701,767,768,1023,1024,1440]){
 const context=await browser.newContext({viewport:{width,height:960},hasTouch:width<1024,serviceWorkers:'block'});await context.addCookies([...bag.values()].map(cookie=>({name:cookie.name,value:cookie.value,url:origin,httpOnly:false,secure:false,sameSite:'Lax'})));const page=await context.newPage();
 const entry={locale,width,keyboard:false,touch:width>=1024?null:false};proof.cases.push(entry);
 try{await page.goto(`${origin}/${locale}`,{waitUntil:'networkidle',timeout:90000});const link=page.getByRole('link',{name:locale==='fr'?'Mon espace · Client':'مساحتي · عميل',exact:true}).first();await expect(link).toBeVisible();entry.noHorizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);if(!entry.noHorizontalOverflow)throw new Error('PUBLIC_HORIZONTAL_OVERFLOW');await page.screenshot({path:resolve(directory,`${locale}-${width}.png`),fullPage:true,caret:'initial'});await link.focus();await expect(link).toBeFocused();await page.keyboard.press('Enter');await page.waitForURL(url=>url.pathname!==`/${locale}`,{timeout:20000});if(page.url().includes('/connexion'))throw new Error('PUBLIC_CLIENT_LINK_LOST_NATIVE_AUTH');entry.keyboard=true;if(width<1024){await page.goto(`${origin}/${locale}`,{waitUntil:'networkidle'});await link.tap();await page.waitForURL(url=>url.pathname!==`/${locale}`);if(page.url().includes('/connexion'))throw new Error('PUBLIC_TOUCH_LINK_LOST_NATIVE_AUTH');entry.touch=true;}}
 catch(error){entry.failure=error.message.slice(0,500);proof.failures.push({locale,width,message:entry.failure});}
 await context.close();
 }proof.status=proof.failures.length?'FAILED':'PASSED';if(proof.failures.length)process.exitCode=1;
}finally{await browser.close();await writeFile(resolve(directory,'summary.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({status:proof.status,cases:proof.cases.length,failures:proof.failures.length,evidence:resolve(directory,'summary.json')}));}
