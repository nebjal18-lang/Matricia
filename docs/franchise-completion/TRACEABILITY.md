# Traçabilité des constats financiers et Franchisé

Les constats de la contre-revue sont distincts de l’ancien audit navigateur M01–M30, déjà traité dans les lots fusionnés. Ce tableau trace le présent chantier, sans réétiqueter l’ancienne préversion comme candidat final. Les preuves Web sont regroupées dans [le reçu candidat](evidence/integration/candidate-checks.json), les preuves SQL finales dans [le replay558](evidence/sql/final-fresh-558/summary.json). Une revue favorable de source n’est pas une recette hébergée.

| Identifiant | Cause et correction | Source principale / preuve | État et limite |
|---|---|---|---|
| FA01 | Auth indisponible assimilé à session absente ; classification technique et reprise exacte. | `data/spaces/context.ts`, `data/library/workspace.ts`, proxy partagé ;24 tests proxy. | Corrigé ; panne Auth native en cours de recette. |
| FA02 | Échec de contexte transformé en objet opérationnel vide. | `data/operations/repository.ts`, `screens/library/page-helper.ts`. | Corrigé, tests DAL et états partiels réussis. |
| FA03 | Projections mélangées entre mandats, limites silencieuses et versions historiques arbitraires. | Lecteurs opérations/espaces et migration45200+ ;0368/0372/0377. | Corrigé ; recette multi-mandats finale en cours. |
| FA04 | Identité de clôture variant avec sa version générée ; rejeu de versement après contrôle du solde. | Migrations45210+ ;0362. | Corrigé ; ancien bénéfice sans source canonique reste bloqué. |
| FA05 | Effet/catégorie/montant P&L libres, journal réutilisable et revenu non prouvé. | Gardes45211–45226, rapprochement canonique ;0362/0364/0369. | Corrigé, coûts nets réels et contrôles négatifs vérifiés. Pas de distribution historique positive inventée. |
| FA06 | Prospect « invité » sans véritable invitation durable. | `data/network/invitation-consumer.ts`, actions réseau, worker ;0363. | Corrigé ; livraison email hébergée non certifiée. |
| FA07 | Erreurs de détail, règles et composition transformées uniformément en refus de droits ; contexte de messagerie réduit à un booléen. | Actions des éditeurs, loaders partagés et états de messagerie. | Corrigé, tests FR/AR : refus réel, incident, réponse invalide et reprise distincts sans détail sensible. |
| FA08 | Score global sur données partielles, qualité absente ramenée à zéro, périodicité/axes non prouvés. | Performance native45400+, worker, rapports et signaux ;0365/0371/0373. | Six axes et rapports corrigés/vérifiés. Seuils de favoritisme approuvés et liaison territoriale de certaines sources manquants : indicateurs descriptifs, pas de verdict automatique. |
| FA09 | Deux intervalles chevauchants pouvaient reconnaître deux fois un même bénéfice. | Verrou du livre et refus du chevauchement45212 ;0362. | Corrigé et vérifié. |
| FA10 | Comparaisons SQL à NULL n’imposaient pas toujours AAL2. | Gardes `IS DISTINCT FROM`, matrice rôles/assurance ;0360/0362/0364/0370/0372. | Corrigé et vérifié : absent, JSON-null et AAL1 refusés. |
| FA11 | Nouveau versement sans revalidation après remboursement/litige ; fenêtre avant import d’un événement adverse. | Gardes45219/45223–45226 ;0364 et source de dispatch vérifiée. | Correction et refus sur faits adverses courants vérifiés. Scénario positif historique clôturé puis remboursé non certifié faute de source historique canonique. |
| FA12 | Coût central et catégories incompatibles admis par simple texte libre. | Garde45213 ;0362. | Corrigé : refus sans politique contractuelle approuvée ; aucune règle inventée. |
| FA13 | Ordres de verrouillage contradictoires entre consommation et rapprochement. | Acquisition cohérente/non bloquante45223+ et reprises. | Corrigé en source et contrôles ciblés ; aucune nouvelle campagne de charge à deux connexions certifiée par ce replay. |
| FA14 | Livre/type/règle fournis par l’appelant sans mandat économique exact. | Registre append-only52800+, ouverture Admin ;0372 :52 assertions. | Corrigé et vérifié, y compris lecteur propriétaire, mauvais territoire, MFA et maintien INVOKER/RLS. |
| FA15 | Anciennes remesures différentes pouvaient justifier ensemble une clôture incorrecte. | Helper unique du dernier rapport comparable45453 ;0373. | Corrigé et vérifié, preuve de complétion immuable. |
| FA16 | `can_decide` ignorait certaines appartenances refusées par la commande. | Helper commun d’indépendance45531 ;0376. | Corrigé et vérifié avec acteur Finance composite. |
| FA17 | Zéro admis/révoqué impossible à remplacer par une dépense réelle. | Reprise45531 et versions liées ;0376 :127 assertions. | Corrigé et vérifié pour période ouverte. Refus d’une période déjà close revu en source ; scénario historique positif correspondant non exécuté. |
| FE01 | Archive masquée par le statut d’une ancienne version. | Projection45100,0361. | Corrigé/vérifié. |
| FE02 | APPROVED compté comme publié. | Compteur partagé de bibliothèque et tests. | Corrigé/vérifié. |
| FE03 | Éditeur choisissant la version publiée plutôt que le brouillon courant. | Lecteur/éditeur de questions. | Corrigé, versions utilisées préservées. |
| FE04 | Cibles de règles omises et parcours récursif non borné. | Collecteur itératif de références, commandes de composition. | Corrigé, tests bornes/cibles réussis. |
| FE05 | Incident, refus et verrouillage confondus dans les constructeurs. | Erreurs de commandes et loaders communs FR/AR. | Corrigé, reprise sans perte de saisie. |
| FE06 | Duplication de question native non reliée à un formulaire. | Formulaire et commande de duplication de question. | Corrigé ; validation du nouveau code et du motif conservée. |
| FE07 | Détail hors du cadre Franchisé et retours de navigation incohérents. | Détail de questions, accès et cadre partagé. | Corrigé ; contexte et langue du détail conservés. |
| FE08 | Association de questionnaire et absence de retour/documents inventées par l’inspecteur. | Inspecteur de service et sources documentaires réelles. | Corrigé ; seuls les faits effectivement chargés sont affirmés. |
| FE09 | Catégories transmises par nom et pagination perdant le filtre de type. | Options par identifiant et liens de page. | Corrigé, tests filtres/pagination réussis. |
| FE10 | Choix implicite du premier mandat et formulaires perdant son identité. | Choix explicite, transmission du mandat ;0374/0377. | Corrigé ; libellés territoriaux approuvés ajoutés après reproduction native. |

## Causes supplémentaires reproduites au navigateur ou au replay

| Cause | Correction et preuve |
|---|---|
| Activation Franchisé sans raccordement catalogue |45520 crée/répare la délégation depuis la preuve approuvée et acceptée ;0374, aucune ACL métier manuelle. |
| Huit formulaires produisant un UUID de version invalide | Namespace déterministe qui préserve version/variant, validations conservées ; création et duplication natives réussies. |
| Livrables FR/AR refusés par le validateur SQL | Contrat strict bilingue ou chaîne historique, sauvegarde sans suppression ;0375. |
| Connexion OTP validée puis POST intercepté par le proxy | Redirection de confort limitée GET/HEAD ; contre-tests2 échecs avant,24 succès après. MFA reste contrôlé côté serveur. |
| Création de règle financière invalide | Colonnes SQL qualifiées puis scopes d’idempotence normalisés sans assouplir la contrainte ;0372. |
| Projection INVOKER appelant un helper privé inaccessible | APIs booléennes étroites, contrôle exact, aucun USAGE privé ; INVOKER/RLS conservés,0372. |
| Mauvais message de prérequis MFA | Identité de rôle courante séparée de l’autorisation finale stricte ;0370/0372 et aucun grant élargi. |
| Description de bibliothèque, fournisseur et documents invalide pour un lecteur d’écran | Couples `dt/dd` dans les composants partagés ;117 tests du delta, recette axe finale encore en cours. |
| En-tête mobile superposé et colonnes illisibles | Contexte sur une seconde ligne, tableaux dans leur zone défilante lisible, accès recherche mobile ; Services FR375/390 vérifié au C2, matrice C3 en cours. |

Les contenus libres ne sont pas traduits. Aucune donnée réelle de société, prix ou condition commerciale absente n’est inventée. Aucune intégration hébergée, signature juridique, sauvegarde/restauration de staging ou publication client n’est certifiée par ces tests locaux.
