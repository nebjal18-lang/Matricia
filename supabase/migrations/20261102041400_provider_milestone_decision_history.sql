begin;
-- Parties need the actual rejection reason, not an inaccessible audit row or a
-- reassuring generic status. Project only the relevant immutable audit events.
create table public.mission_milestone_decisions_v1(
 audit_event_id bigint primary key references public.audit_events(id)on delete restrict,
 milestone_id uuid not null references public.mission_milestones(id)on delete restrict,
 decision text not null check(decision in('ACCEPTED','REJECTED')),
 reason text not null,decided_by uuid references auth.users(id),decided_at timestamptz not null
);
insert into public.mission_milestone_decisions_v1(audit_event_id,milestone_id,decision,reason,decided_by,decided_at)
select a.id,m.id,a.metadata->>'decision',a.metadata->>'reason',a.actor_user_id,a.occurred_at
from public.audit_events a join public.mission_milestones m on m.id::text=a.resource_id
where a.action='mission.milestone.decided'and a.resource_type='mission_milestone'and a.metadata->>'decision'in('ACCEPTED','REJECTED')and a.metadata->>'reason'is not null;
alter table public.mission_milestone_decisions_v1 enable row level security;
create policy milestone_decision_party_read on public.mission_milestone_decisions_v1 for select to authenticated using(private.mission_party_access((select m.mission_id from public.mission_milestones m where m.id=milestone_id)));
create trigger milestone_decision_immutable before update or delete on public.mission_milestone_decisions_v1 for each row execute function private.prevent_contract_immutable_change();
revoke all on public.mission_milestone_decisions_v1 from public,anon,authenticated,service_role;grant select on public.mission_milestone_decisions_v1 to authenticated;
create function private.project_milestone_decision_v1()returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.action='mission.milestone.decided'and new.resource_type='mission_milestone'and new.metadata->>'decision'in('ACCEPTED','REJECTED')and new.metadata->>'reason'is not null then
  insert into public.mission_milestone_decisions_v1(audit_event_id,milestone_id,decision,reason,decided_by,decided_at)
  select new.id,m.id,new.metadata->>'decision',new.metadata->>'reason',new.actor_user_id,new.occurred_at from public.mission_milestones m where m.id::text=new.resource_id;
 end if;return new;
end$$;
create trigger milestone_decision_project_v1 after insert on public.audit_events for each row execute function private.project_milestone_decision_v1();
revoke all on function private.project_milestone_decision_v1()from public,anon,authenticated,service_role;
-- Rejection is objective and actionable only with a criterion-specific reason.
do $patch$declare src text;needle text;begin
 src:=pg_get_functiondef('public.accept_delivery(uuid,jsonb,text,uuid)'::regprocedure);
 needle:='for x in select * from jsonb_array_elements(p_decisions)loop';
 if position(needle in src)=0 then raise exception'ACCEPTANCE_REASON_SOURCE_DRIFT';end if;
 src:=replace(src,needle,'if exists(select 1 from jsonb_array_elements(p_decisions)j where (j->>''status''=''NONCOMPLIANT''and length(btrim(coalesce(j->>''comment'','''')))not between 3 and 1000)or length(coalesce(j->>''comment'',''''))>1000)then raise exception''ACCEPTANCE_REJECTION_REASON_REQUIRED''using errcode=''22023'';end if;'||needle);
 execute src;
end$patch$;

commit;
