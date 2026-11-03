# Franchisé : périmètre opérationnel et intégrité financière

Source : `df67da4`, fusion des lots Client et Sous-traitant. Travail isolé sur `codex/franchise-operations-20261103` ; aucune production modifiée.

## Causes corrigées

| Constat | Cause reproduite dans le code | Correction et preuve |
|---|---|---|
| FA02/FA03 | Une panne Auth retournait un tableau opérationnel vide ; listes bornées silencieusement à 50/100/200 lignes | Incident explicite avant toute requête métier ; pages serveur ordonnées de 100 lignes, filtres parent bornés à 80 identifiants, aucune première page conservée si une suivante échoue. Tests DAL et collecte. |
| FA03 | Missions chargées sans bibliothèque, documents chargés globalement, capacités historiques plutôt que courantes | Projection de missions limitée au mandat choisi, contrôle des identifiants de bibliothèque/franchise reçus ; documents/capacités/qualifications issus des dossiers natifs du mandat. Les autres mandats lisibles ne doivent pas se mélanger au contexte sélectionné ; les RLS générales ne sont pas élargies. |
| FA03 | Urgence de demande dérivée d'une version historique arbitraire | Projection de `current_version_id` et résolution de cette version exacte. Test où une ancienne version arrive après la courante. |
| Coffre | Les références textuelles d'activité CRM étaient présentées comme documents du coffre | Seuls les documents natifs entrent dans le coffre. Les références CRM restent consultables dans la chronologie du dossier. Une panne CRM ne masque pas les documents natifs disponibles ; une panne documentaire ne devient pas « aucun document ». |
| FA04 | La prochaine version générée entrait dans l'identité de la commande de clôture | Hash de commande stable fondé sur l'intention ; hash du contenu clôturé et historique immuable conservés ; compatibilité explicite des clés déjà terminées ; protections de rapprochement crédit conservées. |
| FA04 | Un rejeu de paiement vérifiait le solde déjà consommé avant de retrouver son reçu ; même journal réutilisable avec autre clé | Rejeu du reçu avant le contrôle du solde ; verrou de journal et contrôle anti-réutilisation global, écriture native de versement exacte et revue indépendante du comptabilisateur. |
| FA04 | Montants, sources et catégories P&L sans rapprochement réel avec les écritures | Journal de charge net exact, date civile réelle, référence canonique, classification par un autre acteur Finance AAL2 ; journal consommé une fois ; correction append-only avec catégorie et montant d'origine. La TVA comptabilisée séparément sur un compte d'actif n'est pas une charge. |
| FA04 | Un journal générique pouvait être présenté comme preuve d'encaissement HT acquis | Refus explicite du revenu legacy non rapproché. Le chantier de rapprochement natif du crédit est distinct (`45220+`, test `0364`) ; ce refus seul ne certifie pas sa réalisation ni un profit distribuable positif. |
| Finance UI | Dernier relevé déjà clôturé nommé « Pré-relevé » ; montants systématiquement divisés par 100 | Tous les relevés clôturés restent des relevés. Présentation monétaire exacte partagée avec exposants ISO (JPY/TND/KWD), signes et grandes valeurs, FR/AR. Colonne nommée « Montant ». |
| États partiels | Zéro alerte présenté pendant une panne CRM ; finance bloquée si seule la supervision métier échouait | Alertes non disponibles au lieu de zéro rassurant ; finances disponibles si leur source gouvernance est chargée ; propositions volume dépendantes de la supervision métier. |

## Vérification de ce lot

- 29 tests ciblés réussis dans cinq fichiers (DAL, collecte, monnaie, projection et composants), dernier contrôle avant le changement limité de l'en-tête « Montant ».
- Lint ciblé réussi ; contrôle TypeScript lancé mais son résultat final doit être lu dans le reçu d'intégration du parent.
- Test SQL `0362` ajouté : vrais acteurs de test, book ouvert par RPC, journal de charge par commande native, revue indépendante, montant HT/TVA séparé, duplication refusée, clôture historique d'une perte réelle, rejeu exact et AAL2. Aucun ledger injecté, aucun trigger désactivé. **À exécuter sur la base jetable d'intégration ; aucun succès SQL local revendiqué à ce stade.**
- Le test de perte n'est pas une preuve de profit positif ni de versement positif. Ceux-ci appartiennent à la recette native de rapprochement `0364`.

## Contraintes préservées

MFA/AAL2, habilitations serveur, isolation RLS, journaux et allocations immuables, audit/outbox, règles IT Hatim 50 % / NEOXA 50 % / Asma 0 % avec droit d'entrée nul. Pas de taux ni de prix fiscal inventé. Aucune date de production déplacée pour faire aboutir une clôture.

La recette navigateur et les contrôles SQL d'intégration devront citer leur candidat exact. Ce rapport ne certifie pas les intégrations hébergées, les conditions légales ou une mise en production.

## Extension des listes et états natifs d’invitation

Le CRM, les relances, le digest et les plans correctifs utilisent également une collecte ordonnée par pages. Le plan correctif accepte le `franchiseId` du mandat sélectionné avant la pagination ; le chargeur de page doit transmettre cette valeur. Les rejets de transport sont contenus en incident technique ; une réponse Auth 503 n’est pas transformée en déconnexion. Les relances exposées sont limitées aux prospects réellement chargés dans ce périmètre.

Les dossiers CRM présentent maintenant le dernier état de la vraie invitation (`QUEUED`, acquittement du service d’envoi, ouverture, inscription, expiration, révocation) et son mode. Un test non contractuel reste explicitement marqué ; un prospect sans invitation n’implique aucun envoi. Cette projection nécessite la migration du lot Invitations `45300+` et ne lit aucun token privé.

Preuves complémentaires : six tests de lecteurs (301 prospects, échec de seconde page, Auth 503/401/rejet, deux périmètres de plans), quatre tests de libellés d’invitation et reprise du groupe opérationnel. Le reçu SQL final de `0362` doit provenir de l’intégration : le premier passage avait correctement exclu une charge créée après une coupure historique trop ancienne ; le correctif de fixture fige maintenant la coupure après la commande native, sans modifier les dates de création.

## Réseau, gouvernance et constats de revue supplémentaire

- Le réseau inclut les vrais dossiers prestataires autorisés même sans prospect CRM. Ces lignes ne deviennent pas des prospects fictifs : les commandes de chronologie CRM nécessitent leur vraie version de prospect. Les pièces natives sont accessibles par le parcours privé existant.
- Les cinq filtres réseau proposent de vraies options (service, profil, capacité, région, documents), s’appliquent conjointement et conservent le mandat pendant recherche et pagination. Les filtres de qualité sans implémentation effective ne sont plus proposés ; recherche et vues métier restent disponibles.
- Les formulaires GET des dossiers, de qualité, du coffre et de la messagerie conservent organisation et franchise. Les paramètres réseau doivent être transmis par les routes racines et imbriquées.
- La permission CRM ne sert plus de permission de qualification ou d’édition : une projection du mandat expose séparément les habilitations Expert, Responsable prestataires, Viewer et Manager. Les contrôles de mutation serveur restent souverains.
- La proposition volume porte un `franchiseId` explicite, des quantités décimales exactes et des libellés métier FR/AR. L’ancienne commande limitée à la bibliothèque refuse une sélection ambiguë ; elle ne choisit plus un territoire selon sa date de création.
- Un prospect CRM qualifié n’est plus présenté comme résultat d’un matching inexistant. Seuls les vrais résultats serveur alimentent ce matching.
- Le panneau qualité ne certifie plus des photos, rapports, étapes achevées ni une décision en attente sans donnée. Il affiche les signalements, références et plans réellement chargés et renvoie vers la messagerie pour l’instruction.
- Les nouveaux gardes SQL refusent AAL absent/null, les clôtures de périodes chevauchantes et les charges centrales non approuvées. Le verrou de livre est partagé par classement, clôture et versement. Les montants/historiques existants restent immuables.

Avant refactor du lecteur de qualification : 42 tests ciblés réussis dans cinq fichiers ; lint ciblé réussi. SQL `0368` ajouté, recette réelle à lire dans le reçu du parent (aucune preuve d’activation juridique tirée de ses seules fixtures).

## Qualification commune Admin / Franchisé

Le formulaire Franchisé exigeait un UUID saisi manuellement et une attestation générique, alors que le garde natif impose la projection originale lue par le réviseur. Le lecteur partagé charge désormais les dépôts autorisés, présente questions/réponses figées, conserve les textes libres, sélectionne un dépôt, porte son hash et sa version, puis recueille le score humain indépendant et l’attestation. Les anciens imports Admin restent compatibles par délégation.

La projection backend ajoutée au lot Sous-traitant vérifiait seulement les rôles plateforme : elle bloquait aussi les réviseurs Franchisé pourtant autorisés par la commande métier antérieure. `45207` rétablit cette autorité pour le service exact, après résolution du dossier ; MFA/AAL2, interdiction d’auto-revue et absence d’accès général aux sessions privées restent en place. `0368` contient des contre-tests Expert, Viewer, AAL1 et acteur également membre du prestataire. La simple absence de session dans ses fixtures n’est pas présentée comme une preuve de lecture de réponses réelles.

## Rattachement financier explicite

Le tableau financier consomme les indicateurs serveur tri-état du rapprochement livre/mandat : `false` explicite autorise la présentation des données certifiées, `true` exige une revue et rend les totaux indisponibles, l’absence de réponse ou `null` affiche une vérification indisponible. Les lignes d’un livre non certifié ne sont pas projetées ; les propositions de volume restent indépendantes. Ce lot nécessite le modèle et la projection FA14 du lot historique. Tests FR/AR : 20 réussis dans les deux fichiers de projection et composants ; lint ciblé réussi.

## Exploitation des relances durables

L’ordonnanceur distingue une file sans échéance d’une panne et expose son état au readiness intégré. Un échec de mise en file reste un échec du cycle même lorsque sa reprise durable a été enregistrée ; les autres jobs indépendants continuent. Les reçus de planification, de lease, de mise en file et de reprise doivent correspondre aux identifiants et formats attendus. Les appels concurrents partagent la même promesse. La mise en file n’est pas qualifiée d’envoi d’e-mail. 21 tests ciblés réussis : transports, reçus invalides, échec d’enregistrement de reprise, continuité des jobs et non-chevauchement. Le raccordement main/readiness/heartbeat est fourni par l’intégration.

Le test `0362` est maintenant raccordé à la vraie identité économique du mandat : métadonnées historiques initiales STANDARD cohérentes, puis ouverture explicite du livre avec version et empreinte approuvées. Le code de bibliothèque synthétique `TEST362_IT` n’est pas une bibliothèque IT et ne bénéficie d’aucune exemption inventée. La période d’octobre utilise uniquement un bloc initial de données de gouvernance non contractuelle, avec chronologie complète, clairement déclaré dans la fixture rollback ; cela ne certifie pas une proposition, une approbation, une signature ou un OTP historiques natifs. La véritable gouvernance actuelle est exercée séparément par `0374`. Les écritures, classement de charge, clôture et rejeux restent exécutés par leurs commandes natives. Le résultat SQL final dépend du passage d’intégration après FA14.

Les lignes de droit d’entrée et de son journal précisent aussi leur base d’exécution : simulation non contractuelle avec environnement, mode contractuel déclaré par le serveur, ou base non certifiée si les nouveaux champs manquent. Aucun ancien échéancier n’est certifié par défaut. Dernière recette projection/composants : 24 tests FR/AR réussis ; lint ciblé réussi.

## Blocage natif du catalogue après activation

La recette navigateur a reproduit une cause supplémentaire : l’activation octroyait le rôle du propriétaire sans produire le mandat catalogue exigé par les permissions. `45520` raccorde désormais l’activation native, après ses preuves d’audit/outbox, à ce mandat ACL. L’identité d’activation, l’acceptation, l’approbation indépendante, les versions et les empreintes figées sont vérifiées ; les politiques de permission existantes ne sont pas remplacées. Un rattrapage serveur limité à une franchise répare les activations natives antérieures. Il ne reconstitue ni signature, ni rôle, ni dates.

La relation bibliothèque/organisation conserve son unique mandat catalogue actif ; plusieurs territoires conservent chacun leur source d’activation et leur contrôle de rôle courant. Les bornes éventuelles proviennent uniquement des fenêtres approuvées ; aucune durée n’est réinitialisée à la date de reprise. Une révocation catalogue explicite exige une revue et n’est jamais annulée par ce rattrapage. La démonstration reste refusée en production. `0374` exerce les commandes natives d’activation et la vraie lecture du catalogue sans insérer de mandat catalogue ; résultat à lire dans le reçu SQL d’intégration.

## Constructeurs catalogue : commandes réellement soumises

La recette native a ensuite identifié huit formulaires qui remplaçaient le chiffre de version d’un UUID par une lettre de commande : leur clé était donc refusée avant l’appel métier. Une dérivation partagée à espaces de noms distincts conserve désormais version et variant ; elle est déterministe entre serveur, hydratation et reprise. Simulation et soumission suivent la nouvelle identité d’édition après une sauvegarde réussie.

Le serveur acceptait uniquement des chaînes dans `deliverables`, alors que le constructeur produit les paires FR/AR prévues. `45530` conserve les chaînes historiques et ajoute strictement les objets à deux libellés fournis, non vides et bornés, sans clé supplémentaire. Les autres listes et permissions restent inchangées. Les lecteurs et le writer rejettent une paire malformée ; aucun livrable n’est omis pour obtenir un succès. `0375` couvre aussi la vraie création native et conserve le statut de revue de traduction `PENDING`. Dernier groupe ciblé : 21 tests réussis dans trois fichiers ; lint ciblé réussi. Résultat SQL à lire dans le reçu d’intégration, aucune DDL exécutée par cet agent sur la cohorte navigateur.

## Choisir entre deux territoires de la même bibliothèque

Deux mandats autorisés de la même organisation étaient tous deux nommés par le code opérateur `FRANCHISEE`. `455320` fournit les noms FR/AR du territoire lié exactement au mandat actif, la bibliothèque publiée (à défaut son code réel) et les rôles du compte avec leurs libellés de référence. Le lecteur et le sélecteur commun utilisent ces descriptions en conservant l’identifiant caché du choix. Aucun nom n’est inventé ; un nom de territoire absent est signalé dans la langue courante. Les contrôles de rôle, de date et de périmètre restent souverains. Le choix ne prend jamais un futur territoire simplement parce qu’il a une version supérieure.

20 tests de lecteur/sélecteur FR/AR réussis, lint ciblé réussi. `0377` prépare deux activations natives indépendamment approuvées pour un même propriétaire, une même organisation et une même bibliothèque ; il vérifie les noms exacts, l’isolation et l’exclusion d’une version future non choisie. Son résultat SQL relève du reçu d’intégration ; aucune DDL n’a été exécutée par cet agent sur la cohorte navigateur. La migration doit précéder l’activation du nouveau lecteur applicatif.
