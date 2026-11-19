# Checklist E2E opérateur non-pro — film admin 1→11

Statuts : `TODO` | `PASS` | `FAIL` | `STRUCT_PASS`. Rejouer FR + AR à 360 px.

| ID | Scénario | Pages clés | Statut |
|---|---|---|---|
| S1 | Fondation prête | command-center → préparation → catalogue/publications → territoires | PASS |
| S2 | Invite→ACTIVE sans mensonge CTA | candidatures-franchise → gouvernance → franchises (actifs) | PASS |
| S3 | Pont invitation/dépôt | invitations-reseau → entreprises / clients / providers | PASS |
| S4 | Confirmation → commerce | conformité VERIFIED + qualification → diagnostics autorisé | PASS |
| S5 | Demande→facture | diagnostics → matching → devis → contrats → missions → jalons → facturation | PASS |
| S6 | Bug hunt | jargon absent, prev/next, 0 crash, 0 CTA menteur | PASS |

`STRUCT_PASS` = routes + film hub + bug log VERIFIED (preuve `e2e-film-routes.test.ts` + Vitest alignment).

Navigateur FR/AR 360 authentifié AAL2 : **PASS** via `tests/e2e/helpers/admin-film-s1-s6-run.mjs` (preuve `work/admin-film-s1-s6/<runId>/summary.json`, 9 routes × FR/AR = 20 checks, `mains=1`, 0 crash). Couverture smoke des portes film listées ci-dessus ; nests catalogue/territoires/devis/contrats/missions restent couverts structurellement.

Preuves : captures ou notes dans `ADMIN_BUG_LOG.md` (passer OPEN → VERIFIED).
