-- Isolated TEST-only, rollback-only fixtures; no disabled trigger or policy.
-- Mutations run as the authenticated manager through audited catalogue commands.
begin;
set local search_path=public,extensions;
select no_plan();
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT' where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','editorial-lifecycle-'||i||'@example.invalid','',now(),'{}','{}',now(),now() from generate_series(1,3)i;
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('b3610000-0000-4000-8000-000000000001','Editorial TEST A','Editorial TEST A','ACTIVE','a3610000-0000-4000-8000-000000000001'),
('b3610000-0000-4000-8000-000000000002','Editorial TEST B','Editorial TEST B','ACTIVE','a3610000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status)
select ('c3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('a3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ACTIVE' from generate_series(1,2)i;
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)
select ('f3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'EDITORIAL_361_'||i,'editorial-361-'||i,('b3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'DRAFT',('a3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.catalog_library_mandates(library_id,organization_id,status,valid_from,policy_version,created_by)
select ('f3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ACTIVE',now()-interval'1 day',1,('a3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.franchises(id,library_id,operator_organization_id,franchise_type,operator_code,territory_code,status,activation_mode,created_by)
select ('d3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('f3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('b3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'STANDARD','FRANCHISEE','EDITORIAL_361_'||i,'ACTIVE','NON_CONTRACTUAL_DEMO',('a3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.franchise_territory_versions(id,franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)
select ('e3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('d3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,1,'EDITORIAL_361_'||i,'Territoire test '||i,'نطاق اختبار '||i,'{}',now()-interval'1 day',repeat('a',64),('a3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
insert into public.franchise_mandate_versions(id,franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,content_hash,created_by)
select ('e3611000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('d3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('e3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,(select id from public.franchise_economic_rule_versions where franchise_type='STANDARD' order by version desc limit 1),1,'ACTIVE','{}','{}','{"testOnly":true}',0,'UPFRONT',0,5000,2500,2500,'DISTRIBUTABLE_PROFIT',now()-interval'1 day',repeat('b',64),('a3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
update public.franchises f set current_mandate_version_id=m.id from public.franchise_mandate_versions m where m.franchise_id=f.id and f.id in('d3610000-0000-4000-8000-000000000001','d3610000-0000-4000-8000-000000000002');
insert into public.organization_member_roles(membership_id,role_code,franchise_id)
select ('c3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'FRANCHISE_MANAGER',('d3610000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,2)i;
create temporary table editorial_observed(k text primary key,v jsonb);
grant all on editorial_observed to authenticated;
create function pg_temp.editorial_payload361() returns jsonb language sql as $$select '{"label_fr":"Question métier réelle de test","label_ar":"سؤال مهني للاختبار","answer_type":"YES_NO","data_key":"editorial.original","required_by_default":true,"required_for_quote":true,"required_for_publication":true,"options":[],"validation_schema":{},"structured_schema":null,"sensitivity":"BUSINESS","nullable":false,"weight":1,"maximum_score":1}'::jsonb$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3610000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into editorial_observed values('create',public.create_catalog_question('f3610000-0000-4000-8000-000000000001','EDITORIAL_ORIGINAL','LIBRARY',pg_temp.editorial_payload361(),'Création native de test','editorial361-create'));
select is((select v->>'outcome'from editorial_observed where k='create'),'CATALOG_QUESTION_CREATED','manager creates a real version through the audited command');
insert into editorial_observed values('before',public.franchise_catalog_page('d3610000-0000-4000-8000-000000000001','QUESTION','',1,null,'DRAFT'));
select is((select(v#>>'{groups,QUESTION,total}')::integer from editorial_observed where k='before'),1,'new draft is present before archive');
insert into editorial_observed values('archive',public.set_catalog_question_archived((select(v->>'question_id')::uuid from editorial_observed where k='create'),1,true,'Archivage natif pour vérifier la projection','editorial361-archive'));
insert into editorial_observed values('archive-replay',public.set_catalog_question_archived((select(v->>'question_id')::uuid from editorial_observed where k='create'),1,true,'Archivage natif pour vérifier la projection','editorial361-archive'));
select is((select v from editorial_observed where k='archive'),(select v from editorial_observed where k='archive-replay'),'archive replay keeps exactly one audited outcome');
select is(public.franchise_question_detail('d3610000-0000-4000-8000-000000000001',(select(v->>'question_id')::uuid from editorial_observed where k='create'))->>'identityStatus','ARCHIVED','detail reads archived identity without rewriting source');
select is((public.franchise_catalog_page('d3610000-0000-4000-8000-000000000001','QUESTION','',1,null,'DRAFT')#>>'{groups,QUESTION,total}')::integer,0,'archived identity is absent from drafts despite historical draft version');
select is((public.franchise_catalog_page('d3610000-0000-4000-8000-000000000001','QUESTION','',1,null,'ARCHIVED')#>>'{groups,QUESTION,total}')::integer,1,'archived question is reachable through the actual archive filter');
select is((select v.status from public.question_versions v where v.id=(select(o.v->>'version_id')::uuid from editorial_observed o where k='create')),'DRAFT','archiving identity preserves original version state');
select is((select count(*)::integer from public.question_versions v where v.question_id=(select(o.v->>'question_id')::uuid from editorial_observed o where k='create')),1,'archiving creates no replacement historical version');
select throws_ok(format($q$select public.save_catalog_question_draft(%L,%L,'LIBRARY',pg_temp.editorial_payload361(),'Archive edit must be refused',2,1,'editorial361-locked')$q$,(select v->>'question_id'from editorial_observed where k='create'),(select v->>'version_id'from editorial_observed where k='create')),'55000','CATALOG_QUESTION_NOT_EDITABLE','archive cannot be edited without restoring');
insert into editorial_observed values('restore',public.set_catalog_question_archived((select(v->>'question_id')::uuid from editorial_observed where k='create'),2,false,'Restauration native de la question','editorial361-restore'));
select is((public.franchise_catalog_page('d3610000-0000-4000-8000-000000000001','QUESTION','',1,null,'DRAFT')#>>'{groups,QUESTION,total}')::integer,1,'restored identity returns to the draft filter');
insert into editorial_observed values('save',public.save_catalog_question_draft((select(v->>'question_id')::uuid from editorial_observed where k='create'),(select(v->>'version_id')::uuid from editorial_observed where k='create'),'LIBRARY',pg_temp.editorial_payload361()||'{"label_fr":"Question métier révisée"}','Révision native indépendante',3,1,'editorial361-save'));
select is((select(v->>'version_number')::integer from editorial_observed where k='save'),2,'editing creates a separate draft version');
select is(public.franchise_question_detail('d3610000-0000-4000-8000-000000000001',(select(v->>'question_id')::uuid from editorial_observed where k='create'))#>>'{payload,label_fr}','Question métier révisée','detail opens the current draft rather than a stale historical version');
select is((select label_fr from public.question_versions where id=(select(v->>'version_id')::uuid from editorial_observed where k='create')),'Question métier réelle de test','original wording remains immutable after edit');
insert into editorial_observed values('duplicate',public.duplicate_catalog_question((select(v->>'question_id')::uuid from editorial_observed where k='create'),(select(v->>'version_id')::uuid from editorial_observed where k='save'),'EDITORIAL_COPY','editorial.copy','Duplication native indépendante','editorial361-duplicate'));
select isnt((select v->>'question_id'from editorial_observed where k='duplicate'),(select v->>'question_id'from editorial_observed where k='create'),'duplicate has its own identity');
select is((select(v->>'identity_row_version')::integer from editorial_observed where k='duplicate'),1,'duplicate starts at its first revision');
-- Outbox is intentionally private to application roles; inspect the test receipt as fixture owner.
reset role;
select is((select count(*)::integer from public.event_outbox where event_type in('CatalogQuestionCreatedV1','CatalogQuestionArchivedV1','CatalogQuestionRestoredV1','CatalogQuestionDraftSavedV1','CatalogQuestionDuplicatedV1')and organization_id='b3610000-0000-4000-8000-000000000001'),5,'each native mutation emits one event and replay emits none');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a3610000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.franchise_catalog_page('d3610000-0000-4000-8000-000000000001','QUESTION')$$,'42501','FRANCHISE_CATALOG_SCOPE_DENIED','another mandate cannot read the edited catalogue');
select throws_ok(format($q$select public.duplicate_catalog_question(%L,%L,'FOREIGN_COPY','foreign.copy','Attempt across catalogue scope','editorial361-foreign')$q$,(select v->>'question_id'from editorial_observed where k='create'),(select v->>'version_id'from editorial_observed where k='save')),'42501','CATALOG_SCOPE_DENIED','another mandate cannot duplicate a foreign question');
select is((select count(*)::integer from public.question_bank_questions where library_id='f3610000-0000-4000-8000-000000000001'),0,'underlying RLS also hides the foreign identities');
reset role;
select * from finish();
rollback;
