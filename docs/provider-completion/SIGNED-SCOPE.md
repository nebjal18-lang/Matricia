# Exécution du périmètre contractuel signé — 2 novembre 2026

## Comportement livré

Les migrations `20261102041950` et `20261102041960` complètent le garde-fou `41900`. Un avenant signé `ADD`, `REPLACE` ou `REMOVE` exige une préparation Client Owner/Admin avec AAL2, un hash exact et une chaîne de signatures effective. Le prestataire propose le changement ; il ne valide pas sa propre exécution Client. Les conditions financières historiques restent gouvernées par le contrat.

L’exécution est atomique, journalisée et idempotente. Un remplacement ajoute une génération opérationnelle avec les critères réellement signés. Le retrait archive l’obligation originale avec son instantané immuable. Livraisons, fichiers, réceptions, preuves, décisions, litiges et écritures financières historiques sont conservés. Une reprise à clé identique renvoie la réception de commande originale ; une nouvelle mutation d’une obligation retirée est refusée.

Un avenant ne peut pas sauter son prédécesseur signé. Le blocage de réconciliation et sa demande administrateur ne sont levés que par l’exécution correspondante, avec un permis transactionnel privé inaccessible aux rôles applicatifs. Une mission terminée n’est rouverte que si une nouvelle obligation signée est réellement créée. Le retrait total ne fabrique aucune preuve de livraison ni évaluation positive. Avant la première mission, un retrait total produit `no_mission_required=true` et refuse la création d’une mission vide.

Le calendrier réel `get_my_provider_planning_v1` contrôle la lecture de chaque mission dans sa requête SECURITY DEFINER. Il exclut les jalons retirés et les périmètres en attente de préparation, avec `operational_scope_incomplete=true` seulement pour les missions effectivement autorisées. Un ajout signé non encore planifié produit aussi cet état partiel, sans retirer les échéances antérieures. Tous les rôles disposant de la lecture métier de mission partagent ce calendrier ; les mutations gardent leurs propres contrôles. Ce signal est distinct d’une liste vide réussie. Les compteurs excluent également les générations retirées.

## Recette native

Les fichiers `0355`, `0355b` et `0355c` utilisent exclusivement des comptes et données TEST, un fournisseur de signature mock explicitement réservé au développement, les commandes publiques et les rôles SQL `authenticated` / `service_role`. Ils ne désactivent aucun trigger ni aucune RLS. Les prérequis de catalogue et de qualification historiques sont limités à chaque transaction de test.

Le runner `tests/e2e/helpers/provider-isolated/transaction.mjs` impose une cible locale explicitement possédée, une migration bornée par transaction et un seul fichier pgTAP par invocation. Il retire les enveloppes des fichiers puis exécute l’ensemble dans `BEGIN` / `ROLLBACK` sans envoyer de `COMMIT`. Une empreinte de schéma avant/après et les SHA-256 exacts des sources accompagnent chaque reçu.

La première preuve avant le correctif de calendrier comptait 149 assertions (0355), 21 (0355b), 18 (0355c), ainsi que 129 sur le garde-fou legacy0354 sans critères signés. Ces reçus historiques ne certifient pas les dernières modifications du calendrier. La réexécution finale sur la cible locale explicitement autorisée `e3ea17e3-1a4a-4a50-bdee-1b55bf272960` a produit :

| Scénario | Résultat final | Reçu exact |
| --- | --- | --- |
| Moteur complet, rôles, archives, chaîne signée et vrai calendrier | 170/170 PASS | [0355](evidence/signed-scope-170.json) |
| Remplacement signé avant la mission initiale | 27/27 PASS | [0355b](evidence/signed-scope-before-mission-replace-27.json) |
| Retrait total signé avant la mission initiale | 18/18 PASS | [0355c](evidence/signed-scope-before-mission-withdrawal-18.json) |
| Legacy REPLACE sans critères : reste bloqué, archives conservées | 129/129 PASS | [0354 canonique corrigé](evidence/signed-scope-legacy-129.json) |

Les quatre transactions vertes ont gardé l’empreinte de schéma `e40b335f90e6ac48bee13ec075bec9f7` inchangée. `commitSent=false` et `rollbackSchemaRestored=true` dans chaque reçu. La garde avant et après la séquence a constaté zéro autre transaction active ; la cible a été libérée à son propriétaire.

Une tentative préalable avec l’ancienne copie 0354 de ce worktree a échoué après 97 assertions parce que ce vieux fichier créait une enveloppe de signature avec le rôle Provider. [Le reçu d’échec conservé](evidence/signed-scope-stale-fixture-failure-97.json) atteste aussi la restauration du schéma. La source canonique corrigée appartenant au worktree Delivery, déjà utilisée pour la preuve historique 129, a ensuite passé 129/129 contre les migrations finales. Le correctif de test respecte l’autorité Client ; aucune règle de signature n’a été assouplie. Le reçu final identifie précisément le chemin et le SHA-256 du fichier réellement exécuté.

Commandes réellement exécutées depuis le worktree du moteur : `node work/scope-engine/run.mjs supabase/tests/0355_signed_scope_generations.test.sql final-planning`, puis 0355b et 0355c dans leurs sorties distinctes, puis `node work/scope-engine/run.mjs /workspace/provider-delivery/supabase/tests/0354_signed_scope_reconciliation_exceptions.test.sql final-legacy-reviewed-source`. Le script de lancement ignoré appelle le runner versionné cité plus haut avec la cible et chaque migration explicites. Les empreintes de sources des reçus finaux ont été comparées aux fichiers présents avant commit.

## Limites explicites

Cette preuve SQL locale ne certifie pas une signature électronique contractuelle externe, un scanner antivirus externe, les déploiements Supabase/Vercel/Railway distants ni une recette navigateur intégrée. Le fournisseur mock ne devient jamais une preuve de signature réelle. Une ancienne obligation sans provenance prouvée ou sans critères signés reste bloquée avec un état explicite ; aucune donnée fictive ne comble ce manque.

## Complément L09 — présentation d’une mission terminée avec avenant en attente

La migration forward `20261102041970` ajoute uniquement `public.get_mission_signed_scope_states_v1(p_mission_ids uuid[])`, qui retourne les lignes `{mission_id, signed_scope_pending}`. La valeur provient du même helper métier que le calendrier. La lecture utilise l’autorité RLS existante `private.mission_party_access` : membre du Client, lecture du Provider selon rôle et affectation individuelle pour Technician seul, ou rôle administrateur déjà autorisé. Les séparations lecture/exécution de `41500` restent intactes.

Le lot doit contenir de 1 à 100 UUID distincts non nuls, dans un tableau à une dimension. Un identifiant inconnu ou inaccessible ne produit aucune ligne, conformément à la lecture de mission. Le DAL doit demander les seuls IDs déjà chargés et refuser une réponse incomplète au lieu de convertir l’absence en `false`. Aucun accès au schéma privé n’est accordé ; `anon` et `service_role` n’obtiennent aucune permission de cette RPC. Cette lecture n’ajoute pas d’exigence AAL2 à un écran de consultation déjà autorisé.

Le nouveau scénario 0355 complète réellement la génération précédente par livraison Provider et réception Client, puis signe un ADD. Il vérifie l’état `COMPLETED` conservé, l’absence de hold artificiel, l’attente projetée aux deux parties, le refus d’inférence pour Technician non affecté et Client étranger, les bornes et la disparition de l’attente après la véritable préparation/exécution Client. Les assertions supplémentaires sont préparées pour le prochain replay frais consolidé du parent ; elles ne sont pas présentées comme déjà exécutées. Les reçus 170/27/18/129 précédents restent attachés aux SHA exacts du commit antérieur. Aucune nouvelle cible Docker ni mutation de la source ou de la recette navigateur n’a été effectuée pour préparer ce complément.
