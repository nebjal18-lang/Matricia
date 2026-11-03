-- Activation is either backed by an exact verified mandate signature, or an explicit
-- non-contractual simulation in the database owner's DEVELOPMENT/STAGING environment.
alter table public.franchises add column activation_mode text check(activation_mode in('CONTRACTUAL','NON_CONTRACTUAL_DEMO'));
create table public.franchise_activation_evidence(
 invitation_id uuid primary key references public.franchise_invitations(id)on delete restrict,
 franchise_id uuid not null references public.franchises(id)on delete restrict,
 approved_mandate_version_id uuid not null references public.franchise_mandate_versions(id)on delete restrict,
 active_mandate_version_id uuid not null references public.franchise_mandate_versions(id)on delete restrict,
 mandate_hash text not null check(mandate_hash~'^[0-9a-f]{64}$'),
 activation_mode text not null check(activation_mode in('CONTRACTUAL','NON_CONTRACTUAL_DEMO')),
 environment text not null check(environment in('DEVELOPMENT','STAGING','PRODUCTION')),
 actor_user_id uuid not null references auth.users(id),
 legal_proof_snapshot jsonb,
 evidence_snapshot jsonb not null check(jsonb_typeof(evidence_snapshot)='object'),
 evidence_hash text not null check(evidence_hash~'^[0-9a-f]{64}$'),
 recorded_at timestamptz not null default clock_timestamp(),
 check((activation_mode='NON_CONTRACTUAL_DEMO'and environment in('DEVELOPMENT','STAGING')and legal_proof_snapshot is null)or(activation_mode='CONTRACTUAL'and jsonb_typeof(legal_proof_snapshot)='object'))
);
alter table public.franchise_activation_evidence enable row level security;
create policy franchise_activation_evidence_read on public.franchise_activation_evidence for select to authenticated using(private.franchise_access(franchise_id)or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','READ_ONLY_AUDITOR']));
revoke all on public.franchise_activation_evidence from public,anon,authenticated,service_role;
grant select on public.franchise_activation_evidence to authenticated;
create function private.prevent_franchise_activation_evidence_mutation()returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin raise exception 'IMMUTABLE_FRANCHISE_ACTIVATION_EVIDENCE'using errcode='55000';end$$;
revoke all on function private.prevent_franchise_activation_evidence_mutation()from public,anon,authenticated,service_role;
create trigger franchise_activation_evidence_immutable before update or delete on public.franchise_activation_evidence for each row execute function private.prevent_franchise_activation_evidence_mutation();

create function private.franchise_mandate_signature_reference_or_null(p_franchise_id uuid,p_mandate_version_id uuid,p_mandate_hash text,p_operator_org_id uuid,p_actor uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare proof jsonb;effective boolean;
begin
 -- The legal adapter is supplied independently. Missing provider/policy/issuer/level or
 -- a mandate-specific bridge is a closed gate, never a caller-supplied boolean proof.
 if to_regprocedure('private.franchise_mandate_signature_effective_v1(uuid,uuid,text,uuid,uuid)')is null or to_regprocedure('private.franchise_mandate_signature_reference_v1(uuid,uuid,text,uuid,uuid)')is null then return null;end if;
 execute 'select private.franchise_mandate_signature_effective_v1($1,$2,$3,$4,$5)'into effective using p_franchise_id,p_mandate_version_id,p_mandate_hash,p_operator_org_id,p_actor;
 if effective is distinct from true then return null;end if;
 execute 'select private.franchise_mandate_signature_reference_v1($1,$2,$3,$4,$5)'into proof using p_franchise_id,p_mandate_version_id,p_mandate_hash,p_operator_org_id,p_actor;
 if jsonb_typeof(proof)is distinct from'object'or proof='{}'::jsonb then return null;end if;
 return proof;
end$$;
revoke all on function private.franchise_mandate_signature_reference_or_null(uuid,uuid,text,uuid,uuid)from public,anon,authenticated,service_role;

create function private.accept_franchise_activation_v1(p_invitation_id uuid,p_token_hash text,p_expected_row_version integer,p_expected_mandate_version_id uuid,p_expected_mandate_hash text,p_activation_mode text,p_demo_confirmed boolean,p_idempotency_key text,p_correlation_id uuid)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();invite public.franchise_invitations%rowtype;franchise public.franchises%rowtype;mandate public.franchise_mandate_versions%rowtype;existing public.franchise_activation_evidence%rowtype;org uuid;membership uuid;email text;verified timestamptz;org_status text;environment text;proof jsonb;snapshot jsonb;proof_hash text;h text;result jsonb;active_m uuid;next_version integer;previous_franchise uuid;legacy record;decision uuid;
begin
 if actor is null then raise exception 'FRANCHISE_INVITATION_ACCEPT_DENIED'using errcode='42501';end if;
 if p_activation_mode is null or p_activation_mode not in('CONTRACTUAL','NON_CONTRACTUAL_DEMO')or p_expected_row_version is null or p_expected_row_version<1 or p_token_hash is null or p_token_hash!~'^[0-9a-f]{64}$'then raise exception 'INVALID_FRANCHISE_INVITATION_TOKEN'using errcode='22023';end if;
 select*into invite from public.franchise_invitations where id=p_invitation_id;
 select operator_organization_id into org from public.franchises where id=invite.franchise_id;
 select u.email,u.email_confirmed_at into email,verified from auth.users u where u.id=actor;
 if org is null or verified is null or lower(email)is distinct from lower(invite.invited_email::text)or not private.is_active_org_member(org,actor)then raise exception 'FRANCHISE_INVITATION_ACCEPT_DENIED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('franchise.activation.org:'||org::text,0));
 -- Match role-assignment lock order (membership before franchise). Freeze all current
 -- legacy grants before a second activation can make a NULL mandate ambiguous.
 perform 1 from public.organization_memberships where organization_id=org order by id for update;
 select id into membership from public.organization_memberships where organization_id=org and user_id=actor and status='ACTIVE';
 select status into org_status from public.organizations where id=org for share;
 if membership is null or org_status not in('ACTIVE','PENDING')then raise exception 'FRANCHISE_INVITATION_ACCEPT_DENIED'using errcode='42501';end if;
 perform 1 from public.franchise_approval_requests q join public.franchises f on f.id=q.franchise_id where f.operator_organization_id=org order by q.id for update of q;
 perform 1 from public.franchises where operator_organization_id=org order by id for update;
 select*into franchise from public.franchises where id=invite.franchise_id;
 select*into invite from public.franchise_invitations where id=p_invitation_id for update;
 if lower(email)is distinct from lower(invite.invited_email::text)or not exists(select 1 from private.franchise_invitation_tokens where invitation_id=invite.id and token_hash=p_token_hash)then raise exception 'FRANCHISE_INVITATION_ACCEPT_DENIED'using errcode='42501';end if;
 select e.environment into environment from private.admin_execution_environment_v1 e where e.singleton;
 if environment is null then raise exception 'FRANCHISE_ACTIVATION_ENVIRONMENT_UNCONFIGURED'using errcode='55000';end if;
 if p_activation_mode='NON_CONTRACTUAL_DEMO'and(environment not in('DEVELOPMENT','STAGING')or p_demo_confirmed is distinct from true)then raise exception 'FRANCHISE_DEMO_DEVELOPMENT_ONLY'using errcode='42501';end if;
 if p_activation_mode='CONTRACTUAL'and(coalesce(auth.jwt()->>'aal','')<>'aal2'or org_status<>'ACTIVE')then raise exception 'FRANCHISE_ACTIVATION_MFA_REQUIRED'using errcode='42501';end if;
 select*into existing from public.franchise_activation_evidence where invitation_id=invite.id;
 if existing.invitation_id is not null then
  if existing.activation_mode<>p_activation_mode or existing.actor_user_id<>actor then raise exception 'FRANCHISE_ACTIVATION_MODE_MISMATCH'using errcode='55000';end if;
  select*into mandate from public.franchise_mandate_versions where id=existing.approved_mandate_version_id and franchise_id=franchise.id for share;
 else
  -- This is the exact version used below; no second unpinned 'latest approved' lookup.
  select q.mandate_version_id,q.id into active_m,decision from public.franchise_approval_requests q where q.franchise_id=franchise.id and q.status='APPROVED'order by q.decided_at desc,q.id desc limit 1 for update;
  select*into mandate from public.franchise_mandate_versions where id=active_m and franchise_id=franchise.id for share;
 end if;
 if mandate.id is null then raise exception 'FRANCHISE_CENTRAL_APPROVAL_REQUIRED'using errcode='55000';end if;
 if(p_activation_mode='NON_CONTRACTUAL_DEMO'or p_expected_mandate_version_id is not null or p_expected_mandate_hash is not null)and(p_expected_mandate_version_id is distinct from mandate.id or p_expected_mandate_hash is distinct from mandate.content_hash)then raise exception 'FRANCHISE_MANDATE_CHANGED'using errcode='40001';end if;
 h:=private.canonical_request_hash(jsonb_build_object('invitation',invite.id,'token_hash',p_token_hash,'expected',p_expected_row_version,'mandate_id',mandate.id,'mandate_hash',mandate.content_hash,'activation_mode',p_activation_mode,'demo_confirmed',p_demo_confirmed,'environment',environment));
 result:=private.begin_contract_command(org,'franchise.invitation.activation.'||invite.id::text,p_idempotency_key,h,actor);if result is not null then return result;end if;
 if existing.invitation_id is not null or invite.status<>'SENT'or invite.expires_at<=clock_timestamp()or invite.row_version<>p_expected_row_version then raise exception 'STALE_OR_EXPIRED_FRANCHISE_INVITATION'using errcode='40001';end if;
 if franchise.status<>'LIBRARY_ASSIGNED'then raise exception 'STALE_FRANCHISE_STATE'using errcode='40001';end if;
 if mandate.effective_until is not null and mandate.effective_until<=greatest(mandate.effective_from,clock_timestamp())then raise exception 'FRANCHISE_MANDATE_EXPIRED'using errcode='55000';end if;
 if p_activation_mode='NON_CONTRACTUAL_DEMO'and franchise.activation_mode='CONTRACTUAL'then raise exception 'FRANCHISE_DEMO_EXISTING_CONTRACTUAL_DENIED'using errcode='42501';end if;
 if p_activation_mode='CONTRACTUAL'then
  proof:=private.franchise_mandate_signature_reference_or_null(franchise.id,mandate.id,mandate.content_hash,org,actor);
  if proof is null then raise exception 'FRANCHISE_SIGNED_MANDATE_REQUIRED'using errcode='55000';end if;
 end if;
 -- Preserve all six existing franchise roles; never infer a sibling assignment once
 -- multiple ACTIVE franchises exist, and never resurrect revoked assignment tombstones.
 select min(id::text)::uuid into previous_franchise from public.franchises where operator_organization_id=org and status='ACTIVE'having count(*)=1;
 if previous_franchise is not null and exists(select 1 from public.franchises f join public.franchise_mandate_versions m on m.id=f.current_mandate_version_id where f.id=previous_franchise and m.mandate_status='ACTIVE'and m.effective_from<=clock_timestamp()and(m.effective_until is null or m.effective_until>clock_timestamp()))then
  for legacy in select m.id membership_id,r.role_code from public.organization_memberships m join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null join public.role_definitions definition on definition.code=r.role_code and definition.scope_type='FRANCHISE'where m.organization_id=org and m.status='ACTIVE'and r.franchise_id is null and not exists(select 1 from public.organization_member_franchise_assignments assignment where assignment.membership_id=r.membership_id and assignment.role_code=r.role_code)order by m.id,r.role_code loop
   perform private.grant_franchise_role_assignment_v1(legacy.membership_id,legacy.role_code,previous_franchise,actor,p_correlation_id);
  end loop;
 end if;
 select coalesce(max(version),0)+1 into next_version from public.franchise_mandate_versions where franchise_id=franchise.id;
 insert into public.franchise_mandate_versions(franchise_id,territory_version_id,economic_rule_version_id,version,mandate_status,rights_snapshot,obligations_snapshot,contract_snapshot,entry_fee_minor,entry_fee_mode,entry_fee_term_months,franchisee_share_bps,neoxa_share_bps,matricia_share_bps,distribution_basis,effective_from,effective_until,content_hash,created_by)values(mandate.franchise_id,mandate.territory_version_id,mandate.economic_rule_version_id,next_version,'ACTIVE',mandate.rights_snapshot,mandate.obligations_snapshot,mandate.contract_snapshot,mandate.entry_fee_minor,mandate.entry_fee_mode,mandate.entry_fee_term_months,mandate.franchisee_share_bps,mandate.neoxa_share_bps,mandate.matricia_share_bps,mandate.distribution_basis,greatest(mandate.effective_from,clock_timestamp()),mandate.effective_until,mandate.content_hash,actor)returning id into active_m;
 update public.franchises set status='ACTIVE',activation_mode=p_activation_mode,current_mandate_version_id=active_m,updated_at=clock_timestamp(),row_version=row_version+1 where id=franchise.id;
 update public.franchise_invitations set status='ACCEPTED',accepted_by=actor,accepted_at=clock_timestamp(),row_version=row_version+1 where id=invite.id;
 perform private.grant_franchise_role_assignment_v1(membership,'FRANCHISE_OWNER',franchise.id,actor,p_correlation_id);
 snapshot:=jsonb_build_object('invitationId',invite.id,'franchiseId',franchise.id,'operatorOrganizationId',org,'approvalRequestId',decision,'approvedMandateVersionId',mandate.id,'activeMandateVersionId',active_m,'mandateHash',mandate.content_hash,'activationMode',p_activation_mode,'environment',environment,'actorUserId',actor,'legalProof',proof,'nonContractualDemo',p_activation_mode='NON_CONTRACTUAL_DEMO');proof_hash:=private.canonical_request_hash(snapshot);
 insert into public.franchise_activation_evidence(invitation_id,franchise_id,approved_mandate_version_id,active_mandate_version_id,mandate_hash,activation_mode,environment,actor_user_id,legal_proof_snapshot,evidence_snapshot,evidence_hash)values(invite.id,franchise.id,mandate.id,active_m,mandate.content_hash,p_activation_mode,environment,actor,proof,snapshot,proof_hash);
 result:=jsonb_build_object('outcome',case when p_activation_mode='NON_CONTRACTUAL_DEMO'then'FRANCHISE_DEMO_ACTIVATED'else'FRANCHISE_ACTIVATED'end,'franchise_id',franchise.id,'active_mandate_version_id',active_m,'activationMode',p_activation_mode,'evidenceHash',proof_hash,'row_version',franchise.row_version+1);
 insert into public.franchise_governance_events(franchise_id,event_type,from_status,to_status,actor_user_id,correlation_id,metadata)values(franchise.id,'INVITATION_ACCEPTED','LIBRARY_ASSIGNED','ACTIVE',actor,p_correlation_id,jsonb_build_object('invitation_id',invite.id,'approved_mandate_version_id',mandate.id,'active_mandate_version_id',active_m,'activation_mode',p_activation_mode,'environment',environment,'evidence_hash',proof_hash));
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,actor,'USER',case when p_activation_mode='NON_CONTRACTUAL_DEMO'then'franchise.demo_activated'else'franchise.activated'end,'franchise',franchise.id::text,p_correlation_id,jsonb_build_object('invitation_id',invite.id,'approved_mandate_version_id',mandate.id,'active_mandate_version_id',active_m,'activation_mode',p_activation_mode,'environment',environment,'evidence_hash',proof_hash),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'franchise',franchise.id::text,case when p_activation_mode='NON_CONTRACTUAL_DEMO'then'FranchiseDemoActivatedV1'else'FranchiseActivatedV1'end,p_correlation_id,result,p_idempotency_key);
 perform private.finish_contract_command(org,'franchise.invitation.activation.'||invite.id::text,p_idempotency_key,result);return result;
end$$;
revoke all on function private.accept_franchise_activation_v1(uuid,text,integer,uuid,text,text,boolean,text,uuid)from public,anon,authenticated,service_role;

create or replace function public.accept_franchise_invitation(p_invitation_id uuid,p_token_hash text,p_expected_row_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin return private.accept_franchise_activation_v1(p_invitation_id,p_token_hash,p_expected_row_version,null,null,'CONTRACTUAL',false,p_idempotency_key,p_correlation_id);end$$;
create function public.simulate_franchise_invitation_acceptance(p_invitation_id uuid,p_token_hash text,p_expected_row_version integer,p_expected_mandate_version_id uuid,p_expected_mandate_hash text,p_confirmed boolean,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin return private.accept_franchise_activation_v1(p_invitation_id,p_token_hash,p_expected_row_version,p_expected_mandate_version_id,p_expected_mandate_hash,'NON_CONTRACTUAL_DEMO',p_confirmed,p_idempotency_key,p_correlation_id);end$$;

create function public.accept_signed_franchise_invitation(p_invitation_id uuid,p_token_hash text,p_expected_row_version integer,p_expected_mandate_version_id uuid,p_expected_mandate_hash text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin if p_expected_mandate_version_id is null or p_expected_mandate_hash is null then raise exception 'FRANCHISE_MANDATE_CHANGED'using errcode='40001';end if;return private.accept_franchise_activation_v1(p_invitation_id,p_token_hash,p_expected_row_version,p_expected_mandate_version_id,p_expected_mandate_hash,'CONTRACTUAL',false,p_idempotency_key,p_correlation_id);end$$;

create function public.franchise_invitation_activation_preview(p_invitation_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare invite public.franchise_invitations%rowtype;f public.franchises%rowtype;m public.franchise_mandate_versions%rowtype;environment text;email text;verified timestamptz;proof jsonb;
begin
 select*into invite from public.franchise_invitations where id=p_invitation_id;select*into f from public.franchises where id=invite.franchise_id;
 select u.email,u.email_confirmed_at into email,verified from auth.users u where u.id=auth.uid();
 if auth.uid()is null or f.id is null or verified is null or lower(email)is distinct from lower(invite.invited_email::text)or not private.is_active_org_member(f.operator_organization_id,auth.uid())then raise exception 'FRANCHISE_INVITATION_ACCEPT_DENIED'using errcode='42501';end if;
 select mv.*into m from public.franchise_mandate_versions mv join public.franchise_approval_requests q on q.mandate_version_id=mv.id where q.franchise_id=f.id and q.status='APPROVED'order by q.decided_at desc,q.id desc limit 1;
 select e.environment into environment from private.admin_execution_environment_v1 e where e.singleton;
 if m.id is not null and environment is not null and auth.jwt()->>'aal'='aal2' then proof:=private.franchise_mandate_signature_reference_or_null(f.id,m.id,m.content_hash,f.operator_organization_id,auth.uid());end if;
 return jsonb_build_object('invitationId',invite.id,'franchiseId',f.id,'organizationId',f.operator_organization_id,'status',invite.status,'expiresAt',invite.expires_at,'rowVersion',invite.row_version,'mandateVersionId',m.id,'mandateHash',m.content_hash,'mandateVersion',m.version,'entryFeeMinor',m.entry_fee_minor::text,'entryFeeMode',m.entry_fee_mode,'entryFeeTermMonths',m.entry_fee_term_months,'franchiseeShareBps',m.franchisee_share_bps,'effectiveFrom',m.effective_from,'effectiveUntil',m.effective_until,'rights',m.rights_snapshot,'obligations',m.obligations_snapshot,'contract',m.contract_snapshot,'environment',coalesce(environment,'UNCONFIGURED'),'demoAvailable',coalesce(environment in('DEVELOPMENT','STAGING')and m.id is not null and invite.status='SENT'and invite.expires_at>statement_timestamp()and f.activation_mode is distinct from'CONTRACTUAL',false),'verifiedLegalProof',proof is not null);
end$$;
revoke all on function public.accept_franchise_invitation(uuid,text,integer,text,uuid),public.simulate_franchise_invitation_acceptance(uuid,text,integer,uuid,text,boolean,text,uuid),public.franchise_invitation_activation_preview(uuid),public.accept_signed_franchise_invitation(uuid,text,integer,uuid,text,text,uuid)from public,anon,service_role;
grant execute on function public.accept_franchise_invitation(uuid,text,integer,text,uuid),public.simulate_franchise_invitation_acceptance(uuid,text,integer,uuid,text,boolean,text,uuid),public.franchise_invitation_activation_preview(uuid),public.accept_signed_franchise_invitation(uuid,text,integer,uuid,text,text,uuid)to authenticated;
