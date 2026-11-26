import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {persistCurrentLocalActorState} from './local-client-activation-fixture.mjs';
import {requireRealLocalActorMfa} from './linked-commercial-commands.mjs';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function rpc(fixture,actor,name,args){fixture.resources.localReferralRewardStage=name;const result=await actor.client.rpc(name,args);if(result.error)throw Object.assign(new Error(/^[A-Z0-9_]{1,160}$/.test(result.error.message)?result.error.message:'REFERRAL_REWARD_RPC_FAILED'),{code:result.error.code});return result.data;}
export async function prepareLocalReferralRewards(fixture,actors,directory){
 assert.equal(fixture.config.runtimeMode,'isolated-local-docker');assert.equal(fixture.config.localDockerVerified,true);
 const db=fixture.resources.database,reviewers=fixture.resources.localJourneyReviewers,finance=reviewers.fr;
 assert.notEqual(finance.userId,reviewers.ar.userId);
 await db`insert into public.platform_user_roles(user_id,role_code)values(${finance.userId}::uuid,'FINANCE_MANAGER')`;fixture.resources.localReferralRewardFinanceId=finance.userId;
 for(const actor of Object.values(reviewers))await requireRealLocalActorMfa(fixture,actor);
 const org=await rpc(fixture,finance,'create_or_request_organization',{p_legal_name:`P05 E2E REWARD AUDIT ${fixture.manifest.runId}`,p_display_name:`P05 E2E REWARD AUDIT ${fixture.manifest.runId}`,p_ice:hash(fixture.manifest.runId).slice(0,16).toUpperCase(),p_owner_role:'CLIENT_OWNER',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});fixture.resources.organizationIds.push(org.organization_id);
 const items={};
 for(const locale of ['fr','ar']){
  const actor=actors[locale],code=`BONUS_${fixture.manifest.runId.slice(0,8).toUpperCase()}_${locale.toUpperCase()}`;
  const source={client:fixture.sessions.clientA.client};
  await rpc(fixture,source,'create_referral_link',{p_source_organization_id:fixture.manifest.fixtures.organizationA.id,p_referral_code:code,p_audience_type:'CLIENT',p_campaign_reference:'Local approved bonus chain',p_expires_at:new Date(Date.now()+86400000).toISOString(),p_max_conversions:1,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
  const claim=await rpc(fixture,actor,'claim_client_referral_v1',{p_referral_code:code,p_target_organization_id:actor.organizationId,p_consent:true,p_idempotency_key:randomUUID()});
  const references=[{registry:'CLIENT_COMPLIANCE_CASE',id:actor.caseId}],proofHash=hash(references);let version=1;
  for(const [stage,signer]of [['PROFILE_STARTED',actor],['VERIFIED',finance],['ACTIVE',reviewers.ar]]){
   const input={p_referral_conversion_id:claim.referral_conversion_id,p_to_stage:stage,p_evidence_refs:references,p_evidence_hash:proofHash,p_expected_row_version:version,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
   if(stage==='ACTIVE'){const denied=await finance.client.rpc('advance_referral_conversion',input);assert.equal(denied.error?.code,'42501');}
   const result=await rpc(fixture,signer,'advance_referral_conversion',input);assert.equal(result.conversion_stage,stage);assert.deepEqual(await rpc(fixture,signer,'advance_referral_conversion',input),result);version=result.row_version;
  }
  const [event]=await db`select * from public.reward_source_events where organization_id=${actor.organizationId}::uuid and source_reference_id=${claim.referral_conversion_id} and audience_type='REFERRED_CLIENT'`;
  assert.ok(event);assert.equal(event.recorded_by,reviewers.ar.userId);
  const rule=await rpc(fixture,finance,'create_reward_rule_version',{p_rule_code:code,p_status:'ACTIVE',p_trigger_event:'REFERRAL_VERIFIED',p_audience_type:'REFERRED_CLIENT',p_bonus_credits:'17',p_per_recipient_cap_credits:'17',p_global_cap_credits:'17',p_window_days:30,p_cooldown_hours:24,p_credit_validity_days:365,p_eligibility_rule:{target_organization_id:actor.organizationId},p_requires_approval:true,p_effective_from:new Date(Date.now()-60000).toISOString(),p_effective_until:new Date(Date.now()+3600000).toISOString(),p_change_reason:'Local independently approved referral credit proof',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
  const self=await reviewers.ar.client.rpc('decide_reward_award',{p_source_event_id:event.id,p_rule_version_id:rule.rule_version_id,p_decision:'APPROVED',p_rationale:'Self approval must remain denied',p_idempotency_key:randomUUID()});assert.equal(self.error?.code,'42501');
  const [before]=await db`select coalesce(sum(quantity),0)::text balance from public.credit_ledger_entries where organization_id=${actor.organizationId}::uuid`;
  const clientState=await persistCurrentLocalActorState(fixture,actor,resolve(directory,`referral-client-${locale}.json`),'aal1');
  items[locale]={code,organizationId:actor.organizationId,conversionId:claim.referral_conversion_id,sourceEventId:event.id,ruleVersionId:rule.rule_version_id,beforeBalance:before.balance,clientState};
 }
 const financeState=await persistCurrentLocalActorState(fixture,finance,resolve(directory,'referral-finance.json'));
 return{items,financeState};
}
export async function collectLocalReferralApprovals(fixture,reference){
 const db=fixture.resources.database;
 for(const item of Object.values(reference.items)){
  const [approval]=await db`select id,decision,decided_by from public.reward_award_approvals where source_event_id=${item.sourceEventId}::uuid and rule_version_id=${item.ruleVersionId}::uuid`;
  assert.ok(approval);assert.equal(approval.decision,'APPROVED');assert.equal(approval.decided_by,fixture.resources.localJourneyReviewers.fr.userId);item.approvalId=approval.id;
  const [pending]=await db`select(select count(*) from public.client_referral_reward_execution_requests_v1 where approval_id=${approval.id}::uuid)::integer requests,(select count(*) from public.reward_grants where rule_version_id=${item.ruleVersionId}::uuid)::integer grants,(select coalesce(sum(quantity),0)::text from public.credit_ledger_entries where organization_id=${item.organizationId}::uuid) balance`;
  assert.equal(pending.requests,1);assert.equal(pending.grants,0);assert.equal(pending.balance,item.beforeBalance);
  const denied=await fixture.resources.localJourneyReviewers.ar.client.rpc('execute_client_referral_reward_v1',{p_approval_id:approval.id,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
 }
}
export async function verifyLocalReferralRewards(fixture,reference){
 const db=fixture.resources.database;
 for(const [locale,item]of Object.entries(reference.items)){
  const rows=await db`select g.id,g.quantity::text quantity,g.credit_lot_id,g.credit_ledger_entry_id,l.quantity::text lot_quantity,l.source_type,l.revenue_value_minor::text revenue,e.quantity::text ledger_quantity,e.entry_type from public.reward_grants g join public.credit_lots l on l.id=g.credit_lot_id join public.credit_ledger_entries e on e.id=g.credit_ledger_entry_id where g.rule_version_id=${item.ruleVersionId}::uuid and g.organization_id=${item.organizationId}::uuid`;
  assert.equal(rows.length,1);const row=rows[0];assert.equal(row.quantity,'17');assert.equal(row.lot_quantity,'17');assert.equal(row.ledger_quantity,'17');assert.equal(row.source_type,'BONUS');assert.equal(row.entry_type,'GRANT');assert.equal(row.revenue,'0');
  const replay=await rpc(fixture,fixture.resources.localJourneyReviewers.fr,'execute_client_referral_reward_v1',{p_approval_id:item.approvalId,p_idempotency_key:randomUUID()});assert.equal(replay.reward_grant_id,row.id);assert.equal(replay.replayed,true);
  const [balance]=await db`select coalesce(sum(quantity),0)::text value from public.credit_ledger_entries where organization_id=${item.organizationId}::uuid`;assert.equal(balance.value,(BigInt(item.beforeBalance)+17n).toString());
  const [facts]=await db`select count(*)::integer n from public.client_referral_reward_execution_facts_v1 where approval_id=${item.approvalId}::uuid`;assert.equal(facts.n,1);
  const [audit]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.resource_id=${item.approvalId} and a.action='reward.referral.executed' and e.event_type='ClientReferralRewardExecutedV1'`;assert.equal(audit.n,1);
  const foreign=fixture.resources.localJourneyActors[locale==='fr'?'ar':'fr'];const denied=await foreign.client.from('reward_grants').select('id').eq('id',row.id);assert.equal(denied.error,null);assert.deepEqual(denied.data,[]);
 }
 return{nativeGovernedReferralActivations:2,referralTransitionReplaysVerified:true,independentActivationAndApprovalRequired:true,realUiRewardApprovals:2,approvalDoesNotCreditWallet:true,nonFinanceExecutionDenied:true,realUiFinanceExecutions:2,realUiPendingRewardViews:2,realUiGrantedRewardViews:4,exactBonusCreditsPerRecipient:'17',uniqueBonusLotsAndLedgerEntries:true,zeroBonusRevenue:true,executionReplayVerified:true,foreignRewardHidden:true,correlatedRewardExecutionAuditOutbox:true};
}
export async function cleanupLocalReferralRewardRoles(fixture){
 const id=fixture.resources.localReferralRewardFinanceId;if(!id)return;assert.ok(fixture.resources.userIds.includes(id));await fixture.resources.database`delete from public.platform_user_roles where user_id=${id}::uuid and role_code='FINANCE_MANAGER'`;
}
