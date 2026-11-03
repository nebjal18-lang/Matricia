# Revue indépendante de qualification prestataire — 2 novembre 2026

## Défaut reproduit

Le relecteur COMPLIANCE_MANAGER AAL2 ne peut pas lire directement les sessions privées du prestataire. La décision Admin sélectionnait pourtant la dernière session par un SELECT soumis à cette RLS : aucune session, puis validation impossible. La RLS acteur est conservée.

## Correction

La migration 38400 ajoute une projection SECURITY DEFINER limitée à la qualification, à son organisation, à la bibliothèque de son service, à un dépôt PROVIDER soumis, non simulé, par un autre acteur. Le relecteur doit être habilité, AAL2 et extérieur à cette organisation. Les questions communes à la bibliothèque restent admises ; une source_service_id explicite étrangère est rejetée.

Le formulaire FR/AR exige un choix explicite de dépôt. Il présente les questions et réponses du manifeste figé ainsi que le score du moteur ; le score humain reste distinct et modifiable. Le texte libre est conservé. La lecture est auditée. L'approbation vérifie cette lecture et l'empreinte du contexte puis appelle la commande gouvernée existante (CAS, idempotence, historique, audit, outbox). L'ancien point d'entrée sans cette vérification n'est plus exécutable par les rôles API.

Les reprises PENDING après INFORMATION_REQUIRED ou SUSPENDED sont proposées. Les chemins sont revalidés et les clés d'action renouvelées seulement après un succès confirmé.

## Vérifications réellement exécutées

- Vitest : actions.test.ts, qualification-questionnaire-review-actions.test.ts, qualification-questionnaire-review-model.test.ts, qualification-questionnaire-review.test.tsx : **19 tests réussis**, 4 fichiers.
- ESLint ciblé sur les 10 fichiers TypeScript concernés : **réussi**.
- git diff --check : **réussi**.
- SQL natif 0357 sur cible locale TEST explicitement possédée, schéma de base 458, migrations 38000 à 38400 dans une unique transaction : **40 assertions réussies**, aucun SKIP/TODO, ROLLBACK.
- Vérifiés notamment : aucune lecture brute des sessions/révisions pour le relecteur, AAL1/Owner/Viewer/autre organisation refusés, deux dépôts sans sélection implicite, vrai texte libre et score 8000, service étranger refusé, contexte forgé/ancien refusé, replay sans doublon, CAS, réouvertures gouvernées.

Empreinte schéma avant/après : `e40b335f90e6ac48bee13ec075bec9f7` / `e40b335f90e6ac48bee13ec075bec9f7`. `commitSent=false`. Reçu local : work/rollback0357-final/receipt.json. Les deux premières tentatives ont échoué sur des UUID mal formés dans les nouvelles données synthétiques ; aucune modification de protection n'a été nécessaire. Le troisième passage a réussi 33 assertions avant extension des tests à 40.

## Limites

Cette preuve SQL est transactionnelle sur la cible TEST existante, pas une reconstruction complète depuis zéro. Elle ne constitue pas une preuve navigateur de l'approbation : la reprise du parcours natif Provider est confiée à la recette navigateur après intégration de ce commit. Le build et les types complets sont centralisés sur la branche d'intégration. Aucun déploiement de production.

## Intégration du test des litiges 0351

Le fichier 0351 transféré depuis la branche d'intégration (empreinte initiale `b2578a35be01d7681fc4c66a2f47471163904f8a27df054d3ad2edacaeb1ef43`) conserve ses ajouts de calendrier et d'habilitation TECH. Son ancien prérequis de qualification insérait directement une session SUBMITTED sans snapshot ni évaluation. Il utilise maintenant un questionnaire de test versionné et publié avec traductions approuvées, les commandes natives start/autosave/submit, puis la projection de revue auditée et son empreinte avant la décision gouvernée.

Commande exécutée : runner `tests/e2e/helpers/provider-isolated/transaction.mjs`, cible locale TEST e3, un seul fichier 0351, les **46 migrations de la branche d'intégration postérieures à 20261102037000** (dont 38400, 41950, 41960 et 44400), toutes dans une transaction annulée.

Résultat : **79 assertions réussies**, aucun SKIP/TODO, `commitSent=false`. Empreintes avant/après : `e40b335f90e6ac48bee13ec075bec9f7` / `e40b335f90e6ac48bee13ec075bec9f7`. Reçu local : work/rollback0351-complete-attempt1/receipt.json. Aucun changement applicatif ni assouplissement de protection requis.

La revue indépendante de la correction 38400 et de ses actions/UI par l'agent d'intégration n'a trouvé aucun blocage sur le périmètre, les manifestes figés, l'indépendance AAL2, les privilèges ou CAS/replay. Son constat mineur de libellés MULTI_SELECT a été corrigé dans 8cd453a : labels approuvés FR/AR pour tableaux de choix, valeurs inconnues et textes libres conservés, 5 tests ciblés réussis.
