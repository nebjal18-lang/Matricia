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

Une seconde passe a suivi les liens métiers depuis les pages statiques avec les mêmes comptes locaux. Elle a rendu **14/52 modèles dynamiques** en FR/AR à 360/1280 px, soit 56 vues supplémentaires, sans écart automatique sur ces vues. Les 38 autres modèles n’ont pas de lien vers un enregistrement de test utilisable dans ce scénario : Public 2/2 manquants, Partagé 2/2, Client 7/9, Sous-traitant 7/11, Franchisé 6/10, Administration 14/18. Les liens de téléchargement et les valeurs non UUID pour les identifiants métier sont écartés afin de ne pas compter des exports comme pages.

La **couverture de contenu rendu** atteint donc **183/222 modèles de page, soit 82,4 %** : 169 pages statiques de contenu + 14 détails dynamiques. La redirection statique contrôlée porte la couverture des comportements de route à 184/222, soit 82,9 %. Cela ne mesure **pas** la beauté, ni la qualité fonctionnelle de tous les états.

Le **100 % de qualité esthétique des 222 pages n’est pas démontré**. Il manque les 38 modèles dynamiques sans données de test, la comparaison humaine exhaustive avec les maquettes, les états chargement/erreur/plein/vide, le zoom et l’accessibilité complète de chaque page. Un score de « beauté » ne peut pas être déduit mécaniquement des captures ou de l’absence de débordement.

Les rapports JSON et captures complets de ces exécutions sont dans `.tmp/visual-route-matrix/` (ignoré par Git). Pour reproduire une passe ciblée : `VISUAL_MATRIX_SPACES`, `VISUAL_MATRIX_LOCALES`, `VISUAL_MATRIX_ROUTES`, `VISUAL_MATRIX_PROJECT` et `VISUAL_MATRIX_AXE` configurent `pnpm test:e2e:local-spaces --visual-route-matrix-only` ou `--visual-dynamic-matrix-only`. Les tests refusent une URL non locale et le programme neutralise les comptes et données de test après chaque passe.
