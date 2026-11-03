begin;
-- Only admission of a NEW offer changes. Already frozen payment promises and
-- historical assignments never re-read current publication/lifecycle status.
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('private.freeze_subscription_box_checkout_terms_v1()'::regprocedure);
 needle:=' select coalesce(jsonb_agg(jsonb_build_object(''approval_id'',a.id';
 if strpos(definition,needle)=0 then raise exception'BOX_CHECKOUT_RULE_LOCK_PATCH_MISMATCH';end if;
 definition:=replace(definition,needle,
 ' perform r.id from public.plan_box_rules r where r.id in(select a.plan_box_rule_id from public.box_configuration_approvals_v1 a where a.source_snapshot->>''plan_version_id''=p.plan_version_id::text)order by r.id for share;'||chr(10)||needle);
 needle:='into options,rollovers from public.box_configuration_approvals_v1 a join public.box_versions b on b.id=(a.source_snapshot->>''box_version_id'')::uuid';
 if strpos(definition,needle)=0 then raise exception'BOX_CHECKOUT_RULE_SOURCE_PATCH_MISMATCH';end if;
 definition:=replace(definition,needle,needle||' join public.plan_box_rules rule on rule.id=a.plan_box_rule_id and rule.plan_version_id=p.plan_version_id and rule.box_version_id=b.id and rule.status=''ACTIVE''');
 execute definition;
end$$;
commit;
