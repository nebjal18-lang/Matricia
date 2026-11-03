import { requireDevelopment, loadOwnState, docker, validateCanonicalSourceTarget } from './safety.mjs';
requireDevelopment();
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const state = await loadOwnState();
const sourcePath = resolve(process.argv[2] ?? '');
const source = validateCanonicalSourceTarget(JSON.parse(await readFile(sourcePath, 'utf8')));
if (source.purpose !== 'CANONICAL_ACL_SETUP_SOURCE_ONLY' || source.status !== 'retained-setup-source') throw new Error('CANONICAL_SETUP_SOURCE_REQUIRED');
const sourceSummary = JSON.parse(await readFile(resolve(sourcePath, '..', 'summary.json')));
const migrations = (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
if (sourceSummary.migrations.length !== migrations.length || source.migrationCount !== migrations.length) throw new Error('COMPLETE_CANONICAL_MIGRATION_SET_REQUIRED');
for (const [index, name] of migrations.entries()) {
  const actual = sourceSummary.migrations[index];
  if (actual.file !== name || !actual.passed || actual.sha256 !== createHash('sha256').update(await readFile('supabase/migrations/' + name)).digest('hex')) throw new Error('CANONICAL_MIGRATION_HASH_MISMATCH');
}
const inspected = JSON.parse(docker(['inspect', source.name]))[0];
if (inspected.Config.Labels?.['matricia.isolated-replay'] !== source.token || inspected.HostConfig.NetworkMode !== 'none' || Object.values(inspected.NetworkSettings.Ports ?? {}).some(ports => ports?.length)) throw new Error('OWNED_NO_NETWORK_SOURCE_REQUIRED');
const metadataSql = `set search_path=pg_catalog;
with objects as (
 select case when p.prokind='p' then 'PROCEDURE' else 'FUNCTION' end kind,
 format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) identity,
 md5(pg_get_functiondef(p.oid)) definition_hash,p.proowner owner,p.proacl acl,'f'::"char" acl_kind
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname !~ '^pg_' and n.nspname<>'information_schema' and p.prokind in('f','p')
 union all
 select case when c.relkind='S' then 'SEQUENCE' else 'TABLE' end,
 format('%I.%I',n.nspname,c.relname),
 md5(jsonb_build_object('kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'options',c.reloptions,
 'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
 'view',case when c.relkind in('v','m')then pg_get_viewdef(c.oid,true)else null end,
 'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
 'policies',(select jsonb_agg(jsonb_build_array(pol.polname,pol.polcmd,pol.polpermissive,(select array_agg(case when role_id=0 then 'PUBLIC'else pg_get_userbyid(role_id)end order by role_id)from unnest(pol.polroles)role_id),pg_get_expr(pol.polqual,pol.polrelid),pg_get_expr(pol.polwithcheck,pol.polrelid))order by pol.polname)from pg_policy pol where pol.polrelid=c.oid))::text),
 c.relowner,c.relacl,case when c.relkind='S'then's'else'r'end::"char"
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname !~ '^pg_' and n.nspname<>'information_schema' and c.relkind in('r','p','v','m','S')
 union all
 select 'SCHEMA',quote_ident(n.nspname),md5(n.nspname||':'||pg_get_userbyid(n.nspowner)),n.nspowner,n.nspacl,'n'::"char"
 from pg_namespace n where n.nspname !~ '^pg_' and n.nspname<>'information_schema'
)
select coalesce(jsonb_agg(jsonb_build_object('kind',o.kind,'identity',o.identity,'definitionHash',o.definition_hash,'owner',pg_get_userbyid(o.owner),
 'acl',(select coalesce(jsonb_agg(jsonb_build_object('role',case when a.grantee=0 then 'PUBLIC'else pg_get_userbyid(a.grantee)end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantee,a.privilege_type),'[]'::jsonb)from aclexplode(coalesce(o.acl,acldefault(o.acl_kind,o.owner)))a))order by o.kind,o.identity),'[]'::jsonb)from objects o;`;
function query(name, sql) { return docker(['exec', '-i', name, 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'], { input: sql, maxBuffer: 64 * 1024 * 1024 }); }
const canonical = JSON.parse(query(source.name, metadataSql));
const observed = JSON.parse(query(state.database, metadataSql));
const key = object => object.kind + ':' + object.identity;
const sourceMap = new Map(canonical.map(object => [key(object), object]));
const targetMap = new Map(observed.map(object => [key(object), object]));
const changes = [], definitionMismatches = [], targetOnly = [];
const quote = identifier => identifier === 'PUBLIC' ? 'PUBLIC' : '"' + identifier.replaceAll('"', '""') + '"';
for (const target of observed) {
  const expected = sourceMap.get(key(target));
  if (!expected) { targetOnly.push(key(target)); continue; }
  if (target.definitionHash !== expected.definitionHash || target.owner !== expected.owner) { definitionMismatches.push(key(target)); continue; }
  const expectedAcl = new Map(expected.acl.map(acl => [acl.role + ':' + acl.privilege, acl]));
  const observedAcl = new Map(target.acl.map(acl => [acl.role + ':' + acl.privilege, acl]));
  for (const [aclKey, actual] of observedAcl) {
    const wanted = expectedAcl.get(aclKey);
    if (!wanted) changes.push({ kind: target.kind, object: target.identity, operation: 'REVOKE', role: actual.role, privilege: actual.privilege, sql: `revoke ${actual.privilege} on ${target.kind} ${target.identity} from ${quote(actual.role)} cascade;` });
    else if (actual.grantable && !wanted.grantable) changes.push({ kind: target.kind, object: target.identity, operation: 'REVOKE_GRANT_OPTION', role: actual.role, privilege: actual.privilege, sql: `revoke grant option for ${actual.privilege} on ${target.kind} ${target.identity} from ${quote(actual.role)} cascade;` });
  }
  for (const [aclKey, wanted] of expectedAcl) {
    const actual = observedAcl.get(aclKey);
    if (!actual || (!actual.grantable && wanted.grantable)) changes.push({ kind: target.kind, object: target.identity, operation: 'MATCH_CANONICAL_GRANT', role: wanted.role, privilege: wanted.privilege, sql: `grant ${wanted.privilege} on ${target.kind} ${target.identity} to ${quote(wanted.role)}${wanted.grantable ? ' with grant option' : ''};` });
  }
}
const sourceOnly = canonical.filter(object => !targetMap.has(key(object))).map(key);
const directory = resolve(state.directory, 'acl-fidelity');
await mkdir(directory, { recursive: true });
const report = { scope: 'OWNED_CLONE_ACL_FIDELITY_NOT_APPLICATION_CERTIFICATION', sourcePurpose: source.purpose, sourceStatus: source.status, migrationCount: migrations.length, canonicalObjects: canonical.length, observedObjects: observed.length, definitionMismatches, sourceOnly, targetOnly, changes: changes.map(({ sql, ...safe }) => safe), status: 'INSPECTED' };
await writeFile(resolve(directory, 'canonical.private.json'), JSON.stringify(canonical), { mode: 0o600 });
await writeFile(resolve(directory, 'observed-before.private.json'), JSON.stringify(observed), { mode: 0o600 });
await writeFile(resolve(directory, 'before.json'), JSON.stringify(report, null, 2));
if (process.argv.includes('--align')) {
  if (definitionMismatches.length || sourceOnly.length || targetOnly.length) throw new Error('MATCHING_CANONICAL_OBJECT_DEFINITIONS_REQUIRED');
  query(state.database, 'begin;\n' + changes.map(change => change.sql).join('\n') + '\ncommit;');
  const after = JSON.parse(query(state.database, metadataSql));
  const normalize = object => JSON.stringify(object.acl.map(acl => [acl.role, acl.privilege, acl.grantable]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  const differences = after.filter(object => normalize(object) !== normalize(sourceMap.get(key(object)))).map(key);
  report.status = differences.length ? 'FAILED' : 'MATCHED_CANONICAL_ACLS';
  report.remainingDifferences = differences;
  await writeFile(resolve(directory, 'after.json'), JSON.stringify(report, null, 2));
  if (differences.length) throw new Error('CANONICAL_ACL_ALIGNMENT_INCOMPLETE');
}
console.log(JSON.stringify({ status: report.status, sourceMigrationCount: migrations.length, sourceObjects: canonical.length, targetObjects: observed.length, definitionMismatches: definitionMismatches.length, sourceOnly: sourceOnly.length, targetOnly: targetOnly.length, aclChanges: changes.length, evidence: resolve(directory, process.argv.includes('--align') ? 'after.json' : 'before.json') }));
