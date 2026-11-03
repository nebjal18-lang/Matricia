import{test}from'node:test';import assert from'node:assert/strict';
import{requiredFlows,requiredActors,ownerRoutes,widths,locales}from'./plan.mjs';
import{validateOwnState,validateCanonicalSourceTarget}from'./safety.mjs';
import{resolve}from'node:path';
const token='11111111-1111-4111-8111-111111111111',tag=token.replaceAll('-','').slice(0,16),root='/workspace/provider-browser';
const state={token,label:`matricia.provider-browser-test=${token}`,network:`matricia_provider_browser_${tag}`,database:`matricia_provider_browser_db_${tag}`,directory:resolve(root,'work/provider-browser-isolated',token),children:[`matricia_provider_browser_db_${tag}`],appPort:19273,gatewayPort:19274};
test('Provider setup cannot adopt a Client, shared, remote or differently owned target',()=>{assert.equal(validateOwnState(state,root),state);for(const delta of [{label:`matricia.client-browser-test=${token}`},{database:'supabase_db_Matricia'},{directory:'/workspace/client-browser-verification/work/client-browser-isolated/'+token},{appPort:443},{children:['supabase_auth_Matricia']}])assert.throws(()=>validateOwnState({...state,...delta},root));});
test('source must remain the explicit no-network setup source, never a live linked project',()=>{assert.throws(()=>validateCanonicalSourceTarget({token,name:'supabase_db_Matricia',isolated:true,network:'none',publicPorts:0}));});
test('native actor separation and complete acceptance coverage are explicit',()=>{assert.equal(new Set(requiredActors).size,requiredActors.length);for(const actor of ['provider-owner','client-owner','technician-assigned','technician-unassigned','provider-viewer','foreign-provider','compliance-reviewer','finance-author','finance-reviewer'])assert.ok(requiredActors.includes(actor));assert.equal(requiredFlows.length,7);assert.deepEqual(widths,[375,390,768,1440]);assert.deepEqual(locales,['fr','ar']);assert.ok(ownerRoutes.includes('sous-traitant/identite'));assert.ok(requiredFlows.find(f=>f.id==='contract-delivery').assertions.includes('unassigned_technician_upload_denied'));});

import{candidateId}from'./candidate.mjs';
test('build/setup cannot silently target an unpinned branch or symbolic HEAD',()=>{for(const value of[undefined,'HEAD','b0be596','https://production.invalid', 'g'.repeat(40)])assert.throws(()=>candidateId(value));assert.equal(candidateId('a'.repeat(40)),'a'.repeat(40));});
