# Audit Matricia — matrice (démarrage 2026-11-26)

Branche: `fix/admin-space-finalization-2026-11-25`
Commit de départ: `fa93445e`
Déploiement de référence: https://matricia-domain.vercel.app/ (distinguer « observé Vercel » vs « vérifié branche »)
Classeur Excel: absent de l'environnement — démarrage depuis routes + constats mission.

## PUB-01 — Orientation besoin libre

| Champ | Valeur |
|---|---|
| Espace | Public / besoin |
| Compte | Anonyme (classement local `rankPublicNeedServices`) |
| Page | `/fr/besoin` |
| Défaut reproduit | Maintenance informatique → 5 services BTP à 7,14 % |
| Cause | Score par service incluait le **nom de bibliothèque** BTP (« BTP, immobilier et maintenance »). Un seul jeton « maintenance » donnait 714 bps à **tous** les services BTP ; tie-break alphabétique `BTP-*` avant `IT-*`. |
| Correction | Score sur libellés de service uniquement + boost de signaux domaine (FR/AR) ; refus de remplir 5 places sur un jeton opérationnel ambigu. |
| Fichiers | `apps/web/modules/public/data/need-intent/model.ts`, `model.test.ts` |
| Verdict | `Corrigé et retesté` (vitest need-intent 10/10) |

### Preuves avant / après (branche)

| Besoin | Avant | Après |
|---|---|---|
| Maintenance informatique 3 postes Tanger | BTP-ARCH/ELEC/ENERGY-AUDIT/FEAS/FIRE @ 714 | Premier rang **IT** ; pas de flood BTP architecte/incendie |
| Clôture comptable annuelle | ACC-CLOSE premier (OK) | ACC-CLOSE conservé |
| Maintenance électrique bâtiment | — | Premier rang **BTP** |
| « j'ai besoin de maintenance » | flood faible | liste vide → clarification / choix manuel |
| AR صيانة معلوماتية | — | Premier rang **IT** |

Commande: `pnpm --filter @matricia/web exec vitest run modules/public/data/need-intent/model.test.ts`

## Lots suivants

- CAT: catalogue natif hors IT
- ADM-01/02: A/B + fiches conformité
- FIN-01/02, CLI/ST/FRA, mobile/AR
