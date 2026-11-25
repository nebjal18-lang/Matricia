import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {actorCookieHeader,createLinkedLocalSignaturePolicy,uploadLinkedLocalArtifact,requireRealLocalActorMfa} from './linked-commercial-commands.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
async function rpc(fixture,client,name,args){
 fixture.resources.localCommercialStage=name;
 const result=await client.rpc(name,args);assert.equal(result.error,null);return result.data;
}
export async function activateLocalAmendments(fixture,chains,provider,directory){
 assert.equal(fixture.config.runtimeMode,'isolated-local-docker');assert.equal(fixture.config.localDockerVerified,true);
 const policy=await createLinkedLocalSignaturePolicy(fixture,'AMENDMENT'),items={};
 for(const locale of ['fr','ar']){
  const chain=chains[locale],actor=fixture.resources.localJourneyActors[locale];
  await requireRealLocalActorMfa(fixture,actor);await requireRealLocalActorMfa(fixture,provider);
  const receipt=JSON.parse(await readFile(resolve(directory,`provider-${locale}-D.json`),'utf8'));
  const [amendment]=await fixture.resources.database`select a.* from public.contract_amendments a join public.change_requests r on r.id=a.change_request_id where a.contract_id=${chain.contractId}::uuid and r.reason=${receipt.reason}`;
  assert.ok(amendment);const archives={};
  for(const language of ['fr','ar']){
   const response=await fetch(new URL(`/api/signatures/amendments/${amendment.id}/documents?locale=${language}`,fixture.config.baseUrl),{headers:{cookie:actorCookieHeader(actor)},redirect:'error',signal:AbortSignal.timeout(60000)});
   assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^application\/pdf/u);
   const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
   const archive=await rpc(fixture,actor.client,'get_signature_document_archive_v1',{p_source_kind:'AMENDMENT',p_source_id:amendment.id,p_locale:language});
   assert.equal(archive.pdf_sha256,digest(bytes));assert.equal(archive.source_hash,amendment.content_hash);archives[language]=archive;
  }
  assert.notEqual(archives.fr.pdf_sha256,archives.ar.pdf_sha256);
  const archive=archives[locale];
  const envelope=await rpc(fixture,actor.client,'create_amendment_signature_envelope',{p_amendment_id:amendment.id,p_provider_code:policy.providerCode,p_environment:policy.environment,p_requested_level:'SIMPLE',p_document_file_name:'synthetic-local-amendment.pdf',p_document_storage_path:archive.storage_path,p_document_sha256:archive.pdf_sha256,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
  const [base]=await fixture.resources.database`select price_minor::text price,currency from public.contract_versions where id=${chain.contractVersionId}::uuid`;
  const signers=[];
  for(const [index,party]of [actor,provider].entries()){
   const user=await party.client.auth.getUser();assert.equal(user.error,null);
   const signer=await rpc(fixture,actor.client,'add_signature_signer',{p_envelope_id:envelope.envelope_id,p_organization_id:party.organizationId,p_signer_user_id:party.userId,p_signer_role:index===0?'CLIENT_OWNER':'PROVIDER_OWNER',p_email_hash:digest(user.data.user.email.trim().toLowerCase()),p_signing_order:index+1,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
   const authority=await uploadLinkedLocalArtifact(fixture,[`Synthetic amendment authority ${amendment.id}`,`Party ${party.organizationId}`]);
   await rpc(fixture,party.client,'authorize_signature_signer',{p_signer_id:signer.signer_id,p_authority_type:'LEGAL_REPRESENTATIVE',p_authority_scope:['CONTRACT_SIGNATURE'],p_amount_ceiling_minor:(BigInt(base.price)+5001n).toString(),p_currency:base.currency,p_valid_from:new Date(Date.now()-86400000).toISOString().slice(0,10),p_valid_until:new Date(Date.now()+86400000).toISOString().slice(0,10),p_evidence_storage_path:authority.path,p_evidence_sha256:authority.sha256,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});signers.push(signer.signer_id);
  }
  const submission={p_amendment_id:amendment.id,p_expected_hash:amendment.content_hash,p_idempotency_key:randomUUID()};
  await rpc(fixture,actor.client,'submit_contract_amendment_for_signature',submission);
  for(const [index,step]of [{action:'SENT',signer:null},{action:'SIGNER_SIGNED',signer:signers[0]},{action:'SIGNER_SIGNED',signer:signers[1]}].entries()){
   const queued=await rpc(fixture,fixture.resources.localJourneyReviewers.fr.client,'request_signature_mock_step_v1',{p_envelope_id:envelope.envelope_id,p_action:step.action,p_signer_id:step.signer,p_idempotency_key:randomUUID()});
   await rpc(fixture,fixture.resources.admin,'execute_signature_mock_step_v1',{p_command_id:queued.command_id});
   const [state]=await fixture.resources.database`select status,activated_contract_version_id from public.contract_amendments where id=${amendment.id}::uuid`;
   if(index<2){assert.equal(state.status,'PENDING_SIGNATURE');assert.equal(state.activated_contract_version_id,null);}else{assert.equal(state.status,'ACTIVE');assert.ok(state.activated_contract_version_id);}
  }
  const [current]=await fixture.resources.database`select v.id,v.price_minor::text price from public.contracts c join public.contract_versions v on v.contract_id=c.id and v.version=c.current_version where c.id=${chain.contractId}::uuid`;
  assert.notEqual(current.id,chain.contractVersionId);assert.equal(current.price,(BigInt(base.price)+5001n).toString());
  const [unchanged]=await fixture.resources.database`select content_hash,price_minor::text price from public.contract_versions where id=${chain.contractVersionId}::uuid`;assert.equal(unchanged.content_hash,chain.contractHash);assert.equal(unchanged.price,base.price);
  const preparations=await rpc(fixture,actor.client,'list_mission_amendment_preparations_v1',{p_amendment_ids:[amendment.id]});
  const preparation=preparations[0];assert.equal(preparation.status,'READY');assert.equal(preparation.items.length,1);assert.equal(preparation.items[0].criteria.length,2);
  items[locale]={amendmentId:amendment.id,label:receipt.label,preparation,newVersionId:current.id};
 }
 return items;
}
export async function verifyLocalAmendmentExecutions(fixture,chains,provider,items,directory){
 for(const locale of ['fr','ar']){
  const item=items[locale],chain=chains[locale],actor=fixture.resources.localJourneyActors[locale];
  const receipt=JSON.parse(await readFile(resolve(directory,`execution-${locale}.json`),'utf8'));
  const [execution]=await fixture.resources.database`select * from public.mission_amendment_executions_v1 where amendment_id=${item.amendmentId}::uuid`;
  assert.ok(execution);assert.equal(execution.executed_by,actor.userId);assert.equal(execution.contract_version_id,item.newVersionId);assert.equal(execution.preparation_hash,receipt.hash);
  // Keep wall-clock input as text: postgres.js serializes timestamp parameters
  // through the host timezone before PostgreSQL receives them.
  const [date]=await fixture.resources.database`select (${receipt.date}::text::timestamp at time zone 'Africa/Casablanca')::text value`;
  assert.equal(new Date(execution.assignments_snapshot[0].due_at).getTime(),new Date(date.value).getTime());
  const args={p_amendment_id:item.amendmentId,p_expected_preparation_hash:receipt.hash,p_assignments:execution.assignments_snapshot,p_schedule_confirmed:true,p_idempotency_key:receipt.key};
  const replay=await rpc(fixture,actor.client,'execute_signed_mission_amendment_v1',args);assert.equal(replay.outcome,'MISSION_AMENDMENT_EXECUTED');assert.equal(replay.created_deliverables,1);
  for(const client of [provider.client,fixture.resources.localJourneyActors[locale==='fr'?'ar':'fr'].client]){const denied=await client.rpc('execute_signed_mission_amendment_v1',{...args,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');}
  const rows=await fixture.resources.database`select d.id,d.status from public.deliverables d where d.mission_id=${chain.missionId}::uuid and d.deliverable_key=${item.preparation.items[0].key}`;
  assert.equal(rows.length,1);assert.equal(rows[0].status,'PENDING');
  const [criteria]=await fixture.resources.database`select count(*)::integer n from public.acceptance_checklists where deliverable_id=${rows[0].id}::uuid`;assert.equal(criteria.n,2);
  const [audit]=await fixture.resources.database`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.action='mission.amendment.executed' and a.resource_id=${chain.missionId} and e.event_type='MissionAmendmentExecutedV1'`;assert.equal(audit.n,1);
 }
 return{governedDevAmendmentActivations:2,realUiMissionAmendmentExecutions:2,realUiAmendedMissionViews:8,oldContractVersionsPreserved:true,amendmentExecutionReplayVerified:true,amendmentForeignExecutionDenied:true,amendmentActivationCertified:false,contractualSignatureValidated:false};
}
