-- Scope Client invoice commands to the organization explicitly selected in the UI.
begin;
create function public.list_client_billable_sources_v1(p_organization_id uuid,p_query text default '',p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result jsonb;
begin
 if not private.can_read_client_billing(p_organization_id)then raise exception'CLIENT_BILLING_READ_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 or length(coalesce(p_query,''))>200 then raise exception'INVALID_BILLING_PAGE'using errcode='22023';end if;
 with matched as(select p.*from public.subscription_payment_events p where p.organization_id=p_organization_id and(coalesce(p_query,'')=''or strpos(lower(p.payment_reference||' '||p.id::text),lower(p_query))>0)),page as(select*from matched order by paid_at desc,id desc offset(p_page-1)*20 limit 21)
 select jsonb_build_object('may_issue',private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'],auth.uid())or private.client_billing_admin(auth.uid()),'requires_mfa',coalesce(auth.jwt()->>'aal','')<>'aal2',
 'sources',coalesce((select jsonb_agg(jsonb_build_object('payment_event_id',p.id::text,'payment_reference',p.payment_reference,'amount_minor',p.amount_minor::text,'currency',p.currency,'gateway',p.gateway,'paid_at',p.paid_at,'invoice_id',(select d.id from public.client_commercial_documents d where d.payment_event_id=p.id and d.kind='INVOICE'),
 'adjustments',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'event_type',x.event_type,'amount_minor',x.amount_minor::text,'currency',x.currency,'occurred_at',x.occurred_at,'credit_note_id',(select d.id from public.client_commercial_documents d where d.adjustment_id=x.id))order by x.occurred_at,x.id)from public.subscription_payment_adjustments x where x.payment_event_id=p.id and x.event_type in('REFUND_SUCCEEDED','PAYMENT_REVERSED')),'[]'::jsonb))order by p.paid_at desc,p.id desc)from page p),'[]'::jsonb),'total',(select count(*)from matched))into result;
 return result;
end$$;
create function public.issue_scoped_client_commercial_document_v1(p_organization_id uuid,p_payment_event_id bigint,p_adjustment_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 if not private.can_read_client_billing(p_organization_id)or not exists(select 1 from public.subscription_payment_events p where p.id=p_payment_event_id and p.organization_id=p_organization_id)then raise exception'CLIENT_DOCUMENT_SOURCE_DENIED'using errcode='42501';end if;
 return public.issue_client_commercial_document_v1(p_payment_event_id,p_adjustment_id,p_idempotency_key,p_correlation_id);
end$$;
revoke all on function public.list_client_billable_sources_v1(uuid,text,integer),public.issue_scoped_client_commercial_document_v1(uuid,bigint,uuid,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.list_client_billable_sources_v1(uuid,text,integer),public.issue_scoped_client_commercial_document_v1(uuid,bigint,uuid,text,uuid)to authenticated;
commit;
