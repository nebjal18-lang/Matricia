# Clôture financière et parcours Franchisé — plan de réalisation

État : **CODE_DELIVERED_RECIPE_PARTIAL_FROZEN**. Périmètre figé à la demande de clôture rapide. PR12 fusionnée par l’utilisateur en `a362abc1` ; complément isolé depuis cette fusion dans `codex/franchise-publication-validation-20261103`. La dernière recette et ses limites font autorité dans `REPORT.md` et `evidence/browser/CLOSURE.json`. Source après les fusions utilisateur : `df67da4`, branche principale `codex/bootstrap-foundation`, contenant Client `7e01276` et Sous-traitant `8b38f9d`. Intégration dédiée : `codex/franchise-finance-completion-20261103`. Modifications antérieures conservées ; aucun déploiement ou merge.

| Chantier | Propriétaire | Vérification attendue |
|---|---|---|
| CI et invitations réseau | ci_failures | Cause des six échecs, gates locaux, invitation réelle et idempotente sans adhésion implicite |
| Clôture Sous-traitant et rapprochement économique | financial_closure | Facture historique TEST native, échéancier, paiement/revue/allocation ; coûts réconciliés et base distribuable prouvée |
| Éditorial Franchisé | franchise_editorial | Versionnage, archivage, duplication, conditions/simulation et publication gouvernée |
| Opérations et finance Franchisé | franchise_operations | Contexte exact, pagination complète, règles IT/standard, source financière et rejeux |
| Performance périodique | franchise_performance | Six axes sur données natives, complétude explicite, alertes et audits sans résiliation automatique |
| Contexte et navigation | root | Incidents Auth distincts de session invalide, retour au lien profond, erreurs précises et sélection explicite |
| Audit indépendant | franchise_independent_audit | Exigences V1, contre-tests et limites, sans modification du code audité |
| Recette navigateur | franchise_browser | Acteurs/mandats TEST natifs, FR/AR/RTL, quatre largeurs, contrôles négatifs et captures |

## Invariants

MFA/AAL2, RLS, séparation des organisations et mandats, validation indépendante, audit/outbox, argent exact et ledgers immuables. Aucune clé publiée, personne réelle contactée, donnée de production inventée, horloge modifiée ou protection désactivée pour obtenir un résultat vert. Fixtures exclusivement locales et explicitement TEST.

## Vérifications et clôture

Tests ciblés puis types/lint/build, suites Web/worker pertinentes, replay des migrations et tests SQL sur base neuve isolée, recette native et revue indépendante. Enregistrer les commandes, résultats, hashes et candidats exacts. Une phase n'est pas verte sans ces preuves. Les trois jobs GitHub sont bloqués avant démarrage par la facturation du compte, sur push et PR : aucun changement de workflow ne corrige ce verrouillage externe. La suite Franchisé initiale passe 195 tests mais ne couvrait pas les huit défauts nouvellement identifiés ; voir l'audit indépendant.
