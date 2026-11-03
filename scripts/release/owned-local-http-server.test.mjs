import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ownedLocalHttpServer} from '../../tests/e2e/helpers/owned-local-http-server.mjs';

const config=baseUrl=>({runtimeMode:'isolated-local-docker',localDockerVerified:true,baseUrl});
test('accepts every verified local origin supported by the fixture loader without starting a server',()=>{
 for(const host of ['localhost','127.0.0.1','[::1]']){
  const server=ownedLocalHttpServer('/unused',config(`http://${host}:5173`));assert.equal(typeof server.start,'function');assert.equal(typeof server.stop,'function');
 }
});
test('rejects remote origins, credentials and unexpected route/configuration before any start',()=>{
 for(const url of ['https://localhost:5173','http://production.example.invalid:5173','http://localhost:3000','http://fixture:invalid@localhost:5173','http://localhost:5173/fr','http://localhost:5173/?mode=remote','http://localhost:5173/#fragment'])assert.throws(()=>ownedLocalHttpServer('/unused',config(url)));
 assert.throws(()=>ownedLocalHttpServer('/unused',{...config('http://localhost:5173'),runtimeMode:'hosted-nonproduction'}));
 assert.throws(()=>ownedLocalHttpServer('/unused',{...config('http://localhost:5173'),localDockerVerified:false}));
});
