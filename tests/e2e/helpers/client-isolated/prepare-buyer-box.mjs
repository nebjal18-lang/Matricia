import { requireDevelopment, loadOwnState, docker } from './safety.mjs';
requireDevelopment();
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { nativeBuyerBoxBootstrapSql } from './buyer-bootstrap.mjs';
import { seedNativeBuyerBox } from './buyer-native-orchestrator.mjs';
const state=await loadOwnState(),actors=JSON.parse(await readFile(resolve(state.directory,'actors.private.json'))),actor=label=>{const found=actors.find(actor=>actor.label===label);if(!found)throw new Error('MISSING_NATIVE_SETUP_ACTOR:'+label);return found;};
const ownerActor=actor('owner'),buyerActor=actor('buyer'),authorActor=actor('reviewer'),reviewerActor=actor('finance-reviewer');
if(ownerActor.organizationId!==buyerActor.organizationId)throw new Error('SAME_REAL_OWNER_BUYER_ORGANIZATION_REQUIRED');
const require=createRequire(resolve('apps/web/package.json')),{createClient}=require('@supabase/supabase-js'),directory=resolve(state.directory,'buyer-box');await mkdir(directory,{recursive:true});
const trace=[];
const ownFetch=async(input,init)=>{const response=await fetch(input,init),url=new URL(typeof input==='string'?input:input.url??input.toString());if(url.pathname.startsWith('/rest/v1/rpc/')){let data;try{data=await response.clone().json();}catch{}trace.push({rpc:url.pathname.split('/').at(-1),http:response.status,args:init?.body?JSON.parse(init.body):null,data});await writeFile(resolve(directory,'rpc-trace.private.json'),JSON.stringify(trace,null,2),{mode:0o600});}return response;};
const config={auth:{persistSession:false,autoRefreshToken:false},global:{fetch:ownFetch}},api=`http://127.0.0.1:${state.gatewayPort}`;
async function nativeClient(actor){const client=createClient(api,state.anonKey,config);if((await client.auth.setSession(actor.session)).error)throw new Error('GENUINE_NATIVE_SESSION_REQUIRED:'+actor.label);return client;}
const owner=await nativeClient(ownerActor),buyer=await nativeClient(buyerActor),financeAuthor=await nativeClient(authorActor),financeReviewer=await nativeClient(reviewerActor),service=createClient(api,state.serviceKey,config);
const bootstrap=nativeBuyerBoxBootstrapSql({organizationId:ownerActor.organizationId,ownerId:ownerActor.userId,buyerId:buyerActor.userId,financeAuthorId:authorActor.userId,financeReviewerId:reviewerActor.userId});
await writeFile(resolve(directory,'bootstrap.private.json'),JSON.stringify({planId:bootstrap.planId,planVersionId:bootstrap.planVersionId}),{mode:0o600});
try{
 docker(['exec','-i',state.database,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:'begin;\n'+bootstrap.sql+'\ncommit;'});
 const proof=await seedNativeBuyerBox({owner,buyer,financeAuthor,financeReviewer,service,organizationId:ownerActor.organizationId,planId:bootstrap.planId,planVersionId:bootstrap.planVersionId,loadPaymentEventId:async event=>{if(!/^TEST-NATIVE-BOX-PAID-[A-Z0-9]{8}$/u.test(event))throw new Error('EXACT_TEST_PAYMENT_EVENT_REQUIRED');return docker(['exec','-i',state.database,'psql','-X','-U','supabase_admin','-d','postgres','-Atq','-v','ON_ERROR_STOP=1'],{input:`select id::text from public.subscription_payment_events where provider_event_id='${event}';`}).trim();}});
 await writeFile(resolve(directory,'fixture-proof.json'),JSON.stringify({...proof,status:'READY',platformRoleBootstrap:'TEST_STAFF_ONLY_NOT_GOVERNED_ROLE_ASSIGNMENT_CERTIFICATION',nativeOnboardingCertified:false,realExternalPspPurchase:false},null,2));console.log(JSON.stringify({status:'BUYER_FUNDED_DEMO_FIXTURE_READY',nativeGovernance:true,externalPspCertified:false,actualRpcCalls:trace.length,evidence:resolve(directory,'fixture-proof.json')}));
}catch(error){const message=String(error.message).replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gu,'[REDACTED]').slice(0,500);await writeFile(resolve(directory,'setup-failure.json'),JSON.stringify({status:'FAILED',message,successfulRpcCalls:trace.filter(call=>call.http<400).length},null,2));console.log(JSON.stringify({status:'FAILED',message,evidence:resolve(directory,'setup-failure.json')}));process.exitCode=1;}
