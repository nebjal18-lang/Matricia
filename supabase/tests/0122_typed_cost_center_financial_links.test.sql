begin;
select plan(10);
create temporary view tested_typed_allocation_source as
 select case when pg_get_functiondef('public.record_client_typed_cost_allocation(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid)'::regprocedure) like '%private.record_client_typed_cost_allocation_pre_client_approval_v1(%'
 then pg_get_functiondef('public.record_client_typed_cost_allocation(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid)'::regprocedure)||pg_get_functiondef('private.record_client_typed_cost_allocation_pre_client_approval_v1(uuid,uuid,uuid,uuid,text,bigint,text,uuid,text,text,uuid)'::regprocedure) else '' end as definition;

select has_function('public','record_client_typed_cost_allocation',array['uuid','uuid','uuid','uuid','text','bigint','text','uuid','text','text','uuid'],'typed allocation RPC exists');
select function_privs_are('public','record_client_typed_cost_allocation',array['uuid','uuid','uuid','uuid','text','bigint','text','uuid','text','text','uuid'],'authenticated',array['EXECUTE'],'authenticated executes typed allocation');
select function_privs_are('public','record_client_typed_cost_allocation',array['uuid','uuid','uuid','uuid','text','bigint','text','uuid','text','text','uuid'],'anon',array[]::text[],'anon cannot execute typed allocation');
select volatility_is('public','record_client_typed_cost_allocation',array['uuid','uuid','uuid','uuid','text','bigint','text','uuid','text','text','uuid'],'v','typed allocation is volatile');
select is_definer('public','record_client_typed_cost_allocation',array['uuid','uuid','uuid','uuid','text','bigint','text','uuid','text','text','uuid'],'typed allocation is security definer');
select isnt_empty($$select 1 from pg_get_constraintdef((select oid from pg_constraint where conname='client_cost_allocations_reference_type_check')) d where d like '%MISSION_MILESTONE%' and d like '%INVOICE%'$$,'typed references are constrained');
select has_index('public','client_cost_allocations','client_cost_allocations_reference_idx','reference lookup index exists');
select isnt_empty($$select 1 from tested_typed_allocation_source where definition like '%client_typed_reference_valid%'$$,'RPC validates tenant-scoped reference');
select isnt_empty($$select 1 from tested_typed_allocation_source where definition like '%CLIENT_INVOICE_ALLOCATION_EXCEEDED%'$$,'invoice total cannot be exceeded');
select isnt_empty($$select 1 from tested_typed_allocation_source where definition like '%event_outbox%' and definition like '%audit_events%'$$,'mutation emits audit and outbox');
select * from finish();
rollback;
