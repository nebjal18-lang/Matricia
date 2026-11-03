begin;
select plan(6);
select has_table('public','franchise_applications','franchise candidature dossiers exist');
select ok(not has_function_privilege('anon','public.submit_franchise_application(text,text,text,text,text,text,text,text,text)','EXECUTE'),'anonymous users cannot open a franchise dossier');
select ok(has_function_privilege('service_role','public.submit_franchise_application(text,text,text,text,text,text,text,text,text)','EXECUTE'),'the server role can open a franchise dossier');
select ok(has_function_privilege('authenticated','public.review_franchise_application(uuid,text,text,integer,text)','EXECUTE'),'an authenticated reviewer can call the guarded transition');
select throws_ok($$select public.submit_franchise_application('A','not-an-email','CASABLANCA_SETTAT','Dirigeant','IT — Informatique','Immédiate',repeat('m',40),'fr',repeat('a',64))$$,'22023','FRANCHISE_APPLICATION_INVALID','invalid candidature is rejected');
create temp table submitted_franchise_application(id uuid);
insert into submitted_franchise_application
select public.submit_franchise_application('Hatim Candidat','candidat@example.invalid','CASABLANCA_SETTAT','Dirigeant','IT — Informatique','Immédiate',repeat('Motivation professionnelle suffisante. ',3),'fr',repeat('b',64));
select is((select status from public.franchise_applications where id=(select id from submitted_franchise_application)),'REGISTERED','a public candidature opens at REGISTERED');
select * from finish();
rollback;
