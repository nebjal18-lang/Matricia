begin;
-- Published terms only; no new access to internal pack drafts or economic policies.
create function public.get_client_credit_pack_catalogue_v1(p_organization_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result jsonb;begin
 if auth.uid()is null or not private.subscription_read_access(p_organization_id,auth.uid())then raise exception'CREDIT_PACK_READ_DENIED'using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name_fr',v.name_fr,'name_ar',v.name_ar,'quantity',v.quantity::text,'price_minor',v.price_minor::text,'currency',v.currency,'validity_days',v.validity_days,
  'pending',q.id is not null,'attempt_key',case when q.actor_id=auth.uid()then q.idempotency_key else null end,'payment_intent_id',i.id)order by v.price_minor,v.id),'[]'::jsonb)into result
 from public.credit_pack_versions v join public.credit_pack_definitions d on d.id=v.pack_id
 left join lateral(select p.* from public.credit_pack_payment_preparations_v1 p where p.organization_id=p_organization_id and p.pack_version_id=v.id
  and not exists(select 1 from public.credit_pack_payment_intents_v1 x join public.credit_pack_payment_events_v1 e on e.payment_intent_id=x.id where x.preparation_id=p.id)
  and not(exists(select 1 from public.credit_pack_native_resolutions_v1 r where r.preparation_id=p.id and r.native_status='VOIDED')and not exists(select 1 from public.credit_pack_native_resolutions_v1 r where r.preparation_id=p.id and r.native_status='COMPLETED'))
  order by p.created_at desc,p.id limit 1)q on true
 left join public.credit_pack_payment_intents_v1 i on i.preparation_id=q.id
 where v.price_minor>0 and((v.status='ACTIVE'and d.status='ACTIVE'and d.current_version=v.version)or q.id is not null);
 return jsonb_build_object('can_purchase',private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid()),'packs',result);
end$$;
create function public.get_client_credit_pack_payment_status_v1(p_organization_id uuid,p_payment_intent_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare i public.credit_pack_payment_intents_v1%rowtype;status text;begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'],auth.uid())then raise exception'CREDIT_PACK_PAYMENT_STATUS_DENIED'using errcode='42501';end if;
 select*into i from public.credit_pack_payment_intents_v1 where id=p_payment_intent_id and organization_id=p_organization_id;
 if not found then raise exception'CREDIT_PACK_PAYMENT_STATUS_DENIED'using errcode='42501';end if;
 if exists(select 1 from public.credit_pack_payment_events_v1 e where e.payment_intent_id=i.id and e.organization_id=p_organization_id and private.credit_pack_payment_source_v1(e.id)is not null)then status:='CONFIRMED';
 elsif exists(select 1 from private.credit_pack_capture_attempts_v1 a where a.payment_intent_id=i.id)then status:='PENDING_WEBHOOK';else status:='REQUIRES_CONFIRMATION';end if;
 return jsonb_build_object('paymentIntentId',i.id,'status',status);
end$$;
revoke all on function public.get_client_credit_pack_catalogue_v1(uuid),public.get_client_credit_pack_payment_status_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_client_credit_pack_catalogue_v1(uuid),public.get_client_credit_pack_payment_status_v1(uuid,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
