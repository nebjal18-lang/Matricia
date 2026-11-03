#!/usr/bin/env python3
"""Committed race proof ONLY in Root's explicitly disposable privacy clone.
No service is retargeted, no Storage/Auth HTTP is called, no backend is stopped.
The clone and synthetic fixtures remain for Root's review and eventual DROP.
"""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import time

DATABASE = "matricia_delivery_privacy_20261101"
CONTAINER = "supabase_db_Matricia"
ROOT = Path(__file__).resolve().parent.parent


def command():
    return ["docker", "exec", "-i", CONTAINER, "psql", "-X", "-qAt", "-U", "supabase_admin", "-d", DATABASE, "-v", "ON_ERROR_STOP=1"]


def sql(statement, expect_error=None):
    result = subprocess.run(command(), input=statement, text=True, capture_output=True, check=False)
    if expect_error:
        if result.returncode == 0 or expect_error not in result.stderr:
            raise RuntimeError("EXPECTED_AUTHORITY_REJECTION_MISSING: " + result.stderr[-500:])
    elif result.returncode or "not ok " in result.stdout:
        raise RuntimeError(result.stderr[-1000:] or "SYNTHETIC_SETUP_ASSERTION_FAILED")
    return result.stdout.strip()


def actor(n):
    uid = f"a2630000-0000-4000-8000-{n:012d}"
    claims = json.dumps({"sub": uid, "role": "authenticated", "aal": "aal2"})
    return f"set local role authenticated;set local request.jwt.claim.sub='{uid}';set local request.jwt.claims='{claims}';"


def await_lock(application):
    for _ in range(100):
        if sql(f"select exists(select 1 from pg_stat_activity where datname='{DATABASE}'and application_name='{application}'and wait_event_type='Lock')") == "t":
            return
        time.sleep(0.05)
    raise RuntimeError("EXECUTOR_DID_NOT_WAIT_FOR_UNCOMMITTED_REVOCATION")


def race(number, call, actor_number):
    uid = f"a2630000-0000-4000-8000-{actor_number:012d}"
    blocker = subprocess.Popen(command(), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert blocker.stdin and blocker.stdout
    blocker.stdin.write(f"begin;update public.platform_user_roles set revoked_at=clock_timestamp()where user_id='{uid}'and role_code='COMPLIANCE_MANAGER';select 'REVOCATION_HELD';\n")
    blocker.stdin.flush()
    while blocker.stdout.readline().strip() != "REVOCATION_HELD":
        if blocker.poll() is not None:
            raise RuntimeError("REVOCATION_CONNECTION_CLOSED")
    application = f"erasure263-authority-race-{number}"
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(sql, f"begin;set local statement_timeout='15s';set local application_name='{application}';{actor(actor_number)}{call};rollback;", "DSR_LEGAL_STAFF_REQUIRED")
            await_lock(application)
            blocker.stdin.write("commit;\n")
            blocker.stdin.close()
            if blocker.wait(timeout=10) != 0:
                raise RuntimeError("REVOCATION_COMMIT_FAILED")
            future.result(timeout=20)
    finally:
        if blocker.poll() is None:
            # Normal SQL rollback only. Never cancel/terminate another backend.
            if not blocker.stdin.closed:
                blocker.stdin.write("rollback;\n")
                blocker.stdin.close()
            blocker.wait(timeout=10)
    sql(f"begin;update public.platform_user_roles set revoked_at=null where user_id='{uid}'and role_code='COMPLIANCE_MANAGER';commit;")
    return {"case": number, "wait_observed": True, "revocation_committed_before_rejection": True}


def main():
    if sql("select current_database()") != DATABASE:
        raise RuntimeError("DISPOSABLE_PRIVACY_DATABASE_REQUIRED")
    if sql("select environment from private.admin_execution_environment_v1 where singleton") != "DEVELOPMENT":
        raise RuntimeError("DISPOSABLE_DEVELOPMENT_BINDING_REQUIRED")
    fixture = (ROOT / "supabase/tests/0263_dsr_governed_erasure_dispositions.test.sql").read_text()
    prefix = fixture.split("insert into er263 values('staff_context'")[0]
    prefix = prefix.replace("select no_plan();", "select no_plan();create table private.dsr_erasure_race_fixture_refs263(plan_id uuid,content_hash text,review_proof_hash text,report_id uuid,report_sha256 text);alter table private.dsr_erasure_race_fixture_refs263 enable row level security;revoke all on private.dsr_erasure_race_fixture_refs263 from public,anon,authenticated,service_role;")
    setup = prefix + """insert into private.dsr_erasure_race_fixture_refs263(plan_id,content_hash,review_proof_hash)select(p.v->>'plan_id')::uuid,p.v->>'content_hash',r.v->>'review_proof_hash'from er263 p,er263 r where p.k='plan'and r.k='review';
insert into public.platform_user_roles(user_id,role_code)values('a2630000-0000-4000-8000-000000000004','COMPLIANCE_MANAGER');
""" + actor(1) + """insert into er263 values('report',public.prepare_dsr_erasure_report_v1((select(v->>'plan_id')::uuid from er263 where k='plan'),(select v->>'content_hash'from er263 where k='plan')));reset role;
update private.dsr_erasure_race_fixture_refs263 set report_id=(select(v->>'execution_id')::uuid from er263 where k='report'),report_sha256=(select v->>'sha256'from er263 where k='report');commit;"""
    sql(setup)
    refs = json.loads(sql("select row_to_json(r)from private.dsr_erasure_race_fixture_refs263 r"))
    plan, content, proof = refs["plan_id"], refs["content_hash"], refs["review_proof_hash"]
    results = [race(1, f"select public.execute_dsr_erasure_sources_v1('{plan}','{content}','{proof}')", 4),
               race(2, f"select public.review_dsr_erasure_plan_v1('{plan}','{content}',true,true,'TEST_ONLY_263_REVIEW','TEST synthetic policy review, not a real legal approval')", 2),
               race(3, f"select public.review_dsr_erasure_report_v1('{refs['report_id']}','{refs['report_sha256']}',true,'TEST concurrent independent report review')", 2)]
    state = json.loads(sql(f"select jsonb_build_object('native_receipts',(select count(*)from public.dsr_erasure_source_receipts_v1 where plan_id='{plan}'),'report_reviews',(select count(*)from public.dsr_erasure_report_reviews_v1 where execution_id='{refs['report_id']}'),'profile',(select display_name from public.user_profiles where id='a2630000-0000-4000-8000-000000000003'))"))
    assert state == {"native_receipts": 0, "report_reviews": 0, "profile": "TEST personal name263"}, state
    print(json.dumps({"result": "PASS", "database": DATABASE, "cases": results, "effects_after_revoked_authority": 0}, sort_keys=True))


if __name__ == "__main__":
    main()
