# Franchisé : catalogue, questions et édition gouvernée

Base explicite : `df67da4`, après fusion des lots Client et Sous-traitant. Travail isolé sur `codex/franchise-editorial-20261103`. Les protections serveur, RLS, mandat actif et MFA sont conservées. La migration de projection conserve le lecteur borné final de `20261031240950`, ses gardes de mandat/permission/MFA et le contrôle d’audience par version de questionnaire.

## Constats reproduits et corrections

| Référence | Cause observée dans le code | Correction et vérification |
|---|---|---|
| FE01 | `franchise_catalog_page` et le read-model prennent le statut de la version historique avant celui de l’identité ; une question archivée continue donc d’être un brouillon dans les filtres. | Migration `20261103451000` et helper partagé : ARCHIVED/RETIRED ont priorité. Les versions sources ne sont pas réécrites. SQL `0361` couvre création, archivage, rejeu, filtre, restauration, nouvelle version et duplication. |
| FE02 | Le compteur « Versions publiées » compte également les versions APPROVED, encore non publiées. | Le compteur compte uniquement PUBLISHED ; les filtres « terminés » gardent leur sens APPROVED/PUBLISHED. |
| FE03 | L’édition de questions privilégie l’ancienne version publiée même lorsqu’un nouveau brouillon existe. | L’éditeur ouvre le brouillon courant ; les versions historiquement utilisées restent conservées. |
| FE04 | Le collecteur de références ne charge que les clés `question_version_id` : un graphe de dépendance ou une cible HIDE/SHOW sans condition propre est injustement refusé. La marche récursive précède les bornes de validation. | Collecte itérative bornée des conditions, cibles de questions et dépendances, puis requête sous RLS de la bibliothèque sélectionnée. Les cibles d’un service ne sont pas assimilées à des questions. Une cible de question étrangère est refusée avant mutation. |
| FE05 | Les actions de composition/règle et la lecture du détail de question assimilent un incident technique à FORBIDDEN. L’échec Auth est ignoré dans le workspace. | Erreurs distinctes : session invalide, refus réel, incident, concurrence, validation et verrouillage. Messages FR/AR et reprise conservant les saisies. Un échec Auth 503 ne lance aucune requête métier même avec un utilisateur mis en cache. |
| FE06 | L’API native de duplication de question existe, mais aucun formulaire Franchisé ne la raccorde. | Formulaire de duplication borné au mandat : nouveau code, nouvelle clé de donnée, motif, commande idempotente et lien vers le nouveau brouillon. Les modifications non enregistrées doivent être sauvegardées avant duplication. Aucun droit supplémentaire n’est accordé. |
| FE07 | La banque et le détail n’ont pas les mêmes états d’accès et de navigation. Le détail est sans cadre Franchisé ; une erreur mélange indisponibilité et autorisation. | Cadre Franchisé conservé, retour à la banque, langue sur le chemin courant, recherche/page/mandat conservés, refus et incident séparés, véritable lien de reprise. |
| FE10 | Plusieurs mandats autorisés peuvent partager une organisation et une bibliothèque ; les formulaires perdent leur mandat et le loader choisit le premier. | Choix explicite avant toute projection, sans requête RPC en cas d’ambiguïté ; liste des seules cibles autorisées dans l’état MANDATE_REQUIRED. Tous les formulaires éditoriaux transmettent le mandat, schémas UUID et loaders le conservent. Le droit natif reste attaché à la bibliothèque et n’est pas remplacé par une nouvelle règle arbitraire. |
| FE09 | Les filtres de catégorie envoient un nom au lieu d’un UUID et la pagination perd le type sélectionné. | Options issues de toutes les catégories autorisées, identifiants transmis au serveur et filtres conservés dans les liens de page. Test de non-régression ciblé : trois tests réussis dans le fichier d’historique, dont le nouveau scénario. |
| FE08 | L’inspecteur coche une association de questionnaire à partir d’un pourcentage calculé sur trois textes. Il affiche « aucun retour » et « aucun document » sans ces preuves. | Trois vérifications descriptives réelles ; pas d’association inventée. Commentaire de revue effectivement persisté, texte libre intact en AR. Accès explicite au coffre autorisé. Le référentiel masque ses anciens compteurs lorsque sa nouvelle lecture échoue. |

Le modèle expose aussi `availableMandates` depuis les seuls mandats autorisés déjà chargés, pour le choix explicite du mandat intégré par l’orchestrateur. Cela n’ajoute aucune requête ni droit.

## Vérifications réellement exécutées

- Avant correction : `pnpm --filter @matricia/web exec vitest run modules/franchise --maxWorkers=2` : **195 tests réussis**.
- Après correction : `pnpm --filter @matricia/web exec vitest run modules/franchise/data/library modules/franchise/screens/library --maxWorkers=2` : **108 tests réussis dans 17 fichiers**, après ajout de la sélection explicite multi-mandat. Les deux premières assertions AR de la nouvelle recette de routes attendaient des synonymes différents du composant partagé ; elles ont été remplacées par le contrat d’état explicite et les vraies destinations de reprise. Aucun texte produit n’a été modifié pour satisfaire ces attentes.
- `git diff --check` : réussi.
- Lint ciblé et contrôle TypeScript ont terminé avec code 0 avant le dernier ajout de sélection multi-mandat. La vérification finale consolidée couvre ce dernier ajout ; aucune nouvelle compilation concurrente n’est lancée dans ce worktree.
- SQL `0361` fourni pour exécution sur la base de test neuve du lot intégré ; il ne constitue pas une recette de mandat signé réel. Aucun déclencheur, RLS ou contrôle MFA n’est désactivé dans ce nouveau test. Tous les jeux de données sont limités à une transaction annulée, avec adresses `example.invalid`.

Les 108 tests ciblés recouvrent une partie des 195 tests de référence et ne doivent pas être additionnés. Les journaux de travail sont `/tmp/franchise-editorial-baseline.log`, `/tmp/franchise-editorial-green.log`, `/tmp/franchise-editorial-mandate-green.log`, `/tmp/franchise-editorial-types.log`, `/tmp/franchise-editorial-lint.log`.

## Limites et intégration

Pas de déploiement ni modification de production. La recette navigateur intégrée, le rejeu SQL neuf, les types/lint/build du lot consolidé et la revue indépendante sont orchestrés dans le rapport global. Les données juridiques, traductions approuvées manquantes ou la signature externe ne sont pas fabriquées par ce lot. Le formulaire de duplication crée un brouillon ; la validation et la publication gouvernées restent requises.
