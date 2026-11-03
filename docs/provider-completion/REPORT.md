# Sous-traitant — état vérifiable de la réalisation

Source explicite : Client `7e01276818e8af11cf18f616615721f1662951fe`, conservé dans `codex/provider-completion-20261102`. Aucun déploiement ni fusion en production. Le présent rapport distingue implémentation, tests locaux et recette hébergée ; il ne certifie pas une livraison commerciale complète.

Produit final : `5b8b0f738137abee19f6552aef538e906d04f24a`, arbre `apps/web` `ef4b62c67a4d8ad5a6403e6a4568bd9dc1774c75`. Les versions `8941517` et `5e06b32` restent les candidats exacts des recettes intermédiaires, avec provenance conservée. Les commits de tests/preuves/documentation suivants ne constituent pas une autre interface.

## Périmètre et preuves

Les identifiants E/D ci-dessous appartiennent à l'analyse approfondie du parcours Sous-traitant, après les corrections Client. Ils ne remplacent pas les identifiants M01–M30 de l'audit initial. « Implémenté » ne signifie pas que toutes les intégrations externes ont été certifiées. Les décomptes recouvrants ne sont jamais additionnés.

| ID | Cause / comportement corrigé | Preuve locale disponible et limite |
|---|---|---|
| E01 | FormData de récurrence ONE_TIME conservé | Tests formulaires/devis ; [Devis](QUOTES.md) |
| E02 | Catégorie fiscale issue du snapshot approuvé | Commandes et tests devis ; pas de tarif fiscal inventé |
| E03 | Version documentaire courante applicable au service exact | Migration38300, SQL0345 44 assertions ; renouvellement B ne qualifie pas A |
| E04 | Questionnaire Provider, sauvegarde, conditions et dépôt | Engine partagé38100, navigateur natif avec reprise hors ligne et texte libre arabe ; revue indépendante38400, SQL0357 40 assertions |
| E05 | Identité légale commune et décision indépendante |43000, SQL0350 28 assertions ; identité native revue après vrais fichiers TEST |
| E06 | Upload rejouable après perte de réponse |38000, chemin/réservation/hash stables, SQL0345 |
| E07 | Lecture distincte des droits de mutation | RLS/rôles SQL et 20 frontières navigateur natives, dont AAL1 refusé |
| E08 | Conditions, motifs et expiration visibles | Projection qualification et composants FR/AR ; statut demandé localisé |
| E09 | Capacité service/globale avec fenêtres effectives | SQL0345 et déclarations natives persistées |
| E10 | Filtres documentaires avant pagination, historique | DAL/coffre et SQL0345 ; pièces privées natives vérifiées |
| E11 | Invitations/devis paginés et détail direct |39100, SQL0346 41 assertions et tests DAL |
| E12 | Échec de chargement distinct d'un formulaire vide | États explicites, erreurs/prefill bloqués, tests de pages FR/AR |
| E13 | PDF réel du brouillon et autorisation du dossier | Route privée/PDF et vrai PDF dans la recette navigateur8941517, tiers refusé |
| E14 | Complétude fondée sur obligations et scans/revues | SQL0345, ancres et revue documentaire native TEST |
| E15 | Options HT facultatives et pièces liées à une version |39000, SQL0346, comparatif ; option acceptée par nouvelle version fiscalisée |
| E16 | Révision volontaire et historique immuable |39200, SQL0346, révision Client→brouillonV2Provider caché→republication et V1 immuable réussis sur8941517 |
| E17 | Rayon et taille déclarés, sans qualification automatique |38200, SQL0345, commandes natives de capacité/périmètre |
| D01 | Déclaration de paiement puis confirmation Client et revue Finance |40000/40500/40600, SQL0347/0352 et UI ; aucun paiement auto-validé par le Provider |
| D02 | Échéancier approuvé lié aux échéances réelles |40500, contre-tests financiers et refus échéance impayée |
| D03 | Pré-relevé, contradiction, exceptions et clôture durable |40100–40950, SQL0347 56 assertions au checkpoint40940 ; délais réels conservés |
| D04 | RejetV1, correctionV2 et rejeu exact du reçu |41700/41800, SQL0348 102 assertions au checkpoint41830 |
| D05 | Jalons corrigés avec décisions historiques |41400, SQL0348 ; réception native V1 refusée puis V2 acceptée, preuves et commentaires conservés sur 8941517 |
| D06 | Contrat complet avant signature et historique | Contrat natif généré après sélectionV2, PDF FR/AR et création de mission réussis ; signature DEV-mock SIMPLE, externe non certifiée |
| D07 | ADD/REPLACE/REMOVE signés, préparés et exécutés |41950/41960, SQL0355 204, 0355b 27, 0355c 18 ; legacy0354 129, chaque transaction annulée |
| D08 | Encaissement des missions livrées/terminées |40000+, contre-tests financiers et confirmation Client séparée |
| D09 | Technicien affecté, lecture séparée de l'exécution |41500/41820/41950, rôles composites et révocation SQL ; technicien non affecté puis révoqué refusé pendant la recette navigateur sur 8941517 |
| D10 | Preuves et commentaires de réception accessibles sous droits | Versions privées propres, commentaires immuables, tests route/UI et SQL0348 |
| D11 | Histoire financière paginée et anciennes devises | DAL, tests anciennes factures hors première page et devises exactes |
| D12 | Relations missions/contrats paginées |41300/41830, recherche native SQL ; détail direct sous RLS |
| D13 | Messagerie native après contrat, tenant et pièces |42000–42040, SQL0349 68 assertions ; Client-only rôle Provider refusé |
| D14 | Preuves contradictoires document/message/livraison canoniques |44100/44200/44400, SQL0351 intégré79 assertions, dont affectation/révocation Technician |
| D15 | Jours ouvrables et calendrier figé de procédure |44000, vendredi→mardi, fermeture et DST ; ancien délai non réécrit |
| D16 | Devise réelle, unités mineures exactes | Finance/DAL/UI, TND/KWD/JPY, pas de taux ou arrondi flottant |
| D17 | Langue conserve chemin, organisation et document | Vrai clic SPA FR→AR→FR sans rechargement, lang/dir synchronisés ; matrice232 et mode Provider conservé |
| D18 | Équipe et erreurs de lecture bornées au tenant | DAL paginé/RLS, sans faux zéro ni membre étranger |
| D19 | États métier FR/AR et RTL | NOT_REQUESTED contextualisé, SELECTED rendu Sélectionné/مختار aux2emplacements,8contrôles devis finaux ; textes libres conservés |

## Résultats consolidés et contre-corrections finales

- **507 migrations,56 fichiers SQL,2 067 assertions PASS**, sur une base neuve isolée, puis nettoyage PASS.649 tables publiques avec RLS,0sansRLS, pgTAP inaccessible aux rôles API. Le reçu énumère les56 tests et tous les hashes ; ce n'est pas une exécution de tous les tests SQL historiques ni une nouvelle certification concurrente.
- Produit final : **2 980 tests Web PASS**, plus **30 PDF/MFA isolés PASS** exclus du groupe précédent ;1skip opt-in. Types et lint passent ; worker104 et build passent. Les échecs d'étape sont conservés et leurs reprises expliquées dans [VALIDATION](VALIDATION.md).
- Recettes natives :15 acteurs GoTrue OTP/TOTP AAL2 ; identité/documents/questionnaire/capacité, revue du dépôt original, devis et révision publiés, contrat DEV-mock et mission, livraison V1refusée→V2acceptée et révocation du technicien, messagerie après contrat avec vrai fichier et contrôle des octets. Source8941517 explicitement conservée dans les reçus.
- Finance5e06 : même intention/PDF/date marocaine initialement refusée, puis déclaration effective, confirmation Client et revue Finance indépendantes. Le vrai lendemain est refusé, sans doublon ni journal anticipé. Pré-relevé réel en attente : la facture du mois courant, son paiement et l'allocation finale ne sont **pas certifiés dans le navigateur avant le cutoff et la fenêtre contradictoire**. Les commandes historiques de clôture/règlement ont leurs tests natifs SQL distincts.
- Double rôle : demande gouvernée Client, refus d'auto-approbation, approbation indépendante, même utilisateur/organisation/adhésion sans duplication. Le retour Provider est corrigé par un indice de navigation explicite, toujours soumis aux autorisations serveur. Les tableaux et formulaires GET conservent l'organisation et le mode, y compris lors du changement de langue.
- Contraste réellement mesuré : le petit libellé arabe d'espace passait à4,1842:1 sur son fond beige. Token existant corrigé ;8scans/56cibles après correction :48bornes complètes conformes,6glyphes opaques conformes,2nonmesurés/clippés ;0sous le seuil parmi les mesures. BrandAR atteint12,5138:1. Les incomplets axe liés aux gradients ne deviennent pas artificiellement des contrôles terminés ; aucune certification WCAG globale n'est revendiquée.
- La matrice complète706 passe232pages/29routes FR/AR aux4largeurs,256scans axe sans violation,8menus et3contrôles réels navigation/recherche ;0erreurJS ou débordement. Le delta final5b8b0f traduit deux états Devis :8reprises ciblées réussies, mêmes dossiers et textes libres. Les candidatures ne sont pas confondues : [index et454empreintes vérifiées](evidence/browser/README.md).

| Constat indépendant final | Cause corrigée | Fichiers / preuve |
|---|---|---|
| R09, revue de qualification bloquée | projection privée limitée au dépôt/service, consultation auditée avant décision |38400, composants `qualification-questionnaire-review*`,0357=40 |
| R11, faux vide Admin Prestataires | jointure organizations incompatible avec le réviseur indépendant |38410 invoker + noms bornés,0358=19 et vraie recherche UI,1ligne ciblée/0organisation générale |
| L09, périmètre signé en attente masqué par l'ancien statut | lecture autorisée `signedScopePending`, notice et priorité séparées, statut historique conservé |41970, DAL Client/Provider, Workbench/FollowBoard ;0355=204 et tests UI |
| F13, jour marocain refusé comme futur | deux gardes financières utilisaient le jour UTC |40960,0359=27, véritable reprise de la même intention et refus du lendemain |
| Notifications Provider indisponibles |2callers oubliaient l'organisation sélectionnée |paramètres, nested-screens,10nouveaux tests SSR FR/AR |
| Incident Auth transformé en déconnexion |lecture Client missions ignorait Auth.error |DAL partagé,503→incident et401→connexion, tests avant toute requête métier |
| Double rôle renvoyant vers Client |liens de dashboard sans contexte explicite |helper partagé, navigation/brand/langues/GET/ModeClient ;23tests+alignement5 |
| Langue document périmée après SPA |root layout persistait malgré le contenu AR correct |DocumentLocaleSync sur locale validée,7tests et vraie navigation SPA sans reload |
| Contraste AR insuffisant |petit libellé sur dégradé reprenait une teinte trop claire |1couleur `provider-brand-space`, mesures pixels avant/après |

Les27/28/40/85/204 assertions et les groupes de composants se recouvrent ; seuls les compteurs du rejeu global et de ses groupes exclus sont additionnables. Détails : [revue indépendante](independent-review.md), [Livraison](DELIVERY-INDEPENDENT-REVIEW.md), [Finance](FINANCE.md), [autorité économique](DISPUTE_ECONOMICS.md), [moteur signé](SIGNED-SCOPE.md), [Devis](QUOTES.md), [Entrée](entry.md), [communication](CONTEXT-COMMUNICATION.md).

## Conditions externes de clôture

1. Fournisseur et niveaux de signature approuvés (DR-001), accords/clauses économiques et mandat de collecte s'il s'applique. Le DEV-mock SIMPLE n'est pas une signature juridique de production.
2. Éditeur légal et coordonnées complètes, CNDP/politiques applicables, conditions commerciales, tarification et traductions approuvées manquantes. Aucun contenu n'est inventé.
3. Recette hébergée autorisée : Supabase/Vercel/worker, email, scanner réel et paiements sandbox, puis sauvegarde/restauration et exploitation. Les tests locaux ne prouvent pas ces connexions distantes.
4. Création de PR : branche poussée et corps de PR prêt ; accès API GitHub refusé. Aucun lien de PR créée n’est revendiqué. Le comparatif avec la branche Client finale est fourni.
