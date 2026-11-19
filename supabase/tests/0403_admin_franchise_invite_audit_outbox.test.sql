-- Privilege / presence checks for invite audit+outbox migration.
begin;
set local search_path = public, extensions;
select plan(3);

select has_function(
  'public',
  'open_franchise_application_invite_v1',
  array['text','text','text','text','text','text','text'],
  'invite RPC still present after audit/outbox upgrade'
);
select has_table('public', 'audit_events', 'audit_events table exists for invite side-effects');
select has_table('public', 'event_outbox', 'event_outbox table exists for FranchiseApplicationInvitedV1');

select * from finish();
rollback;
