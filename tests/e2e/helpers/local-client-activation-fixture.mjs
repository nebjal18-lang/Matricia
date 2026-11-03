import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile,writeFile } from 'node:fs/promises';
import { localFixturePdf } from './local-fixture-pdf.mjs';
const {createServerClient}=createRequire(new URL('../../../apps/web/package.json',import.meta.url))('@supabase/ssr');
const sha=value=>createHash('sha256').update(value).digest('hex');

async function command(fixture,client,name,input,evidence){
 fixture.resources.localActivationStage=name.toUpperCase();
 const result=await client.rpc(name,input);
 if(result.error)throw Object.assign(new Error(`LOCAL_ACTIVATION_${name.toUpperCase()}_FAILED`),{code:result.error.code});
 if(input.p_correlation_id)evidence.push(input.p_correlation_id);
 fixture.resources.localActivationLastOk??=[];fixture.resources.localActivationLastOk.push(name.toUpperCase());
 return result.data;
}
export async function actorFromBrowserState(fixture,path,email,aal){
 const state=JSON.parse(await readFile(path,'utf8'));
 const cookies=new Map(state.cookies.map(cookie=>[cookie.name,{name:cookie.name,value:cookie.value}]));
 const client=createServerClient(fixture.config.supabaseUrl,fixture.config.publishableKey,{cookies:{getAll:()=>[...cookies.values()],setAll:changes=>{for(const change of changes){if(change.value===''||change.options?.maxAge===0)cookies.delete(change.name);else cookies.set(change.name,change);}}},auth:{autoRefreshToken:false,detectSessionInUrl:false,persistSession:true}});
 const label=fixture.resources.localActivationActor??'NATIVE_ACTOR';
 fixture.resources.localActivationStage=`${label}_GET_USER`;
 const user=await client.auth.getUser();
 assert.equal(user.error,null);assert.equal(user.data.user?.email,email);
 fixture.resources.localActivationLastOk??=[];fixture.resources.localActivationLastOk.push(`${label}_GET_USER`);
 fixture.resources.localActivationStage=`${label}_CHECK_${aal.toUpperCase()}`;
 const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
 assert.equal(assurance.error,null);assert.equal(assurance.data.currentLevel,aal);
 fixture.resources.localActivationLastOk.push(`${label}_CHECK_${aal.toUpperCase()}`);
 return{client,cookies,state:path,email,userId:user.data.user.id};
}

/** Serialize only cookies produced by the native SDK, after its real MFA flow. */
export async function persistCurrentLocalActorState(fixture,actor,path,expectedAal='aal2'){
 assert.equal(fixture.config.runtimeMode,'isolated-local-docker');assert.equal(fixture.config.localDockerVerified,true);assert.ok(fixture.resources.userIds.includes(actor.userId));assert.ok(actor.cookies instanceof Map);
 const user=await actor.client.auth.getUser();assert.equal(user.error,null);assert.equal(user.data.user?.id,actor.userId);
 assert.ok(['aal1','aal2'].includes(expectedAal));
 const assurance=await actor.client.auth.mfa.getAuthenticatorAssuranceLevel();assert.equal(assurance.error,null);assert.equal(assurance.data.currentLevel,expectedAal);
 const domain=new URL(fixture.config.baseUrl).hostname;
 const cookies=[...actor.cookies.values()].map(({name,value,options={}})=>({name,value,domain,path:options.path||'/',expires:typeof options.maxAge==='number'?Math.floor(Date.now()/1000)+options.maxAge:-1,httpOnly:options.httpOnly??false,secure:false,sameSite:options.sameSite==='strict'?'Strict':options.sameSite==='none'?'None':'Lax'}));
 await writeFile(path,JSON.stringify({cookies,origins:[]}),{mode:0o600});return path;
}

/** Every activation transition uses real public commands; no organization status is written here. */
export async function activateUiRegisteredClients(fixture,authManifest){
 if(fixture.config.runtimeMode!=='isolated-local-docker'||!fixture.config.localDockerVerified)throw new Error('LOCAL_ACTIVATION_DOCKER_REQUIRED');
 const reviewers={};const actors={};const evidence=[];
 for(const locale of ['fr','ar']){fixture.resources.localActivationActor=`REVIEWER_${locale.toUpperCase()}`;reviewers[locale]=await actorFromBrowserState(fixture,authManifest.centralStatePaths[locale],authManifest.centralEmails[locale],'aal2');}
 // The actual UI TOTP verification invalidated the earlier weak session.
 // Issue a new native AAL1 session after Auth4, retaining the two AAL2 reviewers.
 fixture.resources.localActivationStage='WEAK_REVIEWER_NATIVE_OTP_CHALLENGE';
 const weakContext=fixture.sessions.centralAal1;
 const link=await fixture.resources.admin.auth.admin.generateLink({type:'magiclink',email:authManifest.centralEmails.fr});assert.equal(link.error,null);assert.ok(link.data.properties.hashed_token);
 fixture.resources.localActivationStage='WEAK_REVIEWER_NATIVE_OTP_VERIFY';
 const signed=await weakContext.client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'});assert.equal(signed.error,null);
 fixture.resources.localActivationStage='WEAK_REVIEWER_FRESH_GET_USER';
 const weakUser=await weakContext.client.auth.getUser();assert.equal(weakUser.error,null);assert.equal(weakUser.data.user?.id,reviewers.fr.userId);
 const weakAssurance=await weakContext.client.auth.mfa.getAuthenticatorAssuranceLevel();assert.equal(weakAssurance.error,null);assert.equal(weakAssurance.data.currentLevel,'aal1');assert.equal(weakAssurance.data.nextLevel,'aal2');
 for(const reviewer of Object.values(reviewers)){const user=await reviewer.client.auth.getUser();assert.equal(user.error,null);const assurance=await reviewer.client.auth.mfa.getAuthenticatorAssuranceLevel();assert.equal(assurance.error,null);assert.equal(assurance.data.currentLevel,'aal2');}
 const weakReviewer={client:weakContext.client,cookies:weakContext.cookies,userId:weakUser.data.user.id};
 const weakState=fixture.manifest.states.centralAal1;
 await persistCurrentLocalActorState(fixture,weakReviewer,weakState.path,'aal1');weakState.sha256=sha(await readFile(weakState.path));
 await writeFile(fixture.manifestPath,JSON.stringify(fixture.manifest,null,2)+'\n',{mode:0o600});
 fixture.resources.localActivationLastOk.push('WEAK_REVIEWER_NATIVE_AAL1_FRESH');
 assert.notEqual(reviewers.fr.userId,reviewers.ar.userId);
 for(const locale of ['fr','ar']){
  fixture.resources.localActivationActor=`CLIENT_${locale.toUpperCase()}`;
  const actor=await actorFromBrowserState(fixture,authManifest.registrationStatePaths[locale],authManifest.registrationEmails[locale],'aal1');
  actors[locale]=actor;
  if(!fixture.resources.userIds.includes(actor.userId))fixture.resources.userIds.push(actor.userId);
 }
 for(const locale of ['fr','ar']){
  const actor=actors[locale],foreign=actors[locale==='fr'?'ar':'fr'],client=actor.client;
  const token=randomUUID(),ice=(BigInt(`0x${sha(token).slice(0,14)}`)%1_000_000_000_000_000n).toString().padStart(15,'0'),fiscal=(BigInt(`0x${sha(`${token}:if`).slice(0,10)}`)%100_000_000n).toString().padStart(8,'0'),registration=`E2E${token.replaceAll('-','').slice(0,16).toUpperCase()}`;
  const name=`P05 E2E Activated ${locale} ${fixture.manifest.runId}`;
  const organization=await command(fixture,client,'create_or_request_organization',{p_legal_name:name,p_display_name:name,p_ice:ice,p_owner_role:'CLIENT_OWNER',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()},evidence);
  assert.equal(organization.outcome,'ORGANIZATION_CREATED');actor.organizationId=organization.organization_id;fixture.resources.organizationIds.push(actor.organizationId);
  const profile={legal_form:'SARL',incorporation_date:'2020-01-01',activity:'Activité de recette locale',sector:'Recette',employee_count:2,registered_city:'Casablanca',registered_address:{line1:'Adresse synthétique de recette locale',country_code:'MA'},contact:{phone:'+212600000001',email:actor.email},representative:{first_name:'Compte',last_name:'Recette',title:'Représentant de recette',email:actor.email,phone:'+212600000001',power:'Représentation pour recette locale'},declarations:{accuracy_confirmed:true,representation_authorized:true},if_number:fiscal,rc_number:registration};
  const saved=await command(fixture,client,'save_client_profile_draft',{p_organization_id:actor.organizationId,p_profile:profile,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()},evidence);
  actor.caseId=saved.compliance_case_id;const documents=[];
  for(const kind of ['REGISTRATION_DOCUMENT','REPRESENTATIVE_AUTHORITY','TAX_DOCUMENT']){
   const bytes=localFixturePdf([kind,'SYNTHETIC LOCAL ACCEPTANCE - NOT AN OFFICIAL DOCUMENT',name,`ICE: ${ice}`,`IF: ${fiscal}`,`RC: ${registration}`]),digest=sha(bytes);
   const reserved=await command(fixture,client,'begin_client_compliance_document_upload',{p_compliance_case_id:actor.caseId,p_document_type:kind,p_document_number:kind==='TAX_DOCUMENT'?fiscal:registration,p_issuer:'Émetteur synthétique pour recette locale',p_issued_on:'2026-01-01',p_expires_on:null,p_original_file_name:`${kind.toLowerCase()}.pdf`,p_mime_type:'application/pdf',p_size_bytes:bytes.length,p_sha256:digest,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()},evidence);
   assert.equal(reserved.bucket,'client-compliance');assert.equal(reserved.object_path,`${actor.organizationId}/${actor.caseId}/${reserved.document_id}.pdf`);
   fixture.resources.storagePaths.push(reserved.object_path);
   const uploaded=await client.storage.from(reserved.bucket).upload(reserved.object_path,bytes,{contentType:'application/pdf',upsert:false});assert.equal(uploaded.error,null);
   const downloaded=await client.storage.from(reserved.bucket).download(reserved.object_path);assert.equal(downloaded.error,null);assert.equal(sha(Buffer.from(await downloaded.data.arrayBuffer())),digest);
   const denied=await foreign.client.storage.from(reserved.bucket).download(reserved.object_path);assert.ok(denied.error);
   await command(fixture,client,'finalize_client_compliance_document_upload',{p_document_id:reserved.document_id,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()},evidence);
   // Trusted local known-byte result exercises the scan ledger, not an external malware engine/OCR.
   await command(fixture,fixture.resources.admin,'record_client_document_scan_result',{p_document_id:reserved.document_id,p_result:'CLEAN',p_engine_code:'LOCAL_KNOWN_FIXTURE_PDF',p_engine_version:'1',p_computed_sha256:digest,p_detected_mime_type:'application/pdf',p_detected_size_bytes:bytes.length,p_observed_claims:{},p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()},evidence);
   await command(fixture,reviewers.fr.client,'review_client_compliance_document',{p_document_id:reserved.document_id,p_decision:'VERIFIED',p_verified_sha256:digest,p_reason_public:null,p_reason_internal:'Revue manuelle synthétique des pièces de recette locale',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()},evidence);
   documents.push(reserved.document_id);
  }
  const review=await command(fixture,reviewers.fr.client,'get_client_identity_review_context_v1',{p_compliance_case_id:actor.caseId},evidence);
  const weak=await weakReviewer.client.rpc('get_client_identity_review_context_v1',{p_compliance_case_id:actor.caseId});assert.equal(weak.error?.code,'42501');
  const identityInput={p_compliance_case_id:actor.caseId,p_expected_case_row_version:review.case_row_version,p_expected_profile_version:review.profile_version,p_expected_identity_hash:review.identity_hash,p_document_ids:documents,p_reason:'Vérification humaine synthétique des identifiants sur les trois pièces de recette',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
  const verified=await command(fixture,reviewers.fr.client,'review_client_canonical_identifiers_v1',identityInput,evidence);
  assert.equal(verified.outcome,'CLIENT_CANONICAL_IDENTIFIERS_VERIFIED');
  const replay=await reviewers.fr.client.rpc('review_client_canonical_identifiers_v1',identityInput);assert.equal(replay.error,null);assert.deepEqual(replay.data,verified);
  await command(fixture,reviewers.fr.client,'evaluate_client_compliance',{p_compliance_case_id:actor.caseId,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()},evidence);
  await command(fixture,client,'submit_client_compliance',{p_compliance_case_id:actor.caseId,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()},evidence);
  const sameReviewer=await reviewers.fr.client.rpc('decide_client_compliance',{p_compliance_case_id:actor.caseId,p_decision:'VERIFIED',p_reason_public:'Validation synthétique de recette locale',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()});assert.equal(sameReviewer.error?.code,'42501');
  const finalInput={p_compliance_case_id:actor.caseId,p_decision:'VERIFIED',p_reason_public:'Validation synthétique de recette locale, aucun registre officiel consulté',p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
  const decision=await command(fixture,reviewers.ar.client,'decide_client_compliance',finalInput,evidence);assert.equal(decision.outcome,'CLIENT_COMPLIANCE_VERIFIED');
  const retried=await reviewers.ar.client.rpc('decide_client_compliance',finalInput);assert.equal(retried.error,null);assert.deepEqual(retried.data,decision);
  const [proof]=await fixture.resources.database`select o.status organization_status,c.status case_status,t.status trial_status,(select count(*)::int from public.client_identity_verification_history h where h.organization_id=o.id)identity_history,(select count(*)::int from public.client_compliance_documents d where d.organization_id=o.id and d.status='VERIFIED'and d.scan_status='CLEAN')documents from public.organizations o join public.client_compliance_cases c on c.organization_id=o.id join public.client_trials t on t.organization_id=o.id where o.id=${actor.organizationId}::uuid`;
  assert.equal(proof?.organization_status,'ACTIVE');assert.equal(proof.case_status,'VERIFIED');assert.equal(proof.trial_status,'TRIAL_ACTIVE');assert.equal(proof.documents,3);assert.equal(proof.identity_history,1);
  actor.organizationName=name;actor.activationVerified=true;
 }
 for(const correlation of evidence){
  const [proof]=await fixture.resources.database`select (select count(*)::int from public.audit_events where correlation_id=${correlation}::uuid and event_hash<>repeat('0',64))audits,(select count(*)::int from public.event_outbox where correlation_id=${correlation}::uuid)events`;
  assert.ok(proof.audits>0&&proof.events>0,'Every activation command must retain real correlated audit and outbox evidence');
 }
 fixture.resources.localJourneyActors=actors;
 fixture.resources.localJourneyReviewers=reviewers;
 return{actors,proof:{sameUiRegisteredIdentitiesActivated:true,realPrivatePdfObjects:6,realCanonicalIdentityReviews:2,realVerifiedCases:2,realTrialActivations:2,distinctAal2Reviewers:true,authenticatedAal1ReviewDenied:true,selfApprovalDenied:true,correlatedCommandEvidenceVerified:true,externalRegistryQueried:false,malwareEngineExternal:false}};
}
