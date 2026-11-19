# Audit large 12 familles — 2026-11-14

Périmètre : code Matricia (`apps/web`, packages liés). Objectif : inventaire + corrections HIGH/MED. **Ne certifie pas** `RELEASE_GATE` (visas / YouSign / paiements distants restent REFUSÉ).

## Synthèse

| Famille | Findings | Statut |
|---------|----------|--------|
| 1 Fonctionnel | Idempotence keys au render | Corrigé (`StableIdempotencyField`) |
| 2 Données/état | Query org sessions | Corrigé |
| 3 UI/UX | Hash CTAs, `#plans`, UUID labels | Corrigé |
| 4 Navigation | Sessions sans query ; HashAware tabs | Corrigé |
| 5 Auth/sécu | MFA admin providers + membership | Corrigé |
| 6 i18n/a11y | CTA < 44px ; `lang`/`dir` first paint | Corrigé (bootstrap + DocumentLocaleSync) |
| 7 Finance | `p_tax_minor:"0"` advisory | Non-bloquant (RPC canonique) |
| 8 Intégrations | catch silents UX | Corrigé côté inventaire privacy ; API catches restent des erreurs structurées |
| 9 Perf | N+1 candidatures / missions | Corrigé (lots de 8) |
| 10 Contenu | Erreurs techniques privacy inventory | Corrigé (`readableError` + labels) |
| 11 Qualité | Démo si `APP_ENV` absent | Corrigé |
| 12 Observabilité | Correlation RPCs finance admin | Corrigé |

## MED corrigés (vague 3)

1. Bootstrap `lang`/`dir` avant paint (`DOCUMENT_LOCALE_BOOTSTRAP`) sans dynamiser le root layout
2. HashAwareLink onglets / ancres client (organisation, abonnement, récompenses, litiges, jalons, boards)
3. Messages humains privacy inventory (erreurs + outcomes + sources)
4. Soft E2E / MFA / membership / N+1 / correlation (vagues 1–2)

## Hors code — toujours ouvert

- `RELEASE_GATE` REFUSÉ (~5/76 VERIFIED)
- Visas indépendants, YouSign live, paiements distants, E2E métier avec fixtures seed

## Preuve tests

Vague 3 : bootstrap locale + tests spaces / providers ciblés. RELEASE_GATE inchangé (REFUSÉ).
