import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {validFixtureProject} from './helpers/fixture-project.mjs';
import {settleVisualState} from './helpers/settled-visual-state';
import {formatMinorExact} from '../../apps/web/modules/shared/lib/solution-insights/model';
import {messages} from '../../apps/web/modules/client/screens/diagnostics/solutions/messages';
const path=process.env.E2E_LOCAL_BUNDLES_MANIFEST;
if(!path)throw new Error('LOCAL_BUNDLES_MANIFEST_REQUIRED');
const manifest=JSON.parse(readFileSync(path,'utf8'));
if(!validFixtureProject(manifest)||Date.parse(manifest.expiresAt)<=Date.now())throw new Error('LOCAL_BUNDLES_MANIFEST_INVALID');
for(const locale of ['fr','ar'] as const)test(`MAT-FUNC-010 ${locale} opens a multi-domain proposal in the guided need flow`,async({browser},info)=>{
 test.setTimeout(120000);const mobile=info.project.name.includes('mobile'),item=manifest.items[`${locale}_${mobile?'M':'D'}`];
 const context=await browser.newContext({storageState:item.state,viewport:mobile?{width:360,height:800}:{width:1280,height:900}});
 try{
  const page=await context.newPage();await page.goto(`/${locale}/client/diagnostics/solutions?organizationId=${item.organizationId}`);
  const section=page.locator('section[aria-labelledby="solution-bundles-title"]'),card=section.getByRole('article').filter({has:page.getByRole('heading',{name:item.code,exact:true})});
  await expect(card).toBeVisible();await expect(card).toContainText(item.description);
  await expect(page.getByText(messages(locale).empty,{exact:true})).toHaveCount(0);
  await expect(card.locator('strong')).toHaveText(formatMinorExact('150049','MAD',locale));
  await expect(card).toContainText(locale==='fr'?'2 domaines · 2 prestations regroupées':'2 مجالات · 2 خدمات مجمعة');
  await settleVisualState(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  let scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();if(scan.violations.length)throw new Error(`BUNDLE_ACCESSIBILITY_${scan.violations.map(v=>v.id).join('_')}`);
  const link=card.getByRole('link'),href=await link.getAttribute('href');expect(href).toBeTruthy();
  if(!href)throw new Error('BUNDLE_CONTINUATION_LINK_REQUIRED');
  const target=new URL(href,page.url());expect(target.searchParams.get('organizationId')).toBe(item.organizationId);expect(target.searchParams.get('q')).toBe(`${item.code}\n${item.description}`);
  await link.click();await expect(page).toHaveURL(new RegExp(`/${locale}/besoin\\?`));
  await expect(page.locator('textarea[aria-labelledby="need-step-title"]')).toHaveValue(`${item.code}\n${item.description}`);
  await settleVisualState(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();if(scan.violations.length)throw new Error(`BUNDLE_NEED_ACCESSIBILITY_${scan.violations.map(v=>v.id).join('_')}`);
 }finally{await context.close();}
});
