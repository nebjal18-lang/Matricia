# Handoff REL-01 / REL-02 / REL-06 — 2026-11-19

Implémentation terminée dans le périmètre attribué ; validation indépendante et recette SQL réelle restent à effectuer par root sur clone réservé. Aucun déploiement, accès DB distant, reset partagé ou visa réel effectué.

## Corrections

- **REL-01** : [runner](../../../../scripts/run-db-tests.mjs) et [contrôles](../../../../scripts/db-test-support-safety.mjs) refusent les cibles implicites/arbitraires avant chargement du client PostgreSQL. Suppression de la lecture automatique des fichiers d'environnement et du fallback hébergé/pooler/API Supabase. Seul un clone local explicitement réservé est accepté. Une lecture d'identité DB précède tout nettoyage, mutation ou désactivation de trigger. Les notices PostgreSQL sont supprimées ; les erreurs du runner sont génériques, sans URL, SQL ni diagnostic brut.
- **REL-02** : les runs filtrés sont `PARTIAL`, même si le filtre couvre tous les fichiers. Le [contrôle release](../../../../scripts/release/run-checks.mjs) refuse un filtre avant lancement. La preuve structurée est liée au commit, à un identifiant d'exécution unique, à la liste ordonnée exhaustive des suites et à une empreinte des noms/contenus SQL. Le contrôle compare l'inventaire avant/après et exige quatre scénarios de concurrence. Le [validateur](../../../../scripts/release/manifest.mjs) revalide la preuve SQL imbriquée contre le checkout. Un résumé texte positif seul ne suffit plus.
- **REL-06** : chaque artefact de visa est du JSON strict à sept champs : `schemaVersion: 1`, `approval`, `commit`, `status: approved`, `approvedBy`, `approvedAt`, `reference`. Catégorie, candidat, signataire, date et référence doivent correspondre au manifeste. Les revues indépendantes refusent un auteur, y compris avec variantes de casse/espaces/normalisation Unicode. Les visas expirés sont refusés. Les fixtures positives sont entièrement synthétiques.
- Windows : la fixture de confinement du manifeste utilise une jonction de répertoire sous Windows, conservant le test de sortie du checkout. Le test de marqueurs normalise les séparateurs de chemin.

## Contrat du clone réservé

Le provisionneur doit créer une base propre exclusivement dédiée à cette recette. Le runner ne la crée pas et ne marque jamais lui-même une base comme sûre.

- `APP_ENV=development`
- `DB_TEST_TARGET_MODE=reserved-local-clone`
- `DB_TEST_CLONE_ID` : identifiant aléatoire de 32 caractères hexadécimaux minuscules, propre au clone.
- `DIRECT_URL` : fournie par le canal de secrets habituel, jamais journalisée. Protocole PostgreSQL, hôte littéral `127.0.0.1` ou `[::1]`, port explicite, base nommée `matricia_test_` suivie de cet identifiant ; aucun paramètre d'URL ni fragment.
- `SUPABASE_DB_POOLER_URL` doit être absent.
- Au niveau de la base réservée, le provisionneur doit définir `matricia.test_clone_id` au même identifiant et `matricia.test_environment` à `reserved-local-clone`. Le runner vérifie ces paramètres avec `current_setting(..., true)` et vérifie `current_database()` avant mutation.
- Pour la release, `DB_TEST_PATTERN` doit être absent ; le lanceur gère `DB_TEST_RUN_ID` et `DB_TEST_EVIDENCE_PATH`.

Ce contrat bloque les anciennes exécutions hébergées/staging par conception. Aucun chemin hébergé alternatif n'est autorisé. Le provisionneur reste responsable de ne pas exposer une base distante/production derrière un tunnel local et de l'authenticité des paramètres de clone. Ces marqueurs protègent les erreurs de cible ; ils ne constituent pas une attestation cryptographique contre un administrateur malveillant.

## Preuves exécutées

Windows, Node v24.11.0, sans installation ni jonction de dépendances :

```text
node --test scripts/db-test-support.test.mjs scripts/release/db-test-safety.test.mjs scripts/release/manifest.test.mjs scripts/release/no-placeholders.test.mjs
20 tests, 20 pass, 0 fail, 0 skipped, 0 todo

node --check scripts/run-db-tests.mjs
node --check scripts/release/run-checks.mjs
git diff --check
```

Les contrôles de syntaxe et de diff réussissent. Le diagnostic éditeur des scripts principaux ne signale pas d'erreur. La nouvelle suite est découverte par le glob existant `scripts/release/*.test.mjs` du gate tooling ; aucun changement du registre ou des commandes package n'est requis.

La suite couvre : env trompeur, pooler, domaine distant, alias DNS, URL malformée/paramétrée, base ou clone incohérents, identité DB absente/incorrecte, refus du vrai runner avant import PostgreSQL sans fuite d'identifiants synthétiques, filtre refusé par le vrai lanceur release, inventaire incomplet/réordonné/modifié, ancien candidat/exécution, absence de concurrence complète, JSON arbitraire avec bon hash, mauvais candidat/décision/signataire/catégorie et auto-revue.

## Limites et actions root

1. Aucun clone propre réservé fourni/provisionné : aucune suite SQL réelle ni scénario de concurrence DB exécuté ici. Les contrôles d'identité utilisent un double du lecteur SQL ; leur comportement sur PostgreSQL doit être retesté sur le clone réservé. Ne pas présenter ces tests tooling comme preuve SQL complète.
2. La suite [Vercel](../../../../scripts/release/vercel-web-output.test.mjs) a été exécutée : 5 tests passent, 1 échoue avec `EPERM` sous Windows, dans [le helper de sortie](../../../../scripts/prepare-vercel-web-output.mjs). Ce helper est hors ownership explicite : root doit employer une jonction absolue pour les répertoires sous Windows, conserver les symlinks relatifs sur POSIX, puis relancer les six tests. Aucune assertion retirée ou ignorée. Les instructions du Next installé ont été lues ; aucune modification Next effectuée.
3. Les artefacts de visa prouvent cohérence/intégrité, pas l'identité cryptographique du signataire. Les références de signature et la liste des auteurs doivent être contrôlées par les auditeurs indépendants. Aucun visa n'est généré par cette correction.
4. Aucun audit indépendant, build applicatif ni gate V1 global déclaré vert. Root doit intégrer, refaire la recette complète et recueillir les visas indépendants. Les fichiers de plan/état, package, lockfiles, tsconfig, workflows, registre, migrations et audit source sont inchangés.

Le commit contenant ce document constitue le livrable ; son identifiant est retourné dans le message de fin.

## Complément après revue root — provisionnement réellement exécutable

Ce complément remplace la limite de provisionnement manuel ci-dessus. Le premier commit reste `1b79474f3aec49ec853fa2b79e74a6aa67e612f8`.

### Commande CI proposée à root

Après les étapes existantes d'installation, `supabase start` et `supabase db reset` **dans le job CI isolé uniquement**, remplacer l'étape `pnpm test:db` par :

```yaml
- run: node scripts/run-isolated-db-tests.mjs
  env:
    DB_TEST_SOURCE_KIND: clean-local-supabase
    DB_TEST_SOURCE_PROJECT: Matricia
    DB_TEST_RELEASE: '1'
```

Le projet doit correspondre exactement à `project_id` de la configuration Supabase et au label Docker `com.supabase.cli.project`. Aucune URL ni clé n'est nécessaire pour lire cette source locale : les outils PostgreSQL tournent à l'intérieur du conteneur source via Docker. Root conserve l'ownership du workflow/configuration ; aucun de ces fichiers n'a été modifié ici. `DB_TEST_RELEASE=1` produit le résumé d'acceptation database en plus de la recette ; sans cette option, le runner SQL est exécuté directement. Les filtres restent interdits en mode release.

Sous PowerShell, depuis le dépôt et après préparation volontaire d'une source locale propre à données fictives :

```powershell
$env:DB_TEST_SOURCE_KIND = 'clean-local-supabase'
$env:DB_TEST_SOURCE_PROJECT = 'Matricia'
$env:DB_TEST_RELEASE = '1'
node scripts/run-isolated-db-tests.mjs
```

Prérequis Linux/Windows : Docker local disponible, image PostgreSQL du Supabase local déjà installée, dépendances du dépôt installées, Corepack installé pour le mode release. Le script ne démarre ni ne réinitialise le Supabase source. `DOCKER_HOST` et `DOCKER_CONTEXT` doivent être absents ; le contexte actif doit utiliser un socket Unix ou un pipe Windows, jamais une adresse réseau.

### Cycle et garanties

Le [provisionneur](../../../../scripts/run-isolated-db-tests.mjs) valide le nom, le label et l'identifiant de la source. Il lit uniquement `pg_dumpall --roles-only --no-role-passwords` et `pg_dump --format=custom` sur cette source ; il ne termine aucune connexion source. Il crée un conteneur distinct à partir de l'identifiant immuable de la même image, initialise son propre cluster et restaure rôles, ACL, extensions et données dans `matricia_test_<32hex>`. Les paramètres d'identité sont posés dans cette base uniquement. Le mot de passe est généré aléatoirement et transmis par entrée standard/environnement, jamais dans les arguments CLI ni les logs. Les dumps et diagnostics restent en mémoire (plafond de 512 Mio par commande).

Le port publié est choisi par Docker et lié exclusivement à `127.0.0.1`, sans résolution de `localhost`. La sortie inspectée doit confirmer ce binding avant le runner. Les tâches cron copiées sont désactivées ; `pg_net.database_name` reste sur la base bootstrap `postgres`, distincte du clone restauré. Le script requiert une source propre à données fictives ; ce n'est pas une commande de copie de production.

Après succès, erreur de restauration, échec de tests ou signal interceptable, le nettoyage relit l'identité exacte du conteneur et son label. Il ne supprime jamais par nom seul ni par recherche globale. Après `docker rm`, l'absence de l'identifiant est vérifiée. Une incohérence d'identité ou un nettoyage incomplet fait échouer la commande. Chaque commande est bornée à 10 minutes ; le runner à 40 minutes. Un arrêt forcé non interceptable ou une panne du daemon peut laisser une ressource étiquetée : root doit alors vérifier son identifiant et son label avant nettoyage manuel.

### Corepack et Vitest

[check-support.mjs](../../../../scripts/release/check-support.mjs) trouve le fichier JavaScript de Corepack puis l'exécute par `process.execPath`, sans shell ni shim `.cmd`. Les installations non standard peuvent fournir `COREPACK_CLI_PATH`, chemin du fichier JS. L'installation Windows réelle a été sondée : Corepack `0.34.0`, exit 0.

Le parseur ne compte que les lignes `Tests`, pas les lignes `Test Files`. Il supporte les préfixes workspace, les couleurs, l'ordre `5 failed | 10 passed`, les suites multiples et vérifie les totaux. Un échec dans le résumé refuse le check même si le processus retourne 0. Les `skipped` ne sont plus doublés entre fichiers et tests. Des tests lancent réellement le contrôleur release avec un faux Corepack JS pour vérifier les trois verdicts : échec, skips et réussite.

### Preuves supplémentaires

```text
node --test scripts/release/check-support.test.mjs scripts/release/isolated-db.test.mjs scripts/release/db-test-safety.test.mjs scripts/release/manifest.test.mjs scripts/release/no-placeholders.test.mjs scripts/db-test-support.test.mjs
27 tests, 27 pass, 0 fail, 0 skipped, 0 todo
```

La [sonde Docker explicite](../../../../scripts/release/isolated-db.live.mjs), lancée avec `DB_TEST_IMAGE` égal à l'identifiant d'une image Supabase locale déjà installée, a créé sa propre source synthétique. Elle a vérifié réellement : restauration de pg_cron/pg_net/pgTAP, attribut BYPASSRLS du rôle de test, données, authentification TCP avec le mot de passe généré, nom/paramètres DB, rollback, suppression et absence du clone après réussite **et** après échec injecté du runner. La source synthétique a aussi été supprimée et son absence vérifiée. Résultat final : `LIVE_CLONE_PASS`, exit 0.

Aucune donnée du Supabase partagé n'a été lue ou modifiée pour cette preuve : seul son identifiant d'image Docker a été lu ; tous les accès SQL se limitaient aux conteneurs synthétiques créés pour la sonde. Une jonction locale de dépendances vers le main a été utilisée sans modifier ce dernier.

Limites : les recettes complètes Matricia et la CI Linux restent à exécuter par root sur sa source fraîchement migrée/seedée ; la sonde réelle a tourné sous Windows/Docker Linux. Le correctif Vercel annoncé par root n'a pas été recopié ni modifié ici. Aucun visa de release ou audit indépendant n'est délivré par cet addendum.
