Je vais préparer une sonde à partir des signatures SQL et des fixtures existantes, sans l’exécuter. Je distinguerai les défauts établis par lecture du code des comportements que le coordinateur devra confirmer sur le clone.

Les signatures nécessaires sont vérifiées. La sonde utilisera deux livres séparés, créera les journaux via la RPC native et réutilisera la règle Core V1. Elle ne dépendra ni des migrations démo manquantes, ni de `pg_cron`, ni de pgTAP. Le rejeu sera capturé dans un sous-bloc pour permettre d’atteindre le `ROLLBACK` final.

Voici une sonde autonome pour une connexion **`postgres` ou `supabase_admin` au clone isolé**. Je ne l’ai pas exécutée.

Elle reprend les fixtures du [test financier 0362](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/tests/0362_franchise_operational_financial_integrity.test.sql:3), la signature native de [post_financial_journal](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261031100000_restore_financial_canonical_idempotency.sql:5) et les [RPC du pot Core](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:190). Les deux cas utilisent des livres distincts. Aucun besoin de catalogue, démo, pgTAP ou `pg_cron`.

```sql
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

-- Cas 2 : deux intervalles distincts contenant le même revenu du 14.
DO $overlap$
DECLARE
  c record;
  a jsonb;
  b jsonb;
BEGIN
  SELECT * INTO STRICT c FROM audit_core_probe WHERE case_id = 2;

  -- Les claims de l'acteur du cas 2 sont encore actifs.
  a := public.close_platform_core_pot_period(
    p_book_id => c.book_id,
    p_period_start => DATE '2026-11-12',
    p_period_end => DATE '2026-11-15',
    p_rule_version_id => c.rule_id,
    p_entry_cutoff_at => c.cutoff_at,
    p_reason => 'TEST rollback-only first overlapping period',
    p_idempotency_key => 'core-probe-close-a'
  );

  b := public.close_platform_core_pot_period(
    p_book_id => c.book_id,
    p_period_start => DATE '2026-11-14',
    p_period_end => DATE '2026-11-16',
    p_rule_version_id => c.rule_id,
    p_entry_cutoff_at => c.cutoff_at,
    p_reason => 'TEST rollback-only second overlapping period',
    p_idempotency_key => 'core-probe-close-b'
  );

  UPDATE audit_core_probe
  SET close_a = a, close_b = b
  WHERE case_id = 2;
END
$overlap$;

-- Chaque clôture doit avoir ses deux allocations équilibrées.
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

-- Cas 3 facultatif : rejeu strictement identique de la clôture A.
-- Le sous-bloc capture l'erreur sans annuler les preuves précédentes.
DO $replay$
DECLARE
  c record;
  result jsonb;
  err_state text;
  err_message text;
BEGIN
  SELECT * INTO STRICT c FROM audit_core_probe WHERE case_id = 2;

  BEGIN
    result := public.close_platform_core_pot_period(
      p_book_id => c.book_id,
      p_period_start => DATE '2026-11-12',
      p_period_end => DATE '2026-11-15',
      p_rule_version_id => c.rule_id,
      p_entry_cutoff_at => c.cutoff_at,
      p_reason => 'TEST rollback-only first overlapping period',
      p_idempotency_key => 'core-probe-close-a'
    );

    UPDATE audit_core_probe
    SET replay_state = '00000',
        replay_response = result
    WHERE case_id = 2;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      err_state = RETURNED_SQLSTATE,
      err_message = MESSAGE_TEXT;

    UPDATE audit_core_probe
    SET replay_state = err_state,
        replay_message = err_message
    WHERE case_id = 2;
  END;
END
$replay$;

RESET ROLE;
SET CONSTRAINTS ALL IMMEDIATE;

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

-- Résultat 2 attendu :
-- source_minor=10000, accrued_rights_minor=20000,
-- versions A/B=1/1, bug2_reproduced=true.
WITH evidence AS (
  SELECT c.close_a->>'version' AS version_a,
         c.close_b->>'version' AS version_b,
    (
      SELECT coalesce(sum(e.amount_minor), 0)
      FROM public.platform_core_pot_entries e
      WHERE e.book_id = c.book_id
    ) AS source_minor,
    (
      SELECT coalesce(sum(l.amount_minor), 0)
      FROM public.platform_core_pot_distribution_ledger_entries l
      WHERE l.book_id = c.book_id
        AND l.entry_type = 'ACCRUAL'
        AND l.closure_version_id IN (
          (c.close_a->>'closure_version_id')::uuid,
          (c.close_b->>'closure_version_id')::uuid
        )
    ) AS accrued_rights_minor
  FROM audit_core_probe c WHERE c.case_id = 2
)
SELECT *,
  version_a = '1' AND version_b = '1'
    AND source_minor = 10000
    AND accrued_rights_minor = 20000 AS bug2_reproduced
FROM evidence;

-- Résultat 3 attendu sur le code audité :
-- 22000 / IDEMPOTENCY_PAYLOAD_MISMATCH / true.
SELECT replay_state, replay_message,
       replay_response = close_a AS identical_response_returned,
       replay_state = '22000'
         AND replay_message = 'IDEMPOTENCY_PAYLOAD_MISMATCH'
         AS bug3_reproduced
FROM audit_core_probe
WHERE case_id = 2;

ROLLBACK;
```

Résultats attendus et niveau de preuve actuel :

| Sonde | Gravité technique | Établi statiquement | Confirmation runtime attendue |
|---|---|---|---|
| 1 — rapprochement absent | **P1** | Montant/source non rapprochés du journal | Journal de dépense **100**, revenu Core accepté **10 000** |
| 2 — chevauchement | **P1** | Intervalles distincts autorisés, chacun créant ses accruals | Source unique **10 000**, droits cumulés **20 000** |
| 3 — rejeu | **P2** | Empreinte incluant la prochaine version générée | Même requête rejetée avec **`22000 / IDEMPOTENCY_PAYLOAD_MISMATCH`** |

**À ce stade : analyse statique confirmée, reproductions métier runtime non exécutées de mon côté.** Les cas supposent un acteur Finance autorisé ; ils ne démontrent ni accès non autorisé ni virement réel. Le cas 2 démontre un double droit comptabilisé.

Une erreur avant les résultats constitue un blocage à examiner, pas une reproduction réussie. `ROLLBACK` annule les fixtures et écritures ; les séquences identity peuvent néanmoins avancer sur le clone.
