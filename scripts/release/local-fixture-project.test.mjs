import test from 'node:test';
import assert from 'node:assert/strict';
import { validFixtureProject } from '../../tests/e2e/helpers/fixture-project.mjs';

test('a local fixture cannot impersonate a hosted or production acceptance project',()=>{
 const oldMode=process.env.E2E_LOCAL_ISOLATED,oldProject=process.env.E2E_LOCAL_PROJECT_ID;
 try{
  process.env.E2E_LOCAL_ISOLATED='1';process.env.E2E_LOCAL_PROJECT_ID='Matricia';
  const local={environment:'development',projectRef:'local-Matricia',proof:{runtimeMode:'isolated-local-docker',authentication:'REAL_GOTRUE_OTP_AND_TOTP'}};
  assert.equal(validFixtureProject(local),true);
  for(const overrides of [{projectRef:'abcdefghijklmnopqrst'},{environment:'production'},{projectRef:'local-other'},{proof:{runtimeMode:'isolated-local-docker'}}])assert.equal(validFixtureProject({...local,...overrides}),false);
  delete process.env.E2E_LOCAL_ISOLATED;
  assert.equal(validFixtureProject(local),false);
  assert.equal(validFixtureProject({environment:'development',projectRef:'abcdefghijklmnopqrst'}),true);
  assert.equal(validFixtureProject({environment:'production',projectRef:'abcdefghijklmnopqrst'}),false);
 }finally{if(oldMode===undefined)delete process.env.E2E_LOCAL_ISOLATED;else process.env.E2E_LOCAL_ISOLATED=oldMode;if(oldProject===undefined)delete process.env.E2E_LOCAL_PROJECT_ID;else process.env.E2E_LOCAL_PROJECT_ID=oldProject;}
});
