# E. Rapport technique

## Architecture observée

- Next.js App Router (`apps/web`), proxy session `modules/shared/lib/supabase/proxy.ts`
- Espaces : `client`, `sous-traitant`, `franchise`, `administration`
- Auth : GoTrue + MFA AAL2 (démo via `elevateDemoSession`)
- Outbox : `POST /api/internal/outbox` protégé par `INTERNAL_WEBHOOK_SECRET` (Bearer, timing-safe, ≥32 octets)

## Permissions / auth (exécuté)

| Contrôle | Résultat |
|---|---|
| Préfixes protégés sans cookie → 307 connexion | RÉUSSI |
| `isPublicDemoAccessEnabled` : preview/prod exigent flag explicite | Lu code — OK en intention |
| Outbox sans secret → devrait 401 | ÉCHOUÉ (500 module) |
| Multi-org provider sans `organizationId` → `ProviderReadState` choose-org | RÉUSSI |

## Sécurité (OWASP ASVS / Top 10 comme guides — contrôles ciblés)

| Thème | Résultat | Limite |
|---|---|---|
| Accès objet anonyme UI | Routes protégées redirigées | Pas de fuzz IDOR API authentifié |
| Secret outbox | Présent dans le code | Runtime non testable (500) |
| Exposition secrets dans livrables | Aucun secret publié | `.env.local` non lu en clair dans le rapport |
| Demo access | Gate env | Non testé sur Vercel preview/prod |
| XSS / CSRF | Non testé activement | — |
| Dépendances CVE scan | Non exécuté | — |

## Données

- Listes consultations/devis vides cohérentes avec org démo (pas de fausse donnée inventée).
- Persistance Afficher (après fix CSS) : URL conserve `organizationId`, dossier qualification chargé (identité, checklist) — **observé UI**, pas de relecture SQL.

## Performance / fiabilité

| Mesure | Observation | Conditions |
|---|---|---|
| Accueil HTTP | ~200–400 ms locaux (ordre de grandeur) | local, cache froid variable |
| Tableau de bord | Jusqu’à ~12 s (log Next) | local + auth |
| Outbox | 19–500 ms puis 500 | module fail |
| Fiabilité session | Cassée par menu CSS puis par module signature | — |

**Non évalué** : Lighthouse, réseau 3G, charge.

## Code

- `packages/signature-v41/src/index.ts` réexporte via `./….js` ; Turbopack rapporte **aucune export**.
- Collision possible `YousignSandboxSignatureProvider` dans deux fichiers.
- Workspace link parfois absent → `pnpm install` nécessaire.
- Proxy session : distinction UNAVAILABLE (503 rewrite) vs unauthenticated (307) — conception saine.

## Cartographie routes (extrait importance 1)

Voir aussi agent cartographie. Exemples :

| Module | Route | Rôle | Imp. |
|---|---|---|---|
| Public | `/[locale]` | Visiteur | 1 |
| Auth | `/[locale]/connexion` | Tous | 1 |
| Provider | `/[locale]/sous-traitant/*` | Sous-traitant | 1 |
| Client | `/[locale]/client/*` | Client | 1 |
| Franchise | `/[locale]/franchise/*` | Franchisé | 1 |
| Admin | `/[locale]/administration/*` | Admin | 1 |
| API | `/api/internal/outbox` | Worker | 1 |
