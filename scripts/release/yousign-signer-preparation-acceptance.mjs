import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {prepareSqlTest} from "../db-test-support.mjs";

const [container,database]=process.argv.slice(2);
if(!/^supabase_db_MatriciaV1Closure[0-9]+$/u.test(container??"")||!/^matricia_[a-z0-9_]*validation_[0-9]{8}$/u.test(database??""))throw new Error("EXPLICIT_DISPOSABLE_SIGNER_VALIDATION_REQUIRED");
const root=new URL("../../",import.meta.url);
const command=["exec","-i",container,"psql","-X","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-At"];
const installed=spawnSync("docker",command,{input:"select (to_regprocedure('public.get_my_yousign_preparation_v1(uuid)') is not null)::text||'|'||(select count(*)=0 from public.signature_provider_configs where provider_code='YOUSIGN')::text;",encoding:"utf8"});
if(installed.status!==0||installed.stdout.trim()!=="true|true")throw new Error("EMPTY_OWNED_SIGNER_WORKSPACE_REQUIRED");
const fixture=prepareSqlTest(readFileSync(new URL("supabase/tests/0241_signature_canonical_source_archives.test.sql",root),"utf8")).replace(/^begin;/u,"").replace(/select\s*\*\s*from\s+finish\(\);\s*rollback;\s*$/iu,"");
const native=readFileSync(new URL("supabase/tests/helpers/yousign-transport-acceptance.sql",root),"utf8");
const cut=native.indexOf("select public.configure_yousign_signer_v1(");
if(cut<0)throw new Error("NATIVE_SIGNER_FIXTURE_CONTRACT_CHANGED");
const additional=readFileSync(new URL("supabase/tests/helpers/yousign-signer-preparation-workspace.sql",root),"utf8");
const claimMarker="select is((select v->>'outcome' from y391 where k='claim'),'CLAIMED'";
if(!native.includes(claimMarker))throw new Error("NATIVE_DISPATCH_FIXTURE_CONTRACT_CHANGED");
const claimed=`
select pg_temp.y391_user('a2200000-0000-4000-8000-000000000001');
select is(public.get_my_yousign_preparation_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'))->>'canConfigure','false','durable claim freezes editing before any native request reference');
select throws_ok($$select public.configure_yousign_signer_v1((select(v->>'signer_id')::uuid from y391 where k='client-signer'),'Altered','Name','fr',jsonb_build_array(jsonb_build_object('documentSha256',repeat('1',64),'page',1,'x',40,'y',600)))$$,'55000','YOUSIGN_SIGNER_CONFIGURATION_FROZEN','frozen workspace is enforced by the write command');
select pg_temp.y391_service();
`;
const frozen=`
select pg_temp.y391_user('a2200000-0000-4000-8000-000000000001');
select is(public.get_my_yousign_preparation_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'))->>'canConfigure','false','completed native dispatch freezes the preparation workspace');
select is(public.get_my_yousign_preparation_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'))->>'firstName','Client','readback preserves only the caller explicitly saved identity');
select is(public.get_my_yousign_preparation_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'))#>>'{fields,0,page}','1','readback preserves the saved document placement');
select is(jsonb_array_length(public.get_my_yousign_preparations_v1()),0,'signed envelopes do not remain pending preparations');
`;
const remainder=native.slice(cut).replace(claimMarker,()=>`${claimed}\n${claimMarker}`);
const sql=`begin;\n${fixture}\n${native.slice(0,cut)}\n${additional}\n${remainder}\n${frozen}\nselect * from finish();\nrollback;\n`;
const result=spawnSync("docker",command,{input:sql,encoding:"utf8",maxBuffer:16*1024*1024});
const output=`${result.stdout??""}\n${result.stderr??""}`;
process.stdout.write(output.split("\n").filter(line=>/^(?:not ok|ok |1\.\.|#)|ERROR:|CONTEXT:/.test(line)).join("\n")+"\n");
if(result.error||result.status!==0||/^not ok\b/mu.test(output)||!/^1\.\.[1-9][0-9]*$/mu.test(output))process.exitCode=1;
