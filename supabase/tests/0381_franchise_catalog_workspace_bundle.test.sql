begin;
select plan(4);

select has_function(
  'public',
  'franchise_catalog_workspace_v1',
  array['uuid', 'text', 'text', 'integer', 'uuid', 'text', 'uuid', 'text', 'text', 'text'],
  'franchise catalog workspace bundle exists'
);

select is(
  (
    select prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'franchise_catalog_workspace_v1'
      and pg_get_function_identity_arguments(p.oid) = 'p_franchise_id uuid, p_kind text, p_search text, p_page integer, p_object_id uuid, p_status text, p_category_id uuid, p_language text, p_completeness text, p_validation text'
  ),
  true,
  'workspace bundle is security definer'
);

select ok(
  pg_get_functiondef('public.franchise_catalog_page(uuid,text,text,integer,uuid,text,uuid,text,text,text)'::regprocedure)
    like '%sibling as%',
  'catalog page avoids sibling-kind materialisation of the full question bank'
);

select ok(
  has_function_privilege('authenticated', 'public.franchise_catalog_workspace_v1(uuid,text,text,integer,uuid,text,uuid,text,text,text)', 'execute'),
  'authenticated can execute workspace bundle'
);

select * from finish();
rollback;
