import { requireDevelopment, loadOwnState } from './safety.mjs';
requireDevelopment();
const actorLabel=process.argv.find(argument=>argument.startsWith('--actor='))?.slice(8)??'owner';
if(!/^[a-z][a-z0-9-]{1,32}$/u.test(actorLabel))throw new Error('INVALID_TEST_ACTOR_LABEL');
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = process.cwd(), require = createRequire(resolve(root, 'apps/web/package.json')), { createClient } = require('@supabase/supabase-js'), { createServerClient } = require('@supabase/ssr'), { chromium } = createRequire(resolve(root, 'package.json'))('@playwright/test');
const s = await loadOwnState(), actors = JSON.parse(await readFile(resolve(s.directory, 'actors.private.json'), 'utf8'));
const owner = actors.find(a => a.label === actorLabel), foreign = actors.find(a => a.label === 'foreign'), origin = `http://127.0.0.1:${s.appPort}`, api = `http://127.0.0.1:${s.gatewayPort}`;
const cookies = new Map(), ssr = createServerClient(api, s.anonKey, { cookies: { getAll: () => [...cookies.values()], setAll: items => items.forEach(item => cookies.set(item.name, item)) } });
if ((await ssr.auth.setSession(owner.session)).error)
    throw new Error('NATIVE_SSR_SESSION_FAILED');
const client = createClient(api, s.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
await client.auth.setSession(owner.session);
const proof = { scope: 'OWNED_ISOLATED_CLIENT_NATIVE_AUTH_BROWSER',appTree:execFileSync('git',['rev-parse','HEAD:apps/web'],{encoding:'utf8'}).trim(),actorLabel,ownerOrganizationId:owner.organizationId, nativeOnboardingCertified: false, physicalScanningCertified: false, status: 'RUNNING', candidate: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sourceArchiveSha256: s.baselineArchiveSha256, additionalMigrations:s.additionalMigrations??[], actorBootstrap: 'SYNTHETIC_LOCAL_SQL_ROLE_FIXTURE_NOT_GOVERNED_ONBOARDING_PROOF', nativeAuth: { otp: true, totpAal2: true, userJwtFabrication: false }, pages: [], security: [], businessWorkflowCertified: false, externalProvidersCertified: false, pageErrors: [], menus: [], publicSession: [], failures:[] };
const directory = resolve(s.directory, process.argv.includes('--full-client') ? 'browser-full-client' : process.argv.includes('--menus-probe') ? 'browser-menus-probe' : process.argv.includes('--probe') ? 'browser-probe' : 'browser');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
let activeCase=null;
const check = (value, code) => { if (!value){proof.failures.push({code,context:activeCase});if(['NATIVE_TEST_AAL2_REQUIRED','FOREIGN_ORGANIZATION_VISIBLE','CLIENT_ADMIN_RPC_NOT_DENIED'].includes(code))throw new Error(code);}return value; };
try {
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    check(!assurance.error && assurance.data?.currentLevel === 'aal2', 'NATIVE_TEST_AAL2_REQUIRED');
    proof.nativeAuth.verifiedCurrentLevel = assurance.data.currentLevel;
    const admin = await client.rpc('list_admin_supervision_page_v1', { p_limit: 25, p_offset: 0 });
    proof.security.push({ case: 'client-cannot-admin-rpc', denied: admin.error?.code === '42501' });
    check(admin.error?.code === '42501', 'CLIENT_ADMIN_RPC_NOT_DENIED');
    const org = await client.from('organizations').select('id').eq('id', foreign.organizationId);
    proof.security.push({ case: 'client-cannot-read-foreign-organization', denied: !org.error && org.data.length === 0 });
    check(!org.error && org.data.length === 0, 'FOREIGN_ORGANIZATION_VISIBLE');
    const fullPaths = ['client/diagnostics','client/questionnaires','client/actions','client/portefeuille','client/credits','client/recompenses','client/demandes','client/documents','notifications','client/abonnement','client/achats-groupes','client/boxes/configuration','client/contrats','client/favoris','client/finances','client/litiges','client/missions','client/onboarding','client/recherche','messagerie','organisation','tableau-de-bord'];
    const paths = process.argv.includes('--full-client') ? fullPaths : process.argv.includes('--menus-probe') ? [] : process.argv.includes('--probe') ? ['client/portefeuille', 'client/recompenses'] : ['client/diagnostics', 'client/questionnaires', 'client/actions', 'client/portefeuille', 'client/credits', 'client/recompenses', 'client/demandes', 'client/documents', 'notifications'];
    for (const locale of ['fr', 'ar'])
        for (const width of (process.argv.includes('--menus-probe') ? [360] : process.argv.includes('--probe') ? [375, 1440] : [360, 375, 390, 768, 1440])) {
            const context = await browser.newContext({ viewport: { width, height: 960 }, hasTouch: width < 768, serviceWorkers: 'block' });
            await context.addCookies([...cookies.values()].map(c => ({ name: c.name, value: c.value, url: origin, httpOnly: false, secure: false, sameSite: 'Lax' })));
            await context.route('**/*', async (route) => { const h = route.request().headers(); if (h['next-router-prefetch'] !== undefined || /prefetch/.test(h.purpose ?? ''))
                return route.abort(); return route.continue(); });
            const page = await context.newPage();
            page.on('pageerror', error => proof.pageErrors.push({ locale, width, message: error.message.slice(0, 500) }));
            for (const path of paths) {
                activeCase={locale,width,path};
                const route = `/${locale}/${path}?organizationId=${owner.organizationId}`;
                const response = await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 90000 });
                await page.locator('h1').first().waitFor({ timeout: 30000 });
                const alerts = await page.getByRole('alert').allTextContents();
                const record = { locale, width, path, http: response?.status(), redirectedToLogin: page.url().includes('/connexion'), selectedOrganizationRetained: new URL(page.url()).searchParams.get('organizationId') === owner.organizationId, rtl: await page.locator('html').getAttribute('dir') === 'rtl', horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), alerts };
                proof.pages.push(record);
                console.log(JSON.stringify({ locale, width, path, http: record.http, overflow: record.horizontalOverflow, alerts: alerts.length }));
                await page.screenshot({ path: resolve(directory, `${locale}-${width}-${path.replaceAll('/', '-')}.png`), fullPage: true, caret: 'initial' });
                check(record.http === 200 && !record.redirectedToLogin, 'CLIENT_NATIVE_PAGE_FAILED');
                check(!record.horizontalOverflow, 'CLIENT_HORIZONTAL_OVERFLOW');
                check(record.rtl === (locale === 'ar'), 'CLIENT_LOCALE_DIRECTION_INCORRECT');
                check(record.selectedOrganizationRetained, 'CLIENT_ORGANIZATION_CONTEXT_LOST');
            }
            if (!process.argv.includes('--probe')) {
                await page.goto(`${origin}/${locale}/client/diagnostics?organizationId=${owner.organizationId}`, { waitUntil: 'networkidle', timeout: 90000 });
                const menu = page.locator('details.client-account').first(), summary = menu.locator('summary');
                await summary.focus();
                await page.keyboard.press('Enter');
                check(await menu.evaluate(element => element.open), 'ACCOUNT_MENU_KEYBOARD_OPEN_FAILED');
                const account = menu.locator('a').first();
                await page.keyboard.press('Tab');
                check(await account.evaluate(element=>element===document.activeElement),'ACCOUNT_MENU_TAB_ORDER_FAILED');
                await account.scrollIntoViewIfNeeded();
                const exposed = await account.evaluate(element => { const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && (element === hit || element.contains(hit)); });
                await page.screenshot({path:resolve(directory,`${locale}-${width}-account-menu-before-exposure-check.png`),fullPage:true,caret:'initial'});
                if(!exposed) proof.menuFailure=await account.evaluate(element=>{const r=element.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{target:{x:r.x,y:r.y,width:r.width,height:r.height},hit:hit?.outerHTML.slice(0,500)};});
                check(exposed, 'ACCOUNT_MENU_OCCLUDED');
                const href = await account.getAttribute('href');
                check(href?.includes('organizationId=' + owner.organizationId), 'ACCOUNT_MENU_LOST_ORGANIZATION');
                await page.screenshot({ path: resolve(directory, `${locale}-${width}-account-menu.png`), fullPage: true, caret: 'initial' });
                await summary.focus();
                await page.keyboard.press('Enter');
                check(!(await menu.evaluate(element => element.open)), 'ACCOUNT_MENU_KEYBOARD_CLOSE_FAILED');
                if(width<768){await summary.tap();check(await menu.evaluate(element=>element.open),'ACCOUNT_MENU_TOUCH_OPEN_FAILED');await summary.tap();check(!(await menu.evaluate(element=>element.open)),'ACCOUNT_MENU_TOUCH_CLOSE_FAILED');}
                proof.menus.push({ locale, width, keyboardOpenClose: true, keyboardTabReachesAccountLink:true, touchTapOpenClose:width<768, accountLinkExposed: true, organizationRetained: true });
                await page.goto(`${origin}/${locale}`, { waitUntil: 'networkidle', timeout: 90000 });
                activeCase={locale,width,path:'public-session'};
                const space = page.getByRole('link', { name: locale === 'fr' ? 'Mon espace · Client' : 'مساحتي · عميل', exact: true }).first();
                const present=await space.count()>0;check(present,'PUBLIC_SESSION_SPACE_MISSING');
                const spaceHref=present?await space.getAttribute('href'):null;
                if(present)check(spaceHref?.includes('/'+locale+'/'),'PUBLIC_SESSION_SPACE_INVALID');
                proof.publicSession.push({locale,width,signedInClientSpacePresent:present,href:spaceHref});
                await page.screenshot({path:resolve(directory,`${locale}-${width}-public-session.png`),fullPage:true,caret:'initial'});
            }
            for (const path of [`/${locale}/administration/entreprises`, `/${locale}/client/actions?organizationId=${foreign.organizationId}`]) {
                const response = await page.goto(origin + path, { waitUntil: 'networkidle', timeout: 90000 });
                const destination = new URL(page.url()).pathname;
                const denied = [403, 404].includes(response?.status()) || (path.includes('/administration/') && !destination.includes('/administration/') && !destination.includes('/connexion'));
                proof.security.push({ case: path.includes('/administration/') ? 'client-cannot-admin-page' : 'client-cannot-select-foreign-org', locale, width, denied, http: response?.status(), destination });
                check(denied, 'CLIENT_ROUTE_SCOPE_NOT_DENIED');
            }
            await context.close();
        }
    check(!proof.pageErrors.some(error => /hydration|didn't match/iu.test(error.message)), 'HYDRATION_REGRESSION');
    proof.navigationAndGeometryPassed = !proof.failures.some(f=>/PAGE_FAILED|OVERFLOW|DIRECTION|CONTEXT_LOST/u.test(f.code));
    proof.functionalReadinessPassed = !proof.pages.some(page => page.alerts.some(text => /impossible de charger|QUERY_FAILED|onboarding indisponible|ne peuvent pas être charg|تعذر تحميل/iu.test(text)));
    proof.status = proof.functionalReadinessPassed&&proof.failures.length===0 ? 'PASSED' : 'FAILED';
    if (proof.status==='FAILED') {
        proof.failure = 'CLIENT_MODULE_LOADING_ERRORS';
        process.exitCode = 1;
    }
}
catch (e) {
    proof.status = 'FAILED';
    proof.failure = e.message;
    process.exitCode = 1;
    console.log(JSON.stringify({ failure: e.message }));
}
finally {
    await browser.close();
    await writeFile(resolve(directory, 'summary.json'), JSON.stringify(proof, null, 2) + '\n');
    console.log(JSON.stringify({ status: proof.status, pages: proof.pages.length, security: proof.security.length, evidence: resolve(directory, 'summary.json') }));
}
