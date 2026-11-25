begin;

-- Home snapshot is a read projection: allow every active client org role.
create or replace function public.get_client_home_snapshot_v1(
  p_organization_id uuid,
  p_locale text default 'fr'
) returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_name text;
  v_open integer;
  v_quotes integer;
  v_active integer;
  v_pending_signatures integer;
  v_pending_deliverables integer;
  v_upcoming integer;
  v_featured jsonb;
  v_milestone jsonb;
begin
  if auth.uid() is null
     or not private.has_org_role(
       p_organization_id,
       array[
         'CLIENT_OWNER',
         'CLIENT_ADMIN',
         'CLIENT_BUYER',
         'CLIENT_ACCOUNTING',
         'CLIENT_MEMBER',
         'CLIENT_VIEWER',
         'CLIENT_EDITOR'
       ],
       auth.uid()
     )
  then
    raise exception 'CLIENT_HOME_DENIED' using errcode = '42501';
  end if;
  if p_locale is distinct from 'fr' and p_locale is distinct from 'ar' then
    raise exception 'INVALID_LOCALE' using errcode = '22023';
  end if;

  select o.display_name into v_name
  from public.organizations o
  where o.id = p_organization_id;

  select count(*)::integer into v_open
  from public.service_requests r
  where r.client_organization_id = p_organization_id
    and r.status in (
      'DRAFT', 'INFORMATION_REQUIRED', 'READY', 'MATCHING', 'RFQ_OPEN',
      'QUOTES_RECEIVED', 'CLIENT_REVIEW', 'PROVIDER_SELECTED', 'CONTRACT_PENDING'
    );

  select coalesce(sum(q.cnt), 0)::integer into v_quotes
  from (
    select count(*)::integer as cnt
    from public.service_requests r
    join public.rfqs f on f.request_id = r.id
    join public.quotes q on q.rfq_id = f.id
    where r.client_organization_id = p_organization_id
      and r.status in ('RFQ_OPEN', 'QUOTES_RECEIVED', 'CLIENT_REVIEW')
      and q.status in ('SUBMITTED', 'CLIENT_REVIEW', 'REVISION_REQUESTED')
    group by r.id
  ) q;

  select count(*)::integer into v_active
  from public.missions m
  where m.client_organization_id = p_organization_id
    and m.status not in ('COMPLETED', 'CANCELLED', 'CLOSED');

  select count(*)::integer into v_pending_signatures
  from public.contracts c
  where c.client_organization_id = p_organization_id
    and c.status not in ('SIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'CLOSED')
    and not exists (
      select 1 from public.contract_signatures s where s.contract_id = c.id
    );

  select count(*)::integer into v_pending_deliverables
  from public.deliverables d
  join public.missions m on m.id = d.mission_id
  where m.client_organization_id = p_organization_id
    and m.status not in ('COMPLETED', 'CANCELLED', 'CLOSED')
    and d.status in ('SUBMITTED', 'IN_REVIEW');

  select count(*)::integer into v_upcoming
  from public.mission_milestones s
  join public.missions m on m.id = s.mission_id
  where m.client_organization_id = p_organization_id
    and m.status not in ('COMPLETED', 'CANCELLED', 'CLOSED')
    and s.status not in ('DONE', 'COMPLETED', 'CANCELLED')
    and s.due_at is not null
    and s.due_at >= current_timestamp
    and s.due_at <= current_timestamp + interval '7 days';

  select jsonb_build_object(
    'id', r.id,
    'description', coalesce(v.description, ''),
    'status', r.status,
    'created_at', r.created_at,
    'quote_count', coalesce((
      select count(*)::integer
      from public.rfqs f
      join public.quotes q on q.rfq_id = f.id
      where f.request_id = r.id
        and q.status in ('SUBMITTED', 'CLIENT_REVIEW', 'REVISION_REQUESTED')
    ), 0),
    'rfq_id', (
      select f.id
      from public.rfqs f
      where f.request_id = r.id
      order by f.version_number desc, f.id
      limit 1
    )
  )
  into v_featured
  from public.service_requests r
  left join public.service_request_versions v on v.id = r.current_version_id
  where r.client_organization_id = p_organization_id
    and r.status in (
      'DRAFT', 'INFORMATION_REQUIRED', 'READY', 'MATCHING', 'RFQ_OPEN',
      'QUOTES_RECEIVED', 'CLIENT_REVIEW', 'PROVIDER_SELECTED', 'CONTRACT_PENDING'
    )
  order by
    case
      when r.status in ('RFQ_OPEN', 'QUOTES_RECEIVED', 'CLIENT_REVIEW')
        and exists (
          select 1 from public.rfqs f
          join public.quotes q on q.rfq_id = f.id
          where f.request_id = r.id
            and q.status in ('SUBMITTED', 'CLIENT_REVIEW', 'REVISION_REQUESTED')
        ) then 0
      else 1
    end,
    r.created_at desc,
    r.id
  limit 1;

  select jsonb_build_object(
    'title', case when p_locale = 'ar' then s.title_ar else s.title_fr end,
    'due_at', s.due_at
  )
  into v_milestone
  from public.mission_milestones s
  join public.missions m on m.id = s.mission_id
  where m.client_organization_id = p_organization_id
    and m.status not in ('COMPLETED', 'CANCELLED', 'CLOSED')
    and s.status not in ('DONE', 'COMPLETED', 'CANCELLED')
  order by s.due_at nulls last, s.id
  limit 1;

  return jsonb_build_object(
    'organization_name', v_name,
    'open_requests', v_open,
    'quotes_to_review', v_quotes,
    'active_missions', v_active,
    'pending_decisions', v_pending_signatures + v_pending_deliverables,
    'upcoming_due', v_upcoming,
    'featured', v_featured,
    'next_milestone', v_milestone
  );
end;
$$;

revoke all on function public.get_client_home_snapshot_v1(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.get_client_home_snapshot_v1(uuid, text) to authenticated;

commit;
