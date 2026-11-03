# Contrôles GitHub Actions — diagnostic vérifié

Source analysée : `df67da46f48def7cf804855ab985a28dec4aab6e`, branche principale `codex/bootstrap-foundation`, après les fusions Client #10 et Sous-traitant #11. Vérification le 3 novembre 2026.

## Cause des six échecs affichés

La capture montre trois jobs exécutés chacun sur un événement `push` et un événement `pull_request` : qualité, base de données et navigateur public. Ce sont six résultats de contrôle ; cela ne démontre pas six défauts de code.

La cause est prouvée par les annotations GitHub, y compris sur le dernier commit fusionné :

> The job was not started because your account is locked due to a billing issue.

| Exécution | Déclencheur / version | Preuve |
|---|---|---|
| [41588397772](https://github.com/epitaphe360/matricia/actions/runs/41588397772) | Push de la fusion #11, `df67da4` | Trois annotations identiques ; jobs non démarrés |
| [41588322980](https://github.com/epitaphe360/matricia/actions/runs/41588322980) | PR #11, lot Sous-traitant | Trois annotations identiques ; jobs non démarrés |
| [41556707354](https://github.com/epitaphe360/matricia/actions/runs/41556707354) | Push `8b38f9d`, lot Sous-traitant | Trois annotations identiques ; jobs non démarrés |

Le [reçu épuré](evidence/ci/github-actions-billing-block.json) conserve les URLs, les empreintes des pages et le diagnostic exact. Les pages HTML brutes ne sont pas committées car elles contiennent des valeurs techniques éphémères. L’API GitHub répond `Forbidden` dans cet environnement ; les pages HTTPS normales des runs restent consultables et ont fourni les annotations.

Aucun job n’a commencé dans ces exécutions. On ne peut donc pas déduire que les tests ont réussi ou échoué sur GitHub. Aucune modification de code, désactivation de contrôle, modification de protection de branche ou hausse de délai ne peut corriger ce blocage de facturation. Le workflow existant reste conservé.

## Intervention externe nécessaire

Le propriétaire du compte GitHub `epitaphe360` doit consulter ses [paramètres de facturation](https://github.com/settings/billing), résoudre le blocage signalé par GitHub, puis relancer **tous les jobs** du dernier run correspondant à la branche à relire. Cette mission ne modifie pas les moyens de paiement ni les paramètres de facturation du compte. La confirmation de disparition du blocage exige une nouvelle exécution distante effectivement démarrée ; elle n’est pas revendiquée ici.

## Vérifications locales indépendantes

Exécutées sur la même source `df67da4` avec les dépendances du lockfile, sans secrets externes ni base de production :

| Commande | Résultat | Journal |
|---|---|---|
| `pnpm verify:phase00` | PASS : catalogue, spécification, traçabilité, 1 832 fichiers d’exports serveur contrôlés | [phase00](evidence/ci/phase00.log) |
| `node --experimental-strip-types scripts/validate-boundaries.ts` | PASS : 14 packages | [frontières](evidence/ci/boundaries.log) |
| `pnpm no-placeholders` | PASS | [marqueurs](evidence/ci/no-placeholders.log) |
| `pnpm test:integration` | 3 PASS, aucun ignoré | [intégration](evidence/ci/integration.log) |
| `pnpm test:tooling` | 31 PASS, aucun ignoré ; inclut des contre-tests réels des gardes de release et des marqueurs incomplets | [outillage](evidence/ci/tooling.log) |

Invocation locale de pnpm : `PATH=/workspace/.cache/corepack/bin:$PATH COREPACK_HOME=/workspace/.cache/corepack corepack pnpm …`. Les dépendances locales partagées proviennent du même dépôt et ne constituent pas une nouvelle installation propre sur un runner GitHub. Ces vérifications ne remplacent ni les autres recettes du lot ni la relance distante des trois jobs après régularisation de la facturation.

## Nouveau push de la branche de correction

Le run [41607402990](https://github.com/epitaphe360/matricia/actions/runs/41607402990), après le push de `229a9d98`, reproduit trois annotations de facturation avant démarrage. [Reçu](evidence/ci/latest-branch-billing.json). La correction du produit ne peut lever ce verrouillage du compte ; les vérifications locales et le replay isolé restent tracés séparément.
