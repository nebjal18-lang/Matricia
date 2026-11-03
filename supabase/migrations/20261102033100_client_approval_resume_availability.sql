begin;
-- Offer execution only when every linked decision is ready and the original
-- requester still has the relevant role. The command repeats all guards at POST.
create or replace function public.list_my_client_approval_command_states_v1(p_organization_id uuid,p_approval_ids uuid[])returns table(approval_request_id uuid,can_resume boolean,completed boolean)
language plpgsql stable security definer set search_path=pg_catalog,private as $$
begin
 if auth.uid()is null or not private.is_active_org_member(p_organization_id)then raise exception'CLIENT_APPROVAL_COMMANDS_DENIED'using errcode='42501';end if;
 if p_approval_ids is null or cardinality(p_approval_ids)not between 1 and 25 then raise exception'INVALID_CLIENT_APPROVAL_COMMANDS'using errcode='22023';end if;
 return query select q.id,
   q.status='APPROVED'and q.requested_by=auth.uid()and e.command_id is null
   and coalesce(case c.resource_type
     when'QUOTE_SELECTION'then private.has_org_role(c.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'])
     when'CONTRACT_GENERATION'then private.has_org_role(c.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'])
     else private.client_budget_manage(c.organization_id)end,false)
   and not exists(
     select 1 from private.client_approval_command_links_v1 other_link
     join public.business_approval_requests other_request on other_request.id=other_link.approval_request_id
     join public.business_approval_policy_versions policy on policy.id=other_request.policy_version_id
     where other_link.command_id=c.id and(other_request.status<>'APPROVED'or policy.status<>'ACTIVE'
       or other_request.requested_by<>c.requested_by or other_request.payload_hash<>c.payload_hash)
   ),e.command_id is not null
 from public.business_approval_requests q
 join private.client_approval_command_links_v1 link on link.approval_request_id=q.id
 join private.client_approval_commands_v1 c on c.id=link.command_id
 left join private.client_approval_command_executions_v1 e on e.command_id=c.id
 where q.organization_id=p_organization_id and q.id=any(p_approval_ids);
end$$;
revoke all on function public.list_my_client_approval_command_states_v1(uuid,uuid[])from public,anon,authenticated,service_role;
grant execute on function public.list_my_client_approval_command_states_v1(uuid,uuid[])to authenticated;
notify pgrst,'reload schema';
commit;
