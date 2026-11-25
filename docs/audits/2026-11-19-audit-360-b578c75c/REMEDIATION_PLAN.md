# Plan de correction proposé — aucune correction appliquée

Les rôles ci-dessous sont des propriétaires techniques proposés, pas des affectations nominatives ni des demandes envoyées à des tiers. Les estimations restent relatives : aucune durée précise n'est inventée.

| Lot | Propriétaire proposé | Constats | Résultat et critère d'acceptation |
|---|---|---|---|
| 0 — Reproductibilité et cible sûre | Plateforme/QA | REL-01, REL-03, REL-04, REL-05 | Identité DB vérifiée avant mutation, versions SQL uniques, Node22 vérifié, build/tsc froid/lint/tests verts depuis checkout propre |
| 1 — Intégrité Core native | Finance backend + reviewer indépendant | FIN-01 à FIN-05 | Source/journal rapprochés, clôture commit-safe sous authenticated, périodes exclusives, remboursement rapproché, rejeux stables |
| 2 — Autorisations et démo | Sécurité/Auth + reviewer indépendant | SEC-01, SEC-02, SEC-03 | Matrice documentaire cohérente ; refus démo sans effet Auth/MFA ; confirmation courriel vérifiée dans les environnements pertinents |
| 3 — Continuité commerciale | Produit + Client/Provider | PROD-01 à PROD-04, DEMO-01, UX-01, UX-02 | Même besoin/organisation/réponses de l'entrée à la demande ; service publié découvrable ; démo persistée et cliquable |
| 4 — Design/RTL/a11y | Design system/Frontend | A11Y-01 à A11Y-04, I18N-01, I18N-02, UX-03 | Contrastes/focus/styles calculés conformes, menu multiespace clavier, labels FR/AR corrects, aucun débordement aux cinq largeurs |
| 5 — Contrats et volumétrie | Architecture/Domaines | ARCH-01 à ARCH-04, FIN-06, DATE-01 | Options TS effectives, frontières contrôlées, erreurs discriminées, pages bornées, argent exact et fuseau réel |
| 6 — Preuves de release | QA/Release indépendant | REL-02, REL-06, REL-07, DEP-01 | Aucun filtre accepté comme suite complète ; visas cohérents, couverture mesurée, dépendances revues et intégrations prouvées |

## Dépendances et ordre

- Ne pas rendre le trigger Core simplement permissif : FIN-01/FIN-03/FIN-04 doivent être traités dans le même lot pour ne pas libérer des écritures économiquement incohérentes.
- Une migration corrective doit tenir compte des environnements déjà appliqués ; ne pas modifier une migration historique au hasard.
- Corriger les fixtures/attentes de tests à partir du contrat métier arrêté, jamais en supprimant les contrôles de sécurité ni en ajoutant des skips.
- Les améliorations de style ne doivent pas précéder les blocages de construction, d'autorisation ou d'argent.
- Chaque lot modifiant le produit exige nouveau candidat et retest indépendant ; l'auteur d'une correction ne signe pas seul sa clôture.

## Gates d'acceptation du prochain candidat

1. Installation, replay migrations et seed déterministes sur environnement jetable ; historique non ambigu.
2. Lint, types sans cache, tests, build et gates de structure verts dans l'environnement supporté.
3. Matrices ALLOW/DENY, tenant/scope, session/MFA/révocation ; documents et Storage réels avec fixtures privées.
4. Propriétés financières : conservation, source canonique, contre-écriture, absence de double droit, idempotence après commit et concurrence.
5. Les 26 scénarios E2E du Gold Master et les 68 exigences reliés à preuves actuelles ; les modes simulation/native/externe clairement distingués.
6. Responsive FR/AR, clavier, contrôles manuels d'accessibilité et performances staging représentatives.
7. Restauration DB+Storage+jobs, rollback, intégrations externes et acceptations professionnelles nécessaires.
8. Aucun finding Critical/High ouvert ; Medium sensibles corrigés ou acceptés formellement avec propriétaire et mitigation.

Le périmètre reste V1. Aucune correction, modification de production, mise à jour de dépendances, migration distante ou publication n'est autorisée par le seul présent rapport.
