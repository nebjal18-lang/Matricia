begin;
-- The existing catalogue permission policies remain authoritative. Activation
-- supplies their missing mandate, with immutable native activation provenance.
create table private.franchise_catalog_acl_grants_v1(
 catalog_mandate_id uuid primary key references public.catalog_library_mandates(id)on delete restrict,
 library_id uuid not null references public.catalog_libraries(id),organization_id uuid not null references public.organizations(id),
 policy_version integer not null check(policy_version=1),created_at timestamptz not null default clock_timestamp()
);
create table private.franchise_catalog_acl_sources_v1(
 invitation_id uuid primary key references public.franchise_activation_evidence(invitation_id)on delete restrict,
 catalog_mandate_id uuid not null references public.catalog_library_mandates(id)on delete restrict,
 franchise_id uuid not null references public.franchises(id),active_mandate_version_id uuid not null references public.franchise_mandate_versions(id),
 valid_from timestamptz not null,valid_until timestamptz,basis_snapshot jsonb not null,basis_hash text not null check(basis_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),check(valid_until is null or valid_until>valid_from)
);
revoke all on private.franchise_catalog_acl_grants_v1,private.franchise_catalog_acl_sources_v1 from public,anon,authenticated,service_role;
create trigger franchise_catalog_acl_grant_immutable before update or delete on private.franchise_catalog_acl_grants_v1 for each row execute function private.prevent_update_delete();
create trigger franchise_catalog_acl_source_immutable before update or delete on private.franchise_catalog_acl_sources_v1 for each row execute function private.prevent_update_delete();

create function private.franchise_catalog_activation_source_v1(p_franchise uuid)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare f public.franchises%rowtype;e public.franchise_activation_evidence%rowtype;a public.franchise_mandate_versions%rowtype;m public.franchise_mandate_versions%rowtype;i public.franchise_invitations%rowtype;q public.franchise_approval_requests%rowtype;d public.franchise_approval_decisions%rowtype;env text;
begin
 select*into f from public.franchises where id=p_franchise;
 select*into e from public.franchise_activation_evidence where franchise_id=f.id and active_mandate_version_id=f.current_mandate_version_id;
 select*into a from public.franchise_mandate_versions where id=e.active_mandate_version_id and franchise_id=f.id;
 select*into m from public.franchise_mandate_versions where id=e.approved_mandate_version_id and franchise_id=f.id;
 select*into i from public.franchise_invitations where id=e.invitation_id and franchise_id=f.id;
 select*into q from public.franchise_approval_requests where franchise_id=f.id and mandate_version_id=m.id and status='APPROVED';
 select*into d from public.franchise_approval_decisions where approval_request_id=q.id and decision='APPROVE';
 select environment into env from private.admin_execution_environment_v1 where singleton;
 if f.id is null or f.status is distinct from'ACTIVE'or e.invitation_id is null or a.id is null or m.id is null or i.id is null or q.id is null or d.id is null
  or a.mandate_status is distinct from'ACTIVE'or a.effective_until<=clock_timestamp()
  or f.activation_mode is distinct from e.activation_mode or e.mandate_hash is distinct from m.content_hash or a.content_hash is distinct from m.content_hash
  or (to_jsonb(a)-array['id','version','mandate_status','created_by','created_at','effective_from'])is distinct from(to_jsonb(m)-array['id','version','mandate_status','created_by','created_at','effective_from'])
  or a.effective_from<m.effective_from or d.decided_by=q.requested_by or d.mandate_content_hash is distinct from m.content_hash
  or q.decided_at is null or q.decided_at>e.recorded_at or d.decided_at>e.recorded_at or a.created_at>e.recorded_at
  or i.status is distinct from'ACCEPTED'or i.accepted_by is distinct from e.actor_user_id or i.accepted_at is null or i.accepted_at>e.recorded_at
  or e.evidence_hash is distinct from private.canonical_request_hash(e.evidence_snapshot)
  or e.evidence_snapshot->>'invitationId'is distinct from i.id::text
  or e.evidence_snapshot->>'operatorOrganizationId'is distinct from f.operator_organization_id::text
  or e.evidence_snapshot->>'approvalRequestId'is distinct from q.id::text
  or e.evidence_snapshot->>'franchiseId'is distinct from f.id::text
  or e.evidence_snapshot->>'approvedMandateVersionId'is distinct from m.id::text
  or e.evidence_snapshot->>'activeMandateVersionId'is distinct from a.id::text
  or e.evidence_snapshot->>'mandateHash'is distinct from m.content_hash
  or e.evidence_snapshot->>'activationMode'is distinct from e.activation_mode
  or e.evidence_snapshot->>'environment'is distinct from e.environment
  or e.evidence_snapshot->>'actorUserId'is distinct from e.actor_user_id::text
  or(e.activation_mode='NON_CONTRACTUAL_DEMO'and(env is null or env not in('DEVELOPMENT','STAGING')or e.environment not in('DEVELOPMENT','STAGING')or e.legal_proof_snapshot is not null))
  or(e.activation_mode='CONTRACTUAL'and(jsonb_typeof(e.legal_proof_snapshot)is distinct from'object'or e.legal_proof_snapshot='{}'::jsonb or e.evidence_snapshot->'legalProof'is distinct from e.legal_proof_snapshot))
  or not exists(select 1 from public.audit_events audit where audit.organization_id=f.operator_organization_id and audit.actor_user_id=e.actor_user_id and audit.resource_type='franchise'and audit.resource_id=f.id::text and audit.action=case e.activation_mode when'NON_CONTRACTUAL_DEMO'then'franchise.demo_activated'else'franchise.activated'end and audit.metadata->>'evidence_hash'=e.evidence_hash)
  or not exists(select 1 from public.event_outbox event where event.organization_id=f.operator_organization_id and event.aggregate_type='franchise'and event.aggregate_id=f.id::text and event.event_type=case e.activation_mode when'NON_CONTRACTUAL_DEMO'then'FranchiseDemoActivatedV1'else'FranchiseActivatedV1'end and event.payload->>'evidenceHash'=e.evidence_hash)
 then raise exception'FRANCHISE_NATIVE_CATALOG_ACTIVATION_REQUIRED'using errcode='55000';end if;
 if not exists(select 1 from public.catalog_permission_policies where role_code='FRANCHISE_OWNER'and permission_code='CATALOG_VIEW_DRAFT'and policy_version=1 and active and valid_from<=statement_timestamp()and(valid_until is null or valid_until>statement_timestamp()))then raise exception'FRANCHISE_CATALOG_ROLE_POLICY_REQUIRED'using errcode='55000';end if;
 return jsonb_build_object('franchise_id',f.id,'library_id',f.library_id,'organization_id',f.operator_organization_id,'activation',to_jsonb(e),'approved_mandate',to_jsonb(m),'active_mandate',to_jsonb(a),'approval',jsonb_build_object('request_id',q.id,'requested_by',q.requested_by,'decision_id',d.id,'decided_by',d.decided_by,'mandate_hash',d.mandate_content_hash),'policy_version',1);
end$$;
revoke all on function private.franchise_catalog_activation_source_v1(uuid)from public,anon,authenticated,service_role;

create function private.ensure_franchise_catalog_mandate_v1(p_franchise uuid,p_correlation uuid)returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare source jsonb;lib uuid;org uuid;invitation uuid;actor uuid;starts timestamptz;ends timestamptz;mandate public.catalog_library_mandates%rowtype;prior private.franchise_catalog_acl_sources_v1%rowtype;new_from timestamptz;new_until timestamptz;payload jsonb;
begin
 -- Serialize with native activation before the pair-wide catalogue lock.
 select operator_organization_id into org from public.franchises where id=p_franchise;
 if org is null or p_correlation is null then raise exception'FRANCHISE_NATIVE_CATALOG_ACTIVATION_REQUIRED'using errcode='55000';end if;
 perform pg_advisory_xact_lock(hashtextextended('franchise.activation.org:'||org::text,0));
 source:=private.franchise_catalog_activation_source_v1(p_franchise);
 lib:=(source->>'library_id')::uuid;invitation:=(source#>>'{activation,invitation_id}')::uuid;actor:=(source#>>'{activation,actor_user_id}')::uuid;
 starts:=(source#>>'{active_mandate,effective_from}')::timestamptz;ends:=(source#>>'{active_mandate,effective_until}')::timestamptz;
 perform pg_advisory_xact_lock(hashtextextended('franchise.catalog.acl:'||lib::text||':'||org::text,0));
 select*into prior from private.franchise_catalog_acl_sources_v1 where invitation_id=invitation;
 if prior.invitation_id is not null then
  if prior.basis_hash is distinct from private.canonical_request_hash(source)or prior.basis_snapshot is distinct from source then raise exception'FRANCHISE_CATALOG_SOURCE_CHANGED'using errcode='40001';end if;
  select*into mandate from public.catalog_library_mandates where id=prior.catalog_mandate_id;
  if mandate.status is distinct from'ACTIVE'then raise exception'FRANCHISE_CATALOG_GRANT_REVOKED_REVIEW_REQUIRED'using errcode='55000';end if;
  return jsonb_build_object('outcome','FRANCHISE_CATALOG_MANDATE_PRESENT','catalog_mandate_id',mandate.id,'franchise_id',p_franchise);
 end if;
 select*into mandate from public.catalog_library_mandates where library_id=lib and organization_id=org and status='ACTIVE'for update;
 if mandate.id is null then
  -- Revocation/suspension is an independent governance decision, never a missing
  -- row to repair automatically; old records and their lifetime remain intact.
  if exists(select 1 from public.catalog_library_mandates where library_id=lib and organization_id=org)then raise exception'FRANCHISE_CATALOG_GRANT_REVOKED_REVIEW_REQUIRED'using errcode='55000';end if;
  insert into public.catalog_library_mandates(library_id,organization_id,status,valid_from,valid_until,policy_version,created_by)values(lib,org,'ACTIVE',starts,ends,1,actor)returning*into mandate;
  insert into private.franchise_catalog_acl_grants_v1(catalog_mandate_id,library_id,organization_id,policy_version)values(mandate.id,lib,org,1);
 elsif mandate.policy_version<>1 then raise exception'FRANCHISE_CATALOG_POLICY_REVIEW_REQUIRED'using errcode='55000';
 elsif exists(select 1 from private.franchise_catalog_acl_grants_v1 where catalog_mandate_id=mandate.id)then
  -- Merge only exact approved windows, not now()+TTL. The per-source role gate
  -- below keeps sibling territories and future/expired windows independent.
  new_from:=least(mandate.valid_from,starts);new_until:=case when mandate.valid_until is null or ends is null then null else greatest(mandate.valid_until,ends)end;
  if(new_from,new_until)is distinct from(mandate.valid_from,mandate.valid_until)then
   insert into private.catalog_acl_write_capabilities values(pg_backend_pid(),txid_current())on conflict do nothing;
   update public.catalog_library_mandates set valid_from=new_from,valid_until=new_until,row_version=row_version+1 where id=mandate.id returning*into mandate;
   delete from private.catalog_acl_write_capabilities where backend_pid=pg_backend_pid()and transaction_id=txid_current();
  end if;
 elsif mandate.valid_from>starts or(mandate.valid_until is not null and(ends is null or mandate.valid_until<ends))then raise exception'FRANCHISE_CATALOG_MANUAL_GRANT_REVIEW_REQUIRED'using errcode='55000';
 end if;
 insert into private.franchise_catalog_acl_sources_v1(invitation_id,catalog_mandate_id,franchise_id,active_mandate_version_id,valid_from,valid_until,basis_snapshot,basis_hash)values(invitation,mandate.id,p_franchise,(source#>>'{active_mandate,id}')::uuid,starts,ends,source,private.canonical_request_hash(source));
 payload:=jsonb_build_object('franchise_id',p_franchise,'catalog_mandate_id',mandate.id,'library_id',lib,'organization_id',org,'activation_evidence_hash',source#>>'{activation,evidence_hash}','source_hash',private.canonical_request_hash(source),'valid_from',starts,'valid_until',ends,'catalog_policy_version',1,'activation_mode',source#>>'{activation,activation_mode}');
 insert into public.audit_events(organization_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,'SYSTEM','franchise.catalog_mandate.granted','catalog_library_mandate',mandate.id::text,p_correlation,payload,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'catalog_library_mandate',mandate.id::text,'FranchiseCatalogMandateGrantedV1',p_correlation,payload,'franchise-catalog-activation:'||invitation::text);
 return jsonb_build_object('outcome','FRANCHISE_CATALOG_MANDATE_GRANTED','catalog_mandate_id',mandate.id,'franchise_id',p_franchise);
end$$;
revoke all on function private.ensure_franchise_catalog_mandate_v1(uuid,uuid)from public,anon,authenticated,service_role;

create function private.franchise_catalog_acl_source_allows_v1(p_catalog_mandate uuid,p_role text,p_actor uuid)returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select not exists(select 1 from private.franchise_catalog_acl_grants_v1 where catalog_mandate_id=p_catalog_mandate)
 or exists(select 1 from private.franchise_catalog_acl_sources_v1 source join public.franchises f on f.id=source.franchise_id
  join public.franchise_activation_evidence e on e.invitation_id=source.invitation_id
  where source.catalog_mandate_id=p_catalog_mandate and f.status='ACTIVE'and f.current_mandate_version_id=source.active_mandate_version_id
   and f.activation_mode=e.activation_mode and private.franchise_activation_mode_allowed_v1(f.id)
   and statement_timestamp()>=source.valid_from and(source.valid_until is null or statement_timestamp()<source.valid_until)
   and private.has_franchise_role(f.id,array[p_role],p_actor))
$$;
revoke all on function private.franchise_catalog_acl_source_allows_v1(uuid,text,uuid)from public,anon,authenticated,service_role;

-- Preserve the existing permission function's OID and every policy/role check.
do $$declare definition text;anchor text:='and x.status=''ACTIVE''and statement_timestamp()>=x.valid_from';begin
 select pg_get_functiondef('private.has_library_permission(uuid,text,uuid)'::regprocedure)into definition;
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'FRANCHISE_CATALOG_PERMISSION_PATCH_TARGET_MISMATCH';end if;
 execute replace(definition,anchor,'and private.franchise_catalog_acl_source_allows_v1(x.id,r.role_code,p_actor_id) '||anchor);
 select pg_get_functiondef('private.accept_franchise_activation_v1(uuid,text,integer,uuid,text,text,boolean,text,uuid)'::regprocedure)into definition;
 anchor:='perform private.finish_contract_command(org,''franchise.invitation.activation.''||invite.id::text,p_idempotency_key,result);return result;';
 if(length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception'FRANCHISE_CATALOG_ACTIVATION_PATCH_TARGET_MISMATCH';end if;
 execute replace(definition,anchor,'perform private.ensure_franchise_catalog_mandate_v1(franchise.id,p_correlation_id);'||anchor);
end$$;

-- Scoped repair for native activations committed before this migration. It does
-- not alter roles, approvals, signatures, mode, dates or explicit revocations.
create function public.reconcile_franchise_catalog_mandate_v1(p_franchise_id uuid,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.role()is distinct from'service_role'then raise exception'FRANCHISE_CATALOG_RECONCILIATION_SERVICE_ONLY'using errcode='42501';end if;
 return private.ensure_franchise_catalog_mandate_v1(p_franchise_id,p_correlation_id);
end$$;
revoke all on function public.reconcile_franchise_catalog_mandate_v1(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function public.reconcile_franchise_catalog_mandate_v1(uuid,uuid)to service_role;
commit;
