# A. Synthèse décisionnelle

## Périmètre réellement testé

- Pages publiques FR/AR (HTTP 200) : accueil, franchise publique, abonnements, besoin, connexion.
- Redirections auth anonymes (HTTP 307 → `/connexion`) : sous-traitant, client, administration.
- Session démo **Sous-traitant** : qualification (multi-org), consultations, devis, tableau de bord.
- Sélecteur d’organisation (Afficher) : perte de session reproduite puis cause CSS confirmée.
- API `POST /api/internal/outbox` sans secret.
- Observation runtime Turbopack : résolution `@matricia/signature-v41`.
- Lecture code : proxy session, demo-policy, outbox auth, shells.

## Non couvert / bloqué

- Parcours métier complet multi-rôles (création demande → affectation → clôture) : **NON EXÉCUTÉ** (runtime dégradé + temps).
- Admin AAL2 réel hors persona démo : **NON EXÉCUTÉ**.
- Franchisé / Client démo bout-en-bout : **BLOQUÉ** en fin de session par overlay Module not found / page crash.
- Paiements, YouSign live, emails : **NON APPLICABLE** (pas d’activation externe).
- Tests SQL/RLS live : **NON EXÉCUTÉ** dans cette passe.
- Lecteur d’écran : **NON EXÉCUTÉ**.

## Principaux blocages confirmés

1. **BUG-003 (CRITIQUE / P0 local)** — `@matricia/signature-v41` non résolu / exports vides sous Turbopack → `POST /api/internal/outbox` 500 ; overlay d’erreur Next.js empêche l’UI.
2. **BUG-001 (MAJEURE / P1)** — Menu compte fermé restait cliquable (« Se déconnecter ») → session « perdue » au moment de choisir une organisation (cause CSS confirmée ; correctif local déjà appliqué sur demande antérieure).
3. **BUG-004 (MODÉRÉE)** — Titre document `Matricia | Matricia` sur espaces connectés.
4. **BUG-005 (MODÉRÉE)** — Overlay erreur dev + page « This page couldn’t load » après déconnexion pendant l’erreur module.

## Compteurs (constats documentés)

| Gravité | Nombre |
|---|---|
| CRITIQUE | 1 (+ chaîne signature/outbox) |
| MAJEURE | 4 (session CSS, crash logout, démo Vercel, magic-link démo) |
| MODÉRÉE | 5+ (titre, readiness, workers, paiements DEMO… — voir L) |
| MINEURE | 3+ |

## Avis mise en production

**Mise en production déconseillée** sur la base de cet audit local :

- Runtime local cassé par la chaîne signature/outbox (blocage technique confirmé).
- Parcours critiques multi-rôles non validés de bout en bout dans cette passe.
- `PROJECT_STATE` projet indique déjà `RELEASE_GATE = REFUSÉ` / visas indépendants manquants.

## Corrections prioritaires recommandées

1. P0 — Réparer exports/résolution `@matricia/signature-v41` (Turbopack) et vérifier `pnpm` link ; retester outbox → 401 sans secret, 202 avec secret.
2. P1 — Pousser/valider le correctif CSS menu compte (`details[open]`).
3. P1 — Retester personas Client / Franchisé / Admin après P0.
4. P2 — Titre document, hydratation (`crypto.randomUUID` / Suspense), images aspect-ratio.
5. P2 — Campagne E2E Playwright authentifiée existante (`test:e2e:authenticated`) sur environnement stable.
6. P1 — Durcir `demo-policy` / personas (BUG-011/012) ; restreindre `/api/readiness` (BUG-013).
