# File Admin des prestataires — 2 novembre 2026

## Cause reproduite

La recette navigateur sur le candidat 8941517 a confirmé, avec le relecteur COMPLIANCE_MANAGER AAL2 extérieur à la société : SELECT organizations = 0, provider_profiles = 1, RPC get_admin_special_space_snapshot_v1(providers, fr) = rows vide avec complete=true et sans erreur. La vue de qualification chargeait pourtant le prestataire et ses services.

La projection SQL de file était SECURITY INVOKER et faisait une jointure interne avec organizations, dont la RLS n'autorise que les membres actifs. Le lecteur détaillé charge les profils sous leur propre RLS et utilise déjà le RPC borné list_admin_provider_organization_names_v1. Le statut de société vérifiée et les filtres de recherche n'expliquent donc pas le défaut. Un test DAL isolé (sans base) a reproduit le résultat vide de la première projection à côté d'un dashboard contenant un prestataire et deux services.

## Correction 38410

La seule branche providers du lecteur de files délègue à un lecteur SECURITY INVOKER. Celui-ci conserve la RLS sur les profils, services et documents, exige l'habilitation Admin existante et AAL2, puis demande au RPC existant uniquement les noms des organisations associées aux profils effectivement visibles.

Aucun droit SELECT sur organizations ni nouvelle policy ; aucune nouvelle fonction SECURITY DEFINER. Un échec ou une réponse incomplète du lecteur de noms produit une erreur, jamais une liste vide réussie. L'enveloppe, les champs, le tri et les limites de 20 000 résultats et 16 MiB sont préservés ; les autres branches de file restent inchangées. Recherche, filtres et compteurs continuent d'utiliser les vraies lignes retournées. Aucun changement DAL/UI.

## Vérifications exécutées

- 0358_admin_provider_independent_queue.test.sql : **19 assertions réussies**. Le profil est créé par la commande native submit_provider_profile ; le relecteur non membre voit ce prestataire et son vrai nom dans la file FR/AR, tout en gardant zéro ligne organizations en lecture directe. AAL1, Client, Provider, acteur étranger, identité absente, langue invalide, anonyme et worker sont refusés selon leur point d'entrée. Le lecteur reste SECURITY INVOKER.
- 0357_provider_qualification_reviewer_context.test.sql : **40 assertions réussies** avec 38410.
- Chaque test SQL utilise une transaction séparée sur la cible locale TEST, le schéma de base 458 et les 47 migrations additionnelles figées. Aucun COMMIT envoyé ; empreintes avant/après identiques. Les reçus et journaux sont conservés sous work/rollback0358-attempt1 et work/rollback0357-with38410.
- Vitest filters.test.ts et space-read-states.test.ts : **19 tests réussis** ; reproduction DAL isolée : **1 test réussi**.
- git diff --check et contrôle statique absence de grant SELECT / policy / SECURITY DEFINER dans 38410 : réussis.

[Reçu détaillé versionné](../provider-completion/evidence/admin-provider-queue-2026-11-02.json).

## Limites

La reconstruction stricte depuis zéro et la vérification navigateur après intégration sont suivies séparément. La base locale utilisée pour ces transactions a été libérée pour le nettoyage gardé de l'agent d'intégration. Aucun déploiement de production.
