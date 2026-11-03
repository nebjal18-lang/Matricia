begin;
-- Opening a structural book is not evidence of a signed mandate. A real entry
-- debt requires its legal basis; non-production simulations are labelled by the
-- server, never by an unchecked form flag. Old schedules remain uncertified.
alter table public.franchise_entry_fee_schedules
 add column execution_mode text check(execution_mode in('CONTRACTUAL','NON_CONTRACTUAL_DEMO')),
 add column execution_environment text check(execution_environment in('DEVELOPMENT','STAGING','PRODUCTION')),
 add column legal_proof_hash text check(legal_proof_hash~'^[a-f0-9]{64}$'),
 add constraint franchise_entry_fee_execution_basis_check check(
  (execution_mode is null and execution_environment is null and legal_proof_hash is null)
  or(execution_mode='NON_CONTRACTUAL_DEMO'and execution_environment in('DEVELOPMENT','STAGING')and legal_proof_hash is null)
  or(execution_mode='CONTRACTUAL'and execution_environment is not null and legal_proof_hash is not null));
create function private.guard_franchise_entry_fee_legal_basis_v1()returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare source jsonb;environment text;evidence public.franchise_activation_evidence%rowtype;proof jsonb;
begin
 source:=private.assert_franchise_book_binding_v1(new.book_id);
 select e.environment into environment from private.admin_execution_environment_v1 e where e.singleton;
 if environment is null or environment not in('DEVELOPMENT','STAGING','PRODUCTION')then raise exception'FRANCHISE_FINANCIAL_ENVIRONMENT_REQUIRED'using errcode='55000';end if;
 select*into evidence from public.franchise_activation_evidence where franchise_id=(source->>'franchise_id')::uuid and approved_mandate_version_id=(source#>>'{approved_mandate,id}')::uuid;
 if evidence.activation_mode='CONTRACTUAL'then
  perform private.franchise_book_active_basis_v1(new.book_id);
  proof:=evidence.legal_proof_snapshot;
 else
  proof:=private.franchise_mandate_signature_reference_or_null((source->>'franchise_id')::uuid,(source#>>'{approved_mandate,id}')::uuid,source#>>'{approved_mandate,content_hash}',(source->>'organization_id')::uuid,auth.uid());
 end if;
 if jsonb_typeof(proof)='object'and proof<>'{}'::jsonb then
  new.execution_mode:='CONTRACTUAL';new.legal_proof_hash:=private.canonical_request_hash(proof);
 elsif environment in('DEVELOPMENT','STAGING')then
  new.execution_mode:='NON_CONTRACTUAL_DEMO';new.legal_proof_hash:=null;
 else raise exception'FRANCHISE_ENTRY_FEE_SIGNED_MANDATE_REQUIRED'using errcode='55000';end if;
 new.execution_environment:=environment;
 return new;
end$$;
revoke all on function private.guard_franchise_entry_fee_legal_basis_v1()from public,anon,authenticated,service_role;
create trigger franchise_entry_fee_execution_basis_guard before insert on public.franchise_entry_fee_schedules for each row execute function private.guard_franchise_entry_fee_legal_basis_v1();
-- Retain the bounded INVOKER snapshot and column grants; add no new read scope.
do $$declare definition text;old text:='x.id,x.book_id,x.mode,x.principal_minor::text as principal_minor,x.deposit_minor::text as deposit_minor,x.starts_on,x.due_on';begin
 definition:=pg_get_functiondef('public.franchise_governance_dashboard_snapshot(uuid)'::regprocedure);
 if strpos(definition,old)=0 then raise exception'FRANCHISE_ENTRY_FEE_SNAPSHOT_SOURCE_MISMATCH';end if;
 execute replace(definition,old,old||',x.execution_mode,x.execution_environment');
end$$;
commit;
