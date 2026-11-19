-- Privileges + DENY for get_admin_network_invitations_supervision_v1
begin;
set local search_path = public, extensions;
select plan(4);

select has_function('public', 'get_admin_network_invitations_supervision_v1', array['text'], 'supervision RPC exists');
select ok(has_function_privilege('authenticated', 'public.get_admin_network_invitations_supervision_v1(text)', 'EXECUTE'), 'authenticated can execute');
select ok(not has_function_privilege('anon', 'public.get_admin_network_invitations_supervision_v1(text)', 'EXECUTE'), 'anon cannot execute');
select ok(not has_function_privilege('service_role', 'public.get_admin_network_invitations_supervision_v1(text)', 'EXECUTE'), 'service_role cannot execute');

select * from finish();
rollback;
