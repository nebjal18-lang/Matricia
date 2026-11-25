# Règle économique — partenariats Matricia (V1)

**Statut :** autorité métier confirmée Jalil le 2026-11-12 ; reprise dans le Gold Master (décisions prioritaires §5) et `AGENTS.md`.  
**Implémentation code :** migration `supabase/migrations/20261112200000_platform_core_pot_finance.sql` ; test `supabase/tests/0386_platform_core_pot_finance.test.sql` ; constante TS `PLATFORM_CORE_POT_ECONOMICS` (`packages/legal-v41`).  
**Monnaie / exactitude :** unités mineures ou décimaux exacts ; jamais de `float` ; TVA ≠ revenu.

## A — Parts par franchise (inchangées)

| Périmètre | Répartition |
|---|---|
| Bénéfice distribuable **IT** | 50 % Hatim Ahmitech / 50 % Jalil-NEOXA / **0 %** Mme Asma |
| Autres franchises | 50 % franchisé / 25 % Jalil-NEOXA / 25 % Mme Asma |
| Droit d’entrée IT | 0 (Hatim exempt) |

Le bénéfice IT et les bases 50/25/25 restent des ledgers franchise distincts. Hatim conserve 50 % du bénéfice distribuable IT.

## B — Pot Core + droits d’entrée (nouveau, distinct)

**Entrent dans le pot (HT acquis, définitifs) :**

- `CORE_SUBSCRIPTION_REVENUE` (accès plateforme)
- droits d’entrée franchise encaissés (`franchise_entry_fee_ledger`), hors IT

**N’y entrent pas :**

- bénéfice / P&L IT
- bases distribuables des autres franchises
- factures client → sous-traitant
- TVA collectée
- crédits encore non alloués / promo à revenu 0 (sauf règle versionnée ultérieure)

**Ordre de calcul :**

```text
Pot = Core HT acquis + droits d’entrée HT acquis
    − remboursements / avoirs liés à ce pot
    − marketing affecté à ce pot (versionné)
    − charges d’exploitation affectées à ce pot (versionnées)
= reste distribuable plateforme
→ 50 % Jalil-NEOXA / 50 % Mme Asma-Matricia
```

Clôture avec snapshot de règle + formule de coûts ; ledger immuable ; audit + outbox ; pas de rewrite de solde.

## C — Séparation obligatoire

| Flux | Qui partage |
|---|---|
| P&L IT après coûts IT | Hatim 50 % / Jalil 50 % |
| Autre franchise | Franchisé 50 % / Jalil 25 % / Asma 25 % |
| Reste pot Core + entrée après charges | Jalil 50 % / Asma 50 % |

Un admin ne peut pas fusionner ni réécrire ces droits hors règle contractuelle versionnée.
