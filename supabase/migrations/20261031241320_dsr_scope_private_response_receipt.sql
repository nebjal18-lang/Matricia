begin;
-- The subject confirms the requested scope; legacy/ALL requests are never
-- silently narrowed to the subsets for which an assembler already exists.
create table public.dsr_scope_versions_v1(
 id uuid primary key default extensions.gen_random_uuid(),request_id uuid not null references public.data_subject_requests(id),version integer not null check(version>0),subject_user_id uuid not null references auth.users(id),requested_scopes text[]not null check(cardinality(requested_scopes)>0),confirmed_at timestamptz not null default clock_timestamp(),idempotency_key text not null,content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),unique(request_id,version),unique(request_id,idempotency_key));
create table public.dsr_private_responses_v1(
 id uuid primary key default extensions.gen_random_uuid(),request_id uuid not null references public.data_subject_requests(id),scope_version_id uuid not null references public.dsr_scope_versions_v1(id),subject_user_id uuid not null references auth.users(id),response_json text not null check(octet_length(response_json)<=16777216),sha256 text not null check(sha256~'^[a-f0-9]{64}$'),covered_scopes text[]not null,uncovered_scopes text[]not null,complete boolean not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),source_export_proof_id uuid not null references public.privacy_data_subject_export_proofs_v1(id),idempotency_key text not null,unique(request_id,idempotency_key));
create table public.dsr_private_response_decisions_v1(response_id uuid primary key references public.dsr_private_responses_v1(id),decision text not null check(decision in('APPROVE','REJECT')),sha256 text not null check(sha256~'^[a-f0-9]{64}$'),review_reason text not null check(length(btrim(review_reason))between 10 and 2000),decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp());
create table public.dsr_private_response_access_v1(response_id uuid not null references public.dsr_private_responses_v1(id),subject_user_id uuid not null references auth.users(id),sha256 text not null,access_granted_at timestamptz not null default clock_timestamp(),primary key(response_id,subject_user_id));
create table public.dsr_private_response_ack_v1(response_id uuid primary key references public.dsr_private_responses_v1(id),subject_user_id uuid not null references auth.users(id),sha256 text not null,acknowledged_at timestamptz not null default clock_timestamp());
do $$declare t text;begin foreach t in array array['dsr_scope_versions_v1','dsr_private_responses_v1','dsr_private_response_decisions_v1','dsr_private_response_access_v1','dsr_private_response_ack_v1']loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_update_delete()',t||'_immutable',t);end loop;end$$;

create function private.dsr_response_staff_v1()returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select auth.uid()is not null and auth.jwt()->>'aal'='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER'])$$;
revoke all on function private.dsr_response_staff_v1()from public,anon,authenticated,service_role;
create function public.confirm_my_dsr_scope_v1(p_request_id uuid,p_requested_scopes text[],p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.data_subject_requests%rowtype;s public.dsr_scope_versions_v1%rowtype;scopes text[];h text;n integer;
begin
 select*into d from public.data_subject_requests where id=p_request_id for update;
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or d.id is null or d.status<>'IN_REVIEW'or d.request_type not in('ACCESS','PORTABILITY')or d.verified_at is null or private.dsr_account_subject_v1(d.id)is distinct from auth.uid()then raise exception'DSR_VERIFIED_SUBJECT_REQUIRED'using errcode='42501';end if;
 if p_requested_scopes is null or cardinality(p_requested_scopes)not between 1 and 7 or exists(select 1 from unnest(p_requested_scopes)scope_entry where scope_entry is null or scope_entry not in('ACCOUNT','MEMBERSHIP','CONSENTS','ASSISTANCE','OWN_MESSAGES','FINANCIAL_CONTRACT_RECORDS','ALL'))or length(btrim(coalesce(p_idempotency_key,'')))not between 8 and 200 then raise exception'INVALID_DSR_SCOPE'using errcode='22023';end if;
 select array_agg(distinct scope order by scope)into scopes from unnest(p_requested_scopes)scope;
 if'ALL'=any(scopes)and cardinality(scopes)<>1 then raise exception'INVALID_DSR_SCOPE'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('request_id',d.id,'subject',auth.uid(),'scopes',to_jsonb(scopes)));
 select*into s from public.dsr_scope_versions_v1 where request_id=d.id and idempotency_key=p_idempotency_key;
 if s.id is not null then if s.content_hash<>h then raise exception'IDEMPOTENCY_KEY_REUSED'using errcode='22023';end if;return jsonb_build_object('outcome','DSR_SCOPE_CONFIRMED','scope_version_id',s.id,'version',s.version);end if;
 select coalesce(max(version),0)+1 into n from public.dsr_scope_versions_v1 where request_id=d.id;
 insert into public.dsr_scope_versions_v1(request_id,version,subject_user_id,requested_scopes,idempotency_key,content_hash)values(d.id,n,auth.uid(),scopes,p_idempotency_key,h)returning*into s;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.organization_id,auth.uid(),'USER','privacy.dsr.scope_confirmed','data_subject_request',d.id::text,extensions.gen_random_uuid(),jsonb_build_object('scope_version_id',s.id,'version',s.version,'scopes',scopes,'content_hash',h),repeat('0',64));
 return jsonb_build_object('outcome','DSR_SCOPE_CONFIRMED','scope_version_id',s.id,'version',s.version);
end$$;

create function public.prepare_admin_dsr_private_response_v1(p_request_id uuid,p_expected_scope_version_id uuid,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare d public.data_subject_requests%rowtype;s public.dsr_scope_versions_v1%rowtype;r public.dsr_private_responses_v1%rowtype;exported jsonb;source jsonb;document jsonb;scope text;covered text[]:='{}';uncovered text[]:='{}';encoded text;sha text;
begin
 if not private.dsr_response_staff_v1()then raise exception'DSR_RESPONSE_STAFF_REQUIRED'using errcode='42501';end if;
 select*into d from public.data_subject_requests where id=p_request_id for update;
 if d.id is null or d.status<>'IN_REVIEW'or d.request_type not in('ACCESS','PORTABILITY')or d.verified_at is null then raise exception'DSR_RESPONSE_REVIEW_REQUIRED'using errcode='55000';end if;
 select*into s from public.dsr_scope_versions_v1 where request_id=d.id order by version desc limit 1;
 if p_expected_scope_version_id is null or s.id is distinct from p_expected_scope_version_id then raise exception'STALE_DSR_SCOPE'using errcode='40001';end if;
 if length(btrim(coalesce(p_idempotency_key,'')))not between 8 and 200 then raise exception'INVALID_IDEMPOTENCY_KEY'using errcode='22023';end if;
 select*into r from public.dsr_private_responses_v1 where request_id=d.id and idempotency_key=p_idempotency_key;
 if r.id is not null then if r.scope_version_id<>s.id then raise exception'IDEMPOTENCY_KEY_REUSED'using errcode='22023';end if;return jsonb_build_object('outcome','DSR_RESPONSE_PREPARED','response_id',r.id,'sha256',r.sha256,'complete',r.complete);end if;
 exported:=public.generate_admin_dsr_export_v1(d.id);source:=(exported->>'export_json')::jsonb;
 document:=jsonb_build_object('format','MATRICIA_DSR_RESPONSE_V1','request_id',d.id,'scope_version_id',s.id,'scope_version',s.version,'generated_at',clock_timestamp());
 foreach scope in array s.requested_scopes loop
  if scope in('ACCOUNT','MEMBERSHIP','CONSENTS','ASSISTANCE','OWN_MESSAGES')then document:=document||jsonb_build_object(lower(scope),source->lower(scope));covered:=array_append(covered,scope);else uncovered:=array_append(uncovered,scope);end if;
 end loop;
 document:=document||jsonb_build_object('requested_scopes',s.requested_scopes,'covered_scopes',covered,'uncovered_scopes',uncovered,'complete',cardinality(uncovered)=0,'scope_limitations',case when cardinality(uncovered)>0 then jsonb_build_array('ADDITIONAL_SCOPE_ASSEMBLY_AND_REVIEW_REQUIRED')else'[]'::jsonb end);
 encoded:=document::text;sha:=encode(extensions.digest(convert_to(encoded,'UTF8'),'sha256'),'hex');
 insert into public.dsr_private_responses_v1(request_id,scope_version_id,subject_user_id,response_json,sha256,covered_scopes,uncovered_scopes,complete,created_by,source_export_proof_id,idempotency_key)values(d.id,s.id,s.subject_user_id,encoded,sha,covered,uncovered,cardinality(uncovered)=0,auth.uid(),(exported->>'proof_id')::uuid,p_idempotency_key)returning*into r;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.organization_id,auth.uid(),'USER','privacy.dsr.response_prepared','data_subject_request',d.id::text,extensions.gen_random_uuid(),jsonb_build_object('response_id',r.id,'scope_version_id',s.id,'sha256',sha,'complete',r.complete),repeat('0',64));
 return jsonb_build_object('outcome','DSR_RESPONSE_PREPARED','response_id',r.id,'sha256',r.sha256,'complete',r.complete);
end$$;

create function public.review_admin_dsr_private_response_v1(p_response_id uuid,p_expected_sha256 text,p_approve boolean,p_review_confirmed boolean,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.dsr_private_responses_v1%rowtype;d public.data_subject_requests%rowtype;decision public.dsr_private_response_decisions_v1%rowtype;
begin
 if not private.dsr_response_staff_v1()then raise exception'DSR_RESPONSE_STAFF_REQUIRED'using errcode='42501';end if;
 select*into r from public.dsr_private_responses_v1 where id=p_response_id;
 select*into d from public.data_subject_requests where id=r.request_id for update;
 if r.id is null or r.created_by=auth.uid()then raise exception'DSR_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 if d.status<>'IN_REVIEW'or r.scope_version_id is distinct from(select id from public.dsr_scope_versions_v1 where request_id=d.id order by version desc limit 1)or p_expected_sha256 is distinct from r.sha256 then raise exception'STALE_DSR_RESPONSE'using errcode='40001';end if;
 if p_approve is null or(p_approve and p_review_confirmed is distinct from true)or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'DSR_SCOPE_AND_THIRD_PARTY_REVIEW_REQUIRED'using errcode='22023';end if;
 select*into decision from public.dsr_private_response_decisions_v1 where response_id=r.id;
 if decision.response_id is null then insert into public.dsr_private_response_decisions_v1(response_id,decision,sha256,review_reason,decided_by)values(r.id,case when p_approve then'APPROVE'else'REJECT'end,r.sha256,btrim(p_reason),auth.uid());
 elsif decision.decision is distinct from(case when p_approve then'APPROVE'else'REJECT'end)or decision.review_reason is distinct from btrim(p_reason)or decision.decided_by<>auth.uid()then raise exception'DSR_RESPONSE_ALREADY_REVIEWED'using errcode='55000';else return jsonb_build_object('outcome',case when not p_approve then'DSR_RESPONSE_REJECTED'when r.complete then'DSR_COMPLETE_RESPONSE_PUBLISHED'else'DSR_PARTIAL_RESPONSE_PUBLISHED'end,'response_id',r.id,'sha256',r.sha256);end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.organization_id,auth.uid(),'USER','privacy.dsr.response_reviewed','data_subject_request',d.id::text,extensions.gen_random_uuid(),jsonb_build_object('response_id',r.id,'sha256',r.sha256,'decision',case when p_approve then'APPROVE'else'REJECT'end,'complete',r.complete,'reason',btrim(p_reason)),repeat('0',64));
 return jsonb_build_object('outcome',case when not p_approve then'DSR_RESPONSE_REJECTED'when r.complete then'DSR_COMPLETE_RESPONSE_PUBLISHED'else'DSR_PARTIAL_RESPONSE_PUBLISHED'end,'response_id',r.id,'sha256',r.sha256);
end$$;

-- A revoked membership does not remove the subject's right to their private
-- response. No organization writer permission is used for this route.
create function public.get_private_dsr_response_v1(p_response_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.dsr_private_responses_v1%rowtype;approved boolean;subject boolean;
begin
 select*into r from public.dsr_private_responses_v1 where id=p_response_id;
 approved:=exists(select 1 from public.dsr_private_response_decisions_v1 where response_id=r.id and decision='APPROVE'and sha256=r.sha256);
 subject:=auth.uid()is not null and auth.jwt()->>'aal'='aal2'and auth.uid()=r.subject_user_id and exists(select 1 from public.data_subject_requests where id=r.request_id and verified_at is not null);
 if r.id is null or not(private.dsr_response_staff_v1()or(subject and approved))then raise exception'DSR_PRIVATE_RESPONSE_DENIED'using errcode='42501';end if;
 if subject and approved then insert into public.dsr_private_response_access_v1(response_id,subject_user_id,sha256)values(r.id,auth.uid(),r.sha256)on conflict do nothing;end if;
 return jsonb_build_object('response_json',r.response_json,'sha256',r.sha256,'response_id',r.id,'scope_version_id',r.scope_version_id,'complete',r.complete);
end$$;
create function public.acknowledge_my_dsr_response_v1(p_response_id uuid,p_scope_version_id uuid,p_sha256 text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare r public.dsr_private_responses_v1%rowtype;d public.data_subject_requests%rowtype;
begin
 select*into r from public.dsr_private_responses_v1 where id=p_response_id;
 select*into d from public.data_subject_requests where id=r.request_id for update;
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or auth.uid()is distinct from r.subject_user_id or d.verified_at is null then raise exception'DSR_VERIFIED_SUBJECT_REQUIRED'using errcode='42501';end if;
 if r.id is null or p_scope_version_id is distinct from r.scope_version_id or p_sha256 is distinct from r.sha256 or r.scope_version_id is distinct from(select id from public.dsr_scope_versions_v1 where request_id=r.request_id order by version desc limit 1)then raise exception'STALE_DSR_RESPONSE'using errcode='40001';end if;
 if not exists(select 1 from public.dsr_private_response_decisions_v1 where response_id=r.id and decision='APPROVE'and sha256=r.sha256)or not exists(select 1 from public.dsr_private_response_access_v1 where response_id=r.id and subject_user_id=auth.uid()and sha256=r.sha256)then raise exception'DSR_APPROVED_RESPONSE_ACCESS_REQUIRED'using errcode='55000';end if;
 if exists(select 1 from public.dsr_private_response_ack_v1 where response_id=r.id and subject_user_id=auth.uid()and sha256=r.sha256)then return jsonb_build_object('outcome','DSR_RESPONSE_ACKNOWLEDGED','response_id',r.id,'sha256',r.sha256);end if;
 insert into public.dsr_private_response_ack_v1(response_id,subject_user_id,sha256)values(r.id,auth.uid(),r.sha256)on conflict do nothing;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(d.organization_id,auth.uid(),'USER','privacy.dsr.response_acknowledged','data_subject_request',d.id::text,extensions.gen_random_uuid(),jsonb_build_object('response_id',r.id,'scope_version_id',r.scope_version_id,'sha256',r.sha256,'complete',r.complete,'automatically_fulfilled',false),repeat('0',64));
 return jsonb_build_object('outcome','DSR_RESPONSE_ACKNOWLEDGED','response_id',r.id,'sha256',r.sha256);
end$$;
create function private.dsr_acknowledged_complete_response_v1(p_request_id uuid,p_reference text)returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.dsr_private_responses_v1 r join public.dsr_private_response_decisions_v1 d on d.response_id=r.id and d.decision='APPROVE'and d.sha256=r.sha256 and d.decided_by<>r.created_by join public.dsr_private_response_ack_v1 a on a.response_id=r.id and a.sha256=r.sha256 and a.subject_user_id=r.subject_user_id join public.dsr_scope_versions_v1 s on s.id=r.scope_version_id where r.request_id=p_request_id and p_reference='privacy-response:'||r.id::text and r.complete and cardinality(r.uncovered_scopes)=0 and r.covered_scopes=s.requested_scopes and s.version=(select max(version)from public.dsr_scope_versions_v1 where request_id=r.request_id))
$$;
revoke all on function private.dsr_acknowledged_complete_response_v1(uuid,text)from public,anon,authenticated,service_role;
-- Same transition guard, now satisfied only by an independently reviewed,
-- scope-complete private response explicitly acknowledged by its subject.
do $$declare definition text;begin select pg_get_functiondef('public.transition_data_subject_request(uuid,integer,text,text,text,uuid)'::regprocedure)into definition;
 if strpos(definition,'raise exception''PRIVACY_SCOPE_REVIEW_AND_SUBJECT_DELIVERY_REQUIRED''using errcode=''55000'';')=0 then raise exception'DSR_RESPONSE_TRANSITION_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,'where id=p_request_id;','where id=p_request_id for update;');
 definition:=replace(definition,'raise exception''PRIVACY_SCOPE_REVIEW_AND_SUBJECT_DELIVERY_REQUIRED''using errcode=''55000'';','if not private.dsr_acknowledged_complete_response_v1(d.id,reference)then raise exception''PRIVACY_SCOPE_REVIEW_AND_SUBJECT_DELIVERY_REQUIRED''using errcode=''55000'';end if;');execute definition;
end$$;
do $$declare f regprocedure;begin foreach f in array array['public.confirm_my_dsr_scope_v1(uuid,text[],text)'::regprocedure,'public.prepare_admin_dsr_private_response_v1(uuid,uuid,text)'::regprocedure,'public.review_admin_dsr_private_response_v1(uuid,text,boolean,boolean,text)'::regprocedure,'public.get_private_dsr_response_v1(uuid)'::regprocedure,'public.acknowledge_my_dsr_response_v1(uuid,uuid,text)'::regprocedure]loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f);execute format('grant execute on function %s to authenticated',f);end loop;end$$;
create function public.get_dsr_delivery_console_v1(p_staff boolean default false,p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare requests jsonb;total bigint;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or p_staff is null or(p_staff and not private.dsr_response_staff_v1())then raise exception'DSR_DELIVERY_CONSOLE_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_PAGE'using errcode='22023';end if;
 select count(*)into total from public.data_subject_requests d where d.request_type in('ACCESS','PORTABILITY')and(p_staff or private.dsr_account_subject_v1(d.id)=auth.uid()or exists(select 1 from public.dsr_scope_versions_v1 s where s.request_id=d.id and s.subject_user_id=auth.uid()));
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'request_type',d.request_type,'status',d.status,'row_version',d.row_version,'verified',d.verified_at is not null,'scope',(select jsonb_build_object('id',s.id,'version',s.version,'requested_scopes',s.requested_scopes)from public.dsr_scope_versions_v1 s where s.request_id=d.id order by s.version desc limit 1),'response',(select jsonb_build_object('id',r.id,'scope_version_id',r.scope_version_id,'sha256',r.sha256,'complete',r.complete,'covered_scopes',r.covered_scopes,'uncovered_scopes',r.uncovered_scopes,'created_by',r.created_by,'decision',(select decision from public.dsr_private_response_decisions_v1 where response_id=r.id),'acknowledged',exists(select 1 from public.dsr_private_response_ack_v1 where response_id=r.id and sha256=r.sha256),'reference','privacy-response:'||r.id::text)from public.dsr_private_responses_v1 r where r.request_id=d.id and r.scope_version_id=(select s.id from public.dsr_scope_versions_v1 s where s.request_id=d.id order by s.version desc limit 1)order by r.created_at desc,r.id desc limit 1))order by d.created_at desc,d.id desc),'[]')into requests from(select*from public.data_subject_requests x where x.request_type in('ACCESS','PORTABILITY')and(p_staff or private.dsr_account_subject_v1(x.id)=auth.uid()or exists(select 1 from public.dsr_scope_versions_v1 s where s.request_id=x.id and s.subject_user_id=auth.uid()))order by x.created_at desc,x.id desc limit 25 offset((p_page-1)*25))d;
 return jsonb_build_object('requests',requests,'page',p_page,'has_next',p_page::bigint*25<total);
end$$;
revoke all on function public.get_dsr_delivery_console_v1(boolean,integer)from public,anon,authenticated,service_role;
grant execute on function public.get_dsr_delivery_console_v1(boolean,integer)to authenticated;
notify pgrst,'reload schema';
commit;
