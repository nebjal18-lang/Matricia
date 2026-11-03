#!/usr/bin/env python3
"""Local-only committed race proof. Run solely against root's disposable clone.
The script never accepts a production URL or touches the source database.
Root drops matricia_delivery_ice_concurrency after inspecting its evidence.
"""
import concurrent.futures
import json
import subprocess
import threading

CONTAINER = "supabase_db_Matricia"
DATABASE = "matricia_delivery_ice_concurrency"
ACTOR = "a1950000-0000-4000-8000-000000000001"
APPROVER = "a1950000-0000-4000-8000-000000000002"
ICE = "195000000000001"


def sql(statement: str) -> str:
    run = subprocess.run(["docker", "exec", "-i", CONTAINER, "psql", "-X", "-qAt", "-U", "postgres", "-d", DATABASE, "-v", "ON_ERROR_STOP=1"], input=statement, text=True, capture_output=True, check=False)
    if run.returncode:
        raise RuntimeError(run.stderr.strip())
    return run.stdout.strip()


def main() -> None:
    if sql("select current_database()") != DATABASE:
        raise RuntimeError("DISPOSABLE_DATABASE_REQUIRED")
    sql(f"""begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('{ACTOR}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-ice-race-requester@example.invalid','',now(),'{{}}','{{}}',now(),now()),
('{APPROVER}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-ice-race-approver@example.invalid','',now(),'{{}}','{{}}',now(),now());
insert into public.platform_user_roles(user_id,role_code)values('{ACTOR}','MATRICIA_ADMIN'),('{APPROVER}','MATRICIA_ADMIN');
insert into public.admin_operational_action_requests(id,action_type,target_environment,resource_type,resource_id,request_payload_hash,redacted_summary,reason,approvals_required,status,requested_by)
select('e1950000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'CHANGE_CONFIGURATION','DEVELOPMENT','ORGANIZATION','b1950000-0000-4000-8000-'||lpad(i::text,12,'0'),repeat('a',64),jsonb_build_object('intent','CREATE_ORGANIZATION','ice','{ICE}','legalName','Société fixture concurrence ICE','displayName','Fixture concurrence ICE','kind','CLIENT'),'Création concurrente contrôlée en base jetable uniquement',1,'AUTHORIZED','{ACTOR}'from generate_series(1,2)i;
insert into public.admin_operational_action_decisions(action_request_id,decision,reason,request_payload_hash,decided_by)
select id,'APPROVE','Approbateur distinct de la fixture',request_payload_hash,'{APPROVER}'from public.admin_operational_action_requests where id in('e1950000-0000-4000-8000-000000000001','e1950000-0000-4000-8000-000000000002');
commit;""")
    barrier = threading.Barrier(3)

    def execute(number: int) -> dict:
        barrier.wait()
        output = sql(f"""begin;set local role service_role;set local request.jwt.claims='{{"role":"service_role"}}';set local request.jwt.claim.sub='';
select public.execute_admin_operational_action_v1('e1950000-0000-4000-8000-{number:012d}',gen_random_uuid());
select pg_sleep(0.25);commit;""")
        return json.loads(next(line for line in output.splitlines() if line.startswith("{")))

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = [pool.submit(execute, n) for n in (1, 2)]
        barrier.wait()
        outcomes = [future.result() for future in results]
    assert sorted(item["outcome"] for item in outcomes) == ["ADMIN_ACTION_EXECUTED", "ADMIN_ACTION_FAILED"], outcomes
    proof = json.loads(sql(f"""select jsonb_build_object(
 'organizations',(select count(*)from public.organizations where id in('b1950000-0000-4000-8000-000000000001','b1950000-0000-4000-8000-000000000002')),
 'active_ice',(select count(*)from public.organization_identifiers where identifier_type='ICE'and is_active and normalized_value='{ICE}'),
 'administration_profiles',(select count(*)from public.organization_administration_profiles where organization_id in('b1950000-0000-4000-8000-000000000001','b1950000-0000-4000-8000-000000000002')),
 'executed',(select count(*)from public.admin_operational_action_requests where id in('e1950000-0000-4000-8000-000000000001','e1950000-0000-4000-8000-000000000002')and status='EXECUTED'),
 'failed',(select count(*)from public.admin_operational_action_requests where id in('e1950000-0000-4000-8000-000000000001','e1950000-0000-4000-8000-000000000002')and status='FAILED'));"""))
    assert proof == {"organizations": 1, "active_ice": 1, "administration_profiles": 1, "executed": 1, "failed": 1}, proof
    print(json.dumps({"database": DATABASE, "result": "PASS", "proof": proof}, sort_keys=True))


if __name__ == "__main__":
    main()
