begin;

-- The absence of a binding must be evaluated outside the uploader's tenant
-- RLS. Losing membership must never turn immutable evidence into an orphan.
-- This function remains outside the exposed API schemas and answers only for
-- the caller's own object prefix, never for another uploader's path.
create function private.delivery_proof_storage_owner_unbound_v1(p_bucket text,p_path text)
returns boolean language sql stable security definer
set search_path=pg_catalog set row_security=off as $$
 select coalesce(
  p_bucket='delivery-proofs'
  and auth.uid()is not null
  and private.current_auth_session_active_v1()
  and split_part(p_path,'/',1)=auth.uid()::text
  and not exists(select 1 from public.delivery_proofs p where p.storage_bucket=p_bucket and p.storage_path=p_path),false)
$$;
revoke all on function private.delivery_proof_storage_owner_unbound_v1(text,text)from public,anon,authenticated,service_role;
grant execute on function private.delivery_proof_storage_owner_unbound_v1(text,text)to authenticated;

alter policy delivery_proof_storage_owner_unbound_read on storage.objects
using(private.delivery_proof_storage_owner_unbound_v1(bucket_id,name));
alter policy delivery_proof_storage_orphan_delete on storage.objects
using(private.delivery_proof_storage_owner_unbound_v1(bucket_id,name));

-- The native RI locks close both orders of the bind/delete race, including
-- when DELETE evaluated its RLS predicate before waiting for a binding commit.
-- Historical absent objects are not certified by this additive constraint;
-- every new binding and every deletion is nevertheless checked immediately.
create index delivery_proofs_storage_binding_v1_idx on public.delivery_proofs(storage_bucket,storage_path)where storage_path is not null;
alter table public.delivery_proofs add constraint delivery_proofs_storage_object_binding_v1
 foreign key(storage_bucket,storage_path)references storage.objects(bucket_id,name)on delete restrict not valid;

create or replace function private.bind_delivery_proof_storage()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_deliverable uuid;v_object uuid;begin
 select d.id into v_deliverable from public.delivery_versions v join public.deliverables d on d.id=v.deliverable_id where v.id=new.delivery_version_id;
 if new.storage_path is not null then
  if v_deliverable is null or new.storage_bucket<>'delivery-proofs'
   or split_part(new.storage_path,'/',1)is distinct from auth.uid()::text
   or split_part(new.storage_path,'/',2)is distinct from v_deliverable::text
  then raise exception'DELIVERY_PROOF_STORAGE_BINDING_REQUIRED'using errcode='22000';end if;
  select o.id into v_object from storage.objects o where o.bucket_id=new.storage_bucket and o.name=new.storage_path for key share;
  if v_object is null then raise exception'DELIVERY_PROOF_STORAGE_BINDING_REQUIRED'using errcode='22000';end if;
 elsif new.url is null or new.url!~'^https://'then
  raise exception'DELIVERY_PROOF_LOCATION_INVALID'using errcode='22023';
 end if;
 return new;
end$$;
revoke all on function private.bind_delivery_proof_storage()from public,anon,authenticated,service_role;

notify pgrst,'reload schema';
commit;
