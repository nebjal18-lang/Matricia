# Clôture financière — continuité de recette et exploitation

Source explicite : `df67da4`, après les fusions Client et Sous-traitant. Travail local exclusivement ; aucune action de production et aucun secret externe utilisé.

## Causes reproduites et corrections

Le scheduler du worker attendait la clôture avant d’appeler les rappels. Une erreur de transport de la clôture supprimait donc également les rappels sur les factures déjà émises, indépendantes de la période en panne. Il acceptait en outre une réponse de rappels absente ou mal formée si le transport ne déclarait pas d’erreur. La santé du worker ne regardait que le scanner et l’outbox : ces incidents financiers pouvaient rester masqués par une readiness positive.

`apps/worker/src/provider-billing.ts` lance désormais les deux pages durables indépendamment et attend leurs deux résultats, sans chevauchement des cycles. Les deux erreurs sont conservées lorsqu’elles surviennent ensemble ; le prochain cycle peut réessayer. Une réponse de rappels doit contenir un compteur entier positif ou nul. L’état des deux dépendances entre dans la readiness et le heartbeat du worker ; un échec financier n’arrête pas le traitement indépendant de l’outbox.

La migration `20261103450000` termine l’alignement des échéances sur le jour civil marocain déjà utilisé pour la clôture et les déclarations. Le plan de paiement, le calcul d’exigible par défaut et le dernier statut de la projection utilisaient encore `current_date`, donc le fuseau de la connexion. La correction utilise `Africa/Casablanca`, sans modifier le fuseau d’une session de production, une horloge, une date de facture ou une empreinte signée. Les ACL privées et `security_invoker` sont conservés. Les contrôles de dates futures restent actifs.

## Parcours SQL de clôture jusqu’au règlement

`0360_provider_finance_close_to_payment.test.sql` reprend explicitement les prérequis natifs de `0347_provider_monthly_closing` : identité revue, documents et scans de test, qualification, devis sélectionné, signature gouvernée DEV-mock, mission réelle, déclaration d’encaissement, confirmation du Client et revue Finance indépendante, fiscalité et émetteur de test approuvés séparément, pré-relevé et contestation par ligne.

Le test fournit une **période historique de test dont le délai est déjà écoulé**, avec les snapshots sources exacts issus du pré-relevé. Il ne prétend pas avoir attendu le délai du mois courant ; il ne change aucune horloge et ne désactive aucun trigger. La facture, ses écritures et son événement proviennent du scheduler réel. Aucun journal, paiement ou facture n’est injecté pour compléter le parcours.

La suite utilise cette facture précise : échéancier sur deux dates futures, rejet du jour courant malgré un autre fuseau de connexion, refus AAL1, approbation indépendante, justificatif privé et scan explicitement TEST, déclaration de paiement sans effet de caisse, refus d’auto-validation, décision Finance, deux allocations partielles et replays identiques. Elle vérifie le solde `PAID`, l’équilibre de chaque journal, l’absence de réécriture de la facture, l’absence de doublon après rejeu et le refus de lecture étrangère. Les dates futures d’exigibilité sont testées par le calcul privé à date explicite, sans attendre un impayé réel ni antidater un règlement.

## Vérifications réellement exécutées dans ce lot

| Vérification | Résultat | Preuve |
|---|---|---|
| Nouveaux tests du scheduler, avant correction | 3 passent, 8 échouent | [Journal avant](evidence/finance/worker-before.log) |
| Worker complet `pnpm --filter @matricia/worker test --maxWorkers=1` | 13 fichiers, **118 tests PASS** | [Journal final](evidence/finance/worker-final-118.log) |
| Worker `pnpm --filter @matricia/worker typecheck` | PASS | [Types](evidence/finance/worker-types.log) |
| `git diff --check` | PASS | Contrôle source local |
| Migration `45000`, SQL `0360` et régressions financières | À exécuter par l’intégration sur une base locale isolée neuve | Ne pas déclarer cette ligne réussie sans reçu |

Les huit échecs du premier journal ne constituent pas huit causes distinctes : deux portent sur la poursuite des rappels après échec de clôture, cinq sur les réponses mal formées, un sur la séquence parallèle attendue par le nouveau test de non-chevauchement. Les nombres de tests ne s’ajoutent pas aux tests Web et SQL.

## Limites de clôture réelle

La dette du mois courant ne devient pas facturable avant sa date de clôture et sa fenêtre contradictoire réelles. Le présent parcours historique de test vérifie le moteur et sa continuité ; il ne certifie pas cette échéance courante par anticipation. La génération/archivage PDF FR/AR, les notifications et leur transport possèdent leurs tests dédiés dans le dépôt ; leur livraison hébergée n’est pas démontrée ici. Émetteur légal, données fiscales et numérotation approuvés, scanner réel, transport email et worker hébergé restent des prérequis de lancement. Une signature DEV-mock n’est jamais une signature juridique de production.
