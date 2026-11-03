## Problème et comportement obtenu

L’audit du 2 novembre a relevé des listes indisponibles, des erreurs présentées comme des résultats vides, des formulaires Admin sans cible métier et des incohérences de navigation/diagnostic FR/AR. Cette branche corrige les causes reproduites : colonne Favoris inexistante, cardinalité qualification objet/null, contextes d’organisation, classification des pannes/Auth/MFA/refus, navigation autorisée, véritables réponses du diagnostic, formulaires de gouvernance et progression Besoin.

Les actions Admin conservent leurs workflows métier et leurs habilitations. L’import annoncé à tort devient une préparation explicite de partage d’un document existant. Le portefeuille sélectionne des dossiers autorisés et calcule la preuve depuis un vrai fichier. Une migration ajoute une lecture minimale des factures exclusivement rattachées au Client sans exposer la colonne privée du calendrier.

## Source et périmètre

- Base conservée : `39552d7`, descendant de la consolidation et de la fusion amont `1ebf3ea`.
- Branche dédiée : `codex/audit-m01-m30-20261102` ; base PR : `codex/bootstrap-foundation`.
- Le demandeur confirme que l’audit précède la fusion. Le SHA exact du déploiement audité reste inconnu et son URL est refusée par le proxy. Aucune correspondance exacte entre cette URL et un commit n’est affirmée.
- Aucun projet distant substitué, aucune fusion, aucun déploiement en production, aucune migration sur Supabase partagé/distant.

## Vérifications exécutées

- Types et lint globaux : PASS ; build standard Next 16.4.1 avec métadonnées HTTPS de laboratoire : PASS.
- Suite des espaces de travail : 2 712 tests PASS ; 1 test Storage à activation explicite non exécuté.
- Intégration HTTP Outbox : 3 PASS ; outils : 31 PASS ; contrôles de fondation et exports Server Actions : PASS.
- Clone PostgreSQL neuf sans réseau ni port publié : 418 migrations PASS ; SQL0300 : 23 assertions PASS ; 608 tables publiques avec RLS ; ACL pgTAP fermées après rollback ; clone supprimé.
- GoTrue/TOTP AAL2 natif local, quatre acteurs et trois organisations de test : 168 cas sans incident technique, plus 8 états facture partiels attendus. Nettoyage vérifié. Ces contrôles de lecture/readiness ne certifient pas les workflows complets de qualification, signature ou paiement.
- Diagnostic huit questions, détail des réponses, trois actions, besoin conservé FR→AR et cinq étapes : 8 E2E PASS à 375/390/768/1440 px après correction du débordement réel. Aucun POST métier effectué.

Les preuves, les commandes, les captures, la vérification du menu et les différences de builds sont détaillées dans `docs/audit-20261102/CHECKS.md` et `docs/evidence/audit30-candidate-20261102.json`.

## Limites à conserver avant recette client

Le tableau exhaustif `docs/audit-20261102/REPORT.md` distingue correction du code et recette ouverte pour chacun des 30 identifiants. Les points suivants empêchent une clôture commerciale : identité légale approuvée, noms AR approuvés de 200 services/79 catégories, quotas et conditions Box versionnés, recette de dossiers métier liés et mandat signé de test, accès à la préversion/aux projets distants.

La migration de lecture des factures doit être appliquée à l’environnement de test autorisé après revue. Les cas d’allocation sur une facture réelle, de facture mixte et de plafond financier ne sont pas annoncés comme réussis. Les protections MFA, RLS, tenant, validation indépendante et audit restent actives. Le garde global de livraison V1 reste refusé ; cette PR est une version de correction à relire, sans visa de mise en production.
