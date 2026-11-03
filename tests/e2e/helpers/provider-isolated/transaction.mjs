// Opt-in owned TEST transaction runner; no COMMIT is sent to PostgreSQL.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareSqlTest } from '../../../../scripts/db-test-support.mjs';
import { loadOwnState, docker } from '../client-isolated/safety.mjs';
if(process.env.APP_ENV!=='development')throw Error('EXPLICIT_DEVELOPMENT_REQUIRED');
const args=process.argv.slice(2),value=name=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
if(args.some(a=>!(/^--(?:browser-root|migration|test|output)=\//u.test(a)||/^--target-token=[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(a))))throw Error('EXPLICIT_ABSOLUTE_LOCAL_ARGUMENTS_REQUIRED');
const invokingRoot=process.cwd();
if(!value('browser-root')||!value('output')||!value('target-token'))throw Error('EXPLICIT_TARGET_AND_OUTPUT_REQUIRED');
const browserRoot=resolve(value('browser-root')),output=resolve(value('output'));
if(!output.startsWith(resolve(invokingRoot,'work')+'/'))throw Error('IGNORED_WORK_OUTPUT_REQUIRED');
const migrations=args.filter(a=>a.startsWith('--migration=')).map(a=>resolve(a.slice(12))),tests=args.filter(a=>a.startsWith('--test=')).map(a=>resolve(a.slice(7)));
if(!migrations.length||!tests.length)throw Error('MIGRATIONS_AND_TESTS_REQUIRED');
if(tests.length!==1)throw Error('ONE_SQL_TEST_PER_ROLLBACK_TRANSACTION_REQUIRED');
process.chdir(browserRoot);
const state=await loadOwnState();
if(state.token!==value('target-token'))throw Error('EXPLICIT_OWNED_CLIENT_TARGET_REQUIRED');
await mkdir(output,{recursive:true});
const query=input=>docker(['exec','-i',state.database,'psql','-X','-U','supabase_admin','-d','postgres','-Atq','-v','ON_ERROR_STOP=1'],{input,timeout:90000});
const fingerprintSql=`select md5(jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.prosrc,p.proconfig,p.prosecdef,p.proowner,p.proacl)order by p.oid)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname!~'^pg_'and n.nspname<>'information_schema'),
 'relations',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions)order by c.oid)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname!~'^pg_'and n.nspname<>'information_schema'),
 'columns',(select jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attname,a.atttypid,a.attnotnull,a.attidentity,a.attgenerated)order by a.attrelid,a.attnum)from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where a.attnum>0 and n.nspname!~'^pg_'and n.nspname<>'information_schema'),
 'policies',(select jsonb_agg(to_jsonb(p)order by p.oid)from pg_policy p),
 'constraints',(select jsonb_agg(jsonb_build_array(oid,conrelid,conname,pg_get_constraintdef(oid))order by oid)from pg_constraint where connamespace in(select oid from pg_namespace where nspname!~'^pg_'and nspname<>'information_schema'))
 )::text);`;
const before=query(fingerprintSql).trim(),receipts=[],sql=[];
for(const path of migrations){const bytes=await readFile(path,'utf8');if(!/^\s*(?:(?:--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)\s*)*begin\s*;/i.test(bytes)||!/commit;\s*$/i.test(bytes))throw Error('BOUNDED_MIGRATION_REQUIRED');const body=bytes.replace(/^\s*(?:(?:--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)\s*)*begin\s*;/i,'').replace(/commit;\s*$/i,'');if(/^\s*(?:commit|rollback)\s*;/im.test(body))throw Error('EMBEDDED_TRANSACTION_CONTROL_REFUSED');sql.push(body);receipts.push({kind:'migration',file:path,sha256:createHash('sha256').update(bytes).digest('hex')});}
for(const path of tests){const bytes=await readFile(path,'utf8');if(/\b(?:session_replication_role|disable\s+trigger|enable\s+trigger)\b/i.test(bytes))throw Error('FIXTURE_GUARD_BYPASS_REFUSED');if(/^\s*commit\s*;/im.test(bytes))throw Error('TEST_COMMIT_REFUSED');const body=prepareSqlTest(bytes).replace(/^\s*(?:--[^\n]*\n\s*)*begin;\s*/i,'').replace(/rollback;\s*$/i,'');sql.push(body);receipts.push({kind:'test',file:path,sha256:createHash('sha256').update(bytes).digest('hex')});}
let text='',failure=null;
try{text=docker(['exec','-i',state.database,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:'begin;\n'+sql.join('\n')+'\nrollback;',timeout:90000});}catch(error){text=String(error.stdout??'')+'\n'+String(error.stderr??'');failure='SQL_TRANSACTION_FAILED_CONNECTION_CLOSED';}
const after=query(fingerprintSql).trim(),assertions=[...text.matchAll(/^\s*(not )?ok\s+(\d+)\b[^\n]*$/gm)],plans=[...text.matchAll(/^\s*1\.\.(\d+)\s*$/gm)];
const passed=!failure&&before===after&&text.trim().endsWith('ROLLBACK')&&plans.length===tests.length&&assertions.length===plans.reduce((n,p)=>n+Number(p[1]),0)&&assertions.every((a,i)=>!a[1]&&Number(a[2])===plans.flatMap(p=>Array.from({length:Number(p[1])},(_,j)=>j+1))[i])&&!/Bail out!/i.test(text)&&!/^(?:\s*not )?\s*ok\b[^\n]*#\s*(?:SKIP|TODO)/im.test(text);
await writeFile(resolve(output,'transaction.log'),text,{mode:0o600});
const receipt={scope:'OWNED_458_SCHEMA_ROLLBACK_TRANSACTION_NOT_FRESH_REPLAY',targetToken:state.token,targetLabel:state.label,sourceBaselineArchiveSha256:state.baselineArchiveSha256,additionalMigrations:state.additionalMigrations??[],files:receipts,status:passed?'PASSED':'FAILED',assertions:assertions.length,planCount:plans.length,beforeSchemaFingerprint:before,afterSchemaFingerprint:after,rollbackSchemaRestored:before===after,commitSent:false,failure};
await writeFile(resolve(output,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({status:receipt.status,assertions:receipt.assertions,rollbackSchemaRestored:receipt.rollbackSchemaRestored,commitSent:false,receipt:resolve(output,'receipt.json')}));if(!passed)process.exitCode=1;
