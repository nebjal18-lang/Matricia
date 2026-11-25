begin;
select plan(4);
select has_function('public','promote_public_diagnostic_intake',array['uuid','text'],'public intake can be promoted');
select ok(not has_function_privilege('anon','public.promote_public_diagnostic_intake(uuid,text)','EXECUTE'),'anonymous users cannot promote a diagnostic');
select ok(pg_get_functiondef('private.score_public_diagnostic_v1(jsonb)'::regprocedure) like '%PUBLIC_DIAGNOSTIC_V1%' and pg_get_functiondef('private.score_public_diagnostic_v1(jsonb)'::regprocedure) like '%BACKUP_ABSENT%','the first-visit score is versioned and explains missing backups');
select is((private.score_public_diagnostic_v1('{"goals":["save_time"],"sector":"commerce","team_size":"small","priority_tracking":"no","sales_tracking":"shared","backup_restore":"recent","decision_trace":"systematic","next_action":"Organiser le suivi"}'::jsonb)->>'score')::numeric,70::numeric,'a missing priority follow-up deducts thirty points');
select * from finish();
rollback;
