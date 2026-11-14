begin;
select plan(2);

select ok(
  (
    select pg_get_functiondef('public.list_admin_supervision_page_raw_v1(integer,integer)'::regprocedure)
    like '%questionnaire_version%'
  ),
  'admin diagnostics projection exposes questionnaire_version'
);

select ok(
  (
    select pg_get_functiondef('public.list_admin_supervision_page_raw_v1(integer,integer)'::regprocedure)
    like '%questionnaire_sessions qs%'
  ),
  'admin diagnostics projection joins questionnaire sessions for version titles'
);

select * from finish();
rollback;
