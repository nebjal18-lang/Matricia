import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {localFixturePdf} from './local-fixture-pdf.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function rpc(client,name,args){const r=await client.rpc(name,args);assert.equal(r.error,null,`REPUTATION_FINANCE_${name.toUpperCase()}_FAILED`);return r.data;}
export async function prepareReputationFinance(fixture,chain,provider){
 assert.equal(fixture.config.localDockerVerified,true);
 const db=fixture.resources.database,adminId=fixture.resources.userIds[2],reviewer=fixture.sessions.central.client,client=fixture.resources.localJourneyActors.fr.client;
 await db`insert into public.platform_user_roles(user_id,role_code) values(${adminId}::uuid,'FINANCE_MANAGER') on conflict do nothing`;
 fixture.resources.localCommercialExtraRoles??=[];if(!fixture.resources.localCommercialExtraRoles.some(x=>x.userId===adminId&&x.roleCode==='FINANCE_MANAGER'))fixture.resources.localCommercialExtraRoles.push({userId:adminId,roleCode:'FINANCE_MANAGER'});
 // A declared synthetic fiscal prerequisite on the verified local development
 // database only. Never activate a demo row or replace an existing valid rule.
 await db.begin(async tx=>{
  await tx`select pg_advisory_xact_lock(hashtextextended('local-reputation-provider-commission-tax',0))`;
  const active=await tx`select id from public.tax_rule_versions where category_code='PROVIDER_COMMISSION' and jurisdiction_code='MA' and status='ACTIVE' and professional_validation_status='VALIDATED' and effective_from<=current_date and (effective_to is null or effective_to>=current_date)`;
  if(active.length)return;
  const taxId=randomUUID();fixture.resources.localReputationTaxId=taxId;
  await tx.unsafe("set local session_replication_role='replica'");
  const inserted=await tx`insert into public.tax_rule_versions(id,jurisdiction_code,category_code,version,rate_basis_points,effective_from,effective_to,status,professional_validation_status,rule_type,priority,conditions,legal_reference,rounding_strategy,approved_by,approved_at,validation_reference,content_hash,change_reason) select ${taxId}::uuid,'MA','PROVIDER_COMMISSION',(select coalesce(max(version),0)+1 from public.tax_rule_versions where category_code='PROVIDER_COMMISSION' and jurisdiction_code='MA'),rate_basis_points,current_date,current_date,'ACTIVE','VALIDATED',rule_type,priority,'{}','LOCAL SYNTHETIC REFERENCE - NOT FISCAL APPROVAL',rounding_strategy,${adminId}::uuid,clock_timestamp(),${'LOCAL-REPUTATION-'+fixture.manifest.runId},${hash(Buffer.from(fixture.manifest.runId))},'Synthetic local reputation finance prerequisite' from public.tax_rule_versions where category_code='PROVIDER_COMMISSION' and jurisdiction_code='MA' order by version desc limit 1 returning id`;
  assert.equal(inserted.length,1,'LOCAL_COMMISSION_TAX_REFERENCE_REQUIRED');
 });
 const bytes=localFixturePdf(['TEST ONLY - SYNTHETIC LOCAL RECEIPT','No actual bank transfer or external payment certified.',chain.missionId]),sha=hash(bytes);
 const upload=await rpc(provider.client,'begin_provider_receipt_proof_upload',{p_provider_organization_id:provider.organizationId,p_original_file_name:'synthetic-receipt.pdf',p_declared_mime_type:'application/pdf',p_declared_size_bytes:bytes.length,p_declared_sha256:sha,p_idempotency_key:randomUUID()});
 fixture.resources.localReputationFinance={upload,sha};
 const stored=await provider.client.storage.from(upload.storage_bucket).upload(upload.storage_object_path,bytes,{contentType:'application/pdf'});assert.equal(stored.error,null);
 const downloaded=await fixture.resources.admin.storage.from(upload.storage_bucket).download(upload.storage_object_path);assert.equal(downloaded.error,null);assert.equal(hash(Buffer.from(await downloaded.data.arrayBuffer())),sha);
 await rpc(fixture.resources.admin,'record_provider_payment_proof_scan_result',{p_upload_id:upload.upload_id,p_result:'CLEAN',p_engine_code:'LOCAL_KNOWN_FIXTURE_PDF',p_engine_version:'1.0.0',p_computed_sha256:sha,p_idempotency_key:randomUUID()});
 const [{today}]=await db`select current_date::text today`,key=randomUUID();
 const payload={missionId:chain.missionId,eventType:'CLIENT_RECEIPT_CONFIRMED',paymentMethod:'BANK_TRANSFER',occurredOn:today,currency:'MAD',grossAmountMinor:'100',clientReceiptReference:`SYNTHETIC_${fixture.manifest.runId}`,proofHash:sha};
 await rpc(provider.client,'save_my_provider_billing_intent',{p_provider_organization_id:provider.organizationId,p_kind:'PAYABLE',p_payload:payload,p_idempotency_key:key});
 const declared=await rpc(provider.client,'record_provider_payable_event',{p_mission_id:chain.missionId,p_event_type:payload.eventType,p_occurred_on:today,p_currency:'MAD',p_gross_amount_minor:'100',p_client_receipt_reference:payload.clientReceiptReference,p_proof_hash:sha,p_idempotency_key:key});
 const args={p_declaration_id:declared.declaration_id,p_approved:true,p_reason:'Independent review of known synthetic local receipt'};
 const self=await provider.client.rpc('review_provider_financial_declaration_v1',args);assert.equal(self.error?.code,'42501');
 const early=await reviewer.rpc('review_provider_financial_declaration_v1',args);assert.equal(early.error?.code,'55000');
 await rpc(client,'confirm_provider_receipt_declaration_v1',{p_declaration_id:declared.declaration_id,p_confirmed:true,p_reason:'Client confirms synthetic local receipt for testing'});
 const reviewed=await rpc(reviewer,'review_provider_financial_declaration_v1',args);assert.ok(reviewed.payable_event_id);assert.deepEqual(await rpc(reviewer,'review_provider_financial_declaration_v1',args),reviewed);
 const [event]=await db`select gross_amount_minor::text gross from public.provider_payable_events where id=${reviewed.payable_event_id}::uuid`;assert.equal(event.gross,'100');
 return{nativeReviewedReceiptAccruals:1,independentClientAndFinanceReceiptDecisions:true,externalPaymentCertified:false,commissionTaxIsHistoricalSyntheticPrecondition:true};
}
export async function cleanReputationFinance(fixture){
 if(fixture.resources.localReputationTaxId)await fixture.resources.database.begin(async tx=>{await tx.unsafe("set local session_replication_role='replica'");await tx`update public.tax_rule_versions set status='RETIRED' where id=${fixture.resources.localReputationTaxId}::uuid and validation_reference=${'LOCAL-REPUTATION-'+fixture.manifest.runId}`;});
 const item=fixture.resources.localReputationFinance;if(!item)return;
 const [row]=await fixture.resources.database`select u.status,exists(select 1 from public.provider_financial_declarations_v1 d where d.upload_id=u.id) declared from public.provider_payment_proof_uploads u where u.id=${item.upload.upload_id}::uuid`;
 if(row?.status==='BOUND'||row?.declared){
  const retained=await fixture.resources.admin.storage.from(item.upload.storage_bucket).download(item.upload.storage_object_path);assert.equal(retained.error,null);assert.equal(hash(Buffer.from(await retained.data.arrayBuffer())),item.sha);
 }else{
  const removed=await fixture.resources.admin.storage.from(item.upload.storage_bucket).remove([item.upload.storage_object_path]);assert.equal(removed.error,null);
 }
}
