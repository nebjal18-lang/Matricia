import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {prepareLocalQuoteIdentity,closePendingLocalProviderScans} from './local-provider-identity-fixture.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');

/**
 * Declared historical qualification, never a proof of provider onboarding.
 * No request/RFQ/quote/selection/contract/mission/delivery is inserted here.
 * Current legal identity itself is revalidated by the real 253 AAL2 command.
 */
export async function prepareLinkedLocalProviderReference(fixture){
 assert.equal(fixture.config.runtimeMode,'isolated-local-docker');assert.equal(fixture.config.localDockerVerified,true);
 const client=fixture.sessions.noRole.client,user=await client.auth.getUser();
 assert.equal(user.error,null);const userId=user.data.user?.id;assert.ok(fixture.resources.userIds.includes(userId));
 const catalog=fixture.resources.localCatalog;assert.ok(catalog?.service&&catalog?.release);
 const ids=Object.fromEntries(['organization','membership','providerService','questionnaire','questionnaireVersion','session','qualification','decision','taxRule'].map(key=>[key,randomUUID()]));
 const suffix=fixture.manifest.runId.replaceAll('-','').toUpperCase(),categoryCode=`LOCAL_LINKED_${suffix}`;
 fixture.resources.organizationIds.push(ids.organization);
 fixture.resources.localCommercialProviderReference={...ids,userId,categoryCode};
 const db=fixture.resources.database;
 await db.begin(async tx=>{
  // Only fresh reference records owned by this run. Published input references
  // and prior qualification are explicitly distinguished from tested effects.
  await tx.unsafe("set local session_replication_role='replica'");
  const name=`P23 Provider linked ${fixture.manifest.runId}`;
  await tx`insert into public.organizations(id,legal_name,display_name,status,created_by)values(${ids.organization}::uuid,${name},${name},'ACTIVE',${userId}::uuid)`;
  await tx`insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values(${ids.membership}::uuid,${ids.organization}::uuid,${userId}::uuid,'ACTIVE',clock_timestamp())`;
  await tx`insert into public.organization_member_roles(membership_id,role_code,granted_by)values(${ids.membership}::uuid,'PROVIDER_OWNER',${userId}::uuid)`;
  await tx`insert into public.tax_categories(code,name_fr,name_ar,description_fr,description_ar,category_kind,status)values(${categoryCode},'Référence fiscale synthétique locale','مرجع ضريبي اصطناعي محلي','Précondition de recette, aucune validation fiscale réelle','شرط اختبار دون اعتماد ضريبي حقيقي','SERVICE','ACTIVE')`;
  await tx`insert into public.tax_rule_versions(id,jurisdiction_code,category_code,version,rate_basis_points,effective_from,effective_to,status,professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,approved_by,approved_at,validation_reference,content_hash,change_reason)values(${ids.taxRule}::uuid,'MA',${categoryCode},1,2000,current_date-1,current_date+2,'ACTIVE','VALIDATED','VAT',100,'{}','LOCAL-SYNTHETIC-REFERENCE-NOT-FISCAL-APPROVAL','HALF_AWAY_FROM_ZERO_TO_MINOR_UNIT',${userId}::uuid,clock_timestamp(),'LOCAL-SYNTHETIC-TEST',${digest(`${suffix}:tax`)},'Précondition fiscale synthétique locale explicitement déclarée')`;
 });
 const identity=await prepareLocalQuoteIdentity(fixture,ids.organization,userId);
 await db.begin(async tx=>{
  await tx.unsafe("set local session_replication_role='replica'");
  await tx`insert into public.provider_match_profiles(provider_organization_id,company_verified,documents_valid,financial_status,quality_status,capacity_status,region_codes,partner_contract_signed)values(${ids.organization}::uuid,true,true,'OK','OK','AVAILABLE',array['CASABLANCA_SETTAT'],true)`;
  await tx`insert into public.provider_services(id,provider_organization_id,service_id,request_status,requested_by,requested_at)values(${ids.providerService}::uuid,${ids.organization}::uuid,${catalog.service}::uuid,'DECIDED',${userId}::uuid,clock_timestamp())`;
  await tx`insert into public.provider_service_match_profiles(provider_organization_id,service_id,qualification_status,required_certifications_valid,service_fit_score,quality_score,historical_delay_score,experience_score,satisfaction_score)values(${ids.organization}::uuid,${catalog.service}::uuid,'APPROVED',true,95,92,90,91,93)`;
  await tx`insert into public.questionnaires(id,library_id,code,status,created_by)values(${ids.questionnaire}::uuid,${catalog.library}::uuid,${`LOCAL_PROVIDER_${suffix}`},'DRAFT',${userId}::uuid)`;
  await tx`insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,sensitive,change_reason,created_by)values(${ids.questionnaireVersion}::uuid,${ids.questionnaire}::uuid,${catalog.library}::uuid,${catalog.release}::uuid,1,'DRAFT','Qualification historique de recette','تأهيل تاريخي للاختبار','Précondition qualifiée synthétique, parcours fournisseur non recetté','شرط تأهيل اصطناعي وليس اختبار التسجيل','PROVIDER','LOCAL-REFERENCE-1','LOCAL-REFERENCE-1',${digest(`${suffix}:provider-version`)},false,'Précondition historique explicitement déclarée',${userId}::uuid)`;
  await tx`update public.questionnaires set current_draft_version_id=${ids.questionnaireVersion}::uuid where id=${ids.questionnaire}::uuid`;
  await tx`insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,is_simulation,submitted_at,answer_manifest,answer_manifest_hash)values(${ids.session}::uuid,${ids.organization}::uuid,${userId}::uuid,${catalog.library}::uuid,${catalog.release}::uuid,${ids.questionnaireVersion}::uuid,'PROVIDER','fr-MA','SUBMITTED',false,clock_timestamp(),${tx.json({historical_local_qualification:true})},${digest(`${suffix}:provider-session`)})`;
  await tx`insert into public.provider_qualifications(id,provider_service_id,provider_organization_id,service_id)values(${ids.qualification}::uuid,${ids.providerService}::uuid,${ids.organization}::uuid,${catalog.service}::uuid)`;
  await tx`insert into public.provider_qualification_decisions(id,qualification_id,provider_organization_id,service_id,decision_version,status,questionnaire_version_id,questionnaire_session_id,score_basis_points,mandatory_checks,blocking_conditions,rationale,rule_version,effective_from,expires_at,decided_by,correlation_id)values(${ids.decision}::uuid,${ids.qualification}::uuid,${ids.organization}::uuid,${catalog.service}::uuid,1,'APPROVED',${ids.questionnaireVersion}::uuid,${ids.session}::uuid,9200,${tx.json([{code:'LOCAL_HISTORICAL_REFERENCE',passed:true}])},'[]','Précondition historique synthétique, aucune certification réelle','LOCAL-REFERENCE-1',clock_timestamp()-interval'1 day',clock_timestamp()+interval'2 days',${userId}::uuid,${randomUUID()}::uuid)`;
  await tx`update public.provider_qualifications set current_decision_id=${ids.decision}::uuid where id=${ids.qualification}::uuid`;
  await tx`insert into public.provider_capacity_versions(provider_organization_id,service_id,version_number,capacity_status,available_units,lead_time_days,effective_from,effective_until,reason,declared_by)values(${ids.organization}::uuid,${catalog.service}::uuid,1,'AVAILABLE',5,2,clock_timestamp()-interval'1 day',clock_timestamp()+interval'2 days','Précondition historique synthétique locale',${userId}::uuid)`;
 });
 return{organizationId:ids.organization,userId,client,cookies:fixture.sessions.noRole.cookies,identity,taxRuleVersionId:ids.taxRule,taxCategoryCode:categoryCode,qualificationIsHistoricalPrecondition:true,identityRevalidatedByRealCommand:true};
}

export async function neutralizeLinkedLocalProviderReference(fixture){
 const reference=fixture.resources.localCommercialProviderReference;if(!reference)return;
 assert.equal(fixture.config.runtimeMode,'isolated-local-docker');assert.equal(fixture.config.localDockerVerified,true);
 assert.ok(fixture.resources.organizationIds.includes(reference.organization));assert.ok(fixture.resources.userIds.includes(reference.userId));
 await closePendingLocalProviderScans(fixture,fixture.resources.localQuoteIdentityPaths??[]);
 await fixture.resources.database.begin(async tx=>{
  await tx.unsafe("set local session_replication_role='replica'");
  await tx`update public.tax_rule_versions set status='RETIRED'where id=${reference.taxRule}::uuid and category_code=${reference.categoryCode}`;
  await tx`update public.tax_categories set status='RETIRED'where code=${reference.categoryCode}`;
  await tx`update public.provider_match_profiles set capacity_status='PAUSED'where provider_organization_id=${reference.organization}::uuid`;
  await tx`update public.questionnaires set status='ARCHIVED',archived_at=clock_timestamp()where id=${reference.questionnaire}::uuid`;
 });
}
