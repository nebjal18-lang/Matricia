-- Intervention capabilities are declared facts, distinct from capacity and region.
alter table public.provider_match_profiles add column intervention_modes text[] not null default'{}'check(intervention_modes<@array['ONSITE','REMOTE','HYBRID']::text[]and array_position(intervention_modes,null)is null);
create table public.provider_intervention_mode_versions(
 id uuid primary key default extensions.gen_random_uuid(),provider_organization_id uuid not null references public.provider_match_profiles(provider_organization_id),
 version_number integer not null check(version_number>0),modes text[] not null check(cardinality(modes)between 1 and 3 and modes<@array['ONSITE','REMOTE','HYBRID']::text[]and array_position(modes,null)is null),
 reason text not null check(length(btrim(reason))between 3 and 500),declared_by uuid not null references auth.users(id),declared_at timestamptz not null default clock_timestamp(),
 idempotency_key uuid not null,request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),unique(provider_organization_id,version_number),unique(provider_organization_id,idempotency_key)
);
alter table public.provider_intervention_mode_versions enable row level security;
revoke all on public.provider_intervention_mode_versions from public,anon,authenticated,service_role;
grant select on public.provider_intervention_mode_versions to authenticated;
create policy provider_intervention_modes_read on public.provider_intervention_mode_versions for select to authenticated using(private.is_active_org_member(provider_organization_id,auth.uid())or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','COMPLIANCE_MANAGER','READ_ONLY_AUDITOR'],auth.uid()));
create trigger provider_intervention_modes_immutable before update or delete on public.provider_intervention_mode_versions for each row execute function private.prevent_update_delete();
create function public.declare_provider_intervention_modes(p_provider_organization_id uuid,p_modes text[],p_reason text,p_expected_version integer,p_idempotency_key uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare codes text[];h text;r public.provider_intervention_mode_versions%rowtype;latest integer;response jsonb;
begin
 if not private.can_manage_provider(p_provider_organization_id,auth.uid())then raise exception'PROVIDER_INTERVENTION_SCOPE_DENIED'using errcode='42501';end if;
 select array_agg(distinct upper(btrim(value))order by upper(btrim(value)))into codes from unnest(p_modes)value;
 if codes is null or cardinality(codes)not between 1 and 3 or not(codes<@array['ONSITE','REMOTE','HYBRID']::text[])or array_position(codes,null)is not null or p_expected_version is null or p_expected_version<0 or p_idempotency_key is null or length(btrim(coalesce(p_reason,'')))not between 3 and 500 then raise exception'INVALID_PROVIDER_INTERVENTION_MODES'using errcode='22023';end if;
 if not exists(select 1 from public.provider_match_profiles where provider_organization_id=p_provider_organization_id)then raise exception'PROVIDER_PROFILE_REQUIRED'using errcode='23514';end if;
 h:=private.canonical_request_hash(jsonb_build_object('org',p_provider_organization_id,'actor',auth.uid(),'modes',codes,'reason',btrim(p_reason),'expected',p_expected_version));
 perform pg_advisory_xact_lock(hashtextextended('provider-intervention-modes:'||p_provider_organization_id::text,0));
 select*into r from public.provider_intervention_mode_versions where provider_organization_id=p_provider_organization_id and idempotency_key=p_idempotency_key;
 if found then if r.request_hash<>h then raise exception'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return jsonb_build_object('outcome','PROVIDER_INTERVENTION_MODES_DECLARED','command_id',r.id,'version_number',r.version_number);end if;
 select coalesce(max(version_number),0)into latest from public.provider_intervention_mode_versions where provider_organization_id=p_provider_organization_id;
 if latest<>p_expected_version then raise exception'PROVIDER_INTERVENTION_VERSION_CONFLICT'using errcode='40001';end if;
 insert into public.provider_intervention_mode_versions(provider_organization_id,version_number,modes,reason,declared_by,idempotency_key,request_hash)values(p_provider_organization_id,latest+1,codes,btrim(p_reason),auth.uid(),p_idempotency_key,h)returning*into r;
 update public.provider_match_profiles set intervention_modes=codes,row_version=row_version+1,updated_at=clock_timestamp()where provider_organization_id=p_provider_organization_id;
 response:=jsonb_build_object('outcome','PROVIDER_INTERVENTION_MODES_DECLARED','command_id',r.id,'version_number',r.version_number);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_provider_organization_id,auth.uid(),'USER','provider.intervention_modes.declared','provider_intervention_mode_version',r.id::text,p_correlation_id,jsonb_build_object('version',r.version_number,'modes',codes),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_provider_organization_id,'provider_intervention_mode_version',r.id::text,'ProviderInterventionModesDeclaredV1',p_correlation_id,jsonb_build_object('version_id',r.id,'version_number',r.version_number),'provider-intervention-modes:'||r.id::text);
 return response;
end$$;
revoke all on function public.declare_provider_intervention_modes(uuid,text[],text,integer,uuid,uuid)from public,anon,service_role;
grant execute on function public.declare_provider_intervention_modes(uuid,text[],text,integer,uuid,uuid)to authenticated;
create function private.provider_intervention_mode_matches(p_org uuid,p_data jsonb)returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce(p_data->>'intervention_mode','')=''or(coalesce(p_data->>'intervention_mode','')in('ONSITE','REMOTE','HYBRID')and exists(select 1 from public.provider_intervention_mode_versions v where v.provider_organization_id=p_org and v.version_number=(select max(version_number)from public.provider_intervention_mode_versions where provider_organization_id=p_org)and p_data->>'intervention_mode'=any(v.modes)))
$$;
create function private.enforce_matching_intervention_mode()returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare data jsonb;version uuid;
begin
 select request_version.required_quote_data into data from public.matching_runs run join public.service_request_versions request_version on request_version.id=run.request_version_id where run.id=new.matching_run_id;
 select id into version from public.provider_intervention_mode_versions where provider_organization_id=new.provider_organization_id order by version_number desc limit 1;
 if not private.provider_intervention_mode_matches(new.provider_organization_id,data)then new.eligible:=false;new.exclusion_reasons:=array_append(new.exclusion_reasons,'INTERVENTION_MODE_MISMATCH');end if;
 new.score_explanation:=new.score_explanation||jsonb_build_object('required_intervention_mode',data->>'intervention_mode','provider_intervention_mode_version_id',version,'exclusion_reasons',to_jsonb(new.exclusion_reasons));return new;
end$$;
create trigger matching_candidate_intervention_mode before insert on public.matching_candidates for each row execute function private.enforce_matching_intervention_mode();
create function private.enforce_invitation_intervention_mode()returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare data jsonb;
begin
 select v.required_quote_data into data from public.rfqs rfq join public.service_requests r on r.id=rfq.request_id join public.service_request_versions v on v.id=r.current_version_id where rfq.id=new.rfq_id;
 if not private.provider_intervention_mode_matches(new.provider_organization_id,data)then raise exception'RFQ_INTERVENTION_MODE_MISMATCH'using errcode='23514';end if;return new;
end$$;
create trigger rfq_provider_intervention_mode before insert on public.rfq_providers for each row execute function private.enforce_invitation_intervention_mode();
revoke all on function private.provider_intervention_mode_matches(uuid,jsonb),private.enforce_matching_intervention_mode(),private.enforce_invitation_intervention_mode()from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
