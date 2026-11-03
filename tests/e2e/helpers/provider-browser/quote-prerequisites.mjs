import { requireDevelopment, loadOwnState, docker } from './safety.mjs';
import { nativeBrowserActor } from './browser-session.mjs';
import { localFixturePdf } from '../local-fixture-pdf.mjs';
import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
requireDevelopment();
const state=await loadOwnState(), path=resolve(state.directory,'quote-prerequisites.private.json');
const upstreamOnly=process.argv.includes('--upstream-only');
const qualification=JSON.parse(await readFile(resolve(state.directory,'qualification-reviewed.json'))), catalogue=JSON.parse(await readFile(resolve(state.directory,'catalogue-fixture-provenance.json')));
if(!upstreamOnly&&(qualification.status!=='PASSED'||qualification.appTree!==state.candidate?.appTree))throw Error('ACTUAL_NATIVE_PROVIDER_QUALIFICATION_FIRST');
try{await access(path);throw Error('PRESERVE_EXISTING_QUOTE_PREREQUISITES');}catch(error){if(error.code!=='ENOENT')throw error;}
const owner=await nativeBrowserActor(state,'provider-owner'), client=await nativeBrowserActor(state,'client-owner'), author=await nativeBrowserActor(state,'finance-author'), reviewer=await nativeBrowserActor(state,'finance-reviewer'), compliance=await nativeBrowserActor(state,'compliance-reviewer');
if(author.actor.userId===reviewer.actor.userId)throw Error('INDEPENDENT_NATIVE_FISCAL_REVIEW_REQUIRED');
const eligible=await owner.client.rpc('explain_provider_service_eligibility',{p_provider_organization_id:owner.actor.organizationId,p_service_id:catalogue.ids.serviceA});
if(!upstreamOnly&&(eligible.error||eligible.data?.eligible!==true))throw Error('NATIVE_PROVIDER_MUST_ALREADY_BE_ELIGIBLE');
const source=await readFile('supabase/tests/0338_client_native_mission_dispute_acceptance.test.sql','utf8'),taxSource=await readFile('supabase/tests/0346_provider_quote_completion.test.sql','utf8');
const section=(text,start,end)=>{const from=text.indexOf(start),to=text.indexOf(end,from);if(from<0||to<=from)throw Error('REVIEWED_QUOTE_PREREQUISITE_SOURCE_DRIFT');return text.slice(from,to);};
const ids={clientCaseId:randomUUID(),requestId:randomUUID(),requestVersionId:randomUUID(),matchingRunId:randomUUID(),matchingCandidateId:randomUUID(),rfqId:randomUUID(),invitationId:randomUUID(),taxRuleVersionId:randomUUID()};
const mapping=new Map([
 ['fd100000-0000-4000-8000-000000000001',client.actor.userId],['fd100000-0000-4000-8000-000000000004',compliance.actor.userId],
 ['fd110000-0000-4000-8000-000000000001',client.actor.organizationId],['fd110000-0000-4000-8000-000000000002',owner.actor.organizationId],
 ['fd410000-0000-4000-8000-000000000001',ids.clientCaseId],['fd140000-0000-4000-8000-000000000001',ids.requestId],['fd160000-0000-4000-8000-000000000001',ids.requestVersionId],
 ['fd170000-0000-4000-8000-000000000001',ids.matchingRunId],['fd171000-0000-4000-8000-000000000001',ids.matchingCandidateId],['fd150000-0000-4000-8000-000000000001',ids.rfqId],['fd190000-0000-4000-8000-000000000001',ids.invitationId],
]);
let legal=section(source,'insert into public.organization_identifiers(','insert into public.service_requests(');
// Preserve the genuine organization ICE, users and memberships. Only historical
// Client legal prerequisites are installed; this is not Client onboarding QA.
legal=legal.slice(legal.indexOf('-- Pre-existing verified profile'));
let requests=section(source,'insert into public.service_requests(','-- Native service request, reviewed qualification');
let rfq=section(source,'insert into public.matching_runs(','create temporary table accept338');
let sql=legal+requests+rfq;
for(const value of new Set(sql.match(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/giu)))if(!mapping.has(value))mapping.set(value,randomUUID());
for(const[from,to]of mapping)sql=sql.replaceAll(from,to);
const fiscal='TEST'+state.token.slice(0,8).toUpperCase();
sql=sql.replaceAll('997104000000001',client.actor.ice).replaceAll('99710401','99710401').replaceAll('TEST104',fiscal)
 .replaceAll('MF024 Client',`TEST ONLY client-owner ${state.token}`).replaceAll("'CONTRACT_PENDING'","'RFQ_OPEN'")
 .replaceAll("'CASABLANCA'","'CASABLANCA_SETTAT'")
 .replaceAll("'ACCEPTED',clock_timestamp()","'INVITED',null")
 .replaceAll("'Tribunal'","'TEST ONLY historical reference'").replaceAll("'Notaire'","'TEST ONLY historical reference'");
const profileLine=sql.split('\n').find(line=>line.startsWith('insert into public.client_profile_versions('));
if(!profileLine)throw Error('EXACT_HISTORICAL_CLIENT_PROFILE_LINE_REQUIRED');
sql=sql.replace(profileLine,profileLine.replace(`}',1,'${client.actor.userId}');`,`}',(select row_version from public.organizations where id='${client.actor.organizationId}'),'${client.actor.userId}');`));
if(/\bauth\.|organization_memberships|organization_member_roles|platform_user_roles|provider_(profiles|qualifications|qualification_decisions)|\bquotes\b|quote_versions|set_config|disable\s+trigger|session_replication_role/iu.test(sql))throw Error('UPSTREAM_FIXTURE_CANNOT_WRITE_PROVIDER_SUCCESS_OR_AUTH');
if(upstreamOnly){const requestStart=sql.indexOf('insert into public.service_requests(');if(requestStart<0)throw Error('EXACT_CLIENT_LEGAL_BOUNDARY_REQUIRED');sql=sql.slice(0,requestStart);}
const {createClient}=createRequire(resolve('apps/web/package.json'))('@supabase/supabase-js'),storage=createClient(`http://127.0.0.1:${state.gatewayPort}`,state.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const docs=[];
for(const[kind,old,letter]of[['REGISTRATION_DOCUMENT','registration','a'],['REPRESENTATIVE_AUTHORITY','authority','b']]){
 const bytes=localFixturePdf(['TEST ONLY / NON_CONTRACTUAL_DEMO',kind.padEnd(32,' '),`Client organization: ${client.actor.organizationId}`,'Historical Client legal prerequisite, not native onboarding certification.']);
 const hash=createHash('sha256').update(bytes).digest('hex'),objectPath=`${client.actor.organizationId}/provider-browser-test/${old}.pdf`;
 docs.push({kind,objectPath,sha256:hash,sizeBytes:bytes.length});
 sql=sql.replaceAll(`repeat('${letter}',64)`,`'${hash}'`).replaceAll(`${client.actor.organizationId}/client-a/${old}.pdf`,objectPath).replaceAll(`compliance/client-a/${old}.pdf`,objectPath);
}
if(docs[0].sizeBytes!==docs[1].sizeBytes)throw Error('EXACT_EQUAL_SIZE_HISTORICAL_FILE_SUBSTITUTION_REQUIRED');
sql=sql.replaceAll(',128,',`,${docs[0].sizeBytes},`);
const taxCode=`TEST_PROVIDER_${state.token.replaceAll('-','').slice(0,12).toUpperCase()}`;
let tax=section(taxSource,'insert into public.tax_categories(','create temporary table accept339');
tax=tax.replaceAll('ACCEPT339_SERVICE',taxCode).replaceAll('f3390000-0000-4000-8000-000000000001',ids.taxRuleVersionId).replaceAll('fd100000-0000-4000-8000-000000000004',reviewer.actor.userId);
const prelude=`update public.organizations set status='ACTIVE' where id='${client.actor.organizationId}' and status='PENDING';
update public.organization_identifiers set verification_status='VERIFIED' where organization_id='${client.actor.organizationId}' and identifier_type='ICE';
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('${client.actor.organizationId}','IF','99710401','VERIFIED'),('${client.actor.organizationId}','RC','${fiscal}','VERIFIED');
create temporary table mf024_catalog as select '${catalogue.ids.libraryId}'::uuid library_id,'${catalogue.ids.serviceA}'::uuid service_id,'${catalogue.ids.serviceVersionA}'::uuid service_version_id;`;
const proof={scope:upstreamOnly?'HISTORICAL_CLIENT_LEGAL_AND_FISCAL_TEST_PREREQUISITES_RFQ_NOT_CREATED':'HISTORICAL_CLIENT_LEGAL_REQUEST_RFQ_AND_FISCAL_TEST_PRECONDITIONS',status:'INTENT_RECORDED',candidate:state.candidate.commit,appTree:state.candidate.appTree,ids,docs,providerQualificationWritten:false,providerQuoteWritten:false,nativeAuthenticationAltered:false,clientOnboardingCertified:false,physicalAntivirusCertified:false,catalogueGovernanceCertified:false,sourceSha256:createHash('sha256').update(source).digest('hex'),taxSourceSha256:createHash('sha256').update(taxSource).digest('hex')};
await writeFile(path,JSON.stringify(proof,null,2),{mode:0o600});
for(const doc of docs){const kind=doc.kind,bytes=localFixturePdf(['TEST ONLY / NON_CONTRACTUAL_DEMO',kind.padEnd(32,' '),`Client organization: ${client.actor.organizationId}`,'Historical Client legal prerequisite, not native onboarding certification.']);const result=await storage.storage.from('client-compliance').upload(doc.objectPath,bytes,{contentType:'application/pdf',upsert:false});if(result.error)throw Error('ACTUAL_TEST_CLIENT_PREREQUISITE_STORAGE_UPLOAD:'+result.error.statusCode);}
const transaction=`begin;do $$begin if not exists(select 1 from private.admin_execution_environment_v1 where singleton and environment='DEVELOPMENT')then raise exception 'OWNED_DEVELOPMENT_ONLY';end if;if exists(select 1 from public.client_compliance_cases where organization_id='${client.actor.organizationId}')then raise exception 'PRESERVE_NATIVE_CLIENT_CASE';end if;end$$;\n${prelude}\n${sql}\n${tax}\nset constraints all immediate;commit;`;
docker(['exec','-i',state.database,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:transaction});
proof.appliedSqlSha256=createHash('sha256').update(transaction).digest('hex');proof.status='HISTORICAL_PREREQUISITES_INSTALLED';await writeFile(path,JSON.stringify(proof,null,2),{mode:0o600});
async function call(c,name,args){const r=await c.rpc(name,args);if(r.error)throw Error(`${name}:${r.error.code}`);return r.data;}
const scope=await call(author.client,'get_service_tax_category_mapping_context_v1',{p_service_version_id:catalogue.ids.serviceVersionA,p_country_code:'MA',p_currency:'MAD',p_page:1});
const proposal=await call(author.client,'propose_service_tax_category_mapping_v1',{p_service_version_id:catalogue.ids.serviceVersionA,p_expected_service_hash:scope.source.content_hash,p_expected_scope_hash:scope.scope_hash,p_country_code:'MA',p_currency:'MAD',p_category_code:taxCode,p_valid_from:new Date().toISOString().slice(0,10),p_valid_until:null,p_development_only:true,p_supersedes_mapping_ids:[],p_reason:'TEST ONLY classification for exact native Provider quote acceptance, not a legal tax opinion.',p_idempotency_key:randomUUID()});
proof.taxProposal=proposal;await writeFile(path,JSON.stringify(proof,null,2),{mode:0o600});
const decision=await call(reviewer.client,'decide_service_tax_category_mapping_v1',{p_proposal_id:proposal.proposal_id,p_expected_content_hash:proposal.content_hash,p_approve:true,p_approval_reference:'TEST-NATIVE-PROVIDER-QUOTE',p_reason:'TEST ONLY independent fiscal mapping review, no commercial or legal tax claim.'});
proof.taxDecision=decision;proof.status=upstreamOnly?'UPSTREAM_READY':'READY';proof.rfqCreated=!upstreamOnly;await writeFile(path,JSON.stringify(proof,null,2),{mode:0o600});
console.log(JSON.stringify({status:proof.status,scope:proof.scope,providerQuoteWritten:false,nativeFiscalFourEyes:true,actualHistoricalClientFileBytes:true}));
