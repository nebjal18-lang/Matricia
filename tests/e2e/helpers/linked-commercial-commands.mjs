import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {totp} from '../../../scripts/p05-e2e/totp.mjs';
import {localFixturePdf} from './local-fixture-pdf.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');

export function missingLocalFixtureBucket(error){
 const status=Number(error?.status??error?.statusCode);
 return[400,404].includes(status)&&(error?.code==='NoSuchBucket'||/^Bucket not found$/iu.test(error?.message??''));
}

function isolated(fixture){
 assert.equal(fixture.config.runtimeMode,'isolated-local-docker');
 assert.equal(fixture.config.localDockerVerified,true);
}
async function command(fixture,client,name,input){
 fixture.resources.localCommercialStage=name;
 const response=await client.rpc(name,input);
 if(response.error){const reason=response.error.message;fixture.resources.localCommercialCommandDiagnostic={operation:name,sqlstate:response.error.code,canonicalReason:typeof reason==='string'&&/^[A-Z][A-Z0-9_]{1,119}$/u.test(reason)?reason:null,status:Number.isInteger(response.status)?response.status:null};throw Object.assign(new Error(`LOCAL_COMMERCIAL_${name.toUpperCase()}_FAILED`),{code:response.error.code});}
 fixture.resources.localCommercialLastOk??=[];fixture.resources.localCommercialLastOk.push(name);
 return response.data;
}
async function one(client,table,columns,filters){
 let query=client.from(table).select(columns);
 for(const[key,value]of Object.entries(filters))query=query.eq(key,value);
 const result=await query.single();
 if(result.error||!result.data)throw new Error('LOCAL_COMMERCIAL_REQUIRED_SCOPED_RECORD_MISSING');
 return result.data;
}
function trackExtraRole(fixture,userId,roleCode){
 assert.ok(fixture.resources.userIds.includes(userId));
 assert.ok(['FINANCE_MANAGER','LIBRARY_MANAGER'].includes(roleCode));
 fixture.resources.localCommercialExtraRoles??=[];
 if(!fixture.resources.localCommercialExtraRoles.some(role=>role.userId===userId&&role.roleCode===roleCode))fixture.resources.localCommercialExtraRoles.push({userId,roleCode});
}
/** Run after policy disabling, before the generic fixture account cleanup. */
export async function clearLinkedLocalExtraPlatformRoles(fixture){
 isolated(fixture);
 for(const{userId,roleCode}of fixture.resources.localCommercialExtraRoles??[]){
  assert.ok(fixture.resources.userIds.includes(userId));assert.ok(['FINANCE_MANAGER','LIBRARY_MANAGER'].includes(roleCode));
  await fixture.resources.database`delete from public.platform_user_roles where user_id=${userId}::uuid and role_code=${roleCode}`;
  const [remaining]=await fixture.resources.database`select count(*)::int as count from public.platform_user_roles where user_id=${userId}::uuid and role_code=${roleCode}`;
  assert.equal(remaining.count,0);
 }
}

/** Native GoTrue enrollment; this never fabricates claims or stores a TOTP secret. */
export async function requireRealLocalActorMfa(fixture,actor){
 isolated(fixture);
 assert.ok(fixture.resources.userIds.includes(actor.userId));
 const user=await actor.client.auth.getUser();assert.equal(user.error,null);assert.equal(user.data.user?.id,actor.userId);
 const before=await actor.client.auth.mfa.getAuthenticatorAssuranceLevel();assert.equal(before.error,null);
 if(before.data.currentLevel!=='aal2'){
  const enrolled=await actor.client.auth.mfa.enroll({factorType:'totp',friendlyName:'Synthetic linked local commercial recipe'});
  assert.equal(enrolled.error,null);assert.ok(enrolled.data?.id&&enrolled.data?.totp?.secret);
  let verified=false;
  for(const offset of [0,-30_000,30_000]){
   const result=await actor.client.auth.mfa.challengeAndVerify({factorId:enrolled.data.id,code:totp(enrolled.data.totp.secret,Date.now()+offset)});
   if(!result.error){verified=true;break;}
  }
  assert.equal(verified,true);
 }
 const after=await actor.client.auth.mfa.getAuthenticatorAssuranceLevel();assert.equal(after.error,null);assert.equal(after.data.currentLevel,'aal2');
}

/** Policy creation and independent review are real commands, never seeded decisions. */
export async function createLinkedLocalContractPolicies(fixture,{libraryId,serviceId}){
 isolated(fixture);
 assert.equal(libraryId,fixture.resources.localCatalog.library);assert.equal(serviceId,fixture.resources.localCatalog.service);
 const reviewers=fixture.resources.localJourneyReviewers;
 assert.ok(reviewers?.fr&&reviewers?.ar);assert.notEqual(reviewers.fr.userId,reviewers.ar.userId);
 for(const actor of Object.values(reviewers))await requireRealLocalActorMfa(fixture,actor);
 // Role setup is a declared fixture precondition. Both accounts are fresh,
 // fixture-owned GoTrue accounts; no application decision is inserted here.
 assert.ok(Object.values(reviewers).every(actor=>fixture.resources.userIds.includes(actor.userId)));
 for(const actor of Object.values(reviewers))trackExtraRole(fixture,actor.userId,'FINANCE_MANAGER');
 await fixture.resources.database`insert into public.platform_user_roles(user_id,role_code)select user_id,'FINANCE_MANAGER'from unnest(${Object.values(reviewers).map(actor=>actor.userId)}::uuid[])user_id on conflict(user_id,role_code)do nothing`;
 const suffix=fixture.manifest.runId.replaceAll('-','').toUpperCase();
 const from=new Date(Date.now()-86400_000).toISOString().slice(0,10),until=new Date(Date.now()+86400_000).toISOString().slice(0,10);
 const result={};
 for(const kind of ['TEMPLATE','COMMISSION']){
  const payload={kind,code:`LOCAL_${kind}_${suffix}`,version:1,library_id:libraryId,service_id:serviceId,country_code:'MA',title_fr:'Politique synthétique de recette uniquement',title_ar:'سياسة اصطناعية للاختبار فقط',valid_from:from,valid_until:until,approval_reference:'LOCAL-SYNTHETIC-TEST-NOT-LEGAL-APPROVAL',...(kind==='TEMPLATE'?{clauses:{fr:'TEXTE SYNTHÉTIQUE DE RECETTE LOCALE UNIQUEMENT. Aucune approbation juridique réelle.',ar:'نص اصطناعي للاختبار المحلي فقط. لا موافقة قانونية حقيقية.'}}:{currency:'MAD',basis_points:750,basis_code:'CONFIRMED_CLIENT_RECEIPT_AMOUNT'})};
  const proposed=await command(fixture,reviewers.fr.client,'create_contract_policy_version_v1',{p_payload:payload,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
  assert.equal(proposed.outcome,'CONTRACT_POLICY_VERSION_PROPOSED');
  const input={p_policy_version_id:proposed.policy_version_id,p_approve:true,p_reason:'Contre-revue humaine synthétique de recette locale, aucune approbation client réelle',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
  const denied=await reviewers.fr.client.rpc('decide_contract_policy_version_v1',input);assert.equal(denied.error?.code,'42501');
  const reviewed=await command(fixture,reviewers.ar.client,'decide_contract_policy_version_v1',input);
  assert.equal(reviewed.decision,'APPROVE');
  assert.deepEqual(await command(fixture,reviewers.ar.client,'decide_contract_policy_version_v1',input),reviewed);
  result[kind.toLowerCase()]=proposed.policy_version_id;
 }
 return result;
}

export async function publishLinkedLocalFiscalMapping(fixture,provider){
 isolated(fixture);
 const catalog=fixture.resources.localCatalog,reviewers=fixture.resources.localJourneyReviewers;
 const context=await command(fixture,reviewers.fr.client,'get_service_tax_category_mapping_context_v1',{p_service_version_id:catalog.serviceVersion,p_country_code:'MA',p_currency:'MAD',p_page:1});
 assert.equal(context.environment,'DEVELOPMENT');assert.equal(context.source.service_version_id,catalog.serviceVersion);
 const [dates]=await fixture.resources.database`select(clock_timestamp()at time zone'Africa/Casablanca')::date::text as today,((clock_timestamp()at time zone'Africa/Casablanca')::date+1)::text as tomorrow`;
 const proposal=await command(fixture,reviewers.fr.client,'propose_service_tax_category_mapping_v1',{p_service_version_id:catalog.serviceVersion,p_expected_service_hash:context.source.content_hash,p_expected_scope_hash:context.scope_hash,p_country_code:'MA',p_currency:'MAD',p_category_code:provider.taxCategoryCode,p_valid_from:dates.today,p_valid_until:dates.tomorrow,p_development_only:true,p_supersedes_mapping_ids:[],p_reason:'Classement fiscal synthétique explicite pour recette locale uniquement',p_idempotency_key:randomUUID()});
 assert.equal(proposal.outcome,'SERVICE_TAX_MAPPING_PROPOSED');
 const decision={p_proposal_id:proposal.proposal_id,p_expected_content_hash:proposal.content_hash,p_approve:true,p_approval_reference:'LOCAL_TEST_SERVICE_TAX_NOT_FISCAL_APPROVAL',p_reason:'Contre-revue fiscale synthétique de développement, sans validation professionnelle réelle'};
 const self=await reviewers.fr.client.rpc('decide_service_tax_category_mapping_v1',decision);assert.equal(self.error?.code,'42501');
 const approved=await command(fixture,reviewers.ar.client,'decide_service_tax_category_mapping_v1',decision);assert.equal(approved.outcome,'SERVICE_TAX_MAPPING_PUBLISHED');assert.equal(approved.development_only,true);
 assert.deepEqual(await command(fixture,reviewers.ar.client,'decide_service_tax_category_mapping_v1',decision),approved);
 const policy=await command(fixture,reviewers.fr.client,'get_service_tax_category_policy_v1',{p_service_version_id:catalog.serviceVersion,p_country_code:'MA',p_currency:'MAD',p_effective_on:dates.today});
 assert.equal(policy.mapping_id,approved.mapping_id);assert.equal(policy.category_code,provider.taxCategoryCode);
 fixture.resources.localCommercialFiscalMappingId=approved.mapping_id;
 return approved;
}

function actorCookieHeader(actor){
 assert.ok(actor.cookies instanceof Map);
 return[...actor.cookies.values()].map(({name,value})=>{assert.match(name,/^[A-Za-z0-9_.-]+$/u);assert.ok(typeof value==='string'&&!/[\r\n;]/u.test(value));return`${name}=${value}`;}).join('; ');
}

/** Authenticated Next routes must render/register both canonical languages atomically. */
export async function archiveLinkedLocalContractPdfs(fixture,chain){
 isolated(fixture);
 fixture.resources.localCommercialCanonicalSources??=[];
 if(!fixture.resources.localCommercialCanonicalSources.some(source=>source.versionId===chain.contractVersionId))fixture.resources.localCommercialCanonicalSources.push({versionId:chain.contractVersionId,hash:chain.contractHash});
 const actor=fixture.resources.localJourneyActors[chain.locale],foreign=fixture.resources.localJourneyActors[chain.locale==='fr'?'ar':'fr'];
 const archived={};
 for(const locale of ['fr','ar']){
  fixture.resources.localCommercialStage=`CANONICAL_PDF_${locale.toUpperCase()}`;
  const path=`/api/signatures/contracts/${chain.contractId}/documents?locale=${locale}&contractVersionId=${chain.contractVersionId}`;
  const response=await fetch(new URL(path,fixture.config.baseUrl),{headers:{cookie:actorCookieHeader(actor)},redirect:'error',signal:AbortSignal.timeout(60_000)});
  if(response.status!==200){let code;try{const value=await response.json();if(typeof value.code==='string'&&/^[A-Z0-9_]{1,80}$/u.test(value.code))code=value.code;}catch{}fixture.resources.localCommercialHttpDiagnostic={operation:'CANONICAL_SOURCE_PDF',locale,status:response.status,code:code??'UNAVAILABLE'};throw new Error('LOCAL_COMMERCIAL_CANONICAL_PDF_HTTP_FAILED');}
  assert.match(response.headers.get('content-type')??'',/^application\/pdf/u);assert.match(response.headers.get('cache-control')??'',/no-store/u);assert.equal(response.headers.get('x-matricia-document-kind'),'UNSIGNED_SOURCE_DOCUMENT');
  const bytes=Buffer.from(await response.arrayBuffer()),digest=hash(bytes);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>500);assert.equal(response.headers.get('etag'),`"${digest}"`);
  const artifact=await command(fixture,actor.client,'get_signature_document_archive_v1',{p_source_kind:'CONTRACT',p_source_id:chain.contractVersionId,p_locale:locale});
  assert.equal(artifact.source_hash,chain.contractHash);assert.equal(artifact.pdf_sha256,digest);assert.equal(artifact.locale,locale);assert.equal(artifact.size_bytes,bytes.length);assert.equal(artifact.render_version,'SIGNATURE_SOURCE_PDF_V1');
  assert.equal(artifact.storage_path,`contract/${chain.contractVersionId}/${chain.contractHash}/${locale}/${digest}.pdf`);
  assert.notEqual(digest,chain.contractHash);
  fixture.resources.localCommercialCanonicalArtifactPaths??=[];
  if(!fixture.resources.localCommercialCanonicalArtifactPaths.includes(artifact.storage_path))fixture.resources.localCommercialCanonicalArtifactPaths.push(artifact.storage_path);
  const cached=await fetch(new URL(path,fixture.config.baseUrl),{headers:{cookie:actorCookieHeader(actor)},redirect:'error',signal:AbortSignal.timeout(60_000)});assert.equal(cached.status,200);assert.equal(cached.headers.get('etag'),`"${digest}"`);assert.equal(hash(Buffer.from(await cached.arrayBuffer())),digest);
  const again=await command(fixture,actor.client,'get_signature_document_archive_v1',{p_source_kind:'CONTRACT',p_source_id:chain.contractVersionId,p_locale:locale});assert.equal(again.id,artifact.id);
  const denied=await fetch(new URL(path,fixture.config.baseUrl),{headers:{cookie:actorCookieHeader(foreign)},redirect:'error',signal:AbortSignal.timeout(10_000)});assert.equal(denied.status,404);await denied.arrayBuffer();
  const forbidden=await foreign.client.storage.from('signature-source-documents').download(artifact.storage_path);assert.ok(forbidden.error);
  const publicUrl=fixture.resources.admin.storage.from('signature-source-documents').getPublicUrl(artifact.storage_path).data.publicUrl;
  const publicResult=await fetch(publicUrl,{redirect:'error',signal:AbortSignal.timeout(10_000)});assert.ok(publicResult.status>=400&&publicResult.status<500);await publicResult.arrayBuffer();
  archived[locale]={id:artifact.id,path:artifact.storage_path,sha256:digest,sizeBytes:bytes.length,partiesHash:artifact.parties_hash};
 }
 assert.notEqual(archived.fr.id,archived.ar.id);assert.notEqual(archived.fr.sha256,archived.ar.sha256);assert.equal(archived.fr.partiesHash,archived.ar.partiesHash);
 const [registered]=await fixture.resources.database`select count(*)::int as count,count(distinct locale)::int as languages from private.contract_signature_source_artifacts_v1 where source_kind='CONTRACT'and source_id=${chain.contractVersionId}::uuid and source_hash=${chain.contractHash} and locale in('fr','ar')`;
 assert.equal(registered.count,2);assert.equal(registered.languages,2);
 fixture.resources.localCommercialFacts??=[];fixture.resources.localCommercialFacts.push({locale:chain.locale,stage:'CANONICAL_BILINGUAL_PDF_PAIR',sourceHash:chain.contractHash,frPdfSha256:archived.fr.sha256,arPdfSha256:archived.ar.sha256,cacheAndForeignDenialVerified:true});
 return{...chain,canonicalPdfs:archived,canonicalPdfPairVerified:true,canonicalPdfCacheVerified:true,canonicalPdfForeignReadDenied:true};
}

/** Registered archive rows are immutable historical evidence, so retain their private files. */
export async function verifyLinkedLocalCanonicalPdfRetention(fixture){
 isolated(fixture);
 const ids=fixture.resources.organizationIds;
 const artifacts=await fixture.resources.database`select a.storage_path,a.pdf_sha256,a.size_bytes::text as size_bytes from private.contract_signature_source_artifacts_v1 a join public.contract_versions v on v.id=a.contract_version_id join public.contracts c on c.id=v.contract_id where c.client_organization_id=any(${ids}::uuid[])and a.locale in('fr','ar')`;
 for(const artifact of artifacts){
  assert.ok(artifact.storage_path.startsWith('contract/'));
  const read=await fixture.resources.admin.storage.from('signature-source-documents').download(artifact.storage_path);assert.equal(read.error,null);const bytes=Buffer.from(await read.data.arrayBuffer());assert.equal(hash(bytes),artifact.pdf_sha256);assert.equal(String(bytes.length),artifact.size_bytes);
 }
 fixture.resources.localCommercialRetainedCanonicalPdfFiles=artifacts.length;
 // A failed render/readback may have uploaded an object before pair registration.
 // Remove only unregistered files beneath this run's exact canonical sources.
 for(const source of fixture.resources.localCommercialCanonicalSources??[]){
  assert.match(source.versionId,/^[a-f0-9-]{36}$/u);assert.match(source.hash,/^[a-f0-9]{64}$/u);
  for(const locale of ['fr','ar']){
   const prefix=`contract/${source.versionId}/${source.hash}/${locale}`;
   const listed=await fixture.resources.admin.storage.from('signature-source-documents').list(prefix,{limit:100});assert.equal(listed.error,null);assert.ok(listed.data.length<100,'LOCAL_CANONICAL_CLEANUP_LIST_BUDGET');
   for(const entry of listed.data){
    assert.match(entry.name,/^[a-f0-9]{64}\.pdf$/u);const path=`${prefix}/${entry.name}`;
    if(!artifacts.some(artifact=>artifact.storage_path===path)){const removed=await fixture.resources.admin.storage.from('signature-source-documents').remove([path]);assert.equal(removed.error,null);const missing=await fixture.resources.admin.storage.from('signature-source-documents').download(path);assert.ok(missing.error);}
   }
  }
 }
}

export async function publishLinkedLocalChecklist(fixture){
 isolated(fixture);
 const actor=fixture.resources.localJourneyReviewers?.fr;assert.ok(actor);
 await requireRealLocalActorMfa(fixture,actor);
 const reference=fixture.resources.localCatalog;assert.ok(reference?.serviceVersion);
 const [library]=await fixture.resources.database`select steward_organization_id from public.catalog_libraries where id=${reference.library}::uuid`;
 assert.ok(fixture.resources.organizationIds.includes(library?.steward_organization_id));
 trackExtraRole(fixture,actor.userId,'LIBRARY_MANAGER');
 await fixture.resources.database`insert into public.platform_user_roles(user_id,role_code)values(${actor.userId}::uuid,'LIBRARY_MANAGER')on conflict(user_id,role_code)do nothing`;
 const items=[{key:'QUALITY',label_fr:'Rapport de recette contrôlé',label_ar:'تقرير الاختبار الذي تم فحصه',instructions_fr:'Déposer le PDF synthétique attendu et vérifier ses octets.',instructions_ar:'أودعوا ملف الاختبار الاصطناعي وتحققوا من محتواه.',proof_required:true,proof_types:['DOCUMENT']}];
 const result=await command(fixture,actor.client,'publish_service_checklist_template',{p_audit_organization_id:library.steward_organization_id,p_service_version_id:reference.serviceVersion,p_items:items,p_change_reason:'Publication réelle de la checklist synthétique de recette locale',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
 assert.equal(result.outcome,'SERVICE_CHECKLIST_PUBLISHED');assert.equal(result.item_count,1);
 return{templateId:result.template_id,items};
}

export async function createLinkedLocalSignaturePolicy(fixture){
 isolated(fixture);
 const reviewers=fixture.resources.localJourneyReviewers,issuer=fixture.resources.localJourneyActors?.fr;
 assert.ok(reviewers?.fr&&reviewers?.ar&&issuer);assert.notEqual(reviewers.fr.userId,reviewers.ar.userId);
 const [existing]=await fixture.resources.database`select count(*)::int as count from private.contract_signature_policy_versions_v1 p where p.environment='DEVELOPMENT'and p.source_kind='CONTRACT'and p.approved_at<=clock_timestamp()and(p.valid_until is null or p.valid_until>clock_timestamp())and not exists(select 1 from private.signature_policy_revocations_v1 r where r.policy_version_id=p.id)`;
 assert.equal(existing.count,0,'LOCAL_COMMERCIAL_EXISTING_SIGNATURE_POLICY_CONFLICT');
 const [config]=await fixture.resources.database`select id from public.signature_provider_configs where provider_code='MATRICIA_DEV_MOCK'and environment='DEVELOPMENT'and status='ACTIVE'and valid_from<=clock_timestamp()and(valid_until is null or valid_until>clock_timestamp())order by version desc limit 1`;
 assert.ok(config,'LOCAL_COMMERCIAL_INSTALLED_DEV_MOCK_REQUIRED');
 const proposal=await command(fixture,reviewers.fr.client,'propose_signature_policy_v1',{p_issuer_organization_id:issuer.organizationId,p_source_kind:'CONTRACT',p_provider_config_id:config.id,p_minimum_level:'SIMPLE',p_require_certificate:false,p_require_trusted_timestamp:false,p_legal_approval_reference:'LOCAL-SYNTHETIC-NON-CONTRACTUAL-TEST',p_adapter_registration_reference:'LOCAL-INSTALLED-DEVELOPMENT-MOCK',p_valid_hours:1,p_reason:'Simulation locale synthétique non contractuelle, sans accord juridique ni fournisseur réel',p_idempotency_key:randomUUID()});
 assert.equal(proposal.development_mock,true);assert.equal(proposal.environment,'DEVELOPMENT');
 fixture.resources.localCommercialSignatureProposals??=[];
 fixture.resources.localCommercialSignatureProposals.push(proposal.proposal_id);
 const decision={p_proposal_id:proposal.proposal_id,p_expected_content_hash:proposal.content_hash,p_approve:true,p_reason:'Contre-revue synthétique indépendante : simulation DEV seulement, aucune signature contractuelle réelle'};
 const denied=await reviewers.fr.client.rpc('decide_signature_policy_v1',decision);assert.equal(denied.error?.code,'42501');
 const approved=await command(fixture,reviewers.ar.client,'decide_signature_policy_v1',decision);
 assert.equal(approved.outcome,'SIGNATURE_POLICY_APPROVED');assert.equal(approved.development_mock,true);
 return{proposalId:proposal.proposal_id,policyVersionId:approved.policy_version_id,providerConfigId:config.id,providerCode:'MATRICIA_DEV_MOCK',environment:'DEVELOPMENT',level:'SIMPLE',contractualEvidence:false};
}

/** Always call before disabling fixture accounts, including on a lost HTTP response. */
export async function disableLinkedLocalSignaturePolicies(fixture){
 isolated(fixture);
 const reviewer=fixture.resources.localJourneyReviewers?.ar;
 for(const id of fixture.resources.localCommercialSignatureProposals??[]){
  const [decision]=await fixture.resources.database`select decision,policy_version_id from private.signature_policy_decisions_v1 where proposal_id=${id}::uuid`;
  if(decision?.decision!=='APPROVED')continue;
  assert.ok(reviewer);
  const result=await command(fixture,reviewer.client,'disable_signature_policy_v1',{p_proposal_id:id,p_reason:'Arrêt explicite de la simulation synthétique lors du nettoyage de recette locale'});
  assert.equal(result.outcome,'SIGNATURE_POLICY_DISABLED');
  const [proof]=await fixture.resources.database`select count(*)::int as count from private.signature_policy_revocations_v1 where proposal_id=${id}::uuid and policy_version_id=${decision.policy_version_id}::uuid`;
  assert.equal(proof.count,1);
 }
}

/** Real private bytes for an explicitly non-contractual DEV simulation. */
export async function uploadLinkedLocalArtifact(fixture,lines){
 isolated(fixture);
 if(!fixture.resources.localCommercialBucket){
  const bucket=`local-commercial-${fixture.manifest.runId}`;
  const existing=await fixture.resources.admin.storage.getBucket(bucket);
  assert.ok(existing.error,'LOCAL_COMMERCIAL_BUCKET_ALREADY_EXISTS');
  assert.equal(missingLocalFixtureBucket(existing.error),true,'LOCAL_COMMERCIAL_BUCKET_ABSENCE_UNCONFIRMED');
  fixture.resources.localCommercialBucket=bucket;
  const created=await fixture.resources.admin.storage.createBucket(bucket,{public:false,fileSizeLimit:10485760,allowedMimeTypes:['application/pdf']});assert.equal(created.error,null);
 }
 const bucket=fixture.resources.localCommercialBucket,path=`synthetic/${randomUUID()}.pdf`;
 const bytes=localFixturePdf(['NON-CONTRACTUAL DEVELOPMENT MOCK - SYNTHETIC LOCAL RECIPE',...lines]);
 fixture.resources.localCommercialArtifactPaths??=[];fixture.resources.localCommercialArtifactPaths.push(path);
 const uploaded=await fixture.resources.admin.storage.from(bucket).upload(path,bytes,{contentType:'application/pdf',upsert:false});assert.equal(uploaded.error,null);
 const downloaded=await fixture.resources.admin.storage.from(bucket).download(path);assert.equal(downloaded.error,null);assert.equal(hash(Buffer.from(await downloaded.data.arrayBuffer())),hash(bytes));
 const info=await fixture.resources.admin.storage.getBucket(bucket);assert.equal(info.error,null);assert.equal(info.data.public,false);
 return{bucket,path,sha256:hash(bytes),sizeBytes:bytes.length,contractualEvidence:false};
}

export async function clearLinkedLocalArtifacts(fixture){
 isolated(fixture);
 const bucket=fixture.resources.localCommercialBucket;if(!bucket)return;
 assert.equal(bucket,`local-commercial-${fixture.manifest.runId}`);
 const paths=fixture.resources.localCommercialArtifactPaths??[];
 assert.ok(paths.every(path=>/^synthetic\/[a-f0-9-]{36}\.pdf$/u.test(path)));
 if(paths.length){const result=await fixture.resources.admin.storage.from(bucket).remove(paths);assert.equal(result.error,null);}
 const removed=await fixture.resources.admin.storage.deleteBucket(bucket);assert.equal(removed.error,null);
 const remaining=await fixture.resources.admin.storage.getBucket(bucket);assert.ok(remaining.error);
}

export async function completeLinkedLocalMockSignature(fixture,{chain,provider,signaturePolicy}){
 isolated(fixture);
 assert.equal(signaturePolicy.environment,'DEVELOPMENT');assert.equal(signaturePolicy.contractualEvidence,false);
 const actor=fixture.resources.localJourneyActors[chain.locale];assert.equal(actor.organizationId,chain.clientOrganizationId);assert.equal(provider.organizationId,chain.providerOrganizationId);
 await requireRealLocalActorMfa(fixture,actor);await requireRealLocalActorMfa(fixture,provider);
 assert.equal(chain.canonicalPdfPairVerified,true);
 const pdf={path:chain.canonicalPdfs[chain.locale].path,sha256:chain.canonicalPdfs[chain.locale].sha256};
 const envelope=await command(fixture,actor.client,'create_signature_envelope',{p_contract_id:chain.contractId,p_contract_version_id:chain.contractVersionId,p_provider_code:'MATRICIA_DEV_MOCK',p_environment:'DEVELOPMENT',p_requested_level:'SIMPLE',p_document_file_name:'non-contractual-local-recipe.pdf',p_document_storage_path:pdf.path,p_document_sha256:pdf.sha256,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
 assert.ok(envelope.envelope_id);
 const [price]=await fixture.resources.database`select price_minor::text as amount,currency from public.contract_versions where id=${chain.contractVersionId}::uuid and contract_id=${chain.contractId}::uuid`;
 assert.ok(price);const signers=[];
 for(const [index,party]of [actor,provider].entries()){
  const user=await party.client.auth.getUser();assert.equal(user.error,null);assert.equal(user.data.user?.id,party.userId);assert.ok(user.data.user.email_confirmed_at);
  const role=index===0?'CLIENT_OWNER':'PROVIDER_OWNER';
  const signer=await command(fixture,actor.client,'add_signature_signer',{p_envelope_id:envelope.envelope_id,p_organization_id:party.organizationId,p_signer_user_id:party.userId,p_signer_role:role,p_email_hash:hash(user.data.user.email.trim().toLowerCase()),p_signing_order:index+1,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
  const authority=await uploadLinkedLocalArtifact(fixture,[`Synthetic authority for ${role}`,`User: ${party.userId}`,`Organization: ${party.organizationId}`,`Contract hash: ${chain.contractHash}`]);
  await command(fixture,party.client,'authorize_signature_signer',{p_signer_id:signer.signer_id,p_authority_type:'LEGAL_REPRESENTATIVE',p_authority_scope:['CONTRACT_SIGNATURE'],p_amount_ceiling_minor:price.amount,p_currency:price.currency,p_valid_from:new Date(Date.now()-86400_000).toISOString().slice(0,10),p_valid_until:new Date(Date.now()+86400_000).toISOString().slice(0,10),p_evidence_storage_path:authority.path,p_evidence_sha256:authority.sha256,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
  signers.push(signer.signer_id);
 }
 const readiness=await command(fixture,actor.client,'get_contract_signature_readiness_v1',{p_contract_id:chain.contractId});assert.equal(readiness.status,'READY_TO_SUBMIT');
 const current=await one(actor.client,'contracts','row_version',{id:chain.contractId});
 await command(fixture,actor.client,'submit_contract_for_signature',{p_contract_id:chain.contractId,p_expected_row_version:current.row_version,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
 for(const [index,step]of [{action:'SENT',signer:null},{action:'SIGNER_SIGNED',signer:signers[0]},{action:'SIGNER_SIGNED',signer:signers[1]}].entries()){
  const queued=await command(fixture,fixture.resources.localJourneyReviewers.fr.client,'request_signature_mock_step_v1',{p_envelope_id:envelope.envelope_id,p_action:step.action,p_signer_id:step.signer,p_idempotency_key:randomUUID()});
  assert.equal(queued.outcome,'SIGNATURE_SIMULATION_QUEUED');
  const result=await command(fixture,fixture.resources.admin,'execute_signature_mock_step_v1',{p_command_id:queued.command_id});
  if(index===1){assert.equal(result.outcome,'SIGNATURE_ENVELOPE_PARTIALLY_SIGNED');assert.equal((await one(actor.client,'contracts','status',{id:chain.contractId})).status,'PENDING_SIGNATURE');}
  if(index===2)assert.equal(result.outcome,'SIGNATURE_ENVELOPE_SIGNED');
 }
 assert.equal((await one(actor.client,'contracts','status',{id:chain.contractId})).status,'ACTIVE');
 const [proof]=await fixture.resources.database`select b.source_hash,b.pdf_sha256,b.policy_version_id,e.final_hash,(select count(*)::int from public.contract_signatures s where s.contract_version_id=b.contract_version_id and s.contract_hash=${chain.contractHash})signatures from private.contract_signature_bindings_v1 b join public.signature_evidence_packages e on e.envelope_id=b.envelope_id where b.envelope_id=${envelope.envelope_id}::uuid`;
 assert.equal(proof.source_hash,chain.contractHash);assert.equal(proof.pdf_sha256,pdf.sha256);assert.equal(proof.policy_version_id,signaturePolicy.policyVersionId);assert.equal(proof.signatures,2);assert.match(proof.final_hash,/^[a-f0-9]{64}$/u);
 fixture.resources.localCommercialFacts??=[];fixture.resources.localCommercialFacts.push({locale:chain.locale,stage:'GOVERNED_NON_CONTRACTUAL_DEV_SIGNATURE',sourceHash:chain.contractHash,pdfSha256:pdf.sha256,finalHash:proof.final_hash,nativeSignatureFacts:2,contractActiveVerified:true,contractualSignatureValidated:false});
 return{...chain,envelopeId:envelope.envelope_id,signatureFinalHash:proof.final_hash,pdfSha256:pdf.sha256,signatureMode:'GOVERNED_NON_CONTRACTUAL_DEVELOPMENT_MOCK',contractualSignatureValidated:false};
}

/** Native mission, authenticated private bytes, trusted known-fixture verdict and reception. */
export async function completeLinkedLocalMission(fixture,{chain,provider,checklist}){
 isolated(fixture);
 const actor=fixture.resources.localJourneyActors[chain.locale],foreign=fixture.resources.localJourneyActors[chain.locale==='fr'?'ar':'fr'];
 assert.equal(actor.organizationId,chain.clientOrganizationId);assert.equal(provider.organizationId,chain.providerOrganizationId);
 assert.equal(chain.signatureMode,'GOVERNED_NON_CONTRACTUAL_DEVELOPMENT_MOCK');
 const labelFr=`Rapport synthétique ${chain.sessionId.slice(0,8)}`,labelAr=`تقرير اصطناعي ${chain.sessionId.slice(0,8)}`;
 const input={p_contract_id:chain.contractId,p_contract_version_id:chain.contractVersionId,p_milestones:[{key:'DELIVERY',title_fr:'Livraison de recette',title_ar:'تسليم الاختبار',sort_order:1,due_at:new Date(Date.now()+7*86400_000).toISOString(),owner_organization_id:provider.organizationId,validation_required:true}],p_deliverables:[{key:'REPORT',milestone_key:'DELIVERY',label_fr:labelFr,label_ar:labelAr,proof_required:true}],p_acceptance_criteria:[{deliverable_key:'REPORT',criterion_key:'QUALITY'}],p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
 const mission=await command(fixture,actor.client,'create_mission',input);assert.equal(mission.outcome,'MISSION_CREATED');assert.equal(mission.checklist_template_id,checklist.templateId);
 assert.deepEqual(await command(fixture,actor.client,'create_mission',input),mission);
 const milestone=await one(provider.client,'mission_milestones','id,row_version',{mission_id:mission.mission_id,milestone_key:'DELIVERY'});
 const deliverable=await one(provider.client,'deliverables','id,milestone_id',{mission_id:mission.mission_id,deliverable_key:'REPORT'});
 assert.equal(deliverable.milestone_id,milestone.id,'LOCAL_COMMERCIAL_MILESTONE_LINK_REQUIRED');
 const checklistItem=await one(provider.client,'mission_checklist_items','id,status',{mission_id:mission.mission_id,item_key:'QUALITY'});assert.equal(checklistItem.status,'PENDING');
 const bytes=localFixturePdf(['SYNTHETIC LOCAL DELIVERY - NOT A CLIENT DOCUMENT',`Contract ${chain.contractId}`,`Mission ${mission.mission_id}`,`Diagnostic session ${chain.sessionId}`]);
 const deliveryKey=randomUUID(),path=`${provider.userId}/${deliverable.id}/${deliveryKey}/synthetic-report.pdf`,expectedSha=hash(bytes);
 fixture.resources.localCommercialDeliveryPaths??=[];fixture.resources.localCommercialDeliveryPaths.push({path,userId:provider.userId,deliverableId:deliverable.id});
 const upload=await provider.client.storage.from('delivery-proofs').upload(path,bytes,{contentType:'application/pdf',upsert:false});assert.equal(upload.error,null);
 const ownBytes=await provider.client.storage.from('delivery-proofs').download(path);assert.equal(ownBytes.error,null);assert.equal(hash(Buffer.from(await ownBytes.data.arrayBuffer())),expectedSha);
 const deliveryInput={p_deliverable_id:deliverable.id,p_description:'Livraison synthétique de recette persistée par la vraie commande',p_links:[],p_proofs:[{type:'DOCUMENT',storage_path:path,url:null,evidence_hash:expectedSha,metadata:{note:'Known synthetic fixture bytes only; no external malware certification',original_file_name:'synthetic-report.pdf',mime_type:'application/pdf',size_bytes:bytes.length,upload_binding_version:1}}],p_idempotency_key:deliveryKey,p_correlation_id:randomUUID()};
 const submitted=await command(fixture,provider.client,'submit_delivery',deliveryInput);assert.equal(submitted.outcome,'DELIVERY_SUBMITTED');assert.deepEqual(await command(fixture,provider.client,'submit_delivery',deliveryInput),submitted);
 const proof=await one(provider.client,'delivery_proofs','id,scan_status,evidence_hash',{delivery_version_id:submitted.delivery_version_id,storage_path:path});assert.equal(proof.scan_status,'PENDING');assert.equal(proof.evidence_hash,expectedSha);
 const acceptInput={p_deliverable_id:deliverable.id,p_decisions:[{criterion_key:'QUALITY',status:'COMPLIANT',comment:'Octets synthétiques attendus vérifiés pendant la recette locale',evidence:[]}],p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
 const beforeScan=await actor.client.rpc('accept_delivery',acceptInput);assert.equal(beforeScan.error?.code,'55000');
 const foreignAccept=await foreign.client.rpc('accept_delivery',{...acceptInput,p_idempotency_key:randomUUID()});assert.equal(foreignAccept.error?.code,'42501');
 const foreignDownload=await foreign.client.storage.from('delivery-proofs').download(path);assert.ok(foreignDownload.error);
 const publicUrl=fixture.resources.admin.storage.from('delivery-proofs').getPublicUrl(path).data.publicUrl;
 const publicResult=await fetch(publicUrl,{redirect:'error'});assert.ok(publicResult.status>=400&&publicResult.status<500);
 const scanned=await command(fixture,fixture.resources.admin,'record_delivery_proof_scan_result',{p_proof_id:proof.id,p_result:'CLEAN',p_engine_code:'LOCAL_KNOWN_FIXTURE_PDF',p_engine_version:'1',p_computed_sha256:expectedSha,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});assert.equal(scanned.outcome,'DELIVERY_PROOF_SCAN_RECORDED');assert.equal(scanned.result,'CLEAN');
 const clientBytes=await actor.client.storage.from('delivery-proofs').download(path);assert.equal(clientBytes.error,null);assert.equal(hash(Buffer.from(await clientBytes.data.arrayBuffer())),expectedSha);
 const foreignCleanDownload=await foreign.client.storage.from('delivery-proofs').download(path);assert.ok(foreignCleanDownload.error);
 const foreignRows=await foreign.client.from('delivery_proofs').select('id').eq('id',proof.id);assert.equal(foreignRows.error,null);assert.equal(foreignRows.data?.length,0);
 const itemInput={p_item_id:checklistItem.id,p_expected_status:'PENDING',p_proof_id:proof.id,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
 const itemCompleted=await command(fixture,provider.client,'complete_mission_checklist_item',itemInput);assert.equal(itemCompleted.outcome,'MISSION_CHECKLIST_ITEM_COMPLETED');assert.deepEqual(await command(fixture,provider.client,'complete_mission_checklist_item',itemInput),itemCompleted);
 const milestoneInput={p_milestone_id:milestone.id,p_expected_row_version:milestone.row_version,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
 const milestoneSubmitted=await command(fixture,provider.client,'submit_mission_milestone',milestoneInput);assert.equal(milestoneSubmitted.outcome,'MILESTONE_SUBMITTED');assert.deepEqual(await command(fixture,provider.client,'submit_mission_milestone',milestoneInput),milestoneSubmitted);
 const acceptance=await command(fixture,actor.client,'accept_delivery',acceptInput);assert.equal(acceptance.outcome,'DELIVERY_ACCEPTED');assert.deepEqual(await command(fixture,actor.client,'accept_delivery',acceptInput),acceptance);
 const milestoneDecision={p_milestone_id:milestone.id,p_expected_row_version:milestoneSubmitted.row_version,p_decision:'ACCEPTED',p_reason:'Réception explicite du rapport synthétique de recette locale',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
 const decided=await command(fixture,actor.client,'decide_mission_milestone',milestoneDecision);assert.equal(decided.outcome,'MILESTONE_ACCEPTED');assert.deepEqual(await command(fixture,actor.client,'decide_mission_milestone',milestoneDecision),decided);
 const accepted=await one(actor.client,'deliverables','status',{id:deliverable.id});assert.equal(accepted.status,'ACCEPTED');
 const events=await fixture.resources.database`select a.action,e.event_type,a.metadata->>'outcome'as audit_outcome,e.payload->>'outcome'as event_outcome from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.correlation_id=any(${[input.p_correlation_id,deliveryInput.p_correlation_id,itemInput.p_correlation_id,milestoneInput.p_correlation_id,acceptInput.p_correlation_id,milestoneDecision.p_correlation_id]}::uuid[])and a.event_hash<>repeat('0',64)group by a.action,e.event_type,a.metadata->>'outcome',e.payload->>'outcome'`;
 const expectedEvents=[['mission.created','MissionCreatedV1'],['delivery.submitted','DeliverySubmittedV1'],['mission.checklist_item.completed','MissionChecklistItemCompletedV1'],['mission.milestone.submitted','MissionMilestoneSubmittedV1'],['delivery.decided','DeliveryAcceptedV1'],['mission.milestone.decided','MissionMilestoneAcceptedV1']];
 for(const[action,eventType]of expectedEvents)assert.ok(events.some(event=>event.action===action&&event.event_type===eventType&&(action!=='delivery.decided'||event.audit_outcome==='DELIVERY_ACCEPTED'&&event.event_outcome==='DELIVERY_ACCEPTED')),`LOCAL_COMMERCIAL_MISSING_${action.toUpperCase().replaceAll('.','_')}`);
 return{...chain,missionId:mission.mission_id,milestoneId:milestone.id,deliverableId:deliverable.id,deliveryVersionId:submitted.delivery_version_id,proofId:proof.id,deliverySha256:expectedSha,deliveryLabel:chain.locale==='fr'?labelFr:labelAr,deliveryAccepted:true,milestoneAccepted:true,malwareEngineExternal:false,scope:'LOCAL_NATIVE_DIAGNOSTIC_TO_ACCEPTED_DELIVERY'};
}

export async function clearLinkedLocalDeliveryFiles(fixture){
 isolated(fixture);
 const files=fixture.resources.localCommercialDeliveryPaths??[];
 for(const file of files){assert.ok(fixture.resources.userIds.includes(file.userId));assert.ok(file.path.startsWith(`${file.userId}/${file.deliverableId}/`));}
 let retained=0;
 for(const file of files){
  const [binding]=await fixture.resources.database`select p.evidence_hash from public.delivery_proofs p join public.delivery_versions v on v.id=p.delivery_version_id where p.storage_bucket='delivery-proofs'and p.storage_path=${file.path} and v.deliverable_id=${file.deliverableId}::uuid`;
  if(binding){const read=await fixture.resources.admin.storage.from('delivery-proofs').download(file.path);assert.equal(read.error,null);assert.equal(hash(Buffer.from(await read.data.arrayBuffer())),binding.evidence_hash);retained++;}
  else{const result=await fixture.resources.admin.storage.from('delivery-proofs').remove([file.path]);assert.equal(result.error,null);const missing=await fixture.resources.admin.storage.from('delivery-proofs').download(file.path);assert.ok(missing.error);}
 }
 fixture.resources.localCommercialRetainedDeliveryFiles=retained;
}

/** After business/UI acceptance, probe native Storage retention and revoked-party isolation. */
export async function verifyLinkedLocalBoundStorageGuards(fixture,{chains,provider}){
 isolated(fixture);
 for(const chain of Object.values(chains)){
  const [proof]=await fixture.resources.database`select p.storage_path,o.id as object_id from public.delivery_proofs p join storage.objects o on o.bucket_id=p.storage_bucket and o.name=p.storage_path where p.id=${chain.proofId}::uuid and p.storage_bucket='delivery-proofs'`;
  assert.ok(proof);
  const rejected=await fixture.resources.admin.storage.from('delivery-proofs').remove([proof.storage_path]);
  const storageCode=rejected.error?.code,storageStatus=Number(rejected.error?.statusCode??rejected.error?.status);
  fixture.resources.localCommercialStorageDiagnostic={operation:'BOUND_STORAGE_DELETE',status:Number.isInteger(storageStatus)?storageStatus:null,code:typeof storageCode==='string'&&/^[A-Za-z0-9_]{1,64}$/u.test(storageCode)?storageCode:null,foreignKeyMentioned:/23503|delivery_proofs_storage_object_binding_v1|foreign key/iu.test(rejected.error?.message??'')};
  assert.ok(rejected.error,'BOUND_STORAGE_API_DELETE_MUST_BE_DENIED');
  assert.ok(/23503|delivery_proofs_storage_object_binding_v1|foreign key/iu.test(rejected.error.message),'BOUND_STORAGE_API_FOREIGN_KEY_DENIAL_REQUIRED');
  const read=await fixture.resources.admin.storage.from('delivery-proofs').download(proof.storage_path);assert.equal(read.error,null);assert.equal(hash(Buffer.from(await read.data.arrayBuffer())),chain.deliverySha256);
  const [same]=await fixture.resources.database`select id from storage.objects where bucket_id='delivery-proofs'and name=${proof.storage_path}`;assert.equal(same.id,proof.object_id);
 }
 // A declared fixture-only permission restriction, separate from the completed
 // commercial commands. No Admin approval or business decision is invented.
 assert.ok(fixture.resources.organizationIds.includes(provider.organizationId));assert.ok(fixture.resources.userIds.includes(provider.userId));
 const changed=await fixture.resources.database`update public.organization_memberships set status='REVOKED',updated_at=clock_timestamp()where organization_id=${provider.organizationId}::uuid and user_id=${provider.userId}::uuid and status='ACTIVE'returning id`;
 assert.equal(changed.length,1);
 const user=await provider.client.auth.getUser();assert.equal(user.error,null);assert.equal(user.data.user?.id,provider.userId);
 for(const chain of Object.values(chains)){
  const [proof]=await fixture.resources.database`select storage_path from public.delivery_proofs where id=${chain.proofId}::uuid`;
  const hidden=await provider.client.from('delivery_proofs').select('id').eq('id',chain.proofId);assert.equal(hidden.error,null);assert.equal(hidden.data.length,0);
  const denied=await provider.client.storage.from('delivery-proofs').download(proof.storage_path);assert.ok(denied.error);
  const client=fixture.resources.localJourneyActors[chain.locale].client,read=await client.storage.from('delivery-proofs').download(proof.storage_path);assert.equal(read.error,null);assert.equal(hash(Buffer.from(await read.data.arrayBuffer())),chain.deliverySha256);
 }
 fixture.resources.localCommercialStorageDiagnostic.completed=true;
 return{nativeBoundStorageApiDeleteDenied:true,nativeBoundStorageApiBytesPreserved:true,revokedProviderProofHidden:true,revokedProviderPrivateDownloadDenied:true,remainingClientPrivateDownloadPreserved:true,membershipRevocationIsPrivilegedFixtureRestriction:true};
}

/**
 * Continues an actually converted Client6 opportunity through real RFQ, quote,
 * selection and canonical contract commands. The provider qualification and
 * validated tax reference are explicit inputs, prepared separately. Importing
 * this module performs no mutation; it is not a successful acceptance runner.
 */
export async function createLinkedLocalContract(fixture,{locale,clientCase,provider,policies,taxRuleVersionId}){
 isolated(fixture);
 const actor=fixture.resources.localJourneyActors?.[locale];assert.ok(actor);
 assert.equal(actor.organizationId,clientCase.organizationId);
 assert.ok(fixture.resources.organizationIds.includes(provider.organizationId));
 assert.ok(fixture.resources.userIds.includes(provider.userId));
 const source=await fixture.resources.database`select request.id,request.row_version from public.diagnostic_runs diagnostic join public.diagnostic_opportunities opportunity on opportunity.diagnostic_run_id=diagnostic.id join public.service_requests request on request.id=opportunity.service_request_id where diagnostic.questionnaire_session_id=${clientCase.sessionId}::uuid and diagnostic.organization_id=${actor.organizationId}::uuid and opportunity.status='CONVERTED'and request.client_organization_id=${actor.organizationId}::uuid`;
 assert.equal(source.length,1);const requestId=source[0].id;
 const ready=await command(fixture,actor.client,'mark_service_request_ready',{p_request_id:requestId,p_expected_row_version:source[0].row_version,p_change_reason:'Préparation réelle de la demande issue du diagnostic local',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
 assert.equal(ready.request_id,requestId);
 const [fiscal]=await fixture.resources.database`select v.required_quote_data from public.service_requests r join public.service_request_versions v on v.id=r.current_version_id where r.id=${requestId}::uuid and r.client_organization_id=${actor.organizationId}::uuid`;
 assert.equal(fiscal.required_quote_data.tax_category_code,provider.taxCategoryCode);assert.equal(fiscal.required_quote_data.tax_category_policy_snapshot.mapping_id,fixture.resources.localCommercialFiscalMappingId);assert.equal(fiscal.required_quote_data.tax_category_policy_snapshot.development_only,true);
 const matched=await command(fixture,actor.client,'run_service_request_matching',{p_request_id:requestId,p_policy_version:'MATCH-V1',p_target_panel_size:1,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
 assert.ok(matched.matching_run_id);
 const openInput={p_request_id:requestId,p_matching_run_id:matched.matching_run_id,p_deadline:new Date(Date.now()+7*86400_000).toISOString(),p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
 const initialAssurance=await actor.client.auth.mfa.getAuthenticatorAssuranceLevel();assert.equal(initialAssurance.error,null);assert.equal(initialAssurance.data.currentLevel,'aal1');
 const deniedOpen=await actor.client.rpc('open_service_request_rfq',openInput);assert.equal(deniedOpen.error?.code,'42501');
 await requireRealLocalActorMfa(fixture,actor);
 const opened=await command(fixture,actor.client,'open_service_request_rfq',openInput);
 assert.ok(opened.rfq_id);
 const invitation=await one(provider.client,'rfq_providers','id,row_version',{rfq_id:opened.rfq_id,provider_organization_id:provider.organizationId});
 const invitationInput={p_rfq_provider_id:invitation.id,p_decision:'ACCEPT',p_reason:null,p_expected_row_version:invitation.row_version,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
 const accepted=await command(fixture,provider.client,'respond_to_rfq_invitation',invitationInput);
 assert.deepEqual(await command(fixture,provider.client,'respond_to_rfq_invitation',invitationInput),accepted);
 const payload={currency:'MAD',solution_fr:'Solution synthétique liée au vrai diagnostic local',solution_ar:'حل اصطناعي مرتبط بالتشخيص المحلي',deliverables:['Rapport synthétique de recette'],inclusions:[],exclusions:[],prerequisites:[],warranty_fr:'Garantie de recette uniquement',warranty_ar:'ضمان اختبار فقط',correction_terms_fr:'Corrections synthétiques incluses',correction_terms_ar:'تصحيحات الاختبار مشمولة',sla:{},proposed_start_date:new Date(Date.now()+86400_000).toISOString().slice(0,10),duration_days:'10',valid_until:new Date(Date.now()+30*86400_000).toISOString(),items:[{line_number:'1',item_kind:'ONE_TIME',label_fr:'Forfait de recette locale',label_ar:'حزمة الاختبار المحلي',quantity:'1',unit_code:'FORFAIT',unit_price_minor:'10000',tax_rule_version_id:taxRuleVersionId,recurrence_interval:''}],options:[],expected_current_version_id:null};
 const quote=await command(fixture,provider.client,'create_quote_revision',{p_rfq_provider_id:invitation.id,p_payload:payload,p_change_reason:'Devis réel de recette locale lié au diagnostic',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
 assert.ok(quote.quote_id&&quote.quote_version_id);
 const identity=await command(fixture,provider.client,'get_my_provider_identity_status_v1',{p_provider_organization_id:provider.organizationId});
 assert.match(identity.identity_hash,/^[a-f0-9]{64}$/u);
 await command(fixture,provider.client,'submit_provider_quote_with_identity_v1',{p_quote_id:quote.quote_id,p_expected_version_id:quote.quote_version_id,p_expected_identity_hash:identity.identity_hash,p_registered_address:'Adresse synthétique du prestataire pour recette locale uniquement',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
 const comparison=await command(fixture,actor.client,'compare_quotes',{p_rfq_id:opened.rfq_id,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
 assert.ok(comparison.comparison_snapshot_id);
 const selection={p_quote_id:quote.quote_id,p_expected_version_id:quote.quote_version_id,p_selection_reason:'Sélection explicite du devis synthétique pour recette locale',p_comparison_snapshot_id:comparison.comparison_snapshot_id,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
 const assurance=await actor.client.auth.mfa.getAuthenticatorAssuranceLevel();assert.equal(assurance.error,null);assert.equal(assurance.data.currentLevel,'aal2');
 await command(fixture,actor.client,'select_quote_and_notify',selection);
 const request=await one(actor.client,'service_requests','row_version',{id:requestId,client_organization_id:actor.organizationId});
 const contractInput={p_request_id:requestId,p_quote_version_id:quote.quote_version_id,p_expected_request_row_version:request.row_version,p_template_version_id:policies.template,p_commission_policy_version_id:policies.commission,p_reason:'Génération canonique réelle de recette locale, sans approbation juridique client',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
 const contract=await command(fixture,actor.client,'generate_selected_quote_contract_v1',contractInput);
 assert.equal(contract.outcome,'SELECTED_QUOTE_CONTRACT_DRAFTED');
 assert.deepEqual(await command(fixture,actor.client,'generate_selected_quote_contract_v1',contractInput),contract);
 const version=await one(actor.client,'contract_versions','id,contract_id,content_hash,selected_quote_version_id',{id:contract.contract_version_id,contract_id:contract.contract_id});
 assert.equal(version.selected_quote_version_id,quote.quote_version_id);assert.equal(version.content_hash,contract.content_hash);
 return{locale,requestId,sessionId:clientCase.sessionId,rfqId:opened.rfq_id,invitationId:invitation.id,quoteId:quote.quote_id,quoteVersionId:quote.quote_version_id,comparisonSnapshotId:comparison.comparison_snapshot_id,contractId:contract.contract_id,contractVersionId:version.id,contractHash:version.content_hash,providerOrganizationId:provider.organizationId,clientOrganizationId:actor.organizationId,identityHash:identity.identity_hash,templatePolicyId:policies.template,commissionPolicyId:policies.commission,scope:'LOCAL_NATIVE_COMMANDS_THROUGH_CANONICAL_DRAFT_ONLY',chainHash:hash(JSON.stringify({sessionId:clientCase.sessionId,requestId,quoteVersionId:quote.quote_version_id,contractVersionId:version.id}))};
}
