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

La reprise complète du **24 novembre 2026** (`de35728d-2fe2-41c9-997c-ee3f08cd1107`) a rendu **47/52 modèles dynamiques**, chacun en FR/AR à 360 et 1280 px : Public 2/2, Partagé 1/2, Client 8/9, Sous-traitant 10/11, Franchisé 9/10 et Administration 17/18. Les **188 vues** de ces 47 modèles n’ont pas d’écart automatique. Le test global reste en échec volontaire parce que cinq modèles n’ont pas encore de fiche probante. La route Admin Support a été retirée du compte des réussites : elle affichait un refus d’autorisation, malgré un titre et un HTTP 200.

Les cinq modèles restants sont `signatures/[envelopeId]/preparation`, `client/abonnement/cycles/[cycleId]`, `sous-traitant/facturation/[invoiceId]`, `franchise/finance/releves/[closureId]` et `administration/support/[id]`. Les quatre premiers exigent un objet créé par leurs flux de signature, paiement ou comptabilité ; le dernier exige une autorisation temporaire exécutée après deux décisions indépendantes. Un identifiant artificiel ou un écran de refus ne constitue pas une preuve de contenu. Les liens de téléchargement et les valeurs non UUID pour les identifiants métier sont aussi écartés.

La **couverture de contenu rendu** atteint **215/222 modèles de page, soit 96,8 %** : 169 pages statiques de contenu et 46 détails dynamiques ; le 47e détail dynamique est l’alias Client « comparaison », redirigé vers « offres ». Avec cette redirection et la redirection statique contrôlée, la **couverture des comportements de route** est **217/222, soit 97,7 %**. Cela ne mesure **pas** la beauté, ni la qualité fonctionnelle de tous les états.

Le **100 % de qualité esthétique des 222 pages n’est pas démontré**. Il manque cinq modèles dynamiques avec données métier probantes, la comparaison humaine exhaustive avec les maquettes, les états chargement/erreur/plein/vide, le zoom et l’accessibilité complète de chaque page. Un score de « beauté » ne peut pas être déduit mécaniquement des captures ou de l’absence de débordement.

Les rapports JSON et captures complets de ces exécutions sont dans `.tmp/visual-route-matrix/` (ignoré par Git). Pour reproduire une passe ciblée : `VISUAL_MATRIX_SPACES`, `VISUAL_MATRIX_LOCALES`, `VISUAL_MATRIX_ROUTES`, `VISUAL_MATRIX_PROJECT` et `VISUAL_MATRIX_AXE` configurent `pnpm test:e2e:local-spaces --visual-route-matrix-only` ou `--visual-dynamic-matrix-only`. Les tests refusent une URL non locale et le programme neutralise les comptes et données de test après chaque passe.
