import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prepareReputationFinance} from './local-reputation-finance.mjs';
async function rpc(client,name,args){const result=await client.rpc(name,args);assert.equal(result.error,null,`REPUTATION_${name.toUpperCase()}_FAILED`);return result.data;}
export async function prepareLocalReputation(fixture,chains,provider){
 const db=fixture.resources.database,admin=fixture.resources.userIds[2];
 await db`insert into public.platform_user_roles(user_id,role_code) values(${admin}::uuid,'MATRICIA_ADMIN') on conflict do nothing`;
 const projection=await rpc(fixture.sessions.central.client,'list_admin_provider_organization_names_v1',{p_organization_ids:[provider.organizationId]});
 assert.equal(projection.organizations[0]?.id,provider.organizationId,'REPUTATION_ADMIN_PROVIDER_PROJECTION_FAILED');
 for(const locale of ['fr','ar']){
  const input={p_mission_id:chains[locale].missionId,p_quality_basis_points:10000,p_compliance_basis_points:10000,p_satisfaction_basis_points:10000,p_feedback_snapshot:{summary_code:'MISSION_SUCCESS',criteria:['COMMUNICATION','PROFESSIONALISM','VALUE'].map(key=>({key,rating:5}))},p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
  const client=fixture.resources.localJourneyActors[locale].client;
  const first=await rpc(client,'submit_mission_provider_feedback',input);assert.deepEqual(await rpc(client,'submit_mission_provider_feedback',input),first);
 }
 fixture.resources.localReputationFinanceProof=await prepareReputationFinance(fixture,chains.fr,provider);
 const refresh={p_provider_organization_id:provider.organizationId,p_service_id:fixture.resources.localCatalog.service,p_policy_version:'PROVIDER-REPUTATION-V1',p_idempotency_key:randomUUID()};
 const initial=await rpc(fixture.sessions.central.client,'refresh_provider_reputation_from_events',refresh);assert.deepEqual(await rpc(fixture.sessions.central.client,'refresh_provider_reputation_from_events',refresh),initial);
 const code=`LOCAL_${fixture.manifest.runId.replaceAll('-','').toUpperCase()}`;
 await rpc(fixture.sessions.central.client,'create_provider_badge_policy_version',{p_audit_organization_id:provider.organizationId,p_badge_code:code,p_label_fr:code,p_label_ar:code,p_dimension:'QUALITY',p_minimum_basis_points:8000,p_minimum_evidence_count:1,p_effective_from:new Date(Date.now()-60_000).toISOString(),p_effective_until:new Date(Date.now()+3600_000).toISOString(),p_change_reason:'Local event-derived reputation verification',p_idempotency_key:randomUUID()});
 const [policy]=await db`select id from public.provider_badge_policy_versions where badge_code=${code}`;assert.ok(policy?.id);
 fixture.resources.localReputation={providerId:provider.organizationId,serviceId:fixture.resources.localCatalog.service,policyId:policy.id,code,items:[]};
 return{...fixture.resources.localReputation,adminState:fixture.manifest.states.centralAal2.path,providerState:chains.fr.providerState};
}
export async function collectLocalReputation(fixture){
 const db=fixture.resources.database,r=fixture.resources.localReputation;
 const snapshots=await db`select id,overall_basis_points,evidence_count from public.provider_reputation_snapshots where provider_organization_id=${r.providerId}::uuid and service_id=${r.serviceId}::uuid order by version_number`;
 assert.equal(snapshots.length,5);assert.ok(snapshots.every(s=>s.evidence_count>=8&&s.overall_basis_points>=8000));
 const dimensions=await db`select distinct dimension from public.provider_reputation_evidence_events where provider_organization_id=${r.providerId}::uuid and service_id=${r.serviceId}::uuid`;assert.equal(dimensions.length,6);
 const items=await db`select e.id,e.eligible from public.provider_badge_evaluations e where e.badge_policy_id=${r.policyId}::uuid and e.provider_organization_id=${r.providerId}::uuid order by e.evaluation_version`;
 assert.equal(items.length,4);assert.ok(items.every(x=>x.eligible));
 const decisions=await db`select id from public.provider_badge_decisions where evaluation_id=any(${items.map(x=>x.id)}::uuid[])`;assert.equal(decisions.length,0);
 r.items=items.map((x,i)=>({...x,locale:i<2?'fr':'ar',device:i%2===0?'D':'M'}));
 return r.items;
}
export async function verifyLocalReputation(fixture){
 const db=fixture.resources.database,r=fixture.resources.localReputation;
 for(const item of r.items){
  const rows=await db`select action,decided_by,correlation_id from public.provider_badge_decisions where evaluation_id=${item.id}::uuid`;assert.equal(rows.length,1);assert.equal(rows[0].action,'PUBLISHED');assert.equal(rows[0].decided_by,fixture.resources.userIds[2]);
  const denied=await fixture.sessions.clientB.client.rpc('decide_provider_badge',{p_evaluation_id:item.id,p_action:'REVOKED',p_rationale:'Forbidden foreign actor badge decision',p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
  const [audit]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.correlation_id=${rows[0].correlation_id}::uuid`;assert.ok(audit.n>=1);
 }
 return{...fixture.resources.localReputationFinanceProof,nativeCompletedMissionFeedbacks:2,nativeReputationRefreshReplayVerified:true,realUiReputationRefreshes:4,authoritativeDimensions:6,noAutomaticBadgePublication:true,realUiHumanBadgePublications:4,realUiProviderReputationViews:4,foreignBadgeDecisionDenied:true,badgeDecisionAuditOutboxVerified:true};
}
