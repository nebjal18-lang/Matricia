# Parcours Client — corrections et recette du 2 novembre 2026

Ce lot part de la version fusionnée `origin/codex/bootstrap-foundation` au commit
`a237ae1`, dans la branche dédiée `codex/client-completion-20261102`. Il préserve
les développements existants et prend le Gold Master V4 FINAL comme référence.
Les dépendances Prestataire/Administration nécessaires au parcours Client sont
incluses ; cette recette ne certifie pas tous les autres espaces.

Les 26 chantiers ci-dessous ont reçu une implémentation ou un traitement explicite
du blocage. **La livraison commerciale complète n’est pas certifiée** : la
signature externe, les contenus approuvés et la recette des services hébergés
restent distincts des preuves locales. Aucun déploiement, fusion ou migration
distante n’est réalisé dans cette mission.

## Traçabilité des 26 chantiers

Les chemins Web sont relatifs à `apps/web/`. Les numéros SQL identifient les
fichiers complets dans `supabase/tests/`, et non une certification de production.

| ID | Modification et fichiers principaux | Vérification et limite |
| --- | --- | --- |
| C01 | Présentation conditionnelle SHOW/HIDE/REQUIRE, obligatoire/progression serveur ; `modules/shared/lib/questionnaire-sessions/`, panneau Client. | SQL 0301 ; parcours navigateur réel avec condition vraie/fausse, refus de soumission incomplète. |
| C02 | Reprise de la session inachevée exacte ; `modules/client/screens/diagnostics/`, page diagnostics. | Rechargement, reprise depuis le hub, conservation des réponses FR/AR ; sauvegarde hors ligne puis reconnexion et soumission réelles. |
| C03 | Filtres de diagnostics fonctionnels et contexte conservé. | Tests du hub et navigation clavier navigateur ; filtre ne modifie pas la session. |
| C04 | Requêtes d’accueil ciblées par organisation, états terminaux exacts ; `modules/client/data/home/`. Synthèse abonnement : comptage serveur exact de l’équipe autorisée, erreur et projection restreinte distinctes de zéro. | Tests dépôt/accueil et `abonnement/member-count.test.ts` : autre organisation, restriction, panne et total supérieur à une page. |
| C05 | Comparateur : récurrence, périodicité, paiement et maintenance réels ; projection et saisie Prestataire correspondantes. | SQL `0339_client_native_quote_comparison_acceptance` : deux vrais devis soumis par deux prestataires ; données différentes, droits et rejeu. SQL 0342 : transport exact supérieur à `2^53`, snapshot/hash historiques préservés et sélection canonique du devis. |
| C06 | Le contrôle de signature existant demeure fermé sans fournisseur/niveau contractuel ; aucune signature simulée activée en production. | **Décision externe manquante** : fournisseur et niveau par acte. Le mock SIMPLE ne prouve que le flux natif de laboratoire, pas une signature distante. |
| C07 | Préparation de mission depuis contrat/checklist figés ; `missions/`, projection et commande SQL natives. | SQL `0338_client_native_mission_dispute_acceptance` : livrables/critères, empreinte périmée, clé inventée et organisation étrangère. Contrat initial historique explicitement identifié dans la fixture. |
| C08 | Litige lié à l’obligation réelle, politique dérivée serveur, pièces du coffre privé ; `litiges/`. | Même SQL 0338 : vraie commande de politique gouvernée, isolation, AAL2, documents autorisés, audit/Outbox et rejeu. Aucun scan externe revendiqué. |
| C09 | Droits et quotas versionnés contrôlés par les commandes natives ; migrations d’admission. | SQL 0301 : premier site autorisé puis dépassement refusé. Un interblocage d’audit reproduit a été corrigé dans 34000 ; trois cohortes GoTrue simultanées confirment une création, un refus 54000 et aucun dépassement, avec chaîne d’audit linéaire. |
| C10 | Seuils/devise/limite Buyer gouvernés ; pagination, sujets métier et reprise de la commande immuable après décisions indépendantes ; migrations 27000/27010/33000/33100 et `approbations/`. | SQL 0327 et 0333 : pas d’effet avant approbation, demandeur seul, refus conservé, commande exacte et exécution unique. Revue indépendante du code ; pas de certification de toutes les courses multi-sessions. |
| C11 | Renouvellement et changement payé : cycle intégral ou prorata restant exact, devis/consentement figés, financement composé ; migrations 31000/31100/31110/31120. | SQL 0331/0332/0334/0335 du domaine Abonnements ; règles indépendamment approuvées, annuité et crédits futurs préservés, rejeu. **Aucune règle commerciale publiée par défaut**, aucun PSP externe certifié. |
| C12 | Catalogue de packs, checkout/capture/retour/reprise sur le moteur PSP existant ; `credits/`, API paiement. | Tests des commandes/retours et port de paiement SANDBOX SQL ; aucun débit réel ni compte PSP configuré dans cette mission. |
| C13 | Enveloppe personnelle Buyer, réservation/libération limitée au membre ; migration 30000 et `/client/boxes/mon-enveloppe`. | SQL 0330, 0338 Box : budget exact et Box acquise exacte même avec deux cycles payés ; aucun accès comptable global accordé. |
| C14 | Box multi-bibliothèques et recommandations traçables depuis les anomalies ; configuration gouvernée et budgets séparés. | Tests de configuration et régression 0256 ; recommandation conservée comme proposition, pas comme droit acquis. |
| C15 | Promesse d’admission et moteur natif figés avant paiement ; migrations 30010/30050 et lignée 31110. | SQL 0331 Box, 0336–0338 : achat A puis publication B, prorata et cycles simultanés ; moteur manquant refusé avant PSP. |
| C16 | Activation réelle, réservation de pool et RFQ par le formulaire métier normal ; 30030/30040, `demandes/benefit-context.ts`. | SQL 0334/0335 Box : vrai dossier RFQ, activation réelle puis compte rendu et réception indépendante avant consommation. |
| C17 | Attente, annulation, expiration et remboursement gouverné ; 30020/30030 et écrans FR/AR Client/Finance. | SQL 0333 Box, 0332 remboursements et régression économique 0340. Restitution dans les lots originaux, dates conservées, contre-écritures exactes, panne atomique ; aucun remboursement bancaire implicite. |
| C18 | Historique complet et agrégats serveur ; `credits-wallet/`, `subscriptions/`, `portfolio/`, notifications ; migration 28000. | Tests de pagination et grands historiques ; totaux indépendants de la page affichée, montants exacts en texte. |
| C19 | Création de sites, édition/versionnage des projets et tâches, choix d’un membre autorisé ; `portefeuille/`. | Tests actions/panneaux, SQL 0070 et création réelle de site/projet avec lecture RLS. Les conflits et assignataires étrangers restent refusés. |
| C20 | Recherche paginée des cibles d’allocation, garde facture mono-organisation ; `data/portfolio/allocation-targets.ts`. | SQL 0300 : cibles au-delà de la première page, facture autorisée et facture mixte refusée ; ACL privées conservées. |
| C21 | Entrée de parrainage consentie, événement réel, approbation séparée de l’exécution Finance ; 32000, page d’entrée et récompenses. | SQL 0334 récompenses : 32 assertions, décision Conformité sans privilège Finance, crédits uniques après exécution habilitée, session et rejouabilité. Pas de campagne réelle envoyée. |
| C22 | Économies vérifiées distinctes du ROI, objets/preuves du dossier, devises issues de la source ; 29000 et `recompenses/`. | SQL 0329 : accès Finance/Conformité aux seules preuves permises ; tests montants JPY/KWD et indépendance de revue. Pas de gain commercial fabriqué. |
| C23 | Organisation choisie, historique paginé et rappels d’essai/crédits idempotents avec rattrapage ; 26000 et dépôt notifications. | SQL 0316 : 22 assertions ; historique, recherche, échéances, préférences, arabe et rejeu. La délivrabilité email distante reste à vérifier. |
| C24 | Saisie locale et calcul exact suivant la devise ISO ; formatage partagé et transports texte. | Tests JPY/KWD/MAD, valeurs supérieures à `2^53`, reprise de la devise serveur et refus de nombres déjà arrondis. |
| C25 | États restriction/MFA/panne/vide séparés, sujets et choix métier, reprise utile ; panneaux partagés et formulaires du lot. | Tests actions/rendus FR/AR, refus inter-tenant et Administration dans la recette native. Une absence de données ne sert jamais de preuve de réussite. |
| C26 | Direction Version A bleue partagée, RTL, menu au-dessus du contenu et parcours clavier/mobile. | Matrice navigateur et captures liées dans les preuves finales. **Traductions de catalogue approuvées manquantes** : non inventées, absence explicitement signalée. |

## Nature des preuves

Les fixtures SQL sont exécutées sur des clones Docker possédés par le test, sans
réseau ni port publié. Elles utilisent des acteurs synthétiques et des
transactions annulées ; les prérequis historiques (identité déjà vérifiée,
documents déjà scannés, catalogue) sont nommés comme tels. Elles ne remplacent ni
l’OTP cryptographique ni l’antivirus externe. Les commandes métier, triggers,
RLS, contrôles d’approbation et ledgers restent actifs. Le runner refuse les
fixtures utilisant une désactivation des triggers ou un changement de
`session_replication_role`.

La recette navigateur utilise son propre Supabase local, GoTrue/PostgREST/Storage
et de véritables OTP/TOTP. Les identités et documents sont exclusivement de test.
Le questionnaire a été sauvegardé hors ligne puis repris après reconnexion, en
conservant le texte libre bilingue. Aucun service hébergé ni compte réel n’est
déclaré vérifié sur la seule base de ces tests.

Le contrôle RLS réel des achats groupés a aussi reproduit une récursion `42P17` entre réservations et allocations, y compris sans lignes. La migration 36000 remplace les prédicats cycliques par des lectures privées strictement liées à l’acteur et corrige une référence `id` ambiguë ; elle ne confère aucun droit d’écriture. Le test 0343 couvre les organisations et prestataires étrangers.

La recette de paiement avec le véritable rôle serveur a ensuite révélé que trois contrôles différés de cohérence lisaient les ledgers avec les droits du rôle appelant après le retour de la commande. La migration 37000 rend ces seuls contrôles privés `SECURITY DEFINER`, avec chemin de résolution fixé et exécution directe interdite aux rôles API. Aucun droit de table, calcul financier ni corps de contrôle n’est changé. Le test 0344 force les contraintes après retour de la commande sous le véritable rôle `service_role` et vérifie également les écritures incohérentes, le refus Client/anonyme et le rejeu unique.

Les scans axe ont enfin reproduit deux défauts de sémantique du portefeuille : indicateurs de progression sans nom et chiffres budgétaires dans une liste de définitions mal structurée. Le composant partagé donne maintenant un nom contextualisé FR/AR aux indicateurs et utilise des paires `dt`/`dd`, sans modifier les montants ni les données.

Les résultats initiaux en échec sont conservés. Ils comprennent un défaut SQL de
nom de variable, une projection de rôles ordonnée par une colonne inexistante,
un menu masqué, une hydratation divergente sous Node 24, des assertions devenues
obsolètes et un délai du test PDF arabe sous charge. Les corrections ont leurs
tests ciblés ; le rapport final distingue les nouvelles exécutions de ces
tentatives initiales.

## Informations nécessaires à la clôture externe

1. Fournisseur de signature et niveaux autorisés par acte ; comptes sandbox et
   webhooks vérifiables dans les paramètres sécurisés.
2. Règles commerciales approuvées FR/AR : plans/quotas, packs/Box, changements et
   retours de crédits. Les moteurs gouvernés existent ; les données de test ne
   deviennent pas des conditions commerciales.
3. Identité complète de l’éditeur, contacts et textes juridiques/consentements
   validés, formalités nécessaires et traductions de catalogue approuvées.
4. Cibles Supabase/Vercel/worker/scanner autorisées et configuration sécurisée
   permettant la recette hébergée, paiements/email/signature réels, reprise et
   restauration. Aucune connexion distante n’est certifiée sans cette preuve.

Les commandes, résultats consolidés, revue indépendante et captures sont ajoutés
dans les fichiers de validation de ce dossier. Le statut global Gold Master reste
celui des registres contrôlés ; ce lot ne transforme pas les exigences non
prouvées en exigences vérifiées.


## Limite du certificat global

Le validateur global `release:validate` reste refusé : les contrats atomiques P01, les approbations des registres, les preuves d’interaction globales et le manifeste de livraison de l’ensemble de l’application ne sont pas clos. Le résultat de ce lot Client ne constitue donc pas une autorisation de livrer toute l’application. Les tests de compatibilité hérités utilisant une désactivation des triggers, dont 0247, sont exclus du rejeu strict ; leurs résultats historiques ne sont pas présentés comme des preuves équivalentes. La recette financière principale 0332 et la régression 0340 s’exécutent avec tous les contrôles actifs.

La première fixture de questionnaire contenait un profil historique incomplet. La page d’onboarding l’a correctement refusé au chargement : une réponse HTTP 200 ne suffisait pas. La fixture corrigée satisfait le validateur canonique complet dans le test 0301 (14 assertions) et sert à une nouvelle recette ; aucune version historique vérifiée n’est réécrite, et le schéma de lecture n’est pas assoupli.


## Résultat local et suite

Le lot est sauvegardé avec build/types/lint,904assertionsSQL strictes,220casOwner FR/AR,8contrôlesBuyer financés,32scansaxe sans violation et32mesures de légende≥5,1597:1 après correction. Voir [VALIDATION.md](VALIDATION.md) et le [dossier navigateur](evidence/browser/README.md) pour les commandes, captures, empreintes, exclusions et limites exactes. Ce bilan ne revendique ni signature externe, ni déploiement, ni certification commerciale globale.

La suite demandée est le Sous-traitant complet. Son audit préparatoire a identifié des défauts dans des flux partagés, notamment la correction/réception de livraisons versionnées et la validation indépendante des encaissements. Ils seront corrigés sur une branche issue de ce lot et vérifiés aussi côté Client ; ce rapport ne les masque pas dans ses acquis de préparation de mission.
