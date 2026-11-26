begin;

-- SECURITY DEFINER changes current_user to the function owner. Check the
-- selected database role, which cannot be assumed without role membership.
create or replace function public.submit_franchise_application(
  p_applicant_name text,
  p_reply_email text,
  p_territory_code text,
  p_professional_profile text,
  p_domain_label text,
  p_availability_label text,
  p_motivation text,
  p_locale text,
  p_ip_hash text
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare
  application_id uuid;
  normalized_email text := lower(btrim(coalesce(p_reply_email, '')));
begin
  if coalesce(current_setting('role', true), 'none') <> 'service_role' then
    raise exception 'FRANCHISE_APPLICATION_DENIED' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_applicant_name, ''))) not between 2 and 120
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or length(normalized_email) > 254
     or p_territory_code not in (
       'TANGER_TETOUAN_AL_HOCEIMA','ORIENTAL','FES_MEKNES','RABAT_SALE_KENITRA','BENI_MELLAL_KHENIFRA',
       'CASABLANCA_SETTAT','MARRAKECH_SAFI','DRAA_TAFILALET','SOUSS_MASSA','GUELMIM_OUED_NOUN',
       'LAAYOUNE_SAKIA_EL_HAMRA','DAKHLA_OUED_ED_DAHAB'
     )
     or length(btrim(coalesce(p_professional_profile, ''))) not between 2 and 80
     or length(btrim(coalesce(p_domain_label, ''))) not between 2 and 200
     or length(btrim(coalesce(p_availability_label, ''))) not between 2 and 80
     or length(btrim(coalesce(p_motivation, ''))) not between 40 and 800
     or p_locale not in ('fr','ar')
     or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'FRANCHISE_APPLICATION_INVALID' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('franchise-application:ip:' || p_ip_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('franchise-application:email:' || normalized_email, 0));
  if (select count(*) from public.franchise_applications where ip_hash = p_ip_hash and created_at > clock_timestamp() - interval '1 hour') >= 5
     or (select count(*) from public.franchise_applications where reply_email = normalized_email and created_at > clock_timestamp() - interval '1 day') >= 3 then
    raise exception 'FRANCHISE_APPLICATION_RATE_LIMITED' using errcode = 'P0001';
  end if;
  insert into public.franchise_applications(
    applicant_name, reply_email, territory_code, professional_profile, domain_label, availability_label, motivation, locale, ip_hash
  ) values (
    btrim(p_applicant_name), normalized_email, p_territory_code, btrim(p_professional_profile), btrim(p_domain_label),
    btrim(p_availability_label), btrim(p_motivation), p_locale, p_ip_hash
  ) returning id into application_id;
  insert into public.franchise_application_events(application_id, from_status, to_status, reason, idempotency_key)
  values (application_id, null, 'REGISTERED', 'PUBLIC_CANDIDATURE', 'submit:' || application_id::text);
  return application_id;
end;
$$;

-- Restore the current-family projection and partner-contract wrapper while retaining activitySummary.
create or replace function private.franchise_provider_dossiers_v1(p_franchise_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare f public.franchises%rowtype;result jsonb;
begin
 if not private.active_franchise_messaging_scope(p_franchise_id)then raise exception 'FRANCHISE_PROVIDER_SCOPE_DENIED'using errcode='42501';end if;
 select * into f from public.franchises where id=p_franchise_id;
 select coalesce(jsonb_agg(jsonb_build_object(
  'organizationId',p.provider_organization_id,
  'name',o.display_name,
  'companyStatus',p.company_status,
  'status',p.overall_status,
  'createdAt',p.created_at,
  'teamSize',p.team_size,
  'activitySummary',p.activity_summary,
  'regions',coalesce((select to_jsonb(r.region_codes)from public.provider_region_versions r where r.provider_organization_id=p.provider_organization_id order by r.version_number desc limit 1),'[]'::jsonb),
  'qualifications',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'serviceId',q.service_id,'serviceCode',s.code,'status',coalesce(d.status,'PENDING'),'rowVersion',q.row_version)order by s.code)from public.provider_qualifications q join public.catalog_services s on s.id=q.service_id left join public.provider_qualification_decisions d on d.id=q.current_decision_id where q.provider_organization_id=p.provider_organization_id and s.library_id=f.library_id),'[]'::jsonb),
  'capacities',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'serviceId',c.service_id,'serviceCode',c.code,'status',c.capacity_status,'availableUnits',c.available_units,'leadTimeDays',c.lead_time_days)order by c.code)from(select distinct on(v.service_id)v.*,s.code from public.provider_capacity_versions v join public.catalog_services s on s.id=v.service_id where v.provider_organization_id=p.provider_organization_id and s.library_id=f.library_id and v.effective_from<=now()and(v.effective_until is null or v.effective_until>now())order by v.service_id,v.version_number desc)c),'[]'::jsonb),
  'documents',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'kind',v.document_kind,'code',v.code,'status',v.status,'expiresOn',v.expires_on)order by v.code)from(select distinct on(d.family_id)d.id,d.status,d.expires_on,d.family_id,d.version_number,family.document_kind,family.code from public.provider_document_versions d join public.provider_document_families family on family.id=d.family_id where d.provider_organization_id=p.provider_organization_id and not exists(select 1 from public.provider_document_versions newer where newer.family_id=d.family_id and newer.version_number>d.version_number) and exists(select 1 from public.provider_document_service_links link join public.provider_services ps on ps.id=link.provider_service_id join public.catalog_services s on s.id=ps.service_id where link.document_version_id=d.id and s.library_id=f.library_id)order by d.family_id,d.version_number desc)v),'[]'::jsonb)
 )order by o.display_name,p.provider_organization_id),'[]'::jsonb)into result
 from public.provider_profiles p join public.organizations o on o.id=p.provider_organization_id where exists(select 1 from public.provider_services ps join public.catalog_services s on s.id=ps.service_id where ps.provider_organization_id=p.provider_organization_id and s.library_id=f.library_id);
 return result;
end$$;

create or replace function public.franchise_provider_dossiers(p_franchise_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 select coalesce(jsonb_agg(provider || jsonb_build_object('partnerContract',(
 select jsonb_build_object('id',d.id,'version',d.decision_version,'status',case when d.partner_contract_status='SIGNED'and d.partner_contract_expires_at<=statement_timestamp()then'EXPIRED'else d.partner_contract_status end,'expiresAt',d.partner_contract_expires_at,'decidedAt',d.decided_at,'ruleVersion',d.rule_version,'reason',d.reason)
 from public.provider_company_decisions d where d.provider_organization_id=(provider->>'organizationId')::uuid order by d.decision_version desc limit 1))order by provider->>'name',provider->>'organizationId'),'[]'::jsonb)into result
 from jsonb_array_elements(private.franchise_provider_dossiers_v1(p_franchise_id))provider;
 return result;
end$$;

commit;
