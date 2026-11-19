-- Admin read-only supervision of franchise network invitations (steps 3–4 bridge).
-- Does not queue, send, or impersonate franchise invites.
-- Rollback: drop function + revoke.

create or replace function public.get_admin_network_invitations_supervision_v1(p_locale text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  actor uuid := auth.uid();
  rows jsonb;
begin
  if actor is null or not private.has_platform_role(array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'COMPLIANCE_MANAGER'], actor) then
    raise exception 'ADMIN_NETWORK_INVITE_SUPERVISION_DENIED' using errcode = '42501';
  end if;
  if coalesce(auth.jwt()->>'aal', '') is distinct from 'aal2' then
    raise exception 'ADMIN_NETWORK_INVITE_SUPERVISION_MFA_REQUIRED' using errcode = '42501';
  end if;
  if p_locale is null or p_locale not in ('fr', 'ar') then
    raise exception 'ADMIN_NETWORK_INVITE_SUPERVISION_INVALID' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(item order by sort_at desc, id), '[]'::jsonb)
  into rows
  from (
    select
      i.id,
      i.created_at as sort_at,
      jsonb_build_object(
        'id', i.id,
        'franchiseId', i.franchise_id,
        'status', i.status,
        'prospectType', i.prospect_type,
        'contactEmailMasked',
          case
            when position('@' in i.contact_email::text) > 1 then
              left(i.contact_email::text, 1) || '***@' || split_part(i.contact_email::text, '@', 2)
            else '***'
          end,
        'locale', i.locale,
        'deliveryMode', coalesce(i.delivery_mode, ''),
        'queuedAt', i.created_at,
        'sentAt', i.sent_at,
        'openedAt', i.opened_at,
        'registeredAt', i.registered_at,
        'expiresAt', i.expires_at,
        'referralOrganizationId', r.target_organization_id,
        'operatorLabel', case f.operator_code
          when 'HATIM_AHMITECH' then 'Hatim Ahmitech'
          when 'FRANCHISEE' then case when p_locale = 'ar' then 'صاحب امتياز' else 'Franchisé' end
          else initcap(replace(f.operator_code, '_', ' '))
        end,
        'statusLabel', case i.status
          when 'QUEUED' then case when p_locale = 'ar' then 'في الانتظار' else 'En file' end
          when 'SENT' then case when p_locale = 'ar' then 'مُرسل' else 'Envoyé' end
          when 'OPENED' then case when p_locale = 'ar' then 'مفتوح' else 'Ouvert' end
          when 'REGISTERED' then case when p_locale = 'ar' then 'مسجّل' else 'Inscrit' end
          when 'EXPIRED' then case when p_locale = 'ar' then 'منتهٍ' else 'Expiré' end
          when 'REVOKED' then case when p_locale = 'ar' then 'ملغى' else 'Révoqué' end
          else i.status
        end
      ) as item
    from public.franchise_network_invitations i
    join public.franchises f on f.id = i.franchise_id
    left join public.franchise_network_referrals r on r.invitation_id = i.id
    order by i.created_at desc, i.id
    limit 500
  ) page;

  return jsonb_build_object(
    'rows', rows,
    'snapshotAt', statement_timestamp(),
    'complete', true,
    'readOnly', true
  );
end;
$$;

revoke all on function public.get_admin_network_invitations_supervision_v1(text) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_network_invitations_supervision_v1(text) to authenticated;
