// Generates SQL only. The browser verification owner executes it exclusively
// inside its already labelled disposable TEST database after the Owner matrix.
import{randomUUID}from'node:crypto';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function nativeBuyerBoxBootstrapSql({organizationId,ownerId,buyerId,financeAuthorId,financeReviewerId,planId=randomUUID(),planVersionId=randomUUID()}){
 const ids=[organizationId,ownerId,buyerId,financeAuthorId,financeReviewerId,planId,planVersionId];if(!ids.every(x=>uuid.test(x))||new Set(ids).size!==ids.length)throw new Error('SEPARATE_EXACT_TEST_UUIDS_REQUIRED');
 return{planId,planVersionId,sql:`
-- TEST ONLY historical plan + explicit staff-role bootstrap; not production
-- commercial publication or governed role-assignment/onboarding certification.
-- No auth.users/sessions, fake USER JWT, claim setters or disabled triggers.
do $test_box_bootstrap$
begin
 if not exists(select 1 from private.admin_execution_environment_v1 where singleton and environment='DEVELOPMENT')then raise exception'TEST_DEVELOPMENT_DATABASE_REQUIRED';end if;
 if exists(select 1 from public.subscription_plans where code='GOLD')then raise exception'TEST_UNUSED_GOLD_PLAN_REQUIRED';end if;
 if not exists(select 1 from public.organizations where id='${organizationId}'and status='ACTIVE')then raise exception'TEST_ACTIVE_EXISTING_ORGANIZATION_REQUIRED';end if;
 if not exists(select 1 from public.organization_memberships m join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null where m.organization_id='${organizationId}'and m.user_id='${ownerId}'and m.status='ACTIVE'and r.role_code='CLIENT_OWNER')then raise exception'TEST_EXISTING_PLAIN_OWNER_REQUIRED';end if;
 if not exists(select 1 from public.organization_memberships m join public.organization_member_roles r on r.membership_id=m.id and r.revoked_at is null where m.organization_id='${organizationId}'and m.user_id='${buyerId}'and m.status='ACTIVE'and r.role_code='CLIENT_BUYER')then raise exception'TEST_EXISTING_BUYER_REQUIRED';end if;
 if exists(select 1 from public.platform_user_roles where user_id in('${ownerId}','${buyerId}')and revoked_at is null)then raise exception'TEST_CORE_ACTORS_MUST_REMAIN_PLAIN_CLIENTS';end if;
 if exists(select 1 from public.subscriptions where organization_id='${organizationId}'and status not in('TRIAL_ACTIVE','TRIAL_EXPIRED'))or exists(select 1 from public.customer_boxes where organization_id='${organizationId}')or exists(select 1 from private.subscription_checkout_attempts_v1 where organization_id='${organizationId}'and state not in('SETTLED','CANCELLED_VERIFIED'))then raise exception'TEST_FRESH_UNPAID_CLIENT_COHORT_REQUIRED';end if;
 if(select count(distinct user_id)from auth.sessions where user_id in('${financeAuthorId}','${financeReviewerId}'))<>2 or(select count(distinct user_id)from auth.mfa_factors where user_id in('${financeAuthorId}','${financeReviewerId}')and status='verified')<>2 then raise exception'TEST_NATIVE_FINANCE_MFA_IDENTITIES_REQUIRED';end if;
 if exists(select 1 from public.platform_user_roles where user_id in('${financeAuthorId}','${financeReviewerId}')and role_code='READ_ONLY_AUDITOR'and revoked_at is null)then raise exception'TEST_FINANCE_ACTOR_HAS_READ_ONLY_ROLE';end if;
 insert into public.platform_user_roles(user_id,role_code)values('${financeAuthorId}','FINANCE_MANAGER'),('${financeReviewerId}','FINANCE_MANAGER')on conflict do nothing;
 insert into public.subscription_plans(id,code,status,created_by)values('${planId}','GOLD','ACTIVE','${financeAuthorId}');
 insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)values('${planVersionId}','${planId}',1,'ACTIVE','EUR',12345,123450,10,5000,5000,'{"USERS":"5","SITES":"5","PROJECTS":"5","DIAGNOSTICS":"20","REPORTS":"20"}',current_date-1,repeat('a',64),'${financeAuthorId}');
end;
$test_box_bootstrap$;`};
}
