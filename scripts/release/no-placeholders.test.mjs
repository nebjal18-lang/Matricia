import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const script=fileURLToPath(new URL('../validate-no-placeholders.ts',import.meta.url));
async function inspect(files){
 const root=await mkdtemp(join(tmpdir(),'matricia-marker-gate-'));
 try{
  for(const[path,source]of Object.entries(files)){const target=resolve(root,path);await mkdir(resolve(target,'..'),{recursive:true});await writeFile(target,source);}
  return spawnSync(process.execPath,['--experimental-strip-types',script],{cwd:root,encoding:'utf8',timeout:10000});
 }finally{await rm(root,{recursive:true,force:true});}
}
test('unfinished work in a business module fails the actual gate',async()=>{
 const result=await inspect({'apps/web/modules/payments/action.ts':'// TO'+'DO: apply a real financial command\nexport const value=1;'});
 assert.equal(result.error,undefined);assert.equal(result.status,1);assert.match(result.stderr,/apps\/web\/modules\/payments\/action\.ts/);
});
test('test assertions may discuss markers while adjacent product code remains checked',async()=>{
 const accepted=await inspect({'apps/web/modules/payments/action.test.ts':'expect(html).not.toMatch(/TO'+'DO|FIX'+'ME/);','apps/web/modules/payments/action.ts':'export const ready=true;'});
 assert.equal(accepted.error,undefined);assert.equal(accepted.status,0);
 const rejected=await inspect({'apps/web/modules/payments/action.spec.tsx':'const text="TB'+'D";','apps/web/modules/payments/form.tsx':'// FIX'+'ME: implement submission'});
 assert.equal(rejected.status,1);assert.match(rejected.stderr,/form\.tsx/);
});
test('SQL migrations stay covered and ordinary input hints are accepted',async()=>{
 const rejected=await inspect({'supabase/migrations/001.sql':'-- TO'+'DO: add restrictive RLS'});assert.equal(rejected.status,1);assert.match(rejected.stderr,/001\.sql/);
 const accepted=await inspect({'apps/web/modules/auth/form.tsx':'export const form=<input placeholder="Email" className="placeholder:text-muted"/>; const {placeholder}=props; const state="todo";'});assert.equal(accepted.status,0);
});

test('explicit unfinished sentinels and lowercase comment markers fail',async()=>{
 for(const source of ['// todo: finish the request handler','export const label="PLACE'+'HOLDER";']){
  const result=await inspect({'apps/web/modules/requests/action.ts':source});assert.equal(result.status,1);
 }
});
