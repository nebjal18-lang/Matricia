-- Deliverables bind to the milestones created by the same mission transaction.
-- A lone milestone is an unambiguous compatibility default; multiple require a key.
begin;
alter table public.mission_milestones add constraint mission_milestones_id_mission_unique unique(id,mission_id);
alter table public.deliverables add constraint deliverable_milestone_same_mission foreign key(milestone_id,mission_id)references public.mission_milestones(id,mission_id)on delete restrict;
alter table public.mission_checklist_items add constraint checklist_milestone_same_mission foreign key(milestone_id,mission_id)references public.mission_milestones(id,mission_id)on delete restrict;
create function private.resolve_created_mission_milestone_v1(p_mission_id uuid,p_deliverable jsonb)returns uuid language plpgsql stable security definer set search_path=pg_catalog as $$
declare requested_id uuid;requested_key text;resolved uuid;matches integer;
begin
 if p_mission_id is null or jsonb_typeof(p_deliverable)is distinct from'object'then raise exception'INVALID_DELIVERABLE_MILESTONE'using errcode='22023';end if;
 requested_key:=nullif(btrim(p_deliverable->>'milestone_key'),'');requested_id:=nullif(p_deliverable->>'milestone_id','')::uuid;
 if requested_id is not null then
  select id into resolved from public.mission_milestones where id=requested_id and mission_id=p_mission_id and(requested_key is null or milestone_key=requested_key);
 elsif requested_key is not null then
  select id into resolved from public.mission_milestones where mission_id=p_mission_id and milestone_key=requested_key;
 else
  select count(*)::integer,min(id::text)::uuid into matches,resolved from public.mission_milestones where mission_id=p_mission_id;
  if matches<>1 then raise exception'DELIVERABLE_MILESTONE_KEY_REQUIRED'using errcode='22023';end if;
 end if;
 if resolved is null then raise exception'DELIVERABLE_MILESTONE_SCOPE_DENIED'using errcode='22023';end if;return resolved;
exception when invalid_text_representation then raise exception'INVALID_DELIVERABLE_MILESTONE'using errcode='22023';
end$$;
revoke all on function private.resolve_created_mission_milestone_v1(uuid,jsonb)from public,anon,authenticated,service_role;
do $$declare definition text;target text:='values(m,nullif(x->>''milestone_id'','''')::uuid,x->>''key''';begin
 select pg_get_functiondef('public.create_mission_legacy_0159(uuid,uuid,jsonb,jsonb,jsonb,text,uuid)'::regprocedure)into definition;
 if strpos(definition,target)=0 then raise exception'MISSION_DELIVERABLE_MILESTONE_PATCH_TARGET_MISSING';end if;
 execute replace(definition,target,'values(m,private.resolve_created_mission_milestone_v1(m,x),x->>''key''');
end$$;
notify pgrst,'reload schema';
commit;
