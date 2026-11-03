# Calendrier du catalogue — demande et décision centrale

Route : `/{locale}/administration/catalogue/calendrier`, avec filtres `library` et `page` conservés dans la navigation et la reprise après connexion. La page utilise le cadre Admin existant, distingue session, rôle central, MFA, configuration et incident, puis charge exclusivement `get_catalog_release_window_context_v1`. Chaque page contient au plus 25 conflits et 25 demandes. Une panne ne devient jamais une collection vide.

L'administrateur sélectionne une ancienne publication par bibliothèque, clé et date. Les références, versions et empreintes proviennent de la projection autorisée ; aucune saisie d'UUID ou d'empreinte n'est demandée. La demande précise son motif, fige sa source et attend un autre administrateur central habilité. Les motifs libres ne sont pas traduits. L'interface est disponible en FR/AR et RTL.

Les capacités serveur `canRequest` et `canDecide` conditionnent les actions visibles. Une source modifiée bloque l'approbation mais permet le rejet indépendant. Chaque réponse est validée ; une panne conserve les saisies et la clé de rejeu du même contenu en mémoire. Le navigateur ne décide jamais qu'une source est approuvée en l'absence du reçu natif. Les anciennes publications et les services ne sont pas supprimés par ce panneau.

Le backend reste l'autorité des permissions `CATALOG_APPROVE`, de l'AAL2, de l'indépendance, des verrous, de la source attendue, de l'audit et de l'outbox. Le panneau appelle seulement les RPC natifs de demande et de décision. La taxonomie spécifique du nouveau garde backend distingue `CENTRAL_MFA_REQUIRED`, `CATALOG_AUTH_REQUIRED` et `CATALOG_SCOPE_DENIED` ; cette interprétation ne s'applique pas aux anciennes RPC qui peuvent réutiliser des messages ambigus.

Vérifications exécutées :

```sh
pnpm --filter @matricia/web exec vitest run modules/admin/screens/catalogue-calendar modules/admin/data/catalogue-calendar 'app/[locale]/administration/catalogue/calendrier/page.test.tsx' --maxWorkers=1
pnpm --filter @matricia/web exec eslint modules/admin/screens/catalogue-calendar modules/admin/data/catalogue-calendar 'app/[locale]/administration/catalogue/calendrier'
pnpm exec tsc -p work/catalogue-calendar/tsconfig.json
```

54 tests dans quatre fichiers, ESLint et graphe TypeScript isolé : réussis. La configuration de types isolée étend `apps/web/tsconfig.json`, désactive l'incrémental et les plugins, et inclut uniquement les trois répertoires ci-dessus avec leur graphe d'imports. Ce lot UI ne revendique ni exécution SQL ni preuve navigateur native ; ces recettes doivent utiliser la migration de contexte et de clôture approuvée par le lot Operations. Aucun déploiement ou donnée de production modifiés.

## Correction d'hydratation des dates

Le navigateur a reproduit une divergence de base de fuseaux entre Node et Chromium : le même instant à Casablanca était affiché à 22:57 puis 21:57. Les libellés sont désormais calculés une seule fois dans le rendu serveur, sérialisés et transmis au panneau. Le navigateur ne reformate aucune date ; les timestamps métier transmis aux commandes restent inchangés. Aucun avertissement d'hydratation n'est supprimé. Un contretest FR/AR simule ces deux bases de fuseaux différentes et vérifie un rendu identique avec les chaînes serveur. Vérification ciblée : 29 tests dans deux fichiers (panneau et route SSR), ESLint réussi ; aucune vérification globale revendiquée pour ce delta.
