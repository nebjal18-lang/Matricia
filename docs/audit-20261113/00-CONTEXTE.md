# Contexte de l’audit

| Champ | Valeur |
|---|---|
| Application | Matricia |
| Objectif | Marketplace B2B Maroc : diagnostic → demande → matching → devis → contrat → mission → clôture (Client / Sous-traitant / Franchisé / Admin) |
| Type | Application web (Next.js App Router) + API internes + PostgreSQL/Supabase |
| URL auditée | `http://localhost:5173` / `http://127.0.0.1:5173` |
| Environnement | **LOCAL / development** (`APP_ENV=development`), Supabase projet distant de développement |
| Branche / SHA | `version-2` @ `676883e` (+ correctif CSS local menu compte non poussé au moment de certains tests) |
| Dépôt | `https://github.com/nebjal18-lang/Matricia.git` |
| Date | 2026-11-13 |
| Mode | **AUDIT UNIQUEMENT** (aucune correction produit pendant cette passe, hors correctif CSS déjà appliqué précédemment sur demande explicite) |
| Langues | FR / AR (RTL) |
| Accès | Boutons « Connexion automatique » démo (Client, Sous-traitant, Franchisé, Admin) ; comptes `MATRICIA_PARCOURS_*` présents en local (non publiés) |

## Skills / outils

| Élément | Statut |
|---|---|
| `matricia-testing-security-release` | Disponible, lu, utilisé (cadre d’audit) |
| Browser MCP (`cursor-ide-browser`) | Disponible, exécuté |
| Explore agents (cartographie / sécurité code) | Lancés en parallèle |
| Playwright projet | Disponible dans le repo ; non exécuté comme suite complète (runtime local dégradé) |
| `web-design-guidelines` | Disponible ; revue ciblée via observation navigateur |
| Accès base SQL interactive | Non utilisé (pas de session psql auditée ici) |
| Lecteur d’écran | **Non disponible** — non prétendu |

## Hypothèses

1. Le code local `version-2` correspond à l’instance servie sur `:5173`.
2. Les personas démo `demo.*@matricia.test` sont des comptes de développement autorisés.
3. Aucune opération de paiement réel ni message externe n’a été tentée.
