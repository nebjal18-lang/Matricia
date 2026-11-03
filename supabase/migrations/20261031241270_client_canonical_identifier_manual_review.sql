begin;
create table public.client_canonical_identity_reviews_v1(
 id uuid primary key default extensions.gen_random_uuid(),compliance_case_id uuid not null,organization_id uuid not null,profile_version integer not null,
 identity_hash text not null check(identity_hash~'^[a-f0-9]{64}$'),identity_snapshot jsonb not null,document_ids uuid[]not null check(cardinality(document_ids)=3),
 reason text not null check(length(btrim(reason))between 10 and 2000),reviewed_by uuid not null references auth.users(id),reviewed_at timestamptz not null default clock_timestamp(),proof_hash text not null check(proof_hash~'^[a-f0-9]{64}$'),
 foreign key(compliance_case_id,organization_id,profile_version)references public.client_profile_versions(compliance_case_id,organization_id,version));
alter table public.client_canonical_identity_reviews_v1 enable row level security;
revoke all on public.client_canonical_identity_reviews_v1 from public,anon,authenticated,service_role;
grant select on public.client_canonical_identity_reviews_v1 to authenticated;
create policy client_identity_reviews_staff_read on public.client_canonical_identity_reviews_v1 for select to authenticated using(auth.jwt()->>'aal'='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR']));
create trigger client_canonical_identity_reviews_immutable before update or delete on public.client_canonical_identity_reviews_v1 for each row execute function private.prevent_client_delivery_history_change();
create function private.client_canonical_identity_review_snapshot_v1(p_case_id uuid)returns jsonb language sql stable security definer set search_path=pg_catalog,public,private as $$
 select jsonb_build_object('organization_id',o.id,'legal_name',o.legal_name,'country_code',o.country_code,'profile_version',c.current_profile_version,'identifiers',coalesce((select jsonb_object_agg(i.identifier_type,i.normalized_value::text)from public.organization_identifiers i where i.organization_id=o.id and i.is_active and i.identifier_type in('ICE','IF','RC')),'{}'::jsonb),'profile_hash',private.canonical_request_hash(p.profile_data),'organization_snapshot_hash',private.canonical_request_hash(p.organization_snapshot),'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'type',d.document_type,'sha256',d.declared_sha256,'version',d.version,'scan_result_id',d.current_scan_result_id,'status',d.status,'scan_status',d.scan_status,'expires_on',d.expires_on)order by d.document_type)from(select distinct on(document_type)*from public.client_compliance_documents where compliance_case_id=c.id and document_type in('REGISTRATION_DOCUMENT','REPRESENTATIVE_AUTHORITY','TAX_DOCUMENT')order by document_type,version desc,id)d),'[]'::jsonb))
 from public.client_compliance_cases c join public.organizations o on o.id=c.organization_id join public.client_profile_versions p on p.compliance_case_id=c.id and p.version=c.current_profile_version where c.id=p_case_id
$$;
revoke all on function private.client_canonical_identity_review_snapshot_v1(uuid)from public,anon,authenticated,service_role;
create function public.get_client_identity_review_context_v1(p_compliance_case_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare c public.client_compliance_cases%rowtype;s jsonb;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'])then raise exception'CLIENT_IDENTITY_REVIEW_DENIED'using errcode='42501';end if;
 select*into c from public.client_compliance_cases where id=p_compliance_case_id;
 s:=private.client_canonical_identity_review_snapshot_v1(c.id);
 if s is null then raise exception'CLIENT_IDENTITY_PROFILE_REQUIRED'using errcode='55000';end if;
 return jsonb_build_object('compliance_case_id',c.id,'organization_id',c.organization_id,'case_row_version',c.row_version,'profile_version',c.current_profile_version,'status',c.status,'identity_snapshot',s,'identity_hash',private.canonical_request_hash(s),'created_by',c.created_by);
end$$;
revoke all on function public.get_client_identity_review_context_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_client_identity_review_context_v1(uuid)to authenticated;
create function public.review_client_canonical_identifiers_v1(p_compliance_case_id uuid,p_expected_case_row_version integer,p_expected_profile_version integer,p_expected_identity_hash text,p_document_ids uuid[],p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare actor uuid:=auth.uid();c public.client_compliance_cases%rowtype;p public.client_profile_versions%rowtype;s jsonb;cached jsonb;h text;proof text;review_id uuid;selected_ids uuid[];current_ids uuid[];ice text;identifier_if text;identifier_rc text;valid_documents integer;r jsonb;
begin
 if actor is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'])then raise exception'CLIENT_IDENTITY_REVIEW_DENIED'using errcode='42501';end if;
 if p_expected_case_row_version is null or p_expected_case_row_version<1 or p_expected_profile_version is null or p_expected_profile_version<1 or p_expected_identity_hash is null or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 or p_expected_identity_hash!~'^[a-f0-9]{64}$'or cardinality(p_document_ids)is distinct from 3 then raise exception'INVALID_CLIENT_IDENTITY_REVIEW'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('client-compliance-case:'||p_compliance_case_id::text,0));
 select*into c from public.client_compliance_cases where id=p_compliance_case_id for update;
 if c.id is null then raise exception'COMPLIANCE_CASE_NOT_FOUND'using errcode='P0002';end if;
 h:=private.canonical_request_hash(jsonb_build_object('case_id',c.id,'case_version',p_expected_case_row_version,'profile_version',p_expected_profile_version,'identity_hash',p_expected_identity_hash,'document_ids',p_document_ids,'reason',btrim(p_reason),'reviewed_by',actor));
 cached:=private.begin_contract_command(c.organization_id,'client.identity.review.v1',p_idempotency_key,h,actor);if cached is not null then return cached;end if;
 perform 1 from public.organizations where id=c.organization_id for update;
 perform 1 from public.organization_identifiers where organization_id=c.organization_id and is_active for update;
 if c.row_version is distinct from p_expected_case_row_version or c.current_profile_version is distinct from p_expected_profile_version then raise exception'CLIENT_IDENTITY_REVIEW_STALE'using errcode='40001';end if;
 select*into p from public.client_profile_versions where compliance_case_id=c.id and version=c.current_profile_version;
 if c.status in('VERIFIED','SUSPENDED','REJECTED')or not exists(select 1 from public.organizations where id=c.organization_id and status in('PENDING','ACTIVE'))then raise exception'CLIENT_IDENTITY_REVIEW_NOT_OPEN'using errcode='55000';end if;
 if actor in(c.created_by,p.created_by)or private.is_active_org_member(c.organization_id,actor)then raise exception'CLIENT_IDENTITY_REVIEW_DUAL_CONTROL_REQUIRED'using errcode='42501';end if;
 s:=private.client_canonical_identity_review_snapshot_v1(c.id);
 if private.canonical_request_hash(s)is distinct from p_expected_identity_hash then raise exception'CLIENT_IDENTITY_REVIEW_STALE'using errcode='40001';end if;
 ice:=s->'identifiers'->>'ICE';identifier_if:=s->'identifiers'->>'IF';identifier_rc:=s->'identifiers'->>'RC';
 if(select count(*)from public.organization_identifiers where organization_id=c.organization_id and is_active and identifier_type in('ICE','IF','RC'))<>3 then raise exception'CLIENT_CANONICAL_IDENTIFIERS_AMBIGUOUS'using errcode='55000';end if;
 if coalesce(ice,'')!~'^[0-9]{15}$'or coalesce(identifier_if,'')!~'^[0-9]{6,20}$'or length(coalesce(identifier_rc,''))not between 3 and 32 or p.profile_data->>'if_number'is distinct from identifier_if or p.profile_data->>'rc_number'is distinct from identifier_rc or p.organization_snapshot->'identifiers'->>'ICE'is distinct from ice or p.organization_snapshot->>'legal_name'is distinct from s->>'legal_name' or p.organization_snapshot->>'country_code'is distinct from s->>'country_code'then raise exception'CLIENT_CURRENT_IDENTITY_SNAPSHOT_MISMATCH'using errcode='55000';end if;
 select array_agg(distinct v order by v)into selected_ids from unnest(p_document_ids)v;
 select array_agg((d->>'id')::uuid order by(d->>'id')::uuid)into current_ids from jsonb_array_elements(s->'documents')d;
 if selected_ids is distinct from current_ids or cardinality(current_ids)is distinct from 3 then raise exception'CLIENT_IDENTITY_CURRENT_DOCUMENTS_REQUIRED'using errcode='55000';end if;
 select count(*)into valid_documents from public.client_compliance_documents d where d.id=any(current_ids)and d.compliance_case_id=c.id and d.organization_id=c.organization_id and d.status='VERIFIED'and d.scan_status='CLEAN'and(d.expires_on is null or d.expires_on>=current_date)and d.created_by<>actor and exists(select 1 from private.client_document_scan_results scan where scan.id=d.current_scan_result_id and scan.document_id=d.id and scan.organization_id=d.organization_id and scan.result='CLEAN'and scan.computed_sha256=d.declared_sha256 and scan.sequence=(select max(sequence)from private.client_document_scan_results where document_id=d.id));
 if valid_documents<>3 then raise exception'CLIENT_IDENTITY_CURRENT_DOCUMENTS_REQUIRED'using errcode='55000';end if;
 proof:=private.canonical_request_hash(jsonb_build_object('identity_hash',p_expected_identity_hash,'document_ids',current_ids,'reason',btrim(p_reason),'reviewed_by',actor));
 insert into public.client_canonical_identity_reviews_v1(compliance_case_id,organization_id,profile_version,identity_hash,identity_snapshot,document_ids,reason,reviewed_by,proof_hash)values(c.id,c.organization_id,c.current_profile_version,p_expected_identity_hash,s,current_ids,btrim(p_reason),actor,proof)returning id into review_id;
 update public.organization_identifiers set verification_status='VERIFIED'where organization_id=c.organization_id and is_active and identifier_type in('ICE','IF','RC');
 r:=jsonb_build_object('outcome','CLIENT_CANONICAL_IDENTIFIERS_VERIFIED','review_id',review_id,'identity_hash',p_expected_identity_hash,'proof_hash',proof,'profile_version',c.current_profile_version,'case_status',c.status);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(c.organization_id,actor,'USER','client.identity.manual_review_verified','client_compliance_case',c.id::text,p_correlation_id,jsonb_build_object('review_id',review_id,'profile_version',c.current_profile_version,'identity_hash',p_expected_identity_hash,'proof_hash',proof,'document_ids',current_ids,'reason',btrim(p_reason),'verification_source','HUMAN_DOCUMENT_REVIEW'),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(c.organization_id,'client_compliance_case',c.id::text,'ClientCanonicalIdentityReviewedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(c.organization_id,'client.identity.review.v1',p_idempotency_key,r);return r;
end$$;
revoke all on function public.review_client_canonical_identifiers_v1(uuid,integer,integer,text,uuid[],text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.review_client_canonical_identifiers_v1(uuid,integer,integer,text,uuid[],text,text,uuid)to authenticated;
-- The final case decision remains a separate human act and cannot attest the
-- reviewer's own identity verification or a subsequently changed snapshot.
create function private.guard_client_canonical_identity_decision_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.client_canonical_identity_reviews_v1%rowtype;
begin
 if new.status='VERIFIED'and old.status is distinct from'VERIFIED'then
  select*into r from public.client_canonical_identity_reviews_v1 where compliance_case_id=new.id and profile_version=new.current_profile_version order by reviewed_at desc,id desc limit 1;
  if found then
   if auth.uid()=r.reviewed_by then raise exception'CLIENT_COMPLIANCE_DUAL_CONTROL_REQUIRED'using errcode='42501';end if;
   if r.identity_hash is distinct from private.canonical_request_hash(private.client_canonical_identity_review_snapshot_v1(new.id))then raise exception'CLIENT_IDENTITY_REVIEW_STALE'using errcode='40001';end if;
  end if;
 end if;return new;
end$$;
revoke all on function private.guard_client_canonical_identity_decision_v1()from public,anon,authenticated,service_role;
create trigger client_canonical_identity_decision before update on public.client_compliance_cases for each row execute function private.guard_client_canonical_identity_decision_v1();
notify pgrst,'reload schema';
commit;
