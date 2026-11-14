# M. Réconciliation audit Cursor ↔ audit Codex

| | Cursor (cette session) | Codex (rapport fourni) |
|---|---|---|
| Date | 2026-11-13 | 2026-11-13 |
| Commit | `676883e` (`version-2`) | `7eb72239` (branche `work`, **absent de ce dépôt**) |
| Runtime | Windows, `:5173`, Node 24 | Linux, Node 24.19, pnpm 10.17 / 11.25 |
| Mode | AUDIT UNIQUEMENT (+ CSS menu compte corrigé sur demande antérieure) | AUDIT UNIQUEMENT |
| Verdict | Mise en production **déconseillée** | Mise en production **déconseillée** |

Les deux audits convergent sur le **bloqueur signature-v41** et sur l’impossibilité de visa release. Ils ne portent **pas** sur le même SHA : les écarts de bugs UI/session sont attendus.

---

## 1. Convergence forte (même famille de défaut)

| Thème | Codex | Cursor | Lecture croisée |
|---|---|---|---|
| Export Yousign ambigu / package cassé | BUG-001 TS2308 `YousignSandboxSignatureProvider` doublé (`yousign-sandbox-provider` + `yousign-provider`) | BUG-002/007 : module sans exports / résolution `.js` + dual class | **Même cause racine** : double définition + surface d’export incohérente. Codex mesure **tsc** ; Cursor mesure **Turbopack runtime**. |
| Runtime signature → 500 + overlay global | BUG-002 webhook YouSign `./mock-provider.js` introuvable → pages 500 | BUG-002/003 outbox + overlay `signature-v41` | **Même chaîne** : charger un module qui importe le package casse le serveur de dev. |
| Demo Vercel | RISQUE conditionnel (flag prod) | BUG-011/012 confirmés code | Alignés : **pas d’exploit déployé démontré** ; risque config. |
| Parcours critiques connectés | BLOQUÉS (base locale ancienne) | Partiellement provider démo puis **bloqués** par signature | Les deux : **pas de visa multi-rôles**. |
| Verdict release | Déconseillé | Déconseillé | Identique |

---

## 2. Compléments Codex (absents ou peu couverts chez Cursor)

| Codex | À retenir pour Matricia | Statut dans dossier Cursor |
|---|---|---|
| BUG-003 précision `bigint` → `Number` (core-pot) | Contrat données finance ; impact serveur non démontré | À intégrer comme **BUG-014** (MODÉRÉE/P2) |
| BUG-004 harnais `exact-comparison-transport` (mock auth) | Qualité tests, pas bug utilisateur | **BUG-015** harnais |
| BUG-005 Contact `aria-label` ≠ texte visible (WCAG 2.5.3) | a11y publique FR/AR | **BUG-016** — à revalider sur `676883e` |
| 4369 unit / 17 fail ; 18/18 E2E public ; axe 0 auto | Couverture outillage beaucoup plus large | Cursor : non rejoué intégralement |
| 32 pages publiques × responsive / JOURNEY diagnostic→besoin | Preuves parcours public riches | Cursor : probes HTTP + snapshots partiels |
| Readiness 503 OUTBOX_BACKLOG (DB locale Codex) | Précondition recette | Cursor : readiness non mesuré de la même façon (outbox 500 module) |
| Gate release refusée / visas manquants | Cohérent `PROJECT_STATE` | Déjà cité |

---

## 3. Compléments Cursor (absents ou peu couverts chez Codex)

| Cursor | Pourquoi Codex peut ne pas l’avoir |
|---|---|
| BUG-001 menu compte CSS → « session perdue » au sélecteur d’org | Codex n’a **pas** validé les espaces connectés (base ancienne) |
| Login démo sous-traitant + Afficher org | Idem — Cursor avait Supabase distant + personas |
| Titre `Matricia \| Matricia` | Surface connectée |
| `/api/readiness` public + admin client (lecture code) | Codex : readiness 503 ops ; Cursor : finding code exposition |
| Cartographie 287 routes (Codex) vs matrice K (Cursor) | Complémentaires |

---

## 4. Registre unifié recommandé (priorité correction)

| Ordre | ID unifié | Source | Action |
|---|---|---|---|
| P0/P1 | SIG-EXPORT / SIG-RUNTIME | Codex BUG-001+002 = Cursor BUG-002/003/007/010 | Un seul fournisseur sandbox canonique ; exports Turbopack+tsc ; webhook + outbox compilables ; accueil 200 après appel |
| P1 | SESSION-MENU | Cursor BUG-001 | CSS `details[open]` (déjà patch local) |
| P1 | DEMO-POLICY | Cursor BUG-011/012 · Codex risque | Durcir `demo-policy` hors non-prod |
| P2 | BIGINT-COREPOT | Codex BUG-003 | Chaîne décimale exacte |
| P2 | TEST-HARNESS-COMPARE | Codex BUG-004 | Mock auth + isolation Vitest |
| P2 | CONTACT-A11Y | Codex BUG-005 | Aligner `aria-label` / texte |
| P2 | READINESS-EXPOSURE | Cursor BUG-013 | Restreindre payload/auth |
| — | Parcours A/B + SQL/RLS | Les deux BLOQUÉS | Base de test alignée migrations puis recette |

---

## 5. Notes d’honnêteté

1. **Ne pas fusionner les compteurs de tests** (4369 unit Codex ≠ tests navigateur Cursor).
2. Commit Codex `7eb72239` **n’est pas dans ce clone** : rejouer ses commandes ici peut diverger tant que le SHA n’est pas récupéré.
3. Working tree actuelle : `packages/signature-v41/src/index.ts` **déjà modifié localement** (sans `export *` sandbox dans l’index) — état intermédiaire, **non validé** comme correctif livré.
4. Aucune des deux campagnes ne remplace une recette staging avec sessions A/B et gate release signée.

## 6. Verdict croisé

**Mise en production déconseillée** pour les deux versions examinées.  
Priorité unique de déblocage : **package `@matricia/signature-v41` (export + résolution bundler)** puis base de test à jour et parcours connectés.
