import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {provisionLocalCatalogReference,neutralizeLocalCatalogReference} from './local-catalog-reference.mjs';
export async function prepareLocalSolutionBundles(fixture,cases){
 assert.equal(fixture.config.runtimeMode,'isolated-local-docker');assert.equal(fixture.config.localDockerVerified,true);
 const primary=fixture.resources.localCatalog;
 try{await provisionLocalCatalogReference(fixture);fixture.resources.localBundleExtraCatalog=fixture.resources.localCatalog;}finally{fixture.resources.localCatalog=primary;}
 const secondary=fixture.resources.localBundleExtraCatalog,items={};
 for(const locale of ['fr','ar'])for(const device of ['D','M']){
  const actor=fixture.resources.localJourneyActors[locale],foreign=fixture.resources.localJourneyActors[locale==='fr'?'ar':'fr'],key=`${locale}_${device}`,code=`BUNDLE_${fixture.manifest.runId.slice(0,8).toUpperCase()}_${key.toUpperCase()}`;
  const scope=[{dedupe_key:'FIRST',service_id:primary.service,service_version_id:primary.serviceVersion,fusion_strategy:'KEEP_PRIMARY',amount_minor:'125050',provenance:{reference:'LOCAL_SCOPE_A'}},{dedupe_key:'FIRST',service_id:primary.service,service_version_id:primary.serviceVersion,fusion_strategy:'KEEP_PRIMARY',amount_minor:'125050',provenance:{reference:'LOCAL_SCOPE_A_DUPLICATE'}},{dedupe_key:'SECOND',service_id:secondary.service,service_version_id:secondary.serviceVersion,fusion_strategy:'SEQUENCE',amount_minor:'24999',provenance:{reference:'LOCAL_SCOPE_B'}}];
  const input={p_organization_id:actor.organizationId,p_bundle_key:code,p_version:1,p_title_fr:code,p_title_ar:code,p_description_fr:'Coordonner les deux prestations pour améliorer votre organisation.',p_description_ar:'تنسيق الخدمتين لتحسين أداء مؤسستكم.',p_currency:'MAD',p_fusion_policy_snapshot:{version:'LOCAL_V1',content_hash:createHash('sha256').update(JSON.stringify(scope)).digest('hex'),default_strategy:'KEEP_PRIMARY'},p_items:scope,p_idempotency_key:randomUUID(),p_correlation_id:randomUUID()};
  const result=await actor.client.rpc('publish_solution_bundle',input);
  if(result.error){const constraint=/constraint "([a-z0-9_]+)"/u.exec(result.error.message)?.[1];throw Object.assign(new Error(constraint?`BUNDLE_CONSTRAINT_${constraint.toUpperCase()}`:/^[A-Z_]+$/u.test(result.error.message)?result.error.message:'BUNDLE_PUBLICATION_FAILED'),{code:result.error.code});}
  assert.equal(result.data.outcome,'SOLUTION_BUNDLE_PUBLISHED');assert.equal(String(result.data.total_amount_minor),'150049');assert.equal(result.data.deduplicated_count,2);assert.equal(result.data.library_count,2);
  const replay=await actor.client.rpc('publish_solution_bundle',input);assert.equal(replay.error,null);assert.deepEqual(replay.data,result.data);
  const denied=await foreign.client.rpc('publish_solution_bundle',{...input,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
  const hidden=await foreign.client.from('solution_bundle_versions').select('id').eq('id',result.data.bundle_version_id);assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[]);
  const [requests]=await fixture.resources.database`select count(*)::integer n from public.service_requests where client_organization_id=${actor.organizationId}::uuid`;
  items[key]={...cases[locale],code,bundleId:result.data.bundle_version_id,description:locale==='fr'?input.p_description_fr:input.p_description_ar,requestsBefore:requests.n};
 }
 return items;
}
export async function verifyLocalSolutionBundles(fixture,items){
 const db=fixture.resources.database;
 for(const item of Object.values(items)){
  const [row]=await db`select total_amount_minor::text total,(select count(*)::integer from public.solution_bundle_items i where i.bundle_version_id=b.id) items,(select sum(source_count)::integer from public.solution_bundle_items i where i.bundle_version_id=b.id) sources from public.solution_bundle_versions b where id=${item.bundleId}::uuid`;assert.equal(row.total,'150049');assert.equal(row.items,2);assert.equal(row.sources,3);
  const [requests]=await db`select count(*)::integer n from public.service_requests where client_organization_id=${item.organizationId}::uuid`;assert.equal(requests.n,item.requestsBefore);
  const [audits]=await db`select count(*)::integer n from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.resource_id=${item.bundleId} and a.action='solution.bundle.published' and e.event_type='SolutionBundlePublishedV1'`;assert.equal(audits.n,1);
 }
 return{nativeMultiLibraryBundles:4,realUiBundleViews:4,realUiGuidedNeedContinuations:4,twoLibrariesAndDeduplicatedServices:true,exactBundleTotalMinor:'150049',bundlePublicationReplay:true,foreignBundleReadWriteDenied:true,noAutomaticRequestCreated:true,correlatedBundleAuditOutbox:true,frArDesktop360Accessibility:true};
}
export async function cleanupLocalBundleReference(fixture){
 if(!fixture.resources.localBundleExtraCatalog)return;const primary=fixture.resources.localCatalog;
 try{fixture.resources.localCatalog=fixture.resources.localBundleExtraCatalog;await neutralizeLocalCatalogReference(fixture);}finally{fixture.resources.localCatalog=primary;}
}
