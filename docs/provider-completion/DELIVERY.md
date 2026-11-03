# Contrats, missions et livraisons Sous-traitant

Base : `7e01276`, lot Client préservé ; branche `codex/provider-delivery-20261102`.

| Constat | Modification | Vérification et limite |
| --- | --- | --- |
| D4 — Réception impossible après rejet de V1 | Réceptions distinctes par version de livraison ; décisions antérieures immuables ; formulaire Client lié à la version effectivement examinée ; reprise des corrections déjà soumises avant migration | Cycle SQL natif V1 rejetée → V2 soumise → réception V2 et maintien du rejet V1 vérifié dans le premier replay ; extensions ultérieures à rejouer après intégration |
| D5 — Jalon rejeté non resoumettable | Commande corrective motivée, instantané du jalon rejeté, historique immuable, audit/outbox, nouvelle soumission et contrôle de version | Soumission, rejet Client, correction Technician affecté et rejeu idempotent : premier replay réussi |
| D6 — Dossier contractuel incomplet avant signature | Routes liste/détail Contrats ; parties, clauses, demande/devis figés, livrables, exclusions, paiement, critères, corrections, pénalités, historique et preuves de signature réellement enregistrées | Tests de projection avant signature et 1 001 lignes contractuelles réussis ; fournisseur de signature réel toujours à configurer et recetter |
| D7 — Avenants seulement en lecture | Proposition Owner/Manager AAL2 contre version/hash exacts ; monnaie dérivée du contrat ; prix exact ; livrables supplémentaires structurés ; brouillons et motif/périmètre visibles ; commission dérivée de la version gouvernée | Actions positives/négatives FR/AR et devise TND à trois décimales vérifiées. Exécution opérationnelle implémentée par41600 : critères explicitement proposés puis signés, échéances confirmées par le Client AAL2, objets réels et historique immuable. **Rejeu SQL0348/0353 et recette navigateur encore attendus : D7 reste ouvert jusqu’à leurs résultats** |
| D9 — Technician non limité aux affectations | Affectations persistées gérées par Owner/Manager ; RLS des missions/contrats/relations et commandes/preuves Storage utilisent cette affectation ; révocation immédiate | Deux techniciens de même organisation : lectures, soumission par ID connu et auto-affectation refusées ; affectation, rejeu et révocation autorisés : premier replay réussi |
| D10 — Commentaires et preuves non consultables | Critères et commentaires par version, originaux privés uniquement CLEAN, historique des décisions et corrections de jalon | Route de téléchargement : 5 tests de droits, panne, quarantaine et URL limitée ; projection historique SQL ajoutée après le premier replay, à rejouer |
| D12 — Relations et détails tronqués | Transport paginé et listes d’identifiants bornées ; détail contractuel direct au-delà de la première page ; recherche de missions avant pagination ; compteurs agrégés sous RLS | 1 001 relations et 101e contrat testés ; recherche/compteurs SQL ajoutés au test natif étendu, à rejouer |

## Résultats réellement exécutés

- `APP_ENV=development node scripts/validate-local-migration-replay.mjs --test=0348_provider_versioned_receipts_assignments.test.sql` : **459 migrations, 1 fichier SQL, 62 assertions PASS, nettoyage PASS**. Preuve : [delivery-initial-replay.json](evidence/delivery-initial-replay.json). Ce reçu contient les empreintes de la première version de `41000` et du test avant extension. Il ne certifie pas les modifications postérieures, ni `41200`/`41300`/`41400`.
- `pnpm --filter @matricia/web exec vitest run modules/provider/data/missions modules/provider/screens/missions modules/shared/lib/contracts-missions modules/client/screens/missions 'app/api/provider/delivery-proofs/[proofId]/route.test.ts' --maxWorkers=2` : **24 fichiers, 121 tests PASS**. Journal local : `/tmp/provider-delivery-final-unit.log`.
- `git diff --check` : PASS.
- `pnpm --filter @matricia/web typecheck` : lancé ; résultat global encore en attente au point de sauvegarde. Il n’est pas déclaré réussi.

Les nouveaux scénarios SQL étendus doivent être rejoués sur la branche intégrée. La matrice navigateur et le build intégrés restent à effectuer. Aucune base distante ni production n’a été modifiée. Aucun mock n’est présenté comme une signature contractuelle ou un verdict antivirus réel.

## Complément41600 — périmètre signé et exécution réelle

Les critères de chaque ajout sont conservés dans la version contractuelle signée ; aucun critère n’est généré depuis un texte libre ou une ancienne recommandation. Pour une mission existante, le Client habilité confirme les dates contre le hash de préparation courant, puis une commande atomique crée réellement jalons, livrables et réceptions. La mission ne peut pas être close en omettant un ajout signé. Pour un avenant signé avant la première mission, la préparation initiale conserve la checklist opérationnelle publiée et impose les critères signés de l’ajout.

Un ancien avenant actif dépourvu de critères explicites reste `MISSING_SIGNED_CRITERIA`. Il exige une nouvelle précision contractuelle approuvée et signée ; la migration n’invente pas les données manquantes et ne réécrit pas l’historique. Les états de préparation indisponibles sont affichés comme tels. Les rôles Sales/Accounting gardent la lecture déjà autorisée par RLS, avec aucune action d’exécution ; un Technician ne reçoit les formulaires que sur ses affectations.

Après le redémarrage de l’environnement :26 fichiers/132 tests réussis sur le delta conservé ;17 tests des deux actions après ajout des refus de panne Auth/MFA ;11 tests de projection après contrôle des rôles en lecture et des libellés opérationnels figés. Ces groupes se recouvrent, ils ne constituent pas160 tests uniques. Lint ciblé réussi ; typecheck de travail encore en cours et futur contrôle intégré réservé au root. SQL0348 étendu et nouveau0353 sont des scénarios exécutables, non déclarés verts avant leur rejeu natif.

## Revue des reprises et de la projection contractuelle

Le réviseur indépendant `/root/provider_quotes_finish` a trouvé deux reprises qui échouaient avant lecture du reçu : un original committé encore PENDING ne peut pas être relu via Storage409, et un reçu Client de rejetV1 devenait inaccessible après soumissionV2. Les migrations41700/41800 récupèrent désormais le reçu exact, lié à l’acteur, à l’organisation et au hash complet, avant ces prérequis mutables. Aucune politique de lecture des octets PENDING n’a été ouverte. Une nouvelle commande Client périmée reste refusée ; seul le rejeu identique de la décision historique est retourné.

Les actions confirmées invalident les vues métier, et les formulaires conservent leur clé après erreur puis la renouvellent après succès confirmé. La projection Provider utilise le `contract_version_id` de la mission : une missionV1 terminée ne se présente plus comme une missionV2 terminée lorsque l’avenant signé n’a pas encore été exécuté. Les tests ciblés de ces changements passent34/34 ; les scénarios SQL additionnels restent à rejouer avant clôture.

La revue a aussi découvert le cas des opérations contractuelles REMOVE/REPLACE de l’ABI existante. Le complément de réconciliation de ce périmètre est en cours ; il ne sera pas assimilé à `NO_ADDITIONAL_WORK` ni déclaré clos sur le seul scénario ADD.

## Recette native complémentaire — 0348 et0353

Le rejeu transactionnel sur la cible locale possédée a exécuté les migrations41000–41830 et chaque fichier SQL dans une session séparée : **0348 :102 assertions PASS ;0353 :18 assertions PASS**. Les deux transactions sont annulées, aucun COMMIT envoyé, empreintes de schéma avant/après identiques. Reçus : [102 assertions](evidence/delivery-native-102.json) et [18 assertions](evidence/signed-initial-mission-native-18.json). Il s’agit d’un schéma458 existant avec migrations explicites, pas d’un replay intégral neuf.

Cette recette a reproduit une panne réelle des projections de recherche/compteurs : leurs fonctions SECURITY INVOKER appelaient directement un helper du schéma privé inaccessible au rôle authenticated.41830 expose seulement un prédicat booléen lié à auth.uid(), sans paramètre d’utilisateur, tout en conservant l’exécution des projections sous RLS. Aucun USAGE du schéma privé n’est accordé.

Sont notamment vérifiés : signature de développement via gouvernance/callback réels, ajout signé avant ou après mission initiale, critères signés exacts, reçus de reprise sous quarantaine, rejetV1/reprise aprèsV2, affectations et restrictions Technician. Les métadonnées de preuve SQL ne valent pas scan antivirus physique. REMOVE/REPLACE et recette navigateur intégrée restent ouverts.

## Frontière signée REMOVE/REPLACE — sécurisation41900

Les opérations legacy REMOVE/REPLACE étaient réellement matérialisées dans le contrat, mais l’ancien exécuteur ADD annonçait à tort qu’aucun travail ne restait.41900 détecte ces signatures sur une mission existante, conserve un snapshot opérationnel immuable et ouvre un dossier réel dans la file Administration « Exceptions opérationnelles ». Le contexte Client/Provider distingue cet état en FR/AR et conserve les preuves et décisions antérieures. Les nouveaux actes d’exécution/réception et la clôture sont suspendus ; une simple résolution de file ne peut pas simuler la réconciliation. Les écritures économiques restent des commandes Finance distinctes.

Les compteurs de livrables à traiter deviennent indisponibles lorsque leur périmètre n’est plus certifié ; aucun zéro ni ancienne obligation retirée ne se présente comme un total courant.24 tests ciblés de projection/présentation et lint ciblé réussis. Le nouveau scénario natif0354 est préparé, **pas encore déclaré réussi** : remplacement d’un livrable accepté sans critères signés explicites, retrait d’un autre, puis retrait du dernier ; reçus et litiges restent conservés. Le moteur complet des générations REMOVE/REPLACE relève du complément41950+, en cours séparément ; D7 reste ouvert.

### Résultat natif0354

La recette de sécurisation41900 passe **129 assertions sur129**, dont le flux de signature gouverné de développement réel, le retrait/remplacement legacy sans critères, le retrait du dernier livrable, la file Administration réellement claimable, le refus d’une fausse résolution et les historiques conservés. Une seule transaction annulée ; empreintes de schéma identiques, aucun COMMIT envoyé. Reçu : [129 assertions](evidence/signed-scope-exceptions-native-129.json). La première invocation avait correctement refusé une création d’enveloppe sous le Provider ; le scénario a été corrigé pour utiliser le Client habilité. Le moteur41950+ ne fait pas partie de ce reçu.

## Interfaces du moteur41950/41960

Le Client confirme séparément les obligations retirées et les nouvelles échéances. Un retrait seul ne demande ni date ni critère inventé ; le reçu doit attester au moins une création ou un retrait effectif. Les nouvelles générations REPLACE affichent une réception indépendante ; les livraisons, critères décidés, preuves et jalons archivés restent consultables sans formulaire de mutation. Les projections lisent obligatoirement l’historique sous RLS et restent indisponibles si cette lecture échoue. L’ordre des avenants et le cas signé sans aucun livrable sont des états explicites, avec lien vers l’avenant précédent et aucune mission vide proposée.

Le Provider peut proposer ADD, REPLACE ou REMOVE via une sélection de livrables de la version contractuelle autorisée. Les cibles/positions sont relues côté serveur, les remplacements exigent de nouveaux critères explicites, les textes libres sont conservés dans leur langue de saisie ; le contrôle décisif reste dans la commande SQL AAL2/CAS gouvernée. Une proposition reste un brouillon à signer, puis à préparer par le Client.

Commande ciblée réellement exécutée : `pnpm --filter @matricia/web exec vitest run modules/provider/data/missions modules/provider/screens/missions modules/shared/lib/contracts-missions modules/client/screens/missions 'app/api/provider/delivery-proofs/[proofId]/route.test.ts' --maxWorkers=2` : **27 fichiers,163 tests PASS**. Lint ciblé et `git diff --check` réussis. Ces résultats vérifient les interfaces et actions contre les contrats RPC convenus ; le moteur SQL41950/41960 et la recette navigateur finale restent à exécuter avant clôture D7.

## Consolidation du moteur et contre-revue

Les mentions « en cours » ci-dessus décrivent leurs checkpoints. Le moteur41950/41960 est maintenant intégré et les dernières recettes natives, avec la revue de qualification38400 obligatoire, passent :0355=170,0355b=27,0355c=18 et0354=129. Voir [moteur signé](SIGNED-SCOPE.md), [compatibilité des fixtures sans bypass](../recette/provider-qualification-fixture-compatibility-2026-11-02.md) et [contre-revue indépendante L01–L08](DELIVERY-INDEPENDENT-REVIEW.md). Aucun retrait de garde pour obtenir ces résultats. La recette navigateur consolidée reste suivie dans le [rapport](REPORT.md), avec attribution explicite de ses gestes effectivement exécutés et des intégrations externes non certifiées.
