# MARKETING-001..008 — implémentation, specs et écarts restants

Date : 2026-11-09  
Specs : `docs/specs/sections/marketing-autopilot.md`, parcours `tests/e2e/p18-marketing-franchise-tax.spec.ts`, `p24-marketing-completion.spec.ts`, `p29-marketing-workspaces.spec.ts`.

| ID | Spec / parcours | Implémentation principale | Tests automatisés existants | Écart restant (honnête) | Preuve atomique cible |
|---|---|---|---|---|---|
| MARKETING-001 | p18 Brand Kits | `brand-defaults.ts`, pages Prestataire/Franchisé, migration `20260913018700` | `brand-defaults-model.test.ts`, SQL `0058` | E2E authentifié mutation Brand Kit + visa | `tests/e2e/mat-func-marketing-001-brand-kit-smoke.spec.ts` |
| MARKETING-002 | p18 contenus 4 canaux | `content-engine.ts`, migration attribution | `content-engine.test.ts` | Génération déterministe 1 service = 3 contenus E2E | `mat-func-marketing-002-content-engine-smoke.spec.ts` |
| MARKETING-003 | p18 templates | migration `20260912007800` | SQL `0058` | Seed/version UI six templates franchisé | smoke admin + SQL dédié |
| MARKETING-004 | p24 calendrier / approbation | `calendar-management.tsx`, `0171` funnel | SQL `0058`, `0171` | Job mensuel + approbation globale E2E | `p24` extension authentifiée |
| MARKETING-005 | p18 publication | `publisher.ts`, worker `20260913018000` | `publisher.test.ts` | Credentials live prod (sandbox OK pour « implémenté ») | sandbox publish smoke |
| MARKETING-006 | p29 funnel CTA | `funnel.ts`, `api/marketing/cta/[token]` | `funnel*.test.ts`, `route.test.ts` | Valeur contrat dans attribution + E2E bout-en-bout | `mat-func-marketing-006-funnel-smoke.spec.ts` |
| MARKETING-007 | p18 tendances hebdo | worker `marketing-trends`, `0132` | `route.test.ts`, SQL `0132` | E2E authentifié + preuve opération planifiée | `mat-func-marketing-007-trends-smoke.spec.ts` |
| MARKETING-008 | p29 workspace KPI | `dimension-labels.ts`, worker `marketing-frequency` | `marketing-workspace.test.tsx`, `route.test.ts` | Filtres complets acteur/bibliothèque E2E | `p29-marketing-workspaces.spec.ts` extension |

## Notes

- Aucune ligne ne passe `PENDING:visa-independant` sans JSON d'exécution sous `docs/evidence/`.
- MARKETING-005 : le compteur « 100 % implémenté non certifié » accepte le sandbox ; le live prod reste hors compteur (cf. prompt release).
