import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {before,after,test} from 'node:test';
import {chromium,expect} from '@playwright/test';

// Component interaction proof only: real React component, synthetic dashboard,
// replaced server action. No native accounting, authentication or RLS claim.
const root=process.cwd(),web=resolve(root,'apps/web');
let browser,script;
before(async()=>{
 const folder=(await readdir(resolve(root,'node_modules/.pnpm'))).filter(x=>x.startsWith('esbuild@')).sort().at(-1);
 assert.ok(folder,'ESBUILD_REQUIRED');
 const {build}=createRequire(resolve(root,'node_modules/.pnpm',folder,'loader.cjs'))('esbuild');
 const output=await build({stdin:{resolveDir:web,loader:'tsx',contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';
 import {FinancePanel} from '@/modules/admin/screens/finance/finance-panel';
 import {getAdminFinanceMessages} from '@/modules/admin/screens/finance/messages';
 const locale=document.documentElement.lang;
 createRoot(document.getElementById('root')).render(<FinancePanel locale={locale} dashboard={window.fixture} m={getAdminFinanceMessages(locale)} identity={{idempotencyKey:'test-key',correlationId:'test-correlation'}}/>);
 `},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},alias:{'@':web},plugins:[{name:'test-boundaries',setup(b){
  b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'boundary'}));
  b.onResolve({filter:/^\.\/actions$/},args=>args.importer.endsWith('finance-panel.tsx')?{path:'actions',namespace:'boundary'}:undefined);
  b.onLoad({filter:/.*/,namespace:'boundary'},args=>({resolveDir:web,loader:'jsx',contents:args.path==='link'?`import React from 'react';export default function Link(props){return <a {...props}/>}`:`export async function reconcilePaymentAction(_,form){window.submitted=Object.fromEntries(form.entries());return {status:'success',batchId:'fixture-batch'};}`}));
 }}]});script=output.outputFiles[0].text;browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();});

const payment=(id,organization_id,currency,unallocated_minor)=>({id,organization_id,organization_name:organization_id,payment_reference:id,currency,amount_minor:unallocated_minor,allocated_minor:'0',unallocated_minor,paid_on:'2026-11-01'});
const invoice=(id,organization_id,currency,outstanding_minor)=>({id,organization_id,organization_name:organization_id,invoice_number:id,currency,total_minor:outstanding_minor,paid_minor:'0',outstanding_minor,payment_status:'ISSUED',due_on:'2026-12-01'});
const fixture={as_of:'2026-11-23T12:00:00Z',payment_intents:[],payment_events:[],subscriptions:[],cycles:[],provider_payments:[payment('PAY-A','ORG-A','MAD','1000'),payment('PAY-B','ORG-B','MAD','2000'),payment('PAY-EUR','ORG-A','EUR','500'),payment('PAY-EMPTY','ORG-A','USD','100')],provider_invoices:[invoice('INV-A','ORG-A','MAD','800'),invoice('INV-A2','ORG-A','MAD','200'),invoice('INV-B','ORG-B','MAD','1500'),invoice('INV-EUR','ORG-A','EUR','600')]};

for(const locale of ['fr','ar'])for(const width of [360,1280])test(`finance matching and confirmation ${locale} ${width}`,async()=>{
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/*',route=>route.abort());
  await page.setContent(`<html lang="${locale}" dir="${locale==='ar'?'rtl':'ltr'}"><body><div id="root"></div></body></html>`);
  await page.evaluate(f=>{window.fixture=f;},fixture);await page.addScriptTag({content:script});
  const form=page.locator('#rapprochements'),pay=form.locator('[name="paymentId"]'),inv=form.locator('[name="invoiceId"]'),amount=form.locator('[name="amountMinor"]'),confirm=form.locator('[name="confirmed"]');
  await expect(pay).toHaveValue('PAY-A');await expect(inv.locator('option')).toHaveText([/INV-A/,/INV-A2/]);await expect(amount).toHaveValue('800');
  await confirm.check();await inv.selectOption('INV-A2');await expect(amount).toHaveValue('200');await expect(confirm).not.toBeChecked();
  await confirm.check();await pay.selectOption('PAY-B');await expect(inv.locator('option')).toHaveCount(1);await expect(inv).toHaveValue('INV-B');await expect(amount).toHaveValue('1500');await expect(confirm).not.toBeChecked();
  await pay.selectOption('PAY-EUR');await expect(inv).toHaveValue('INV-EUR');await expect(amount).toHaveValue('500');
  await pay.selectOption('PAY-EMPTY');await expect(inv).toHaveValue('');await expect(form.locator('[type="submit"]')).toBeDisabled();
  await pay.selectOption('PAY-B');await expect(form.locator('[type="submit"]')).toBeEnabled();await confirm.check();await form.locator('[type="submit"]').click();
  await expect.poll(()=>page.evaluate(()=>window.submitted)).toMatchObject({paymentId:'PAY-B',invoiceId:'INV-B',amountMinor:'1500',confirmed:'yes',locale});
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
