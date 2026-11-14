# K. Cartographie (code) — version-2

Sources : navs `*-nav.ts`, shells, App Router ; consolidé depuis [Cartographie routes Matricia](0c8380b3-9d0f-49eb-9921-4dd0102bcfe4) et [Cartographier Matricia](0c6260f7-4171-4a69-8d43-d1f7932be13e).

**Importance :** 4 = critique V1 · 3 = cœur métier · 2 = support · 1 = légal / mineur

## Parcours critique V1 (10 étapes)

| # | Étape | Routes types | Rôles |
|---|---|---|---|
| 1 | Découverte | `/{locale}`, `/entreprises`, `/abonnements` | Public |
| 2 | Inscription / connexion / consentements | `/inscription`, `/connexion`, `/connexion/consentements`, `/securite/compte` | Futur utilisateur |
| 3 | Organisation & onboarding | `/organisation`, `/client/onboarding` | Client |
| 4 | Diagnostic / besoin | `/diagnostic`, `/besoin`, `/client/diagnostics/**` | Public → Client |
| 5 | Demande RFQ | `/client/demandes/nouvelle`, `/client/demandes/[requestId]` | Client |
| 6 | Matching / consultations | `/sous-traitant/consultations/**`, `/administration/matching/**` | ST · Admin |
| 7 | Devis & comparaison | ST `/sous-traitant/devis/**` · Client `…/offres`, `…/comparaison` | Client · ST |
| 8 | Contrat & signature | `/client/contrats`, `/signatures/**`, webhooks YouSign | Client · ST |
| 9 | Mission, jalons, preuves | `/client/missions/**`, `/sous-traitant/missions/**`, API preuves | Client · ST |
| 10 | Finances / clôture / litige | `/client/finances`, `/client/abonnement`, API paiements, `/client/litiges/**` | Client |

## Matrice condensée Module × Route × Rôle × Imp.

| Module | Fonction | Route pattern | Rôle | Imp. |
|---|---|---|---|:---:|
| Public | Accueil, entreprises, fournisseur, franchise, services, abonnements | `/{locale}`, `/entreprises`, `/fournisseur`, `/franchise`, `/services/**`, `/abonnements` | Anonyme | 2–3 |
| Public | Diagnostic / besoin | `/diagnostic/**`, `/besoin` | Anonyme | 4 |
| Auth | Connexion, inscription, invitation, MFA, sessions | `/connexion/**`, `/inscription`, `/invitation/[code]`, `/securite/**` | Tous | 4 |
| Transverse | Hub, org, messagerie, signatures | `/tableau-de-bord`, `/organisation/**`, `/messagerie`, `/signatures/**` | Selon contexte | 3–4 |
| Client | Diagnostics → demandes → offres → missions → contrats → finances → litiges → boxes | `/client/**` | Client | 2–4 |
| Sous-traitant | Qualification → consultations → devis → contrats → missions → facturation | `/sous-traitant/**` | Prestataire | 2–4 |
| Franchise | Accueil, biblio, services, règles, réseau, finance, gouvernance | `/franchise/**` | Franchisé | 2–4 |
| Administration | Command center, acteurs, parcours `[space]`, catalogue, finance, anti-abus, ops | `/administration/**` | Admin AAL2 | 2–4 |
| API | Health / readiness | `/api/health`, `/api/readiness` | Ops | 1–2 |
| API | Outbox, workers, paiements, webhooks, signatures, docs | `/api/internal/**`, `/api/workers/**`, `/api/payments/**`, `/api/webhooks/**`, `/api/signatures/**`, `/api/{client,provider}/**` | Auth / secret / HMAC | 3–4 |

## Écarts notés

- Libellés nav Admin (`/administration/demandes`, etc.) → implémentation via `administration/[space]` (`ADMIN_SPACE_IDS`).
- Couverture **navigateur** de cet audit ≠ exhaustivité de cette carte (voir `B-MATRICE-TESTS.md` et `H-LIMITES.md`).
