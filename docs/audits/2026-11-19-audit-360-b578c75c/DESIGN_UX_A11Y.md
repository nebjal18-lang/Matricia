# Design, UX, FR/AR et accessibilité

## Résultats observés

- 14 routes publiques × 2 langues × 5 largeurs : **140 contrôles** à 360, 390, 768, 1024 et 1440 px. Les dimensions sont émulées, pas des appareils physiques.
- **56 scans axe**, aucun finding dans les états publics scannés. Pas de conclusion globale WCAG et aucun PASS des espaces authentifiés par extrapolation.
- Langue/direction, titres, images cassées, erreurs JS et largeurs enregistrés dans les rapports bruts.
- Deux débordements FR à 1024, confirmés par une seconde mesure : accueil 1046/1024 ; diagnostic 1026/1024. La navigation desktop et son CTA débordent. Pas de débordement de document à 360 dans ces états contrôlés.
- Lien d'évitement : après activation puis Tab, focus sur le CTA principal en FR et AR. Menu anonyme : ouverture/Escape/retour focus corrects à 360. Le cas multiespace reste distinct.
- La vraie continuation FR→AR conserve le texte saisi, le service BTP-RENOV, la progression et le contexte libre, avant toute soumission. Deux sondes PASS ; les deux échecs du test historique attendent une traduction absente désormais disponible.

## Inspection visuelle

Les captures d'accueil FR/AR à 360 ont été ouvertes et examinées : marque, hiérarchie et CTA principal présents ; miroir RTL visible ; texte et pied de page accessibles. Les pages publiques utilisent des surfaces/illustrations cohérentes. Sans maquette approuvée, aucun écart pixel-perfect n'est allégué. Les captures à 1024 complètent la preuve de débordement.

Exemples : [evidence/screenshots/fr-home-360.png](./evidence/screenshots/fr-home-360.png), [evidence/screenshots/ar-home-360.png](./evidence/screenshots/ar-home-360.png), [evidence/screenshots/fr-home-1024-targeted.png](./evidence/screenshots/fr-home-1024-targeted.png).

## Écarts source et contrôles à confirmer en session

| ID | Constat | Preuve disponible |
|---|---|---|
| [PROD-02](./FINDINGS.md#prod-02) | La restauration du besoin perd l'organisation explicite | Source + évaluation déterministe des helpers |
| [UX-01](./FINDINGS.md#ux-01) | L'inscription fournisseur impose la classification avant de continuer | Source + observation navigateur |
| [UX-02](./FINDINGS.md#ux-02) | Changer de langue abandonne le détail et la version d'une offre | Construction des liens sur source |
| [A11Y-01](./FINDINGS.md#a11y-01) | Le CTA financier blanc sur corail est sous AA | Source + calcul de contraste |
| [A11Y-02](./FINDINGS.md#a11y-02) | Le suivi mission combine un texte très clair et un champ blanc | Source + calcul de contraste |
| [A11Y-03](./FINDINGS.md#a11y-03) | Les recherches connectées suppriment leur indicateur de focus | Analyse de cascade CSS |
| [A11Y-04](./FINDINGS.md#a11y-04) | Le menu multiespace exclut summary de sa navigation personnalisée | Analyse du focus selector et du gestionnaire Tab |
| [I18N-01](./FINDINGS.md#i18n-01) | Les services arabes du fournisseur portent lang=fr | Source et contenu localisé inspectés |
| [I18N-02](./FINDINGS.md#i18n-02) | Des codes métier internes sont exposés sans traduction | Analyse des libellés de formulaires |
| [UX-03](./FINDINGS.md#ux-03) | La navigation française déborde à 1024px | Navigateur réel, reproduction ciblée |

La déclaration corail/blanc donne 2,864:1 ; le thème follow combine une encre claire et un champ blanc à 1,091:1. Ces calculs ne remplacent pas la vérification du style calculé dans le compte et l'état concernés. Les défauts de recherche, d'offre détaillée et de menu multiespace n'ont pas été observés dans une session métier authentifiée.

## Référentiels

Design Authority Version A du Gold Master, règles Matricia et [Web Interface Guidelines officielles consultées](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Les règles de copy anglaise du guide externe ne remplacent pas les exigences FR/AR du produit.

## Manques de preuve

Pas de NVDA/VoiceOver, matériel mobile réel/clavier virtuel, zoom manuel de tous les formulaires, axe sur états authentifiés, référence Figma approuvée ou validation complète de toutes les erreurs/modales. La revue source indépendante complète les scans sans les remplacer : [reviewers/design.md](./reviewers/design.md).
