begin;

-- Storage versioning removed the global (bucket_id, name) unique key. Bind
-- evidence to the native object identity instead; absent historical bytes
-- are deliberately not invented or certified by this migration.
create table private.delivery_storage_object_bindings_v1 (
 proof_id uuid primary key references public.delivery_proofs(id) on delete restrict,
 object_id uuid not null,
 constraint delivery_proofs_storage_object_binding_v1
   foreign key(object_id) references storage.objects(id) on delete restrict
);
create index delivery_storage_object_bindings_object_idx
 on private.delivery_storage_object_bindings_v1(object_id);
alter table private.delivery_storage_object_bindings_v1 enable row level security;
revoke all on private.delivery_storage_object_bindings_v1 from public,anon,authenticated,service_role;

insert into private.delivery_storage_object_bindings_v1(proof_id,object_id)
select p.id,o.id from public.delivery_proofs p join storage.objects o
 on o.bucket_id=p.storage_bucket and o.name=p.storage_path
where to_jsonb(o)->>'archived_at' is null
 and coalesce((to_jsonb(o)->>'is_delete_marker')::boolean,false)=false;

create function private.bind_delivery_storage_object_identity_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare object_id uuid;
begin
 if new.storage_path is null then return new;end if;
 select o.id into strict object_id from storage.objects o
 where o.bucket_id=new.storage_bucket and o.name=new.storage_path
 and to_jsonb(o)->>'archived_at' is null
 and coalesce((to_jsonb(o)->>'is_delete_marker')::boolean,false)=false
 for key share;
 insert into private.delivery_storage_object_bindings_v1(proof_id,object_id)
 values(new.id,object_id);
 return new;
exception when no_data_found then
 raise exception 'DELIVERY_PROOF_STORAGE_BINDING_REQUIRED' using errcode='23503';
end$$;
revoke all on function private.bind_delivery_storage_object_identity_v1() from public,anon,authenticated,service_role;
create trigger delivery_storage_object_identity_v1 after insert on public.delivery_proofs
 for each row execute function private.bind_delivery_storage_object_identity_v1();

-- Native FK locking protects bind/delete races. Also reject version rollover,
-- relocation and metadata replacement, which need not physically delete a row.
create function private.preserve_bound_delivery_storage_version_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if (to_jsonb(new)-array['updated_at','last_accessed_at']) is distinct from
    (to_jsonb(old)-array['updated_at','last_accessed_at'])
 and (exists(select 1 from private.delivery_storage_object_bindings_v1 b where b.object_id=old.id)
   or exists(select 1 from public.delivery_proofs p where p.storage_bucket=old.bucket_id and p.storage_path=old.name)) then
  raise exception 'delivery_proofs_storage_object_binding_v1' using errcode='23503';
 end if;
 return new;
end$$;
revoke all on function private.preserve_bound_delivery_storage_version_v1() from public,anon,authenticated,service_role;
create trigger preserve_bound_delivery_storage_version_v1 before update on storage.objects
 for each row execute function private.preserve_bound_delivery_storage_version_v1();

notify pgrst,'reload schema';
commit;
