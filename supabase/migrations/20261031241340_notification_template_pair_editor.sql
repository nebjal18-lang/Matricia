begin;
create table public.notification_template_pair_proposals_v1(id uuid primary key default extensions.gen_random_uuid(),template_code text not null,version integer not null,source_pair_hash text not null check(source_pair_hash~'^[a-f0-9]{64}$'),draft_template_ids uuid[]not null check(cardinality(draft_template_ids)=2),target_environment text not null check(target_environment in('DEVELOPMENT','STAGING','PRODUCTION')),approvals_required integer not null check(approvals_required in(1,2)),production_authorization_reference text,reason text not null check(length(btrim(reason))between 10 and 2000),content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),unique(template_code,version));
create table public.notification_template_pair_decisions_v1(proposal_id uuid not null references public.notification_template_pair_proposals_v1(id),decided_by uuid not null references auth.users(id),decision text not null check(decision in('APPROVE','REJECT')),reason text not null check(length(btrim(reason))between 10 and 2000),content_hash text not null,decided_at timestamptz not null default clock_timestamp(),primary key(proposal_id,decided_by));
create table public.notification_template_pair_activations_v1(proposal_id uuid primary key references public.notification_template_pair_proposals_v1(id),content_hash text not null,activated_at timestamptz not null default clock_timestamp());
do $$declare t text;begin foreach t in array array['notification_template_pair_proposals_v1','notification_template_pair_decisions_v1','notification_template_pair_activations_v1']loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);execute format('create trigger %I before update or delete on public.%I for each row execute function private.prevent_update_delete()',t||'_immutable',t);end loop;end$$;
create function private.notification_template_editor_access_v1()returns boolean language sql stable security definer set search_path=pg_catalog,private as $$select auth.uid()is not null and auth.jwt()->>'aal'='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'])$$;
revoke all on function private.notification_template_editor_access_v1()from public,anon,authenticated,service_role;
create function private.notification_active_pair_v1(p_code text)returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$select coalesce(jsonb_agg(to_jsonb(t)order by locale),'[]')from public.notification_template_versions t where template_code=p_code and status='ACTIVE'$$;
revoke all on function private.notification_active_pair_v1(text)from public,anon,authenticated,service_role;
create function private.assert_notification_pair_content_v1(p_pair jsonb,p_translations jsonb)returns void language plpgsql immutable set search_path=pg_catalog as $$
declare template jsonb;translation jsonb;piece text;variable text;
begin
 if jsonb_array_length(p_pair)<>2 or jsonb_typeof(p_translations)is distinct from'object'or(p_translations-array['fr-MA','ar-MA'])<>'{}'::jsonb then raise exception'BILINGUAL_NOTIFICATION_PAIR_REQUIRED'using errcode='22023';end if;
 for template in select*from jsonb_array_elements(p_pair)loop
  translation:=p_translations->(template->>'locale');
  if jsonb_typeof(translation)is distinct from'object'or(translation-array['subject','body'])<>'{}'::jsonb or length(btrim(coalesce(translation->>'subject','')))not between 2 and 240 or length(btrim(coalesce(translation->>'body','')))not between 2 and 4000 or translation->>'subject'~E'[\\r\\n]'then raise exception'INVALID_NOTIFICATION_TRANSLATION'using errcode='22023';end if;
  foreach piece in array array[translation->>'subject',translation->>'body']loop
   for variable in select capture[1]from regexp_matches(piece,'\{\{([A-Za-z][A-Za-z0-9_]*)\}\}','g')capture loop
    if not(template->'variable_keys'?variable)then raise exception'UNKNOWN_NOTIFICATION_VARIABLE'using errcode='22023';end if;
   end loop;
   if regexp_replace(piece,'\{\{([A-Za-z][A-Za-z0-9_]*)\}\}','','g')like'%{{%'or regexp_replace(piece,'\{\{([A-Za-z][A-Za-z0-9_]*)\}\}','','g')like'%}}%'then raise exception'INVALID_NOTIFICATION_PLACEHOLDER'using errcode='22023';end if;
  end loop;
 end loop;
end$$;
revoke all on function private.assert_notification_pair_content_v1(jsonb,jsonb)from public,anon,authenticated,service_role;
create function public.preview_notification_template_pair_v1(p_template_code text,p_expected_pair_hash text,p_translations jsonb,p_variables jsonb)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare pair jsonb;template jsonb;translation jsonb;rendered jsonb:='[]';key text;
begin
 if not private.notification_template_editor_access_v1()then raise exception'NOTIFICATION_TEMPLATE_EDITOR_DENIED'using errcode='42501';end if;
 pair:=private.notification_active_pair_v1(p_template_code);
 if p_expected_pair_hash is distinct from private.canonical_request_hash(pair)then raise exception'STALE_NOTIFICATION_TEMPLATE_PAIR'using errcode='40001';end if;
 perform private.assert_notification_pair_content_v1(pair,p_translations);
 if jsonb_typeof(p_variables)is distinct from'object'or octet_length(p_variables::text)>16384 then raise exception'INVALID_PREVIEW_VARIABLES'using errcode='22023';end if;
 for key in select jsonb_object_keys(p_variables)loop if not exists(select 1 from jsonb_array_elements(pair)t where t->'variable_keys'?key)or jsonb_typeof(p_variables->key)<>'string'then raise exception'UNKNOWN_NOTIFICATION_VARIABLE'using errcode='22023';end if;end loop;
 for template in select*from jsonb_array_elements(pair)loop
  if exists(select 1 from jsonb_array_elements_text(template->'variable_keys')v where not(p_variables?v))then raise exception'MISSING_NOTIFICATION_VARIABLE'using errcode='22023';end if;
  translation:=p_translations->(template->>'locale');rendered:=rendered||jsonb_build_array(jsonb_build_object('locale',template->>'locale','subject',private.render_notification_text(translation->>'subject',p_variables),'body',private.render_notification_text(translation->>'body',p_variables),'cta_path',private.render_notification_text(template->>'cta_path_template',p_variables)));
 end loop;
 return jsonb_build_object('outcome','NOTIFICATION_TEMPLATE_PREVIEW','rendered',rendered,'delivery_sent',false);
end$$;
create function public.propose_notification_template_pair_v1(p_template_code text,p_expected_pair_hash text,p_translations jsonb,p_reason text,p_production_authorization_reference text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare pair jsonb;template jsonb;translation jsonb;environment text;hash text;cached jsonb;result jsonb;drafts uuid[]:='{}';draft uuid;proposal uuid;next_version integer;required integer;effective timestamptz:=clock_timestamp();
begin
 if not private.notification_template_editor_access_v1()then raise exception'NOTIFICATION_TEMPLATE_EDITOR_DENIED'using errcode='42501';end if;
 select e.environment into environment from private.admin_execution_environment_v1 e where e.singleton;
 if environment is null then raise exception'ADMIN_DEPLOYMENT_ENVIRONMENT_REQUIRED'using errcode='55000';end if;
 if environment='PRODUCTION'and length(btrim(coalesce(p_production_authorization_reference,'')))not between 8 and 500 then raise exception'PRODUCTION_AUTHORIZATION_REQUIRED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'NOTIFICATION_TEMPLATE_REASON_REQUIRED'using errcode='22023';end if;
 hash:=private.canonical_request_hash(jsonb_build_object('code',p_template_code,'source',p_expected_pair_hash,'translations',p_translations,'reason',btrim(p_reason),'environment',environment,'production_reference',p_production_authorization_reference));cached:=private.begin_admin_command('notification.template.propose',p_idempotency_key,hash,auth.uid());if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended('notification-template:'||p_template_code,0));pair:=private.notification_active_pair_v1(p_template_code);
 if p_expected_pair_hash is distinct from private.canonical_request_hash(pair)then raise exception'STALE_NOTIFICATION_TEMPLATE_PAIR'using errcode='40001';end if;
 perform private.assert_notification_pair_content_v1(pair,p_translations);
 select coalesce(max(version),0)+1 into next_version from public.notification_template_versions where template_code=p_template_code;
 for template in select*from jsonb_array_elements(pair)loop
  translation:=p_translations->(template->>'locale');
  insert into public.notification_template_versions(template_code,version,event_type,category_code,locale,subject_template,body_template,cta_path_template,priority,mandatory,channels,variable_keys,status,effective_from,content_hash)values(p_template_code,next_version,template->>'event_type',template->>'category_code',template->>'locale',translation->>'subject',translation->>'body',template->>'cta_path_template',template->>'priority',(template->>'mandatory')::boolean,array(select jsonb_array_elements_text(template->'channels')),array(select jsonb_array_elements_text(template->'variable_keys')),'DRAFT',effective,private.canonical_request_hash(jsonb_build_object('source_hash',template->>'content_hash','version',next_version,'translation',translation)))returning id into draft;drafts:=array_append(drafts,draft);
 end loop;
 required:=case when environment='PRODUCTION'then 2 else 1 end;
 insert into public.notification_template_pair_proposals_v1(template_code,version,source_pair_hash,draft_template_ids,target_environment,approvals_required,production_authorization_reference,reason,content_hash,created_by)values(p_template_code,next_version,p_expected_pair_hash,drafts,environment,required,p_production_authorization_reference,btrim(p_reason),hash,auth.uid())returning id into proposal;
 result:=jsonb_build_object('outcome','NOTIFICATION_TEMPLATE_PAIR_PROPOSED','proposal_id',proposal,'version',next_version,'approvals_required',required,'content_hash',hash);
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(auth.uid(),'USER','notification.template.pair_proposed','notification_template_pair',proposal::text,extensions.gen_random_uuid(),result||jsonb_build_object('source_pair_hash',p_expected_pair_hash,'environment',environment),repeat('0',64));
 perform private.finish_admin_command('notification.template.propose',p_idempotency_key,auth.uid(),result);return result;
end$$;
create function public.decide_notification_template_pair_v1(p_proposal_id uuid,p_expected_content_hash text,p_approve boolean,p_review_confirmed boolean,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare p public.notification_template_pair_proposals_v1%rowtype;environment text;hash text;cached jsonb;result jsonb;approved integer;activated boolean:=false;
begin
 if not private.notification_template_editor_access_v1()then raise exception'NOTIFICATION_TEMPLATE_EDITOR_DENIED'using errcode='42501';end if;
 select*into p from public.notification_template_pair_proposals_v1 where id=p_proposal_id for update;
 if p.id is null or p.created_by=auth.uid()then raise exception'NOTIFICATION_TEMPLATE_INDEPENDENT_APPROVER_REQUIRED'using errcode='42501';end if;
 select e.environment into environment from private.admin_execution_environment_v1 e where e.singleton;
 if environment is distinct from p.target_environment then raise exception'ADMIN_DEPLOYMENT_ENVIRONMENT_MISMATCH'using errcode='42501';end if;
 if p_expected_content_hash is distinct from p.content_hash then raise exception'STALE_NOTIFICATION_TEMPLATE_PAIR'using errcode='40001';end if;
 if p_approve is null or(p_approve and p_review_confirmed is distinct from true)or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'NOTIFICATION_TEMPLATE_BILINGUAL_REVIEW_REQUIRED'using errcode='22023';end if;
 hash:=private.canonical_request_hash(jsonb_build_object('proposal',p.id,'hash',p.content_hash,'approve',p_approve,'reason',btrim(p_reason)));cached:=private.begin_admin_command('notification.template.decide.'||p.id::text,p_idempotency_key,hash,auth.uid());if cached is not null then return cached;end if;
 if exists(select 1 from public.notification_template_pair_activations_v1 where proposal_id=p.id)or exists(select 1 from public.notification_template_pair_decisions_v1 where proposal_id=p.id and decision='REJECT')then raise exception'NOTIFICATION_TEMPLATE_PAIR_ALREADY_DECIDED'using errcode='55000';end if;
 if exists(select 1 from public.notification_template_pair_decisions_v1 where proposal_id=p.id and decided_by=auth.uid())then raise exception'NOTIFICATION_TEMPLATE_REVIEW_ALREADY_RECORDED'using errcode='55000';end if;
 perform pg_advisory_xact_lock(hashtextextended('notification-template:'||p.template_code,0));
 if p.source_pair_hash is distinct from private.canonical_request_hash(private.notification_active_pair_v1(p.template_code))then raise exception'STALE_NOTIFICATION_TEMPLATE_PAIR'using errcode='40001';end if;
 insert into public.notification_template_pair_decisions_v1(proposal_id,decided_by,decision,reason,content_hash)values(p.id,auth.uid(),case when p_approve then'APPROVE'else'REJECT'end,btrim(p_reason),p.content_hash);
 select count(*)into approved from public.notification_template_pair_decisions_v1 d where d.proposal_id=p.id and d.decision='APPROVE'and d.content_hash=p.content_hash and d.decided_by<>p.created_by and exists(select 1 from public.platform_user_roles r where r.user_id=d.decided_by and r.role_code in('SUPER_ADMIN','MATRICIA_ADMIN')and r.revoked_at is null);
 if p_approve and approved>=p.approvals_required then
  if(select count(*)from public.notification_template_versions where id=any(p.draft_template_ids)and status='DRAFT')<>2 then raise exception'NOTIFICATION_TEMPLATE_DRAFT_PAIR_REQUIRED'using errcode='55000';end if;
  update public.notification_template_versions set status='RETIRED',effective_until=clock_timestamp()where template_code=p.template_code and status='ACTIVE';
  update public.notification_template_versions set status='ACTIVE'where id=any(p.draft_template_ids)and status='DRAFT';
  insert into public.notification_template_pair_activations_v1(proposal_id,content_hash)values(p.id,p.content_hash);activated:=true;
  insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values('notification_template_pair',p.id::text,'NotificationTemplatePairActivatedV1',extensions.gen_random_uuid(),jsonb_build_object('proposal_id',p.id,'template_code',p.template_code,'version',p.version,'content_hash',p.content_hash,'template_version_ids',p.draft_template_ids,'delivery_sent',false),'notification-template-pair:'||p.id::text);
 end if;
 result:=jsonb_build_object('outcome',case when activated then'NOTIFICATION_TEMPLATE_PAIR_ACTIVATED'when not p_approve then'NOTIFICATION_TEMPLATE_PAIR_REJECTED'else'NOTIFICATION_TEMPLATE_PAIR_APPROVAL_RECORDED'end,'proposal_id',p.id,'approvals',approved,'approvals_required',p.approvals_required,'content_hash',p.content_hash);
 insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(auth.uid(),'USER','notification.template.pair_reviewed','notification_template_pair',p.id::text,extensions.gen_random_uuid(),result||jsonb_build_object('reason',btrim(p_reason),'approved',p_approve,'activated',activated),repeat('0',64));
 perform private.finish_admin_command('notification.template.decide.'||p.id::text,p_idempotency_key,auth.uid(),result);return result;
end$$;
create function public.get_notification_template_editor_v1(p_page integer default 1)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare pairs jsonb;proposals jsonb;pair_count bigint;proposal_count bigint;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'or not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','READ_ONLY_AUDITOR'])then raise exception'NOTIFICATION_TEMPLATE_EDITOR_DENIED'using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 100000 then raise exception'INVALID_PAGE'using errcode='22023';end if;
 select count(distinct template_code)into pair_count from public.notification_template_versions where status='ACTIVE';select count(*)into proposal_count from public.notification_template_pair_proposals_v1;
 select coalesce(jsonb_agg(jsonb_build_object('code',code,'source_pair_hash',private.canonical_request_hash(private.notification_active_pair_v1(code)),'templates',private.notification_active_pair_v1(code))order by code),'[]')into pairs from(select distinct template_code code from public.notification_template_versions where status='ACTIVE'order by template_code limit 25 offset((p_page-1)*25))codes;
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('templates',(select jsonb_agg(to_jsonb(t)order by locale)from public.notification_template_versions t where t.id=any(p.draft_template_ids)),'decisions',coalesce((select jsonb_agg(to_jsonb(d)order by decided_at,decided_by)from public.notification_template_pair_decisions_v1 d where d.proposal_id=p.id),'[]'),'activated',exists(select 1 from public.notification_template_pair_activations_v1 where proposal_id=p.id),'stale',not exists(select 1 from public.notification_template_pair_activations_v1 where proposal_id=p.id)and(p.source_pair_hash is distinct from private.canonical_request_hash(private.notification_active_pair_v1(p.template_code))or p.target_environment is distinct from(select e.environment from private.admin_execution_environment_v1 e where e.singleton)))order by p.created_at desc,p.id desc),'[]')into proposals from(select*from public.notification_template_pair_proposals_v1 order by created_at desc,id desc limit 25 offset((p_page-1)*25))p;
 return jsonb_build_object('pairs',pairs,'proposals',proposals,'page',p_page,'has_next',p_page::bigint*25<greatest(pair_count,proposal_count),'can_edit',private.notification_template_editor_access_v1());
end$$;
revoke all on function public.preview_notification_template_pair_v1(text,text,jsonb,jsonb),public.propose_notification_template_pair_v1(text,text,jsonb,text,text,text),public.decide_notification_template_pair_v1(uuid,text,boolean,boolean,text,text),public.get_notification_template_editor_v1(integer)from public,anon,authenticated,service_role;
grant execute on function public.preview_notification_template_pair_v1(text,text,jsonb,jsonb),public.propose_notification_template_pair_v1(text,text,jsonb,text,text,text),public.decide_notification_template_pair_v1(uuid,text,boolean,boolean,text,text),public.get_notification_template_editor_v1(integer)to authenticated;
notify pgrst,'reload schema';
commit;
