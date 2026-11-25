# ARCH-01 — handoff routes et pages

Périmètre : API web et pages catalogue, confidentialité, invitations, messagerie, notifications, organisation, sécurité et contact public. Les quatre corrections existantes des lectures `mock.calls` ont été reprises depuis la copie principale sans réversion.

Les paramètres facultatifs absents sont omis aux frontières de contrat ; les composants locaux acceptent explicitement `undefined` lorsqu'il est transmis intentionnellement. Le formulaire de rôles protège la sélection d'une organisation absente. Le test webhook vérifie l'existence des deux appels avant de comparer leur ordre. Aucun contrat de module partagé n'a été modifié.

Vérifications exécutées avec les dépendances installées dans la copie principale, liées temporairement au worktree :

- Vitest ciblé : 9 fichiers, 168 tests réussis, incluant cas positifs et négatifs webhook, travailleurs, historique de notifications et formulaire de rôles vide ou renseigné.
- ESLint ciblé sur les pages et composants modifiés et le test webhook : succès.
- `tsc --noEmit --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noImplicitOverride --noFallthroughCasesInSwitch --pretty false -p apps/web/tsconfig.json` : échec global. Dans le périmètre attribué, sept diagnostics subsistent, tous sur le contrat partagé de classification `AuthError` : invitations (3), notifications (1), organisation (1), API franchise (1) et pièces jointes devis (1). La correction de ce contrat appartient au propriétaire partagé ; à revérifier après intégration. Les autres diagnostics initiaux du périmètre ne réapparaissent pas dans cette exécution.
- `git diff --check` : succès.

Limites : le build, les tests globaux, SQL/RLS, E2E et audits indépendants n'ont pas été exécutés ; ce handoff ne constitue pas une validation de phase ou de release. Relancer le typecheck strict et les gates après intégration des contrats partagés.
