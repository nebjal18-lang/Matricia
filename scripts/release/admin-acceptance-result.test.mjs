import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedAdminAcceptanceStatus, finalizeAdminAcceptance } from '../p05-e2e/admin-acceptance-result.mjs';
const rpc = [{ actor:'admin', schemaValid:true, authenticatedAal2:true, code:null },{ actor:'ordinary', authenticatedAal2:true, code:'42501' }];
const browser = ['fr','ar'].flatMap(locale => [360,1280].map(width => ({locale,width,realSearchAndSelection:true,ownOrganizationHeadingVerified:true})));
test('RPC-only success is explicitly a probe and cannot certify the browser', () => {
  assert.equal(completedAdminAcceptanceStatus({probeOnly:true,rpc,browser:[]}), 'PROBE_PASSED');
  assert.equal(completedAdminAcceptanceStatus({probeOnly:false,rpc,browser:[]}), 'FAILED');
  assert.equal(completedAdminAcceptanceStatus({probeOnly:false,rpc,browser}), 'PASSED');
});
test('missing denial, language, viewport or actual selection fails acceptance', () => {
  for(const input of [{rpc:rpc.slice(0,1),browser},{rpc,browser:browser.slice(0,3)},{rpc,browser:browser.map(result=>({...result,ownOrganizationHeadingVerified:false}))}]) assert.equal(completedAdminAcceptanceStatus({probeOnly:false,...input}), 'FAILED');
});
test('browser-close and actor-cleanup failures do not skip other actors, verification, database close or evidence', async () => {
  const calls=[];const proof={status:'PASSED',cleanup:{verified:false}};
  const steps=[
    {code:'BROWSER_CLOSE_FAILED',run:async()=>{calls.push('browser');throw Error('private details must not be recorded');}},
    {code:'ACTOR_1_CLEANUP_FAILED',run:async()=>{calls.push('actor1');throw Error('private details');}},
    {code:'ACTOR_2_CLEANUP_FAILED',run:async()=>{calls.push('actor2');}},
    {code:'VERIFY_FAILED',run:async()=>{calls.push('verify');proof.cleanup.verified=true;}},
    {code:'DATABASE_CLOSE_FAILED',run:async()=>{calls.push('database');}},
  ];
  const passed=await finalizeAdminAcceptance({proof,steps,persist:async()=>{calls.push('evidence');}});
  assert.equal(passed,false);assert.deepEqual(calls,['browser','actor1','actor2','verify','database','evidence']);
  assert.deepEqual(proof.cleanupFailures,['BROWSER_CLOSE_FAILED','ACTOR_1_CLEANUP_FAILED']);
  assert.equal(JSON.stringify(proof).includes('private details'),false);
});
test('a failed cleanup verification prevents an otherwise successful probe', async () => {
  const proof={status:'PROBE_PASSED',cleanup:{verified:false}};
  assert.equal(await finalizeAdminAcceptance({proof,steps:[],persist:async()=>{}}),false);
});
