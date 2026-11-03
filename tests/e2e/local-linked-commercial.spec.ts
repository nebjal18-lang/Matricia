import {existsSync,readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import {validFixtureProject} from './helpers/fixture-project.mjs';

type Chain={locale:'fr'|'ar';contractId:string;missionId:string;clientOrganizationId:string;providerOrganizationId:string;deliveryLabel:string;state:string;foreignState:string;providerState:string};
const path=process.env.E2E_LOCAL_LINKED_COMMERCIAL_MANIFEST;
if(!path||!existsSync(path))throw new Error('LOCAL_LINKED_COMMERCIAL_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('LOCAL_LINKED_COMMERCIAL_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const){
 test(`${locale.toUpperCase()} same diagnostic contract and accepted delivery persist for both parties`,async({browser})=>{
  test.setTimeout(90_000);
  const chain=manifest.chains[locale] as Chain;
  if(!chain||chain.locale!==locale||!existsSync(chain.state)||!existsSync(chain.foreignState)||!existsSync(chain.providerState))throw new Error('LOCAL_LINKED_COMMERCIAL_STATE_REQUIRED');
  const client=await browser.newContext({storageState:chain.state,locale:`${locale}-MA`,timezoneId:'Africa/Casablanca'});
  const provider=await browser.newContext({storageState:chain.providerState,locale:`${locale}-MA`,timezoneId:'Africa/Casablanca'});
  const foreign=await browser.newContext({storageState:chain.foreignState});
  try{
   const page=await client.newPage(),url=`/${locale}/client/missions/${chain.missionId}?organizationId=${chain.clientOrganizationId}`;
   await page.goto(`/${locale}/client/contrats?organizationId=${chain.clientOrganizationId}`);
   const contract=page.locator(`#contrat-${chain.contractId}`);await expect(contract).toBeVisible();await expect(contract).toContainText('2/2');
   await expect(contract.locator(`a[href="${url}"]`)).toBeVisible();
   const response=await page.goto(url);expect(response?.status()).toBeLessThan(500);
   await expect(page.getByText(chain.deliveryLabel,{exact:true}).first()).toBeVisible();
   await page.reload();await expect(page.getByText(chain.deliveryLabel,{exact:true}).first()).toBeVisible();
   await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr');
   const deliveryPage=await provider.newPage();
   const providerResponse=await deliveryPage.goto(`/${locale}/sous-traitant/missions/${chain.missionId}?organizationId=${chain.providerOrganizationId}`);expect(providerResponse?.status()).toBeLessThan(500);
   await expect(deliveryPage.getByText(chain.deliveryLabel,{exact:true}).first()).toBeVisible();
   await deliveryPage.reload();await expect(deliveryPage.getByText(chain.deliveryLabel,{exact:true}).first()).toBeVisible();
   const denied=await foreign.newPage();await denied.goto(url);await expect(denied.locator('body')).not.toContainText(chain.deliveryLabel);
  }finally{await Promise.all([client.close(),provider.close(),foreign.close()]);}
 });
}
