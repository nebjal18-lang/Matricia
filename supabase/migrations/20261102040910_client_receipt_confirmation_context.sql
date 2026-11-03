begin;
-- Client confirmations retain the selected Client organisation and expose only
-- its own receipts. Read permission is distinct from authority to confirm a
-- declaration made by a company of which the actor is also a member.
create index provider_financial_declarations_client_v1_idx on public.provider_financial_declarations_v1(client_organization_id,declared_at desc,id)where kind='PAYABLE';
create function public.get_client_provider_receipts_v1(p_organization_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare declarations jsonb;decisions jsonb;
begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'],auth.uid())then raise exception'CLIENT_RECEIPTS_SCOPE_DENIED'using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('can_client_confirm',d.declared_by<>auth.uid()and not private.is_active_org_member(d.provider_organization_id,auth.uid()))order by d.declared_at desc,d.id),'[]')into declarations from public.provider_financial_declarations_v1 d where d.kind='PAYABLE'and d.client_organization_id=p_organization_id;
 select coalesce(jsonb_agg(to_jsonb(x)order by x.decided_at,x.id),'[]')into decisions from public.provider_financial_declaration_decisions_v1 x join public.provider_financial_declarations_v1 d on d.id=x.declaration_id where d.kind='PAYABLE'and d.client_organization_id=p_organization_id;
 return jsonb_build_object('organization_id',p_organization_id,'declarations',declarations,'decisions',decisions);
end$$;
revoke all on function public.get_client_provider_receipts_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_client_provider_receipts_v1(uuid)to authenticated;
-- Do not ask a conflicted counterparty member, or a Client who already decided,
-- to confirm again. Delivery deduplication still uses the immutable declaration.
do $migration$
declare definition text;needle text:=$needle$where d.kind='PAYABLE'and exists$needle$;
begin
 definition:=pg_get_functiondef('public.run_provider_billing_reminders_v1(integer)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception'CLIENT_RECEIPT_REMINDER_SCOPE_PATCH_MISSING';end if;
 execute replace(definition,needle,$patch$where d.kind='PAYABLE'and d.declared_by<>m.user_id and not private.is_active_org_member(d.provider_organization_id,m.user_id)and not exists(select 1 from public.provider_financial_declaration_decisions_v1 decided where decided.declaration_id=d.id and decided.decision in('CLIENT_CONFIRMED','CLIENT_CONTESTED','APPROVED','REJECTED'))and exists$patch$);
end $migration$;
notify pgrst,'reload schema';
commit;
