BEGIN;
SET LOCAL search_path = public, extensions, pg_temp;
SET LOCAL timezone = 'UTC';
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Connexion propriétaire requise pour les fixtures uniquement.
DO $preflight$
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'PROBE_REQUIRES_CLONE_OWNER_CONNECTION';
  END IF;
END
$preflight$;

CREATE TEMP TABLE audit_core_probe (
  case_id integer PRIMARY KEY,
  actor_id uuid NOT NULL DEFAULT extensions.gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT extensions.gen_random_uuid(),
  cash_account_id uuid NOT NULL DEFAULT extensions.gen_random_uuid(),
  other_account_id uuid NOT NULL DEFAULT extensions.gen_random_uuid(),
  rule_id uuid NOT NULL,
  book_id uuid,
  journal_id uuid,
  post_result jsonb,
  cutoff_at timestamptz,
  close_a jsonb,
  close_b jsonb,
  replay_state text,
  replay_message text,
  replay_response jsonb
) ON COMMIT DROP;

-- Règle métier installée par la migration Core, sans dépendance démo.
INSERT INTO audit_core_probe(case_id, rule_id)
SELECT v.case_id, r.id
FROM (VALUES (1), (2)) AS v(case_id)
CROSS JOIN public.platform_core_pot_rule_versions r
WHERE r.version = 1
  AND r.status = 'ACTIVE'
  AND r.neoxa_jalil_share_bps = 5000
  AND r.asma_matricia_share_bps = 5000
  AND r.effective_from <= DATE '2026-11-12'
  AND (r.effective_to IS NULL OR r.effective_to >= DATE '2026-11-16');

DO $rule_check$
BEGIN
  IF (SELECT count(*) FROM audit_core_probe) <> 2 THEN
    RAISE EXCEPTION 'PROBE_CORE_RULE_V1_NOT_AVAILABLE';
  END IF;
END
$rule_check$;

-- Identités synthétiques ; aucun compte existant réutilisé.
INSERT INTO auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
SELECT actor_id, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated',
       'core-pot-probe-' || actor_id::text || '@example.invalid',
       '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
FROM audit_core_probe;

INSERT INTO public.organizations(
  id, legal_name, display_name, status, created_by
)
SELECT organization_id,
       'TEST Core Pot Probe ' || case_id,
       'TEST Core Pot Probe ' || case_id,
       'ACTIVE', actor_id
FROM audit_core_probe;

INSERT INTO public.platform_user_roles(user_id, role_code)
SELECT actor_id, 'FINANCE_MANAGER'
FROM audit_core_probe;

INSERT INTO public.financial_accounts(
  id, organization_id, code, name, account_type, currency
)
SELECT cash_account_id, organization_id,
       'TEST_PROBE_CASH', 'TEST probe cash', 'ASSET', 'MAD'
FROM audit_core_probe
UNION ALL
SELECT other_account_id, organization_id,
       'TEST_PROBE_OTHER', 'TEST probe counterpart',
       CASE WHEN case_id = 1 THEN 'EXPENSE' ELSE 'REVENUE' END,
       'MAD'
FROM audit_core_probe;

GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT SELECT, UPDATE ON audit_core_probe TO authenticated;

-- Toutes les mutations métier ci-dessous passent par les RPC,
-- sous rôle authenticated + Finance + aal2.
SET LOCAL ROLE authenticated;

DO $native_setup$
DECLARE
  c record;
  b uuid;
  j uuid;
  lines jsonb;
  result jsonb;
BEGIN
  FOR c IN SELECT * FROM audit_core_probe ORDER BY case_id LOOP
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'sub', c.actor_id::text,
        'role', 'authenticated',
        'aal', 'aal2'
      )::text,
      true
    );
    PERFORM set_config('request.jwt.claim.sub', c.actor_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    b := (
      public.open_platform_core_pot_book(
        p_audit_organization_id => c.organization_id,
        p_currency => 'MAD',
        p_rule_version_id => c.rule_id,
        p_idempotency_key => 'core-probe-open-' || c.case_id
      )->>'book_id'
    )::uuid;

    IF c.case_id = 1 THEN
      -- Cas 1 : journal équilibré de dépense de 100,
      -- sans aucune ligne de revenu.
      lines := jsonb_build_array(
        jsonb_build_object(
          'account_id', c.other_account_id,
          'direction', 'DEBIT',
          'amount_minor', 100
        ),
        jsonb_build_object(
          'account_id', c.cash_account_id,
          'direction', 'CREDIT',
          'amount_minor', 100
        )
      );
    ELSE
      -- Cas 2 indépendant : journal équilibré de revenu de 10 000.
      lines := jsonb_build_array(
        jsonb_build_object(
          'account_id', c.cash_account_id,
          'direction', 'DEBIT',
          'amount_minor', 10000
        ),
        jsonb_build_object(
          'account_id', c.other_account_id,
          'direction', 'CREDIT',
          'amount_minor', 10000
        )
      );
    END IF;

    j := public.post_financial_journal(
      p_organization_id => c.organization_id,
      p_idempotency_key => 'core-probe-journal-' || c.case_id,
      p_request_hash => NULL::text,
      p_journal_type => 'TEST_CORE_POT_PROBE',
      p_currency => 'MAD'::char(3),
      p_effective_at => TIMESTAMPTZ '2026-11-14 12:00:00+01',
      p_description => 'TEST rollback-only Core pot audit journal',
      p_entries => lines
    );

    -- Cas 1 : prétend reconnaître 10 000 de revenu Core
    -- depuis le journal de dépense de 100.
    -- Cas 2 : montant concordant, réservé au test de chevauchement.
    result := public.post_platform_core_pot_entry(
      p_book_id => b,
      p_effect_type => 'REVENUE',
      p_category => 'CORE_SUBSCRIPTION_REVENUE_ACQUIRED',
      p_amount_minor => 10000::bigint,
      p_financial_journal_id => j,
      p_source_type => 'FINANCIAL_JOURNAL',
      p_source_id => j::text,
      p_effective_on => DATE '2026-11-14',
      p_reason => 'TEST rollback-only source reconciliation probe',
      p_reverses_entry_id => NULL::uuid,
      p_idempotency_key => 'core-probe-post-' || c.case_id
    );

    UPDATE audit_core_probe AS target
    SET book_id = b,
        journal_id = j,
        post_result = result,
        cutoff_at = clock_timestamp()
    WHERE target.case_id = c.case_id;
  END LOOP;
END
$native_setup$;

-- Vérifie effectivement les contraintes différées des journaux.
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;


RESET ROLE;
-- Résultat 1 attendu sur le code audité :
-- journal_debit_minor=100, journal_revenue_credit_minor=0,
-- core_minor=10000, bug1_reproduced=true.
WITH evidence AS (
  SELECT c.post_result->>'outcome' AS outcome,
    (
      SELECT coalesce(sum(e.amount_minor), 0)
      FROM public.financial_entries e
      WHERE e.journal_id = c.journal_id AND e.direction = 'DEBIT'
    ) AS journal_debit_minor,
    (
      SELECT coalesce(sum(e.amount_minor), 0)
      FROM public.financial_entries e
      JOIN public.financial_accounts a ON a.id = e.account_id
      WHERE e.journal_id = c.journal_id
        AND e.direction = 'CREDIT'
        AND a.account_type = 'REVENUE'
    ) AS journal_revenue_credit_minor,
    (
      SELECT coalesce(sum(e.amount_minor), 0)
      FROM public.platform_core_pot_entries e
      WHERE e.book_id = c.book_id
    ) AS core_minor
  FROM audit_core_probe c WHERE c.case_id = 1
)
SELECT *,
  outcome = 'PLATFORM_CORE_POT_ENTRY_POSTED'
    AND journal_debit_minor = 100
    AND journal_revenue_credit_minor = 0
    AND core_minor = 10000 AS bug1_reproduced
FROM evidence;


ROLLBACK;
