# A. Synthèse décisionnelle — audit 4 espaces

**Verdict : mise en production / recette démo des 4 espaces déconseillée en l’état.**

| Espace | Couverture exécutée | Verdict partiel |
|---|---|---|
| Client | Dashboard + 15 routes fetch + diagnostics UI | Dégradé (widgets Indisponible / rôle, titres, hydratation) |
| Sous-traitant | Dashboard + 12 routes avec org | Partiel OK ; facturation FORBIDDEN |
| Franchise | Accueil + 10 routes | **Bloqué** — accès non autorisé sur persona démo |
| Admin | Command center + entreprises + demandes | Fonctionnel apparent ; titres plats ; DOM très lourd |

## Compteurs (constats de cette passe)

| Gravité | Nombre |
|---|---|
| CRITIQUE | 1 (Franchise démo inutilisable) |
| MAJEURE | 8 (+ titres, client, ST factu, org-switch CSS, paiement review, devis org, export admin) |
| MODÉRÉE | 8+ (voir C + L) |
| MINEURE | 3+ |

## Blocages majeurs

1. **ESP-001** — Persona `demo.franchise` : « Accès non autorisé » sur l’espace franchisé (y compris avec `organizationId`).
2. **ESP-002** — Titres documents forcés à `Matricia` (régression `title.absolute` root) — perte d’accessibilité onglets.
3. **ESP-003** — Client : alertes rôle / « Indisponible » sur widgets dashboard et plusieurs écrans.
4. **ESP-004** — Hydratation `ClientAppShell` (Issue overlay Next).
5. **ESP-005** — Sous-traitant facturation : message rôle interdit pour le persona démo.

## Non exécuté (strict)

- Cycle RFQ→devis→contrat→mission bout-en-bout
- Écritures métier / uploads
- Isolation cross-tenant A/B authentifiée
- Admin AAL2 révocation / MFA réel hors démo
- Lecteur d’écran
