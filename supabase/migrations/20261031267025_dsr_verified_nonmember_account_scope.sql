begin;
-- Account rights do not require inventing an organization membership. The
-- authenticated subject can bind a verified request only to the explicitly
-- configured platform controller or a previously proven personal perimeter.
-- Membership history remains an authoritative subject link for tenant records.
create or replace function private.dsr_account_subject_v1(p_request_id uuid)returns uuid language plpgsql stable security definer set search_path=pg_catalog,public,private,extensions as $$
declare d public.data_subject_requests%rowtype;subject_value uuid;candidate uuid:=auth.uid();begin
 select*into d from public.data_subject_requests where id=p_request_id;
 if d.id is null then return null;end if;
 select m.user_id into subject_value from public.organization_memberships m where m.organization_id=d.organization_id and d.subject_reference_hash=encode(extensions.digest(convert_to(d.organization_id::text||':'||m.user_id::text,'UTF8'),'sha256'),'hex')limit 1;
 if subject_value is not null then return subject_value;end if;
 if d.verified_at is null then return null;end if;
 select s.subject_user_id into subject_value from public.dsr_scope_versions_v1 s join public.data_subject_requests verified on verified.id=s.request_id and verified.verified_at is not null where s.request_id=d.id and verified.organization_id=d.organization_id and d.subject_reference_hash=encode(extensions.digest(convert_to(d.organization_id::text||':'||s.subject_user_id::text,'UTF8'),'sha256'),'hex')order by s.version desc limit 1;
 if subject_value is not null then return subject_value;end if;
 if to_regclass('public.dsr_processing_scope_versions_v1')is not null then execute'select s.subject_user_id from public.dsr_processing_scope_versions_v1 s where s.request_id=$1 and s.organization_id=$2 and $3=encode(extensions.digest(convert_to($2::text||'':''||s.subject_user_id::text,''UTF8''),''sha256''),''hex'')order by s.version desc limit 1'into subject_value using d.id,d.organization_id,d.subject_reference_hash;end if;
 if subject_value is not null then return subject_value;end if;
 if candidate is null or auth.jwt()->>'aal'is distinct from'aal2'or d.subject_reference_hash is distinct from encode(extensions.digest(convert_to(d.organization_id::text||':'||candidate::text,'UTF8'),'sha256'),'hex')then return null;end if;
 if exists(select 1 from private.platform_privacy_deployment_scope_v1 where singleton and controller_organization_id=d.organization_id and legal_approval_reference is not null and configured_at is not null)or exists(select 1 from public.dsr_scope_versions_v1 s join public.data_subject_requests verified on verified.id=s.request_id and verified.verified_at is not null and verified.organization_id=d.organization_id where s.subject_user_id=candidate and verified.subject_reference_hash=d.subject_reference_hash)then return candidate;end if;
 if to_regclass('public.dsr_processing_scope_versions_v1')is not null then execute'select s.subject_user_id from public.dsr_processing_scope_versions_v1 s join public.data_subject_requests verified on verified.id=s.request_id and verified.verified_at is not null where s.subject_user_id=$1 and s.organization_id=$2 and verified.organization_id=$2 and verified.subject_reference_hash=$3 limit 1'into subject_value using candidate,d.organization_id,d.subject_reference_hash;end if;
 return subject_value;
end$$;
revoke all on function private.dsr_account_subject_v1(uuid)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
