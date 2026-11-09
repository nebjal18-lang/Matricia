# MAT-FUNC P1 — targeted E2E implementation pass

Date: 2026-11-09  
Statut exécution: **PENDING** (preuves locales/CI à capturer après run vert)

## Périmètre

Spécifications Playwright dédiées aux écarts E2E P1 de la chaîne commerciale (PROMPT_100_IMPLEMENTATION_NON_CERTIFIEE.md) :

| ID | Fichier | Ce que la spec prouve |
|---|---|---|
| MAT-FUNC-014 | `tests/e2e/mat-func-014-provider-quote-mandatory-fields.spec.ts` | Matrice négative FR/AR : score de complétude &lt; 100 % et bouton « Créer la nouvelle version » désactivé lorsqu’un champ obligatoire du devis est omis (fixture P23). |
| MAT-FUNC-022 | `tests/e2e/mat-func-022-mission-milestones.spec.ts` | Prestataire soumet un jalon ; Client accepte ; isolation tenant étranger (fixture P25). Parcours AR : contrôles de décision de jalon. |
| MAT-FUNC-024 | `tests/e2e/mat-func-024-mission-checklist-snapshot.spec.ts` | UI prestataire affiche la ligne « Modèle publié {version} · {hash} » (snapshot figé). Test optionnel `E2E_MAT_FUNC_024_SNAPSHOT` : mission historique inchangée après bump de template publié. |
| MAT-FUNC-025 | `tests/e2e/mat-func-025-delivery-acceptance-criteria.spec.ts` | Décision livrable critère par critère (conforme / non conforme + commentaire) ; scan worker si PENDING ; AR : formulaire multi-critères visible. |
| MAT-FUNC-026 | `tests/e2e/mat-func-026-contract-amendment-activation.spec.ts` | Client rédige un avenant sur contrat ACTIVE ; rechargement + envoi à la signature lorsque l’UI l’autorise ; section avenants AR sur `/client/contrats`. |
| MAT-FUNC-028 | `tests/e2e/mat-func-028-document-reuse-cross-context.spec.ts` | Liaison document vérifié → autre contexte autorisé (coffre Client) ; Client B ne voit pas l’organisation A (manifest P05 / states). |

## Helper partagé

- `tests/e2e/helpers/mat-func-session.ts` — contexte authentifié FR/AR, viewport 360 / desktop, aligné sur `p25-client-provider-completion.spec.ts`.

## Variables d’environnement attendues

| Spec | Variables |
|---|---|
| 014 | `E2E_PROVIDER_STORAGE_STATE`, `E2E_P23_TARGET_ORGANIZATION_ID`, `E2E_P23_DECOY_ORGANIZATION_ID`, `E2E_P23_CASES` (harness `tests/e2e/helpers/p23-provider-quotes-run.mjs`) |
| 022 | `E2E_PROVIDER_STORAGE_STATE`, `E2E_CLIENT_STORAGE_STATE`, `E2E_CLIENT_B_STORAGE_STATE`, `E2E_P25_WORKFLOWS` |
| 024 | `E2E_PROVIDER_STORAGE_STATE` ; optionnel `E2E_MAT_FUNC_024_SNAPSHOT` (JSON mission + version/hash figés) |
| 025 | `E2E_CLIENT_STORAGE_STATE`, `E2E_PROVIDER_STORAGE_STATE`, `E2E_CRON_SECRET` |
| 026 | `E2E_CLIENT_STORAGE_STATE` (contrat ACTIVE avec formulaire avenant) |
| 028 | `E2E_CLIENT_STORAGE_STATE`, `E2E_CLIENT_B_STORAGE_STATE` ; recommandé `E2E_P05_MANIFEST` |

## Commande de recette (à exécuter avant visa)

```bash
pnpm.cmd exec playwright test tests/e2e/mat-func-014-provider-quote-mandatory-fields.spec.ts
pnpm.cmd exec playwright test tests/e2e/mat-func-022-mission-milestones.spec.ts
pnpm.cmd exec playwright test tests/e2e/mat-func-024-mission-checklist-snapshot.spec.ts
pnpm.cmd exec playwright test tests/e2e/mat-func-025-delivery-acceptance-criteria.spec.ts
pnpm.cmd exec playwright test tests/e2e/mat-func-026-contract-amendment-activation.spec.ts
pnpm.cmd exec playwright test tests/e2e/mat-func-028-document-reuse-cross-context.spec.ts
```

Résultat attendu : **0 failed**, skips uniquement si fixture volontairement absente en dev nu.

## Blockers connus

1. **P25** ne seed pas `mission_checklist_snapshots` ni plusieurs critères d’acceptation — MAT-FUNC-024 (test bump template) et MAT-FUNC-025 (multi-critères strict) dépendent d’une extension fixture ou de `E2E_MAT_FUNC_024_SNAPSHOT`.
2. **MAT-FUNC-028** : liaison cross-context nécessite au moins un document `VERIFIED` + `CLEAN` et une cible dans `loadClientDocumentVault` (seed P05 ou dossier démo).
3. **MAT-FUNC-026** : envoi signature conditionné à `signatureReadiness` ; l’E2E valide le brouillon et l’état UI disponible, pas la signature réelle.

## Evidence exécution

- Chemin : `docs/evidence/atomic/mat-func-p1-implementation-pass.md` (ce fichier)
- JSON / log CI : **à ajouter** après premier run vert (`artifacts/test-results/playwright-report` + extrait `line` reporter)
