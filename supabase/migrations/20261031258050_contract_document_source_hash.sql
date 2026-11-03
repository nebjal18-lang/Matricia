begin;
-- Historical integrity only. Current identity/financial/signature readiness is
-- checked by the commitment domain; a later change never rewrites a document.
create function private.recompute_contract_document_source_hash_v1(p_contract_version_id uuid)returns text language plpgsql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
declare v public.contract_versions%rowtype;parent public.contract_versions%rowtype;c public.contracts%rowtype;m public.selected_quote_contract_drafts_v1%rowtype;refresh public.selected_quote_contract_refreshes_v1%rowtype;proposal public.selected_quote_identity_proposals_v1%rowtype;client_value jsonb;provider_value jsonb;computed text;requested_hash text;begin
 select*into v from public.contract_versions where id=p_contract_version_id;
 if v.id is null then return null;end if;
 select*into c from public.contracts where id=v.contract_id;select*into m from public.selected_quote_contract_drafts_v1 where contract_id=c.id;
 if c.id is null or m.contract_id is null then return null;end if;
 loop
  if v.contract_id is distinct from c.id or v.selected_quote_version_id is distinct from m.quote_version_id or(select count(*)from public.contract_parties where contract_version_id=v.id)<>2 then return null;end if;
  select legal_snapshot into client_value from public.contract_parties where contract_version_id=v.id and party_role='CLIENT'and organization_id=c.client_organization_id;
  select legal_snapshot into provider_value from public.contract_parties where contract_version_id=v.id and party_role='PROVIDER'and organization_id=c.provider_organization_id;
  if client_value is null or provider_value is null then return null;end if;
  if not exists(select 1 from public.contract_policy_versions_v1 p join public.contract_policy_decisions_v1 d on d.policy_version_id=p.id and d.decision='APPROVE'and d.content_hash=p.content_hash and d.decided_by<>p.created_by where p.id=m.template_policy_version_id and p.kind='TEMPLATE'and p.content_hash=v.clauses->>'template_content_hash'and p.id::text=v.clauses->>'template_policy_version_id')or not exists(select 1 from public.contract_policy_versions_v1 p join public.contract_policy_decisions_v1 d on d.policy_version_id=p.id and d.decision='APPROVE'and d.content_hash=p.content_hash and d.decided_by<>p.created_by where p.id=m.commission_policy_version_id and p.kind='COMMISSION'and p.content_hash=v.commission_rule_snapshot->>'content_hash'and p.id::text=v.commission_rule_snapshot->>'policy_version_id')then return null;end if;
  select*into refresh from public.selected_quote_contract_refreshes_v1 where contract_version_id=v.id;
  if refresh.id is null then
   if v.id is distinct from m.contract_version_id or v.version<>1 or m.source_hash is distinct from v.content_hash then return null;end if;
   computed:=private.canonical_request_hash(jsonb_build_object('request',v.request_snapshot,'quote',v.quote_snapshot,'clauses',v.clauses,'commission',v.commission_rule_snapshot,'client_party',client_value,'provider_party',provider_value,'price_minor',v.price_minor::text,'currency',v.currency));
   if computed is distinct from v.content_hash then return null;end if;
   return coalesce(requested_hash,computed);
  end if;
  select*into parent from public.contract_versions where id=refresh.previous_version_id;
  if refresh.contract_id is distinct from c.id or refresh.source_hash is distinct from v.content_hash or parent.id is null or parent.contract_id is distinct from c.id or parent.version<>v.version-1 or parent.selected_quote_version_id is distinct from v.selected_quote_version_id or parent.price_minor is distinct from v.price_minor or parent.currency is distinct from v.currency or parent.request_snapshot is distinct from v.request_snapshot or parent.quote_snapshot is distinct from v.quote_snapshot or parent.clauses is distinct from v.clauses or parent.commission_rule_snapshot is distinct from v.commission_rule_snapshot then return null;end if;
  if(select coalesce(jsonb_agg(to_jsonb(i)-'id'-'contract_version_id'order by item_key),'[]')from public.contract_items i where contract_version_id=v.id)is distinct from(select coalesce(jsonb_agg(to_jsonb(i)-'id'-'contract_version_id'order by item_key),'[]')from public.contract_items i where contract_version_id=parent.id)then return null;end if;
  if refresh.identity_reconfirmation_id is not null then
   select*into proposal from public.selected_quote_identity_proposals_v1 where id=refresh.identity_reconfirmation_id;
   if proposal.id is null or proposal.quote_version_id is distinct from v.selected_quote_version_id or proposal.client_organization_id is distinct from c.client_organization_id or proposal.provider_organization_id is distinct from c.provider_organization_id or proposal.context_hash is distinct from refresh.context_hash or proposal.client_party is distinct from client_value or proposal.provider_party is distinct from provider_value or proposal.content_hash is distinct from private.canonical_request_hash(jsonb_build_object('context_hash',proposal.context_hash,'client_party',proposal.client_party,'provider_party',proposal.provider_party,'reason',proposal.reason,'proposed_by',proposal.proposed_by))or not exists(select 1 from public.selected_quote_identity_responses_v1 r where r.proposal_id=proposal.id and r.decision='ACCEPT'and r.content_hash=proposal.content_hash and r.responded_by<>proposal.proposed_by and r.responded_at<=refresh.created_at)then return null;end if;
  elsif provider_value is distinct from private.provider_quote_identity_snapshot_v1(v.selected_quote_version_id)then return null;end if;
  computed:=private.canonical_request_hash(jsonb_build_object('previous_contract_version_id',parent.id,'previous_content_hash',parent.content_hash,'request',v.request_snapshot,'quote',v.quote_snapshot,'clauses',v.clauses,'commission',v.commission_rule_snapshot,'client_party',client_value,'provider_party',provider_value,'price_minor',v.price_minor::text,'currency',v.currency,'identity_reconfirmation_id',refresh.identity_reconfirmation_id));
  if computed is distinct from v.content_hash then return null;end if;
  requested_hash:=coalesce(requested_hash,computed);v:=parent;
 end loop;
end$$;
revoke all on function private.recompute_contract_document_source_hash_v1(uuid)from public,anon,authenticated,service_role;
commit;
