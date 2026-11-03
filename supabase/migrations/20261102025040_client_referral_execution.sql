begin;
-- Reject a member registering their own second organization as a referral.
-- Direct RPC invocation is covered too, not only the native landing form.
create function private.guard_referral_self_attribution_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 if private.is_active_org_member(new.source_organization_id,new.registered_by)then raise exception 'SELF_REFERRAL_DENIED'using errcode='42501';end if;
 if exists(select 1 from public.organization_memberships source_member join public.organization_member_roles source_role on source_role.membership_id=source_member.id and source_role.revoked_at is null and source_role.role_code in('CLIENT_OWNER','PROVIDER_OWNER')join public.organization_memberships target_member on target_member.user_id=source_member.user_id and target_member.organization_id=new.target_organization_id and target_member.status='ACTIVE'join public.organization_member_roles target_role on target_role.membership_id=target_member.id and target_role.revoked_at is null and target_role.role_code in('CLIENT_OWNER','PROVIDER_OWNER')where source_member.organization_id=new.source_organization_id and source_member.status='ACTIVE')then raise exception 'SELF_REFERRAL_OWNER_DENIED'using errcode='42501';end if;
 return new;
end$$;
create trigger referral_self_attribution_guard_v1 before insert on public.referral_conversions for each row execute function private.guard_referral_self_attribution_v1();
revoke all on function private.guard_referral_self_attribution_v1()from public,anon,authenticated,service_role;

create function public.claim_client_referral_v1(p_referral_code text,p_target_organization_id uuid,p_consent boolean,p_idempotency_key text)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();l public.referral_links%rowtype;c public.referral_conversions%rowtype;proof jsonb;proof_hash text;visitor_hash text;r jsonb;
begin
 if a is null or not coalesce(p_consent,false)or not coalesce(private.has_org_role(p_target_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],a),false)then raise exception 'REFERRAL_CLAIM_DENIED'using errcode='42501';end if;
 select * into l from public.referral_links where referral_code=upper(p_referral_code)and audience_type='CLIENT'and status='ACTIVE'and expires_at>clock_timestamp();
 if l.id is null or private.is_active_org_member(l.source_organization_id,a)then raise exception 'REFERRAL_CLAIM_DENIED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('referral-claim:'||p_target_organization_id::text,0));
 select * into c from public.referral_conversions where target_organization_id=p_target_organization_id;
 if c.id is not null then
  if c.referral_link_id<>l.id then raise exception 'REFERRAL_ALREADY_ATTRIBUTED'using errcode='55000';end if;
  return jsonb_build_object('outcome','REFERRAL_REGISTERED','referral_conversion_id',c.id,'conversion_stage',c.conversion_stage);
 end if;
 proof:=jsonb_build_object('registry','ORGANIZATION_REGISTRATION','id',p_target_organization_id,'consent_version','REFERRAL_ATTRIBUTION_V1','consented_by',a);
 proof_hash:=private.canonical_request_hash(proof);
 visitor_hash:=private.canonical_request_hash(jsonb_build_object('actor',a,'target',p_target_organization_id,'link',l.id));
 perform public.record_referral_touchpoint(l.referral_code,'REGISTRATION_STARTED',visitor_hash,'referral-touch:'||p_target_organization_id::text||':'||l.id::text);
 r:=public.register_referral_conversion(l.referral_code,p_target_organization_id,jsonb_build_object('entry','CONSENTED_LINK','consent_version','REFERRAL_ATTRIBUTION_V1','consent_accepted',true),jsonb_build_array(proof),proof_hash,p_idempotency_key);
 return r;
end$$;
revoke all on function public.claim_client_referral_v1(text,uuid,boolean,text)from public,anon,authenticated,service_role;
grant execute on function public.claim_client_referral_v1(text,uuid,boolean,text)to authenticated;

-- An activated referral is a verified source for its real referrer as well.
create or replace function private.valid_reward_organization_source(p_organization_id uuid,p_source_type text,p_source_id text)returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$declare x uuid;begin
 if p_source_id!~'^[0-9a-f-]{36}$'then return false;end if;x:=p_source_id::uuid;
 return case p_source_type
 when 'DIAGNOSTIC_RECOMMENDATION'then exists(select 1 from public.diagnostic_recommendations q where q.id=x and q.organization_id=p_organization_id)
 when 'DIAGNOSTIC_OPPORTUNITY'then exists(select 1 from public.diagnostic_opportunities q where q.id=x and q.organization_id=p_organization_id)
 when 'CLIENT_PROJECT'then exists(select 1 from public.client_projects q where q.id=x and q.organization_id=p_organization_id)
 when 'CONTRACT'then exists(select 1 from public.contracts q where q.id=x and q.client_organization_id=p_organization_id)
 when 'REFERRAL_CONVERSION'then exists(select 1 from public.referral_conversions q where q.id=x and q.source_organization_id=p_organization_id and q.conversion_stage='ACTIVE')else false end;
 exception when invalid_text_representation then return false;
end$$;

-- The existing transition still requires the real verification and independent
-- AAL2 actors. No cron fabricates a verification or grants a bonus by itself.
create function private.record_activated_client_referral_sources_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare c public.referral_conversions%rowtype;details jsonb;proof jsonb;
begin
 if new.to_stage<>'ACTIVE'then return new;end if;
 select * into c from public.referral_conversions where id=new.referral_conversion_id and audience_type='CLIENT'and conversion_stage='ACTIVE';
 if c.id is null then return new;end if;
 details:=jsonb_build_object('conversion_stage','ACTIVE','audience_type',c.audience_type,'source_organization_id',c.source_organization_id,'target_organization_id',c.target_organization_id);
 proof:=jsonb_build_array(jsonb_build_object('registry','REFERRAL_CONVERSION_EVENT','id',new.id::text));
 perform public.record_reward_source_event(c.target_organization_id,'REFERRAL_VERIFIED','REFERRED_CLIENT','REFERRAL_CONVERSION',c.id::text,details,proof,new.evidence_hash,new.occurred_at,'referral-recipient-source:'||c.id::text,new.correlation_id);
 perform public.record_reward_source_event(c.source_organization_id,'REFERRAL_VERIFIED','CLIENT_ORGANIZATION','REFERRAL_CONVERSION',c.id::text,details,proof,new.evidence_hash,new.occurred_at,'referral-source:'||c.id::text,new.correlation_id);
 return new;
end$$;
create trigger activated_client_referral_sources_v1 after insert on public.referral_conversion_events for each row execute function private.record_activated_client_referral_sources_v1();
revoke all on function private.record_activated_client_referral_sources_v1()from public,anon,authenticated,service_role;

-- Execution is transactional with the independent approval and uses the existing
-- award command, caps, cooldown, wallet-audience guard, ledger and outbox.
create function private.execute_approved_client_referral_reward_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare e public.reward_source_events%rowtype;w uuid;anti_abuse text;
begin
 if new.decision<>'APPROVED'then return new;end if;
 select * into e from public.reward_source_events where id=new.source_event_id and source_reference_type='REFERRAL_CONVERSION'and audience_type in('REFERRED_CLIENT','CLIENT_ORGANIZATION');
 if e.id is null then return new;end if;
 perform public.ensure_client_credit_wallet(e.organization_id,'referral-wallet:'||e.organization_id::text,new.correlation_id);
 select id into w from public.credit_wallets where organization_id=e.organization_id and wallet_type='CLIENT';
 if w is null then raise exception 'CLIENT_REWARD_WALLET_REQUIRED'using errcode='55000';end if;
 anti_abuse:=private.canonical_request_hash(jsonb_build_object('source',e.source_reference_type,'id',e.source_reference_id,'recipient',e.organization_id));
 perform public.award_reward(e.organization_id,w,new.rule_version_id,e.source_reference_type,e.source_reference_id,anti_abuse,jsonb_build_object('source_event_id',e.id),new.id::text,'approved-referral-award:'||new.id::text,new.correlation_id);
 return new;
end$$;
create trigger approved_client_referral_reward_v1 after insert on public.reward_award_approvals for each row execute function private.execute_approved_client_referral_reward_v1();
revoke all on function private.execute_approved_client_referral_reward_v1()from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
