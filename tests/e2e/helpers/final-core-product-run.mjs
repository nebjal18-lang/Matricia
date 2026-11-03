import { runSecuredBrowserSuite, writeLocalSuiteEvidence } from "./secured-browser-runner.mjs";
import { localFixturePdf } from './local-fixture-pdf.mjs';
import { closePendingLocalProviderScans } from './local-provider-identity-fixture.mjs';
import { provisionLocalCatalogReference, neutralizeLocalCatalogReference } from "./local-catalog-reference.mjs";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSafeConfiguration } from "../../../scripts/p05-e2e/environment.mjs";
import { provision } from "../../../scripts/p05-e2e/provision.mjs";
import { buildChildEnvironment, secureLocalPaths, validateFreshManifest } from "../../../scripts/p05-e2e/security.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const runId = randomUUID();
const directory = resolve(root, "artifacts", "test-results", `final-core-product-${runId}`);
const manifestPath = resolve(directory, "manifest.json");
const output = resolve(directory, "playwright");
const sharedAuthDirectory = resolve(root, "scripts", "p05-e2e", ".auth");
const evidencePath = resolve(root, "docs", "evidence", "final-core-product-020-last-run.json");
const hash = (value) => createHash("sha256").update(`${runId}:${value}`).digest("hex");
let base; let created; let failure; let evidence; let cleanupFailed=false; let config; let suiteSummary;
const knownPdf=localFixturePdf(['SYNTHETIC LOCAL PROVIDER QUALIFICATION FIXTURE','NOT AN OFFICIAL DOCUMENT']);
const knownPdfHash=createHash("sha256").update(knownPdf).digest("hex");

function sanitizedPlaywrightFailure(value) {
  const queue=[value],messages=[];
  while(queue.length>0){const current=queue.shift();if(Array.isArray(current)){queue.push(...current);continue;}if(!current||typeof current!=="object")continue;if(typeof current.message==="string"&&current.message.trim())messages.push(current.message);queue.push(...Object.values(current));}
  const message=messages.find((item)=>/locator|expect\(|waiting for|Timeout.*exceeded/iu.test(item)&&!/browserContext\.close/iu.test(item))??messages.sort((left,right)=>right.length-left.length)[0];
  return message?message.replace(/eyJ[A-Za-z0-9._-]+/gu,"[redacted-token]").replace(/(?:postgres(?:ql)?|https?):\/\/\S+/giu,"[redacted-endpoint]").replace(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/giu,"[redacted-id]").replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu,"[redacted-email]").slice(0,1200):"no sanitized Playwright diagnostic available";
}

async function createFixture(fixture) {
  const database = fixture.resources.database;
  const baseRun = fixture.manifest.runId;
  const [client] = await database`select id from auth.users where email=${`p05-e2e-clienta-${baseRun}@example.invalid`}`;
  const [providerUser] = await database`select id from auth.users where email=${`p05-e2e-norole-${baseRun}@example.invalid`}`;
  if (!client?.id) throw new Error("Final core fixture client identity is unavailable");
  if (!providerUser?.id) throw new Error("Final core fixture provider identity is unavailable");
  const [catalog] = await database`select service.id as service_id,service.library_id,version.name_fr as service_label_fr,library.current_release_id as catalog_release_id
    from public.catalog_services service join public.catalog_service_versions version on version.id=service.current_published_version_id and version.status='PUBLISHED'
    join public.catalog_libraries library on library.id=service.library_id and library.status='PUBLISHED' and library.current_published_version_id is not null
    join public.catalog_subcategories category on category.id=service.primary_subcategory_id and category.status='PUBLISHED' and category.current_published_version_id is not null
    where service.status='PUBLISHED' and library.current_release_id is not null and (${fixture.resources.localCatalog?.service??null}::uuid is null or service.id=${fixture.resources.localCatalog?.service??null}::uuid) order by service.code limit 1`;
  if (!catalog) throw new Error("Final core fixture requires one published catalog service with a current release");
  const ids = Object.fromEntries(["request","requestVersion","matchingRun","matchingRunPrevious","candidatePrevious","rfq","thread","clientParticipant","providerParticipant","message","snapshot","capacityProvider","capacityMembership","capacityProviderService","capacityQualification","capacityDecision","capacitySession","capacityCompanyDecision","capacityQuestionnaire","capacityQuestionnaireVersion",...Array.from({length:3},(_,index)=>`provider${index}`),...Array.from({length:3},(_,index)=>`candidate${index}`),...Array.from({length:3},(_,index)=>`invitation${index}`),...Array.from({length:3},(_,index)=>`quote${index}`),...Array.from({length:3},(_,index)=>`quoteVersion${index}`),...Array.from({length:3},(_,index)=>`capacityDocumentFamily${index}`),...Array.from({length:3},(_,index)=>`capacityDocumentVersion${index}`)].map((key)=>[key,randomUUID()]));
  const clientOrganizationId = fixture.manifest.fixtures.organizationA.id;
  const subject = `Clarification finale ${runId.slice(0,8)}`;
  const message = `Message dossier isolé ${runId.slice(0,8)}`;
  const foreignMarker = `FOREIGN-${runId.slice(0,8)}`;
  const validUntil = new Date(Date.now()+30*24*60*60*1000).toISOString();
  const rows=[];
  fixture.resources.organizationIds.push(ids.provider0,ids.provider1,ids.provider2,ids.capacityProvider);
  fixture.resources.localFinalPdfPaths=[];
  await database.begin(async(transaction)=>{
    await transaction.unsafe("set local session_replication_role=replica");
    for(let index=0;index<3;index+=1){
      await transaction`insert into public.organizations(id,legal_name,display_name,status,created_by)values(${ids[`provider${index}`]}::uuid,${`Final Provider ${index} ${runId}`},${`P05 E2E Final Provider ${index} ${runId}`},'ACTIVE',${client.id}::uuid)`;
    }
    await transaction`insert into public.organizations(id,legal_name,display_name,status,created_by)values(${ids.capacityProvider}::uuid,${`P05 E2E Capacity Provider ${runId}`},${`P05 E2E Capacity Provider ${runId}`},'ACTIVE',${providerUser.id}::uuid)`;
    if(fixture.config.runtimeMode==='isolated-local-docker'){
      const ice=(BigInt(`0x${hash('provider-ice').slice(0,14)}`)%1_000_000_000_000_000n).toString().padStart(15,'0');
      const fiscal=(BigInt(`0x${hash('provider-if').slice(0,10)}`)%100_000_000n).toString().padStart(8,'0');
      await transaction`insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status,is_active)values(${ids.capacityProvider}::uuid,'ICE',${ice},'PENDING',true),(${ids.capacityProvider}::uuid,'IF',${fiscal},'PENDING',true),(${ids.capacityProvider}::uuid,'RC',${`E2E${runId.replaceAll('-','').slice(0,16)}`},'PENDING',true)`;
    }
    await transaction`insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values(${ids.capacityMembership}::uuid,${ids.capacityProvider}::uuid,${providerUser.id}::uuid,'ACTIVE',clock_timestamp())`;
    await transaction`insert into public.organization_member_roles(membership_id,role_code,granted_by)values(${ids.capacityMembership}::uuid,'PROVIDER_OWNER',${providerUser.id}::uuid)`;
    await transaction`insert into public.provider_profiles(provider_organization_id,company_status,overall_status,activity_summary,team_size,years_experience,secondary_subcontracting_allowed,accounting_contact_email,partner_contract_status,created_by)values(${ids.capacityProvider}::uuid,'VERIFIED','ACTIVE','Prestation de qualification E2E contrôlée',4,6,false,null,'SIGNED',${providerUser.id}::uuid)`;
    await transaction`insert into public.provider_company_decisions(id,provider_organization_id,decision_version,company_status,partner_contract_status,reason,rule_version,decided_by,correlation_id)values(${ids.capacityCompanyDecision}::uuid,${ids.capacityProvider}::uuid,1,'VERIFIED','SIGNED','Fixture humaine TEST','E2E-COMPANY-V1',${providerUser.id}::uuid,${randomUUID()}::uuid)`;
    await transaction`insert into public.provider_match_profiles(provider_organization_id,company_verified,documents_valid,financial_status,quality_status,capacity_status,region_codes,partner_contract_signed)values(${ids.capacityProvider}::uuid,true,true,'OK','OK','PAUSED',array['MA-CAS'],'true')`;
    await transaction`insert into public.provider_services(id,provider_organization_id,service_id,request_status,requested_by,requested_at)values(${ids.capacityProviderService}::uuid,${ids.capacityProvider}::uuid,${catalog.service_id}::uuid,'DECIDED',${providerUser.id}::uuid,clock_timestamp())`;
    await transaction`insert into public.provider_service_match_profiles(provider_organization_id,service_id,qualification_status,required_certifications_valid,service_fit_score,quality_score,historical_delay_score,experience_score,satisfaction_score)values(${ids.capacityProvider}::uuid,${catalog.service_id}::uuid,'APPROVED',true,95,92,90,91,93)`;
    await transaction`insert into public.questionnaires(id,library_id,code,status,created_by)values(${ids.capacityQuestionnaire}::uuid,${catalog.library_id}::uuid,${`E2E_PROVIDER_${runId.replaceAll("-","").slice(0,12).toUpperCase()}`},'DRAFT',${providerUser.id}::uuid)`;
    await transaction`insert into public.questionnaire_versions(id,questionnaire_id,library_id,catalog_release_id,version,status,title_fr,title_ar,description_fr,description_ar,audience,engine_version,policy_version,snapshot_hash,sensitive,change_reason,created_by)values(${ids.capacityQuestionnaireVersion}::uuid,${ids.capacityQuestionnaire}::uuid,${catalog.library_id}::uuid,${catalog.catalog_release_id}::uuid,1,'DRAFT','Qualification capacité E2E','تأهيل القدرة للاختبار','Version fournisseur limitée à la preuve TEST','نسخة مقدم خدمة مخصصة لاختبار الإثبات','PROVIDER','E2E-1','E2E-1',${hash("capacity-questionnaire-version")},false,'Fixture MAT-FUNC-020',${providerUser.id}::uuid)`;
    await transaction`update public.questionnaires set current_draft_version_id=${ids.capacityQuestionnaireVersion}::uuid where id=${ids.capacityQuestionnaire}::uuid`;
    await transaction`insert into public.questionnaire_sessions(id,organization_id,actor_user_id,library_id,catalog_release_id,questionnaire_version_id,audience,locale,status,is_simulation,submitted_at,answer_manifest,answer_manifest_hash)values(${ids.capacitySession}::uuid,${ids.capacityProvider}::uuid,${providerUser.id}::uuid,${catalog.library_id}::uuid,${catalog.catalog_release_id}::uuid,${ids.capacityQuestionnaireVersion}::uuid,'PROVIDER','fr-MA','SUBMITTED',false,clock_timestamp(),${transaction.json({fixture:"MAT-FUNC-020"})},${hash("capacity-questionnaire")})`;
    await transaction`insert into public.provider_qualifications(id,provider_service_id,provider_organization_id,service_id)values(${ids.capacityQualification}::uuid,${ids.capacityProviderService}::uuid,${ids.capacityProvider}::uuid,${catalog.service_id}::uuid)`;
    await transaction`insert into public.provider_qualification_decisions(id,qualification_id,provider_organization_id,service_id,decision_version,status,questionnaire_version_id,questionnaire_session_id,score_basis_points,mandatory_checks,blocking_conditions,rationale,rule_version,decided_by,correlation_id)values(${ids.capacityDecision}::uuid,${ids.capacityQualification}::uuid,${ids.capacityProvider}::uuid,${catalog.service_id}::uuid,1,'APPROVED',${ids.capacityQuestionnaireVersion}::uuid,${ids.capacitySession}::uuid,9200,${transaction.json([{code:"E2E_CHECK",passed:true}])},'[]'::jsonb,'Qualification humaine TEST','E2E-QUAL-V1',${providerUser.id}::uuid,${randomUUID()}::uuid)`;
    await transaction`update public.provider_qualifications set current_decision_id=${ids.capacityDecision}::uuid where id=${ids.capacityQualification}::uuid`;
    for (const [index, kind] of ["LEGAL","FISCAL","INSURANCE"].entries()) {
      await transaction`insert into public.provider_document_families(id,provider_organization_id,document_kind,code,created_by)values(${ids[`capacityDocumentFamily${index}`]}::uuid,${ids.capacityProvider}::uuid,${kind},${`E2E_${kind}`},${providerUser.id}::uuid)`;
      await transaction`insert into public.provider_document_versions(id,family_id,provider_organization_id,version_number,status,storage_object_path,content_hash,change_reason,submitted_by,reviewed_by,reviewed_at)values(${ids[`capacityDocumentVersion${index}`]}::uuid,${ids[`capacityDocumentFamily${index}`]}::uuid,${ids.capacityProvider}::uuid,1,'VERIFIED',${`test-only/${ids.capacityProvider}/${kind.toLowerCase()}.pdf`},${knownPdfHash},'Fixture TEST vérifiée',${providerUser.id}::uuid,${providerUser.id}::uuid,clock_timestamp())`;
    }
    await transaction`insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by)values(${ids.request}::uuid,${clientOrganizationId}::uuid,${catalog.library_id}::uuid,${catalog.service_id}::uuid,'CLIENT_REVIEW',${client.id}::uuid)`;
    await transaction`insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,currency_code,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)values(${ids.requestVersion}::uuid,${ids.request}::uuid,${clientOrganizationId}::uuid,${catalog.library_id}::uuid,1,${`Comparaison finale ${runId.slice(0,8)}`},'NORMAL','MAD',${transaction.json({})},true,${hash("catalog")},${hash("questionnaire")},'Fixture E2E finale',${hash("request")},${client.id}::uuid)`;
    await transaction`update public.service_requests set current_version_id=${ids.requestVersion}::uuid where id=${ids.request}::uuid`;
    await transaction`insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,started_at,completed_at)values(${ids.matchingRunPrevious}::uuid,${ids.request}::uuid,${ids.requestVersion}::uuid,'MATCH-V1','NO_CANDIDATE',3,${client.id}::uuid,clock_timestamp()-interval'1 day',clock_timestamp()-interval'1 day')`;
    await transaction`insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,exclusion_reasons,score_basis_points,score_explanation,rotation_component)values(${ids.candidatePrevious}::uuid,${ids.matchingRunPrevious}::uuid,${ids.provider0}::uuid,false,array['CAPACITY_UNAVAILABLE'],0,${transaction.json({policy_version:"MATCH-V1",availability:{value:0,weight:15},exclusion_reasons:["CAPACITY_UNAVAILABLE"]})},0)`;
    await transaction`insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at)values(${ids.matchingRun}::uuid,${ids.request}::uuid,${ids.requestVersion}::uuid,'MATCH-V1','COMPLETED',3,${client.id}::uuid,clock_timestamp())`;
    for(let index=0;index<3;index+=1){
      await transaction`insert into public.matching_candidates(id,matching_run_id,provider_organization_id,eligible,score_basis_points,score_explanation,rotation_component)values(${ids[`candidate${index}`]}::uuid,${ids.matchingRun}::uuid,${ids[`provider${index}`]}::uuid,true,${9000-index*500},${transaction.json({policy_version:"MATCH-V1",service_fit:{value:90-index*5,weight:30},exclusion_reasons:[]})},${index*10})`;
    }
    await transaction`insert into public.rfqs(id,request_id,request_version_id,matching_run_id,status,deadline,confidentiality_settings,invited_count,opened_by)values(${ids.rfq}::uuid,${ids.request}::uuid,${ids.requestVersion}::uuid,${ids.matchingRun}::uuid,'OPEN',clock_timestamp()+interval'30 days',${transaction.json({mask_direct_contacts:true,competitor_offers_visible:false})},3,${client.id}::uuid)`;
    for(let index=0;index<3;index+=1){
      await transaction`insert into public.rfq_providers(id,rfq_id,provider_organization_id,matching_candidate_id,status,responded_at)values(${ids[`invitation${index}`]}::uuid,${ids.rfq}::uuid,${ids[`provider${index}`]}::uuid,${ids[`candidate${index}`]}::uuid,'ACCEPTED',clock_timestamp())`;
      await transaction`insert into public.quotes(id,rfq_id,rfq_provider_id,provider_organization_id,status,created_by)values(${ids[`quote${index}`]}::uuid,${ids.rfq}::uuid,${ids[`invitation${index}`]}::uuid,${ids[`provider${index}`]}::uuid,'SUBMITTED',${client.id}::uuid)`;
      const subtotal=100000+index*25000,tax=Math.round(subtotal*.2),total=subtotal+tax;
      await transaction`insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by)values(${ids[`quoteVersion${index}`]}::uuid,${ids[`quote${index}`]}::uuid,${ids.rfq}::uuid,${ids[`provider${index}`]}::uuid,1,'SUBMITTED','Fixture E2E finale','MAD',${index===2?foreignMarker:`Solution ${index+1}`},${transaction.json(["Rapport"])},'Garantie','Corrections','2026-10-15',${10+index},${validUntil}::timestamptz,${subtotal},${tax},${total},0,${transaction.json({})},${hash(`quote-${index}`)},clock_timestamp(),${client.id}::uuid)`;
      await transaction`update public.quotes set current_version_id=${ids[`quoteVersion${index}`]}::uuid where id=${ids[`quote${index}`]}::uuid`;
      if(index<2)rows.push({quote_id:ids[`quote${index}`],quote_version_id:ids[`quoteVersion${index}`],provider_organization_id:ids[`provider${index}`],version_number:1,currency:"MAD",subtotal_minor:subtotal,tax_minor:tax,total_minor:total,recurring_subtotal_minor:0,duration_days:10+index,deliverables_count:1,valid_until:validUntil,price_rank:index+1,explanation:["Périmètre comparable"]});
    }
    await transaction`insert into public.quote_comparison_snapshots(id,rfq_id,client_organization_id,normalization_version,quote_version_ids,currency,comparison,input_hash,created_by)values(${ids.snapshot}::uuid,${ids.rfq}::uuid,${clientOrganizationId}::uuid,'QUOTE_COMPARE_V1',${[ids.quoteVersion0,ids.quoteVersion1]}::uuid[],'MAD',${transaction.json({criteria:["TOTAL_MINOR"],tax_basis:"VERSIONED_MA_RULE_PER_LINE",rows})},${hash("comparison")},${client.id}::uuid)`;
    await transaction`insert into public.internal_message_threads(id,object_type,object_id,service_request_id,client_organization_id,provider_organization_id,subject,created_by)values(${ids.thread}::uuid,'RFQ',${ids.rfq}::uuid,${ids.request}::uuid,${clientOrganizationId}::uuid,${ids.provider0}::uuid,${subject},${client.id}::uuid)`;
    await transaction`insert into public.internal_message_participants(id,thread_id,organization_id,participant_kind,display_alias)values(${ids.clientParticipant}::uuid,${ids.thread}::uuid,${clientOrganizationId}::uuid,'CLIENT','CLIENT'),(${ids.providerParticipant}::uuid,${ids.thread}::uuid,${ids.provider0}::uuid,'PROVIDER','PROVIDER')`;
    await transaction`insert into public.internal_messages(id,thread_id,sender_participant_id,sender_organization_id,sender_user_id,body,idempotency_key)values(${ids.message}::uuid,${ids.thread}::uuid,${ids.clientParticipant}::uuid,${clientOrganizationId}::uuid,${client.id}::uuid,${message},${`final-${runId}`})`;
    await transaction.unsafe("set local session_replication_role=origin");
  });
  fixture.resources.finalCoreCreated={ids,clientOrganizationId,subject,message,foreignMarker,providerUserId:providerUser.id,capacityServiceId:catalog.service_id,capacityServiceLabelFr:catalog.service_label_fr};
  if (fixture.config.runtimeMode==='isolated-local-docker') {
    // Known clean PDF metadata is a historical test precondition, not a claim
    // that a production malware scanner or compliance reviewer was exercised.
    for (const [index,kind] of ["LEGAL","FISCAL","INSURANCE"].entries()) {
      const path=`test-only/${ids.capacityProvider}/${kind.toLowerCase()}.pdf`;
      fixture.resources.localFinalPdfPaths.push(path);
      const upload=await fixture.resources.admin.storage.from('provider-qualification').upload(path,knownPdf,{contentType:'application/pdf',upsert:false});
      if(upload.error)throw new Error('FINAL_CORE_REAL_PDF_UPLOAD_FAILED');
      const [job]=await database`insert into public.provider_document_scan_jobs(document_version_id,provider_organization_id,storage_object_path,declared_sha256,declared_mime_type)values(${ids[`capacityDocumentVersion${index}`]}::uuid,${ids.capacityProvider}::uuid,${path},${knownPdfHash},'application/pdf')returning id`;
      const scan=await fixture.resources.admin.rpc('record_provider_document_scan_result',{p_upload_id:job.id,p_result:'CLEAN',p_engine_code:'LOCAL_FIXTURE_KNOWN_PDF',p_engine_version:'1',p_computed_sha256:knownPdfHash,p_idempotency_key:`local-known-pdf:${job.id}`});
      if(scan.error||scan.data?.result!=='CLEAN')throw new Error('FINAL_CORE_KNOWN_PDF_PRECONDITION_FAILED');
    }
    const central=fixture.sessions.central.client;
    const review=await central.rpc('get_provider_identity_review_context_v1',{p_provider_organization_id:ids.capacityProvider});
    if(review.error||!review.data?.identity_hash||review.data.document_version_ids?.length!==3)throw new Error('FINAL_CORE_IDENTITY_REVIEW_CONTEXT_REQUIRED');
    const validation=await central.rpc('revalidate_provider_identity_v1',{p_provider_organization_id:ids.capacityProvider,p_expected_organization_row_version:review.data.organization_row_version,p_expected_profile_row_version:review.data.profile_row_version,p_expected_identity_hash:review.data.identity_hash,p_expected_company_decision_id:review.data.company_decision_id,p_reason:'Validation humaine synthétique de recette locale, sans certification réelle',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});
    if(validation.error)throw new Error('FINAL_CORE_REAL_IDENTITY_REVALIDATION_FAILED');
    const current=await central.rpc('get_provider_identity_review_context_v1',{p_provider_organization_id:ids.capacityProvider});
    if(current.error||current.data?.currently_verified!==true)throw new Error('FINAL_CORE_CURRENT_IDENTITY_NOT_VERIFIED');
    fixture.resources.localProviderIdentityRevalidated=true;
  }
  return {ids,clientOrganizationId,subject,message,foreignMarker,providerUserId:providerUser.id,capacityServiceId:catalog.service_id,capacityServiceLabelFr:catalog.service_label_fr};
}

async function cleanup(database, item){
  // Keep all real command/audit/outbox history. The shared cleanup revokes
  // memberships, archives every fixture organization and disables Auth users.
  await database.begin(async tx=>{
    await tx.unsafe("set local session_replication_role='replica'");
    await tx`update public.questionnaire_versions set status='SUPERSEDED',superseded_at=clock_timestamp() where id=${item.ids.capacityQuestionnaireVersion}::uuid and status='PUBLISHED'`;
    await tx`update public.questionnaires set status='ARCHIVED',archived_at=clock_timestamp() where id=${item.ids.capacityQuestionnaire}::uuid`;
  });
  const [remaining]=await database`select count(*)::int as count from public.questionnaire_versions where id=${item.ids.capacityQuestionnaireVersion}::uuid and status='PUBLISHED'`;
  if(remaining?.count!==0)throw new Error('FINAL_CORE_REFERENCE_REMAINS_PUBLISHED');
}

async function verifyProviderCapacityProof(database,item){
  const [history]=await database`select array_agg(capacity_status order by version_number) as statuses,array_agg(version_number order by version_number) as versions,count(*)::integer as count from public.provider_capacity_versions where provider_organization_id=${item.ids.capacityProvider}::uuid and service_id=${item.capacityServiceId}::uuid`;
  const expectedStatuses=["AVAILABLE","LIMITED","FULL","PAUSED"];
  if(history?.count!==4||JSON.stringify(history.statuses)!==JSON.stringify(expectedStatuses)||JSON.stringify(history.versions)!==JSON.stringify([1,2,3,4]))throw new Error("Final core provider capacity history is incomplete");
  const [events]=await database`select (select count(*)::integer from public.audit_events where organization_id=${item.ids.capacityProvider}::uuid and action='provider.capacity.declared') as audits,(select count(*)::integer from public.event_outbox where organization_id=${item.ids.capacityProvider}::uuid and event_type='ProviderCapacityDeclaredV1') as outbox_events`;
  if(events?.audits!==4||events?.outbox_events!==4)throw new Error("Final core provider capacity audit/outbox proof is incomplete");
  const [eligibility]=await database`select private.provider_service_eligibility_snapshot(${item.ids.capacityProvider}::uuid,${item.capacityServiceId}::uuid) as value`;
  const snapshot=eligibility?.value;
  if(snapshot?.eligible!==false||snapshot?.capacity_status!=="PAUSED"||!snapshot?.reasons?.includes("CAPACITY_PAUSED"))throw new Error("Final core provider paused matching exclusion is not enforced");
  return{statuses:history.statuses,versions:history.versions,audits:events.audits,outboxEvents:events.outbox_events,finalEligible:snapshot.eligible,finalReason:"CAPACITY_PAUSED"};
}

try{
  base=await provision();config=await loadSafeConfiguration(root);await validateFreshManifest(base.manifest,config);if(config.runtimeMode==="isolated-local-docker")await provisionLocalCatalogReference(base);created=await createFixture(base);
  await mkdir(directory,{recursive:false,mode:0o700});await mkdir(output,{recursive:false,mode:0o700});await secureLocalPaths(directory,[output]);
  const manifest={schemaVersion:1,environment:"TEST",expiresAt:new Date(Date.now()+20*60_000).toISOString(),clientState:base.manifest.states.clientA.path,foreignClientState:base.manifest.states.clientB.path,providerState:base.manifest.states.noRole.path,messaging:{threadId:created.ids.thread,subject:created.subject,message:created.message,foreignMarker:created.foreignMarker},comparison:{requestId:created.ids.request,rfqId:created.ids.rfq,foreignMarker:created.foreignMarker},matching:{requestId:created.ids.request,policyVersion:"MATCH-V1",minimumRuns:2},providerQualification:{organizationId:created.ids.capacityProvider,serviceId:created.capacityServiceId,serviceLabelFr:created.capacityServiceLabelFr}};
  await writeFile(manifestPath,JSON.stringify(manifest),{mode:0o600,flag:"wx"});
  const env=buildChildEnvironment(process.env,{E2E_BASE_URL:config.baseUrl,E2E_FINAL_CORE_PRODUCT_MANIFEST:manifestPath,...(process.env.E2E_EXTERNAL_SERVER==="1"?{E2E_EXTERNAL_SERVER:"1"}:{})});
  suiteSummary=await runSecuredBrowserSuite({root,config,environment:env,specifications:["tests/e2e/final-core-product.spec.ts"],output,expectedTests:4,projects:["chromium-desktop"]});
  const stats={expected:suiteSummary.passed,unexpected:0,skipped:0,flaky:0,duration:Date.parse(suiteSummary.finishedAt)-Date.parse(suiteSummary.startedAt)};
  const providerCapacity=await verifyProviderCapacityProof(base.resources.database,created);
  const [messaging]=await base.resources.database`select count(distinct message.id)::int as messages,count(distinct audit.id)::int as audits,count(distinct event.id)::int as events from public.internal_messages message join public.audit_events audit on audit.resource_id=message.id::text and audit.action='messaging.message.sent' join public.event_outbox event on event.correlation_id=audit.correlation_id and event.event_type='InternalMessageSentV1' where message.thread_id=${created.ids.thread}::uuid and message.body=${`${created.message} — réponse persistée`}`;
  if(messaging?.messages!==1||messaging?.audits!==1||messaging?.events!==1)throw new Error('FINAL_CORE_MESSAGE_PERSISTENCE_PROOF_FAILED');
  evidence={schemaVersion:1,environment:"TEST",generatedAt:new Date().toISOString(),outcome:"PASS",command:"node tests/e2e/helpers/final-core-product-run.mjs",stats:{expected:stats.expected,unexpected:stats.unexpected,flaky:stats.flaky,skipped:stats.skipped,durationMs:Math.round(stats.duration)},requirements:["MAT-FUNC-007","MAT-FUNC-013","MAT-FUNC-018","MAT-FUNC-019","MAT-FUNC-020"],security:["cross-tenant-deny","provider-capacity-matching-inclusion-exclusion"],providerCapacity,cleanup:"verified"};
  console.log("PASS final core product authenticated E2E: MAT-FUNC-007, MAT-FUNC-013, MAT-FUNC-018, MAT-FUNC-019 and MAT-FUNC-020");
}catch(error){failure=error;suiteSummary??=error.browserSummary;}finally{
  if(base)try{await closePendingLocalProviderScans(base,base.resources.localFinalPdfPaths);}catch(error){cleanupFailed=true;failure??=error;}
  if(base?.resources.localFinalPdfPaths?.length)try{const removal=await base.resources.admin.storage.from('provider-qualification').remove(base.resources.localFinalPdfPaths);if(removal.error)throw new Error('FINAL_CORE_PDF_BYTES_CLEANUP_FAILED');}catch(error){cleanupFailed=true;failure??=error;}
  if(base&&(created||base.resources.finalCoreCreated))try{await cleanup(base.resources.database,created??base.resources.finalCoreCreated);console.log("PASS final core product fixture neutralized");}catch(error){cleanupFailed=true;failure=failure?new AggregateError([failure,error]):error;}
  if(base)try{await neutralizeLocalCatalogReference(base);}catch(error){cleanupFailed=true;failure??=error;}
  if(base)try{await base.cleanup();}catch(error){cleanupFailed=true;failure=failure?new AggregateError([failure,error]):error;}
  try{await rm(directory,{recursive:true,force:true});}catch(error){cleanupFailed=true;failure??=error;}
  try{await rm(sharedAuthDirectory,{recursive:true,force:true});}catch(error){cleanupFailed=true;failure??=error;}
}
await writeLocalSuiteEvidence({root,suite:"final-core",config,summary:suiteSummary,failure,cleanupVerified:!cleanupFailed,proof:{knownPdfIsPreconditionOnly:true,providerIdentityRevalidatedViaRealAal2Command:base?.resources.localProviderIdentityRevalidated===true,providerCapacityAuditVerified:!failure}});
if(!failure&&evidence)try{await writeFile(evidencePath,JSON.stringify(evidence,null,2)+"\n",{encoding:"utf8"});}catch(error){failure=error;}
if(failure){
  const sanitized=typeof failure.message==='string'&&/^[A-Z0-9_.:-]{1,160}$/u.test(failure.message)?failure.message:'FINAL_CORE_FAILED';
  try{await writeFile(evidencePath,JSON.stringify({schemaVersion:1,environment:"TEST",generatedAt:new Date().toISOString(),outcome:"FAIL",command:"node tests/e2e/helpers/final-core-product-run.mjs",requirements:["MAT-FUNC-020"],error:sanitized,cleanup:cleanupFailed?"failed":"verified"},null,2)+"\n",{encoding:"utf8"});}catch{}
  console.error(`FAIL final core product E2E: ${sanitized}`);
  process.exitCode=1;
}
