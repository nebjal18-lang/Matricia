# Handoff architecture — 19 novembre 2026

Périmètre : ARCH-02, ARCH-03, ARCH-04, DEMO-01. Aucun déploiement, aucune connexion ni écriture de base, aucune modification des secrets ou du checkout principal. Les dépendances existantes du checkout principal ont été réutilisées par liens locaux ; aucun manifeste, lockfile ou tsconfig modifié.

## Architecture effectivement retenue

Le monolithe reste modulaire. PostgreSQL/RPC conserve l'autorité sur les permissions, transactions, invariants, idempotence, audit et Outbox. Les adaptateurs Next/Supabase demeurent dans les modules Web existants. Cette correction extrait des responsabilités effectivement consommées, sans déplacement global du projet :

- [application](../../../packages/application/src/execute-command.ts) orchestre authentification et exécution par ports ; aucune dépendance framework et aucune reprise automatique d'une mutation.
- [contracts](../../../packages/contracts/src/command-result.ts) fournit le résultat discriminé et la classification SQLSTATE sûre.
- [forms](../../../packages/forms/src/values.ts) normalise les valeurs de formulaire, refuse les fichiers comme champs texte et normalise les dates.
- [workflows](../../../packages/workflows/src/franchise-review.ts) expose les prérequis persistés de présentation de la revue franchise. La vérification quatre yeux existante et l'autorité des RPC sont conservées.
- [Actions incitations](../../../apps/web/modules/admin/screens/incitations/actions.ts) consomme les trois premiers packages ; [revue franchise](../../../apps/web/modules/admin/screens/franchise-applications/review-forms.tsx) consomme le dernier.

Les imports relatifs vers ces modules sont intentionnels dans cette étape : les manifests/exports et la configuration des alias appartiennent à root et sont exclus de cette intervention. Une intégration ultérieure peut déclarer les dépendances workspace et adopter les imports `@matricia/*` sans changer les contrats.

[Le validateur](../../../scripts/validate-boundaries.ts) inspecte désormais packages ET applications. Analyse syntaxique TypeScript des imports, exports, import dynamique, require, import de type et import-equals ; exclusion des commentaires, chaînes, artefacts et liens de dépendances. Refus des imports inter-applications, des imports de l'orchestration serveur/infrastructure depuis les composants client et des imports packages → apps. Les règles de couches et d'indépendance framework préexistantes restent actives. Cela ne constitue pas une preuve de pureté métier de tous les modules existants.

## Contrats d'erreurs

Les commandes d'incitation distinguent `VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `CONFLICT`, `NOT_FOUND`, `UNAVAILABLE`. Chaque échec contient une corrélation générée côté serveur. Pour un échec RPC, elle est identique à `p_correlation_id`. Aucun message, détail SQL ou exception brute n'est retourné. La clé d'idempotence transmise reste celle de la commande. Les lectures préparatoires échouées et exceptions réseau ne deviennent pas des succès.

Le composant de feedback des incitations, hors ownership, affiche encore son message générique. Le contrat permet maintenant de sélectionner un texte FR/AR par `state.code` et d'afficher `state.correlationId` ; cette intégration de présentation reste à son propriétaire. ARCH-04 est corrigé au niveau du résultat serveur audité.

## Pagination et invariants

[read-pages](../../../apps/web/modules/shared/lib/data/read-pages.ts) propose :

- `readPage` : une requête, taille de page entre 1 et 500, sentinelle et `nextOffset` explicite. L'adaptateur doit conserver filtres tenant et tri stable unique. Ce résultat n'est pas un total et ne doit pas autoriser une transition financière.
- `readAllPages` : projection complète limitée à 5 000 lignes, puis une sentinelle. Au-delà, `data:null` et `READ_LIMIT_EXCEEDED` ; jamais un tableau partiel ou vide de remplacement. 100 000 et 1 000 000 de lignes synthétiques coûtent chacun 11 appels au maximum.
- `readRelatedPages` : limite partagée entre lots de 100 identifiants, 5 000 parents uniques maximum, 5 000 lignes et 60 requêtes maximum pour l'ensemble des lots. Un échec abandonne tout le résultat.

La [file des candidatures](../../../apps/web/app/[locale]/administration/candidatures-franchise/page.tsx) utilise des pages de 50 et des liens précédent/suivant. Compteurs et filtres indiquent explicitement leur portée sur la page ; ils ne prétendent pas être globaux. Les lectures liées sont bornées ; erreurs ou réponses invalides bloquent les actions avec un état indisponible, au lieu de prétendre que les dépendances n'existent pas. L'horloge d'expiration reste dans le chargement serveur ; la branche `Date.now()` en rendu issue de l'overlay a disparu.

Seul consommateur additionnel modifié : [billing/workspace](../../../apps/web/modules/provider/data/billing/workspace.ts), avec son test. Déclarations/périodes/exceptions sont bornées et filtrées par organisation si fournie ; décisions/lignes/litiges/complétions sont filtrés par parents persistés, résolutions par litiges. Les filtres de sécurité de projection sont conservés. Aucune modification de calcul, montant ou transition. Un historique trop grand rend la projection indisponible (`null`, contrat existant) : le consommateur de pré-relevé affiche déjà un état d'erreur.

**ARCH-03 reste une migration progressive**, pas une certification de pagination métier de tout le produit. Les autres consommateurs héritent du garde-fou complet-ou-erreur mais certains affichent une indisponibilité générique. Prochaine étape : paramètres de période et curseurs métier dans leurs contrats/UI, agrégats SQL exacts pour les totaux, sélection ciblée des versions actives, index après EXPLAIN. Ne jamais remplacer une lecture complète utilisée pour une transition par la première page. Les historiques au-delà des bornes perdent temporairement la disponibilité de ces projections, ce qui doit être connu avant activation production. Les compteurs globaux et la pagination transactionnellement stable en présence d'écritures concurrentes ne sont pas introduits ici.

## Démo et parcours

Les [tableaux Client](../../../apps/web/modules/client/screens/spaces/boards.tsx) ne fabriquent plus diagnostics, demandes, missions, documents, finances, membres ou messages. Les lignes et liens persistés fournis sont conservés même avec le flag démo. Les candidatures utilisent exclusivement les lignes de base et leurs dépendances ; une file vide reste vide. Le contrôle explicite des fixtures déjà persistées reste disponible.

Une candidature en attente sans franchise/approbation/invitation affiche un état incomplet ; aucune fausse action d'approbation. Les formulaires existants, leurs identifiants, versions, clés d'idempotence et contrôle quatre yeux sont conservés. Aucun seed inventé ou exécuté. Pour une démo complète, utiliser les provisionneurs du domaine dans une cible non-production validée puis vérifier les parcours natifs. Les autres composants démo hors périmètre ne sont pas certifiés par cette correction.

## Propositions à root : CRM et digest (non appliquées)

Ces deux fichiers utilisent actuellement `collectOperationPages` depuis `operations/paging`, qui reste une boucle non bornée. Proposition minimale compatible avec l'étape complète-ou-erreur :

```diff
--- apps/web/modules/franchise/data/digest/repository.ts
+++ apps/web/modules/franchise/data/digest/repository.ts
@@
-import { collectOperationPages } from "../operations/paging";
+import { readAllPages as collectOperationPages } from "@/modules/shared/lib/data/read-pages";
```

Pour CRM, préserver l'effacement de profondeur du builder réalisé par root et normaliser l'erreur inconnue à sa frontière :

```diff
--- apps/web/modules/franchise/data/crm/repository.ts
+++ apps/web/modules/franchise/data/crm/repository.ts
@@
-import { collectOperationPages } from "../operations/paging";
+import { readAllPages as collectOperationPages } from "@/modules/shared/lib/data/read-pages";
@@
-   return{data:Array.isArray(result.data)?(result.data as unknown[]):null,error:result.error};
+   return{data:Array.isArray(result.data)?(result.data as unknown[]):null,error:result.error?{code:"UNAVAILABLE"}:null};
```

Les gardes `QUERY_FAILED` préexistants doivent rester avant tout parsing/décision. Rejouer leurs tests, le contrôle strict (notamment TS2589) et les scénarios à 5 001 lignes. Ensuite paginer les prospects/digests et borner les jobs/périodes au serveur ; ne pas limiter les versions d'autorisation ou de mandat sans résoudre la version courante. Aucun de ces deux fichiers n'a été écrit ici.

## Vérifications

Toutes les commandes sont exécutées dans le worktree attribué avec les dépendances disponibles. Runtime de cette intervention : Node 24.11.0 ; le dépôt cible Node 22, à conserver pour la gate d'intégration root.

- Vitest Web : **50 tests passants**, huit fichiers : actions incitations ; tableaux Client ; review-forms ; page candidatures ; read-pages ; client-completion-pages ; billing/workspace ; pagination Client existante. Couverture d'exécution : classifications SQLSTATE, corrélation, absence de fuite, erreur transport, bornes et sentinelles, parents/organisation, rendu FR/AR des liens persistés, erreur des dépendances, candidature sans prérequis et continuation de liste.
- Vitest racine : **16 tests passants**, validateur de frontières et packages application/forms/workflows. Tests d'imports interdits, commentaires ignorés, authentification refusée sans mutation, non-rejeu, champs fichier refusés et prérequis persistés.
- TypeScript : les quatre packages passent `tsc -p packages/<nom>`. Le validateur et son test passent avec `--strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noImplicitOverride --noFallthroughCasesInSwitch`.
- TypeScript Web : `tsc -p apps/web --noEmit --incremental false --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noImplicitOverride --noFallthroughCasesInSwitch` reste en **exit 2 pour les autres périmètres**. Aucun diagnostic dans les fichiers réservés de cette intervention dans le dernier run. Les diagnostics complets temporaires ne sont pas une certification globale ; root traite les autres domaines en parallèle.
- ESLint ciblé : succès, zéro erreur/warning pour les six fichiers de production Web modifiés et leurs tests contrôlés. Imports inutilisés retirés ; erreur de pureté liée au `Date.now()` de l'overlay supprimée.
- `node --experimental-strip-types scripts/validate-boundaries.ts` : succès, 14 packages et applications.
- `node scripts/release/server-action-exports.mjs` : succès, 2 210 sources contrôlées au moment du run.
- `git diff --check` : succès.

Les tests exécutent les fonctions source et rendent les composants, avec doubles de transport explicites. Aucun parcours navigateur authentifié, test SQL/RLS natif, build global ou audit indépendant de release n'est revendiqué. La preuve de bout en bout liste → fiche → devis et candidature → approbation → invitation → activation sur la base démo persistée reste une gate d'intégration. Aucune phase globale verte déclarée ; PROJECT_STATE reste à root.
