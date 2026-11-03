begin;
-- The reservation can wait for FEFO lots after its admission. Validate once
-- again at the actual ledger RESERVE, when all allocation locks have completed.
-- RELEASE, consumption and authorized cached responses do not enter this path.
-- Keep exact authorized retries available after their original deadline. A new
-- request still validates the current deadline before inserting its redemption.
do $$declare definition text;early text;cached text;begin
 select pg_get_functiondef('public.reserve_benefit_credits(uuid,uuid,uuid,bigint,timestamptz,text,uuid)'::regprocedure)into definition;
 early:='if p_units<=0 or p_reservation_expires_at<=clock_timestamp()then raise exception''INVALID_CREDIT_RESERVATION''using errcode=''22023'';end if;';
 cached:='if r is not null then return r;end if;insert into public.benefit_redemptions';
 if strpos(definition,early)=0 or strpos(definition,cached)=0 then raise exception'BENEFIT_FINAL_DEADLINE_PATCH_SOURCE_MISMATCH';end if;
 definition:=replace(definition,early,'if p_units is null or p_units<=0 or p_reservation_expires_at is null then raise exception''INVALID_CREDIT_RESERVATION''using errcode=''22023'';end if;');
 definition:=replace(definition,cached,'if r is not null then return r;end if;if p_reservation_expires_at<=clock_timestamp()then raise exception''INVALID_CREDIT_RESERVATION''using errcode=''22023'';end if;insert into public.benefit_redemptions');
 execute definition;
end$$;
create function private.finalize_benefit_credit_reservation_v1()returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
declare r public.benefit_redemptions%rowtype;a public.benefit_redemption_admissions_v1%rowtype;current_state jsonb;
begin
 if new.entry_type<>'RESERVE'or new.reference_type is distinct from'BENEFIT_REDEMPTION'then return new;end if;
 select*into r from public.benefit_redemptions where id=new.reference_id::uuid and organization_id=new.organization_id and wallet_id=new.wallet_id;
 select*into a from public.benefit_redemption_admissions_v1 where redemption_id=r.id;
 if r.id is null or a.redemption_id is null or r.status<>'RESERVED'or new.quantity::numeric is distinct from-r.reserved_credits::numeric or new.created_by is distinct from auth.uid()then
  raise exception'BENEFIT_RESERVATION_ADMISSION_REQUIRED'using errcode='55000';
 end if;
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.credits_client_access(r.organization_id)
  or not exists(select 1 from public.organizations o where o.id=r.organization_id and o.status='ACTIVE')then
  raise exception'BENEFIT_ADMISSION_AAL2_REQUIRED'using errcode='42501';
 end if;
 if r.reservation_expires_at<=clock_timestamp()then raise exception'BENEFIT_RESERVATION_EXPIRED'using errcode='55000';end if;
 if not private.subscription_financially_clear(r.organization_id)then raise exception'SUBSCRIPTION_FINANCIAL_HOLD'using errcode='55000';end if;
 if not private.client_identity_allows_new_operations(r.organization_id)then raise exception'CLIENT_IDENTITY_REVIEW_REQUIRED'using errcode='55000';end if;
 current_state:=private.benefit_admission_status_v1(r.organization_id,r.benefit_version_id,r.units,clock_timestamp(),r.id);
 if(current_state->>'admissible')::boolean is distinct from true then raise exception'%',current_state->>'blocked_reason'using errcode='55000';end if;
 if current_state->>'policy_id'is distinct from a.policy_id::text or current_state->>'policy_hash'is distinct from a.policy_hash
  or current_state->>'source_hash'is distinct from a.source_hash
  or current_state->>'subscription_cycle_id'is distinct from a.subscription_cycle_id::text then
  raise exception'STALE_BENEFIT_RESERVATION_ADMISSION'using errcode='40001';
 end if;
 if(select coalesce(sum(m.quantity),0)from public.credit_lot_movements m where m.redemption_id=r.id and m.organization_id=r.organization_id and m.movement_type='RESERVE')is distinct from r.reserved_credits::numeric
  or exists(select 1 from public.credit_ledger_entries old_entry where old_entry.id<>new.id and old_entry.organization_id=r.organization_id and old_entry.wallet_id=r.wallet_id and old_entry.entry_type='RESERVE'and old_entry.reference_type='BENEFIT_REDEMPTION'and old_entry.reference_id=r.id::text)then
  raise exception'BENEFIT_RESERVATION_ALLOCATION_MISMATCH'using errcode='23514';
 end if;
 return new;
end$$;
create trigger benefit_reserve_final_allocation_guard after insert on public.credit_ledger_entries
for each row execute function private.finalize_benefit_credit_reservation_v1();
revoke all on function private.finalize_benefit_credit_reservation_v1()from public,anon,authenticated,service_role;
commit;
