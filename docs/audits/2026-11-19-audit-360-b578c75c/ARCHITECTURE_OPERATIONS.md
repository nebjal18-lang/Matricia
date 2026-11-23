# Architecture, qualité, performance et exploitation

## Architecture réelle

Le monorepo possède les espaces et domaines attendus, mais une part importante du métier est implémentée dans les modules web et PostgreSQL. Des packages application/contracts/forms/workflows restent minimaux ; le contrôle des frontières ne couvre pas toutes les applications. Ne pas confondre ce constat avec une absence de toutes les fonctions métier.

| Axe | Constat | Référence |
|---|---|---|
| Release | Le runner SQL accepte une cible arbitraire sans identité non-production | [REL-01](./FINDINGS.md#rel-01) |
| Release | Un sous-ensemble SQL peut satisfaire un check de release complet | [REL-02](./FINDINGS.md#rel-02) |
| Release | Deux migrations partagent le même identifiant | [REL-03](./FINDINGS.md#rel-03) |
| Release | Le build et la vérification TypeScript à froid échouent | [REL-04](./FINDINGS.md#rel-04) |
| Qualité | Lint, tests web et tooling ne sont pas verts | [REL-05](./FINDINGS.md#rel-05) |
| Release | Le contenu des visas n'est pas validé | [REL-06](./FINDINGS.md#rel-06) |
| Qualité | Les preuves atomiques et la couverture exigée restent incomplètes | [REL-07](./FINDINGS.md#rel-07) |
| Architecture | Le web n'hérite pas de plusieurs options strictes requises | [ARCH-01](./FINDINGS.md#arch-01) |
| Architecture | Les packages de domaine et le contrôle de frontières restent largement déclaratifs | [ARCH-02](./FINDINGS.md#arch-02) |
| Performance | La pagination de transport charge toujours tout l'historique | [ARCH-03](./FINDINGS.md#arch-03) |
| Architecture | Des erreurs métier différentes deviennent indiscernables | [ARCH-04](./FINDINGS.md#arch-04) |

## Reproductibilité

L'installation offline/frozen de HEAD dans un checkout détaché a réussi en v22.23.5. Le runtime système demeure Node24 ; aucune configuration globale n'a été changée par l'audit. Le runner explicite vérifie Node22. La suite web reste rouge sous ce runtime vérifié et le typecheck sans incrémental reproduit TS2589. Le build avec variables locales en mémoire compile mais bloque sur ce même type ; les paramètres absents du premier essai ne sont donc pas l'unique obstacle.

La collision de version SQL empêche une représentation non ambiguë du replay dans schema_migrations. L'exécution de SQL manquants sur le clone à des fins de diagnostic n'est pas une correction de l'historique ni une preuve de clean migration.

## Tests et garanties trompeuses à éviter

- 4 186 tests web verts ne compensent ni les six rouges ni les branches non mesurées.
- Les tests de rendu sans contexte Router, anciennes traductions et ancien contrat HTTP403 doivent être réconciliés : ne pas transformer une traduction correcte en régression pour satisfaire une attente obsolète.
- Les tests SQL de fragments de fonctions peuvent passer alors qu'une RPC échoue lors d'une contrainte différée. Tester le rôle applicatif jusqu'au commit ou à une validation équivalente contrôlée.
- La suite filtrée de concurrence est explicitement partielle. Le gate de release doit aussi refuser ce raccourci de couverture.
- Les symlinks Windows demandent des prérequis adaptés ; les erreurs EPERM ne prouvent pas une panne de déploiement Linux.

## Performance

Le vrai helper readAllPages accumule 100 000 lignes après 201 appels séquentiels sur transport synthétique. C'est une preuve d'amplification du coût, pas une mesure réseau ni un dépassement du p95. Les temps de navigation du serveur de développement ne sont pas des Web Vitals de production.

Objectifs du Gold Master à mesurer en staging contrôlé : LCP ≤ 2,5 s ; INP ≤ 200 ms ; CLS ≤ 0,1 ; API courantes p95 < 500 ms hors fournisseurs. **Non évaluables comme gates de performance dans cet audit**, notamment à cause du build bloqué et de l'absence de scénario authentifié représentatif.

## Exploitation

Les mécanismes Outbox, retries et contrôle d'ACK ont des preuves locales ciblées ; les scénarios à deux connexions passent. Les runbooks de déploiement/restauration existent et séparent les preuves locales de la validation hébergée. Pas de restore DB+Storage+jobs, rollback, RPO/RTO ou incident réel staging validé sur ce candidat.

Priorité : rendre le candidat construisible, sécuriser les outils de test, fiabiliser les preuves et corriger les causes métier avant optimisation de détail ou réécriture architecturale. Une migration progressive par use cases est préférable à une refonte générale sans preuve de nécessité.

Revue indépendante complète : [reviewers/architecture.md](./reviewers/architecture.md).
