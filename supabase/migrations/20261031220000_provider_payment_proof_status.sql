-- Read only the current actor's reserved proof; never expose an object URL or a scan override.
create or replace function public.get_my_provider_payment_proof_status(p_provider_organization_id uuid,p_sha256 text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare u public.provider_payment_proof_uploads%rowtype;
begin
 if auth.uid() is null or not coalesce(private.has_org_role(p_provider_organization_id,array['PROVIDER_OWNER','PROVIDER_ACCOUNTING'],auth.uid()) or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','FINANCE_MANAGER'],auth.uid()),false) then raise exception 'PROVIDER_PAYMENT_PROOF_DENIED' using errcode='42501'; end if;
 select * into u from public.provider_payment_proof_uploads where provider_organization_id=p_provider_organization_id and actor_user_id=auth.uid() and declared_sha256=p_sha256 order by created_at desc,id desc limit 1;
 if not found then raise exception 'PAYMENT_PROOF_UPLOAD_REQUIRED' using errcode='P0002';end if;
 return jsonb_build_object('scan_status',u.scan_status,'expired',u.expires_at<=clock_timestamp(),'bound',u.status='BOUND');
end$$;
revoke all on function public.get_my_provider_payment_proof_status(uuid,text) from public,anon,service_role;
grant execute on function public.get_my_provider_payment_proof_status(uuid,text) to authenticated;
