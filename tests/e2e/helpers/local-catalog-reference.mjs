import { randomUUID, createHash } from 'node:crypto';

/** Minimal local-only reference bootstrap, never proof of a publication workflow. */
export async function provisionLocalCatalogReference(fixture) {
  if (fixture.config.runtimeMode !== 'isolated-local-docker' || !fixture.config.localDockerVerified) throw new Error('Local reference bootstrap requires Docker verification');
  const ids = Object.fromEntries(['library','libraryVersion','release','category','categoryVersion','subcategory','subcategoryVersion','service','serviceVersion'].map(key=>[key,randomUUID()]));
  fixture.resources.localCatalog = ids;
  const actor = fixture.resources.userIds[0], org = fixture.manifest.fixtures.organizationA.id;
  const suffix = ids.library.replaceAll('-','').slice(0,16), code = `E2E_LOCAL_${suffix.toUpperCase()}`, hash = createHash('sha256').update(suffix).digest('hex');
  await fixture.resources.database.begin(async tx=>{
    // Historical fixture publication only; all subsequent tested commands use their real permissions/triggers.
    await tx.unsafe("set local session_replication_role='replica'");
    await tx`insert into public.catalog_libraries(id,code,slug,status,steward_organization_id,created_by)values(${ids.library}::uuid,${code},${`e2e-local-${suffix}`},'PUBLISHED',${org}::uuid,${actor}::uuid)`;
    await tx`insert into public.catalog_library_versions(id,library_id,version,status,name_fr,name_ar,description_fr,description_ar,icon_key,sort_order,change_reason,content_hash,created_by,published_at,code,slug)values(${ids.libraryVersion}::uuid,${ids.library}::uuid,1,'PUBLISHED','Bibliothèque de recette locale','مكتبة اختبار محلي','Référence synthétique isolée','مرجع اصطناعي معزول','layers',1,'Bootstrap de fixture locale',${hash},${actor}::uuid,clock_timestamp(),${code},${`e2e-local-${suffix}`})`;
    await tx`update public.catalog_libraries set current_published_version_id=${ids.libraryVersion}::uuid where id=${ids.library}::uuid`;
    await tx`insert into public.catalog_categories(id,library_id,code,slug,status,created_by)values(${ids.category}::uuid,${ids.library}::uuid,'LOCAL_CATEGORY','local-category','PUBLISHED',${actor}::uuid)`;
    await tx`insert into public.catalog_category_versions(id,category_id,library_id,version,status,name_fr,name_ar,description_fr,description_ar,sort_order,change_reason,content_hash,created_by,published_at,code,slug)values(${ids.categoryVersion}::uuid,${ids.category}::uuid,${ids.library}::uuid,1,'PUBLISHED','Catégorie locale','فئة محلية','Référence de recette','مرجع الاختبار',1,'Bootstrap de fixture locale',${hash},${actor}::uuid,clock_timestamp(),'LOCAL_CATEGORY','local-category')`;
    await tx`update public.catalog_categories set current_published_version_id=${ids.categoryVersion}::uuid where id=${ids.category}::uuid`;
    await tx`insert into public.catalog_subcategories(id,library_id,category_id,code,slug,status,created_by)values(${ids.subcategory}::uuid,${ids.library}::uuid,${ids.category}::uuid,'LOCAL_SUBCATEGORY','local-subcategory','PUBLISHED',${actor}::uuid)`;
    await tx`insert into public.catalog_subcategory_versions(id,subcategory_id,library_id,version,status,name_fr,name_ar,description_fr,description_ar,sort_order,change_reason,content_hash,created_by,published_at,category_id,code,slug)values(${ids.subcategoryVersion}::uuid,${ids.subcategory}::uuid,${ids.library}::uuid,1,'PUBLISHED','Sous-catégorie locale','فئة فرعية محلية','Référence de recette','مرجع الاختبار',1,'Bootstrap de fixture locale',${hash},${actor}::uuid,clock_timestamp(),${ids.category}::uuid,'LOCAL_SUBCATEGORY','local-subcategory')`;
    await tx`update public.catalog_subcategories set current_published_version_id=${ids.subcategoryVersion}::uuid where id=${ids.subcategory}::uuid`;
    await tx`insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,status,created_by)values(${ids.service}::uuid,${ids.library}::uuid,${ids.subcategory}::uuid,${`${code}_SERVICE`},'local-service','PUBLISHED',${actor}::uuid)`;
    await tx`insert into public.catalog_service_versions(id,service_id,library_id,version,status,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,sort_order,change_reason,content_hash,created_by,published_at,primary_subcategory_id,code,slug)values(${ids.serviceVersion}::uuid,${ids.service}::uuid,${ids.library}::uuid,1,'PUBLISHED','Service de recette locale','خدمة اختبار محلي','Service synthétique local','خدمة اصطناعية محلية','Service persistant destiné exclusivement à la recette locale','خدمة دائمة مخصصة للاختبار المحلي فقط','CONSULTING','mission','مهمة',1,'Bootstrap de fixture locale',${hash},${actor}::uuid,clock_timestamp(),${ids.subcategory}::uuid,${`${code}_SERVICE`},'local-service')`;
    await tx`update public.catalog_services set current_published_version_id=${ids.serviceVersion}::uuid where id=${ids.service}::uuid`;
    await tx`insert into public.catalog_releases(id,library_id,release_key,status,source_bundle_hash,snapshot_hash,published_at,created_by)values(${ids.release}::uuid,${ids.library}::uuid,${`${code}.V1`},'PUBLISHED',${hash},${hash},clock_timestamp(),${actor}::uuid)`;
    for (const [kind,id,version,order] of [['LIBRARY',ids.library,ids.libraryVersion,1],['CATEGORY',ids.category,ids.categoryVersion,2],['SUBCATEGORY',ids.subcategory,ids.subcategoryVersion,3],['SERVICE',ids.service,ids.serviceVersion,4]]) await tx`insert into public.catalog_release_items(release_id,library_id,object_type,object_id,version_id,content_hash,sort_order)values(${ids.release}::uuid,${ids.library}::uuid,${kind},${id}::uuid,${version}::uuid,${hash},${order})`;
    await tx`update public.catalog_libraries set current_release_id=${ids.release}::uuid where id=${ids.library}::uuid`;
  });
  return ids;
}
export async function neutralizeLocalCatalogReference(fixture) {
  const ids = fixture.resources.localCatalog;
  if (!ids) return;
  if (fixture.config.runtimeMode !== 'isolated-local-docker') throw new Error('Local catalogue cleanup requires Docker fixture');
  await fixture.resources.database.begin(async tx=>{
    await tx.unsafe("set local session_replication_role='replica'");
    await tx`update public.catalog_releases set status='RETIRED',retired_at=clock_timestamp()where library_id=${ids.library}::uuid and status='PUBLISHED'`;
    await tx`update public.catalog_library_mandates set status='REVOKED',valid_until=clock_timestamp(),row_version=row_version+1 where library_id=${ids.library}::uuid and status='ACTIVE'`;
    for (const table of ['catalog_library_versions','catalog_category_versions','catalog_subcategory_versions','catalog_service_versions']) await tx`update public.${tx(table)} set status='RETIRED',retired_at=clock_timestamp() where library_id=${ids.library}::uuid and status='PUBLISHED'`;
    for (const table of ['catalog_categories','catalog_subcategories','catalog_services']) await tx`update public.${tx(table)} set status='ARCHIVED',archived_at=clock_timestamp() where library_id=${ids.library}::uuid`;
    await tx`update public.catalog_libraries set status='ARCHIVED',archived_at=clock_timestamp() where id=${ids.library}::uuid`;
    const [active] = await tx`select count(*)::int as count from public.catalog_libraries where id=${ids.library}::uuid and status<>'ARCHIVED'`;
    if (active.count !== 0) throw new Error('Local reference catalogue remains active');
  });
}
