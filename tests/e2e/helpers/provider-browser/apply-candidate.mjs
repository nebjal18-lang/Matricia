import{requireDevelopment,loadOwnState,docker}from'./safety.mjs';requireDevelopment();
if(!process.argv.includes('--coordinated'))throw Error('ORCHESTRATOR_COORDINATED_STAGE_REQUIRED');
import{readFile,writeFile}from'node:fs/promises';import{resolve}from'node:path';import{candidateSnapshot}from'./candidate.mjs';
const pin=await candidateSnapshot(process.argv.find(a=>a.startsWith('--candidate='))?.slice(12)),s=await loadOwnState();
if(!['RESTORED','ACTORS_READY'].includes(s.status)||s.schemaStatus!=='BASELINE_CANONICAL458'||s.baselineMigrationCount!==458||!s.canonicalSourceManifest||s.candidate)throw Error('FRESH_CANONICAL458_PROVIDER_BASELINE_REQUIRED');
const source=JSON.parse(await readFile(resolve(s.canonicalSourceManifest,'..','summary.json')));if(source.migrations.length!==458)throw Error('EXACT_CANONICAL458_SOURCE_REQUIRED');
for(const[index,migration]of source.migrations.entries())if(migration.file!==pin.migrations[index]?.file||migration.sha256!==pin.migrations[index]?.sha256)throw Error('UNCHANGED_CANONICAL458_PREFIX_REQUIRED');
s.additionalMigrations=[];
for(const migration of pin.migrations.slice(458)){
 const sql=await readFile('supabase/migrations/'+migration.file,'utf8');
 docker(['exec','-i',s.database,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql});
 s.additionalMigrations.push(migration);await writeFile(resolve(s.directory,'state.private.json'),JSON.stringify(s),{mode:0o600});console.log(JSON.stringify({status:'OWNED_PROVIDER_DELTA_APPLIED',file:migration.file}));
}
const security=JSON.parse(docker(['exec','-i',s.database,'psql','-X','-U','supabase_admin','-d','postgres','-Atq','-v','ON_ERROR_STOP=1'],{input:`select json_build_object('tablesWithoutRls',(select count(*)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relkind in('r','p')and not c.relrowsecurity),'pgtapApiExecutable',(select coalesce(bool_or(has_function_privilege(r.name,p.oid,'execute')),false)from pg_proc p join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'join pg_extension e on e.oid=d.refobjid cross join(values('anon'),('authenticated'),('service_role'))r(name)where e.extname='pgtap'));`}));
if(security.tablesWithoutRls!==0||security.pgtapApiExecutable!==false)throw Error('PROVIDER_RUNTIME_RLS_AND_PGTAP_ACL_REQUIRED');
s.candidate=pin;s.schemaStatus='CANDIDATE_READY';if(s.status!=='ACTORS_READY')s.status='CANDIDATE_READY';await writeFile(resolve(s.directory,'state.private.json'),JSON.stringify(s),{mode:0o600});
await writeFile(resolve(s.directory,'candidate-proof.json'),JSON.stringify({scope:'OWNED_PROVIDER_BROWSER_DATABASE_SETUP_NOT_GREEN_SQL_RECEIPT',candidate:pin,status:s.status,baselineArchiveSha256:s.baselineArchiveSha256,baselineMigrationCount:458,additionalMigrations:s.additionalMigrations,security,greenSqlReceipt:false},null,2));console.log(JSON.stringify({status:s.status,candidate:pin.commit,appTree:pin.appTree,deltaMigrations:s.additionalMigrations.length,greenSqlReceipt:false}));
