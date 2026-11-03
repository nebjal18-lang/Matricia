import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {connect} from 'node:net';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {buildChildEnvironment} from '../../../scripts/p05-e2e/security.mjs';

async function listening(host){
 return new Promise((done,reject)=>{
  const socket=connect({host,port:5173});
  socket.setTimeout(1000,()=>{socket.destroy();reject(new Error('LOCAL_HTTP_PORT_PROBE_TIMEOUT'));});
  socket.once('connect',()=>{socket.destroy();done(true);});
  socket.once('error',error=>{socket.destroy();if(error.code==='ECONNREFUSED')done(false);else reject(new Error('LOCAL_HTTP_PORT_PROBE_FAILED'));});
 });
}
/** Own exactly one Next CLI child; never reuse or kill a foreign process. */
export function ownedLocalHttpServer(root,config){
 assert.equal(config.runtimeMode,'isolated-local-docker');assert.equal(config.localDockerVerified,true);
 const url=new URL(config.baseUrl);
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
 assert.equal(url.protocol,'http:');assert.equal(url.port,'5173');assert.equal(url.pathname,'/');
 assert.equal(url.username,'');assert.equal(url.password,'');assert.equal(url.search,'');assert.equal(url.hash,'');
 const host=url.hostname.replace(/^\[|\]$/gu,'');
 let child,closed,exited=false;
 return{
  async start(){
   assert.equal(await listening(host),false,'LOCAL_HTTP_PORT_ALREADY_IN_USE');
   const env={...buildChildEnvironment(process.env,{}),APP_ENV:'development',PAYMENT_PROVIDER:'DEMO',PAYMENT_PROVIDER_ALLOWLIST:'DEMO',PAYMENT_LIVE_ENABLED:'false',EMAIL_DELIVERY_MODE:'DEMO',EMAIL_LIVE_DELIVERY_ENABLED:'false',MARKETING_PUBLISH_MODE:'sandbox',MARKETING_LIVE_PUBLISHING_ENABLED:'false',MARKETING_CONTENT_PROVIDER_URL:'',MARKETING_CONTENT_PROVIDER_API_KEY:'',MARKETING_CONTENT_PROVIDER_ENDPOINT_ALLOWLIST:'',NEXT_TELEMETRY_DISABLED:'1'};
   child=spawn(process.execPath,[resolve(root,'apps/web/node_modules/next/dist/bin/next'),'dev','--port','5173','--hostname',host],{cwd:resolve(root,'apps/web'),env,shell:false,stdio:['ignore','pipe','pipe']});
   child.stdout.resume();child.stderr.resume();
   closed=new Promise(done=>{child.once('exit',()=>{exited=true;done();});child.once('error',()=>{exited=true;done();});});
   const end=Date.now()+120_000;
   while(Date.now()<end){
    assert.equal(exited,false,'LOCAL_HTTP_SERVER_EXITED');
    try{const response=await fetch(`${config.baseUrl}/fr`,{redirect:'manual',signal:AbortSignal.timeout(2000)});await response.arrayBuffer();if(response.status<500)return;}catch{}
    await delay(250);
   }
   throw new Error('LOCAL_HTTP_SERVER_NOT_READY');
  },
  async stop(){
   if(!child)return;
   if(!exited)child.kill('SIGTERM');
   await Promise.race([closed,delay(10_000,undefined,{ref:false})]);
   if(!exited){child.kill('SIGKILL');await Promise.race([closed,delay(5000,undefined,{ref:false})]);}
   assert.equal(exited,true,'LOCAL_HTTP_CHILD_NOT_CLOSED');
   const end=Date.now()+5000;
   while(Date.now()<end){if(!await listening(host))return;await delay(100);}
   throw new Error('LOCAL_HTTP_OWNED_SERVER_PORT_NOT_CLOSED');
  },
 };
}
