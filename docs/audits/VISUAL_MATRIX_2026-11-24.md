# Matricia — matrice visuelle des pages, 24 novembre 2026

## Périmètre et résultat

L’inventaire calculé depuis `apps/web/app/[locale]` contient **222 fichiers `page.tsx`**, sans doublon de route : 170 routes statiques et 52 modèles de route dynamiques. L’audit précédent indiquait 223 ; son dénominateur a été corrigé. La matrice a parcouru les **888 combinaisons** page × FR/AR × 360/1280 px dans un environnement local isolé, avec sessions Client, Sous-traitant, Franchisé et Admin distinctes. Les captures de contenu statique couvrent **169 pages × 4 = 676 vues** ; la 170e route statique, `administration/gouvernance-franchise`, redirige volontairement vers `administration/gouvernance`, elle-même capturée. Une passe supplémentaire a ensuite cherché de vraies fiches pour les 52 modèles dynamiques.

| Espace | Fichiers de page | Statiques | Dynamiques |
| --- | ---: | ---: | ---: |
| Public | 21 | 19 | 2 |
| Partagé | 16 | 14 | 2 |
| Client | 39 | 30 | 9 |
| Sous-traitant | 37 | 26 | 11 |
| Franchisé | 37 | 27 | 10 |
| Administration | 72 | 54 | 18 |
| **Total** | **222** | **170** | **52** |

Le passage complet a contrôlé pour chaque route statique l’URL finale, le titre principal, la présence de contenu, la langue, le sens RTL, le débordement horizontal et les erreurs de page. Il a détecté un état d’invitation invalide presque vide en arabe et une ancienne URL Admin redirigée, initialement classée à tort comme échec. La page d’invitation invalide présente désormais un panneau FR/AR avec explication et action ; la redirection est reconnue comme telle. Le texte du centre de pilotage Admin décrit maintenant le panneau d’action sans position gauche/droite inexacte sur mobile.

Après correction, la reprise ciblée FR/AR × 360/1280 px sur l’invitation invalide, le centre de pilotage et la redirection a terminé **8/8 tests, zéro ignoré, zéro écart**, avec contrôle axe WCAG sur les deux pages effectivement rendues par cas. Les contrôles TypeScript et ESLint de `@matricia/web` ont réussi. Captures corrigées : [FR mobile](./visual-2026-11-24/join-network-invalid-fr-mobile.png) et [AR mobile](./visual-2026-11-24/join-network-invalid-ar-mobile.png).

## Limite du pourcentage

La passe initiale avait rendu **14/52 modèles dynamiques**. Une fixture de données synthétiques, réservée à une base Docker locale vérifiée, ajoute un catalogue publié avec ses liens de sous-catégorie, des demandes, RFQ, devis, diagnostics, questionnaires, messages, documents PDF de test et une demande d’assistance. Les commandes métier réelles produisent la demande d’assistance et la revue de gouvernance ; le rapport de contrôle franchise est calculé depuis les faits locaux. La fixture est neutralisée après la passe. Elle ne démontre ni paiement, ni validation fiscale, ni approbation humaine, ni publication contractuelle.

La nouvelle reprise complète du **24 novembre 2026** (`7e8c4272-923b-4f03-a46d-394ca7deb67a`) a rendu **52/52 modèles dynamiques**, chacun en FR/AR à 360 et 1280 px : Public 2/2, Partagé 2/2, Client 9/9, Sous-traitant 11/11, Franchisé 10/10 et Administration 18/18. Les **208 vues** sont sans écart automatique ; les six tests de matrice passent, zéro échec et zéro ignoré. Le contrôle TypeScript de `@matricia/web` passe également.

Les cinq fiches précédemment manquantes ont désormais des données locales contrôlées. `administration/support/[id]` passe par une demande d’accès temporaire réellement approuvée par deux comptes distincts et exécutée ; l’accès est révoqué à la fin. `signatures/[envelopeId]/preparation` utilise un véritable PDF de test privé, ses empreintes et un brouillon de demande ; aucune signature ni invitation Yousign n’est envoyée. `client/abonnement/cycles/[cycleId]` utilise un cycle historique annulé de montant nul, sans encaissement. `sous-traitant/facturation/[invoiceId]` utilise une écriture synthétique équilibrée et une facture historique sans règlement. `franchise/finance/releves/[closureId]` utilise une clôture de présentation à activité nulle, sans recette ni distribution. Les quatre fixtures historiques sont injectées uniquement dans la base Docker locale vérifiée, en contournant certains déclencheurs métier ; elles prouvent l’affichage et la lecture autorisée, pas les commandes métier de paiement, de facturation, de signature ou de clôture.

La **couverture de contenu rendu** atteint **220/222 modèles de page, soit 99,1 %** : 169 pages statiques de contenu et 51 détails dynamiques. L’alias Client « comparaison » et l’ancienne route statique de gouvernance sont deux redirections vérifiées. La **couverture des comportements de route** est donc **222/222, soit 100 %** pour cette matrice de rendu locale. Ce pourcentage ne représente ni la couverture des branches du code, ni la preuve E2E de tous les workflows métier.

Le **100 % de qualité esthétique des 222 pages n’est pas démontré**. Restent notamment la comparaison humaine exhaustive avec les maquettes, les états chargement/erreur/plein/vide, le zoom et l’accessibilité complète de chaque page. Un score de « beauté » ne peut pas être déduit mécaniquement des captures ou de l’absence de débordement.

Les rapports JSON et captures complets de ces exécutions sont dans `.tmp/visual-route-matrix/` (ignoré par Git). Pour reproduire une passe ciblée : `VISUAL_MATRIX_SPACES`, `VISUAL_MATRIX_LOCALES`, `VISUAL_MATRIX_ROUTES`, `VISUAL_MATRIX_PROJECT` et `VISUAL_MATRIX_AXE` configurent `pnpm test:e2e:local-spaces --visual-route-matrix-only` ou `--visual-dynamic-matrix-only`. Les tests refusent une URL non locale. Le programme révoque l’accès temporaire et neutralise les comptes ; les écritures historiques immuables et le PDF privé de signature demeurent dans la base Docker de test, avec des références explicitement synthétiques.
