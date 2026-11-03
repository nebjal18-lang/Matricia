import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { localFixturePdf } from './local-fixture-pdf.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');

/** Historical qualification inputs; identity verification itself uses the real AAL2 command. */
export async function prepareLocalQuoteIdentity(fixture,organizationId,userId){
 if(fixture.config.runtimeMode!=='isolated-local-docker'||!fixture.config.localDockerVerified||!fixture.resources.organizationIds.includes(organizationId)||!fixture.resources.userIds.includes(userId))throw new Error('LOCAL_QUOTE_IDENTITY_SCOPE_REQUIRED');
 const db=fixture.resources.database;
 const[organization]=await db`select legal_name from public.organizations where id=${organizationId}::uuid and created_by=${userId}::uuid and display_name like'P23 Provider %'`;
 if(!organization)throw new Error('LOCAL_QUOTE_IDENTITY_FIXTURE_REQUIRED');
 const ice=(BigInt(`0x${sha(organizationId).slice(0,14)}`)%1_000_000_000_000_000n).toString().padStart(15,'0'),fiscal=(BigInt(`0x${sha(`${organizationId}:if`).slice(0,10)}`)%100_000_000n).toString().padStart(8,'0'),registration=`E2E${organizationId.replaceAll('-','').slice(0,16).toUpperCase()}`;
 const documents=['LEGAL','FISCAL','INSURANCE'].map(kind=>{const bytes=localFixturePdf(['SYNTHETIC LOCAL PROVIDER QUALIFICATION - NOT OFFICIAL',kind,organization.legal_name,`ICE: ${ice}`,`IF: ${fiscal}`,`RC: ${registration}`]);return{kind,family:randomUUID(),version:randomUUID(),path:`test-only/${organizationId}/${kind.toLowerCase()}.pdf`,bytes,digest:sha(bytes)};});
 fixture.resources.localQuoteIdentityPaths??=[];
 await db.begin(async tx=>{
  await tx.unsafe("set local session_replication_role='replica'");
  await tx`insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status,is_active)values(${organizationId}::uuid,'ICE',${ice},'PENDING',true),(${organizationId}::uuid,'IF',${fiscal},'PENDING',true),(${organizationId}::uuid,'RC',${registration},'PENDING',true)`;
  await tx`insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,secondary_subcontracting_allowed,partner_contract_status,created_by)values(${organizationId}::uuid,'VERIFIED','ACTIVE','Précondition historique synthétique de devis local',4,6,false,'SIGNED',${userId}::uuid)`;
  await tx`insert into public.provider_company_decisions(provider_organization_id,decision_version,company_status,partner_contract_status,reason,rule_version,decided_by,correlation_id)values(${organizationId}::uuid,1,'VERIFIED','SIGNED','Précondition historique synthétique locale, sans certification réelle','LOCAL-FIXTURE-1',${userId}::uuid,${randomUUID()}::uuid)`;
  for(const document of documents){
   await tx`insert into public.provider_document_families(id,provider_organization_id,document_kind,code,created_by)values(${document.family}::uuid,${organizationId}::uuid,${document.kind},${`E2E_${document.kind}`},${userId}::uuid)`;
   await tx`insert into public.provider_document_versions(id,family_id,provider_organization_id,version_number,status,storage_object_path,content_hash,change_reason,submitted_by,reviewed_by,reviewed_at)values(${document.version}::uuid,${document.family}::uuid,${organizationId}::uuid,1,'VERIFIED',${document.path},${document.digest},'Précondition historique synthétique locale',${userId}::uuid,${userId}::uuid,clock_timestamp())`;
  }
 });
 for(const document of documents){
  fixture.resources.localQuoteIdentityPaths.push(document.path);
  const uploaded=await fixture.resources.admin.storage.from('provider-qualification').upload(document.path,document.bytes,{contentType:'application/pdf',upsert:false});assert.equal(uploaded.error,null);
  const downloaded=await fixture.resources.admin.storage.from('provider-qualification').download(document.path);assert.equal(downloaded.error,null);assert.equal(sha(Buffer.from(await downloaded.data.arrayBuffer())),document.digest);
  const[job]=await db`insert into public.provider_document_scan_jobs(document_version_id,provider_organization_id,storage_object_path,declared_sha256,declared_mime_type)values(${document.version}::uuid,${organizationId}::uuid,${document.path},${document.digest},'application/pdf')returning id`;
  const scan=await fixture.resources.admin.rpc('record_provider_document_scan_result',{p_upload_id:job.id,p_result:'CLEAN',p_engine_code:'LOCAL_KNOWN_FIXTURE_PDF',p_engine_version:'1',p_computed_sha256:document.digest,p_idempotency_key:randomUUID()});assert.equal(scan.error,null);assert.equal(scan.data?.result,'CLEAN');
 }
 const central=fixture.sessions.central.client;
 const review=await central.rpc('get_provider_identity_review_context_v1',{p_provider_organization_id:organizationId});assert.equal(review.error,null);assert.equal(review.data?.document_version_ids?.length,3);assert.equal(review.data?.currently_verified,false);
 const result=await central.rpc('revalidate_provider_identity_v1',{p_provider_organization_id:organizationId,p_expected_organization_row_version:review.data.organization_row_version,p_expected_profile_row_version:review.data.profile_row_version,p_expected_identity_hash:review.data.identity_hash,p_expected_company_decision_id:review.data.company_decision_id,p_reason:'Revue humaine synthétique des identifiants de devis en recette locale',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});assert.equal(result.error,null);
 const current=await central.rpc('get_provider_identity_review_context_v1',{p_provider_organization_id:organizationId});assert.equal(current.error,null);assert.equal(current.data?.currently_verified,true);
 return{identityHash:current.data.identity_hash,legalName:organization.legal_name,ice};
}
export async function cleanLocalQuoteIdentityFiles(fixture){
 if(!fixture.resources.localQuoteIdentityPaths?.length)return;
 const result=await fixture.resources.admin.storage.from('provider-qualification').remove(fixture.resources.localQuoteIdentityPaths);
 if(result.error)throw new Error('LOCAL_QUOTE_IDENTITY_STORAGE_CLEANUP_FAILED');
}
export async function closePendingLocalProviderScans(fixture,paths){
 if(!paths?.length)return;
 if(fixture.config.runtimeMode!=='isolated-local-docker'||!fixture.config.localDockerVerified||paths.some(path=>!path.startsWith('test-only/')))throw new Error('LOCAL_PROVIDER_SCAN_CLEANUP_SCOPE_INVALID');
 const jobs=await fixture.resources.database`select id,declared_sha256 from public.provider_document_scan_jobs where storage_object_path=any(${paths}::text[])and scan_status='PENDING'`;
 const failures=[];
 for(const job of jobs){
  try{
   const result=await fixture.resources.admin.rpc('record_provider_document_scan_result',{p_upload_id:job.id,p_result:'ERROR',p_engine_code:'LOCAL_FIXTURE_CLEANUP',p_engine_version:'1',p_computed_sha256:job.declared_sha256,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
   if(result.error)throw new Error('LOCAL_PROVIDER_SCAN_CLEANUP_FAILED');
  }catch(error){failures.push(error);}
 }
 if(failures.length)throw new AggregateError(failures,'LOCAL_PROVIDER_SCAN_CLEANUP_FAILED');
}
