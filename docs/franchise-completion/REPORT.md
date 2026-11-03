# Clôture financière et Franchisé — rapport de réalisation

État : **recette finale en cours**. Source conservée après les fusions utilisateur : `df67da4`, branche principale `codex/bootstrap-foundation`. Travail : `codex/franchise-finance-completion-20261103`. Aucun merge ni déploiement de production.

Le candidat applicatif courant est `b433394c`, arbre `apps/web` `c318ec4094656f3937f7754c488954f10bbce56a`. Il ajoute uniquement les derniers couples descriptifs `dt/dd` au candidat `834202b6`, déjà compilé avec TypeScript strict. Le nouveau build et sa recette visuelle sont en cours ;117 tests ciblés du delta ont réussi. Les migrations correctives ultérieures ne modifient pas ces arbres. Chaque recette conserve son véritable candidat ; les premiers échecs ne sont pas renommés en succès final.

## Produit réalisé

| Parcours | Corrections et contrat conservé | Vérification |
|---|---|---|
| Organisation et mandat | Sélection explicite des organisations et territoires autorisés ; libellés territoriaux approuvés FR/AR ; contexte conservé dans recherche, formulaires, détails et langue. | Tests DAL, navigation et SQL0374/0377 ; seconde recette navigateur en cours. |
| Bibliothèque et constructeurs | Archivage/versionnage/duplication, composition et simulation bornées, liens de publication gouvernée, vraies critiques de Matricia, livrables bilingues conservés, clés UUID stables et valides. | SQL0361/0375 et tests éditoriaux ; recette des gestes réels en cours. [Détails FE01–FE10](EDITORIAL.md). |
| Opérations | Projections exactes par mandat, pagination serveur, sources documentaires/qualification/capacité natives, recherche et filtres ; incident, restriction, vide et données partielles distincts. | Tests DAL/composants ; SQL0368. [Détails](OPERATIONS.md). |
| Réseau et relances | Invitation ciblée et durable ; aucune adhésion implicite. Échecs de transport, baux, reprises et reçus vérifiés ; readiness/heartbeat reflètent les pannes. | SQL0363 et worker158 tests. Livraison réelle hébergée non certifiée. |
| Qualité et performance | Six axes natifs, mesures absentes non transformées en zéro, rapports immuables et périodiques, plans avec responsable gouverné, remesure récente unique, signaux descriptifs et revue humaine indépendante. | SQL0365/0371/0373, tests de page/actions ; seuils de favoritisme et attribution territoriale manquants restent des limites. |
| Livres et partage | Livre rattaché au mandat approuvé exact, type IT/standard, opérateur, règle datée et droits acquis ; ouverture/régularisation Admin explicite. Droit d’entrée simulé affiché comme non contractuel. | SQL0362/0372 : rattachement, lecteur propriétaire, mauvais territoire, MFA et maintien INVOKER/RLS vérifiés. [FA14](FA14-BOOK-BINDING.md). |
| Clôture prestataire | Clôture et rappels indépendants, calendrier marocain, facture historique TEST native, échéancier futur, paiement revu puis allocations partielles exactes et rejeux. | SQL0360 :74 assertions sur le replay neuf. Une facture du mois courant ne peut pas être émise avant sa vraie fenêtre. |
| Bénéfice acquis | Encaissement canonique, réception réelle, coûts nets rapprochés, taxes séparées, validation indépendante, refus des sources adverses et des chevauchements ; pas de revenu ni de solde fabriqué. | SQL0362/0364/0369. L’absence d’une consommation historique canonique empêche encore une démonstration positive complète de distribution ancienne. |
| Justificatifs et coût nul | Dépôt privé réel, vérification serveur des octets/hash/MIME, scanner sous bail, lecture auditée avant décision indépendante, révocation et remplacement append-only. Route Admin reliée à Finance et dossiers autorisés paginés. | SQL0370 :118 assertions ;801 tests Web ciblés au total, dont contrats de ces APIs. Scanner physique absent : la recette navigateur doit rester PENDING/ERROR, sans approbation inventée. |
| Zéro révoqué puis dépense | Seul un zéro réellement révoqué peut être remplacé par une dépense comptabilisée exacte ; prédécesseur/version figés, période et indépendance contrôlées, premier COST canonique, anciens faits conservés. | SQL0376 :127 assertions ; garde des périodes déjà closes revue en source mais ce cas historique n’a pas été exécuté. |
| Connexion, accessibilité et mobile | Auth503 distinct de déconnexion ; action après OTP autorisée à vérifier le MFA ; menu, sémantique des listes/progrès, contexte mobile et colonnes de catalogue corrigés, recherche mobile accessible. | Contre-tests OTP avant/après ; build strict PASS. Matrice initiale192 visites :176 PASS/16 FAIL, défauts partagés corrigés ; matrice finale en cours. |

## Vérifications et preuves

- [801 tests Web /92 fichiers](evidence/integration/web-final-801.log), [158 tests worker /15 fichiers](evidence/integration/worker-final-158.log) et types worker réussis.
- [Build optimisé834](evidence/browser/final-build/build.json) réussi avec TypeScript strict,14 pages statiques. Build du delta sémantique `b433394c` encore attendu.
- Frontières, exports serveur et absence de marqueurs incomplets vérifiés ; les reçus indiquent le périmètre et la source réellement exécutés.
- [Replay final neuf](evidence/sql/final-fresh-558/summary.json) :**558 migrations,73 fichiers SQL,2813 assertions réussies**,664 tables publiques,0 sans RLS, pgTAP non exécutable par les rôles API, nettoyage réussi. Les56 régressions Client/Sous-traitant sont incluses. Le [premier replay552 en échec](evidence/sql/fresh-552-first/summary.json) est conservé séparément avec ses causes et leurs corrections.
- [Contre-audit FA01–FA17](INDEPENDENT-AUDIT.md), lectures indépendantes sans écriture du produit audité. Les résultats ne s’additionnent pas comme des tests uniques.
- [CI GitHub](CI.md) : trois jobs sur push/PR bloqués **avant démarrage** par la facturation du compte. Le nouveau push reproduit le blocage ; aucun workflow n’a été assoupli.

## Limites de livraison externe

Les preuves locales ne certifient pas Supabase hébergé, Vercel, Railway, le scanner de production, l’email, un PSP ou un virement réel. Aucune intégration distante sans configuration sécurisée n’est déclarée connectée. Aucun déploiement ou merge de production n’a été effectué.

La société/identité légale complète et les formalités approuvées, le fournisseur/niveau de signature contractuelle, les seuils de gouvernance validés et les références de staging restent à fournir ou valider selon les registres du projet. La marque Matricia n’est pas assimilée à une identité légale complète. Les prix et conditions manquants ne sont pas inventés.

Une signature SIMPLE DEV-mock, des identités ou métadonnées SQL TEST et un callback de paiement DEMO sont explicitement distingués d’une signature juridique, d’un parcours Auth natif ou d’une capture PSP réelle. Les tests ne modifient aucune horloge et ne désactivent ni MFA, ni RLS, ni triggers financiers.
