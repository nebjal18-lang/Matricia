-- Candidature -> organization -> proposed mandate -> approval -> activation,
-- first-visit opportunity -> need intake, and evidence-only pipeline catch-up.
begin;set local search_path=public,extensions;select plan(24);
grant usage on schema extensions to authenticated;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a3800000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','onboarding380-'||n||'@example.invalid','',now(),'{}','{}',now(),now() from generate_series(1,5)n;
insert into public.platform_user_roles(user_id,role_code) values('a3800000-0000-4000-8000-000000000001','MATRICIA_ADMIN'),('a3800000-0000-4000-8000-000000000002','MATRICIA_ADMIN');
insert into public.organizations(id,legal_name,display_name,status,created_by) values
 ('b3800000-0000-4000-8000-000000000001','TEST380 opérateur','TEST380 opérateur','ACTIVE','a3800000-0000-4000-8000-000000000003'),
 ('b3800000-0000-4000-8000-000000000002','TEST380 client','TEST380 client','ACTIVE','a3800000-0000-4000-8000-000000000004'),
 ('b3800000-0000-4000-8000-000000000003','TEST380 autre','TEST380 autre','ACTIVE','a3800000-0000-4000-8000-000000000005');
insert into public.organization_memberships(id,organization_id,user_id,status) values
 ('d3800000-0000-4000-8000-000000000003','b3800000-0000-4000-8000-000000000001','a3800000-0000-4000-8000-000000000003','ACTIVE'),
 ('d3800000-0000-4000-8000-000000000004','b3800000-0000-4000-8000-000000000002','a3800000-0000-4000-8000-000000000004','ACTIVE'),
 ('d3800000-0000-4000-8000-000000000005','b3800000-0000-4000-8000-000000000003','a3800000-0000-4000-8000-000000000005','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code,granted_by) values
 ('d3800000-0000-4000-8000-000000000003','FRANCHISE_OWNER','a3800000-0000-4000-8000-000000000003'),
 ('d3800000-0000-4000-8000-000000000004','CLIENT_OWNER','a3800000-0000-4000-8000-000000000004'),
 ('d3800000-0000-4000-8000-000000000005','FRANCHISE_OWNER','a3800000-0000-4000-8000-000000000005');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by) values('c3800000-0000-4000-8000-000000000001','TEST380','test380','b3800000-0000-4000-8000-000000000001','a3800000-0000-4000-8000-000000000001');
do $$begin
  if to_regclass('private.admin_execution_environment_v1') is not null then
    execute $sql$update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST0380_ROLLBACK_ONLY' where singleton$sql$;
  end if;
end$$;
create temporary table chain380(k text primary key,v jsonb);
grant select,insert on chain380 to authenticated;
insert into chain380 select 'application',to_jsonb(public.submit_franchise_application('Candidat TEST380','onboarding380-3@example.invalid','CASABLANCA_SETTAT','Dirigeant','TEST380 — Bibliothèque test','Immédiate',repeat('Motivation professionnelle suffisante. ',3),'fr',repeat('c',64)));

-- Candidate links its own organization; another owner cannot.
select set_config('request.jwt.claims','{"sub":"a3800000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);set local role authenticated;
select throws_ok($$select public.link_my_franchise_application_organization((select (v#>>'{}')::uuid from chain380 where k='application'),'b3800000-0000-4000-8000-000000000003',1,'TEST380-foreign-link')$$,'42501','FRANCHISE_APPLICATION_LINK_DENIED','another account cannot attach its organization to a candidature');
reset role;
select set_config('request.jwt.claims','{"sub":"a3800000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);set local role authenticated;
select throws_ok($$select public.link_my_franchise_application_organization((select (v#>>'{}')::uuid from chain380 where k='application'),'b3800000-0000-4000-8000-000000000003',1,'TEST380-wrong-org')$$,'42501','FRANCHISE_APPLICATION_LINK_DENIED','the candidate cannot attach an organization it does not own');
select is(public.link_my_franchise_application_organization((select (v#>>'{}')::uuid from chain380 where k='application'),'b3800000-0000-4000-8000-000000000001',1,'TEST380-link')->>'outcome','FRANCHISE_APPLICATION_ORGANIZATION_LINKED','the candidate attaches its own franchise organization');
select is(public.link_my_franchise_application_organization((select (v#>>'{}')::uuid from chain380 where k='application'),'b3800000-0000-4000-8000-000000000001',1,'TEST380-link')->>'replayed','true','a retried link replays without a second change');
select is((select organization_id from public.franchise_applications where id=(select (v#>>'{}')::uuid from chain380 where k='application')),'b3800000-0000-4000-8000-000000000001'::uuid,'the candidate reads its dossier with the linked organization');
reset role;

-- Admin reviews, sees the candidate's organization and proposes the mandate from the dossier.
select set_config('request.jwt.claims','{"sub":"a3800000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.review_franchise_application((select (v#>>'{}')::uuid from chain380 where k='application'),'COMPANY_REVIEW','TEST380 revue société',2,'TEST380-review-1');
select public.review_franchise_application((select (v#>>'{}')::uuid from chain380 where k='application'),'DOCUMENT_REVIEW','TEST380 pièces demandées',3,'TEST380-review-2');
select is((select array_agg(organization_id) from public.franchise_application_organization_candidates((select (v#>>'{}')::uuid from chain380 where k='application'))),array['b3800000-0000-4000-8000-000000000001'::uuid],'the reviewer chooses only organizations owned by the candidate address');
select throws_ok($$select public.propose_franchise_from_application((select (v#>>'{}')::uuid from chain380 where k='application'),100000,'UPFRONT',0,36,'Casablanca-Settat','الدار البيضاء سطات','',repeat('e',64),'TEST380 proposition',3,'TEST380-stale')$$,'40001','STALE_FRANCHISE_APPLICATION','a stale dossier version cannot propose a mandate');
insert into chain380 select 'proposal',public.propose_franchise_from_application((select (v#>>'{}')::uuid from chain380 where k='application'),100000,'UPFRONT',0,36,'Casablanca-Settat','الدار البيضاء سطات','Aucune exclusivité supplémentaire.',repeat('e',64),'TEST380 proposition',4,'TEST380-propose');
select is((select v->>'outcome' from chain380 where k='proposal'),'FRANCHISE_APPROVAL_REQUIRED','the proposal opens the central approval');
select is((select status from public.franchise_applications where id=(select (v#>>'{}')::uuid from chain380 where k='application')),'CONTRACT_PENDING','the dossier is bound to the proposed mandate');
select is((select invited_email::text from public.franchise_invitations where id=(select (v->>'invitation_id')::uuid from chain380 where k='proposal')),'onboarding380-3@example.invalid','the invitation targets the candidate address');
select is((select entry_fee_minor::text||':'||entry_fee_mode from public.franchise_mandate_versions where id=(select (v->>'mandate_version_id')::uuid from chain380 where k='proposal')),'100000:UPFRONT','the standard entry fee comes from the reviewer in minor units');
select is(public.propose_franchise_from_application((select (v#>>'{}')::uuid from chain380 where k='application'),100000,'UPFRONT',0,36,'Casablanca-Settat','الدار البيضاء سطات','Aucune exclusivité supplémentaire.',repeat('e',64),'TEST380 proposition',4,'TEST380-propose')->>'replayed','true','a retried proposal does not create a second mandate');
select throws_ok($$select public.decide_franchise_governance((select (v->>'approval_request_id')::uuid from chain380 where k='proposal'),'APPROVE','TEST380 auto approbation',1,'TEST380-self-approve')$$,'42501','FRANCHISE_APPROVAL_DENIED','the proposing admin cannot approve its own mandate');
select is(public.rotate_franchise_application_invitation_code((select (v#>>'{}')::uuid from chain380 where k='application'),repeat('9',64),'TEST380 e-mail non reçu','TEST380-rotate')->>'outcome','FRANCHISE_INVITATION_CODE_ROTATED','a reviewer can issue a fresh invitation code');
reset role;

select set_config('request.jwt.claims','{"sub":"a3800000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_franchise_governance((select (v->>'approval_request_id')::uuid from chain380 where k='proposal'),'APPROVE','TEST380 approbation indépendante',1,'TEST380-approve');
reset role;
select is((select status from public.franchise_applications where id=(select (v#>>'{}')::uuid from chain380 where k='application')),'LIBRARY_ASSIGNED','central approval moves the dossier to library assigned');

select set_config('request.jwt.claims','{"sub":"a3800000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);set local role authenticated;
do $$
declare invitation uuid := (select (v->>'invitation_id')::uuid from chain380 where k='proposal');
begin
  if to_regprocedure('public.simulate_franchise_invitation_acceptance(uuid,text,integer,uuid,text,boolean,text,uuid)') is not null then
    execute 'select public.simulate_franchise_invitation_acceptance($1,$2,1,$3,(public.franchise_invitation_activation_preview($1)->>''mandateHash''),true,''TEST380-activate'')'
      using invitation, repeat('9',64), (select (v->>'mandate_version_id')::uuid from chain380 where k='proposal');
  else
    perform public.accept_franchise_invitation(invitation, repeat('9',64), 1, 'TEST380-activate');
  end if;
end$$;
reset role;
select is((select status from public.franchise_applications where id=(select (v#>>'{}')::uuid from chain380 where k='application')),'ACTIVE','the candidate activation closes the dossier as active');

-- The IT exception always proposes Hatim Ahmitech with a zero, exempt entry fee.
insert into public.catalog_libraries(code,slug,steward_organization_id,created_by)
select 'IT','it-test380','b3800000-0000-4000-8000-000000000001','a3800000-0000-4000-8000-000000000001' where not exists(select 1 from public.catalog_libraries where code='IT');
insert into chain380 select 'application_it',to_jsonb(public.submit_franchise_application('Candidat TEST380','onboarding380-3@example.invalid','RABAT_SALE_KENITRA','Dirigeant','IT — Informatique','Immédiate',repeat('Motivation professionnelle suffisante. ',3),'fr',repeat('c',64)));
select set_config('request.jwt.claims','{"sub":"a3800000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);set local role authenticated;
select public.link_my_franchise_application_organization((select (v#>>'{}')::uuid from chain380 where k='application_it'),'b3800000-0000-4000-8000-000000000001',1,'TEST380-link-it');
reset role;
select set_config('request.jwt.claims','{"sub":"a3800000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.review_franchise_application((select (v#>>'{}')::uuid from chain380 where k='application_it'),'COMPANY_REVIEW','TEST380 revue IT',2,'TEST380-review-it-1');
select public.review_franchise_application((select (v#>>'{}')::uuid from chain380 where k='application_it'),'DOCUMENT_REVIEW','TEST380 pièces IT',3,'TEST380-review-it-2');
insert into chain380 select 'proposal_it',public.propose_franchise_from_application((select (v#>>'{}')::uuid from chain380 where k='application_it'),999999,'UPFRONT',0,24,'Rabat-Salé-Kénitra','الرباط سلا القنيطرة','',repeat('f',64),'TEST380 proposition IT',4,'TEST380-propose-it');
reset role;
select is((select franchise_type||':'||operator_code from public.franchises where id=(select (v->>'franchise_id')::uuid from chain380 where k='proposal_it')),'IT:HATIM_AHMITECH','an IT candidature is proposed under the Hatim Ahmitech exception');
select is((select entry_fee_minor::text||':'||entry_fee_mode||':'||entry_fee_term_months from public.franchise_mandate_versions where id=(select (v->>'mandate_version_id')::uuid from chain380 where k='proposal_it')),'0:EXEMPT:0','the IT entry fee is zero and exempt whatever the reviewer typed');

-- Pipeline: a linked prospect catches up only the stages that have evidence.
insert into public.public_diagnostic_intakes(organization_id,created_by,locale,answers,priorities,content_hash)
values('b3800000-0000-4000-8000-000000000002','a3800000-0000-4000-8000-000000000004','fr',
 '{"goals":["save_time"],"sector":"commerce","team_size":"small","priority_tracking":"no","sales_tracking":"shared","backup_restore":"no","decision_trace":"systematic","next_action":"Organiser le suivi"}','[]',repeat('d',64));
insert into public.franchise_crm_prospects(franchise_id,territory_version_id,prospect_type,display_name,contact_email,source_code,owner_user_id,created_by,linked_organization_id)
select f.id,t.id,'CLIENT','Client TEST380','onboarding380-4@example.invalid','TEST_SOURCE','a3800000-0000-4000-8000-000000000003','a3800000-0000-4000-8000-000000000003','b3800000-0000-4000-8000-000000000002'
from public.franchises f join public.franchise_territory_versions t on t.franchise_id=f.id where f.id=(select (v->>'franchise_id')::uuid from chain380 where k='proposal');
select is((select pipeline_stage from public.franchise_crm_prospects where display_name='Client TEST380'),'REGISTERED','linking catches up opened and registered, then stops before the missing profile');
select is((select count(*)::int from public.franchise_pipeline_events e join public.franchise_crm_prospects p on p.id=e.prospect_id where p.display_name='Client TEST380'),2,'each caught-up stage has its own evidence event');

-- First-visit opportunity opens a real need intake for the versioned service hint.
select set_config('request.jwt.claims','{"sub":"a3800000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}',true);set local role authenticated;
select public.promote_public_diagnostic_intake((select id from public.public_diagnostic_intakes where organization_id='b3800000-0000-4000-8000-000000000002'),'TEST380-promote');
insert into chain380 select 'quote',public.act_on_public_diagnostic_opportunity(o.id,'REQUEST_QUOTES',null,o.row_version,'TEST380-quote')
from public.public_diagnostic_opportunities o join public.public_diagnostic_findings f on f.id=o.finding_id where o.organization_id='b3800000-0000-4000-8000-000000000002' and f.code='BACKUP_ABSENT';
select is((select v->>'service_code' from chain380 where k='quote'),'IT-BACKUP','a missing backup requests quotes for the backup service');
select ok((select constraints_text like '%(IT-BACKUP)%' and need_text like 'Suite au diagnostic Matricia%' from public.public_need_intakes where id=(select (v->>'need_intake_id')::uuid from chain380 where k='quote')),'the need intake carries the finding and the preselected service');
select is((select status||':'||(need_intake_id is not null)::text from public.public_diagnostic_opportunities o join public.public_diagnostic_findings f on f.id=o.finding_id where o.organization_id='b3800000-0000-4000-8000-000000000002' and f.code='BACKUP_ABSENT'),'NEED_REQUESTED:true','the opportunity keeps its link to the need intake');
reset role;
select is((select pipeline_stage from public.franchise_crm_prospects where display_name='Client TEST380'),'REGISTERED','a later diagnostic does not skip the missing profile stage');
select * from finish();
rollback;
