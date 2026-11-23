# Recette authentifiée locale isolée

## Rejeu SQL neuf et concurrence

Le lanceur `scripts/validate-local-migration-replay.mjs` accepte `--with-sql`
pour rejouer tous les fichiers SQL et `--with-concurrency` pour ajouter les
quatre courses natives (Outbox, journal financier, crédits et chaîne d'audit).
Il exige `APP_ENV=development`. PostgreSQL utilise un conteneur UUID sans réseau
ni port exposé ; le processus Node 22 partage uniquement cet espace réseau
isolé. Aucun fichier de configuration applicatif ou socket Docker n'est monté
dans le processus de tests. Les secrets temporaires sont retirés au nettoyage.

Le résultat est écrit dans `work/isolated-replay/<run-id>/summary.json` ; seuls
`status=passed`, `concurrencyIncluded=true` et `cleanup=passed` prouvent la passe
avec concurrence. Une passe SQL réussie suivie d'un échec de préparation de la
concurrence reste un échec global. Cette commande ne certifie aucun PSP externe.

## Configuration locale automatique (Windows et Node 22)

### Concordance des fuseaux de Casablanca

Le conteneur PostgreSQL 17.6.1.166 embarque initialement tzdata 2025b,
contrairement à Node 22.23.5 (2026e). La recette d’activation des avenants
compare cinq dates historiques et futures avant de créer les parcours UI.
Une divergence provoque `LOCAL_CASABLANCA_RUNTIME_MISMATCH`.
Les règles proviennent de [IANA 2026e](https://data.iana.org/time-zones/tzdb-2026e/NEWS).

Après les variables locales ci-dessous, la commande explicite
`corepack pnpm --use-node-version=22.23.5 exec node scripts/repair-local-casablanca-tzdata.mjs`
installe les zones Casablanca et El_Aaiun compilées depuis la source IANA dont
le SHA-256 est fixé dans le script. Elle sauvegarde les fichiers remplacés dans
`work/timezone-2026e/`, redémarre uniquement `supabase_db_Matricia`, puis vérifie
la concordance Node/PostgreSQL. Aucune donnée métier ni migration n’est modifiée.
La correction doit être réappliquée si ce conteneur est recréé depuis son image
d’origine. Les clones SQL neufs restent des environnements distincts ; un ancien
rejeu sur leur image d’origine ne prouve pas cette concordance de fuseaux.

Lorsque la configuration habituelle cible un projet hébergé, activer explicitement
`E2E_LOCAL_AUTO_CONFIG=1` en plus de `E2E_LOCAL_ISOLATED=1`,
`E2E_LOCAL_PROJECT_ID=Matricia` et `APP_ENV=development`.
Le lanceur lit `supabase status -o env` en mémoire, puis vérifie Docker, les ports,
le projet, TOTP et les clés auprès de GoTrue. Il ne réécrit pas `.env.local`.
Les serveurs gérés reçoivent les paramètres locaux vérifiés sans placer de clé dans
la configuration sérialisée du rapport Playwright.

Les images Supabase des registres `ghcr.io/supabase/` et
`public.ecr.aws/supabase/` sont reconnues ; tous les autres contrôles restent requis.
Le service Storage doit correspondre au schéma effectivement installé : le
22 novembre 2026, le schéma avec versionnement des objets était incompatible avec
Storage 1.73.1 (`42P10` sur `ON CONFLICT (name, bucket_id)`). L'alignement local sur
1.96.4 a permis de réussir les preuves d'envoi de documents et de refus inter-tenant,
sans ajouter de contrainte globale qui casserait le versionnement.
Les migrations `20261122230000_versioned_delivery_storage_binding.sql` et
`20261122230100_delivery_storage_generated_metadata.sql` sont également requises :
elles conservent les preuves de livraison par une FK vers l'identité native de
l'objet et bloquent son remplacement. La recette commerciale exige le refus de
suppression par l'API Storage puis la relecture des octets avec le même SHA-256.
La migration `20261122234000_exact_tax_integer_quotient.sql` corrige aussi
l'arrondi anticipé des grands montants ; elle est requise pour la preuve exacte
P23. Elle ne réécrit aucun devis ni ledger historique.

Exemple PowerShell, depuis la racine avec Node 22 dans `PATH` :

```powershell
$env:E2E_LOCAL_ISOLATED='1'
$env:E2E_LOCAL_AUTO_CONFIG='1'
$env:E2E_LOCAL_PROJECT_ID='Matricia'
$env:APP_ENV='development'
node tests/e2e/helpers/p24-p26-completion-run.mjs --configuration-only
node tests/e2e/helpers/p24-p26-completion-run.mjs --local-fixture-proofs-only
node tests/e2e/helpers/p24-p26-completion-run.mjs --authenticated-route-smoke-only
```

Le port 5173 doit être libre avant la recette navigateur. Ne jamais remplacer le
serveur géré par un serveur déjà connecté à un autre projet.

Depuis un poste dont Node global n'est pas en version 22, la commande suivante
sélectionne explicitement le runtime requis et lance les quatre espaces :

```powershell
corepack pnpm --use-node-version=22.23.5 test:e2e:local-spaces
```

Ajouter `--all-workflows` pour les 64 tests des espaces et workflows,
`--marketing-only` pour les 8 tests Marketing, `--business-spaces-only` pour
les 40 tests métier complémentaires, ou `--local-auth-ui-only` pour les 4 tests
de connexion réelle. `--configuration-only` ne crée aucune fixture.
`--marketing-spaces-only` rejoue 24 tests combinant mutations Marketing et
accès aux espaces, afin de détecter notamment les erreurs de rendu après
l'apparition de calendriers publiés.
Chaque mode exige son nombre exact de tests réussis, sans test ignoré ni relance.
`E2E_FAIL_FAST=1` sert au diagnostic : un arrêt anticipé reste un résultat FAILED.
La planification Marketing nécessite notamment la migration
`20261122211500_marketing_schedule_variable_scope.sql`, qui résout les collisions
entre variables PL/pgSQL et colonnes sans retirer les contrôles d'autorisation.
Le lanceur initialise aussi l'identité de déploiement d'une base Docker vérifiée
encore non configurée en `DEVELOPMENT`, à condition qu'aucune révision de
configuration n'existe. Il conserve cette liaison d'infrastructure entre les
recettes et refuse de remplacer une liaison différente. Le scanner applique ainsi
la configuration locale sandbox tout en gardant le contrôle serveur obligatoire.
La recette des espaces passe explicitement l'organisation et le mandat des
fixtures multi-rôles ; elle couvre aussi les tableaux de bord client, fournisseur,
franchisé et administrateur. Sur Windows, le serveur géré ferme son propre arbre
de processus avant de rendre le port 5173.

Statut : outil prêt ; les recettes métier doivent être exécutées après intégration des migrations. Aucune validation staging ou production ne résulte de ce mode.

Le mode historique hébergé conserve ses contrôles URL/projet/région development/staging. Le mode local est distinct et exige simultanément :

- `E2E_LOCAL_ISOLATED=1`, `E2E_LOCAL_PROJECT_ID=Matricia` identique au `project_id` de `supabase/config.toml`, `APP_ENV=development` ;
- API HTTP loopback port 54321, PostgreSQL loopback port 54322/base postgres, application HTTP loopback port 5173 ; aucun pooler hébergé ;
- conteneurs `supabase_{db,kong,auth,storage}_Matricia` actifs, labels projet Supabase **et** Compose identiques au projet, images Supabase, ports DB/API concordants ;
- TOTP GoTrue local activé (`auth.mfa.totp.enroll_enabled` et `verify_enabled`), confirmé sur le conteneur Auth avant toute création de compte ;
- clés publishable/service-role acceptées par le vrai GoTrue local, sans afficher réponse utilisateurs, token ou secret.

`.env.local` ignoré par Git doit déjà contenir ces URL locales et les clés locales appropriées. Les contrôles locaux n’utilisent pas `supabase/project-metadata.json` hébergé et ne le modifient pas. Le compte SQL doit pouvoir exécuter le bootstrap et le nettoyage de fixture existants (lecture `auth`, création des seules fixtures, `session_replication_role` pour fixtures historiques) : ne pas fournir un accès hébergé.

Préconditions : toutes les migrations intégrées et règle économique STANDARD active présente ; Storage actif et migrations de buckets/policies appliquées ; dépendances installées, Chromium disponible ; espace disque libre pour Next/Playwright ; port5173 libre. Ne pas utiliser un serveur web déjà démarré : le mode local force son propre serveur. Réserver le créneau DB : le nettoyage existant neutralise aussi les anciennes fixtures `p05-e2e-*`, donc aucune recette p05 concurrente.

Depuis la racine du checkout intégré, sans recopier aucune clé dans la commande :

```sh
export E2E_LOCAL_ISOLATED=1
export E2E_LOCAL_PROJECT_ID=Matricia
export APP_ENV=development
export COREPACK_HOME=/workspace/.cache/corepack
node tests/e2e/helpers/p24-p26-completion-run.mjs --configuration-only
```

Cette commande est en lecture seule (Docker inspect ciblé + GoTrue settings/admin list limité) et ne provisionne aucune fixture.

Dans le créneau réservé, commencer par les preuves de fixture, puis exécuter les recettes :

```sh
node tests/e2e/helpers/p24-p26-completion-run.mjs --local-fixture-proofs-only
node tests/e2e/helpers/p24-p26-completion-run.mjs --authenticated-route-smoke-only
node tests/e2e/helpers/p24-p26-completion-run.mjs --local-auth-ui-only
node tests/e2e/helpers/p24-p26-completion-run.mjs
```

La première commande prouve uniquement les préconditions et l’isolation ; son résultat indique explicitement **aucune recette navigateur exécutée**. La deuxième exige16 tests navigateur sans skip/retry ; la troisième exige4 tests OTP/consentement/MFA desktop FR/AR ; la quatrième exige64 tests métier/FR-AR/360px et desktop sans skip/retry. Chaque commande reprovisionne et nettoie ses propres comptes. Les assertions ne sont pas affaiblies si une interface ou un workflow ne correspond plus : l’échec doit être corrigé dans le produit ou dans une attente obsolète justifiée.

Les identités sont créées dans GoTrue réel. En local, chaque session utilise un challenge OTP magic-link produit par l’API admin puis consommé par `verifyOtp`, jamais un JWT fabriqué. Le compte central COMPLIANCE_MANAGER n’a aucune organisation ; son vrai TOTP est inscrit/challengé et le niveau aal2 vérifié. Les états navigateur conservent aussi un central aal1 pour les refus. Le compte fournisseur/franchisé possède deux organisations et deux mandats actifs distincts ; une session étrangère réelle doit n’en voir aucun. Les comptes ClientA/ClientB, les dossiers, le document et les workflows sont persistés, avec preuve des commandes/audit/outbox et refus intertenant. Le mode local prépare aussi son propre petit catalogue FR/AR aux identifiants uniques (bibliothèque, catégorie, sous-catégorie, service), sans dépendre du catalogue client ni charger les 6 000 questions. Le nettoyage retire ses versions et archive ses identités. La préparation des références publiées et de certaines fixtures contractuelles historiques est un bootstrap privilégié ; elle ne prouve ni le parcours de publication du catalogue ni le parcours commercial de création d’un contrat.

Le `finally` retire les dépôts Storage non liés à une preuve via l’API (octets compris), termine les franchises, révoque rôles/adhésions, archive les organisations, supprime les facteurs MFA et bannit les comptes synthétiques. Les preuves de livraison liées restent conservées avec leurs octets, SHA-256 vérifié, et leur historique mission/contrat. Le nettoyage normal et celui après interruption respectent cette conservation. Aucune purge générale de DB n’est faite. Les états/cookies/traces privés sont effacés ; seul un résumé sans secrets reste dans `artifacts/test-results/authenticated-route-smoke-summary.json` avec mode/environnement local, nombres observés même en échec, scénarios/causes nettoyés de leurs identifiants et résultat de nettoyage. Le rapport Playwright JSON brut reste dans le répertoire privé temporaire puis est supprimé. Un nettoyage en échec fait échouer la commande.

Après interruption brutale, utiliser uniquement le run token exact de la fixture concernée avec les commandes existantes :

```sh
node tests/e2e/helpers/p24-p26-completion-run.mjs --cleanup-only RUN_TOKEN
node tests/e2e/helpers/p24-p26-completion-run.mjs --verify-clean RUN_TOKEN
```

Ces commandes sont des mutations de nettoyage : les lancer dans le même créneau réservé. Aucune sortie de ce mode ne constitue un certificat de performance hébergée, de restauration staging, d’intégration fournisseur ni un procès-verbal client signé.

## OTP et MFA par les interfaces

Le mode `--local-auth-ui-only` vérifie en plus le conteneur de courrier local et son port54324 (Mailpit ou Inbucket selon l’image effectivement démarrée), puis la longueur OTP effectivement configurée sur GoTrue (6 par défaut, 7/8 seulement si configurés). Quatre scénarios desktop FR/AR cochent le consentement, demandent et saisissent le vrai code reçu, reprennent une URL interne profonde et font passer deux comptes administrateurs sans organisation par le vrai challenge TOTP. Aucun JWT ou cookie de session n’est construit dans ces scénarios. Les deux acceptations de consentement doivent être présentes en base avec identité/email vérifiés. Les secrets TOTP et codes restent exclusivement dans les fichiers temporaires privés/mémoire puis sont supprimés ; seuls les courriers des destinataires synthétiques uniques et nouveaux comptes synthétiques sont neutralisés au nettoyage. Cette recette ne vaut pas approbation juridique de l’éditeur ou des conditions.

## Recette unifiée des segments locaux

Après intégration et installation, réserver un créneau sans migration, build ni autre navigateur. Les variables locales ci-dessus sont obligatoires ; ajouter le chemin Chromium si nécessaire :

```sh
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
export PLAYWRIGHT_VIDEO=off
corepack pnpm test:e2e:local-delivery
```

Le runner exécute successivement ces recettes, chacune avec ses comptes réels et son nettoyage :

| Phase | Tests attendus | Preuve exercée |
| --- | ---: | --- |
| `recurring-requests` | 10 | Inscription et activation reelles, quatre clones, douze plans, trois cadences et dates, pause/reprise/fin, rejeu et refus inter-tenant |
| `admin-summary` | 4 | Résumé administrateur, priorités et sélection sans mutation, FR/AR desktop/360 |
| `universal-actions` | 16 | File universelle des quatre rôles, lecture, isolation et accessibilité FR/AR desktop/360 |
| `franchise-followups` | 12 | Règles, revue indépendante, consentement retiré et planification native FR/AR desktop/360 |
| `franchise-crm` | 8 | Invitations, dédoublonnage, notes et suivi manuel Client/Provider FR/AR desktop/360 |
| `questionnaire-assistance` | 14 | Préremplissage frais confirmé, faits expirés exclus, aide/exemples/explications FR/AR desktop/360 |
| `questionnaire-revalidation` | 10 | Expiration réelle, confirmation FR/AR desktop/360, soumission, historique et refus serveur |
| `client-referrals` | 4 | Liens client, consentement et attribution, FR/AR desktop/360 |
| `referral-rewards` | 14 | Approbation indépendante, émission Finance et crédits réels, FR/AR desktop/360 |
| `solution-decisions` | 10 | Trois niveaux, acceptation/refus/report persistés, FR/AR desktop/360 |
| `diagnostic-history` | 10 | Historique scores, snapshots et explications FR/AR desktop/360 |
| `questionnaire-simulation` | 4 | Simulation franchisé, deux branches et refus, FR/AR desktop/360 |
| `question-quality` | 10 | Analyses de qualité, doublons et décisions humaines, FR/AR desktop/360 |
| `solution-bundles` | 10 | Publication multi-bibliothèques, déduplication et reprise guidée, FR/AR desktop/360 |
| `reward-rules` | 4 | Huit versions de règles et quantités exactes, FR/AR desktop/360 |
| `amendment-activation` | 20 | Signatures DEV, activation et intégration UI des travaux, FR/AR desktop/360 |
| `contract-amendments` | 16 | Propositions client/fournisseur, contrat signé conservé, FR/AR desktop/360 |
| `provider-reputation` | 20 | Réputation issue des missions, badges humains et consultation FR/AR desktop/360 |
| `provider-favorites` | 16 | Parcours commercial réel, favoris FR/AR desktop/360, revalidation courante, pause fournisseur, isolation et rejeu |
| `notification-templates` | 4 | Prévisualisation et proposition FR/AR, approbation indépendante, textes persistés, versions et audit/outbox corrélés, refus serveur |
| `admin-decisions` | 4 | Ouverture native de huit dossiers, prise en charge et decisions humaines FR/AR desktop/360, historique et absence de sanction automatique |
| `functional-controls` | 20 | Sites, projets, jalons jusqu'à acceptation et progression, calendrier Casablanca, centres de coûts, budgets et allocations exacts avec empreinte du fichier, assistance avec décision humaine, modification de profil et réévaluation, préférences Franchisé et notifications FR/AR 360/desktop ; persistance, audit/outbox, refus inter-tenant et catégories obligatoires |
| `ui-auth` | 4 | OTP e-mail réel, consentement persisté, MFA TOTP réel, retour profond FR/AR |
| `route-smoke` | 16 | Quatre rôles, FR/AR, 360px et desktop, refus croisés, accessibilité automatisée |
| `p05-onboarding` | 28 | Profil et conformité Client, documents privés, central AAL2, refus AAL1 et tiers |
| `v1-critical` | 24 | Parcours Client/administration et accès diagnostics avec refus tenant/MFA |
| `client-journey` | 6 | Inscription OTP/consentement et MFA par UI ; mêmes comptes activés par profil, trois pièces privées, revue canonique et décideurs distincts ; lecture conformité/essai puis diagnostic autoritatif, acceptation de priorité et demande par UI FR/AR ; budget exact, rejeu et conflit de version |
| `p23-quotes` | 4 | Choix explicite de l’organisation, invitation, devis exact, adresse/identité confirmées par UI, publication avec ancre courante, audit/outbox, refus étranger |
| `final-core` | 4 | Message envoyé et relu après rechargement, comparaison figée, historique matching, quatre transitions de capacité par UI desktop FR |
| `linked-commercial` | 8 | 8/8 PASS local au SDK8 du1novembre05:22UTC : mêmes comptes inscrits, diagnostic et demande, commandes natives jusqu'à la réception, lectures UI des deux parties et signature de simulation DEV non contractuelle ; preuves exactes dans `LINKED_COMMERCIAL_RECIPE.md` |
| `benefit-fulfillment` | 6 | 6/6 PASS local le 22 novembre : Auth UI4 puis cadeaux gouvernés, politique indépendante, réservations, planification/rapport/réception/consommation par UI FR/AR ; protocole dans `LOCAL_BENEFIT_FULFILLMENT.md` |
| `p24-p26` | 64 | Recettes transversales, missions/livrables et marketing local FR/AR, mobile et desktop |

Les 404 exécutions configurées sont une somme de segments avec préconditions distinctes ; ils ne constituent pas un parcours commercial unique traversant tous les services. La recette Client conserve les vraies sessions obtenues par OTP dans les interfaces et utilise ces mêmes identités pour créer les organisations, saisir les profils, réserver/téléverser/finaliser les six pièces privées, enregistrer le résultat local connu sain, revoir les documents et identifiants puis décider VERIFIED/TRIAL_ACTIVE. La revue et la décision finale utilisent deux identités Compliance AAL2 distinctes ; l’auto-approbation est refusée. Aucun UPDATE de statut d’organisation n’active ce parcours. L’état validé et l’essai sont relus après rechargement dans l’interface P05, avant le diagnostic et la demande. La migration Admin241270 de revue canonique est requise. Pour corriger un segment, exécuter par exemple `corepack pnpm test:e2e:local-delivery --step client-journey`. Le manifeste mentionne alors explicitement `SINGLE_LOCAL_SEGMENT` ; il ne certifie pas les autres phases.

Le runner Client direct accepte `--historical-active-only` uniquement pour diagnostiquer le segment aval avec un état ACTIVE historique explicite. Ce mode n’est pas appelé par la recette unifiée et ses deux tests ne peuvent pas satisfaire son contrat de six tests ; il ne prouve ni inscription ni activation.

Le questionnaire de référence Client contient une règle publiée réelle : réponse INTEGER typée1, SCORE5000, anomalie/recommandation/opportunité FR/AR, service publié et niveau GUIDANCE explicite. La vraie soumission produit l’évaluation immutable ; le diagnostic213100 doit reprendre exactement score50.00, actions, identifiants et empreintes de cette évaluation. Le navigateur accepte la priorité, prépare le devis et suit le lien vers son brouillon de demande. Une conversion supplémentaire besoin→demande est exercée séparément par SDK et identifiée comme telle dans la preuve ; elle ne remplace pas les deux conversions issues du diagnostic par l’interface.

Un échec interrompt la chaîne et marque les phases suivantes `NOT_RUN`. Un skip, un retry/flaky, un nombre incomplet, une preuve ancienne, un nettoyage non vérifié ou une modification du code pendant la chaîne interdit le succès. Le manifeste local contient le commit Git et l’empreinte des sources applicatives, migrations et recettes, y compris les fichiers intégrés non encore committés. Les preuves expurgées de chaque phase sont liées par SHA256 dans `artifacts/test-results/local-acceptance/manifest.json`. Les sorties Playwright privées ne sont ni affichées ni conservées après nettoyage.

Les références catalogue/questionnaire publiées, consultations/contrats et qualifications historiques sont préparées explicitement. Les vrais messages, capacités, devis et commandes Client sont exécutés ensuite avec les permissions et déclencheurs applicatifs. La qualification finale utilise des octets PDF privés réels et une précondition locale connue saine, puis une revalidation publique par le vrai compte Compliance AAL2 (migration Provider253 requise). Cette validation synthétique de recette ne certifie ni le moteur antimalware externe ni une vérification humaine réelle de l’identité. Les messages/audits/outbox de cette recette restent conservés, les organisations sont archivées et les comptes désactivés. Le serveur local force les adaptateurs paiement/e-mail DEMO et marketing sandbox et désactive le fournisseur de contenu externe. Le courrier Auth reste le vrai GoTrue local. Aucun paiement ni publication externe ne peut être certifié par ce mode.

P23 utilise également une qualification historique explicite et trois PDF privés synthétiques, puis la vraie revalidation d’identité253. La publication257 est exécutée dans le formulaire avec adresse contractuelle et confirmation de l’utilisateur ; aucune ancre d’identité de devis n’est injectée en SQL. La vérification finale exige quatre ancres nouvelles correspondant à l’identité courante et aux adresses saisies, en plus des montants exacts et événements métier.

Le succès porte exclusivement le statut `LOCAL_SEGMENTS_PASSED`. Le staging autorisé, la restauration hébergée complète et ses fichiers Storage, le fournisseur de signature, les paiements réels et validations fiscales, ainsi que la signature du procès-verbal client restent des preuves distinctes requises avant livraison.
