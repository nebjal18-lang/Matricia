// Local browser policy recipe. Every request is fulfilled in memory; no PSP is contacted.
import { chromium } from '@playwright/test';
import { paymentFormActionPolicy } from '../../apps/web/modules/shared/lib/payment-form-policy.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const policy=paymentFormActionPolicy({PAYMENT_PROVIDER:'CMI',CMI_GATEWAY_URL:'https://testpayment.cmi.co.ma/gateway',CMI_GATEWAY_ALLOWED_HOSTS:'testpayment.cmi.co.ma'});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const cases=[];
try{
 for(const [target,expected]of [['https://testpayment.cmi.co.ma/gateway',1],['https://untrusted.invalid/gateway',0]]){
  const context=await browser.newContext();let posts=0;
  try{
   await context.route('**/*',async route=>{
    if(route.request().method()==='POST'){posts++;return route.fulfill({status:200,body:'synthetic gateway'});}
    return route.fulfill({status:200,headers:{'content-type':'text/html','content-security-policy':policy},body:`<form method="post" action="${target}"><button>Pay</button></form>`});
   });
   const page=await context.newPage();await page.goto('http://127.0.0.1:4999/payment');
   await page.evaluate(()=>{window.violations=[];document.addEventListener('securitypolicyviolation',event=>window.violations.push(event.effectiveDirective));document.querySelector('form').submit();});
   if(expected)await page.waitForURL(target);else await page.waitForFunction(()=>window.violations.includes('form-action'));
   if(posts!==expected)throw Error('UNEXPECTED_GATEWAY_POST_COUNT');
   cases.push({target,expectedPosts:expected,actualPosts:posts,status:'PASS'});
  }finally{await context.close();}
 }
}finally{await browser.close();}
await mkdir('work/v1-closure',{recursive:true});
await writeFile('work/v1-closure/cmi-browser.json',JSON.stringify({environment:'local-intercepted-browser',liveGatewayContacted:false,policy,policySha256:createHash('sha256').update(policy).digest('hex'),cases},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',assertions:cases.length,liveGatewayContacted:false}));
