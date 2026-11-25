Je vais préparer une sonde transactionnelle avec des identités synthétiques et un document sans objet Storage, en vérifiant les contraintes et triggers cumulés. Je conserverai aussi les qualifications demandées : autoconfirmation comme risque de configuration locale, et assurance démo comme preuve source + mock.

La sonde utilisera trois acteurs avec des rôles distincts, des sessions synthétiques et des assertions sous le rôle SQL `authenticated`. Le document sera uniquement une fixture de métadonnées : aucun objet Storage ni binaire. Les politiques RLS et les triggers resteront actifs ; la sonde vérifiera l’autorisation de téléchargement, pas le transfert d’octets HTTP.

Sonde **non exécutée de mon côté**. À lancer comme `postgres`, avec `ON_ERROR_STOP=1`, uniquement sur le clone indiqué. Elle conserve RLS et triggers actifs, ne crée aucun objet Storage et vérifie l’autorisation RPC, sans téléchargement binaire.

Les lignes sont annulées par `ROLLBACK` ; la séquence du journal d’audit peut avancer sur le clone.

```sql
BEGIN;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SET LOCAL row_security = on;
SET LOCAL search_path = pg_catalog, public;
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
  authorization jsonb;
  allowed boolean;
  denied_reason text;
  sql_role text;
  active_rls boolean;
BEGIN
  -- Refus avant toute insertion si la cible n'est pas le clone prévu.
  IF current_database()
       IS DISTINCT FROM 'matricia_audit_20261119_b578c75c' THEN
    RAISE EXCEPTION 'DOC01_WRONG_DATABASE: %', current_database();
  END IF;

  IF current_user <> 'postgres' THEN
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
    WHERE b.document_id = document_id
  ) THEN
    RAISE EXCEPTION 'DOC01_UNEXPECTED_DOCUMENT_BINDING';
  END IF;

  FOR actor IN
    SELECT *
    FROM (
      VALUES
        ('OWNER_A', owner_a, session_owner_a),
        ('VIEWER_A', viewer_a, session_viewer_a),
        ('OTHER_TENANT_OWNER', owner_b, session_owner_b)
    ) AS x(kind, user_id, session_id)
  LOOP
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

    authorization := NULL;
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
        authorization :=
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

    allowed := authorization IS NOT NULL;

    IF allowed THEN
      IF authorization->>'outcome'
           IS DISTINCT FROM 'CLIENT_DOCUMENT_AUTHORIZED'
         OR authorization->>'document_id'
           IS DISTINCT FROM document_id::text
         OR authorization->>'bucket'
           IS DISTINCT FROM 'client-compliance'
         OR authorization->>'object_path'
           IS DISTINCT FROM object_path THEN
        RAISE EXCEPTION 'DOC01_UNEXPECTED_RPC_GRANT: %',
          actor.kind;
      END IF;
    END IF;

    IF actor.kind = 'OWNER_A' THEN
      IF visible_rows <> 1 OR NOT allowed THEN
        RAISE EXCEPTION 'DOC01_OWNER_ALLOW_NOT_REPRODUCED';
      END IF;

    ELSIF actor.kind = 'VIEWER_A' THEN
      IF visible_rows <> 0 OR NOT allowed THEN
        RAISE EXCEPTION
          'DOC01_VIEWER_DIVERGENCE_NOT_REPRODUCED: SELECT=%, RPC=%',
          visible_rows, allowed;
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
      coalesce(authorization->>'outcome', denied_reason)
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
  ) <> 1 OR (
    SELECT count(*)
    FROM public.audit_events e
    WHERE e.action = 'client.document.downloaded'
      AND e.resource_type = 'client_compliance_document'
      AND e.resource_id = document_id::text
      AND e.actor_user_id = viewer_a
  ) <> 1 THEN
    RAISE EXCEPTION 'DOC01_DOWNLOAD_AUDIT_NOT_REPRODUCED';
  END IF;
END
$doc01$;

SELECT *
FROM pg_temp.doc01_observed
ORDER BY CASE actor_kind
  WHEN 'OWNER_A' THEN 1
  WHEN 'VIEWER_A' THEN 2
  ELSE 3
END;

ROLLBACK;
```

Résultat attendu :

| Acteur | Rôle SQL | RLS active | SELECT | RPC autorisée |
|---|---|---:|---:|---:|
| OWNER_A | authenticated | true | 1 | true |
| VIEWER_A | authenticated | true | 0 | true |
| OTHER_TENANT_OWNER | authenticated | true | 0 | false — `42501:CLIENT_DOCUMENT_DENIED` |

Si la divergence n’est pas reproduite, la sonde lève une exception : elle ne produit pas de faux résultat positif.

Qualifications retenues pour la consolidation : **autoconfirmation locale = risque de configuration, exploitation non reproduite et portée production non établie ; assurance démo = preuve source + mock, sans attaque Auth native démontrée.**
