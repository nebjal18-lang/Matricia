# Sauvegarde et restauration vérifiable

État : **PREUVES DE RECETTE À RATTACHER AU CANDIDAT**. Un dump ou une restauration locale DB ne certifie ni Storage privé ni RPO/RTO du staging.

## Avant l’exercice

Identifier cible source/cible, classe non-production, propriétaires, RPO/RTO convenus et autorisation. Préférer une cible jetable distincte ; ne pas utiliser `db reset` sur une base de travail existante. Inventorier DB, objets Storage privés, configuration non secrète, versions de schéma/providers et files. Chiffrer et contrôler l’accès aux sauvegardes, jamais de clés dans les rapports.

## Base

Créer un dump transactionnel cohérent avec un compte autorisé, sans désactiver les vérifications TLS. Calculer taille et SHA256, stocker le dump dans le coffre de sauvegarde. Restaurer dans une instance distincte compatible PostgreSQL/extensions/rôles. Préserver propriétaires et ACL du modèle Supabase ; `--no-owner`/`--no-acl` ne permet pas de prétendre avoir restauré les droits. Les extensions dépendant de l’hôte, telles que pg_cron, exigent une procédure explicite de recréation et une vérification de leurs jobs, pas une exclusion silencieuse.

Vérifier nombre/identité des objets, contraintes, RLS, politiques, fonctions, ACL et historique de migration. Exécuter les tests SQL, autorisations ALLOW/DENY et invariants financiers sur la cible restaurée. Contrôler exactitude des soldes, versions immuables, idempotence, audit et Outbox.

## Fichiers privés et files

Restaurer les objets Storage et leurs métadonnées à partir de la sauvegarde autorisée ; comparer tailles/hashes/version et ouvrir seulement les objets autorisés. Vérifier que l’objet d’une autre organisation est refusé et qu’un document non CLEAN ne devient pas lisible. Restaurer les checkpoints/leases et reprendre les effets externes sans replay aveugle des succès déjà confirmés.

## Preuve et retour au service

Enregistrer début/fin, volumes, hashes, versions, classes des cibles, exclusions explicites et résultats de contrôles ; mesurer RPO et RTO effectifs par rapport aux objectifs. Faire revoir les preuves par un autre acteur, corriger/retester les écarts et ne marquer PASSED qu’après l’ensemble DB+Storage+files+recette. Supprimer uniquement la cible jetable identifiée après conservation des preuves ; garder la source intacte.

Le parent d’implémentation a effectué un exercice local DB distinct ; son résultat doit être consigné comme local et son périmètre conservé. Il ne remplit pas automatiquement le check staging `backupRestore` du manifeste.
