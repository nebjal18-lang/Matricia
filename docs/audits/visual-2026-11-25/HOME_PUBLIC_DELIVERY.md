# Accueil public — livraison visuelle 2026-11-25

## Référence

- Branche : `design/visual-correction-2026-11-25`
- Base : `03f48a4f` (puis diagnostic `76d9cc09`)
- Environnement captures : `http://localhost:5180` (apps/web preview local, menu fermé)
- Note : badge Next.js Dev Tools présent en `next dev` ; absent d’un build de prévisualisation

## Symptômes avant

- Titre « Matricia » hero-level alors que le logo est déjà dans l’en-tête
- CTA « J’ai déjà un besoin précis » trop discret face à « Analyser » / inscription
- Hero forcé en plein écran mobile
- Cycle public : libellé « Matcher »
- Pas d’exemple compact besoin → prestation → livrable sous la bannière

## Changements

- Promesse métier en H1 ; surtitre B2B à la place du brand hero
- CTA primaire « Analyser mon entreprise », secondaire visible « Décrire un besoin précis », lien distinct « Proposer mes services »
- Hauteur hero adaptée (`min(72svh, 640px)` desktop ; auto sur téléphone)
- Bandeau « Exemple compact » (FR/AR) sous la bannière
- Cycle : « Mettre en relation » / « الربط »
- Abonnements : états publié / vide / indisponible déjà conformes (aucun tarif fictif)

## Captures après

| Fichier | Route | Langue | Largeur | Menu |
| --- | --- | --- | --- | --- |
| `after/home-fr-360.png` | `/fr` | FR | 360×800 | fermé |
| `after/home-ar-360.png` | `/ar` | AR | 360×800 | fermé |
| `after/home-fr-1280.png` | `/fr` | FR | 1280×800 | fermé (desktop) |

## Tests

- `HomePremium.test.tsx` — 3 pass
- `(public)/page.test.tsx` — 2 pass
- `public-pages-mockup-alignment.test.tsx` — 7 pass
- `abonnements/page.test.tsx` — 9 pass

## Fichiers

- `apps/web/modules/public/ui/home-premium/home-premium.copy.ts`
- `apps/web/modules/public/ui/home-premium/HomePremiumHero.tsx`
- `apps/web/modules/public/ui/home-premium/HomePremiumBelow.tsx`
- `apps/web/modules/public/ui/home-premium/home-premium-shell.module.css`
- `apps/web/modules/public/ui/home-premium/HomePremium.test.tsx`
- `apps/web/app/[locale]/(public)/page.test.tsx`
- `apps/web/app/[locale]/(public)/public-pages-mockup-alignment.test.tsx`
