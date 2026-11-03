# Preuves liées au candidat

## Séparation des niveaux

`pnpm release:structure` vérifie catalogue, registres et marqueurs de code. `pnpm release:validate` exige en plus : arbre de travail figé, 76 visas `VERIFIED`/`APPROVED`, manifeste du SHA courant en environnement staging, checks non vides sans skip/flaky/échec attendu, artefacts intègres et approbations indépendantes, juridique/comptable, client et exploitation. Un simple PASS SQL ou une référence de route ne vaut pas une recette navigateur.

## Collecte

1. Geler un commit candidat ; relever le SHA et les auteurs intervenus.
2. Exécuter `pnpm release:prepare`. Le manifeste ignoré créé dans `artifacts/test-results/release-manifest.json` contient uniquement `not_run`, `NOT_REVIEWED` et `not_approved`. Il ne remplace pas des résultats existants.
3. `pnpm release:checks lint typecheck unit integration database build` exécute réellement les commandes et produit des résumés SHA/dates/counts/exit. Pour `database`, utiliser exclusivement les bindings d’une cible test/staging vérifiée. Pour `build`, fournir l’URL HTTPS autorisée et les paramètres publics correspondants. Le collecteur ne conserve pas de sortie brute susceptible de contenir des credentials.
4. Exécuter les runners navigateur publics, authentifiés et workflows. Les résumés décrivent leurs vrais résultats ; chaque fixture doit être créée, vérifiée et nettoyée par le runner propriétaire. Le workflow GitHub manuel `Staging acceptance (protected)` utilise les secrets de l’environnement protégé `staging-acceptance` et le runner existant avec provisioning/cleanup. Aucun export brut de traces authentifiées n’est publié par ce workflow.
5. Mesurer accessibilité, performance, sécurité et fournisseurs ; joindre leurs rapports normalisés. Les checks de performance doivent être des mesures réelles ; les tests de configuration de l’outil ne sont pas une mesure de performance.
6. Copier dans chaque entrée de manifeste les métadonnées du résumé concerné et sa référence relative + SHA256. Ne jamais transformer manuellement un échec ou un zéro test en succès. Les rapports normalisés portent `schemaVersion:1`, `check` (nom exact du contrôle), `commit`, `status`, `exitCode`, `assertions`, `skipped`, `flaky`, `expectedFailures`, `startedAt`, `finishedAt` ; le gate vérifie leur concordance et leur contenu.
7. Chaque approbation référence un artefact signé/confirmé par son responsable et lié au SHA. Renseigner les auteurs du candidat ; les auditeurs qualité/sécurité ne sont pas auteurs du code audité. Le validateur contrôle présence, intégrité et cohérence ; l’authenticité de l’approbation est vérifiée dans le système de signature/revue retenu.
8. Renseigner tous les problèmes ouverts. Un P0/P1/P2 non fermé interdit le gate. Refaire les preuves après tout changement du candidat. Les résultats expirent après 72 heures pour éviter la réutilisation involontaire d’une ancienne recette.

`RELEASE_MANIFEST_PATH` permet une copie sécurisée hors chemin par défaut. Les chemins d’artefacts sont relatifs au checkout, sans sortie par `..` ou symlink. Aucun manifeste ne contient de valeur de secret ni de fichier de session/dump.

## Contrôles de mesure

Les Web Vitals synthétiques respectent les budgets du Gold Master : LCP 2,5 s, INP 200 ms et CLS 0,1. Le plan fournit une origine staging exactement vérifiée et une interaction réelle par route ; absence de métrique ou d’interaction = échec. Une interaction plus rapide que le seuil de l’observateur est reportée comme borne supérieure à 16 ms, pas comme INP terrain mesuré à zéro. Compléter par RUM et p95 API hors fournisseurs en exploitation.

## Couverture runtime des interactions

`node scripts/audit-interactions.mjs --check --inventory-json artifacts/test-results/interaction-inventory.json` produit les identifiants stables pour le candidat et le hash de chaque source. Ce fichier est un inventaire, pas une preuve de test. La validation structurelle porte explicitement `STATIC_INVENTORY_ONLY`.

Le gate strict exige `RELEASE_INTERACTION_PROOF_PATH`. Le document JSON de couverture contient `schemaVersion:1`, le SHA `commit` et `entries`. Chaque entrée reprend `id` et `sourceSha256` de l’inventaire, avec `status:"passed"`, `skipped:0`, `flaky:0`, un `reviewer` indépendant, `testSource` (chemin relatif de la spec), `scenario` (titre exact exécuté) et `artifact:{path,sha256}`. L’artefact doit être le rapport JSON Playwright non vide, sans ignoré/instable/échec attendu, qui contient réellement cette spec et ce scénario. Un changement de source ou de candidat invalide la couverture.

Une référence de route, une exclusion automatique ou un simple test parent ne ferme aucune interaction. Les preuves de code source/SQL restent utiles à leur niveau ; elles ne sont pas acceptées à la place d’un rapport navigateur dans ce document de couverture. Le reviewer vérifie que le scénario observe réellement l’effet métier et les états exigés, pas seulement le titre de la page.

Le gate exige trois preuves de performance distinctes : `performance` (Web Vitals), `performanceApi` (p95 API) et `performanceCatalog` (6 000 et 50 000 questions). Utiliser respectivement `test:performance`, `test:performance:api` et `test:performance:catalog`. Pour le catalogue, le runner de preuve refuse un environnement autre que staging et des tailles réduites. Les preuves de performance/sécurité/fournisseurs/restauration exigées en staging ne peuvent pas être remplacées par un résultat local ou un test de configuration.
