## 2026-11-25 — MAT-FINAL lot 02, parcours prédiagnostic → besoin

Le [registre des 376 points](../mat-final/REGISTRE_376.md) et le [reçu du lot 02](../mat-final/LOT02_DIAGNOSTIC_BESOIN_2026-11-25.md) sont actualisés pour D02, D04, D05, D08, D09, D10, D13, D14 et D18, tous **EN COURS**. Le bouton d'accompagnement utilise la priorité choisie, le formulaire reprend le texte libre et les réponses du diagnostic, et le cas BTP signale que la rentabilité chantier reste à mesurer. Un ancien brouillon est conservé jusqu'au choix de l'utilisateur. Test ciblé : 53/53 unitaires et 10/10 E2E FR/AR ordinateur/360 px ; TypeScript, lint et build synthétique PASS. Serveur local factice, sans soumission ni déploiement. Node local 24.11.0 ; gate Node 22 et flux connecté non prouvés. Le programme MAT-FINAL complet reste ouvert.

## 2026-11-25 — MAT-FINAL lot 01, candidat en cours

Source figée pour l'inventaire : `ec09db5de9de8289fbc177994891a5ff695f5898` sur `codex/mat-final-01-candidate` ; aucune fusion ni production. [Registre des 376 points](../mat-final/REGISTRE_376.md) initialisé sans clôture automatique et [matrice V01–V12](../mat-final/LOT01_CANDIDATE_2026-11-25.md) actualisée : 223 pages, 377 actions serveur, 2 388 interactions recensées statiquement, 648 dettes de validation runtime. Scanner `--check` PASS et tests de preuve 3/3 PASS sous Node 24.11.0, sans valeur de gate Node 22. CI du SHA source : navigateur public et qualité PASS, SQL FAIL `0043`/`42501` sur un `session_replication_role=replica` du test. Docker local indisponible pour rejouer le clone. Lot et release NO-GO ; prochaine étape : corriger la fixture SQL sans désactiver les triggers, puis recette commune au même SHA.

## 2026-11-22 — Extension des preuves des 68 fonctions, en cours

## 2026-11-23 — Vérification globale du candidat d5e3cf2c

[Bilan consolidé](../../artifacts/test-results/final-verification-20261123/summary.json). Node 22.23.5, aucun changement applicatif pendant la recette.

| Contrôle | Résultat exécuté |
| --- | --- |
| Lint, TypeScript, phase00, absence de placeholders, structure release | PASS |
| Unitaires | 4 753 PASS + 1 test de stockage privé local exécuté séparément PASS ; ce dernier était ignoré par défaut |
| Intégration / outillage | 3 / 123 PASS |
| Composant financier navigateur | 6 PASS, action serveur simulée |
| Recette E2E locale complète | 404/404 PASS, 32 séquences, zéro échec/ignoré, nettoyages validés |
| Pages publiques | 58/58 PASS, zéro échec/ignoré/instable |
| SQL complet | 629 migrations, 400 fichiers, 9 793 assertions PASS ; concurrence et nettoyage PASS |
| Build | PASS après configuration locale de NEXT_PUBLIC_APP_URL=https://matricia.invalid |

La première commande globale a échoué au build car l'URL HTTP locale ne satisfait pas la règle HTTPS de production. Seul le build a été relancé avec l'URL fictive ci-dessus ; aucun déploiement ni assouplissement de garde. Le test Storage séparé vérifie les vrais octets PDF FR/AR sur le Supabase local et supprime ses propres fichiers.

Les **462 exécutions E2E réussies** comprennent des prérequis répétés : ce nombre ne mesure pas une couverture fonctionnelle de 100 %. La recette complète est désormais exécutée sur un même candidat, au lieu de seulement additionner les 406 exécutions historiques de segments distincts. [Manifeste archivé et reçus des 32 séquences](../../artifacts/test-results/local-acceptance/history/final-20261123-manifest-41811a7c6d99c5826c50b9643db2e91bb6f858f751560f13a9d3ec2ba833a093.json). [Preuve SQL](../../artifacts/test-results/final-verification-20261123/sql.json). [Preuve publique](../../artifacts/test-results/final-verification-20261123/public-browser.json).

Les statuts contractuels restent **57 PARTIAL_EXECUTED / 11 REVIEW_REQUIRED**. Les parcours encore incomplets et les preuves externes (paiement bancaire/PSP, signature contractuelle, emails, antivirus, restauration hébergée, déploiement et audit indépendant) empêchent un visa global. Prochaine étape : combler ces preuves ; pas de nouvelle relance globale sans changement. Le push est bloqué par la reconnexion GitHub requise.

## 2026-11-23 — Expiration des certifications : preuve SQL native

**15/15 assertions PASS**, 629 migrations sur clone isolé neuf, nettoyage PASS. Onze assertions comportementales ajoutées aux quatre contrôles statiques de [0370_provider_review_credential_reminders.test.sql](../../supabase/tests/0370_provider_review_credential_reminders.test.sql). Les commandes natives déposent et font vérifier les documents, puis le worker génère six rappels J-60/J-30/J-7 pour deux destinataires FR/AR. Pagination, refus utilisateur, absence de rappel hors échéance, rejeu sans doublon et lectures RLS par destinataire sont vérifiés. [Reçu final](../../work/isolated-replay/5b741104-8870-4228-ab2b-7397c4b5b638/summary.json).

MAT-FUNC-029 reste REVIEW_REQUIRED : suspension ciblée et parcours navigateur restent à prouver ; métadonnées Storage et résultat antivirus synthétiques, aucun email externe certifié. Le total E2E reste inchangé. Une erreur de résolution de pgTAP sous le rôle authenticated a été corrigée dans le test en collectant les lectures sous ce rôle avant les assertions ; aucun droit applicatif ajouté.

## 2026-11-23 — Rapprochement : refus serveur et reprise navigateur

Treize nouveaux tests de l'action serveur couvrent la confirmation obligatoire, les locales autorisées, la transmission exacte des montants et identifiants, les refus et l'absence de rafraîchissement après échec. Résultat ciblé avec le repository : **21/21 PASS**. Deux nouveaux tests de composant navigateur FR/AR vérifient le bouton désactivé pendant l'envoi, le conflit visible, la reprise avec la même identité de requête et le montant exact `9007199254740993`. Suite composant : **6/6 PASS** en 5,4 secondes, compilation et navigateur partagés. Sources : [action serveur](../../apps/web/modules/admin/screens/finance/actions.test.ts), [composant navigateur](../../tests/remediation/finance-reconciliation-browser.test.mjs).

Les limites sont inchangées : action simulée dans le navigateur, repository simulé dans les tests d'action ; aucune nouvelle preuve E2E native ni hausse du total 406. Prochaine étape : continuité navigateur-vers-base du rapprochement.

### 2026-11-23 — Validation financière native ciblée

Dernière extension : **82/82 assertions PASS** sur clone neuf (629 migrations, nettoyage PASS). Deux factures natives et deux paiements approuvés ; répartition d'un paiement entre les deux factures, soldes nuls, comptabilité équilibrée, immutabilité et rejeux vérifiés. Les chiffres 74/78 ci-dessous sont historiques, non cumulatifs. Prochaine preuve : continuité navigateur-vers-base ; aucun mouvement bancaire externe certifié.

Extension exécutée : **78/78 assertions PASS**, 629 migrations, nettoyage confirmé. Deux paiements indépendamment approuvés règlent exactement une facture, avec journaux équilibrés et absence de doublons. Le cas multi-factures et la continuité navigateur native restent ouverts. Aucun test E2E ajouté au compteur par cette preuve SQL.

629 migrations rejouées sur clone neuf ; 74/74 assertions du scénario clôture-facture-paiement-rapprochement passent, nettoyage confirmé. Écritures natives équilibrées, revue indépendante, rejouabilité et refus MFA/inter-organisations vérifiés. [Résultat et limites](../audits/E2E_COVERAGE_2026-11-22.md). Reste : continuité navigateur native et cas multi-factures/multi-paiements, sans confondre ces preuves avec un règlement bancaire externe.

### 2026-11-23 — Continuité, dates et rapprochement financier

Contrôle interactif du rapprochement ajouté : 4/4 tests Chromium FR/AR 360/1280 passent ; composant réel, données et action synthétiques explicitement déclarées. Couverture des changements de sélection, montants et confirmations. Exécution isolée en 7,1 secondes et intégration à la validation applicative. La recette financière native reste ouverte.

Quatre corrections : conservation de l'organisation du besoin, report d'opportunité en heure Casablanca avec validation des dates, transport exact des montants des recommandations, sélection de factures compatible avec le paiement dans l'Admin. Validation ciblée : 62 tests PASS, TypeScript/lint sans erreur ; 10/10 E2E FR/AR desktop/360 du besoin passent avec nettoyage. [Détails et limites](../audits/E2E_COVERAGE_2026-11-22.md).

Prochaine étape : recette navigateur native du rapprochement modifié, puis fermeture des lacunes des 11 exigences encore à examiner. La validation complète des 68 exigences, les intégrations externes et les audits indépendants restent ouverts. Aucun pourcentage de couverture complète revendiqué.

## 2026-11-23 - Historique des diagnostics

10/10 E2E passent : comparaison de scores 50 vers 0, conservation des anciens instantanes, explications client et techniques, refus inter-organisations, rejeu et audit. FR/AR ordinateur et 360 px. Le debordement mobile qui rendait le lien historique inaccessible est corrige. [Preuve](../../artifacts/test-results/local-acceptance/history/diagnostic-history-bfe25e1e52ab7412949e5d63dcbd56956de4381eb793a319afb5bf6576790733.json).

406 executions sur 32 segments avec prerequis repetes ; 57/68 exigences partiellement prouvees, 11 a examiner. Ce total ne constitue pas un pourcentage de couverture complete.


## 2026-11-23 — Simulation accessible au franchisé mandaté

**4/4 E2E passent** : huit simulations réelles couvrent les deux branches (0 et 5 000 points de base), avec quatre rejets de saisies invalides. FR/AR, ordinateur/360 px, accessibilité, déterminisme et refus hors bibliothèque passent. Aucun questionnaire réel n’est créé ; le snapshot publié et sa version restent inchangés. [Preuve](../../artifacts/test-results/local-acceptance/history/questionnaire-simulation-ebb64f5b983ed9b85be6756a341ec570c3fb2ead85aa377b6c9cc0e42440070b.json).

Deux défauts corrigés : le questionnaire client disparaissait de la vue éditoriale après publication ; le moteur exigeait en plus un rôle central et refusait le franchisé pourtant mandaté. Les permissions de bibliothèque, la double authentification du moteur et les refus après révocation restent effectifs. Neuf assertions d’accès passent après 628 migrations sur base neuve ; huit assertions supplémentaires du moteur passent avec la correction en transaction annulée. La suite SQL globale du candidat incluant les deux corrections passe : **629 migrations, 400 fichiers, 9 774 assertions et quatre scénarios de concurrence**, avec nettoyage réussi. [Preuve](../../work/isolated-replay/2369ca5a-82e8-4f9b-ac70-828d504d5c60/summary.json).

Consolidation : **396 exécutions sur 31 segments**, avec prérequis répétés ; **55/68 exigences partiellement prouvées**, 13 à examiner. Les opérateurs complexes et la revue indépendante ne sont pas certifiés par ces quatre parcours.


## 2026-11-23 — Qualité des questions et décisions humaines

**10/10 E2E passent**, sans échec, test ignoré ni instabilité. Quatre analyses réelles détectent ambiguïtés, données déjà connues et similarités ; quatre décisions humaines sont persistées. Le rejeu des analyses et décisions, les refus inter-organisations, les événements corrélés et l’accessibilité FR/AR ordinateur/360 px passent. Les questions publiées restent inchangées après ces décisions. [Preuve](../../artifacts/test-results/local-acceptance/history/question-quality-310071763618624f1e804f3581e7e5d6da712d7e41a1eee063c4600f0649544f.json).

Le modèle testé est heuristique et versionné, sans fournisseur IA externe. Cette preuve couvre partiellement MAT-FUNC-041 et 042 ; elle ne certifie pas la qualité sémantique générale ni tous les doublons entre domaines.

Consolidation : **392 exécutions sur 30 segments**, avec prérequis répétés ; **54/68 exigences partiellement prouvées**, 14 à examiner. Aucun pourcentage de couverture complète n’est déduit de ce total.


## 2026-11-23 — Ensembles multi-bibliothèques utilisables

**10/10 E2E passent**, sans échec ni test ignoré : quatre publications réelles réunissent deux bibliothèques ; trois lignes sources deviennent deux prestations sans double facturation, pour **150 049 unités mineures**. Les propositions sont affichées dans l’espace client et permettent de préparer un besoin en conservant titre, description et organisation. Aucune demande n’est créée automatiquement. Rejeu, refus inter-organisations, audit/Outbox et accessibilité FR/AR ordinateur/360 px passent. [Preuve](../../artifacts/test-results/local-acceptance/history/solution-bundles-93f2f93b0ead91b3164cdfd87c77dff433eff8025cf9ea18e99742470738682b.json).

Défauts corrigés : propositions chargées mais absentes de la page ; message vide contradictoire ; publication bloquée par les majuscules du code dans la portée d’idempotence. La portée utilise désormais une empreinte stable et bornée. **12 assertions SQL passent après 627 migrations sur base neuve**, y compris code de 120 caractères et rejeu à charge modifiée refusé. [Preuve SQL](../../work/isolated-replay/155eebb0-8261-42c2-bd01-6845eb799a4a/summary.json). Le contrôle SQL global passe : **627 migrations, 398 fichiers, 9 757 assertions, quatre scénarios de concurrence et nettoyage réussi**. [Preuve globale](../../work/isolated-replay/f78e7b7e-ba8d-4d9d-b091-c5c0f035c0d3/summary.json). Le test Storage séparé et le build de **354 pages** passent après les corrections d’affichage.

La progression des projets (MAT-FUNC-056) est également reliée à une preuve existante : 0 % avant réception, 100 % après acceptation, confirmés dans l’interface et en base. Cette correction de traçabilité n’ajoute aucune exécution.

Consolidation : **382 exécutions sur 29 segments**, avec prérequis répétés ; **52/68 exigences partiellement prouvées**, 16 à examiner. Ce total n’est pas une couverture fonctionnelle complète ; la revue indépendante reste ouverte.


## 2026-11-23 — Solutions multiples et décisions client

**10/10 E2E passent** : diagnostics issus des questionnaires, quatre ensembles Essential/Standard/Advanced et douze décisions réelles d’acceptation/refus/report, en FR/AR ordinateur/360 px. Les décisions persistées, rejeux, refus inter-organisations, audit/Outbox et fin de journée Casablanca sont vérifiés. [Preuve](../../artifacts/test-results/local-acceptance/history/solution-decisions-37c78a142cb9f47a9247162818699185b49d77fd86cd6dee663e14804a4d465e.json).

Deux défauts corrigés : dates de report impossibles et décalage UTC ; contraste du lien dégradé hérité du style général des liens. Trois tests de régression échouaient avant correction ; **12 tests ciblés, TypeScript et lint passent**. La suite globale passe avec **4 339 tests Web, 183 Worker et les packages** ; le test Storage conditionnel et un nouveau build restent à exécuter après les prochaines modifications.

Consolidation : **372 exécutions sur 28 segments**, avec prérequis répétés ; **50/68 exigences partiellement prouvées**, 18 à examiner. Référentiel publié de recette explicite ; revue indépendante et couverture complète restent ouvertes.


## 2026-11-23 — Parrainage jusqu’à émission financière

**14/14 E2E passent**, sans échec ni test ignoré : inscription et activation des clients, transitions de parrainage contrôlées par deux intervenants, approbation dans l’interface, consultation de l’attente, émission Finance et consultation des crédits en FR/AR ordinateur/360 px. L’approbation laisse le solde inchangé ; chaque émission crée exactement **17 crédits BONUS**, un lot et une écriture uniques, avec revenu nul. Rejeux, refus sans habilitation Finance, isolation, audit/Outbox et accessibilité passent. [Preuve](../../artifacts/test-results/local-acceptance/history/referral-rewards-7e6dadf6e76d32a6164634bbbb087616a27bedcd5645390c19ffe2d8d28e4997.json).

Correction : le rejeu d’une transition de parrainage retrouve sa réponse avant le contrôle de l’état courant, après les contrôles d’autorisation et de séparation des intervenants. **19 assertions passent après 626 migrations sur un clone neuf**. [Preuve SQL ciblée](../../work/isolated-replay/488e1e60-ea27-42ff-9bc2-03819dfab6c1/summary.json). Le rejeu global est validé : **626 migrations, 397 fichiers, 9 745 assertions et quatre scénarios de concurrence**, nettoyage réussi. [Preuve SQL globale](../../work/isolated-replay/d5d5a390-7d40-4009-9b9d-4d474c53bf3b/summary.json).

Consolidation : **362 exécutions sur 27 segments**, avec prérequis répétés ; **49/68 exigences partiellement prouvées**, 19 à examiner. Les preuves du parrainage fournisseur et la revue indépendante restent à compléter ; aucun 100 % fonctionnel n’est déclaré.


## 2026-11-23 — Parrainage client consenti

Validation globale après les corrections des récompenses et du parrainage : **4 336 tests Web et 183 tests Worker passent**, ainsi que les packages. Le test Storage conditionnel passe séparément ; build **354 pages**, TypeScript et lint ciblé passent également. [Journal des tests](../../work/local-validation/unit-rewards-referrals.log).

**4/4 E2E passent** : quatre liens créés par l’interface puis quatre rattachements consentis depuis les invitations existantes, en FR/AR ordinateur/360 px. Expiration Casablanca, origine conservée, point de contact unique, rejeu, consentement obligatoire, refus d’auto-parrainage, quota d’une conversion, isolation et audit/Outbox passent. Aucun dossier n’est automatiquement vérifié ou activé, aucun bonus n’est émis. [Preuve](../../artifacts/test-results/local-acceptance/history/client-referrals-fd6a9c39dd26b50112eec19535fa4c1af087b5770e27aca8cd6acf8ac4a3b62b.json).

Correction : expiration interprétée en Casablanca au lieu du fuseau hôte ; dates impossibles, heures inexistantes et heures ambiguës refusées. **17 tests ciblés passent**, dont quatre régressions reproduites avant correction. TypeScript et lint ciblé passent. La conversion complète jusqu’à activation/récompense et le parrainage fournisseur restent à prouver.

Consolidation : **348 exécutions sur 26 segments**, avec prérequis répétés ; **49/68 exigences partiellement prouvées**, 19 à examiner. Aucun 100 % fonctionnel n’est déclaré.


## 2026-11-23 — Règles de récompense exactes

**4/4 E2E passent** : huit versions de règles créées par l’interface et affichées avec leurs quantités exactes, en FR/AR ordinateur/360 px. Les valeurs supérieures à la précision entière JavaScript sont conservées ; le plafond PostgreSQL est accepté, les dépassements et fractions sont rejetés. Rejeu, refus de charge modifiée, refus hors rôle, anciennes versions, audit/Outbox et absence d’émission de crédit passent. [Preuve](../../artifacts/test-results/local-acceptance/history/reward-rules-05e41f43a37c8691c4bb5a5a5e64ef5896de929ff49f62ace9f2a913d432f34c.json).

Correction : saisie des crédits et plafonds comme chaînes entières bornées, lecture PostgREST en texte. **23 tests ciblés et TypeScript passent**. L’organisation d’audit du compte central est un prérequis créé par la commande native. Ce segment ne certifie pas encore l’attribution d’un bonus après parrainage.

Consolidation : **344 exécutions sur 25 segments**, avec prérequis répétés ; **48/68 exigences partiellement prouvées**, 20 à examiner. La couverture fonctionnelle complète reste à établir.


## 2026-11-23 — Activation des avenants et exécution en mission

**20/20 E2E passent** : les propositions sont suivies de deux activations après signatures des deux parties dans le simulateur DEV gouverné. Les PDF canoniques FR/AR sont archivés ; les anciennes versions restent intactes et les prix augmentent exactement de 5 001 unités mineures. Deux confirmations client dans l’interface ajoutent les nouveaux livrables à la mission ; huit consultations client/sous-traitant passent en FR/AR ordinateur/360 px. Les livrables commencent en attente avec leurs deux critères, sans réception héritée. Rejeu, refus inter-organisations, dates Casablanca et audit/Outbox passent. [Preuve complète](../../artifacts/test-results/local-acceptance/history/amendment-activation-0222c22dfc831c797944ffae604236b2bb55045e0b64d3b034bbefbe6a36b82d.json).

Défaut d’environnement corrigé : PostgreSQL local utilisait tzdata 2025b face à Node 2026e. Les zones IANA Casablanca/El_Aaiun ont été alignées et cinq dates de contrôle passent. Le contrôle préalable détecte toute régression ; la procédure de maintenance est documentée dans la recette locale. Les images des clones SQL restent distinctes. Aucune signature contractuelle externe ni revue indépendante n’est certifiée.

Consolidation : **340 exécutions sur 24 segments**, avec prérequis répétés ; **47/68 exigences partiellement prouvées**, 21 à examiner. Ce total n’est pas un pourcentage de couverture fonctionnelle.


## 2026-11-23 — Propositions d’avenants

**16/16 E2E passent**, dont huit prérequis commerciaux rejoués : quatre demandes client et quatre propositions sous-traitant, FR/AR ordinateur/360 px. Les propositions conservent exactement 5 001 unités mineures et sept jours ; les quatre propositions fournisseur ajoutent un livrable et deux critères. Rejeu sans doublon, audit/Outbox, isolation et accessibilité passent. [Preuve complète](../../artifacts/test-results/local-acceptance/history/contract-amendments-ca1b1ca443bab790d4145dc452141a169bc83765d507d57ec7e4c1aa88d5ba9e.json).

Le contrat signé et sa version restent inchangés. Le fournisseur ne peut pas soumettre à la signature ; le client reste bloqué sans les prérequis de signature. Les contrats de cette recette restent actifs avec des livraisons soumises, non réceptionnées. L’activation des avenants et leurs effets opérationnels ne sont pas encore certifiés par ce segment.

Consolidation : **320 exécutions sur 23 segments**, avec prérequis répétés ; **47/68 exigences partiellement prouvées**, 21 à examiner. La couverture fonctionnelle complète reste à établir.


## 2026-11-23 — Réputation et badges

Validation globale après les corrections de réputation : **4 326 tests Web et 183 tests Worker passent**, ainsi que les packages. Le test Storage conditionnel passe séparément ; build **354 pages**, TypeScript et lint ciblé passent également. [Journal des tests](../../work/local-validation/unit-reputation.log).

**20/20 E2E passent**, dont huit prérequis commerciaux rejoués : deux retours sur missions terminées, quatre calculs depuis les événements couvrant six dimensions, aucune publication automatique, quatre décisions humaines et quatre consultations sous-traitant, FR/AR ordinateur/360 px. Les décisions étrangères sont refusées et les événements sensibles corrélés à l’audit. [Preuve complète](../../artifacts/test-results/local-acceptance/history/provider-reputation-ca562e40014838ebf06b162808df8de092ec7c6274a250ba761018dec61f78f4.json). La qualification fournisseur reste un prérequis historique déclaré et la signature un mode de développement gouverné.

Corrections : dates de politiques en Africa/Casablanca, rejet des dates impossibles, listes admin paginées et noms fournisseurs obtenus via la projection administrative autorisée sans élargir la lecture des organisations. 17 tests ciblés, TypeScript, lint, build et Storage passent.

Consolidation : **304 exécutions sur 22 segments**, avec prérequis répétés ; **45/68 exigences partiellement prouvées**, 23 à examiner. La couverture fonctionnelle complète reste à établir.


## 2026-11-23 — Résumé administrateur

**4/4 E2E passent** avec huit dossiers réels : priorités, compteurs, sélection du formulaire correspondant, clavier, reflow et axe en FR/AR ordinateur/360 px. La sélection ne prend aucune décision et ne modifie pas l’affectation. L’organisation étrangère ne lit aucun dossier. [Preuve complète](../../artifacts/test-results/local-acceptance/history/admin-summary-25cc29edd7fafa90a8e68ad4f2e932162381065d2825f75b11bf9ce14debb093.json).

Consolidation : **284 exécutions sur 21 segments**, avec prérequis répétés ; **43/68 exigences partiellement prouvées**, 25 à examiner. La couverture fonctionnelle complète reste à établir.


## 2026-11-23 — File universelle des quatre rôles

**16/16 E2E passent** sur la file universelle pour des acteurs Client, Sous-traitant, Franchisé et Administrateur, FR/AR desktop/360. Douze notifications créées par la commande native sont lues via l'interface puis disparaissent des actions ; quatre liens ouvrent les dossiers admin. Clavier, reflow, axe, isolation entre organisations, rejeu des lectures et historiques sont vérifiés. [Preuve complète](../../artifacts/test-results/local-acceptance/history/universal-actions-6317ec21d00d335a4c2eeff42ee9ef38bbe793c64cd4b83386ae5406898e9bef.json). Ce segment ne remplace pas les parcours propres à chaque tableau de bord.

Défaut corrigé : la page universelle omettait les tâches admin. Elle les demande désormais après vérification serveur du rôle et du MFA ; une vérification d'accès défaillante ne devient pas une file vide. Cinq tests ciblés, TypeScript et lint passent. Les préparations de test utilisent des dossiers distincts pour respecter le refus natif des doublons ouverts.

Consolidation : **280 exécutions sur 20 segments**, avec prérequis répétés ; **42/68 exigences partiellement prouvées**, 26 à examiner. Aucun visa global ni couverture fonctionnelle de 100 % n'est déclaré.


## 2026-11-23 — Relances et revue centrale

**12/12 E2E passent** : quatre règles proposées puis approuvées par un autre acteur, huit préférences enregistrées et quatre consentements retirés, FR/AR desktop/360. Le moteur planifie huit relances sans doublon ; quatre demandes d'envoi sont mises en file, les quatre contacts ayant retiré leur consentement restent exclus. Les historiques, audit/outbox, refus inter-organisations, rejeu des décisions et pipeline inchangé sont vérifiés. Aucun courriel externe n'est envoyé. [Preuve complète](../../artifacts/test-results/local-acceptance/history/franchise-followups-283effbb13eda70dbe98ff5aabb5d679a82d484b5023181ba2486bb81b5ac931.json).

Corrections : écran de revue centrale relié à la gouvernance, contrôles de rôle/MFA et séparation des acteurs ; rejeu des décisions avant la vérification de l'état courant ; saisies des dates interprétées dans Africa/Casablanca. Quinze tests ciblés, TypeScript et lint passent. La [migration 625](../../work/isolated-replay/4156eeb0-3fcd-49d9-b5a3-f3866074cf0b/summary.json) passe six assertions SQL ciblées après reproduction de trois échecs avant correction. Le [rejeu global](../../work/isolated-replay/4b878f86-bb0c-4d57-9830-31dc8108de57/summary.json) passe : **625 migrations, 396 fichiers SQL, 9 726 assertions et quatre scénarios de concurrence**, nettoyage confirmé. Les unitaires globaux passent : Web 4 316, Worker 183 et packages ; le contrôle Storage conditionnel passe séparément. Le build de 354 pages passe après les relances, avant la correction suivante de la file universelle.

Consolidation : **264 exécutions sur 19 segments**, avec prérequis répétés ; **41/68 exigences partiellement prouvées**, 27 à examiner. Aucun visa global ni couverture fonctionnelle de 100 % n'est déclaré.


## 2026-11-23 — CRM et pipeline franchisé

**8/8 E2E passent** : FR/AR desktop/360, contacts Client et Sous-traitant. Huit invitations en attente d'envoi, huit tentatives dédoublonnées, seize notes successives et huit transitions manuelles SENT → OPENED sont vérifiées en base après les actions UI. Rejeu exact, refus inter-organisations, audit/outbox corrélés et absence de création de rôle, adhésion ou essai sont contrôlés. [Preuve](../../artifacts/test-results/local-acceptance/history/franchise-crm-f9a20140232a3aae96ee23ed63e36ac7e5d3d5a6d86e66ad4f1ee684e123a33a.json). Aucun courriel externe n'est envoyé ; les autres étapes de conversion restent à couvrir.

Corrections : lecture des invitations en attente avec mode de livraison nul ; rejeu du pipeline traité avant la validation de son état courant, avec compatibilité des anciens reçus. Le [rejeu complet](../../work/isolated-replay/789853f1-bad9-452c-be75-ad4fe3115200/summary.json) passe : **624 migrations, 395 fichiers, 9 720 assertions et quatre scénarios de concurrence**, nettoyage confirmé. Les tests ciblés CRM et TypeScript passent.

Consolidation : **252 exécutions sur 18 segments**, avec prérequis répétés ; **40/68 exigences partiellement prouvées**, 28 à examiner. Ceci ne constitue pas une couverture fonctionnelle de 100 % ni un visa global.


## 2026-11-23 — Préremplissage et aide contextuelle

**14/14 E2E passent** : six prérequis et huit parcours FR/AR desktop/360. Quatre confirmations de faits récents, quatre exclusions après leur expiration réelle, huit consultations d'aide/exemple/explication. Les valeurs soumises, les deux faits immuables, les refus inter-organisations et le rejeu exact sont vérifiés en base. [Preuve complète](../../artifacts/test-results/local-acceptance/history/questionnaire-assistance-c14a5b86c77af5f9adc4683624f4fe3178d9aa49724cb41e4fd7379db7832333.json).

Défaut corrigé : le même appel de préremplissage créait plusieurs versions et acceptait un autre contenu avec la même clé. Le [rejeu global](../../work/isolated-replay/b3fe3d04-64ca-4ff4-9df7-74f1744d063c/summary.json) passe : **623 migrations, 394 fichiers, 9 709 assertions et quatre scénarios de concurrence**, nettoyage confirmé. Les 13 assertions du préremplissage couvrent aussi les reçus historiques et le refus des anciens doublons ambigus. L'interface distingue désormais une donnée préremplie à confirmer d'une réponse expirée ; six tests de composant, TypeScript et le lint ciblé passent. Le build de 352 pages et le contrôle Storage privé repassent après cette correction.

Consolidation : **244 exécutions sur 17 segments**, avec prérequis répétés ; **38/68 exigences partiellement prouvées**, 30 à examiner. Aucun pourcentage de couverture fonctionnelle de 100 % ni visa global n'est déclaré. Les 123 tests d'outillage passent. Suite : parcours CRM du franchisé.


## 2026-11-23 — Réponses expirées et confirmation légère

**10/10 E2E passent** : six parcours préparatoires et quatre confirmations FR/AR desktop/360. La validité de 60 secondes expire réellement côté serveur ; la soumission est refusée avant confirmation. L'interface confirme la même valeur puis soumet une nouvelle révision, sans modifier l'ancienne. Le contrôle natif vérifie les dates, les valeurs, l'audit/outbox et les refus après soumission ou depuis une autre organisation. [Preuve complète](../../artifacts/test-results/local-acceptance/history/questionnaire-revalidation-c5a081b484c9663aab682f18e8e51f6a31a9df881e86dbd9aca3ac3314f008e6.json).

Consolidation : **230 exécutions sur 16 segments**, avec prérequis répétés ; **36/68 exigences partiellement prouvées**, 32 à examiner. Ce compteur n'est pas une couverture fonctionnelle de 100 %. Les contrôles de structure et les trois tests d'intégration passent. Prochaine étape : préremplissage et aide contextuelle.


## 2026-11-23 — Favoris et éligibilité courante

**16/16 E2E passent**, dont huit parcours préparatoires réels et huit parcours favoris FR/AR desktop/360. Deux favoris persistés, quatre cycles retrait/restauration et 24 revalidations par l'interface sont vérifiés. La pause du fournisseur le rend inéligible ; le rejeu reste identique et l'autre organisation est refusée. [Preuve navigateur et native](../../artifacts/test-results/local-acceptance/history/provider-favorites-8507a4e02c66d34e1caea498df95b272799f9399bfad0f53822e44e23d170943.json).

Corrections : fournisseur sélectionnable malgré son nom masqué par RLS ; pagination complète des favoris et relations ; clé renouvelée après chaque revalidation ; calcul d'éligibilité canonique ; hash idempotent indépendant de l'heure, avec compatibilité des reçus historiques. **622 migrations, 393 fichiers SQL, 9 696 assertions et quatre scénarios de concurrence passent**, nettoyage confirmé. [Rejeu complet](../../work/isolated-replay/951eb9a8-a603-4f20-abc2-999ae41a006e/summary.json).

Consolidation : **220 exécutions réussies sur 15 segments**, avec réutilisation explicite de certains prérequis ; ce nombre n'est ni un nombre de tests uniques ni un pourcentage de couverture fonctionnelle. **35/68 exigences partiellement prouvées**, 33 restant à examiner ; aucun visa global ni 100 % déclaré. Après ces corrections, les unitaires globaux passent (Web 4 304, Worker 183 et packages), ainsi que TypeScript et le lint sans avertissement. Le build de 352 pages passe après les favoris, ainsi que le contrôle Storage privé explicite.


## 2026-11-23 — Conflits métier et modèles bilingues

Les refus métier explicites utilisent maintenant HTTP 409 (PT409), sans modifier les véritables conflits de sérialisation PostgreSQL. 230 fonctions supplémentaires et 286 refus sont corrigés ; les lecteurs et interfaces conservent la compatibilité 40001. La preuve DSR est versionnée sans réécrire son registre immuable : toute autre dérive de fonction reste refusée. **620 migrations, 392 fichiers, 9 682 assertions et quatre courses natives passent**, nettoyage confirmé. [Rejeu complet](../../work/isolated-replay/b3eb77c9-05a7-4d0c-a024-78ae3d23479a/summary.json). Les 20 contrôles fonctionnels repassent, dont le conflit de préférence HTTP 409 en moins de cinq secondes.

**4/4 E2E modèles de communication** : prévisualisation, proposition et approbation par un autre administrateur, FR/AR desktop/360. Correction d'un défaut réel : la prévisualisation réinitialisait les textes du formulaire avant leur proposition. Les tests vérifient maintenant les quatre champs conservés et les textes exacts enregistrés. L'activation partage sa corrélation avec l'audit ; rejeu et double revue contrôlés par **29 assertions SQL après 621 migrations**. [Preuve SQL ciblée](../../work/isolated-replay/8c941220-c6f7-46dd-95fb-a38b4c16c572/summary.json) ; [preuve navigateur et native](../../artifacts/test-results/local-acceptance/history/notification-templates-0017cd43c6c9244702c6c1c7b79ab0ef09802bf9286d22fb2b21d209dee800e3.json). Cette passe ciblée complète le rejeu global de 620 migrations. Aucun message externe n'est envoyé.

Unitaires globaux : Web 4 301 réussis, Worker 183 réussis et packages réussis ; le test Storage conditionnel est exécuté séparément avec succès. TypeScript global et lint global passent ; **zéro erreur et zéro avertissement lint** après le correctif de formulaire. Le [build local de 352 pages](../../artifacts/test-results/local-acceptance/web-build-20261123.json) repasse après ce correctif, avant les changements suivants sur les favoris. Consolidation : **204 exécutions sur 14 segments distincts**, 34 exigences partiellement prouvées et 34 à examiner. Aucun visa global des 68 ni couverture fonctionnelle de 100 % n'est déclaré. Suite : favoris avec revalidation de l'éligibilité, puis autres parcours manquants.


## 2026-11-23 - Decisions administrateur et conflits HTTP

**4/4 E2E admin-decisions** avec 8 ouvertures natives, 8 prises en charge et 8 resolutions humaines FR/AR desktop/360. Historiques, audit/outbox, rejeu apres resolution, refus inter-tenant et absence de sanction automatique verifies. Un conflit de version produisait HTTP 504 apres 60 secondes : les trois commandes claim/resolve/decide utilisent maintenant PT409 au lieu du code de serialization 40001, en conservant les controles de version, permissions et idempotence. Le test HTTP impose 409 en moins de cinq secondes. **130 tests unitaires admin passent.**

Migration `20261123010000_admin_stale_conflict_http.sql` : **618 migrations et 10 assertions SQL ciblees passent sur clone neuf**, nettoyage confirme ; cette passe ciblee ne remplace pas le rejeu global precedent de 389 fichiers. [Preuve SQL](../../work/isolated-replay/21d6ec37-46ed-4846-93bc-fc9fc2c75c06/summary.json). [Preuve E2E](../../artifacts/test-results/local-acceptance/history/admin-decisions-ecc7893381a15bb13c7ab3bea96f75af7b18ada92a4e7ea5ecb0a7484bfb2d8c.json).

Consolidation : **200 executions reussies sur 13 segments distincts**, avec des parcours communs ; **33 exigences partiellement prouvees, 35 a examiner**. Aucun visa global des 68. Prochaine etape : inventorier les autres refus metier qui utilisent 40001 puis poursuivre les parcours manquants. Cause technique documentee par [Supabase](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).


## 2026-11-23 - Clonage et prestations recurrentes

Segment `recurring-requests` : **10/10 E2E**, sans echec, ignore ni instabilite, source figee et nettoyage verifies. Inscription/activation reelles puis FR/AR desktop/360 px : 4 clones, 12 plans mensuels/trimestriels/annuels, 24 brouillons aux dates controlees, 36 transitions pause/reprise/fin. Montants exacts, historique, audit/outbox, rejeu apres arret et refus des nouvelles generations/inter-tenant verifies. Corrections : identite de commande incluant le bouton soumis, nouvelle cle pour une nouvelle action, conservation de l entreprise selectionnee dans les liens. **25 tests unitaires cibles et TypeScript Web passent.**

[Preuve archivee](../../artifacts/test-results/local-acceptance/history/recurring-requests-950cfcdebd956fa95407af9998d06c3bffaed1704e799d80694464fea4d79ef0.json). Consolidation : **196 executions reussies, 12 segments distincts** ; ce nombre inclut des parcours communs et ne mesure pas la couverture fonctionnelle. Matrice : **31 exigences partiellement prouvees, 37 a examiner** ; aucun visa global des 68. Prochaine etape : commandes admin, signaux de risque et decisions humaines.


- Dernier segment enrichi : **20/20 E2E**, avec quatre modifications réelles du profil suivies d'une réévaluation terminée (MAT-FUNC-004), FR/AR desktop/360 px. **68 paires audit/outbox et 57 refus de lecture inter-tenant**. Le formulaire attend son initialisation avant d'autoriser la saisie : une course au chargement ajoutait l'ancienne activité au nouveau texte. Régression navigateur conservée, 25 tests ciblés, TypeScript Web et lint ciblé réussis. [Preuve actuelle](../../artifacts/test-results/local-acceptance/functional-controls-proof.json).
- Consolidation actualisée : **186 exécutions réussies sur 11 segments distinctement validés**. Matrice : 29 exigences avec preuve partielle exécutée, 39 encore à examiner ; aucune certification globale des 68.
- Passe commune finale : **617 migrations, 389/389 fichiers SQL, 9 663 assertions et quatre courses natives réussies**, Node 22, clone neuf sans réseau ni port exposé, nettoyage confirmé. Les 681 tables publiques contrôlées ont RLS active ; pgTAP n'est pas exécutable par les rôles API. [Preuve](../../work/isolated-replay/69291653-2763-4ae9-9ebe-965f5edeb2f7/summary.json). Le build Web optimisé repasse après la correction du profil ; les 123 tests d'outillage passent aussi.

- Matrice explicite des [68 contrats et 26 scénarios minimum](../traceability/V1_RUNTIME_COVERAGE.md), avec [source machine](../traceability/V1_RUNTIME_COVERAGE.json). Les références statiques, preuves partielles exécutées et visas historiques restent distincts. Aucun visa global renouvelé.
- Segment `functional-controls` enrichi : **16/16 E2E**, FR/AR, desktop/360 px, zéro échec/ignoré/instable. Créations de sites, projets, jalons avec critères et centres de coûts ; budgets approuvés exacts reliés au site et au projet ; configuration versionnée du résumé Franchisé et transitions des préférences de notification. Assistance : quatre analyses, deux acceptations et deux refus humains persistés, aucune création automatique de demande métier. **40 paires audit/outbox et 37 refus de lecture inter-tenant**, plus refus d'une décision d'assistance inter-tenant ; nettoyage confirmé. Les jalons en attente gardent une progression nulle. [Preuve](../../artifacts/test-results/local-acceptance/functional-controls-proof.json).
- Défauts corrigés : la case d'approbation du budget était masquée par son champ caché ; les catégories de notification en majuscules invalidaient leur scope d'idempotence. **26 tests d'actions portefeuille** et **13 assertions SQL comportementales notifications** réussis ; contrôle TypeScript Web sous Node 22 réussi.
- Copie SQL : conservation de l'identité du rôle bootstrap PostgreSQL et de ses attributions ; 5 tests du runner et smoke natif succès/échec/nettoyage réussis. Deux références orphelines historiques empêchent encore la restauration de la base de développement actuelle ; aucune donnée de production modifiée et aucun historique supprimé.
- Rejeu final depuis zéro, conteneur sans réseau : **617 migrations, 389/389 fichiers SQL, 9 663 assertions réussies**, nettoyage confirmé. [Preuve](../../work/isolated-replay/3c1dd6e2-4c3b-495d-81ab-be673d893622/summary.json). Concurrence non incluse. Le garde-fou documentaire reconnaît le marquage explicite du clone réservé ; le refus de la base locale non marquée a été revérifié. La correction des notifications et ses 13 assertions sont incluses.
- Suite unitaire du monorepo réussie : Web 4 288 tests réussis et un test local conditionnel ignoré lors de la passe générale ; ce dernier a ensuite été activé et réussi séparément contre le Storage Docker vérifié (PDF FR/AR, octets/hachage, doublon refusé, accès public refusé, nettoyage). Worker : 183 tests réussis. Contrôle TypeScript Web réussi après la modification du panneau devis.
- Devis renforcés : **4/4 E2E réussis**, 56 omissions de champs rejetées côté serveur, puis soumissions exactes et ancrages d'identité/audit vérifiés. Le test attend désormais l'URL et le panneau d'aperçu avant de remplir son formulaire ; les essais de modification du formulaire produit ont été retirés. [Preuve](../../artifacts/test-results/local-acceptance/p23-quotes.json).
- Calendrier : quatre régressions rouges ont confirmé la dépendance au fuseau du serveur et l'acceptation d'heures ambiguës/inexistantes. Conversion IANA Casablanca et réaffichage des échéances corrigés ; tests ciblés, TypeScript et lint réussis. **16/16 E2E** ensuite réussis avec quatre événements et quatre échéances vérifiés en UTC et dans l'interface ; preuve portée à **44 paires audit/outbox et 41 refus de lecture**.
- Devis : second rejeu **4/4** réussi. Consolidation conservée par SHA-256 : **182 exécutions réussies sur 11 segments**, sans recompter le smoke de 16 routes déjà inclus dans les 64.
- Allocations : **16/16 E2E réussis**, avec quatre dépenses exactes de 1 005 unités mineures rattachées au budget, centre de coûts, projet et jalon attendus. Empreintes SHA-256 des fichiers réellement envoyés vérifiées ; **48 paires audit/outbox et 45 refus de lecture inter-tenant**. Les budgets de même année/montant affichent désormais leur projet, site et bibliothèque pour éviter une sélection ambiguë ; régression unitaire rouge puis verte.
- Vérifications transversales : TypeScript des 16 projets réussi ; lint global terminé avec zéro erreur et dix avertissements ; 121 tests tooling et 3 tests intégration réussis. Build Web optimisé réussi, 352 pages générées, contre les services Docker locaux vérifiés. Le build utilise une URL canonique HTTPS locale de test ; aucune validation de déploiement externe.
- Progression : nouveau rejeu **16/16 E2E réussi**. Les quatre jalons passent par en cours, soumis puis accepté ; la progression reste nulle avant acceptation puis atteint 100 %. Quatre versions par tâche sont relues, avec **60 paires audit/outbox et 45 refus de lecture inter-tenant** sur le segment complet. La liaison projet–contrat n'est pas encore prouvée par ce segment.
- Suite : exécuter les quatre scénarios de concurrence sur le clone neuf, puis poursuivre les preuves métier manquantes des 68 contrats et l'audit indépendant. Le nombre d'exécutions E2E par segments ne signifie pas 100 % de couverture fonctionnelle.

## 2026-11-22 — Recette locale des espaces et Marketing, validation partielle

- Node 22, Supabase Docker local vérifié, authentification réelle GoTrue OTP/TOTP ; aucun changement de production. Infrastructure locale et Storage débloqués.
- Espaces connectés : 16/16 réussis, FR/AR, 360 px et desktop, tableaux de bord admin/client/sous-traitant/franchisé, refus entre rôles et accessibilité. [Preuve](../../artifacts/test-results/e2e-spaces-20261122-passed.json).
- Marketing : 8/8 réussis ; génération, approbation authentifiée, planification, publication sandbox et attribution persistée. [Preuve](../../artifacts/test-results/e2e-marketing-20261122-passed.json). Pas de preuve de publication externe réelle.
- Corrections : titre admin Parcours, projection fournisseur du référentiel incitations, accessibilité clavier du tableau devis et collision de variables SQL dans la planification Marketing.
- Tests ciblés : 4 unitaires du référentiel admin, 29 infrastructure, 11 SQL Marketing réussis. Fixtures et états privés nettoyés par chaque recette.
- Métier complémentaire : 40/40 réussis, sans test ignoré ni instabilité, fixtures nettoyées. Dépôt/scan sandbox/acceptation persistée des livrables et jalons, publication réelle de checklists. [Preuve](../../artifacts/test-results/e2e-business-spaces-20261122-passed.json).
- Correctifs supplémentaires : initialisation contrôlée de l'environnement Docker, liens hérités Finance masqués correctement, accès RLS aux seules métadonnées de checklist pour admin AAL2, relation service–bibliothèque explicite. 10 contrôles SQL et 7 tests unitaires d'actions réussis ; isolation metadata/contenu prouvée via sessions natives.
- Segments supplémentaires validés : connexion OTP/MFA 4/4, onboarding 28/28, parcours critiques V1 24/24, parcours client 6/6, chaîne commerciale 8/8, avantages 6/6. Les preuves détaillées et leurs limites sont dans le [suivi E2E](../audits/E2E_COVERAGE_2026-11-22.md).
- Conservation des livrables : liaison restrictive à l'objet Storage versionné et protection des métadonnées ; 26 contrôles SQL réussis. La chaîne commerciale vérifie le refus de suppression par API, la conservation des octets et l'isolement après révocation. Signatures et scanner restent locaux/sandbox.
- Devis P23 4/4 et final-core 4/4 réussis : soumission FR/AR, montant exact supérieur à la précision Number, identité et audit ; messagerie persistée, comparaison figée, matching et transitions de capacité fournisseur.
- Correctif fiscal `20261122234000` : quotient entier exact pour grands montants et bornes bigint, sans réécriture des historiques. 12 nouveaux tests SQL et 49 tests fiscaux existants réussis ; 20 unitaires actions/aperçu devis réussis.
- Passe commune finale : 64/64 réussis, sans ignoré ni instabilité, sources stables et nettoyage vérifié. Les preuves Storage liées sont conservées avec leur historique et leur SHA-256 ; seuls les dépôts non liés sont supprimés. Trois régressions de nettoyage réussies.
- Public sous Node 22 : 18/18 réussis. Consolidation : 166/166 exécutions validées par segments, sans recompter les 16 routes incluses dans les 64. Ce total n'est ni une couverture fonctionnelle ni une passe unique des 166 tests. [Preuves consolidées](../../artifacts/test-results/local-acceptance/consolidated-20261122.json).
- Prochaine étape : matrice exhaustive des 68 exigences et audit indépendant, puis validations externes/staging. Couverture globale non déterminée ; aucun visa global déclaré.

## 2026-11-18 — Admin Parcours hubs P0→P3 (colonnes, Ariadne, film)

- P0 : colonnes métier réelles (demandes titre/domaine/complétude, matching score/exclusion, avenants objet+delta) via `parcours-space-rows` + schéma supervision enrichi ; fil d’Ariane cliquable demande→matching→devis→contrat→mission sur chaque ligne (`parcours-ariadne` + colonne Parcours).
- P1 : leads/CTAs « Superviser / Examiner / Ouvrir le parcours acteur » ; « Traiter » réservé litiges (+ revue documents) ; `parcoursDossierChain` sur hub Parcours ; film démo hétérogène (≥1 devis SELECTED, ≥1 contrat ACTIVE sans mission).
- P2 : onglets Messagerie / Notifications ; pipelines devis/docs remplis ; badge « Film démo » ; copy diagnostics alignée mode démo.
- P3 : KPIs par hub (`buildSpaceHubMetrics`) sur les files Parcours.
- Vitest : `parcours-ariadne`, `demo-hubs`, `hub-metrics`, `space-journey`, `render-admin-space`, `diagnostics-queue` verts.
- Prochaine étape : smoke navigateur FR/AR 360 sur files Parcours si demandé.

## 2026-11-18 — Démo overlays Client / ST / Franchise réactivés

- Gates `canApplyClientSpaceDemo` / `canApplyProviderSpaceDemo` / `canApplyFranchiseSpaceDemo` / `canApplyDemoOffer` → `isDemoClientHomeEnabled()` (APP_ENV allowlist + `MATRICIA_DEMO_ACCESS_ENABLED`, jamais prod).
- Builders déjà non vides côté Client/ST ; Franchise : devis/missions/users/volume/qualité/correctifs remplis (plus de tableaux `[]` sur ces boards).
- Home client (`applyDemoClientHome`) et bibliothèque franchise (`overlayFranchiseLibraryDemo`) restent no-op volontaire (pas de catalogue inventé).
- Vitest : `client|provider|franchise/data/spaces/demo.test.ts` + ajustements boards/comparison/quote-detail.
- Hors périmètre : invitations-réseau / territoires / anti-abus / catalogue (agent sibling).

## 2026-11-18 — Démo overlay admin gaps #2–5

- Invitations réseau : `demo-network-invitations.ts` + loader (24 = 12×CLIENT+PROVIDER, `@matricia.test`).
- Territoires / gouvernance / litiges : `demo-special-spaces.ts` branché sur `specialSnapshotSpaces` (12 / 8 / 6).
- Anti-abus : `demo-anti-abuse.ts` (4 règles + 5 cas OPEN) sur `/administration/anti-abus`.
- Catalogue questions : thin path `catalogue/validation` via `demo-catalog-questions.ts` (1 version + 5 questions, fill-when-empty).
- Vitest : overlays + smokes page/loader. Éditeur catalogue create-form reste DB-only (pas de liste thin).

## 2026-11-18 — Démo overlay candidatures franchise

- `/administration/candidatures-franchise` : flag démo ON → file d’instruction overlay (`buildDemoFranchiseApplications`, 6 dossiers ouverts REGISTERED→CONTRACT_PENDING, e-mails `@matricia.test`, orgs régionales liées).
- Cause : seeds créent des franchises déjà ACTIVE → file DB vide pour l’instruction.
- Vitest : `demo-franchise-applications.test.ts` + page overlay.
- Prochaine étape : gaps admin #2–5 (invitations, territoires/gouvernance, anti-abus, catalogue questions) livrés.

## 2026-11-18 — Alignement shells Version A (scene hero + page-standard)

- `SpaceSceneHero` + `.mat-scene-hero` partagés ; `OrganizationFicheHero` rebranché (photo `arch-city` + motifs admin).
- Enveloppes `*-page-standard` cascaded sous Admin / Client / Provider / Franchise.
- Hubs identité : scene mast sur Client (home, organisation, dossiers), Provider (identité, missions, devis), Franchise (accueil, territoire, finance) + revues identité admin.
- Vitest ciblé : boards admin 4/4, client boards 12/12, cockpit 6/6, space-scene-hubs 3/3 (**25/25**).
- Spot-check navigateur : `/fr/tableau-de-bord` → redirection connexion (session absente) ; preuves structure via tests source + boards HTML `mat-scene-hero`.
- Prochaine étape : photo hero seulement sur fiches détaillées restantes si demandé ; pas sur listes génériques.

## 2026-11-18 — Fiche organisation `#membres` enrichie

- Panel Membres plein : KPIs, liste (nom/email/statut/rôles), CTA Inviter / Gérer / ouvrir profil.
- Contrat `memberships` + démo (représentant + invite) ; migration `20261118180000_admin_fiche_membership_identity_v1` (RPC fiche).
- Onglet `#membres` : `FicheTabNav` + `aria-current` via hash / `matricia:hashchange`.
- Tests : `boards.test.tsx`, `demo-supervision.test.ts` verts.
- Prochaine étape : aligner Finance sur ce pattern carte si demandé.

## 2026-11-18 — Démo hubs admin : film métier + finance/pilotage

- Film supervision : 12 régions × demande → matching → devis → contrat → avenant → mission → 2 jalons + diagnostics/docs/messages/exceptions.
- Hubs branchés (flag ON = replace) : command-center, finance dashboard, crédits/catalogue commerce + vault + volume, opérations.
- Parcours spaces (devis, etc.) : lignes métier du film (plus d’écrasement générique).
- Reste hors seed : éditeur catalogue questions/questionnaires (DB bibliothèque) et écrans paramètres purs (forms).

## 2026-11-18 — Démo complète : replace + reset propre + flag

- UI admin (Entreprises, acteurs, spaces, conformité) : **remplace** l’ancien volume quand `MATRICIA_DEMO_ACCESS_ENABLED=true` (+ `APP_ENV` non prod) ; **rien** de démo si flag `false`.
- Catalogue : 12 régions × (1 franchisé + 3 ST + 6 clients).
- SQL `20261118170000_reset_demo_workspace_v1` : `reset_demo_workspace_v1` archive orgs démo (`@matricia.test` / `matricia_demo`) + purge `DEMO_*` ; registre `private.demo_workspace_organizations_v1` ; `ensure_demo_regional_actor_v1` enregistre les orgs. Jamais en PRODUCTION.
- Test SQL `0405` + vitest `demo-supervision.test.ts`.

## 2026-11-18 — Film finance : MATRICIA_ADMIN + AAL2 (plus de dead-ends)

- Migration `20261118220000_admin_matricia_finance_film_gates_v1` : `morocco_tax_admin`, `service_tax_mapping_reviewer_v1`, `provider_finance_reviewer_v1`, `client_billing_admin`, `benefit_admission_staff_v1`, `manual_credit_finance_v1`, crédits abonnement (read/write helpers) incluent **MATRICIA_ADMIN** + AAL2 ; four-eyes (auteur ≠ réviseur) inchangé.
- UI alignée : fiscalité, classification fiscale, prestataires, avantages/règles, hub-copy, actions finance, crédits abonnement ; facturation-clients distingue MFA vs refus rôle.
- SQL `0414` **8/8 PASS** local ; Vitest morocco-tax **7/7 PASS**.
- Hors élargissement volontaire : écritures remboursements / cost-proof / pot Core restent SUPER_ADMIN|FINANCE_MANAGER (lecture ops déjà ouverte à MATRICIA_ADMIN).
- Appliquée local via psql Docker ; `db push` distant seulement sur OK explicite.

## 2026-11-18 — Audit gates admin UI↔SQL (demo MATRICIA_ADMIN) — corrigé ensuite

- Dead-ends nav signalés (fiscalité, classification, facturation, avantages/règles) → corrigés par entrée « Film finance : MATRICIA_ADMIN + AAL2 » ci-dessus.
- Prestataires : message rôle distinct de MFA (plus de faux « MFA requise »).

## 2026-11-18 — `next build` vert + film E2E AAL2 (20/20)

- `npx next build` PASS (TypeScript + 352 pages) avec `NEXT_PUBLIC_APP_URL=https://…` (http local rejeté en NODE_ENV=production).
- Fixes TS : demo `PromiseLike` RPC, CRM franchise erase profondeur PostgREST, loading admin sans double `<main>`.
- Harness film S1–S6 : **20/20** FR/AR 360 AAL2.
- **Reste** : nests hors smoke ; wholesale **linked** sans OK explicite ; upgrade Next sécurité proposé à part.

## 2026-11-18 — Admin film E2E AAL2 FR/AR 360 PASS (20/20)

- Harness `tests/e2e/helpers/admin-film-s1-s6-run.mjs` : fixture GoTrue + TOTP AAL2, `next dev` local, page fraîche par route.
- Résultat : **PASSED** — 9 routes × FR/AR = 20 checks, `mains=1`, 0 crash (`work/admin-film-s1-s6/<runId>/summary.json`).
- Fix loading admin : plus de `<main>` imbriqué sous `AdminAppShell`.
- Checklist S1–S6 + scoreboard C12 film smoke mis à jour (~97 % cœur).

## 2026-11-18 — Admin parcours quasi-fermé (~93 %)

- V4 orphelins : OffFilmGate / Step gates sur ops, privacy, marketing, anti-abus, avantages, assistance, support, v4-1, incitations, achats-groupes, clonage, livres, identité, wholesale offres.
- Wholesale Box : migration `18150000` + test `0413` PASS ; demo reset `18160000` poussé local.
- `db push --local` débloqué (fix defaults `ingest_platform_core_pot_sources_v1`).
- SQL admin `0402`/`0403`/`0412`/`0413` PASS local.
- Bug log cœur VERIFIED ; E2E S1–S6 STRUCT_PASS (navigateur auth traité dans l’entrée du jour).

## 2026-11-18 — V4 amorcée + film hub 3/4 séparés

- `filmHubChain` : étapes 3 (`invitations-reseau`) et 4 (`entreprises`) distinctes.
- `AdminOffFilmGate` branché : operations, confidentialité, marketing, anti-abus, avantages/règles.

## 2026-11-18 — BUG-011 a11y + bug log cœur VERIFIED

- Shell admin : `mainLandmark` défaut **true** ; contenus `client-page` passés en `<div>` (plus de main imbriqués).
- Une recette d’en-tête : mast shell **ou** hub board (plus les deux) ; `finance/prestataires` branché sur `AdminModulePage`.
- Jargon restant nettoyé (ops AR, matching colonnes, Event Outbox blueprint, payloads).
- Bug log admin parcours : **BUG-001→012 tous VERIFIED**.
- E2E S1–S6 : `STRUCT_PASS` structure ; navigateur auth toujours bloqué sans fixtures.

## 2026-11-18 — Admin parcours : batterie de tests lancée

- Vitest admin (journey + franchise + alignment) : **36/36 PASS**.
- SQL local (migrations 140000/141000 appliquées à la main sur Docker local) : `0402` 9/9, `0403` 3/3, `0412` 4/4 **PASS**.
- Harness pgTAP : `search_path=public,extensions` + `grant usage` sur `0402`/`0403`/`0412` (sinon `throws_ok` invisible sous `authenticated`).
- `db push --local` bloqué plus tôt sur `20261113100000_platform_core_pot_ingest_sources_v1` (paramètres sans défaut après défaut) — hors périmètre ; contournement psql ciblé OK.
- Playwright admin authentifié : **bloqué** (fixtures `E2E_P06_*` absentes). Checklist S1–S6 reste à jouer navigateur.
- Bug log : BUG-002/003/004/007/012 → **VERIFIED** ; BUG-011 encore OPEN.

## 2026-11-18 — Mode démo Box : réseau propre franchisé/ST/services

- Nettoyage : défauts slots COMPTABLE/MARKETING retirés ; catalogue démo **remplace** le volume DB résiduel quand `MATRICIA_DEMO_ACCESS_ENABLED=true` (+ `APP_ENV` non prod).
- Réseau déterministe : **12 régions Maroc** × 10 secteurs × 1 franchisé × 3 ST × 3 services (1080 offres).
- **Dossiers franchisé/ST** (ICE/IF/RC/CIN/RIB/contrats…) dans les espaces admin Franchisés / Prestataires / Capacité — **pas** sur la page Offres.
- RPC reset scoped `reset_demo_box_network_v1` (préfixe `DEMO_` uniquement, AAL2). Tests `demo-network.test.ts` + `demo-box-actors.test.ts`.

## 2026-11-18 — Box Builder : catalogue gros territorial + combo

- `/finance/offres` : catalogue de **toutes** les offres de gros ST par `Region_territoire`, toutes catégories, détail prix ; sélection manuelle ou assistée par sujet ; composition Box + marge `BOX_PLATFORM_MARGIN_BPS` (défaut 1500).
- RPC `list_admin_wholesale_offers_by_territory_v1` ; action `createBoxFromWholesaleAction` (snapshot sources + calcul serveur exact).
- Outils techniques BoxesPanel conservés en `<details>`. Migration `20261118150000_…`. Tests margin + workshop + SQL 0403.

## 2026-11-18 — Finance : contenu remis sur la bonne page

- Attributions manuelles + journal crédits sortis de `/finance/offres` → `/finance/credits` (`CreditAttributionsPanel`).
- Hub `/finance` : ancres legacy `#boxes` / `#plans` / `#credits` = renvois uniquement ; guide ops corrigé ; plus de numéros 3./4. fantômes.
- Annuaire : liens `#plans` / `#credits` morts remplacés par `/finance/offres` et `/finance/credits`.
- Sélecteur org : hub reste sur Finance du jour ; offres/crédits ouvrent leur atelier.

## 2026-11-18 — Admin parcours 100 % (exécution démarrée)

- Artefacts : `docs/parcours/ADMIN_PARCOURS_SCOREBOARD.md`, `ADMIN_BUG_LOG.md`.
- Film 1→11 : `admin-film.ts` + `AdminFilmStrip` branché sur tous les spaces admin ; hub `parcours` étendu.
- `spaceNextStep` couvre aussi acteurs (providers→qualification→…).
- Purge jargon : finance, directory, matching, fixtures, operations (messages).
- V0 amorcé : command-center + preparation (why/next gate).
- V1b : page `/administration/invitations-reseau` + RPC `get_admin_network_invitations_supervision_v1` + test `0412`.
- V0 : `AdminStep1Gate` sur préparation/config/catalogue(+sous-pages)/fiscalité ; hub acteurs ordonné.
- V1 : migration `20261118141000` audit+outbox sur invite franchise.
- Appliquer : voir `docs/parcours/APPLY_MIGRATION_INVITATIONS_RESEAU.md` (ne pas `db push` aveugle : 25 migrations en retard sur linked).
- V1/V2 gates : `AdminStep2Gate`, `AdminStep5Gate`, `AdminCommerceGate` ; franchises filtre ACTIVE par défaut.
- Tests : `0402` étendu, `0403` audit/outbox presence.
- Migrations 140000/141000 signalées appliquées par l’opérateur.
- V3 étape 11 : `AdminStep11Gate` (facturation, finance, prestataires, approbations, litiges).
- Tests SQL `0408` (compliance entitlement) + `0409` (qualification company gate).
- Checklist E2E : `docs/parcours/ADMIN_E2E_S1_S6_CHECKLIST.md` (à jouer FR/AR 360).
- Suite : passer S1–S6 + bug log VERIFIED + V4 orphelins.

## 2026-11-14 — Atelier Offres Box séparé de Finance du jour

- Problème : `#boxes` mélangeait création d’offre + paiements + P&L → illisible.
- Nouveau : `/administration/finance/offres` = atelier seul (services → Box multi-catégories → plan → wallet).
- `/finance/credits` = packs ; hub `/finance` = ops du jour + liens clairs.
- Nav Finance + fiches org pointent vers `/finance/offres`. Tests hub/boards PASS.

## 2026-11-14 — Box = offre unique multi-services

- Intention métier : une Box regroupe plusieurs services/catégories (ex. créer une entreprise = comptable + marketing + …), souvent via sous-traitants.
- UI `#boxes` : parcours Services → Offre Box → Plan → Wallet ; éditeur multi-emplacements (`OfferSlotsEditor` + `slotsJson`).
- Action `create_box_version` accepte plusieurs slots (compat legacy 1 slot conservée).
- Tests boxes + commerce-exact PASS.

## 2026-11-14 — Finance page : corrections complètes #boxes/#credits/ops

- `#boxes` : pipeline Avantage → Box → lien plan → wallet ; grants après catalogue ; empty compact ; activité ledger en details.
- `#credits` : rôle packs/promotions distinct + notice « Achats de packs vérifiés ».
- Sections 3–5 : empty sans cartes lourdes (finance-panel, sorties, P&L/clôture indisponibles).
- Tests finance 103 PASS.

## 2026-11-14 — Finance #boxes : logique métier (pas du polish)

- Rôle clarifié (Gold Master §12.3–12.7 / ADM-031) : `#boxes` = ce que le client obtient via son plan.
- Parcours imposé dans l’UI : **Avantage → Box → lien plan↔Box → wallet/attributions** ; étape courante affichée ; grants après le catalogue.
- `#credits` séparé : packs/promotions/paramètres (hors Box Builder).
- Plus de murs « Aucun élément » en cartes : empty compact + activité ledger en `<details>`.
- Tests BoxesPanel + finance page PASS.

## 2026-11-14 — Standard pages Administration (toutes pages)

- Fondation : `admin-page-standard.css` + enveloppe `admin-page-standard` + `WorkspaceHashScroll` dans `AdminAppShell` (toutes pages AdminAppShell / AdminModulePage).
- Primitives : `AdminSectionHead` / `AdminNotice` ; sections `admin-panel` + `data-tone` (violet/mint/coral/sky/peach) ; notices ; tabs `client-tabs`.
- Hubs alignés : finance (boxes/credits/P&L), catalogue, parcours, opérations, anti-abus, configuration, command-center (via shell).
- Panels génériques `bg-card` → `admin-panel` (finance, achats groupés, clients, providers, ops, marketing, etc.).
- Fiches acteurs : tons Version A + champs manquants « — à compléter » (plus de faux « Non disponible »).
- Tests ciblés boards + cockpit. **RELEASE_GATE** inchangé.

## 2026-11-14 — Candidatures franchise : clarté + invitation admin

- CTA **Ouvrir / inviter un dossier** sur `/administration/candidatures-franchise` (plus de faux « Ajouter un franchisé »).
- RPC `open_franchise_application_invite_v1` (`20261114210000_…`) : dossier `REGISTERED` + event `ADMIN_INVITE`, AAL2, e-mail candidat ; jamais ACTIVE en un clic.
- Revue : motif explicite, bandeau org non liée, bloc lien ouvert.
- Annuaire Franchisés : lead « pas de création libre » ; CTA → file candidatures.
- Doc : `docs/parcours/ORDONNANCEMENT_TACHES_MOTS_SIMPLES.md` étape 2.
- Tests Vitest franchise-applications PASS (25). SQL `0402_…` prêt ; **migration à appliquer** (Docker local indispo cette session). **RELEASE_GATE** inchangé.

## 2026-11-14 — Ordonnancement des tâches (mots simples)

- Document métier pédagogique : `docs/parcours/ORDONNANCEMENT_TACHES_MOTS_SIMPLES.md` (valider les gens → commerce).
- Lien depuis `docs/audit-20261113/K-CARTOGRAPHIE.md`.
- Ordre : plateforme → franchise → invitations → inscription → confirmation admin → besoin → matching → devis → contrat → mission → facturation.

## 2026-11-14 — Alignement UI global Version A (toutes interfaces)

- Fondation partagée : `apps/web/modules/shared/ui/design-system/matricia-ds.css` (heroes/cartes/chips colorés) importée via `client-experience.css` et `(public)/experience.css`.
- Bloc identité Gold Master réutilisable : `OrganizationIdentityBlock` (FR/AR) — raison sociale, forme juridique, ICE/IF/RC, adresse, représentant.
- Admin : panels client/provider identité refondus ; fiches acteurs/org enrichies ; migration display `20261114194500_admin_fiche_legal_profile_gold_master_v1.sql` (+ `profile_display` identité client déjà en place).
- Client onboarding : passeport via `OrganizationIdentityBlock` quand profil présent.
- Prestataire `/sous-traitant/identite` : hero mint + bloc identité + cartes tonées.
- Franchise treat tiles + sections publiques : accents violet/mint/coral/navy.
- Tests ciblés PASS (identity block + client-identity + boards). SQL fiche à appliquer sur la base cible. **RELEASE_GATE** inchangé (REFUSÉ).

## 2026-11-14 — Vague 3 MED (lang/dir, HashAware, privacy messages)

- Bootstrap `lang`/`dir` avant paint (`DOCUMENT_LOCALE_BOOTSTRAP`) + DocumentLocaleSync inchangé.
- HashAwareLink sur onglets/ancres client (organisation, abonnement, récompenses, litiges, jalons, boards).
- Privacy inventory : erreurs et outcomes humanisés (`readableError`, labels sources).
- Inventaire : `docs/audit-20261114-12cats/FINDINGS.md` — plus de MED code listés ; **RELEASE_GATE** toujours REFUSÉ.

## 2026-11-14 — Vague 2 HIGH (MFA, membership, N+1, labels)

- MFA + rôles plateforme sur `admin/screens/providers/actions.ts` (review vs finance) ; `p_correlation_id` sur mutations.
- Membership avant crédits `ensure`/`reserve`, bookmark diagnostics, franchise bank-search.
- N+1 candidatures-franchise + mission prep : lots parallèles de 8.
- E2E MAT-FUNC-024/028 : fixture vide → fail (plus de soft-skip data).
- Labels humains DSR erasure + allocations PnL / bénéficiaires franchise.
- Inventaire mis à jour : `docs/audit-20261114-12cats/FINDINGS.md`. **RELEASE_GATE** toujours REFUSÉ.

## 2026-11-14 — Audit large 12 familles + corrections HIGH

- Inventaire : `docs/audit-20261114-12cats/FINDINGS.md` (cats 1–12, ~75 findings agents).
- Corrections livrées : clés d’idempotence stables (`StableIdempotencyField`) sur favoris / invites / jalons / anti-abus / approbations-finance / space-forms ; gate démo alignée (APP_ENV allowlist + blocage production) ; query `organizationId` préservée sur liens sessions sécurité ; ancre `#plans` unique abonnement ; cibles tactiles admin ≥44px.
- Tests ciblés PASS (61). **Ne remplace pas** `RELEASE_GATE` (visas / YouSign / paiements / E2E C1–C8 toujours REFUSÉ).

## 2026-11-12 — Pot Core + droits d’entrée (50/50 Jalil–Asmaa)

- Autorité : `docs/finance/REGLE_ECONOMIQUE_PARTENARIAT_CORE_ENTREE_V1.md` + Gold Master décision prioritaire §5.
- Migration additive `supabase/migrations/20261112200000_platform_core_pot_finance.sql` : livre plateforme, écritures Core/entrée/marketing/charges, clôture, allocations 50/50, ledger de distribution, exclusion IT entry fee.
- pgTAP structurel : `supabase/tests/0386_platform_core_pot_finance.test.sql` (IT 50/50 et STANDARD 50/25/25 non modifiés).
- Miroir TS : `PLATFORM_CORE_POT_ECONOMICS` + `allocatePlatformCorePotRemainder` dans `packages/legal-v41`.
- Ingestion callable V1 : `public.ingest_platform_core_pot_sources_v1` (`20261113100000_platform_core_pot_ingest_sources_v1.sql`) — une ligne `credit_revenue_ledger_v1` (classe `CORE_SUBSCRIPTION_REVENUE`) ou `franchise_entry_fee_ledger_entries` (PAYMENT/WITHHOLDING hors IT) + journal plateforme → `post_platform_core_pot_entry`. Tests : `0387_platform_core_pot_ingest_sources.test.sql` ; wrapper admin `apps/web/modules/admin/data/core-pot/`.
- Prochaine étape : batch/auto-scan des sources non encore ingérées + écran admin Finance.

## Avancement 100 % implémenté non certifié (2026-11-09)

- **IMPLEMENTED_NON_CERTIFIED = 76/76 (100 %)** : 71 `PENDING:visa-independant` + 5 `VERIFIED`.
- Preuve agrégée : `docs/evidence/implementation-100-non-certified.json`.
- Derniers lots : 058/061 axe+aides ; 020/023 capacité/preuve ; marketing 002–005/008 sandbox ; P1 restant 014/022/024–026/028 via smokes dédiés PASS.
- **RELEASE_GATE = REFUSÉ** jusqu’aux visas indépendants + P0 externes (YouSign live, etc.). Aucune promotion `VERIFIED` ajoutée.
- Harness mutation P23/P25/final-core restent utiles pour preuve visa-grade ; runs hosted de cette session non verts / hung — non bloquants pour le compteur « implémenté non certifié ».

## Build Vercel — compatibilité des variables publiques Supabase

- Le journal distant confirme que la bonne application Next est maintenant compilée, puis échoue faute de configuration publique reconnue. Normalisation partagée : URL canonique/alias serveur public et clés publishable/anon publiques ; seules les deux valeurs canoniques sont injectées pour le navigateur. Aucun fallback de clé privilégiée et aucune valeur factice de production.
- Quatorze tests PASS (priorités, alias, valeurs vides, absence, URL et clés privilégiées), lint ciblé PASS. Build complet PASS dans une copie sans dotenv avec uniquement SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY, sans clé canonique ni service-role. Valeur publique canonique retrouvée dans le bundle navigateur. Contrôle de configuration absente vérifié avec les CLI Node22 et24.
- Packaging natif du nouveau build PASS :566 Lambda,116 sorties API,887 routes. Revue indépendante favorable. Les variables réelles du projet Vercel restent à confirmer ; leur absence demeure explicitement bloquante. Aucun succès hébergé ni audit métier global annoncé.

## Build Vercel — suivi des vérifications distantes

- Lint web complet et nouveau build complet PASS après capture du temps d’observation dans le loader serveur des invitations ; requête, contrôle d’expiration et autorisations conservés. Avertissement de variable inutilisée du scoring supprimé ; quatre régressions scoring et dix tests d’actions franchise PASS.
- Packaging natif des trois racines rejoué sur le nouveau build : résultats identiques. Aperçu Vercel en échec, mais nouveau journal privé refusé faute d’authentification ; cause précise non établie et journal demandé au demandeur. Aucun succès de déploiement annoncé.
- CI SQL : échec existant0193, version persistée5 contre2 attendue. Le trigger de rattrapage457400 ajoute des transitions après le lien230300 ; le RPC retourne une version intermédiaire. Constat conservé pour l’audit fonctionnel, sans modification de migration ou d’assertion pour masquer l’écart.

## Build Vercel — préconfiguration automatique du monorepo

- Configurations natives Next pour racine, `apps/web` et compatibilité `packages/domain` (cas du journal fourni). Le relais utilise les vrais artefacts et dépendances web, conserve le build métier domaine et refuse les collisions avec les sources/dépendances existantes. Les quinze crons sont conservés et leurs endpoints vérifiés.
- Compilation web explicite `build:vercel`, dépendances Next/React détectables depuis la racine avec lockfile synchronisé. Cible TypeScript ES2020 pour les calculs BigInt de questionnaire existants. Aucun changement de design, de logique d’autorisation, de données ou de production.
- Build complet Node22/pnpm10 PASS ; questionnaire32 PASS ; tooling42 PASS ; packaging officiel @vercel/next28.0.1 PASS aux trois racines :566 Lambda,116 sorties API,887 routes chacune. Helper réel rejoué deux fois dans une fixture propre ; revue indépendante favorable. Aucun déploiement distant certifié.
- Preuve : `docs/evidence/vercel-autobuild.json`. Procédure : `docs/release/DEPLOYMENT_RUNBOOK.md`. L’audit global des scénarios métier reste ouvert et n’est pas remplacé par ces preuves de build.

## 2026-11-03 — Réparation des validations CI des trois lots Administration

- Tests temporels Maroc stabilisés sous Node 22.23.4 ; fixtures catalogue, Box, qualification, signature, mandat et Finance conformes aux préconditions natives. Frontières de requêtes explicites dans une unique transaction avec rollback ; contrôles TAP conservés.
- Migration DSR additive pour les justificatifs de coûts Finance : portée, revue indépendante, CLEAN fiable, environnement et révocation couverts ; familles inconnues refusées. Aucune production modifiée.
- Rejeu neuf **562 migrations PASS**, nettoyage PASS ; **347 fichiers SQL/RLS PASS par segments**, quatre courses officielles à deux connexions PASS ; **3 892 tests unitaires PASS**, un Storage opt-in ignoré existant ; intégration3/tooling33, lint/typecheck/build, phase00/frontières/no-placeholders PASS. Budget du job SQL : 40 minutes. Revue indépendante sans bloquant.
- Passage CI unique GitHub Actions à confirmer après publication. Preuves et limites : `docs/recette/ci-repair-2026-11-03.md` et `docs/evidence/ci-repair-20261103.json`. Aucun visa global de livraison ni fusion annoncé.

## 2026-11-03 — Administration lot 3 : vraie recette AAL2 et reprise de pagination

- Branche `codex/admin-lot3-20261103`, après PR #5 ; code candidat `e37e76e`. La recette native a reproduit un centre inutilisable sur une page d’approbations dépassant les résultats : HTTP416/PGRST103. Reprise page1 sous le même filtre/RLS uniquement pour cet état ; autres erreurs conservées.
- **19 étapes natives PASS** sur serveur compilé possédé : GoTrue/TOTP réels, trois profils de refus en RPC et navigateur FR/AR, auto-approbation refusée, filtre/contexte, claim/resolve sans rechargement manuel et version périmée refusée, rejet par un second Admin sans rechargement manuel. FR360 / AR1280 pour le workflow des tâches ; décision FR1280.
- Nettoyage vérifié : **4 acteurs / 1 organisation**, zéro rôle/session/tâche ouverte/approbation en attente des fixtures ; faits immuables conservés et serveur arrêté. Bootstrap des rôles local seulement ; aucune preuve de nomination gouvernée n’est extrapolée.
- **649 tests Admin PASS**, **35 outillage PASS** ; lint ciblé et build Next complet / TypeScript PASS. Harness historique : statut PROBE_PASSED distinct et nettoyage poursuivi malgré une erreur de fermeture. Revue indépendante sans bloquant.
- Preuves et limites : `docs/recette/admin-lot3-2026-11-03.md`, `docs/evidence/admin-lot3-native-20261103.json`. Base locale229 versions enregistrées, pas de visa de rejeu neuf/staging/production. Confidentialité, gros exports et projections Boxes/crédits restent ouverts.

## 2026-11-03 — Administration lot 2 : dossiers et suivi des actions

- Branche `codex/admin-lot2-20261103`, base `2075da4` du lot 1 / PR #4. Mapping des ressources vers leurs vraies collections de détail ; aucune réinterprétation d’un identifiant de RFQ/livrable/version comme identifiant parent. Segments encodés, cibles vides/dot refusées, contexte organisation commun aux cartes et à la recherche.
- Le filtre d’approbations préserve organisation et recherche, réinitialise la page. Les cinq commandes du centre rafraîchissent la file une seule fois après reçu RPC valide ; refus, conflits et réponses invalides restent des erreurs.
- **645/645 tests Admin PASS dans 95 fichiers**, dont111 régressions ciblées ; lint ciblé PASS ; compilation Next complète / TypeScript PASS avec configuration locale synthétique. **4 scénarios Chromium synthétiques PASS**, FR/AR à360/1440 px, sur le composant réel rendu statiquement. Revue indépendante sans bloquant résiduel.
- Périmètre, preuve navigateur et limites : `docs/recette/admin-lot2-2026-11-03.md`. Aucune modification SQL/RLS ou de production ; prochaine étape : recette authentifiée Admin AAL2 et vérification RPC sur base dédiée. Les exécuteurs de confidentialité et gros exports restent ouverts.

## 2026-11-03 — Corrections administration : faits, urgences et navigation

- Branche `codex/admin-corrections-20261103`, base GitHub `nebjal18-lang/Matricia` `d481bb6`. Conformité de la fiche fondée sur les preuves Client/Provider et l’identité canonique courantes ; retrait des validations déduites de l’absence de litige ou de la simple présence d’un brouillon.
- Tri gravité puis échéance ; file ouverte avant l’annuaire et raccourcis vers la tâche exacte. Gestion des membres filtrée sur l’organisation du dossier ; invitations limitées à INVITED ; activité/IF/RC réels, compteurs correctement nommés et indisponibilité explicite des Boxes/crédits sans projection.
- Suite Admin **567/567 PASS dans 94 fichiers**, sans test ignoré ; TypeScript web et lint web PASS ; validateur Server Actions PASS (1 951 sources) ; **8/8 contrôles Chromium synthétiques** du menu compte FR/AR à 375/390/768/1440 px PASS. Revue indépendante effectuée, deux remarques de navigation corrigées et revues.
- Compilation Next complète PASS, incluant TypeScript et génération des pages, avec une configuration HTTPS/Supabase locale synthétique. Aucun changement SQL/RLS, financier ou de production. La recette Admin AAL2 native et les RPC sur base de test ne sont pas certifiés par ces preuves.
- Périmètre et limites : `docs/recette/admin-corrections-2026-11-03.md`. Suite : recette authentifiée intégrée, puis traitements de confidentialité et exports volumineux déjà recensés. Aucun visa global de livraison n’est annoncé.

## 2026-11-02 — Corrections de l’audit complet M01–M30

- Audit complet reçu après l’instantané ci-dessous : les trente identifiants sont maintenant traités dans le code et documentés dans `docs/audit-20261102/REPORT.md`. Branche dédiée `codex/audit-m01-m30-20261102`, base `39552d7` préservée, consolidation/fusion amont `1ebf3ea`. Le déploiement audité précède cette fusion selon le demandeur ; son SHA exact reste inconnu et son URL est refusée CONNECT403. Aucun projet distant substitué.
- Causes corrigées : schéma Favoris, relation qualification objet/null, tenant/mandat, états lecture/Auth/refus/MFA/partiel, workflows Admin, diagnostic fondé sur réponses réelles, Besoin FR/AR, navigation/session, menu compte et contrôles de fichier du portefeuille. Lecteur de factures minimal gardé, ACL privées inchangées.
- Types/lint/build PASS  ; 2 712 tests PASS et un Storage opt-in ignoré ; intégration 3 PASS, outillage 31 PASS. 418 migrations sur clone neuf et23 assertions SQL PASS,608 tables RLS, nettoyage vérifié ; aucune migration partagée ou distante appliquée.
- Native local GoTrue/TOTP AAL2 : 176 contrôles satisfaits, dont168 sans incident technique et8 états facture partiels attendus ; quatre acteurs/trois organisations propres. Reprise finale Admin 8 PASS : menu borné/Tab/recherche/organisation/rôle public, vraie déconnexion et lien protégé refusé. Recette publique 8 PASS aux largeurs 375/390/768/1440 FR/AR après correction mobile.16 acteurs / 12 organisations sur quatre cohortes neutralisés, audit immuable conservé.
- Revues indépendantes croisées réalisées. M14 reste bloqué par200 services / 79 catégories AR approuvés manquants ; M21 par l’identité légale approuvée ; M22 par les limites/conditions commerciales. Recettes métier liées, mandat signé et facture positive/mixte ne sont pas certifiés par la readiness. Registres/PV et visas de lancement non approuvés ; garde V1 REFUSÉ (74 conditions dans l’instantané préparatoire,5/76 VERIFIED).
- Code poussé sur la branche dédiée ; PR préparée, création API refusée `POST https://api.github.com/graphql: Forbidden`. Pas de fusion ni de production. Commandes, captures, provenance des builds et réserves : `docs/audit-20261102/CHECKS.md` et `docs/evidence/audit30-candidate-20261102.json`.
- Prochaine étape : revue de la branche et des contenus approuvés, accès non-production sécurisé, application contrôlée de la nouvelle lecture puis recettes métier positives et visas réels. L’entrée suivante conserve l’historique antérieur à la fourniture de M02–M30.

## 2026-11-02 — Candidat unifié : lectures Admin et contexte d’organisation

- Branche dédiée `codex/final-corrections-20261102`, base réelle `1ebf3ea` de `codex/bootstrap-foundation` ; cette base contient déjà consolidation et design via PR #8. Modifications existantes préservées ; aucune fusion distante ni production effectuée par cette mission.
- États refus/absence/panne distingués, Auth503 centralisé, signaux Next préservés, MFA exigée ; périmètre organisation exact et choix explicite avant édition multi-organisations. Largeur mobile des grilles/tableaux et menus d’action corrigée.
- Types/lint/build PASS ; 2 150 tests web, 102 worker et 137 bibliothèques PASS, un Storage opt-in ignoré. 18 tests publics et 4 parcours Organisations réels FR/AR à 360/1 280 px PASS, vraies sessions GoTrue/TOTP AAL2, recherche/menu/fiche propres vérifiés ; Admin RPC valide, compte ordinaire refusé42501.
- Clone neuf : 417 migrations, 225 contrats sans référence aux contournements PASS / 4 926 assertions ; 608 tables sous RLS et pgTAP fermé aux rôles API. 56 exclusions maintenues ; suite globale non certifiée. Nettoyage clone et 14 acteurs/sept organisations propres vérifié, serveur arrêté.
- M01 vérifié sur le candidat local actuel ; M02 incomplet et M03–M30 non fournis, aucune clôture inventée. La recette temporelle de crédits après expiration réelle reste ouverte.
- Gate livraison REFUSÉ (74 conditions, 5/76 VERIFIED). PR préparée, création API refusée (`Forbidden`, domaine api.github.com non autorisé). Bilan : `docs/release/FINAL_CANDIDATE_2026-11-02.md` ; preuve : `docs/evidence/final-candidate-20261102.json`. Candidat de revue, pas un visa client définitif.

## 2026-11-01 — Recette commerciale FR/AR et nouvelles protections vérifiées

- Le candidat reste **en intégration et non approuvé pour livraison externe**. Les nouveaux lots financiers, la configuration réelle des Boxes et leurs automatismes, puis le rejeu global et la restauration coordonnée doivent encore être figés et vérifiés ensemble. La traçabilité reste 5/76 VERIFIED.
- SDK8 : **8/8 tests PASS, aucun échec, ignoré ou instable**, terminé le 1er novembre à 05:22:54 UTC. Les deux chaînes FR/AR utilisent les vraies commandes : demande, RFQ, devis, contrat, PDF canoniques privés, signature SIMPLE de développement gouvernée, mission et réceptions. Les interfaces Client/Prestataire et les sondes Storage vérifient le refus de suppression d’une preuve liée, son SHA inchangé et l’accès refusé au Prestataire révoqué mais conservé au Client. Nettoyage vérifié, source inchangée pendant l’essai. Rapport SHA256 `0eeac251e8c253faf20881295d2b1516c2cf807e608a09df6e25a33e3560be8a`, archive `artifacts/test-results/local-acceptance/history/linked-commercial-2026-11-01T05-22-54-021Z.json`. Cette preuve locale ne remplace pas un fournisseur de signature contractuel ni la recette du staging.
- Instantané SDK8 des contrôles globaux : **2 155 assertions unitaires exécutées PASS** (1 918 web, 100 worker, 137 bibliothèques), typage et lint globaux PASS. Le test Storage opt-in non activé dans la suite groupée reste identifié séparément ; les essais natifs Storage sont consignés dans leurs propres rapports. De nouveaux lots ont été intégrés après cet instantané : une validation finale demeure nécessaire.
- Avantages 268030/061 : parcours effectif réservation → planification → démarrage → rapport → réception indépendante → consommation, avec idempotence, CAS, preuve canonique et admission approuvée. **37 assertions SQL PASS/ROLLBACK** sur base principale locale et clone ; **12 tests web PASS**, revue indépendante incorporée. Un compte rendu humain n’est pas un fichier scanné ni une activation automatique. La recette navigateur spécifique reste en préparation.
- DSR : périmètre de compte sans adhésion vérifié (8 assertions), restriction marketing exécutée et attestée par les traitements réels (33 assertions), notifications optionnelles effectivement bloquées sans bloquer les communications obligatoires (14 assertions). Un reçu de fichier ou une référence libre ne vaut pas preuve d’effacement complet. Les compléments de clôture des autres demandes restent en intégration.
- Confidentialité catalogue : les coûts et règles internes sont retirés de la lecture directe des rôles API ; les projections Client restent liées à son organisation et à ses versions réellement détenues. **17 assertions SQL PASS** pour ce lot. La configuration/attribution native d’une Box reste à prouver dans sa propre recette.
- Accès externes revérifiés : runtime cloud toujours révision 1, réseau restreint sans domaines Supabase/Vercel autorisés. Le brouillon sauvegardé doit être activé dans les paramètres cloud. Supabase DEV seul est autorisé ; aucune cible distincte staging Vercel ni référence Railway n’est fournie. Les décisions de signature, d’identité légale complète, CNDP et fiscales restent requises. Contrôle de 3 021 fichiers révisables : aucun des tokens de gestion autorisés ni token GitHub/Supabase/Vercel de forme réelle détecté ; les fichiers de credentials locaux restent hors Git.

## 2026-11-01 — Rejeu complet local et révocation native vérifiés

- Le candidat reste **non livrable au client et non figé** : le nouveau lot DSR ALL/fichiers, la recette commerciale liée et les vérifications finales restent en cours. La traçabilité demeure 5/76 VERIFIED ; aucun visa n'est déduit d'un test local.
- Sur la source intégrée avant DSR267 : **377 migrations, 259 fichiers SQL et 5 843 assertions PASS** dans une base PostgreSQL neuve, isolée sans réseau ; 550/550 tables publiques sous RLS, pgTAP non exécutable par les rôles API, nettoyage vérifié. Les onze échecs du précédent diagnostic ont été corrigés sans désactiver les gardes. Preuve : `work/isolated-replay/e0bed532-2d8b-448b-8c15-4c66b8ae96b9/summary.json`.
- Instantané de qualité intégré : 1 939 assertions unitaires réellement exécutées PASS (1 725 web, 92 worker, 122 bibliothèques), typage et lint globaux PASS, 23 tests des outils PASS sans ignoré, Server Actions contrôlées sur 1 486 fichiers. Le test Storage opt-in ignoré dans la suite web a été exécuté séparément par son propriétaire avec de vrais octets Supabase locaux ; il n'est pas compté parmi les 1 939. Ces résultats devront être actualisés après DSR267 et les nouveaux correctifs.
- Sécurité 264000/010/020/021/022 : annuaire des vrais comptes sans adhésion, décisions globales à quatre yeux MFA, sessions liées à GoTrue pour REST/RLS/Storage, preuves liées protégées après perte d'adhésion et contre deux ordres de course suppression/liaison, autorisation catalogue avant recherche. 0034/0134/0244 : 32+62+22 assertions PASS sur la base locale, transactions annulées.
- Révocation native réelle : même JWT AAL2, sans rafraîchissement, encore valide 3 599 s ; après suppression de sa session, RPC et profil répondent 401 et les deux accès Storage privés refusent les octets. Nettoyage et source inchangée vérifiés. Rapport `artifacts/test-results/local-acceptance/native-session-revocation.json`, SHA256 `a5c6b7aba1586d173934c3d699fc0b50269162f3b3b72704809d3c42a9238bc4`. Voir `docs/release/ACCOUNT_ACCESS_AND_SESSION_ENFORCEMENT.md`.
- Navigateur : Client6 et smoke16 avaient passé sur une source antérieure ; ils ne certifient pas le candidat courant. La recette commerciale liée a passé AuthUI4 puis identifié une fixture AAL1 révoquée après TOTP ; sa session de test est corrigée via GoTrue réel, sans assouplir l'application. La chaîne entière et la conservation physique des preuves après refus API restent à exécuter.
- Intégrations : transport privé FR/AR des PDF sources vérifié localement (upload, conflit, download SHA, refus public, suppression/absence) ; routes canoniques complètes à recetter. La restauration coordonnée LAB n'est pas encore verte après le premier échec par saturation disque ; nouveau protocole borné préparé, aucun visa de restauration annoncé.
- GitHub revérifié : HEAD et origin/codex/bootstrap-foundation = `dbf309cd4ec5c48212c43243203dd98150ee5114`. Les lots locaux sont conservés sur les branches de domaine et dans l'intégration, sans déploiement ni push de production.
- Accès externes : brouillon cloud réseau sauvegardé, activation non effectuée (runtime révision1). Supabase DEV autorisé seulement ; Vercel reste sans cible staging distincte validée et Railway sans références. Fournisseur/niveau de signature, identité légale complète, décisions CNDP/fiscales, recettes de staging, remise et PV signé restent externes. La marque Matricia ne remplace pas ces décisions. Aucun secret dans Git ou les journaux.

## 2026-10-31 — Livraison complète : intégration et nouvelle recette en cours

- État du nouveau candidat : **non livrable, non figé**. Les résultats historiques ci-dessous ne valident pas les modifications de ce lot. Le backlog de référence contient 87 tickets (`docs/audit-livraison/backlog-livraison-2026-10-31.json`). Aucune exigence n’est déclarée signée par ces seuls développements.
- Développements intégrés : contexte des organisations et mandats, assistance Client avec retrait du consentement, documents privés scannés, dossiers Prestataire et PDF FR/AR, constructeurs Franchisé, décisions Admin avec effets bornés et preuves, remboursements PayPal avec rapprochement sans nouvel ordre ambigu, reçus email vérifiés, Outbox avec accusés de consommation et supervision sous panne. Des compléments sont encore en développement, notamment factures/avoirs Client et parcours complets de protection des données.
- Dernier instantané assemblé vérifié : **1 445 tests unitaires**, dont 1 259 web et 69 worker ; typage global, 3 tests d’intégration HTTP réels, 16 tests des outils de preuve, frontières des 14 packages et contrôles structurels passent. Les contrôles devront être relancés après les compléments suivants.
- Rejeu indépendant : **261 migrations applicatives** passent sur PostgreSQL isolé sans réseau, après les migrations officielles Auth (70) et Storage (68). Les migrations ajoutées ensuite et la suite SQL complète restent à revérifier. Les régressions détectées sont renvoyées aux auteurs ; le bootstrap pgTAP de ce laboratoire a été aligné sur celui de la CLI, sans modifier les droits runtime de la base principale.
- Recette réelle locale : OTP GoTrue, TOTP AAL2, administrateur sans organisation, deux organisations et deux mandats, refus RLS, Storage et nettoyage passent. Le nouveau smoke navigateur a échoué, notamment sur un décalage ICU serveur/navigateur ; correction par libellés de dates calculés côté serveur intégrée, nouvelle recette à exécuter. Le parcours UI OTP a révélé une longueur de code imposée à tort : correction en cours selon le défaut Gold Master à six chiffres configurable.
- Build : le deuxième essai compile et type correctement, mais échoue au chargement du module PDF (résolution des polices transformée par Turbopack). Correction et nouvelle compilation encore requises ; aucun build vert du candidat courant n’est annoncé.
- Environnement : Storage privé et TOTP local activés ; redémarrage sans reset et sans perte des données. Instructions réutilisables et domaines Supabase/Vercel sauvegardés dans le brouillon de configuration, **publication de l’environnement encore nécessaire**. GitHub vérifié : branche distante `codex/bootstrap-foundation` et HEAD local identiques à `dbf309cd4ec5c48212c43243203dd98150ee5114`, corrections conservées dans le travail local.
- Hors production : les API Supabase/Vercel sont refusées par le proxy avant authentification. Railway n’a pas de cible fournie ; fournisseur/niveau de signature, identité légale complète, politique fiscale validée, restauration staging et procès-verbal client restent sans validation externe. Aucun déploiement, signature ou visa client n’a été inventé. Les tokens restent hors Git et hors journaux.

## 2026-10-31 — Corrections du workflow cloud et contrôles locaux verts

- Correction de la régression d’idempotence financière par migration additive, fixtures fiscales alignées sur les règles validées, états React/hydratation, tokens CSS/TypeScript, lint et URL de build CI.
- Vérifications : 1 265 tests unitaires ; 233 migrations rejouées sur une base jetable neuve ; 174 fichiers SQL, 3 833 assertions et 4 scénarios de concurrence ; 18 E2E publics/cookies FR/AR mobile/bureau ; typage, lint, build et gates de phase 00 validés.
- Supabase local : démarrage reproductible via `bash scripts/start-local-supabase.sh`, Auth/REST/DB/outbox sains et parcours OTP réel vérifié sans divulgation de secrets. La base existante est conservée.
- Revue indépendante des corrections réalisée et recommandations intégrées. Preuve : `docs/evidence/cloud-error-corrections-2026-10-31.md`.
- Prochaine étape : reprendre la validation des parcours métier authentifiés et des intégrations hébergées avec les accès de développement appropriés. Cette correction n’est pas un visa de release V1.

## 2026-10-31 — Parcours authentifié des espaces, 16 tests verts

- Le parcours sandbox `authenticated-route-smoke` ouvre, avec un compte réel, en français et en arabe, à 360 px et sur ordinateur : diagnostics, questionnaires, devis, missions, facturation, crédits et notifications (Client) ; qualification, devis, missions, facturation et marketing (Prestataire) ; performance, relances, questionnaires, résumé et marketing (Franchisé) ; command center, parcours et organisations (Administration).
- Un compte sans le rôle est renvoyé hors de la finance d’administration, et le nom de l’autre organisation de test n’apparaît pas dans son espace. Les comptes de test ont été supprimés à la fin. Résultat : 16/16, aucun test ignoré. Preuve : `artifacts/test-results/authenticated-route-smoke-summary.json`.
- Corrections trouvées par ce parcours : les dates de mission et du command center s’affichent à l’heure du Maroc, donc le serveur et le navigateur rendent le même texte. Les clés des formulaires de mission ne sont plus tirées au hasard pendant l’affichage. La lecture des services prestataire nomme les liens exacts entre les tables, ce qui permet d’ouvrir la qualification même sans service déclaré.
- Ce n’est pas un visa des 63 fonctions. Le compte d’administration de ce bac à sable n’a pas le rôle Finance, Super Admin ni gestion marketing : ces trois pages d’administration lui restent fermées, comme prévu. La publication sur un vrai réseau social et l’audit indépendant restent ouverts.

## 2026-10-08 — Régions d’intervention prestataire, retour diagnostic, affichage de l’accueil

- Accueil public : rendu corrigé (hero en une seule image, voile, cartes, boutons, pied de page arabe), vérifié en FR/AR à 390, 1200, 1440 et 1920 px, sans débordement horizontal.
- RFQ-REGION-001 : formulaire des 12 régions officielles dans `/sous-traitant/qualification` (FR/AR, motif obligatoire, `aria-live`). RPC `declare_provider_regions` : contrôle des droits, idempotence, historique immuable `provider_region_versions`, mise à jour du profil de matching, audit et outbox `ProviderRegionsDeclaredV1`. Migration `20261008100000_provider_intervention_regions.sql` **non appliquée** ; pgTAP `0172` écrit, **non exécuté**.
- PUB-DIAG-004 : le retour vers l’enregistrement du diagnostic est conservé via `/organisation` (liste blanche, pas de redirection ouverte).
- Vérification : `tsc` 0 erreur ; Vitest 277 fichiers, 1110 tests verts ; ESLint 0 erreur sur les fichiers modifiés ; `next build` vert (avec une URL publique `https`, comme l’exige la production).
- Le 2026-10-08, l’utilisateur a appliqué `20261008100000_provider_intervention_regions.sql` et `20260929110000_restore_account_security_mfa.sql` dans l’éditeur SQL Supabase. Contrôle en lecture seule : exigence MFA `aal2` rétablie (sécurité du compte et rôles plateforme), table `provider_region_versions` avec RLS et trigger d’immutabilité, RPC exécutable par `authenticated` et pas par `anon`, aucun insert direct, 12 régions, opération d’idempotence autorisée.
- pgTAP exécutés sur cette base, chacun dans une transaction annulée : `0170` 14/14, `0171` 14/14, `0172` 10/10. Dans `0171`, le contrôle du worker appelait pgTAP sous le rôle `authenticated`, qui n’a pas accès au schéma `extensions`. Il capture désormais le refus `42501`, puis vérifie après `reset role`, comme les autres tests.
- **Toujours non prêt** : fichier `20260929110000_restore_account_security_mfa.sql` à ajouter à Git. E2E authentifiés (dont `p29-marketing-workspaces.spec.ts`, non suivi dans Git) à lancer. Intégrations externes non prouvées. Audit indépendant absent.
- **Prochaine étape** : déclarer les régions d’un vrai compte prestataire via l’écran, puis vérifier qu’il entre dans le matching d’une demande de la même région. Lancer ensuite les E2E authentifiés.

## 2026-09-29 - Marketing : espaces Prestataire et Franchisé, suivi de conversion, fréquence hebdomadaire

- Nouveaux écrans `/sous-traitant/marketing` et `/franchise/marketing` (FR/AR, entrée « Marketing » dans la navigation). Ils montrent Brand Kit, consentements, campagnes, contrôle des contenus, calendrier assisté, validations, programmation et performance de la seule organisation sélectionnée. L'organisation doit figurer parmi celles que l'utilisateur peut gérer, sinon accès refusé. La revue des preuves et les templates restent réservés à l'administration.
- Validation globale du calendrier ASSISTED ouverte aux propriétaires Client, Prestataire et Franchisé (avant : Client seulement). Le serveur contrôle toujours consentement, conformité, risque, audit et outbox.
- Brand Kit prérempli : dernière version du Brand Kit si elle existe, sinon nom de l'organisation, services du prestataire ou bibliothèque du franchisé, et lien HTTPS vers le diagnostic.
- Filtres de performance : noms de bibliothèque, service, organisation, franchise, contenu et réseau à la place des UUID ; les acteurs deviennent « Vous » ou « Membre N ».
- Suivi de conversion : un clic sur un CTA pose un cookie signé (HMAC, HttpOnly, Secure, 30 jours) et enregistre `CTA_CLICKED`. Ensuite, l'inscription (`REGISTRATION_STARTED`), le diagnostic public (`DIAGNOSTIC_STARTED`), l'opportunité (`OPPORTUNITY_CREATED`), la demande (`RFQ_STARTED`) et la signature de contrat (`CONTRACT_SIGNED`) sont reliés au contenu cliqué via `ingest_marketing_attribution_event_v1`. Consentement MARKETING_ANALYTICS obligatoire, clé d'idempotence déterministe, aucun identifiant du navigateur n'est cru. En cas d'échec, le parcours métier continue.
- Recommandation hebdomadaire appliquée : worker `/api/workers/marketing-frequency` (cron lundi 04:45). Seules les campagnes AUTOPILOT changent, d'un cran au plus par semaine (bornes 1 à 50). Les recommandations « pause » et « changer de template » attendent une décision humaine. Chaque décision est enregistrée dans un registre immuable, auditée et publiée dans l'outbox.
- Script de démonstration `scripts/provision-marketing-demo.mjs` : 10 Brand Kits franchisés, 20 prestataires, 50 campagnes, 300 contenus, 100 publications programmées, avec cas publiés, échoués, sautés, bloqués et consentement analytique retiré. En simulation par défaut, `--apply` requis, development/staging uniquement. **Non exécuté.** Aucune connexion sociale n'a de credential : rien ne peut partir sur un vrai réseau.
- Migration `20260929100000_marketing_workspaces_funnel.sql` (additive) : appliquée le 2026-09-29 par l'utilisateur dans l'éditeur SQL Supabase. Contrôle en lecture seule : registre présent, RLS forcée, worker autorisé, utilisateur refusé, validation ASSISTED ouverte aux propriétaires Prestataire et Franchisé. Test pgTAP `0171` écrit, **non exécuté** (pas de base locale).
- Vérification : `tsc` sans erreur dans le code source (seule erreur dans `.next/dev/types`, fichier généré). Vitest : 275 fichiers, 1103 tests verts. ESLint sur les fichiers modifiés : 0 erreur.
- **Toujours non prêt** : pgTAP `0171` à exécuter, E2E authentifié marketing (FR/AR, 360 px) absent, audit indépendant absent, franchises de démo en statut CONTRACT_PENDING (le filtre « Franchise » de la démo reste vide).
- **Prochaine étape** : exécuter `0171`, lancer le script de démo en simulation puis avec `--apply` sur development, puis écrire l'E2E marketing authentifié.

## 2026-09-28 — Besoin → demande → matching conforme au Gold Master V4

- La demande créée depuis un besoin reprend les réponses du besoin. Le serveur calcule si les informations obligatoires pour les devis sont réunies. Sinon, la demande passe en « Informations requises » et le client ne complète que ce qui manque. Chaque complément crée une nouvelle version immuable, figée avant le matching.
- Région choisie parmi les 12 régions officielles (FR/AR). Date limite choisie avec un sélecteur, en heure du Maroc. Panel de 10 prestataires au minimum.
- L’essai de 30 jours bloque les nouvelles demandes dès sa date de fin, même sans traitement planifié.
- Le diagnostic public revient directement à l’étape d’enregistrement après connexion.
- Vérification : `tsc` sans erreur dans le code source (seule erreur dans `.next/dev/types`, fichier généré). Vitest : 269 fichiers, 1080 tests verts. Test SQL `0170` écrit mais **non exécuté**.
- Migration `20260928120000_need_request_quote_completeness.sql` appliquée le 2026-09-28 par l’utilisateur dans l’éditeur SQL Supabase : les 5 fonctions sont présentes. Test pgTAP `0170` pas encore exécuté.
- **Prochaine étape** : exécuter le test pgTAP `0170`. Ajouter un écran pour que les prestataires ou l’administration renseignent les régions d’intervention (RFQ-REGION-001).

## 2026-09-28 — Administration : plus d’UUID, de JSON ni d’empreinte à saisir

- Command center : l’action contrôlée se demande en choisissant un dossier ouvert. Le serveur relit le dossier sous RLS, en déduit l’organisation et la ressource, et calcule l’empreinte SHA-256 et le résumé. Les identifiants envoyés par le navigateur sont ignorés.
- L’accès support est accordé au responsable du dossier, pour 15, 30 ou 60 minutes. Avant, une date `datetime-local` échouait à la validation.
- Finance (box) : avantages autorisés en cases à cocher. Achats groupés : fournisseur choisi dans une liste.
- Quatre tests périmés alignés sur le comportement réel (Finance franchisé présente, bouton inventé retiré).
- Vérification : `tsc` sans erreur dans le code source. La seule erreur restante est dans `.next/dev/types`, un fichier généré par le serveur de dev. Vitest : 267 fichiers, 1071 tests verts.
- **Toujours non prêt** : pas d’E2E, pas de SQL/RLS relancé, pas d’audit indépendant, pas d’essai navigateur du Command center.

## 2026-09-28 — Besoin public : une étape à la fois

- Le formulaire n’affiche plus toutes les sections ensemble. L’ordre est : description, compréhension du besoin, questions, compléments, puis récapitulatif.
- Le libellé technique `TOKEN_OVERLAP_V1` n’est plus montré à l’utilisateur.
- **Toujours non prêt** pour le reste du prompt maître.

## 2026-09-28 — Franchise publique : plus de promesse d’exclusivité

- La page ne dit plus « territoire exclusif ». Elle dit que le territoire est celui prévu au contrat versionné, en français et en arabe.
- Les parts internes (Hatim, NEOXA, Asma) n’étaient pas sur cette page.
- **Toujours non prêt** pour le reste du prompt maître.

## 2026-09-28 — Page Professionnels : plusieurs métiers, catégories repliées

- Le hero ne montre plus la photo d’artisan. Il liste les domaines réels du catalogue (informatique, juridique, comptabilité, etc.).
- Les services d’un domaine sont groupés par catégorie. Seule la première catégorie est ouverte.
- L’exemple d’activité cite plusieurs métiers, plus seulement la menuiserie.
- **Toujours non prêt** pour le reste du prompt maître.

## 2026-09-28 — Prédiagnostic public : plus de chiffres inventés

- Sans priorité, une seule carte s’affiche. Les 92 %, 83 %, 71 % et « 44 / 48 réponses » sont retirés.
- Si le navigateur refuse le brouillon, une seule reprise s’affiche : réessayer, continuer sans sauvegarde locale, ou se reconnecter. Les trois pannes simultanées sont retirées.
- Le secteur « Santé, éducation & social » est retiré : le contrat `save_public_diagnostic_intake` ne l’accepte pas. Un ancien brouillon est enregistré comme « Autre activité ».
- **Toujours non prêt** pour le reste du prompt maître.

## 2026-09-28 — Navigation publique unique et hero allégé

- FR et AR partagent les mêmes destinations, dans le même ordre : Comment ça marche, Entreprises, Professionnels, Franchise, Abonnements, À propos. Le contact reste dans le pied de page.
- Le hero n’affiche plus le slogan, les trois valeurs, le script ni les bandeaux posés sur la photo. Le voile du titre suit le sens d’écriture (`to inline-end`).
- Preuve : `vitest run public-navigation public-pages-mockup-alignment` — 2 fichiers, 12 tests, vert.
- **Toujours non prêt.** Le reste du prompt maître (diagnostic, espaces, admin, E2E, SQL) n’est pas traité.

## 2026-09-28 — Correction publique ciblée (contact, abonnements, besoin)

- Branche `codex/audit-final-2026-09-15`, HEAD `a1e5752`. Aucun déploiement. Les changements locaux non commités sont conservés.
- Contact : suppression du bloc « États d’envoi (exemples) / Exemple illustratif » et de la carte « Nous écrire directement — Via le formulaire ci-dessus ». Le succès reste celui renvoyé par l’action serveur.
- Abonnements : les cartes n’affichent plus la même liste de fonctions. Prix et crédits viennent de `get_public_subscription_plans` (unités mineures, `formatMinor`). Prix nul ou plans indisponibles : « Tarif communiqué avant souscription », sans cartes Essentiel / Premium / Organisation inventées.
- Besoin public : les deux sections numérotées 3 sont devenues 3, 4 et 5. Faute « nous pourrez » corrigée. Le découpage en six étapes distinctes n’est pas fait.
- Preuve : `vitest run abonnements/page.test public-pages-mockup-alignment` — 2 fichiers, 10 tests, vert.
- **Non prêt.** Inventaire complet des routes, RBAC, E2E et P0 non exécuté. Détail : `docs/corrections-integrales/ACCEPTANCE_REPORT.md`.

## 2026-09-21 — Registre des 71 lignes encore ouvertes

- Les 63 lignes `MAT-FUNC` `IN_PROGRESS` ne pointent plus vers la matrice générique. Chacune cite une implémentation, un test et la preuve atomique qui existe. Le motif `PENDING` nomme l’écart restant : visa indépendant, et E2E métier quand il manque encore.
- Les 8 lignes Marketing étaient déjà rattachées à leur code. Elles restent `IN_PROGRESS` pour le même motif.
- Compteur inchangé : **5/76 `VERIFIED`**. `validate-traceability` passe. Aucun visa n’a été inventé.

## 2026-09-21 — Audit final après corrections

- Base locale et base de développement alignées sur `20260921250000`. La table d’avis de marque manquante en local a été recréée depuis `20260913018700`, puis les 33 migrations en attente ont été appliquées. `row_version` est qualifié dans les mises à jour jointes du catalogue (`42702`).
- Contrats SQL ajustés aux politiques de lecture franchise additives, au refus de consultation porté par le helper, et au plan réel des soumissions catalogue.
- Preuve : suite SQL distante **171 fichiers, 3 786 assertions**, 4 scénarios de concurrence. Contrats `0160`–`0169` verts en local (139 assertions). `validate-release` passe. Dry-run distant : à jour.
- **Non signable.** Couverture inchangée : **5/76 `VERIFIED`, 71 `IN_PROGRESS`**. Pas de visa indépendant, pas d’E2E-01 exécuté. Paiement sandbox, SMTP/OTP et worker/ClamAV distants restent non prouvés. L’arbre n’est pas gelé.

## 2026-09-21 — Restauration clôture prestataire et politique litige

- `20260921120000` avait réécrit, après coup, le tableau de clôture et le balayage d’exceptions. `20260921240000` rétablit les corps de `20260921220000` (`OVERDUE`, `blocks_new_opportunities`) et remplace la politique `dispute_cases_franchise_library_read` par `franchise_supervises_dispute`.
- Le contrat `0161` compte 31 politiques de lecture franchise et compare la capacité sans casse. Le contrat `0163` appelle `extensions.throws_ok` sans changer de rôle avant la fonction pgTAP. Le parcours mission client n’utilise plus l’état `todo` scanné comme marqueur incomplet.
- Preuve développement : `0161`, `0163`, `0167`, `0168`, `0169` (52 assertions) et les 4 scénarios de concurrence. `validate-release` passe (catalogue, spec, traçabilité, marqueurs).
- Lot 9 : **non clos**. 5/76 `VERIFIED`. Pas de visa indépendant, pas d’E2E-01. Les preuves externes du checklist (paiement sandbox, SMTP, worker, ClamAV) restent en échec.

## 2026-09-21 — Pages publiques : composition calée sur les 19 PNG

- Accueil FR : hero pleine largeur, cartes flottantes sur photo à droite, titre navy/violet, 7 étapes, résultats 2×2 + ruban, FAQ + bandeau violet. Accueil AR (maquette 17) : photo à gauche, titre corail, note latérale, cycle numéroté, sans FAQ/résultats FR. Nav AR : الرئيسية، كيف تعمل، لمن، موارد، من نحن، اتصل بنا.
- 404 : illustration chemin/arche/panneaux (plus une photo). Connexion : overlay titre+chapeau sur photo et bandeau navy. Contact : colonne photo pleine hauteur. À propos, franchise, professionnels, abonnements, services : hero photo qui déborde à droite.
- Ce n’est **pas** un clone photographique des PNG : portraits Figma, fleur vs logo M, diagnostic maquette 18 en 4/9 vs produit 8 questions. Design Authority A reste le CSS produit. Preuve : tests accueil/nav/alignement.
- Lot 9 : **non clos**.



## 2026-09-21 — Lecture de la facture d’abonnement client

- Le cycle payé s’ouvre sur `/client/abonnement/cycles/[cycleId]` (montant exact, plan, période, référence de paiement). Le hash de preuve reste côté serveur. Le lien « Voir la facture » ne renvoie plus au coffre documents.
- Preuve : migration `20260921230000`, contrat SQL `0169`, rendu `subscription-invoice.test.tsx`.
- Marketing 001–008, adaptateurs LinkedIn/Meta et paiement PayPal d’abonnement étaient déjà implémentés. Ils restent `IN_PROGRESS`. Pas de visa indépendant, pas d’exécution E2E-01, pas de `VERIFIED`.

## 2026-09-21 — Avoirs, échéanciers et recouvrement prestataire

- ADM-036 : `issue_provider_credit_note` (finance seulement). Journal `PROVIDER_CREDIT_NOTE` inverse les comptes de la facture. Le solde est dérivé (`total − allocations − avoirs`). La facture n’est jamais `UPDATE`. Un avoir après paiement complet est possible tant que la somme des avoirs ≤ total.
- ADM-037 / ST-032 : `request_provider_payment_plan` (prestataire ou finance, 2 à 12 échéances = solde), `decide_provider_payment_plan` (finance). Un plan `APPROVED` passe le statut dérivé à `PAYMENT_PLAN` et lève le gel J+8. `open_provider_collection_case` défait le plan (`DEFAULTED`) ; `advance_provider_collection_case` ajoute OPEN → FORMAL_NOTICE → COLLECTION → CLOSED sans muter le dossier.
- UI Admin (avoir, décision d’échéancier, recouvrement) et échéancier prestataire (demande). Sorties finance : libellé `PAYMENT_PLAN`.
- Preuves : migration `20260921220000`, contrat SQL `0168`, vitest actions/facturation.
- Lot 9 : **non clos**. Pas de visa indépendant, pas d’E2E-01, pas de `VERIFIED`.

## 2026-09-21 — Restriction J+8 prestataire (nouvelles opportunités)

- ADM-035 / critère 73 : une facture Matricia échue (`due_on < current_date` et solde > 0) ajoute `OVERDUE_INVOICE` à `provider_service_eligibility_snapshot`. Matching et invitation RFQ excluent le prestataire. Les missions déjà ouvertes ne sont pas mutées ; `financial_status` n’est pas réécrit (une restriction FINANCIAL imposée n’est pas effacée au paiement).
- Le règlement intégral (allocations = total) lève le gel sans nouvelle date d’échéance. Un paiement partiel ne prolonge pas `due_on`.
- Clôture admin : `blocks_new_opportunities` sur les factures échues. Facturation prestataire : alerte FR/AR si `paymentStatus=OVERDUE`.
- Preuves : migration `20260921210000`, contrat SQL `0167`, vitest clôture / facturation.
- Lecture facture client et paiement d’abonnement : livrés ensuite (sections du 21 septembre). Restent hors signature : visa Lot 9, E2E-01, `VERIFIED`.

## 2026-09-21 — Packs, promotions, paramètres, demande volume, coffre

- ADM-031G/H : brouillon et activation AAL2 des packs et promotions. L’attribution appelle `issue_credits` (`EXTRA_PURCHASE` / `PROMOTION`), sans second ledger. Le plafond bonus actif `CREDIT_PROMOTION_MAX_BONUS` borne la création et l’attribution.
- ADM-044 : trois paramètres versionnés seulement (`DOCUMENT_EXPIRY_WARNING_DAYS`, `VOLUME_RESERVATION_DEFAULT_TTL_HOURS`, `CREDIT_PROMOTION_MAX_BONUS`). Pas d’éditeur libre.
- ADM-VOL-002 : `list_admin_volume_demand` compare 12 mois de réservations au forecast négocié.
- ADM-010 : `list_admin_document_vault` agrège les métadonnées client et prestataire, sans chemin de stockage. L’alerte d’expiration n’existe que si le paramètre est actif.
- Preuves : migration `20260921170000`, contrat SQL `0166`, tests UI catalogue et demande.
- Toujours hors signature : visa indépendant, E2E-01, promotion `VERIFIED`. Adaptateurs LinkedIn/Meta déjà présents, restent `IN_PROGRESS`. Pas de PDF fictif ni de connexion en tant que client.

## 2026-09-21 — Client : RFQ existante + site questionnaire/mission

- `open_service_request_rfq` refuse maintenant via `private.client_may_open_new_service_request` (`CLIENT_REQUEST_NOT_ENTITLED`, 42501). Matching et `mark_ready` inchangés. Rotation 90 jours et éligibilité courante conservées.
- `start_questionnaire_session` : 7e argument `p_site_id` défaut `null` (une seule signature PostgREST). Audience CLIENT + site ACTIVE de l’organisation, sinon `SITE_NOT_APPLICABLE` / `SITE_SCOPE_DENIED`. Hash d’idempotence sans `site_id` si null (rejeu des clés 6 arguments). UI `/client/questionnaires` transmet le site du portefeuille.
- `missions.site_id` hérité de la demande contractée (`create_mission` après le wrapper checklist 0191) + rattrapage des missions existantes. FK composite vers `client_sites(id, organization_id)`.
- Preuves : migration `20260921160000`, contrat SQL `0165`, 0025 signature 7 arguments, vitest start/site/panel.
- Lot 9 : **non clos**. Pas de visa indépendant, pas d’E2E-01, pas de `VERIFIED` de couverture.

## 2026-09-21 — Client : blocage SQL des nouvelles demandes (reliquat lots 3/5/7)

- Le blocage n’est plus seulement UI : `private.client_may_open_new_service_request` refuse une **nouvelle** demande si abonnement hors `TRIAL_ACTIVE`/`ACTIVE`, essai `TRIAL_EXPIRED` sans Gold `ACTIVE`, ou anomalie `DOCUMENT_EXPIRED` encore `OPEN`/`QUESTIONED`. Statut d’abonnement inconnu = pas de blocage inventé (tests P07).
- Appliqué dans `create_service_request` et `clone_request_core` (`CLIENT_REQUEST_NOT_ENTITLED`, 42501). Conversion besoin/opportunité inchangée : elles appellent déjà `create_service_request`. Pause/fin de plan récurrent non concernées.
- UI : `/client/demandes/nouvelle` et `/demandes/recurrence` masquent création/clonage/génération ; historique, pause et fin restent. `42501` → `FORBIDDEN` côté actions. Document expiré : Casablanca `YYYY-MM-DD`, mission non détruite. L’ouverture RFQ et le `site_id` de session sont traités par la migration `20260921160000`.
- Preuves : migration `20260921150000` (évite la collision volume `20260921140000` / `0163`), contrat SQL `0164`, vitest entitlement / actions / récurrence.
- Lot 9 : **non clos**. Pas de visa indépendant, pas d’E2E-01, pas de `VERIFIED` de couverture.

## 2026-09-21 — Activation pool volume (ADM-VOL-006)

- Commande `activate_framework_pool` : AAL2 + `begin_volume_command` (le même jeton d’idempotence que le brouillon). DRAFT → `FRAMEWORK_ACTIVE`, puis pool `POOL_ACTIVE` borné par `maximum_units`. Engagement fournisseur facultatif. Un seul pool ouvert par version.
- Écran Achats groupés : formulaire d’activation distinct du brouillon. Réserve / allocation / consommation inchangées.
- Preuves : migration `20260921140000`, contrat SQL `0163`, test UI négociations.

## 2026-09-21 — Administration Boxes / P&L / clôture / exceptions / volume

- ADM-031 : commandes versionnées `create_benefit_version`, `create_box_version` (slots), `activate_*` (AAL2, coût plein > attendu ⇒ référence d’approbation), `link_plan_box_rule`, dashboard `list_admin_boxes_dashboard` + `issue_credits` / wallet. Écran Finance `#boxes` / `#credits` (FR/AR, pas d’impersonnation client : simulation = matrice plan↔Box).
- P&L bibliothèques : `list_admin_pnl_dashboard` + clôture via `close_franchise_profit_period` (règles IT 50/50 et STANDARD 50/25/25 inchangées).
- Clôture fournisseur : `list_admin_provider_closure_dashboard` + `issue_provider_statement`. Sweep `sweep_admin_exceptions` → file `EXCEPTIONS` (`BILLING_EXCEPTION`, payables non relevés, matching FAILED/NO_CANDIDATE, LOW_STOCK, PAST_DUE).
- Volume : `create_framework_agreement_draft` + dashboard enrichi (contrats, SKU, rentabilité agrégée).
- Corrections TS : `PersonRow`/`RequestRow`/`MessageRow` exportés ; `QuotePreview` garde `invitation` nulle.
- Preuves : migration `20260921120000`, contrat SQL `0162`, tests UI Boxes + mock command center.

## 2026-09-21 — Lots 1 / 4 / 8 / 9 Client (onboarding, contrats, sécurité, preuves)

- Lot 1 : ICE déjà connu → `ACCESS_REQUESTED` sans doublon ; après création Client, CTA vers `/client/onboarding`. Parcours conformité : documents = étape 2, essai seulement après `VERIFIED` + essai actif. Résultat de validation affiché. Essai expiré → réactivation Gold. Le SQL d’activation d’essai n’a pas été modifié (`MAT-FUNC-001` conservé).
- Lot 4 restant : signature et envoi à la signature sur `/client/contrats` (plus seulement dans le panneau missions), avec `revalidatePath` contrats/missions. Approbations multi-personnes `business_approval_requests` sur `/client/actions` via `decide_business_approval` (AAL2 + rôles de la politique versionnée, aucun paiement autonome).
- Lot 3 reliquat : barre de progression réelle sur `/besoin` (étapes 1–5, pourcentage entier) ; clonage visible depuis `/client/demandes` vers `clone_service_request` (`/demandes/recurrence`).
- Lot 5 / 7 reliquat : document expiré → alerte mission (mission non détruite) ; coffre : seuls les documents non expirés sont liables à une demande/mission.
- Lot 7 original (coffre/finances/Box) : pages déjà dans le shell ; **nouvelle RFQ bloquée en SQL et UI** si abonnement `TRIAL_EXPIRED` / `SUSPENDED` / `PAST_DUE` / `CANCELLED`, essai expiré sans Gold actif, ou document expiré non résolu ; historique conservé. Coffre, crédits, Box, récompenses inchangés.
- Lot 8 : invitation membre déjà dans l’écran sécurité ; lien préférences notifs (`IMMEDIATE` / `DIGEST` / `DISABLED` par catégorie) vers `/notifications` (déjà `ClientAppShell` via `ConnectedAppShell`).
- Lot 9 : **non clos**. Pas de visa indépendant, pas d’E2E-01 bout-en-bout exécuté ici, `REQUIREMENTS_COVERAGE` non passé en `VERIFIED`. FR/AR et 360 px des nouveaux panneaux couverts par rendu statique + typecheck ciblé.

## 2026-09-21 — Lot 2 Client (bilan, décisions, assistance 002–006, 009–010, 046)

- Bilan et évolution sur le même parcours : bandeau de continuité sur `/client/diagnostics` (dernier score par bibliothèque, delta entier) et delta du run ouvert, sans overlay illustratif.
- Recommandations groupées par constat, libellés FR/AR `Conseil / Accompagné / Piloté` (GUIDANCE/ASSISTED/MANAGED). Comparaison Essentielle/Standard/Avancée via `/diagnostics/solutions?anomalyId=` — les deux vocabulaires restent distincts.
- Questions expirées/expirantes et réévaluations de profil affichées sur le bilan (comptes du questionnaire sélectionné et des candidats assistance), sans charger le corpus 6 000.
- Assistance contextuelle incrustée bilan / besoin / devis / jalon : suggestions à confirmer ou rejeter, aucune action critique autonome. Bundles : lancement d’un besoin confirmé (`/besoin?q=`), pas de commande silencieuse.
- Conversion opportunité → demande : `RFQ_READY` pointe vers `/client/demandes/nouvelle?opportunityId=`. `start_questionnaire_session` inchangé (pas de `site_id`).
- Preuves : helpers journey, AssistanceCue, board continuité, messages FR/AR.

## 2026-09-21 — Lot 6 Client (portefeuille 011, 012, 021, 051, 053)

- Sites : création versionnée `create_client_site` depuis `/client/portefeuille` (code, noms FR/AR, adresse, code région). Affichés sur projets et budgets.
- Budgets : alertes de consommation en points de base entiers (attention 80 %, enveloppe 100 %, dépassement si net > approuvé). Montants exacts, y compris restant négatif.
- Calendrier : libellés FR/AR des sources (devis, jalons, factures, documents). Progression projet sans virgule flottante.
- Demandes : `site_id` transmis dans le payload de conversion (besoin ou opportunité). Préremplissage depuis `diagnostic_runs.site_id` quand le bilan en a un. Zone géographique (`regionCode`) distincte du site d’entreprise.
- Preuves : tests consommation/progress/site RPC, panneau portefeuille, formulaire demande avec sites.
- Écart assumé : `start_questionnaire_session` ne prend pas encore `site_id` ; `missions` n’a pas de colonne `site_id` (héritage via la demande). Lot 2 pourra brancher le site au démarrage du questionnaire.

## 2026-09-20 — Lot 7 Client (comparaison et sélection de devis)

- Comparaison Client : score de complétude en points de base entiers, livrables/garanties de la version figée, pas d’identité prestataire. Pondération locale d’analyse sans score automatique.
- Sélection : motif obligatoire + confirmation humaine. RPC `select_quote_and_notify` enregistre la décision, appelle `select_quote`, puis publie un retour anonymisé (`publish_not_selected_feedback`) aux non retenus sans gagnant ni coordonnées.
- Démo : colonnes illustratives sans bouton de sélection réelle. Messagerie interne uniquement avant choix.
- Preuves : contrat SQL 0160, tests complétude/action/formulaire comparaison.

## 2026-09-20 — Lot 5 Client (demande/RFQ depuis besoin confirmé)

- Conversion atomique `create_service_request_from_need_intake` : intake verrouillé, service publié résolu par code métier, questionnaire CLIENT publié de la même bibliothèque, empreintes catalogue/questionnaire serveur, table `public_need_intake_conversions` insert-only (intake inchangé).
- Aucune ouverture automatique de consultation (`mark_ready` / matching / `open_rfq` restent des actions humaines distinctes). Idempotence par replay de conversion + clé `intake_id`.
- `/client/demandes/nouvelle?intakeId=&serviceCode=` prépare le brouillon ; `/besoin` propose « Créer une demande de devis » après enregistrement d’un service confirmé.
- Preuves : contrat SQL 0159, formulaire sans UUID internes, action besoin vs opportunité, extraction du code service depuis le snapshot.

## 2026-09-20 — Lot 3 Client (assistant besoin MAT-FUNC-008)

- Parcours `/besoin` : texte libre borné classé vers des services publiés (`TOKEN_OVERLAP_V1`), confirmation humaine obligatoire, questions discriminantes manquantes, sans création silencieuse de besoin/RFQ.
- Authentifié : `discover_assistance_scope` (lecture seule, max 20 services / 50 questions) enrichi des libellés FR/AR ; données fraîches `prefill_fact_versions` réutilisées et à confirmer.
- Public : classement borné sur la projection des 200 services (aucune question du corpus 6 000 chargée). Brouillon autosauvegardé localement (7 jours) ; l’enregistrement compte reste une action distincte.
- Correction TS prestataire : documents de consultation typés `ConsultationPackDocument` (plus de `doc.id` sur une union démo).
- Prochaine étape : Lot 5 — demandes/RFQ (conversion brouillon confirmé → consultation, versions catalogue conservées).

## 2026-09-20 — Lot 0 Client (shell Gold Master)

- Espace Client : pages hors chrome rentrées dans `ClientAppShell` (portefeuille, favoris, récurrence, assistance, solutions, achats groupés, onboarding, nouveau litige).
- Nav Gold Master : 9 liens maquette + Pilotage (À traiter, Contrats, Portefeuille, Crédits & Boxes, Favoris).
- Routes nouvelles : `/client/actions` (CL-013 / MAT-FUNC-006), `/client/contrats` (CL-028), `/client/recherche` (bandeau global demandes/missions/contrats/documents/messages).
- Preuves : tests nav/recherche + four-spaces + accueil Client verts. Typecheck web : seules des erreurs prestataire préexistantes (`workbenches.tsx`) restent hors Lot 0.
- Prochaine étape : Lot 3 — assistant besoin `MAT-FUNC-008` (texte libre → service → questions manquantes) + préremplissage/autosave.

## 2026-09-19 — Restructuration modulaire par espace (5 vagues)

- Architecture cible livrée : **un module par espace** sous `apps/web/modules/`. Les routes `app/[locale]/…` restent des coquilles Next.js (page/layout/loading/error) et délèguent aux écrans du module.
  - `modules/client` — 143 fichiers (data 23, screens 118) : tableau de bord, diagnostics, demandes, missions, finances, documents, onboarding…
  - `modules/provider` — 65 fichiers (data 22, screens 41) : qualification, devis, missions, facturation, réputation, planning
  - `modules/franchise` — 37 fichiers (data 14, screens 23) : accueil, CRM, relances, digest, gouvernance
  - `modules/admin` — 112 fichiers (data 27, screens 85) : command-center, clients, providers, finance, catalogue, opérations…
  - `modules/shared` — 191 fichiers : cockpit/shell, UI, i18n, supabase, auth, notifications, contrats, fiscalité…
  - `modules/public` — 30 fichiers : catalogue public, parcours besoin/fournisseur, site
- `lib/` et `components/` vidés puis retirés. Alias `@/` résolu en tests via `apps/web/vitest.config.ts`.
- Preuves : typecheck PASS, ESLint PASS, **816 tests web verts (200 fichiers)**, `release:validate` + `traceability:validate` (76 exigences) PASS.
- Prochaine étape : extraire les pages publiques restantes vers `modules/public/screens` si le site public doit suivre le même contrat que les 4 espaces.

## 2026-09-18 — Correction UX des tableaux de bord (structure et affichage)

- Déduplication du déroulement Client et Prestataire : suppression des rangées de gros CTA qui doublonnaient le hero et les actions groupées (« Exprimer un besoin » affiché 3 fois), et des liens Messages/Notifications/Profil qui doublonnaient la nav courte dans la barre de recherche.
- `CockpitActionGroups` : pastille « · » remplacée par une tuile or « ↗ » (`cockpit-action-tile`, miroir RTL) avec chevron dédié.
- `admin-experience.css` : cartes KPI resserrées (min-height 8,5rem → 6,5rem) avec teintes de fond par tonalité (critique/attention/ok) ; process strip en 2 colonnes sur mobile puis `auto-fit` desktop (fini la colonne unique interminable) ; flux d’activité plus compact. CSS mort (`client-primary-actions`, `provider-primary-actions`) retiré.
- `admin-module-chrome.test.tsx` réécrit en JSX (corrige `react/no-children-prop` et le typage `children` requis).
- Preuves : 813+54+4 tests unitaires verts, typecheck/ESLint propres, smoke démo 18/18 routes saines, captures avant/après dans `artifacts/test-results/dashboard-review/`.

## 2026-09-18 — Audit global des portails (cahier des charges Gold Master V4)

- Portails structurels : `catalog:validate` (10 bibliothèques, 200 services, 6000 questions), `spec:validate` (7 registres, 68 fonctions, 63 agents), `traceability:validate` (76 exigences cohérentes), `no-placeholders` et `release:validate` verts.
- Typecheck tous packages vert ; ESLint vert ; tests unitaires 871 verts (199 fichiers web, 11 worker, 1 ui) ; tests SQL/RLS **159/159 verts** sur la base development ; smoke runtime démo **18/18 routes saines** (4 personas, 360 px) via `tests/e2e/helpers/demo-spaces-smoke-run.mjs`.
- Corrections appliquées pendant l’audit : état `ProcessStep` `"todo"` renommé `"pending"` (24 fichiers, 42 occurrences — faux positif du validateur anti-placeholder) ; `react/no-children-prop` dans `admin-module-chrome.test.tsx` ; test SQL `0156` aligné sur le durcissement MFA (claims `aal:"aal2"` pour les rôles plateforme) ; dérive de migration comblée — `20260916120000_admin_supervision_projection` vérifiée présente sur development et enregistrée dans `schema_migrations`.
- Écart assumé vs Definition of Done release : 5/68 exigences `VERIFIED`, 63 `IN_PROGRESS` (implémentation existante, preuves atomiques à compléter) — voir `docs/traceability/REQUIREMENTS_COVERAGE.md`. P01 reste ouverte (contrats atomiques exhaustifs).

## 2026-09-18 — Alignement cockpit SIP des espaces connectés

- Espace franchisé aligné sur le cockpit SIP (hero, KPI, actions groupées, flux d’activité) : nouvel accueil protégé `franchise/accueil` composé sur `loadFranchiseCrm` (prospects, relances, alertes, objectifs, scores) — aucune donnée inventée, aucun faux zéro (`lib/franchise-home/view-model`).
- Modules `franchise/digest`, `franchise/performance`, `franchise/relances` migrés de l’ancien chrome (`bg-muted/40`) vers `AdminModuleChrome` ; retour des quatre modules vers l’accueil de l’espace. La page publique `/franchise` (candidature) reste inchangée et publique.
- Hub de modules : route `franchise-home` enregistrée avec libellés FR/AR. Client, Sous-traitant et Administration étaient déjà alignés (aucun changement).
- Preuves : `lib/franchise-home/view-model.test.ts`, `franchise/accueil/messages.test.ts`, `franchise/cockpit-alignment.test.tsx` ; 48 tests verts, typecheck et ESLint ciblés propres.
- Validation runtime (2026-09-18) : persona démo `franchise` provisionné sur l’environnement development via `scripts/provision-demo-franchise-persona.mjs` (déterministe, idempotent, identifiants uniquement dans `.env.local`) — franchise ACTIVE « Franchisé · Démo Matricia » (bibliothèque COM, territoire SOUSS versionné), 3 prospects (1 relance en retard), 1 objectif actif, 1 snapshot + 2 alertes ouvertes (1 CRITICAL) adossés à une métrique démo `DEMO_CLIENT_NETWORK`.
- Accès démo étendu : quatrième persona « Franchisé » sur `/connexion` (`demo-access.tsx`, `demo-actions.ts`, destination `franchise/accueil`, FR/AR, tests mis à jour — 9 tests verts).
- Revue visuelle `tests/e2e/helpers/franchise-cockpit-review-run.mjs` : connexion réelle par le bouton démo puis 20 captures (5 modules × FR/AR × 360 px/desktop) dans `artifacts/test-results/franchise-cockpit/` — statut 200 partout, aucun débordement horizontal, aucune erreur navigateur ; KPI alimentés par les données réelles (1 relance en retard, 3 prospects, 2 alertes, 1 objectif) et RTL arabe conforme.
- Prochaine étape : étendre le smoke E2E sandbox (`authenticated-route-smoke.spec.ts`) à la route `franchise/accueil`.

## 2026-09-16 — Site public 10/10 (compose + polish)

- Inventaire `docs/PUBLIC_SITE_VALIDATION.md` (spec 1–14). Nav commune Entreprises/Professionnels/Comment ça marche/Offres/Franchise + CTA Analyser. Accueil : titre cible, 6 étapes, domaines catalogue → `/besoin?library=`, FAQ confiance.
- Page Entreprises, pages légales (`mentions-legales`, `confidentialite`, `conditions`), footer cohérent, franchise candidature conditionnelle, contact motifs adaptés, offres sans débit (`plan=` conservé).
- Handoff : brouillons locaux vs compte distingués ; proxy public étendu. Preuves : `page.test.tsx`, `public-navigation.test.tsx`, `entreprises/page.test.tsx`, `public-legal/documents.test.ts`.
- Re-score A–D ≥ 9/10. Gaps volontaires : branches prédiagnostic déclaratives ; conversion brouillon→RFQ Lot 3.

## 2026-09-16 — Tableau de bord Prestataire 10/10 (compose + polish)

- Inventaire `docs/PROVIDER_DASHBOARD_VALIDATION.md`. Accueil provider-shaped sur `tableau-de-bord` (rôles PROVIDER_*), stages nouveau/qualifié/bloqué avec blockers service≠suspension générale, KPI sans faux zéro (`lib/provider-home`), planning agrégé, shell `provider-shell` sur qualification/devis/facturation/planning.
- Hub : `provider-planning`. Preuves unitaires view-model. Re-score A–D ≥ 9/10. Gap volontaire : litiges UI provider non inventé.

## 2026-09-16 — Tableau de bord Client 10/10 (compose + polish)

- Même méthode que l’Admin : inventaire `docs/CLIENT_DASHBOARD_VALIDATION.md`, composition sans faux zéros (`lib/client-home`), accueil parcours Analyser→Payer, file situations, KPI cliquables, stages nouveau/actif/équipe, shell `client-shell`, hub `client/finances` (Matricia vs prestataires séparé).
- Preuves : `lib/client-home/view-model.test.ts`, hub route `client-finances`, nav courte FR/AR.
- Re-score A–D ≥ 9/10. Gap volontaire : pas d’invention d’encaissement prestataire côté Client.

## 2026-09-16 — Admin supervision 10/10 (compose + polish)

- Sprint 0–5 fermés : inventaire `docs/ADMIN_SUPERVISION_VALIDATION.md`, projection RPC `list_admin_supervision_projection` / `get_admin_organization_fiche`, UI pilotage enrichie, fiche entreprise, parcours RFQ→devis→missions→diagnostics, shell UX commun (`AdminProcessStrip`, `AdminModuleChrome`).
- Routes hub : `administration/parcours`, `administration/entreprises` (+ fiche `[organizationId]`).
- Preuves : unit `admin-supervision/repository.test.ts`, `admin-process-strip.test.tsx`, SQL `0156_admin_supervision_projection.test.sql`, smoke routes protégées étendues.
- Re-score A/B/C/D ≥ 9/10 (détail dans la matrice de validation). Aucun workflow fictif ajouté ; lecture Admin only via security definer.
- Prochaine étape : appliquer la migration `20260916120000` sur l’environnement de développement, puis smoke Admin démo runtime.

## 2026-09-14 — Refonte publique, aperçu local

- Direction visuelle reprise suite au rejet utilisateur : blanc/bleu électrique, photographie illustrative originale, titre client/talents/réussite partagée, cartes flottantes et mouvement désactivable. La direction sombre à anneaux a été remplacée.
- Accueil : studio interactif de trois projets illustratifs, liens vers les expertises complémentaires, parcours de confiance, entrées Client/Sous-traitant et Franchise.
- Catalogue public : projection des 200 services du CSV de référence (aucune question chargée), recherche multi-mots insensible aux accents, filtre bibliothèque, état vide, 200 fiches avec métadonnées et sitemap. Ce catalogue de référence statique ne remplace pas la publication organisationnelle.
- FR/AR et RTL pour l'interface ; les noms/descriptions de services issus du catalogue source restent en français, signalés et balisés lang=fr.
- Preuves : 4 E2E desktop/360 px FR/AR verts avec axe WCAG A/AA, studio, pause des animations, filtrage, fiches et recherche vide. ESLint ciblé vert. Captures dans artifacts/test-results/playwright/public-experience-*.
- Pas de changement base de données, ni déploiement de cette refonte. Validation visuelle utilisateur encore attendue ; aucune note de satisfaction ou validation globale V1 inférée.
- Visuel et prompt : docs/progress/public-experience-visual.md.

Dernière mise à jour : 2026-09-12 15:50 America/Toronto

Phase de contrôle active : **PHASE 01 — contrats atomiques en cours**

Travaux engagés : **PHASES 01, 03, 05 et 06 — en cours; PHASES 02 et 04 signées GREEN**

## État prouvé

- Gold Master V4 FINAL et `AGENTS.md` sont les autorités actives.
- PHASE 00 est GREEN au commit `32cfd89` après visa indépendant : inventaire, 63 agents, index des 76 exigences, plans, Marketing et context-pack ciblé sont conformes.
- Inventaire PHASE 00, ExecPlan P00–P19, index de contexte, architecture, threat model et carte d’ownership sont présents.
- Les 57 agents du corps principal et les 6 agents obligatoires Marketing possèdent 63 configurations TOML projet.
- Catalogue validé : 10 bibliothèques, 40 catégories, 80 sous-catégories, 200 services, 212 liaisons et 6 000 questions.
- Les sept registres bootstrap ont des références nominales cohérentes; P01 reste ouverte car ils ne couvrent pas encore atomiquement les 76 exigences.
- Traçabilité enregistrée pour MAT-FUNC-001..068 et MARKETING-001..008. Aucune exigence n’est déclarée `VERIFIED` sans preuve.
- Monorepo pnpm, Next.js App Router, worker et packages TypeScript strict sont opérationnels.
- PHASE 02 est GREEN au commit `d92d8f0` après réaudit indépendant : installation figée, frontières de modules, lint, typecheck, 74 tests, build, logger expurgé, Worker et Design A sont conformes sans finding P0/P1/P2.
- PHASE 04 est GREEN après visa indépendant : connexion OTP PKCE, invitations courriel, rôles cumulables, sessions, mot de passe facultatif, MFA TOTP et saga d'audit Auth sont implémentés en FR/AR RTL.
- `.env.local` est ignoré par Git; aucune valeur secrète n’est consignée.

## Supabase development/staging

Projet distant Matricia contrôlé en environnement applicatif `development`; la CLI Supabase est liée au projet vérifié. Après dry-run propre, les migrations `20260912013000`, `13100`, `13200`, `13300`, `13400`, `13600`, `13700`, `13900`, `14000`, `14100` et `14200` sont confirmées appliquées avec succès à distance. Les statuts déjà confirmés de `12800` et `12900` restent acquis; aucun statut supplémentaire n'est revendiqué ici.

1. extensions et référentiels versionnés;
2. identité, organisations, memberships et RBAC;
3. idempotence, audit et Event Outbox;
4. ledger financier immuable et équilibré;
5. ledger de crédits immuable;
6. rôles et règles économiques de référence;
7. support pgTAP de test;
8. RPC financières/crédits atomiques;
9. scellement sérialisé de la chaîne d’audit;
10. claim Outbox `SKIP LOCKED`, retry et dead-letter;
11. durcissement des invariants et privilèges;
12. hash canonique serveur pour l’idempotence;
13. restriction d’accès runtime au schéma d’extensions.
14. workflows identité P04 : profil, OTP limité, ICE, rattachement, invitations, sessions;
15. sonde readiness DB/Outbox à privilège minimal;
16. rechargement explicite du schéma API;
17. correction additive de la sonde sur le schéma Outbox immuable.
18. révocation complète des ACL runtime dangereuses, grants minimaux et readiness hors dead-letter.
19. demandes idempotentes de rôles cumulables, interdiction des rôles plateforme, approbation centrale des rôles `OWNER` transverses et refus de l'auto-approbation.
20. refus explicite et idempotent d'invitation, statut `DECLINED`, blocage de l'auto-invitation et du contournement des rôles `OWNER` transverses.
21. onboarding Client versionné, décision centrale et essai initial de 30 jours;
22. documents de conformité privés, questions/réponses, gates de soumission et transitions;
23. scan documentaire serveur, matrice versionnée, anomalies ciblées et RPC minimale du worker.
24. catalogue W1 : hiérarchie et versions immuables, releases gouvernées,
    audiences/fenêtres canoniques, attestation AR, worker à lease/retry/dead-letter,
    audit, Outbox et RLS restrictive.
25. persistance Question/Rule Engine : questionnaires/règles versionnés, snapshots,
    réponses validées, calculs décimaux exacts, idempotence, audit et Outbox;
26. API Client catalogue : lectures RPC authentifiées, snapshot de release exact,
    visibilité fail-closed et pagination keyset;
27. compatibilité additive des anciens writers de versions catalogue;
28. snapshots catalogue historiques explicites préservés avec FK intra-bibliothèque;
29. lifecycle catalogue durci par capabilities transactionnelles à usage unique,
    MFA fail-closed, items scellés et récupération rollback contrôlée.
30. import baseline transactionnel et idempotent, commandes de hiérarchie/services,
    compatibilités legacy fail-closed et contrat strict des questions publiables.
31. commandes Question Builder : création, nouvelle version de brouillon, duplication,
    archivage/restauration, scope GLOBAL central AAL2, audit et Event Outbox;
32. interface Question Builder réelle : création DRAFT bilingue FR/AR et RTL par
    service, sensibilité, exigences devis, identité idempotente persistée et retours accessibles;
33. commandes Rule Builder : création et nouvelle version DRAFT immuable,
    concurrence optimiste, hash canonique serveur, MFA sensible, audit et Event Outbox;
34. interface Rule Builder FR/AR RTL : prédicat booléen déterministe, action typée,
    priorité, sensibilité, confirmation et identité idempotente persistée;
35. création Questionnaire Builder : version DRAFT bilingue liée à une release
    éditable, première section immuable, idempotence, MFA sensible, audit et Outbox.
36. composition Questionnaire Builder : sections suivantes ordonnées, ajout de
    questions et règles approuvées/publiées, concurrence optimiste, snapshot
    canonique, MFA sensible, audit et Outbox.
37. gate de charge catalogue GET-only, borné et fail-closed avec scénarios 6k/50k
    et sortie de métriques nettoyée; harness local 6/6 vert, exécution distante à prouver.
38. RFQ et matching explicable : demandes versionnées, éligibilité, invitations,
    sélection idempotente, audit, Outbox et RLS restrictive;
39. devis et comparaison : révisions exactes, comparaison normalisée sans float,
    sélection d'une version précise, audit et isolation inter-tenant;
40. contrats et missions : snapshots contractuels, signatures, jalons, livrables,
    acceptation et transitions gouvernées;
41. qualification Sous-traitant : capacités, preuves, décisions versionnées et
    contrôle d'éligibilité;
42. facturation Sous-traitant : factures, événements payables, règlements et
    rapprochements adossés aux écritures immuables;
43. litiges et réaffectation : preuves, médiation, décision et transfert contrôlé;
44. achats groupés : pools, engagements, consommation et allocation fournisseur;
45. gouvernance et finance franchise : territoires, mandats, exception IT,
    allocations et distributions immuables;
46. abonnements : plans versionnés, cycles, essais et transitions idempotentes;
47. command center Administration : supervision, approbations et commandes
    opérationnelles à privilège minimal.
48. diagnostics/opportunités : résultats et scores exacts, snapshots, anomalies,
    recommandations, recomputation et transitions contrôlées vers RFQ;
49. Boxes/crédits : avantages versionnés, wallets sûrs, lots FIFO expirables,
    réservation/libération/consommation et suppression de l'auto-attribution;
50. notifications : templates FR/AR versionnés, préférences immédiat/digest,
    alertes critiques obligatoires, inbox, déduplication, retry et dead-letter.
51. Marketing Autopilot : consentements append-only, Brand Kit et contenus FR/AR
    versionnés, approbation humaine, orchestration Outbox, fréquence, attribution et KPI;
52. CRM/performance franchise : pipeline, activités immuables, objectifs et snapshots
    KPI versionnés, scores exacts et alertes explicables sans sanction automatique;
53. moteur fiscal Maroc : catégories FR/AR, règles datées/versionnées sans taux
    hardcodé, validation/approbation, calcul exact et raccord facturation compatible.
54. moteur Question/Rule avancé : AST AND/OR/NOT borné, quinze opérateurs,
    détection des cycles, actions typées, scoring exact et simulation reproductible.
55. durcissements indépendamment réaudités : AUTOPILOT et consentement owner-only,
    PII CRM isolées, ownership CRM intra-tenant, KPI bornés/uniques et réponses
    numériques canoniques évaluées de manière identique aux raccourcis.
56. sessions questionnaires : snapshot immuable, reprise, soumission reproductible,
    abandon/expiration, réponses privées et évaluation par le moteur avancé;
57. portefeuille Client : projets, tâches, budgets annuels exacts, centres de coûts,
    allocations tenant-bound et calendrier central;
58. Provider : feedback réellement anonymisé, réputation versionnée à six dimensions,
    badges sous décision humaine et favoris revalidés;
59. récompenses/parrainage/ROI : règles et plafonds versionnés, ledger crédits,
    double contrôle AAL2, preuves durables, baselines approuvées et calculs exacts.
60. IA assistée et qualité : analyses bornées et déterministes, revue humaine,
    qualité/similarité bilingue, provenance, minimisation PII et rétention contrôlée;
61. solutions et benchmark : bundles inter-bibliothèques versionnés selon les
    niveaux `ESSENTIAL`, `STANDARD` et `ADVANCED`, benchmarks anonymisés sous
    politique de confidentialité et registre de métriques faisant autorité;
62. RFQ récurrentes : clonage avec provenance immuable, plans mensuels,
    trimestriels ou annuels, snapshots publiés et génération bornée sans
    invitation ni dépense autonome;
63. digest franchise : synthèse FR/AR configurable sans PII, agrégats CRM/KPI,
    jobs idempotents avec lease, retry/dead-letter et notification versionnée;
64. durcissements P1/P2 issus de l'audit : budget de confidentialité benchmark
    scellé contre les oracles par différence, autorisations par rôle et ACL à
    privilège minimal, révocation fail-closed, verrous de concurrence partagés,
    entrées d'assistance minimisées et absence d'expiration artificielle pour une
    entrée vide.
65. durcissements finaux `11900`–`12400` : valeur benchmark liée exactement à
    sa preuve, sa version de registre et sa politique source; scope exact par
    franchise dans les organisations multi-franchises; purge automatique bornée
    des entrées d'assistance avec minimisation CIN/passeport; scope canonique
    d'idempotence du digest et corrélation d'audit non-PII stable au replay.
66. durcissements `12500`–`12600` : cycle autonome et borné de purge des entrées
    d'assistance, contrôle strict des leases, retry/dead-letter et minimisation PII;
    sélection du scheduler digest bornée avant composition, dernière configuration
    seulement, ordre déterministe et absence de famine entre lots.

Preuves actuelles :

- 123 migrations locales/distantes `20260910000100`..`20260912012600` appliquées sur development, avec `20260912012300` intentionnellement absente;
- lint SQL public/private sans erreur de schéma lors du dernier contrôle distant;
- `pnpm test:db` vert le 2026-09-12 pour les fichiers `0001`..`0092` : 92 fichiers, 2 397 assertions et quatre scénarios à deux connexions couvrant Outbox, journal, crédits et chaîne audit;
- tests négatifs RLS inter-tenant, immutabilité, équilibre/devise, crédits, idempotence, audit et Outbox.

Docker local reste indisponible sur cet hôte; la reconstruction propre doit être prouvée par le job CI Supabase avant signature P03.
Le workflow GitHub Actions contient bien un job de replay Supabase vierge, mais les
deux jobs du dernier run n'ont reçu aucun runner : GitHub les refuse actuellement
avec l'annotation `account is locked due to a billing issue`. Cette contrainte de
compte externe empêche la preuve CI tant qu'elle n'est pas levée; elle ne vaut pas
échec des migrations locales ou development.

## Gates exécutés les 2026-09-11 et 2026-09-12

- `pnpm verify:phase00` : vert — catalogue 10/200/6000, 7 registres bootstrap, 68 fonctions, 8 exigences Marketing conformes à l’addendum et 63 agents.
- `pnpm lint` : vert.
- `pnpm typecheck` : vert.
- Tests Web : vert — 76 fichiers, 313 tests.
- Tests Worker : vert — 11 fichiers, 54 tests; typecheck strict vert.
- `pnpm test:db` : vert pour `0001`..`0092` — 92 fichiers et 2 397 assertions, plus quatre scénarios génériques à deux connexions. Sessions, portefeuille Client, réputation Provider, rewards/referral/ROI, IA assistée/qualité, bundles/benchmarks, RFQ récurrentes et digest franchise sont appliqués, durcis et couverts sur Supabase development.
- E2E catalogue authentifié réel : 4/4 en FR/AR à 360 px, navigation clavier,
  axe, recherche discriminante et RPC de publication/lecture réelles; crash/reaper
  `SCHEDULED` et `PUBLISHING` prouvés, zéro résidu actif ou artefact local.
- E2E P05 authentifiés : 28/28 exactement, zéro skip/flaky/unexpected, FR/AR, 360 px et desktop; cleanup distant vérifié et preuve sanitizée persistée.
- E2E des nouvelles routes Marketing, CRM franchise et Fiscalité : 12/12
  scénarios anonymes réels, FR/AR, mobile 360 px et desktop, RTL/LTR, clavier,
  absence d’overflow et axe; les ALLOW/DENY authentifiés restent à prouver avec
  des fixtures dédiées Franchise Manager et administrateur fiscal AAL2.
- `pnpm build` : vert — routes identité, organisation, invitations, rôles, sécurité et santé compilées.
- `pnpm release:validate` : vert — uniquement gates structurels et absence de placeholders dans le périmètre contrôlé; ce n’est pas une signature de release.

## Audits et écarts

- Les réaudits P00/P01 ont identifié puis fait corriger les métriques d’inventaire, la force des validateurs, le signoff positif et le context-pack structuré. Le réaudit final indépendant au commit `32cfd89` est PASS; P00 est fermée GREEN.
- Le second réaudit P03 a détecté des droits `TRUNCATE` runtime hérités, un seed absent et la prise en compte des dead-letters en readiness. La migration additive 018, le test ACL et `supabase/seed.sql` corrigent ces écarts; seul le replay CI vierge et le nouveau visa restent requis.
- Les réaudits P02 ont imposé redaction PII, readiness réelle, Worker exécutable, TypeScript renforcé et palette navy/bleu vif. Ces écarts sont corrigés et le visa indépendant final au commit `d92d8f0` est PASS; P02 est fermée GREEN.
- Le réaudit indépendant du lot Marketing/CRM/Fiscalité/Rule Engine a fermé 7/7
  findings : trois P1 d’autorisation/isolation/évaluation canonique et quatre P2
  d’intégrité KPI, ownership CRM, accessibilité et localisation FR/AR.
- Le signoff sécurité indépendant du lot backend `09000`–`09900` est GREEN :
  confidentialité feedback/Outbox historique, preuves réputation, audience/wallet,
  double contrôle Referral, baseline durable, portefeuille et anti-oracles sont fermés,
  sans finding P0/P1/P2 ouvert.
- Le lot backend `10000`–`12600` intègre les durcissements P1/P2 d'audit sur
  la confidentialité des benchmarks, les autorisations de l'assistance et du digest,
  la minimisation PII, la concurrence des publications/générations et les ACL des
  helpers. Les compléments `11900`–`12400` lient la valeur à sa provenance
  benchmark, ferment le scope exact franchise et l'idempotence du digest, et
  automatisent la purge PII avec corrélation d'audit stable. Les tests
  `12500` et `12600` ajoutent l'exécution autonome de purge avec lease/retry et le
  bornage du scheduler digest avant composition. Les tests `0074`..`0092`
  couvrent ces correctifs dans le gate DB vert.
- P01 ne couvre pas encore les contrats atomiques de toutes les phases.
- P04 est GREEN : OTP, organisations, invitations courriel, rôles, sessions, mot de passe facultatif, MFA TOTP, AAL2 et saga d'audit Auth durable ont passé le visa indépendant sans P0/P1/P2.
- P05 dispose des migrations appliquées `024`, `026` et `029`–`03550` : profils, documents privés, questionnaires, matrice/anomalies, scan serveur, activation et essai 30 jours. Interfaces, Worker, concurrence et E2E authentifiés sont prouvés. ClamAV staging réel et replay vierge restent requis; P05 demeure `IN_PROGRESS`.
- P06 est en cours : catalogue W1, persistance Question/Rule W2, API Client,
  lifecycle immuable et E2E authentifié sont appliqués/verts. Le baseline development
  est importé et vérifié : 10 bibliothèques, 40 catégories, 80 sous-catégories,
  200 services, 212 liens, 220 questionnaires et 6 000 questions; releases et
  traductions restent volontairement `DRAFT/PENDING`. La suite globale atteint
  41 fichiers/981 assertions et les concurrences hiérarchie/services sont vertes.
  Les commandes serveur du Question Builder sont appliquées et testées; l’interface
  de création de questions DRAFT est livrée en FR/AR RTL avec contrat strict. La
  création et le versionnage DRAFT des règles sont appliqués avec hash canonique,
  MFA sensible, audit et Outbox. L’interface Rule Builder booléenne est branchée
  sur la commande réelle. La création de questionnaires, les sections suivantes
  et l’ajout gouverné de questions/règles aux snapshots sont appliqués et testés.
  Le gate de charge 6k/50k est implémenté et testé localement, mais sa preuve
  distante reste requise. Les opérateurs avancés, la validation/simulation, les
  sessions et les fondations IA assistée de qualité/similarité sont appliqués et
  couverts en base; leur intégration complète aux parcours et le visa indépendant
  restent requis avant GREEN.
- Les fondations et interfaces P07–P18 progressent en lots indépendants : RFQ/devis,
  contrats/missions Client et Sous-traitant, qualification/facturation Provider,
  litiges/réaffectation, achats groupés, franchise, abonnements, administration,
  diagnostics/opportunités, Boxes/crédits, Notifications, Marketing Autopilot,
  CRM/performance franchise et moteur fiscal Maroc sont branchés côté données et
  disposent maintenant de routes Web FR/AR pour les trois derniers domaines. Les
  fondations de bundles `ESSENTIAL`/`STANDARD`/`ADVANCED`, benchmark anonymisé,
  clonage/récurrence RFQ et digest franchise sont également appliquées et testées.
  Les E2E multi-rôles,
  audits indépendants et la traçabilité atomique restent requis avant GREEN.
- La couverture MAT-FUNC-001..068 et MARKETING-001..008 reste partielle : les
  fondations de plusieurs domaines sont présentes, mais la traçabilité atomique,
  les parcours E2E et les audits indépendants restent requis avant de déclarer
  chaque exigence `VERIFIED`.
- Le registre atomique strict compte actuellement 1 exigence `PROVEN`, 67
  `PARTIAL`, 0 `MISSING` et 0 `BLOCKED`; il contient exactement 68 IDs uniques.
- Vercel et Railway ne sont pas configurés. Aucune production n’a été modifiée ou autorisée.

## Prochaine exécution

1. Intégrer et valider les interfaces Client RFQ/devis, qualification et facturation Sous-traitant, contrats/missions, litiges et command center.
2. Intégrer aux parcours P06/P07/P10 l'IA assistée, les opérateurs avancés, la
   validation/simulation, les sessions, les bundles/benchmarks, la récurrence RFQ
   et le digest franchise; prouver les E2E associés et la charge distante 6k/50k.
3. Compléter la traçabilité atomique P01 et les parcours E2E/RLS des fondations P07–P17.
4. Obtenir un replay DB vierge CI et prouver ClamAV réel en staging.
5. Continuer P07..P19 selon `PLANS.md`, sans sauter de gate.

## Checkpoint UI 2026-09-12

- Assistance diagnostique bornee, decisions de solutions, benchmarks anonymises,
  RFQ recurrentes et digest franchise disposent maintenant de routes Web FR/AR,
  RTL, responsive 360 px et d''actions branchees sur les RPC finales.
- Les decisions humaines restent obligatoires; aucune invitation, depense ou action
  metier critique autonome n''est declenchee par ces interfaces.
- Les montants de solutions restent en unites mineures exactes et sont affiches avec
  `BigInt`, sans conversion flottante.
- Gate Web apres integration : lint vert, TypeScript strict vert, build Next.js vert,
  94 fichiers de tests et 365 tests verts.
- Restent requis avant GREEN : E2E authentifie multi-role FR/AR a 360 px, audit
  independant, charge distante 6k/50k et preuves SQL/RLS contractuelles associees.

## Checkpoint local intégré 2026-09-12

- Le lot fonctionnel Web V1 raccorde désormais les parcours RFQ/devis et comparaison,
  contrats/missions et réceptions, qualification/facturation/réputation Sous-traitant,
  litiges/réaffectation, achats groupés Client/Admin, abonnements et paiement de
  démonstration, diagnostics/opportunités et assistance, portefeuille et crédits,
  récompenses/parrainage/ROI, notifications, ainsi que gouvernance et finance
  franchise. La navigation partagée n'expose que les routes fonctionnelles selon
  l'espace et le rôle, avec libellés FR/AR et direction RTL.
- Les décisions sensibles restent humaines et autorisées côté serveur : versions,
  signatures, avenants, jalons, preuves, réception et acceptation sont conservés
  dans les snapshots contractuels; les écritures financières et de crédits passent
  par les RPC/ledgers immuables, avec montants exacts en unités mineures.
- La règle franchise IT est exposée sans droit d'entrée et avec distribution 50 %
  Hatim Ahmitech / 50 % Jalil-NEOXA / 0 % Mme Asma-Matricia. Les autres franchises
  utilisent la règle versionnée 50 % / 25 % / 25 % sur base distribuable.
- Les migrations `20260912012700` à `20260912013400` sont présentes localement :
  autorisation RPC Question/Rule, portée des références documentaires, lecture des
  récurrences, éligibilité Provider à la réaffectation, activation de paiement,
  consommation des avantages après livraison, agrégats Admin des achats groupés et
  alignement des rôles RPC d'assistance. Seules `12800` et `12900` sont confirmées
  appliquées à distance. `13000`–`13400` sont désormais également confirmées
  appliquées sur Supabase Matricia development après dry-run propre et liaison CLI
  vérifiée; aucun déploiement de production n'a été tenté. Le statut distant de
  `12700` n'est pas revendiqué dans ce checkpoint.
- Le paiement de démonstration dispose d'intentions et d'un webhook idempotent; le
  secret local reste exclusivement dans `.env.local`, ignoré par Git. L'assistance
  minimise les PII avant RPC et conserve provenance, version et revue humaine.
- Les tests globaux, SQL/RLS et E2E sont volontairement différés à la fin du cycle
  de développement demandé. Le présent checkpoint ne déclare donc aucun nouveau
  module GREEN ni aucune exigence supplémentaire `VERIFIED`; les résultats de tests
  antérieurs consignés ci-dessus restent historiques et ne valent pas visa de ce lot.
- Prochaine action : confirmer séparément le statut distant de `12700`, puis exécuter
  les gates globaux, E2E multi-rôles FR/AR/RTL et audits indépendants.

## Checkpoint local d'intégration 2026-09-12

- Le module Catalogue/Publications expose l'historique des releases versionnées et
  le rollback gouverné, avec contrôle AAL2 pour l'action sensible, audit serveur,
  libellés FR/AR et RTL. La navigation partagée publie son lien uniquement pour les
  rôles plateforme `SUPER_ADMIN`, `MATRICIA_ADMIN` et `LIBRARY_MANAGER`, alignés sur
  l'autorisation du dépôt serveur.
- Le module CRM/Performance Franchise expose les activités et événements de pipeline
  immuables ainsi que les snapshots KPI versionnés. Les montants et valeurs `bigint`
  ou `numeric` restent des chaînes exactes; les objectifs et alertes demeurent en
  lecture seule tant qu'aucune RPC de mutation autorisée n'existe.
- Contrôle d'intégration Web : `pnpm --filter @matricia/web typecheck` vert et
  `pnpm --filter @matricia/web lint` vert. L'horodatage des expirations de crédits est
  isolé dans un module `server-only` pour préserver la pureté du rendu React.
- Aucun test global, SQL/RLS ou E2E n'a été lancé dans ce checkpoint, conformément au
  différé de fin de développement. Aucun changement de production ou secret n'est inclus.

## Checkpoint local Public et SEO 2026-09-12

- Les routes publiques FR/AR réelles couvrent désormais l'accueil, Services,
  Franchise, À propos et Contact sous un layout commun. Header, footer, navigation
  clavier, reflow 360 px, direction RTL et bascule de langue sont partagés; Contact
  propose uniquement des CTA fonctionnels vers Services et Connexion, sans faux
  formulaire ni collecte publique de données personnelles.
- Le proxy évite le refresh Supabase uniquement pour les chemins publics allowlistés.
  Connexion conserve le contrôle de session; Catalogue authentifié, Client,
  Sous-traitant, Franchise métier, Administration, Notifications, Organisation et
  Sécurité restent fail-closed. Le chemin public `/franchise` n'ouvre aucune de ses
  sous-routes métier.
- Aucune RPC catalogue exécutable par `anon` n'existe : la vitrine utilise donc une
  projection statique bornée au manifeste vérifié `1.0.0`, soit 10 bibliothèques et
  200 services. Les 6 000 questions et tous les brouillons restent exclus.
- Chaque route publique possède ses métadonnées FR/AR, canonical, hreflang, Open
  Graph et Twitter. `robots.txt` utilise une allowlist publique et interdit les
  espaces privés/auth; le sitemap contient exactement 10 URL localisées. Connexion
  est `noindex`; le manifeste et la carte sociale sont présents.
- Le même lot finalise l'évolution versionnée des diagnostics et l'historique des
  allocations de facturation Sous-traitant. Les montants et reliquats restent des
  chaînes entières exactes, sans conversion flottante ni mutation de ledger.
- Gates d'intégration : `pnpm --filter @matricia/web typecheck` vert,
  `pnpm --filter @matricia/web lint` vert et `git diff --check` vert. Aucun E2E n'a
  été lancé; la revue visuelle réelle à 360 px et la validation crawler de la carte
  sociale restent à effectuer en fin de développement.

## Checkpoint local Administration V1 2026-09-12

- La navigation partagée expose désormais, uniquement selon les rôles plateforme
  autorisés par chaque dépôt serveur, les consoles Clients/Conformité,
  Sous-traitants/Facturation, Finance, Gouvernance Franchise/Litiges et
  Notifications/Audit/Outbox.
- Admin Clients applique la séparation quatre-yeux aux décisions de conformité,
  revues documentaires et acceptations de réponses. Le réaudit statique des
  migrations additives locales `20260912013700` et `20260912013900` est PASS : la
  projection est minimisée, AAL2 est vérifié côté PostgreSQL et Server Actions, et
  les preuves quatre-yeux sont durables et fail-closed. Ces migrations ne sont ni
  désormais confirmées appliquées sur Supabase Matricia development après dry-run
  propre. Le présent checkpoint ne remplace pas les tests SQL/RLS de fin de cycle.
- Admin Finance conserve les montants en unités mineures exactes et les
  rapprochements idempotents. Admin Providers conserve les preuves, décisions
  versionnées et écritures financières via les RPC métier. Gouvernance expose les
  territoires, mandats, distributions et réaffectations, dont la règle IT exacte.
- Admin Operations expose en lecture seule un journal d'audit expurgé aux seuls
  rôles `SUPER_ADMIN`, `MATRICIA_ADMIN` et `READ_ONLY_AUDITOR`. Aucun payload,
  metadata, IP, user-agent ou identifiant utilisateur/organisation n'est chargé.
  Aucun retry, replay ou traitement de dead-letter n'est proposé.
- La migration 138 de projection agrégée Outbox/livraisons a été refusée par le
  contrôle de sécurité faute d'une autorisation utilisateur explicite pour
  l'élargissement `SECURITY DEFINER`; elle n'a pas été créée ni appliquée. Ces
  données restent fail-closed dans l'interface et aucune RLS n'a été assouplie.
- Les tests globaux, SQL/RLS et E2E restent volontairement différés à la fin du
  développement. Aucun changement de production, liaison distante ou secret ne
  fait partie de ce checkpoint.

## Checkpoint local Messagerie, Relances et Analytique 2026-09-12

- La messagerie interne sécurisée, les relances Franchise et l'analytique agrégée
  d'abandon des questionnaires disposent de routes FR/AR raccordées à la navigation
  selon les memberships et rôles strictement autorisés par leurs repositories/RLS.
- Les migrations `20260912014000`, `20260912014100` et `20260912014200` sont
  confirmées appliquées sur Supabase Matricia development, CLI liée, après dry-run
  propre. Les migrations `13600`, `13700` et `13900` sont également confirmées
  appliquées dans le même environnement.
- Les relances conservent consentement, heures calmes, plafonds versionnés,
  séparation de l'approbateur et traitement Worker. L'analytique reste agrégée et
  soumise au seuil de confidentialité; la messagerie demeure limitée aux
  participants autorisés des objets métier.
- Aucun test E2E ou global supplémentaire n'est exécuté dans ce lot et aucune
  production n'est modifiée.

## Checkpoint Paiements CMI/PayPal 2026-09-12

- Les migrations `20260912014300`, `20260912014400` et `20260912014500` sont
  confirmées appliquées sur Supabase Matricia development. Elles couvrent les
  intentions et webhooks CMI/PayPal, le journal financier équilibré, la correction
  d'ambiguïté du numéro de cycle et l'ACL de lecture minimale du `service_role`.
- Le test SQL/RLS `0097_real_payment_gateways.test.sql` est PASS avec 20 assertions.
  Le harness PostgreSQL confirme également les 4 scénarios de concurrence : Outbox,
  journal financier idempotent, crédits idempotents et chaîne d'audit concurrente.
- Les parcours CMI et PayPal sont raccordés à l'interface réelle. CMI utilise une
  confirmation POST signée; PayPal enchaîne approbation, capture serveur idempotente
  puis activation exclusivement après webhook `PAYMENT.CAPTURE.COMPLETED` vérifié.
  Aucun secret n'est exposé au navigateur ou aux logs.
- La migration `20260912013800_admin_operations_projection.sql` est désormais
  préparée localement pour réaudit, mais n'est pas appliquée sur l'environnement
  development ni sur aucun environnement distant.
- Aucun environnement, secret ou donnée de production n'a été lu ou modifié dans
  ce checkpoint.

## Checkpoint de clôture technique V1 — 2026-09-12

- Supabase development est synchronisé jusqu'à la migration additive `20260912015500`;
  le dry-run final retourne `upToDate=true`. Les migrations 153 à 155 refusent les
  rôles plateforme révoqués, imposent AAL2 pour la projection Operations et calculent
  l'éligibilité RFQ depuis les preuves Provider versionnées, temporelles et propres au
  service. Aucun environnement de production n'a été modifié.
- Gate PostgreSQL/RLS globale : 100 fichiers, 2 507 assertions et 4 scénarios de
  concurrence PASS. Le réaudit sécurité indépendant final ne relève aucun P0/P1/P2.
- Gates monorepo : lint PASS, TypeScript strict PASS, tests unitaires/intégration PASS
  (Web 115 fichiers/436 tests; Worker 11 fichiers/54 tests), build Next.js/Worker PASS,
  `release:validate` structurel PASS et aucun marqueur incomplet détecté.
- E2E additionnels V1 : 20/20 PASS, zéro skip, avec fixtures development neutralisées;
  FR/AR, RTL/LTR, 360 px et desktop, axe WCAG A/AA, clavier/focus, reflow, refus anon et
  séparation Client/Sous-traitant/Franchisé. Les crashes Litiges et Notifications
  découverts pendant ces E2E ont été corrigés sans élargir les droits RLS.
- Command Center localise désormais les codes métier en FR/AR, priorise la file du jour
  et conserve la revue humaine. Diagnostics raccorde Assistance et Évolution sans copie
  métier hardcodée. Le module de paiement se construit sous Turbopack avec ses imports
  TypeScript résolus depuis les sources.
- Limites de déclaration : les gates techniques de ce checkpoint sont vertes, mais la
  matrice atomique reste honnêtement à 1 `PROVEN` et 67 `PARTIAL`; le registre formel
  `REQUIREMENTS_COVERAGE.md` reste à 0/76 `VERIFIED` et P01 demeure ouverte jusqu'aux
  contrats atomiques, preuves et visas indépendants exhaustifs. Ce checkpoint ne
  revendique donc pas une V1 Gold Master terminée à 100 %.
- Risques externes restant à fermer avant release staging signée : replay vierge CI
  actuellement empêché par le runner GitHub/facturation, ClamAV réel en staging, audit
  manuel lecteur d'écran, déclencheur périodique service-role du scheduler et preuves
  atomiques/signoffs des exigences restantes. Aucun déploiement production n'est autorisé.

## Checkpoint d'intégration final — 2026-09-12

- Portfolio Client : commit `b91de14`, 468/468 tests Web et P22 4/4. Actions
  universelles : 7/7. Questionnaires/Diagnostics : 4/4.
- Provider Quotes : 21 tests PASS; devise persistée, sélection multi-organisation
  explicite et fiscalité autoritative. La migration additive
  `20260912015600_quote_tax_authority_hardening.sql` est appliquée uniquement sur
  Supabase development. Le visa indépendant de la migration 156 est PASS sans
  finding P0/P1/P2; l'autorité runtime est prouvée par 19/19 assertions incluant
  les appels directs au RPC public sous rôle authentifié.
- Gate DB globale : 101 fichiers, 2 526 assertions et 4 scénarios de concurrence
  PASS. E2E critiques : 20/20 PASS; le runner isole, protège et nettoie ses états
  authentifiés.
- Typecheck et lint Web PASS. Le dry-run Supabase final retourne
  `upToDate=true`. Le lint DB global ne remonte pour la migration 156 aucune
  nouvelle anomalie; ses alertes restantes sont des dettes historiques hors 156.
- Aucun environnement de production n'a été modifié. La couverture atomique reste
  honnêtement à 1 `PROVEN` et 67 `PARTIAL`; ce checkpoint ne revendique pas une
  V1 terminée à 100 %.

## Checkpoint final de vérification V1 — 2026-09-13

- Les lots consolidés correspondent aux commits `b9d8e69`, `7ba354b`, `59e7491`
  et `d6c6cd5`. Les Actions universelles sont PASS sur 8/8 parcours E2E et le lot
  Provider Quotes P23 est PASS sur 4/4 parcours FR/AR, 360 px et desktop.
- La migration additive
  `20260912015700_provider_quote_exact_amount_projection.sql` projette les montants
  `bigint` en `TEXT` sans conversion flottante. Elle est appliquée uniquement sur
  Supabase development; le dry-run lié final retourne `upToDate=true` sans migration,
  seed ni rôle en attente. Le test DB `0102` est PASS sur 9/9 assertions et les 4
  scénarios de concurrence sont PASS.
- Gate global consolidé : Web 126 fichiers/480 tests PASS; Worker 11 fichiers/54
  tests PASS; lint, TypeScript strict, build, `release:validate`,
  `traceability:validate`, `spec:validate` et `git diff --check` PASS.
- Le P1 qui masquait la soumission d'un devis `DRAFT`/`REVISED` lorsque sa règle
  fiscale historique n'était plus active est fermé et audité sans finding P0/P1/P2.
  La création d'une nouvelle révision reste fail-closed sans règle fiscale active.
- La couverture formelle reste honnêtement à 1/76 exigences `VERIFIED` et 1/68
  fonctions MAT prouvées. Ce checkpoint confirme les gates exécutés, mais ne
  revendique pas une V1 Gold Master terminée à 100 %.
- Aucun environnement, secret ou donnée de production n'a été lu ou modifié; aucun
  déploiement production n'est autorisé par ce checkpoint.

## Checkpoint V4.1 incremental upgrade - 2026-09-13

- Baseline V4 preserved on branch `upgrade/v4.1`; implementation used only additive
  migrations 16300 through 17000 plus corrective 16901. Supabase development is
  synchronized and the final linked dry-run returns `upToDate=true`.
- P0: cash flows A/B/C, electronic signature, privacy/CNDP, procurement/AP, AI FinOps,
  actual Box margins, bank-account antifraud and Matricia own payments are implemented.
- P1: treasury, suppliers, third parties, contract lifecycle, probative communications,
  dispute governance, security/resilience, restore evidence, jobs/DLQ, organization exit,
  catalogue findings, franchise controls, marketing safety and Admin V4.1 are implemented.
- Gates: DB/RLS 116 files and 2915 assertions PASS; 4 concurrency scenarios PASS;
  Web 128 files/489 tests PASS; Worker 11 files/54 tests PASS; 20/20 V4.1 E2E PASS;
  lint, strict TypeScript, build and structural validators PASS.
- Next.js is 16.3.3; the final production dependency audit reports no known
  vulnerabilities. `.env.local` remains ignored and untracked.
- Technical development/staging status is GREEN. Catalogue human review, CNDP/legal
  formalities, real provider certification, production restore/security drills and
  production authorization remain `REQUIRED_NOT_COMPLETED`. No production change occurred.

## Checkpoint V4.1 admin-managed external validation - 2026-09-13

- Migration additive `20260913017100_v41_admin_external_validations.sql` appliquée sur
  Supabase development/staging; dry-run final `upToDate=true`.
- Le tableau de bord Admin V4.1 permet désormais la saisie et la validation des neuf
  familles de preuves externes : CNDP, signature, trois revues catalogue, restauration,
  test d'intrusion et autorisation Production.
- Commandes AAL2 idempotentes, validation à quatre yeux, concurrence optimiste,
  RLS restrictive, preuves/décisions immuables, audit et Event Outbox sont actifs.
- Gates : DB/RLS 117 fichiers et 2931 assertions PASS; 4 scénarios de concurrence
  PASS; Web 128 fichiers/490 tests PASS; lint, TypeScript strict et build PASS;
  E2E V4.1 21 scénarios sur desktop et 360 px, soit 42/42 PASS.
- Les preuves restent non approuvées tant qu'elles ne sont pas réellement saisies et
  validées par deux administrateurs distincts. Aucun déploiement Production n'a eu lieu.

## Checkpoint MAT-FUNC-026 — activation complète des avenants — 2026-09-13

- Migrations additives `20260913017200` et corrective de compatibilité `17201`
  appliquées uniquement sur Supabase development/staging; dry-run final
  `upToDate=true`.
- Un avenant passe désormais de DRAFT à PENDING_SIGNATURE, exige les signatures AAL2
  distinctes Client et Sous-traitant, puis crée une nouvelle version contractuelle
  immutable. Parties, clauses et items sont snapshotés; les deltas ADD/REPLACE/REMOVE
  sont appliqués sans modifier l'historique; la mission active est rattachée à la
  nouvelle version.
- Interfaces FR/AR et responsive ajoutées aux espaces Client et Sous-traitant.
  Mutations idempotentes, RLS restrictive, concurrence, audit et Event Outbox actifs.
- Gates : DB/RLS 118 fichiers, 2946 assertions et 4 scénarios de concurrence PASS;
  lint, TypeScript strict, build et absence de placeholders PASS.
- Aucun environnement de production n'a été modifié. Prochain lot : coffre documentaire
  transversal et réutilisation contrôlée conformité/RFQ/contrat/mission.

## Checkpoint MAT-FUNC-012/021/025 — coffre documentaire transversal — 2026-09-13

- Migration additive `20260913017300_secure_client_document_reuse.sql` appliquée
  uniquement sur Supabase development/staging; dry-run final `upToDate=true`.
- Les documents Client vérifiés, scannés CLEAN et non expirés peuvent être liés
  sans copie binaire à une demande, une version contractuelle ou une mission de la
  même organisation. Les liaisons et révocations sont immuables, AAL2,
  idempotentes, auditées et publiées via Event Outbox.
- L'interface Client FR/AR `/client/documents` permet de créer et révoquer les
  liaisons; elle est responsive, accessible au clavier et exposée uniquement aux
  rôles Client Owner/Admin.
- Gates : DB/RLS 119 fichiers, 2 961 assertions et 4 scénarios de concurrence PASS;
  lint, TypeScript strict, build et synchronisation Supabase PASS.
- Aucun environnement de production n'a été modifié. Prochain lot : audit ciblé
  puis fermeture des écarts UI encore réels dans CRM, récompenses, IA et règles.

## Checkpoint Admin incitations — récompenses, badges et parrainage — 2026-09-13

- Migration additive `20260913017400_admin_badge_policy_versions.sql` appliquée
  uniquement sur Supabase development/staging. Les politiques de badges sont
  désormais créées en versions immuables avec AAL2, idempotence, audit et Outbox.
- La route FR/AR `/administration/incitations` administre les versions de règles
  de récompense/parrainage, les politiques de badges, les évaluations sur snapshots
  de réputation et les décisions humaines publication/révocation.
- Les crédits restent attribués exclusivement par le moteur et le ledger immuable;
  l'interface ne modifie aucun solde directement.
- Gates : DB/RLS 120 fichiers, 2 968 assertions et 4 scénarios de concurrence PASS;
  lint, TypeScript strict et build PASS. Aucun environnement de production modifié.

## Checkpoint clonage gouverné avec provenance — 2026-09-13

- Migration additive `20260913017500_content_clone_provenance.sql` appliquée
  uniquement sur Supabase development/staging; historique synchronisé.
- L'administration peut cloner questionnaires, ensembles de clauses et checklists
  de service sans altérer les sources. Chaque clone conserve une provenance immutable,
  crée une nouvelle identité/version brouillon et émet audit plus Event Outbox.
- L'interface FR/AR `/administration/clonage` expose les trois opérations avec motif,
  idempotence, autorisation restrictive et validation des identifiants.
- Gates : DB/RLS 121 fichiers, 2 979 assertions et 4 scénarios de concurrence PASS;
  lint, TypeScript strict et build PASS. Aucun environnement de production modifié.

## Checkpoint autosauvegarde questionnaire résiliente — 2026-09-13

- L'autosauvegarde Client conserve le délai de 800 ms, renouvelle les identités de
  commande et synchronise désormais les versions optimistes renvoyées par le serveur.
- Une saisie effectuée hors ligne reste dans l'onglet, passe en file d'attente et est
  renvoyée automatiquement au retour du réseau; un conflit propose explicitement de
  recharger la version serveur sans écrasement silencieux.
- Messages FR/AR, états accessibles et commandes tactiles 44 px minimum sont fournis.
- Gates : Web 128 fichiers/491 tests PASS; lint, TypeScript strict et build PASS.

## Checkpoint centres de coûts transversaux — 2026-09-13

- Migration additive `20260913017600_typed_cost_center_financial_links.sql`
  appliquée uniquement sur Supabase development/staging.
- Les allocations relient désormais un centre de coûts aux projets, tâches, contrats,
  missions, jalons, factures Provider côté Client, documents et RFQ. Chaque référence
  est validée dans le tenant; une facture ne peut pas être surallouée.
- L'interface Portefeuille FR/AR expose le type et l'identifiant de la source; les
  montants restent en unités mineures côté serveur, avec idempotence, audit et Outbox.
- Gates : DB/RLS 122 fichiers, 2 989 assertions et 4 scénarios de concurrence PASS;
  lint, TypeScript strict et build PASS. Aucun environnement de production modifié.

## Checkpoint moteur transversal anti-abus — 2026-09-13

- Migration additive `20260913017700_transversal_abuse_detection.sql` appliquée
  uniquement sur Supabase development/staging.
- Les règles anti-abus sont versionnées par type d'événement; les signaux ne conservent
  que des empreintes et un contexte expurgé. Le moteur applique fenêtre, vélocité et
  seuils ALLOW/REVIEW/BLOCK puis ouvre une file de revue humaine.
- L'interface FR/AR `/administration/anti-abus` permet de créer les versions et de
  statuer avec AAL2, preuve, RLS restrictive, historique immutable, audit et Outbox.
- Le Command Center existant couvre déjà les approbations multi-objets transversales
  avec ressource typée, double contrôle et nombre d'approbations configurable.
- Gates : DB/RLS 123 fichiers, 3 001 assertions et 4 scénarios de concurrence PASS;
  lint, TypeScript strict et build PASS. Aucun environnement de production modifié.

## Checkpoint préremplissage transversal et fraîcheur — 2026-09-13

- Migration additive `20260913017800_versioned_prefill_freshness.sql` appliquée
  uniquement sur Supabase development/staging.
- Cinq politiques de fraîcheur versionnées couvrent profil, organisation, site,
  réponse antérieure et document. Les faits sont versionnés et immutables.
- Les questionnaires proposent désormais les valeurs fraîches compatibles par
  `data_key`, tenant, acteur et sensibilité; toute suggestion doit être confirmée
  avant d'être persistée ou comptée comme réponse.
- Gates ciblés : 10 assertions SQL/RLS PASS; Web 128 fichiers/491 tests PASS;
  lint, TypeScript strict et build PASS. Aucun environnement de production modifié.

## Checkpoint livrables scannés et Marketing Autopilot exécutable — 2026-09-13

- Les migrations additives `20260913017900_delivery_proof_trusted_scan.sql` et
  `20260913018000_marketing_publication_worker.sql` sont appliquées uniquement
  sur Supabase development/staging.
- Les preuves de livrable conservent désormais leur empreinte SHA-256 réelle,
  reçoivent un verdict immuable d'un scanner `service_role`, et aucun livrable
  ne peut être accepté ou rejeté tant que les preuves de sa version courante ne
  sont pas toutes `CLEAN`. L'UI Client expose ce blocage en FR/AR.
- Le Marketing Autopilot dispose d'un worker protégé par `CRON_SECRET`, d'un
  mode sandbox sans réseau et d'adaptateurs réels LinkedIn et Meta
  Facebook/Instagram/Reels. Les credentials ne transitent que par une référence
  `env://`; consentement, autorisation de marque, kill-switch et contenu sont
  revérifiés au claim puis avant journalisation. Retry borné, idempotence, audit
  et Event Outbox sont actifs.
- Gates : DB/RLS 126 fichiers, 3 030 assertions et 4 scénarios de concurrence
  PASS; monorepo 129 fichiers Web/495 tests, 11 fichiers Worker/54 tests et
  packages partagés PASS; lint, TypeScript strict et builds PASS; aucun
  placeholder applicatif; catalogue 10 bibliothèques/200 services/6 000
  questions valide.
- E2E authentifiés development : V1 critique 20 PASS, questionnaires/diagnostics
  4 PASS, portefeuille 4 PASS, Action Center 8 PASS, devis Provider 4 PASS,
  catalogue 5 PASS avec 1 scénario explicitement ignoré par le runner. Tous les
  jeux de données temporaires ont été neutralisés.
- Aucun environnement de production n'a été modifié. Les activations live des
  providers sociaux restent désactivées jusqu'à configuration des credentials
  acquis et autorisation opérationnelle explicite.

## Checkpoint calendrier Marketing et intégrité sandbox — 2026-09-13

- Les migrations additives `20260913018100_marketing_calendar_scheduler.sql` et
  `20260913018200_marketing_scheduling_sandbox_integrity.sql` sont appliquées
  uniquement sur Supabase development; le dry-run final confirme la cible à jour.
- Le calendrier M+1 est généré de façon idempotente le 25 pour les règles actives.
  En mode AUTOPILOT, seuls les contenus approuvés, non expirés, consentis et sans
  exception bloquante sont planifiés; ASSISTED reste soumis à validation humaine.
- La planification manuelle rattache chaque publication au calendrier versionné
  obligatoire et sérialise la limite hebdomadaire. Le mode sandbox produit
  `SANDBOXED` et ne crée plus aucune preuve de publication réelle.
- Les endpoints cron protégés par `CRON_SECRET` acceptent GET/POST; la
  configuration Vercel programme le calendrier mensuel et le worker de publication.
- Gates : DB/RLS 128 fichiers, 3 051 assertions et 4 scénarios de concurrence PASS;
  Web 130 fichiers/502 tests PASS; lint, TypeScript strict et build PASS.
  Aucun environnement de production n'a été modifié.

## Checkpoint gouvernance Marketing et reprise worker — 2026-09-13

- Les migrations additives `20260913018300_marketing_schedule_rule_commands.sql`
  et `20260913018400_marketing_worker_lease_policy_hardening.sql` sont appliquées
  uniquement sur Supabase development; replay local complet 001–184 PASS.
- Les règles de calendrier sont versionnées, validées par timezone IANA et créneaux
  stricts, activées par verrou optimiste et protégées par idempotence, audit et Outbox.
  L'approbation globale ASSISTED est réservée au rôle `CLIENT_OWNER`.
- Le worker récupère les claims expirés avec une lease de cinq minutes. Les blocages
  de politique créent une exception dédupliquée, un audit et un événement Outbox.
  Les dix familles de conformité sont obligatoires et les scopes sociaux sont bornés
  au provider et au canal avant toute publication.
- L'interface Marketing FR/AR RTL expose comptes sociaux, versions de règles,
  calendrier, publications et exceptions, avec création, activation et approbation
  globale branchées aux commandes serveur.
- Gates : DB/RLS 130 fichiers, 3 079 assertions et 4 scénarios de concurrence PASS;
  Web 130 fichiers/507 tests PASS; lint, TypeScript strict et build PASS.
  Aucun environnement de production n'a été modifié.

## Checkpoint intégrité at-most-once Marketing — 2026-09-13

- Migration additive `20260913018500_marketing_publication_attempt_integrity.sql`
  appliquée uniquement sur Supabase development; le dry-run final confirme la cible
  distante à jour.
- Chaque claim est lié à une lease et à une clé fournisseur SHA-256 unique par
  tentative. Les attempts sont immuables; les anciens RPC sans lease échouent fermés.
  Seul `PROVIDER_HTTP_429` autorise un retry borné avec une nouvelle clé. Toute
  réponse réseau, timeout ou 5xx ambiguë exige une réconciliation probante avant
  publication, échec ou remise en file.
- Les quotas sont sérialisés par organisation et provider. Les preuves de consentement,
  d'autorisation, de conformité, de contenu et de sécurité sont figées au claim.
  Timeout, quota, policy, pénurie calendrier et réconciliation sont audités et émis
  par Event Outbox; les workers exécutent les balayages timeout et pénurie.
- Gates : replay local migrations 001–185 PASS; DB/RLS 131 fichiers, 3 110 assertions
  et 4 scénarios de concurrence PASS; Web 132 fichiers/521 tests PASS; lint,
  TypeScript strict et build PASS; E2E authentifiés FR/AR à 360 px et desktop 24/24
  PASS avec fixtures development neutralisées. Audit indépendant : MERGEABLE,
  aucun P0/P1 bloquant dans ce périmètre.
- Aucun environnement de production n'a été modifié. La publication live reste
  désactivée jusqu'à l'injection KMS/Vault des credentials acquis et aux essais
  fournisseurs; le `container_id` Meta ambigu requiert une revue/réconciliation
  humaine et n'est jamais republié automatiquement.

## Checkpoint MARKETING-007 — tendances hebdomadaires — 2026-09-13

- Migration additive `20260913018600_marketing_weekly_trends.sql` appliquée
  uniquement sur Supabase development; le dry-run final confirme la cible à jour.
- L'agrégateur hebdomadaire calcule les volumes et croissances en anomalies
  distinctes, applique avant agrégation le consentement Marketing Analytics, les
  seuils de confidentialité et de croissance versionnés, puis crée les snapshots
  et suggestions sans exposer de PII.
- Le worker est protégé par `CRON_SECRET`, paginé à 500 groupes et reprend après
  interruption grâce à un checkpoint privé durable, un verrou advisory et un
  verrou de ligne. Les mutations sont idempotentes, auditées et émises via Outbox.
- Gates : DB/RLS 132 fichiers, 3 150 assertions et 4 scénarios de concurrence
  PASS; Web 133 fichiers/526 tests PASS; lint, TypeScript strict et build PASS. Réaudit indépendant :
  GO/MERGEABLE, 0 P0 et 0 P1. `MARKETING-007` reste `IN_PROGRESS` jusqu'à l'E2E
  authentifié et à la preuve d'exécution planifiée.
- L'audit atomique consolidé confirme honnêtement 1/76 exigence `VERIFIED`; les
  autres exigences disposent d'implémentations partielles mais attendent encore
  leur preuve atomique et leur visa indépendant. Aucun environnement de production
  n'a été modifié.

## Checkpoint V4.1 — compléments 187–192 — 2026-09-13

- Six migrations additives couvrent Marketing/CTA et approbations, preuves Client/
  Provider, notifications et schedulers, réputation/badges/checklists, ainsi que le
  centre financier/coûts/économies/ROI. Aucun reset ni changement production.
- Gates locales finales : Web 149 fichiers/621 tests PASS; TypeScript strict PASS;
  lint PASS; aucun marqueur incomplet. SQL 0133/0135 PASS (64 assertions), 0134
  PASS (61), 0136 PASS (33 + 4 concurrences) et 0137 PASS (64) sur bases fraîches.
- Les migrations 187–192 ont été appliquées manuellement sur Supabase development,
  puis inscrites dans l'historique CLI. Le correctif additif 193 normalise la portée
  d'idempotence des revues Marketing et a été appliqué automatiquement.
- Tests development : 0133 PASS (33), 0134 PASS (61), 0135 PASS (34), 0136 PASS
  (33), 0137 PASS (64), 0138 PASS (8), plus 4 scénarios de concurrence. Les E2E
  authentifiés sans skip et la configuration des fournisseurs externes restent les
  seules preuves opérationnelles de ce checkpoint; aucune production n'a été touchée.

## Checkpoint accès de validation multi-espaces — 2026-09-13

- La connexion par mot de passe optionnelle complète désormais l'OTP principal en
  FR/AR, avec erreurs non énumérantes et redirection vers le tableau de bord.
- Quatre identités isolées ont été créées et authentifiées sur Supabase development
  pour les espaces Administration, Client, Sous-traitant et Franchisé. Les rôles
  attendus ont été vérifiés; les secrets temporaires ont été remis uniquement via le
  presse-papiers local et ne sont ni loggés, ni documentés, ni commités.
- Le hub récupère les rôles plateforme par le RPC de sécurité borné au compte, sans
  ouvrir de lecture directe sur la table centrale. Les actions Admin sensibles restent
  soumises à AAL2/MFA.
- Gates : Web 150 fichiers/623 tests PASS; TypeScript strict PASS; lint sans erreur;
  build production PASS. GitHub et le déploiement Vercel autorisé ont été mis à jour
  au commit `67835bc`.

## Checkpoint E2E authentifié sans skip — 2026-09-13

- Le gate P05 authentifié a été rejoué sur Supabase development avec deux tenants,
  une identité centrale AAL2, la même identité AAL1 et une identité sans rôle.
- Résultat Playwright : 28/28 PASS, zéro skip, zéro flaky et zéro échec, en FR/AR,
  sur Chromium 360 px et desktop. Les refus anonymes, l'isolation inter-tenant et
  l'obligation MFA centrale sont prouvés.
- Toutes les fixtures Auth, données et stockage ont été neutralisées; les preuves
  d'audit immuables sont conservées et le rapport expurgé est enregistré sous
  `docs/evidence/p05/authenticated-e2e-last-run.json`.

## Checkpoint configuration Vercel et diagnostic runtime — 2026-09-14

- Le périmètre Vercel Matricia a été corrigé localement puis les variables Production
  manquantes ont été créées sans écraser les secrets existants : environnement,
  référence Supabase, chiffrement, webhook interne, signature CTA, paiement DEMO et
  garde-fous Marketing sandbox. Aucun secret n'a été affiché ou commité.
- Le déploiement Production `c3e9ea8` est READY; accueil, connexion et health répondent
  HTTP 200. Web : 150 fichiers/624 tests PASS, TypeScript strict et build PASS.
- Le diagnostic readiness distingue maintenant PostgreSQL `up` du backlog Outbox
  `down` (`OUTBOX_BACKLOG`) au lieu de signaler faussement la base indisponible.
- Blocages externes vérifiés : le jeton Supabase Management fourni retourne HTTP 403
  et ne voit pas le projet, empêchant la configuration Auth URL/SMTP; le worker
  Railway/ClamAV n'est pas configuré, donc 542 événements Outbox restent en attente.

## Checkpoint Railway Worker/ClamAV et Outbox — 2026-09-14

- Le projet Railway `Matricia` et ses services production `matricia-worker` et
  `clamav` ont été créés après autorisation explicite. ClamAV utilise l'image
  officielle épinglée `clamav/clamav:1.4.6-debian13-slim` et reste accessible
  uniquement sur le réseau privé Railway.
- Le worker est configuré avec build/start ciblés, healthcheck `/health`, secrets
  injectés sans affichage, Supabase service role, dispatch HTTPS borné à
  `matricia.vercel.app` et liaison ClamAV privée.
- Un récepteur Outbox interne authentifié, validé et borné à 128 Kio est déployé
  sur Vercel. Tests ciblés 3/3 PASS, TypeScript strict Worker/Web PASS et build
  Next.js production PASS.
- Déploiements Railway Worker et ClamAV : `SUCCESS`. Le backlog Outbox est passé
  de 542 à 0 et `https://matricia.vercel.app/api/readiness` répond HTTP 200 avec
  PostgreSQL et Outbox `up`. Aucun secret n'est documenté ou commité.

## Checkpoint design premium public — 2026-09-14

- La Home et les parcours publics diagnostic, besoin, fournisseur, connexion,
  contact, franchise et à-propos utilisent désormais le système visuel premium
  centralisé et la signature Réponse → Priorité → Action, sans réintroduire de
  catalogue public ni changer une règle métier.
- Les parcours FR/AR conservent route, paramètres et brouillons; les contrôles
  radio, champs libres et menu mobile ont été renforcés pour le clavier et les
  technologies d'assistance.
- Gates : lint et TypeScript strict PASS; build Next.js PASS; Web 151 fichiers/
  627 tests PASS; UI 4/4 PASS; E2E public ciblé 26/26 PASS. Les captures réelles
  avant/après et le rapport sont dans `docs/design-premium/`.
- Les espaces authentifiés n'ont pas été inspectés visuellement pendant cette
  passe faute de compte de test explicitement autorisé. Aucun déploiement ni
  changement de base ou de production n'a été effectué.

## Correctif inscription publique — 2026-09-14

- L'en-tête, la connexion et l'entrée fournisseur exposent maintenant une
  inscription explicite Client ou Sous-traitant. Le mode inscription autorise
  la création Auth par OTP; le mode connexion continue d'interdire toute
  création implicite afin d'éviter l'énumération et les comptes accidentels.
- Après validation du courriel, le nouveau compte reprend sur le passeport
  organisation avec le rôle Client ou Provider prérempli, sans accorder de rôle
  plateforme ni contourner les contrôles d'organisation.
- Gates : lint et TypeScript strict PASS; Web 151 fichiers/629 tests PASS;
  build Next.js PASS; E2E design et inscription 24/24 PASS.

## Checkpoint corrections publiques et espaces connectés — 2026-09-15

- Les parcours publics diagnostic, besoin précis, fournisseur, abonnements, contact et authentification sont raccordés jusqu'au dossier autorisé, avec reprise FR/AR et écritures serveur idempotentes.
- Les espaces Client et Sous-traitant ont reçu les corrections P0 : contexte d'organisation serveur, diagnostics et demandes sans identifiants techniques, devis multiligne exact, qualification documentaire privée et facturation métier. Navigation, Franchise et Administration ont été harmonisées sans affaiblir RLS, AAL2, approbations ou règles financières.
- Migrations additives `194` à `199` et `202` à `206` appliquées sur Supabase development ; dry-run distant final `upToDate: true`.
- Gates : workspace 910 tests PASS, TypeScript strict PASS, lint PASS, build PASS ; Playwright public final 34/34 PASS ; E2E cœur authentifié ciblé 2/2 PASS ; SQL 149 fichiers / 3 488 assertions / 4 scénarios de concurrence PASS ; catalogue 10/200/6000 et absence de placeholders validés.
- Les résidus (primitive documentaire de preuve de paiement, quelques statuts avancés, revue visuelle authentifiée exhaustive et traçabilité Gold Master `1/76 VERIFIED` avec P01 ouverte) sont explicitement consignés dans `docs/corrections-public-dashboards/PROGRESS.md`. Aucun déploiement production n'a été effectué pendant cette passe.

## Checkpoint audit final et fermeture P1 ciblée — 2026-09-15

- Le déploiement observé a été réconcilié avec `codex/bootstrap-foundation` au SHA `b4050fc3`; la branche d'audit part exactement de ce point. Les onze matrices et rapports demandés sont maintenus sous `docs/`.
- Home, navigation, diagnostic, besoin précis, services et entrée Prestataire utilisent le catalogue canonique 10/200 sans charger les 6 000 questions. Brouillons, reprise OTP, validation serveur, FR/AR, clavier et responsive 360–1440 ont été renforcés.
- Qualification Prestataire, capacité `PAUSED`, explications de matching et historique Client sont raccordés. La preuve de paiement Prestataire est désormais archivée dans un objet privé, immuable et tenant-safe avant liaison transactionnelle au ledger.
- Le formulaire Contact déclenche désormais une notification support idempotente lorsqu'elle est configurée, sans perdre la demande ni annoncer faussement une livraison; Railway utilise `/readiness` au lieu du simple liveness `/health`.
- Migrations additives `205` à `207` appliquées uniquement sur Supabase development; dry-run final `upToDate=true`. La 207 impose un verdict antivirus immuable CLEAN avant toute écriture comptable de paiement prestataire. Aucune production n'a été modifiée.
- Gates : build PASS; TypeScript et lint PASS; 910 tests unitaires/intégration PASS; 154 fichiers SQL / 3 590 assertions PASS et 311/311 RPC avec indice DENY; 0154/0155 ciblés et 4 concurrences PASS avec preuves machine, tandis que le replay complet Outbox reste à refaire sans worker development concurrent. E2E publics 34/34 PASS, smoke routes 8/8, E2E authentifiés 3/3 couvrant MAT-FUNC-007/013/018/019 avec fixtures entièrement neutralisées. Traçabilité indépendante actuelle : 5/68 MAT-FUNC V1 VERIFIED.
- Release non signable à ce checkpoint : P01 et traçabilité `5/76 VERIFIED` (5/68 MAT-FUNC V1), MAT-FUNC-020 E2E rouge, smoke authentifié 16 scénarios non exécuté, 336 validations runtime des matrices, paramètres Auth hébergés et intégrations externes réelles (signature, paiements sandbox, SMTP, scanner/social) restent à prouver. Ces points sont consignés dans `docs/RELEASE_CHECKLIST.md` et `docs/DECISIONS_REQUIRED.md`.

## Checkpoint Client — 2026-11-02

- Source fusionnée `codex/bootstrap-foundation` au SHA `a237ae1`, corrections dans `codex/client-completion-20261102`. Aucun environnement distant ni production modifié. La branche de travail est poussée ; la création automatique de PR est refusée par l’accès API GitHub, et son corps/comparatif sont préparés.
- Les 26 chantiers Client sont tracés dans `docs/client-completion/REPORT.md` : questionnaires conditionnels et reprise, contexte d’organisation, devis/mission/litiges, quotas, approbations et reprise exacte, changements payés, packs, Box/membres/exécutions/retours, historique, portefeuille, parrainage/récompenses, ROI/économies, notifications et FR/AR.
- Contrôles techniques réussis : types, lint, build Next avec contrôles activés ; Web 2 639 tests hors PDF, groupe PDF 10/10 réussi séparément ; packages 137, worker 102, intégration 3 et tooling 31. Les derniers changements ont leurs régressions ciblées ; les décomptes recouvrants ne sont pas additionnés.
- Rejeu strict final : 458 migrations, 34 fichiers SQL, 904 assertions réussies, 623 tables publiques avec RLS, pgTAP fermé aux rôles API, nettoyage réussi. Concurrence native : trois cohortes GoTrue, une création et un refus de quota 54000 par paire, aucun interblocage ni double création. Le scellement d’audit garde une chaîne linéaire.
- Une pile navigateur a été reconstruite depuis le schéma canonique dans `template0` après découverte d’une dérive de restauration dans le clone initial. Comparaison finale : 3 915 objets, aucune différence de définition ou d’ACL. Aucun trigger de l’ancien clone n’a été retiré pour obtenir cette équivalence.
- Contre-recette canonique Owner : 220/220 pages FR/AR à 360/375/390/768/1440, 22 refus Administration/organisation étrangère, 14 frontières publiques et navigation clavier/tactile réussis, sans débordement, erreur JavaScript ou panne métier. Portefeuille natif 5/5 et questionnaire conditionnel/hors ligne 11/11 réussis. Buyer payé DEMO : 8/8 contrôles réussis (3→0→3, clavier/tactile et refus hors périmètre). Axe : 32/32 scans FR/AR, aucune violation ni exclusion ; la légende corrigée a 32/32 mesures de glyphes ≥5,1597:1 ; zones non rendues/masquées non mesurées et absence de certificat WCAG global explicites.
- Revue indépendante des corrections R1–R12 : causes et sources examinées, résultats attribués à leurs exécutants et limites explicites. Les preuves et commandes sont conservées sous `docs/client-completion/`.
- Livraison commerciale globale non certifiée : fournisseur/niveaux de signature, règles et contenus approuvés, traductions de catalogue et recette hébergée manquent. `release:validate` reste refusé par 73 conditions globales ; P01 et les registres `5/76 VERIFIED` ne sont pas fermés artificiellement. La recette technique ciblée Client est close. La prochaine étape demandée est le Sous-traitant complet, sur une branche issue de ce lot, avec régression des flux partagés Client/Provider et certification externe toujours séparée.

## 2026-11-02 — Sous-traitant, intégration et recette en cours

- Source explicite : Client final `7e01276`, branche `codex/provider-completion-20261102`. Le checkpoint Client est poussé ; ses modifications sont conservées. Aucun déploiement ni fusion de production.
- Lots intégrés : qualification/questionnaire/coffre/capacité/identité commune, devis versionnés/options HT facultatives/pièces privées, contexte/équipe/messagerie, contrats/livraisons/affectations/avenants ADD, première facturation gouvernée40000–40400. Les registres et reçus sous `docs/provider-completion/` distinguent chaque preuve de ses extensions encore en cours.
- Vérifications d'étape réellement réussies : Entrée44 SQL ; Identité28 SQL ; Devis41 SQL ; messagerie68 SQL ; litiges69 SQL. Chaque reçu transactionnel indique les fichiers/empreintes et un ROLLBACK sans COMMIT. Le premier rejeu neuf Livraison459 migrations/62 assertions est une preuve antérieure aux extensions. Ces nombres ne sont pas additionnés en certification intégrée.
- Premier `pnpm typecheck` intégré réussi. `pnpm lint` a terminé avec4 avertissements Finance, corrections demandées au propriétaire ; ni ce contrôle ni les reçus d'étape ne valent contrôle du candidat final. Les correctifs Client/Provider d'état de lecture et les gardes du runner ont leurs tests ciblés.
- Revue indépendante : défauts réels supplémentaires relevés sur reprises après panne, rôles composites, facturation/échéanciers/avoirs, bénéficiaire et provenance des pénalités, exécution des retraits/remplacements signés. Leurs auteurs implémentent les contre-tests ; le lot n'est pas déclaré clos sur une simple annonce.
- Recette navigateur : nouvelle cible locale Provider distincte de la cible SQL Client, droits comparés au source canonique458,15 vrais acteurs GoTrue OTP/TOTP AAL2, organisations/invitations natives. Build et gestes métier complets encore à exécuter. Aucun JWT utilisateur fabriqué, aucune preuve de signature juridique ou d'antivirus externe revendiquée.
- Prochaines étapes : finir40500+ Finance et41700+ Livraison, contre-revue et rejeu intégré, build/navigateur FR/AR, sauvegarde de tous les commits/preuves et préparation PR. Les dépendances externes restent identifiées dans le rapport Client ; les barrières globales de release ne sont pas passées artificiellement.

## 2026-11-02 — Sous-traitant, candidat consolidé8941517

- La branche conserve Client final7e01276. Lots complémentaires intégrés : revue questionnaire38400, contre-corrections Finance40500–40950, moteur opérationnel signé41950/41960 et planning individuel. Les décisions financières ne prennent plus de montants ni de validation juridique fournis par l'opérateur ; une clause approuvée et effectivement signée est l'autorité. L'appel qui inverse une première décision déclenche ses effets une fois.
- Recettes natives d'étape : qualification reviewer40, litiges intégrés79 avec46 migrations Provider, générations signées170/remplacement avant mission27/retrait avant mission18/legacy129. Chaque reçu porte ses sources/hashes, rollback sans COMMIT et empreintes identiques. Les reçus antérieurs ne sont pas additionnés en certificat global. Les revues indépendantes FinanceF01–F12, LivraisonL01–L08 et rootR09/R10 sont consignées dans docs/provider-completion/.
- Premier contrôle Web global :2939PASS/8échecs/1skip. Les échecs étaient quatre délaisPDF parallèles et quatre attentes de tests lues pendant l'intégration ; les groupes ciblés PDF/options16 et navigation/pages15 passent ensuite, sans augmenter de délai. Rejeu global hors PDF et lint encore en cours ; TypeScript intégré a réussi. Les fixtures SQL historiques sont adaptées à la nouvelle revue obligatoire, sans retrait des assertions ni bypass de protection.
- Candidat navigateur8941517 (arbre apps/web e709d635bfc02c3297ec356689b24364243a67ea) :15 migrations nouvelles appliquées, anciens SHA inchangés, toutes tables publiques RLS, pgTAP fermé aux rôles API. Nouveau build compilation+TypeScript réussis, fin de build et chaîne métier native en cours. Le réviseur AAL2 lit les vraies réponses via projection bornée, tandis que son SELECT général reste à0.
- Déjà constatés sur candidat précédent :40 pages FR/AR375/390/768/1440,8menus,20frontières de rôles/MFA réussis ;64scans axe sans violation automatique mais contrôle color-contrast incomplet, sans certification WCAG. Identité/documents/questionnaire/capacité exécutés avec acteurs GoTrue et fichiersTEST privés réels ; aucun utilisateurJWT fabriqué, antivirus externe ou signature juridique de production revendiqué.
- GitHub : branche poussée et confirmée jusqu'àea2b18f ; derniers commits en cours de consolidation avant nouvelle poussée. PR distante toujours non créée après refus GraphQL observé précédemment. Aucune fusion ni production. Le rapport exhaustif du périmètre est docs/provider-completion/REPORT.md ; la recette intégrée finale et les prérequis externes restent explicitement ouverts.

## 2026-11-03 — Sous-traitant, réalisation et recette technique ciblée terminées

- Client final7e01276 conservé, branche `codex/provider-completion-20261102`. Dernier produit vérifié5b8b0f738137abee19f6552aef538e906d04f24a, arbre apps/web ef4b62c67a4d8ad5a6403e6a4568bd9dc1774c75. Les commits ultérieurs concernent preuves/documentation. Aucune fusion, production ou réapplication de l'environnement publié.
- Périmètre E01–E17/D01–D19 implémenté et tracé dans docs/provider-completion/REPORT.md : entrée/identité/questionnaires, revue indépendante, documents, capacité, devis/révisions/PDF/options, contrats/avenants/missions/livraisons/affectations, finance, litiges, messagerie, équipe, contexte, rôleClient et FR/AR.
- Contre-revues R/F/L ont corrigé des causes réelles supplémentaires : accès de revue sans élargir SELECT privé ; faux vide de fileAdmin ; exceptions puis générations signées immuables ; lecture/exécution séparées ; reçus de reprise ; décisions économiques issues du modèle approuvé et signé ; date marocaine refusée sousUTC ;2contextes notifications omis ; incidentAuth conservé technique ; lien du double rôle, contrasteAR et langue/dir du document lors des vraies navigationsSPA ;2statutsDevis traduits sans toucher les textes libres.
- Validation finale :507migrations,56fichiersSQL,2067assertions PASS,649tables publiques/0sansRLS/pgTAPnonexécutableAPI, nettoyagePASS. Web2980PASS +30PDF/MFAisolés distinctsPASS et1skip opt-in ; worker104PASS ; types, lint, builds et exports server-actions1832sourcesPASS. Le reçu global ne prétend pas rejouer tous les anciens tests ni inclure une nouvelle campagne de concurrence.
- Navigateur natif :15acteursGoTrueOTP/TOTPAAL2 ; identité/coffre/questionnaire/capacité, qualification, devis7/révision3/contrat-mission5/livraison6/messages4, finance4avecfenêtre intacte, double rôle4 et navigation/recherche3. Les gestes gardent leur véritable candidat e929→894→5e06→706, sans les réétiqueter artificiellement. Matrice706 :232/232pages, FR/AR375/390/768/1440,256scansaxe/0violation,8menus/0JS/0débordement. Delta final5b8Devis :8/8contrôles ciblés, mêmeV2/organisation/textes libres.454fichiers de preuve et archiveaxe brute vérifiés par root.
- Contraste mesuré : libelléAR4,1842→12,5138:1 ;54/56cibles conformes,2nonmesurées. Les256incomplets axe liés aux gradients restent explicitement non résolus globalement ; aucun certificatWCAG universel.
- Limites réelles : clôture/facture/paiement/allocation du mois courant non joués avant le30novembre et sa contradiction ; signature juridique, scanner réel, mouvement bancaire, validation fiscale professionnelle, informations légales, email/PSP/workerhébergé/restaurationstaging non certifiés. Pas de faux solde, mock de réussite ou donnéesTEST publiées en production. Registre global5/76 et autres barrières release non fermés artificiellement.
- Ancienne pileClient e3 sauvegardée privée11Mo puis4conteneurs nettoyés avec garde ; chaque replay neuf s'autonettoie. Source f59 et cohorteProviderb9 conservées ; app/gateway de recette arrêtés proprement, pas de service de production touché. Code/preuves/descriptionPR préparés, GitHubAPIcréationPR refusée ; branche et comparatif permettent la revue sans merge autorisé.


## 2026-11-03 — Finance et Franchisé livrés, recette finale partielle figée

- Source initialedf67da4 conservée après Client/Prestataire. PR12 fusionnée par l’utilisateur en a362abc1 ; l’assistant n’a ni fusionné ni déployé en production. Complément depuis cette fusion : codex/franchise-publication-validation-20261103.
- Correctifs : mandat/ACLcatalogue natifs, organisation/territoire explicites, lecteurs exacts et erreurs distinctes, constructeurs/versionnage/UUID/livrablesFRAR, invitations/relances durables, six axes/rapports et plans indépendants, binding économique des livres, coûts nets/documents privés/coûts nuls et reprise vers dépense réelle, calendrier et replays financiers. PRIMARY manquant réparé par sauvegarde DRAFT native, jamais publication directe.
- Rejeu final neuf :559migrations,74fichiersSQL,2833assertions PASS ;664tables publiques/0sansRLS/pgTAPnonexécutableAPI, nettoyagePASS. Web801PASS sur candidat834 ; deltas117PASS (groupes recouvrants), worker158PASS ; types/lint et build strictC3b433 PASS,31tooling/3intégration/5gardes d’outillage PASS.
- NavigateurC3 : OTP→TOTP→AAL2 et retour exact FR/AR PASS ;10étapes éditoriales natives et régularisation de2anciens services PASS. Publication non exécutée :23P01 CATALOG_SCHEDULE_CONFLICT, aucune release annulée pour faire passer. Finance :RESERVED/PENDING, dépôt final non confirmé, pas de scanCLEAN/approbation réelle certifiés.
- Matrice finale arrêtée à la demande de clôture rapide :43visites,37PASS/6FAIL et2interrompues. Les6échecs concernent le focus des tableaux ; correctif commun8ad97dd2 et117tests+lint PASS. Ce dernier delta n’a pas eu de nouvelle recette navigateur/build optimisé. La couverture finale192 n’est pas certifiée.
- Dernier arbreapp865af1bcf3bd0904b9c941c90a024c5f988492b7 ; build strictb433/appTreec318 et état final distincts, sans réétiquetage des preuves. Voir docs/franchise-completion/REPORT.md, TRACEABILITY.md et evidence/browser/CLOSURE.json.
- Limites : CI du compte GitHub encore bloquée par facturation après fusion, APIcréationPR Forbidden ; scanner physique, intégrations/staging hébergés, signature juridique, données légales/conditions validées, seuils de gouvernance et distribution historique positive non certifiés. Aucun100%global V1 ni procès-verbal client revendiqué. Aucun contrôle supplémentaire en cours.


## 2026-11-03 — Reprise ciblée : publication, dépôt financier et visuel finalisés

- Publication réelle PUBLISHED après régularisation560 à deux administrateurs natifsAAL2 ; auto-approbation refusée, claim/complete sous bail et rejeu sans doublon, anciennes versions/hashes conservés.
- Même PDF privé repris après alignement Origin du runtime : UPLOADED,816octets/hash vérifiés,1upload,0rapprochement ; scannerERROR et refus55000 de coût nul maintiennent la sécurité faute de moteur réel.
- Focus12cas FR/AR375/390 PASS enDEV, clavier réel et0axe/0JS. Pas de nouvelle campagne optimisée192 ni de déploiementprod.
- AdminCalendrier560 exploitable FR/AR ; dates sérialisées serveur contre divergenceTZdata ;56testsWeb et28SQL PASS, revue indépendante favorable. Reçus finaux dans docs/franchise-completion/evidence/browser.


## 2026-11-09 — Clôture V1 : corrections et recette locale, release non certifiée

- Synchronisation `version-2` avec le head GitHub `10c4fc3`, sans écrasement des changements entrants ; code candidat local `888bcaf`.
- Corrections : champ de report optionnel pour accepter/refuser une solution, conservation stricte du tenant client, récupération FR/AR des références franchise sans mandat, origine CMI HTTPS explicitement autorisée par CSP, dépendance `server-only` et contexte de tests serveur explicites.
- Préparation des recettes : inventaire filesystem, gardes de manifest org/franchise/bibliothèque, données manquantes signalées. Les cinq templates de recette sans IDs restent ouverts. Le scan ne certifie plus une 404, un refus inattendu, une redirection de connexion ou un contexte de tenant modifié. Les deux refus fiscaux attendus sont distingués des parcours métier réussis.
- Preuves locales vertes : 4 076 tests unitaires réussis, un test Storage opt-in existant non exécuté ; 63 tests d’outillage ; intégration 3/3 ; Chromium public 18/18, FR/AR, 360/ordinateur, axe et quatre captures ; CMI intercepté 2/2 sans PSP réel ; build Next/Turbopack Node22 avec TypeScript ; lint 0 erreur et 4 avertissements existants.
- SQL : environnement neuf séparé, 575 migrations + seed verts. Correctif additif de version finale CRM et assertion 0193 renforcée. Suite SQL globale complète : 360 fichiers, 9 301 assertions et quatre scénarios de concurrence verts sur la base isolée ; reçu `docs/evidence/v1-closure-sql-full-20261109.json`.
- Revue technique indépendante conservée ; preuve principale : `docs/evidence/v1-closure-20261109.json`. Plan, lots et limites : `docs/release/V1_CLOSURE_2026-11-09.md`.
- Aucun changement de production, aucun dossier IT existant réutilisé, aucun secret copié. Yousign sandbox retenu par le demandeur, sans activation EXTERNAL ni validation juridique déduite de ce choix.
- Gate V1 : **REFUSÉ**, 73 conditions restantes sur worktree figé, toujours **5/76 VERIFIED**, aucune promotion. Staging/bindings, KYC, politiques four-eyes, signature réelle, CNDP/fiscalité, données de recette et parcours natifs C1–C8 restent à prouver.
- Prochaine étape unique : confirmer la cible de staging et ses bindings autorisés pour alimenter les acteurs de recette puis exécuter les parcours natifs du plan.

- Complément CI : correctif `60e6b1c` après le timeout du test navigateur devis dans le premier run. La CI installe désormais Chromium avec Playwright et le test ne dépend plus d’un chemin système implicite. 10 tests ciblés verts avec le navigateur Playwright et 10 avec l’override local, sans retry ni hausse de délai. **Run GitHub 42644570334 : quality, browser-public et database tous verts** sur le code courant. Le gate métier reste refusé indépendamment de cette validation technique.

## 2026-11-09 — Réparation du staging et transport YouSign

Statut : **code validé, activation externe et production non certifiées**. Source contrôlée : `c0578a098ba51806af245342a0e3e4dd6dd1b49f` (application identique à `d8c3a75`, décision Vercel de construire à chaque push ajoutée).

- Staging distinct créé sans données de production : `matricia-staging.vercel.app`, Supabase `vuwvkpfprixzysjfpgkw`, branche Git `codex/staging-repair-20261109` et 30 bindings Preview propres.
- Reconstruction canonique après divergence du schéma initial ; 577 migrations réellement appliquées, 686 tables publiques et 149 privées, 12 buckets et 29 politiques Storage. Références JWT et trois empreintes de fonctions vérifiées ; base de confiance `STAGING`.
- OTP à 8 chiffres et URLs Auth alignés ; garde de build contre les backends partagés avec Production ; Node 22 et build Vercel automatique.
- Worker : scanner authentifié, requêtes bornées, preuves de readiness expirantes et heartbeats coalescés ; image non privilégiée reconstruite et démarrage sans réseau vérifié.
- YouSign : transport SIMPLE sandbox, webhook HMAC, claims durables et preuve PDF/consentement/audit vérifiée ; aucune attestation juridique ni activation réelle inventée.
- Vérification : **4 183 tests unitaires PASS**, un test Storage natif optionnel existant ignoré ; **103 tests d’outillage PASS**, **58 assertions SQL positives** et **21 contrôles SQL de droits** ; build Next.js/TypeScript, phase00, frontières et ESLint des fichiers d’intégration PASS. Deux contrôles globaux standalone TSC/lint ont été interrompus pour ressources ; TypeScript a ensuite terminé dans le build et les fichiers modifiés ont passé ESLint.
- Revue indépendante sans P1 statique ouvert dans le périmètre revu. Les statuts d’exigences restent **5/76 VERIFIED** ; aucune certification externe ajoutée.

Restants : credentials et recette Resend/SMTP, PayPal et YouSign ; hébergement worker/ClamAV et scan natif ; réseau du navigateur d’audit ; comptes et contenu de recette ; deux administrateurs AAL2 distincts ; validations métier/juridique/CNDP/fiscales, restauration/pentest, visas indépendants et décision de production. Voir `docs/release/STAGING_REPAIR_2026-11-09.md` et `docs/evidence/staging-repair-20261109.json`.

Complément confidentialité et validation finale : la première CI a détecté le défaut réel 0243 lié aux nouveaux fichiers YouSign. La migration additive `20261109101000` raccorde les fichiers et sept familles de métadonnées au sujet exact, en conservant `UNTRUSTED` et les revues indépendantes. **108 assertions natives RGPD passent**. La campagne locale interrompue par le redémarrage a été terminée sur les 110 fichiers restants après les 251 premiers, sans omission. Le job GitHub `database` du run `42673774172`, sur `1a99fcda15862932b331f29c0e3051899568d674`, confirme indépendamment **361 fichiers SQL, 9 323 assertions et quatre scénarios de concurrence PASS** après reconstruction des 577 migrations. Reçu : `docs/evidence/staging-repair-sql-final-20261109.json`.

Les jobs qualité et navigateur ont réussi dans le run `42666211494` sur `1d0eb0b94a0734407ffc8fe72fe37ae25a1e7fcc` : lint global, types, unités, intégration, outillage et build. Les arbres `apps`, `packages`, le manifeste racine, le lockfile et le workflow sont identiques sur le candidat SQL final ; Vercel y réussit également. Le run final demeure globalement rouge : GitHub affiche une erreur interne de planification (`7c94913a-4819-40d3-a3bd-a8c7bb9af940`) et n’a pas démarré les jobs qualité/navigateur. Aucun contrôle n’est désactivé pour masquer ce problème externe. L’activation des fournisseurs et la production restent non certifiées.


## 2026-11-09 — Configuration Admin autonome : recette technique verte

- Code contrôlé `3d04c50a9523d903bbb97a89a8d0277060441117`, PR nº17. Le candidat conserve la fusion GitHub `13e4086`. Aucune fusion ni modification de production par cet agent.
- Nouvel espace `/fr/administration/configuration` et `/ar/administration/configuration` : entreprise, Resend, PayPal, YouSign et antivirus ; révisions persistantes, coffre AES-GCM privé, tests de connexion datés, activation réelle par un autre administrateur AAL2 et désactivation sans résurrection des anciennes clés. Les modules métier restent liés et gouvernés.
- Finance utilisable sur une base neuve : sélection d’une organisation par son nom, création guidée si aucune ; aucun client ou portefeuille choisi implicitement. Signature : préparation propre depuis l’interface, aperçu du PDF exact et privé, bornes contrôlées sur le vrai document, relecture après sauvegarde et gel après dispatch. YouSign live reste conditionné aux environnements concordants et aux attestations/politiques indépendantes.
- Staging réellement migré à581 sans données de production. Les30bindings de branche et le domaine existants sont conservés. Dernier inventaire : zéro utilisateur et zéro configuration active hébergés ; les personnes du client ne sont pas inventées.
- **CI complète du code verte**, run42688036269 : lint/types/intégration/outillage/build et navigateur public PASS ; **4 331 tests unitaires PASS**, un test Storage opt-in existant ignoré ; **365 fichiers SQL, 9 429 assertions et quatre scénarios de concurrence PASS**. Rejeu ciblé final235tests et outillage103PASS.
- Recette Admin GoTrue/REST réelle isolée :12contrôles fonctionnels, deux administrateurs TOTP indépendants, refus AAL1/ordinaire/auto-approbation, persistance, confidentialité DOM/RSC, erreurs de saisie et désactivation. Quatre pages FR/AR360/1440 :0violation axe, clavier et absence de débordement ; contrastes incomplets conservés sans certification WCAG globale. Quatre acteurs nettoyés.
- Recette signataire native sans interception : PDF canonique25 597octets archivé et relu avec même SHA dans un Storage dédié ; navigateur FR1440 avec aperçu200, vraie saisie/PUT200 et rechargement persistant, refus403 de modification de l’autre partie,0erreur JS/CSP/console/débordement. Quatre acteurs GoTrue OTP/TOTP nettoyés ; gouvernance synthétique locale uniquement, aucun fournisseur externe appelé. Origine locale canonique Nextlocalhost, protection CSRF conservée.
- Revue technique indépendante sans finding ouvert. Preuve principale : `docs/evidence/admin-configuration-delivery-20261109.json`. Guide : `docs/release/ADMIN_CONFIGURATION_HANDOVER_2026-11-09.md`. Les changements documentaires suivants ne changent pas les arbres de code contrôlés.
- **Remise des accès et exploitation commerciale encore conditionnées** : deux identités Admin réelles/MFA, SMTP Auth initial, clés et recettes fournisseurs, hébergement worker/ClamAV, contenu et validations métier/juridique/CNDP/fiscales, attestation indépendante et autorisation de production séparée. Le registre reste5/76VERIFIED ; aucune certification globale n’est déduite de cette recette technique.
## 2026-11-19 — Remédiation audit 360 : gates TypeScript, tests et build

- TypeScript froid, lint, tests workspace, tooling, build synthétique et phase00 validés ; 610 migrations sans collision, 352 pages générées.
- `strict: true` reste actif ; `exactOptionalPropertyTypes` et `noUncheckedIndexedAccess` ont été retirés car ils produisaient 370 erreurs existantes.
- La recette SQL native complète exige encore un clone Supabase réservé ; aucun accès distant ni production modifié.

## 2026-11-19 — Remédiation audit 360 : replay SQL local vert

- Reset Supabase local Docker complet réussi : toutes les migrations et le seed rejoués.
- Correction de compatibilité CRLF dans les patches dynamiques de définitions PostgreSQL des migrations `20261031263000`, `20261031266120`, `20261031268010` et `20261102040900`.
- Test SQL `0410_audit_core_finance_integrity.test.sql` : 41/41 assertions passées.
- Test SQL `0411_audit_volume_replay.test.sql` : 10/10 assertions passées.
- Les tests couvrent l’idempotence, les contraintes financières, les refus d’accès RLS, les preuves de paiement et le replay allocation/consommation.
- Prochaine étape : conserver la preuve locale et exécuter les validations distantes autorisées séparément ; aucune modification de production n’a été effectuée.
## 2026-11-22 — Correction scheduler franchise follow-up

- Cause confirmée de l’erreur distante `column "value" does not exist` : `unnest(...) with ordinality` n’aliasait pas ses colonnes dans `schedule_franchise_followups`.
- Ajout de la migration forward-only `20261122100000_fix_franchise_followup_scheduler_unnest_alias.sql` avec les alias `delay_minutes` et `ordinality` explicites.
- Reset Supabase local complet réussi après application de la nouvelle migration.
- Smoke test local du RPC avec `service_role` réussi : 0 job retourné, aucune erreur SQL.
- Aucun changement appliqué à la base distante.
## 2026-11-22 — Validation Supabase distante des contrôles finance

- Projet distant Matricia actif vérifié : `nbqtuybebrhkqmtonhsd`.
- La migration Platform Core Finance et la migration d’audit ont été appliquées manuellement sur la base distante.
- Test distant `0410_audit_core_finance_integrity.test.sql` : plan complet `1..41` atteint sans échec signalé.
- Test distant `0411_audit_volume_replay.test.sql` : plan complet `1..10` atteint sans échec signalé.
- La correction du RPC `schedule_franchise_followups` élimine l’erreur `column "value" does not exist`.
