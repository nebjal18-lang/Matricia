begin;
set local search_path=public,extensions,pg_temp;
grant usage on schema extensions to authenticated;
select no_plan();
create temp table vol411(k text primary key,v jsonb);
grant all on vol411 to authenticated;
do $$
declare a uuid:=extensions.gen_random_uuid();o uuid:=extensions.gen_random_uuid();sku uuid:=extensions.gen_random_uuid();ag uuid:=extensions.gen_random_uuid();av uuid:=extensions.gen_random_uuid();pool uuid:=extensions.gen_random_uuid();cap uuid:=extensions.gen_random_uuid();rs uuid:=extensions.gen_random_uuid();svc uuid:=extensions.gen_random_uuid();lib uuid:=extensions.gen_random_uuid();cat uuid:=extensions.gen_random_uuid();subcat uuid:=extensions.gen_random_uuid();
begin
 insert into auth.users(id,email)values(a,'vol411-'||a||'@example.invalid');
 insert into public.organizations(id,legal_name,display_name,status,created_by)values(o,'Volume regression','Volume regression','ACTIVE',a);
 insert into public.platform_user_roles(user_id,role_code)values(a,'FINANCE_MANAGER');
 insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by)values(lib,'T411-'||upper(substr(lib::text,1,8)),'t411-'||lib,o,a);
 insert into public.catalog_categories(id,library_id,code,slug,created_by)values(cat,lib,'T411','t411',a);
 insert into public.catalog_subcategories(id,library_id,category_id,code,slug,created_by)values(subcat,lib,cat,'T411','t411',a);
 insert into public.catalog_services(id,library_id,primary_subcategory_id,code,slug,created_by)values(svc,lib,subcat,'T411-'||upper(svc::text),'t411',a);
 insert into public.service_skus(id,service_id,code,version,status,unit_code,unit_quantity,deliverables,exclusions,acceptance_criteria,correction_limit,sla_days,currency,reference_cost_minor,credit_cost,effective_from,content_hash,created_by)
 values(sku,svc,'TEST411-'||upper(sku::text),1,'ACTIVE','UNIT',1,'[]','[]','[]',1,1,'MAD',100,1,current_date,repeat('1',64),a);
 insert into public.framework_agreements(id,owner_organization_id,sku_id,agreement_code,status,created_by)values(ag,o,sku,'TEST411','ACTIVE',a);
 insert into public.framework_agreement_versions(id,agreement_id,version,valid_from,valid_to,forecast_units,minimum_commitment_units,maximum_units,payment_model,currency,price_tiers,rebate_rules,sla_snapshot,penalty_rules,exit_rules,content_hash,created_by)
 values(av,ag,1,current_date,current_date+30,2,0,2,'PAY_PER_USE','MAD','[]','[]','{}','[]','{}',repeat('1',64),a);
 insert into public.provider_capacity_commitments(id,agreement_id,agreement_version_id,provider_organization_id,capacity_units,allocation_share_basis_points,quality_score_basis_points,monthly_capacity_units,unit_price_minor)
 values(cap,ag,av,o,2,10000,10000,2,100);
 insert into public.service_inventory_pools(id,owner_organization_id,agreement_id,agreement_version_id,contracted_units,available_units,reserved_units,low_stock_threshold_units,reservation_ttl,window_start,window_end)
 values(pool,o,ag,av,2,0,2,0,interval '1 day',now(),now()+interval '30 days');
 insert into public.service_reservations(id,pool_id,client_organization_id,benefit_reference,reserved_units,expires_at,correlation_id,created_by)values(rs,pool,o,'TEST411',2,now()+interval '1 day',extensions.gen_random_uuid(),a);
 insert into vol411 values('context',jsonb_build_object('actor',a,'org',o,'reservation',rs,'capacity',cap,'pool',pool));
end$$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',v->>'actor','role','authenticated','aal','aal2')::text,true) from vol411 where k='context';
create function pg_temp.allocate411(units numeric default 2)returns jsonb language sql as $$select public.allocate_provider_from_pool((v->>'reservation')::uuid,(v->>'capacity')::uuid,units,'{}','test411-allocate')from vol411 where k='context'$$;
insert into vol411 values('allocation',pg_temp.allocate411());
select is(pg_temp.allocate411(),(select v from vol411 where k='allocation'),'full allocation retry returns canonical receipt');
select throws_ok($$select pg_temp.allocate411(1)$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','changed allocation payload rejected before state guard');
create function pg_temp.consume411(units numeric default 2)returns jsonb language sql as $$select public.consume_service_units((c.v->>'reservation')::uuid,jsonb_build_array(jsonb_build_object('allocation_id',a.v->>'allocation_id','units',units)),'test411-consume')from vol411 c,vol411 a where c.k='context'and a.k='allocation'$$;
insert into vol411 values('consumption',pg_temp.consume411());
select is(pg_temp.consume411(),(select v from vol411 where k='consumption'),'full consumption retry returns canonical receipt');
select throws_ok($$select pg_temp.consume411(1)$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','changed consumption payload rejected');
select lives_ok('set constraints all immediate','volume constraints pass as authenticated');
select set_config('request.jwt.claims','{"role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select pg_temp.allocate411()$$,'42501','PROVIDER_ALLOCATION_DENIED','allocation replay retains authorization');
select throws_ok($$select pg_temp.consume411()$$,'42501','VOLUME_CONSUMPTION_DENIED','consumption replay retains authorization');
reset role;
select is((select consumed_units from public.service_inventory_pools where id=(select(v->>'pool')::uuid from vol411 where k='context')),2::numeric,'pool consumed once');
select is((select count(*)::integer from public.service_provider_consumptions where reservation_id=(select(v->>'reservation')::uuid from vol411 where k='context')),1,'one immutable consumption');
select is((select count(*)::integer from public.event_outbox where organization_id=(select(v->>'org')::uuid from vol411 where k='context')),2,'allocation and consumption each emit exactly one event');
select * from finish();
rollback;
