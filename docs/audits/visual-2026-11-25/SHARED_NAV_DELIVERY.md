# Identité partagée + navigation mobile — 2026-11-25

## Décision de couleur

| Rôle | Token | Usage |
| --- | --- | --- |
| Action principale | `--mat-coral-ink` / `--client-cta` | Boutons primaires, indicateur d’onglet actif |
| Accent de marque | `--mat-violet*` | Soft backgrounds, chips violet, identité |
| Statuts | mint / peach / coral / sky / rose | États métier (inchangés) |

Le public (accueil) et les espaces connectés partagent désormais la même signification pour l’action principale (corail). Le violet n’est plus la CTA par défaut des shells.

## Navigation mobile

- Nouveau composant `WorkspaceMobileNav` (Sheet Radix) : fermé au chargement, fermeture visible, Esc, overlay, restauration de focus, scroll interne, fermeture après navigation.
- Client / Professionnel / Admin : sidebar masquée sous 960 px ; déclencheur « Ouvrir le menu » dans la topbar.
- Franchisé : dock conservé ; « Plus » ouvre le menu complet (plus de lien direct unique vers gouvernance) ; contraste et zone tactile du dock renforcés.

## Fichiers

- `apps/web/modules/shared/ui/workspace-mobile-nav.tsx`
- `apps/web/modules/shared/ui/workspace-mobile-nav.test.tsx`
- `apps/web/modules/shared/ui/design-system/matricia-ds.css`
- `apps/web/modules/client/ui/client-experience.css`
- `apps/web/modules/client/ui/client-app-shell.tsx`
- `apps/web/modules/provider/ui/provider-app-shell.tsx`
- `apps/web/modules/admin/ui/admin-app-shell.tsx`
- `apps/web/modules/franchise/ui/franchise-app-shell.tsx`
- `apps/web/modules/franchise/ui/franchise-experience.css`

## Tests

- `workspace-mobile-nav.test.tsx` — 1 pass
- `connected-app-shell.test.tsx` — 6 pass

## Captures restantes

Écrans métier des quatre rôles (menu fermé / ouvert / après navigation) à capturer en session authentifiée de recette ; le composant est prouvé unitairement et branché dans les quatre shells.
