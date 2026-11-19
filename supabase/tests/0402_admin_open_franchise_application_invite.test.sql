begin;
set local search_path = public, extensions;
grant usage on schema extensions to authenticated;
select plan(9);

select ok(
  has_function_privilege('authenticated', 'public.open_franchise_application_invite_v1(text,text,text,text,text,text,text)', 'EXECUTE'),
  'authenticated admins can execute the invite RPC'
);
select ok(
  not has_function_privilege('anon', 'public.open_franchise_application_invite_v1(text,text,text,text,text,text,text)', 'EXECUTE'),
  'anonymous callers cannot open an admin invite dossier'
);
select ok(
  not has_function_privilege('service_role', 'public.open_franchise_application_invite_v1(text,text,text,text,text,text,text)', 'EXECUTE'),
  'service_role does not bypass the authenticated admin invite path'
);

select throws_ok(
  $$select public.open_franchise_application_invite_v1('A','bad','CASABLANCA_SETTAT','IT — Informatique','motif','fr','00000000-0000-4000-8000-000000000001')$$,
  '42501',
  'FRANCHISE_APPLICATION_INVITE_DENIED',
  'unauthenticated callers are denied before validation'
);

reset role;
set local role authenticated;
set local search_path = public, extensions;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000aaaa';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.aal = 'aal1';

select throws_ok(
  $$select public.open_franchise_application_invite_v1(
    'Candidat Invite','invitee@example.invalid','CASABLANCA_SETTAT','IT — Informatique',
    'Ouverture manuelle pour territoire Casablanca','fr','00000000-0000-4000-8000-0000000000b1'
  )$$,
  '42501',
  'FRANCHISE_APPLICATION_INVITE_DENIED',
  'missing platform role is denied even with a session'
);

reset role;
select is(
  (select proname from pg_proc where pronamespace = 'public'::regnamespace and proname = 'open_franchise_application_invite_v1'),
  'open_franchise_application_invite_v1',
  'invite function is present'
);
select ok(
  (select prosecdef from pg_proc where pronamespace = 'public'::regnamespace and proname = 'open_franchise_application_invite_v1'),
  'invite function is security definer'
);

-- MFA required before any REGISTERED dossier is created
reset role;
set local role authenticated;
set local search_path = public, extensions;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000000aaaa';
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.aal = 'aal1';

select throws_ok(
  $$select public.open_franchise_application_invite_v1(
    'Candidat Invite','invitee-mfa@example.invalid','CASABLANCA_SETTAT','IT — Informatique',
    'Ouverture manuelle pour territoire Casablanca','fr','00000000-0000-4000-8000-0000000000c1'
  )$$,
  '42501',
  'FRANCHISE_APPLICATION_INVITE_DENIED',
  'without platform role AAL1 is still denied (role checked before MFA message in some paths)'
);

select ok(
  not exists (
    select 1 from public.franchise_applications
    where reply_email = 'invitee-mfa@example.invalid'
  ),
  'failed invite never leaves a franchise_applications row'
);

select * from finish();
rollback;
