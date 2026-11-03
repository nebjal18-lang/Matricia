# Audit indépendant — allocation économique des crédits

Date : 2026-11-01. Candidat lu : `/workspace/matricia`, HEAD `dbf309cd4ec5c48212c43243203dd98150ee5114` avec ses modifications intégrées. Audit statique en lecture seule pendant le gel SDK. Aucun SQL exécuté, aucune donnée modifiée, aucun conteneur démarré. Les scénarios ci-dessous ne constituent pas une preuve runtime.

## Conclusion

Le chemin comptable demandé par les sections 12.6 et 20.1 du Gold Master n'est pas terminé. Les crédits et leurs consommations ont un ledger immuable, mais leur valeur économique n'est ni classée en Core/Benefit Pool/Non alloué, ni transférée à la bibliothèque lors de consommation. Les P&L franchise restent alimentés par une commande manuelle distincte.

Les travaux `268000` d'Intégrations et `268010` de Client ne ferment pas ce manque. Les deux auteurs l'ont confirmé : admission d'abonnement réellement financé pour le premier ; provenance, mensualités, report et FEFO des crédits d'abonnement pour le second. Aucun nouveau revenu n'est reconnu lors de ces grants d'abonnement, ce qui évite un double comptage, mais ne réalise pas la ventilation initiale ni l'allocation ultérieure du Benefit Pool.

## Exigences vérifiées

Gold Master, lignes 1119–1131 et 4725–4735 :

- Séparation `CORE_SUBSCRIPTION_REVENUE`, `BENEFIT_POOL_REVENUE`, `UNALLOCATED_CREDIT_REVENUE`.
- Crédits achetés : revenu non alloué avant consommation, puis affectation à la bibliothèque réellement consommée.
- Promotions : revenu nul, coût de fulfillment possible.
- Core : aucune attribution arbitraire à une bibliothèque.
- Benefit Pool : attribution selon la valeur économique des consommations réelles de la période.
- Répartition franchise sur le bénéfice distribuable, distincte de la classification du revenu et avec TVA exclue.

## Chemin existant et manques démontrés dans le code

| Étape | Code actuel | Manque concret |
|---|---|---|
| Paiement abonnement vérifié | `20261031259000_payment_trusted_deployment_binding.sql:238–267` crée un journal `SUBSCRIPTION_PAYMENT`, débite le cash et crédite **tout** le montant dans `SUBSCRIPTION_REVENUE_<currency>` de l'organisation cliente. | Aucun calcul Core/Benefit Pool. Les deux pourcentages du plan ne sont pas lus par ce chemin. |
| Politique du plan | `20260912007000_subscription_plans_cycles.sql:6` impose que `core_allocation_basis_points + benefit_pool_allocation_basis_points = 10000`. `20260912013500` les projette. | Valeurs administrables existantes, mais aucune consommation comptable de ces valeurs dans le candidat primaire. |
| Pack acheté | `20260921170000_admin_catalog_demand_vault.sql:205–267`, `grant_credit_pack`, prend une référence de paiement texte, lit la version active puis appelle `issue_credits(EXTRA_PURCHASE, quantity, reference, price_minor, ...)`. | Ni capture vérifiée, ni paiement/journal lié par FK, ni preuve de montant/devise/organisation, ni revenu non alloué. Une référence libre n'est pas une preuve de paiement. |
| Émission des lots | `20260912009700_rewards_referral_audience_hardening.sql:28–31`, `issue_credits`, crée GRANT + lot + audit/outbox. Le lot contient `revenue_value_minor`; la devise n'est pas un argument et reste par défaut `MAD` (`20260912007300:47–51`). | Valeur fournie par appelant admin, sans pont comptable. Un pack autorise une devise autre que MAD mais son appel de grant ne transmet pas cette devise : le lot obtenu conserve MAD. Aucun mécanisme de conversion ne corrige ce fait. |
| Promotion | Le même `issue_credits` exige seulement `p_revenue_value_minor >= 0`, y compris pour `PROMOTION`, avec référence d'approbation. | Le contrat permet une valeur positive pour une promotion malgré le revenu nul exigé par le Gold Master. Ce constat est statique ; pas de test SQL effectué. |
| Consommation | `20260912013200_benefit_consumption_requires_delivery.sql:3–105`, `consume_benefit_credits`, exige DELIVERED, écrit les mouvements CONSUME, RELEASE/CONSUME du wallet, l'état, l'audit et `BenefitConsumedV1`. | Ne lit pas `revenue_value_minor`, ne calcule pas de valeur consommée et ne poste ni journal d'allocation ni P&L. Les réservations/libérations sont correctement distinctes des consommations de crédits, mais aucune allocation monétaire ne les suit. |
| Traitement asynchrone | Recherches des événements `BenefitConsumedV1`, `CreditPackGrantedV1`, `CreditsGrantedV1` et de `revenue_value_minor` dans les sources worker. | Aucun consommateur d'allocation économique identifié. Un événement outbox seul ne réalise pas le chaînage. |
| Coût/marge d'avantage | `20260913016600_v41_finops_margin_treasury.sql:119` enregistre les coûts réels ; `20260913016601_v41_finops_reconciliation_commands.sql:16` reçoit `p_revenue_minor` pour une photo de marge. | La photo de marge accepte un revenu fourni par son appelant technique, sans le dériver des lots/paiements. Elle n'est pas un ledger autoritatif d'allocation. Les coûts réels existent, mais aucun pont automatique vers le P&L franchise n'est identifié. |
| P&L franchise | `20260912006800_franchise_finance.sql:48–50`, `post_franchise_pnl_entry`, reçoit montant, source et journal d'un administrateur finance AAL2. Il impose `journal.organization_id = book.franchise_organization_id`. | Le journal de capture appartient à l'organisation cliente : on ne peut pas le transmettre directement à cette RPC pour une franchise. Aucun pont interne explicite ne traite cette frontière juridique/économique. |
| Clôture et distribution | `20260912006800:52` clôture les écritures P&L existantes et applique la règle versionnée. | Cette clôture ne prouve pas que toutes les consommations payées ont été allouées. Une mécanique de distribution correcte ne compense pas l'absence des revenus en amont. |

Recherche exhaustive des usages de `revenue_value_minor` dans les migrations primaires : définition, insertion, projection Admin et export DSR ; aucun calcul d'allocation identifié. Aucun des trois noms de classes économiques n'est utilisé dans ces migrations avant le nouveau lot proposé.

## Incidence des travaux en cours

`268010_credit_lot_canonical_payment_funding.sql` :

- Lie les lots **SUBSCRIPTION_GRANT** à un événement/cycle canonique, avec plafonds exacts, slots mensuels et politique de report versionnée.
- Fixe leur valeur de revenu à zéro, car le paiement est déjà inscrit au ledger abonnement.
- Vérifie les mouvements RESERVE/CONSUME et filtre le FEFO avant allocation des quantités.
- Les types autres que SUBSCRIPTION_GRANT, dont EXTRA_PURCHASE, retournent actuellement `ELIGIBLE` dans `credit_lot_funding_status_v1`; leur financement n'est pas vérifié par ce lot.
- Ne crée aucun journal ni ledger monétaire d'allocation. Ne pas utiliser ses crédits d'abonnement de valeur zéro comme si le Benefit Pool avait un budget nul.

`268000_subscription_funding_admission.sql` :

- Vérifie événement/intent/cycle exacts, journal équilibré, environnement et période réelle avant admission.
- N'impose pas un compte unique de revenu : un futur découpage équilibré reste compatible.
- Ne modifie ni le journal de capture ni ses catégories.

## Lot distinct proposé, sans taux ni politique inventés

1. **Sources de financement immuables.** Événement de paiement vérifié, facture/taxes canoniques, version de plan ou pack, devise, montant net attribuable et journal de capture doivent être liés sans référence libre comme preuve. Pour EXTRA_PURCHASE, créer le contrat d'achat/capture distinct ou une vraie preuve de règlement gouvernée ; ne pas réutiliser un paiement abonnement déjà affecté pour financer un pack. Les lots historiques sans source exacte restent non vérifiés pour l'allocation, sans réécriture des soldes.

2. **Classification économique append-only.** Ledger interne distinct avec les trois classes exigées, FK vers les sources et politique approuvée. Le split abonnement utilise exclusivement les bps de la version réellement payée et une règle d'arrondi approuvée ; les montants doivent se conserver exactement. Ne pas réécrire le journal légal existant, ne pas créer un second encaissement et ne pas traiter la TVA comme revenu. Toute reclassification comptable légale éventuelle exige une politique comptable et un mapping de comptes approuvés.

3. **Allocation des crédits achetés à la consommation.** Réagir au fait natif CONSUME et à sa quantité exacte par lot. Enregistrer source payée, mouvement, bénéfice/version, bibliothèque de cette version, devise, valeur, règle et empreinte. Calcul exact avec reliquat selon politique d'arrondi approuvée ; cumul alloué inférieur ou égal au financement, égalité à consommation complète. Aucun revenu à RESERVE/RELEASE, et aucun revenu promotionnel. Unicité sur mouvement/source, audit et outbox dans la même transaction. Aucun UPDATE/DELETE du wallet, des lots ou des anciennes écritures.

4. **Benefit Pool d'abonnement distinct.** Budget dérivé du split effectivement financé, puis répartition selon les consommations réelles et leurs valeurs économiques versionnées. Ne pas déduire un taux du simple nombre de crédits ni attribuer le Core. La période de rattachement, le traitement du report et le dénominateur doivent relever d'une politique approuvée ; aucune règle de remplacement inventée si elle manque.

5. **Pont P&L interne explicite.** Allocation de bibliothèque vers un livre/mandat économique exact, courant à l'événement et épinglé. Aucune sélection du premier livre d'une bibliothèque, aucun mélange de deux mandats. Construire une source P&L interne contrôlée qui respecte la frontière journal client / opérateur franchise, sans fabriquer un paiement intersociétés. Conserver les règles IT et standard existantes. Les types de sources canoniques doivent être réservés au moteur pour empêcher qu'une saisie P&L manuelle les reproduise ou les double.

6. **Remboursements et rapprochement.** Écritures inverses liées aux allocations originales, plafonds, idempotence et conservation par devise. Le traitement des restes expirés et du financement remboursé reste une politique approuvée. Avant une clôture franchise, contrôler qu'aucune consommation admissible/aucun coût requis n'est omis ; une anomalie doit être visible et bloquante, pas assimilée à zéro. Une correction après clôture produit une nouvelle version/écriture, jamais une réécriture historique.

Le choix d'une politique comptable réelle, des règles de périodes et d'arrondi n'est pas fourni par cet audit. L'outillage peut être construit pour exiger ces politiques ; aucun défaut de configuration ne doit générer une politique de production fictive.

## Responsabilités à coordonner avant écriture

| Propriétaire proposé | Frontière |
|---|---|
| Intégrations/paiements | Capture canonique des packs achetés, réconciliation des remboursements, source de financement et hook de classification du paiement ; conserver `268000`. |
| Client/crédits | Provenance/FEFO et mouvements de quantité ; conserver `268010`, exposer le fait CONSUME exact sans introduire un second wallet. Aucun moteur de revenu dans l'UI. |
| Nouveau lot Finance/Franchise, propriétaire unique à désigner par root | Ledger économique append-only, budget Core/Benefit/Unallocated, allocation par mouvement, pont bibliothèque/livre/mandat, inversions et rapprochement. Consommer les faits canoniques des deux autres domaines. |
| Admin/Finance | Gouvernance des politiques et mappings, examen des sources historiques, anomalies d'allocation, garde de clôture et export rapproché. |
| Audit Release indépendant | Recette réelle paiement → lot → réservation → livraison → consommation → allocation → P&L/clôture, avec conservation, isolation, replay et concurrence. |

## Preuves nécessaires avant clôture

- Capture vérifiée et journal équilibré ; split du bon plan ou pack, bases HT/TVA exactes, devises distinctes sans conversion implicite.
- Consommation partielle puis complète d'un lot, conservation du reliquat selon politique et absence de revenu à la réservation/libération.
- Deux consommations concurrentes, replay et livraison asynchrone dupliquée : une allocation unique, aucun dépassement du montant financé.
- Promotion à revenu nul et coût réel positif ; un pack non-MAD conserve sa devise de bout en bout.
- Core jamais attribué à une bibliothèque ; Benefit Pool distinct de la valeur zéro des lots d'abonnement.
- Mauvaise organisation, bibliothèque sœur, livre/mandat ambigu, source non payée, politique absente et remboursement : refus effectif ou état d'anomalie explicite.
- P&L relié à sa source exacte sans nouveau cash artificiel ; coûts inclus avant calcul du bénéfice et règles de distribution existantes inchangées.
- Corrections/annulations et clôtures antérieures conservées, absence de réécriture de ledger et preuve d'absence de double allocation.

Ces preuves restent à développer et à exécuter. Cet audit n'annonce aucun PASS économique ou comptable.
