# Matricia — candidat unifié du 2 novembre 2026

**État : version de revue technique vérifiable, non certifiée pour livraison définitive.** Branche : `codex/final-corrections-20261102`, base `1ebf3ea` de `codex/bootstrap-foundation`. Cette base contient déjà la consolidation `5366c32` et le design reconstruit `a5b57af`, fusionnés sur GitHub par la PR #8 avant la remise. Cette mission n’a fusionné aucune PR et n’a déployé aucune production.

## Corrections effectives

- Organisations : refus d’accès distinct d’une liste réellement vide, erreur technique conservée, réponses invalides et pagination incomplète refusées, nouvelle tentative FR/AR conservant les filtres. Une panne de la file complémentaire est signalée séparément.
- Authentification : classification commune d’Auth503 comme panne, conservation des signaux Next, maintien des rôles et de MFA/AAL2 ; une panne de lecture des habilitations ne devient plus une redirection silencieuse.
- Acteurs : erreurs de fiche conservées sans faux 404 ; aucune substitution à une autre adhésion lorsqu’une organisation est demandée. Plusieurs organisations sans contexte explicite imposent un choix avant toute lecture de contexte d’édition ou formulaire de mutation.
- Mobile : contraintes de largeur communes des cartes/grilles et tableaux corrigées ; région de tableau focalisable ; menus d’actions consultables dans le défilement. Les noms d’organisation saisis par les utilisateurs restent inchangés en arabe.
- Quinze contrats SQL réalignés sur les prérequis gouvernés actuels. Aucune migration modifiée ni appliquée sur la base partagée ; aucun garde désactivé pour obtenir ces résultats. Les écritures de fixture se limitent au laboratoire local vérifié et au clone isolé.

## Vérifications et portée

| Contrôle | Résultat |
| --- | --- |
| Installation | `pnpm install --frozen-lockfile --prefer-offline` réussie dans le worktree dédié. |
| Types, lint, compilation | PASS ; Next 16.4.1, compilation finale du candidat. |
| Unitaires | 2 150 web, 102 worker et 137 bibliothèques PASS ; un Storage opt-in explicitement ignoré. |
| Régressions ciblées | Refus/503/transport/réponse invalide/pagination/organisation erronée ou ambiguë testés, avec rendu serveur FR/AR. |
| Navigateur public | 18/18 PASS, aucun ignoré/instable. |
| Organisations réel | 4/4 : FR/AR × 360/1 280 px ; GoTrue OTP/TOTP AAL2, recherche saisie + Entrée, ouverture du menu, sélection et titre de la véritable organisation de fixture. |
| Autorisation serveur | Projection et schéma valides pour l’Admin synthétique ; compte ordinaire AAL2 refusé avec `42501`. Le compte exact Admin de démonstration n’a pas été modifié. |
| SQL isolé | 417 migrations rejouées ; 225 contrats PASS, 4 926 assertions. 608 tables publiques sous RLS, pgTAP inaccessible aux rôles API ; clone nettoyé. |
| Nettoyage natif | Sept cohortes, 14 acteurs neutralisés et sept organisations de test archivées ; données d’audit conservées. Serveur de recette arrêté. |

Quatre tests de la passe fortement parallèle ont dépassé leur budget de 5 s. La passe séquentielle avec deux workers passe sans modification de ce budget ou des assertions ; la CI utilise désormais cette concurrence bornée. Les échecs initiaux restent conservés dans les journaux privés et ne sont pas effacés du bilan.

Les premières tentatives navigateur visaient un lien dans un menu fermé, puis ont révélé un véritable défaut de largeur mobile. Le test a été corrigé pour ouvrir le menu normalement et la cause CSS a été corrigée ; les quatre parcours finaux passent sans clic forcé ni réponse métier simulée.

## Réserves bloquantes

1. **M01 vérifié dans le candidat local actuel.** Le message backend d’origine « UNAVAILABLE » ne se reproduit pas avec la session Admin synthétique AAL2 ; aucun changement arbitraire de schéma n’a été appliqué pour le cacher.
2. **M02 incomplet et M03–M30 non fournis.** La liste des neuf routes M02 et les descriptions restantes manquent. Les causes communes corrigées ne constituent pas une fermeture inventée de ces identifiants. Voir `docs/evidence/M01-M30-status-20261102.json`.
3. **56 contrats SQL exclus**, identifiés par le filtre conservateur de références à `session_replication_role` ou à l’activation/désactivation de triggers. Ils ne sont pas comptés comme réussis ; la suite complète de 281 contrats n’est pas certifiée. Une revue de chaque fixture est nécessaire pour distinguer préparation historique et tests négatifs avant levée de l’exclusion.
4. Le test 0246 ne certifie pas un cycle réellement expiré ni un deuxième mois annuel déjà dû. Il couvre les sources natives actuelles, le report de politique exact et le refus des périodes futures/historiques non prouvés.
5. **Contrôle de livraison refusé : 74 conditions non satisfaites ; 5/76 exigences VERIFIED.** Les approbations, décisions externes et réserves de livraison antérieures restent ouvertes ; aucun visa n’a été inventé.
6. **PR non créée automatiquement.** La commande GitHub a reçu `Forbidden` sur `https://api.github.com/graphql` ; `api.github.com` est absent de la liste réseau autorisée. La branche et ce dossier sont poussés ; le contenu de PR est prêt dans `PR_FINAL_CANDIDATE_2026-11-02.md`.

Preuves : `docs/evidence/final-candidate-20261102.json` et `docs/evidence/final-sql-guard-safe-20261102.json`. Aucune clé, session d’authentification ou capture privée n’est committée.

## Reproduction locale

Utiliser les variables sécurisées locales et les six services Supabase identifiés `Matricia`, sans base de production. Installer par `corepack pnpm install --frozen-lockfile`.

- Tests : `corepack pnpm -r --workspace-concurrency=1 test --maxWorkers=2`.
- Qualité : `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm test:integration`, `corepack pnpm test:tooling`, `corepack pnpm verify:phase00`.
- Compiler avec une URL HTTPS de métadonnées autorisée pour le laboratoire ; démarrer le serveur local 5173 depuis ce même build.
- Recette M01 : `E2E_LOCAL_ISOLATED=1 E2E_LOCAL_PROJECT_ID=Matricia APP_ENV=development NEXT_PUBLIC_APP_URL=http://localhost:5173 corepack pnpm test:e2e:admin-organizations`. Le helper refuse tout environnement autre que le Docker local vérifié, crée ses propres acteurs, n’usurpe aucun JWT et nettoie ses données même en échec. Son bootstrap de rôle est une préparation de fixture, pas une preuve du circuit d’attribution gouverné.
- SQL : employer le rejeu neuf isolé et ses labels vérifiés. Ne jamais réinitialiser ni migrer automatiquement la base partagée pour reproduire ces tests.
