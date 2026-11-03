begin;
-- Provider facts are declarations for human qualification, never approved rules.
create table public.provider_work_scope_versions(
 id uuid primary key default extensions.gen_random_uuid(),provider_organization_id uuid not null references public.provider_profiles(provider_organization_id),version_number integer not null check(version_number>0),
 intervention_radius_km integer check(intervention_radius_km>=0),mission_size_summary text not null check(length(btrim(mission_size_summary))between 3 and 1000),reason text not null check(length(btrim(reason))between 3 and 500),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),operation_key uuid not null,request_hash text not null check(request_hash~'^[0-9a-f]{64}$'),response_body jsonb not null,
 unique(provider_organization_id,version_number),unique(provider_organization_id,operation_key)
);
alter table public.provider_work_scope_versions enable row level security;
revoke all on public.provider_work_scope_versions from public,anon,authenticated,service_role;
grant select on public.provider_work_scope_versions to authenticated;
create policy provider_work_scope_read on public.provider_work_scope_versions for select to authenticated using(private.is_active_org_member(provider_organization_id,auth.uid())or private.can_decide_provider_qualification(auth.uid()));
create trigger provider_work_scope_immutable before update or delete on public.provider_work_scope_versions for each row execute function private.prevent_update_delete();
create function public.declare_provider_work_scope_v1(p_provider_organization_id uuid,p_intervention_radius_km integer,p_mission_size_summary text,p_expected_version integer,p_reason text,p_operation_key uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare current_version integer;prior public.provider_work_scope_versions%rowtype;h text;r jsonb;identifier uuid:=extensions.gen_random_uuid();correlation uuid:=extensions.gen_random_uuid();
begin
 if not private.can_manage_provider(p_provider_organization_id,auth.uid())then raise exception 'PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 if p_operation_key is null or p_expected_version is null or p_expected_version<0 or p_intervention_radius_km<0 or length(btrim(coalesce(p_mission_size_summary,'')))not between 3 and 1000 or length(btrim(coalesce(p_reason,'')))not between 3 and 500 then raise exception 'INVALID_PROVIDER_WORK_SCOPE'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('organization',p_provider_organization_id,'radius',p_intervention_radius_km,'mission_size',btrim(p_mission_size_summary),'expected',p_expected_version,'reason',btrim(p_reason),'actor',auth.uid()));
 perform pg_advisory_xact_lock(hashtextextended('provider-work-scope:'||p_provider_organization_id::text,0));
 select*into prior from public.provider_work_scope_versions where provider_organization_id=p_provider_organization_id and operation_key=p_operation_key;
 if found then if prior.request_hash is distinct from h then raise exception 'IDEMPOTENCY_PAYLOAD_MISMATCH'using errcode='22000';end if;return prior.response_body;end if;
 select coalesce(max(version_number),0)into current_version from public.provider_work_scope_versions where provider_organization_id=p_provider_organization_id;
 if current_version<>p_expected_version then raise exception 'STALE_PROVIDER_WORK_SCOPE'using errcode='40001';end if;
 r:=jsonb_build_object('outcome','PROVIDER_WORK_SCOPE_DECLARED','command_id',identifier,'version_number',current_version+1);
 insert into public.provider_work_scope_versions(id,provider_organization_id,version_number,intervention_radius_km,mission_size_summary,reason,created_by,operation_key,request_hash,response_body)values(identifier,p_provider_organization_id,current_version+1,p_intervention_radius_km,btrim(p_mission_size_summary),btrim(p_reason),auth.uid(),p_operation_key,h,r);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(p_provider_organization_id,auth.uid(),'USER','provider.work_scope.declared','provider_work_scope',identifier::text,correlation,jsonb_build_object('version',current_version+1),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(p_provider_organization_id,'provider_work_scope',identifier::text,'ProviderWorkScopeDeclaredV1',correlation,jsonb_build_object('version_id',identifier,'version',current_version+1),p_operation_key::text);
 return r;
end$$;
revoke all on function public.declare_provider_work_scope_v1(uuid,integer,text,integer,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.declare_provider_work_scope_v1(uuid,integer,text,integer,text,uuid)to authenticated;
notify pgrst,'reload schema';

commit;
