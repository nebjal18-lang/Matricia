import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSafeConfiguration} from '../p05-e2e/environment.mjs';
import {provision} from '../p05-e2e/provision.mjs';
import {sourceIdentity} from './local-acceptance-evidence.mjs';
import {localFixturePdf} from '../../tests/e2e/helpers/local-fixture-pdf.mjs';

// This is a diagnostic of native Supabase behavior, not a logout certification.
// It only deletes the current session of a newly provisioned fixture account.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const requireImmediateRevocation=process.argv.slice(2).includes('--require-immediate-rpc-revocation');
if(process.argv.slice(2).some(arg=>arg!=='--require-immediate-rpc-revocation'))throw new Error('LOCAL_SESSION_DIAGNOSTIC_ARGUMENTS_INVALID');
let fixture,failure,cleanupVerified=false,stage='configuration',observation,sourceBefore,sourceAfter,rpcDefinitionSha256,authorizationRuntimeSha256,unboundStoragePath;
const startedAt=new Date().toISOString();
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 const config=await loadSafeConfiguration(root);
 assert.equal(config.runtimeMode,'isolated-local-docker');assert.equal(config.localDockerVerified,true);
 sourceBefore=await sourceIdentity(root);
 stage='fresh-owned-fixture';fixture=await provision();
 const client=fixture.sessions.central.client,session=await client.auth.getSession();assert.equal(session.error,null);
 const token=session.data.session?.access_token;assert.ok(token);
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
 assert.equal(claims.aal,'aal2');assert.ok(fixture.resources.userIds.includes(claims.sub));
 assert.match(claims.session_id,/^[0-9a-f-]{36}$/u);
 const protectedRpc=async()=>{
  const response=await fetch(`${config.supabaseUrl}/rest/v1/rpc/get_client_identity_review_context_v1`,{method:'POST',redirect:'error',headers:{apikey:config.publishableKey,authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({p_compliance_case_id:fixture.manifest.fixtures.organizationA.caseId})});
  // Never persist a staff response or raw server error.
  await response.arrayBuffer();return response.status;
 };
 const selfRead=async()=>{
  const response=await fetch(`${config.supabaseUrl}/rest/v1/user_profiles?id=eq.${claims.sub}&select=id`,{redirect:'error',headers:{apikey:config.publishableKey,authorization:`Bearer ${token}`}});
  const value=await response.json();return{status:response.status,ownRowRead:Array.isArray(value)&&value.length===1&&value[0]?.id===claims.sub};
 };
 const [document]=await fixture.resources.database`select storage_bucket,storage_object_path,declared_sha256 from public.client_compliance_documents where id=${fixture.manifest.fixtures.document.id}::uuid and organization_id=${fixture.manifest.fixtures.organizationA.id}::uuid`;
 assert.ok(document);assert.equal(document.storage_bucket,'client-compliance');assert.ok(fixture.resources.storagePaths.includes(document.storage_object_path));
 const privateObject=async(record=document)=>{
  const response=await fetch(`${config.supabaseUrl}/storage/v1/object/authenticated/${record.storage_bucket}/${record.storage_object_path}`,{redirect:'error',headers:{apikey:config.publishableKey,authorization:`Bearer ${token}`}});
  const bytes=Buffer.from(await response.arrayBuffer());let errorDenial=false;
  if([400,401,403,404].includes(response.status)&&bytes.length<4096&&response.headers.get('content-type')?.includes('json')){
   try{const error=JSON.parse(bytes.toString('utf8'));errorDenial=typeof error==='object'&&error!==null&&/not[ _-]?found|unauthori[sz]ed|forbidden|access[ _-]?denied|invalid[ _-]?(jwt|token)|jwt[ _-]?(expired|invalid)|insufficient[ _-]?privilege/iu.test(`${error.error??''} ${error.message??''} ${error.statusCode??''}`);}catch{}
  }
  return{status:response.status,privateDocumentBytesReturned:sha256(bytes)===record.declared_sha256,authorizationDenied:errorDenial&&sha256(bytes)!==record.declared_sha256};
 };
 // This is a synthetic unbound Storage probe, not a seeded mission/delivery.
 // Its owner-only read policy uses auth.uid directly rather than an RBAC helper.
 const unboundBytes=localFixturePdf(['SYNTHETIC LOCAL SESSION REVOCATION PROBE - NOT A DELIVERY']);
 unboundStoragePath=`${claims.sub}/${randomUUID()}/${fixture.manifest.runId}/session-revocation.pdf`;
 const unbound={storage_bucket:'delivery-proofs',storage_object_path:unboundStoragePath,declared_sha256:sha256(unboundBytes)};
 const unboundUpload=await fixture.resources.admin.storage.from(unbound.storage_bucket).upload(unbound.storage_object_path,unboundBytes,{contentType:'application/pdf',upsert:false});assert.equal(unboundUpload.error,null);
 stage='before-delete';
 const [definition]=await fixture.resources.database`select encode(extensions.digest(pg_get_functiondef('public.get_client_identity_review_context_v1(uuid)'::regprocedure),'sha256'),'hex')as sha256`;rpcDefinitionSha256=definition.sha256;
 const [authorization]=await fixture.resources.database`select encode(extensions.digest(coalesce(pg_get_functiondef(to_regprocedure('private.current_auth_session_active_v1()')),'ABSENT')||pg_get_functiondef('private.has_org_role(uuid,text[],uuid)'::regprocedure)||pg_get_functiondef('private.has_platform_role(text[],uuid)'::regprocedure),'sha256'),'hex')as sha256`;authorizationRuntimeSha256=authorization.sha256;
 const beforeUser=await client.auth.getUser(token);assert.equal(beforeUser.error,null);assert.equal(beforeUser.data.user?.id,claims.sub);
 const beforeRpcStatus=await protectedRpc();assert.equal(beforeRpcStatus,200);
 const beforeSelf=await selfRead();assert.equal(beforeSelf.status,200);assert.equal(beforeSelf.ownRowRead,true);
 const beforeObject=await privateObject();assert.equal(beforeObject.status,200);assert.equal(beforeObject.privateDocumentBytesReturned,true);
 const beforeUnbound=await privateObject(unbound);assert.equal(beforeUnbound.status,200);assert.equal(beforeUnbound.privateDocumentBytesReturned,true);
 const [before]=await fixture.resources.database`select count(*)::int as count from auth.sessions s join auth.users u on u.id=s.user_id where s.id=${claims.session_id}::uuid and s.user_id=${claims.sub}::uuid and u.email=${`p05-e2e-central-${fixture.manifest.runId}@example.invalid`}`;
 assert.equal(before.count,1);
 stage='delete-owned-session';
 const deleted=await fixture.resources.database`delete from auth.sessions where id=${claims.session_id}::uuid and user_id=${claims.sub}::uuid returning id`;assert.equal(deleted.length,1);
 const [remaining]=await fixture.resources.database`select count(*)::int as count from auth.sessions where id=${claims.session_id}::uuid`;assert.equal(remaining.count,0);
 stage='same-token-after-delete';
 const afterUser=await client.auth.getUser(token),afterRpcStatus=await protectedRpc(),afterSelf=await selfRead(),afterObject=await privateObject(),afterUnbound=await privateObject(unbound);
 observation={nativeSessionRowDeleted:true,tokenWasRealNativeAal2:true,tokenWasRefreshed:false,userJwtFabricated:false,accessTokenSecondsRemaining:Math.max(0,claims.exp-Math.floor(Date.now()/1000)),beforeUserAccepted:true,beforeProtectedRpcStatus:beforeRpcStatus,beforeOwnProfileRead:true,beforePrivateStorageBytesVerified:true,beforeUnboundOwnerStorageBytesVerified:true,afterUserAccepted:!afterUser.error&&afterUser.data.user?.id===claims.sub,afterUserErrorStatus:afterUser.error?.status??null,afterProtectedRpcStatus:afterRpcStatus,afterProtectedRpcAccepted:afterRpcStatus===200,immediateProtectedRpcAuthorizationDenied:[401,403].includes(afterRpcStatus),afterSelfReadStatus:afterSelf.status,afterOwnProfileRead:afterSelf.ownRowRead,immediateSelfReadAuthorizationDenied:[401,403].includes(afterSelf.status)&&!afterSelf.ownRowRead,afterPrivateObjectStatus:afterObject.status,afterPrivateDocumentBytesReturned:afterObject.privateDocumentBytesReturned,immediatePrivateStorageAuthorizationDenied:afterObject.authorizationDenied,afterUnboundOwnerStorageStatus:afterUnbound.status,afterUnboundOwnerStorageBytesReturned:afterUnbound.privateDocumentBytesReturned,immediateUnboundOwnerStorageAuthorizationDenied:afterUnbound.authorizationDenied};
 if(requireImmediateRevocation){
  assert.equal(observation.immediateProtectedRpcAuthorizationDenied,true,'IMMEDIATE_PROTECTED_RPC_REVOCATION_REQUIRED');
  assert.equal(observation.immediateSelfReadAuthorizationDenied,true,'IMMEDIATE_SELF_READ_REVOCATION_REQUIRED');
  assert.equal(observation.immediatePrivateStorageAuthorizationDenied,true,'IMMEDIATE_PRIVATE_STORAGE_REVOCATION_REQUIRED');
  assert.equal(observation.immediateUnboundOwnerStorageAuthorizationDenied,true,'IMMEDIATE_UNBOUND_OWNER_STORAGE_REVOCATION_REQUIRED');
 }
}catch(error){failure=error;}
finally{
 let storageClean=true;
 if(unboundStoragePath&&fixture)try{const removed=await fixture.resources.admin.storage.from('delivery-proofs').remove([unboundStoragePath]);assert.equal(removed.error,null);}catch(error){failure??=error;storageClean=false;}
 try{await fixture?.cleanup();cleanupVerified=storageClean;}catch(error){failure??=error;}
 try{sourceAfter=await sourceIdentity(root);}catch(error){failure??=error;}
}
const sourceUnchanged=!!sourceBefore&&sourceBefore.applicationAndRecipeTreeSha256===sourceAfter?.applicationAndRecipeTreeSha256&&sourceBefore.gitHead===sourceAfter?.gitHead;
if(requireImmediateRevocation&&!sourceUnchanged)failure??=new Error('LOCAL_SESSION_DIAGNOSTIC_SOURCE_CHANGED');
const provisionStage=typeof failure?.provisionStage==='string'&&/^[A-Za-z0-9 _-]{1,100}$/u.test(failure.provisionStage)?failure.provisionStage:null;
const rawDiagnostic=failure?.cause?.proofDiagnostic;
const provisionDiagnostic=rawDiagnostic&&/^[A-Z0-9_]{1,80}$/u.test(rawDiagnostic.operation)?rawDiagnostic:null;
const report={schemaVersion:1,scope:'NEW_SYNTHETIC_LOCAL_GOTRUE_SESSION_ONLY',startedAt,completedAt:new Date().toISOString(),status:failure?'FAILED':requireImmediateRevocation?'VERIFIED_TARGETED_RPC_SELF_AND_PRIVATE_STORAGE_REVOCATION':'OBSERVED',stage,provisionStage,provisionDiagnostic,cleanupVerified,sourceBefore:sourceBefore??null,sourceAfter:sourceAfter??null,sourceUnchanged,rpcDefinitionSha256:rpcDefinitionSha256??null,authorizationRuntimeSha256:authorizationRuntimeSha256??null,observation:observation??null,failureCode:failure?'LOCAL_SESSION_REVOCATION_DIAGNOSTIC_FAILED':null};
await mkdir(resolve(root,'artifacts/test-results/local-acceptance'),{recursive:true,mode:0o700});
await writeFile(resolve(root,'artifacts/test-results/local-acceptance/native-session-revocation.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(report));if(failure)process.exitCode=1;
