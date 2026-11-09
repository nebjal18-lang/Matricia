# Matricia — ExecPlan permanent

Autorité : `Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md`. Toute phase suit `SPECIFY → IMPLEMENT → TEST → REVIEW → RED TEAM → FIX → RETEST → INTEGRATE → VERIFY`. Une phase reste ouverte sans audit indépendant signé et preuves enregistrées.

## Format obligatoire d’un ExecPlan

```yaml
id:
title:
status: QUEUED | IN_PROGRESS | BLOCKED | GREEN
goal:
scope:
requirements:
invariants:
ownership:
dependencies:
milestones:
decisions:
risks:
validation_commands:
evidence_paths:
progress_log:
results:
independent_signoff:
next_phase:
```

Règles : plan vivant mis à jour pendant l’exécution ; un seul propriétaire en écriture par fichier/migration ; logs volumineux sous `artifacts/` ou `docs/evidence/` ; aucun statut `GREEN` sans tests, audit et références de preuve ; `docs/progress/PROJECT_STATE.md` et `docs/progress/phase-ledger.json` sont mis à jour après chaque phase verte.

## Plan global V1 actif

```yaml
id: MAT-V1-GM4
title: Exécution intégrale Gold Master V4 FINAL
status: IN_PROGRESS
goal: Livrer et prouver MAT-FUNC-001..068 et MARKETING-001..008 sur development/staging.
scope: P00..P19; production explicitement exclue sans autorisation.
requirements: [MAT-FUNC-001..068, MARKETING-001..008]
invariants:
  - isolation multi-tenant et RLS restrictive
  - montants exacts, ledgers immuables, idempotence, audit et Event Outbox
  - contrats et règles versionnés
  - FR/AR RTL, accessibilité et responsive 360 px
ownership: docs/orchestration/file-ownership-map.csv
dependencies: [Gold Master V4 FINAL, AGENTS.md, Supabase development, catalogue canonique]
milestones:
  - P00 reconnaissance, mémoire, ownership et matrice
  - P01 contrats écrans/formulaires/permissions/API/événements/notifications/états
  - P02 monorepo, CI, design system, configuration et observabilité
  - P03 PostgreSQL, migrations, RLS, audit, Outbox et ledgers
  - P04 identité, OTP, sessions, organisation unique et rôles
  - P05 onboarding et conformité Client
  - P06 catalogue universel, questions et builders
  - P07 diagnostics et opportunités
  - P08 abonnements, paiements, Boxes et crédits
  - P09 onboarding et qualification Provider
  - P10 franchise, CRM, gouvernance et performance
  - P11 besoins, matching, RFQ et devis
  - P12 contrats, signatures, missions et livrables
  - P13 litiges, pénalités et réaffectation
  - P14 fiscalité Maroc, facturation Provider et recouvrement
  - P15 revenus franchise, allocations et P&L
  - P16 SKU, contrats-cadres et achats groupés
  - P17 administration, automatisations, notifications et reporting
  - P18 seeds dix domaines, FR/AR et Marketing Autopilot
  - P19 hardening, audits, clean clone et staging
decisions:
  - aucune fonction n’est VERIFIED sans code, tests, preuves et visa indépendant
  - toute correction de migration appliquée utilise une nouvelle migration
  - le catalogue est chargé par sous-ensemble sauf contrôle agrégé explicite
risks:
  - couverture fonctionnelle encore majoritairement planifiée
  - Docker local indisponible; reconstruction propre à prouver dans CI
  - aucune configuration de production autorisée
validation_commands:
  - pnpm verify:phase00
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm test:db
  - pnpm build
  - pnpm release:validate
evidence_paths:
  - docs/progress/PROJECT_STATE.md
  - docs/progress/phase-ledger.json
  - docs/evidence/
  - artifacts/test-results/
progress_log:
  - 2026-09-10: socle, identité OTP initiale et migrations 00100..01300 créés
  - 2026-09-11: remédiation des écarts documentaires et agents P00 engagée
results: Les résultats exacts sont consignés dans PROJECT_STATE et le phase ledger.
independent_signoff: PENDING
next_phase: Fermer P00 indépendamment, puis poursuivre P04 sans perdre les gates P01-P03.
```

## ExecPlans des phases actives

```yaml
id: P00
title: Reconnaissance et mémoire projet
status: GREEN
goal: Obtenir un inventaire, une orchestration, des plans et matrices fidèles et auditables.
scope: [inventaire, architecture, threat model, ownership, agents, index, traceabilité initiale]
requirements: [Gold Master sections 2, 3, 30]
invariants: [autorité V4 unique, aucun secret, aucun faux VERIFIED]
ownership: program_orchestrator et documentation_curator sur fichiers réservés
dependencies: [AGENTS.md, dépôt Git]
milestones: [inventaire reproductible, 63 agents, registres initialisés, audit indépendant]
decisions: [P01 non signée par simple présence de registres]
risks: [faux positif structurel]
validation_commands: [pnpm verify:phase00, pnpm release:validate]
evidence_paths: [docs/inventory/PHASE00_INVENTORY.md, docs/specs/context-index.json, .codex/agents]
progress_log: [2026-09-11 audit FAIL puis remédiation autorité Marketing/agents/inventaire]
results: Gate automatisé vert et audit indépendant PASS au commit 32cfd89.
independent_signoff: APPROVED:requirements_traceability_auditor:phase00_signoff_32cfd89
next_phase: P01
---
id: P01
title: Spécifications atomiques
status: IN_PROGRESS
goal: Décrire sans ambiguïté les contrats des 68 fonctions et 8 fonctions Marketing.
scope: [écrans, formulaires, permissions, API, événements, notifications, états, tests]
requirements: [MAT-FUNC-001..068, MARKETING-001..008]
invariants: [références résolues, statuts honnêtes, preuves exigées pour VERIFIED]
ownership: requirements_architect sur registres attribués
dependencies: [P00, Gold Master fonctionnel]
milestones: [identité, domaines P05-P17, Marketing, matrice tests]
decisions: [aucun contrat inventé au-delà du Gold Master]
risks: [registre incomplet, références non exécutables]
validation_commands: [pnpm spec:validate, pnpm traceability:validate]
evidence_paths: [docs/specs/registries, docs/specs/sections, docs/traceability/REQUIREMENTS_COVERAGE.md]
progress_log: [2026-09-11 identité et Marketing extraits; couverture exhaustive restante]
results: 0/76 exigences VERIFIED; phase ouverte.
independent_signoff: PENDING_FULL_COVERAGE
next_phase: P02
---
id: P02
title: Socle professionnel
status: GREEN
goal: Rendre monorepo, CI, design system, observabilité et sécurité de base hermétiques.
scope: [workspace, packages, CI, design partagé, observabilité, headers]
requirements: [TypeScript strict, Design Authority A, FR/AR RTL, sécurité]
invariants: [chaque package contrôlé, clone propre reproductible]
ownership: integration_manager sur fichiers partagés
dependencies: [P00, P01 contrats socle]
milestones: [scripts tous packages, CI sans secrets, frontières, readiness, UI partagée]
decisions: [un build utilisant .env.local ne prouve pas la CI]
risks: [packages sautés, configuration non hermétique]
validation_commands: [pnpm install --frozen-lockfile, pnpm lint, pnpm typecheck, pnpm test, pnpm build]
evidence_paths: [.github/workflows/ci.yml, packages, apps]
progress_log: [2026-09-11 audits P02 ont guidé readiness réelle, redaction PII, Worker exécutable, strict TS et palette navy/bleu vif; 2026-09-11 réaudit indépendant d92d8f0 PASS]
results: 74 tests verts, poller Outbox et health/readiness Web/Worker branchés, tokens Design A consommés, logs structurés expurgés; aucun finding P0/P1/P2 ouvert.
independent_signoff: APPROVED:code_quality_reviewer:p02_signoff_d92d8f0
next_phase: P03
---
id: P03
title: PostgreSQL, RLS et primitives transactionnelles
status: IN_PROGRESS
goal: Prouver migrations propres, isolation, ledgers, audit, idempotence et Outbox.
scope: [migrations, RLS, tests SQL, concurrence, CI Supabase]
requirements: [multi-tenant, argent exact, ledgers immuables, audit, Outbox]
invariants: [ALLOW et DENY, replay propre, concurrence sûre]
ownership: database_architect; auditeur database_rls_test_agent en lecture seule
dependencies: [P02 CI, Supabase development]
milestones: [13 migrations, tests adversariaux complets, db reset CI, réaudit]
decisions: [aucune modification de migration appliquée]
risks: [Docker local absent, matrices RLS/concurrence partielles]
validation_commands: [pnpm test:db, supabase db lint, supabase db reset]
evidence_paths: [supabase/migrations, supabase/tests, scripts/run-db-tests.mjs]
progress_log: [2026-09-11 deux audits; 192 assertions, ACL runtime minimales et quatre courses réelles vertes]
results: Base development alignée et durcie; replay vierge CI bloqué par le compte GitHub Actions avant démarrage des runners.
independent_signoff: PENDING_CLEAN_REPLAY_GITHUB_ACCOUNT_LOCKED
next_phase: P04
---
id: P04
title: Auth, organisation unique et multi-rôles
status: IN_PROGRESS
goal: Livrer OTP, sessions, rattachement ICE, invitations et rôles cumulables.
scope: [auth serveur, organisations, memberships, sessions, routes FR/AR]
requirements: [MAT-FUNC-001, gate P04]
invariants: [anti-énumération, contexte serveur, cross-tenant DENY, audit]
ownership: auth_identity_agent sur tranche attribuée
dependencies: [P02, P03]
milestones: [OTP instrumenté, create/join/merge, invitations, rôles, sessions, E2E]
decisions: [création utilisateur explicite; aucun doublon ICE silencieux]
risks: [rate-limit absent, tests insuffisants, session revoke non prouvée]
validation_commands: [pnpm lint, pnpm typecheck, pnpm test, pnpm test:db, pnpm build]
evidence_paths: [apps/web/lib/auth, apps/web/app/[locale], supabase/migrations, supabase/tests]
progress_log: [2026-09-10 OTP/PKCE initial; 2026-09-11 backend identité et écran FR/AR create-or-request ICE livrés; 2026-09-11 demandes de rôles cumulables et approbation centrale appliquées sur development; 2026-09-11 invitations accept/refuse et 36 E2E FR/AR mobile/desktop verts]
results: Backend identité, OTP serveur, parcours organisation, gestion des sessions, demandes de rôles cumulables et invitations opérationnels; 33 tests Web, 69 assertions SQL P04 et 36 E2E verts; MFA, mot de passe facultatif, invitation par courriel et audit indépendant restent ouverts.
independent_signoff: PARTIAL_MFA_EMAIL_INVITE_ROLE_UI_SECURITY_AUDIT_REQUIRED
next_phase: P05
```

La carte détaillée et les gates sont dans `docs/specs/sections/phase-map.md`.

## Staging repair — 2026-11-09

```yaml
id: STAGING-REPAIR-20261109
title: Corriger les écarts de configuration hébergée et terminer les adaptateurs exécutables
status: IN_PROGRESS
goal: Isoler la recette du backend public et traiter les onze constats de l’inventaire Vercel/Supabase.
scope: configuration Preview dédiée, OTP, migrations additives staging, preflight, worker et YouSign sandbox
requirements: [MAT-FUNC-001, MAT-FUNC-015, MAT-FUNC-020, MAT-FUNC-023, hardening P19]
invariants:
  - aucune mutation de production ni promotion sans autorisation de production distincte
  - aucun secret dans Git, les journaux ou les preuves
  - une intégration sans credentials et recette réelle reste non certifiée
  - politiques de signature, four-eyes, RLS, scans et budgets de production conservés
ownership:
  - integration_manager: branche codex/staging-repair-20261109 et fichiers partagés
  - staging_preflight_implementation: scripts/staging
  - staging_runtime_implementation: apps/worker et recette de conteneurisation
  - yousign_runtime_implementation: signature-v41, consommateur/webhook et migration additive signature
dependencies: accès temporaires Vercel/Supabase; comptes tiers et décisions métier existantes
milestones: [préparer, corriger, tester, revue indépendante, intégrer, déployer Preview si accès disponibles]
decisions:
  - inventaire source daté du 2026-11-09; aucune supposition de validité des valeurs masquées
  - branch spécifique Preview sans copie de données de production
risks:
  - capacités du forfait Supabase et durée des accès temporaires
  - credentials email/PSP/scanner/YouSign et choix juridiques non déductibles des jetons de gestion
validation_commands: [pnpm test:tooling, pnpm typecheck, tests ciblés worker/signature/auth, pnpm build:vercel]
evidence_paths: [docs/evidence/staging-repair-20261109.json, /workspace/outputs/staging-repair]
progress_log:
  - 2026-11-09: GitHub synchronisé sur 4962ce7; worktrees indépendants; correction demandée par le propriétaire.
results: IN_PROGRESS
independent_signoff: PENDING
next_phase: Recette du staging avec services externes réellement configurés, puis gate de production séparé.
```
