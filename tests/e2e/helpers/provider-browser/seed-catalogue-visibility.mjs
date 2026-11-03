import { requireDevelopment, loadOwnState, docker } from './safety.mjs';
import { nativeBrowserActor } from './browser-session.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
requireDevelopment();
const state = await loadOwnState();
const fixture = JSON.parse(await readFile(resolve(state.directory, 'catalogue-fixture-provenance.json')));
if (fixture.scope !== 'HISTORICAL_SQL_TEST_PRECONDITION' || fixture.appTree !== state.candidate?.appTree || !/^[a-f0-9-]{36}$/u.test(fixture.ids.libraryId)) throw new Error('EXACT_HISTORICAL_TEST_CATALOGUE_REQUIRED');
// The old SQL fixtures relied on staff catalogue scope. A real Provider requires
// release membership. These are reference publication facts, never a mandate or
// a change to RLS. Preserve any existing release membership rather than replace it.
const id = fixture.ids.libraryId;
const releaseId = randomUUID(), actors = JSON.parse(await readFile(resolve(state.directory,'actors.private.json'))), author = actors.find(actor=>actor.label==='governance-author');
if(!author || !/^[a-f0-9-]{36}$/u.test(author.userId)) throw new Error('NATIVE_TEST_REFERENCE_AUTHOR_REQUIRED');
const sql = `begin;
do $$begin if not exists(select 1 from private.admin_execution_environment_v1 where singleton and environment='DEVELOPMENT') then raise exception 'DEVELOPMENT_ONLY';end if;
if exists(select 1 from public.catalog_release_items where library_id='${id}') then raise exception 'PRESERVE_EXISTING_RELEASE_MEMBERSHIP';end if;end$$;
insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,created_by,audience,effective_from)
values('${releaseId}','${id}','TEST.REFERENCE.${state.token.replaceAll('-','').toUpperCase()}','DRAFT',repeat('c',64),'${author.userId}','{"kind":"PUBLIC"}',now()-interval'1 day');
insert into public.catalog_release_items(release_id,library_id,object_type,object_id,version_id,content_hash,sort_order)
select '${releaseId}',l.id,x.kind,x.id,x.version,x.hash,x.ord from public.catalog_libraries l cross join lateral(
select 'LIBRARY'::text kind,l.id id,v.id version,v.content_hash hash,1 ord from public.catalog_library_versions v where v.id=l.current_published_version_id
union all select 'CATEGORY',c.id,v.id,v.content_hash,2 from public.catalog_categories c join public.catalog_category_versions v on v.id=c.current_published_version_id where c.library_id=l.id
union all select 'SUBCATEGORY',c.id,v.id,v.content_hash,3 from public.catalog_subcategories c join public.catalog_subcategory_versions v on v.id=c.current_published_version_id where c.library_id=l.id
union all select 'SERVICE',c.id,v.id,v.content_hash,3+row_number()over(order by c.code)::integer from public.catalog_services c join public.catalog_service_versions v on v.id=c.current_published_version_id where c.library_id=l.id
)x where l.id='${id}';
update public.catalog_releases set status='PUBLISHED',snapshot_hash=repeat('d',64),published_at=now() where id='${releaseId}' and status='DRAFT';
set constraints all immediate;commit;`;
docker(['exec','-i',state.database,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql});
const owner = await nativeBrowserActor(state,'provider-owner');
const read = await owner.client.from('catalog_services').select('id').in('id',[fixture.ids.serviceA,fixture.ids.serviceB]);
if(read.error || read.data.length !== 2) throw new Error('PROVIDER_NATIVE_RLS_MUST_SEE_BOTH_PUBLISHED_REFERENCE_SERVICES');
await writeFile(resolve(state.directory,'catalogue-visibility-provenance.json'),JSON.stringify({scope:'HISTORICAL_SQL_TEST_RELEASE_MEMBERSHIP_PRECONDITION',candidate:state.candidate.commit,appTree:state.candidate.appTree,sqlSha256:createHash('sha256').update(sql).digest('hex'),nativeOwnerRlsVisibleServices:read.data.length,governedCataloguePublicationCertified:false,rlsAltered:false},null,2));
console.log(JSON.stringify({status:'HISTORICAL_RELEASE_MEMBERSHIP_READY',nativeProviderRlsVisibleServices:read.data.length,rlsAltered:false}));
