# Client C11 — changement immédiat financé

Les modes `FULL_NEW_CYCLE` et `PROPORTIONAL_REMAINING` sont implémentés, sans règle commerciale publiée par migration. Deux responsables Finance distincts doivent proposer/approuver une règle versionnée FR/AR, liée aux versions source/cible, à une périodicité et à un délai de validité. Le Client reçoit un calcul exact, accepte son empreinte et les conditions, puis utilise le checkout PSP durable existant.

Le premier mode redémarre une période entière au prix intégral de la version cible. Il n’applique aucun remboursement ou prorata implicite du temps restant. Les crédits déjà payés gardent leurs échéances et leur validité ; la nouvelle période entièrement payée produit ses propres crédits. Ces conséquences sont visibles avant acceptation. Aucun tarif, quota, règle commerciale ou compte externe n’est créé par ce lot.

Les capacités transactionnelles de préparation restent privées à PostgreSQL. Le navigateur ne peut ni ouvrir le contrôle `ACTIVE`, ni choisir un autre plan/montant, ni fabriquer une preuve. Le webhook/capture vérifié doit correspondre exactement à la source, à la préparation, à la version et aux conditions acceptées. Les anciens paiements/cycles et les ledgers restent immuables. Le nouveau cycle suit le validateur canonique et les exécuteurs de crédits existants ; un incident ou une source périmée reste dans le rapprochement existant.

## Vérifications réalisées

- Migrations `20261102031000`, `20261102031100` et `20261102031120` appliquées dans la seule base jetable `client_upgrade_verify_20261102`, copie locale du candidat isolé. Aucune migration sur le Supabase partagé/distant.
- `0331_governed_immediate_subscription_upgrade.test.sql` : **29 assertions réussies**. Le scénario crée un paiement source canonique, publie une règle par deux acteurs, refuse AAL1, l’auto-approbation, l’absence de consentement et un hash divergent ; prépare un intent SANDBOX, exécute la capture SQL de test, applique le paiement vérifié, puis vérifie le rejeu et les droits. Les deux allocations de crédits réellement payées (10 +20) sont produites par le worker natif sans doublon.
- Tests unitaires ciblés (API, devis de changement, formatage monétaire) : **21 réussis**. Cas JPY/KWD, négatif et montant supérieur à `2^53`, refus avant PSP et cible prise dans la réponse serveur.
- Lint ciblé exécuté ; le build/typecheck consolidé appartient à l’intégrateur.

Cette preuve SQL utilise des identités synthétiques, des rôles/sessions SQL de laboratoire, le port de paiement DEV/SANDBOX et une transaction annulée. Elle ne certifie ni un webhook reçu sur un PSP externe, ni la délivrabilité, ni une recette navigateur de paiement réel.

## Prorata restant et politique de crédits

`PROPORTIONAL_REMAINING` calcule exactement `(prix cible − prix source) × durée restante / durée totale d’origine`. La durée conserve les microsecondes PostgreSQL ; les prix restent des entiers exacts. L’arrondi `FLOOR`, `CEIL` ou `HALF_UP` est choisi dans une règle proposée puis approuvée par une autre personne habilitée. Aucun choix commercial n’est activé par défaut. Un résultat arrondi à zéro est refusé.

Le devis fige la période d’origine, la date de calcul, les prix source/cible, l’arrondi, la règle et ses conditions FR/AR. Son acceptation porte sur son empreinte exacte. Le complément vérifié crée un nouveau cycle partiel à la version cible et conserve l’échéance d’origine ; le validateur reconstitue le financement composé du cycle précédent et du complément avec leurs journaux. Le paiement ancien, ses cycles et ledgers restent inchangés. Les changements successifs conservent la base calendaire complète d’origine.

La politique implémentée `NEXT_FULL_CYCLE_ONLY` conserve les crédits déjà acquis et tous les mois futurs d’une année prépayée. Le complément ne délivre aucune nouvelle dotation complète en crédits ni aucune Box complète de la version cible. Les nouveaux crédits/Box démarrent au prochain renouvellement intégral ; les droits Box originaux sont conservés par le résolveur de lignée, intégré au domaine Box dans le lot suivant. Le worker automatique et les termes de dotation manuelle appliquent la même restriction. Ces effets sont expliqués avant consentement en FR/AR.

- `0332_remaining_period_subscription_upgrade.test.sql` : **29 assertions réussies**, calcul exact et arrondis, non-publication par défaut, validation indépendante, préparation différentielle, refus de montant différent, capture, fin conservée, financement composé, droits cible, source Box d’origine, crédits existants et rejeu. Le retrait d’une règle interdit les nouveaux devis mais conserve le contrat de la commande déjà acceptée, encore soumise aux contrôles de source et de sécurité.
- `0334_annual_remaining_period_subscription_upgrade.test.sql` : **27 assertions réussies**, même paiement différentiel annuel et conservation des onze futurs mois de crédits déjà payés.
- `0331` reste requis après `31100` pour prouver que le mode intégral conserve son propre financement et ses dotations.

Les transitions de proposition, décision indépendante, retrait, devis et acceptation disposent chacune d’un événement Outbox durable corrélé à leur source immuable. Un rejeu ne génère pas une nouvelle acceptation. Les événements observent ces faits déjà validés ; ils n’effectuent aucun versement ni changement de droits.

`0335_subscription_upgrade_nonpayable_option.test.sql` : **6 assertions réussies**. Une différence positive trop faible, arrondie à zéro, est distinguée d’une panne et d’une règle non approuvée (`NO_PAYABLE_UPGRADE`). Le devis direct reste refusé, sans nouveau droit ni faux succès.

## Conditions de clôture externe

Les règles commerciales approuvées (référence, conditions FR/AR, arrondi, versions et périodicité), les politiques comptables ainsi que les comptes PSP externes restent à fournir/publier par les acteurs habilités. Les tests ne choisissent que des valeurs synthétiques annulées. Le passage réel du temps jusqu’au prochain renouvellement et une capture externe n’ont pas été exécutés dans cette recette SQL ; aucune validation correspondante n’est revendiquée. La recette Box de lignée et le build consolidé appartiennent aux lots d’intégration indiqués.
