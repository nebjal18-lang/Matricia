# PROMPT AGENT — Atteindre 100 % « Implémenté mais non certifié »

## Définition du 100 % (obligatoire)

Objectif ≠ `VERIFIED` ≠ production.

**100 % implémenté non certifié** = pour chacune des **76** exigences du registre (`MAT-FUNC-001..068` + `MARKETING-001..008`) :

1. Code métier présent et branché (pas de placeholder / bouton mort / workflow fictif V1)
2. Preuve atomique **exécution** : SQL/RLS et/ou E2E métier **spécifique** au motif `PENDING:` actuel
3. Evidence datée dans `docs/evidence/` (JSON/log/md) avec commande + résultat
4. Ligne `REQUIREMENTS_COVERAGE.md` mise à jour : `PENDING:` réduit à **`PENDING:visa-independant` uniquement**
5. **Interdit** : passer en `VERIFIED` sans visa indépendant + preuves release

### Formule

Avant (pondération actuelle) :
- `VERIFIED` = 1,0
- `IN_PROGRESS` avec écart E2E/SQL/autre = 0,7
- → ≈ **72 %**

Cible :
- `VERIFIED` = 1,0 (5 lignes)
- `IN_PROGRESS` **visa-only** = 1,0 pour le compteur « implémenté »
- → **76/76 = 100 % implémenté**, toujours **non certifié** (~7 % VERIFIED inchangé tant que visas absents)

---

## État de départ (figé)

| Bucket | Count | Action |
|---|---|---|
| Déjà VERIFIED | 5 | Ne pas toucher sauf régression |
| Déjà visa-only | 11 | Vérifier preuves encore valides ; rien à coder si OK |
| Manque E2E métier | 50 | Écrire/exécuter E2E + evidence |
| Manque SQL | 2 | Compléter contrats SQL |
| Autre (matrice/a11y/i18n/inventaire/credentials) | 8 | Lots dédiés |

**Visa-only déjà (11)** : MAT-FUNC-002, 003, 004, 005, 008, 009, 010, 011, 012, 021, 051

**SQL (2)** :
- MAT-FUNC-038 — `SQL-relance-et-visa`
- MAT-FUNC-044 — `SQL-abandons-et-visa`

**Autre (8)** :
- MAT-FUNC-027 inventaire immutabilité
- MAT-FUNC-054 matrice 360
- MAT-FUNC-056 contrat progression transversal
- MAT-FUNC-058 aides champs critiques
- MAT-FUNC-059 couverture FR/AR exhaustive
- MAT-FUNC-060 texte simplifié systématique
- MAT-FUNC-061 audit accessibilité complet
- MARKETING-005 credentials live (sandbox autorisé suffit pour « implémenté » ; live prod = hors ce compteur)

**E2E (50)** : tout le reste des `PENDING:E2E-*-et-visa` + `visa-independant-et-E2E`

---

## Règles d’exécution

- Branche : `version-2` (ou lot dédié puis merge)
- 1 exigence = 1 lot atomique (max 3 proches si même surface)
- Acteurs GoTrue/TOTP réels ; pas de JWT fabriqué
- FR + AR sur parcours critiques ; 360 px si UI
- Aucun secret dans Git
- Ne pas casser dossier IT demo COMPLETED
- Après chaque lot : maj `REQUIREMENTS_COVERAGE.md` → `PENDING:visa-independant` + evidence path
- Mettre à jour `docs/progress/PROJECT_STATE.md` avec compteur : `implemented_non_certified = X/76`

### Critère done d’une ligne

```text
[ ] Motif PENDING exact traité (E2E ou SQL ou autre)
[ ] Preuve exécutée (PASS) référencée
[ ] release_signoff = PENDING:visa-independant
[ ] status reste IN_PROGRESS (sauf les 5 VERIFIED)
[ ] Pas de régression typecheck/lint sur fichiers touchés
```

### Rapport lot

```md
## Lot MAT-FUNC-0XX
- Écart fermé : <ancien PENDING>
- Fichiers
- Commande + résultat
- Evidence path
- Nouveau signoff : PENDING:visa-independant
- Compteur : N/76
```

---

## Ordre de battle (P0 → P3)

### P0 — Fermer les 2 SQL (rapide)
1. MAT-FUNC-038 relances franchise
2. MAT-FUNC-044 abandons questionnaires

### P1 — Chaîne commerciale / contrats / missions (bloque prod narrative)
E2E ciblés dans l’ordre :
- 014 champs obligatoires devis
- 020 capacité qualification
- 022 jalons
- 023 preuve scan
- 024 checklist figée
- 025 acceptation
- 026 avenant
- 028 réutilisation document
- (+ lots finance 030–035 si dépendances)

### P2 — Franchise / admin / notifications / questions
- 006, 036–043, 015–017, file du jour, digest, CRM, etc.

### P3 — Transversal UX / i18n / a11y / matrices
- 027, 054, 056, 058–061
- Marketing 001–008 (credentials sandbox pour 005)

### Fin
Quand **71/71** IN_PROGRESS sont `PENDING:visa-independant` et les 5 VERIFIED intacts :

```text
IMPLEMENTED_NON_CERTIFIED = 76/76 = 100%
VERIFIED = 5/76 ≈ 7%
RELEASE_GATE = toujours REFUSÉ jusqu’aux visas + P0 externes
```

Publier un evidence summary : `docs/evidence/implementation-100-non-certified.json`

---

## Interdits

- Recalculer le % en mentant (garder 0,7 sur une ligne encore E2E-pending)
- Promouvoir VERIFIED sans auditor
- Marquer visa-only sans avoir exécuté la preuve manquante
- Utiliser mock signature comme preuve contractuelle d’une exigence signature réelle

## Commandes types

```bash
# tests unitaires ciblés
pnpm.cmd --filter web test -- <path>

# e2e ciblé
pnpm.cmd exec playwright test tests/e2e/<spec>.ts

# sql ciblé (selon harness repo)
# supabase test db / scripts documentés dans docs/recette
```

## Définition de sortie session

Une session Agent doit :
1. Prendre le **prochain ID non visa-only** de la file P0→P3
2. Fermer **au moins 1** exigence jusqu’à `PENDING:visa-independant`
3. Committer preuves + maj couverture
4. Afficher `N/76` restant
