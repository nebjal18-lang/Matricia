import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function verifyLocalAmendments(fixture,chains,provider,directory){
 const db=fixture.resources.database;
 for(const locale of ['fr','ar']){
  const chain=chains[locale],foreign=fixture.resources.localJourneyActors[locale==='fr'?'ar':'fr'].client;
  const [contract]=await db`select c.status,c.current_version,v.id,v.content_hash,v.price_minor::text price from public.contracts c join public.contract_versions v on v.contract_id=c.id and v.version=c.current_version where c.id=${chain.contractId}::uuid`;
  assert.equal(contract.status,'ACTIVE');assert.equal(contract.id,chain.contractVersionId);assert.equal(contract.content_hash,chain.contractHash);
  const [count]=await db`select count(*)::integer n from public.contract_amendments where contract_id=${chain.contractId}::uuid`;assert.equal(count.n,4);
  for(const role of ['client','provider'])for(const device of ['D','M']){
   const receipt=JSON.parse(await readFile(resolve(directory,`${role}-${locale}-${device}.json`),'utf8'));
   const rows=await db`select a.*,r.reason,r.scope_delta from public.contract_amendments a join public.change_requests r on r.id=a.change_request_id where a.contract_id=${chain.contractId}::uuid and r.reason=${receipt.reason}`;assert.equal(rows.length,1);const a=rows[0];
   assert.equal(a.status,'DRAFT');assert.equal(String(a.price_delta_minor),'5001');assert.equal(a.deadline_delta_days,7);assert.equal(a.base_contract_version_id,chain.contractVersionId);assert.equal(a.activated_contract_version_id,null);assert.equal(a.scope_delta.description,receipt.scope);
   if(role==='provider'){assert.equal(a.deliverables_delta.length,1);assert.equal(a.deliverables_delta[0].operation,'ADD');assert.equal(a.deliverables_delta[0].label_fr,receipt.label);assert.equal(a.deliverables_delta[0].details.acceptance_criteria.length,2);}else assert.deepEqual(a.deliverables_delta,[]);
   const denied=await foreign.from('contract_amendments').select('id').eq('id',a.id);assert.equal(denied.error,null);assert.deepEqual(denied.data,[]);
   const actor=role==='client'?fixture.resources.localJourneyActors[locale].client:provider.client;
   const args={p_contract_id:chain.contractId,p_expected_contract_version_id:chain.contractVersionId,p_expected_contract_hash:chain.contractHash,p_reason:receipt.reason,p_scope_delta:a.scope_delta,p_price_delta_minor:'5001',p_deadline_delta_days:7,p_idempotency_key:receipt.key};
   const replay=await actor.rpc(role==='client'?'create_current_contract_amendment_v1':'propose_provider_contract_amendment_v1',role==='client'?args:{...args,p_deliverables_delta:a.deliverables_delta});assert.equal(replay.error,null);assert.equal(replay.data.amendment_id,a.id);
   const premature=await fixture.resources.localJourneyActors[locale].client.rpc('submit_contract_amendment_for_signature',{p_amendment_id:a.id,p_expected_hash:a.content_hash,p_idempotency_key:randomUUID()});assert.equal(premature.error?.code,'55000');
   const unauthorized=await provider.client.rpc('submit_contract_amendment_for_signature',{p_amendment_id:a.id,p_expected_hash:a.content_hash,p_idempotency_key:randomUUID()});assert.equal(unauthorized.error?.code,'42501');
   const [unchanged]=await db`select status from public.contract_amendments where id=${a.id}::uuid`;assert.equal(unchanged.status,'DRAFT');
   const [audit]=await db`select count(*)::integer n from public.audit_events x join public.event_outbox e on e.correlation_id=x.correlation_id where x.resource_id=${a.id} and x.action='contract.amendment_drafted' and e.event_type='ContractAmendmentDraftedV1'`;assert.equal(audit.n,1);
  }
 }
 return{realUiClientAmendmentRequests:4,realUiProviderAmendmentProposals:4,realProposedAdditionalDeliverables:4,exactAmendmentPriceDeltaMinor:'5001',signedBaseUnchangedBeforeSignatures:true,amendmentReplayVerified:true,foreignAmendmentReadDenied:true,missingSignaturePrerequisitesBlockSubmission:true,amendmentActivationCertified:false};
}
