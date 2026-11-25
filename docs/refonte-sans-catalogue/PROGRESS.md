# Refonte sans catalogue — état de travail

## Terminé avec preuve

- Audit ciblé et carte de routes : `AUDIT.md`.
- Baseline locale : `apps/web` build, lint ciblé et E2E public du commit `028312a` étaient verts avant la nouvelle refonte.

## En cours

- Lot 2 : Home diagnostic-first, prédiagnostic public déterministe, besoin précis et conservation locale limitée.
- Mapping non permanent des anciennes URLs `/services` et `/services/[code]` vers des entrées guidées.

## Bloqué

- Aucun blocage technique à ce stade. La persistance authentifiée du prédiagnostic exige de raccorder une mutation serveur idempotente aux tables existantes après le premier vertical public.

## Prochaine action exacte

- Livrer `/[locale]/diagnostic` et `/[locale]/besoin`, puis raccorder le retour OTP et les entrées publiques sans catalogue.
# Progression — refonte des parcours sans catalogue

## Terminé avec preuve

- Lot 1 : audit ciblé et carte des routes dans `AUDIT.md`.
- Lot 2 : Home guidée, prédiagnostic déterministe de sept questions, bilan sans score, raccourci de besoin, entrée fournisseur et redirections des anciennes routes publiques.
- Authentification : l’OTP conserve une destination locale validée ; le navigateur conserve uniquement le brouillon public non sensible, expirant après sept jours et effaçable.
- Qualité du lot public : `corepack pnpm --filter @matricia/web typecheck`, `corepack pnpm --filter @matricia/web lint` et `corepack pnpm exec playwright test tests/e2e/refonte-sans-catalogue-public.spec.ts --workers=2 --reporter=dot` passent le 2026-09-14 (4 tests).

## En cours

- Lot 4 : E2E authentifié besoin→demande FR/AR 360 px.

## Terminé récemment

- Lot 3 : rattachement auto du brouillon confirmé après OTP via `save_public_need_intake` (idempotent) + redirection vers la demande préremplie quand un `serviceCode` est connu (`need-flow.tsx` NeedResult).
- Lot 4 (web) : préremplissage activité depuis intent v2, consultations home `tab=answer`, multi-services après succès.
- UX-01 : `activitySummary` exposé par `franchise_provider_dossiers` + affichage qualification franchise (migration `20261112190000_franchise_provider_dossier_activity_summary.sql`).

## Bloqué

- Aucun blocage technique pour le lot public. YouSign LIVE, CMI LIVE (dont remboursements sans spec API) et consumers Privacy*RequestedV1 restent hors ce lot (décisions / attestation externes).

## Prochaine action exacte

E2E authentifié besoin→demande FR/AR 360 px.
