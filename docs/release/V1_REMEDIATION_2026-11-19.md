# V1 — remédiation après audit 360

## ExecPlan

- ID : V1-REMEDIATION-20261119.
- Statut : IN_PROGRESS. Aucun visa de production.
- But : corriger les 36 constats de l'audit, rétablir une recette reproductible et préparer un candidat V1 déployable.
- Référence initiale : b578c75c, avec deux corrections staged préexistantes conservées. Audit immuable : [synthèse](../audits/2026-11-19-audit-360-b578c75c/EXECUTIVE_SUMMARY.md).
- Autorité : Gold Master V4 FINAL ; MAT-FUNC-001..068 ; Design Authority A ; refonte commerciale sans catalogue imposé.
- Invariants : pas de modification de production ; aucun secret publié ; RLS restrictive ; montants exacts ; historique immuable ; mutations sensibles transactionnelles, idempotentes, auditées avec Outbox ; FR/AR RTL.

## Propriété et intégration

| Domaine | Propriétaire | Périmètre réservé |
|---|---|---|
| Finance | finance | Nouvelle migration 20261119100000 ; tests 0410/0411 ; FIN-01..05 |
| Auth/document | sécurité | Connexion demo, config Auth locale ; migration 20261119101000 ; test 0412 |
| Parcours besoin/fournisseur | produit | Need flow/context/actions/intent ; taxonomy fournisseur ; migration 20261119102000 si nécessaire ; test 0413 |
| Design/format | design | CSS client/public, navigation publique, offre client, récompenses, display ; A11Y/RTL/date/argent |
| Preuves release | release | Runner SQL, helpers tests DB, run-checks/manifest et tests tooling |
| Intégration | principal | Build/lint/types, dépendances, collisions migrations, architecture, démo, registres et preuves intégrées |
| Contre-revue | indépendant | Lecture seule du candidat intégré ; constats renvoyés aux propriétaires |

Chaque implémenteur dispose d'un worktree ; aucun fichier partagé en écriture simultanée. Les deux WIP initiaux ne sont ni retirés ni remplacés. Les migrations historiques déjà appliquées ne sont pas réécrites sans analyse de leur historique.

## Jalons et validation

1. Corriger les causes, avec tests ciblés et commits par domaine.
2. Intégrer et réexécuter lint, types froids, unités, intégration, tooling et build sous Node22 vérifié.
3. Rejouer migrations et SQL/RLS/concurrence sur cible isolée explicitement identifiée.
4. Recette navigateur publique et authentifiée FR/AR, responsive, permissions, persistance et workflows.
5. Contre-revue indépendante, corrections complémentaires, retest ; actualiser traçabilité seulement à partir de preuves actuelles.
6. Documenter le candidat et les seules activations externes réellement restantes ; ne pas transformer une recette technique en approbation juridique, comptable ou de production.

## Journal

- 2026-11-19 : corrections autorisées par Jalil ; audit conservé ; cinq domaines délégués en worktrees indépendants. Production exclue de cette exécution.

## Résultats

Travaux en cours. Aucun constat n'est déclaré clos avant preuve et revue.

### Point d'intégration du 19 novembre

- Intégrés en modifications locales, sans modifier les deux WIP staged initiaux : Finance `4922cd06`, sécurité `8d8dbc23`, design `d490d036`, contrats partagés partiels `cb36e5f7`, routes strictes `3d73abfe`, premières fixtures SQL `95387e34`, architecture `aa2cbfce`. Les commits des worktrees ne valent pas encore visa du candidat intégré.
- Next.js corrigé vers 16.4.5 ; audit des dépendances sans vulnérabilité rapportée. Identités des migrations : 609 uniques après les deux migrations additives intégrées.
- Première suite Web intégrée sous Node 22 : 4 222 succès, 5 échecs, 1 ignoré. Les quatre échecs de contexte Router et l'écart de date Casablanca sont renvoyés aux propriétaires. Résultat non vert.
- Typage strict : 650 diagnostics après première intégration, contre 789 initialement ; corrections supplémentaires par domaine en cours. Aucun assouplissement des options strictes.
- Lectures franchise bornées à 5 000 lignes et 120 requêtes partagées entre lots, avec refus explicite sans données partielles ; 19 tests ciblés réussis. Les écrans à grands historiques nécessitent encore une pagination métier, pas une prétendue liste complète tronquée.
- Rejeu intégral depuis un conteneur local vierge en cours ; les preuves Finance sur clone ne le remplacent pas. Le précédent rejeu interrompu sans résumé final ne constitue pas une preuve complète.
- Revues indépendantes Finance, sécurité, design et architecture en cours. Aucun déploiement ni certification production.

Les preuves sont conservées dans [le dossier de remédiation](../evidence/remediation-20261119/). Les prochaines exécutions du helper d'intégration enregistrent l'identité des sources avant/après et échouent si elle change pendant le contrôle.
