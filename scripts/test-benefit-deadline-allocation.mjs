import {readFileSync} from "node:fs";
import {spawn,spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import {randomBytes} from "node:crypto";

const template=process.argv[2];
if(!template||!/^matricia_delivery_[a-z0-9_]{1,42}$/u.test(template))throw new Error("Explicit local delivery clone required; MAIN is refused.");
const database="matricia_delivery_benefit_time_"+randomBytes(6).toString("hex");
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
 if(!fixture.includes(marker))throw new Error("DEADLINE_FIXTURE_SOURCE_CHANGED");
 const seed=fixture.slice(0,fixture.indexOf(marker))+
  "\nselect pg_temp.actor254(1);insert into manual254 values('deadline-before',pg_temp.propose254(4,'NONE',null,null)),('deadline-after',pg_temp.propose254(5,'NONE',null,null));"+
  "\nselect pg_temp.actor254(2);do $$declare p jsonb;begin for p in select v from manual254 where k in('deadline-before','deadline-after')loop perform public.decide_benefit_admission_policy_v1((p->>'policy_id')::uuid,p->>'content_hash',true,'TEST_DEADLINE_APPROVAL','TEST independent final allocation policy');end loop;end$$;commit;";
 sync(database,seed);
 for(const [benefit,patched]of [[4,false],[5,true]]){
  if(patched)sync(database,readFileSync(resolve(root,"supabase/migrations/20261031268062_benefit_reserve_final_allocation_guard.sql"),"utf8"));
  let marked=false,contender,signal;
  const started=new Promise(resolveStart=>{signal=resolveStart;});
  const locker=session("begin;select 1 from public.credit_lots where organization_id='b2540000-0000-4000-8000-000000000001'for update;\n\\echo FIRST_RESERVED\nselect pg_sleep(2);commit;",()=>{
   if(marked)return;marked=true;
   const command=reserve(1,benefit,"TEST-254-late-allocation-"+benefit).replace("interval'1 day'","interval'400 milliseconds'");
   contender=session("begin;set local application_name='benefit_deadline_contender';set local lock_timeout='5s';"+actor(3)+command+"commit;");signal();
  });
  await Promise.race([started,locker.then(()=>{if(!marked)throw new Error("DEADLINE_LOT_LOCK_NOT_OBSERVED");})]);
  let waiting=false;
  for(let probe=0;probe<8;probe++){
   waiting=sync(database,"select exists(select 1 from pg_stat_activity where datname=current_database()and application_name='benefit_deadline_contender'and wait_event_type='Lock'and wait_event in('transactionid','tuple'));")==="t";
   if(waiting)break;await new Promise(resolveProbe=>setTimeout(resolveProbe,25));
  }
  const lockResult=await locker,result=await contender;
  if(lockResult.code!==0||!waiting)throw new Error("DEADLINE_REAL_FEFO_WAIT_REQUIRED");
  if(!patched){
   if(result.code!==0)throw new Error("DEADLINE_BASELINE_NOT_REPRODUCED "+result.errors);
   const expired=sync(database,"select count(*)from public.benefit_redemptions where benefit_version_id='f2540000-0000-4000-8000-000000000004'and reservation_expires_at<clock_timestamp();");
   if(expired!=="1")throw new Error("DEADLINE_BASELINE_EXPIRY_NOT_REAL");
   process.stdout.write("Before268062: actual FEFO lock wait permits an already expired committed reservation (reproduced)\n");
  }else{
   if(result.code===0||!result.errors.includes("BENEFIT_RESERVATION_EXPIRED"))throw new Error("DEADLINE_GUARD_FAILED "+JSON.stringify(result));
   const effects=sync(database,"select (select count(*)from public.benefit_redemptions where benefit_version_id='f2540000-0000-4000-8000-000000000005')::text||':'||(select count(*)from public.benefit_redemption_admissions_v1 a join public.benefit_redemptions r on r.id=a.redemption_id where r.benefit_version_id='f2540000-0000-4000-8000-000000000005')::text||':'||(select count(*)from public.credit_lot_movements where idempotency_key='TEST-254-late-allocation-5')::text||':'||(select count(*)from public.credit_ledger_entries where idempotency_key='TEST-254-late-allocation-5')::text;");
   if(effects!=="0:0:0:0")throw new Error("DEADLINE_PARTIAL_FINANCIAL_EFFECTS");
   process.stdout.write("After268062: same real FEFO wait -> BENEFIT_RESERVATION_EXPIRED, financial effects0:0:0:0\n");
  }
 }
 // Cached old reservation is preserved, but no new expired reservation is sold.
 const replay=sync(database,"begin;"+actor(3)+reserve(1,4,"TEST-254-late-allocation-4").replace("clock_timestamp()+interval'1 day'","(select reservation_expires_at from public.benefit_redemptions where benefit_version_id='f2540000-0000-4000-8000-000000000004')")+"commit;");
 if(!replay.includes("BENEFIT_RESERVED"))throw new Error("DEADLINE_AUTHORIZED_REPLAY_CHANGED");
 process.stdout.write("Authorized cached expired reservation replay preserved\n");
}finally{
 if(created){sync("postgres",'drop database "'+database+'";');process.stdout.write("Isolated deadline database removed\n");}
}
