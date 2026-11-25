# F. Plan de correction

| Ordre | ID | Action | Dépendances | Critère d’acceptation | Non-régression |
|---|---|---|---|---|---|
| 1 | BUG-007/002/003 | Corriger `packages/signature-v41` exports pour Turbopack ; unifier providers YouSign ; `pnpm install` ; redémarrer Next | — | Import `@matricia/signature-v41` OK ; outbox sans secret → **401** `{code:"UNAUTHORIZED"}` ; plus d’overlay module | Tests `signature-v41`, `outbox/route.test.ts` |
| 2 | BUG-001 | Merger/pousser CSS `client-account[open]` | — | CDP : panneau `display:none` si fermé ; Afficher conserve session | Shells client/franchise partageant le CSS |
| 3 | BUG-005 | Retester logout après #1 | #1 | Déconnexion → `/connexion` stable | — |
| 4 | — | Recette personas Client / Franchisé / Admin démo | #1 | Chaque persona atteint son home sans overlay | Smoke `demo-spaces` / e2e authenticated |
| 5 | BUG-004/008/009 | Metadata titles ; images ; éviter `randomUUID` au render serveur affiché | #1 | Titres uniques ; pas d’erreur hydratation sur qualification | Pages shell |
| 6 | — | Parcours E2E multi-rôles RFQ→devis→mission (staging) | #1–4 | Matrice T18 RÉUSSI | Playwright workflows |
| 7 | — | Campagne IDOR/RLS cross-tenant authentifiée | #4 | Refus systématique org B | SQL/RLS + API |
| 8 | BUG-011/012 | Exiger `APP_ENV≠production` **et** flag pour démo ; refuser personas admin hors non-prod explicite | Config Vercel | Flag seul insuffisant sur `VERCEL_ENV=production` | Tests `demo-policy` |
| 9 | BUG-013 | Auth/réseau sur `/api/readiness` ou payload minimal sans service role | — | Pas de détail ops public | health vs readiness |

## Critères de sortie audit de suivi

- BUG-002/003 fermés avec preuve HTTP.
- T07–T17 rejoués verts.
- Au moins un parcours critique multi-rôles RÉUSSI documenté.
