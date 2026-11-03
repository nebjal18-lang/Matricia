-- Client delivery: private human assistance, bookmarks and verified consent receipts.
begin;
create table public.registration_consent_receipts (
 id uuid primary key default extensions.gen_random_uuid(), identifier_hash text not null check(identifier_hash~'^[0-9a-f]{64}$'),
 locale text not null check(locale in('fr','ar')), terms_version text not null, privacy_version text not null,
 requested_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null default(clock_timestamp()+interval '30 minutes')
);
create table public.registration_consent_acceptances (
 id uuid primary key default extensions.gen_random_uuid(), receipt_id uuid not null unique references public.registration_consent_receipts(id),
 user_id uuid not null references auth.users(id), accepted_at timestamptz not null default clock_timestamp()
);
alter table public.registration_consent_receipts enable row level security;
alter table public.registration_consent_acceptances enable row level security;
revoke all on public.registration_consent_receipts,public.registration_consent_acceptances from public,anon,authenticated,service_role;
grant select on public.registration_consent_acceptances to authenticated;
create policy registration_consent_owner on public.registration_consent_acceptances for select to authenticated using(user_id=auth.uid());
create function public.reserve_registration_consent(p_email text,p_locale text,p_terms_version text,p_privacy_version text)returns uuid language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare receipt uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'CONSENT_RESERVATION_DENIED' using errcode='42501';end if;
 if p_locale not in('fr','ar') or p_terms_version<>'2026-10-31' or p_privacy_version<>'2026-10-31' or length(p_email)>320 or p_email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'INVALID_CONSENT' using errcode='22023';end if;
 insert into public.registration_consent_receipts(identifier_hash,locale,terms_version,privacy_version)values(encode(extensions.digest(lower(btrim(p_email)),'sha256'),'hex'),p_locale,p_terms_version,p_privacy_version)returning id into receipt;
 return receipt;
end$$;
create function public.confirm_registration_consent(p_receipt_id uuid)returns uuid language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare receipt public.registration_consent_receipts%rowtype; acceptance uuid; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501';end if;
 select * into receipt from public.registration_consent_receipts where id=p_receipt_id;
 if not found or receipt.expires_at<clock_timestamp() or receipt.identifier_hash<>encode(extensions.digest(lower(coalesce(auth.jwt()->>'email','')),'sha256'),'hex') or not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null and lower(u.email)=lower(auth.jwt()->>'email')) then raise exception 'CONSENT_RECEIPT_DENIED' using errcode='42501';end if;
 insert into public.registration_consent_acceptances(receipt_id,user_id)values(receipt.id,actor)on conflict(receipt_id)do nothing;
 select id into acceptance from public.registration_consent_acceptances where receipt_id=receipt.id and user_id=actor;
 if acceptance is null then raise exception 'CONSENT_RECEIPT_DENIED' using errcode='42501';end if;
 return acceptance;
end$$;
revoke all on function public.reserve_registration_consent(text,text,text,text),public.confirm_registration_consent(uuid)from public,anon,authenticated,service_role;
grant execute on function public.reserve_registration_consent(text,text,text,text)to service_role;
grant execute on function public.confirm_registration_consent(uuid)to authenticated;

create table public.client_assistance_requests(
 id uuid primary key default extensions.gen_random_uuid(),organization_id uuid not null references public.organizations(id),created_by uuid not null references auth.users(id),
 subject text not null check(length(btrim(subject))between 3 and 200),body text not null check(length(btrim(body))between 10 and 10000),
 status text not null check(status in('DRAFT','SUBMITTED','ASSIGNED','CLOSED')),document_ids uuid[]not null default'{}'check(cardinality(document_ids)<=10),
 consented_at timestamptz,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),row_version integer not null default 1,
 idempotency_key text not null,request_hash text not null,unique(organization_id,created_by,idempotency_key),check(status='DRAFT'or consented_at is not null)
);
create table public.client_assistance_messages(
 id uuid primary key default extensions.gen_random_uuid(),request_id uuid not null references public.client_assistance_requests(id),actor_user_id uuid not null references auth.users(id),
 body text not null check(length(btrim(body))between 1 and 10000),created_at timestamptz not null default clock_timestamp(),idempotency_key text not null,
 unique(request_id,actor_user_id,idempotency_key)
);
create index client_assistance_organization_idx on public.client_assistance_requests(organization_id,updated_at desc,id);
alter table public.client_assistance_requests enable row level security;
alter table public.client_assistance_messages enable row level security;
revoke all on public.client_assistance_requests,public.client_assistance_messages from public,anon,authenticated,service_role;
grant select on public.client_assistance_requests,public.client_assistance_messages to authenticated;
create function private.can_read_client_assistance(p_organization_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select auth.uid() is not null and(private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_EDITOR','CLIENT_MEMBER','CLIENT_BUYER','CLIENT_VIEWER'],auth.uid()) or (coalesce(auth.jwt()->>'aal','')='aal2' and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','SUPPORT_AGENT','COMPLIANCE_MANAGER'],auth.uid())))$$;
revoke all on function private.can_read_client_assistance(uuid)from public,anon,authenticated,service_role;
grant execute on function private.can_read_client_assistance(uuid)to authenticated;
create policy assistance_request_reader on public.client_assistance_requests for select to authenticated using(private.can_read_client_assistance(organization_id) and (created_by=auth.uid() or (status<>'DRAFT' and consented_at is not null)));
create policy assistance_message_reader on public.client_assistance_messages for select to authenticated using(exists(select 1 from public.client_assistance_requests r where r.id=request_id));
create function public.save_client_assistance(p_request_id uuid,p_organization_id uuid,p_subject text,p_body text,p_document_ids uuid[],p_submit boolean,p_consent boolean,p_expected_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare actor uuid:=auth.uid(); r public.client_assistance_requests%rowtype; h text; rid uuid; q uuid; new_status text; version integer; cached jsonb;
begin
 if actor is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_EDITOR','CLIENT_MEMBER','CLIENT_BUYER'],actor)then raise exception 'ASSISTANCE_WRITE_DENIED' using errcode='42501';end if;
 if p_expected_version is null or p_expected_version<0 or p_submit is null or p_consent is null or length(btrim(coalesce(p_subject,'')))not between 3 and 200 or length(btrim(coalesce(p_body,'')))not between 10 and 10000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 or cardinality(p_document_ids)>10 or (p_submit and not p_consent)then raise exception 'INVALID_ASSISTANCE' using errcode='22023';end if;
 if exists(select 1 from unnest(coalesce(p_document_ids,'{}')) d where not exists(select 1 from public.client_compliance_documents cd where cd.id=d and cd.organization_id=p_organization_id and cd.status='VERIFIED'and cd.scan_status='CLEAN'and cd.current_scan_result_id is not null and(cd.expires_on is null or cd.expires_on>=current_date)))then raise exception 'ASSISTANCE_DOCUMENT_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('request',p_request_id,'org',p_organization_id,'subject',btrim(p_subject),'body',btrim(p_body),'documents',coalesce(p_document_ids,'{}'),'submit',p_submit,'consent',p_consent,'version',p_expected_version));
 cached:=private.begin_contract_command(p_organization_id,'client.assistance.save',p_idempotency_key,h,actor);
 if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||actor::text||p_idempotency_key,0));
 new_status:=case when p_submit then'SUBMITTED'else'DRAFT'end;
 if p_request_id is null then
  if p_expected_version is distinct from 0 then raise exception 'STALE_ASSISTANCE'using errcode='40001';end if;
  insert into public.client_assistance_requests(organization_id,created_by,subject,body,status,document_ids,consented_at,idempotency_key,request_hash)values(p_organization_id,actor,btrim(p_subject),btrim(p_body),new_status,coalesce(p_document_ids,'{}'),case when p_submit then clock_timestamp()else null end,p_idempotency_key,h)returning id,row_version into rid,version;
 else
  select * into r from public.client_assistance_requests where id=p_request_id and organization_id=p_organization_id for update;
  if not found or r.created_by<>actor or r.status<>'DRAFT'then raise exception 'ASSISTANCE_WRITE_DENIED'using errcode='42501';end if;
  if r.row_version is distinct from p_expected_version then raise exception 'STALE_ASSISTANCE'using errcode='40001';end if;
  update public.client_assistance_requests set subject=btrim(p_subject),body=btrim(p_body),status=new_status,document_ids=coalesce(p_document_ids,'{}'),consented_at=case when p_submit then clock_timestamp()else null end,updated_at=clock_timestamp(),row_version=row_version+1,idempotency_key=p_idempotency_key,request_hash=h where id=r.id returning id,row_version into rid,version;
 end if;
 if p_submit then
  select id into q from public.admin_queue_versions where queue_key='EXCEPTIONS'and status='ACTIVE';
  if q is null then raise exception 'ASSISTANCE_QUEUE_UNAVAILABLE'using errcode='55000';end if;
  insert into public.admin_work_items(queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,due_at,redacted_context,created_by)
  values(q,p_organization_id,'MANUAL_REVIEW','client_assistance_request',rid::text,'Demande de conseil client','طلب استشارة عميل','MEDIUM',clock_timestamp()+interval'2 days',jsonb_build_object('request_id',rid),actor);
 end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_organization_id,actor,'USER',case when p_submit then'client.assistance.submitted'else'client.assistance.saved'end,'client_assistance_request',rid::text,p_correlation_id,jsonb_build_object('version',version,'document_count',cardinality(coalesce(p_document_ids,'{}'))),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_organization_id,'client_assistance_request',rid::text,case when p_submit then'ClientAssistanceSubmittedV1'else'ClientAssistanceDraftSavedV1'end,p_correlation_id,jsonb_build_object('request_id',rid),p_idempotency_key);
 cached:=jsonb_build_object('id',rid,'status',new_status,'row_version',version);
 perform private.finish_contract_command(p_organization_id,'client.assistance.save',p_idempotency_key,cached);
 return cached;
end$$;
create function public.reply_client_assistance(p_request_id uuid,p_body text,p_close boolean,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns uuid language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare actor uuid:=auth.uid();r public.client_assistance_requests%rowtype; mid uuid; staff boolean; cached jsonb; h text; work public.admin_work_items%rowtype;
begin
 select * into r from public.client_assistance_requests where id=p_request_id for update;
 if not found or actor is null or not private.can_read_client_assistance(r.organization_id)then raise exception 'ASSISTANCE_REPLY_DENIED'using errcode='42501';end if;
 staff:=coalesce(auth.jwt()->>'aal','')='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','SUPPORT_AGENT','COMPLIANCE_MANAGER'],actor);
 if (not staff and r.created_by<>actor)or(p_close and not staff)then raise exception 'ASSISTANCE_REPLY_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(p_body,'')))not between 1 and 10000 or length(coalesce(p_idempotency_key,''))not between 8 and 200 or p_close is null then raise exception 'INVALID_ASSISTANCE_REPLY'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('request',r.id,'body',btrim(p_body),'close',p_close));
 cached:=private.begin_contract_command(r.organization_id,'client.assistance.reply.'||r.id::text,p_idempotency_key,h,actor);
 if cached is not null then return(cached->>'id')::uuid;end if;
 if r.status not in('SUBMITTED','ASSIGNED')then raise exception 'ASSISTANCE_REPLY_DENIED'using errcode='42501';end if;
 insert into public.client_assistance_messages(request_id,actor_user_id,body,idempotency_key)values(r.id,actor,btrim(p_body),p_idempotency_key)returning id into mid;
 update public.client_assistance_requests set status=case when p_close then'CLOSED'when staff then'ASSIGNED'else status end,updated_at=clock_timestamp(),row_version=row_version+1 where id=r.id;
 if p_close then
  for work in select * from public.admin_work_items where resource_type='client_assistance_request' and resource_id=r.id::text and organization_id=r.organization_id and status in('OPEN','CLAIMED','WAITING_INFORMATION') for update loop
   update public.admin_work_items set status='RESOLVED',resolution_code='ASSISTANCE_COMPLETED',resolution_reason='Conseil terminé avec réponse au client',resolution_evidence=jsonb_build_object('request_id',r.id,'message_id',mid),updated_at=clock_timestamp(),row_version=row_version+1 where id=work.id;
   insert into public.admin_work_item_events(work_item_id,event_type,from_status,to_status,actor_user_id,reason,evidence_snapshot,correlation_id)values(work.id,'ASSISTANCE_COMPLETED',work.status,'RESOLVED',actor,'Conseil terminé avec réponse au client',jsonb_build_object('request_id',r.id,'message_id',mid),p_correlation_id);
  end loop;
 end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.organization_id,actor,'USER','client.assistance.replied','client_assistance_request',r.id::text,p_correlation_id,jsonb_build_object('message_id',mid,'closed',p_close),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(r.organization_id,'client_assistance_request',r.id::text,'ClientAssistanceRepliedV1',p_correlation_id,jsonb_build_object('request_id',r.id,'message_id',mid),p_idempotency_key);
 perform private.finish_contract_command(r.organization_id,'client.assistance.reply.'||r.id::text,p_idempotency_key,jsonb_build_object('id',mid));
 return mid;
end$$;
revoke all on function public.save_client_assistance(uuid,uuid,text,text,uuid[],boolean,boolean,integer,text,uuid),public.reply_client_assistance(uuid,text,boolean,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.save_client_assistance(uuid,uuid,text,text,uuid[],boolean,boolean,integer,text,uuid),public.reply_client_assistance(uuid,text,boolean,text,uuid)to authenticated;

create table public.client_solution_bookmarks(
 user_id uuid not null references auth.users(id),solution_set_id uuid not null references public.diagnostic_solution_sets(id),created_at timestamptz not null default clock_timestamp(),primary key(user_id,solution_set_id)
);
alter table public.client_solution_bookmarks enable row level security;
revoke all on public.client_solution_bookmarks from public,anon,authenticated,service_role;
grant select on public.client_solution_bookmarks to authenticated;
create policy solution_bookmark_owner on public.client_solution_bookmarks for select to authenticated using(user_id=auth.uid()and exists(select 1 from public.diagnostic_solution_sets s where s.id=solution_set_id));
create function public.set_client_solution_bookmark(p_solution_set_id uuid,p_saved boolean)returns boolean language plpgsql security definer set search_path=pg_catalog,private as $$
declare actor uuid:=auth.uid();org uuid;
begin
 select organization_id into org from public.diagnostic_solution_sets where id=p_solution_set_id;
 if actor is null or org is null or not private.has_org_role(org,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_EDITOR','CLIENT_MEMBER','CLIENT_VIEWER'],actor)then raise exception 'SOLUTION_BOOKMARK_DENIED'using errcode='42501';end if;
 if p_saved is null then raise exception 'INVALID_BOOKMARK'using errcode='22023';end if;
 if p_saved then insert into public.client_solution_bookmarks(user_id,solution_set_id)values(actor,p_solution_set_id)on conflict do nothing;
 else delete from public.client_solution_bookmarks where user_id=actor and solution_set_id=p_solution_set_id;end if;
 return p_saved;
end$$;
revoke all on function public.set_client_solution_bookmark(uuid,boolean)from public,anon,authenticated,service_role;
grant execute on function public.set_client_solution_bookmark(uuid,boolean)to authenticated;
create function private.prevent_client_delivery_history_change()returns trigger language plpgsql set search_path=pg_catalog as $$begin raise exception 'CLIENT_HISTORY_IMMUTABLE'using errcode='55000';end$$;
revoke all on function private.prevent_client_delivery_history_change()from public,anon,authenticated,service_role;
create trigger registration_receipt_immutable before update or delete on public.registration_consent_receipts for each row execute function private.prevent_client_delivery_history_change();
create trigger registration_acceptance_immutable before update or delete on public.registration_consent_acceptances for each row execute function private.prevent_client_delivery_history_change();
create trigger client_assistance_message_immutable before update or delete on public.client_assistance_messages for each row execute function private.prevent_client_delivery_history_change();
create function public.list_client_request_page(p_organization_id uuid,p_query text default'',p_status text default'',p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_VIEWER'],auth.uid())then raise exception 'CLIENT_REQUEST_LIST_DENIED'using errcode='42501';end if;
 if p_page is null or p_page<1 or p_page>100000 or length(coalesce(p_query,''))>200 or p_status is null or p_status not in('','DRAFT','INFORMATION_REQUIRED','READY','MATCHING','RFQ_OPEN','QUOTES_RECEIVED','CLIENT_REVIEW','PROVIDER_SELECTED','CONTRACT_PENDING','CONTRACTED','CANCELLED','EXPIRED','NO_PROVIDER_AVAILABLE')then raise exception 'INVALID_REQUEST_FILTER'using errcode='22023';end if;
 select coalesce(jsonb_agg(row_value order by created_at desc,id),'[]')into result from(
  select r.id,r.created_at,jsonb_build_object('id',r.id,'client_organization_id',r.client_organization_id,'library_id',r.library_id,'service_id',r.service_id,'current_version_id',r.current_version_id,'status',r.status,'created_at',r.created_at,'row_version',r.row_version)row_value
  from public.service_requests r left join public.service_request_versions v on v.id=r.current_version_id
  where r.client_organization_id=p_organization_id and(p_status=''or r.status=p_status)and(coalesce(p_query,'')=''or strpos(lower(coalesce(v.description,'')),lower(p_query))>0)
  order by r.created_at desc,r.id offset((p_page-1)*20)limit 21
 )q;
 return result;
end$$;
revoke all on function public.list_client_request_page(uuid,text,text,integer)from public,anon,authenticated,service_role;
grant execute on function public.list_client_request_page(uuid,text,text,integer)to authenticated;

-- Receipt projection: the subscription charge and the client's confirmed mission receipt.
-- Provider commission invoices are deliberately excluded: their debtor is the provider.
create function public.list_client_financial_page(p_organization_id uuid,p_kind text default '',p_status text default '',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING','CLIENT_VIEWER'],auth.uid())then raise exception 'CLIENT_FINANCE_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or p_kind not in('','SUBSCRIPTION','MISSION_RECEIPT')or p_status not in('','PENDING','CONFIRMED')then raise exception 'INVALID_FINANCE_FILTER'using errcode='22023';end if;
 with entries as(
 select i.id,'SUBSCRIPTION'::text kind,coalesce(e.payment_reference,i.provider_intent_id) reference,i.amount_minor::text amount_minor,i.currency::text currency,case when e.id is null then 'PENDING' else 'CONFIRMED'end status,coalesce(e.paid_at,i.created_at) occurred_at,null::uuid mission_id,i.gateway='DEMO' is_demo
 from public.subscription_payment_intents i left join lateral(select e.* from public.subscription_payment_events e where e.payment_intent_id=i.id and e.organization_id=i.organization_id order by e.received_at,e.id limit 1)e on true where i.organization_id=p_organization_id
 union all
 select e.id,'MISSION_RECEIPT',e.client_receipt_reference,e.gross_amount_minor::text,e.currency::text,'CONFIRMED',e.occurred_on::timestamptz,e.mission_id,false from public.provider_payable_events e where e.client_organization_id=p_organization_id and e.event_type='CLIENT_RECEIPT_CONFIRMED'
 ), page as(select * from entries where(p_kind=''or kind=p_kind)and(p_status=''or status=p_status)order by occurred_at desc,id offset(p_page-1)*20 limit 21)
 select coalesce(jsonb_agg(to_jsonb(page)order by occurred_at desc,id),'[]'::jsonb)into result from page;
 return result;
end$$;
revoke all on function public.list_client_financial_page(uuid,text,text,integer)from public,anon,authenticated,service_role;
grant execute on function public.list_client_financial_page(uuid,text,text,integer)to authenticated;

create function public.authorize_client_assistance_document(p_request_id uuid,p_document_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare r public.client_assistance_requests%rowtype; d public.client_compliance_documents%rowtype;
begin
 select * into r from public.client_assistance_requests where id=p_request_id and status in('SUBMITTED','ASSIGNED','CLOSED')and consented_at is not null and p_document_id=any(document_ids);
 if not found or not private.can_read_client_assistance(r.organization_id)then raise exception 'CLIENT_DOCUMENT_DENIED'using errcode='42501';end if;
 select * into d from public.client_compliance_documents d where d.id=p_document_id and d.organization_id=r.organization_id and d.status='VERIFIED'and d.scan_status='CLEAN'and(d.expires_on is null or d.expires_on>=current_date)and exists(select 1 from private.client_document_scan_results s where s.id=d.current_scan_result_id and s.document_id=d.id and s.organization_id=d.organization_id and s.result='CLEAN'and s.computed_sha256=d.declared_sha256);
 if not found then raise exception 'CLIENT_DOCUMENT_DENIED'using errcode='42501';end if;
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.organization_id,auth.uid(),'USER','client.assistance.document_downloaded','client_compliance_document',d.id::text,extensions.gen_random_uuid(),jsonb_build_object('request_id',r.id,'version',d.version),repeat('0',64));
 return jsonb_build_object('outcome','CLIENT_DOCUMENT_AUTHORIZED','document_id',d.id,'bucket',d.storage_bucket,'object_path',d.storage_object_path,'file_name',d.original_file_name,'mime_type',d.declared_mime_type,'size_bytes',d.declared_size_bytes);
end$$;
revoke all on function public.authorize_client_assistance_document(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.authorize_client_assistance_document(uuid,uuid)to authenticated;

create function public.list_client_solution_sets_page(p_organization_id uuid,p_query text default '',p_level text default '',p_saved boolean default false,p_anomaly_id uuid default null,p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result jsonb;
begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_VIEWER'],auth.uid())then raise exception 'CLIENT_SOLUTIONS_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or length(coalesce(p_query,''))>200 or p_level not in('','ESSENTIAL','STANDARD','ADVANCED')or p_saved is null then raise exception 'INVALID_SOLUTIONS_FILTER'using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(s)order by s.created_at desc,s.id),'[]'::jsonb)into result from(
 select s.id,s.organization_id,s.anomaly_id,s.version,s.rationale_fr,s.rationale_ar,s.created_at from public.diagnostic_solution_sets s
 where s.organization_id=p_organization_id and(p_anomaly_id is null or s.anomaly_id=p_anomaly_id)
 and(coalesce(p_query,'')=''or strpos(lower(s.rationale_fr||' '||s.rationale_ar),lower(p_query))>0)
 and(p_level=''or exists(select 1 from public.diagnostic_solution_options o where o.solution_set_id=s.id and o.level=p_level))
 and(not p_saved or exists(select 1 from public.client_solution_bookmarks b where b.solution_set_id=s.id and b.user_id=auth.uid()))
 order by s.created_at desc,s.id offset(p_page-1)*20 limit 21)s;
 return result;
end$$;
revoke all on function public.list_client_solution_sets_page(uuid,text,text,boolean,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function public.list_client_solution_sets_page(uuid,text,text,boolean,uuid,integer)to authenticated;

commit;
