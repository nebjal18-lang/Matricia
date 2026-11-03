-- Choice options carry an exact score. The diagnostic percentage records
-- SUM(answer_score * weight) / SUM(maximum_score * weight) * 100 beside the published rule score.
begin;

create function private.question_score_text(p_value jsonb) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select case jsonb_typeof(p_value)
  when 'number' then (p_value#>>'{}') ~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$'
  when 'string' then (p_value#>>'{}') ~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$'
  else false end
$$;

create function private.question_option_value(p_option jsonb) returns text
language sql immutable set search_path=pg_catalog as $$
 select case jsonb_typeof(p_option) when 'string' then btrim(p_option#>>'{}') when 'object' then btrim(p_option->>'value') else null end
$$;

create function private.question_options_valid(p_options jsonb,p_answer_type text,p_maximum jsonb,p_weight jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare v_option jsonb;v_score numeric;v_total numeric:=0;v_maximum numeric;v_weight numeric;v_values text[]:='{}';v_value text;
begin
 if jsonb_typeof(p_options)<>'array' then return false; end if;
 if p_answer_type not in('SINGLE_CHOICE','MULTIPLE_CHOICE') then return p_options='[]'::jsonb; end if;
 if jsonb_array_length(p_options)=0 then return true; end if;
 if not exists(select 1 from jsonb_array_elements(p_options) o where jsonb_typeof(o)<>'string') then
  return not exists(select 1 from jsonb_array_elements(p_options) o where length(btrim(o#>>'{}')) not between 1 and 500)
   and jsonb_array_length(p_options)=(select count(distinct btrim(o#>>'{}')) from jsonb_array_elements(p_options) o);
 end if;
 if exists(select 1 from jsonb_array_elements(p_options) o where jsonb_typeof(o)<>'object') or not private.question_score_text(p_maximum) or not private.question_score_text(p_weight) then return false; end if;
 v_maximum:=(p_maximum#>>'{}')::numeric;v_weight:=(p_weight#>>'{}')::numeric;
 if v_weight<=0 or v_maximum<=0 then return false; end if;
 for v_option in select value from jsonb_array_elements(p_options) loop
  v_value:=private.question_option_value(v_option);
  if (select count(*) from jsonb_object_keys(v_option))<>4 or not(v_option?&array['value','label_fr','label_ar','score'])
   or v_value is null or v_value!~'^[A-Za-z][A-Za-z0-9_.-]{0,79}$' or v_value=any(v_values)
   or length(btrim(v_option->>'label_fr')) not between 1 and 500 or length(btrim(v_option->>'label_ar')) not between 1 and 500
   or not private.question_score_text(v_option->'score') then return false; end if;
  v_score:=(v_option->>'score')::numeric;
  if v_score<0 or v_score>v_maximum then return false; end if;
  v_values:=array_append(v_values,v_value);v_total:=v_total+v_score;
 end loop;
 return p_answer_type<>'MULTIPLE_CHOICE' or v_total<=v_maximum;
end $$;

create or replace function private.assert_question_builder_payload_v1(p_library_id uuid,p_scope text,p_payload jsonb) returns void
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare v_service uuid;
begin
 if p_library_id is null or p_scope not in('GLOBAL','LIBRARY','CATEGORY','SUBCATEGORY','SERVICE') or jsonb_typeof(p_payload)<>'object'
  or not(p_payload?&array['label_fr','label_ar','answer_type','data_key','required_by_default','required_for_quote','required_for_publication','options','validation_schema','sensitivity','nullable','weight','maximum_score'])
  or exists(select 1 from jsonb_object_keys(p_payload)k where k not in('label_fr','label_ar','help_fr','help_ar','why_we_ask_fr','why_we_ask_ar','answer_type','data_key','required_by_default','required_for_quote','required_for_publication','options','validation_schema','structured_schema','visibility_rule','default_value','prefill_source','sensitivity','nullable','weight','maximum_score','template_key','validity_seconds','source_service_id'))
  or length(btrim(coalesce(p_payload->>'label_fr',''))) not between 1 and 1000 or length(btrim(coalesce(p_payload->>'label_ar',''))) not between 1 and 1000
  or coalesce(p_payload->>'answer_type','') not in('YES_NO','SINGLE_CHOICE','MULTIPLE_CHOICE','SHORT_TEXT','LONG_TEXT','INTEGER','DECIMAL','PERCENTAGE','MONEY','CURRENCY','DATE','DATE_RANGE','TIME','EMAIL','PHONE','URL','ADDRESS','GEO_AREA','RATING_5','RATING_10','QUANTITY','UNIT_VALUE','FILE','MULTI_FILE','IMAGE','TABLE','REPEATER','CONTACT','ORGANIZATION','PRODUCT_LIST','SITE_LIST','MILESTONE_LIST','BUDGET_BREAKDOWN')
  or coalesce(p_payload->>'data_key','')!~'^[A-Za-z][A-Za-z0-9_.-]{1,159}$'
  or jsonb_typeof(p_payload->'required_by_default')<>'boolean' or jsonb_typeof(p_payload->'required_for_quote')<>'boolean' or jsonb_typeof(p_payload->'required_for_publication')<>'boolean' or jsonb_typeof(p_payload->'nullable')<>'boolean'
  or jsonb_typeof(p_payload->'options')<>'array' or jsonb_typeof(p_payload->'validation_schema')<>'object'
  or coalesce(p_payload->>'sensitivity','') not in('PUBLIC','BUSINESS','CONFIDENTIAL','RESTRICTED')
  or not private.question_score_text(p_payload->'weight') or not private.question_score_text(p_payload->'maximum_score')
  or not private.question_options_valid(p_payload->'options',p_payload->>'answer_type',p_payload->'maximum_score',p_payload->'weight')
  or (p_payload->>'answer_type' not in('SINGLE_CHOICE','MULTIPLE_CHOICE') and p_payload->'options'<>'[]'::jsonb)
  or (p_payload->>'answer_type' in('TABLE','REPEATER')) is distinct from (jsonb_typeof(p_payload->'structured_schema')='object')
  or (p_payload?'visibility_rule' and jsonb_typeof(p_payload->'visibility_rule') not in('object','null'))
  or (p_payload?'prefill_source' and p_payload->>'prefill_source' is not null and p_payload->>'prefill_source' not in('PROFILE','ORGANIZATION','SITE','PREVIOUS_ANSWER','DOCUMENT'))
  or (p_payload?'template_key' and p_payload->>'template_key' is not null and length(btrim(p_payload->>'template_key')) not between 1 and 160)
  or (p_payload?'validity_seconds' and (jsonb_typeof(p_payload->'validity_seconds')<>'number' or (p_payload->>'validity_seconds')!~'^[1-9][0-9]{0,8}$')) then raise exception 'INVALID_CATALOG_QUESTION' using errcode='22023';end if;
 if p_scope='SERVICE' then
  begin v_service:=(p_payload->>'source_service_id')::uuid;exception when others then raise exception 'INVALID_CATALOG_QUESTION' using errcode='22023';end;
  if not exists(select 1 from public.catalog_services s where s.id=v_service and s.library_id=p_library_id and s.status not in('RETIRED','ARCHIVED')) then raise exception 'CATALOG_QUESTION_SERVICE_SCOPE_MISMATCH' using errcode='23514';end if;
 elsif p_payload?'source_service_id' and p_payload->>'source_service_id' is not null then raise exception 'CATALOG_QUESTION_SERVICE_SCOPE_MISMATCH' using errcode='23514';end if;
end $$;

create function private.question_option_score(p_options jsonb,p_value text) returns numeric
language sql stable set search_path=pg_catalog as $$
 select min((o->>'score')::numeric) from jsonb_array_elements(coalesce(p_options,'[]'::jsonb)) o
 where jsonb_typeof(o)='object' and private.question_option_value(o)=p_value and private.question_score_text(o->'score')
$$;

create function private.resolve_answer_score(p_answer_type text,p_options jsonb,p_maximum numeric,p_value jsonb) returns numeric
language plpgsql stable set search_path=pg_catalog as $$
declare v_score numeric;v_item jsonb;v_found numeric;
begin
 if p_value is null or p_value='null'::jsonb or p_maximum is null or p_maximum<0 then return null; end if;
 if p_answer_type='SINGLE_CHOICE' and jsonb_typeof(p_value)='string' then v_score:=private.question_option_score(p_options,p_value#>>'{}');
 elsif p_answer_type='MULTIPLE_CHOICE' and jsonb_typeof(p_value)='array' then
  v_score:=0;
  for v_item in select value from jsonb_array_elements(p_value) loop
   if jsonb_typeof(v_item)<>'string' then return null; end if;
   v_found:=private.question_option_score(p_options,v_item#>>'{}');
   if v_found is null then return null; end if;
   v_score:=v_score+v_found;
  end loop;
 elsif jsonb_typeof(p_value)='number' and private.question_score_text(p_value) then v_score:=(p_value#>>'{}')::numeric;
 elsif jsonb_typeof(p_value)='object' and p_value->>'kind' in('INTEGER','DECIMAL') and private.question_score_text(p_value->'value') then v_score:=(p_value->>'value')::numeric;
 elsif jsonb_typeof(p_value)='object' and p_value?'score' and private.question_score_text(p_value->'score') then v_score:=(p_value->>'score')::numeric;
 else return null; end if;
 if v_score<0 or v_score>p_maximum then return null; end if;
 return v_score;
end $$;

create function private.weighted_question_percentage(p_items jsonb) returns numeric
language plpgsql immutable set search_path=pg_catalog as $$
declare v_item jsonb;v_points numeric:=0;v_maximum numeric:=0;v_weight numeric;v_max numeric;v_answer numeric;v_counted integer:=0;
begin
 if jsonb_typeof(p_items)<>'array' then return null; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if not private.question_score_text(v_item->'weight') or not private.question_score_text(v_item->'maximum_score') or not private.question_score_text(v_item->'answer_score') then return null; end if;
  v_weight:=(v_item->>'weight')::numeric;v_max:=(v_item->>'maximum_score')::numeric;v_answer:=(v_item->>'answer_score')::numeric;
  if v_answer<0 or (v_max>0 and v_answer>v_max) then return null; end if;
  if v_weight=0 or v_max=0 then continue; end if;
  v_points:=v_points+v_answer*v_weight;v_maximum:=v_maximum+v_max*v_weight;v_counted:=v_counted+1;
 end loop;
 if v_counted=0 or v_maximum<=0 or v_points>v_maximum then return null; end if;
 return round(v_points/v_maximum*100,2);
end $$;

create function private.session_question_percentage(p_session_id uuid) returns numeric
language sql stable security definer set search_path=pg_catalog as $$
 select private.weighted_question_percentage(coalesce((select jsonb_agg(jsonb_build_object(
  'weight',qv.weight,'maximum_score',qv.maximum_score,
  'answer_score',private.resolve_answer_score(qv.answer_type,qv.options,qv.maximum_score,ar.value)))
  from public.questionnaire_answers qa
  join public.questionnaire_answer_revisions ar on ar.id=qa.current_revision_id
  join public.question_versions qv on qv.id=qa.question_version_id
  where qa.session_id=p_session_id and qv.weight>0 and qv.maximum_score>0
   and private.resolve_answer_score(qv.answer_type,qv.options,qv.maximum_score,ar.value) is not null),'[]'::jsonb))
$$;

create or replace function private.is_valid_question_answer(p_question public.question_versions,p_value jsonb) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_labels jsonb;
begin
 if not private.question_options_valid(p_question.options,p_question.answer_type,to_jsonb(p_question.maximum_score),to_jsonb(p_question.weight)) then return false; end if;
 select coalesce(jsonb_agg(to_jsonb(private.question_option_value(item.value)) order by item.ordinality),'[]'::jsonb) into v_labels from jsonb_array_elements(p_question.options) with ordinality as item(value, ordinality);
 return private.is_valid_typed_question_answer(p_question.answer_type,p_question.nullable,v_labels,jsonb_build_object('precision',coalesce((p_question.validation_schema->>'precision')::integer,1000),'scale',coalesce((p_question.validation_schema->>'scale')::integer,case when p_question.answer_type in('INTEGER','RATING_5','RATING_10') then 0 else 1000 end),'rounding',coalesce(p_question.validation_schema->>'rounding','HALF_EVEN')),p_question.validation_schema,p_question.structured_schema,p_value);
end $$;

create or replace function private.is_valid_question_metadata(p_question public.question_versions) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_labels jsonb;
begin
 if not private.question_options_valid(p_question.options,p_question.answer_type,to_jsonb(p_question.maximum_score),to_jsonb(p_question.weight)) then return false; end if;
 select coalesce(jsonb_agg(to_jsonb(private.question_option_value(item.value)) order by item.ordinality),'[]'::jsonb) into v_labels from jsonb_array_elements(p_question.options) with ordinality as item(value, ordinality);
 return private.is_valid_typed_question_metadata(p_question.answer_type,v_labels,case when p_question.answer_type in('INTEGER','DECIMAL','PERCENTAGE','QUANTITY','UNIT_VALUE','RATING_5','RATING_10') then jsonb_build_object('precision',coalesce((p_question.validation_schema->>'precision')::integer,1000),'scale',coalesce((p_question.validation_schema->>'scale')::integer,case when p_question.answer_type in('INTEGER','RATING_5','RATING_10') then 0 else 1000 end),'rounding',coalesce(p_question.validation_schema->>'rounding','HALF_EVEN')) else '{}'::jsonb end,p_question.validation_schema,p_question.structured_schema);
end $$;

create function private.attach_question_percentage() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 new.explanation:=coalesce(new.explanation,'{}'::jsonb)||jsonb_build_object('question_formula','SUM(answer_score*weight)/SUM(maximum_score*weight)*100','question_weighted_percentage',private.session_question_percentage(new.questionnaire_session_id));
 return new;
end $$;

create trigger diagnostic_runs_question_percentage before insert on public.diagnostic_runs
for each row execute function private.attach_question_percentage();

revoke all on function private.question_score_text(jsonb),private.question_option_value(jsonb),private.question_options_valid(jsonb,text,jsonb,jsonb),private.question_option_score(jsonb,text),private.resolve_answer_score(text,jsonb,numeric,jsonb),private.weighted_question_percentage(jsonb),private.session_question_percentage(uuid),private.attach_question_percentage() from public,anon,authenticated,service_role;

commit;
