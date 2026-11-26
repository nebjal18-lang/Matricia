import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {provision} from '../../../scripts/p05-e2e/provision.mjs';
import {loadSafeConfiguration} from '../../../scripts/p05-e2e/environment.mjs';
import {buildChildEnvironment,validateFreshManifest} from '../../../scripts/p05-e2e/security.mjs';
import {runSecuredBrowserSuite,writeLocalSuiteEvidence} from './secured-browser-runner.mjs';
import {prepareLocalFranchiseCrm,neutralizeLocalFranchiseCrm} from './local-franchise-crm-reference.mjs';
import {neutralizeLocalCatalogReference} from './local-catalog-reference.mjs';
import {ownedLocalHttpServer} from './owned-local-http-server.mjs';
const root=process.cwd(),directory=resolve(root,'artifacts/test-results',`.local-franchise-followups-${randomUUID()}`);
let config,fixture,reference,server,failure,proof,stage='configuration',cleanupVerified=true;
const summaries=[],groups=[],items=[];
const aggregate=()=>summaries.length?{executed:summaries.reduce((n,s)=>n+s.executed,0),passed:summaries.reduce((n,s)=>n+s.passed,0),failed:summaries.reduce((n,s)=>n+s.failed,0),skipped:summaries.reduce((n,s)=>n+s.skipped,0),flaky:summaries.reduce((n,s)=>n+s.flaky,0),failures:summaries.flatMap(s=>s.failures),startedAt:summaries[0].startedAt,finishedAt:summaries.at(-1).finishedAt}:null;
async function rpc(client,name,args){const r=await client.rpc(name,args);assert.equal(r.error,null,`FOLLOWUP_${name.toUpperCase()}_FAILED`);return r.data;}
try{
 config=await loadSafeConfiguration(root);assert.equal(config.runtimeMode,'isolated-local-docker');assert.equal(config.localDockerVerified,true);
 stage='fixture';fixture=await provision();await validateFreshManifest(fixture.manifest,config);await mkdir(directory,{recursive:true,mode:0o700});reference=await prepareLocalFranchiseCrm(fixture,directory);
 const db=fixture.resources.database,owner=fixture.sessions.noRole.client,reviewer=fixture.sessions.central.client,foreign=fixture.sessions.clientB.client,reviewerId=fixture.resources.userIds[2];
 await db`insert into public.platform_user_roles(user_id,role_code) values(${reviewerId}::uuid,'MATRICIA_ADMIN') on conflict do nothing`;
 // Historical approved mandate is a precondition, not a claim that this suite signs a contract.
 await db`insert into public.franchise_approval_requests(franchise_id,mandate_version_id,request_type,status,change_reason,requested_by,requested_at,decided_at) values(${reference.franchiseId}::uuid,${reference.mandateId}::uuid,'INITIAL_ACTIVATION','APPROVED','Historical local mandate for followup verification',${reference.actor}::uuid,clock_timestamp()-interval '1 day',clock_timestamp()-interval '1 day')`;
 const effectiveFrom=new Intl.DateTimeFormat('sv-SE',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace(' ','T'),quietStart=`${String((new Date().getUTCHours()+4)%24).padStart(2,'0')}:00`,quietEnd=`${String((new Date().getUTCHours()+5)%24).padStart(2,'0')}:00`;
 for(const locale of ['fr','ar'])for(const device of ['D','M']){
  const suffix=`${locale}_${device}`,reason=`Local followup policy ${suffix} ${fixture.manifest.runId.slice(0,8)}`;groups.push({locale,device,suffix,reason,reviewReason:`Independent review ${suffix} of delays and consent`});
  for(const type of ['CLIENT','PROVIDER']){
   const created=await rpc(owner,'save_franchise_prospect',{p_franchise_id:reference.franchiseId,p_prospect_id:null,p_territory_version_id:reference.territoryId,p_prospect_type:type,p_display_name:`Contact ${suffix} ${type}`,p_contact_email:`followup-${randomUUID()}@crm.example.test`,p_organization_name:`Societe ${suffix} ${type}`,p_source_code:'DIRECT',p_next_followup_at:new Date(Date.now()-60_000).toISOString(),p_owner_user_id:reference.actor,p_expected_row_version:0,p_idempotency_key:randomUUID()});
   items.push({locale,device,type,prospectId:created.prospect_id});
  }
 }
 server=ownedLocalHttpServer(root,config);await server.start();
 for(const phase of ['configure','approve','withdraw']){
  stage=`${phase}-browser`;const path=resolve(directory,`${phase}.json`);await writeFile(path,JSON.stringify({...fixture.manifest,expiresAt:new Date(Date.now()+20*60_000).toISOString(),reference,groups,items,phase,effectiveFrom,quietStart,quietEnd}),{mode:0o600});
  summaries.push(await runSecuredBrowserSuite({root,config,environment:buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_EXTERNAL_SERVER:'1',E2E_LOCAL_FOLLOWUPS_MANIFEST:path}),specifications:['tests/e2e/local-franchise-followups.spec.ts'],output:resolve(directory,phase),expectedTests:4,projects:['chromium-desktop','chromium-mobile-360']}));
  stage=`${phase}-native-proof`;
  if(phase==='configure'){
   for(const group of groups){const rows=await db`select id,status,proposed_by from public.franchise_followup_policy_versions where franchise_id=${reference.franchiseId}::uuid and change_reason=${group.reason}`;assert.equal(rows.length,1);assert.equal(rows[0].status,'PENDING_APPROVAL');assert.equal(rows[0].proposed_by,reference.actor);group.policyId=rows[0].id;
    const self=await owner.rpc('decide_franchise_followup_policy',{p_policy_version_id:group.policyId,p_decision:'APPROVE',p_reason:group.reviewReason,p_idempotency_key:randomUUID()});assert.equal(self.error?.code,'42501');
   }
   const prefs=await db`select prospect_id,version,contact_allowed,email_allowed,locale from public.franchise_followup_preference_versions where franchise_id=${reference.franchiseId}::uuid`;assert.equal(prefs.length,8);for(const row of prefs){assert.equal(row.version,1);assert.equal(row.contact_allowed,true);assert.equal(row.email_allowed,true);assert.equal(row.locale,items.find(i=>i.prospectId===row.prospect_id).locale);}
  }
  if(phase==='approve'){
   for(const group of groups){const [p]=await db`select status,approved_by from public.franchise_followup_policy_versions where id=${group.policyId}::uuid`;assert.ok(['ACTIVE','RETIRED'].includes(p.status));assert.equal(p.approved_by,reviewerId);
    const [receipt]=await db`select key,response_body from public.idempotency_keys where organization_id=${reference.organizationId}::uuid and operation_scope=${`franchise.followup.policy.decide.${group.policyId}`}`;assert.ok(receipt);
    assert.deepEqual(await rpc(reviewer,'decide_franchise_followup_policy',{p_policy_version_id:group.policyId,p_decision:'APPROVE',p_reason:group.reviewReason,p_idempotency_key:receipt.key}),receipt.response_body);
   }
   // Roll back the entire scheduler transaction if any other local franchise would be affected.
   await db.begin(async tx=>{await tx`set local role service_role`;await tx`select set_config('request.jwt.claims','{"role":"service_role"}',true)`;
    const created=await tx`select public.schedule_franchise_followups() job`;assert.equal(created.length,8);assert.ok(created.every(r=>r.job.franchise_id===reference.franchiseId));
    assert.equal((await tx`select public.schedule_franchise_followups() job`).length,0);
   });
  }
 }
 stage='consent-and-worker-proof';
 const prefs=await db`select prospect_id,version,contact_allowed,email_allowed from public.franchise_followup_preference_versions where franchise_id=${reference.franchiseId}::uuid`;assert.equal(prefs.length,12);assert.equal(prefs.filter(p=>p.version===1&&p.contact_allowed&&p.email_allowed).length,8);assert.equal(prefs.filter(p=>p.version===2&&!p.contact_allowed&&!p.email_allowed).length,4);
 const worker=randomUUID();
 await db.begin(async tx=>{
  await tx`lock table public.franchise_followup_jobs in share row exclusive mode`;
  const [other]=await tx`select count(*)::integer n from public.franchise_followup_jobs where franchise_id<>${reference.franchiseId}::uuid and status in('PENDING','RETRY','LEASED')`;assert.equal(other.n,0,'UNRELATED_LOCAL_FOLLOWUP_JOBS_PRESENT');
  await tx`set local role service_role`;await tx`select set_config('request.jwt.claims','{"role":"service_role"}',true)`;
  const claimed=await tx`select * from public.claim_franchise_followup_jobs(${worker}::uuid,100)`;assert.equal(claimed.length,4);
  for(const job of claimed){assert.equal(job.franchise_id,reference.franchiseId);assert.equal(items.find(i=>i.prospectId===job.prospect_id).type,'CLIENT');const [r]=await tx`select public.complete_franchise_followup_job(${job.id}::uuid,${worker}::uuid) receipt`;assert.equal(r.receipt.outcome,'FRANCHISE_FOLLOWUP_QUEUED');}
  assert.equal((await tx`select * from public.claim_franchise_followup_jobs(${worker}::uuid,100)`).length,0);
 });
 const jobs=await db`select id,prospect_id,status,correlation_id from public.franchise_followup_jobs where franchise_id=${reference.franchiseId}::uuid`;assert.equal(jobs.length,8);
 for(const job of jobs){const type=items.find(i=>i.prospectId===job.prospect_id).type;assert.equal(job.status,type==='CLIENT'?'SUCCEEDED':'PENDING');const [events]=await db`select count(*)::integer n from public.event_outbox e join public.audit_events a on a.correlation_id=e.correlation_id and a.resource_id=e.aggregate_id where e.aggregate_id=${job.id} and e.event_type='FranchiseFollowupRequestedV1' and a.action='franchise.followup.queued'`;assert.equal(events.n,type==='CLIENT'?1:0);}
 const [history]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id and e.aggregate_id=a.resource_id where a.organization_id=${reference.organizationId}::uuid and a.action in('franchise.followup.policy_proposed','franchise.followup.policy_decided','franchise.followup.preference_configured') and e.event_type in('FranchiseFollowupPolicyProposedV1','FranchiseFollowupPolicyDecidedV1','FranchiseFollowupPreferenceConfiguredV1')`;assert.equal(history.n,20);
 for(const item of items){const [p]=await db`select pipeline_stage,row_version from public.franchise_crm_prospects where id=${item.prospectId}::uuid`;assert.equal(p.pipeline_stage,'SENT');assert.equal(p.row_version,1);const read=await foreign.from('franchise_followup_preference_versions').select('id').eq('prospect_id',item.prospectId);assert.equal(read.error,null);assert.deepEqual(read.data,[]);}
 const denied=await foreign.rpc('decide_franchise_followup_policy',{p_policy_version_id:groups[0].policyId,p_decision:'APPROVE',p_reason:groups[0].reviewReason,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
 proof={realUiPolicyProposals:4,realUiIndependentApprovals:4,realUiInitialPreferences:8,realUiConsentWithdrawals:4,scheduledJobs:8,queuedFollowups:4,withdrawnContactsNotQueued:4,policyReplayVerified:true,foreignReadAndDecisionDenied:true,pipelineUnchanged:true,externalEmailDelivered:false};
}catch(error){failure=error;if(error.browserSummary)summaries.push(error.browserSummary);}
finally{
 for(const cleanup of[()=>server?.stop(),async()=>{if(reference)await fixture.resources.database`update public.franchise_followup_jobs set status='CANCELLED',locked_by=null,locked_at=null,lease_until=null where franchise_id=${reference.franchiseId}::uuid and status in('PENDING','RETRY','LEASED')`;},()=>fixture&&neutralizeLocalFranchiseCrm(fixture),()=>fixture&&neutralizeLocalCatalogReference(fixture),()=>fixture?.cleanup(),()=>rm(directory,{recursive:true,force:true}),()=>rm(resolve(root,'scripts/p05-e2e/.auth'),{recursive:true,force:true})])try{await cleanup();}catch(error){cleanupVerified=false;failure??=error;}
}
const failureLocations=[...(failure?.stack??'').matchAll(/([^\s/\\()]+\.(?:mjs|ts)):(\d+):(\d+)/gu)].slice(0,4).map(m=>({file:m[1],line:Number(m[2]),column:Number(m[3])}));
await writeLocalSuiteEvidence({root,suite:'franchise-followups',config,summary:aggregate(),failure,cleanupVerified,proof:{...proof,stage,failureLocations}});
if(failure){console.error('LOCAL_FRANCHISE_FOLLOWUPS_FAILED');process.exitCode=1;}else console.log('LOCAL_FRANCHISE_FOLLOWUPS_PASSED');
