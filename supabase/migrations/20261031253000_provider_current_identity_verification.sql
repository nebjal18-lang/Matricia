-- A historical company decision never approves a different current legal identity.
create function private.provider_current_identity_snapshot_v1(p_org uuid)returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object('legal_name',o.legal_name,'country_code',o.country_code,'identifiers',coalesce((select jsonb_object_agg(identifier_type,normalized_value::text order by identifier_type,normalized_value::text)from public.organization_identifiers where organization_id=o.id and is_active and identifier_type in('ICE','IF','RC')),'{}'::jsonb))from public.organizations o where o.id=p_org
$$;
create table public.provider_identity_verification_history(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),organization_row_version integer not null check(organization_row_version>0),
 identity_hash text not null check(identity_hash~'^[0-9a-f]{64}$'),identity_snapshot jsonb not null check(jsonb_typeof(identity_snapshot)='object'),company_decision_id uuid not null references public.provider_company_decisions(id),
 document_version_ids uuid[]not null check(cardinality(document_version_ids)=3),verified_at timestamptz not null default clock_timestamp(),verified_by uuid not null references auth.users(id),reason text not null check(length(btrim(reason))between 10 and 1000),
 idempotency_key uuid not null,request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),response_body jsonb not null,unique(organization_id,idempotency_key)
);
create index provider_identity_history_current_idx on public.provider_identity_verification_history(organization_id,verified_at desc,id);
alter table public.provider_identity_verification_history enable row level security;
revoke all on public.provider_identity_verification_history from public,anon,authenticated,service_role;
grant select on public.provider_identity_verification_history to authenticated;
create policy provider_identity_history_read on public.provider_identity_verification_history for select to authenticated using(private.is_active_org_member(organization_id,auth.uid())or private.can_decide_provider_qualification(auth.uid()));
create trigger provider_identity_history_immutable before update or delete on public.provider_identity_verification_history for each row execute function private.prevent_update_delete();
create function private.provider_current_identity_is_verified_v1(p_org uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.provider_identity_verification_history h join public.provider_company_decisions d on d.id=h.company_decision_id and d.provider_organization_id=h.organization_id and d.company_status='VERIFIED'
 where h.organization_id=p_org and h.identity_hash=private.canonical_request_hash(private.provider_current_identity_snapshot_v1(p_org))
 and(select count(*)from public.organization_identifiers where organization_id=p_org and is_active and identifier_type in('ICE','IF','RC'))=3
 and not exists(select 1 from public.organization_identifiers i where i.organization_id=p_org and i.is_active and i.identifier_type in('ICE','IF','RC')and i.verification_status<>'VERIFIED')
 and h.id=(select last.id from public.provider_identity_verification_history last where last.organization_id=p_org order by last.verified_at desc,last.id desc limit 1))
$$;
create function private.provider_current_identity_documents_v1(p_org uuid)returns uuid[]language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare kind text;version uuid;ids uuid[]:='{}';begin
 foreach kind in array array['LEGAL','FISCAL','INSURANCE']loop
  select latest.id into version from public.provider_document_families f join lateral(select v.*from public.provider_document_versions v where v.family_id=f.id order by v.version_number desc limit 1)latest on true
  where f.provider_organization_id=p_org and f.document_kind=kind and latest.status='VERIFIED'and(latest.expires_on is null or latest.expires_on>current_date)and private.provider_document_is_clean(latest.storage_object_path,latest.content_hash)order by latest.created_at desc,latest.id limit 1;
  if version is null then return null;end if;ids:=array_append(ids,version);version:=null;
 end loop;return ids;
end$$;
create function public.get_provider_identity_review_context_v1(p_provider_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare o public.organizations%rowtype;p public.provider_profiles%rowtype;snapshot jsonb;decision uuid;docs uuid[];
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.can_decide_provider_qualification(auth.uid())then raise exception'PROVIDER_IDENTITY_REVIEW_DENIED'using errcode='42501';end if;
 select*into o from public.organizations where id=p_provider_organization_id;select*into p from public.provider_profiles where provider_organization_id=o.id;
 if o.id is null or p.provider_organization_id is null then raise exception'PROVIDER_IDENTITY_NOT_FOUND'using errcode='P0002';end if;
 snapshot:=private.provider_current_identity_snapshot_v1(o.id);select id into decision from public.provider_company_decisions where provider_organization_id=o.id order by decision_version desc limit 1;
 docs:=private.provider_current_identity_documents_v1(o.id);
 return jsonb_build_object('organization_id',o.id,'organization_row_version',o.row_version,'profile_row_version',p.row_version,'organization_status',o.status,'identity_snapshot',snapshot,'identity_hash',private.canonical_request_hash(snapshot),'company_decision_id',decision,'document_version_ids',docs,'currently_verified',private.provider_current_identity_is_verified_v1(o.id));
end$$;
create function public.revalidate_provider_identity_v1(p_provider_organization_id uuid,p_expected_organization_row_version integer,p_expected_profile_row_version integer,p_expected_identity_hash text,p_expected_company_decision_id uuid,p_reason text,p_idempotency_key uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare o public.organizations%rowtype;p public.provider_profiles%rowtype;d public.provider_company_decisions%rowtype;prior public.provider_identity_verification_history%rowtype;snapshot jsonb;h text;docs uuid[];review uuid:=extensions.gen_random_uuid();r jsonb;kind text;value text;new_status text;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.can_decide_provider_qualification(auth.uid())then raise exception'PROVIDER_IDENTITY_REVIEW_DENIED'using errcode='42501';end if;
 if p_idempotency_key is null or p_expected_identity_hash is null or p_expected_identity_hash!~'^[0-9a-f]{64}$'or p_expected_organization_row_version is null or p_expected_profile_row_version is null or p_expected_company_decision_id is null or length(btrim(coalesce(p_reason,'')))not between 10 and 1000 then raise exception'INVALID_PROVIDER_IDENTITY_REVIEW'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('org',p_provider_organization_id,'org_version',p_expected_organization_row_version,'profile_version',p_expected_profile_row_version,'identity_hash',p_expected_identity_hash,'company_decision',p_expected_company_decision_id,'reason',btrim(p_reason),'actor',auth.uid()));
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||p_provider_organization_id::text,0));
 select*into o from public.organizations where id=p_provider_organization_id for update;
 select*into prior from public.provider_identity_verification_history where organization_id=o.id and idempotency_key=p_idempotency_key;
 if found then if prior.request_hash is distinct from h then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return prior.response_body;end if;
 select*into p from public.provider_profiles where provider_organization_id=o.id for update;
 snapshot:=private.provider_current_identity_snapshot_v1(o.id);
 if o.id is null or p.provider_organization_id is null or o.row_version is distinct from p_expected_organization_row_version or p.row_version is distinct from p_expected_profile_row_version or private.canonical_request_hash(snapshot)is distinct from p_expected_identity_hash then raise exception'PROVIDER_CURRENT_IDENTITY_CONFLICT'using errcode='40001';end if;
 select*into d from public.provider_company_decisions where provider_organization_id=o.id order by decision_version desc limit 1;
 if d.id is distinct from p_expected_company_decision_id or d.company_status is distinct from'VERIFIED'or p.company_status is distinct from'VERIFIED'then raise exception'PROVIDER_COMPANY_REVIEW_REQUIRED'using errcode='55000';end if;
 if coalesce(snapshot#>>'{identifiers,ICE}','')!~'^[0-9]{15}$'or coalesce(snapshot#>>'{identifiers,IF}','')!~'^[0-9]{6,20}$'or length(btrim(coalesce(snapshot#>>'{identifiers,RC}','')))not between 2 and 80 then raise exception'PROVIDER_CANONICAL_IDENTIFIERS_REQUIRED'using errcode='55000';end if;
 foreach kind in array array['ICE','IF','RC']loop
  if(select count(*)from public.organization_identifiers where organization_id=o.id and is_active and identifier_type=kind)<>1 then raise exception'PROVIDER_CANONICAL_IDENTIFIERS_REQUIRED'using errcode='55000';end if;
 end loop;
 docs:=private.provider_current_identity_documents_v1(o.id);if docs is null then raise exception'PROVIDER_CURRENT_IDENTITY_CLEAN_DOCUMENTS_REQUIRED'using errcode='55000';end if;
 -- This explicit human command confirms the displayed current identifiers against the three reviewed documents.
 update public.organization_identifiers set verification_status='VERIFIED'where organization_id=o.id and is_active and identifier_type in('ICE','IF','RC');
 new_status:=o.status;
 if o.status='PENDING'and not exists(select 1 from public.client_compliance_cases where organization_id=o.id and status<>'VERIFIED')then new_status:='ACTIVE';end if;
 update public.organizations set status=new_status,row_version=row_version+1,updated_at=clock_timestamp()where id=o.id;
 r:=jsonb_build_object('outcome','PROVIDER_IDENTITY_VERIFIED','identity_review_id',review,'identity_hash',p_expected_identity_hash,'organization_status',new_status,'organization_row_version',o.row_version+1);
 insert into public.provider_identity_verification_history(id,organization_id,organization_row_version,identity_hash,identity_snapshot,company_decision_id,document_version_ids,verified_by,reason,idempotency_key,request_hash,response_body)values(review,o.id,o.row_version+1,p_expected_identity_hash,snapshot,d.id,docs,auth.uid(),btrim(p_reason),p_idempotency_key,h,r);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(o.id,auth.uid(),'USER','provider.identity.current_verified','provider_identity_verification',review::text,p_correlation_id,jsonb_build_object('identity_hash',p_expected_identity_hash,'company_decision_id',d.id,'document_version_ids',docs,'reason',btrim(p_reason)),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id)values(o.id,'provider_identity_verification',review::text,'ProviderCurrentIdentityVerifiedV1',p_correlation_id,jsonb_build_object('identity_review_id',review,'organization_id',o.id,'identity_hash',p_expected_identity_hash),p_idempotency_key::text,review);
 return r;
end$$;
create function public.get_my_provider_identity_status_v1(p_provider_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$begin
 if auth.uid()is null or not(private.is_active_org_member(p_provider_organization_id,auth.uid())or private.can_decide_provider_qualification(auth.uid()))then raise exception'PROVIDER_IDENTITY_STATUS_DENIED'using errcode='42501';end if;
 return jsonb_build_object('verified',private.provider_current_identity_is_verified_v1(p_provider_organization_id),'last_verified_at',(select verified_at from public.provider_identity_verification_history where organization_id=p_provider_organization_id order by verified_at desc,id desc limit 1));
end$$;
revoke all on function public.get_my_provider_identity_status_v1(uuid)from public,anon,service_role;
grant execute on function public.get_my_provider_identity_status_v1(uuid)to authenticated;
revoke all on function private.provider_current_identity_snapshot_v1(uuid),private.provider_current_identity_documents_v1(uuid),private.provider_current_identity_is_verified_v1(uuid)from public,anon,authenticated,service_role;
revoke all on function public.get_provider_identity_review_context_v1(uuid),public.revalidate_provider_identity_v1(uuid,integer,integer,text,uuid,text,uuid,uuid)from public,anon,service_role;
grant execute on function public.get_provider_identity_review_context_v1(uuid),public.revalidate_provider_identity_v1(uuid,integer,integer,text,uuid,text,uuid,uuid)to authenticated;

create or replace function private.provider_service_eligibility_snapshot(p_provider_organization_id uuid,p_service_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare company public.provider_company_decisions%rowtype;service_row public.provider_services%rowtype;qualification public.provider_qualification_decisions%rowtype;capacity text;reasons text[]:='{}';kind text;
begin
 if not exists(select 1 from public.organizations o where o.id=p_provider_organization_id and o.status='ACTIVE')then reasons:=array_append(reasons,'ORGANIZATION_INACTIVE');end if;
 select * into company from public.provider_company_decisions d where d.provider_organization_id=p_provider_organization_id order by d.decision_version desc limit 1;
 if company.id is null or company.company_status<>'VERIFIED'then reasons:=array_append(reasons,'COMPANY_NOT_VERIFIED');end if;
 if not private.provider_current_identity_is_verified_v1(p_provider_organization_id)then reasons:=array_append(reasons,'PROVIDER_CURRENT_IDENTITY_REVIEW_REQUIRED');end if;
 if company.id is null or company.partner_contract_status<>'SIGNED'or(company.partner_contract_expires_at is not null and company.partner_contract_expires_at<=statement_timestamp())then reasons:=array_append(reasons,'PARTNER_CONTRACT_INVALID');end if;
 foreach kind in array array['LEGAL','FISCAL','INSURANCE'] loop
  if not exists(select 1 from public.provider_document_families family join lateral(select version.* from public.provider_document_versions version where version.family_id=family.id order by version.version_number desc limit 1)latest on true where family.provider_organization_id=p_provider_organization_id and family.document_kind=kind and latest.status='VERIFIED'and private.provider_document_is_clean(latest.storage_object_path,latest.content_hash)and(latest.expires_on is null or latest.expires_on>current_date))then reasons:=array_append(reasons,'DOCUMENT_'||kind||'_INVALID');end if;
 end loop;
 select * into service_row from public.provider_services s where s.provider_organization_id=p_provider_organization_id and s.service_id=p_service_id;
 if service_row.id is null then reasons:=array_append(reasons,'SERVICE_NOT_REQUESTED');else
  select decision.* into qualification from public.provider_qualifications aggregate join public.provider_qualification_decisions decision on decision.id=aggregate.current_decision_id and decision.qualification_id=aggregate.id where aggregate.provider_organization_id=p_provider_organization_id and aggregate.service_id=p_service_id;
  if qualification.id is null then reasons:=array_append(reasons,'QUALIFICATION_NOT_DECIDED');elsif qualification.effective_from is null or qualification.effective_from>statement_timestamp()then reasons:=array_append(reasons,'QUALIFICATION_NOT_EFFECTIVE');elsif qualification.status<>'APPROVED'then reasons:=array_append(reasons,'QUALIFICATION_'||qualification.status);elsif qualification.expires_at is not null and qualification.expires_at<=statement_timestamp()then reasons:=array_append(reasons,'QUALIFICATION_EXPIRED');elsif not exists(select 1 from public.questionnaire_sessions session where session.id=qualification.questionnaire_session_id and session.organization_id=p_provider_organization_id and session.questionnaire_version_id=qualification.questionnaire_version_id and session.status='SUBMITTED'and not session.is_simulation)then reasons:=array_append(reasons,'QUALIFICATION_EVIDENCE_INVALID');end if;
  if exists(select 1 from public.provider_document_service_links link join public.provider_document_versions document on document.id=link.document_version_id where link.provider_service_id=service_row.id and link.is_mandatory and(document.status<>'VERIFIED'or not private.provider_document_is_clean(document.storage_object_path,document.content_hash)or(document.expires_on is not null and document.expires_on<=current_date)))then reasons:=array_append(reasons,'MANDATORY_DOCUMENT_INVALID');end if;
 end if;
 select version.capacity_status into capacity from public.provider_capacity_versions version where version.provider_organization_id=p_provider_organization_id and(version.service_id=p_service_id or version.service_id is null)and version.effective_from<=statement_timestamp()and(version.effective_until is null or version.effective_until>statement_timestamp())order by(version.service_id is not null)desc,version.version_number desc limit 1;
 if capacity is null then reasons:=array_append(reasons,'CAPACITY_NOT_DECLARED');elsif capacity not in('AVAILABLE','LIMITED')then reasons:=array_append(reasons,'CAPACITY_'||capacity);end if;
 if exists(select 1 from public.provider_restriction_decisions restriction where restriction.provider_organization_id=p_provider_organization_id and(restriction.service_id is null or restriction.service_id=p_service_id)and restriction.action='IMPOSED'and not exists(select 1 from public.provider_restriction_decisions newer where newer.provider_organization_id=restriction.provider_organization_id and newer.service_id is not distinct from restriction.service_id and newer.restriction_type=restriction.restriction_type and newer.decision_version>restriction.decision_version))then reasons:=array_append(reasons,'ACTIVE_HUMAN_RESTRICTION');end if;
 if private.provider_has_overdue_matricia_invoice(p_provider_organization_id) then reasons:=array_append(reasons,'OVERDUE_INVOICE');end if;
 return jsonb_build_object('eligible',cardinality(reasons)=0,'provider_organization_id',p_provider_organization_id,'service_id',p_service_id,'reasons',to_jsonb(reasons),'qualification_status',coalesce(qualification.status,'NOT_REQUESTED'),'qualification_decision_version',qualification.decision_version,'capacity_status',coalesce(capacity,'NOT_DECLARED'),'company_decision_version',company.decision_version,'checked_at',statement_timestamp());
end$$;

notify pgrst,'reload schema';
