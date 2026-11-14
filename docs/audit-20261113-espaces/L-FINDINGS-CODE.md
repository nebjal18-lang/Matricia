# L. Findings code (lecture seule) — Client / ST / Franchise / Admin

Sources : [Scan bugs Client/ST code](cdebb658-4e14-40db-abf9-49bd93ffcc4b), [Scan bugs Franchise/Admin code](ad6a9e66-3392-49ac-a010-d815334f421f).  
Complète le registre runtime `C-REGISTRE-BUGS.md` (ESP-*). Distinguer BUG CONFIRMÉ (code) / RISQUE.

## Client & Sous-traitant

| ID | Espace | Gravité | Type | Résumé |
|---|---|---|---|---|
| AUD-01 | Client | Haute | BUG CONFIRMÉ | `.client-org-switch ul { display:grid }` sans garde `[open]` — même classe de défaut que le menu compte (CSS) |
| AUD-02 | Client | Moyenne | BUG CONFIRMÉ | `client-app-shell` : `<details className="client-org-switch">` exposé au bug AUD-01 |
| AUD-03/04 | Client | Moyenne | BUG CONFIRMÉ | `value-panel` : liens parrainage / économies sans état vide |
| AUD-05 | Client | Moyenne | BUG CONFIRMÉ | `subscription-board` : opérations crédits vides → `null` (pas de message) |
| AUD-06 | Client | Faible | BUG CONFIRMÉ | `portfolio-panel` : affectations liées vides sans texte |
| AUD-07 | Client | Haute | BUG CONFIRMÉ | `payment-intent-button` : `catch` → état « review » (masque l’erreur) |
| AUD-08 | Client | Moyenne | RISQUE | assistance humaine : tout `catch` → UNAVAILABLE |
| AUD-09/10 | Sous-traitant | Haute/Moyenne | BUG CONFIRMÉ | Éditeur devis : `ProviderAppShell` sans `organizations` → pas de sélecteur multi-org |
| AUD-11 | Sous-traitant | Moyenne | RISQUE | GET devis/nouveau : `organizationId` hidden peut être `""` |
| AUD-12 | Sous-traitant | Moyenne | RISQUE | Formulaires finance sans `organizationId` explicite (RLS seul) |
| AUD-13 | Sous-traitant | Faible | RISQUE | `recipient-review` : `catch → null` |
| AUD-14 | Sous-traitant | Faible | RISQUE | `settings-board` : `crypto.randomUUID()` à chaque rendu (idempotence) |

## Franchise & Administration

| ID | Espace | Gravité | Type | Résumé |
|---|---|---|---|---|
| FRA-01–03 | Franchise | Moyenne | BUG CONFIRMÉ | Pages document / contrat / invitation hors `FranchiseAppShell` |
| FRA-04 | Franchise | Moyenne | BUG CONFIRMÉ | `NO_MANDATE` sur nouveau service/questionnaire/règle = Alert seule, sans CTA candidature/contact |
| FRA-05 | Franchise | Moyenne | BUG CONFIRMÉ | `NO_MANDATE` → `FORBIDDEN` dans commandes éditoriales (message « non autorisé ») — **cohérent avec ESP-001 runtime** |
| FRA-06 | Franchise | Moyenne | BUG CONFIRMÉ | `useSearchParams` client sans `Suspense` |
| FRA-07 | Franchise | Faible | BUG CONFIRMÉ | Marketing : `NO_ORGANIZATION` affiché comme `NO_MANDATE` |
| FRA-08 | Franchise | Faible | RISQUE | Layout franchise = `children` seuls (pas de filet shell) |
| ADM-01 | Admin | Haute | BUG CONFIRMÉ | Export clients : pas de garde `FORBIDDEN` / `MFA_REQUIRED` |
| ADM-02 | Admin | Moyenne | BUG CONFIRMÉ | Export entreprises : pas de `requirementSatisfied` / AAL2 |
| ADM-03 | Admin | Moyenne | BUG CONFIRMÉ | Bouton Exporter utilisateurs visible même si annuaire en erreur |
| ADM-04–06 | Admin | Moyenne | RISQUE / UX | `42501` → `FORBIDDEN` sans distinguer MFA AAL2 |
| ADM-07–08 | Admin | Faible | BUG CONFIRMÉ | `preparation` refus + `loading` hors `AdminAppShell` |

## Croisement runtime ↔ code

| Runtime | Code | Lecture |
|---|---|---|
| ESP-001 Franchise « Accès non autorisé » | FRA-05 (`NO_MANDATE`→`FORBIDDEN`) | Cause UX/mapping plausible ; seed mandat à confirmer |
| ESP-003 Client Indisponible / rôle | (projection / droits) | Pas entièrement expliqué par AUD-* ; garder ESP-003 |
| ESP-005 Facturation ST | AUD-12 / droits RPC | Complémentaire |
| Menu compte déjà patché | AUD-01/02 org-switch | **Même famille CSS encore ouverte** sur le sélecteur d’org |
