import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";

const database=process.argv[2];
if(!database||!/^matricia_delivery_[a-z0-9_]+$/u.test(database)){
  throw new Error("Provide the explicit local pre-268060 clone database (matricia_delivery_*). MAIN/template databases are refused.");
}
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const fixture=readFileSync(resolve(root,"supabase/tests/0254_benefit_admission_policies.test.sql"),"utf8");
const marker="select pg_temp.actor254(3);set local role authenticated;";
if(!fixture.includes(marker))throw new Error("UPGRADE_FIXTURE_SOURCE_CHANGED");
const prefix=fixture.slice(0,fixture.indexOf(marker)).replaceAll("254","25a").replaceAll("TEST_ADMISSION25a_","TEST_ADMISSION25A_");
const migration=readFileSync(resolve(root,"supabase/migrations/20261031268060_benefit_admission_policies.sql"),"utf8").trim();
if(!migration.startsWith("begin;")||!migration.endsWith("commit;"))throw new Error("UPGRADE_MIGRATION_BOUNDARY_CHANGED");
const checks=readFileSync(resolve(root,"supabase/fixtures/0254_benefit_admission_upgrade_checks.sql"),"utf8");
// Every old native reservation, DDL, new admission and independent legacy review
// stay inside one transaction. ROLLBACK restores the clone; no trigger is disabled.
const sql="do $$begin if to_regclass('public.benefit_admission_policy_versions_v1')is not null then raise exception'UPGRADE_EXPECTS_PRE_268060_CLONE';end if;end$$;\n"
 +prefix+"\nselect pg_temp.actor25a(3);set local role authenticated;\ninsert into manual25a values('legacy',pg_temp.reserve25a(1,1,1,'TEST-25a-native-before-upgrade'));\nreset role;\n"
 +migration.slice("begin;".length,-"commit;".length)+"\n"+checks;
const result=spawnSync("docker",["exec","-i","supabase_db_Matricia","psql","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1"],{input:sql,encoding:"utf8",timeout:120000,maxBuffer:4*1024*1024});
const output=(result.stdout??"")+"\n"+(result.stderr??"");
for(const line of output.split("\n"))if(/^\s*(ok \d|not ok|1\.\.|ROLLBACK)|ERROR:|Failed test|Looks like you failed/u.test(line))process.stdout.write(line.trim()+"\n");
if(result.error||result.status!==0||/not ok|ERROR:|Looks like you failed/u.test(output)||!output.includes("ROLLBACK"))throw new Error("BENEFIT_ADMISSION_UPGRADE_FAILED");
