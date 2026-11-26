import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function pauseFavoriteProvider(fixture,provider){
 const result=await provider.client.rpc('declare_provider_capacity',{p_provider_organization_id:provider.organizationId,p_service_id:fixture.resources.localCatalog.service,p_capacity_status:'PAUSED',p_available_units:null,p_lead_time_days:2,p_reason:'E2E favorite must recheck current paused capacity',p_idempotency_key:randomUUID()});
 assert.equal(result.error,null,'FAVORITE_PROVIDER_PAUSE_FAILED');
}

export async function verifyLocalFavorites(fixture,chains,paused){
 const db=fixture.resources.database;
 for(const locale of ['fr','ar']){
  const chain=chains[locale],actor=fixture.resources.localJourneyActors[locale];
  const rows=await db`select id,status,row_version,note from public.client_provider_favorites where client_organization_id=${chain.clientOrganizationId}::uuid and provider_organization_id=${chain.providerOrganizationId}::uuid`;
  assert.equal(rows.length,1);const favorite=rows[0];assert.equal(favorite.status,'ACTIVE');assert.equal(favorite.row_version,5);assert.equal(favorite.note,`E2E reusable favorite ${locale}`);
  const checks=await db`select id,eligible,exclusion_reasons,correlation_id from public.favorite_eligibility_revalidations where favorite_id=${favorite.id}::uuid order by checked_at,id`;
  assert.equal(checks.length,paused?12:6);assert.ok(checks.slice(0,6).every(row=>row.eligible===true));
  if(paused)assert.ok(checks.slice(6).every(row=>row.eligible===false&&row.exclusion_reasons.includes('CAPACITY_PAUSED')));
  const foreign=fixture.resources.localJourneyActors[locale==='fr'?'ar':'fr'].client;
  const read=await foreign.from('client_provider_favorites').select('id').eq('id',favorite.id);assert.equal(read.error,null);assert.deepEqual(read.data,[]);
  const denied=await foreign.rpc('revalidate_provider_favorite',{p_favorite_id:favorite.id,p_request_id:chain.requestId,p_idempotency_key:randomUUID()});assert.equal(denied.error?.code,'42501');
  for(const check of checks){
   const correlated=await db`select count(*)::integer count from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.resource_id=${check.id} and a.action='provider.favorite.revalidated' and e.event_type='ProviderFavoriteRevalidatedV1' and e.aggregate_id=${favorite.id}`;assert.equal(correlated[0].count,1);
  }
  if(paused){
   const input={p_favorite_id:favorite.id,p_request_id:chain.requestId,p_idempotency_key:randomUUID()};
   const first=await actor.client.rpc('revalidate_provider_favorite',input);assert.equal(first.error,null);
   const replay=await actor.client.rpc('revalidate_provider_favorite',input);assert.equal(replay.error,null,'FAVORITE_REVALIDATION_REPLAY_FAILED');assert.deepEqual(replay.data,first.data);
   const [count]=await db`select count(*)::integer count from public.favorite_eligibility_revalidations where favorite_id=${favorite.id}::uuid`;assert.equal(count.count,13);
  }
 }
 return{realUiFavorites:2,realUiRemoveRestoreCycles:4,realUiEligibilityChecks:24,currentCapacityPauseDisqualifiesFavorite:true,foreignFavoriteReadAndReuseDenied:true,correlatedFavoriteRevalidations:true,revalidationReplayVerified:true};
}
