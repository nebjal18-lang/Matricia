# Compatibilité des prérequis de qualification — 2 novembre 2026

Les 14 tests ci-dessous utilisaient encore une session SUBMITTED insérée directement, sans manifeste final, snapshot ou évaluation. Leurs prérequis suivent maintenant le même parcours natif que le test 0351 déjà validé : questionnaire TEST versionné et publié avec traductions approuvées, start/autosave/submit par le propriétaire prestataire, lecture auditée de la projection par le relecteur indépendant AAL2 puis décision gouvernée avec empreinte de contexte. Les tests 0339, 0342 et 0346 suivent aussi ce parcours pour leur second prestataire.

Aucun changement de produit, de migration, de RLS ou de prérequis de sécurité. Une comparaison mécanique a vérifié les empreintes des fichiers sources de la branche d'intégration, l'identité du contenu hors blocs de prérequis de qualification pour 13 fichiers et la conservation exacte de toutes les assertions métier. Dans 0356 seulement, le prérequis d'appel du litige fournit aussi une déclaration MESSAGE synthétique du Client, canonisée par le RPC au lieu de l'ancien tableau vide désormais refusé par 44100. Le test 0351 n'a pas été modifié. Les données restent synthétiques, dans des transactions de test annulées.

La répétition du prérequis commun reste dans les fichiers SQL autonomes : aucun mécanisme d'inclusion ni comportement du runner n'a été changé.

## Exécutions

Chaque fichier a été exécuté séparément avec le runner `tests/e2e/helpers/provider-isolated/transaction.mjs`, la cible locale TEST explicitement possédée, la base 458 et les 46 migrations de la branche d'intégration postérieures à 20261102037000. Les octets de ces migrations ont été copiés et figés sous work/fixture-compatibility/migrations avant le premier test ; leurs empreintes sont dans le reçu. Aucun COMMIT n'a été envoyé. Chaque empreinte de schéma avant/après est identique.

| Test | Assertions réussies | Résultat |
| --- | ---: | --- |
| 0342_client_quote_exact_transport_acceptance.test.sql | 30 | PASS / ROLLBACK |
| 0346_provider_quote_completion.test.sql | 41 | PASS / ROLLBACK |
| 0347_provider_monthly_closing.test.sql | 56 | PASS / ROLLBACK |
| 0348_provider_versioned_receipts_assignments.test.sql | 102 | PASS / ROLLBACK |
| 0352_provider_contract_message_continuity.test.sql | 68 | PASS / ROLLBACK |
| 0353_signed_amendment_before_initial_mission.test.sql | 18 | PASS / ROLLBACK |
| 0354_signed_scope_reconciliation_exceptions.test.sql | 129 | PASS / ROLLBACK |
| 0355_signed_scope_generations.test.sql | 170 | PASS / ROLLBACK |
| 0355b_signed_replacement_before_initial_mission.test.sql | 27 | PASS / ROLLBACK |
| 0355c_signed_withdrawal_before_initial_mission.test.sql | 18 | PASS / ROLLBACK |
| 0356_provider_dispute_economic_authority.test.sql | 85 | PASS / ROLLBACK |
| 0104_contract_mission_checklist_snapshot.test.sql | 29 | PASS / ROLLBACK |
| 0338_client_native_mission_dispute_acceptance.test.sql | 34 | PASS / ROLLBACK |
| 0339_client_native_quote_comparison_acceptance.test.sql | 18 | PASS / ROLLBACK |

**Total : 825 assertions réussies sur 14 fichiers**, sans SKIP/TODO. Le premier passage de 0356 a échoué après 58 assertions sur DISPUTE_EVIDENCE_REQUIRED : son appel natif transmettait un tableau de preuves vide, interdit par 44100. Après ajout de la vraie déclaration synthétique du Client (type MESSAGE, visibilité et organisation source ; empreinte calculée par le RPC), la reprise a réussi ses 85 assertions. Les deux transactions ont été annulées et leurs reçus sont conservés.

Reçu détaillé versionné : [qualification-fixture-compatibility-2026-11-02.json](../provider-completion/evidence/qualification-fixture-compatibility-2026-11-02.json). Les journaux SQL complets et reçus individuels restent sous work/fixture-compatibility/sql-*/.

Cette preuve porte sur un schéma de test existant avec transactions annulées. La reconstruction stricte depuis zéro et la recette navigateur sont suivies séparément par l'intégration. Aucun déploiement de production.
