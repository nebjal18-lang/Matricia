# Clôture financière et Franchisé — rapport de réalisation

État : **trois blocages de reprise finalisés en recette locale ciblée**. La PR[#12](https://github.com/epitaphe360/matricia/pull/12) a été fusionnée par l’utilisateur en `a362abc1`. La régularisation PRIMARY découverte après cette fusion est isolée dans `codex/franchise-publication-validation-20261103`, créée depuis cette version fusionnée, sans réappliquer les corrections précédentes. Source conservée après les fusions utilisateur : `df67da4`, branche principale `codex/bootstrap-foundation`. Travail : `codex/franchise-finance-completion-20261103`. Aucun merge ni déploiement de production.

Le code applicatif courant est `8ad97dd2`, arbre `apps/web` `865af1bcf3bd0904b9c941c90a024c5f988492b7`. Le dernier build optimisé avec TypeScript strict porte sur `b433394c`, arbre `c318ec4094656f3937f7754c488954f10bbce56a`. Le delta suivant ajoute seulement `tabIndex=0` aux13 conteneurs défilants partagés :117 tests et lint ciblé réussis, sans nouveau build optimisé ni recette navigateur sur ce delta. Les migrations SQL ne modifient pas ces arbres. Chaque recette conserve son véritable candidat ; les premiers échecs ne sont pas renommés en succès final.

## Produit réalisé

| Parcours | Corrections et contrat conservé | Vérification |
|---|---|---|
| Organisation et mandat | Sélection explicite des organisations et territoires autorisés ; libellés territoriaux approuvés FR/AR ; contexte conservé dans recherche, formulaires, détails et langue. | Tests DAL, navigation et SQL0374/0377 ; recette C3 partielle. |
| Bibliothèque et constructeurs | Archivage/versionnage/duplication, composition et simulation bornées, liens de publication gouvernée, vraies critiques de Matricia, livrables bilingues conservés, clés UUID stables et valides. | SQL0361/0375 et tests éditoriaux ; dix étapes éditoriales natives réussies ; publication bloquée par calendrier. [Détails FE01–FE10](EDITORIAL.md). |
| Opérations | Projections exactes par mandat, pagination serveur, sources documentaires/qualification/capacité natives, recherche et filtres ; incident, restriction, vide et données partielles distincts. | Tests DAL/composants ; SQL0368. [Détails](OPERATIONS.md). |
| Réseau et relances | Invitation ciblée et durable ; aucune adhésion implicite. Échecs de transport, baux, reprises et reçus vérifiés ; readiness/heartbeat reflètent les pannes. | SQL0363 et worker158 tests. Livraison réelle hébergée non certifiée. |
| Qualité et performance | Six axes natifs, mesures absentes non transformées en zéro, rapports immuables et périodiques, plans avec responsable gouverné, remesure récente unique, signaux descriptifs et revue humaine indépendante. | SQL0365/0371/0373, tests de page/actions ; seuils de favoritisme et attribution territoriale manquants restent des limites. |
| Livres et partage | Livre rattaché au mandat approuvé exact, type IT/standard, opérateur, règle datée et droits acquis ; ouverture/régularisation Admin explicite. Droit d’entrée simulé affiché comme non contractuel. | SQL0362/0372 : rattachement, lecteur propriétaire, mauvais territoire, MFA et maintien INVOKER/RLS vérifiés. [FA14](FA14-BOOK-BINDING.md). |
| Clôture prestataire | Clôture et rappels indépendants, calendrier marocain, facture historique TEST native, échéancier futur, paiement revu puis allocations partielles exactes et rejeux. | SQL0360 :74 assertions sur le replay neuf. Une facture du mois courant ne peut pas être émise avant sa vraie fenêtre. |
| Bénéfice acquis | Encaissement canonique, réception réelle, coûts nets rapprochés, taxes séparées, validation indépendante, refus des sources adverses et des chevauchements ; pas de revenu ni de solde fabriqué. | SQL0362/0364/0369. L’absence d’une consommation historique canonique empêche encore une démonstration positive complète de distribution ancienne. |
| Justificatifs et coût nul | Dépôt privé réel, vérification serveur des octets/hash/MIME, scanner sous bail, lecture auditée avant décision indépendante, révocation et remplacement append-only. Route Admin reliée à Finance et dossiers autorisés paginés. | SQL0370 :118 assertions ;801 tests Web ciblés au total, dont contrats de ces APIs. Scanner physique absent : la recette navigateur doit rester PENDING/ERROR, sans approbation inventée. |
| Zéro révoqué puis dépense | Seul un zéro réellement révoqué peut être remplacé par une dépense comptabilisée exacte ; prédécesseur/version figés, période et indépendance contrôlées, premier COST canonique, anciens faits conservés. | SQL0376 :127 assertions ; garde des périodes déjà closes revue en source mais ce cas historique n’a pas été exécuté. |
| Connexion, accessibilité et mobile | Auth503 distinct de déconnexion ; action après OTP autorisée à vérifier le MFA ; menu, sémantique des listes/progrès, contexte mobile et colonnes de catalogue corrigés, recherche mobile accessible. | Contre-tests OTP avant/après ; build strict PASS. Matrice initiale192 visites :176 PASS/16 FAIL, défauts partagés corrigés ; matrice finale partielle. |

## Vérifications et preuves

- [801 tests Web /92 fichiers](evidence/integration/web-final-801.log), [158 tests worker /15 fichiers](evidence/integration/worker-final-158.log) et types worker réussis.
- [Build optimisé834](evidence/browser/final-build/build.json) réussi avec TypeScript strict,14 pages statiques. [Build strict C3b433](evidence/browser/final-build-c3/build.json) réussi ; delta de focus plus récent non recompilé en build optimisé.
- Frontières, exports serveur et absence de marqueurs incomplets vérifiés ; les reçus indiquent le périmètre et la source réellement exécutés.
- [Replay final neuf](evidence/sql/final-fresh-558/summary.json) :**558 migrations,73 fichiers SQL,2813 assertions réussies**,664 tables publiques,0 sans RLS, pgTAP non exécutable par les rôles API, nettoyage réussi. Les56 régressions Client/Sous-traitant sont incluses. Le [premier replay552 en échec](evidence/sql/fresh-552-first/summary.json) est conservé séparément avec ses causes et leurs corrections.
- [Contre-audit FA01–FA17](INDEPENDENT-AUDIT.md), lectures indépendantes sans écriture du produit audité. Les résultats ne s’additionnent pas comme des tests uniques.
- [CI GitHub](CI.md) : trois jobs sur push/PR bloqués **avant démarrage** par la facturation du compte. Le nouveau push reproduit le blocage ; aucun workflow n’a été assoupli.

## Limites de livraison externe

Les preuves locales ne certifient pas Supabase hébergé, Vercel, Railway, le scanner de production, l’email, un PSP ou un virement réel. Aucune intégration distante sans configuration sécurisée n’est déclarée connectée. Aucun déploiement ou merge de production n’a été effectué.

La société/identité légale complète et les formalités approuvées, le fournisseur/niveau de signature contractuelle, les seuils de gouvernance validés et les références de staging restent à fournir ou valider selon les registres du projet. La marque Matricia n’est pas assimilée à une identité légale complète. Les prix et conditions manquants ne sont pas inventés.

Une signature SIMPLE DEV-mock, des identités ou métadonnées SQL TEST et un callback de paiement DEMO sont explicitement distingués d’une signature juridique, d’un parcours Auth natif ou d’une capture PSP réelle. Les tests ne modifient aucune horloge et ne désactivent ni MFA, ni RLS, ni triggers financiers.

## Régularisation native après fusion de la PR12

Les anciens services TEST importés possédaient un parent, mais aucun lien PRIMARY. La sauvegarde native créait un brouillon en renvoyant un succès sans rétablir cette relation lorsque le parent restait identique. Le correctif455380 réutilise le writer DRAFT et ses gardes ; sa trace précise la réparation, sans approuver ni publier. [Preuve RED/GREEN](evidence/sql/primary-link-red-green/after-summary.json) :20 assertions réussies, anciens contenus publiés inchangés, rejeu et absence de doublon. Le [replay final559](evidence/sql/final-fresh-559/summary.json) est entièrement réussi :74fichiers,2833assertions,664tables publiques/0sansRLS, pgTAP nonexécutableAPI et nettoyage réussi. La régularisation réelle des deux services est réussie ; la tentative de publication est restée bloquée par23P01 `CATALOG_SCHEDULE_CONFLICT`, sans annuler ni repointer une release existante. [Revue indépendante](PUBLICATION-INDEPENDENT-REVIEW.md).

## Résultat navigateur au gel du périmètre

- Build C3 optimisé strict : réussite ; connexion GoTrue OTP→TOTP→AAL2 et reprise exacte du lien profond : FR et AR réussis.
- Dix étapes éditoriales natives : création bilingue, sauvegarde/reprise hors ligne, duplication, archivagev2, soumission, revue indépendante et attestationAR, puis régularisation des deux anciens services avec PRIMARYDRAFT et conservation des hashes publiés. Publication non exécutée : conflit de calendrier23P01, garde conservé.
- Matrice C3 interrompue proprement à la demande de clôture rapide :43 visites terminées,37réussites/6échecs et2interrompues. Les6échecs portent sur le focus des tableaux défilants, corrigé ensuite dans les composants partagés. Le correctif final n’a pas été rejoué au navigateur. La couverture finale192 n’est donc pas certifiée.
- Finance : réservation native acquittée, état constaté `RESERVED/PENDING` ; dépôt d’octets et commit final non confirmés. Aucun scan CLEAN, coût nul ou approbation documentaire réelle n’est déclaré réussi. Les tests serveur/SQL ne remplacent pas cette recette physique.
- Les essais de panne non achevés ne sont pas déclarés réussis. La recette de bout en bout, les interfaces finales et les intégrations hébergées ne sont pas closes à100%.

La PR12 a été fusionnée par l’utilisateur ; le [run après fusion](https://github.com/epitaphe360/matricia/actions/runs/41615991197) rapporte encore trois tâches non démarrées pour facturation. Cette observation est distincte du succès de fusion. L’API GitHub de cet environnement refuse la création de PR avec `Forbidden` ; la branche complémentaire et sa description restent prêtes pour une ouverture manuelle.


## Finalisation des trois blocages — reprise demandée par l’utilisateur

Les trois points de la recette ciblée sont désormais vérifiés en environnement local de test :

- Publication : ancienne fenêtre non courante régularisée par demande FR et décision AR de deux administrateurs GoTrue/AAL2 distincts, auto-approbation refusée. Publication Owner réelle puis claim/complete natifs sous bail ; état PUBLISHED, rejeu exact sans doublon, textes FR/AR et hashes des anciennes versions conservés. Aucun ancien snapshot ni engagement supprimé.
- Dépôt financier : origine de runtime corrigée sans relâcher la validation Origin. Même dépôt idempotent repris, état UPLOADED,816octetsPDF etSHA vérifiés dansStorageprivé,1seul dépôt et0rapprochement créé. ScannerERROR faute de moteur réel : coût nul refusé55000, aucune approbation ou analyseCLEAN inventée.
- Visuel :12cas ciblés FR/AR375/390 PASS enDEV sur les tableaux corrigés, défilement clavier réel,0violationaxe et0erreurJS. Les interruptions initiales de compilation sont conservées. Il ne s’agit pas d’un nouveau certificat optimisé192pages.

Le calendrier Admin est accessible depuis Catalogue avec contexte bibliothèque ; demande/revue FR/AR, MFA et indépendance obligatoires. La variation de timezone Node/Chromium est corrigée par libellés sérialisés au serveur, sans changer les timestamps métier. Tests :56Web calendrier PASS,28SQL gouvernance PASS et revue indépendante favorable. Base560 appliquée de façon contrôlée après le replay neuf559/74fichiers/2833assertions.

Cette finalisation remplace les blocages décrits dans le bilan précédent, conservé comme historique. Restent externes : moteur antivirus réel, intégrations/staging hébergés et contrôles CI du compte ; aucune fusion ni production par l’assistant.
