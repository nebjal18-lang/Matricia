# Revue indépendante — finance

Source : agent en worktree isolé au commit b578c75c. Texte de revue conservé comme preuve ; voir FINDINGS.md pour la consolidation, la gravité et les limites actualisées.

Created isolated worktree for branch `agents/independent-audit-matricia-review-b62a6213`

Je vais auditer les flux financiers ciblés en lecture seule, de PostgreSQL jusqu’à l’UI et aux tests. Je vérifierai le HEAD audité et signalerai la limite liée aux deux modifications staged conservées par le coordinateur.

Le worktree est propre et pointe bien sur `b578c75c1c0f076c7fb46b0239d7ab5f2b0afc4c`. J’applique les skills Matricia d’audit, de finance franchise, de facturation, d’invariants métier et de Supabase/RLS. Les deux modifications staged du coordinateur ne sont pas présentes ici et restent hors audit.

Les premières vérifications montrent que le pot Core est séparé des P&L franchise et que ses tables sont protégées contre les mises à jour et suppressions. Je vérifie maintenant les clôtures et leurs reprises : la gestion d’idempotence du pot diffère de celle du moteur franchise, corrigée dans des migrations antérieures. J’ai aussi trouvé deux migrations portant le même identifiant.

Les contrôles PostgreSQL en transaction `READ ONLY` confirment deux défauts de reprise du pot Core : la clôture inclut le numéro de version généré dans son empreinte d’idempotence, et le payout vérifie le solde avant de rechercher une réponse déjà enregistrée. Je poursuis sur les remboursements, la provenance des revenus et la facturation automatique pour préciser leurs conséquences et les tests manquants.

Les 24 prédicats structurels du test SQL du pot Core passent en lecture seule. Ils vérifient les tables, droits, triggers et fragments de fonctions ; ils ne rejouent pas les opérations métier. Les contrôles en mémoire passent aussi pour l’arithmétique `bigint`, les répartitions et l’exemption IT. L’affichage fiscal partagé perd toutefois un centime pour un montant au-delà de la précision sûre de JavaScript.

L’examen du parcours UI → contrats TypeScript → RPC → ledger → tests est terminé pour le volume, les remboursements d’avantages et la clôture fournisseur. Les principaux écarts se concentrent sur le pot Core : provenance des écritures insuffisamment contrôlée, périodes pouvant se chevaucher et remboursements sans revalidation avant distribution. Les tests SQL du volume passent leurs 30 contrôles structurels, mais ne couvrent pas le rejeu après consommation complète.

Audit terminé sur `b578c75c1c0f076c7fb46b0239d7ab5f2b0afc4c`. **Je ne recommande pas de valider l’intégrité financière du pot Core en l’état.** Les constats ci-dessous concernent uniquement le périmètre financier demandé.

Aucun fichier, index Git, secret ou donnée métier n’a été modifié. Les contrôles PostgreSQL ont été exécutés en transaction `READ ONLY`.

L’analyse applique le [Gold Master V4 FINAL](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:13) et la [règle économique Core + entrée](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/docs/finance/REGLE_ECONOMIQUE_PARTENARIAT_CORE_ENTREE_V1.md:19).

**Constats confirmés**

Les scénarios RPC ci-dessous constituent les reproductions à exécuter sur fixtures jetables. Je n’ai exécuté aucune mutation métier : la confirmation repose sur le chemin de code, les contraintes SQL et les vérifications locales précisées.

1. **P1 — Le pot accepte des montants sans preuve économique correspondant au journal.**

   **Fichier :** [supabase/migrations/20261112200000_platform_core_pot_finance.sql:243](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:243).

   Le posting vérifie l’organisation, la devise et le statut `POSTED` du journal. Il ne rapproche pas le montant demandé de ses lignes comptables et ne vérifie pas l’existence de la source déclarée. L’unicité porte sur une référence source fournie par l’appelant.

   **Reproduction :** avec un acteur Finance autorisé, utiliser un journal valide de 100 unités mineures pour poster un revenu de 10 000, puis réutiliser ce journal avec une autre référence source. Ces contrôles ne rejettent ni l’écart ni cette réutilisation. La clôture calcule ensuite les droits depuis les montants ainsi déclarés.

   **Impact :** création de bénéfice distribuable sans encaissement HT correspondant ; séparation économique et exclusion de TVA insuffisamment garanties.

   **Exigence :** §§16.6 et 20.5 ; MAT-FUNC-030/032. **Recommandation/test :** imposer une source canonique, vérifier montant HT, journal, devise, date et absence de réutilisation ; tester journal sans rapport, montant majoré et doublon sous références différentes.

2. **P1 — Des clôtures qui se chevauchent peuvent distribuer deux fois le même revenu.**

   **Fichier :** [supabase/migrations/20261112200000_platform_core_pot_finance.sql:306](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:306).

   Le verrou et la recherche de clôture précédente utilisent le couple exact début/fin. Aucun contrôle n’interdit un autre intervalle chevauchant. La seule contrainte unique est `(book_id, period_start, period_end, version)`, confirmée dans PostgreSQL.

   **Reproduction :** un revenu de 10 000 daté du 14 novembre ; clôturer du 12 au 15, puis du 14 au 16 avec une autre clé. Chaque intervalle retrouve ce revenu et considère sa clôture comme initiale : les droits cumulés atteignent 20 000.

   **Impact :** double comptabilisation des droits distribuables. Des périodes différentes utilisent également des verrous différents.

   **Exigence :** §16.6 et conservation des allocations. **Recommandation/test :** sérialiser au niveau du livre, interdire les chevauchements distincts et réserver les corrections au versionnage du même intervalle ; tester les appels séquentiels et concurrents.

3. **P1 — Un remboursement natif ne bloque pas la distribution du revenu Core antérieur.**

   **Fichiers :** [supabase/migrations/20261113100000_platform_core_pot_ingest_sources_v1.sql:35](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261113100000_platform_core_pot_ingest_sources_v1.sql:35) et [supabase/migrations/20261031268023_subscription_refund_frozen_posting_accounts.sql:27](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261031268023_subscription_refund_frozen_posting_accounts.sql:27).

   L’ingestion accepte une écriture Core positive et vérifie seulement l’existence du financement. Un remboursement natif marque ce financement `SOURCE_REVIEW_REQUIRED`, avec `NATIVE_REFUND_REQUIRES_FISCAL_REVERSAL`. L’ingestion, la clôture et le payout du pot ne consultent pas cette invalidation ; aucune contre-écriture du pot n’est imposée.

   **Reproduction :** classifier un abonnement, ingérer sa part Core, puis enregistrer son remboursement canonique. Sans correction manuelle, la clôture conserve le revenu initial. Le contrôle local des fonctions confirme l’absence de revalidation des sources de crédit dans la clôture et le payout.

   **Impact :** des sommes remboursées restent distribuables.

   **Exigence :** §16.6 et règle du pot : encaissements définitivement acquis, diminués des remboursements/avoirs. **Recommandation/test :** bloquer clôture et versement tant que les événements défavorables ne sont pas rapprochés ; produire des contre-écritures immuables. Tester remboursement avant ingestion, avant clôture et avant payout.

4. **P2 — Les reprises du pot Core ne sont pas correctement idempotentes.**

   **Fichiers :** [supabase/migrations/20261112200000_platform_core_pot_finance.sql:318](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:318) et [supabase/migrations/20261112200000_platform_core_pot_finance.sql:392](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261112200000_platform_core_pot_finance.sql:392).

   La clôture calcule la prochaine version puis l’intègre à l’empreinte de requête. Après succès, un rejeu identique calcule une version différente et provoque `IDEMPOTENCY_PAYLOAD_MISMATCH`.

   Le payout vérifie le solde avant de rechercher une réponse déjà enregistrée. **Reproduction :** verser la totalité d’un solde, puis rejouer exactement la requête : le solde devenu nul déclenche `INSUFFICIENT_PLATFORM_CORE_POT_BALANCE` avant le rejeu. La même disposition affecte les annulations d’écritures, validées avant la recherche d’idempotence.

   **Impact :** après perte de réponse réseau, l’appelant reçoit une erreur malgré une opération engagée.

   **Exigence :** §5.6. **Recommandation/test :** identifier la commande depuis ses paramètres stables et restituer son résultat avant les validations dépendant de son effet précédent ; tester les trois rejeux après commit.

5. **P2 — Le volume refuse le rejeu après allocation ou consommation complète.**

   **Fichier :** [supabase/migrations/20260912006600_volume_procurement_pools.sql:278](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20260912006600_volume_procurement_pools.sql:278), et consommation à [la ligne 302](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20260912006600_volume_procurement_pools.sql:302).

   L’allocation exige encore `RESERVED` avant de rechercher le résultat enregistré ; une allocation complète produit `COMMITTED`. La consommation vérifie également son état avant l’idempotence ; une consommation complète produit `CONSUMED`.

   **Reproduction :** allouer toute une réservation puis rejouer la même clé : `RESERVATION_NOT_ALLOCATABLE`. Consommer entièrement puis rejouer : `RESERVATION_NOT_CONSUMABLE`. L’ordre de ces gardes a été confirmé dans les fonctions PostgreSQL, identiques au HEAD.

   **Impact :** reprise réseau ambiguë dans les parcours financiers volume.

   **Exigence :** §§5.6 et 21. **Recommandation/test :** vérifier l’autorisation, rechercher le résultat canonique, puis appliquer les gardes de transition aux commandes nouvelles ; ajouter les deux tests de rejeu.

6. **P2 — L’affichage financier partagé perd la précision des montants `bigint`.**

   **Fichier :** [apps/web/modules/shared/lib/format/display.ts:32](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/apps/web/modules/shared/lib/format/display.ts:32).

   Le formatter convertit la chaîne monétaire en `Number`, puis divise par 100. Il est notamment utilisé par le [simulateur fiscal](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/apps/web/modules/admin/screens/fiscalite-maroc/tax-panel.tsx:461).

   **Preuve exécutée :** les entrées `9007199254740993` et `9007199254740992` produisent toutes deux `90.071.992.547.409,92 MAD`. La première devrait conserver `,93`.

   **Impact :** affichage inexact ; aucune altération du ledger n’a été démontrée par ce défaut.

   **Exigence :** §5.4. **Recommandation/test :** réutiliser le [formatter exact existant](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/apps/web/modules/shared/lib/commercial-documents/money.ts:10) ; couvrir les limites `bigint`, signes, FR/AR et décimales des devises.

7. **P1 — Deux migrations partagent le même identifiant.**

   **Fichiers :** [supabase/migrations/20261118160000_ensure_demo_admin_platform_role_v1.sql:1](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261118160000_ensure_demo_admin_platform_role_v1.sql:1) et [supabase/migrations/20261118160000_reset_demo_box_network_v1.sql:1](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/migrations/20261118160000_reset_demo_box_network_v1.sql:1).

   **Preuve exécutée :** le regroupement des migrations par préfixe retourne ces deux fichiers pour `20261118160000`. PostgreSQL confirme `PRIMARY KEY(version)` dans l’historique ; une seule entrée existe localement, nommée `reset_demo_box_network_v1`.

   **Impact :** les deux migrations ne peuvent pas être suivies séparément par cet historique ; la reproductibilité du schéma livré est compromise.

   **Exigence :** migrations rejouables et preuves depuis une base propre. **Recommandation/test :** attribuer des identifiants uniques en tenant compte des environnements déjà migrés, puis démontrer un replay complet sur une base jetable.

**Points conformes vérifiés**

- Les règles SQL imposent pour IT : Hatim, exemption d’entrée et répartition 50/50/0. La configuration STANDARD vérifiée conserve 50/25/25.
- Le pot Core possède des tables distinctes, une règle 50/50 et des snapshots de clôture.
- Les triggers d’immutabilité sont présents sur les journaux, écritures financières, crédits, transactions d’inventaire et consommations fournisseurs. Les six historiques du pot sont également protégés.
- Aucune colonne `real` ou `double precision` dans les cinq tables économiques ciblées.
- Le calcul fiscal exact passe les contrôles d’arrondi positif, négatif et au-delà de la précision sûre JavaScript.
- Le remboursement d’avantage conserve les lots d’origine, applique une revue indépendante et écrit crédit, contre-allocation, audit et outbox dans la même transaction.

**Contrôles et limites**

- **24/24** prédicats structurels du [test du pot Core](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/tests/0386_platform_core_pot_finance.test.sql:4) et **30/30** du [test volume](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/tests/0049_p12_volume_procurement_pools.test.sql:5) réévalués en lecture seule. Cela ne constitue pas une exécution comportementale complète de pgTAP.
- **11 assertions** monétaires/IT et **8 assertions** du scheduler fournisseur passent en mémoire. Les RPC du scheduler étaient simulées.
- Parcours examinés : volume ; remboursement d’avantage ; clôture fournisseur jusqu’au rapprochement. Les [tests de remboursement](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/tests/0332_governed_benefit_refunds.test.sql:281) et de [clôture/paiement](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/supabase/tests/0360_provider_finance_close_to_payment.test.sql:418) ont été lus, sans exécuter leurs fixtures mutantes.
- Pas d’E2E, de PSP réel, de replay complet des migrations ni de test concurrent à deux sessions. Les dépendances ne sont pas installées dans ce worktree.
- La base locale compte 603 migrations enregistrées pour 607 fichiers. Trois versions sont absentes, en plus de la collision. Les six fonctions pot/volume utilisées pour les constats ont été comparées au HEAD : corps identiques après normalisation des fins de ligne.
- Les modifications staged du coordinateur dans [demo-franchise-applications.ts](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/apps/web/modules/admin/data/spaces/demo-franchise-applications.ts) et [franchise/data/crm/repository.ts](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-b62a6213/apps/web/modules/franchise/data/crm/repository.ts) sont absentes ici et **non auditées**.

Aucune hypothèse de contournement MFA ou de conformité fiscale/juridique n’est présentée comme un fait établi. Cet avis est technique et ne certifie pas la conformité juridique.

