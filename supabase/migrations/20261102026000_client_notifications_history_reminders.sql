-- Client C23: exact recipient/workspace history and durable trial/credit reminders.
begin;
create index notification_instances_recipient_history_v1 on public.notification_instances
 (organization_id,recipient_user_id,created_at desc,id desc);

create function public.list_notification_center_page_v1(
 p_organization_id uuid,p_limit integer default 25,p_query text default '',p_unread_only boolean default false,
 p_before_created_at timestamptz default null,p_before_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare actor uuid:=auth.uid(); page jsonb; next_cursor jsonb;
begin
 if actor is null or not private.is_active_org_member(p_organization_id,actor) then raise exception 'NOTIFICATION_CENTER_DENIED' using errcode='42501';end if;
 if p_limit is null or p_limit not between 1 and 100 or p_query is null or length(p_query)>160 or p_unread_only is null
 or (p_before_created_at is null)<>(p_before_id is null) or (p_before_created_at is not null and not isfinite(p_before_created_at)) then
  raise exception 'INVALID_NOTIFICATION_HISTORY_FILTER' using errcode='22023';end if;
 with selected as materialized (
  select n.id,n.category_code,n.event_type,n.locale,n.subject,n.body,n.cta_path,n.priority,n.mandatory,n.read_at,n.row_version,n.created_at,'[]'::jsonb deliveries
  from public.notification_instances n
  where n.recipient_user_id=actor and n.organization_id=p_organization_id
   and (not p_unread_only or n.read_at is null)
   and (btrim(p_query)='' or position(lower(btrim(p_query)) in lower(n.subject||' '||n.body))>0)
   and (p_before_created_at is null or (n.created_at,n.id)<(p_before_created_at,p_before_id))
   and exists(select 1 from public.notification_deliveries d where d.notification_id=n.id and d.channel='IN_APP' and d.status<>'SKIPPED')
  order by n.created_at desc,n.id desc limit p_limit+1
 ), visible as (select * from selected order by created_at desc,id desc limit p_limit)
 select coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc,v.id desc)from visible v),'[]'::jsonb),
  case when (select count(*) from selected)>p_limit then (select jsonb_build_object('createdAt',v.created_at,'id',v.id)from visible v order by v.created_at,v.id limit 1) end
 into page,next_cursor;
 return jsonb_build_object('preferences',coalesce((select jsonb_agg(to_jsonb(p)-array['user_id','organization_id']order by p.category_code,p.channel)from public.user_notification_preferences p where p.user_id=actor and p.organization_id=p_organization_id),'[]'::jsonb),'notifications',page,'next',next_cursor);
end$$;
revoke all on function public.list_notification_center_page_v1(uuid,integer,text,boolean,timestamptz,uuid)from public,anon,authenticated,service_role;
grant execute on function public.list_notification_center_page_v1(uuid,integer,text,boolean,timestamptz,uuid)to authenticated;

-- This policy controls reminders only: it never changes expiry, entitlement or price.
create table private.client_reminder_policy_versions_v1(
 version integer primary key check(version>0),trial_days integer[] not null check(trial_days=array[10,5,2,1,0]),
 credit_days integer[] not null check(cardinality(credit_days)>0 and 0<all(credit_days)),
 effective_from timestamptz not null,created_at timestamptz not null default clock_timestamp()
);
insert into private.client_reminder_policy_versions_v1(version,trial_days,credit_days,effective_from)values(1,array[10,5,2,1,0],array[7,1],'2026-11-02T00:00:00Z');
create function private.prevent_client_reminder_policy_mutation_v1()returns trigger language plpgsql set search_path=pg_catalog as $$begin raise exception 'IMMUTABLE_REMINDER_POLICY'using errcode='55000';end$$;
create trigger client_reminder_policy_immutable before update or delete on private.client_reminder_policy_versions_v1 for each row execute function private.prevent_client_reminder_policy_mutation_v1();
revoke all on private.client_reminder_policy_versions_v1 from public,anon,authenticated,service_role;
revoke all on function private.prevent_client_reminder_policy_mutation_v1()from public,anon,authenticated,service_role;

insert into public.notification_template_versions(template_code,version,event_type,category_code,locale,subject_template,body_template,cta_path_template,priority,mandatory,channels,variable_keys,status,effective_from,content_hash)
select x.code,1,x.event,x.category,x.locale,x.subject,x.body,x.path,'IMPORTANT',false,array['IN_APP','EMAIL'],x.variables,'ACTIVE','2026-11-02T00:00:00Z',private.canonical_request_hash(jsonb_build_object('template',x.code,'version',1,'locale',x.locale,'subject',x.subject,'body',x.body,'path',x.path,'variables',x.variables))
from(values
 ('CLIENT_TRIAL_ENDING','TrialEndingReminderV1','TRIAL','fr-MA','Votre essai se termine le {{expires_on}}','Votre période d’essai prend fin le {{expires_on}} ({{milestone}}). Consultez les offres publiées pour préparer la suite.','/fr/client/abonnement?organizationId={{organization_id}}',array['expires_on','milestone','organization_id']),
 ('CLIENT_TRIAL_ENDING','TrialEndingReminderV1','TRIAL','ar-MA','تنتهي فترتكم التجريبية في {{expires_on}}','تنتهي الفترة التجريبية في {{expires_on}} ({{milestone}}). اطّلعوا على العروض المنشورة للتحضير للخطوة التالية.','/ar/client/abonnement?organizationId={{organization_id}}',array['expires_on','milestone','organization_id']),
 ('CLIENT_TRIAL_EXPIRED','TrialExpiredReminderV1','TRIAL','fr-MA','Votre période d’essai est terminée','Votre essai s’est terminé le {{expires_on}}. Consultez les offres publiées ; aucune souscription payante n’est créée par ce rappel.','/fr/client/abonnement?organizationId={{organization_id}}',array['expires_on','organization_id']),
 ('CLIENT_TRIAL_EXPIRED','TrialExpiredReminderV1','TRIAL','ar-MA','انتهت فترتكم التجريبية','انتهت فترتكم التجريبية في {{expires_on}}. اطّلعوا على العروض المنشورة؛ لا ينشئ هذا التذكير اشتراكاً مدفوعاً.','/ar/client/abonnement?organizationId={{organization_id}}',array['expires_on','organization_id']),
 ('CLIENT_CREDIT_EXPIRING','CreditExpiringReminderV1','CREDITS','fr-MA','Des crédits arrivent à expiration le {{expires_on}}','Un lot comporte {{available}} crédit(s) disponibles et expire le {{expires_on}}. Consultez votre portefeuille et ses conditions applicables.','/fr/client/credits?organizationId={{organization_id}}',array['expires_on','available','organization_id']),
 ('CLIENT_CREDIT_EXPIRING','CreditExpiringReminderV1','CREDITS','ar-MA','تنتهي صلاحية أرصدة في {{expires_on}}','تحتوي دفعة على {{available}} رصيداً متاحاً وتنتهي صلاحيتها في {{expires_on}}. اطّلعوا على محفظتكم وشروطها المطبقة.','/ar/client/credits?organizationId={{organization_id}}',array['expires_on','available','organization_id'])
)x(code,event,category,locale,subject,body,path,variables);

-- Latest due checkpoint catches up after an outage without sending all obsolete
-- reminders together. The source expiry + milestone + recipient is deduplicated.
create function private.client_reminder_candidates_v1(p_as_of date)
returns table(recipient_user_id uuid,organization_id uuid,source_type text,source_id uuid,template_code text,event_type text,locale text,variables jsonb,deduplication_key text)
language sql stable security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
 with policy as(select * from private.client_reminder_policy_versions_v1 where effective_from<=clock_timestamp()order by version desc limit 1),
 trial_sources as(
  select t.id,t.organization_id,t.trial_ends_at,t.trial_started_at,(select min(day)from unnest(p.trial_days)day where (t.trial_ends_at at time zone 'UTC')::date-day<=p_as_of)milestone
  from public.client_trials t cross join policy p
  where (t.trial_started_at at time zone 'UTC')::date<=p_as_of
   and not exists(select 1 from public.subscriptions s where s.organization_id=t.organization_id and s.status='ACTIVE')
 ),credit_sources as(
  select l.id,l.organization_id,l.expires_at,
   (l.quantity-coalesce((select sum(case m.movement_type when'RESERVE'then m.quantity when'RELEASE'then-m.quantity else 0 end)from public.credit_lot_movements m where m.credit_lot_id=l.id),0))::bigint available,
   (select min(day)from unnest(p.credit_days)day where (l.expires_at at time zone 'UTC')::date-day<=p_as_of)milestone
  from public.credit_lots l cross join policy p
  where (l.created_at at time zone 'UTC')::date<=p_as_of and l.expires_at>p_as_of::timestamptz
   and private.credit_lot_funding_status_v1(l.id)='ELIGIBLE'
   and not exists(select 1 from public.credit_ledger_entries e where e.wallet_id=l.wallet_id and e.reference_type='CREDIT_LOT'and e.reference_id=l.id::text and e.entry_type='EXPIRE')
 ),sources as(
  select t.organization_id,'client_trial'::text source_type,t.id source_id,
   case when t.milestone=0 then'CLIENT_TRIAL_EXPIRED'else'CLIENT_TRIAL_ENDING'end template_code,
   case when t.milestone=0 then'TrialExpiredReminderV1'else'TrialEndingReminderV1'end event_type,
   jsonb_build_object('expires_on',to_char(t.trial_ends_at at time zone 'UTC','YYYY-MM-DD'),'organization_id',t.organization_id)||case when t.milestone=0 then'{}'::jsonb else jsonb_build_object('milestone','J-'||t.milestone)end variables,
   'client-trial:'||t.id||':'||to_char(t.trial_ends_at at time zone 'UTC','YYYYMMDDHH24MISS')||':'||t.milestone deduplication_key
  from trial_sources t where t.milestone is not null
  union all
  select l.organization_id,'credit_lot',l.id,'CLIENT_CREDIT_EXPIRING','CreditExpiringReminderV1',
   jsonb_build_object('expires_on',to_char(l.expires_at at time zone 'UTC','YYYY-MM-DD'),'available',l.available::text,'organization_id',l.organization_id),
   'client-credit:'||l.id||':'||to_char(l.expires_at at time zone 'UTC','YYYYMMDDHH24MISS')||':'||l.milestone
  from credit_sources l where l.milestone is not null and l.available>0
 )
 select distinct om.user_id,s.organization_id,s.source_type,s.source_id,s.template_code,s.event_type,
  case when u.raw_user_meta_data->>'locale'in('ar','ar-MA')then'ar-MA'else'fr-MA'end,
  s.variables,s.deduplication_key
 from sources s join public.organization_memberships om on om.organization_id=s.organization_id and om.status='ACTIVE'
 join auth.users u on u.id=om.user_id
 where exists(select 1 from public.organization_member_roles r where r.membership_id=om.id and r.revoked_at is null and r.role_code in('CLIENT_OWNER','CLIENT_ADMIN','CLIENT_ACCOUNTING'))
 and not exists(select 1 from public.notification_instances n where n.organization_id=s.organization_id and n.recipient_user_id=om.user_id and n.deduplication_key=s.deduplication_key)
$$;
revoke all on function private.client_reminder_candidates_v1(date)from public,anon,authenticated,service_role;

create function public.run_client_reminder_scheduler_v1(p_as_of date default current_date,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions set timezone='UTC' as $$
declare item record;processed integer:=0;more boolean;corr uuid:=extensions.gen_random_uuid();
begin
 if auth.role()is distinct from'service_role'then raise exception 'CLIENT_REMINDER_SCHEDULER_DENIED'using errcode='42501';end if;
 if p_as_of is null or not isfinite(p_as_of) or p_limit is null or p_limit not between 1 and 500 then raise exception 'INVALID_CLIENT_REMINDER_PAGE'using errcode='22023';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('client-reminders:'||p_as_of::text,0))then return jsonb_build_object('outcome','CLIENT_REMINDERS_BUSY','has_more',true,'processed',0);end if;
 for item in select * from private.client_reminder_candidates_v1(p_as_of)order by organization_id,source_type,source_id,recipient_user_id limit p_limit loop
  perform public.enqueue_notification(item.recipient_user_id,item.organization_id,item.template_code,item.event_type,item.locale,item.variables,item.deduplication_key,item.source_type,item.source_id::text,corr);
  processed:=processed+1;
 end loop;
 select exists(select 1 from private.client_reminder_candidates_v1(p_as_of))into more;
 return jsonb_build_object('outcome',case when more then'CLIENT_REMINDERS_PARTIAL'else'CLIENT_REMINDERS_COMPLETED'end,'as_of',p_as_of,'processed',processed,'has_more',more,'correlation_id',corr);
end$$;
revoke all on function public.run_client_reminder_scheduler_v1(date,integer)from public,anon,authenticated,service_role;
grant execute on function public.run_client_reminder_scheduler_v1(date,integer)to service_role;

-- Keep all pre-existing automation behavior and evidence. A completed base run
-- does not prevent new reminder pages or an outage catch-up from being processed.
alter function public.run_domain_automation_schedulers_v1(date,integer)set schema private;
alter function private.run_domain_automation_schedulers_v1(date,integer)rename to run_domain_automation_base_v1;
revoke all on function private.run_domain_automation_base_v1(date,integer)from public,anon,authenticated,service_role;
create function public.run_domain_automation_schedulers_v1(p_as_of date default current_date,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$
declare base_result jsonb;reminder_result jsonb;more boolean;
begin
 if auth.role()is distinct from'service_role'then raise exception 'DOMAIN_AUTOMATION_DENIED'using errcode='42501';end if;
 if p_as_of is null or not isfinite(p_as_of)or p_limit is null or p_limit not between 1 and 500 then raise exception 'INVALID_DOMAIN_AUTOMATION_INPUT'using errcode='22023';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('client-domain-automations:'||p_as_of::text,0))then return jsonb_build_object('outcome','DOMAIN_AUTOMATIONS_BUSY','has_more',true);end if;
 base_result:=private.run_domain_automation_base_v1(p_as_of,p_limit);
 reminder_result:=public.run_client_reminder_scheduler_v1(p_as_of,p_limit);
 more:=coalesce((base_result->>'has_more')::boolean,false)or coalesce((reminder_result->>'has_more')::boolean,false);
 return base_result||jsonb_build_object('client_reminders',reminder_result,'has_more',more,'outcome',case when more then'DOMAIN_AUTOMATIONS_PARTIAL'else base_result->>'outcome'end);
end$$;
revoke all on function public.run_domain_automation_schedulers_v1(date,integer)from public,anon,authenticated,service_role;
grant execute on function public.run_domain_automation_schedulers_v1(date,integer)to service_role;
notify pgrst,'reload schema';
commit;
