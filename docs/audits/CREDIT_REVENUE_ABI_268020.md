# ABI 268020 — financement et allocation économique

Propriétaire SQL/tests0247/UI allocation : Franchise. Ports checkout/webhooks : Intégrations. Provenance/FEFO/consume/reserve : Client268010. Livraison effective : root268030. Aucun point commun ne doit être remplacé sans coordination.

## Invariants arbitrés par root

- Pas d'encaissement externe avant une préparation comportant un mapping comptable approuvé à quatre yeux. Les comptes de cash ASSET et d'encaissement en attente LIABILITY sont créés/résolus et épinglés à cette préparation avant le gateway.
- Une capture d'un intent déjà préparé est conservée avec son journal équilibré d'attente, même si la politique a depuis expiré. L'absence de facture/contexte fiscal n'autorise ni la perte du callback payé, ni une base HT ou une TVA inventée.
- La classification fiscale et le P&L restent explicitement en attente jusqu'à une source fiscale canonique ou une décision gouvernée référencée. Le TTC n'est jamais annoncé comme bénéfice.
- Ledger append-only ; aucune réécriture des journaux, wallets, lots, clôtures ou répartitions antérieurs. Aucun cash intersociétés fictif.
- Les anciens packs à référence de paiement libre ne sont pas requalifiés en paiements prouvés.

## Checkout et callbacks : contrats proposés à Intégrations

Tous les montants JSON sont des chaînes décimales entières ; SQL reçoit des bigint. UUID est une chaîne UUID. `provider_environment` est DEMO/SANDBOX/LIVE, jamais UNVERIFIED.

```text
prepare_credit_pack_payment_intent_v1(
 p_organization_id uuid, p_pack_version_id uuid, p_gateway text,
 p_provider_environment text, p_idempotency_key text
) -- authenticated CLIENT_OWNER/CLIENT_ADMIN, organisation admissible
=> {preparation_id:uuid, amount_minor:string, currency:string,
    gateway:string, provider_environment:string, purchase_kind:'CREDIT_PACK',
    pack_version_id:uuid, expires_at:timestamp}

register_credit_pack_payment_intent_v1(
 p_preparation_id uuid, p_provider_environment text, p_provider_intent_id text,
 p_amount_minor bigint, p_currency char(3), p_correlation_id uuid
) -- service_role uniquement après vraie réponse du gateway
=> {payment_intent_id:uuid}

prepare_credit_pack_payment_capture_v1(
 p_payment_intent_id uuid, p_provider_environment text
) -- authenticated, propriétaire réel de l'intent, PayPal uniquement
=> {payment_intent_id:uuid, provider_intent_id:string, amount_minor:string,
    currency:string, gateway:string, provider_environment:string,
    replayed:boolean, capture_result:object|null}

process_verified_credit_pack_payment_v1(
 p_provider_environment text, p_gateway text, p_provider_event_id text,
 p_provider_intent_id text, p_event_type text, p_amount_minor bigint,
 p_currency char(3), p_paid_at timestamptz, p_payment_reference text,
 p_payload_hash text, p_signature_fingerprint text, p_correlation_id uuid
) -- service_role, après le vérificateur natif de signature
=> {outcome:'CREDIT_PACK_CAPTURED', payment_event_id:uuid,
    payment_intent_id:uuid, credit_lot_id:uuid, wallet_id:uuid,
    financial_journal_id:uuid, economic_status:string, replayed:boolean}

process_verified_credit_pack_adjustment_v1(
 p_gateway text, p_provider_environment text, p_provider_event_id text,
 p_provider_payment_id text, p_provider_adjustment_id text, p_event_type text,
 p_amount_minor bigint, p_currency char(3), p_occurred_at timestamptz,
 p_payload_hash text, p_signature_fingerprint text,
 p_merchant_reference text, p_correlation_id uuid
) -- contrat de remboursement/litige à stabiliser avec Intégrations
=> {received:true, replayed:boolean, economic_status:string}
```

`process_verified_credit_pack_payment_v1` reprend les noms d'arguments du callback abonnement v2. La préparation et le callback valident `private.assert_payment_runtime_v1(gateway,provider_environment,false)`, le binding de déploiement, le contexte figé, le prix/devise exacts et les identifiants natifs. Le helper d'intent abonnement n'est pas utilisé pour un pack.

Le gateway doit porter le kind CREDIT_PACK nativement dans son contrat interne ; un pack ne doit pas être présenté comme une version de plan abonnement. Le callback résout le kind depuis une référence fournisseur déjà enregistrée, jamais depuis un champ libre envoyé par le navigateur.

ABI du résolveur service proposé :

```text
resolve_verified_payment_kind_v1(
 p_gateway text, p_provider_environment text,
 p_provider_intent_id text default null, p_payment_reference text default null
) => {kind:'SUBSCRIPTION'|'CREDIT_PACK', payment_intent_id:uuid}
```

Une référence absente ou ambiguë ne route aucun paiement. La réservation d'une référence fournisseur doit être sérialisée pour les deux kinds ; registre privé unique et triggers sur leurs tables d'intents à coordonner avec Intégrations avant ajout. Les anciens identifiants non vérifiés ne sont pas légitimés par un backfill supposé.

## Provenance des lots et consommation

- Nouveau lot acheté : référence exacte `credit-pack-payment:<payment_event_uuid>`, quantity/expiry/currency issus de la version de pack et de la capture figées. `revenue_value_minor` est la valeur HT connue ou zéro si valuation encore en attente ; une valuation ultérieure est une écriture additionnelle, jamais un UPDATE du lot.
- Branche EXTRA de `private.credit_lot_funding_status_v1(uuid)` étendue en préservant son OID et toutes ses branches SC/gifts. Un lot acheté non prouvé est SOURCE_UNVERIFIED ; un paiement natif admissible reste financièrement réel même si sa classification fiscale est en attente. Les holds et environnements sont vérifiés.
- Hook distinct AFTER UPDATE vers CONSUMED de `benefit_redemptions`. Il observe tous les mouvements CONSUME exacts, la preuve effective fournie par root268030, le lot, sa capture et la version d'avantage. Il ne modifie pas consume/reserve ni les quantités de crédits.
- En l'absence de politique fiscale/d'allocation ou de mandat exact : fait de consommation conservé, état d'attente explicite, aucune écriture de bénéfice. Le rapprochement reprendra idempotemment après une décision gouvernée.

Preuve268030 : `private.benefit_accepted_receipt_v1(redemption_uuid,proof_hash)` renvoie un JSON canonique ou NULL. Son type actuel est `OPERATIONAL_REPORT_WITH_INDEPENDENT_CLIENT_RECEIPT` : rapport opérationnel humain et réception indépendante sous MFA, **sans affirmation de scan ni d'octets livrés**. Une politique ALLOCATION doit explicitement contenir `accepted_evidence_kinds` et `fulfillment_modes`; sinon l'attribution financière reste en attente.

## Politiques et frontières économiques

- POSTING : cible exacte pack/version/devise/environnement, codes/comptes cash et attente distincts, approbation indépendante. Pas de mapping implicite de production.
- FISCAL : facture canonique ou contexte fiscal approuvé explicitement pour PLAN/PACK. Réutiliser une version fiscale existante en la référençant pour ce produit ; pas de taux seedé ni d'inférence TTC→HT hors contexte.
- ALLOCATION : arrondi explicite, conservation par devise, périmètre/période et traitement du report du Benefit Pool. Paramètres réels soumis à quatre yeux ; aucune politique de remplacement silencieuse.
- BOOK_ROUTE : bibliothèque et mandat/livre exacts, portée organisation et date de consommation. Aucune sélection du premier livre. Pont P&L interne avec source réservée et référence au journal client, sans faux transfert de cash entre entités.
- Core reste central. Crédits achetés : allocation immédiate de leur valeur canonique consommée. Benefit Pool : consommations valorisées puis règlement de période gouverné, sans attribuer le Core ni doubler le revenu des crédits d'abonnement de valeur zéro.
- Remboursements : inversions append-only des allocations sources et plafonds. Aucun UPDATE/DELETE de revenu passé. Une clôture ne doit pas masquer une allocation admissible encore en anomalie.

## UI centrale

Export gelé : `modules/franchise/screens/economic-revenue/workspace.tsx`, `EconomicRevenueWorkspace({locale,page=1,status='ALL'})`.

Route fournie par Admin : `/administration/allocations-economiques`. File paginée25, FR/AR, statuts d'attente avec raison et prochaine action, politiques et approbation indépendante, source de paiement/journal/fiscalité, allocations par bibliothèque/mandat, rapprochement et clôture de pool. Les états nouveaux seront documentés avant raccord de filtres.

La recette0247 devra produire une preuve réelle de la chaîne financée, des conservations/arrondis/replays/concurrences et des refus. Ce document ne revendique aucune recette exécutée de268020.

## Ordre des migrations et dépendances

- 268000 : admission des abonnements financés (Intégrations).
- 268001 : reçus/tentatives durables (Intégrations), installation indépendante des helpers268020 ; résolution différée explicite et refus du checkout si le helper manque. Les reçus déjà payés restent PENDING_LEDGER_CONFIGURATION. Si cette indépendance ne peut être tenue avant application, emplacement268025 réservé par root pour ce lot Intégrations.
- 268010 : source/termes/FEFO des lots d'abonnement (Client).
- 268020 : tables, gouvernance, mapping de paiement, registre de routage et capture des packs ; aucune valeur fiscale supposée.
- 268021/268022 : classification/allocation et forwards éventuels (Franchise).
- 268030 : rapport opérationnel et réception indépendante (root).
- 268031/268032 : hook CONSUMED et éléments dépendant du helper268030 (Franchise), si leur placement après sa définition est nécessaire. Avant cela, aucun constructeur ne peut produire une allocation sans la preuve native.
- 268040 : liaison service immuable de la mission (Client).
- 268050 : gouvernance des cadeaux manuels (Admin), hors EXTRA_PURCHASE et SUBSCRIPTION_GRANT prouvés.

Le core privé APPLIED à patcher uniquement dans son bloc journal est `private.process_subscription_payment_context_core_v1(text,text,text,text,text,bigint,char(3),timestamptz,text,text,text,uuid)`. Toute transformation exige un bloc source unique reconnu ou échoue. L'OID et le wrapper public d'Intégrations sont conservés. Une capture native = un seul journal cash ; sourceKey `gateway:provider_environment:nativeCaptureReference` et corrélation du premier reçu restent immuables.
