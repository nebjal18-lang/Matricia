# Audit Matricia 360 — synthèse de décision

**Date : 19 novembre 2026. Candidat : b578c75c + deux corrections staged préexistantes.**

## Verdict

| Usage | Décision | Motif |
|---|---|---|
| Démonstration publique guidée, sans engagement ni transaction | **GO conditionnel** | Pages publiques accessibles FR/AR ; annoncer les simulations et limites ; ne pas présenter le film démo comme chaîne persistée validée |
| Démonstration complète des opérations multi-acteurs/finance | **NO-GO en l'état** | Continuité démo, autorisations et clôture Core non fiables |
| Pilote transactionnel contrôlé | **NO-GO en l'état** | Corriger les blocages d'intégrité et d'autorisation, puis recette authentifiée du périmètre pilote |
| Production / acceptation V1 complète | **NO-GO** | Build propre bloqué, gates rouges, constats haute gravité et preuves d'acceptation incomplètes |

**36 constats documentés : 10 haute gravité, 25 moyenne, 1 faible.** Deux risques conditionnels de sécurité sont clairement distingués des défauts reproduits. Aucun score global n'est attribué : la couverture authentifiée/performance/externe ne permet pas une note honnête. Aucun Critical ni compromission de production démontrés ; pas de certification d'absence de vulnérabilités.

## Les décisions prioritaires

1. **Fiabiliser le pot Core avant toute distribution.** Une vraie RPC Finance accepte 10 000 unités de revenu Core depuis un journal de dépense de 100 sans revenu. Les contraintes passent sous authenticated. La clôture, elle, échoue lors de sa vérification différée faute d'EXECUTE sur le helper RLS.
2. **Traiter ensemble la cohérence économique et le blocage d'accès.** Le diagnostic propriétaire montre deux droits de clôture cumulés de 20 000 depuis une source de 10 000 et un rejeu refusé. Ce n'est PAS une double distribution native persistée : le défaut ACL bloque actuellement cette validation. Les remboursements et sources invalidées nécessitent aussi une revalidation.
3. **Aligner les permissions documentaires.** Owner : coffre et RPC autorisés ; Viewer : coffre refusé mais RPC autorisée ; autre tenant : refusé. Aucune fuite inter-tenant n'est démontrée par cette sonde.
4. **Rétablir une recette reproductible.** Deux migrations portent le même numéro ; le build et tsc sans cache échouent sur le digest franchise ; plusieurs gates sont rouges. Les outils de test doivent vérifier leur cible et ne pas accepter un filtre comme preuve complète.
5. **Réparer la continuité produit, pas ajouter des écrans.** Besoin non classé, contexte multi-organisation, réponses tronquées et overlays démo fragilisent l'entrée commerciale et la vérité de la démonstration.

## Ce qui a réellement été exécuté

| Contrôle | Résultat |
|---|---|
| Installation offline/frozen, checkout propre, Node22 | PASS |
| Typecheck incrémental initial | PASS, mais non suffisant |
| Typecheck sans incrémental et build local configuré | FAIL TS2589 |
| Lint | 6 erreurs, 15 warnings |
| Tests web sous Node22 vérifié | 4 186 PASS, 6 FAIL, 1 SKIP |
| Tests worker | 183 PASS |
| Intégration HTTP Outbox | 3/3 PASS |
| Tooling Windows | 100/103 PASS |
| SQL : tous les fichiers sur snapshot isolé | 364 PASS / 10 FAIL / 9 ERROR sur 383 |
| Recontrôle SQL ciblé après réconciliation du clone | 2 PASS / 8 FAIL / 9 ERROR sur 19, pas nouvelle suite complète |
| Concurrence SQL à deux connexions | 4 scénarios PASS |
| Navigateur public FR/AR, cinq largeurs | 140 contrôles, 56 scans axe sans violation dans ces états |
| Routes protégées anonymes | 12 redirections attendues |
| Recette publique historique | 2 PASS FR, 2 FAIL AR sur attente obsolète |
| Sonde réelle de continuation FR→AR distincte | 2/2 PASS, desktop et 360, sans soumission |

L'échec AR historique attendait une mention de traduction indisponible ; le service possède désormais son vrai nom arabe. Ce rouge est une dette de test, pas une preuve de mauvaise traduction. Les erreurs unitaires Router/libellé/403 et tooling sont aussi qualifiées dans le registre : ne pas annoncer autant de pannes utilisateur que de tests rouges.

## Points solides, dans leur portée

681 tables publiques sur 681 ont la RLS activée dans le snapshot. Les trois droits économiques sont représentés séparément. Les protections d'immutabilité et des preuves locales d'Outbox/idempotence/concurrence existent. Les pages publiques FR/AR sont cohérentes et le parcours clavier anonyme contrôlé fonctionne. Ces acquis ne compensent pas les défauts natifs Core ni les preuves manquantes.

## Couverture et limites

Inventaire : 222 fichiers de pages, 70 handlers HTTP, 68 exigences V1 cartographiées ; 5 statuts VERIFIED sont historiques et ne sont pas recertifiés. Pas de recette navigateur authentifiée des quatre espaces ni de validation complète des 26 scénarios E2E, de PSP/signature réels, de lecteur d'écran manuel, de performance staging ou de restauration hébergée. Aucun résultat de démonstration ne vaut une preuve de persistance.

La copie SQL est distincte et rollback-only pour les sondes. Trois migrations déjà présentes dans le dépôt et le hook de base ont été appliqués au clone seulement pour séparer dérive d'environnement et défaut. Aucun code applicatif, index Git, secret ou environnement de production n'a été modifié ; les deux corrections staged préexistantes sont conservées.

## Livrables

- [FINDINGS.md](./FINDINGS.md) : constats, sources/lignes, reproductions, impacts et tests attendus.
- [SCOPE_AND_COVERAGE.md](./SCOPE_AND_COVERAGE.md) : matrice des 68 fonctions, 26 scénarios et limites.
- [TEST_EVIDENCE.md](./TEST_EVIDENCE.md) : commandes, résultats exacts et qualification des échecs.
- [DESIGN_UX_A11Y.md](./DESIGN_UX_A11Y.md) : design, responsive, FR/AR et accessibilité.
- [SECURITY_DATA_FINANCE.md](./SECURITY_DATA_FINANCE.md) : sécurité, données et invariants économiques.
- [ARCHITECTURE_OPERATIONS.md](./ARCHITECTURE_OPERATIONS.md) : architecture, qualité, performance et exploitation.
- [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) : vision, raccordements métier et métriques nécessaires.
- [REMEDIATION_PLAN.md](./REMEDIATION_PLAN.md) : lots ordonnés et critères d'acceptation.

Rapports d'auditeurs indépendants : dossier reviewers. Preuves structurées, sondes et captures : dossier evidence et probes. Cet audit ne ferme aucune phase verte et n'autorise ni mise en production ni correction automatique.
