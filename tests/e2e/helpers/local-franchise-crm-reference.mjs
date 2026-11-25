import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {provisionLocalCatalogReference} from './local-catalog-reference.mjs';
import {elevateToAal2,toPlaywrightState} from '../../../scripts/p05-e2e/provision.mjs';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export async function prepareLocalFranchiseCrm(fixture,directory){
 assert.equal(fixture.config.runtimeMode,'isolated-local-docker');assert.equal(fixture.config.localDockerVerified,true);
 const db=fixture.resources.database,catalog=await provisionLocalCatalogReference(fixture),actor=fixture.resources.userIds[3];
 const [rule]=await db`select * from public.franchise_economic_rule_versions where franchise_type='STANDARD' and status='ACTIVE' and effective_from<=current_date and (effective_to is null or effective_to>=current_date) order by version desc limit 1`;
 assert.ok(rule);
 const ids=Object.fromEntries(['organizationId','membershipId','franchiseId','territoryId','mandateId'].map(k=>[k,randomUUID()]));
 fixture.resources.localCrm=ids;fixture.resources.organizationIds.push(ids.organizationId);
 const digest=createHash('sha256').update(ids.mandateId).digest('hex'),territory=`LOCAL_CRM_${ids.franchiseId.replaceAll('-','').slice(0,16).toUpperCase()}`;
 // Historical local mandate only. All CRM mutations use the authenticated API/UI.
 await db.begin(async tx=>{
  await tx`insert into public.organizations(id,legal_name,display_name,status,created_by) values(${ids.organizationId}::uuid,'TEST local franchise CRM','TEST local franchise CRM','ACTIVE',${actor}::uuid)`;
  await tx`insert into public.organization_memberships(id,organization_id,user_id,status,activated_at) values(${ids.membershipId}::uuid,${ids.organizationId}::uuid,${actor}::uuid,'ACTIVE',clock_timestamp())`;
  await tx`insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,created_by) values(${ids.franchiseId}::uuid,${catalog.library}::uuid,${ids.organizationId}::uuid,'STANDARD','FRANCHISEE',${territory},'CONTRACT_PENDING',${actor}::uuid)`;
  await tx`insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by) values(${ids.territoryId}::uuid,${ids.franchiseId}::uuid,1,${territory},'Territoire local de recette','نطاق اختبار محلي','{"fixture":"LOCAL_CRM"}',clock_timestamp(),${digest},${actor}::uuid)`;
  await tx`insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by) values(${ids.mandateId}::uuid,${ids.franchiseId}::uuid,${ids.territoryId}::uuid,${rule.id}::uuid,1,'ACTIVE','{"fixture":"LOCAL_CRM"}','{"fixture":"LOCAL_CRM"}','{"classification":"NON_CONTRACTUAL_DEMO","fixture":"LOCAL_CRM"}',${rule.entry_fee_minor},${BigInt(rule.entry_fee_minor)===0n?'EXEMPT':'UPFRONT'},0,${rule.franchisee_share_bps},${rule.neoxa_share_bps},${rule.matricia_share_bps},${rule.distribution_basis},clock_timestamp(),${digest},${actor}::uuid)`;
  await tx`update public.franchises set status='ACTIVE',current_mandate_version_id=${ids.mandateId}::uuid,row_version=row_version+1 where id=${ids.franchiseId}::uuid`;
  await tx`insert into public.organization_member_roles(membership_id,role_code,franchise_id,granted_by) values(${ids.membershipId}::uuid,'FRANCHISE_OWNER',${ids.franchiseId}::uuid,${actor}::uuid)`;
  await tx`update public.catalog_libraries set steward_organization_id=${ids.organizationId}::uuid where id=${catalog.library}::uuid`;
  await tx`insert into public.catalog_library_mandates(library_id,organization_id,status,valid_from,policy_version,created_by) values(${catalog.library}::uuid,${ids.organizationId}::uuid,'ACTIVE',clock_timestamp(),1,${actor}::uuid)`;
 });
 await elevateToAal2(fixture.sessions.noRole);
 const state=resolve(directory,'franchise.json');await writeFile(state,JSON.stringify(toPlaywrightState(fixture.sessions.noRole.cookies,fixture.config.baseUrl)),{mode:0o600});
 return{...ids,actor,state};
}
export async function neutralizeLocalFranchiseCrm(fixture){
 const ids=fixture.resources.localCrm;if(!ids)return;
 await fixture.resources.database`update public.franchise_network_invitations set status='REVOKED' where franchise_id=${ids.franchiseId}::uuid and status in('QUEUED','SENT','OPENED')`;
 await fixture.resources.database`update public.franchises set status='TERMINATED',row_version=row_version+1,updated_at=clock_timestamp() where id=${ids.franchiseId}::uuid and status<>'TERMINATED'`;
 const [row]=await fixture.resources.database`select count(*)::integer count from public.franchise_network_invitations where franchise_id=${ids.franchiseId}::uuid and status in('QUEUED','SENT','OPENED')`;assert.equal(row.count,0);
}
