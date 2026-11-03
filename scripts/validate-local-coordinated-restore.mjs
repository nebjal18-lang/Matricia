#!/usr/bin/env node
import {execFileSync,spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile,rm,statfs,realpath,lstat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {assertLab,digest,technicalJwt,validateStorageTar,replayRoleCreates,sanitizeLabDiagnostic,proofKind} from './local-coordinated-restore/safety.mjs';

const toolRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const helpers=join(toolRoot,'scripts/local-coordinated-restore');
const args=process.argv.slice(2);
assertLab(args.length===1&&['--plan','--execute'].includes(args[0]),'ARGUMENTS');
const plan={proofKind,sourceDatabaseAccess:false,network:'none + shared lab loopback',hostPorts:0,laboratories:'A then B, never simultaneous',minimumWorkspaceGiB:2,minimumVfsPreflightGiB:7,exclusiveDockerBuildBrowserRequired:true,minimumTmpGiB:2,minimumAvailableRamGiB:8,pgdataTmpfsMiB:1536,postgresMemoryMiB:3072,maximumLeaseWaitSeconds:360,userJwtSigning:false,hostedStagingCertification:false,reviewProtocol:'scripts/local-coordinated-restore/README.md'};
if(args[0]==='--plan'){console.log(JSON.stringify(plan,null,2));process.exit(0);}
assertLab(process.env.APP_ENV==='development','DEVELOPMENT_REQUIRED');
assertLab(process.env.LOCAL_RESTORE_EXCLUSIVE_DOCKER==='1','EXCLUSIVE_DOCKER_BUILD_BROWSER_WINDOW_REQUIRED');
process.umask(0o077);
const candidateRoot=await realpath(process.env.LOCAL_RESTORE_CANDIDATE_ROOT??toolRoot);
assertLab(candidateRoot.startsWith('/workspace/')||candidateRoot.startsWith('/tmp/'),'CANDIDATE_LOCAL_WORKSPACE_REQUIRED');
const token=randomUUID();const labelKey='matricia.coordinated-restore';const label=`${labelKey}=${token}`;
const prefix=`matricia_restore_${token.replaceAll('-','')}`;
const privateRoot=join('/tmp',prefix);const evidenceRoot=join(toolRoot,'work/coordinated-restore',token);
await mkdir(privateRoot,{recursive:true,mode:0o700});await mkdir(evidenceRoot,{recursive:true,mode:0o700});
const dockerEnv={...process.env,DOCKER_HOST:'unix:///var/run/docker.sock'};
for(const key of ['DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[key];
const summary={...plan,startedAt:new Date().toISOString(),status:'FAILED',cleanup:'pending',assertions:0,phases:[],migrations:0};
let protectedInventoryCaptured=false;let protectedContainers=[];let currentLab=null;let candidateFingerprint;let imageIds;let images;let imageSizes;let storageDriver;let diagnostics=null;const startupLogs=new Map();
const secret=randomBytes(32).toString('hex');const serviceKey=technicalJwt('service_role',secret);const anonKey=technicalJwt('anon',secret);const webhookSecret=randomBytes(32).toString('hex');
const environmentFile=join(privateRoot,'services.env');const workerConfig=join(privateRoot,'worker.json');
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
function docker(parameters,options={}){return execFileSync('docker',parameters,{env:dockerEnv,encoding:'utf8',timeout:90000,maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe'],...options});}
function sql(lab,source){return docker(['exec','-i',lab.db,'psql','-X','-U','supabase_admin','-d','postgres','-Atq','-v','ON_ERROR_STOP=1'],{input:source});}
function jsonSql(lab,source){return JSON.parse(sql(lab,source).trim());}
function check(condition,code){summary.assertions+=1;assertLab(condition,code);}
function phase(name){summary.phases.push({name,at:new Date().toISOString()});console.log(JSON.stringify({phase:name,proofKind}));}
async function budget(){
 const [workspace,tmp,memory]=await Promise.all([statfs(candidateRoot,{bigint:true}),statfs('/tmp',{bigint:true}),readFile('/proc/meminfo','utf8')]);
 summary.lastBudget={workspaceFreeBytes:String(workspace.bavail*workspace.bsize),tmpFreeBytes:String(tmp.bavail*tmp.bsize)};
 check(workspace.bavail*workspace.bsize>=2n*1024n**3n,'WORKSPACE_BUDGET');check(tmp.bavail*tmp.bsize>=2n*1024n**3n,'TMP_BUDGET');
 if(protectedInventoryCaptured){const current=inventory();check(current.every(item=>protectedContainers.some(before=>before.id===item.id)),'FOREIGN_CONTAINER_CREATED_DURING_EXCLUSIVE_WINDOW');}
 const available=Number(memory.match(/^MemAvailable:\s+(\d+) kB$/m)?.[1]??0);check(available>=8*1024**2,'RAM_BUDGET');
}
async function candidate(){
 const files=(await readdir(join(candidateRoot,'supabase/migrations'))).filter(name=>name.endsWith('.sql')).sort();
 const migrations=await Promise.all(files.map(async file=>({file,bytes:await readFile(join(candidateRoot,'supabase/migrations',file))})));
 const workerFiles=['poller.ts','outbox-repository.ts','dispatcher.ts','dispatch-errors.ts'];
 const workerHashes=await Promise.all(workerFiles.map(async file=>[file,digest(await readFile(join(candidateRoot,'apps/worker/src',file)))]));
 const {sourceIdentity}=await import(pathToFileURL(join(candidateRoot,'scripts/release/local-acceptance-evidence.mjs')).href);
 const identity=await sourceIdentity(candidateRoot);
 const recipeFiles=['scripts/validate-local-coordinated-restore.mjs',...(await readdir(helpers)).filter(name=>name.endsWith('.mjs')||name.endsWith('.md')).sort().map(name=>`scripts/local-coordinated-restore/${name}`)];
 const recipeHashes=await Promise.all(recipeFiles.map(async file=>[file,digest(await readFile(join(toolRoot,file)))]));
 return {identity,recipeHash:digest(JSON.stringify(recipeHashes)),sha:execFileSync('git',['rev-parse','HEAD'],{cwd:candidateRoot,encoding:'utf8'}).trim(),migrations,manifestHash:digest(JSON.stringify(migrations.map(({file,bytes})=>({file,sha256:digest(bytes)})))),workerHash:digest(JSON.stringify(workerHashes))};
}
async function verifyCandidate(){const latest=await candidate();check(latest.sha===candidateFingerprint.sha&&latest.manifestHash===candidateFingerprint.manifestHash&&latest.workerHash===candidateFingerprint.workerHash&&JSON.stringify(latest.identity)===JSON.stringify(candidateFingerprint.identity)&&latest.recipeHash===candidateFingerprint.recipeHash,'CANDIDATE_CHANGED_DURING_PROBE');}
function inventory(){
 const ids=docker(['ps','-aq']).trim().split(/\s+/).filter(Boolean);if(!ids.length)return[];
 const template='{"id":{{json .Id}},"name":{{json .Name}},"lab":{{json (index .Config.Labels "matricia.coordinated-restore")}},"mounts":{{json .Mounts}}}';
 return docker(['inspect','--format',template,...ids]).trim().split('\n').map(line=>JSON.parse(line)).filter(row=>row.lab!==token).map(row=>({id:row.id,name:row.name,mounts:row.mounts.map(m=>({type:m.Type,name:m.Name??null,source:m.Source,destination:m.Destination})).sort((a,b)=>a.destination.localeCompare(b.destination))}));
}
function mounts(){
 // Expose only the executed recipe, worker source and installed dependency trees.
 // Never mount checkout-wide .env, browser states, uploads or .git into a lab.
 const paths=[helpers,join(candidateRoot,'node_modules'),join(candidateRoot,'apps/worker/src'),join(candidateRoot,'apps/worker/node_modules'),join(candidateRoot,'apps/worker/package.json')];
 return [...new Set(paths)].flatMap(path=>['--mount',`type=bind,src=${path},dst=${path},readonly`]);
}
function sanitize(value){return sanitizeLabDiagnostic(value,[secret,serviceKey,anonKey,webhookSecret]);}
async function creationBudget(image){
 await budget();if(storageDriver==='vfs'){
  const free=await statfs(candidateRoot,{bigint:true});const needed=2n*1024n**3n+2n*BigInt(imageSizes[image])+256n*1024n**2n;
  check(free.bavail*free.bsize>=needed,'VFS_NEXT_CONTAINER_MARGIN');
 }
}
async function run(name,image,parameters=[],extra=[]){
 await creationBudget(image);const log={chunks:[],bytes:0,exitCode:null};startupLogs.set(name,log);
 const child=spawn('docker',['run','--pull=never','--name',name,'--label',label,'--log-driver','none',...extra,image,...parameters],{env:dockerEnv,stdio:['ignore','pipe','pipe']});
 const capture=bytes=>{if(log.bytes<131072){const bounded=bytes.subarray(0,131072-log.bytes);log.chunks.push(bounded);log.bytes+=bounded.length;}};
 child.stdout.on('data',capture);child.stderr.on('data',capture);child.on('error',()=>{log.exitCode=-1;});child.on('exit',code=>{log.exitCode=code;});
 await waitUntil(()=>{const inspect=JSON.parse(docker(['inspect',name]))[0];if(inspect.State.Status==='exited')throw new Error('LOCAL_RESTORE_SERVICE_EXITED');return inspect.State.Status==='running';},'CONTAINER_START_FAILED',45);
}
function captureDiagnostics(){
 const result=[];for(const[name,log]of startupLogs){let state=null,environmentKeyNames=[];try{const item=JSON.parse(docker(['inspect',name]))[0];state={status:item.State.Status,exitCode:item.State.ExitCode,error:sanitize(item.State.Error??''),health:item.State.Health?.Status??null};environmentKeyNames=(item.Config.Env??[]).map(value=>value.split('=',1)[0]).filter(value=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)).sort();}catch{/* container may already have terminated */}
  result.push({role:name.slice(name.lastIndexOf('_')+1),state,processExitCode:log.exitCode,environmentKeyNames,startup:sanitize((()=>{const text=Buffer.concat(log.chunks).toString('utf8');return text.slice(0,text.lastIndexOf('\n')+1);})())});
 }return result;
}
async function waitUntil(test,code,seconds=40){
 const end=Date.now()+seconds*1000;while(Date.now()<end){try{if(await test())return;}catch{/* bounded readiness, never emit credential-bearing errors */}await new Promise(done=>setTimeout(done,500));}throw new Error(`LOCAL_RESTORE_${code}`);
}
async function startDatabase(kind){
 await budget();const lab={kind,db:`${prefix}_${kind}_db`,auth:`${prefix}_${kind}_auth`,rest:`${prefix}_${kind}_rest`,storage:`${prefix}_${kind}_storage`,worker:`${prefix}_${kind}_worker`,files:join(privateRoot,`storage-${kind}`)};
 check(!currentLab,'SIMULTANEOUS_LAB_FORBIDDEN');await mkdir(lab.files,{recursive:true,mode:0o700});
 await run(lab.db,imageIds.database,['postgres','-D','/etc/postgresql','-c','shared_preload_libraries=pg_cron','-c','cron.database_name=postgres','-c','cron.use_background_workers=on','-c','max_connections=50','-c','shared_buffers=128MB','-c','max_wal_size=128MB','-c','min_wal_size=32MB'],['--network','none','--memory','3g','--memory-swap','3g','--env-file',environmentFile,'--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=1536m']);
 currentLab=lab;
 await waitUntil(()=>{docker(['exec',lab.db,'pg_isready','-h','127.0.0.1','-p','5432','-U','postgres']);return true;},'POSTGRES_UNAVAILABLE');
 const dataDirectory=sql(lab,'show data_directory;').trim();check(dataDirectory==='/var/lib/postgresql/data'||dataDirectory.startsWith('/var/lib/postgresql/data/'),'PGDATA_OUTSIDE_TMPFS');
 const inspected=JSON.parse(docker(['inspect',lab.db]))[0];check(inspected.HostConfig.NetworkMode==='none'&&Object.keys(inspected.HostConfig.PortBindings??{}).length===0,'LAB_NETWORK_OR_PORTS');check(Boolean(inspected.HostConfig.Tmpfs?.['/var/lib/postgresql/data']),'PGDATA_MOUNT_MISSING');
 sql(lab,"alter system set cron.launch_active_jobs='off';select pg_reload_conf();");
 sql(lab,`alter role supabase_auth_admin password ${quote(secret)};alter role supabase_storage_admin password ${quote(secret)};alter role authenticator password ${quote(secret)};`);
 return lab;
}
async function bootstrap(lab){
 await creationBudget(imageIds.auth);
 docker(['run','--rm','--pull=never','--name',`${prefix}_${lab.kind}_auth_bootstrap`,'--label',label,'--log-driver','none','--network',`container:${lab.db}`,'--env-file',environmentFile,imageIds.auth,'auth','migrate']);
 await creationBudget(imageIds.storage);
 docker(['run','--rm','--pull=never','--name',`${prefix}_${lab.kind}_storage_bootstrap`,'--label',label,'--log-driver','none','--network',`container:${lab.db}`,'--env-file',environmentFile,'--entrypoint','node',imageIds.storage,'dist/scripts/migrate-call.js']);
}
async function startServices(lab){
 const common=['--network',`container:${lab.db}`,'--env-file',environmentFile,'--read-only','--tmpfs','/tmp:rw,nosuid,nodev,size=32m','--memory','512m'];
 await run(lab.auth,imageIds.auth,[],common);await run(lab.rest,imageIds.rest,[],common);
 await run(lab.storage,imageIds.storage,[],[...common,'--mount',`type=bind,src=${workerConfig},dst=/lab/worker.json,readonly`,'--user',`${process.getuid()}:${process.getgid()}`,'--mount',`type=bind,src=${lab.files},dst=/var/lib/storage`,...mounts()]);
 await waitUntil(async()=>{const response=await http(lab,9999,'/health',null);return response.status===200;},'AUTH_UNAVAILABLE');
 await waitUntil(async()=>{const response=await http(lab,3000,'/',anonKey);return response.status===200;},'REST_UNAVAILABLE');
 await waitUntil(async()=>{const response=await http(lab,5000,'/status',serviceKey);return [200,204].includes(response.status);},'STORAGE_UNAVAILABLE');
}
async function http(lab,port,path,bearer,method='GET',body,contentType='application/json'){
 const headers={...(bearer?{authorization:`Bearer ${bearer}`,apikey:anonKey}:{}),...(body===undefined?{}:{'content-type':contentType})};
 const input={url:`http://127.0.0.1:${port}${path}`,method,headers,...(body===undefined?{}:{bodyBase64:Buffer.from(Buffer.isBuffer(body)?body:JSON.stringify(body)).toString('base64')})};
 const response=JSON.parse(docker(['exec','-i',lab.storage,'node',join(helpers,'http.mjs')],{input:JSON.stringify(input)}));
 check(!response.error,'HTTP_TRANSPORT');const bytes=Buffer.from(response.bodyBase64,'base64');
 return {status:response.status,bytes,json:response.contentType?.includes('json')?JSON.parse(bytes.toString('utf8')||'null'):null};
}
async function rpc(lab,name,args,bearer,expectedStatus=200){const response=await http(lab,3000,`/rpc/${name}`,bearer,'POST',args);check(response.status===expectedStatus,`RPC_${name.toUpperCase()}_STATUS`);return response.json;}
async function authenticate(lab,email,create=false){
 if(create){const created=await http(lab,9999,'/admin/users',serviceKey,'POST',{email,email_confirm:true});check([200,201].includes(created.status),'AUTH_USER_CREATE');}
 const link=await http(lab,9999,'/admin/generate_link',serviceKey,'POST',{type:'magiclink',email});check(link.status===200&&typeof link.json?.hashed_token==='string','AUTH_LINK');
 const verified=await http(lab,9999,'/verify',anonKey,'POST',{type:'magiclink',token_hash:link.json.hashed_token});check(verified.status===200&&typeof verified.json?.access_token==='string'&&verified.json?.user?.id,'AUTH_VERIFY');
 return {token:verified.json.access_token,id:verified.json.user.id,email};
}
async function proveAccess(lab,probe,owner,other){
 const own=await http(lab,3000,`/client_compliance_documents?id=eq.${probe.documentId}&select=id`,owner.token);check(own.status===200&&own.json?.length===1,'OWNER_DOCUMENT_RLS');
 const foreign=await http(lab,3000,`/client_compliance_documents?id=eq.${probe.documentId}&select=id`,other.token);check(foreign.status===200&&foreign.json?.length===0,'FOREIGN_DOCUMENT_RLS');
 const path=`/${probe.bucket}/${probe.objectPath}`;
 const bytes=await http(lab,5000,`/object/authenticated${path}`,owner.token);check(bytes.status===200&&bytes.bytes.length===probe.size&&digest(bytes.bytes)===probe.sha256,'OWNER_STORAGE_BYTES');
 for(const [kind,route,key]of [['OTHER',`/object/authenticated${path}`,other.token],['ANON',`/object/authenticated${path}`,anonKey],['PUBLIC',`/object/public${path}`,null]]){
  const denied=await http(lab,5000,route,key);check([400,401,403,404].includes(denied.status)&&digest(denied.bytes)!==probe.sha256,`${kind}_STORAGE_DENIED`);
 }
}
function acl(expression){return`(select jsonb_agg(jsonb_build_array(case when acl_item.grantee=0 then 'PUBLIC'else pg_get_userbyid(acl_item.grantee)end,pg_get_userbyid(acl_item.grantor),acl_item.privilege_type,acl_item.is_grantable)order by acl_item.grantee=0,pg_get_userbyid(acl_item.grantee),pg_get_userbyid(acl_item.grantor),acl_item.privilege_type,acl_item.is_grantable)from aclexplode(${expression})acl_item)`;}
function state(lab,probe){
 return jsonSql(lab,`select jsonb_build_object(
 'database',(select jsonb_build_object('name',datname,'owner',pg_get_userbyid(datdba),'acl',${acl("coalesce(datacl,acldefault('d',datdba))")})from pg_database where datname=current_database()),
 'databaseRoleSettings',(select jsonb_agg(jsonb_build_array(coalesce(d.datname,'GLOBAL'),case when r.setrole=0 then 'ALL_ROLES'else pg_get_userbyid(r.setrole)end,r.setconfig)order by coalesce(d.datname,'GLOBAL'),pg_get_userbyid(r.setrole))from pg_db_role_setting r left join pg_database d on d.oid=r.setdatabase where r.setdatabase=0 or d.datname=current_database()),
 'ownersAcl',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner),${acl("coalesce(c.relacl,acldefault((case when c.relkind='S'then'S'else'r'end)::\"char\",c.relowner))")})order by n.nspname,c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not like 'pg_%'and n.nspname<>'information_schema'and c.relkind in('r','p','v','m','S')),
 'functionAcl',(select jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_userbyid(p.proowner),${acl("coalesce(p.proacl,acldefault('f',p.proowner))")})order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname not like'pg_%'and n.nspname<>'information_schema'),
 'schemaAcl',(select jsonb_agg(jsonb_build_array(nspname,pg_get_userbyid(nspowner),${acl("coalesce(nspacl,acldefault('n',nspowner))")})order by nspname)from pg_namespace where nspname not like'pg_%'and nspname<>'information_schema'),
 'columnAcl',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,a.attname,${acl("coalesce(a.attacl,'{}'::aclitem[])")})order by n.nspname,c.relname,a.attname)from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname not like'pg_%'and n.nspname<>'information_schema'and a.attnum>0 and not a.attisdropped and a.attacl is not null),
 'defaultAcl',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),coalesce(n.nspname,'GLOBAL'),d.defaclobjtype,${acl("d.defaclacl")})order by pg_get_userbyid(d.defaclrole),coalesce(n.nspname,'GLOBAL'),d.defaclobjtype)from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace),
 'policies',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,p.polname,p.polcmd,p.polpermissive,(select jsonb_agg(case when role_id=0 then 'PUBLIC'else pg_get_userbyid(role_id)end order by role_id=0,pg_get_userbyid(role_id))from unnest(p.polroles)role_id),pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))order by n.nspname,c.relname,p.polname)from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace),
 'rls',(select jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,c.relforcerowsecurity)order by c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relkind in('r','p')),
 'roles',(select jsonb_agg(jsonb_build_array(rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolvaliduntil,rolconfig)order by rolname)from pg_roles),
 'memberships',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(roleid),pg_get_userbyid(member),pg_get_userbyid(grantor),admin_option,inherit_option,set_option)order by pg_get_userbyid(roleid),pg_get_userbyid(member),pg_get_userbyid(grantor))from pg_auth_members),
 'extensions',(select jsonb_agg(jsonb_build_array(extname,extversion)order by extname)from pg_extension),
 'cron',(select coalesce(jsonb_agg(to_jsonb(j)order by jobid),'[]')from cron.job j),
 'object',(select to_jsonb(o)from storage.objects o where bucket_id=${quote(probe.bucket)}and name=${quote(probe.objectPath)}),
 'document',(select to_jsonb(d)from public.client_compliance_documents d where id=${quote(probe.documentId)}::uuid),
 'outbox',(select to_jsonb(e)from public.event_outbox e where id=${quote(probe.eventId)}::bigint));`);
}
async function removeLab(lab){
 const ids=docker(['ps','-aq','--filter',`label=${label}`]).trim().split(/\s+/).filter(Boolean);
 if(ids.length){const objects=JSON.parse(docker(['inspect',...ids]));check(objects.every(o=>o.Config?.Labels?.[labelKey]===token&&o.Name.startsWith(`/${prefix}`)),'CLEANUP_OWNERSHIP');docker(['rm','--force','--volumes',...ids]);}
 currentLab=null;
 if(lab)await rm(lab.files,{recursive:true,force:true});
}
async function privateFilesOnly(root){
 const files=[];async function walk(path){for(const name of await readdir(path)){check(name!=='.'&&name!=='..','STORAGE_FILE_NAME');const next=join(path,name);const value=await lstat(next);check(!value.isSymbolicLink()&&(value.isFile()||value.isDirectory()),'STORAGE_SPECIAL_FILE');if(value.isDirectory())await walk(next);else files.push(next);}}await walk(root);return files;
}
try{
 phase('preflight');await budget();storageDriver=docker(['info','--format','{{.Driver}}']).trim();summary.storageDriver=storageDriver;protectedContainers=inventory();protectedInventoryCaptured=true;candidateFingerprint=await candidate();summary.candidateSha=candidateFingerprint.sha;summary.sourceIdentity=candidateFingerprint.identity;summary.toolRecipeHash=candidateFingerprint.recipeHash;summary.migrationManifestHash=candidateFingerprint.manifestHash;summary.workerHash=candidateFingerprint.workerHash;
 const replay=await readFile(join(candidateRoot,'scripts/validate-local-migration-replay.mjs'),'utf8');
 images=Object.fromEntries(['database','auth','storage'].map(key=>{const value=replay.match(new RegExp(`${key}:\\s*'([^']+)'`))?.[1];check(value&&/^[a-zA-Z0-9_./:-]+$/.test(value),'REPLAY_IMAGE_CONTRACT');return[key,value];}));images.rest='ghcr.io/supabase/postgrest:v16.2';imageIds={};imageSizes={};for(const[key,image]of Object.entries(images)){imageIds[key]=docker(['image','inspect',image,'--format','{{.Id}}']).trim();imageSizes[imageIds[key]]=Number(docker(['image','inspect',image,'--format','{{.Size}}']).trim());}
 if(storageDriver==='vfs'){const free=await statfs(candidateRoot,{bigint:true});const peak=Object.values(imageSizes).reduce((sum,size)=>sum+BigInt(size),0n)*2n+2n*1024n**3n+512n*1024n**2n;summary.requiredVfsFreeBytes=String(peak);check(free.bavail*free.bsize>=peak&&free.bavail*free.bsize>=7n*1024n**3n,'VFS_PEAK_DISK_MARGIN');}summary.images=Object.fromEntries(Object.entries(images).map(([key,image])=>[key,{image,id:imageIds[key]}]));
 await writeFile(environmentFile,[`POSTGRES_PASSWORD=${secret}`,'PGDATA=/var/lib/postgresql/data','GOTRUE_DB_DRIVER=postgres',`GOTRUE_DB_DATABASE_URL=postgresql://supabase_auth_admin:${secret}@127.0.0.1:5432/postgres`,'API_EXTERNAL_URL=http://127.0.0.1:9999','GOTRUE_SITE_URL=http://127.0.0.1:5173',`GOTRUE_JWT_SECRET=${secret}`,'GOTRUE_API_HOST=0.0.0.0','GOTRUE_API_PORT=9999','PORT=5000','GOTRUE_JWT_AUD=authenticated','GOTRUE_JWT_ADMIN_ROLES=service_role','GOTRUE_DISABLE_SIGNUP=false',`AUTH_JWT_SECRET=${secret}`,`DATABASE_URL=postgresql://supabase_storage_admin:${secret}@127.0.0.1:5432/postgres`,'STORAGE_BACKEND=file','FILE_STORAGE_BACKEND_PATH=/var/lib/storage',`ANON_KEY=${anonKey}`,`SERVICE_KEY=${serviceKey}`,'POSTGREST_URL=http://127.0.0.1:3000','REGION=local','TENANT_ID=local',`PGRST_DB_URI=postgresql://authenticator:${secret}@127.0.0.1:5432/postgres`,'PGRST_DB_SCHEMAS=public',`PGRST_JWT_SECRET=${secret}`,'PGRST_DB_ANON_ROLE=anon','PGRST_SERVER_PORT=3000',''].join('\n'),{mode:0o600});
 await writeFile(workerConfig,'{}',{mode:0o600});phase('create-lab-A');const a=await startDatabase('a');await bootstrap(a);
 for(const migration of candidateFingerprint.migrations){try{sql(a,migration.bytes);}catch{summary.failedMigration=migration.file;throw new Error('LOCAL_RESTORE_MIGRATION_FAILED');}summary.migrations+=1;if(summary.migrations%40===0){console.log(JSON.stringify({phase:'migrations',completed:summary.migrations}));await new Promise(done=>setImmediate(done));}}
 sql(a,"update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configured_at=clock_timestamp(),configuration_reference='SYNTHETIC_LOCAL_RESTORE'where singleton and environment is null;");await startServices(a);
 phase('create-native-probe');const owner=await authenticate(a,`owner-${token}@example.invalid`,true);const other=await authenticate(a,`other-${token}@example.invalid`,true);
 const organization=await rpc(a,'create_or_request_organization',{p_legal_name:'Local Restore Synthetic SARL',p_display_name:'Local Restore Synthetic',p_ice:(BigInt('0x'+token.replaceAll('-','').slice(0,12))%10n**15n).toString().padStart(15,'0'),p_owner_role:'CLIENT_OWNER',p_idempotency_key:`restore-org-${token}`,p_correlation_id:randomUUID()},owner.token);check(organization.outcome==='ORGANIZATION_CREATED','NATIVE_ORGANIZATION');
 const profile=await rpc(a,'save_client_profile_draft',{p_organization_id:organization.organization_id,p_profile:{legal_form:'SARL',incorporation_date:'2020-01-01',activity:'Sonde synthétique locale',sector:'Services',employee_count:1,registered_city:'Casablanca',registered_address:{line1:'Adresse synthétique laboratoire',country_code:'MA'},contact:{phone:'0600000000',email:owner.email},representative:{first_name:'Sonde',last_name:'Locale',title:'Gérant',email:owner.email,phone:'0600000000',power:'Sonde autorisée de laboratoire'},declarations:{accuracy_confirmed:true,representation_authorized:true},if_number:'12345678',rc_number:'123456'},p_idempotency_key:`restore-profile-${token}`,p_correlation_id:randomUUID()},owner.token);check(profile.outcome==='CLIENT_PROFILE_VERSION_CREATED','NATIVE_PROFILE');
 const {localFixturePdf}=await import(pathToFileURL(join(candidateRoot,'tests/e2e/helpers/local-fixture-pdf.mjs')).href);const pdf=localFixturePdf(['SYNTHETIC LOCAL RESTORE - NOT AN OFFICIAL DOCUMENT','Local Restore Synthetic SARL','RC: 123456']);const probe={sha256:digest(pdf),size:pdf.length};
 const reserved=await rpc(a,'begin_client_compliance_document_upload',{p_compliance_case_id:profile.compliance_case_id,p_document_type:'REGISTRATION_DOCUMENT',p_document_number:'123456',p_issuer:'Laboratoire synthétique',p_issued_on:'2020-01-01',p_expires_on:null,p_original_file_name:'local-restore-probe.pdf',p_mime_type:'application/pdf',p_size_bytes:pdf.length,p_sha256:probe.sha256,p_idempotency_key:`restore-upload-${token}`,p_correlation_id:randomUUID()},owner.token);check(reserved.document_id&&reserved.bucket&&reserved.object_path,'NATIVE_DOCUMENT_RESERVATION');Object.assign(probe,{documentId:reserved.document_id,bucket:reserved.bucket,objectPath:reserved.object_path});
 const upload=await http(a,5000,`/object/${probe.bucket}/${probe.objectPath}`,owner.token,'POST',pdf,'application/pdf');check([200,201].includes(upload.status),'NATIVE_STORAGE_UPLOAD');
 const finalized=await rpc(a,'finalize_client_compliance_document_upload',{p_document_id:probe.documentId,p_idempotency_key:`restore-finalize-${token}`,p_correlation_id:randomUUID()},owner.token);check(finalized.document_id===probe.documentId,'NATIVE_DOCUMENT_FINALIZE');await proveAccess(a,probe,owner,other);
 phase('capture-native-lease-and-cron');const originalWorker=randomUUID();const claimed=await rpc(a,'claim_outbox_events',{p_worker_id:originalWorker,p_limit:1},serviceKey);check(Array.isArray(claimed)&&claimed.length===1&&claimed[0].event_type==='OrganizationCreatedV1','NATIVE_INFORMATIONAL_LEASE');probe.eventId=String(claimed[0].id);probe.lockedAt=claimed[0].locked_at;probe.payloadHash=digest(JSON.stringify(claimed[0].payload));
 sql(a,"select cron.schedule('local_restore_probe','1 second','select 1');alter system set cron.launch_active_jobs='on';select pg_reload_conf();");await waitUntil(()=>Number(sql(a,"select count(*)from cron.job_run_details where jobid=(select jobid from cron.job where jobname='local_restore_probe')and status='succeeded';").trim())>0,'CRON_A_NOT_EXECUTED',15);
 phase('quiesce-and-backup');docker(['stop',a.auth,a.rest,a.storage]);sql(a,"alter system set cron.launch_active_jobs='off';select pg_reload_conf();");await new Promise(done=>setTimeout(done,1500));await verifyCandidate();const cut=state(a,probe);const cutHash=digest(JSON.stringify(cut));
 const databaseArchive=docker(['exec',a.db,'pg_dump','-U','supabase_admin','-d','postgres','-Fc'],{encoding:null,maxBuffer:128*1024*1024});const roles=docker(['exec',a.db,'pg_dumpall','-U','postgres','--roles-only']);check(databaseArchive.length<128*1024*1024,'DATABASE_ARCHIVE_BUDGET');
 const fileList=await privateFilesOnly(a.files);check(fileList.length===1&&digest(await readFile(fileList[0]))===probe.sha256,'STORAGE_BACKEND_EXACT_FILE');const archivePath=join(privateRoot,'storage.tar');execFileSync('tar',['--format=ustar','--numeric-owner','-cf',archivePath,'-C',a.files,'.'],{timeout:15000,stdio:'pipe'});const storageArchive=await readFile(archivePath);const storageProof=validateStorageTar(storageArchive,probe.sha256,probe.size);
 await writeFile(join(privateRoot,'database.dump'),databaseArchive,{mode:0o600});await writeFile(join(privateRoot,'roles.sql'),roles,{mode:0o600});const manifest={candidateSha:summary.candidateSha,migrationManifestHash:summary.migrationManifestHash,cutAt:new Date().toISOString(),cutHash,databaseSha256:digest(databaseArchive),rolesSha256:digest(roles),storage:storageProof,probe};await writeFile(join(privateRoot,'manifest.json'),JSON.stringify(manifest),{mode:0o600});summary.configurationProofScope=['database_owner_acl','database_role_settings','schema_table_column_function_default_acl','roles_memberships','rls_policies','extensions_cron','storage_document_metadata','outbox_event_lease'];summary.archives={databaseSha256:manifest.databaseSha256,rolesSha256:manifest.rolesSha256,storageSha256:storageProof.sha256,objectSha256:probe.sha256,objectSizeBytes:probe.size,cutHash};
 phase('destroy-A-before-create-B');await removeLab(a);await budget();await verifyCandidate();const b=await startDatabase('b');
 phase('restore-B-owners-acl-storage');sql(b,replayRoleCreates(roles));docker(['exec','-i',b.db,'pg_restore','-U','postgres','-d','postgres','--clean','--if-exists','--exit-on-error'],{input:databaseArchive,maxBuffer:16*1024*1024});validateStorageTar(await readFile(archivePath),probe.sha256,probe.size);execFileSync('tar',['-xf',archivePath,'-C',b.files],{timeout:15000,stdio:'pipe'});
 await budget();const restored=state(b,probe);for(const field of ['database','databaseRoleSettings','ownersAcl','functionAcl','schemaAcl','columnAcl','defaultAcl','policies','rls','roles','memberships','extensions','cron','object','document','outbox'])check(digest(JSON.stringify(restored[field]))===digest(JSON.stringify(cut[field])),`RESTORED_${field.toUpperCase()}`);
 phase('prove-restored-native-sessions-and-bytes');await startServices(b);const restoredOwner=await authenticate(b,owner.email);const restoredOther=await authenticate(b,other.email);check(restoredOwner.id===owner.id&&restoredOther.id===other.id,'RESTORED_AUTH_IDENTITIES');await proveAccess(b,probe,restoredOwner,restoredOther);
 const cronBefore=Number(sql(b,"select count(*)from cron.job_run_details where jobid=(select jobid from cron.job where jobname='local_restore_probe')and status='succeeded';").trim());sql(b,"alter system set cron.launch_active_jobs='on';select pg_reload_conf();");await waitUntil(()=>Number(sql(b,"select count(*)from cron.job_run_details where jobid=(select jobid from cron.job where jobname='local_restore_probe')and status='succeeded';").trim())>cronBefore,'CRON_B_NOT_EXECUTED',15);
 phase('wait-native-lease-expiration');const leaseDeadline=new Date(probe.lockedAt).getTime()+300000;check(Number.isFinite(leaseDeadline),'LEASE_TIMESTAMP');check(leaseDeadline-Date.now()<=360000,'LEASE_WAIT_BUDGET');while(Date.now()<=leaseDeadline+1000){await new Promise(done=>setTimeout(done,Math.min(5000,Math.max(100,leaseDeadline-Date.now()+1100))));if(summary.phases.at(-1).name!=='wait-native-lease-expiration')throw new Error('LOCAL_RESTORE_PHASE_CHANGED');}
 phase('resume-real-poller-http-retry-and-ack');const workerId=randomUUID();await writeFile(workerConfig,JSON.stringify({candidateRoot,serviceKey,webhookSecret,workerId,targetEventId:probe.eventId}),{mode:0o600});docker(['exec','--detach',b.storage,'node','--import',join(candidateRoot,'apps/worker/node_modules/tsx/dist/loader.mjs'),join(helpers,'worker.mjs'),'/lab/worker.json']);
 await waitUntil(async()=>{const ready=await http(b,7500,'/state',webhookSecret);return ready.status===200;},'WORKER_UNAVAILABLE');
 for(let attempt=0;attempt<3;attempt++){
  const polled=await http(b,7500,'/poll',webhookSecret,'POST',{});check(polled.status===200&&polled.json?.claimed>0,'REAL_POLLER_CLAIM');const event=jsonSql(b,`select to_jsonb(e)from public.event_outbox e where id=${quote(probe.eventId)}::bigint;`);check(digest(JSON.stringify(event.payload))===probe.payloadHash,'OUTBOX_PAYLOAD_PRESERVED');
  if(attempt<2){check(event.published_at===null&&event.attempt_count===attempt+1,'OUTBOX_RETRY_NOT_FALSE_PUBLISHED');check(event.last_error_code===(attempt===0?'OUTBOX_DISPATCH_FAILED':'OUTBOX_CONSUMER_ACK_INVALID'),'HTTP_ACK_ERROR_CLASSIFICATION');const stale=await http(b,3000,'/rpc/mark_outbox_published',serviceKey,'POST',{p_event_id:probe.eventId,p_worker_id:originalWorker});check(stale.status>=400&&stale.json?.code==='55000','STALE_WORKER_FENCED');const due=new Date(event.available_at).getTime();check(due-Date.now()<30000,'OUTBOX_BACKOFF_BUDGET');while(Date.now()<=due+100)await new Promise(done=>setTimeout(done,Math.min(1000,Math.max(100,due-Date.now()+110))));}
  else check(event.published_at!==null&&event.locked_by===null&&event.attempt_count===2,'OUTBOX_EVENTUALLY_PUBLISHED');
 }
 const receipt=(await http(b,7500,'/state',webhookSecret)).json;check(receipt.targetDeliveries===3&&receipt.targetLogicalReceipts===1,'HTTP_LOGICAL_RECEIPT_DEDUPLICATION');summary.outbox={transportAttempts:receipt.targetDeliveries,logicalProbeReceipts:receipt.targetLogicalReceipts,failedBeforeSuccess:2,oldWorkerFenced:true,documentScanningValidated:false};
 await verifyCandidate();summary.status='PASS';
}catch(error){diagnostics=captureDiagnostics();summary.failure=typeof error?.message==='string'&&/^LOCAL_RESTORE_[A-Za-z0-9_]+$/.test(error.message)?error.message:'LOCAL_RESTORE_FAILED';process.exitCode=1;}
finally{
 phase('cleanup');try{await removeLab(currentLab);const after=inventory();check(protectedContainers.every(before=>after.some(current=>current.id===before.id&&JSON.stringify(current.mounts)===JSON.stringify(before.mounts))),'PRIMARY_CONTAINERS_OR_MOUNTS_CHANGED');check(docker(['ps','-aq','--filter',`label=${label}`]).trim()==='','LAB_RESOURCES_LEFT');await rm(privateRoot,{recursive:true,force:true});summary.cleanup='PASS';await budget();}catch(error){await rm(privateRoot,{recursive:true,force:true}).catch(()=>{});if(summary.cleanup!=='PASS')summary.cleanup='FAILED';summary.status=summary.cleanup==='PASS'?'FAILED':'INCOMPLETE';summary.failure=typeof error?.message==='string'&&/^LOCAL_RESTORE_[A-Za-z0-9_]+$/.test(error.message)?error.message:'LOCAL_RESTORE_CLEANUP_FAILED';process.exitCode=1;}
 if(diagnostics)await writeFile(join(evidenceRoot,'diagnostics.sanitized.json'),JSON.stringify(diagnostics,null,2)+'\n',{mode:0o600});summary.finishedAt=new Date().toISOString();summary.durationMs=new Date(summary.finishedAt)-new Date(summary.startedAt);await writeFile(join(evidenceRoot,'summary.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});console.log(JSON.stringify({proofKind,status:summary.status,cleanup:summary.cleanup,assertions:summary.assertions,migrations:summary.migrations,durationMs:summary.durationMs,evidence:`work/coordinated-restore/${token}/summary.json`,...(summary.failure?{failure:summary.failure}:{})}));
}
