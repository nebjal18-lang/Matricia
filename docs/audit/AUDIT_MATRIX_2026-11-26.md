# Audit Matricia — matrice 2026-11-26

Branche: `fix/admin-space-finalization-2026-11-25`  
PR: https://github.com/nebjal18-lang/Matricia/pull/42  
Déploiement de référence: https://matricia-domain.vercel.app/ — distinguer **observé Vercel** vs **vérifié branche**.  
Classeur Excel: absent de l’environnement.

## Synthèse des verdicts

| Lot | Verdict | Preuve |
|---|---|---|
| PUB-01 besoin / ranking | Corrigé et retesté | vitest need-intent 10/10 |
| PUB-02 diagnostic brouillon | Corrigé et retesté | gate reprise/nouveau dans `prediagnostic-flow.tsx` |
| PUB-03 abonnements vides | Corrigé et retesté | hero aligné sur état vide ; page.test |
| PUB-03 mentions légales | Données métier vérifiées (éditorial) | `legalPublication().missing` liste les champs éditeur |
| ADM-01 org label | Corrigé et retesté | `Organisation {ref}` ; A/B UI test panel |
| ADM-01 A/B persistence | Lecture incomplète / preuve locale antérieure | panel test A≠B ; navigateur→DB à rejouer en démo |
| ADM-02 fiches conformité | Corrigé et retesté | plus de `notFound()` public trompeur |
| CAT fallback IT démo | Corrigé et retesté | plus d’injection IT dans shell COM ; `demoFallback` explicite |
| CAT inventaire hors IT | Données métier vérifiées (CSV) | `artifacts/.../lot3-non-it-libraries.json` — 9 libs |
| CAT cycle éditorial DB | Bloqué — libs métier absentes DB locale | fixtures E2E_LOCAL seulement |
| FIN-01 MAT-FUNC-032 | Action et persistance vérifiées (local) | `lot2-mat-func-032.json` PASSED |
| FIN-02 fiscal | Données métier vérifiées | `client-billing/panel.test.tsx` politique absente vs APPROVED |
| CLI/ST/FRA film | Lecture incomplète cette session | fixtures existantes ; non rejouées navigateur ici |
| Mobile / AR | Lecture incomplète cette session | RTL + pages publiques couvertes partiellement par tests |

## PUB-01 — Orientation besoin libre

**Cause:** score par service incluait le nom de bibliothèque BTP (« … et maintenance ») → 714 bps (7,14 %) pour tous les BTP ; tie-break `BTP-*` avant `IT-*`.

**Correction:** libellés de service + boost domaines ; jeton ambigu seul → liste vide.

| Besoin | Après |
|---|---|
| Maintenance informatique 3 postes | 1er rang IT |
| Clôture comptable annuelle | ACC-CLOSE |
| Maintenance électrique bâtiment | BTP |
| « j’ai besoin de maintenance » | vide → clarification |
| AR صيانة معلوماتية | IT |

## CAT — Bibliothèques hors IT (CSV autorité)

Source: `catalogue/Matricia_Catalogue_Metier_V1`  
IT exclu du lot métier. **9** bibliothèques hors IT inventoriées.

Décision métier requise (CSV): colonnes AR absentes / AR=FR sur échantillon — **ne pas publier** en recopiant le FR.

Constructeur: sans `library`+`service` le builder reste fermé (lien directory corrigé vers `#domaines`). Simulation de secours IT **identifiée** (`simulation de secours`, `demoFallback`).

## ADM-02

Les ~27 destinations « Le service est momentanément indisponible » correspondaient souvent à la **carte d’exemple** de la 404 publique après `notFound()` sur dossier absent — pas une panne RPC systématique.

## FIN

- MAT-FUNC-032: preuve locale navigateur→DB PASSED (`artifacts/test-results/local-acceptance/lot2-mat-func-032.json`).
- Fiscal: message distinct politique absente vs source absente (`hasApprovedPolicy`).

## Points ouverts (décision précise)

1. Importer / publier les 9 libs hors IT en base de test pour clôturer le cycle franchisé→admin→client.
2. Fournir les variables `LEGAL_*` éditeur pour lever « Publication définitive en attente ».
3. Rejouer A/B admin + film client↔prestataire sur démo déployée après merge.
4. Traductions AR CSV (Gold Master) — décision éditoriale hors code.
