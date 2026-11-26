import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {provision} from '../../../scripts/p05-e2e/provision.mjs';
import {loadSafeConfiguration} from '../../../scripts/p05-e2e/environment.mjs';
import {buildChildEnvironment,validateFreshManifest} from '../../../scripts/p05-e2e/security.mjs';
import {runSecuredBrowserSuite,writeLocalSuiteEvidence} from './secured-browser-runner.mjs';
const root=process.cwd(),directory=resolve(root,'artifacts/test-results',`.local-client-referrals-${randomUUID()}`);
let config,fixture,summary,failure,proof,stage='configuration',cleanupVerified=true;
try{
 config=await loadSafeConfiguration(root);assert.equal(config.runtimeMode,'isolated-local-docker');assert.equal(config.localDockerVerified,true);
 stage='fixture';fixture=await provision();await validateFreshManifest(fixture.manifest,config);const db=fixture.resources.database,targets={};
 for(const locale of ['fr','ar'])for(const device of ['D','M']){
  const suffix=`${locale}_${device}`,name=`P05 E2E REFERRAL ${suffix} ${fixture.manifest.runId}`;
  const result=await fixture.sessions.clientB.client.rpc('create_or_request_organization',{p_legal_name:name,p_display_name:name,p_ice:createHash('sha256').update(name).digest('hex').slice(0,16).toUpperCase(),p_owner_role:'CLIENT_OWNER',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
  assert.equal(result.error,null);assert.equal(result.data.outcome,'ORGANIZATION_CREATED');targets[suffix]=result.data.organization_id;fixture.resources.organizationIds.push(result.data.organization_id);
 }
 const expiry=new Date(Date.now()+2*86400000).toISOString().slice(0,10)+'T14:30';
 await mkdir(directory,{recursive:true,mode:0o700});const receipts=resolve(directory,'receipts');await mkdir(receipts,{mode:0o700});const path=resolve(directory,'manifest.json');
 await writeFile(path,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+1200000).toISOString(),targets,expiry}),{mode:0o600});
 stage='browser';summary=await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_REFERRALS_MANIFEST:path,E2E_LOCAL_REFERRALS_RECEIPTS:receipts}),specifications:['tests/e2e/local-client-referrals.spec.ts'],output:resolve(directory,'browser'),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']});
 stage='native-proof';
 for(const locale of ['fr','ar'])for(const device of ['D','M']){
  const receipt=JSON.parse(await readFile(resolve(receipts,`${locale}_${device}.json`),'utf8'));
  const [link]=await db`select * from public.referral_links where referral_code=${receipt.code}`;assert.ok(link);assert.equal(link.source_organization_id,fixture.manifest.fixtures.organizationA.id);assert.equal(link.max_conversions,1);
  const [date]=await db`select (${expiry}::text::timestamp at time zone 'Africa/Casablanca')::text expected`;assert.equal(new Date(link.expires_at).getTime(),new Date(date.expected).getTime());
  const args={p_source_organization_id:link.source_organization_id,p_referral_code:receipt.code,p_audience_type:'CLIENT',p_campaign_reference:receipt.campaign,p_expires_at:link.expires_at,p_max_conversions:1,p_idempotency_key:receipt.key};
  const replay=await fixture.sessions.clientA.client.rpc('create_referral_link',args);assert.equal(replay.error,null);assert.equal(replay.data.referral_link_id,link.id);
  const foreign=await fixture.sessions.clientB.client.rpc('create_referral_link',{...args,p_idempotency_key:randomUUID()});assert.equal(foreign.error?.code,'42501');
  const [conversion]=await db`select * from public.referral_conversions where referral_link_id=${link.id}::uuid`;assert.ok(conversion);assert.equal(conversion.target_organization_id,receipt.target);assert.equal(conversion.conversion_stage,'REGISTERED');assert.equal(conversion.origin_snapshot.consent_accepted,true);
  const claim={p_referral_code:receipt.code,p_target_organization_id:receipt.target,p_consent:true,p_idempotency_key:receipt.claimKey};
  const again=await fixture.sessions.clientB.client.rpc('claim_client_referral_v1',claim);assert.equal(again.error,null);assert.equal(again.data.referral_conversion_id,conversion.id);
  const consent=await fixture.sessions.clientB.client.rpc('claim_client_referral_v1',{...claim,p_consent:false,p_idempotency_key:randomUUID()});assert.equal(consent.error?.code,'42501');
  const self=await fixture.sessions.clientA.client.rpc('claim_client_referral_v1',{...claim,p_target_organization_id:link.source_organization_id,p_idempotency_key:randomUUID()});assert.equal(self.error?.code,'42501');
  const limit=await fixture.sessions.clientB.client.rpc('claim_client_referral_v1',{...claim,p_target_organization_id:fixture.manifest.fixtures.organizationB.id,p_idempotency_key:randomUUID()});assert.equal(limit.error?.code,'23514');assert.equal(limit.error?.message,'REFERRAL_CONVERSION_CAP_REACHED');
  const hidden=await fixture.sessions.noRole.client.from('referral_conversions').select('id').eq('id',conversion.id);assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[]);
  const [events]=await db`select count(*)::integer n from public.referral_conversion_events where referral_conversion_id=${conversion.id}::uuid`;assert.equal(events.n,1);
  const [touches]=await db`select count(*)::integer n from public.referral_touchpoints where referral_link_id=${link.id}::uuid`;assert.equal(touches.n,1);
  for(const [id,action,event]of [[link.id,'referral.link.created','ReferralLinkCreatedV1'],[conversion.id,'referral.conversion.registered','ReferralRegisteredV1']]){const [audit]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.resource_id=${id} and a.action=${action} and e.event_type=${event}`;assert.equal(audit.n,1);}
  const [sources]=await db`select count(*)::integer n from public.reward_source_events where source_reference_type='REFERRAL_CONVERSION' and source_reference_id=${conversion.id}`;assert.equal(sources.n,0);
 }
 proof={realUiClientReferralLinks:4,realUiConsentedClaims:4,realNavigableInvitationLinks:4,casablancaExpiryVerified:true,referralReplayVerified:true,consentRequired:true,selfReferralDenied:true,conversionCapEnforced:true,foreignConversionHidden:true,correlatedReferralAuditOutbox:true,noAutomaticVerificationActivationOrBonus:true,frArDesktop360Accessibility:true};
}catch(error){failure=error;summary??=error.browserSummary;}
finally{for(const cleanup of[()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})])try{await cleanup();}catch(error){cleanupVerified=false;failure??=error;}}
const safe=value=>typeof value==='string'&&/^[A-Z0-9_]{2,100}$/u.test(value)?value:null;
await writeLocalSuiteEvidence({root,suite:'client-referrals',config,summary,failure,cleanupVerified,proof:{...proof,stage,responseCode:safe(failure?.actual?.code),responseLabel:safe(failure?.actual?.message),failureLocations:[...(failure?.stack??'').matchAll(/([^\s()]+\.mjs):(\d+):(\d+)/gu)].slice(0,3).map(m=>({file:m[1].split('/').at(-1),line:Number(m[2])}))}});
if(failure){console.error('LOCAL_CLIENT_REFERRALS_FAILED');process.exitCode=1;}else console.log('LOCAL_CLIENT_REFERRALS_PASSED');
