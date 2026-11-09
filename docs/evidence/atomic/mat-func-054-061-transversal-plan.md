# MAT-FUNC-054..061 — plan de preuves atomiques transversales

Date : 2026-11-09  
Autorité : `PROMPT_100_IMPLEMENTATION_NON_CERTIFIEE.md` (lot P3 transversal).

## Objectif

Fermer les motifs `PENDING` transversaux (matrice 360, progression, aides, i18n, texte simplifié, accessibilité) par **un chemin de preuve dédié par ID**, exécutable en CI/recette, sans promouvoir `VERIFIED` ni `visa-independant` sans PASS daté.

## Inventaire des preuves cibles

| ID | Motif actuel | Artefact dédié | Type | Evidence JSON cible |
|---|---|---|---|---|
| 054 | matrice-360-exhaustive | `tests/e2e/mat-func-054-viewport-matrix-smoke.spec.ts` | E2E Playwright 360 px | `docs/evidence/atomic/mat-func-054-viewport-matrix-run.json` |
| 056 | contrat-progression-transversal | `apps/web/modules/shared/lib/contracts-missions/mat-func-056-progression-contract.test.ts` | Unit | `docs/evidence/atomic/mat-func-056-progression-contract-run.json` |
| 058 | aides-champs-critiques | `tests/e2e/mat-func-058-critical-field-help-smoke.spec.ts` | E2E | `docs/evidence/atomic/mat-func-058-field-help-run.json` |
| 059 | couverture-FR-AR-exhaustive | `apps/web/modules/shared/lib/i18n/mat-func-059-locale-contract.test.ts` | Unit + E2E smoke | `docs/evidence/atomic/mat-func-059-locale-run.json` |
| 060 | texte-simplifie-systematique | `tests/e2e/mat-func-060-simplified-text-smoke.spec.ts` | E2E public | `docs/evidence/atomic/mat-func-060-simplified-text-run.json` |
| 061 | audit-accessibilite-complet | `tests/e2e/mat-func-061-accessibility-smoke.spec.ts` | E2E axe | `docs/evidence/atomic/mat-func-061-accessibility-run.json` |

## Ordre d'exécution recommandé

1. Unit 056 / 059 (rapides, sans fixture auth).
2. E2E 054 / 058 / 060 / 061 avec états `E2E_*_STORAGE_STATE` générés.
3. Agrégation : référencer chaque JSON dans `REQUIREMENTS_COVERAGE.md` **uniquement après** PASS.

## Critère done par ligne

- [ ] Fichier dédié présent et référencé dans `test_refs` de la ligne.
- [ ] Commande documentée exécutée avec résultat PASS.
- [ ] `docs/evidence/atomic/mat-func-0XX-*-run.json` daté (commande, durée, commit).
- [ ] Motif réduit à `PENDING:visa-independant` (jamais sans exécution réelle).

## Commandes

```bash
pnpm.cmd --filter web test -- apps/web/modules/shared/lib/contracts-missions/mat-func-056-progression-contract.test.ts
pnpm.cmd --filter web test -- apps/web/modules/shared/lib/i18n/mat-func-059-locale-contract.test.ts
pnpm.cmd exec playwright test tests/e2e/mat-func-054-viewport-matrix-smoke.spec.ts
pnpm.cmd exec playwright test tests/e2e/mat-func-058-critical-field-help-smoke.spec.ts
pnpm.cmd exec playwright test tests/e2e/mat-func-060-simplified-text-smoke.spec.ts
pnpm.cmd exec playwright test tests/e2e/mat-func-061-accessibility-smoke.spec.ts
# SQL inventaire MAT-FUNC-027 (lié transversal)
# supabase test db — fichier 0385_immutable_inventory_ledger_guard.test.sql
```

## Hors périmètre de ce plan

- Promotion `VERIFIED`.
- Visa auditeur indépendant.
- Matrice exhaustive de **tous** les écrans V1 (054 reste incrémental : liste critique versionnée dans le spec).
