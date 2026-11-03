import { fixtureState, privateDirectory, actorSession, sourceCandidate } from './franchise-final-support.mjs';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
const state=await fixtureState(),pin=await sourceCandidate(),dir=await privateDirectory(state),file=resolve(dir,'actors.private.json'),cohort=JSON.parse(await readFile(file));
console.log(JSON.stringify({stage:'STATE_AND_CANDIDATE_READY'}));
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
const proof={scope:'FRANCHISE_NATIVE_BASELINE',candidate:pin.commit,appTree:pin.appTree,hostedCertification:false,tests:[]};
const out=resolve('docs/franchise-completion/evidence/browser/baseline');await mkdir(out,{recursive:true});
try{
 const actor=cohort.actors.find(value=>value.label==='owner');console.log(JSON.stringify({stage:'BROWSER_READY'}));const native=await actorSession(state,actor,file,cohort);console.log(JSON.stringify({stage:'NATIVE_SESSION_READY'}));const context=await browser.newContext({viewport:{width:390,height:844}});await context.addCookies(native.cookies);const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
 for(const locale of ['fr','ar']){console.log(JSON.stringify({stage:'NAVIGATE_NO_MANDATE',locale}));
  const response=await page.goto(`http://127.0.0.1:${state.appPort}/${locale}/franchise/accueil`,{waitUntil:'networkidle'});const text=await page.locator('body').innerText();const expected=locale==='fr'?'Aucun mandat de bibliothèque actif accessible':'لا يوجد تكليف نشط بمكتبة';const hasExpected=text.includes(expected),hasApply=await page.locator(`a[href="/${locale}/franchise/candidature"]`).count()>0;
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);await page.screenshot({path:resolve(out,`no-mandate-${locale}-390.png`),fullPage:true});proof.tests.push({id:`NO_MANDATE_${locale}`,status:hasExpected&&hasApply&&!overflow?'PASS':'FAIL',httpStatus:response.status(),preciseAbsenceExplained:hasExpected,concreteApplyAction:hasApply,overflow,dir:await page.locator('html').getAttribute('dir'),lang:await page.locator('html').getAttribute('lang')});
 }
 await context.close();const anonymous=await browser.newContext(),anonPage=await anonymous.newPage();const deep=`/fr/franchise/services/nouveau?organizationId=${actor.organizationId}`;await anonPage.goto(`http://127.0.0.1:${state.appPort}${deep}`,{waitUntil:'networkidle'});const target=new URL(anonPage.url());proof.tests.push({id:'ANONYMOUS_DEEP_LINK',status:target.searchParams.get('next')===deep?'PASS':'REPRODUCED',landingPath:target.pathname,nextPreserved:target.searchParams.get('next')===deep});proof.pageErrors=errors;await anonymous.close();
}catch(error){proof.failure=String(error).replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gu,'[REDACTED]');process.exitCode=1;}finally{await browser.close();await writeFile(resolve(out,'summary.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));}
