import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {provision} from '../../../scripts/p05-e2e/provision.mjs';
import {loadSafeConfiguration} from '../../../scripts/p05-e2e/environment.mjs';
import {buildChildEnvironment,validateFreshManifest} from '../../../scripts/p05-e2e/security.mjs';
import {runSecuredBrowserSuite,writeLocalSuiteEvidence} from './secured-browser-runner.mjs';
const root=process.cwd(),directory=resolve(root,'artifacts/test-results',`.local-reward-rules-${randomUUID()}`);
let config,fixture,summary,failure,proof,stage='configuration',cleanupVerified=true;
try{
 config=await loadSafeConfiguration(root);assert.equal(config.runtimeMode,'isolated-local-docker');assert.equal(config.localDockerVerified,true);
 stage='fixture';fixture=await provision();await validateFreshManifest(fixture.manifest,config);const db=fixture.resources.database,client=fixture.sessions.central.client;
 await db`insert into public.platform_user_roles(user_id,role_code)values(${fixture.resources.userIds[2]}::uuid,'MATRICIA_ADMIN')on conflict do nothing`;
 // Global rules still require an actor-owned organization for the audit chain.
 const organization=await client.rpc('create_or_request_organization',{p_legal_name:`Matricia P05 E2E REWARDS ${fixture.manifest.runId}`,p_display_name:`P05 E2E REWARDS ${fixture.manifest.runId}`,p_ice:fixture.manifest.runId.replaceAll('-','').slice(0,16).toUpperCase(),p_owner_role:'CLIENT_OWNER',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
 assert.equal(organization.error,null);assert.equal(organization.data.outcome,'ORGANIZATION_CREATED');fixture.resources.organizationIds.push(organization.data.organization_id);
 await mkdir(directory,{recursive:true,mode:0o700});const receipts=resolve(directory,'receipts');await mkdir(receipts,{mode:0o700});const path=resolve(directory,'manifest.json');
 const from=new Date().toISOString().slice(0,10)+'T00:00',until=new Date(Date.now()+86400000).toISOString().slice(0,10)+'T00:00';
 await writeFile(path,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+1200000).toISOString(),from,until}),{mode:0o600});
 stage='browser';summary=await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_LOCAL_REWARD_RULES_MANIFEST:path,E2E_LOCAL_REWARD_RULES_RECEIPTS:receipts}),specifications:['tests/e2e/local-reward-rules.spec.ts'],output:resolve(directory,'browser'),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']});
 stage='native-proof';
 for(const locale of ['FR','AR'])for(const device of ['D','M']){
  const recorded=JSON.parse(await readFile(resolve(receipts,`${locale}_${device}.json`),'utf8'));
  for(const receipt of recorded){
   const [row]=await db`select *,bonus_credits::text bonus,per_recipient_cap_credits::text recipient_cap,global_cap_credits::text global_cap from public.reward_rule_versions where rule_code=${receipt.code} and version_number=${receipt.version}`;
   assert.ok(row);assert.equal(row.bonus,receipt.bonus);assert.equal(row.recipient_cap,'9007199254740997');assert.equal(row.global_cap,'9223372036854775807');assert.equal(row.requires_approval,true);assert.equal(row.status,receipt.version===1?'DRAFT':'ACTIVE');assert.deepEqual(row.eligibility_rule,{local_run:fixture.manifest.runId});
   const args={p_rule_code:row.rule_code,p_status:row.status,p_trigger_event:row.trigger_event,p_audience_type:row.audience_type,p_bonus_credits:row.bonus,p_per_recipient_cap_credits:row.recipient_cap,p_global_cap_credits:row.global_cap,p_window_days:row.window_days,p_cooldown_hours:row.cooldown_hours,p_credit_validity_days:row.credit_validity_days,p_eligibility_rule:row.eligibility_rule,p_requires_approval:row.requires_approval,p_effective_from:row.effective_from,p_effective_until:row.effective_until,p_change_reason:receipt.reason,p_idempotency_key:receipt.key};
   const replay=await client.rpc('create_reward_rule_version',args);assert.equal(replay.error,null);assert.equal(replay.data.rule_version_id,row.id);
   const foreign=await fixture.sessions.clientB.client.rpc('create_reward_rule_version',{...args,p_idempotency_key:randomUUID()});assert.equal(foreign.error?.code,'42501');
   const changed=await client.rpc('create_reward_rule_version',{...args,p_bonus_credits:'1'});assert.equal(changed.error?.code,'22000');
   const [audit]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.action='reward.rule_version.created' and a.resource_id=${row.id} and e.event_type='RewardRuleVersionCreatedV1'`;assert.equal(audit.n,1);
   const [grants]=await db`select count(*)::integer n from public.reward_grants where rule_version_id=${row.id}::uuid`;assert.equal(grants.n,0);
  }
  const [versions]=await db`select count(*)::integer n from public.reward_rule_versions where rule_code=${recorded[0].code}`;assert.equal(versions.n,2);
 }
 proof={realUiRewardRuleVersions:8,realUiExactCreditDisplays:8,exactLargeBonusCredits:true,immutablePreviousRuleVersions:true,rewardRuleReplayVerified:true,changedReplayDenied:true,foreignRuleCreationDenied:true,correlatedRuleAuditOutbox:true,noCreditsIssuedByRuleCreation:true,frArDesktop360Accessibility:true};
}catch(error){failure=error;summary??=error.browserSummary;}
finally{for(const cleanup of[()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})])try{await cleanup();}catch(error){cleanupVerified=false;failure??=error;}}
const safe=value=>typeof value==='string'&&/^[A-Z0-9_]{2,100}$/u.test(value)?value:null;
await writeLocalSuiteEvidence({root,suite:'reward-rules',config,summary,failure,cleanupVerified,proof:{...proof,stage,responseCode:safe(failure?.actual?.code),responseLabel:safe(failure?.actual?.message),failureLocations:[...(failure?.stack??'').matchAll(/([^\s()]+\.mjs):(\d+):(\d+)/gu)].slice(0,3).map(m=>({file:m[1].split('/').at(-1),line:Number(m[2])}))}});
if(failure){console.error('LOCAL_REWARD_RULES_FAILED');process.exitCode=1;}else console.log('LOCAL_REWARD_RULES_PASSED');
