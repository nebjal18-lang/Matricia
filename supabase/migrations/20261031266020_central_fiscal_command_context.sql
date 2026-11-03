-- Platform fiscal governance has its own actor command namespace. No tenant UUID
-- is synthesized and no membership is inferred from the first visible account.
create table private.platform_tax_command_keys(
 actor_user_id uuid not null references auth.users(id),operation_scope text not null check(operation_scope~'^morocco[.]tax[.]rule[.][a-z0-9_.-]{2,99}$'),key text not null check(length(key)between 8 and 200),request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),status text not null check(status in('PROCESSING','COMPLETED')),response_body jsonb,created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,primary key(actor_user_id,operation_scope,key),check((status='COMPLETED')=(response_body is not null and completed_at is not null))
);
alter table private.platform_tax_command_keys enable row level security;
revoke all on private.platform_tax_command_keys from public,anon,authenticated,service_role;
create function private.guard_platform_tax_command_key_v1()returns trigger language plpgsql set search_path=pg_catalog,private as $$begin
 if tg_op='DELETE'then raise exception'PLATFORM_TAX_COMMAND_IMMUTABLE'using errcode='55000';end if;
 if old.status<>'PROCESSING'or new.status<>'COMPLETED'or new.actor_user_id is distinct from old.actor_user_id or new.operation_scope is distinct from old.operation_scope or new.key is distinct from old.key or new.request_hash is distinct from old.request_hash or new.created_at is distinct from old.created_at then raise exception'PLATFORM_TAX_COMMAND_IMMUTABLE'using errcode='55000';end if;return new;
end$$;
create trigger platform_tax_command_key_immutable before update or delete on private.platform_tax_command_keys for each row execute function private.guard_platform_tax_command_key_v1();
create function private.begin_fiscal_command_v1(p_organization_id uuid,p_scope text,p_key text,p_hash text,p_actor uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$declare prior private.platform_tax_command_keys%rowtype;begin
 if not coalesce(private.morocco_tax_admin(p_actor),false)then raise exception'MOROCCO_TAX_ADMIN_AAL2_REQUIRED'using errcode='42501';end if;
 if p_organization_id is not null then return private.begin_contract_command(p_organization_id,p_scope,p_key,p_hash,p_actor);end if;
 if p_scope is null or p_scope!~'^morocco[.]tax[.]rule[.][a-z0-9_.-]{2,99}$'or p_key is null or length(p_key)not between 8 and 200 or p_hash is null or p_hash!~'^[0-9a-f]{64}$'then raise exception'INVALID_FISCAL_COMMAND'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('platform-tax:'||p_actor::text||':'||p_scope||':'||p_key,0));
 select*into prior from private.platform_tax_command_keys where actor_user_id=p_actor and operation_scope=p_scope and key=p_key;
 if found then
  if prior.request_hash is distinct from p_hash then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;
  if prior.status='COMPLETED'then return prior.response_body;end if;
  raise exception'IDEMPOTENCY_IN_PROGRESS'using errcode='55000';
 end if;
 insert into private.platform_tax_command_keys(actor_user_id,operation_scope,key,request_hash,status)values(p_actor,p_scope,p_key,p_hash,'PROCESSING');return null;
end$$;
create function private.finish_fiscal_command_v1(p_organization_id uuid,p_scope text,p_key text,p_response jsonb)returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$begin
 if not coalesce(private.morocco_tax_admin(auth.uid()),false)then raise exception'MOROCCO_TAX_ADMIN_AAL2_REQUIRED'using errcode='42501';end if;
 if p_organization_id is not null then perform private.finish_contract_command(p_organization_id,p_scope,p_key,p_response);return;end if;
 update private.platform_tax_command_keys set status='COMPLETED',response_body=p_response,completed_at=clock_timestamp()where actor_user_id=auth.uid()and operation_scope=p_scope and key=p_key and status='PROCESSING';
 if not found then raise exception'FISCAL_COMMAND_NOT_RESERVED'using errcode='55000';end if;
end$$;
revoke all on function private.guard_platform_tax_command_key_v1(),private.begin_fiscal_command_v1(uuid,text,text,text,uuid),private.finish_fiscal_command_v1(uuid,text,text,jsonb)from public,anon,authenticated,service_role;
-- One role boundary for catalogue fiscal reading, simulation and both command scopes.
create or replace function private.morocco_tax_admin(p_actor uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select p_actor is not null and p_actor=auth.uid()and private.has_platform_role(array['SUPER_ADMIN','FINANCE_MANAGER'],p_actor)and coalesce(auth.jwt()->>'aal','')='aal2'$$;
-- Change only context admission/idempotence plumbing in the existing calculation
-- governance. Validation, professional reference, four eyes, audit and outbox stay shared.
do $$declare definition text;oid regprocedure;marker text;begin
 foreach oid in array array['public.propose_morocco_tax_rule(uuid,text,text,integer,integer,jsonb,text,date,date,text,text,uuid)'::regprocedure,'public.decide_morocco_tax_rule(uuid,uuid,text,text,text,text,integer,text,uuid)'::regprocedure]loop
  definition:=pg_get_functiondef(oid);
  marker:='or not private.is_active_org_member(p_audit_organization_id,a)';
  if position(marker in definition)=0 or position('private.begin_contract_command('in definition)=0 or position('private.finish_contract_command('in definition)=0 then raise exception'CENTRAL_FISCAL_CONTEXT_PATCH_SOURCE_MISMATCH';end if;
  definition:=replace(definition,marker,'or(p_audit_organization_id is not null and not private.is_active_org_member(p_audit_organization_id,a))');
  definition:=replace(definition,'private.begin_contract_command(','private.begin_fiscal_command_v1(');
  definition:=replace(definition,'private.finish_contract_command(','private.finish_fiscal_command_v1(');
  -- Preserve null-safe CAS for both scopes.
  definition:=replace(definition,'x.row_version<>p_expected_row_version','x.row_version is distinct from p_expected_row_version');
  execute definition;
 end loop;
end$$;
create function public.get_morocco_tax_context_v1()returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$begin
 if not coalesce(private.morocco_tax_admin(auth.uid()),false)then raise exception'MOROCCO_TAX_ADMIN_AAL2_REQUIRED'using errcode='42501';end if;
 return jsonb_build_object('kind','PLATFORM');
end$$;
revoke all on function public.get_morocco_tax_context_v1()from public,anon,authenticated,service_role;
grant execute on function public.get_morocco_tax_context_v1()to authenticated;
notify pgrst,'reload schema';
