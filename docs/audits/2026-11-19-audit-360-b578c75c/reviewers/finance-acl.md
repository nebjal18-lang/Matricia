Je vais vérifier les ACL, la politique RLS et le contexte d’exécution du trigger. L’erreur observée peut révéler un blocage du commit natif ; dans ce cas, il faudra distinguer les écritures transitoires des défauts financiers effectivement persistables.

**Oui : nouveau finding P1 bloquant pour la clôture Core native sous `authenticated`.** J’avais manqué ce blocage ; il faut requalifier la portée runtime des constats précédents. Aucun P0 ni double versement effectif n’est démontré.

Les vérifications locales, uniquement `READ ONLY`, confirment :

- [Le trigger d’équilibrage](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:135) est **`SECURITY INVOKER`** (`prosecdef=false`).
- [Son exécution est différée](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:420), initialement jusqu’à la fin de transaction.
- [Sa lecture des clôtures](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:139) applique [une politique RLS utilisant le helper](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:433).
- [L’EXECUTE du helper est révoqué](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:441). ACL actuelle : `{postgres=X/postgres}` ; `has_function_privilege('authenticated', …, 'EXECUTE') = false`.

La RPC s’exécute comme propriétaire, mais le contrôle différé intervient après son retour, sous le rôle appelant. **Ton erreur `42501` au contrôle différé confirme ce chemin runtime.** Un `COMMIT` conservant ce rôle devrait rencontrer le même obstacle ; le commit lui-même n’a toutefois pas été testé.

| Point | Qualification précise |
|---|---|
| **Nouveau défaut ACL/trigger — P1** | Blocage runtime de la validation différée confirmé par ton exécution ; cause confirmée par code et ACL. |
| **Montant non rapproché — P1 statique** | Le posting a pu être accepté dans la transaction, mais aucune persistance n’est démontrée après son rollback. **Ce trigger ne bloque pas un posting isolé**, qui ne crée aucune allocation ; son commit reste à vérifier séparément. |
| **Chevauchement — P1 latent** | Les chemins autorisent les deux clôtures et doubles accruals, mais **des droits transitoires ne prouvent pas des droits committables sous `authenticated`**. Le nouveau blocage masque actuellement cette conséquence. |
| **Rejeu — P2 statique** | Le défaut d’empreinte reste établi ; son observation dans la variante propriétaire sera une preuve diagnostique, distincte d’un parcours natif committable. |

La validation sous propriétaire convient pour isoler les défauts de calcul, en gardant les appels métier sous `authenticated` :

```sql
-- Après les appels natifs, uniquement pour le diagnostic :
RESET ROLE;
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
SET LOCAL ROLE authenticated;
```

Même sans nouveau `GRANT`, **cela change le contexte de validation** : les tables appartiennent à `postgres`, avec RLS activée mais sans `FORCE ROW LEVEL SECURITY`. Cette variante démontre éventuellement le double calcul ; elle ne démontre pas sa persistance par le parcours natif.

Pour consolidation, j’ajouterais :

> **P1 — Clôture Core impossible à valider sous le rôle applicatif : trigger différé INVOKER dépendant d’un helper RLS non exécutable.** Exigence : clôture financière fonctionnelle (§16.6, MAT-FUNC-030). Tester le chemin autorisé jusqu’à validation des contraintes sous `authenticated`, puis les rejets métier. Corriger séparément le contexte du contrôle différé et les permissions nécessaires aux lectures RLS légitimes.

Le rollback avec organisation restante à zéro confirme ici l’annulation des fixtures ; **aucune corruption persistée n’a été observée**. Aucune modification ni exécution mutante de mon côté.
