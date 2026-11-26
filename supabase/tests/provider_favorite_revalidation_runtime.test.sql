begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated;
select no_plan();
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('e0480000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'authenticated','authenticated','favorite-runtime-'||i||'@example.invalid','{}','{}',now(),now() from generate_series(1,2)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)
select ('e0481000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'TEST favorite '||i,'TEST favorite '||i,'ACTIVE',('e0480000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.organization_memberships(id,organization_id,user_id,status)
values('e0482000-0000-4000-8000-000000000001','e0481000-0000-4000-8000-000000000001','e0480000-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('e0482000-0000-4000-8000-000000000001','CLIENT_OWNER');
insert into public.provider_profiles(provider_organization_id,activity_summary,team_size,years_experience,created_by)
values('e0481000-0000-4000-8000-000000000002','TEST unqualified provider profile',1,0,'e0480000-0000-4000-8000-000000000002');
-- Historical catalogue/request inputs only; every tested favorite command below
-- executes with ordinary triggers, roles, RLS and audit enabled.
insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by)
values('e0483000-0000-4000-8000-000000000001','TEST_FAVORITE_RUNTIME','test-favorite-runtime','e0481000-0000-4000-8000-000000000001','e0480000-0000-4000-8000-000000000001');
insert into public.catalog_categories(id,library_id,code,slug,created_by)
values('e0484000-0000-4000-8000-000000000001','e0483000-0000-4000-8000-000000000001','TEST_FAVORITE','test-favorite','e0480000-0000-4000-8000-000000000001');
insert into public.catalog_subcategories(id,library_id,category_id,code,slug,created_by)
values('e0485000-0000-4000-8000-000000000001','e0483000-0000-4000-8000-000000000001','e0484000-0000-4000-8000-000000000001','TEST_FAVORITE','test-favorite','e0480000-0000-4000-8000-000000000001');
insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,created_by)
values('e0486000-0000-4000-8000-000000000001','e0483000-0000-4000-8000-000000000001','e0485000-0000-4000-8000-000000000001','TEST_FAVORITE_RUNTIME','test-favorite','e0480000-0000-4000-8000-000000000001');
insert into public.service_requests(id,client_organization_id,library_id,service_id,status,created_by)
values('e0487000-0000-4000-8000-000000000001','e0481000-0000-4000-8000-000000000001','e0483000-0000-4000-8000-000000000001','e0486000-0000-4000-8000-000000000001','DRAFT','e0480000-0000-4000-8000-000000000001'),
('e0487000-0000-4000-8000-000000000002','e0481000-0000-4000-8000-000000000001','e0483000-0000-4000-8000-000000000001','e0486000-0000-4000-8000-000000000001','DRAFT','e0480000-0000-4000-8000-000000000001');
create temporary table favorite_results(k text primary key,v jsonb);
grant select,insert on favorite_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0480000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into favorite_results values('favorite',public.set_provider_favorite('e0481000-0000-4000-8000-000000000001','e0481000-0000-4000-8000-000000000002',null,true,'TEST favorite reference',0,'favorite-runtime-create'));
insert into favorite_results values('check',public.revalidate_provider_favorite((select(v->>'favorite_id')::uuid from favorite_results where k='favorite'),'e0487000-0000-4000-8000-000000000001','favorite-runtime-check'));
select is((select(v->>'eligible')::boolean from favorite_results where k='check'),false,'an unqualified favorite is never eligible');
select pg_sleep(0.002);
select lives_ok($$insert into favorite_results values('replay',public.revalidate_provider_favorite((select(v->>'favorite_id')::uuid from favorite_results where k='favorite'),'e0487000-0000-4000-8000-000000000001','favorite-runtime-check'))$$,'retry after the eligibility timestamp changes succeeds');
select is((select v from favorite_results where k='replay'),(select v from favorite_results where k='check'),'retry returns the exact original evidence');
select lives_ok($$select public.revalidate_provider_favorite((select(v->>'favorite_id')::uuid from favorite_results where k='favorite'),'e0487000-0000-4000-8000-000000000001','favorite-runtime-fresh-check')$$,'a new command can perform a fresh eligibility check');
reset role;
select is((select count(*)::integer from public.favorite_eligibility_revalidations where client_organization_id='e0481000-0000-4000-8000-000000000001'),2,'retry adds no extra immutable revalidation');
select ok((select v->'exclusion_reasons'?'DOCUMENT_LEGAL_INVALID' from favorite_results where k='check'),'favorites use the same mandatory document gate as matching');
select is((select count(*)::integer from public.audit_events a join public.event_outbox e on e.correlation_id=a.correlation_id where a.organization_id='e0481000-0000-4000-8000-000000000001'and a.action='provider.favorite.revalidated'and e.event_type='ProviderFavoriteRevalidatedV1'),2,'each new revalidation has one correlated audit and event');
-- Historical receipt in the former hash format; no existing receipt is changed.
insert into public.idempotency_keys(organization_id,operation_scope,key,request_hash,created_by,expires_at,status,response_code,response_body,completed_at)
select 'e0481000-0000-4000-8000-000000000001','provider.favorite.revalidate','favorite-runtime-legacy',private.canonical_request_hash(jsonb_build_object('operation','provider.favorite.revalidate.v1','favorite',v->>'favorite_id','request',v->>'request_id','eligibility',v->'explanation')),'e0480000-0000-4000-8000-000000000001',clock_timestamp()+interval '1 day','COMPLETED',200,v,clock_timestamp()from favorite_results where k='check';
set local role authenticated;
select is(public.revalidate_provider_favorite((select(v->>'favorite_id')::uuid from favorite_results where k='favorite'),'e0487000-0000-4000-8000-000000000001','favorite-runtime-legacy'),(select v from favorite_results where k='check'),'completed receipts in the former hash format remain replayable');
select throws_ok($$select public.revalidate_provider_favorite((select(v->>'favorite_id')::uuid from favorite_results where k='favorite'),'e0487000-0000-4000-8000-000000000002','favorite-runtime-legacy')$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','legacy receipt cannot be reused for a different request');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e0480000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.revalidate_provider_favorite((select(v->>'favorite_id')::uuid from favorite_results where k='favorite'),'e0487000-0000-4000-8000-000000000001','favorite-runtime-foreign')$$,'42501','FAVORITE_ACCESS_DENIED','foreign callers cannot reuse a favorite');
select is((select count(*)::integer from public.client_provider_favorites where client_organization_id='e0481000-0000-4000-8000-000000000001'),0,'foreign callers cannot read favorites');
select set_config('request.jwt.claims','{"sub":"e0480000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.set_provider_favorite('e0481000-0000-4000-8000-000000000001','e0481000-0000-4000-8000-000000000002',null,false,'TEST favorite reference',1,'favorite-runtime-remove');
select throws_ok($$select public.revalidate_provider_favorite((select(v->>'favorite_id')::uuid from favorite_results where k='favorite'),'e0487000-0000-4000-8000-000000000001','favorite-runtime-removed')$$,'55000','INACTIVE_PROVIDER_FAVORITE','removed favorites cannot be reused');
reset role;
select * from finish();
rollback;
