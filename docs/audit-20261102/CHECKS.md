# Commandes exécutées — candidat audit M01–M30

Exécutions dans le dépôt, avec pnpm 10.17.1 et Next 16.4.1. Les préfixes PATH/COREPACK_HOME propres au cloud ne sont pas nécessaires dans une installation pnpm équivalente. Les empreintes des journaux et la révision applicative sont conservées dans [la preuve structurée](../evidence/audit30-candidate-20261102.json).

| Commande | Résultat et portée |
| --- | --- |
| `corepack pnpm typecheck` | PASS tous espaces de travail ; le build final revérifie les types web. |
| `corepack pnpm lint` | PASS. |
| `NEXT_PUBLIC_APP_URL=https://matricia.test corepack pnpm build` | PASS ; URL HTTPS de métadonnées du laboratoire, aucune publication sur ce domaine. |
| `corepack pnpm -r --workspace-concurrency=1 test --maxWorkers=2` | 2 473 web +102 worker +137 bibliothèques =2 712 PASS ; un test Storage exigeant une activation explicite est ignoré. |
| `corepack pnpm test:integration` | 3 PASS : enveloppe/auth/corrélation Outbox, refus HTTP et absence d’acquittement. |
| `corepack pnpm test:tooling` | 31 PASS. |
| `corepack pnpm verify:phase00` | PASS structure catalogue/spécification/traçabilité/exports ; 5/76 exigences VERIFIED, aucune certification métier déduite. |
| `APP_ENV=development node scripts/validate-local-migration-replay.mjs --test=0300_client_allocation_invoice_targets.test.sql` | 418 migrations PASS sur clone neuf sans réseau/port ; 23 assertions PASS/ROLLBACK ; RLS608/608 et pgTAP fermé après rollback ; clone supprimé. |
| `E2E_LOCAL_ISOLATED=1 E2E_LOCAL_PROJECT_ID=Matricia APP_ENV=development NEXT_PUBLIC_APP_URL=http://localhost:5173 corepack pnpm test:e2e:audit30-native` | 176 contrôles satisfaits :168 sans incident technique et8 états facture partiels attendus. Quatre vrais acteurs GoTrue/TOTP AAL2 ; trois organisations locales propres ; nettoyage vérifié. |
| `E2E_EXTERNAL_SERVER=1 E2E_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium PLAYWRIGHT_VIDEO=off corepack pnpm test:e2e:audit30-public` | 8 PASS : FR/AR ×375/390/768/1440, huit questions puis réponses/détail/plan et Besoin/reprise/retours ; zéro POST métier. |
| `E2E_LOCAL_ISOLATED=1 E2E_LOCAL_PROJECT_ID=Matricia APP_ENV=development NEXT_PUBLIC_APP_URL=http://localhost:5173 corepack pnpm test:e2e:audit30-native --admin-only` | Dernier build :8 PASS, menu entièrement dans le viewport, Tab, hit-test déconnexion, recherche/sélection natives, rôle Admin depuis la vitrine ; vraie déconnexion puis lien protégé refusé. |
| `E2E_EXTERNAL_SERVER=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium PLAYWRIGHT_VIDEO=off corepack pnpm exec playwright test tests/e2e/admin-account-menu-geometry.spec.ts --project=chromium-desktop --workers=1` | 8 PASS, géométrie CSS synthétique FR/AR ; aucune preuve de session déduite de ce test. |
| `corepack pnpm --filter @matricia/web exec vitest run modules/shared/ui/workspace-account-menu.test.tsx modules/shared/shell/cockpit.test.tsx modules/admin/screens/admin-mockup-alignment.test.tsx --maxWorkers=2` | 17 PASS après le dernier CSS Admin. |
| `corepack pnpm release:validate` | REFUSÉ :74 conditions dans l’instantané préparatoire, 5/76 VERIFIED. Ce résultat est conservé et ne devient pas un visa de lancement. |
| `gh pr create --draft --base codex/bootstrap-foundation --head codex/audit-m01-m30-20261102 --title 'Corriger les 30 constats de l’audit Matricia du 2 novembre 2026' --body-file docs/audit-20261102/PR.md` | Bloqué : `POST https://api.github.com/graphql: Forbidden`. Aucun numéro de PR inventé. |

Le serveur des tests est démarré depuis ce build avec `NEXT_PUBLIC_APP_URL=https://matricia.test corepack pnpm --filter @matricia/web exec next start --hostname 127.0.0.1 --port 5173`. Les paramètres Supabase locaux sont ignorés par Git. Le harnais natif refuse un environnement autre que le Docker local vérifié ; il ne fonctionne pas comme un seed distant.

## Provenance et échecs conservés

- Première passe globale : deux échecs de tests d’interface liés aux nouvelles structures ; corrigés, puis suite complète 2712 PASS.
- Premier build : URL locale HTTP refusée en mode production. Reprise avec métadonnées HTTPS ; la protection n’a pas été désactivée.
- Premier SQL0300 :10 assertions puis absence d’USAGE du schéma du framework après changement de rôle. Grant limité au framework, dans le rollback du test ; second clone neuf :23 PASS. Aucun trigger ni RLS désactivé.
- Première recette publique :4/8 PASS, quatre débordements réels à375/390px. Diagnostic CSS sur50 mesures de diagnostic avec injection du seul delta CSS, puis huit E2E PASS après reconstruction.
- Revue des captures Admin : hit-test seul insuffisant pour détecter le rognage à gauche. Test renforcé avec limites du rectangle et Tab, CSS corrigé, huit reprises natives PASS sur le build final.

La matrice complète utilise le build `cq8xTYOaQeQHs-8zthv4q`. Les seuls changements applicatifs suivants sont les CSS Besoin et Admin, chacun recetté sur son build corrigé. Les TypeScript de production sont inchangés. Le dernier build, le harnais et les arbres Git applicatifs sont identifiés dans le JSON candidat.

## Réserves

Les tests SQL de rôle utilisent des claims transactionnels de fixture ; ils ne sont pas des sessions GoTrue. Les rôles Admin natifs sont un bootstrap explicite de test ; aucune attribution de rôle gouvernée n’est certifiée. Le lecteur facture n’est pas appliqué au Supabase partagé/distant ; ses états partiels sont annoncés. Une facture réelle exclusive/mixte et son plafond d’allocation restent à vérifier avec un graphe financier natif complet.

Ces contrôles ne certifient pas une qualification Provider complète, un mandat signé, une signature contractuelle, un envoi externe, une restauration coordonnée, le mobile de tous les130 chemins audités ou un PV client. Les contenus approuvés et accès manquants sont indiqués dans le tableau M01–M30.

## Captures de test

- [Menu Admin mobile FR](../evidence/audit30-screenshots/admin-menu-fr-375.png) et [AR](../evidence/audit30-screenshots/admin-menu-ar-375.png), dernier build natif.
- [Besoin AR375](../evidence/audit30-screenshots/need-recap-ar-375.png) et [FR375](../evidence/audit30-screenshots/need-recap-fr-375.png), dernier parcours public.
- [Favoris Client](../evidence/audit30-screenshots/client-fr-390-client-favoris.png), [qualification Prestataire](../evidence/audit30-screenshots/provider-fr-375-sous-traitant-qualification.png) et [absence de mandat Franchisé](../evidence/audit30-screenshots/franchise-ar-375-franchise-accueil.png). Comptes et contenus synthétiques locaux uniquement.
