# Audit indépendant Franchisé — base fusionnée

Date : 3 novembre 2026. Source examinée : `df67da4`, fusion des lots Client et Sous-traitant dans `codex/bootstrap-foundation`. Branche de revue indépendante : `codex/franchise-audit-20261103`. Ce document décrit les constats **avant** les nouvelles corrections ; il ne constitue pas leur recette finale.

Audit en lecture seule du produit. Les seuls fichiers écrits sur cette branche sont ce rapport et ses preuves. Aucun changement de donnée distante, de permission, de facteur MFA, de politique RLS ou de journal financier. Aucune nouvelle pile Docker. Aucune personne réelle contactée.

## Méthode et preuve exécutée

Instructions lues : `AGENTS.md`, instructions Next de `apps/web/AGENTS.md`, Gold Master V4 FINAL, en particulier décisions prioritaires et §§ 8.4, 16.1–16.13, 20, parcours et critères V1 ; skills `matricia-franchise-governance` et `matricia-franchise-finance`.

Commande réellement exécutée sur la base :

```sh
PATH=/workspace/.cache/corepack/bin:$PATH COREPACK_HOME=/workspace/.cache/corepack \
  corepack pnpm --filter @matricia/web exec vitest run modules/franchise --maxWorkers=2
```

Résultat : **45 fichiers, 195 tests réussis**, durée 19,67 s. [Journal](evidence/independent-baseline-web.log). Les dépendances sont celles déjà installées pour la même base produit ; aucun secret n'a été ajouté. Ces tests existants ne reproduisent pas les défauts financiers ci-dessous. Ils ne sont pas une preuve de disponibilité de Supabase hébergé, de Vercel, de l'email ou d'un fournisseur de signature.

Lectures/recherches effectuées avec `rg`, `sed` et analyse ciblée des fonctions SQL effectives et de leurs remplacements ultérieurs. [Reçu des vérifications statiques](evidence/independent-static-findings.json) avec empreinte de migration. **Ces vérifications sont statiques** : les scénarios SQL attendus restent à exécuter dans une base TEST par le chantier d'intégration. Aucun résultat de test SQL ou de navigateur distant n'est inventé dans cet audit.

## Constats à corriger et contre-tests requis

| ID | Priorité | Cause localisée et comportement | Contre-test d'acceptation demandé |
|---|---|---|---|
| FA01 | P1 | `data/spaces/context.ts:17` et `data/library/workspace.ts:151` ignorent `auth.getUser().error` ; avec `user:null`, une erreur Auth 503 devient une déconnexion. | 401/session absente → connexion ; 503 → incident reprenable sans requête métier ni faux « aucun mandat ». FR/AR. |
| FA02 | P1 | `data/operations/repository.ts:57–60` retourne un objet `empty` pour identifiant invalide ou utilisateur absent, et ignore Auth.error. L'appelant l'enveloppe comme succès dans `screens/library/page-helper.ts`. | Identifiant invalide, session absente et Auth 503 doivent rester distincts d'un vrai résultat vide ; vérifier les cartes et compteurs. |
| FA03 | P1 | `data/operations/repository.ts:77–79` charge documents et missions sans filtre bibliothèque ; les autres requêtes ont des limites fixes 50/100/200. RLS borne les droits, mais un même acteur autorisé sur deux bibliothèques peut mélanger leurs missions dans la sélection A. L'UI pagine ensuite seulement les lignes tronquées. | Deux mandats de la même organisation, documents/mission A et B ; sélection A ne contient pas B. Tester plus que les limites, recherche, détail ancien, pagination ou état partiel explicite. Ce constat **ne démontre pas une fuite inter-tenant**. |
| FA04 | P1 | `20260912006800_franchise_finance.sql:51`, `close_franchise_profit_period` calcule `ver := prior.version + 1`, puis inclut cette version dans le hash **avant** `begin_contract_command`. Le même appel après succès possède un autre hash. La sérialisation ne suffit pas à assurer le rejeu. | Même clé/requête → réponse identique, une clôture/allocation/audit/outbox. Autre clé de correction → nouvelle version avec delta, historique immuable. Anciennes clôtures ne doivent pas être réécrites. |
| FA05 | P1 | Même migration, `post_franchise_pnl_entry:48` accepte montant, effet, catégorie et référence libres après un contrôle du journal POSTED/organisation/devise. Aucun reçu natif n'est lu, aucun montant HT n'est dérivé des écritures, aucune politique de coût n'est contrôlée ; effet REVENUE et catégorie coût sont indépendamment acceptés. `record_franchise_distribution_payout:54` vérifie le solde **avant** le rejeu et ne lie pas le montant à un paiement canonique unique. | Refuser faux revenu, TVA, créance non encaissée, mauvaise catégorie, coût central sans règle approuvée et double source/journal sous autre clé. Rejouer un versement intégral après solde zéro doit rendre la réponse initiale. Source réelle admissible + montant/devise exacts + classification indépendante ; aucun solde/journal injecté pour faire passer. |
| FA06 | P1 | `screens/network/actions.ts:70–102` enregistre un prospect puis une activité « Invitation envoyée » ; l'activité utilise une nouvelle date/clé à chaque reprise. `save_franchise_prospect` n'émet que `FranchiseProspectSavedV1` ; le dispatcher worker classe cet événement en observabilité terminale. Pas d'envoi/lien signé de 30 jours trouvé pour ce parcours. `invite-form.tsx:30` affiche pourtant l'envoi réussi. | Invitation persistée avec cible, lien/expiration, anti-spam/déduplication et outbox durable. Distinguer demande, attente, échec et envoi confirmé. Perte de réponse/rejeu ne duplique ni dossier ni activité. TEST uniquement, aucune vraie adresse. |
| FA07 | P2 | `question-editor-actions.ts:9` transforme toute erreur de lecture du détail en FORBIDDEN ; `rule-editor-actions.ts` et `composition-actions.ts` font de même pour tous les échecs workspace. La messagerie utilise aussi un booléen de disponibilité de contexte. | 42501 → refus ; panne technique/invalid response → indisponibilité et reprise ; aucun faux refus de droits. Éviter d'exposer les détails sensibles. |
| FA08 | P1 de complétude | Gold §§16.7/16.12 non prouvé intégralement : `screens/performance/actions.ts:10` envoie une seule métrique saisie numérateur/dénominateur et une empreinte du formulaire ; `record_franchise_performance_snapshot` calcule le score global sur les seules mesures fournies, et qualité absente devient zéro. Les recherches ciblées ne trouvent pas de déclencheur worker/cron pour des audits mensuels/trimestriels ou un moteur indépendant complet à six axes. | Calcul depuis faits autorisés et versionnés, couverture et absence de mesure explicites, six axes lorsque les sources existent, rapport périodique immuable et rejouable avec drill-down. Pas de sanction automatique ni de score global rassurant à partir d'un axe favorable. |

Les propriétaires d'implémentation ont reçu les causes et contre-tests : contexte/root, éditorial, opérations/finance. Ils doivent rapporter les nouvelles migrations/tests et leurs résultats ; ce rapport ne déclare pas ces corrections déjà validées.

### Précautions spécifiques à FA05

`matricia_own_revenue_payments` contient des paiements natifs liés à `financial_journal_id`, mais ce lien seul ne prouve pas qu'un montant est un revenu HT définitivement acquis et attribuable à la bibliothèque. Les financements et consommations de crédits ont déjà un domaine séparé (`credit_economic_*`) et des allocations réservées ; leur réattribution par le P&L historique créerait un risque de double comptage.

Le garde-fou `private.assert_credit_economic_profit_close_ready_v1`, ajouté par `20261031268033`, bloque explicitement une clôture de bénéfice lorsque coûts de fulfillment et frais PSP ne sont pas rapprochés. Il faut **le conserver**. Aucun coût manquant ne doit être supposé nul pour obtenir un profit distribuable. Les méthodes de saisie/revue centrale ne doivent pas remplacer la preuve native d'encaissement, ni la règle de coût versionnée.

## Couverture des exigences et état de la base

Les lignes « mécanisme présent » décrivent une lecture du code et les tests existants cités, **pas une recette hébergée complète**.

| Exigence / parcours | Mécanisme présent sur la base | Écart ou preuve finale à fournir |
|---|---|---|
| Organisation commune et six rôles Franchisé | Contexte d'organisation, rôles OWNER/MANAGER/EXPERT/PROVIDER_MANAGER/ACCOUNTING/VIEWER ; affectations par mandat ajoutées sans remplacer les rôles historiques. | FA01, FA03 ; recette rôles composites, révoqués et deux mandats. |
| Mandat, territoire, dates effectives, exclusivité | Gouvernance versionnée, approbation indépendante, prédicats d'accès aux bibliothèques et affectations exactes. | Recette native début/expiration/rejet/révocation et sélection. Ne pas créer un mandat fictif pour masquer l'absence. |
| Signature et activation | Migration40980 distingue `CONTRACTUAL` de `NON_CONTRACTUAL_DEMO`, réserve la simulation à DEVELOPMENT/STAGING, exige mandat/hash exacts, identité email et preuve effective pour activation contractuelle. Source-binding/politique renforcés par58110/59100. | Fournisseur juridique et niveaux approuvés restent externes. Ne pas présenter le mock SIMPLE comme une signature réelle. |
| Séparation données/mutations | RLS et RPC ciblés, droits de lecture séparés ; aucune extension demandée dans cet audit. | Rejouer contre-tests inter-organisation, inter-bibliothèque, technicien/client simple et révocation immédiate. |
| Catalogue services | Création, brouillon, duplication, classement et commandes gouvernées présents ; pages serveur bornées. | Vérifier archive identité vs état de version, recherche/filtre après mutation, dossier hors première page, publication FR/AR. |
| Questions/questionnaires | Banque ciblée, composition, sections, obligatoire/optionnel, historique et soumission/revue centrale. | FA07 ; reprise panne/conflit, archives et références dans une composition figée. |
| Règles et simulation (`MAT-FUNC-008/010/040–044`) | Contrôles visuels AST/actions/dépendances, banque paginée, sandbox et revue. | Vérifier dépendances seules et cibles des actions, cycles et références étrangères ; aucune charge de 6 000 questions globale. Les audits qualité/abandons complets ne sont pas certifiés par ces 195 tests. |
| Publication centrale et indépendance | `central-review-actions` exige revue humaine/traductions explicites ; tests empêchent une approbation déduite du bouton seul. | Rejouer proposition → refus/correction → revue indépendante → publication, sans auto-approbation ni changement d'une version publiée. |
| CRM/pipeline (`MAT-FUNC-036/037`) | Prospects/types CLIENT/PROVIDER, activités, transitions versionnées, liens vers organisation et dossier fournisseur. | FA03, FA06 ; test de rejeu d'une transition après succès (état courant change avant hash/validation). |
| Invitations et origine (`MAT-FUNC-035/036`) | Écran destinataire, import CSV, prospect et origine métier. | FA06 : ne pas confondre création du prospect et invitation effectivement envoyée/acceptée. |
| Relances/digest (`MAT-FUNC-038/063/064`) | Politiques et jobs de relance, fréquence/destinataire/langue/timezone et consommateurs ; accès par mandat. | Tester panne, lease/retry, idempotence et accès révoqué, sans notification réelle. |
| Réseau/qualification/capacité | RPC de dossier fournisseur avec qualification/capacité service dans la bibliothèque mandatée et document lié au service. | FA03 ; le franchisé ne peut certifier une pièce ni une qualification par une simple case UI. Revue indépendante exigée. |
| Dossiers/devis/missions | Lectures métier sous RLS et synthèse opérationnelle. | FA03 ; cohérence requête/détail et absence de mélange entre les bibliothèques autorisées. |
| Coffre/export (`MAT-FUNC-028`) | Référence documentaire privée, téléchargement contrôlé, export de relevé et audit d'accès. CSV exact ; pas de cellule utilisateur libre dans `statementCsv`. | Recette bytes/hash/scanner réel TEST, refus hors service et liens périmés. Pas de preuve d'un scanner hébergé disponible. |
| Messagerie (`MAT-FUNC-067`) | Conversations deux parties `FRANCHISE_RFQ`, ancienne conversation Client/Provider privée ; RPC d'inbox/thread vérifie le mandat et participant FRANCHISE. | FA07 ; recette après changement d'état de dossier, contexte interdit, pagination, pièce privée et contact avant sélection. Le formulaire Franchisé direct est textuel ; les pièces ne sont pas certifiées par cet audit. |
| Marketing V1 et sélection | `/franchise/marketing` possède déjà un sélecteur d'organisation et des états contextualisés ; pas de correction arbitraire de l'ancien M25. Consentement, marque, clés sociales et outbox séparés. | Recette sélection/mandat réel et lien de régularisation si absent ; panne provider/expiration consentement/anti-doublon et tracking sans fausse conversion. |
| Finance IT/standard | Contraintes IT : Hatim 0 droit d'entrée ; 50/50/0 sur bénéfice distribuable. Standard : règle 50/25/25 versionnée. Sommes exactes, ledgers immuables, allocations avec delta et accès par livre. | FA04/FA05 ; prouver le calcul depuis revenu encaissé HT/coûts autorisés, pas seulement les pourcentages affichés. |
| Frais d'entrée standard | Modes UPFRONT/INSTALLMENT/REVENUE_WITHHOLDING, échéance maximum six mois et exemption IT en contrainte. | Réception réelle des règlements/retenues et restriction gouvernée ; aucun KPI frais ne doit créer une dette IT. |
| Qualité/performance/favoritisme (`MAT-FUNC-068`) | Compteurs réels de supervision, mesures/alertes/snapshots ; états santé et plans documentés ; contrôle gouverné pour sanctions et versions. | FA08 : six axes mesurés, source probante, rapport mensuel/trimestriel et révisions ; score/flag ne résilie jamais. |
| FR/AR/RTL/mobile/accessibilité (`MAT-FUNC-054/059/061`) | Copie des pages et composants FR/AR ; textes libres gardés ; design partagé ; document locale corrigé par lot précédent. | Recette Franchisé aux largeurs 375/390/768/1440, clavier/tactile, menu/overlay, focus, RTL et contraste. L'ancienne matrice Sous-traitant ne certifie pas ces parcours. |
| Résilience et production | Erreurs explicites et garde-fous de signature/finance existants, pas d'overlay inventant une bibliothèque vide (`canApplyFranchiseSpaceDemo()` retourne false). | FA01/02/03/04/05/06/07 ; vérifier outbox/crons externes et reprise réelle. Zéro fictif et mock de réussite interdits. |

## Conclusions limitées

La fusion est une vraie base à conserver ; l'existence de 195 tests verts ne ferme pas les écarts repérés. Les causes partagées sont l'erreur Auth ignorée, les projections tronquées ou insuffisamment contextualisées, les contrôles de rejeu trop tardifs et la confusion entre événement enregistré et action effectivement accomplie.

La sécurité du mandat/signature et plusieurs contrôles RLS sont présents ; aucun contournement ne doit être utilisé pour rendre les écrans verts. La base ne peut pas être déclarée « Franchisé 100 % » avant contre-tests exécutés, revue indépendante des nouvelles corrections, parcours natifs et preuves d'intégrations autorisées. Les six contrôles GitHub de la capture relèvent d'une enquête CI séparée ; leur cause n'est pas déduite de la durée ni du succès Vercel.

## Contre-revue des corrections — première passe

Source d'intégration lue : `50e0e96`, puis nouveaux lots jusqu'à `8c0c5d06` ; les deux ajustements locaux de `page-helper.ts` et du test de recherche sont signalés dans l'état de travail du propriétaire. La revue porte sur le code effectif, pas uniquement ses descriptions. Les migrations en cours ne sont pas considérées appliquées en hébergement.

Contrôles indépendants réellement exécutés dans le worktree d'intégration :

```sh
corepack pnpm --filter @matricia/web exec vitest run \
  modules/franchise/data/spaces/context.test.ts \
  modules/franchise/data/library/workspace-access.test.ts \
  modules/franchise/screens/access-readiness.test.tsx \
  modules/franchise/ui/franchise-context-navigation.test.tsx \
  'app/[locale]/franchise/recherche/page.test.tsx' \
  modules/franchise/screens/library/actions.test.ts --maxWorkers=2

corepack pnpm --filter @matricia/web exec vitest run \
  modules/franchise/data/network/invitation-token.test.ts \
  modules/franchise/data/network/invitation-consumer.test.ts \
  modules/franchise/screens/network/recipient-actions.test.ts \
  modules/franchise/screens/network/invitation-status-action.test.ts \
  modules/franchise/screens/network/actions.test.ts --maxWorkers=2
```

Même préfixe PATH/COREPACK_HOME que la commande de base. Résultats : **123 tests / six fichiers** et **31 tests / cinq fichiers**, tous réussis. [UI](evidence/independent-corrective-ui.log), [invitations](evidence/independent-invitations.log). Ces groupes sont inclus dans les futurs totaux globaux et ne doivent pas y être ajoutés une deuxième fois. Aucun `tsc` global, Docker ou test SQL supplémentaire n'a été lancé par l'auditeur pendant cette passe.

### Corrections confirmées à la lecture et par les tests ciblés

- L'incident Auth 503 reste un incident sans requête métier ; une session absente ou invalide conduit à la connexion. Les pages de barrage maintiennent le cadre de navigation et ne fabriquent plus de succès vide ou de formulaire métier lorsque le mandat manque.
- Le lien profond, l'organisation, le mandat explicite, la recherche et le changement de langue utilisent le même contexte ; `safeReturnPath` borne la destination. Aucun élargissement de permission n'est requis pour ce comportement.
- La projection éditoriale conserve les protections effectives de la dernière fonction40950 : lecteur de bibliothèque ciblé, audience, validation et sécurité. L'archive de l'identité doit prévaloir sur une ancienne version publiée. Les erreurs de lecture et de validation restent distinctes des refus.
- Le nouveau parcours d'acquisition45300 est distinct d'une invitation de membre ou d'un contrat de franchise : token HMAC avec clé serveur, empreinte privée, expiration, destinataire email vérifié, organisation et rôle autorisés. Le batch est atomique et rejouable ; la demande outbox n'embarque ni token ni adresse email. Le consommateur appelle réellement l'adaptateur avec une clé fournisseur stable, puis ne confirme SENT qu'après acceptation par le fournisseur. Le mode DEMO est explicite et interdit en production. Il n'ajoute ni membre, ni rôle, ni qualification, ni droit économique. Aucun SMTP réel n'est certifié par les tests contractuels ci-dessus.
- La nouvelle réconciliation45220 dérive les montants depuis des écritures EXPENSE réelles, séparément des actifs de taxe récupérable, et les rattache à une capture/une réception Client canonique ; proposition et décision indépendantes, captures figées et droits bornés. Les proportions sont calculées en décimaux exacts avec arrondi cumulatif ; aucune saisie de montant libre dans la commande de rapprochement. Un coût absent ou égal à zéro non prouvé reste bloquant.

### Problèmes supplémentaires trouvés dans cette passe

| ID | Risque précis | Correctif demandé / reçu, validation restante |
|---|---|---|
| FA09 — P1 | Deux clôtures sur des intervalles différents mais se chevauchant ne retrouvaient pas la même clôture précédente : mêmes revenus pouvaient produire deux accruals complets. Le verrou initial ne portait que sur `(book,start,end)`. | Patch `82d0eeae` / migration452120 : verrou commun du livre et refus du chevauchement d'un intervalle différent. Une correction de l'intervalle identique reste versionnée. Lecture favorable ; contre-tests SQL natifs et course concurrente à confirmer par l'intégrateur. |
| FA10 — P1 | `auth.jwt()->>'aal' <> 'aal2'` vaut NULL si la claim manque ; `IF NOT access()` ne dénie pas non plus si `access()` vaut NULL. Un rôle Finance valide pouvait ainsi passer les nouveaux points d'entrée avec une claim AAL absente. | `26109cf4` normalise les six gardes historiques ; `3debfc73` emploie `IS DISTINCT FROM TRUE` dans les rapprochements. Les contre-tests doivent couvrir claim absente et JSON-null, pas seulement AAL1. Les remplacements initiaux produisaient les tokens invalides `truethen`/`trueor`, signalés avant rejeu SQL ; résultat final exigé après réparation syntaxique. |
| FA11 — P1 | Après clôture, un remboursement/litige natif peut rendre les revenus inadmissibles alors que l'accrual historique reste positif. Le versement utilisait uniquement ce solde et un journal de règlement, sans revalider les sources. | `a0283770` ajoute une revalidation des périodes avant tout nouveau versement, après le retour d'un rejeu historique exact. Contre-test indispensable : clôture positive → remboursement vérifié → nouveau versement refusé, sans réécriture de l'ancienne clôture. |
| FA12 — P1 | La catégorie `APPROVED_SHARED_CENTRAL_COST` du chemin P&L historique restait un texte libre sans règle d'allocation centrale contractuellement approuvée. Un effet COST pouvait aussi utiliser une catégorie de revenu. | `178a4d6d` / migration452130 : exclusion par défaut des coûts centraux et couplage effet/catégorie. Lecture favorable ; contre-tests SQL requis. Ne pas inventer une politique permettant de fermer le test. |
| FA13 — P2 fiabilité | Le verrou de livre ajouté à l'écriture d'allocation ne supprime pas le verrou de financement déjà pris par son appelant68031:76. Un rapprochement prenait livre puis financement alors qu'une consommation pouvait tenir financement puis attendre livre : cycle de deadlock. | Signalé au propriétaire ; utiliser un ordre cohérent sur tous les appelants ou une acquisition non bloquante avec erreur55P03 reprenable. L'atomicité évite un ledger partiel, mais ne suffit pas à revendiquer une exploitation fiable. |

Course liée à FA11 : le reçu adverse peut exister dans `private.verified_payment_dispatch_inbox_v1` avant son import dans `credit_pack_payment_adjustments_v1`. Les protections de clôture et de versement doivent inclure cette source et ses écrivains, pas uniquement la table d'ajustements finale. Une signature de paiement correctement vérifiée mais non encore dispatchée ne doit pas laisser une fenêtre de distribution admissible. Ce point a été transmis au propriétaire financier.

Cette passe est une **contre-revue intermédiaire**. Les tests SQL réellement exécutés par le chantier d'intégration, la recette native, la matrice visuelle et le nouveau moteur de performance45400 restent à examiner avant conclusion finale. Les 123/31 tests UI/contrats ne sont pas présentés comme une preuve monétaire ou de disponibilité externe.

## Deuxième contre-revue — performance et concordance économique

Le lot natif45400 et ses corrections additives45410/45420/45430 ont été lus jusqu'au commit de domaine `3b03bacb`. Un contrôle indépendant des quatre fichiers de tests DAL/action/rendu/export a été exécuté après cette révision : **23 tests réussis**, journal [performance corrigée](evidence/independent-performance-corrected.log). Il complète les contrôles précédents ; ne pas compter cette reprise comme 23 nouveaux tests distincts du même groupe.

Lecture favorable des mécanismes suivants : six axes dérivés des faits, absence mesurée par `null`, aucun score global sans six mesures, modèle à deux administrateurs AAL2, rapports quotidiens/mensuels/trimestriels immuables, benchmark anonyme au minimum cinq autres franchises comparables, rapports/plans par page et événements50 avec continuation, séparation des mesures manuelles historiques. Les compteurs d'événements d'acquisition sont distincts de la cohorte d'invitations créée dans la période. Les commentaires utilisateur restent inchangés. La décision sur un plan est refusée à un membre actif de l'organisation opératrice, même s'il cumule un rôle Admin ; la capacité affichée suit ce refus. Les plans identiques encore ouverts ne sont plus multipliés par les trois rapports périodiques.

Le worker est réellement raccordé au planificateur natif, indépendamment de l'outbox et de l'antivirus. Son état est faux avant la première exécution, pendant un calcul, si le verrou est occupé ou après un échec ; readiness et heartbeat ne transforment pas ces états en réussite. La publication hébergée et les déclencheurs externes ne sont pas certifiés par cette lecture ni par les tests unitaires.

La portée de l'axe conformité est précisée près de l'interface : mandat et droit d'entrée applicable, pas certification de toute la clôture comptable. Un vrai coût égal à zéro n'a pas encore de mode de preuve dans le rapprochement45220 ; il reste bloqué, plutôt que supposé nul. Les rapports ne certifient pas une attribution personnelle des revenus.

### FA14 — P1 : concordance livre / franchise / droits du mandat

Un autre agent préparant la recette historique a signalé une incohérence ; elle a été **confirmée indépendamment dans le code** :

- `open_franchise_pnl_book` dans `20260912006800` valide la règle financière, le type et l'opérateur fournis, l'existence de la bibliothèque et l'organisation active. Il ne relie pas ces termes à une franchise/son mandat réel.
- `private.credit_economic_book_route_v1` dans `20261031268031:5` relie bibliothèque, organisation et devise à un mandat, mais ne compare pas le type, l'opérateur ou les parts du livre/règle financière aux termes du mandat.
- Conséquence : une route de franchise STANDARD pourrait désigner un livre IT et la clôture calculer50/50 au lieu de50/25/25. Le rôle technique Finance ou une route approuvée ne peut remplacer les droits économiques contractuels.

Le propriétaire financier et l'intégrateur ont reçu la cause. Contre-tests requis : refus de l'ouverture/routage/clôture/versement avec termes incompatibles ; autorisation du cycle exact sous ses vraies conditions ; historique et anciens ledgers conservés, avec exception de rapprochement si incompatibles. La recette historique ne doit pas exploiter ce défaut pour produire un solde positif. L'ouverture d'un livre de préparation doit rester compatible avec l'étape de droit d'entrée avant activation, sans permettre sa distribution avant mandat admissible.

### Réserves de preuve à cette étape

- La lecture des patchs de claim AAL, verrou commun du livre, coût central, revalidation avant versement, revenu historique et acquisition non bloquante du financement est favorable. Les reçus SQL finaux doivent encore démontrer ces comportements après toutes les migrations ; les anciens échecs de fixture sont conservés, jamais présentés comme verts.
- La surveillance native de favoritisme (Gold§16.9) est un chantier séparé en cours : les anciens schémas/revues déclaratives ne suffisent pas à la certifier. Une mesure de concentration ne prouve aucune faute ; toute conclusion et sanction demeurent humaines et autorisées.
- Le digest possède une vraie route de worker (`/api/workers/franchise-digests`) : absence non alléguée. Le scheduler de relances existe aussi ; son état n'était pas encore inclus dans la readiness du worker et une déférence de job pouvait rester un résultat de cycle résolu. À vérifier avant certification d'exploitation complète.
- Les nouvelles réceptions natives, clôtures et versements historiques doivent être identifiés comme TEST, avec leurs vrais prérequis. Aucun score, texte juridique, taxe, reçu de paiement, signature ou période écoulée n'est inventé dans ce rapport.

## Troisième contre-revue — rattachement économique et responsables des plans

Sources lues le 3 novembre 2026 : `/workspace/franchise-history` au commit `93ba426d` pour les migrations452800–452840 et `/workspace/franchise-risk` au commit `01d91255` pour45450/454510/454520. Le travail anti-favoritisme45440 présent sans commit dans le second worktree est distinct et n'est pas déclaré validé ici. Aucune modification produit, aucun DDL ni commande SQL n'a été effectué par l'auditeur.

Contrôles indépendants exécutés, avec le même préfixe PATH/COREPACK_HOME documenté :

```sh
corepack pnpm --filter @matricia/web exec vitest run \
  modules/franchise/screens/gouvernance/book-opening-actions.test.ts \
  modules/franchise/screens/gouvernance/book-opening-form.test.tsx --maxWorkers=2

corepack pnpm --filter @matricia/web exec vitest run \
  modules/franchise/screens/performance/native-owner-actions.test.ts \
  modules/franchise/screens/performance/native-owner-controls.test.tsx \
  modules/franchise/screens/performance/native-plan-actions.test.ts \
  modules/franchise/screens/performance/native-control-panel.test.tsx --maxWorkers=2
```

Résultats : **21 tests / deux fichiers** pour les livres et **23 tests / quatre fichiers** pour les plans, tous réussis. Journaux [livres](evidence/independent-book-review.log) et [responsables](evidence/independent-owner-review.log). Une partie des tests plans était déjà incluse dans les contrôles antérieurs : ces chiffres décrivent les exécutions, pas un nombre cumulatif de tests distincts.

### FA14 : correction favorable en source, preuve SQL finale attendue

Le registre immuable lie désormais chaque livre au mandat approuvé exact, à sa décision indépendante, à son hash, à la règle financière et aux parts réelles. Les arguments type/opérateur de l'ancien appel ne peuvent plus redéfinir les droits approuvés. L'ouverture explicite autorise la préparation du droit d'entrée avant activation ; les écritures financières ultérieures passent par des gardes de table, qui persistent même si un corps de commande est remplacé plus tard.

La route active vérifie le clone d'activation exact, son identité et les bornes temporelles. La clôture historique utilise les termes figés du mandat applicable ; la fin actuelle de franchise ne crée ni ne supprime rétroactivement un revenu. Un versement sans clôture sourcée est refusé. Les preuves d'activation ambiguës et les anciens livres incohérents restent des rapprochements requis ; aucun solde, reçu ou événement légal n'est fabriqué pour les rendre recevables.

Les projections de gouvernance et l'export filtrent le `franchise_id` exact du registre, y compris si deux territoires partagent la même organisation et bibliothèque. Le fallback ancien est limité à un rattachement unique et cohérent. La dette de droit d'entrée en production exige une preuve signée effective, même avant activation ; le mode non contractuel est attesté côté serveur uniquement en DEVELOPMENT/STAGING. Les montants, modes et échéances proviennent du mandat, avec sérialisation de la dette au niveau de la franchise. La lecture des contre-tests0372 est favorable ; leur exécution après toutes les migrations appartient au chantier d'intégration.

### Responsables : reprise gouvernée sans réécriture

Les propositions de plans gardent leur suggestion d'origine. Une affectation réelle se fait par proposition puis décision d'un autre Admin AAL2 indépendant, sans appartenance active à l'organisation opératrice ; version, cible et habilitation exacte sont revérifiées sous verrou. Une nouvelle affectation gouvernée permet de reprendre un plan dont le responsable a été révoqué, sans modifier l'approbation historique. Un responsable absent ou révoqué bloque la progression/la clôture, sans remplacement silencieux. Les nouvelles tables privées ne reçoivent pas de droits d'écriture API.

Deux défauts supplémentaires trouvés pendant cette revue ont déjà été corrigés en source par le propriétaire :

- `5a3092db` /454510 réévalue le droit de l'acteur COMMENT/PROGRESS après verrouillage des lignes d'habilitation. La première version vérifiait ce droit avant le verrou, ce qui laissait une course avec une révocation.
- `01d91255` /454520 exige une file centrale ACTIVE. La première version utilisait un `INSERT SELECT` sans vérifier le cas sans ligne et pouvait créer le plan sans tâche centrale. L'absence lève maintenant55000 et fait échouer explicitement la transaction et le cycle ; les tâches des plans ouverts sont reprises. Ce cas n'est pas transformé en file vide ou en réussite.

La page Admin de responsable et la tâche centrale existent réellement. L'affectation seule ne ferme pas la tâche : seule une clôture gouvernée du plan permet de la résoudre. Les capacités UI reprennent la séparation des responsabilités et l'état courant. La fraîcheur des contre-tests0373 doit être vérifiée par l'intégrateur.

### FA15 — P2 : clôture avec des remesures anciennes incompatibles

Un défaut reste ouvert dans `20261103454510_franchise_control_actor_recheck.sql:32` et dans `private.franchise_control_owner_context_v1` de45450 : le critère COMPLETED cherche, **pour chaque objectif séparément**, n'importe quel rapport du franchisé créé après la proposition, sans sélectionner une remesure commune récente ni imposer un modèle comparable.

Contre-exemple déterministe à ajouter en SQL : un premier rapport récent améliore A mais laisse B sous sa cible ; un second améliore B alors qu'A a régressé. Le prédicat actuel trouve le premier pour A et le second pour B : il autorise la clôture alors qu'aucune mesure ne satisfait les objectifs ensemble. Un ancien rapport satisfaisant n'est pas invalidé par une mesure plus récente dégradée. Ce défaut ne déclenche aucun versement automatique ; il permet une certification incorrecte d'achèvement du plan.

Cause et contre-test transmis au propriétaire performance et à l'intégrateur. Correction demandée : un même helper pour capacité et commande, fondé sur une remesure native explicitement sélectionnée et comparable, postérieure à l'approbation et satisfaisant tous les objectifs sur le même rapport. Les 23 tests Web cités ci-dessus ne couvrent pas ce prédicat SQL et ne ferment donc pas FA15.

## Quatrième contre-revue — FA15, preuve de coût nul et signaux de gouvernance

Source intégrée inspectée : `349774fd` dans `/workspace/franchise-completion`, comprenant le correctif de remesure `4fcd2097` (intégré `c64afebc`), le lot de signaux `2ccab4fe` et son successeur `06def1f1`. Cette revue ne certifie aucun DDL ni intégration distante ; le rejeu SQL frais est encore à la charge de l'intégrateur.

### FA15 corrigé en source

La migration454530 remplace le prédicat dispersé par `private.franchise_control_completion_measurement_v1`, partagé entre capacité et commande. Elle choisit le dernier rapport du même type sans sauter un dernier modèle incompatible, exige le modèle exact du plan et une collecte après approbation, puis vérifie tous les objectifs sur ce seul rapport. La clôture future reçoit une preuve privée immuable liant son événement au rapport précis. Cela ferme les contre-exemples « A puis B avec régression de A » et « ancienne réussite puis dégradation » dans le code ; l'exécution des nouveaux contre-tests0373 reste attendue. Les rapports structurels TEST ne prouvent pas une remédiation native complète passée en production.

### Coffre financier et vrai coût égal à zéro

Lecture de45300/45310 et de leurs appelants serveur : la cible est un financement avec capture native exacte ou une consommation livrée et acceptée avec allocations cohérentes. La preuve n'est ni un montant utilisateur arbitraire ni un hash saisi sans fichier. Le navigateur réserve une identité de fichier bornée ; le serveur télécharge les octets privés après autorisation, contrôle taille, SHA-256 et type ; le scanner de confiance détient un bail/version, revérifie les octets et enregistre un verdict natif. Un incident de scan garde un état non recevable et une reprise durable. Le mode sandbox est explicitement refusé en production.

La lecture des bytes CLEAN passe par une capacité serveur liée au document/acteur, une vérification effective des octets et un reçu privé audité. La décision indépendante exige ce reçu et refuse auteur du document, auteur de proposition, opérateur et parties concernées. Un zéro admis ajoute une preuve analytique exacte ; aucun journal nul, faux encaissement ou solde n'est inséré. Révocation et remplacement zéro→zéro sont append-only. La clôture et le versement revalident l'admissibilité, et la révocation participe au verrou de cohérence des sources. Une preuve absente/rejetée/révoquée ne devient jamais zéro par défaut.

Tests indépendants réellement exécutés :

```sh
corepack pnpm --filter @matricia/web exec vitest run \
  modules/shared/lib/finance-cost-proofs/server.test.ts \
  modules/shared/lib/finance-cost-proofs/review-commands.test.ts \
  modules/shared/lib/finance-cost-proofs/browser-upload.test.ts \
  modules/shared/lib/finance-cost-proofs/scan-consumer.test.ts \
  modules/admin/screens/pnl/finance-cost-proof-panel.test.tsx \
  'app/api/finance/cost-proofs/uploads/[uploadId]/route.test.ts' \
  app/api/workers/finance-cost-scans/route.test.ts --maxWorkers=2
```

**82 tests / sept fichiers réussis**, [journal](evidence/independent-finance-vault.log). Ces tests utilisent des adaptateurs contrôlés : ils prouvent les contrats/erreurs et vérifications des octets, pas l'existence d'un scanner ou d'un objet hébergé réel. Le test SQL0370 représente les métadonnées et callbacks de scan TEST comme tels, sans prétendre certifier un antivirus de production.

Deux écarts concrets transmis à l'intégrateur :

| ID | Statut et cause | Recette requise |
|---|---|---|
| FA16 — P2 | **Ouvert à cette révision.** `get_finance_cost_documents_v1` (45310:184–188) ne reprend pas les exclusions de membres d'organisations des allocations/faits de `decide_credit_economic_cost_v1` (45310:75–78). Exemple PSP : le document appartient au client, un Finance membre du franchisé peut voir `can_decide=true` puis être refusé à la commande. La protection serveur reste effective. | Compte Finance composite lié au franchisé ou client concerné : capacité false et refus serveur ; compte indépendant admissible : capacité cohérente avec prérequis de lecture/scan. Employer la même règle plutôt qu'élargir la commande. |
| FA17 — P2 reprise financière | **Ouvert à cette révision.** Après zéro admis puis révoqué, une facture EXPENSE réelle ne peut remplacer ce zéro. La proposition positive effective452210:55 refuse toute réconciliation préexistante ;45310 conserve ce chemin et renomme seulement la décision en helper privé. Cette décision positive insère encore la version par défaut1, et l'attribution45310:130 refuse ensuite zéro→positif. La panne reste bloquante et sûre, mais une preuve réellement devenue payante n'a pas de reprise métier. | Zéro admis → révocation indépendante → vrai journal EXPENSE positif → proposition/décision indépendantes → version suivante et attribution positive exacte → clôture corrigée avec delta. Tous anciens documents, réconciliations, attributions et ledgers doivent rester immuables. Ne pas permettre une preuve nulle d'effacer une dépense admise. |

### Signaux Gold§16.9 : périmètre mesuré et limites conservées

La collecte45440 fige les missions, passages matching, panels/invitations, décisions de qualification et revues, conflits déclarés et réaffectations. La qualification utilise l'audit immuable antérieur à la décision, pas un `requested_at` mutable. La vue membre n'expose pas les conflits libres ni identités de revue ; l'inspection Admin AAL2 est motivée, bornée et auditée. Proposition et approbation sont séparées, indépendantes de l'organisation opératrice ; aucune conclusion n'écrit de sanction ni de commission. Une file RISK_FLAGS absente échoue explicitement.

Le correctif454410 crée une vraie demande et tâche successeurs après conclusion approuvée FURTHER_REVIEW_REQUIRED ; le rejeu retourne la même réponse sans recréer de suite. Les sources utilisent un agrégat de bibliothèque explicitement déclaré : faute de binding métier territorial, aucune attribution à un territoire ou franchisé n'est certifiée. Les seuils numériques approuvés restent manquants ; absence de verdict explicite, pas score de culpabilité inventé. Cette limite empêche de déclarer Gold§16.9 totalement clos.

```sh
corepack pnpm --filter @matricia/web exec vitest run \
  modules/franchise/data/governance-signals/repository.test.ts \
  modules/franchise/screens/performance/governance-signal-actions.test.ts \
  modules/franchise/screens/performance/governance-signals-panel.test.tsx --maxWorkers=2
```

**17 tests / trois fichiers réussis**, [journal](evidence/independent-governance-signals.log). Aucun nouveau P1 concret de permission ou d'écriture financière n'a été trouvé dans ce lot par cette lecture. Les contre-tests SQL0371 et la recette de saisie native de conflit/missions restent à attester séparément.

## Revue ciblée de la reprise financière455310

Source : commit de domaine `a42a92e2` dans `/workspace/franchise-history`. Lecture seule des 149 lignes de `20261103455310_credit_zero_to_expense_governed_recovery.sql` et du scénario0376 ; aucune exécution de ces migrations/tests par l'auditeur.

- **FA16 corrigé en source** : `private.credit_economic_cost_decider_allowed_v1` devient la règle partagée pour les deux décisions de coût et `can_decide`. Elle conserve les conflits auteurs document/journal/proposition, opérateur/réception et membres des organisations allouées. Le contre-test0376 utilise précisément un Finance membre de l'opérateur distinct du client du document.
- **FA17 corrigé en source pour une période encore ouverte** : la reprise exige le dernier zéro réellement admis, sa révocation indépendante et l'égalité des hashes/décisions ; proposition et approbation figent le prédécesseur exact et ajoutent une version. Le journal EXPENSE positif reste soumis aux contrôles préexistants de provenance, organisation, devise, net HT, journal non réutilisé et revue indépendante. Le jour comptable correspond à la capture ou consommation canonique ; aucun déplacement automatique entre périodes n'est admis.
- Les livres concernés sont verrouillés dans un ordre déterministe avant de rechercher des clôtures existantes. Toute allocation dont le jour est déjà couvert par une clôture produit `CREDIT_ECONOMIC_CLOSED_PERIOD_REVIEW_REQUIRED`. Le verrou de journal reste cohérent avec l'ordre livre→journal du classificateur P&L452120/452230. Une attribution nulle antérieure reçoit un successeur analytique ; elle n'est ni modifiée ni effacée. Une dépense positive admise ne devient pas une nouvelle preuve de zéro.

Aucun nouveau défaut concret de permission, provenance ou version n'a été trouvé dans cette lecture. Le test0376 prévoit la reprise positive réelle, les conflits d'acteurs, le mauvais jour, le rejeu, l'immuabilité et l'absence de clôture anticipée du jour courant. **Il ne reproduit pas encore le cas d'une allocation déjà couverte par une clôture historique.** Cette garde est présente en source ; son scénario natif reste à attester avec une fixture historique appropriée, sans fabriquer d'anciens revenus, soldes ou signatures. La reprise d'une période déjà close reste volontairement une revue requise, pas une correction comptable automatique certifiée.

Les statuts « corrigé en source » ci-dessus ne remplacent pas les reçus SQL frais0376. Aucun des 82 tests Web du coffre ne prouve à lui seul l'admission SQL de cette reprise.

## Relecture de la correction issue du replay frais455340

Commit de domaine `654cc344` relu sans exécution SQL : qualification des deux références `id` ambiguës dans `create_franchise_finance_rule`, séparation privée de l'identité de rôle et des prérequis d'autorisation, capacité de reprise scanner alignée. L'identité directe d'attribution non révoquée sert seulement à distinguer un prérequis MFA manquant d'un refus : elle n'est pas un nouveau droit et l'assertion applique toujours session/compte actifs, AAL2 strict puis le helper complet Finance. Le cumul READ_ONLY_AUDITOR reste interdit d'écriture. `can_retry` conserve créateur, UPLOADED, PENDING/ERROR et absence de lease active. Les tests d'ACL attendent le véritable42501 avant le corps serveur, sans ouvrir EXECUTE. Aucun nouveau défaut concret identifié à cette lecture ; les résultats du replay antérieur ne sont pas attribués à cette migration tant qu'elle n'est pas rejouée.

## Relecture du correctif de frontière INVOKER455360

Commits de domaine `41fb6654` et `0d631846` relus : les trois wrappers publics ne renvoient que des booléens après session active, MFA pour les rôles centraux et contrôle natif exact du livre/franchise. Un livre étranger est refusé avant divulgation de son état de rattachement ; le prédicat de scope vérifie l'accès à la franchise sélectionnée et l'égalité exacte du registre. Le snapshot demeure INVOKER, avec les RLS/budgets existants. Aucun USAGE du schéma private ni droit global n'est ajouté ; les EXECUTE authentifiés des implémentations privées sont retirés. Aucun élargissement concret Finance ou inter-organisation trouvé par cette lecture. Les nouveaux tests ciblent propriétaire réellement affecté, territoires voisins, Client, MFA, INVOKER et absence de private USAGE ; leur exécution fraîche reste à attester par l'intégrateur, sans résultat SQL anticipé ici.
