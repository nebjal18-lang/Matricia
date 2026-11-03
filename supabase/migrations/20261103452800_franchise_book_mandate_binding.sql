begin;
-- A P&L book is tied to one independently approved mandate and economic basis.
-- Neither a caller-supplied IT label nor an organization/library pair proves it.
create table public.franchise_pnl_book_bindings_v1(
 book_id uuid primary key references public.franchise_pnl_books(id)on delete restrict,
 franchise_id uuid not null references public.franchises(id)on delete restrict,
 approved_mandate_version_id uuid not null,
 finance_rule_version_id uuid not null references public.franchise_finance_rule_versions(id)on delete restrict,
 currency char(3)not null check(currency~'^[A-Z]{3}$'),
 basis_snapshot jsonb not null,basis_hash text not null check(basis_hash~'^[a-f0-9]{64}$'),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 foreign key(approved_mandate_version_id,franchise_id)references public.franchise_mandate_versions(id,franchise_id)on delete restrict,
 unique(franchise_id,approved_mandate_version_id,finance_rule_version_id,currency)
);
alter table public.franchise_pnl_book_bindings_v1 enable row level security;
revoke all on public.franchise_pnl_book_bindings_v1 from public,anon,authenticated,service_role;
grant select on public.franchise_pnl_book_bindings_v1 to authenticated;
create policy franchise_book_binding_read on public.franchise_pnl_book_bindings_v1 for select to authenticated using(private.franchise_book_access(book_id));
create trigger franchise_book_binding_immutable before update or delete on public.franchise_pnl_book_bindings_v1 for each row execute function private.prevent_update_delete();
-- Different territories or approved economic bases must not be forced into the
-- same old unique organization/library book. The registry above supplies the key.
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.franchise_pnl_books'::regclass and contype='u'
  and conkey=array[(select attnum from pg_attribute where attrelid='public.franchise_pnl_books'::regclass and attname='library_id'),(select attnum from pg_attribute where attrelid='public.franchise_pnl_books'::regclass and attname='franchise_organization_id')]::smallint[] loop
  execute format('alter table public.franchise_pnl_books drop constraint %I',c.conname);
 end loop;
end$$;

create function private.franchise_book_basis_source_v1(p_franchise uuid,p_approved_mandate uuid,p_finance_rule uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare f public.franchises%rowtype;m public.franchise_mandate_versions%rowtype;e public.franchise_economic_rule_versions%rowtype;r public.franchise_finance_rule_versions%rowtype;decision jsonb;
begin
 select*into f from public.franchises where id=p_franchise;
 select*into m from public.franchise_mandate_versions where id=p_approved_mandate and franchise_id=f.id;
 select*into e from public.franchise_economic_rule_versions where id=m.economic_rule_version_id;
 select*into r from public.franchise_finance_rule_versions where id=p_finance_rule;
 select jsonb_build_object('request_id',q.id,'requested_by',q.requested_by,'decision_id',d.id,'decided_by',d.decided_by,'decided_at',d.decided_at,'mandate_hash',d.mandate_content_hash)into decision
  from public.franchise_approval_requests q join public.franchise_approval_decisions d on d.approval_request_id=q.id
  where q.franchise_id=f.id and q.mandate_version_id=m.id and q.status='APPROVED'and d.decision='APPROVE'
   and d.decided_by<>q.requested_by and d.mandate_content_hash=m.content_hash;
 if f.id is null or m.id is null or e.id is null or r.id is null or decision is null
  or f.franchise_type is distinct from e.franchise_type or f.franchise_type is distinct from r.franchise_type
  or f.operator_code is distinct from r.operator_code
  or r.effective_from>(m.effective_from at time zone'Africa/Casablanca')::date
  or(r.effective_to is not null and r.effective_to<(m.effective_from at time zone'Africa/Casablanca')::date)
  or m.distribution_basis is distinct from'DISTRIBUTABLE_PROFIT'or e.distribution_basis is distinct from m.distribution_basis or r.distribution_basis is distinct from m.distribution_basis
  or (m.franchisee_share_bps,m.neoxa_share_bps,m.matricia_share_bps)is distinct from(e.franchisee_share_bps,e.neoxa_share_bps,e.matricia_share_bps)
  or (m.franchisee_share_bps,m.neoxa_share_bps,m.matricia_share_bps)is distinct from(r.franchisee_share_bps,r.neoxa_share_bps,r.asma_matricia_share_bps)
  or r.entry_fee_required is distinct from(m.entry_fee_minor>0)
  or(f.franchise_type='IT'and(f.operator_code<>'HATIM_AHMITECH'or m.entry_fee_minor<>0 or m.entry_fee_mode<>'EXEMPT'or m.entry_fee_term_months<>0 or(m.franchisee_share_bps,m.neoxa_share_bps,m.matricia_share_bps)is distinct from(5000,5000,0)))
  or(f.franchise_type='STANDARD'and(f.operator_code<>'FRANCHISEE'or m.entry_fee_minor<=0 or m.entry_fee_mode='EXEMPT'or(m.entry_fee_mode='UPFRONT'and m.entry_fee_term_months<>0)or(m.entry_fee_mode in('INSTALLMENT','REVENUE_WITHHOLDING')and m.entry_fee_term_months not between 1 and 6)))
 then raise exception'FRANCHISE_APPROVED_ECONOMIC_BASIS_REQUIRED'using errcode='55000';end if;
 return jsonb_build_object('franchise_id',f.id,'library_id',f.library_id,'organization_id',f.operator_organization_id,'franchise_type',f.franchise_type,'operator_code',f.operator_code,
  'approved_mandate',to_jsonb(m),'economic_rule',to_jsonb(e)-'status','finance_rule',to_jsonb(r)-'status','approval',decision);
end$$;
revoke all on function private.franchise_book_basis_source_v1(uuid,uuid,uuid)from public,anon,authenticated,service_role;

create function private.assert_franchise_book_binding_v1(p_book uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' as $$
declare b public.franchise_pnl_books%rowtype;binding public.franchise_pnl_book_bindings_v1%rowtype;source jsonb;
begin
 select*into b from public.franchise_pnl_books where id=p_book;
 select*into binding from public.franchise_pnl_book_bindings_v1 where book_id=b.id;
 if b.id is null or binding.book_id is null then raise exception'FRANCHISE_BOOK_BINDING_REVIEW_REQUIRED'using errcode='55000';end if;
 source:=private.franchise_book_basis_source_v1(binding.franchise_id,binding.approved_mandate_version_id,binding.finance_rule_version_id);
 if binding.basis_hash is distinct from private.canonical_request_hash(source)or binding.basis_snapshot is distinct from source
  or b.library_id is distinct from(source->>'library_id')::uuid or b.franchise_organization_id is distinct from(source->>'organization_id')::uuid
  or b.franchise_type is distinct from source->>'franchise_type'or b.operator_code is distinct from source->>'operator_code'
  or b.opened_under_rule_version_id is distinct from binding.finance_rule_version_id or b.currency is distinct from binding.currency
 then raise exception'FRANCHISE_BOOK_ECONOMIC_BASIS_MISMATCH'using errcode='55000';end if;
 return source||jsonb_build_object('book_id',b.id,'currency',b.currency,'basis_hash',binding.basis_hash);
end$$;
revoke all on function private.assert_franchise_book_binding_v1(uuid)from public,anon,authenticated,service_role;

create function private.guard_franchise_book_binding_source_v1()returns trigger
language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare source jsonb;book public.franchise_pnl_books%rowtype;
begin
 source:=private.franchise_book_basis_source_v1(new.franchise_id,new.approved_mandate_version_id,new.finance_rule_version_id);
 select*into book from public.franchise_pnl_books where id=new.book_id;
 if book.id is null or new.basis_hash is distinct from private.canonical_request_hash(source)or new.basis_snapshot is distinct from source
  or book.library_id is distinct from(source->>'library_id')::uuid or book.franchise_organization_id is distinct from(source->>'organization_id')::uuid
  or book.franchise_type is distinct from source->>'franchise_type'or book.operator_code is distinct from source->>'operator_code'
  or book.opened_under_rule_version_id is distinct from new.finance_rule_version_id or book.currency is distinct from new.currency
 then raise exception'FRANCHISE_BOOK_ECONOMIC_BASIS_MISMATCH'using errcode='55000';end if;
 return new;
end$$;
revoke all on function private.guard_franchise_book_binding_source_v1()from public,anon,authenticated,service_role;
create trigger franchise_book_binding_source_guard before insert on public.franchise_pnl_book_bindings_v1 for each row execute function private.guard_franchise_book_binding_source_v1();

create function public.open_franchise_pnl_book_for_mandate_v1(p_franchise_id uuid,p_approved_mandate_version_id uuid,p_expected_mandate_hash text,p_currency text,p_rule_version_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare actor uuid:=auth.uid();f public.franchises%rowtype;m public.franchise_mandate_versions%rowtype;book public.franchise_pnl_books%rowtype;source jsonb;h text;response jsonb;counted integer;new_book uuid:=extensions.gen_random_uuid();scope text;
begin
 if actor is null or private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],actor)is distinct from true or auth.jwt()->>'aal'is distinct from'aal2'then raise exception'FRANCHISE_BOOK_DENIED'using errcode='42501';end if;
 if p_currency is null or p_currency!~'^[A-Z]{3}$'or p_expected_mandate_hash is null or p_expected_mandate_hash!~'^[a-f0-9]{64}$'or length(coalesce(p_idempotency_key,''))not between 8 and 200 or p_correlation_id is null then raise exception'INVALID_FRANCHISE_BOOK'using errcode='22023';end if;
 source:=private.franchise_book_basis_source_v1(p_franchise_id,p_approved_mandate_version_id,p_rule_version_id);
 if source#>>'{approved_mandate,content_hash}'is distinct from p_expected_mandate_hash then raise exception'FRANCHISE_MANDATE_CHANGED'using errcode='40001';end if;
 select*into f from public.franchises where id=p_franchise_id;
 select*into m from public.franchise_mandate_versions where id=p_approved_mandate_version_id;
 perform pg_advisory_xact_lock(hashtextextended('franchise.book.open.'||f.id::text||':'||p_currency,0));
 scope:='franchise.book.open.for_mandate_v1.'||f.id::text;
 h:=private.canonical_request_hash(jsonb_build_object('basis',source,'currency',p_currency));
 response:=private.begin_contract_command(f.operator_organization_id,scope,p_idempotency_key,h,actor);if response is not null then return response;end if;
 select b.*into book from public.franchise_pnl_books b join public.franchise_pnl_book_bindings_v1 binding on binding.book_id=b.id
  where binding.franchise_id=f.id and binding.approved_mandate_version_id=m.id and binding.finance_rule_version_id=p_rule_version_id and binding.currency=p_currency;
 if book.id is null then
  -- No implicit migration of an inconsistent/ambiguous historical book.
  select count(*)into counted from public.franchise_pnl_books b where b.library_id=f.library_id and b.franchise_organization_id=f.operator_organization_id
   and not exists(select 1 from public.franchise_pnl_book_bindings_v1 binding where binding.book_id=b.id);
  if counted>1 then raise exception'FRANCHISE_LEGACY_BOOK_RECONCILIATION_REQUIRED'using errcode='55000';end if;
  if counted=1 then
   if(select count(distinct existing.id)from public.franchises existing join public.franchise_approval_requests approved on approved.franchise_id=existing.id and approved.status='APPROVED'where existing.library_id=f.library_id and existing.operator_organization_id=f.operator_organization_id)>1
    and exists(select 1 from public.franchise_pnl_entries entry join public.franchise_pnl_books legacy on legacy.id=entry.book_id where legacy.library_id=f.library_id and legacy.franchise_organization_id=f.operator_organization_id and not exists(select 1 from public.franchise_pnl_book_bindings_v1 binding where binding.book_id=legacy.id))
   then raise exception'FRANCHISE_LEGACY_BOOK_RECONCILIATION_REQUIRED'using errcode='55000';end if;
   select*into book from public.franchise_pnl_books b where b.library_id=f.library_id and b.franchise_organization_id=f.operator_organization_id
    and not exists(select 1 from public.franchise_pnl_book_bindings_v1 binding where binding.book_id=b.id);
   if book.franchise_type is distinct from f.franchise_type or book.operator_code is distinct from f.operator_code or book.currency is distinct from p_currency::char(3)or book.opened_under_rule_version_id is distinct from p_rule_version_id
    or exists(select 1 from public.franchise_profit_closure_versions c where c.book_id=book.id and c.rule_version_id<>p_rule_version_id)
    or exists(select 1 from public.franchise_pnl_entries e where e.book_id=book.id and(e.effective_on<(m.effective_from at time zone'Africa/Casablanca')::date or(m.effective_until is not null and e.effective_on>(m.effective_until at time zone'Africa/Casablanca')::date)))
   then raise exception'FRANCHISE_LEGACY_BOOK_RECONCILIATION_REQUIRED'using errcode='55000';end if;
  else
   if f.status not in('ENTRY_FEE_SETUP','LIBRARY_ASSIGNED','ACTIVE')or(m.effective_until is not null and m.effective_until<=clock_timestamp())or not exists(select 1 from public.organizations where id=f.operator_organization_id and status='ACTIVE')
    or not exists(select 1 from public.franchise_finance_rule_versions where id=p_rule_version_id and status='ACTIVE')
   then raise exception'FRANCHISE_CURRENT_MANDATE_REQUIRED_FOR_NEW_BOOK'using errcode='55000';end if;
   insert into public.franchise_pnl_books(id,library_id,franchise_organization_id,franchise_type,operator_code,currency,opened_under_rule_version_id,created_by)
    values(new_book,f.library_id,f.operator_organization_id,f.franchise_type,f.operator_code,p_currency,p_rule_version_id,actor)returning*into book;
  end if;
  insert into public.franchise_pnl_book_bindings_v1(book_id,franchise_id,approved_mandate_version_id,finance_rule_version_id,currency,basis_snapshot,basis_hash,created_by)
   values(book.id,f.id,m.id,p_rule_version_id,p_currency,source,private.canonical_request_hash(source),actor);
 end if;
 perform private.assert_franchise_book_binding_v1(book.id);
 response:=jsonb_build_object('outcome','FRANCHISE_PNL_BOOK_OPENED','book_id',book.id,'franchise_id',f.id,'approved_mandate_version_id',m.id,'basis_hash',private.canonical_request_hash(source));
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(f.operator_organization_id,actor,'USER','franchise.pnl_book.bound','franchise_pnl_book',book.id::text,p_correlation_id,response,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(f.operator_organization_id,'franchise_pnl_book',book.id::text,'FranchisePnlBookBoundV1',p_correlation_id,response,'franchise-book-binding:'||book.id::text||':'||p_idempotency_key);
 perform private.finish_contract_command(f.operator_organization_id,scope,p_idempotency_key,response);return response;
end$$;

create or replace function public.open_franchise_pnl_book(p_library_id uuid,p_franchise_organization_id uuid,p_franchise_type text,p_operator_code text,p_currency text,p_rule_version_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' as $$
declare candidate record;counted integer;
begin
 if auth.uid()is null or private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'])is distinct from true or auth.jwt()->>'aal'is distinct from'aal2'then raise exception'FRANCHISE_BOOK_DENIED'using errcode='42501';end if;
 select count(*)into counted from public.franchises f join public.franchise_approval_requests q on q.franchise_id=f.id and q.status='APPROVED'
  where f.library_id=p_library_id and f.operator_organization_id=p_franchise_organization_id;
 if counted<>1 then raise exception'FRANCHISE_BOOK_MANDATE_SELECTION_REQUIRED'using errcode='55000';end if;
 select f.id,f.franchise_type,f.operator_code,m.id mandate_id,m.content_hash into candidate from public.franchises f
  join public.franchise_approval_requests q on q.franchise_id=f.id and q.status='APPROVED'join public.franchise_mandate_versions m on m.id=q.mandate_version_id
  where f.library_id=p_library_id and f.operator_organization_id=p_franchise_organization_id;
 if candidate.franchise_type is distinct from p_franchise_type or candidate.operator_code is distinct from p_operator_code then raise exception'FRANCHISE_BOOK_ECONOMIC_BASIS_MISMATCH'using errcode='55000';end if;
 return public.open_franchise_pnl_book_for_mandate_v1(candidate.id,candidate.mandate_id,candidate.content_hash,p_currency,p_rule_version_id,p_idempotency_key,p_correlation_id);
end$$;
revoke all on function public.open_franchise_pnl_book_for_mandate_v1(uuid,uuid,text,text,uuid,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.open_franchise_pnl_book_for_mandate_v1(uuid,uuid,text,text,uuid,text,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
