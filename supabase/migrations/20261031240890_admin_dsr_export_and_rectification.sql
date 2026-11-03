begin;
create table public.privacy_data_subject_export_proofs_v1(id uuid primary key default extensions.gen_random_uuid(),request_id uuid not null references public.data_subject_requests(id),organization_id uuid not null references public.organizations(id),generated_by uuid not null references auth.users(id),sha256 text not null check(sha256~'^[0-9a-f]{64}$'),size_bytes integer not null check(size_bytes>0),scope text not null check(scope='PERSONAL_ACCOUNT_AND_OWN_CORRESPONDENCE'),generated_at timestamptz not null default clock_timestamp());
create table public.privacy_data_subject_rectification_proofs_v1(action_request_id uuid primary key references public.admin_operational_action_requests(id),request_id uuid not null references public.data_subject_requests(id),organization_id uuid not null references public.organizations(id),fields text[]not null,previous_hash text not null,new_hash text not null,rectified_at timestamptz not null default clock_timestamp());
alter table public.privacy_data_subject_export_proofs_v1 enable row level security;
alter table public.privacy_data_subject_rectification_proofs_v1 enable row level security;
revoke all on public.privacy_data_subject_export_proofs_v1,public.privacy_data_subject_rectification_proofs_v1 from public,anon,authenticated,service_role;
grant select on public.privacy_data_subject_export_proofs_v1,public.privacy_data_subject_rectification_proofs_v1 to authenticated;
create policy privacy_export_proof_read on public.privacy_data_subject_export_proofs_v1 for select to authenticated using(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid()));
create policy privacy_rectification_proof_read on public.privacy_data_subject_rectification_proofs_v1 for select to authenticated using(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid()));
create trigger privacy_export_proof_immutable before update or delete on public.privacy_data_subject_export_proofs_v1 for each row execute function private.prevent_update_delete();
create trigger privacy_rectification_proof_immutable before update or delete on public.privacy_data_subject_rectification_proofs_v1 for each row execute function private.prevent_update_delete();
create function private.dsr_account_subject_v1(p_request_id uuid)returns uuid language sql stable security definer set search_path=pg_catalog,public,private,extensions as $$
 select m.user_id from public.data_subject_requests d join public.organization_memberships m on m.organization_id=d.organization_id where d.id=p_request_id and d.subject_reference_hash=encode(extensions.digest(convert_to(d.organization_id::text||':'||m.user_id::text,'UTF8'),'sha256'),'hex')limit 1
$$;
revoke all on function private.dsr_account_subject_v1(uuid)from public,anon,authenticated,service_role;
create function public.generate_admin_dsr_export_v1(p_request_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare d public.data_subject_requests%rowtype;subject_user uuid;document jsonb;encoded text;sha text;proof uuid;c uuid:=extensions.gen_random_uuid();
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],auth.uid())then raise exception'PRIVACY_EXPORT_ACCESS_DENIED'using errcode='42501';end if;
 select*into d from public.data_subject_requests where id=p_request_id for share;
 subject_user:=private.dsr_account_subject_v1(d.id);
 if d.id is null or d.request_type not in('ACCESS','PORTABILITY')or d.status<>'IN_REVIEW'or d.verified_at is null or subject_user is null then raise exception'PRIVACY_VERIFIED_EXPORT_SUBJECT_REQUIRED'using errcode='42501';end if;
 if(select count(*)from public.internal_messages m join public.internal_message_threads t on t.id=m.thread_id where m.sender_user_id=subject_user and d.organization_id in(t.client_organization_id,t.provider_organization_id))>10000 or(select count(*)from public.client_assistance_messages m join public.client_assistance_requests r on r.id=m.request_id where r.organization_id=d.organization_id and r.created_by=subject_user)>10000 then raise exception'PRIVACY_EXPORT_REQUIRES_BATCH_JOB'using errcode='55000';end if;
 document:=jsonb_build_object('format','MATRICIA_PERSONAL_EXPORT_V1','generated_at',clock_timestamp(),'request_id',d.id,'scope','PERSONAL_ACCOUNT_AND_OWN_CORRESPONDENCE','organization_id',d.organization_id,
 'account',(select jsonb_build_object('email',u.email,'phone',u.phone,'created_at',u.created_at,'display_name',p.display_name,'preferred_locale',p.preferred_locale)from auth.users u left join public.user_profiles p on p.id=u.id where u.id=subject_user),
 'membership',(select jsonb_build_object('status',m.status,'joined_at',m.created_at,'roles',coalesce((select jsonb_agg(r.role_code)from public.organization_member_roles r where r.membership_id=m.id and r.revoked_at is null),'[]'::jsonb))from public.organization_memberships m where m.organization_id=d.organization_id and m.user_id=subject_user),
 'consents',coalesce((select jsonb_agg(jsonb_build_object('status',status,'channel',channel,'occurred_at',occurred_at,'purpose_id',processing_purpose_id,'notice_id',privacy_notice_id))from public.consent_records where organization_id=d.organization_id and subject_reference_hash=d.subject_reference_hash),'[]'::jsonb),
 'assistance',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'subject',r.subject,'body',r.body,'status',r.status,'created_at',r.created_at,'messages',coalesce((select jsonb_agg(jsonb_build_object('participant',case when m.actor_user_id=subject_user then'SUBJECT'else'SUPPORT'end,'body',m.body,'created_at',m.created_at)order by m.created_at,m.id)from public.client_assistance_messages m where m.request_id=r.id),'[]'::jsonb)))from public.client_assistance_requests r where r.organization_id=d.organization_id and r.created_by=subject_user),'[]'::jsonb),
 'own_messages',coalesce((select jsonb_agg(jsonb_build_object('body',m.body,'created_at',m.created_at,'thread_id',m.thread_id)order by m.created_at,m.id)from public.internal_messages m join public.internal_message_threads t on t.id=m.thread_id where m.sender_user_id=subject_user and d.organization_id in(t.client_organization_id,t.provider_organization_id)),'[]'::jsonb),
 'excluded_scope',jsonb_build_array('AUTHENTICATION_SECRETS','OTHER_PERSONS_ACCOUNTS','OTHER_TENANTS','FINANCIAL_AND_CONTRACT_RECORDS_RETAINED_UNDER_SEPARATE_POLICY'));
 encoded:=document::text;if octet_length(convert_to(encoded,'UTF8'))>16777216 then raise exception'PRIVACY_EXPORT_REQUIRES_BATCH_JOB'using errcode='55000';end if;sha:=encode(extensions.digest(convert_to(encoded,'UTF8'),'sha256'),'hex');
 insert into public.privacy_data_subject_export_proofs_v1(request_id,organization_id,generated_by,sha256,size_bytes,scope)values(d.id,d.organization_id,auth.uid(),sha,octet_length(convert_to(encoded,'UTF8')),'PERSONAL_ACCOUNT_AND_OWN_CORRESPONDENCE')returning id into proof;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.organization_id,auth.uid(),'USER','privacy.dsr.export_generated','data_subject_request',d.id::text,c,jsonb_build_object('export_proof_id',proof,'sha256',sha,'size_bytes',octet_length(convert_to(encoded,'UTF8')),'scope','PERSONAL_ACCOUNT_AND_OWN_CORRESPONDENCE','dsr_fulfilled',false),repeat('0',64));
 return jsonb_build_object('export_json',encoded,'sha256',sha,'proof_id',proof,'scope','PERSONAL_ACCOUNT_AND_OWN_CORRESPONDENCE');
end$$;
revoke all on function public.generate_admin_dsr_export_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.generate_admin_dsr_export_v1(uuid)to authenticated;
create function private.execute_admin_dsr_rectification_v1(p_action_id uuid,p_correlation_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare x public.admin_operational_action_requests%rowtype;d public.data_subject_requests%rowtype;p public.user_profiles%rowtype;subject_user uuid;before_hash text;after_hash text;new_display_name text;locale text;
begin
 select*into x from public.admin_operational_action_requests where id=p_action_id;
 select*into d from public.data_subject_requests where id=x.resource_id::uuid for update;
 if auth.role()is distinct from'service_role'or x.status<>'AUTHORIZED'or x.action_type<>'MANUAL_EXCEPTION'or x.approvals_required<>2 or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],x.requested_by)or d.organization_id is distinct from x.organization_id or d.status<>'IN_REVIEW'or d.verified_at is null or d.request_type<>'RECTIFICATION'then raise exception'PRIVACY_RECTIFICATION_APPROVAL_REQUIRED'using errcode='42501';end if;
 subject_user:=private.dsr_account_subject_v1(d.id);
 select*into p from public.user_profiles where id=subject_user for update;
 new_display_name:=btrim(x.redacted_summary->>'displayName');locale:=x.redacted_summary->>'preferredLocale';
 if p.id is null or length(coalesce(new_display_name,''))not between 2 and 120 or locale is null or locale not in('fr-MA','ar-MA')then raise exception'INVALID_PRIVACY_RECTIFICATION'using errcode='22023';end if;
 if p.row_version is distinct from(x.redacted_summary->>'expectedProfileVersion')::integer then raise exception'STALE_PRIVACY_PROFILE'using errcode='40001';end if;
 before_hash:=private.canonical_request_hash(jsonb_build_object('display_name',p.display_name,'preferred_locale',p.preferred_locale,'row_version',p.row_version));
 update public.user_profiles set display_name=new_display_name,preferred_locale=locale,row_version=row_version+1 where id=p.id;
 after_hash:=private.canonical_request_hash(jsonb_build_object('display_name',new_display_name,'preferred_locale',locale,'row_version',p.row_version+1));
 insert into public.privacy_data_subject_rectification_proofs_v1(action_request_id,request_id,organization_id,fields,previous_hash,new_hash)values(x.id,d.id,d.organization_id,array['display_name','preferred_locale'],before_hash,after_hash);
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.organization_id,'SERVICE','privacy.dsr.rectified','data_subject_request',d.id::text,p_correlation_id,jsonb_build_object('fields',array['display_name','preferred_locale'],'previous_hash',before_hash,'new_hash',after_hash,'dsr_fulfilled',false),repeat('0',64));
 return jsonb_build_object('request_id',d.id,'scope','DISPLAY_NAME_AND_LOCALE','result_hash',after_hash,'dsr_fulfilled',false);
end$$;
revoke all on function private.execute_admin_dsr_rectification_v1(uuid,uuid)from public,anon,authenticated,service_role;
do $$declare definition text;begin
 select pg_get_functiondef('public.execute_admin_operational_action_v1(uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'elsif x.resource_type=''ORGANIZATION''then')=0 then raise exception'ADMIN_RECTIFICATION_PATCH_TARGET_NOT_FOUND';end if;
 definition:=replace(definition,'elsif x.resource_type=''ORGANIZATION''then','elsif x.resource_type=''PRIVACY_DSR_RECTIFICATION''then result:=private.execute_admin_dsr_rectification_v1(x.id,p_correlation_id); elsif x.resource_type=''ORGANIZATION''then');
 execute definition;
end$$;
do $$declare definition text;begin
 select pg_get_functiondef('public.get_admin_privacy_console_v1()'::regprocedure)into definition;
 definition:=replace(definition,'from public.data_subject_requests)', 'from public.data_subject_requests dsr)');
 definition:=replace(definition,'''row_version'',row_version)', '''row_version'',row_version,''export_reference'',(select ''privacy-export-proof:''||p.id::text from public.privacy_data_subject_export_proofs_v1 p where p.request_id=dsr.id order by p.generated_at desc,p.id desc limit 1))');
 execute definition;
end$$;
create or replace function public.transition_data_subject_request(p_request_id uuid,p_expected_version integer,p_new_status text,p_decision_reason_code text,p_export_storage_reference text,p_correlation_id uuid)returns integer language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.data_subject_requests%rowtype;reference text:=p_export_storage_reference;
begin
 if auth.jwt()->>'aal'is distinct from'aal2'then raise exception'PRIVACY_DSR_MFA_REQUIRED'using errcode='42501';end if;
 select*into d from public.data_subject_requests where id=p_request_id;
 if not private.privacy_manage_access(d.organization_id)then raise exception'PRIVACY_DSR_TRANSITION_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(p_decision_reason_code,'')))not between 3 and 100 or p_correlation_id is null or(reference is not null and(reference like'%://%'or reference like'%..%'or reference like'/%'))then raise exception'INVALID_PRIVACY_DSR_EVIDENCE'using errcode='22023';end if;
 if p_new_status='FULFILLED'and d.request_type in('ACCESS','PORTABILITY')then
  if reference is null or reference!~'^privacy-export-proof:[a-f0-9-]{36}$'or not exists(select 1 from public.privacy_data_subject_export_proofs_v1 p where p.id=split_part(reference,':',2)::uuid and p.request_id=d.id and p.organization_id=d.organization_id and p.generated_at>clock_timestamp()-interval'7 days')then raise exception'PRIVACY_GENERATED_EXPORT_PROOF_REQUIRED'using errcode='55000';end if;
 end if;
 if p_new_status='FULFILLED'and d.request_type='RECTIFICATION'and not exists(select 1 from public.privacy_data_subject_rectification_proofs_v1 where request_id=d.id and organization_id=d.organization_id)then raise exception'PRIVACY_RECTIFICATION_EXECUTION_PROOF_REQUIRED'using errcode='55000';end if;
 if p_new_status='FULFILLED'and d.request_type='ERASURE'then raise exception'PRIVACY_FULL_ERASURE_EVIDENCE_REQUIRED'using errcode='55000';end if;
 return public.transition_data_subject_request_delivery_internal(p_request_id,p_expected_version,p_new_status,p_decision_reason_code,reference,p_correlation_id);
end$$;

create function public.get_admin_dsr_rectification_console_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'],auth.uid())then raise exception'PRIVACY_RECTIFICATION_CONSOLE_DENIED'using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('requestId',d.id,'organizationName',o.display_name,'displayName',p.display_name,'preferredLocale',p.preferred_locale,'profileVersion',p.row_version))from public.data_subject_requests d join public.organizations o on o.id=d.organization_id join public.user_profiles p on p.id=private.dsr_account_subject_v1(d.id)where d.request_type='RECTIFICATION'and d.status='IN_REVIEW'and d.verified_at is not null),'[]'::jsonb);
end$$;
revoke all on function public.get_admin_dsr_rectification_console_v1()from public,anon,authenticated,service_role;
grant execute on function public.get_admin_dsr_rectification_console_v1()to authenticated;

notify pgrst,'reload schema';
commit;
