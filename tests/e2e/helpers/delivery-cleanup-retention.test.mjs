import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {retainBoundDeliveryObjects} from './p24-p26-completion-run.mjs';

test('cleanup retains bound bytes and only removes unbound uploads',async()=>{
  const bytes=Buffer.from('synthetic immutable evidence');
  const digest=createHash('sha256').update(bytes).digest('hex');
  const removed=[];
  const database=async(_strings,name)=>name==='bound.pdf'?[{evidence_hash:digest}]:[];
  const admin={storage:{from:()=>({download:async()=>({data:new Blob([bytes]),error:null}),remove:async paths=>{removed.push(...paths);return{error:null};}})}};
  await retainBoundDeliveryObjects(database,admin,[{name:'bound.pdf'},{name:'unbound.pdf'}]);
  assert.deepEqual(removed,['unbound.pdf']);
});

test('a changed retained proof fails cleanup without deleting evidence',async()=>{
  const database=async()=>[{evidence_hash:'0'.repeat(64)}];
  const admin={storage:{from:()=>({download:async()=>({data:new Blob(['changed']),error:null}),remove:async()=>assert.fail('must not delete')})}};
  await assert.rejects(retainBoundDeliveryObjects(database,admin,[{name:'bound.pdf'}]),/RETAINED_DELIVERY_HASH_MISMATCH/);
});

test('a missing retained proof fails cleanup without deleting evidence',async()=>{
  const database=async()=>[{evidence_hash:'0'.repeat(64)}];
  const admin={storage:{from:()=>({download:async()=>({data:null,error:{code:'missing'}}),remove:async()=>assert.fail('must not delete')})}};
  await assert.rejects(retainBoundDeliveryObjects(database,admin,[{name:'bound.pdf'}]),/RETAINED_DELIVERY_READ_FAILED/);
});
