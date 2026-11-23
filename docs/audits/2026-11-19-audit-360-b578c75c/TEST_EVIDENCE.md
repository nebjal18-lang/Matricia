# Registre des exécutions

Généré 2026-11-19T13:52:10.385Z. Commandes exactes, horodatage UTC, durée et code de sortie : fichiers JSON voisins de chaque log.

## Contrôles de dépôt

| Contrôle | Interpréteur du runner | Exit | Durée | Log |
|---|---|---:|---:|---|
| runtime | v22.23.5 | 0 | 0.99 s | [evidence/runtime.log](./evidence/runtime.log) |
| lint | v24.11.0 | 1 | 80.48 s | [evidence/lint.log](./evidence/lint.log) |
| typecheck | v24.11.0 | 0 | 20.63 s | [evidence/typecheck.log](./evidence/typecheck.log) |
| unit | v22.23.5 | 1 | 41.22 s | [evidence/unit.log](./evidence/unit.log) |
| unit-failures | v22.23.5 | 1 | 10.02 s | [evidence/unit-failures.log](./evidence/unit-failures.log) |
| typecheck-clean | v22.23.5 | 1 | 88.92 s | [evidence/typecheck-clean.log](./evidence/typecheck-clean.log) |
| integration | v24.11.0 | 0 | 0.65 s | [evidence/integration.log](./evidence/integration.log) |
| tooling | v24.11.0 | 1 | 1.65 s | [evidence/tooling.log](./evidence/tooling.log) |
| phase00 | v24.11.0 | 0 | 5.13 s | [evidence/phase00.log](./evidence/phase00.log) |
| placeholders | v24.11.0 | 0 | 1.85 s | [evidence/placeholders.log](./evidence/placeholders.log) |
| release | v24.11.0 | 0 | 2.20 s | [evidence/release.log](./evidence/release.log) |
| build | v24.11.0 | 1 | 5.74 s | [evidence/build.log](./evidence/build.log) |
| dependencies | v24.11.0 | 1 | 1.08 s | [evidence/dependencies.log](./evidence/dependencies.log) |

### Note de méthode Node Windows

La machine utilise Node24. Une distribution Node22 a été utilisée sans modifier l'installation globale. Les premières tentatives avec parent Node22 passaient encore par un shim Corepack lié à Node24 ; elles sont conservées comme tentatives préliminaires. Le runner corrigé invoque le CLI Corepack avec son interpréteur explicite ; [evidence/runtime.log](./evidence/runtime.log) confirme v22.23.5. La suite unitaire complète et le typecheck propre ont été réexécutés après cette correction. Les scripts SQL, sondes et build-local invoquent directement process.execPath sous Node22.

### Résultats qui ne doivent pas être confondus

- Lint : 6 erreurs, 15 warnings, exit 1.
- Typecheck incrémental : exit 0 ; tsc sans incrémental : TS2589, exit 1. Le second et le build priment pour juger la reproductibilité à froid.
- Web : 4 186 succès, 6 échecs, 1 test ignoré dans 689 fichiers. Worker : 183 succès dans 17 fichiers. La suite workspace globale est rouge. Les autres packages exécutés sont détaillés dans le log ; certains acceptent une absence de tests.
- Intégration : 3/3 HTTP Outbox, pas une recette complète de tous domaines.
- Tooling : 100/103 ; deux créations de symlink refusées sous Windows et une regex de chemin non portable.
- Phase00, anti-marqueurs et structure release : PASS de leur portée structurelle ; aucune autorisation de livraison.
- Build brut : variables publiques absentes. Build avec paramètres locaux en mémoire : compilation puis TS2589. [evidence/build-local.log](./evidence/build-local.log).

## SQL : exécution large puis diagnostic

Le runner officiel s'arrête au fichier 0060. La sonde d'audit continue ensuite sur **tous les 383 fichiers**, avec le même prepareSqlTestBatches, une connexion par état de test, rollback/reset entre fichiers, plan unique, décompte et numérotation contrôlés, aucun skip accepté. Elle ne réécrit aucun test.

Résultat initial : **364 PASS, 10 FAIL, 9 ERROR**. 9280 lignes d'assertion ont été inspectées pour les fichiers ayant terminé ; les assertions partielles des fichiers en erreur ne sont pas incluses dans ce total. Ce nombre n'est pas un compte d'assertions toutes réussies.

Après restauration du hook propre à la base et application au clone des trois migrations existantes manquantes : recontrôle des 19 fichiers non verts, **2 PASS, 8 FAIL, 9 ERROR**. Ce sous-ensemble ne remplace pas une nouvelle campagne complète et ne transforme pas l'historique de migrations en replay valide.

| Fichier | Initial | Recontrôle ciblé | Cause/symptôme initial |
|---|---|---|---|
| [0060_p14_morocco_tax_engine.test.sql](../../../supabase/tests/0060_p14_morocco_tax_engine.test.sql) | FAIL | FAIL | not ok 31 - tax administration binds the caller identity, fails closed on AAL2 and checks privileged roles |
| [0091_assistance_purge_execution_hardening.test.sql](../../../supabase/tests/0091_assistance_purge_execution_hardening.test.sql) | ERROR | ERROR | relation "cron.job" does not exist |
| [0193_franchise_provider_bridge_delivery.test.sql](../../../supabase/tests/0193_franchise_provider_bridge_delivery.test.sql) | FAIL | FAIL | Plan 17, assertions 18 |
| [0198_franchise_network_contract_calendar.test.sql](../../../supabase/tests/0198_franchise_network_contract_calendar.test.sql) | FAIL | FAIL | not ok 6 - only provider with signed contract and current approved qualification is active ; not ok 8 - calendar uses latest immutable company decision |
| [0234_live_session_authorization.test.sql](../../../supabase/tests/0234_live_session_authorization.test.sql) | FAIL | PASS | not ok 17 - request hook configuration is bound to this database, not other projects in the cluster |
| [0242_central_fiscal_governance.test.sql](../../../supabase/tests/0242_central_fiscal_governance.test.sql) | FAIL | FAIL | not ok 3 - administration role alone cannot read central fiscal governance |
| [0347_provider_monthly_closing.test.sql](../../../supabase/tests/0347_provider_monthly_closing.test.sql) | ERROR | ERROR | REVERSAL_NOT_INVOICED |
| [0356_provider_dispute_economic_authority.test.sql](../../../supabase/tests/0356_provider_dispute_economic_authority.test.sql) | ERROR | ERROR | REVERSAL_NOT_INVOICED |
| [0359_provider_finance_civil_date.test.sql](../../../supabase/tests/0359_provider_finance_civil_date.test.sql) | FAIL | FAIL | not ok 20 - Finance approval still requires an authorized AAL2 reviewer |
| [0360_admin_territoires_queue_cells.test.sql](../../../supabase/tests/0360_admin_territoires_queue_cells.test.sql) | FAIL | FAIL | not ok 5 - Bibliothèque uses the library version name |
| [0360_provider_finance_close_to_payment.test.sql](../../../supabase/tests/0360_provider_finance_close_to_payment.test.sql) | ERROR | ERROR | PROVIDER_PAYMENT_PLAN_DENIED |
| [0367_franchise_application_dossiers.test.sql](../../../supabase/tests/0367_franchise_application_dossiers.test.sql) | ERROR | ERROR | FRANCHISE_APPLICATION_DENIED |
| [0368_franchise_role_capabilities_volume_scope.test.sql](../../../supabase/tests/0368_franchise_role_capabilities_volume_scope.test.sql) | FAIL | FAIL | not ok 9 - old A document is not revived as current when the latest family version targets B only |
| [0380_onboarding_chain_completion.test.sql](../../../supabase/tests/0380_onboarding_chain_completion.test.sql) | ERROR | ERROR | FRANCHISE_APPLICATION_DENIED |
| [0388_admin_actor_directory_profile_details.test.sql](../../../supabase/tests/0388_admin_actor_directory_profile_details.test.sql) | ERROR | ERROR | function is(text, unknown, unknown) does not exist |
| [0390_org002_user_fiche_excellence.test.sql](../../../supabase/tests/0390_org002_user_fiche_excellence.test.sql) | FAIL | FAIL | not ok 2 - persona repair promotes Hatim/IT identity and franchise scopes |
| [0405_reset_demo_workspace_v1.test.sql](../../../supabase/tests/0405_reset_demo_workspace_v1.test.sql) | FAIL | PASS | not ok 1 - reset_demo_workspace_v1 exists ; not ok 2 - demo workspace org registry exists ; not ok 3 - reset denied in PRODUCTION |
| [0408_compliance_entitlement_guards.test.sql](../../../supabase/tests/0408_compliance_entitlement_guards.test.sql) | ERROR | ERROR | function ok(text, unknown) does not exist |
| [0409_qualification_company_gate.test.sql](../../../supabase/tests/0409_qualification_company_gate.test.sql) | ERROR | ERROR | function ok(text, unknown) does not exist |

### Qualification des rouges SQL

- 0234 devient vert après restauration du réglage propre à la base : limite du clone initial, pas défaut attribué à l'application.
- 0405 devient vert après application de la migration existante manquante : dérive du snapshot.
- 0091 dépend de cron.job, explicitement absent de la copie : contrôle scheduler non validé.
- 0193 : plan annoncé 17, 18 assertions ; contrat de preuve invalide.
- 0408/0409 : has_function/has_table renvoient une ligne TAP textuelle passée à ok, d'où ok(text,unknown). Défaut de test, pas preuve d'une faille d'entitlement.
- Les assertions de rôles fiscaux/finance doivent être réconciliées avec la migration récente ajoutant MATRICIA_ADMIN+AAL2 : ne pas annuler une policy uniquement pour satisfaire une ancienne chaîne attendue.
- REVERSAL_NOT_INVOICED, PAYMENT_PLAN_DENIED, FRANCHISE_APPLICATION_DENIED et les autres assertions métier restent à trier avec fixtures/contrats actuels. Leur échec empêche l'acceptation, mais sa cause ne devient pas automatiquement une vulnérabilité.

Preuves complètes : [evidence/sql-all-files.json](./evidence/sql-all-files.json), [evidence/sql-rechecked-files.json](./evidence/sql-rechecked-files.json), [evidence/clone-reconciliation.json](./evidence/clone-reconciliation.json).

### Concurrence

Le runner officiel a aussi été lancé avec un filtre explicitement partiel : 4 fichiers/43 assertions, puis **4 scénarios à deux connexions PASS** (outbox, journal, crédit, chaîne d'audit). [evidence/db-filtered-concurrency.log](./evidence/db-filtered-concurrency.log). Ce résultat n'est jamais qualifié de suite SQL complète.

## Sondes contradictoires

- [evidence/core-pot-post-probe.json](./evidence/core-pot-post-probe.json) : journal dépense 100/revenu 0 → Core 10 000, contraintes validées sous authenticated.
- [evidence/core-pot-probe.json](./evidence/core-pot-probe.json) : clôture bloquée 42501 au trigger différé.
- [evidence/core-pot-owner-constraints-diagnostic-probe.json](./evidence/core-pot-owner-constraints-diagnostic-probe.json) : sous validation propriétaire uniquement, droits 20 000 depuis source 10 000, et rejeu rejeté. Ne prouve pas un commit natif.
- [evidence/document-authorization-probe.json](./evidence/document-authorization-probe.json) : Owner ALLOW, Viewer divergence coffre/RPC, autre tenant DENY ; aucune lecture de binaire.
- [evidence/source-probes.json](./evidence/source-probes.json) : vrai formatter bigint, vraie heure civile, vrai collecteur de pages et options TypeScript effectives.

Toutes les sondes métier sont rollback-only ; le nombre d'organisations du clone revient à zéro. Elles ne prouvent pas une signature légale, un paiement bancaire ou une session OTP native.

## Navigateur

140 contrôles page×largeur ; 56 scans axe, 0 violation rapportée dans ces états publics. Douze redirections anonymes attendues vers connexion. [evidence/browser-fr-first-scan.json](./evidence/browser-fr-first-scan.json), [evidence/browser-audit.json](./evidence/browser-audit.json), [evidence/targeted-browser.json](./evidence/targeted-browser.json).

Recette publique existante : 2 PASS français et 2 FAIL arabes à cause d'un ancien libellé attendu. La sonde séparée ne modifie pas ce test ; elle valide la vraie traduction arabe, les réponses, la progression, le rechargement et zéro requête mutante, desktop et 360 : **2 PASS**. [evidence/e2e-integrity-report.json](./evidence/e2e-integrity-report.json), [evidence/continuation-report.json](./evidence/continuation-report.json).

Le premier démarrage isolé a été interrompu par le rappel de sécurité Next ; les essais connexion-refusée sont conservés comme tentatives d'environnement, pas comme bugs produit. Le premier scan FR a ensuite terminé ses pages mais sa sonde clavier s'est interrompue sur un locator dont le nom changeait ; une sonde ciblée stable a confirmé le clavier FR/AR.

## Confidentialité et intégrité

Les rapports ne contiennent pas les valeurs des clés de configuration. Les ressources de traces contenant des clés locales sont assainies ; voir evidence/sanitization.json. Les hashes finaux sont dans evidence-manifest.json ; ce manifeste d'audit n'est pas le manifeste de release du produit.
