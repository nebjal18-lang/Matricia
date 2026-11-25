J’intègre ces résultats aux niveaux de preuve. Je vais vérifier les éventuelles exceptions au blocage ACL et le formatter de Casablanca, sans exécuter de mutation.

Analyse confirmée, avec cette qualification pour consolidation :

| Constat | Gravité | Niveau de preuve |
|---|---|---|
| Journal de dépense **100**, revenu comptable **0**, Core accepté **10 000** | **P1** | **Runtime natif confirmé jusqu’à validation de toutes les contraintes sous `authenticated`**, puis rollback vérifié. Aucun commit conservé. |
| Clôture bloquée par ACL/trigger différé | **P1 bloquant** | **Runtime confirmé**, y compris ACL d’origine : helper non exécutable, trigger INVOKER et lecture soumise à RLS. |
| Revenu **10 000 → droits 20 000** | **P1 latent** | **Runtime diagnostique confirmé sous validation propriétaire**. Persistance native actuellement bloquée par le défaut ACL. |
| Rejeu → `22000 / IDEMPOTENCY_PAYLOAD_MISMATCH` | **P2** | **Runtime diagnostique confirmé**, avec la même limite de contexte. |

Le mécanisme ACL reste cohérent avec le [trigger INVOKER](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:135), la [politique RLS](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:433) et la [révocation d’EXECUTE](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:441).

**Aucun contre-exemple permettant une clôture native valide sous `authenticated` n’a été identifié.** Deux précisions :

- Le rôle métier Finance et `aal2` ne confèrent pas l’EXECUTE SQL manquant. La validation propriétaire explique le succès diagnostique, sans démontrer un commit applicatif.
- Passer les contraintes en mode immédiat **avant** la RPC ne constitue pas une solution : [les allocations sont insérées successivement](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:336), alors que le trigger exige déjà deux allocations. La première insertion devrait donc échouer avec `UNBALANCED_PLATFORM_CORE_POT_ALLOCATION` — conséquence statique, non exécutée ici.

Le défaut de date est également **reproduit localement** dans [formatDateTimeCasablanca](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/apps/web/modules/shared/lib/format/display.ts:16) :

- Entrée : `2026-03-01T23:30:00Z`
- Fonction : **2 mars 2026, 00:30**
- `Intl` avec `Africa/Casablanca` : **1 mars 2026, 23:30**

Mon runtime utilise Node `24.11.0`, tzdata **2025b** ; il reproduit donc aussi ton résultat obtenu avec **2026e**. **P2 confirmé pour l’affichage**, avec changement erroné du jour civil ; aucune dérive du calcul SQL des échéances n’est démontrée. Le décalage fixe contredit le [fuseau exigé par le Gold Master](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:458). Les [tests actuels](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/apps/web/modules/shared/lib/format/display.test.ts:17) couvrent novembre, sans ce cas de mars.

Aucune modification ni exécution SQL mutante de mon côté.
