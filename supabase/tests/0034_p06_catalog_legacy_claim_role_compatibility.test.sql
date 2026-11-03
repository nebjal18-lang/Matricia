begin;
set local search_path=public,extensions;
select plan(32);
grant usage on schema extensions to authenticated;

select ok(has_function_privilege('authenticated','public.decide_catalog_change(uuid,boolean,text,integer,text,uuid)','EXECUTE') and not has_function_privilege('anon','public.decide_catalog_change(uuid,boolean,text,integer,text,uuid)','EXECUTE'),'legacy decision facade is authenticated-only');
select ok(has_function_privilege('authenticated','public.revoke_catalog_library_mandate(uuid,integer,text,text,uuid)','EXECUTE') and not has_function_privilege('service_role','public.revoke_catalog_library_mandate(uuid,integer,text,text,uuid)','EXECUTE'),'legacy revoke facade is authenticated-only');
select ok(not has_function_privilege('authenticated','public.decide_catalog_change_legacy_core(uuid,boolean,text,integer,text,uuid)','EXECUTE') and not has_function_privilege('authenticated','public.revoke_catalog_library_mandate_core_v2(uuid,integer,text,text,uuid)','EXECUTE'),'legacy cores are not runtime callable');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f3400000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-compat-central@example.invalid','',now(),'{}','{}',now(),now()),
('f3400000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p06-compat-outsider@example.invalid','',now(),'{}','{}',now(),now());
insert into public.platform_user_roles(user_id,role_code) values('f3400000-0000-0000-0000-000000000001','MATRICIA_ADMIN');

set local role authenticated;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"sub":"f3400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.decide_catalog_change('f34f0000-0000-0000-0000-000000000001',true,'Décision legacy',1,'p06-compat-aal1')$$,'42501','CENTRAL_MFA_REQUIRED','AAL1 remains denied');
select set_config('request.jwt.claims','{"sub":"f3400000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.decide_catalog_change('f34f0000-0000-0000-0000-000000000001',true,'Décision legacy',1,'p06-compat-outsider')$$,'42501','CENTRAL_MFA_REQUIRED','non-central caller remains denied before target lookup');
select throws_ok($$select public.revoke_catalog_library_mandate('f34f0000-0000-0000-0000-000000000002',1,'Révocation interdite','p06-compat-revoke-outsider')$$,'42501','CATALOG_MANDATE_REVOKE_DENIED','non-central revoke remains denied before target lookup');
select set_config('request.jwt.claims','{"sub":"f3400000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.decide_catalog_change('f34f0000-0000-0000-0000-000000000001',true,'Décision legacy',1,'p06-compat-central')$$,'P0002','CATALOG_CHANGE_NOT_FOUND','central AAL2 legacy decision survives stale scalar role claim');
select throws_ok($$select public.revoke_catalog_library_mandate('f34f0000-0000-0000-0000-000000000002',1,'Révocation contrôlée','p06-compat-revoke-central')$$,'P0002','CATALOG_MANDATE_NOT_FOUND','central AAL2 legacy revoke survives stale scalar role claim');
reset role;

-- Probe a real request and an absent UUID with the same unauthorized identities.
-- These historical catalogue rows test the authorization boundary only.
insert into public.organizations(id,legal_name,display_name,status,created_by)values('f3401000-0000-4000-8000-000000000001','Compat34 scope','Compat34 scope','ACTIVE','f3400000-0000-0000-0000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('f3402000-0000-4000-8000-000000000001','COMPAT34','compat34','f3401000-0000-4000-8000-000000000001','IN_REVIEW','f3400000-0000-0000-0000-000000000001');
insert into public.catalog_library_versions(id,library_id,version,status,code,slug,name_fr,name_ar,description_fr,description_ar,icon_key,sort_order,change_reason,content_hash,created_by)values('f3403000-0000-4000-8000-000000000001','f3402000-0000-4000-8000-000000000001',1,'IN_REVIEW','COMPAT34','compat34','Bibliothèque test','مكتبة اختبار','Périmètre de test','نطاق الاختبار','book-open',1,'Recette autorisation',repeat('a',64),'f3400000-0000-0000-0000-000000000001');
insert into public.catalog_change_requests(id,library_id,target_type,target_id,target_version_id,sensitive,requested_by)values('f34f0000-0000-4000-8000-000000000003','f3402000-0000-4000-8000-000000000001','LIBRARY','f3402000-0000-4000-8000-000000000001','f3403000-0000-4000-8000-000000000001',false,'f3400000-0000-0000-0000-000000000001');
create function pg_temp.catalog_authority_probe(p_actor uuid,p_aal text,p_kind text,p_decision text,p_request uuid)returns text language plpgsql as $$
declare call text;begin
 perform set_config('request.jwt.claim.role','authenticated',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated','aal',p_aal)::text,true);
 call:=format('select public.decide_catalog_change(%L::uuid,%s,%L,1,%L)',p_request,
 case when p_kind='BOOLEAN'then(case when p_decision='APPROVE'then'true'else'false'end)||'::boolean'else quote_literal(p_decision)||'::text'end,
 'Recette garde avant recherche','compat34-probe-'||p_actor||p_aal||p_kind||p_decision||p_request);
 return extensions.throws_ok(call,'42501',case when p_kind='BOOLEAN'then'CENTRAL_MFA_REQUIRED'else'CATALOG_APPROVAL_DENIED'end,
 p_kind||' '||p_decision||' '||p_aal||' actor '||right(p_actor::text,1)||' denies request '||right(p_request::text,1)||' before lookup');
end$$;
set local role authenticated;
select pg_temp.catalog_authority_probe(actor,aal,kind,decision,target)
from(values('f3400000-0000-0000-0000-000000000001'::uuid,'aal1'),('f3400000-0000-0000-0000-000000000002'::uuid,'aal1'),('f3400000-0000-0000-0000-000000000002'::uuid,'aal2'))actors(actor,aal)
cross join(values('BOOLEAN'),('TEXT'))kinds(kind)
cross join(values('APPROVE'),('REJECT'))decisions(decision)
cross join(values('f34f0000-0000-0000-0000-000000000001'::uuid),('f34f0000-0000-4000-8000-000000000003'::uuid))targets(target);
reset role;

select * from finish();
rollback;
