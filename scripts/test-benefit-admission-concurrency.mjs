import {readFileSync} from "node:fs";
import {spawn,spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import {randomBytes} from "node:crypto";

const template=process.argv[2];
if(!template||!/^matricia_delivery_[a-z0-9_]{1,42}$/u.test(template))throw new Error("Explicit local delivery clone required; MAIN is refused.");
const database="matricia_delivery_benefit_race_"+randomBytes(6).toString("hex");
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
function sync(db,sql){
 const r=spawnSync("docker",["exec","-i","supabase_db_Matricia","psql","-X","-U","postgres","-d",db,"-v","ON_ERROR_STOP=1","-At"],{input:sql,encoding:"utf8",timeout:60000,maxBuffer:1024*1024});
 if(r.error||r.status!==0)throw new Error((r.stderr??"LOCAL_DB_ERROR").slice(0,4000));return r.stdout.trim();
}
function session(sql,onMarker){
 let output="",errors="";const proc=spawn("docker",["exec","-i","supabase_db_Matricia","psql","-X","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-At"],{stdio:["pipe","pipe","pipe"]});
 const done=new Promise((resolveDone,reject)=>{proc.on("error",reject);proc.stdout.on("data",value=>{output+=value.toString();if(output.includes("FIRST_RESERVED"))onMarker?.();});proc.stderr.on("data",value=>{errors+=value.toString();});proc.on("close",code=>resolveDone({code,output,errors}));});
 proc.stdin.end(sql);return done;
}
function actor(n){return "select set_config('request.jwt.claim.sub','a2540000-0000-4000-8000-"+String(n).padStart(12,"0")+"',true);select set_config('request.jwt.claims','{\"sub\":\"a2540000-0000-4000-8000-"+String(n).padStart(12,"0")+"\",\"role\":\"authenticated\",\"aal\":\"aal2\"}',true);set local role authenticated;";}
function reserve(org,benefit,key){return "select public.reserve_benefit_credits('b2540000-0000-4000-8000-"+String(org).padStart(12,"0")+"','c2540000-0000-4000-8000-"+String(org).padStart(12,"0")+"','f2540000-0000-4000-8000-"+String(benefit).padStart(12,"0")+"',1,clock_timestamp()+interval'1 day','"+key+"');";}
let created=false;
try{
 sync("postgres",'create database "'+database+'" template "'+template+'";');created=true;
 const fixture=readFileSync(resolve(root,"supabase/tests/0254_benefit_admission_policies.test.sql"),"utf8");
 const marker="select pg_temp.actor254(3);set local role authenticated;";
 if(!fixture.includes(marker))throw new Error("RACE_FIXTURE_SOURCE_CHANGED");
 const seed=fixture.slice(0,fixture.indexOf(marker))+
  "\nselect pg_temp.actor254(1);insert into manual254 values('race-capacity',pg_temp.propose254(1,'GLOBAL_VERSION',3,1)),('race-quota',pg_temp.propose254(4,'GLOBAL_VERSION',1,null));"+
  "\nselect pg_temp.actor254(2);do $$declare p jsonb;begin for p in select v from manual254 where k in('race-capacity','race-quota')loop perform public.decide_benefit_admission_policy_v1((p->>'policy_id')::uuid,p->>'content_hash',true,'TEST_RACE_APPROVAL','TEST independent concurrency policy');end loop;end$$;commit;";
 sync(database,seed);
 for(const [benefit,code]of [[1,"BENEFIT_CAPACITY_UNAVAILABLE"],[4,"BENEFIT_QUOTA_EXCEEDED"]]){
  let marked=false,second,signalSecond;const secondStarted=new Promise(resolveSecond=>{signalSecond=resolveSecond;});
  const first=session("begin;"+actor(3)+reserve(1,benefit,"TEST-254-race-first-"+benefit)+"\n\\echo FIRST_RESERVED\nselect pg_sleep(2);commit;",()=>{
   if(marked)return;marked=true;second=session("begin;set local application_name='benefit_race_contender_"+benefit+"';set local lock_timeout='5s';"+actor(4)+reserve(2,benefit,"TEST-254-race-second-"+benefit)+"commit;");signalSecond();
  });
  await Promise.race([secondStarted,first.then(()=>{if(!marked)throw new Error("RACE_MARKER_MISSING");})]);
  let waited=false;
  for(let probe=0;probe<8;probe++){
   waited=sync(database,"select exists(select 1 from pg_stat_activity where datname=current_database()and application_name='benefit_race_contender_"+benefit+"'and wait_event_type='Lock'and wait_event='advisory');")==="t";
   if(waited)break;await new Promise(resolveProbe=>setTimeout(resolveProbe,25));
  }
  const firstResult=await first;if(!marked||!second||firstResult.code!==0)throw new Error("RACE_FIRST_FAILED "+firstResult.errors);
  const secondResult=await second;if(!waited)throw new Error("RACE_ADVISORY_WAIT_NOT_OBSERVED");if(secondResult.code===0||!secondResult.errors.includes(code))throw new Error("RACE_GUARD_FAILED "+JSON.stringify(secondResult));
  const count=sync(database,"select count(*)from public.benefit_redemptions where benefit_version_id='f2540000-0000-4000-8000-"+String(benefit).padStart(12,"0")+"';");
  if(count!=="1")throw new Error("RACE_DUPLICATE_REDEMPTION");
  process.stdout.write(code+": actual advisory wait observed; exactly one committed reservation, contender denied\n");
 }
 const counts=sync(database,"select (select count(*)from public.benefit_redemptions where benefit_version_id::text like'f2540000-%')::text||':'||(select count(*)from public.benefit_redemption_admissions_v1 where organization_id::text like'b2540000-%')::text||':'||(select count(*)from public.credit_lot_movements where organization_id::text like'b2540000-%'and movement_type='RESERVE')::text;");
 if(counts!=="2:2:2")throw new Error("RACE_PARTIAL_FINANCIAL_EFFECTS");
 process.stdout.write("Admissions, redemptions and credit movements: 2:2:2\n");
}finally{
 // No backend termination/cancellation, table truncation, guard disabling or
 // general cleanup. Only the freshly generated isolated database is dropped.
 if(created){sync("postgres",'drop database "'+database+'";');process.stdout.write("Isolated race database removed\n");}
}
