# C. Registre des bugs — audit espaces (strict)

Environnement : local `127.0.0.1:5173` · `version-2` @ `676883e` · 2026-11-13

| ID | Titre | Espace | Gravité | Priorité | Statut |
|---|---|---|---|---|---|
| ESP-001 | Persona Franchisé démo : accès non autorisé à tout l’espace | Franchise | CRITIQUE | P0 | CORRIGÉ code+seed — rejouer `provision-demo-franchise-persona.mjs` |
| ESP-002 | Métadonnées titre : toutes les pages affichent seulement « Matricia » | Tous | MAJEURE | P1 | CORRIGÉ |
| ESP-003 | Client : widgets dashboard Indisponible + alerte rôle | Client | MAJEURE | P1 | CORRIGÉ (rôles RPC + fallback legacy) |
| ESP-004 | Erreur d’hydratation ClientAppShell | Client (+shells partagés) | MAJEURE | P1 | CORRIGÉ (Image sans style auto) |
| ESP-005 | Facturation prestataire : rôle interdit pour demo.prestataire | Sous-traitant | MAJEURE | P1 | CORRIGÉ (rôles lecture billing) |
| ESP-006 | Bouton « Calculer la santé globale » sans feedback observable | Client | MODÉRÉE | P2 | CORRIGÉ (disclosure piloté + CTA `#analyse`) |
| ESP-007 | Checkbox « Inclure les archives » readonly / filtre Abonnement dégradé | Admin | MODÉRÉE | P2 | CORRIGÉ (plans réels, plus de UNKNOWN inventé) |
| ESP-008 | Page Admin demandes : DOM a11y extrêmement dense | Admin | MODÉRÉE | P2 | CORRIGÉ (menus fermés hors a11y, cap 25, colonnes) |
| ESP-009 | H1 Client « Bonjour , … » (espace avant virgule) | Client | MINEURE | P3 | CORRIGÉ |
| ESP-010 | Bouton assistance franchise : rendu texte chevauché (capture) | Franchise | MINEURE | P3 | CORRIGÉ (CTA workspace-failure) |
| ESP-011 | Contenu dashboard prestataire dupliqué dans l’arbre a11y | Sous-traitant | MODÉRÉE | P2 | CORRIGÉ (CTA unique + parcours) |
| ESP-012 | Sélecteur d’org Client : CSS `details` ouvert alors que fermé (AUD-01/02) | Client | MAJEURE | P1 | CORRIGÉ |
| ESP-013 | Paiement abonnement : erreur réseau affichée comme « review » (AUD-07) | Client | MAJEURE | P1 | CORRIGÉ |
| ESP-014 | Devis ST : shell sans `organizations` (AUD-09/10) | Sous-traitant | MAJEURE | P1 | CORRIGÉ |
| ESP-015 | Export admin clients sans garde FORBIDDEN/MFA (ADM-01) | Admin | MAJEURE | P1 | CORRIGÉ |
| ESP-016 | NO_MANDATE mappé FORBIDDEN (FRA-05) | Franchise | MODÉRÉE | P1 | CORRIGÉ |

Détail code élargi : [L-FINDINGS-CODE.md](./L-FINDINGS-CODE.md).

---

## ESP-001 — Franchise démo inaccessible

1. **Titre** : Compte franchisé démo sans habilitation sur l’espace Franchise  
2. **Catégorie** : Permissions / données démo / produit  
3. **BUG CONFIRMÉ**  
4–5. **CRITIQUE / P0**  
8. Rôle `demo.franchise@matricia.test` · org `4b84270e-…`  
11. Login Franchisé → `/fr/franchise/accueil` → message « Accès non autorisé… » ; même résultat sur bibliothèque, services, demandes, finance, etc.  
12. Attendu : mandat démo utilisable OU message NO_MANDATE avec parcours candidature clair  
14. Observé : interdit générique ; candidature accessible mais reste `forbid`  
16. Impact : espace Franchise non testable / inutilisable en démo  
17. Preuves : `preuves/FRANCHISE-accueil-interdit.png` ; probes fetch  
19. Correction : seed mandat bibliothèque pour persona ; ou UX NO_MANDATE + CTA candidature exclusif  

## ESP-002 — Titres plats « Matricia »

Cause probable : `apps/web/app/layout.tsx` `title: { absolute: "Matricia" }` écrase les titres enfants.  
Observé sur Client, ST, Franchise, Admin (`document.title === "Matricia"`).  
**MAJEURE** accessibilité / UX onglets.  
Correction : retirer `absolute` du root ; garder template uniquement sur `[locale]/layout`.

## ESP-003 — Client Indisponible / rôle

**CORRIGÉ** : `get_client_home_snapshot_v1` accepte tous les rôles client ; le repository retombe sur les lecteurs legacy si le RPC renvoie FORBIDDEN.

## ESP-004 — Hydratation

**CORRIGÉ** : retrait du `style={{ width/height: auto }}` sur `Image` (shells client/prestataire + dashboard) — conflit avec les props width/height Next.

## ESP-005 — Facturation ST

`/fr/sous-traitant/facturation?organizationId=…` contient alerte rôle interdit pour `demo.prestataire`.  
**MAJEURE** pour parcours facturation démo. *(déjà corrigé en vague précédente)*

## ESP-006 — Santé globale

**CORRIGÉ** : `CompleteForm` pilote `<details>` via `open` + `onToggle` (le `open={initialOpen}` figé empêchait le clic) ; CTA DiagnosticsBoard → `#analyse`.

## ESP-007 — Archives / abonnement

**CORRIGÉ** : plus de `planCode: "UNKNOWN"` inventé ; enrichissement via `subscriptions` ; filtre Abonnement n’affiche que les codes réels.

## ESP-008 — Admin demandes dense

**CORRIGÉ** : menus ligne `display:none` quand fermés ; cap 25 lignes ; colonnes allégées ; intents sensibles hors liste demandes.

## ESP-010 / ESP-011

**CORRIGÉ** : CTAs `workspace-failure` sans underline chevauchant ; dashboard ST sans double CTA profil + parcours structuré.
