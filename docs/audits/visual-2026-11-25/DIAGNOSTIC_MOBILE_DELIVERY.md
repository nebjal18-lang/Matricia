# Livraison 1 — Diagnostic mobile FR/AR (360 × 800)

## Référence

| Élément | Valeur |
| --- | --- |
| Commit de départ | `03f48a4f` (`origin/version-2`) |
| Branche | `design/visual-correction-2026-11-25` |
| Routes | `/fr/diagnostic`, `/ar/diagnostic` |
| Viewport | 360 × 800, menu public **fermé** |
| Session | Anonyme (prédiagnostic public) |
| Avant | Captures audit 24 nov. 2026 (`before/`) |
| Après | Captures session 25 nov. 2026 (`after/`), serveur local `127.0.0.1:5180` |

## Symptômes avant

- Titre long + slogan manuscrit + frise d’étapes avant la question à 360 px.
- « Question 1 sur 8 », barre et pourcentage « 12,5 % » redondants.
- Point d’interrogation FR isolable en fin de ligne.
- Le rail mobile (`order: -1`) plaçait les 8 étapes au-dessus de la question.

## Changements

| Fichier | Modification |
| --- | --- |
| `apps/web/modules/public/data/journey/copy.ts` | Titre/intro courts FR+AR ; espace fine insécable avant `?` FR |
| `apps/web/modules/public/ui/journey/prediagnostic-flow.tsx` | Hero compact sans slogan ; progression compacte ; étapes en `<details>` mobile ; pied allégé |
| `apps/web/modules/public/ui/journey/prediagnostic-phases.tsx` | Récap groupé question/réponse/Modifier ; résultat avec justification courte |
| `apps/web/modules/public/ui/journey/diagnostic-premium.module.css` | Hiérarchie mobile, rail desktop vs details, états de choix |
| `apps/web/modules/public/ui/journey/prediagnostic-mobile.test.tsx` | Tests de hiérarchie |
| `apps/web/modules/public/ui/journey/prediagnostic-phases.test.tsx` | Adaptation récap groupé |

## Acceptation observée

- FR 360 × 800 : titre court, question dominante, ponctuation collée, barre + « Question 1 sur 8 », ≥ 2 réponses visibles sans scroll.
- AR 360 × 800 : même hiérarchie RTL, question + ≥ 2 réponses visibles, parcours en `<details>` fermé.
- Tests : 26/26 (`prediagnostic-mobile` + `prediagnostic-phases`).

## Limites

- Bouton flottant Next.js Dev Tools visible en `next dev` uniquement ; absent d’un build de prévisualisation.
- Accueil public, composants partagés et tableaux de bord des quatre rôles : **à poursuivre** sur la même branche.
- Captures « avant » reprises de l’audit du 24 novembre (même parcours, commit antérieur), pas d’une session métier authentifiée.
