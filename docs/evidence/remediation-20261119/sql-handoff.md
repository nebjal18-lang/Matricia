# Handoff SQL — 19 novembre 2026

Statut : les 16 fichiers historiques de l'audit attribués sont verts sur le clone exclusif ; le replay vierge et les gates globaux restent à la charge de l'intégration.

## Environnement et coordination

`matricia_sql_remediation_20261119`, sur `supabase_db_Matricia`, a été créé depuis le clone d'audit sans connexion active ; son paramètre `pgrst.db_pre_request` a été restauré. La migration sécurité `20261119101000_audit_document_authorization.sql` du commit `8d8dbc23` a été appliquée au clone avant la migration corrective. Aucun reset partagé ni modification des bases d'origine ou d'audit. Le snapshot contient déjà les trois migrations réconciliées par l'audit : il ne prouve pas un replay vierge. L'absence de cron dans ce snapshot n'est pas considérée comme un défaut.

Coordination sécurité : la migration 101000 ne corrige pas la projection de documents fournisseur. Le test 0412 de `8d8dbc23` contient deux délimiteurs SQL `$...$` invalides aux lignes 418 et 423 ; son propriétaire doit les corriger. Une copie temporaire corrigée a ensuite refusé notre clone par son contrôle explicite `DOC01_WRONG_DATABASE` ; ce test n'a donc pas été exécuté et son garde-fou n'a pas été contourné. Aucun fichier sécurité n'a été modifié.

## Causes et changements

- 0198 et 0368 : régression réelle. La migration de résumé d'activité avait remplacé la fonction publique et perdu l'enrichissement contractuel ainsi que la sélection de la dernière version par famille documentaire. La migration additive 103000 restaure la projection privée avec `activitySummary`, filtre d'abord la dernière version et rétablit le wrapper de contrat. Le contrôle d'accès au périmètre franchise est conservé. 0198 vérifie désormais aussi le résumé d'activité.
- 0367 et 0380 : défaut réel dans `submit_franchise_application` ; `current_user` dans une fonction `SECURITY DEFINER` est le propriétaire. La migration 103000 vérifie le rôle SQL sélectionné `service_role`, dont l'assomption exige l'appartenance au rôle. Les tests utilisent ce rôle et conservent un refus explicite pour `authenticated` et l'interdiction à `anon`.
- 0347, 0356 et 0360 paiement : fixtures historiques contradictoires, dont le début de relevé était postérieur à sa fin. Dates des événements, décisions, échéances et règles fiscales synthétiques recalées de façon cohérente ; aucun trigger ni contrôle temporel désactivé. Les assertions de contestation, clôture, fiscalité, idempotence et finance sont conservées.
- 0360 territoires : fixture alignée sur le contrat actuel, qui lit la version publiée pointée par la bibliothèque ; les assertions de contenu et de refus AAL1 restent intactes.
- 0390 : assertion de source corrigée pour rechercher littéralement le motif `FRANCHISE_%` utilisé par la fonction.
- 0060, 0193, 0242, 0359, 0388, 0408 et 0409 : corrections du commit 95387e34, détaillées dans son diff. MATRICIA_ADMIN est testé autorisé à AAL2 et refusé à AAL1 ; les assertions pgTAP restent actives.

## Vérification

Harness `prepareSqlTestBatches` du dépôt, une connexion au clone, rollback et reset entre fichiers, un plan unique, numérotation exacte, zéro skip :

`0060 49/49; 0193 18/18; 0198 13/13; 0242 25/25; 0347 56/56; 0356 85/85; 0359 27/27; 0360 territoires 6/6; 0360 paiement 74/74; 0367 7/7; 0368 24/24; 0380 24/24; 0388 6/6; 0390 5/5; 0408 4/4; 0409 4/4.`

Contrôles voisins sans modifications : 0193 admin 8/8, 0198 admin 10/10, 0347 finance indépendante 45/45, 0368 diagnostic public 4/4, 0390 Yousign 21/21. La migration 103000 a été appliquée à plusieurs reprises au clone avec succès. Les vérifications ne remplacent pas un replay vierge, une suite SQL complète ni les tests de concurrence ou de sécurité indépendants.
