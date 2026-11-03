-- Promote an immutable public intake into a versioned diagnostic result.
-- The catalogue questionnaire diagnostic stays separate. This policy is PUBLIC_DIAGNOSTIC_V1.
-- Rollback: revoke the functions, then archive the result tables. Intakes stay immutable.

create function private.score_public_diagnostic_v1(p_answers jsonb) returns jsonb
language plpgsql immutable set search_path = pg_catalog as $$
declare
  score numeric(5,2) := 100;
  findings jsonb := '[]'::jsonb;
  tracking text := p_answers->>'priority_tracking';
  sales text := p_answers->>'sales_tracking';
  backup text := p_answers->>'backup_restore';
  decision text := p_answers->>'decision_trace';
  rating text;
begin
  if tracking = 'partial' then score := score - 15; findings := findings || jsonb_build_array(jsonb_build_object('kind','ANOMALY','code','ORGANIZATION_PARTIAL','severity','WARNING','deduction',15,'title_fr','Le suivi des priorités est partiel','title_ar','متابعة الأولويات جزئية','text_fr','Les priorités ne sont pas suivies de façon régulière.','text_ar','لا تُتابَع الأولويات بانتظام.'));
  elsif tracking = 'no' then score := score - 30; findings := findings || jsonb_build_array(jsonb_build_object('kind','ANOMALY','code','ORGANIZATION_ABSENT','severity','HIGH','deduction',30,'title_fr','Aucun suivi des priorités','title_ar','لا متابعة للأولويات','text_fr','Aucune pratique régulière de suivi n’est déclarée.','text_ar','لم يُصرَّح بأي متابعة منتظمة.'));
  elsif tracking = 'unknown' then score := score - 10; findings := findings || jsonb_build_array(jsonb_build_object('kind','ANOMALY','code','ORGANIZATION_UNKNOWN','severity','INFO','deduction',10,'title_fr','Suivi des priorités à confirmer','title_ar','متابعة الأولويات بحاجة إلى تأكيد','text_fr','La réponse ne permet pas encore de conclure.','text_ar','الإجابة لا تسمح بعد بالاستنتاج.'));
  end if;
  if sales = 'manual' then score := score - 10; findings := findings || jsonb_build_array(jsonb_build_object('kind','ANOMALY','code','SALES_MANUAL','severity','WARNING','deduction',10,'title_fr','Le suivi commercial est manuel','title_ar','المتابعة التجارية يدوية','text_fr','Le suivi des ventes repose sur une saisie manuelle.','text_ar','تعتمد متابعة المبيعات على إدخال يدوي.'));
  elsif sales = 'ad_hoc' then score := score - 20; findings := findings || jsonb_build_array(jsonb_build_object('kind','ANOMALY','code','SALES_AD_HOC','severity','HIGH','deduction',20,'title_fr','Le suivi commercial est ponctuel','title_ar','المتابعة التجارية ظرفية','text_fr','Les ventes ne sont pas suivies de façon partagée.','text_ar','لا تُتابَع المبيعات بطريقة مشتركة.'));
  elsif sales = 'unknown' then score := score - 10; findings := findings || jsonb_build_array(jsonb_build_object('kind','ANOMALY','code','SALES_UNKNOWN','severity','INFO','deduction',10,'title_fr','Suivi commercial à confirmer','title_ar','المتابعة التجارية بحاجة إلى تأكيد','text_fr','La réponse commerciale reste incertaine.','text_ar','الإجابة التجارية ما زالت غير مؤكدة.'));
  end if;
  if backup = 'old' then score := score - 15; findings := findings || jsonb_build_array(jsonb_build_object('kind','RISK','code','BACKUP_OLD','severity','WARNING','deduction',15,'title_fr','La dernière sauvegarde est ancienne','title_ar','آخر نسخة احتياطية قديمة','text_fr','Une sauvegarde ancienne augmente le risque de perte.','text_ar','النسخة القديمة تزيد خطر الفقدان.'));
  elsif backup = 'no' then score := score - 30; findings := findings || jsonb_build_array(jsonb_build_object('kind','RISK','code','BACKUP_ABSENT','severity','CRITICAL','deduction',30,'title_fr','Aucune sauvegarde déclarée','title_ar','لا توجد نسخة احتياطية','text_fr','L’activité n’a pas de restauration déclarée.','text_ar','لا استعادة مصرح بها للنشاط.'));
  elsif backup = 'unknown' then score := score - 10; findings := findings || jsonb_build_array(jsonb_build_object('kind','RISK','code','BACKUP_UNKNOWN','severity','INFO','deduction',10,'title_fr','Sauvegarde à confirmer','title_ar','النسخة الاحتياطية بحاجة إلى تأكيد','text_fr','La continuité numérique n’est pas confirmée.','text_ar','الاستمرارية الرقمية غير مؤكدة.'));
  end if;
  if decision = 'partial' then score := score - 10; findings := findings || jsonb_build_array(jsonb_build_object('kind','ANOMALY','code','DECISION_PARTIAL','severity','WARNING','deduction',10,'title_fr','Les décisions sont partiellement tracées','title_ar','القرارات موثّقة جزئياً','text_fr','La trace des décisions n’est pas systématique.','text_ar','أثر القرارات ليس منهجياً.'));
  elsif decision = 'no' then score := score - 20; findings := findings || jsonb_build_array(jsonb_build_object('kind','ANOMALY','code','DECISION_ABSENT','severity','HIGH','deduction',20,'title_fr','Les décisions ne sont pas tracées','title_ar','القرارات غير موثّقة','text_fr','Aucune trace systématique des décisions n’est déclarée.','text_ar','لا أثر منهجي للقرارات.'));
  elsif decision = 'unknown' then score := score - 10; findings := findings || jsonb_build_array(jsonb_build_object('kind','ANOMALY','code','DECISION_UNKNOWN','severity','INFO','deduction',10,'title_fr','Traçabilité des décisions à confirmer','title_ar','توثيق القرارات بحاجة إلى تأكيد','text_fr','La traçabilité reste à vérifier.','text_ar','التوثيق ما زال بحاجة إلى تحقق.'));
  end if;
  score := greatest(score, 0);
  rating := case when score >= 80 then 'GOOD' when score >= 60 then 'ATTENTION' when score >= 40 then 'IMPORTANT' else 'CRITICAL' end;
  return jsonb_build_object('policy_version','PUBLIC_DIAGNOSTIC_V1','score',score,'rating',rating,'findings',findings);
end;
$$;
revoke all on function private.score_public_diagnostic_v1(jsonb) from public, anon, authenticated, service_role;

create table public.public_diagnostic_promotions (
  id uuid primary key default extensions.gen_random_uuid(),
  intake_id uuid not null unique references public.public_diagnostic_intakes(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  policy_version text not null default 'PUBLIC_DIAGNOSTIC_V1' check (policy_version = 'PUBLIC_DIAGNOSTIC_V1'),
  overall_score numeric(5,2) not null check (overall_score between 0 and 100),
  rating text not null check (rating in ('GOOD','ATTENTION','IMPORTANT','CRITICAL')),
  explanation jsonb not null check (jsonb_typeof(explanation) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp()
);
create table public.public_diagnostic_findings (
  id uuid primary key default extensions.gen_random_uuid(),
  promotion_id uuid not null references public.public_diagnostic_promotions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  finding_kind text not null check (finding_kind in ('ANOMALY','RISK','RECOMMENDATION')),
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{2,79}$'),
  severity text not null check (severity in ('INFO','WARNING','HIGH','CRITICAL')),
  title_fr text not null check (length(btrim(title_fr)) between 3 and 200),
  title_ar text not null check (length(btrim(title_ar)) between 3 and 200),
  client_text_fr text not null check (length(btrim(client_text_fr)) between 3 and 500),
  client_text_ar text not null check (length(btrim(client_text_ar)) between 3 and 500),
  rule_snapshot jsonb not null check (jsonb_typeof(rule_snapshot) = 'object'),
  unique (promotion_id, code)
);
create table public.public_diagnostic_opportunities (
  id uuid primary key default extensions.gen_random_uuid(),
  promotion_id uuid not null references public.public_diagnostic_promotions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  finding_id uuid not null unique references public.public_diagnostic_findings(id) on delete restrict,
  priority integer not null check (priority between 1 and 100),
  status text not null default 'DETECTED' check (status in ('DETECTED','DEFERRED','CLOSED','NEED_REQUESTED')),
  deferred_until date,
  row_version integer not null default 1 check (row_version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check ((status = 'DEFERRED') = (deferred_until is not null))
);
create trigger public_diagnostic_promotions_immutable before update or delete on public.public_diagnostic_promotions for each row execute function private.prevent_diagnostic_result_change();
create trigger public_diagnostic_findings_immutable before update or delete on public.public_diagnostic_findings for each row execute function private.prevent_diagnostic_result_change();

alter table public.public_diagnostic_promotions enable row level security;
alter table public.public_diagnostic_findings enable row level security;
alter table public.public_diagnostic_opportunities enable row level security;
revoke all on public.public_diagnostic_promotions, public.public_diagnostic_findings, public.public_diagnostic_opportunities from public, anon, authenticated, service_role;
create policy public_diagnostic_promotions_read on public.public_diagnostic_promotions for select to authenticated
using (private.has_org_role(organization_id, array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_VIEWER']));
create policy public_diagnostic_findings_read on public.public_diagnostic_findings for select to authenticated
using (private.has_org_role(organization_id, array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_VIEWER']));
create policy public_diagnostic_opportunities_read on public.public_diagnostic_opportunities for select to authenticated
using (private.has_org_role(organization_id, array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER','CLIENT_VIEWER']));
grant select on public.public_diagnostic_promotions, public.public_diagnostic_findings, public.public_diagnostic_opportunities to authenticated;

create function public.promote_public_diagnostic_intake(p_intake_id uuid, p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  actor uuid := auth.uid();
  intake public.public_diagnostic_intakes%rowtype;
  existing public.public_diagnostic_promotions%rowtype;
  scored jsonb;
  finding jsonb;
  promotion_id uuid;
  finding_id uuid;
  ordinal integer := 0;
begin
  select * into intake from public.public_diagnostic_intakes where id = p_intake_id;
  if actor is null or not found or not private.has_org_role(intake.organization_id, array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'], actor) then
    raise exception 'PUBLIC_DIAGNOSTIC_PROMOTION_DENIED' using errcode = '42501';
  end if;
  if length(coalesce(p_idempotency_key, '')) not between 8 and 200 then
    raise exception 'PUBLIC_DIAGNOSTIC_PROMOTION_INVALID' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('public-diagnostic-promotion:' || intake.id::text, 0));
  select * into existing from public.public_diagnostic_promotions where intake_id = intake.id;
  if found then
    return jsonb_build_object('outcome','PUBLIC_DIAGNOSTIC_PROMOTED','promotion_id',existing.id,'score',existing.overall_score,'rating',existing.rating,'replayed',true);
  end if;
  scored := private.score_public_diagnostic_v1(intake.answers);
  insert into public.public_diagnostic_promotions(intake_id, organization_id, overall_score, rating, explanation, created_by)
  values (intake.id, intake.organization_id, (scored->>'score')::numeric, scored->>'rating', jsonb_build_object('policy_version','PUBLIC_DIAGNOSTIC_V1','formula','100 minus versioned deductions, floor 0','thresholds',jsonb_build_object('good',80,'attention',60,'important',40)), actor)
  returning id into promotion_id;
  for finding in select value from jsonb_array_elements(scored->'findings') loop
    ordinal := ordinal + 1;
    insert into public.public_diagnostic_findings(promotion_id, organization_id, finding_kind, code, severity, title_fr, title_ar, client_text_fr, client_text_ar, rule_snapshot)
    values (promotion_id, intake.organization_id, finding->>'kind', finding->>'code', finding->>'severity', finding->>'title_fr', finding->>'title_ar', finding->>'text_fr', finding->>'text_ar', jsonb_build_object('policy_version','PUBLIC_DIAGNOSTIC_V1','deduction',finding->'deduction'))
    returning id into finding_id;
    insert into public.public_diagnostic_findings(promotion_id, organization_id, finding_kind, code, severity, title_fr, title_ar, client_text_fr, client_text_ar, rule_snapshot)
    values (promotion_id, intake.organization_id, 'RECOMMENDATION', 'RECOMMEND_' || (finding->>'code'), finding->>'severity', finding->>'title_fr', finding->>'title_ar', finding->>'text_fr', finding->>'text_ar', jsonb_build_object('policy_version','PUBLIC_DIAGNOSTIC_V1','source',finding->>'code'));
    insert into public.public_diagnostic_opportunities(promotion_id, organization_id, finding_id, priority)
    values (promotion_id, intake.organization_id, finding_id, ordinal);
  end loop;
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (intake.organization_id, actor, 'USER', 'public_diagnostic.promoted', 'public_diagnostic_promotion', promotion_id::text, extensions.gen_random_uuid(), jsonb_build_object('intake_id',intake.id,'score',scored->>'score','rating',scored->>'rating','policy_version','PUBLIC_DIAGNOSTIC_V1'), repeat('0',64));
  return jsonb_build_object('outcome','PUBLIC_DIAGNOSTIC_PROMOTED','promotion_id',promotion_id,'score',scored->>'score','rating',scored->>'rating','replayed',false);
end;
$$;

create function public.act_on_public_diagnostic_opportunity(
  p_opportunity_id uuid,
  p_action text,
  p_deferred_until date,
  p_expected_row_version integer,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  actor uuid := auth.uid();
  opportunity public.public_diagnostic_opportunities%rowtype;
  next_status text;
begin
  select * into opportunity from public.public_diagnostic_opportunities where id = p_opportunity_id for update;
  if actor is null or not found or not private.has_org_role(opportunity.organization_id, array['CLIENT_OWNER','CLIENT_ADMIN','CLIENT_BUYER'], actor) then
    raise exception 'PUBLIC_DIAGNOSTIC_OPPORTUNITY_DENIED' using errcode = '42501';
  end if;
  if p_action not in ('CLOSE','DEFER','REQUEST_QUOTES') or length(coalesce(p_idempotency_key, '')) not between 8 and 200 or opportunity.row_version <> p_expected_row_version then
    raise exception 'PUBLIC_DIAGNOSTIC_OPPORTUNITY_INVALID' using errcode = '22023';
  end if;
  if opportunity.status <> 'DETECTED' or (p_action = 'DEFER' and (p_deferred_until is null or p_deferred_until <= current_date)) then
    raise exception 'PUBLIC_DIAGNOSTIC_OPPORTUNITY_TRANSITION_DENIED' using errcode = '55000';
  end if;
  next_status := case p_action when 'CLOSE' then 'CLOSED' when 'DEFER' then 'DEFERRED' else 'NEED_REQUESTED' end;
  update public.public_diagnostic_opportunities
  set status = next_status,
      deferred_until = case when p_action = 'DEFER' then p_deferred_until else null end,
      row_version = row_version + 1,
      updated_at = clock_timestamp()
  where id = opportunity.id and row_version = p_expected_row_version;
  if not found then raise exception 'STALE_PUBLIC_DIAGNOSTIC_OPPORTUNITY' using errcode = '40001'; end if;
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (opportunity.organization_id, actor, 'USER', 'public_diagnostic.opportunity.' || lower(p_action), 'public_diagnostic_opportunity', opportunity.id::text, extensions.gen_random_uuid(), jsonb_build_object('status',next_status,'idempotency_key',p_idempotency_key), repeat('0',64));
  return jsonb_build_object('outcome','PUBLIC_DIAGNOSTIC_OPPORTUNITY_' || p_action,'opportunity_id',opportunity.id,'status',next_status,'row_version',opportunity.row_version + 1);
end;
$$;
revoke all on function public.promote_public_diagnostic_intake(uuid,text), public.act_on_public_diagnostic_opportunity(uuid,text,date,integer,text) from public, anon, authenticated, service_role;
grant execute on function public.promote_public_diagnostic_intake(uuid,text), public.act_on_public_diagnostic_opportunity(uuid,text,date,integer,text) to authenticated;
notify pgrst, 'reload schema';
