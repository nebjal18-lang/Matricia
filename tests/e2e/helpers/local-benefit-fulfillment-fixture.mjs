import assert from 'node:assert/strict';
import {randomUUID}from'node:crypto';
import {requireRealLocalActorMfa}from'./linked-commercial-commands.mjs';
import {persistCurrentLocalActorState}from'./local-client-activation-fixture.mjs';

function isolated(fixture){assert.equal(fixture.config.runtimeMode,'isolated-local-docker');assert.equal(fixture.config.localDockerVerified,true);}
async function command(fixture,actor,name,input){
 fixture.resources.localBenefitStage=name;
 const result=await actor.client.rpc(name,input);
 if(result.error){const message=result.error.message;fixture.resources.localBenefitDiagnostic={operation:name,sqlstate:result.error.code,status:result.status,canonicalReason:/^[A-Z][A-Z0-9_]{1,119}$/u.test(message??'')?message:null};throw Object.assign(new Error(`LOCAL_BENEFIT_${name.toUpperCase()}_FAILED`),{code:result.error.code});}
 return result.data;
}
async function denied(actor,name,input,code){const user=await actor.client.auth.getUser();assert.equal(user.error,null);assert.equal(user.data.user?.id,actor.userId);const result=await actor.client.rpc(name,input);assert.equal(result.error?.code,code);}

/** Roles are fixture bootstrap only. Every credit, policy and state change below is a real public command. */
export async function prepareLocalBenefitFulfillment(fixture,activated,directory){
 isolated(fixture);const reviewers=fixture.resources.localJourneyReviewers;
 assert.ok(reviewers?.fr&&reviewers?.ar);assert.notEqual(reviewers.fr.userId,reviewers.ar.userId);
 const[binding]=await fixture.resources.database`select environment from private.admin_execution_environment_v1 where singleton`;assert.equal(binding?.environment,'DEVELOPMENT');
 for(const actor of Object.values(activated)){assert.equal(actor.activationVerified,true);assert.ok(fixture.resources.organizationIds.includes(actor.organizationId));assert.ok(fixture.resources.userIds.includes(actor.userId));}
 fixture.resources.localBenefitRoles=[];fixture.resources.localBenefitVersions=[];
 for(const[actor,role]of[[reviewers.fr,'FINANCE_MANAGER'],[reviewers.ar,'FINANCE_MANAGER'],[reviewers.fr,'MATRICIA_ADMIN']]){
  assert.ok(fixture.resources.userIds.includes(actor.userId));
  const rows=await fixture.resources.database`insert into public.platform_user_roles(user_id,role_code)values(${actor.userId}::uuid,${role})on conflict(user_id,role_code)do nothing returning user_id`;
  assert.equal(rows.length,1);fixture.resources.localBenefitRoles.push({userId:actor.userId,role});
 }
 for(const actor of Object.values(reviewers))await requireRealLocalActorMfa(fixture,actor);
 const auditOrg=activated.fr.organizationId,code=`E2E_BENEFIT_${randomUUID().replaceAll('-','').slice(0,16).toUpperCase()}`;
 const names={fr:`Consultation synthétique ${code}`,ar:`استشارة اختبار ${code}`};
 const benefit=await command(fixture,reviewers.fr,'create_benefit_version',{p_audit_organization_id:auditOrg,p_code:code,p_benefit_type:'CONSULTATION',p_fulfillment_mode:'MATRICIA_INTERNAL',p_name_fr:names.fr,p_name_ar:names.ar,p_description_fr:'Prestation synthétique locale, sans intervention client réelle.',p_description_ar:'خدمة اختبار محلية دون تنفيذ خدمة حقيقية للعميل.',p_credit_cost:'5',p_reference_value_minor:'1000',p_internal_cost_minor:'0',p_currency:'MAD',p_library_id:null,p_service_id:null,p_quota:null,p_capacity_rule:{},p_eligibility_rule:{},p_cancellation_rule_version:'LOCAL_TEST_V1',p_effective_from:new Date(Date.now()-60_000).toISOString(),p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
 assert.ok(benefit.benefit_version_id);fixture.resources.localBenefitVersions.push(benefit.benefit_version_id);
 await command(fixture,reviewers.ar,'activate_benefit_version',{p_audit_organization_id:auditOrg,p_benefit_version_id:benefit.benefit_version_id,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
 const context=await command(fixture,reviewers.fr,'get_admin_benefit_admission_context_v1',{p_benefit_version_id:benefit.benefit_version_id,p_page:1});
 const policy=await command(fixture,reviewers.fr,'propose_benefit_admission_policy_v1',{p_benefit_version_id:benefit.benefit_version_id,p_expected_source_hash:context.source_hash,p_expected_head_id:null,p_quota_scope:'NONE',p_quota_units:null,p_capacity_units:null,p_allowed_country_codes:[],p_required_box_version_ids:[],p_effective_from:new Date(Date.now()-60_000).toISOString(),p_effective_until:null,p_reason:'TEST local explicit human report and independent client receipt',p_reference:'TEST_LOCAL_BENEFIT_POLICY',p_fulfillment_evidence_kind:'HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1',p_idempotency_key:randomUUID()});
 fixture.resources.localBenefitPolicyId=policy.policy_id;
 const approval={p_policy_id:policy.policy_id,p_expected_content_hash:policy.content_hash,p_approve:true,p_reference:'TEST_LOCAL_BENEFIT_REVIEW',p_reason:'TEST independent review of this exact synthetic execution policy'};
 await denied(reviewers.fr,'decide_benefit_admission_policy_v1',approval,'42501');
 const approved=await command(fixture,reviewers.ar,'decide_benefit_admission_policy_v1',approval);assert.deepEqual(await command(fixture,reviewers.ar,'decide_benefit_admission_policy_v1',approval),approved);
 const cases={};
 for(const locale of['fr','ar']){
  const actor=activated[locale];await requireRealLocalActorMfa(fixture,actor);
  const state=await persistCurrentLocalActorState(fixture,actor,`${directory}/benefit-client-${locale}.json`);
  const wallet=await command(fixture,actor,'ensure_client_credit_wallet',{p_organization_id:actor.organizationId,p_idempotency_key:randomUUID()});
  const giftArgs={p_organization_id:actor.organizationId,p_wallet_id:wallet.wallet_id,p_source_type:'ADMIN_GRANT',p_quantity:'20',p_expires_at:new Date(Date.now()+30*86400_000).toISOString(),p_library_id:null,p_source_reference:`TEST_LOCAL_BENEFIT_${locale.toUpperCase()}`,p_reason:'TEST synthetic governed gift; no payment or subscription revenue',p_idempotency_key:randomUUID()};
  const gift=await command(fixture,reviewers.fr,'request_manual_credit_grant_v1',giftArgs);assert.deepEqual(await command(fixture,reviewers.fr,'request_manual_credit_grant_v1',giftArgs),gift);
  const reviewArgs={p_request_id:gift.request_id,p_expected_content_hash:gift.content_hash,p_approve:true,p_terms_confirmed:true,p_approval_reference:'TEST_LOCAL_BENEFIT_GIFT',p_reason:'TEST independent Finance approval of this exact local gift'};
  await denied(reviewers.fr,'review_manual_credit_grant_v1',reviewArgs,'42501');
  const review=await command(fixture,reviewers.ar,'review_manual_credit_grant_v1',reviewArgs);
  const executeArgs={p_request_id:gift.request_id,p_expected_content_hash:gift.content_hash,p_expected_review_proof_hash:review.review_proof_hash,p_idempotency_key:randomUUID()};
  const executed=await command(fixture,reviewers.fr,'execute_manual_credit_grant_v1',executeArgs);assert.equal(executed.outcome,'MANUAL_CREDIT_GRANT_EXECUTED');assert.deepEqual(await command(fixture,reviewers.fr,'execute_manual_credit_grant_v1',{...executeArgs,p_idempotency_key:randomUUID()}),executed);
  const reserveArgs={p_organization_id:actor.organizationId,p_wallet_id:wallet.wallet_id,p_benefit_version_id:benefit.benefit_version_id,p_units:'1',p_reservation_expires_at:new Date(Date.now()+7*86400_000).toISOString(),p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
  const reserved=await command(fixture,actor,'reserve_benefit_credits',reserveArgs);assert.equal(reserved.outcome,'BENEFIT_RESERVED');assert.deepEqual(await command(fixture,actor,'reserve_benefit_credits',reserveArgs),reserved);
  const row=await actor.client.from('benefit_redemptions').select('id,row_version,status').eq('id',reserved.redemption_id).single();assert.equal(row.error,null);assert.equal(row.data.status,'RESERVED');
  await denied(actor,'advance_benefit_fulfillment_v1',{p_redemption_id:reserved.redemption_id,p_expected_row_version:row.data.row_version,p_action:'START',p_scheduled_for:null,p_reason:'TEST client cannot act as the operational fulfiller',p_idempotency_key:randomUUID()},'42501');
  await denied({client:fixture.sessions.centralAal1.client,userId:reviewers.fr.userId},'advance_benefit_fulfillment_v1',{p_redemption_id:reserved.redemption_id,p_expected_row_version:row.data.row_version,p_action:'START',p_scheduled_for:null,p_reason:'TEST native authenticated weak operator must be denied',p_idempotency_key:randomUUID()},'42501');
  const org=await actor.client.from('organizations').select('display_name').eq('id',actor.organizationId).single();assert.equal(org.error,null);
  cases[locale]={locale,organizationId:actor.organizationId,organizationName:org.data.display_name,redemptionId:reserved.redemption_id,benefitVersionId:benefit.benefit_version_id,benefitName:names[locale],giftRequestId:gift.request_id,lotId:executed.credit_lot_id,walletId:wallet.wallet_id,state};
 }
 for(const locale of['fr','ar'])cases[locale].foreignState=cases[locale==='fr'?'ar':'fr'].state;
 const operatorState=await persistCurrentLocalActorState(fixture,reviewers.fr,`${directory}/benefit-operator.json`);
 for(const item of Object.values(cases))item.operatorState=operatorState;
 fixture.resources.localBenefitActors={reviewers,clients:activated};fixture.resources.localBenefitCases=cases;
 return cases;
}

export async function verifyLocalBenefitFulfillment(fixture,cases,ui){
 isolated(fixture);const operator=fixture.resources.localBenefitActors.reviewers.fr;
 const policyEvents=await fixture.resources.database`select a.action,e.event_type,count(distinct a.id)::int audits,count(distinct e.id)::int outbox from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.resource_type='benefit_policy'and a.resource_id=${fixture.resources.localBenefitPolicyId}and a.event_hash<>repeat('0',64)group by a.action,e.event_type`;
 for(const[action,type]of[['benefit.admission_policy.proposed','BenefitAdmissionPolicyProposedV1'],['benefit.admission_policy.reviewed','BenefitAdmissionPolicyReviewedV1']]){const pair=policyEvents.find(row=>row.action===action&&row.event_type===type);assert.ok(pair);assert.equal(pair.audits,1);assert.equal(pair.outbox,1);}
 for(const locale of['fr','ar']){
  const item=cases[locale],actor=fixture.resources.localBenefitActors.clients[locale],evidence=ui[locale];assert.equal(evidence.redemptionId,item.redemptionId);assert.equal(evidence.rejectedThenAccepted,true);assert.equal(evidence.foreignReadDenied,true);
  const [row]=await fixture.resources.database`select status,delivery_proof_hash from public.benefit_redemptions where id=${item.redemptionId}::uuid and organization_id=${item.organizationId}::uuid`;assert.equal(row.status,'CONSUMED');assert.match(row.delivery_proof_hash,/^[a-f0-9]{64}$/u);
  const consumed=await command(fixture,operator,'consume_benefit_credits',{p_redemption_id:item.redemptionId,p_delivery_proof_hash:row.delivery_proof_hash,p_idempotency_key:evidence.consumeKey});assert.equal(consumed.outcome,'BENEFIT_CONSUMED');
  const [counts]=await fixture.resources.database`select(select count(*)::int from public.benefit_client_receipts_v1 where redemption_id=${item.redemptionId}::uuid and accepted)accepted,(select count(*)::int from public.benefit_client_receipts_v1 where redemption_id=${item.redemptionId}::uuid and not accepted)rejected,(select count(*)::int from public.credit_lot_movements where redemption_id=${item.redemptionId}::uuid and movement_type='CONSUME'and quantity=5)consumptions,(select count(*)::int from public.manual_credit_grant_executions_v1 where request_id=${item.giftRequestId}::uuid)gift_executions,(select revenue_value_minor::text from public.credit_lots where id=${item.lotId}::uuid)revenue`;
  assert.deepEqual({...counts},{accepted:1,rejected:1,consumptions:1,gift_executions:1,revenue:'0'});
  const [receipt]=await fixture.resources.database`select private.benefit_accepted_receipt_v1(${item.redemptionId}::uuid,${row.delivery_proof_hash})proof`;assert.equal(receipt.proof?.accepted_by,actor.userId);assert.equal(receipt.proof?.operator_user_id,operator.userId);assert.notEqual(actor.userId,operator.userId);assert.equal(receipt.proof?.evidence_kind,'OPERATIONAL_REPORT_WITH_INDEPENDENT_CLIENT_RECEIPT');assert.equal(receipt.proof?.native_file_bytes_verified,false);
  const gifts=await fixture.resources.database`select a.action,e.event_type,count(distinct a.id)::int audits,count(distinct e.id)::int outbox from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.resource_type='manual_credit_grant'and a.resource_id=${item.giftRequestId}and a.organization_id=${item.organizationId}::uuid and a.event_hash<>repeat('0',64)group by a.action,e.event_type`;
  for(const[action,type]of[['credits.manual.requested','ManualCreditGrantRequestedV1'],['credits.manual.reviewed','ManualCreditGrantReviewedV1'],['credits.manual.executed','ManualCreditGrantExecutedV1']]){const pair=gifts.find(value=>value.action===action&&value.event_type===type);assert.ok(pair);assert.equal(pair.audits,1);assert.equal(pair.outbox,1);}
  const events=await fixture.resources.database`select a.action,count(distinct a.id)::int audits,count(distinct e.id)::int outbox from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id and e.event_type=a.action where a.organization_id=${item.organizationId}::uuid and a.resource_id=${item.redemptionId}and a.event_hash<>repeat('0',64)group by a.action`;
  for(const action of['BenefitScheduledV1','BenefitStartedV1','BenefitDeliveryRejectedV1','BenefitDeliveryAcceptedV1']){const pair=events.find(event=>event.action===action);assert.ok(pair);assert.equal(pair.audits,1);assert.equal(pair.outbox,1);}
 }
 return{mode:'REAL_UI_BENEFIT_EXECUTION_AND_CLIENT_RECEIPT',realGovernedGiftExecutions:2,independentFinanceReviews:true,realApprovedAdmissionPolicy:true,realClientReservations:2,realUiSchedules:2,realUiStarts:2,realUiRejectedThenAccepted:2,realUiUniqueConsumptions:2,canonicalReceiptAccountingProofs:2,correlatedPolicyGiftAndReceiptEvents:true,foreignReadDenied:true,zeroGiftRevenueVerified:true,nativeServiceFileBytesVerified:false,externalClientServiceDelivered:false};
}

export async function neutralizeLocalBenefitFulfillment(fixture){
 isolated(fixture);
 if(fixture.resources.localBenefitPolicyId)await fixture.resources.database`update public.event_outbox set published_at=coalesce(published_at,clock_timestamp()),locked_at=null,locked_by=null where aggregate_type='benefit_policy'and aggregate_id=${fixture.resources.localBenefitPolicyId}`;
 for(const id of fixture.resources.localBenefitVersions??[]){
  // Fixture-only neutralization of its unique catalogue reference, after all
  // success assertions; financial facts and client receipts remain immutable.
  await fixture.resources.database`update public.benefit_versions set status='RETIRED'where id=${id}::uuid and created_by=any(${fixture.resources.userIds}::uuid[])and status in('DRAFT','ACTIVE')`;
  const [row]=await fixture.resources.database`select status from public.benefit_versions where id=${id}::uuid`;assert.equal(row.status,'RETIRED');
 }
 for(const{userId,role}of fixture.resources.localBenefitRoles??[]){assert.ok(fixture.resources.userIds.includes(userId));assert.ok(['FINANCE_MANAGER','MATRICIA_ADMIN'].includes(role));await fixture.resources.database`delete from public.platform_user_roles where user_id=${userId}::uuid and role_code=${role}`;const[remaining]=await fixture.resources.database`select count(*)::int count from public.platform_user_roles where user_id=${userId}::uuid and role_code=${role}`;assert.equal(remaining.count,0);}
}
