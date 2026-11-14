# N. Corrections appliquées (Cursor + Codex)

Date : 2026-11-13 · branche locale `version-2` · **non commité** tant que non demandé.

## Bugs audit (passe 1)

| Bug | Correction | Preuve |
|---|---|---|
| Codex 001 / Cursor 007-010 | Export unique sandbox ; scaffold renommé ; index sans `.js` | `tsc` signature OK ; 63/63 package |
| Codex 002 / Cursor 002-003 | Package signature → routes compilables | YouSign GET **405** ; outbox **401** ; `/fr` **200** |
| Cursor 001 | CSS `.client-account[open] > div` | Working tree |
| Cursor 011-012 | `demo-policy` refuse prod APP_ENV/VERCEL | Tests verts |
| Cursor 013 | `/api/readiness` corps public minimal | Tests verts |
| Codex 003 | Core-pot bigint en string | repository.test |
| Codex 004 | Mock `getServerAuthUser` | exact-comparison 4/4 |
| Codex 005 | Contact a11y + E2E | contact-form + specs |
| Cursor 004 titre | Root `title.absolute` | layout + smoke client |
| Paiement DEMO | Refuse `VERCEL_ENV=production` | gateway-factory |

## Suite web + franchise (passe 2 — « corrige tous »)

| Défaut | Correction | Preuve |
|---|---|---|
| 11 tests web en échec | Alignement copy/nav + wrappers franchise | **4019 passed / 0 failed** (`vitest` `@matricia/web`) |
| `reseau`/`fournisseurs` Suspense | Pages async appellent `FranchiseNetworkPage(...)` | access-readiness verts |
| Tests cockpit / nested / home / dashboard | Attentes alignées produit actuel | fichiers ciblés verts |
| Image shells | `style width/height auto` | shells client/provider |

## Smoke runtime après corrections

- Connexion démo **Client** → `/fr/tableau-de-bord` (nav « Bilans », titre métier OK)

## Toujours hors correctif code (environnement / process)

Ces points **ne sont pas des bugs de code restants** des audits ; ils exigent infra, accès ou visas :

| Élément | Pourquoi non « corrigé » ici |
|---|---|
| Gate release / 71 visas | Processus qualité — pas un patch applicatif |
| SQL/RLS A/B live + migrations complètes | Nécessite base de test à jour + campagne dédiée |
| Parcours RFQ→mission→clôture multi-rôles E2E | Recette métier longue ; smoke démo Client OK, pas le cycle complet |
| PSP / YouSign live / e-mails réels | Sandbox externes + secrets + autorisation |

## Conclusion honnête

**Tous les défauts code des audits Cursor+Codex listés et les 11 échecs unitaires web sont corrigés en local.**  
**La validation métier / release complète n’est pas « verte »** tant que la base, les E2E authentifiés multi-rôles et les visas ne sont pas rejoués.
