begin;
-- A command's child FK can hold KEY SHARE while it waits for the subscription
-- financial lock. Audit needs an exclusive *non-key* organization lock to seal
-- a chain, not an UPDATE lock conflicting with that FK. Keeping the shared
-- serializer here fixes the cycle for every producer without a retry bypass.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('private.seal_audit_event()'::regprocedure);
 needle:='perform 1 from public.organizations where id=new.organization_id for update;';
 if strpos(d,needle)=0 then raise exception'AUDIT_ORGANIZATION_LOCK_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'perform 1 from public.organizations where id=new.organization_id for no key update;');
 -- The identity default is evaluated before the BEFORE INSERT trigger can wait
 -- for its scope lock. Allocate the final identity *after* that lock so a delayed
 -- earlier writer cannot be skipped by the existing order-by-id chain reader.
 needle:='declare v_previous_hash text;';
 if strpos(d,needle)=0 then raise exception'AUDIT_CHAIN_DECLARATION_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'declare v_previous_hash text;v_previous_id bigint;');
 needle:='select event_hash into v_previous_hash from public.audit_events where organization_id=new.organization_id order by id desc limit 1;';
 if strpos(d,needle)=0 then raise exception'AUDIT_ORGANIZATION_CHAIN_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'new.id:=nextval(pg_get_serial_sequence(''public.audit_events'',''id'')::regclass); select id,event_hash into v_previous_id,v_previous_hash from public.audit_events where organization_id=new.organization_id order by id desc limit 1;');
 needle:='select event_hash into v_previous_hash from public.audit_events where organization_id is null order by id desc limit 1;';
 if strpos(d,needle)=0 then raise exception'AUDIT_PLATFORM_CHAIN_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'new.id:=nextval(pg_get_serial_sequence(''public.audit_events'',''id'')::regclass); select id,event_hash into v_previous_id,v_previous_hash from public.audit_events where organization_id is null order by id desc limit 1;');
 needle:='new.previous_hash:=v_previous_hash;';
 if strpos(d,needle)=0 then raise exception'AUDIT_PREVIOUS_HASH_SOURCE_MISMATCH';end if;
 d:=replace(d,needle,'if v_previous_id is not null and new.id<=v_previous_id then raise exception''AUDIT_SEQUENCE_REVIEW_REQUIRED''using errcode=''55000'';end if; '||needle);
 execute d;
end$$;
commit;
