begin;
select plan(4);
select has_function('public','enqueue_provider_review_notifications_v1',array['integer'],'provider review decisions are delivered by the worker');
select has_function('public','enqueue_provider_credential_expiry_reminders_v1',array['date','integer'],'certification reminders exist at the scheduler boundary');
select ok(pg_get_functiondef('public.enqueue_provider_credential_expiry_reminders_v1(date,integer)'::regprocedure) like '%CERTIFICATION%' and pg_get_functiondef('public.enqueue_provider_credential_expiry_reminders_v1(date,integer)'::regprocedure) like '%60, 30, 7%','credentials are reminded sixty, thirty and seven days before expiry');
select ok(pg_get_functiondef('public.run_domain_automation_schedulers_v1(date,integer)'::regprocedure) like '%enqueue_provider_review_notifications_v1%' and pg_get_functiondef('public.run_domain_automation_schedulers_v1(date,integer)'::regprocedure) like '%enqueue_provider_credential_expiry_reminders_v1%' and pg_get_functiondef('public.run_domain_automation_schedulers_v1(date,integer)'::regprocedure) like '%pg_try_advisory_xact_lock%','the existing scheduler now sends both provider messages');
select * from finish();
rollback;
