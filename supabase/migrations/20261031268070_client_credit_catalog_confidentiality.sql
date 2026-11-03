-- Commercial catalogue terms are public to an authorized Client workspace.
-- Internal costs, margins, approval references and raw execution rules are not.
begin;
revoke select on public.benefit_versions,public.box_versions from public,anon,authenticated,service_role;
grant select(id,benefit_id,version,status,benefit_type,fulfillment_mode,name_fr,name_ar,description_fr,description_ar,
 credit_cost,reference_value_minor,currency,library_id,service_id,effective_from,effective_to,content_hash)
 on public.benefit_versions to authenticated;
grant select(id,box_id,version,status,box_type,name_fr,name_ar,credit_budget,rollover_months,currency,effective_from,effective_to,content_hash)
 on public.box_versions to authenticated;

create index customer_boxes_tenant_version_read_idx on public.customer_boxes(organization_id,box_version_id);
create index benefit_redemptions_tenant_version_read_idx on public.benefit_redemptions(organization_id,benefit_version_id);

create function public.list_client_credit_catalog_v1(p_organization_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare benefits jsonb;boxes jsonb;
begin
 if auth.uid()is null or p_organization_id is null or not private.credits_client_access(p_organization_id,auth.uid())then
  raise exception'CLIENT_CREDIT_CATALOG_DENIED'using errcode='42501';
 end if;
 -- Explicit columns only. Historical references authorize the exact version,
 -- never the rest of a retired catalogue or another organization's holdings.
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'benefit_type',v.benefit_type,
  'fulfillment_mode',v.fulfillment_mode,'name_fr',v.name_fr,'name_ar',v.name_ar,'description_fr',v.description_fr,
  'description_ar',v.description_ar,'credit_cost',v.credit_cost::text,'currency',v.currency,
  'effective_from',v.effective_from,'effective_to',v.effective_to,'library_id',v.library_id,
  'reservable',v.status='ACTIVE'and v.effective_from<=statement_timestamp()and(v.effective_to is null or v.effective_to>statement_timestamp()))
  order by v.name_fr,v.id),'[]'::jsonb)into benefits
 from public.benefit_versions v where v.status='ACTIVE'or v.id in(
  select r.benefit_version_id from public.benefit_redemptions r where r.organization_id=p_organization_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'box_type',v.box_type,
  'name_fr',v.name_fr,'name_ar',v.name_ar,'credit_budget',v.credit_budget::text,'rollover_months',v.rollover_months,
  'currency',v.currency,'effective_from',v.effective_from,'effective_to',v.effective_to)
  order by v.name_fr,v.id),'[]'::jsonb)into boxes
 from public.box_versions v where v.status='ACTIVE'or v.id in(
  select c.box_version_id from public.customer_boxes c where c.organization_id=p_organization_id);
 return jsonb_build_object('organization_id',p_organization_id,'benefits',benefits,'boxes',boxes);
end$$;
revoke all on function public.list_client_credit_catalog_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.list_client_credit_catalog_v1(uuid)to authenticated;

-- Admin already uses this privileged reader. Keep its complete DTO and role
-- checks, and require AAL2 before any internal cost or margin can be returned.
do $$declare definition text;needle text;
begin
 definition:=pg_get_functiondef('public.list_admin_boxes_dashboard(integer)'::regprocedure);
 needle:='if actor is null or not (private.credits_admin_access(actor)';
 if position(needle in definition)=0 then raise exception'ADMIN_BOX_COST_READ_GUARD_PATCH_MISMATCH';end if;
 execute replace(definition,needle,'if actor is null or auth.jwt()->>''aal''is distinct from''aal2'' or not (private.credits_admin_access(actor)');
end$$;
notify pgrst,'reload schema';
commit;
