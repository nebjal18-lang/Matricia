begin;
-- Only the approved retention transaction can replace message content. All
-- authorship, dates, command keys and normal append-only guarantees remain.
create table private.assistance_retention_write_capabilities_v1(backend_pid integer not null,transaction_id bigint not null,request_id uuid not null references public.client_assistance_requests(id),primary key(backend_pid,transaction_id,request_id));
revoke all on private.assistance_retention_write_capabilities_v1 from public,anon,authenticated,service_role;
create function private.guard_assistance_message_retention_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if tg_op='UPDATE'and new.body='[Contenu effacé]'and(to_jsonb(new)-'body')=(to_jsonb(old)-'body')and exists(select 1 from private.assistance_retention_write_capabilities_v1 where backend_pid=pg_backend_pid()and transaction_id=txid_current()and request_id=old.request_id)then return new;end if;
 raise exception'CLIENT_HISTORY_IMMUTABLE'using errcode='55000';
end$$;
revoke all on function private.guard_assistance_message_retention_v1()from public,anon,authenticated,service_role;
drop trigger client_assistance_message_immutable on public.client_assistance_messages;
create trigger client_assistance_message_immutable before update or delete on public.client_assistance_messages for each row execute function private.guard_assistance_message_retention_v1();
do $$declare definition text;begin
 select pg_get_functiondef('private.execute_admin_privacy_retention_v1(uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'update public.client_assistance_messages m set body=')=0 then raise exception'RETENTION_IMMUTABILITY_PATCH_TARGET_NOT_FOUND';end if;
 definition:=replace(definition,'update public.client_assistance_messages m set body=', 'insert into private.assistance_retention_write_capabilities_v1(backend_pid,transaction_id,request_id) select pg_backend_pid(),txid_current(),id from public.client_assistance_requests where organization_id=a.organization_id and created_by=target_user; update public.client_assistance_messages m set body=');
 definition:=replace(definition,'else raise exception''PRIVACY_RETENTION_TARGET_NOT_ALLOWLISTED''', 'delete from private.assistance_retention_write_capabilities_v1 where backend_pid=pg_backend_pid() and transaction_id=txid_current(); else raise exception''PRIVACY_RETENTION_TARGET_NOT_ALLOWLISTED''');
 execute definition;
end$$;
commit;
