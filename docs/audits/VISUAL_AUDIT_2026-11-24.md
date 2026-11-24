# Audit visuel Matricia — 24 novembre 2026

## Référence et périmètre

Référence obligatoire : Gold Master V4 FINAL, Design Authority Version A, cinq espaces, FR/AR, RTL et largeur minimale de 360 px. Les [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) ont servi de contrôle complémentaire pour la navigation, le focus et le contenu responsive.

Le dépôt contient **222 fichiers de page** : 37 publiques ou partagées, 39 Client, 37 Sous-traitant, 37 Franchisé et 72 Administration. Le contrôle visuel exécuté dans cette passe porte sur l’accueil public FR/AR (360, 1280 et 1440 px), le diagnostic FR/AR (360 px), la connexion FR (360 px), puis les **quatre habillages d’espace** dans une prévisualisation locale avec contenu synthétique (FR/AR, 360 et 1280 px). Les routes protégées redirigent vers la connexion sans session : leurs contenus réels n’ont pas été inspectés visuellement dans cette passe.

## Constats et corrections

| Priorité | Constat observé | Correction |
| --- | --- | --- |
| Haute | À 360 px, la frise et le bloc de réassurance du diagnostic précédaient la question ; l’action principale arrivait très loin sous la ligne de flottaison. | La question précède désormais les informations secondaires, en FR comme en AR. |
| Haute | Les navigations complètes Client, Sous-traitant et Administration occupaient le haut de l’écran sur mobile. | Un volet commun replié par défaut donne accès aux liens ; bouton de 44 px, `aria-expanded`, ouverture au clavier et fermeture par Échap avec retour du focus. Le dock Franchisé existant reste affiché à 360 px. |
| Moyenne | La navigation publique se repliait sur deux lignes à largeur ordinateur portable. | En-tête élargi, espacement resserré et libellés sur une ligne. |
| Moyenne | Les cartes Sous-traitant recevaient une couleur selon leur rang, sans état métier associé. | Surface neutre par défaut ; les tons explicites du design system restent disponibles. |

La base visuelle la plus cohérente est l’habillage partagé Client/Administration : toile claire, barre latérale blanche, bleu de marque, titres hiérarchisés et accent réservé aux actions ou statuts. Il sert de référence commune aux quatre espaces. Les exceptions utiles du Franchisé, notamment le dock mobile, sont conservées.

Captures après correction : [accueil public 1280 px](./visual-2026-11-24/home-laptop.png), [diagnostic FR 360 px](./visual-2026-11-24/diagnostic-mobile.png), [diagnostic AR 360 px](./visual-2026-11-24/diagnostic-ar-mobile.png). Prévisualisations **synthétiques des habillages**, sans session métier : [Client](./visual-2026-11-24/shell-client-fr-360.png), [Sous-traitant RTL](./visual-2026-11-24/shell-provider-ar-360.png), [Franchisé](./visual-2026-11-24/shell-franchise-fr-360.png), [Administration](./visual-2026-11-24/shell-admin-fr-360.png).

## Vérifications exécutées

- Navigateur Chromium local : 16 prévisualisations d’habillage, FR/AR à 360 et 1280 px ; **aucun débordement horizontal**. Pour Client, Sous-traitant et Administration, volet masqué au chargement, visible après activation, fermé par Échap avec focus revenu sur le bouton. Le dock Franchisé reste visible à 360 px.
- Pages publiques : réponses HTTP 200, absence de débordement horizontal pour les vues contrôlées ; question du diagnostic affichée avant la frise en FR/AR. Les liens de navigation publique restent sur une ligne à 1280/1440 px.
- `@matricia/web` : TypeScript et ESLint réussis. La suite locale isolée `test:e2e:local-spaces --authenticated-route-smoke-only` a terminé **16/16 tests, zéro ignoré**, avec données de test neutralisées. Elle parcourt des routes authentifiées FR/AR sur mobile et bureau, vérifie l’absence de débordement, les restrictions de rôle, une analyse axe/WCAG en fin de scénario et l’ouverture/fermeture de la nouvelle navigation. Deux essais préliminaires ont rencontré un démarrage local indisponible, puis le délai de 120 s sur des routes arabes compilées à froid ; la limite a été ajustée à 240 s et la passe complète a réussi.

## Limites et suite nécessaire

Ce résultat **ne certifie ni la perfection visuelle, ni les 222 pages actuelles**. La prévisualisation des espaces utilisait leurs vrais composants de navigation et de style avec un contenu synthétique ; la suite authentifiée vérifie des comportements, mais ne produit pas une comparaison visuelle de chaque donnée, tableau, formulaire et état vide/erreur. Il reste à capturer les pages authentifiées par rôle, FR/AR, 360 px et bureau, à les comparer aux maquettes de `docs/design/`, puis à corriger les écarts page par page. Les 462 exécutions E2E déjà rapportées prouvent des parcours fonctionnels locaux et ne constituent pas une mesure de couverture visuelle exhaustive.
