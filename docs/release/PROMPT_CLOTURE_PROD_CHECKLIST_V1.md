# PROMPT AGENT — Clôture Matricia V1 (corriger + valider)

Copie ce prompt tel quel dans une session Agent. Ne pas inventer de preuves. Ne pas committer de secrets. Ne pas toucher la production sans autorisation explicite. Source d’autorité : Gold Master V4 FINAL + `docs/progress/PROJECT_STATE.md` + `docs/DECISIONS_REQUIRED.md`.

## Contexte figé (ne pas réécrire l’histoire)

- Branche de travail attendue : `version-2` (sauf instruction contraire).
- Comptes parcours : `parcours.*@matricia.test`.
- Dossier IT demo COMPLETED : **ne pas casser / ne pas réutiliser pour litige-avenant destructif**.
- Signature actuelle : mock `MATRICIA_DEV_MOCK` / `SIGNATURE_PROVIDER_MODE=DEVELOPMENT_MOCK` — **non contractuel**, interdit en production.
- Scan surfaces statiques FR/AR desktop+360 : vert.
- Dynamic franchise/provider/admin rescan : 60/60, 0 issue (après hygiène seeds).
- Mutations DEV : litige `WARNING_LEVEL_1` OK ; avenant `CONTRACT_AMENDMENT_DRAFTED` OK.
- Access gates fiscalité : 8/8 `FORBIDDEN` pour `demo.admin`.
- Gate livraison V1 : **REFUSÉ** (~74 conditions, **5/76 VERIFIED**).
- Preuves locales de scan : `.tmp/dynamic-gates-mutations-report.json`, `.tmp/scan-dynamic-surfaces.json`, `.tmp/coverage-report-surfaces.json`, `.tmp/access-gates-verify.json` (artefacts locaux, hors Git si `.tmp/` ignoré).

## Objectif de la session

1. Produire un plan d’exécution ordonné (P0 → P2).
2. Corriger les items code/données listés ci-dessous.
3. Valider les recettes métier avec preuves atomiques (SQL/RLS, navigateur, RPC, audit).
4. Mettre à jour `docs/progress/PROJECT_STATE.md` uniquement après preuves vertes.
5. Ne jamais promouvoir `VERIFIED` sans preuve ; ne jamais présenter le mock comme signature réelle.

## Invariants non négociables

- TypeScript strict ; logique métier hors UI.
- RLS multi-tenant : aucune lecture/écriture cross-org.
- Montants : unités mineures / décimaux exacts — jamais `float`.
- Ledgers immuables ; mutations financières transactionnelles, idempotentes, auditées, outbox.
- FR + AR RTL ; parcours critiques dès 360 px.
- Aucun secret dans Git / logs / docs (`.env.local` uniquement).
- Franchise IT : 50 % Hatim / 50 % Jalil-NEOXA / 0 % Mme Asma.

---

# BLOC A — BLOQUANTS PRODUCTION

## A1. Environnement staging/prod — variables Vercel/Supabase + build + smoke

### État
- Supabase DEV autorisé ; staging Vercel distinct non confirmé.
- Railway sans cible fournie.
- Variables publiques normalisées (`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) ; clés privilégiées interdites côté navigateur.
- Build Vercel a déjà échoué faute de config publique reconnue puis corrigé partiellement sur `version-2`.

### À faire
1. Inventorier variables requises depuis `.env.example` + `docs/integrations/RUNTIME_INTEGRATIONS.md` + `docs/release/EXTERNAL_ACTIVATION_CHECKLIST.md` + `docs/release/DEPLOYMENT_RUNBOOK.md`.
2. Sur Vercel (projet domaine web) confirmer **une par une** :
   - `NEXT_PUBLIC_APP_URL` HTTPS canonique
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou alias documentés)
   - `SUPABASE_SERVICE_ROLE_KEY` **server-only**
   - `INTERNAL_WEBHOOK_SECRET`, secrets worker/cron
   - `SIGNATURE_PROVIDER_MODE=EXTERNAL` + `SIGNATURE_PROVIDER_CODE=<CODE>` **seulement** si adaptateur réel prêt
   - SMTP / OTP length / PSP sandbox flags
3. Sur Supabase staging/prod : Auth (OTP length, redirect URLs, MFA), Storage buckets privés, RLS, migrations appliquées jusqu’au head local.
4. Déployer un build preview puis production candidate.
5. Smoke authentifié : login OTP, 1 page par rôle (client/provider/franchise/admin), health worker, refus clé absente.

### Critères done
- [ ] Matrice variables : présente / absente / secret-manager only, signée.
- [ ] Build preview vert + URL.
- [ ] Smoke 4 rôles FR + 1 AR, captures + codes HTTP.
- [ ] Aucun secret dans logs Vercel/Git.
- [ ] Documenter écarts dans `PROJECT_STATE.md`.

### Preuves attendues
Fichier evidence JSON + captures ; pas de capture d’écran avec tokens.

---

## A2. Identité légale / KYC (M21 ouvert)

### État
- M21 bloqué : identité légale approuvée manquante.
- Parcours documents existent ; preuves d’approbation métier externes manquent.

### À faire
1. Cartographier RPCs/tables : documents conformité client & provider, statuts, gates onboarding (`ACCESS_REQUESTED` → `VERIFIED` + essai).
2. Jouer bout-en-bout **client** : upload pièces → revue admin AAL2 → approbation → déblocage essai/abonnement.
3. Jouer bout-en-bout **prestataire** : pièces qualification → décision → éligibilité devis/mission.
4. Vérifier Storage privé, hash, refus cross-tenant, révocation.
5. Lister pièces manquantes métier (ICE, RC, CIN/passeport selon politique) sans inventer une politique légale.

### Critères done
- [ ] Client demo/parcours passe gate identité avec pièces approuvées **réelles** (DEV/staging).
- [ ] Prestataire idem.
- [ ] Tests SQL/RLS + E2E ciblés.
- [ ] M21 ne passe `VERIFIED` que si preuves atomiques + décision externe DR-004 si requise.

---

## A3. Politiques contractuelles livrées (TEMPLATE + dispute_policy + commission four-eyes)

### État
- DEV : litige/avenant ont nécessité TEMPLATE + `dispute_policy` + clauses exactes + four-eyes.
- Production ne peut pas dépendre de seeds DEV ad hoc.

### À faire
1. Lister politiques actives par environnement (`contract_signature_policy_versions`, templates, commission, dispute_policy).
2. Créer/approuver en **four-eyes AAL2** : TEMPLATE contrat, dispute_policy, règles commission versionnées.
3. Lier politiques aux services catalogue publiés pertinents.
4. Prouver qu’un nouveau contrat créé hors seed hérite des politiques APPROVED (pas mock bypass).
5. Refuser auto-approbation ; second admin distinct.

### Critères done
- [ ] Au moins 1 set ACTIVE/APPROVED en staging pour SIMPLE (puis ADVANCED si décidé).
- [ ] Création enveloppe signature refuse si politique absente/révoquée.
- [ ] Audit trail four-eyes consultable.
- [ ] Recette litige s’ouvre sans fork SQL bricolé.

---

## A4. Fiscalité / CNDP — décisions + contenu métier

### État
- Gates UI `classification-fiscale` + `fiscalite-maroc` : 8/8 `FORBIDDEN` demo.admin (FR/AR × desktop/360) — **refus d’accès OK**.
- Contenu métier / décisions externes (DR-004 CNDP traitement/transfert, moteur fiscal daté) non validés pour release.

### À faire
1. Confirmer matrice rôles qui **peuvent** accéder vs refus.
2. Valider moteur fiscal versionné (pas hardcodé) : barèmes, dates d’effet, snapshots facture.
3. CNDP : déclaration traitement, transferts, consentements marketing, DSR.
4. Remplir validations externes admin `CNDP_PROCESSING_DECLARATION`, `CNDP_TRANSFER_AUTHORIZATION` uniquement avec preuves datées réelles.
5. Ne pas « ouvrir » les gates pour faire joli : le fail-closed est correct tant que décision absente.

### Critères done
- [ ] Décision écrite CNDP/fiscalité (owner + référence).
- [ ] Au moins 1 facture/calcul TVA rejoué avec règle datée.
- [ ] Gates refus inchangés pour rôles non habilités.
- [ ] DR-004 partiellement ou totalement clos avec preuves.

---

## A5. Gate livraison V1 — passer conditions VERIFIED manquantes

### État
- `release:validate` / garde V1 : **REFUSÉ**.
- Traçabilité ~**5/76 VERIFIED**, reste IN_PROGRESS.
- Fichiers : `docs/RELEASE_CHECKLIST.md`, `docs/traceability/REQUIREMENTS_COVERAGE.md`, `docs/release/GATES_AND_OBSERVATIONS.md`, `docs/release/FINAL_CANDIDATE_*.md`.

### À faire
1. Extraire la liste exacte des conditions REFUSÉ / non VERIFIED.
2. Classer : code manquant / preuve manquante / décision externe / hors V1 (MAT-FUNC-069+).
3. Pour chaque condition V1 (MAT-FUNC-001..068 + marketing in-scope) : preuve atomique ou justification hors périmètre.
4. Exécuter `pnpm release:validate` (ou script canonique du repo) après chaque lot vert.
5. Interdiction : fermer artificiellement un VERIFIED.

### Critères done
- [ ] Tableau condition → statut → preuve path → owner.
- [ ] Progression mesurable (ex. 5/76 → N/76) avec hashes/artefacts.
- [ ] Gate global reste REFUSÉ tant que P0 externes (signature, CNDP, staging) ouverts — c’est attendu.

---

# BLOC B — À CORRIGER (PRODUIT / DONNÉES)

## B1. 5 pages dynamiques sans seed

Templates encore non seedés :
1. `client/abonnement/cycles/[cycleId]`
2. `franchise/finance/releves/[closureId]`
3. `sous-traitant/[...slug]`
4. `sous-traitant/consultations/[consultationId]`
5. `sous-traitant/facturation/[invoiceId]`

### À faire
1. Pour chaque template : trouver table source + RPC list + org actor parcours.
2. Créer seed **tenant-correct** (pas d’ID d’une autre org).
3. Ajouter IDs dans le collecteur de seeds (ex. scripts `.tmp/collect-dynamic-seed-ids.mjs` → promouvoir en `tests/e2e` ou `scripts/` versionné).
4. Scanner FR/AR desktop+360 → 200 + contenu métier, pas empty shell.
5. Si la route est hors V1 : documenter et retirer de l’inventaire « livré », ne pas fake seed.

### Critères done
- [ ] 5/5 seedés **ou** explicitement exclus du périmètre V1 avec raison.
- [ ] Rescan dynamic issues = 0 sur ces templates.

---

## B2. Diagnostic client parcours — pas de `diagnostic_runs`

### À faire
1. Vérifier org client parcours : table `diagnostic_runs` vide.
2. Soit exécuter un diagnostic natif via UI/RPC pour créer un run réel, soit seed déterministe lié à l’org.
3. Couvrir `/client/diagnostics/.../[id]` FR/AR.
4. Vérifier conversion diagnostic → opportunité si dans le parcours.

### Critères done
- [ ] ≥1 `diagnostic_runs` pour org demo/parcours.
- [ ] Page détail 200 + données cohérentes.
- [ ] Pas de fallback cross-tenant.

---

## B3. Catalogue franchise — services/questionnaires hors workspace → 404

### État
- Seeds enrich ont déjà retiré une partie des fallbacks cross-tenant.
- IDs catalogue public ≠ workspace franchise → 404.

### À faire
1. Auditer `franchise` library workspace loaders (`apps/web/modules/franchise/data/library/workspace.ts` et migrations `*_franchise_catalog_workspace_bundle*`).
2. Garantir que les liens UI n’émettent que des IDs du workspace courant (+ `franchiseId` query si requis).
3. Tests : accès OK membre ; refus org étrangère ; 404 propre ID hors workspace.
4. Rescan pages détail services/questionnaires franchise.

### Critères done
- [ ] Zéro lien UI vers ID hors workspace.
- [ ] Tests workspace-access verts.
- [ ] RLS prouvée.

---

## B4. Routes inventaire fantômes

### État
- `administration/operations/[id]` : n’existe pas.
- `v4-1/finance` : module invalide ; modules réels type `finops`.

### À faire
1. Corriger inventaire routes (script `inventory-routes` / specs e2e) pour refléter le filesystem réel.
2. Remplacer seeds admin ops invalides.
3. Aligner navigation admin V4.1 sur modules existants.
4. Empêcher rescan d’échouer sur routes inventées.

### Critères done
- [ ] Inventaire = routes réelles uniquement.
- [ ] Specs e2e dynamic n’attendent plus ces fantômes.

---

## B5. Param `franchiseId` — documents / contrats partenaires

### À faire
1. Lister pages qui exigent `?franchiseId=`.
2. Vérifier tous les `Link` / redirects / emails magiques incluent la query.
3. UX : si absente → message actionnable (pas crash, pas 500).
4. Tests unitaires + 1 E2E.

### Critères done
- [ ] Navigation interne conserve `franchiseId`.
- [ ] Entrée sans query = état d’erreur contrôlé.

---

## B6. Seeds enrich — no cross-tenant fallback

### État
- Partiellement corrigé (document provider → `provider_document_versions`, drop IDs hors workspace, etc.).

### À faire
1. Relire collecteur d’IDs : interdit de piocher une autre org « pour remplir ».
2. Si ID manquant → `missingSeedTemplates` explicite.
3. Ajouter test/guard CI si possible.
4. Rescan complet dynamic.

### Critères done
- [ ] Aucun seed issu d’org étrangère.
- [ ] Rapport missing templates honnête.

---

# BLOC C — À VALIDER (RECETTES MÉTIER)

Pour chaque recette : acteurs réels GoTrue/TOTP, pas de JWT fabriqué ; captures FR + AR ; desktop + 360 sur étapes critiques ; SQL assertions + audit/outbox.

## C1. Parcours commercial bout-en-bout

`besoin → devis → contrat → signature réelle → mission → réception → paiement`

### Points de contrôle
1. Intent public / RFQ client sans imposer le catalogue comme étape UI.
2. Matching explainable → devis provider versionné.
3. Comparaison client sans float.
4. Contrat draft → politiques A3 → envoi signature.
5. **Signature réelle** (adaptateur EXTERNAL) — mock interdit pour clôturer cette recette prod.
6. Mission + jalons + preuves Storage immuables.
7. Réception / acceptation.
8. Paiement sandbox PSP + ledger immuable + outbox.

### Critères done
- [ ] Chaîne complète sur staging avec preuves hashées.
- [ ] Refus signature mock en `APP_ENV=production`.

---

## C2. Litige bout-en-bout

### État
- Ouverture DEV OK (`WARNING_LEVEL_1`, case connue en evidence).

### À valider encore
1. Réponse prestataire + preuves.
2. Médiation admin.
3. Décision finale.
4. Impacts finance / réassignation contrôlée.
5. Pas d’altération du dossier IT COMPLETED.

### Critères done
- [ ] Cycle ouvert → clos avec audit.
- [ ] Soldes/ledgers cohérents post-décision.

---

## C3. Avenant bout-en-bout

### État
- Draft OK (`CONTRACT_AMENDMENT_DRAFTED`).

### À valider encore
1. Envoi signature avenant (réelle).
2. Double signature.
3. Activation version + binding hash.
4. Exécution mission / scope (`amendment-execution` states).
5. Annulation/void native si applicable.

### Critères done
- [ ] Version ACTIVE post-signatures vérifiées.
- [ ] Ancien contenu immuable conservé.

---

## C4. Facturation prestataire

### À faire
1. Émission facture depuis événements payables.
2. Réconciliation.
3. Immutabilité ledger ; pas d’update de solde direct.
4. PDF/archivage si dans périmètre.
5. RLS : client ≠ voir journaux provider internes selon politique.

### Critères done
- [ ] Recette SQL + UI provider finance.
- [ ] Tentative mutation ledger → refus.

---

## C5. Finance franchise — relevés / closures / répartition IT 50/50/0

### À faire
1. Seed ou créer closure/relevé réel → couvre aussi B1 `releves/[closureId]`.
2. Vérifier base distribuable versionnée.
3. IT : 50 Hatim / 50 Jalil / 0 Asma.
4. Autres franchises : règles contractuelles versionnées (défaut Gold Master si absent).
5. Statements immuables post-émission.

### Critères done
- [ ] Statement chiffré exact + audit.
- [ ] Page détail releve 200.

---

## C6. Admin four-eyes AAL2

### À faire
1. Deux admins distincts + TOTP AAL2.
2. Proposition ≠ approbation (anti auto-approve).
3. Cas : politiques signature, crédits manuels, validations externes, gouvernance franchise.
4. Version périmée refusée ; claim/resolve.

### Critères done
- [ ] Matrice 19 étapes natives (déjà partielle) rejouée sur candidat courant.
- [ ] Preuves navigateur FR360 + AR.

---

## C7. RLS multi-tenant (focus franchise catalogue)

### À faire
1. Matrice org A vs org B : library, questionnaires, documents, finances, litiges.
2. Service-role uniquement chemins serveur documentés.
3. Storage paths non devinables / non listables cross-tenant.
4. Regression après B3.

### Critères done
- [ ] Rapport SQL/RLS avec assertions fail-closed.
- [ ] 0 fuite détectée.

---

## C8. FR/AR + 360 px sur flux métier

### État
- Scan statique vert ; à rejouer sur flux métier C1–C6.

### À faire
1. Parcours critiques en 360 et desktop, FR et AR (RTL).
2. axe ciblé + clavier sur formulaires signature/paiement/admin.
3. Pas de débordement horizontal ; libellés non coupés critiques.

### Critères done
- [ ] Checklist captures par flux.
- [ ] Bugs UX corrigés ou listés P2 non bloquants.

---

# BLOC D — NON BLOQUANT MAIS À TRAITER

1. **CI SQL** — écart versions persistées (ex. signaux 0193 / 457400) : aligner migrations/tests.
2. **Boxes / crédits** — config native + expiration + consommation.
3. **Exports volumineux / confidentialité** — lots admin ouverts ; DSR/scanner.
4. **Contenus AR catalogue (M14)** — services/catégories AR approuvés manquants.

---

# BLOC E — DÉJÀ OK (ne pas retravailler sans régression)

- Surfaces **statiques** FR/AR desktop+360.
- 8 gates fiscalité `FORBIDDEN`.
- Litige ouvert + avenant draft en conditions DEV préparées.
- Dossier IT demo COMPLETED intact.
- Hygiène partielle seeds dynamic (provider docs, franchiseId, drop fantômes admin).

---

# Ordre d’exécution recommandé

```
P0: A1 staging vars+smoke → A3 politiques four-eyes → DR-001 adaptateur signature (Yousign/autre) sandbox
P0: A2 KYC client+provider
P1: B1–B6 corrections données/routes
P1: C1 commercial avec signature sandbox (puis réelle)
P1: C2 litige fin → C3 avenant fin → C4 facturation → C5 finance franchise
P1: C6 four-eyes → C7 RLS → C8 i18n métier
P2: A4 CNDP/fiscalité décisions → A5 progression VERIFIED → Bloc D
```

---

# Format de rapport obligatoire à chaque fin de lot

```md
## Lot <id>
- Objectif
- Fichiers touchés
- Preuves (chemins, hashes, commandes, résultats)
- Risques / non-faits
- Impact gate VERIFIED (aucun / lesquels / pourquoi pas)
- Prochaine étape unique
```

## Interdits absolus

- Commit de `.env`, clés API, tokens, dumps prod.
- Fake VERIFIED / fake signature juridique.
- Modifier production sans ordre écrit.
- Cross-tenant seed « pour que le scan soit vert ».
- Casser le dossier IT demo COMPLETED.

## Commandes utiles (adapter au repo)

```bash
pnpm --filter @matricia/signature-v41 test
pnpm --filter web typecheck
# SQL tests ciblés selon fichiers supabase/tests/03xx_*.test.sql
# E2E: tests/e2e/parcours-*.spec.ts
pnpm release:validate
```

## Décisions externes à obtenir en parallèle (humain)

- DR-001 fournisseur signature + niveau par type de contrat
- DR-002 tarifs publiables
- DR-003 comptes sandbox externes (PSP, SMTP, social, scanner)
- DR-004 CNDP / revues catalogue / restore / pentest / autorisation prod
