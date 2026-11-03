begin;
set local search_path = public, extensions;
select plan(21);

select has_function('public', 'submit_franchise_catalog_questionnaire', array['uuid', 'uuid', 'integer', 'integer', 'text', 'uuid'], 'questionnaire submit exists');
select has_function('public', 'submit_franchise_catalog_rule', array['uuid', 'uuid', 'integer', 'integer', 'text', 'uuid'], 'rule submit exists');
select has_function('public', 'submit_franchise_catalog_publication', array['uuid', 'integer', 'text', 'uuid'], 'publication submit exists');
select ok(
  (
    select bool_and(p.prosecdef and p.proconfig::text like '%search_path=pg_catalog%')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'submit_franchise_catalog_questionnaire',
         'submit_franchise_catalog_rule',
         'submit_franchise_catalog_publication'
       )
  ),
  'franchise catalog commands use a fixed search_path'
);
select ok(
  has_function_privilege('authenticated', 'public.submit_franchise_catalog_questionnaire(uuid,uuid,integer,integer,text,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.submit_franchise_catalog_rule(uuid,uuid,integer,integer,text,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.submit_franchise_catalog_publication(uuid,integer,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.submit_franchise_catalog_questionnaire(uuid,uuid,integer,integer,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.submit_franchise_catalog_rule(uuid,uuid,integer,integer,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.submit_franchise_catalog_publication(uuid,integer,text,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.submit_franchise_catalog_publication(uuid,integer,text,uuid)', 'EXECUTE'),
  'franchise catalog commands are authenticated-only'
);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
('f5900000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p59-central@example.invalid', '', now(), '{}', '{}', now(), now()),
('f5900000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p59-editor@example.invalid', '', now(), '{}', '{}', now(), now()),
('f5900000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p59-outsider@example.invalid', '', now(), '{}', '{}', now(), now());
insert into public.platform_user_roles(user_id, role_code) values ('f5900000-0000-0000-0000-000000000001', 'MATRICIA_ADMIN');
insert into public.organizations(id, legal_name, display_name, status, created_by) values
('f5910000-0000-0000-0000-000000000001', 'P59 Steward', 'P59 Steward', 'ACTIVE', 'f5900000-0000-0000-0000-000000000001'),
('f5910000-0000-0000-0000-000000000002', 'P59 Other', 'P59 Other', 'ACTIVE', 'f5900000-0000-0000-0000-000000000003');
insert into public.organization_memberships(id, organization_id, user_id, status, activated_at) values
('f5920000-0000-0000-0000-000000000001', 'f5910000-0000-0000-0000-000000000001', 'f5900000-0000-0000-0000-000000000002', 'ACTIVE', now()),
('f5920000-0000-0000-0000-000000000002', 'f5910000-0000-0000-0000-000000000002', 'f5900000-0000-0000-0000-000000000003', 'ACTIVE', now());
insert into public.catalog_libraries(id, code, slug, steward_organization_id, status, created_by) values
('f5930000-0000-0000-0000-000000000001', 'P59_LIB', 'p59-lib', 'f5910000-0000-0000-0000-000000000001', 'DRAFT', 'f5900000-0000-0000-0000-000000000001');
insert into public.catalog_categories(id, library_id, code, slug, status, created_by) values
('f5940000-0000-0000-0000-000000000001', 'f5930000-0000-0000-0000-000000000001', 'P59_CAT', 'p59-cat', 'DRAFT', 'f5900000-0000-0000-0000-000000000001');
insert into public.catalog_subcategories(id, library_id, category_id, code, slug, status, created_by) values
('f5950000-0000-0000-0000-000000000001', 'f5930000-0000-0000-0000-000000000001', 'f5940000-0000-0000-0000-000000000001', 'P59_SUB', 'p59-sub', 'DRAFT', 'f5900000-0000-0000-0000-000000000001');
insert into public.catalog_library_mandates(library_id, organization_id, status, valid_from, policy_version, created_by) values
('f5930000-0000-0000-0000-000000000001', 'f5910000-0000-0000-0000-000000000001', 'ACTIVE', now(), 1, 'f5900000-0000-0000-0000-000000000001');
insert into public.organization_member_roles(membership_id, role_code, library_id) values
('f5920000-0000-0000-0000-000000000001', 'FRANCHISE_OWNER', 'f5930000-0000-0000-0000-000000000001'),
('f5920000-0000-0000-0000-000000000002', 'FRANCHISE_OWNER', null);

create temporary table p59_observed(key text primary key, value jsonb);
grant select, insert, update on p59_observed to authenticated;
grant usage on schema extensions to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f5900000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select extensions.throws_ok(
  $$select public.submit_franchise_catalog_questionnaire('f5990000-0000-0000-0000-000000000001','f5990000-0000-0000-0000-000000000002',1,1,'p59-q-unknown')$$,
  '42501',
  'CATALOG_SCOPE_DENIED',
  'unknown questionnaire is hidden before disclosure'
);
select extensions.throws_ok(
  $$select public.submit_franchise_catalog_rule('f5990000-0000-0000-0000-000000000001','f5990000-0000-0000-0000-000000000002',1,1,'p59-r-unknown')$$,
  '42501',
  'CATALOG_SCOPE_DENIED',
  'unknown rule is hidden before disclosure'
);
select extensions.throws_ok(
  $$select public.submit_franchise_catalog_publication('f5930000-0000-0000-0000-000000000001',1,'p59-pub-incomplete')$$,
  '23514',
  'INCOMPLETE_CATALOG_RELEASE',
  'publication refuses a library without an approved FR/AR snapshot'
);

insert into p59_observed values (
  'release',
  public.create_catalog_release(
    'f5930000-0000-0000-0000-000000000001',
    'P59.DRAFT',
    repeat('a', 64),
    false,
    1,
    'p59-release'
  )
);
insert into p59_observed values (
  'questionnaire',
  public.create_catalog_questionnaire(
    'f5930000-0000-0000-0000-000000000001',
    (select (value->>'release_id')::uuid from p59_observed where key = 'release'),
    'P59_DIAG',
    jsonb_build_object(
      'title_fr', 'Diagnostic franchisé',
      'title_ar', 'تشخيص الامتياز',
      'description_fr', 'Description française du diagnostic',
      'description_ar', 'وصف عربي للتشخيص',
      'audience', 'CLIENT',
      'engine_version', '1.0.0',
      'policy_version', '1.0.0',
      'sensitive', false,
      'section_key', 'P59_SEC',
      'section_label_fr', 'Contexte',
      'section_label_ar', 'السياق'
    ),
    'Création du questionnaire',
    'p59-q-create'
  )
);
-- Legacy approval remains valid for a real questionnaire with already approved dependencies.
reset role;
insert into public.question_bank_questions(id,library_id,question_key,scope,created_by)values('f5997000-0000-4000-8000-000000000001','f5930000-0000-0000-0000-000000000001','P59_LEGACY_READY','LIBRARY','f5900000-0000-0000-0000-000000000002');
insert into public.question_versions(id,question_id,library_id,version,status,label_fr,label_ar,answer_type,data_key,content_hash,change_reason,created_by)values('f5997100-0000-4000-8000-000000000001','f5997000-0000-4000-8000-000000000001','f5930000-0000-0000-0000-000000000001',1,'APPROVED','Question déjà approuvée','سؤال معتمد','YES_NO','p59.legacy_ready',repeat('a',64),'Dépendance approuvée existante','f5900000-0000-0000-0000-000000000002');
update public.question_bank_questions set current_draft_version_id='f5997100-0000-4000-8000-000000000001'where id='f5997000-0000-4000-8000-000000000001';
set local role authenticated;
select public.add_catalog_questionnaire_question((select(value->>'version_id')::uuid from p59_observed where key='questionnaire'),(select id from public.questionnaire_sections where questionnaire_version_id=(select(value->>'version_id')::uuid from p59_observed where key='questionnaire')limit 1),'f5997100-0000-4000-8000-000000000001',1,true,1,'p59-ready-question');
insert into p59_observed values (
  'q-submitted',
  public.submit_franchise_catalog_questionnaire(
    (select (value->>'questionnaire_id')::uuid from p59_observed where key = 'questionnaire'),
    (select (value->>'version_id')::uuid from p59_observed where key = 'questionnaire'),
    1,
    2,
    'p59-q-submit'
  )
);
insert into p59_observed values (
  'q-submitted-replay',
  public.submit_franchise_catalog_questionnaire(
    (select (value->>'questionnaire_id')::uuid from p59_observed where key = 'questionnaire'),
    (select (value->>'version_id')::uuid from p59_observed where key = 'questionnaire'),
    1,
    2,
    'p59-q-submit'
  )
);
insert into p59_observed values (
  'rule',
  public.create_catalog_rule(
    'f5930000-0000-0000-0000-000000000001',
    'P59_BACKUP_TESTED',
    jsonb_build_object(
      'condition_ast', jsonb_build_object('kind', 'PREDICATE', 'operator', 'EQ', 'questionKey', 'HAS_BACKUP', 'operand', true),
      'actions', jsonb_build_array(jsonb_build_object('type', 'RECOMMEND_SERVICE', 'target', 'P59_SERVICE')),
      'dependency_graph', jsonb_build_object('HAS_BACKUP', jsonb_build_array('P59_BACKUP_TESTED')),
      'priority', 100,
      'sensitive', false
    ),
    'Création de la règle',
    'p59-r-create'
  )
);
insert into p59_observed values (
  'r-submitted',
  public.submit_franchise_catalog_rule(
    (select (value->>'rule_id')::uuid from p59_observed where key = 'rule'),
    (select (value->>'version_id')::uuid from p59_observed where key = 'rule'),
    1,
    1,
    'p59-r-submit'
  )
);
select set_config('request.jwt.claims', '{"sub":"f5900000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select extensions.throws_ok(
  format(
    $sql$select public.submit_franchise_catalog_questionnaire(%L::uuid,%L::uuid,2,3,'p59-q-cross')$sql$,
    (select value->>'questionnaire_id' from p59_observed where key = 'questionnaire'),
    (select value->>'version_id' from p59_observed where key = 'questionnaire')
  ),
  '42501',
  'CATALOG_SCOPE_DENIED',
  'outsider cannot submit another library questionnaire'
);
reset role;

select is((select value->>'outcome' from p59_observed where key = 'q-submitted'), 'CATALOG_CHANGE_SUBMITTED', 'mandated editor submits a questionnaire draft');
select is((select value from p59_observed where key = 'q-submitted-replay'), (select value from p59_observed where key = 'q-submitted'), 'questionnaire submit replay returns the original DTO');
select ok(
  (
    select v.status = 'CENTRAL_REVIEW' and q.status = 'DRAFT'
      from public.questionnaires q
      join public.questionnaire_versions v on v.id = q.current_draft_version_id
     where q.id = (select (value->>'questionnaire_id')::uuid from p59_observed where key = 'questionnaire')
  ),
  'questionnaire submit moves the version to CENTRAL_REVIEW without publishing'
);
select ok(
  (
    select count(*) = 1
      from public.catalog_change_requests
     where target_type = 'QUESTIONNAIRE'
       and target_id = (select (value->>'questionnaire_id')::uuid from p59_observed where key = 'questionnaire')
       and status = 'IN_REVIEW'
  ),
  'questionnaire submit opens one QUESTIONNAIRE change request'
);
select is((select value->>'outcome' from p59_observed where key = 'r-submitted'), 'CATALOG_CHANGE_SUBMITTED', 'mandated editor submits a rule draft');
select ok(
  (
    select v.status = 'IN_REVIEW' and r.status = 'DRAFT'
      from public.question_rules r
      join public.question_rule_versions v on v.id = r.current_draft_version_id
     where r.id = (select (value->>'rule_id')::uuid from p59_observed where key = 'rule')
  ),
  'rule submit moves the version to IN_REVIEW without publishing'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f5900000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select extensions.throws_ok(
  format(
    $sql$select public.decide_catalog_change(%L::uuid,'APPROVE','Auto approbation interdite',1,'p59-q-self')$sql$,
    (select value->>'change_request_id' from p59_observed where key = 'q-submitted')
  ),
  '42501',
  'CATALOG_APPROVAL_DENIED',
  'submitter cannot approve their own questionnaire change'
);
select set_config('request.jwt.claims', '{"sub":"f5900000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
insert into p59_observed values (
  'q-decided',
  public.decide_catalog_change(
    (select (value->>'change_request_id')::uuid from p59_observed where key = 'q-submitted'),
    'APPROVE',
    'Validation Matricia du questionnaire',
    1,
    'p59-q-decide'
  )
);
insert into p59_observed values (
  'r-decided',
  public.decide_catalog_change(
    (select (value->>'change_request_id')::uuid from p59_observed where key = 'r-submitted'),
    'APPROVE',
    'Validation Matricia de la règle',
    1,
    'p59-r-decide'
  )
);
reset role;

select is((select value->>'outcome' from p59_observed where key = 'q-decided'), 'CATALOG_CHANGE_APPROVED', 'central reviewer approves a QUESTIONNAIRE change');
select ok(
  (
    select v.status = 'APPROVED' and q.status = 'DRAFT'
      from public.questionnaires q
      join public.questionnaire_versions v on v.id = q.current_draft_version_id
     where q.id = (select (value->>'questionnaire_id')::uuid from p59_observed where key = 'questionnaire')
  ),
  'questionnaire approval writes APPROVED without mutating published history'
);
select is((select value->>'outcome' from p59_observed where key = 'r-decided'), 'CATALOG_CHANGE_APPROVED', 'central reviewer approves a RULE change');
select ok(
  (
    select v.status = 'APPROVED' and r.status = 'DRAFT'
      from public.question_rules r
      join public.question_rule_versions v on v.id = r.current_draft_version_id
     where r.id = (select (value->>'rule_id')::uuid from p59_observed where key = 'rule')
  ),
  'rule approval writes APPROVED without publishing'
);
select ok(
  (
    select count(*) = 1 from public.audit_events
     where action = 'catalog.change.submitted'
       and resource_id = (select value->>'change_request_id' from p59_observed where key = 'q-submitted')
  ) and (
    select count(*) = 1
      from public.event_outbox
     where aggregate_id = (select value->>'change_request_id' from p59_observed where key = 'q-submitted')
       and event_type = 'CatalogChangeSubmittedV1'
  ),
  'questionnaire submit emits one audit and one outbox event'
);

select * from finish();
rollback;
