import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLocalSuiteEvidence } from './local-acceptance-evidence.mjs';

test('local acceptance refuses stale, hosted, incomplete and uncleared results',()=>{
 const now=Date.now();
 const value={environment:'development-local-docker',status:'PASSED',completedAt:new Date(now+1).toISOString(),browser:{executed:4,passed:4,failed:0,skipped:0,flaky:0},cleanupVerified:true};
 assert.equal(validateLocalSuiteEvidence(value,{expectedTests:4,startedAt:now}),4);
 for(const change of [{environment:'staging'},{status:'FAILED'},{completedAt:new Date(now-1).toISOString()},{cleanupVerified:false},{browser:{...value.browser,skipped:1}},{browser:{...value.browser,flaky:1}},{browser:{...value.browser,executed:3}}])assert.throws(()=>validateLocalSuiteEvidence({...value,...change},{expectedTests:4,startedAt:now}));
 assert.throws(()=>validateLocalSuiteEvidence(value,{expectedTests:4,startedAt:now,mode:'FULL_P24_P26'}));
 assert.throws(()=>validateLocalSuiteEvidence(value,{expectedTests:4,startedAt:now,requiredProof:{realTrialActivations:2}}));
 assert.throws(()=>validateLocalSuiteEvidence({...value,proof:{realTrialActivations:1}},{expectedTests:4,startedAt:now,requiredProof:{realTrialActivations:2}}));
 assert.equal(validateLocalSuiteEvidence({...value,proof:{realTrialActivations:2}},{expectedTests:4,startedAt:now,requiredProof:{realTrialActivations:2}}),4);
});
