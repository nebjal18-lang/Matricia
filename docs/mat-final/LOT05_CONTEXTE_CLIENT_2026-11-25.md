# MAT-FINAL — lot 05, contexte des liens Client

| ID | Existant et défaut | Correction / preuve | Reste à faire |
| --- | --- | --- | --- |
| C01 | L'accueil affiche des actions issues du centre d'actions, ordonnées en amont par obligation, échéance et priorité ; les trois premières sont visibles avec un compteur de trois maximum. Il ne présente pas encore les quatre états du ticket. | Lecture du code de l'accueil et du modèle d'actions ; aucune clôture. | Construire la distinction à faire / en cours / bloqué / terminé sur des statuts métier persistés, contrôler les compteurs et ouvrir chaque dossier en E2E connecté. |
| C03 | Les liens des actions, messages et échéances concaténaient le contexte `organizationId` même si le lien le portait déjà. Deux valeurs contradictoires pouvaient arriver dans une route. | Une composition URL unique remplace la valeur antérieure par l'organisation active, garde le dossier, les autres paramètres et le fragment. Les liens externes ne reçoivent pas l'identifiant d'organisation. Test ciblé des trois familles de liens et de l'URL externe. | Tester le changement de langue, les filtres et la navigation connectée sur plusieurs organisations. |

Preuves locales du lot : sélection Vitest `view-model.test.ts`, 7 fichiers/102 tests PASS ; TypeScript web PASS ; ESLint ciblé PASS ; `git diff --check` PASS. Node local 24.11.0 au lieu de Node 22. Aucune base distante ni production utilisée. C01 et C03 restent **EN COURS** au sens complet du ticket #25 ; aucun visa de release.
