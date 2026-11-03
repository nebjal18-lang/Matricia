begin;
-- Optional for existing historical revisions. New composers author explicit
-- terms; the immutable quote JSON/hash and contract snapshot preserve them.
alter table public.quote_versions add constraint quote_commercial_terms_shape_v1 check(
 not(sla?'commercial_terms_v1')or coalesce((
 jsonb_typeof(sla->'commercial_terms_v1')='object'
 and((sla->'commercial_terms_v1')-array['source_locale','payment_terms','maintenance_terms'])='{}'::jsonb
 and sla#>>'{commercial_terms_v1,source_locale}'in('fr','ar')
 and jsonb_typeof(sla#>'{commercial_terms_v1,payment_terms}')='string'
 and length(btrim(sla#>>'{commercial_terms_v1,payment_terms}'))between 3 and 2000
 and jsonb_typeof(sla#>'{commercial_terms_v1,maintenance_terms}')='string'
 and length(sla#>>'{commercial_terms_v1,maintenance_terms}')<=2000
 ),false));
commit;
