begin;
select plan(3);
select has_function('private','auto_advance_franchise_pipeline_v1',array['uuid','text','text','text','text'],'linked prospects can advance from a real event');
select ok(pg_get_functiondef('private.auto_advance_franchise_pipeline_v1(uuid,text,text,text,text)'::regprocedure) like '%linked_organization_id%' and pg_get_functiondef('private.auto_advance_franchise_pipeline_v1(uuid,text,text,text,text)'::regprocedure) like '%catch_up_franchise_prospect_v1%','a linked prospect moves only through stages that each have evidence');
select ok(
  exists(select 1 from pg_trigger where tgname='franchise_pipeline_client_profile')
  and exists(select 1 from pg_trigger where tgname='franchise_pipeline_client_verified')
  and exists(select 1 from pg_trigger where tgname='franchise_pipeline_diagnostic_run')
  and exists(select 1 from pg_trigger where tgname='franchise_pipeline_opportunity')
  and exists(select 1 from pg_trigger where tgname='franchise_pipeline_rfq')
  and exists(select 1 from pg_trigger where tgname='franchise_pipeline_contract'),
  'profile, verification, diagnostic, opportunity, consultation and contract each advance the pipeline'
);
select * from finish();
rollback;
