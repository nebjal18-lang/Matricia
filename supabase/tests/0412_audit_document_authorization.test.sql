-- Run only against a disposable, reserved clone with all migrations applied.
BEGIN;
SELECT plan(17);

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SET LOCAL row_security = on;
SET LOCAL search_path = pg_catalog, public, extensions;
SET LOCAL request.jwt.claims = '{}';
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL request.jwt.claim.role = '';

CREATE TEMP TABLE doc01_observed (
  actor_kind text PRIMARY KEY,
  effective_sql_role text NOT NULL,
  rls_active boolean NOT NULL,
  document_select_rows bigint NOT NULL,
  rpc_allowed boolean NOT NULL,
  rpc_result text NOT NULL
) ON COMMIT DROP;

DO $doc01$
<<doc01_fixture>>
DECLARE
  owner_a   uuid := extensions.gen_random_uuid();
  viewer_a  uuid := extensions.gen_random_uuid();
  owner_b   uuid := extensions.gen_random_uuid();
  reviewer  uuid := extensions.gen_random_uuid();

  session_owner_a  uuid := extensions.gen_random_uuid();
  session_viewer_a uuid := extensions.gen_random_uuid();
  session_owner_b  uuid := extensions.gen_random_uuid();
  session_reviewer uuid := extensions.gen_random_uuid();

  org_a uuid := extensions.gen_random_uuid();
  org_b uuid := extensions.gen_random_uuid();

  membership_owner_a  uuid := extensions.gen_random_uuid();
  membership_viewer_a uuid := extensions.gen_random_uuid();
  membership_owner_b  uuid := extensions.gen_random_uuid();

  compliance_case uuid := extensions.gen_random_uuid();
  policy_id uuid := extensions.gen_random_uuid();
  policy_version integer;
  document_id uuid := extensions.gen_random_uuid();
  scan_id uuid := extensions.gen_random_uuid();

  object_path text;
  fixture_environment text;
  actor record;
  visible_rows bigint;
  authorization_result jsonb;
  allowed boolean;
  denied_reason text;
  sql_role text;
  active_rls boolean;
BEGIN
  -- Refus avant toute insertion si la cible n'est pas le clone prévu.
  -- The network-isolated replay keeps the image database name but marks its
  -- newly created database with a per-run identity. Never accept its name alone.
  IF current_database() NOT LIKE 'matricia_security_%'
     AND NOT (
       coalesce(current_setting('matricia.test_environment', true), '') = 'reserved-local-clone'
       AND coalesce(current_setting('matricia.test_clone_id', true), '') ~ '^[a-f0-9]{32}$'
     ) THEN
    RAISE EXCEPTION 'DOC01_WRONG_DATABASE: %', current_database();
  END IF;

  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'DOC01_REQUIRES_POSTGRES_SETUP_ROLE';
  END IF;

  SELECT environment INTO fixture_environment
  FROM private.admin_execution_environment_v1
  WHERE singleton;

  IF fixture_environment IS NULL
     OR fixture_environment NOT IN ('DEVELOPMENT', 'STAGING') THEN
    RAISE EXCEPTION 'DOC01_REQUIRES_NONPRODUCTION_SCAN_ENVIRONMENT';
  END IF;

  object_path := org_a::text || '/' || compliance_case::text
                 || '/' || document_id::text || '.pdf';

  -- Trois acteurs observés ; reviewer distinct pour le contrôle quatre yeux.
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  SELECT
    x.id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated', 'authenticated',
    'doc01-' || x.id::text || '@example.invalid',
    '',
    clock_timestamp(), '{}'::jsonb, '{}'::jsonb,
    clock_timestamp(), clock_timestamp()
  FROM (
    VALUES (owner_a), (viewer_a), (owner_b), (reviewer)
  ) AS x(id);

  -- Sessions présentes pour ne pas utiliser l'exception "session_id absent"
  -- réservée aux fixtures SQL de maintenance.
  INSERT INTO auth.sessions (
    id, user_id, created_at, updated_at, aal, not_after
  )
  VALUES
    (session_owner_a, owner_a, now(), now(), 'aal1',
     now() + interval '1 hour'),
    (session_viewer_a, viewer_a, now(), now(), 'aal1',
     now() + interval '1 hour'),
    (session_owner_b, owner_b, now(), now(), 'aal1',
     now() + interval '1 hour'),
    (session_reviewer, reviewer, now(), now(), 'aal2',
     now() + interval '1 hour');

  INSERT INTO public.organizations (
    id, legal_name, display_name, status, created_by
  )
  VALUES
    (org_a, 'DOC01 Synthetic Tenant A', 'DOC01 Tenant A',
     'ACTIVE', owner_a),
    (org_b, 'DOC01 Synthetic Tenant B', 'DOC01 Tenant B',
     'ACTIVE', owner_b);

  INSERT INTO public.organization_memberships (
    id, organization_id, user_id, status, activated_at
  )
  VALUES
    (membership_owner_a, org_a, owner_a, 'ACTIVE', now()),
    (membership_viewer_a, org_a, viewer_a, 'ACTIVE', now()),
    (membership_owner_b, org_b, owner_b, 'ACTIVE', now());

  INSERT INTO public.organization_member_roles (
    membership_id, role_code, granted_by
  )
  VALUES
    (membership_owner_a, 'CLIENT_OWNER', owner_a),
    (membership_viewer_a, 'CLIENT_VIEWER', owner_a),
    (membership_owner_b, 'CLIENT_OWNER', owner_b);

  INSERT INTO public.platform_user_roles (
    user_id, role_code, granted_by
  )
  VALUES (reviewer, 'COMPLIANCE_MANAGER', reviewer);

  INSERT INTO public.client_compliance_cases (
    id, organization_id, status, created_by
  )
  VALUES (
    compliance_case, org_a, 'PROFILE_IN_PROGRESS', owner_a
  );

  -- Politique propre à la fixture ; aucune configuration existante modifiée.
  SELECT coalesce(max(version), 0) + 1 INTO policy_version
  FROM public.client_document_policy_versions
  WHERE document_type = 'REGISTRATION_DOCUMENT';

  INSERT INTO public.client_document_policy_versions (
    id, document_type, version, allowed_file_types,
    max_size_bytes, status, effective_from
  )
  VALUES (
    policy_id, 'REGISTRATION_DOCUMENT', policy_version,
    '[{"extension":"pdf","mime":"application/pdf"}]'::jsonb,
    10485760, 'DRAFT', now()
  );

  -- Métadonnées uniquement : aucun storage.objects ni binaire.
  INSERT INTO public.client_compliance_documents (
    id, compliance_case_id, organization_id,
    document_type, version, policy_version_id,
    document_number, issuer, issued_on,
    original_file_name, file_extension,
    declared_mime_type, declared_size_bytes, declared_sha256,
    storage_bucket, storage_object_path,
    detected_mime_type, detected_size_bytes,
    status, uploaded_at, created_by
  )
  VALUES (
    document_id, compliance_case, org_a,
    'REGISTRATION_DOCUMENT', 1, policy_id,
    'DOC01-SYNTHETIC', 'DOC01 synthetic issuer', current_date,
    'doc01-synthetic-no-binary.pdf', 'pdf',
    'application/pdf', 128, repeat('a', 64),
    'client-compliance', object_path,
    'application/pdf', 128,
    'PENDING_REVIEW', now(), owner_a
  );

  -- Preuve de scan synthétique pour isoler le contrôle d'autorisation.
  -- Ceci ne constitue pas un test du scanner ou de l'upload.
  INSERT INTO private.client_document_scan_results (
    id, document_id, organization_id, sequence,
    result, engine_code, engine_version,
    computed_sha256, detected_mime_type, detected_size_bytes,
    scanner_principal, correlation_id
  )
  VALUES (
    scan_id, document_id, org_a, 1,
    'CLEAN', 'TEST_SCANNER', 'DOC01-synthetic',
    repeat('a', 64), 'application/pdf', 128,
    'SUPABASE_SERVICE_ROLE', extensions.gen_random_uuid()
  );

  -- Préparation privilégiée de la fixture, avec reviewer distinct et AAL2.
  PERFORM set_config(
    'request.jwt.claim.sub', reviewer::text, true
  );
  PERFORM set_config(
    'request.jwt.claim.role', 'authenticated', true
  );
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', reviewer,
      'role', 'authenticated',
      'aal', 'aal2',
      'session_id', session_reviewer
    )::text,
    true
  );

  UPDATE public.client_compliance_documents
  SET scan_status = 'CLEAN',
      current_scan_result_id = scan_id,
      scanned_at = now(),
      status = 'VERIFIED',
      reviewed_by = reviewer,
      reviewed_at = now()
  WHERE id = document_id;

  IF EXISTS (
    SELECT 1
    FROM storage.objects s
    WHERE s.bucket_id = 'client-compliance'
      AND s.name = object_path
  ) THEN
    RAISE EXCEPTION 'DOC01_UNEXPECTED_STORAGE_OBJECT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_document_bindings b
    WHERE b.document_id = doc01_fixture.document_id
  ) THEN
    RAISE EXCEPTION 'DOC01_UNEXPECTED_DOCUMENT_BINDING';
  END IF;

  FOR actor IN
    SELECT *
    FROM (
      VALUES
        ('OWNER_A', owner_a, session_owner_a),
        ('ADMIN_A', owner_a, session_owner_a),
        ('VIEWER_A', viewer_a, session_viewer_a),
        ('VIEWER_BOUND', viewer_a, session_viewer_a),
        ('VIEWER_REVOKED_BINDING', viewer_a, session_viewer_a),
        ('REVOKED_ADMIN', owner_a, session_owner_a),
        ('OTHER_TENANT_OWNER', owner_b, session_owner_b)
    ) AS x(kind, user_id, session_id)
  LOOP
    IF actor.kind = 'ADMIN_A' THEN
      INSERT INTO public.organization_member_roles(membership_id,role_code,granted_by)
      VALUES(membership_owner_a,'CLIENT_ADMIN',owner_a);
      UPDATE public.organization_member_roles SET revoked_at = now()
      WHERE membership_id = membership_owner_a AND role_code = 'CLIENT_OWNER';
    ELSIF actor.kind = 'VIEWER_BOUND' THEN
      INSERT INTO public.client_document_bindings(organization_id,document_id,target_type,target_id,purpose,document_version,document_sha256,consented_by,correlation_id)
      VALUES(org_a,document_id,'SERVICE_REQUEST',extensions.gen_random_uuid(),'Synthetic consent fixture',1,repeat('a',64),owner_a,extensions.gen_random_uuid());
    ELSIF actor.kind = 'VIEWER_REVOKED_BINDING' THEN
      INSERT INTO public.client_document_binding_revocations(binding_id,organization_id,reason,revoked_by,correlation_id)
      SELECT b.id,org_a,'Synthetic revocation',owner_a,extensions.gen_random_uuid()
      FROM public.client_document_bindings b WHERE b.document_id = doc01_fixture.document_id;
    ELSIF actor.kind = 'REVOKED_ADMIN' THEN
      UPDATE public.organization_member_roles SET revoked_at = now()
      WHERE membership_id = membership_owner_a AND role_code = 'CLIENT_ADMIN';
    END IF;
    PERFORM set_config(
      'request.jwt.claim.sub', actor.user_id::text, true
    );
    PERFORM set_config(
      'request.jwt.claim.role', 'authenticated', true
    );
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'sub', actor.user_id,
        'role', 'authenticated',
        'aal', 'aal1',
        'session_id', actor.session_id
      )::text,
      true
    );

    authorization_result := NULL;
    denied_reason := NULL;

    BEGIN
      EXECUTE 'SET LOCAL ROLE authenticated';

      sql_role := current_user;
      active_rls := row_security_active(
        'public.client_compliance_documents'::regclass
      );

      IF sql_role <> 'authenticated' OR NOT active_rls THEN
        RAISE EXCEPTION 'DOC01_INVALID_RLS_TEST_CONTEXT';
      END IF;

      -- Vérifie aussi le garde de session utilisé par PostgREST.
      PERFORM public.prepare_current_auth_request_v1(
        'authenticated'
      );

      SELECT count(*) INTO visible_rows
      FROM public.client_compliance_documents d
      WHERE d.id = document_id;

      BEGIN
        authorization_result :=
          public.authorize_client_bound_document(document_id);
      EXCEPTION
        WHEN insufficient_privilege THEN
          IF SQLERRM <> 'CLIENT_DOCUMENT_DENIED' THEN
            RAISE;
          END IF;
          denied_reason := SQLSTATE || ':' || SQLERRM;
      END;

      EXECUTE 'RESET ROLE';
    EXCEPTION
      WHEN OTHERS THEN
        EXECUTE 'RESET ROLE';
        RAISE;
    END;

    allowed := authorization_result IS NOT NULL;

    IF allowed THEN
      IF authorization_result->>'outcome'
           IS DISTINCT FROM 'CLIENT_DOCUMENT_AUTHORIZED'
         OR authorization_result->>'document_id'
           IS DISTINCT FROM document_id::text
         OR authorization_result->>'bucket'
           IS DISTINCT FROM 'client-compliance'
         OR authorization_result->>'object_path'
           IS DISTINCT FROM object_path THEN
        RAISE EXCEPTION 'DOC01_UNEXPECTED_RPC_GRANT: %',
          actor.kind;
      END IF;
    END IF;

    IF actor.kind IN ('OWNER_A','ADMIN_A') THEN
      IF visible_rows <> 1 OR NOT allowed THEN
        RAISE EXCEPTION 'DOC01_OWNER_ALLOW_NOT_REPRODUCED';
      END IF;

    ELSE
      IF visible_rows <> 0
         OR allowed
         OR denied_reason IS DISTINCT FROM
              '42501:CLIENT_DOCUMENT_DENIED' THEN
        RAISE EXCEPTION 'DOC01_OTHER_TENANT_DENY_NOT_REPRODUCED';
      END IF;
    END IF;

    INSERT INTO pg_temp.doc01_observed
    VALUES (
      actor.kind, sql_role, active_rls, visible_rows, allowed,
      coalesce(authorization_result->>'outcome', denied_reason)
    );
  END LOOP;

  -- Les deux autorisations réussies doivent avoir été auditées.
  IF (
    SELECT count(*)
    FROM public.audit_events e
    WHERE e.action = 'client.document.downloaded'
      AND e.resource_type = 'client_compliance_document'
      AND e.resource_id = document_id::text
      AND e.actor_user_id = owner_a
  ) <> 2 OR (
    SELECT count(*)
    FROM public.audit_events e
    WHERE e.action = 'client.document.downloaded'
      AND e.resource_type = 'client_compliance_document'
      AND e.resource_id = document_id::text
      AND e.actor_user_id = viewer_a
  ) <> 0 THEN
    RAISE EXCEPTION 'DOC01_DOWNLOAD_AUDIT_NOT_REPRODUCED';
  END IF;
END
$doc01$;

SELECT pass('Owner/Admin allowed; viewer unbound/bound/revoked, revoked admin and other tenant denied under authenticated RLS');

UPDATE private.admin_execution_environment_v1 SET environment = 'PRODUCTION' WHERE singleton;
SELECT throws_ok($probe$DO $guard$ BEGIN
  SET LOCAL ROLE service_role;
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'INVALID_TEST_ROLE'; END IF;
  PERFORM public.ensure_demo_admin_platform_role_v1(null);
END $guard$;$probe$,'42501','DEMO_ADMIN_ENVIRONMENT_DENIED','admin provisioning denied in production');
RESET ROLE;
SELECT throws_ok($probe$DO $guard$ BEGIN
  SET LOCAL ROLE authenticated;
  IF current_user <> 'authenticated' THEN RAISE EXCEPTION 'INVALID_TEST_ROLE'; END IF;
  PERFORM public.reset_demo_box_network_v1();
END $guard$;$probe$,'42501','DEMO_BOX_RESET_ENVIRONMENT_DENIED','box reset denied in production');
SELECT throws_ok($probe$DO $guard$ BEGIN
  SET LOCAL ROLE service_role;
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'INVALID_TEST_ROLE'; END IF;
  PERFORM public.reset_demo_box_network_v1();
END $guard$;$probe$,'42501','DEMO_BOX_RESET_ENVIRONMENT_DENIED','service_role box alias denied in production');
RESET ROLE;
UPDATE private.admin_execution_environment_v1 SET environment = null WHERE singleton;
SELECT throws_ok($probe$DO $guard$ BEGIN
  SET LOCAL ROLE service_role;
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'INVALID_TEST_ROLE'; END IF;
  PERFORM public.ensure_demo_admin_platform_role_v1(null);
END $guard$;$probe$,'42501','DEMO_ADMIN_ENVIRONMENT_DENIED','admin provisioning denied without environment');
RESET ROLE;
SELECT throws_ok($probe$DO $guard$ BEGIN
  SET LOCAL ROLE authenticated;
  IF current_user <> 'authenticated' THEN RAISE EXCEPTION 'INVALID_TEST_ROLE'; END IF;
  PERFORM public.reset_demo_box_network_v1();
END $guard$;$probe$,'42501','DEMO_BOX_RESET_ENVIRONMENT_DENIED','box reset denied without environment');
SELECT throws_ok($probe$DO $guard$ BEGIN
  SET LOCAL ROLE service_role;
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'INVALID_TEST_ROLE'; END IF;
  PERFORM public.reset_demo_box_network_v1();
END $guard$;$probe$,'42501','DEMO_BOX_RESET_ENVIRONMENT_DENIED','service_role box alias denied without environment');
RESET ROLE;
DELETE FROM private.admin_execution_environment_v1 WHERE singleton;
SELECT throws_ok($probe$DO $guard$ BEGIN
  SET LOCAL ROLE service_role;
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'INVALID_TEST_ROLE'; END IF;
  PERFORM public.ensure_demo_admin_platform_role_v1(null);
END $guard$;$probe$,'42501','DEMO_ADMIN_ENVIRONMENT_DENIED','admin provisioning denied without configuration row');
RESET ROLE;
SELECT throws_ok($probe$DO $guard$ BEGIN
  SET LOCAL ROLE authenticated;
  IF current_user <> 'authenticated' THEN RAISE EXCEPTION 'INVALID_TEST_ROLE'; END IF;
  PERFORM public.reset_demo_box_network_v1();
END $guard$;$probe$,'42501','DEMO_BOX_RESET_ENVIRONMENT_DENIED','box reset denied without configuration row');
SELECT throws_ok($probe$DO $guard$ BEGIN
  SET LOCAL ROLE service_role;
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'INVALID_TEST_ROLE'; END IF;
  PERFORM public.reset_demo_box_network_v1();
END $guard$;$probe$,'42501','DEMO_BOX_RESET_ENVIRONMENT_DENIED','service_role box alias denied without configuration row');
RESET ROLE;
INSERT INTO private.admin_execution_environment_v1(singleton,environment) VALUES(true,'DEVELOPMENT');
SET LOCAL request.jwt.claim.role = 'service_role';
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
SELECT throws_ok($probe$DO $guard$ BEGIN
  SET LOCAL ROLE service_role;
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'INVALID_TEST_ROLE'; END IF;
  PERFORM public.ensure_demo_admin_platform_role_v1(null);
END $guard$;$probe$,'22023','INVALID_DEMO_ADMIN_USER','development passes environment guard but retains input validation');
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claims = '{"role":"authenticated"}';
SELECT throws_ok($probe$DO $guard$ BEGIN
  SET LOCAL ROLE authenticated;
  IF current_user <> 'authenticated' THEN RAISE EXCEPTION 'INVALID_TEST_ROLE'; END IF;
  PERFORM public.reset_demo_box_network_v1();
END $guard$;$probe$,'42501','DEMO_WORKSPACE_RESET_DENIED','development retains actor authorization');
RESET ROLE;
-- ACL checks do not grant test-only schema/function permissions to application roles.
SELECT ok(
  has_function_privilege('authenticated','public.authorize_client_bound_document(uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.authorize_client_bound_document(uuid)','EXECUTE')
  AND NOT has_function_privilege('service_role','public.authorize_client_bound_document(uuid)','EXECUTE'),
  'document RPC execute ACL is authenticated only');
SELECT ok(
  has_function_privilege('service_role','public.ensure_demo_admin_platform_role_v1(uuid)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.ensure_demo_admin_platform_role_v1(uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.ensure_demo_admin_platform_role_v1(uuid)','EXECUTE'),
  'demo admin provisioning execute ACL is service_role only');
SELECT ok(
  has_function_privilege('authenticated','public.reset_demo_box_network_v1()','EXECUTE')
  AND has_function_privilege('service_role','public.reset_demo_box_network_v1()','EXECUTE')
  AND NOT has_function_privilege('anon','public.reset_demo_box_network_v1()','EXECUTE'),
  'demo box reset retains authenticated and service_role execute ACL');
DO $persona$
DECLARE demo_user uuid := extensions.gen_random_uuid(); denied boolean := false;
BEGIN
  INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  VALUES(demo_user,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'sec02-'||demo_user::text||'@matricia.test','',now(),
    '{"matricia_demo":true,"demo_persona":"client"}','{}',now(),now());
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  SET LOCAL ROLE service_role;
  BEGIN
    PERFORM public.ensure_demo_admin_platform_role_v1(demo_user);
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'DEMO_ADMIN_PERSONA_REQUIRED' THEN RAISE; END IF;
    denied := true;
  END;
  RESET ROLE;
  IF NOT denied THEN RAISE EXCEPTION 'WRONG_PERSONA_WAS_GRANTED'; END IF;
  IF EXISTS(SELECT 1 FROM public.platform_user_roles WHERE user_id=demo_user) THEN
    RAISE EXCEPTION 'DENIED_PERSONA_LEFT_ROLE_EFFECT';
  END IF;
  UPDATE auth.users SET raw_app_meta_data='{"matricia_demo":true,"demo_persona":"admin"}' WHERE id=demo_user;
  SET LOCAL ROLE service_role;
  IF public.ensure_demo_admin_platform_role_v1(demo_user) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SYNTHETIC_ADMIN_NOT_GRANTED';
  END IF;
  RESET ROLE;
  IF NOT EXISTS(SELECT 1 FROM public.platform_user_roles WHERE user_id=demo_user AND role_code='MATRICIA_ADMIN' AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'SYNTHETIC_ADMIN_ROLE_MISSING';
  END IF;
END $persona$;
SELECT pass('development service_role denies wrong persona without effects and provisions marked synthetic admin');
DO $alias$
DECLARE fixture_user uuid := extensions.gen_random_uuid(); fixture_org uuid := extensions.gen_random_uuid(); result jsonb;
BEGIN
  INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  VALUES(fixture_user,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'sec02-alias-'||fixture_user::text||'@matricia.test','',now(),'{"matricia_demo":true,"demo_persona":"client"}','{}',now(),now());
  INSERT INTO public.organizations(id,legal_name,display_name,status,created_by)
  VALUES(fixture_org,'SEC02 alias fixture','SEC02 alias fixture','ACTIVE',fixture_user);
  INSERT INTO public.organization_memberships(organization_id,user_id,status,activated_at)
  VALUES(fixture_org,fixture_user,'ACTIVE',now());
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  SET LOCAL ROLE service_role;
  result := public.reset_demo_box_network_v1();
  RESET ROLE;
  IF result->>'outcome' IS DISTINCT FROM 'DEMO_WORKSPACE_RESET'
     OR NOT (result ? 'archived_organizations' AND result ? 'deactivated_memberships') THEN
    RAISE EXCEPTION 'BOX_ALIAS_LOST_FULL_WORKSPACE_RESULT';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=fixture_org AND status='ARCHIVED')
     OR NOT EXISTS(SELECT 1 FROM public.organization_memberships WHERE organization_id=fixture_org AND user_id=fixture_user AND status='REVOKED') THEN
    RAISE EXCEPTION 'BOX_ALIAS_LOST_WORKSPACE_EFFECTS';
  END IF;
END $alias$;
SELECT pass('service_role box alias invokes full workspace reset including organization archival and membership revocation');
SELECT * FROM finish();
ROLLBACK;
