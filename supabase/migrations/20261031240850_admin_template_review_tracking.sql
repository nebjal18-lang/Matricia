begin;
create function private.execute_admin_template_review_v1(p_request_id uuid,p_correlation_id uuid)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare x public.admin_operational_action_requests%rowtype;t public.notification_template_versions%rowtype;w uuid;
begin
 select*into x from public.admin_operational_action_requests where id=p_request_id;
 if auth.role()is distinct from'service_role'or x.status<>'AUTHORIZED'or x.redacted_summary->>'view'<>'preferences'then raise exception'ADMIN_TEMPLATE_REVIEW_DENIED'using errcode='42501';end if;
 select*into t from public.notification_template_versions where id=(x.redacted_summary->>'note')::uuid and status='ACTIVE';
 if t.id is null or length(btrim(coalesce(x.redacted_summary->>'justification','')))not between 10 and 1000 then raise exception'INVALID_ADMIN_TEMPLATE_REVIEW'using errcode='22023';end if;
 insert into public.admin_work_items(queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,due_at,redacted_context,created_by)select id,x.organization_id,'MANUAL_REVIEW','notification_template_review',x.id::text,'Revoir le modèle de notification '||t.template_code,'مراجعة قالب الإشعار '||t.template_code,'MEDIUM',clock_timestamp()+interval'1 day',jsonb_build_object('template_id',t.id,'template_code',t.template_code,'version',t.version,'locale',t.locale,'reason',x.redacted_summary->>'justification','template_changed',false),x.requested_by from public.admin_queue_versions where queue_key='CENTRAL_APPROVALS'and status='ACTIVE'returning id into w;
 if w is null then raise exception'ADMIN_REVIEW_QUEUE_UNAVAILABLE'using errcode='55000';end if;
 insert into public.admin_work_item_events(work_item_id,event_type,to_status,actor_user_id,reason,evidence_snapshot,correlation_id)values(w,'OPENED','OPEN',x.requested_by,'Revue demandée après approbation, modèle inchangé',jsonb_build_object('template_id',t.id,'action_request_id',x.id),p_correlation_id);
 return jsonb_build_object('work_item_id',w,'template_id',t.id,'status','MANUAL_REVIEW_PENDING','template_changed',false);
end$$;
revoke all on function private.execute_admin_template_review_v1(uuid,uuid)from public,anon,authenticated,service_role;
do $$declare definition text;begin
 select pg_get_functiondef('public.execute_admin_operational_action_v1(uuid,uuid)'::regprocedure)into definition;
 if strpos(definition,'elsif x.resource_type=''ORGANIZATION''then')=0 then raise exception'ADMIN_TEMPLATE_REVIEW_PATCH_TARGET_NOT_FOUND';end if;
 definition:=replace(definition,'elsif x.resource_type=''ORGANIZATION''then','elsif x.resource_type=''NOTIFICATION_TEMPLATE''then result:=private.execute_admin_template_review_v1(x.id,p_correlation_id); elsif x.resource_type=''ORGANIZATION''then');
 execute definition;
end$$;
notify pgrst,'reload schema';
commit;
