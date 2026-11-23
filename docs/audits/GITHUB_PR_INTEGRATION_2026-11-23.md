# Vérification des PR et branches GitHub — 2026-11-23

Référence vérifiée : `6ef706d5bf8b2fb057a06c8bcab37fab6d58af78`, branche `codex/audit-final-2026-09-15`. Inventaire GitHub actualisé, puis `git fetch origin --prune`. Audit en lecture seule du produit ; aucune fusion, fermeture ou suppression effectuée.

## Décision

Les 20 PR retournées par GitHub sont fusionnées. Pour chacune, la tête de PR **et** son commit de fusion appartiennent à l'historique du code actuel (`git merge-base --is-ancestor`). Il n'y a donc aucune de ces PR à réappliquer. Leur intégration historique ne certifie pas que tous leurs comportements fonctionnent aujourd'hui : des évolutions ultérieures peuvent modifier leur contenu.

| PR | Objet | Vérification | Décision |
|---|---|---|---|
| [#1](https://github.com/nebjal18-lang/Matricia/pull/1) | Codex/audit m01 m30 20261102 | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#2](https://github.com/nebjal18-lang/Matricia/pull/2) | Codex/franchise finance completion 20261103 | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#3](https://github.com/nebjal18-lang/Matricia/pull/3) | Codex/bootstrap foundation | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#4](https://github.com/nebjal18-lang/Matricia/pull/4) | Administration : corriger les faits affichés et rétablir les validations CI | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#5](https://github.com/nebjal18-lang/Matricia/pull/5) | Administration — lot 2 : dossiers, filtres et suivi des actions | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#6](https://github.com/nebjal18-lang/Matricia/pull/6) | Administration — lot 3 : recette AAL2 native et reprise des pages d’approbations | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#7](https://github.com/nebjal18-lang/Matricia/pull/7) | Codex/admin corrections 20261103 | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#8](https://github.com/nebjal18-lang/Matricia/pull/8) | feat: deepen version 2 seams and gate production demo access | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#9](https://github.com/nebjal18-lang/Matricia/pull/9) | Vercel : préconfigurer le build Next.js depuis les trois racines | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#10](https://github.com/nebjal18-lang/Matricia/pull/10) | Version 2 | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#11](https://github.com/nebjal18-lang/Matricia/pull/11) | fix(web): align client typecheck with current mission and need contracts | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#12](https://github.com/nebjal18-lang/Matricia/pull/12) | Version 2 | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#13](https://github.com/nebjal18-lang/Matricia/pull/13) | fix(web): align demo auth and jalons fixtures with strict types | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#14](https://github.com/nebjal18-lang/Matricia/pull/14) | V1 : corriger les parcours, la CI et les preuves de recette | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#15](https://github.com/nebjal18-lang/Matricia/pull/15) | Version 2 | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#16](https://github.com/nebjal18-lang/Matricia/pull/16) | Corriger le staging isolé et intégrer YouSign sandbox avec preuves natives | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#17](https://github.com/nebjal18-lang/Matricia/pull/17) | Livrer la configuration Admin et la préparation autonome des signatures | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#18](https://github.com/nebjal18-lang/Matricia/pull/18) | Version 2 | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#19](https://github.com/nebjal18-lang/Matricia/pull/19) | fix(ui): localize Client, Provider and Franchise spaces after deep audit | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |
| [#20](https://github.com/nebjal18-lang/Matricia/pull/20) | Version 2 | Fusionnée ; tête et commit de fusion ancêtres de `6ef706d5` | Ne pas réappliquer |

## Anciennes branches

Toutes les têtes des branches distantes récupérées appartiennent à l'historique actuel, sauf `origin/codex/admin-lot3-20261103`, qui possède un seul commit supplémentaire : [bd6428f5](https://github.com/nebjal18-lang/Matricia/commit/bd6428f5a207686a44de78be33a5fc3206f87520).

Son diff modifie quatre fichiers : politique démo, tests, exemple d'environnement et état projet. Il autorise la démo lorsque `VERCEL_ENV=production`, avec activation explicite et `APP_ENV=development/staging`. Le code courant refuse au contraire tout accès démo lorsque APP_ENV ou VERCEL_ENV vaut production et exige un environnement non-production explicite ailleurs.

**Ne pas appliquer ce commit ancien** : il contredit la protection courante. Les modifications ultérieures sont présentes dans l'historique de [demo-policy.ts](../../apps/web/app/[locale]/connexion/demo-policy.ts), notamment `cd8a09e5` et `7f3bfc38`. Test ciblé actuel : **3/3 PASS**, une suite, Node 22.23.5, sans relance globale.

Les branches Admin lots 2/3, Client, Sous-traitant et publication Franchisé ne constituent donc pas des lots manquants. La présence d'une ancienne branche dans l'interface de comparaison ne nécessite aucune nouvelle fusion.

## Limites et reste à faire

- L'URL [Agents](https://github.com/nebjal18-lang/Matricia/agents?author=nebjal18-lang) renvoie une page 404 avec invitation à se connecter dans le navigateur disponible. Le connecteur GitHub fournit PR et métadonnées mais aucun outil de sessions Agents. Aucun contenu de tâche privée non publiée n'est certifié examiné.
- Vérification du dépôt et de son historique uniquement ; ni état des migrations hébergées, ni variables Vercel, ni déploiement de production vérifiés.
- Les fonctionnalités et preuves encore manquantes restent celles du [rapport E2E](./E2E_COVERAGE_2026-11-22.md). Une PR fusionnée ne signifie pas 100 % de couverture ou application finalisée.
