# Outillage de livraison — vérification de développement

La livraison V1 reste non autorisée tant que le gate strict refuse les visas et preuves manquants. Ce rapport ne signe ni la recette client ni les intégrations externes.

## Exécuté dans le worktree de développement

- `pnpm test:integration` : 2 tests réussis, zéro ignoré. Serveur HTTP loopback réel, autorisation/corrélation/enveloppe, publication après accusé et non-publication en 503, reprise avec la même identité.
- `pnpm test:tooling` : 16 tests réussis, zéro ignoré. Gate SHA/temps/comptage/indépendance, intégrité des artefacts et symlinks, refus des faux succès navigateur, couverture d’interactions liée aux sources, sécurité des plans de performance et p95.
- `pnpm release:structure` : sortie 0 ; valide seulement catalogue/spec/traçabilité structurelle et absence de marqueurs incomplets.
- `pnpm release:validate` : sortie 1 attendue, car arbre non figé, preuve runtime des interactions absente, 71 exigences encore sans visa final et manifeste candidat absent. Ce refus est le comportement requis, pas une régression masquée.
- Syntaxe Node des runners et YAML des workflows parsée ; `git diff --check` valide.

## Préparé mais non exécuté par ce sous-domaine

- Job CI public avec installation Chromium et runner 18 scénarios public/cookies, sans skip/flaky/retry.
- Workflow de staging manuel dans l’environnement GitHub protégé `staging-acceptance` ; provisioning/cleanup des fixtures par le runner existant. Les credentials sont générés depuis le coffre d’environnement et les traces authentifiées brutes ne sont pas publiées.
- Mesures navigateur et p95 API réelles, déclenchées uniquement avec un plan de cible vérifié. Les tests de configuration de ces outils ne sont pas une mesure de performance de l’application.
- Recettes authentifiées de mutation et couverture des interactions : fixtures et artefacts requis ; absence = échec explicite. Les moteurs de recette doivent être rejoués après intégration des autres domaines et gel du candidat.
- Juridique/comptabilité, fournisseurs, sécurité indépendante, restauration complète, remise et procès-verbal client : aucune approbation n’a été fabriquée.
