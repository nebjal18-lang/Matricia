# Audit Matricia 360 — plan et périmètre

- Début : 2026-11-19, America/Toronto.
- Commit audité : `b578c75c1c0f076c7fb46b0239d7ab5f2b0afc4c`.
- Branche : `codex/audit-final-2026-09-15` ; 3 commits locaux en avance au démarrage.
- Deux modifications staged préexistantes conservées : typage des candidatures démo et requêtes CRM franchise. Les revues indépendantes portent sur le commit ; le coordinateur vérifie aussi ces modifications.
- Mission : audit, pas correction ; aucun déploiement, push, changement de production ou migration distante.
- Écriture autorisée de l'auditeur : ce dossier de rapports, sondes et preuves uniquement. Les outils de tests/build peuvent créer leurs sorties ignorées habituelles.

## Répartition indépendante

1. Sécurité : authentification, permissions, multi-tenant, RLS/Storage/API et démo.
2. Finance : exactitude, immutabilité, transactions, concurrence et trois flux économiques distincts.
3. Architecture : modules/contrats, tests/gates, CI, exploitation et performance statique.
4. Produit : registre des 68 fonctions, parcours, valeur et stratégie.
5. Design : Version A, FR/AR/RTL, accessibilité et parcours guidés ; revue source.
6. Coordinateur : environnement, exécutions, navigateur, reproduction et consolidation des preuves.

Les agents sont lecteurs dans des worktrees isolés et retournent leurs résultats au coordinateur, seul propriétaire des rapports.

## Séquence

1. État initial, référentiel et inventaire.
2. Contrôles locaux : lint, types, tests unitaires/intégration/outillage, spécifications et gates release.
3. Faisabilité DB locale et navigateur ; uniquement cibles isolées et données synthétiques.
4. Reproduction ciblée des constats ; différencier statique, runtime, simulation et persistance.
5. Matrice 68 fonctions, limites explicites, gravités et verdicts démo/pilote/production.
6. Rapport final et plan de correction par causes racines, sans appliquer les corrections.

## Sémantique des verdicts

Conforme vérifié / non conforme confirmé / risque à confirmer / bloqué / non testé / non applicable. Une déclaration documentaire ou un mock n'est pas une preuve de bout en bout. Aucun score global ne remplace les gates critiques.
