begin;
set local search_path=public,extensions;
-- Storage API sets this native transaction flag before metadata DELETE. Keep
-- normal authenticated RLS enabled; this test does not delete physical bytes.
set local storage.allow_delete_query='true';
select plan(22);
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-storage-rls-0244',configured_at=clock_timestamp()where singleton;
-- Synthetic historical mission facts isolate SQL/RLS behavior. This is neither
-- a contract activation test nor proof that physical Storage bytes were stored.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f2440000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p244-client@example.invalid','',now(),'{}','{}',now(),now()),
('f2440000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p244-provider@example.invalid','',now(),'{}','{}',now(),now()),
('f2440000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p244-foreign@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by) values
('f2440001-0000-4000-8000-000000000001','P244 Client','P244 Client','ACTIVE','f2440000-0000-4000-8000-000000000001'),
('f2440001-0000-4000-8000-000000000002','P244 Provider','P244 Provider','ACTIVE','f2440000-0000-4000-8000-000000000002'),
('f2440001-0000-4000-8000-000000000003','P244 Foreign','P244 Foreign','ACTIVE','f2440000-0000-4000-8000-000000000003');
insert into public.organization_memberships(id,organization_id,user_id,status) values
('f2440002-0000-4000-8000-000000000001','f2440001-0000-4000-8000-000000000001','f2440000-0000-4000-8000-000000000001','ACTIVE'),
('f2440002-0000-4000-8000-000000000002','f2440001-0000-4000-8000-000000000002','f2440000-0000-4000-8000-000000000002','ACTIVE'),
('f2440002-0000-4000-8000-000000000003','f2440001-0000-4000-8000-000000000003','f2440000-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code) values
('f2440002-0000-4000-8000-000000000001','CLIENT_OWNER'),('f2440002-0000-4000-8000-000000000002','PROVIDER_OWNER'),('f2440002-0000-4000-8000-000000000003','CLIENT_OWNER');
insert into public.contracts(id,client_organization_id,provider_organization_id,status,current_version,created_by) values('f2440003-0000-4000-8000-000000000001','f2440001-0000-4000-8000-000000000001','f2440001-0000-4000-8000-000000000002','ACTIVE',1,'f2440000-0000-4000-8000-000000000001');
-- This test exercises mission/proof behavior, not quote selection. Seed only the
-- immutable FK target while replication role bypasses its unrelated upstream graph.
set local session_replication_role=replica;
insert into public.quote_versions(id,quote_id,rfq_id,provider_organization_id,version_number,lifecycle_status,change_reason,currency,solution_fr,deliverables,warranty_fr,correction_terms_fr,proposed_start_date,duration_days,valid_until,subtotal_minor,tax_minor,total_minor,recurring_subtotal_minor,calculation_basis,content_hash,submitted_at,created_by)values('f2440005-0000-4000-8000-000000000001','f2440006-0000-4000-8000-000000000001','f2440007-0000-4000-8000-000000000001','f2440001-0000-4000-8000-000000000002',1,'SUBMITTED','Fixture mission P244','MAD','Solution fixture','["Livrable"]','Garantie fixture','Corrections fixture',current_date,1,clock_timestamp()+interval'1 day',10000,0,10000,0,'{}',repeat('f',64),clock_timestamp(),'f2440000-0000-4000-8000-000000000002');

insert into public.contract_versions(id,contract_id,version,selected_quote_version_id,request_snapshot,quote_snapshot,clauses,price_minor,currency,commission_rule_snapshot,content_hash,change_reason,created_by) values('f2440004-0000-4000-8000-000000000001','f2440003-0000-4000-8000-000000000001',1,'f2440005-0000-4000-8000-000000000001','{}','{"quote_version_id":"f2440005-0000-4000-8000-000000000001"}','{}',10000,'MAD','{}',repeat('a',64),'Fixture comportementale','f2440000-0000-4000-8000-000000000001');
set local session_replication_role=origin;
insert into public.missions(id,contract_id,contract_version_id,client_organization_id,provider_organization_id,status,started_at,created_by) values('f2440008-0000-4000-8000-000000000001','f2440003-0000-4000-8000-000000000001','f2440004-0000-4000-8000-000000000001','f2440001-0000-4000-8000-000000000001','f2440001-0000-4000-8000-000000000002','ACTIVE',now(),'f2440000-0000-4000-8000-000000000001');
insert into public.mission_milestones(id,mission_id,milestone_key,title_fr,title_ar,sort_order,owner_organization_id) values('f2440009-0000-4000-8000-000000000001','f2440008-0000-4000-8000-000000000001','M1','Jalon','مرحلة',1,'f2440001-0000-4000-8000-000000000002');
insert into public.deliverables(id,mission_id,milestone_id,deliverable_key,label_fr,label_ar,proof_required,current_version,status) values('f244000a-0000-4000-8000-000000000001','f2440008-0000-4000-8000-000000000001','f2440009-0000-4000-8000-000000000001','D1','Livrable','تسليم',true,1,'SUBMITTED');

grant usage on schema extensions to authenticated,service_role;
grant execute on all functions in schema extensions to authenticated,service_role;
create temporary table storage244_observed(k text primary key,n bigint);grant all on storage244_observed to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f2440000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
insert into storage.objects(bucket_id,name,owner_id,metadata)
select 'delivery-proofs','f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/'||file,'f2440000-0000-4000-8000-000000000002','{"mimetype":"application/pdf","size":20}'from unnest(array['pending.pdf','clean.pdf','discard-before.pdf','discard-after.pdf'])file;
insert into storage244_observed values('unbound-before',(select count(*)from storage.objects where bucket_id='delivery-proofs'and name like'f2440000-0000-4000-8000-000000000002/%'));
reset role;
insert into storage.objects(bucket_id,name,owner_id,metadata)values('delivery-proofs','f2440000-0000-4000-8000-000000000003/f244000a-0000-4000-8000-000000000001/foreign.pdf','f2440000-0000-4000-8000-000000000003','{}');
insert into public.delivery_versions(id,deliverable_id,version,description,content_hash,submitted_by)values('f2440010-0000-4000-8000-000000000001','f244000a-0000-4000-8000-000000000001',1,'Preuves SQL RLS0244',repeat('b',64),'f2440000-0000-4000-8000-000000000002');
insert into public.delivery_proofs(id,delivery_version_id,proof_type,storage_path,evidence_hash,metadata,created_by)values
('f2440011-0000-4000-8000-000000000001','f2440010-0000-4000-8000-000000000001','DOCUMENT','f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/pending.pdf',repeat('b',64),'{}','f2440000-0000-4000-8000-000000000002'),
('f2440011-0000-4000-8000-000000000002','f2440010-0000-4000-8000-000000000001','DOCUMENT','f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/clean.pdf',repeat('b',64),'{}','f2440000-0000-4000-8000-000000000002');

set local role authenticated;
insert into storage244_observed values('pending-before',(select count(*)from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/pending.pdf'));
with removed as(delete from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/pending.pdf'returning 1)insert into storage244_observed select 'bound-delete-before',count(*)from removed;
with removed as(delete from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/discard-before.pdf'returning 1)insert into storage244_observed select 'unbound-delete-before',count(*)from removed;
reset role;
select is((select n from storage244_observed where k='unbound-before'),4::bigint,'active uploader can read its four own unbound SQL objects');
select is((select n from storage244_observed where k='pending-before'),0::bigint,'active uploader cannot read a bound proof before CLEAN');
select is((select n from storage244_observed where k='bound-delete-before'),0::bigint,'active uploader cannot delete a bound proof');
select is((select n from storage244_observed where k='unbound-delete-before'),1::bigint,'active uploader can delete a genuinely unbound own object');

set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);
create temporary table storage244_claim as select*from public.claim_delivery_proof_scan_jobs('f2440012-0000-4000-8000-000000000001',100,300)where proof_id='f2440011-0000-4000-8000-000000000002';
select public.complete_delivery_proof_scan_job('f2440011-0000-4000-8000-000000000002',(select lease_token from storage244_claim),'f2440012-0000-4000-8000-000000000001',(select row_version from storage244_claim),'CLEAN','TEST_AV','1.0',repeat('b',64),'storage244-native-clean');
reset role;
select is((select scan_status from public.delivery_proofs where id='f2440011-0000-4000-8000-000000000002'),'CLEAN','trusted scanner protocol establishes the CLEAN fixture');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"f2440000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
insert into storage244_observed values('clean-before',(select count(*)from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/clean.pdf'));
reset role;
select is((select n from storage244_observed where k='clean-before'),1::bigint,'active uploader retains mission-party access to its CLEAN proof');

update public.organization_memberships set status='REVOKED',row_version=row_version+1 where id='f2440002-0000-4000-8000-000000000002';
set local role authenticated;select set_config('request.jwt.claims','{"sub":"f2440000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
insert into storage244_observed values
('hidden-proofs',(select count(*)from public.delivery_proofs where id in('f2440011-0000-4000-8000-000000000001','f2440011-0000-4000-8000-000000000002'))),
('pending-after',(select count(*)from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/pending.pdf')),
('clean-after',(select count(*)from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/clean.pdf')),
('unbound-after',(select count(*)from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/discard-after.pdf')),
('foreign-after',(select count(*)from storage.objects where bucket_id='delivery-proofs'and name like'f2440000-0000-4000-8000-000000000003/%'));
reset role;
select is((select n from storage244_observed where k='hidden-proofs'),0::bigint,'revocation really hides proof rows through tenant RLS');
select is((select n from storage244_observed where k='pending-after'),0::bigint,'hidden binding never makes PENDING evidence readable as an orphan');
select is((select n from storage244_observed where k='clean-after'),0::bigint,'former member cannot read even CLEAN evidence through the orphan policy');
select is((select n from storage244_observed where k='unbound-after'),1::bigint,'former member can still read its genuinely unbound own object');
select is((select n from storage244_observed where k='foreign-after'),0::bigint,'former member cannot read another uploader prefix');

-- Restore only these synthetic metadata rows if the vulnerable schema deletes
-- one. The whole SQL fixture rolls back; no physical Storage bytes are claimed.
set local role authenticated;
with removed as(delete from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/pending.pdf'returning 1)select count(*)as n into temporary storage244_pending_delete from removed;
reset role;select is((select n from storage244_pending_delete),0::bigint,'revoked uploader cannot delete a hidden PENDING binding');
insert into storage.objects(bucket_id,name,owner_id,metadata)values('delivery-proofs','f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/pending.pdf','f2440000-0000-4000-8000-000000000002','{"mimetype":"application/pdf","size":20}')on conflict(bucket_id,name)do nothing;
set local role authenticated;
with removed as(delete from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/clean.pdf'returning 1)select count(*)as n into temporary storage244_clean_delete from removed;
reset role;select is((select n from storage244_clean_delete),0::bigint,'revoked uploader cannot delete a hidden CLEAN binding');
insert into storage.objects(bucket_id,name,owner_id,metadata)values('delivery-proofs','f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/clean.pdf','f2440000-0000-4000-8000-000000000002','{"mimetype":"application/pdf","size":20}')on conflict(bucket_id,name)do nothing;

set local role authenticated;
with removed as(delete from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/discard-after.pdf'returning 1)insert into storage244_observed select 'unbound-delete-after',count(*)from removed;
with removed as(delete from storage.objects where bucket_id='delivery-proofs'and name like'f2440000-0000-4000-8000-000000000003/%'returning 1)insert into storage244_observed select 'foreign-delete-after',count(*)from removed;
select set_config('request.jwt.claims','{"sub":"f2440000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into storage244_observed values('client-clean',(select count(*)from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/clean.pdf')),('client-pending',(select count(*)from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/pending.pdf'));
reset role;
select is((select n from storage244_observed where k='unbound-delete-after'),1::bigint,'former member can delete its genuinely unbound own object');
select is((select n from storage244_observed where k='foreign-delete-after'),0::bigint,'former member cannot delete another uploader object');
select is((select n from storage244_observed where k='client-clean'),1::bigint,'remaining client party retains CLEAN evidence access');
select is((select n from storage244_observed where k='client-pending'),0::bigint,'remaining client party cannot read PENDING evidence');

select throws_ok($$delete from storage.objects where bucket_id='delivery-proofs'and name='f2440000-0000-4000-8000-000000000002/f244000a-0000-4000-8000-000000000001/clean.pdf'$$,'23503',null,'native FK prevents even an RLS-bypassing delete from orphaning a binding');
select ok(exists(select 1 from pg_constraint where conrelid='public.delivery_proofs'::regclass and conname='delivery_proofs_storage_object_binding_v1'and confdeltype='r'and not convalidated),'binding FK restricts deletions without certifying old absent objects');
select ok(exists(select 1 from pg_proc where oid=to_regprocedure('private.delivery_proof_storage_owner_unbound_v1(text,text)')and prosecdef and proconfig@>array['search_path=pg_catalog','row_security=off']),'private absence check bypasses proof RLS with a fixed search path');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a where p.oid=to_regprocedure('private.delivery_proof_storage_owner_unbound_v1(text,text)')and a.privilege_type='EXECUTE'and(a.grantee=0 or pg_get_userbyid(a.grantee)in('anon','service_role'))),'absence helper is not executable by PUBLIC, anon or service_role');
select ok(position('FOR KEY SHARE'in upper(pg_get_functiondef('private.bind_delivery_proof_storage()'::regprocedure)))>0,'binder takes a native object lock before attaching evidence');

select*from finish();
rollback;
