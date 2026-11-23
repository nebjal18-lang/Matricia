# Couverture E2E — contrôle du 22 novembre 2026

## 2026-11-23 — Rapprochement : refus serveur et reprise navigateur

Treize nouveaux tests de l'action serveur couvrent la confirmation obligatoire, les locales autorisées, la transmission exacte des montants et identifiants, les refus et l'absence de rafraîchissement après échec. Résultat ciblé avec le repository : **21/21 PASS**. Deux nouveaux tests de composant navigateur FR/AR vérifient le bouton désactivé pendant l'envoi, le conflit visible, la reprise avec la même identité de requête et le montant exact `9007199254740993`. Suite composant : **6/6 PASS** en 5,4 secondes, compilation et navigateur partagés. Sources : [action serveur](../../apps/web/modules/admin/screens/finance/actions.test.ts), [composant navigateur](../../tests/remediation/finance-reconciliation-browser.test.mjs).

Les limites sont inchangées : action simulée dans le navigateur, repository simulé dans les tests d'action ; aucune nouvelle preuve E2E native ni hausse du total 406. Prochaine étape : continuité navigateur-vers-base du rapprochement.

## 2026-11-23 — Finance native : clôture vers règlement

Extension multi-factures : **82/82 assertions PASS**, 629 migrations sur clone neuf, nettoyage PASS. [Dernier reçu](../../work/isolated-replay/f9823ef3-4974-4812-b37f-485872790b92/summary.json). Deux périodes historiques explicites produisent deux factures par le planificateur natif, sans insertion directe de facture ou d'écriture comptable. Deux paiements approuvés indépendamment règlent les deux factures ; le second paiement est réparti entre elles. Sommes exactes, soldes nuls, quatre journaux équilibrés, factures immuables, absence de doublon et lectures étrangères refusées. Le scénario remplace les versions 74/78 assertions ci-dessous : ne pas additionner leurs résultats. Reste à prouver la continuité navigateur-vers-base de ce parcours et le règlement bancaire externe.

Extension multi-paiements : **78/78 assertions PASS** après les 629 migrations sur clone neuf, nettoyage PASS. [Reçu actualisé](../../work/isolated-replay/ef31dbbe-476f-4789-860c-b9e058a8578f/summary.json). Deux paiements distincts, chacun déclaré puis approuvé indépendamment, règlent la même facture. Leur somme correspond exactement au total facturé ; deux allocations, trois journaux équilibrés, aucun doublon au rejeu. Cette preuve remplace le précédent scénario à paiement unique ; elle ne prouve pas encore plusieurs factures ni leur parcours navigateur natif.

Rejeu ciblé sur base locale neuve : **629 migrations, 1 fichier SQL, 74 assertions PASS, nettoyage PASS**. [Reçu](../../work/isolated-replay/e7c2391b-de1d-4e48-a7a3-c3f473e6a9bb/summary.json). Scénario : [0360_provider_finance_close_to_payment.test.sql](../../supabase/tests/0360_provider_finance_close_to_payment.test.sql).

Les commandes natives émettent la facture, demandent et approuvent indépendamment un échéancier, déclarent puis approuvent indépendamment le paiement, et rapprochent deux allocations partielles jusqu'au solde nul. Rejeux sans doublon, surallocation refusée, facture inchangée, journaux exactement équilibrés, MFA obligatoire et lectures étrangères refusées. Les préconditions historiques et le scan documentaire sont synthétiques ; aucun mouvement bancaire ni antivirus externe n'est certifié.

Cette exécution porte sur une facture et un paiement : le parcours navigateur natif multi-factures/multi-paiements reste à prouver. Les quatre tests de composant financier sont une preuve distincte. Aucune hausse artificielle du total E2E, aucun passage de MAT-FUNC-032 à une validation complète ; pas de nouvelle suite globale ou de concurrence exécutée.

## 2026-11-23 — Corrections ciblées de continuité et de finance

Complément navigateur du rapprochement : **4/4 tests Chromium PASS**, FR/AR à 360 et 1280 px, en 7,1 secondes. Le vrai composant React est monté avec données synthétiques et action serveur remplacée : filtrage organisation/devise, changement de facture, montant recalculé, confirmation réinitialisée, soumission empêchée sans facture compatible puis rétablie. Aucune erreur JavaScript. Commande : `corepack pnpm --use-node-version=22.23.5 test:finance:browser`, également incluse dans `test:application`. Cette preuve de composant ne certifie ni écritures comptables natives, ni MFA/RLS, ni accessibilité globale ; elle n'augmente pas le total E2E natif.

- Besoin guidé : conserve l'organisation initiale pendant la restauration sans brouillon. La recette des ensembles vérifie maintenant aussi l'organisation persistée dans le navigateur : **10/10 E2E PASS**, FR/AR ordinateur/360 px, nettoyage confirmé. [Preuve](../../artifacts/test-results/local-acceptance/history/need-organization-solution-bundles-18b00f1c6697572943b367a57acffe0f78c6bc053133054d2f05fd127cf748e5.json).
- Report d'opportunité : conversion IANA Casablanca de la fin de journée et rejet des dates civiles impossibles. Quatre nouvelles régressions échouaient avant correction.
- Montants des recommandations : lecture PostgreSQL en texte pour conserver les unités mineures au-delà de la précision entière JavaScript. Nouvelle régression rouge puis verte avec 9007199254740993 unités mineures.
- Rapprochement Admin : seules les factures de la même organisation et devise sont proposées ; changement de paiement pris en compte, suggestion recalculée, confirmation réinitialisée lorsque la paire change. Refus serveur conservés. Tests des frontières MFA, organisations, devises, solde, lecture incomplète et reçus invalides.

Validation : **62 tests ciblés PASS** dans huit fichiers, TypeScript et lint ciblé sans erreur. Le parcours E2E ci-dessus précède les changements financiers ; aucune recette navigateur du rapprochement modifié n'est revendiquée. Aucun nouveau visa global ni promotion d'exigence : 57 exigences restent partiellement prouvées et 11 à examiner. Cette réexécution ne s'ajoute pas au total consolidé des 406 exécutions.

## 2026-11-23 - Historique des diagnostics

Optimisation du lanceur : un serveur local possede par execution est reutilise entre les trois suites, puis arrete avant nettoyage. Verification ciblee : 10/10 passent, aucun echec ni skip, nettoyage confirme. Intervalle navigateur observe : 96 s avant, 84 s apres (environ 12 % de moins sur cette mesure ; pas un benchmark general). Les assertions et preconditions restent identiques. Les suites SQL/unitaires non touchees ne sont pas relancees.

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


## Extension des preuves des 68 exigences — travail en cours

Dernière extension validée : **20/20** sur `functional-controls`, total consolidé **186 exécutions réussies sur 11 segments**. La modification d'activité du profil déclenche quatre réévaluations terminées par analyse FR/AR desktop/360 px. La saisie avant initialisation du formulaire est corrigée et rejouée avec succès. Preuve native : **68 paires audit/événement, 57 refus de lecture inter-organisations**. La matrice comporte 29 exigences partiellement prouvées et 39 à examiner ; aucun pourcentage global de couverture n'est certifié. Les paragraphes ci-dessous conservent les étapes précédentes de la validation.

La [passe SQL commune finale](../../work/isolated-replay/69291653-2763-4ae9-9ebe-965f5edeb2f7/summary.json) réussit **617 migrations, 389 fichiers, 9 663 assertions et quatre scénarios de concurrence** dans le même rejeu isolé, nettoyage confirmé. Le [build Web local](../../artifacts/test-results/local-acceptance/web-build-20261122.json) passe après les dernières corrections. Aucun service externe réel ni déploiement de production n'est certifié par ces preuves.

Le segment supplémentaire `functional-controls` a réussi **16/16 exécutions**, sans omission ni instabilité, avec authentification réelle et nettoyage confirmé. La somme des segments validés passe de 166 à **182** ; ce n'est pas un rejeu unique et cela ne représente pas un pourcentage de couverture des 68 contrats. Les [preuves consolidées](../../artifacts/test-results/local-acceptance/consolidated-20261122.json) référencent des copies conservées par SHA-256.

- Client : quatre sites, projets, jalons avec critères, centres de coûts et budgets approuvés reliés aux sites/projets, à `9007199254740993` unités mineures, relus après rechargement et en base.
- Franchisé : quatre configurations successives du résumé, versionnées et relues.
- Notifications : douze changements de mode persistés, refus serveur de désactiver une catégorie obligatoire et refus inter-tenant.
- Assistance : quatre analyses, deux acceptations et deux refus humains persistés, sans création automatique de demande métier ; décision étrangère refusée.
- Preuve native enrichie : 60 paires audit/événement et 45 lectures étrangères refusées. Quatre allocations réelles de 1 005 unités mineures sont rattachées aux bons budget, projet, jalon et centre de coûts, avec vérification du SHA-256 des octets envoyés. Les quatre jalons passent par en cours, soumis puis accepté, avec quatre versions chacun et une progression du projet nulle avant acceptation puis à 100 %. [Rapport](../../artifacts/test-results/local-acceptance/functional-controls-proof.json).
- Régressions corrigées : approbation du budget masquée par un champ caché ; scope d'idempotence invalide pour les catégories de notification en majuscules. Tests ciblés : 26 actions et 13 assertions SQL comportementales réussis.

Le suivi exhaustif des identifiants est dans la [matrice des 68 contrats et 26 scénarios](../traceability/V1_RUNTIME_COVERAGE.md). Les preuves restent partielles jusqu'à couverture de chaque comportement et revue indépendante. Le [rejeu SQL complet depuis zéro](../../work/isolated-replay/3c1dd6e2-4c3b-495d-81ab-be673d893622/summary.json) passe **617 migrations, 389/389 fichiers et 9 663 assertions**, avec nettoyage confirmé, sans tests de concurrence. Les devis renforcés passent deux fois à 4/4, avec 56 omissions rejetées côté serveur. Quatre événements et échéances du calendrier sont vérifiés en UTC et en heure de Casablanca après rechargement. Le build Web, TypeScript global et lint global passent ; le lint conserve dix avertissements.

## Historique de la première consolidation (166 exécutions)

**166/166 exécutions retenues réussies : 100 % de réussite**, zéro échec,
zéro test ignoré et zéro instabilité déclarée. Les résultats proviennent de
segments exécutés séparément ; ce n'est pas une passe unique des 166 tests sur
un même instantané. La dernière passe commune de 64 tests a une identité de
sources stable et un nettoyage intégralement vérifié.

| Segment | Réussite |
| --- | ---: |
| Espaces admin, client, sous-traitant, franchisé ; Marketing et transversal | 64/64 |
| Onboarding et conformité | 28/28 |
| Parcours critiques V1 | 24/24 |
| Parcours client complet | 6/6 |
| Chaîne commerciale et livraison | 8/8 |
| Avantages, exécution et réception | 6/6 |
| Devis exacts FR/AR | 4/4 |
| Messagerie, comparaison, matching, capacité | 4/4 |
| Connexion OTP, consentement et MFA | 4/4 |
| Public et préférences cookies sous Node 22 | 18/18 |

Les 16 tests de navigation isolés ne sont pas recomptés : ils figurent déjà
dans la passe de 64. Plusieurs segments réutilisent des parcours ; ce total
ne mesure ni des fonctionnalités uniques ni une couverture du code.

**Couverture fonctionnelle globale des 68 exigences : non déterminée et non
certifiée.** Les tests locaux utilisent des préconditions synthétiques et des
adaptateurs sandbox/DEV. Les paiements, signatures et publications externes
réels, le staging, le rejeu intégral des migrations et l'audit indépendant
restent hors de cette validation locale.

[Consolidation avec hash de chaque preuve](../../artifacts/test-results/local-acceptance/consolidated-20261122.json)
· [Dernière passe des 64 tests](../../artifacts/test-results/local-acceptance/p24-p26.json)
· [Commandes de reproduction](../release/LOCAL_ACCEPTANCE.md).

## Mise à jour après déblocage

La suite publique a été rejouée sous Node 22 : **18/18 PASS**, sans relance ni
test ignoré. [Preuve publique Node 22](../../artifacts/test-results/e2e-public-node22-20261122.json).
Une première passe commune des espaces a obtenu **64/64 navigateur PASS**,
mais son nettoyage a correctement échoué sur les fichiers désormais protégés.
Le nettoyage conserve maintenant les preuves liées et leur historique, vérifie
leurs SHA-256 et ne supprime que les dépôts non liés. Trois tests de régression
et la relecture de quatre objets natifs passent. La nouvelle passe commune
est **64/64 PASS**, avec nettoyage réussi et identité des sources stable.

Le segment final-core est **4/4 PASS** : message envoyé puis relu, refus du
tenant étranger, comparaison figée, historique de matching et quatre
transitions de capacité du service fournisseur avec audit en base.
[Preuve final-core](../../artifacts/test-results/local-acceptance/final-core.json).
Les attentes suivent les titres et offres A/B actuels. Le test de capacité
sélectionne à nouveau le service après chaque remise à zéro du formulaire.

Le contrôle financier P23 a détecté un écart réel d'une unité mineure : la
division NUMERIC arrondissait un grand quotient avant `floor`. La migration
additive `20261122234000_exact_tax_integer_quotient.sql` emploie `div` et
convertit en NUMERIC avant `abs`, sans réécrire les historiques. Les 12 nouveaux
tests aux limites et les 49 tests du moteur fiscal passent sur Docker local.
L'aperçu devis possède désormais une région de tableau nommée, focalisable au
clavier. Les 20 tests unitaires ciblés actions/aperçu passent également.

Le segment devis P23 est **4/4 PASS**, sans ignoré ni instabilité, avec contrôle
financier exact, identité, audit/outbox et nettoyage vérifiés.
[Preuve P23](../../artifacts/test-results/local-acceptance/p23-quotes.json).
La recette utilise le rattachement au hash exact du
service publié, classement fiscal DEVELOPMENT proposé puis approuvé par deux
sessions AAL2 distinctes, et navigation consultation → devis → aperçu.
Les rôles fiscaux temporaires sont retirés au nettoyage. Les contrôles métier
restent actifs. La recette utilise une quantité fractionnaire et un prix en
unités mineures supérieur à `Number.MAX_SAFE_INTEGER`, dans la limite du
formulaire, avec comparaison exacte des montants en base. Les mutations
invalident désormais aussi les pages de détail consultation/devis.

La suite Marketing est également **PASS : 8/8**, zéro test ignoré et zéro
instabilité, avec nettoyage des fixtures. Elle vérifie FR/AR, les écrans admin,
l'accessibilité, la génération, l'approbation authentifiée, la planification,
la publication **sandbox** et la persistance de l'attribution. Ce résultat ne
prouve pas une publication réelle chez un fournisseur social externe.
Preuve : [résultat Marketing](../../artifacts/test-results/e2e-marketing-20261122-passed.json).

Corrections complémentaires : projection des organisations fournisseur dans le
référentiel admin (colonne inexistante supprimée de la requête, relation validée),
région de tableau fournisseur accessible au clavier, correction des variables
ambiguës de `schedule_marketing_campaign` par migration. Contrôles ciblés réussis :
4 tests unitaires du référentiel admin, 29 tests infrastructure et 11 tests SQL
Marketing. La suite métier complémentaire est maintenant **PASS : 40/40**,
zéro échec, zéro test ignoré et zéro instabilité, avec nettoyage des fixtures.
Elle inclut le dépôt, le scan sandbox et l'acceptation persistée des livrables
et jalons ainsi que la publication authentifiée de checklists.
[Preuve métier](../../artifacts/test-results/e2e-business-spaces-20261122-passed.json).
La première relance combinée a donné **60/64**, révélant quatre erreurs
d'hydratation sur les calendriers Marketing après publication. Le calendrier
utilisait le fuseau implicite de l'hôte ; il utilise désormais le formateur
Casablanca fondé sur les transitions IANA versionnées du projet. Les 25 tests
du rendu Marketing et du formateur passent, puis la combinaison ciblée
Marketing + espaces a réussi **24/24**, zéro ignoré, fixtures nettoyées.
[Preuve de combinaison](../../artifacts/test-results/e2e-marketing-spaces-20261122-passed.json).
Le résultat final 64/64 doit encore être rejoué avec cette dernière correction.

Connexion réelle : **4/4 PASS**, FR/AR, OTP acheminé dans la boîte locale,
consentements persistés, reprise de route et MFA, arrêt du serveur et nettoyage
réussis. [Preuve de connexion](../../artifacts/test-results/e2e-local-auth-20261122-passed.json).
Onboarding/conformité : **28/28 PASS**, aucune relance automatique, aucun test ignoré,
nettoyage vérifié et identité des sources stable pendant la passe.
Les tests vérifient les filtres de fixtures explicites, les libellés métier avec
liens de dossier exacts et les redirections de refus/MFA actuelles.
[Preuve onboarding](../../artifacts/test-results/local-acceptance/p05-onboarding.json).
Parcours critiques V1 : **24/24 PASS**, aucun échec, ignoré ou instable,
nettoyage vérifié. [Preuve V1](../../artifacts/test-results/local-acceptance/v1-critical.json).
Parcours client complet : **6/6 PASS**, inscription OTP, consentements,
documents privés, double contrôle d'identité, activation, questionnaire,
diagnostic et demande persistée à budget exact, avec refus inter-tenant.
[Preuve client](../../artifacts/test-results/local-acceptance/client-journey.json).
La configuration locale ne contenait aucun droit d'essai : la fixture ajoute
uniquement les ressources manquantes, avec quota 10, durée maximale d'une heure
et retrait après la passe. Cette référence historique synthétique ne constitue
pas une validation d'une politique commerciale réelle. Les commandes continuent
à appliquer leurs contrôles de quota. Les **31 tests infrastructure** repassent.

La chaîne commerciale a ensuite révélé l'absence de contrainte de conservation
sur le schéma Storage versionné : l'ancienne migration sautait sa clé étrangère
si `(bucket_id, name)` n'était plus unique. Les migrations additives
`20261122230000` et `20261122230100` attachent désormais chaque nouvelle preuve à
l'identifiant natif de l'objet, avec FK restrictive, verrouillage et protection
des métadonnées/version. Les **26 tests SQL 0244 passent**, dont refus de
suppression, isolement après révocation et lecture normale. Une preuve PDF
strictement synthétique supprimée par le test initial a été reconstruite à
l'identique, son SHA-256 vérifié avant et après restauration et sa liaison créée.
Les anciens objets absents ne sont pas déclarés conformes par la migration.
La fixture commerciale reprend maintenant la clé du livrable signé, au lieu
d'une clé arbitraire. Le test OTP utilise une adresse de proxy loopback par
identité synthétique ; les quotas applicatifs ne sont ni supprimés ni réinitialisés.
Après correction, la chaîne commerciale est **8/8 PASS**, sans ignoré ni
instabilité, nettoyage vérifié : contrat actif par signature DEV gouvernée,
PDF FR/AR, livraison acceptée, refus natif de suppression, SHA-256 conservé,
révocation fournisseur et maintien de l'accès client.
[Preuve commerciale](../../artifacts/test-results/local-acceptance/linked-commercial.json).
Avantages : **6/6 PASS**, sans ignoré ni instabilité, avec nettoyage vérifié.
Création/approbation indépendantes, attribution gouvernée, rendez-vous,
refus puis réception client, consommation unique de cinq crédits et revenu nul
des crédits offerts sont prouvés. La requête de vérification SQL finale avait
un séparateur manquant après un paramètre ; elle a été corrigée puis rejouée.
[Preuve avantages](../../artifacts/test-results/local-acceptance/benefit-fulfillment.json).

La passe métier a aussi révélé et corrigé : identité de déploiement Docker non
configurée bloquant le scanner, liens hérités masqués mais accessibles au clavier
dans Finance admin, absence d'accès aux métadonnées de checklist pour Clonage,
et relation PostgREST ambiguë lors de la publication d'une checklist. La nouvelle
politique SQL ne donne accès qu'aux métadonnées, aux rôles admin autorisés avec
AAL2 ; le contenu et les mutations directes restent interdits. Ses 10 contrôles
SQL ciblés et les 7 tests unitaires des actions d'incitation sont réussis.
Une vérification par sessions GoTrue AAL2 réelles confirme l'accès admin aux
métadonnées, le refus au sous-traitant et l'interdiction du contenu privé aux deux
acteurs : [preuve d'isolation](../../artifacts/test-results/e2e-checklist-read-isolation-20261122.json).

La recette des espaces connectés est maintenant **PASS : 16/16**, zéro échec,
zéro test ignoré et zéro instabilité, terminée le 22 novembre à 20:52 UTC sous
Node 22. Les quatre rôles sont exercés en FR/AR, à 360 px et sur ordinateur.
Les tableaux de bord client, sous-traitant, franchisé et administrateur sont
explicitement inclus, avec les refus entre rôles et les vérifications d'accessibilité.
Les fixtures et états d'authentification ont été nettoyés.

Preuve locale : [résultat des quatre espaces](../../artifacts/test-results/e2e-spaces-20261122-passed.json).
Cette réussite concerne la suite définie, pas la couverture globale des 68 fonctions.

Corrections réalisées :

- Reconnaissance des images Supabase ECR en conservant les contrôles Docker,
  projet, ports, environnement, TOTP et GoTrue.
- Configuration locale explicite chargée en mémoire ; aucune réécriture de
  `.env.local` ni intervention sur le projet hébergé.
- Alignement du service Storage local de 1.73.1 vers 1.96.4, sur les mêmes volumes,
  pour le schéma versionné existant. L'ancien conteneur est conservé arrêté sous
  `supabase_storage_Matricia_before_e2e_20261122` ; la base n'a pas été réinitialisée.
- Arrêt de l'arbre du serveur de test sous Windows, et transmission au serveur
  des paramètres locaux vérifiés.
- Sélection explicite de l'organisation et du mandat pour les fixtures multi-rôles,
  correction des titres et sélecteurs de refus devenus obsolètes.
- Titre principal visible rétabli sur la page admin Parcours & dossiers.

Vérifications complémentaires : 17 tests configuration/sécurité et 3 tests du
serveur/contrat de preuve réussis ; lint ciblé de la page admin réussi sous Node 22.

Commande de relance :

```powershell
corepack pnpm --use-node-version=22.23.5 test:e2e:local-spaces
```

La suite métier élargie reste une preuve distincte. Les résultats ci-dessous
décrivent l'état initial, avant ces corrections.

Checkout : `b578c75c`, avec modifications locales préexistantes. Aucun code applicatif modifié pendant ce contrôle. Runtime disponible : Node 24.11.0 ; validation cible Node 22 non effectuée.

## Résultats exécutés

| Contrôle | Résultat | Limite |
| --- | --- | --- |
| Public : expérience et préférences cookies | 18/18 réussis, 0 ignoré, 0 instable | FR/AR, Chromium desktop et 360 px ; ne couvre pas les parcours métier connectés |
| Accès démo client | Échec du clic de connexion après 30 s | Tableau de bord non testé |
| Accès démo sous-traitant | Échec du clic de connexion après 30 s | Tableau de bord non testé |
| Accès démo franchisé | Échec du clic de connexion après 30 s | Tableau de bord non testé |
| Accès démo administrateur | Échec du clic de connexion après 30 s | Tableau de bord non testé |
| Précontrôle recette locale isolée | `Local E2E Docker identity is not verified` | Aucune fixture créée ; workflows métier non lancés |

Le timeout du sélecteur de connexion ne prouve pas un défaut du tableau de bord : le test n'a pas atteint cet écran.

## Pourcentages interprétables

- Réussite de la suite publique exécutée : **100 % (18/18)**.
- Couverture E2E globale : **non déterminée**. Le nombre de tests réussis ne fournit pas le nombre total de comportements attendus.
- Inventaire : **96 fichiers `*.spec.ts`** sous `tests/e2e`, sans implication de réussite ni de couverture exhaustive.
- Registre documentaire actuel : **5/68 VERIFIED (7,35 %)**, **63/68 IN_PROGRESS (92,65 %)**. Ce registre daté ne mesure pas la couverture E2E actuelle et ne constitue pas un nouveau visa indépendant.

## Périmètre restant pour tester tous les espaces

Établir une matrice route/action/exigence pour les 68 fonctions V1 et les 26 scénarios minimum du Gold Master §25.2. Inclure les tableaux de bord et leurs liens, filtres, formulaires, validations, erreurs, états vides, droits et refus inter-tenant pour chaque rôle. Exécuter FR/AR, RTL, clavier, desktop et 360 px. Pour chaque mutation, contrôler la persistance et les effets métier attendus ; une capture d'écran seule ne suffit pas.

Prérequis immédiats : rendre disponible une configuration locale acceptée par les garde-fous existants, réserver l'environnement de fixtures, générer les sessions authentifiées des quatre rôles et vérifier le mécanisme de connexion démo attendu par le smoke. Ne pas neutraliser les contrôles d'identité ni réinitialiser la base partagée.

## Reproduction et preuves

- `E2E_EXTERNAL_SERVER=1 PLAYWRIGHT_VIDEO=off corepack pnpm exec playwright test tests/e2e/public-experience.spec.ts tests/e2e/cookie-preferences.spec.ts --workers=2 --retries=0 --reporter=json`
- Rapport brut local : [rapport public](../../artifacts/test-results/e2e-coverage-20261122-public.json).
- `node tests/e2e/helpers/demo-spaces-smoke-run.mjs` : quatre erreurs de connexion, code de sortie 1.
- `E2E_LOCAL_ISOLATED=1 E2E_LOCAL_PROJECT_ID=Matricia APP_ENV=development node tests/e2e/helpers/p24-p26-completion-run.mjs --configuration-only` : échec du précontrôle, y compris hors sandbox.
- [Registre de couverture](../traceability/REQUIREMENTS_COVERAGE.md).
- [Prérequis de recette locale](../release/LOCAL_ACCEPTANCE.md).

Conclusion : contrôle partiel ; aucune affirmation de couverture complète, de conformité globale ou de livraison validée.
