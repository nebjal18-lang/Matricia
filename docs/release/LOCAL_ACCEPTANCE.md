# Recette authentifiée locale isolée

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

Le `finally` retire les objets Storage via l’API (octets compris), termine les franchises, révoque rôles/adhésions, archive les organisations, supprime les facteurs MFA et bannit les comptes synthétiques. L’historique immutable est conservé ; aucune purge générale de DB n’est faite. Les états/cookies/traces privés sont effacés ; seul un résumé sans secrets reste dans `artifacts/test-results/authenticated-route-smoke-summary.json` avec mode/environnement local, nombres observés même en échec, scénarios/causes nettoyés de leurs identifiants et résultat de nettoyage. Le rapport Playwright JSON brut reste dans le répertoire privé temporaire puis est supprimé. Un nettoyage en échec fait échouer la commande.

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
| `ui-auth` | 4 | OTP e-mail réel, consentement persisté, MFA TOTP réel, retour profond FR/AR |
| `route-smoke` | 16 | Quatre rôles, FR/AR, 360px et desktop, refus croisés, accessibilité automatisée |
| `p05-onboarding` | 28 | Profil et conformité Client, documents privés, central AAL2, refus AAL1 et tiers |
| `v1-critical` | 24 | Parcours Client/administration et accès diagnostics avec refus tenant/MFA |
| `client-journey` | 6 | Inscription OTP/consentement et MFA par UI ; mêmes comptes activés par profil, trois pièces privées, revue canonique et décideurs distincts ; lecture conformité/essai puis diagnostic autoritatif, acceptation de priorité et demande par UI FR/AR ; budget exact, rejeu et conflit de version |
| `p23-quotes` | 4 | Choix explicite de l’organisation, invitation, devis exact, adresse/identité confirmées par UI, publication avec ancre courante, audit/outbox, refus étranger |
| `final-core` | 4 | Message envoyé et relu après rechargement, comparaison figée, historique matching, quatre transitions de capacité par UI desktop FR |
| `linked-commercial` | 8 | 8/8 PASS local au SDK8 du1novembre05:22UTC : mêmes comptes inscrits, diagnostic et demande, commandes natives jusqu'à la réception, lectures UI des deux parties et signature de simulation DEV non contractuelle ; preuves exactes dans `LINKED_COMMERCIAL_RECIPE.md` |
| `benefit-fulfillment` | 6 | Préparé, NON EXÉCUTÉ : Auth UI4 puis cadeaux gouvernés, politique indépendante, réservations, planification/rapport/réception/consommation par UI FR/AR ; protocole dans `LOCAL_BENEFIT_FULFILLMENT.md` |
| `p24-p26` | 64 | Recettes transversales, missions/livrables et marketing local FR/AR, mobile et desktop |

Les 164 tests préparés, dont les six nouveaux cas avantages non exécutés, sont une somme de segments avec préconditions distinctes ; ils ne constituent pas un parcours commercial unique traversant tous les services. La recette Client conserve les vraies sessions obtenues par OTP dans les interfaces et utilise ces mêmes identités pour créer les organisations, saisir les profils, réserver/téléverser/finaliser les six pièces privées, enregistrer le résultat local connu sain, revoir les documents et identifiants puis décider VERIFIED/TRIAL_ACTIVE. La revue et la décision finale utilisent deux identités Compliance AAL2 distinctes ; l’auto-approbation est refusée. Aucun UPDATE de statut d’organisation n’active ce parcours. L’état validé et l’essai sont relus après rechargement dans l’interface P05, avant le diagnostic et la demande. La migration Admin241270 de revue canonique est requise. Pour corriger un segment, exécuter par exemple `corepack pnpm test:e2e:local-delivery --step client-journey`. Le manifeste mentionne alors explicitement `SINGLE_LOCAL_SEGMENT` ; il ne certifie pas les autres phases.

Le runner Client direct accepte `--historical-active-only` uniquement pour diagnostiquer le segment aval avec un état ACTIVE historique explicite. Ce mode n’est pas appelé par la recette unifiée et ses deux tests ne peuvent pas satisfaire son contrat de six tests ; il ne prouve ni inscription ni activation.

Le questionnaire de référence Client contient une règle publiée réelle : réponse INTEGER typée1, SCORE5000, anomalie/recommandation/opportunité FR/AR, service publié et niveau GUIDANCE explicite. La vraie soumission produit l’évaluation immutable ; le diagnostic213100 doit reprendre exactement score50.00, actions, identifiants et empreintes de cette évaluation. Le navigateur accepte la priorité, prépare le devis et suit le lien vers son brouillon de demande. Une conversion supplémentaire besoin→demande est exercée séparément par SDK et identifiée comme telle dans la preuve ; elle ne remplace pas les deux conversions issues du diagnostic par l’interface.

Un échec interrompt la chaîne et marque les phases suivantes `NOT_RUN`. Un skip, un retry/flaky, un nombre incomplet, une preuve ancienne, un nettoyage non vérifié ou une modification du code pendant la chaîne interdit le succès. Le manifeste local contient le commit Git et l’empreinte des sources applicatives, migrations et recettes, y compris les fichiers intégrés non encore committés. Les preuves expurgées de chaque phase sont liées par SHA256 dans `artifacts/test-results/local-acceptance/manifest.json`. Les sorties Playwright privées ne sont ni affichées ni conservées après nettoyage.

Les références catalogue/questionnaire publiées, consultations/contrats et qualifications historiques sont préparées explicitement. Les vrais messages, capacités, devis et commandes Client sont exécutés ensuite avec les permissions et déclencheurs applicatifs. La qualification finale utilise des octets PDF privés réels et une précondition locale connue saine, puis une revalidation publique par le vrai compte Compliance AAL2 (migration Provider253 requise). Cette validation synthétique de recette ne certifie ni le moteur antimalware externe ni une vérification humaine réelle de l’identité. Les messages/audits/outbox de cette recette restent conservés, les organisations sont archivées et les comptes désactivés. Le serveur local force les adaptateurs paiement/e-mail DEMO et marketing sandbox et désactive le fournisseur de contenu externe. Le courrier Auth reste le vrai GoTrue local. Aucun paiement ni publication externe ne peut être certifié par ce mode.

P23 utilise également une qualification historique explicite et trois PDF privés synthétiques, puis la vraie revalidation d’identité253. La publication257 est exécutée dans le formulaire avec adresse contractuelle et confirmation de l’utilisateur ; aucune ancre d’identité de devis n’est injectée en SQL. La vérification finale exige quatre ancres nouvelles correspondant à l’identité courante et aux adresses saisies, en plus des montants exacts et événements métier.

Le succès porte exclusivement le statut `LOCAL_SEGMENTS_PASSED`. Le staging autorisé, la restauration hébergée complète et ses fichiers Storage, le fournisseur de signature, les paiements réels et validations fiscales, ainsi que la signature du procès-verbal client restent des preuves distinctes requises avant livraison.
