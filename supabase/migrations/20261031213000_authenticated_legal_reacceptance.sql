-- Exact text sets and optional authenticated reacceptance; no global legal blocking rule.
begin;
create table public.legal_consent_document_sets(
 id uuid primary key default extensions.gen_random_uuid(),terms_version text not null check(terms_version~'^\d{4}-\d{2}-\d{2}$'),privacy_version text not null check(privacy_version~'^\d{4}-\d{2}-\d{2}$'),locale text not null check(locale in('fr','ar')),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),created_at timestamptz not null default clock_timestamp(),unique(terms_version,privacy_version,locale)
);
create table public.account_legal_consent_acceptances(
 id uuid primary key default extensions.gen_random_uuid(),user_id uuid not null references auth.users(id),document_set_id uuid not null references public.legal_consent_document_sets(id),source_hash text not null check(source_hash~'^[0-9a-f]{64}$'),verified_email_hash text not null check(verified_email_hash~'^[0-9a-f]{64}$'),accepted_at timestamptz not null default clock_timestamp(),idempotency_key text not null,unique(user_id,document_set_id),unique(user_id,idempotency_key)
);
alter table public.registration_consent_receipts add column document_set_id uuid references public.legal_consent_document_sets(id);
alter table public.legal_consent_document_sets enable row level security;
alter table public.account_legal_consent_acceptances enable row level security;
revoke all on public.legal_consent_document_sets,public.account_legal_consent_acceptances from public,anon,authenticated,service_role;
create trigger legal_consent_document_sets_immutable before update or delete on public.legal_consent_document_sets for each row execute function private.prevent_contract_immutable_change();
create trigger account_legal_consent_acceptances_immutable before update or delete on public.account_legal_consent_acceptances for each row execute function private.prevent_contract_immutable_change();
create function public.register_legal_consent_documents_v1(p_terms_version text,p_privacy_version text,p_locale text,p_snapshot jsonb)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare current_set public.legal_consent_document_sets%rowtype;existing public.legal_consent_document_sets%rowtype;h text;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'LEGAL_DOCUMENT_REGISTRATION_DENIED'using errcode='42501';end if;
 if p_locale is null or p_locale not in('fr','ar')or coalesce(p_terms_version,'')!~'^\d{4}-\d{2}-\d{2}$'or coalesce(p_privacy_version,'')!~'^\d{4}-\d{2}-\d{2}$'or jsonb_typeof(p_snapshot)is distinct from'object'or jsonb_typeof(p_snapshot->'terms')is distinct from'object'or jsonb_typeof(p_snapshot->'privacy')is distinct from'object'or octet_length(p_snapshot::text)>262144 then raise exception'INVALID_LEGAL_DOCUMENT_SET'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('legal-document-set:'||p_locale,0));
 select*into current_set from public.legal_consent_document_sets where locale=p_locale order by terms_version desc,privacy_version desc,created_at desc limit 1;
 if found and(p_terms_version<current_set.terms_version or p_privacy_version<current_set.privacy_version)then raise exception'LEGAL_DOCUMENT_VERSION_OUTDATED'using errcode='55000';end if;
 h:=encode(extensions.digest(convert_to(p_snapshot::text,'UTF8'),'sha256'),'hex');
 select*into existing from public.legal_consent_document_sets where terms_version=p_terms_version and privacy_version=p_privacy_version and locale=p_locale;
 if found then if existing.source_hash<>h then raise exception'LEGAL_TEXT_VERSION_COLLISION'using errcode='22000';end if;
 else insert into public.legal_consent_document_sets(terms_version,privacy_version,locale,snapshot,source_hash)values(p_terms_version,p_privacy_version,p_locale,p_snapshot,h)returning*into existing;end if;
 return jsonb_build_object('id',existing.id,'terms_version',existing.terms_version,'privacy_version',existing.privacy_version,'locale',existing.locale,'source_hash',existing.source_hash);
end$$;
create or replace function public.reserve_registration_consent(p_email text,p_locale text,p_terms_version text,p_privacy_version text)returns uuid language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare receipt uuid;document_set uuid;
begin
 if coalesce(auth.role(),'')<>'service_role'then raise exception'CONSENT_RESERVATION_DENIED'using errcode='42501';end if;
 if p_locale is null or p_locale not in('fr','ar')or length(coalesce(p_email,''))>320 or coalesce(p_email,'')!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'then raise exception'INVALID_CONSENT'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('legal-document-set:'||p_locale,0));
 select id into document_set from public.legal_consent_document_sets where locale=p_locale order by terms_version desc,privacy_version desc,created_at desc limit 1;
 if document_set is null or not exists(select 1 from public.legal_consent_document_sets where id=document_set and terms_version=p_terms_version and privacy_version=p_privacy_version)then raise exception'LEGAL_DOCUMENT_VERSION_OUTDATED'using errcode='55000';end if;
 insert into public.registration_consent_receipts(identifier_hash,locale,terms_version,privacy_version,document_set_id)values(encode(extensions.digest(lower(btrim(p_email)),'sha256'),'hex'),p_locale,p_terms_version,p_privacy_version,document_set)returning id into receipt;
 return receipt;
end$$;
create function public.get_my_legal_consent_v1(p_locale text,p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare current_set public.legal_consent_document_sets%rowtype;
begin
 if auth.uid()is null then raise exception'UNAUTHENTICATED'using errcode='42501';end if;
 if p_locale is null or p_locale not in('fr','ar')or p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_LEGAL_CONSENT_QUERY'using errcode='22023';end if;
 select*into current_set from public.legal_consent_document_sets where locale=p_locale order by terms_version desc,privacy_version desc,created_at desc limit 1;
 if not found then raise exception'LEGAL_DOCUMENT_SET_REQUIRED'using errcode='55000';end if;
 return jsonb_build_object('current',jsonb_build_object('id',current_set.id,'terms_version',current_set.terms_version,'privacy_version',current_set.privacy_version,'locale',current_set.locale,'source_hash',current_set.source_hash,'accepted_at',coalesce((select a.accepted_at from public.account_legal_consent_acceptances a where a.document_set_id=current_set.id and a.user_id=auth.uid()),(select a.accepted_at from public.registration_consent_acceptances a join public.registration_consent_receipts r on r.id=a.receipt_id where a.user_id=auth.uid()and r.document_set_id=current_set.id order by a.accepted_at desc limit 1))),
 'history',coalesce((with all_proofs as(
  select a.id,a.document_set_id,a.accepted_at,'ACCOUNT_UPDATE'::text source_type from public.account_legal_consent_acceptances a where a.user_id=auth.uid()
  union all
  select a.id,r.document_set_id,a.accepted_at,'REGISTRATION'::text from public.registration_consent_acceptances a join public.registration_consent_receipts r on r.id=a.receipt_id where a.user_id=auth.uid()and r.document_set_id is not null
 ),page as(select*from all_proofs order by accepted_at desc,id offset(p_page-1)*20 limit 21)
 select jsonb_agg(jsonb_build_object('id',a.id,'source_type',a.source_type,'accepted_at',a.accepted_at,'document_set_id',d.id,'terms_version',d.terms_version,'privacy_version',d.privacy_version,'locale',d.locale,'source_hash',d.source_hash,'snapshot',d.snapshot)order by a.accepted_at desc,a.id)from page a join public.legal_consent_document_sets d on d.id=a.document_set_id),'[]'::jsonb));
end$$;
create function public.accept_account_legal_consent_v1(p_document_set_id uuid,p_source_hash text,p_consent boolean,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare actor uuid:=auth.uid();d public.legal_consent_document_sets%rowtype;current_set uuid;existing public.account_legal_consent_acceptances%rowtype;email_hash text;
begin
 if actor is null or not exists(select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null and lower(u.email)=lower(auth.jwt()->>'email'))then raise exception'VERIFIED_LEGAL_ACTOR_REQUIRED'using errcode='42501';end if;
 if p_consent is distinct from true or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception'EXPLICIT_LEGAL_CONSENT_REQUIRED'using errcode='22023';end if;
 select*into d from public.legal_consent_document_sets where id=p_document_set_id;
 if not found or d.source_hash is distinct from p_source_hash then raise exception'LEGAL_TEXT_HASH_MISMATCH'using errcode='22000';end if;
 perform pg_advisory_xact_lock(hashtextextended('legal-document-set:'||d.locale,0));
 select id into current_set from public.legal_consent_document_sets where locale=d.locale order by terms_version desc,privacy_version desc,created_at desc limit 1;
 if current_set<>d.id then raise exception'LEGAL_DOCUMENT_VERSION_OUTDATED'using errcode='55000';end if;
 perform pg_advisory_xact_lock(hashtextextended('account-legal-consent:'||actor::text,0));
 select*into existing from public.account_legal_consent_acceptances where user_id=actor and idempotency_key=p_idempotency_key;
 if found and existing.document_set_id<>d.id then raise exception'LEGAL_CONSENT_IDEMPOTENCY_MISMATCH'using errcode='22000';end if;
 select*into existing from public.account_legal_consent_acceptances where user_id=actor and document_set_id=d.id;
 if found then return jsonb_build_object('outcome','LEGAL_CONSENT_ALREADY_RECORDED','acceptance_id',existing.id);end if;
 email_hash:=encode(extensions.digest(lower(auth.jwt()->>'email'),'sha256'),'hex');
 insert into public.account_legal_consent_acceptances(user_id,document_set_id,source_hash,verified_email_hash,idempotency_key)values(actor,d.id,d.source_hash,email_hash,p_idempotency_key)returning*into existing;
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(actor,'USER','account.legal_consent.accepted','legal_consent_acceptance',existing.id::text,extensions.gen_random_uuid(),jsonb_build_object('document_set_id',d.id,'terms_version',d.terms_version,'privacy_version',d.privacy_version,'locale',d.locale,'source_hash',d.source_hash),repeat('0',64));
 return jsonb_build_object('outcome','LEGAL_CONSENT_RECORDED','acceptance_id',existing.id);
end$$;
revoke all on function public.register_legal_consent_documents_v1(text,text,text,jsonb),public.get_my_legal_consent_v1(text,integer),public.accept_account_legal_consent_v1(uuid,text,boolean,text)from public,anon,authenticated,service_role;
grant execute on function public.register_legal_consent_documents_v1(text,text,text,jsonb)to service_role;
grant execute on function public.get_my_legal_consent_v1(text,integer),public.accept_account_legal_consent_v1(uuid,text,boolean,text)to authenticated;
commit;
