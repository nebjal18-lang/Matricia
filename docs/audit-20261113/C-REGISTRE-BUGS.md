# C. Registre des bugs

## Tableau récapitulatif

| ID | Titre | Gravité | Priorité | Statut |
|---|---|---|---|---|
| BUG-001 | Menu compte fermé laisse « Se déconnecter » cliquable (session perdue au sélecteur d’org) | MAJEURE | P1 | Confirmé ; correctif CSS local appliqué sur demande |
| BUG-002 | Overlay Turbopack Module/Export `@matricia/signature-v41` casse l’UI connectée | CRITIQUE | P0 | Confirmé |
| BUG-003 | `POST /api/internal/outbox` répond 500 au lieu de 401 (échec chargement module) | CRITIQUE | P0 | Confirmé (lié BUG-002) |
| BUG-004 | Titre document `Matricia \| Matricia` | MINEURE | P3 | Confirmé |
| BUG-005 | Après déconnexion pendant erreur module : page « This page couldn’t load » | MAJEURE | P1 | Confirmé (déclenché par BUG-002) |
| BUG-006 | Lien workspace `@matricia/signature-v41` absent de `node_modules` avant `pnpm install` | MODÉRÉE | P1 | Confirmé (env) |
| BUG-007 | Exports `index.ts` signature avec suffixes `.js` → « module has no exports » sous Turbopack | CRITIQUE | P0 | Confirmé (code) ; lié merge signature |
| BUG-008 | Avertissement image `/scenes/arch-city.png` width/height | MINEURE | P3 | Confirmé (console) |
| BUG-009 | Hydratation / `crypto.randomUUID` sur pages qualification (forms) | MODÉRÉE | P2 | Risque / observé via overlay hydratation antérieur |
| BUG-010 | Double export `YousignSandboxSignatureProvider` (sandbox + provider) | MODÉRÉE | P2 | Confirmé lecture code |
| BUG-011 | Démo activable sur Vercel prod/preview via flag seul (`demo-policy`) | MAJEURE | P1 | Confirmé code — voir `L-SECURITE-CODE.md` |
| BUG-012 | `connectDemoPersona` → magic link service role derrière la même garde | MAJEURE | P1 | Confirmé code |
| BUG-013 | `/api/readiness` public + client admin (RPC ops) | MODÉRÉE | P2 | Confirmé code |
| BUG-014 | Perte de précision bigint source financière (`Number`) | MODÉRÉE | P2 | Confirmé Codex (schéma) ; non rejoué ici — voir M |
| BUG-015 | Harnais comparaison financière (mock auth / contamination) | MODÉRÉE | P2 | Confirmé Codex (tests) — voir M |
| BUG-016 | Contact : `aria-label` ≠ texte visible (WCAG 2.5.3) | MODÉRÉE | P2 | Confirmé Codex ; code local `contact-form.tsx:207` cohérent |

Détail sécurité : [L-SECURITE-CODE.md](./L-SECURITE-CODE.md). Croisement Codex : [M-RECONCILIATION-CODEX.md](./M-RECONCILIATION-CODEX.md).

---

## BUG-001

1. **Titre** : Menu compte fermé expose « Se déconnecter », provoquant une déconnexion lors du choix d’organisation  
2. **Catégorie** : UX / Session / CSS  
3. **Statut** : BUG CONFIRMÉ  
4. **Gravité** : MAJEURE  
5. **Priorité** : P1  
6. **Environnement** : local `:5173`, `version-2`  
7. **Date** : 2026-11-13  
8. **Rôle** : Sous-traitant démo  
9. **Préconditions** : Login démo provider, multi-organisations, message « Choisissez une organisation »  
10. **Données** : org `1d49fa48-e035-47ae-ab81-16c6c798fe29`  
11. **Étapes** : (1) Login Sous-traitant (2) Ouvrir qualification sans org (3) Choisir org + Afficher — avant fix, CDP montrait `details.client-account` fermé avec `panelDisplay:grid` et bouton logout cliquable  
12. **Attendu** : Panneau compte masqué si fermé ; Afficher conserve la session  
13. **Fondement** : Spec HTML `<details>` + comportement attendu du sélecteur d’org  
14. **Observé** : Redirect `/fr/connexion?next=…organizationId=…` (middleware unauthenticated)  
15. **Fréquence** : Systématique tant que CSS fautif  
16. **Impact** : Impossible de sélectionner une org sans se « déconnecter »  
17. **Preuves** : CDP computed style ; URL connexion ; correctif `apps/web/modules/client/ui/client-experience.css`  
18. **Cause** : `.client-account > div { display: grid }` écrase le masquage UA de `<details>` fermé  
19. **Correction** : n’appliquer `display:grid` que sur `.client-account[open] > div` (**fait localement**)  
20. **Validation** : menu fermé → `display:none`, Afficher → URL avec org, session OK  
21. **Régression** : ouverture intentionnelle du menu doit toujours montrer logout  

## BUG-002 / BUG-003 / BUG-007

1. **Titre** : Chaîne signature-v41 cassée sous Turbopack (exports / résolution) → outbox 500 + overlay UI  
2. **Catégorie** : Technique / Intégration / Disponibilité  
3. **Statut** : BUG CONFIRMÉ  
4–5. **CRITIQUE / P0**  
6–8. local, provider/anonymous, 2026-11-13  
11. **Étapes** : (1) Charger espace connecté (2) Observer overlay Next « Module not found / Export doesn’t exist » (3) `POST /api/internal/outbox` `{}` → 500  
12. **Attendu** : module résolu ; outbox 401 sans Bearer secret  
14. **Observé** : 500 vide ; logs `Can't resolve` puis `module has no exports` / `YousignSignatureProvider` manquant  
16. **Impact** : UI inutilisable, worker outbox local non testable, signatures/outbox hors service  
17. **Preuves** : `terminals/*` logs ; HTTP POST ; `packages/signature-v41/src/index.ts` ; import `yousign.ts:4`  
18. **Cause** : combinaison link pnpm manquant + `export * from "./….js"` non résolu / conflit dual sandbox providers — **hypothèse forte** sur les suffixes `.js` dans `index.ts` après merge  
19. **Correction recommandée** : aligner exports Turbopack (sans `.js` ou avec types package corrects), unique surface YouSign, `pnpm install`, redémarrer Next, tests outbox  
20. **Validation** : import Node/Turbopack OK ; POST sans secret → 401 `{code:UNAUTHORIZED}`  
21. **Régression** : workflows signature unitaires + route outbox  

## BUG-004

Titre document dupliqué `Matricia | Matricia` sur pages prestataire. **MINEURE/P3**. Observé via `document.title` / a11y name. Correction : metadata Next par espace.

## BUG-005

Déconnexion pendant BUG-002 → « This page couldn’t load ». **MAJEURE/P1**. Preuve snapshot post-logout. Se résout probablement avec BUG-002.

## BUG-006

`apps/web/node_modules/@matricia` sans `signature-v41` avant install. **MODÉRÉE** env. `pnpm why` après install montre le link.

## BUG-008 / BUG-009 / BUG-010

Voir tableau ; preuves console Next et lecture `yousign-provider.ts` / `yousign-sandbox-provider.ts`.
