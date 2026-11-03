import {createRequire} from 'node:module';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSafeConfiguration,resolveExpectedDatabaseUrl} from '../../../scripts/p05-e2e/environment.mjs';
import {totp} from '../../../scripts/p05-e2e/totp.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const require=createRequire(resolve(root,'package.json'));
const webRequire=createRequire(resolve(root,'apps/web/package.json'));
const {createClient}=webRequire('@supabase/supabase-js');const postgres=require('postgres');
process.umask(0o077);
const config=await loadSafeConfiguration(root);
if(config.runtimeMode!=='isolated-local-docker'||!config.localDockerVerified)throw new Error('VERIFIED_LOCAL_TEST_ENVIRONMENT_REQUIRED');
const adminOnly=process.argv.includes('--admin-only');
const id=randomUUID(),directory=resolve(root,'work/audit30-native-acceptance',id);await mkdir(directory,{recursive:true});
const admin=createClient(config.supabaseUrl,config.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
const {supervisionSchema}=await import(new URL('../../../apps/web/modules/admin/data/supervision/types.ts',import.meta.url));
const db=postgres(resolveExpectedDatabaseUrl(config),{ssl:false,max:1,onnotice:()=>{}});
const users=[],organizations=[];const provenance={harnessSha256:createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex'),buildId:process.argv.includes('--probe')?null:(await readFile(resolve(root,'apps/web/.next/BUILD_ID'),'utf8')).trim()};const proof={scope:'LOCAL_SYNTHETIC_NATIVE_AUTH_AND_ORGANIZATION_ACCEPTANCE',mode:adminOnly?'ADMIN_ONLY':'FOUR_ROLE_READINESS',runId:id,roleBootstrap:'TEST_ONLY_NOT_GOVERNED_ROLE_ASSIGNMENT_PROOF',provenance,rpc:[],browser:[],cleanup:{verified:false},status:'RUNNING'};
let browser;
let stage="setup";let activePage;
function check(value,code){if(!value)throw new Error(code)}
async function blockPrefetch(context){await context.route('**/*',async route=>{const h=route.request().headers();if(h['next-router-prefetch']!==undefined||/prefetch/.test(h.purpose??''))return route.abort();await route.continue()});}
async function actor(label){const email=`final-${label}-${id}@example.invalid`;const created=await admin.auth.admin.createUser({email,email_confirm:true,app_metadata:{final_acceptance_fixture:id}});check(!created.error&&created.data.user,'FIXTURE_USER_CREATION_FAILED');const userId=created.data.user.id;users.push(userId);const link=await admin.auth.admin.generateLink({type:'magiclink',email});check(!link.error,'FIXTURE_NATIVE_LINK_FAILED');const client=createClient(config.supabaseUrl,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});const login=await client.auth.verifyOtp({type:'magiclink',token_hash:link.data.properties.hashed_token});check(!login.error,'FIXTURE_NATIVE_LOGIN_FAILED');const enrolled=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Final local acceptance'});check(!enrolled.error,'FIXTURE_NATIVE_MFA_ENROLL_FAILED');let valid=false;for(const offset of[0,-30000,30000]){const verification=await client.auth.mfa.challengeAndVerify({factorId:enrolled.data.id,code:totp(enrolled.data.totp.secret,Date.now()+offset)});if(!verification.error){valid=true;break}}check(valid,'FIXTURE_NATIVE_MFA_FAILED');const identity=await client.auth.getUser(),aal=await client.auth.mfa.getAuthenticatorAssuranceLevel();check(identity.data.user?.id===userId&&aal.data?.currentLevel==='aal2','FIXTURE_NATIVE_IDENTITY_NOT_AAL2');return{client,userId,email};}
try{
 const privileged=await actor('admin'),ordinary=await actor('owner'),provider=await actor('provider'),franchise=await actor('franchise');
 // Bootstrap is fixture setup only, with real sessions and all SQL guards intact.
 await db`insert into public.platform_user_roles(user_id,role_code)values(${privileged.userId}::uuid,'COMPLIANCE_MANAGER')`;
 const displayName=`Final acceptance ${id}`;
 const created=await ordinary.client.rpc('create_or_request_organization',{p_legal_name:displayName,p_display_name:displayName,p_ice:String(BigInt('0x'+randomBytes(6).toString('hex'))).padStart(15,'0'),p_owner_role:'CLIENT_OWNER',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
 check(!created.error&&created.data?.organization_id,'FIXTURE_NATIVE_ORGANIZATION_FAILED');organizations.push(created.data.organization_id);
 for(const [person,role] of [[provider,'PROVIDER_OWNER'],[franchise,'FRANCHISE_OWNER']]){
  const result=await person.client.rpc('create_or_request_organization',{p_legal_name:`Audit30 test ${role} ${id}`,p_display_name:`Audit30 test ${role} ${id}`,p_ice:String(BigInt('0x'+randomBytes(6).toString('hex'))).padStart(15,'0'),p_owner_role:role,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
  check(!result.error&&result.data?.organization_id,'NATIVE_ROLE_ORGANIZATION_FAILED');organizations.push(result.data.organization_id);
 }
 for(const [label,client]of[['admin',privileged.client],['ordinary',ordinary.client]]){
  const response=await client.rpc('list_admin_supervision_page_v1',{p_limit:100,p_offset:0});
  proof.rpc.push({actor:label,authenticatedAal2:true,code:response.error?.code??null,organizationCount:Array.isArray(response.data?.organizations)?response.data.organizations.length:null,schemaValid:!response.error&&supervisionSchema.safeParse(response.data).success});
  if(label==='admin')check(!response.error&&supervisionSchema.safeParse(response.data).success,'ADMIN_PROJECTION_OR_SCHEMA_FAILED');
  if(label==='ordinary')check(response.error?.code==='42501','NON_ADMIN_PROJECTION_NOT_DENIED');
 }
 if(!process.argv.includes('--probe')){
  const {createServerClient}=webRequire('@supabase/ssr');const bag=new Map();const ssr=createServerClient(config.supabaseUrl,config.publishableKey,{cookies:{getAll:()=>[...bag.values()],setAll:items=>items.forEach(item=>bag.set(item.name,item))}});const session=await privileged.client.auth.getSession();const set=await ssr.auth.setSession(session.data.session);check(!set.error,'FIXTURE_SSR_SESSION_FAILED');
  const {chromium}=require('@playwright/test');browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium'});
  for(const locale of['fr','ar'])for(const width of[375,390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<768,serviceWorkers:'block'});await blockPrefetch(context);await context.addCookies([...bag.values()].map(c=>({name:c.name,value:c.value,url:config.baseUrl,httpOnly:false,secure:false,sameSite:'Lax'})));const page=await context.newPage();await context.route('**/*',async route=>{const h=route.request().headers();if(h['next-router-prefetch']!==undefined||/prefetch/.test(h.purpose??''))return route.abort();await route.continue()});
   activePage=page;
   stage=`account-menu-${locale}-${width}`;
   await page.goto(`${config.baseUrl}/${locale}/administration/command-center`,{waitUntil:'networkidle',timeout:30000});
   const account=page.locator('.admin-workspace details.client-account');check(await account.count()===1,'ADMIN_ACCOUNT_MENU_MISSING');
   await account.locator('summary').focus();await page.keyboard.press('Enter');
   const signout=account.getByRole('button');await signout.waitFor({state:'visible'});
   const menu=account.locator(':scope > div');const menuRect=await menu.boundingBox();check(menuRect&&menuRect.x>=0&&menuRect.x+menuRect.width<=width+1,'ACCOUNT_MENU_OUTSIDE_VIEWPORT');
   await page.keyboard.press('Tab');check(await account.locator('a').first().evaluate(el=>el===document.activeElement),'ACCOUNT_MENU_TAB_ORDER_FAILED');
   check(await signout.evaluate(el=>{const r=el.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return top!==null&&(el===top||el.contains(top));}),'ACCOUNT_MENU_COVERED');
   await page.screenshot({path:resolve(directory,`admin-menu-${locale}-${width}.png`),fullPage:true});
   await account.locator('summary').click();
   stage=`open-${locale}-${width}`;const response=await page.goto(`${config.baseUrl}/${locale}/administration/entreprises`,{waitUntil:'networkidle',timeout:30000});check(response?.status()===200,'ADMIN_ORGANIZATIONS_HTTP_FAILED');check(!page.url().includes('/connexion'),'ADMIN_NATIVE_BROWSER_AUTH_FAILED');const search=page.locator('input[name="q"]').first();check(await search.count()===1,'ADMIN_SEARCH_INPUT_MISSING');stage=`search-${locale}-${width}`;await search.fill(displayName);await search.press('Enter');await page.waitForURL(url=>url.searchParams.get('q')===displayName);await page.waitForLoadState('networkidle');check(await page.locator('html').getAttribute('dir')===(locale==='ar'?'rtl':'ltr'),'ADMIN_DIRECTION_FAILED');
   stage=`select-${locale}-${width}`;const table=page.locator('.client-table-wrap').first();check((await table.boundingBox()).width<=width,'ADMIN_TABLE_VIEWPORT_NOT_BOUNDED');check(await table.getAttribute('tabindex')==='0','ADMIN_TABLE_NOT_KEYBOARD_REACHABLE');const link=page.locator(`a[href*="/administration/entreprises/${organizations[0]}"]`).first();check(await link.count()>0,'OWN_ORGANIZATION_SEARCH_RESULT_MISSING');await link.locator('xpath=ancestor::tr').locator('summary').click();await link.click();await page.waitForURL(`**/administration/entreprises/${organizations[0]}**`);await page.getByRole('heading',{level:1}).filter({hasText:displayName}).waitFor({state:'visible',timeout:15000});await page.goto(`${config.baseUrl}/${locale}`,{waitUntil:'networkidle'});if(await page.getByRole('link',{name:/Mon espace|مساحتي/}).count()===0)await page.locator('.premium-menu-trigger').click();const home=page.getByRole('link',{name:/Mon espace|مساحتي/}).first();check((await home.getAttribute('href'))?.includes('/administration/'),'PUBLIC_ADMIN_WORKSPACE_LINK_MISSING');proof.browser.push({locale,width,realSearchAndSelection:true,ownOrganizationHeadingVerified:true,menuBoundsVerified:true,menuKeyboardTabVerified:true,publicAdminWorkspaceVerified:true});console.log(JSON.stringify({stage:`admin-verified-${locale}-${width}`}));
   if(locale==='ar'&&width===1440){stage='native-admin-signout';await page.goto(`${config.baseUrl}/${locale}/administration/command-center`,{waitUntil:'networkidle'});const accountMenu=page.locator('.admin-workspace details.client-account');await accountMenu.locator('summary').click();await accountMenu.getByRole('button').click();await page.waitForURL(url=>url.pathname===`/${locale}/connexion`);await page.goto(`${config.baseUrl}/${locale}/administration/entreprises`,{waitUntil:'networkidle'});check(new URL(page.url()).pathname===`/${locale}/connexion`,'SIGNED_OUT_ADMIN_ROUTE_NOT_PROTECTED');await page.goto(`${config.baseUrl}/${locale}`,{waitUntil:'networkidle'});check(await page.locator(`a.premium-nav-login[href="/${locale}/connexion"]`).count()>0,'SIGNED_OUT_PUBLIC_NAVIGATION_FAILED');proof.nativeSignOut={verified:true,protectedRouteDenied:true,publicAnonymousNavigation:true};}
   await context.close();
  }
  if(!adminOnly){
  const clientBag=new Map();const clientSsr=createServerClient(config.supabaseUrl,config.publishableKey,{cookies:{getAll:()=>[...clientBag.values()],setAll:items=>items.forEach(item=>clientBag.set(item.name,item))}});
  const clientSession=await ordinary.client.auth.getSession();check(!(await clientSsr.auth.setSession(clientSession.data.session)).error,'CLIENT_SSR_SESSION_FAILED');
  proof.client=[];
  for(const locale of ['fr','ar'])for(const width of[375,390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<768,serviceWorkers:'block'});
   await blockPrefetch(context);await context.addCookies([...clientBag.values()].map(c=>({name:c.name,value:c.value,url:config.baseUrl,httpOnly:false,secure:false,sameSite:'Lax'})));
   const page=await context.newPage();activePage=page;
   for(const path of['client/demandes','client/documents','messagerie','client/finances','client/credits','client/favoris','client/portefeuille']){
    stage=`client-${locale}-${width}-${path}`;
    const response=await page.goto(`${config.baseUrl}/${locale}/${path}?organizationId=${organizations[0]}`,{waitUntil:'networkidle',timeout:30000});
    const body=await page.locator('body').innerText();
    const errors=await page.getByRole('alert').allTextContents();
    const technicalAlerts=errors.filter(text=>/indisponible|QUERY_FAILED|UNAVAILABLE|خطأ تقني|غير متاح/iu.test(text));
    const technical=technicalAlerts.length>0;
    const expectedInvoicePartial=path==='client/portefeuille'&&technicalAlerts.length>0&&technicalAlerts.every(text=>/La sélection des factures est momentanément indisponible|اختيار الفواتير غير متاح مؤقتاً/u.test(text));
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    proof.client.push({locale,width,path,http:response?.status(),selectedOrganizationRetained:new URL(page.url()).searchParams.get('organizationId')===organizations[0],technicalError:technical,expectedInvoiceProjectionPartial:expectedInvoicePartial,horizontalOverflow:overflow,hasHeading:await page.getByRole('heading',{level:1}).count()>0});
    console.log(JSON.stringify({stage}));await page.screenshot({path:resolve(directory,`client-${locale}-${width}-${path.replaceAll('/','-')}.png`),fullPage:true});
    check(response?.status()===200&&!page.url().includes('/connexion'),'CLIENT_ROUTE_OR_AUTH_FAILED');
    check(!technical||expectedInvoicePartial,'CLIENT_TECHNICAL_LOADING_FAILED');check(!overflow,'CLIENT_HORIZONTAL_OVERFLOW');
    check(!/request_number/iu.test(body),'PRIVATE_DATABASE_DETAIL_VISIBLE');
   }
   stage=`client-public-session-${locale}-${width}`;
   await page.goto(`${config.baseUrl}/${locale}`,{waitUntil:'networkidle'});
   if(await page.getByRole('link',{name:/Mon espace|مساحتي/}).count()===0)await page.locator('.premium-menu-trigger').click();
   check(await page.getByRole('link',{name:/Mon espace|مساحتي/}).count()>0,'PUBLIC_SESSION_RETURN_LINK_MISSING');
   const adminResponse=await page.goto(`${config.baseUrl}/${locale}/administration/entreprises`,{waitUntil:'networkidle'});
   check(adminResponse?.status()===403||adminResponse?.status()===404||!/administration\/entreprises(?:\?|$)/u.test(page.url()),'CLIENT_ADMIN_ACCESS_NOT_DENIED');
   await context.close();
  }
  proof.readiness=[];
  for(const [label,person,organizationId,paths] of [
   ['provider',provider,organizations[1],['sous-traitant/qualification','sous-traitant/consultations','sous-traitant/devis','sous-traitant/documents','sous-traitant/planning']],
   ['franchise',franchise,organizations[2],['franchise/accueil','franchise/bibliotheque','franchise/services','franchise/questionnaires','franchise/regles','franchise/validations','franchise/documents','franchise/gouvernance','franchise/marketing']],
  ]){
   const roleBag=new Map();const roleSsr=createServerClient(config.supabaseUrl,config.publishableKey,{cookies:{getAll:()=>[...roleBag.values()],setAll:items=>items.forEach(item=>roleBag.set(item.name,item))}});
   const roleSession=await person.client.auth.getSession();check(!(await roleSsr.auth.setSession(roleSession.data.session)).error,'ROLE_SSR_SESSION_FAILED');
   for(const locale of['fr','ar'])for(const width of[375,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<768,serviceWorkers:'block'});await blockPrefetch(context);await context.addCookies([...roleBag.values()].map(c=>({name:c.name,value:c.value,url:config.baseUrl,httpOnly:false,secure:false,sameSite:'Lax'})));
    const page=await context.newPage();activePage=page;
    for(const path of paths){stage=`readiness-${label}-${locale}-${width}-${path}`;const response=await page.goto(`${config.baseUrl}/${locale}/${path}?organizationId=${organizationId}`,{waitUntil:'networkidle',timeout:30000});
     const technical=await page.locator('[data-error-reason],[data-workspace-failure]').evaluateAll(elements=>elements.some(el=>/QUERY_FAILED|SHAPE_INVALID|UNAVAILABLE|INVALID_RESPONSE/u.test(el.getAttribute('data-error-reason')??el.getAttribute('data-workspace-failure')??'')));
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
     proof.readiness.push({role:label,locale,width,path,http:response?.status(),technicalError:technical,horizontalOverflow:overflow,qualificationAndMandateWorkflowCertified:false});
     console.log(JSON.stringify({stage}));await page.screenshot({path:resolve(directory,`${label}-${locale}-${width}-${path.replaceAll('/','-')}.png`),fullPage:true});
     check(response?.status()===200&&!page.url().includes('/connexion'),'ROLE_ROUTE_OR_AUTH_FAILED');check(!technical,'ROLE_TECHNICAL_LOADING_FAILED');check(!overflow,'ROLE_HORIZONTAL_OVERFLOW');
    }
    await context.close();
   }
  }
  }
 }
 proof.status='PASSED';
}catch(error){proof.status='FAILED';proof.failureStage=stage;if(activePage){await activePage.screenshot({path:resolve(directory,'failure.private.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(directory,'failure.private.log'),String(error.message));}proof.failure=String(error.message).replace(/[^A-Z0-9_:-]/g,'').slice(0,120);process.exitCode=1;}
finally{
 if(browser)await browser.close();
 try{
  await db.begin(async tx=>{
   if(organizations.length){await tx`update public.event_outbox set dead_lettered_at=coalesce(dead_lettered_at,clock_timestamp()),last_error_code='FINAL_FIXTURE_NEUTRALIZED',locked_at=null,locked_by=null where organization_id=any(${organizations}::uuid[]) and published_at is null`;await tx`update public.organization_member_roles r set revoked_at=coalesce(r.revoked_at,clock_timestamp()) from public.organization_memberships m where r.membership_id=m.id and m.organization_id=any(${organizations}::uuid[])`;await tx`update public.organization_memberships set status='REVOKED',updated_at=clock_timestamp(),row_version=row_version+1 where organization_id=any(${organizations}::uuid[])`;await tx`update public.organizations set status='ARCHIVED',updated_at=clock_timestamp(),row_version=row_version+1 where id=any(${organizations}::uuid[])`;}
   if(users.length)await tx`delete from public.platform_user_roles where user_id=any(${users}::uuid[]) and role_code='COMPLIANCE_MANAGER'`;
  });
  for(const user of users){const factors=await admin.auth.admin.mfa.listFactors({userId:user});check(!factors.error,'FIXTURE_FACTOR_LIST_CLEANUP_FAILED');for(const factor of factors.data.factors){const removed=await admin.auth.admin.mfa.deleteFactor({userId:user,id:factor.id});check(!removed.error,'FIXTURE_FACTOR_CLEANUP_FAILED')}const removed=await admin.auth.admin.deleteUser(user,true);check(!removed.error,'FIXTURE_USER_CLEANUP_FAILED')}
  const [remaining]=await db`select (select count(*) from public.platform_user_roles where user_id=any(${users}::uuid[]))::int as roles,(select count(*) from public.organizations where id=any(${organizations}::uuid[])and status<>'ARCHIVED')::int as organizations,(select count(*) from auth.sessions where user_id=any(${users}::uuid[]))::int as sessions`;
  check(Object.values(remaining).every(x=>x===0),'FIXTURE_CLEANUP_INCOMPLETE');proof.cleanup={verified:true,actors:users.length,organizations:organizations.length,immutableEvidenceRetained:true};
 }catch{proof.cleanup={verified:false};proof.status='FAILED';proof.cleanupFailure='FIXTURE_CLEANUP_FAILED';process.exitCode=1;}
 await db.end();await writeFile(resolve(directory,'summary.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:proof.status,summary:resolve(directory,'summary.json'),rpc:proof.rpc,cleanup:proof.cleanup,failure:proof.failure??null}));
}
