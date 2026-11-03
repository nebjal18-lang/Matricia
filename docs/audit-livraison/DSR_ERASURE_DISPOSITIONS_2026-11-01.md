# Effacement gouverné — socle 267070

Le demandeur authentifié MFA confirme une portée versionnée : son compte et la seule organisation du dossier ERASURE déjà vérifié. Aucun rattachement, autre organisation ou utilisateur choisi librement n’est ajouté. Le catalogue technique, les colonnes et le code d’exécution sont figés ; chaque source exige une disposition explicite, ses dates, son âge minimal et sa référence juridique. Aucune durée ni approbation réelle n’est seedée.

Le rédacteur scelle le plan. Une autre personne Conformité/Super Admin avec MFA le revoit avec ses motifs et références. L’exécution relit les habilitations actuelles, l’environnement DB privé, la portée courante, les délais, les gels et les hashes des cibles. Une révocation immuable du plan interdit tout nouvel effet et tout rejeu ; elle ne prétend pas inverser les effets passés. Les commandes SQL sont fixes, sans nom de table, champ ou SQL fourni par le navigateur.

| Source et commande native | Effet réel | Protections et conservation |
|---|---|---|
| `user_profiles` / `ANONYMIZE_DISPLAY_NAME` | Remplace uniquement le nom d’affichage par une valeur anonyme. | Refus si autre organisation historique, adhésion active/invitée, rôle plateforme actif, âge minimal ou snapshot non conformes. ID, locale, horodatages et historique restent explicitement conservés. |
| `client_provider_favorites` / `ERASE_REMOVED_FAVORITE_NOTES` | Efface les notes de favoris créés **et retirés par ce sujet** dans l’organisation DSR. | Favoris actifs, autres auteurs, retraits par un tiers et autre tenant préservés. Les associations et faits métier restent conservés. |
| Autres sources | Conservation juridique explicitement revue ou `ACTION_REQUIRED`. | Aucune commande générique de destruction. La conservation est présentée comme telle, jamais comme une suppression. |
| `@physical_storage` | Exige le futur adaptateur natif 267120. | `private.dsr_erasure_physical_evidence_v1(plan_id)` doit attester une couverture réelle et fournir les hashes du manifeste et de preuve. Sans lui, le rapport demeure partiel. |
| `@processors_and_backups` | Inventaire enregistré comparé à la coupe et disposition juridique revue. | Registre incomplet/modifié ou action manquante bloque la couverture. Aucun reçu de processeur ou suppression de sauvegarde n’est inventé. |

Chaque effet natif produit un reçu immuable avant/après sous forme de hashes, un nombre exact de lignes et les champs conservés. Le même plan ne réexécute jamais la même source. Les valeurs effacées ne sont ni persistées dans le reçu ni envoyées à l’Outbox.

Le rapport privé décrit les effets, conservations et sources en attente. Une seconde revue indépendante précède sa publication. Le titulaire doit ouvrir les octets correspondant au SHA, puis accuser ce rapport et sa version de portée. Une demande partielle reste `IN_REVIEW` même si ce rapport a été reçu. `FULFILLED` exige une couverture complète encore actuelle, la preuve physique réelle et cet accusé ; la transition ne réécrit aucun ledger, contrat ou audit. La réponse au titulaire ne copie aucun bucket/path interne du helper physique : seuls `complete`, `manifest_hash` et `proof_hash` sont admis.

## Contrat avec le worker physique

`private.dsr_erasure_physical_context_v1(plan_id)` fournit `plan_id`, `request_id`, `subject_user_id`, `organization_id`, `content_hash`, `scope_version_id`, `scope_hash`, `environment`, `physical_policy` et `review.{reviewer_id,review_proof_hash}`. Il prend les verrous demande → plan, vérifie l’autorité actuelle et les gels. Il n’est accordé à aucun rôle API ; un wrapper service contrôlé de l’adaptateur doit le consommer. Le worker ne doit accepter aucun chemin ou utilisateur de remplacement. Son helper de preuve reste une autorité privée, sans assertion libre du navigateur.

## Preuves locales et limites concrètes

- **0263 : 35/35 SQL PASS**, DDL et fixtures synthétiques dans **une seule transaction intégralement ROLLBACK**. Aucune installation persistante ni donnée réelle effacée sur MAIN.
- Effets natifs réels sur les fixtures, préservation des tiers/tenants et des favoris actifs, refus AAL1/étranger/auteur/non-CAS, hold, cible modifiée, profil partagé, replay unique, Outbox sans valeurs effacées, accès privé/ACK, révocation et refus d’une fausse clôture.
- **31 tests web ciblés**, TypeScript et lint passent ; interface Admin FR/AR, page universelle du titulaire et téléchargement SHA vérifié.

Restent des développements internes : adaptateurs physiques 267120, cycles Auth/sessions selon politique applicable, commandes pour les réponses/questionnaires, assistance et messages, traitement des corps de captures DSR/copies de travail, et exécution réelle chez les processeurs lorsque demandée. Une source conservée doit disposer d’une base réellement approuvée et d’un délai de réexamen ; ce code ne fournit aucun visa juridique réel. Le socle n’est donc pas une assertion « toutes les données de la personne ont disparu ».

## Correctif 267071 — autorité après attente et horloges explicites

La revue indépendante a identifié une course possible avec la révocation d’un troisième exécuteur pendant l’attente d’un verrou. Le correctif prend le même mutex global `platform.account.access` que la gouvernance des comptes, verrouille les comptes/rôles et la session du caller, puis relit l’autorité après les dernières attentes, y compris dans les revues et avant un rejeu. Le cœur privé `dsr_erasure_policy_context_core_v1` valide les deux auteurs, leurs rôles canoniques et leur état Auth sans dépendre du JWT du caller. Il reste sans privilège API, destiné aux gardes natifs Auth/Storage ; le wrapper conserve ses contrôles MFA/session.

Le schéma de disposition **v2** refuse toute ancienne propriété ambiguë `retain_until` : aucune conversion automatique de date n’est faite. Une nouvelle préparation et une nouvelle revue sont nécessaires.

| Champ | Sens exact |
|---|---|
| `retention_until` | Conservation minimale des données ciblées : aucun effacement avant cette date. |
| `not_before` | Date minimale d’autorisation opérationnelle, distincte de la conservation. |
| `minimum_age_days` | Âge minimal vérifié depuis les dates autoritatives de la cible. |
| `authorization_valid_until` | Expiration de l’autorisation d’exécuter. |
| `retained_fields_until` | Conservation explicitement revue des champs préservés par une commande partielle ou par RETAIN_LEGAL. Nulle pour ERASE_PHYSICAL_STORAGE sans conservation des cibles. |

Les anciennes réponses restent lisibles comme historiques ; elles ne sont pas réinterprétées et l’interface ne propose pas leur clôture comme une politique v2 actuelle. La garde serveur reste autoritative.

Validation finale : **41/41 SQL PASS/ROLLBACK** dans le clone isolé `matricia_delivery_privacy_20261101` ; **3 courses à deux connexions PASS**, chacune avec attente réellement observée, COMMIT de la révocation puis refus de l’exécution/revue de plan/revue de rapport. Aucune écriture native ni revue sous autorité retirée. Les fixtures de course restent seulement dans le clone pour inspection par Root, qui gère son effacement final sans arrêter de backend. **34 tests web ciblés, TypeScript et lint PASS**. Aucune installation persistante sur MAIN, aucun appel Auth/Storage du clone.

## Gel de périmètre du candidat

Le batch267080 n’est pas livré : son brouillon non committé est conservé sous `work/incomplete/267080_dsr_materialized_batch_capture.sql`, hors des migrations actives et hors PRIMARY. Il manque encore compilation/recette complète, revue/UI, transport267130 avec leases/reprises, collecte de fichiers à grand volume, manifeste paginé, accès et accusés de toutes les parties. Son ABI de reprise a été transmise à Integrations mais aucun raccord n’est revendiqué. Les refus synchrones de volume restent explicites.

Les adaptateurs Auth267090/091 et physiques267120 sont des lots distincts encore en préparation par leurs propriétaires. Leur présence n’est pas présumée par ce socle : absence de preuve native = rapport partiel et refus de FULFILLED.
