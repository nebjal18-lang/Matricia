import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
const require=createRequire(resolve(config.candidateRoot,'apps/worker/package.json'));
const {createClient}=require('@supabase/supabase-js');
const {pollOutboxOnce}=await import(pathToFileURL(resolve(config.candidateRoot,'apps/worker/src/poller.ts')).href);
const {createSupabaseOutboxRepository}=await import(pathToFileURL(resolve(config.candidateRoot,'apps/worker/src/outbox-repository.ts')).href);
const {createWorkerDispatcher}=await import(pathToFileURL(resolve(config.candidateRoot,'apps/worker/src/dispatcher.ts')).href);
// Supabase-js expects /rest/v1. This lab exposes PostgREST directly, with no
// gateway or host port; only this HTTP transport prefix is adapted.
const nativeFetch=globalThis.fetch;
const transport=async(input,init)=>nativeFetch(String(input).replace('http://127.0.0.1:3000/rest/v1/','http://127.0.0.1:3000/'),init);
const actualClient=createClient('http://127.0.0.1:3000',config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transport}});
const repository=createSupabaseOutboxRepository(actualClient);
const receipts=new Map();let targetDeliveries=0;let polling=false;
const dispatcher=createWorkerDispatcher({documentScanConsumer:{consume:async()=>null},canScanDocuments:()=>false,dispatchUrl:new URL('http://127.0.0.1:7500/events'),webhookSecret:config.webhookSecret});
const server=createServer(async(req,res)=>{
 if(req.headers.authorization!==`Bearer ${config.webhookSecret}`){res.writeHead(401);res.end();return;}
 try{
  if(req.url==='/state'&&req.method==='GET'){res.setHeader('content-type','application/json');res.end(JSON.stringify({targetDeliveries,targetLogicalReceipts:receipts.has(config.targetEventId)?1:0,logicalReceipts:receipts.size,polling}));return;}
  if(req.url==='/poll'&&req.method==='POST'){
   if(polling){res.writeHead(409);res.end();return;}
   polling=true;try{const result=await pollOutboxOnce(repository,dispatcher,config.workerId,50);res.setHeader('content-type','application/json');res.end(JSON.stringify(result));}finally{polling=false;}return;
  }
  if(req.url==='/events'&&req.method==='POST'){
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1048576)throw new Error('LIMIT');chunks.push(chunk);}
   const event=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!['OrganizationCreatedV1','ClientProfileVersionCreatedV1'].includes(event.eventType)||typeof event.id!=='string'){res.writeHead(422);res.end();return;}
   receipts.set(event.id,true);
   if(event.id===config.targetEventId){targetDeliveries+=1;if(targetDeliveries===1){res.writeHead(500);res.end();return;}if(targetDeliveries===2){res.setHeader('x-matricia-outbox-consumer','INVALID_LAB_ACK');res.writeHead(204);res.end();return;}}
   res.setHeader('x-matricia-outbox-consumer','TERMINAL_OBSERVABILITY');res.writeHead(204);res.end();return;
  }
  res.writeHead(404);res.end();
 }catch{res.writeHead(500);res.end();}
});
server.listen(7500,'127.0.0.1');
