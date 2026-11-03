# Reprise d’un coût nul révoqué par une dépense réelle

Deux écarts ont été reproduits dans les définitions SQL : le sélecteur documentaire omettait le conflit d’appartenance à l’organisation opératrice alors que la décision le refusait ; un zéro admis puis révoqué pouvait recevoir une nouvelle pièce zéro, mais pas une vraie dépense positive.

La migration additive `20261103455310` emploie désormais le même helper d’indépendance pour la capacité `can_decide` et les deux chemins de décision. Elle conserve MFA, les restrictions d’auditeur, les auteurs, les acteurs de réception et les appartenances aux organisations client/opératrice liées.

Une proposition positive peut succéder uniquement à la dernière preuve ZERO dont la révocation et la décision indépendante sont démontrées. Proposition et rapprochement enregistrent un `supersedes_reconciliation_id` immuable. L’approbation épingle encore ce prédécesseur sous verrou et ajoute une nouvelle version. Une dépense positive déjà admise ne devient pas librement remplaçable.

Le journal réel reste contrôlé par le moteur existant : POSTED, type de dépense, organisation, devise, net des seuls comptes de charge, équilibre exact et exclusion de la TVA récupérable. La reprise automatique exige aussi la période canonique : jour d’encaissement pour PSP, jour de consommation reçue pour réalisation. Un décalage de période exige une revue comptable explicite. Les livres sont verrouillés avant le journal ; aucune ligne financière ni ancien zéro n’est modifié.

L’attribution ajoute sa nouvelle version et, pour la première dépense positive, son véritable COST canonique. Les anciens zéro(s) doivent tous être révoqués et les versions intermédiaires doivent former une chaîne complète. Les sources de financement et réception restent contrôlées. L’idempotence, l’audit et l’outbox des commandes existantes restent conservés.

Une reprise monétaire qui toucherait une période déjà clôturée est refusée avec `CREDIT_ECONOMIC_CLOSED_PERIOD_REVIEW_REQUIRED`. Une correction gouvernée de cette clôture est nécessaire ; le système ne laisse pas subsister silencieusement un ancien bénéfice distribué face à un coût ajouté.

## Preuves et limites

- SQL0376 est autonome et reprend le parcours natif courant de 0370, avec opérateur distinct du client. Il teste le conflit de rôle affiché/refusé, le zéro réel admis puis révoqué, le vrai journal positif, l’indépendance/MFA, le prédécesseur et les nouvelles versions, les anciens enregistrements inchangés, le calcul exact de la quote-part et les rejeux.
- Aucune exécution SQL ou DDL de 0376 n’est revendiquée par son auteur. Le responsable l’exécute dans sa cohorte locale fraîche.
- Le scénario de remplacement monétaire d’une période déjà clôturée n’est pas exécuté faute de fixture historique canonique admissible. La garde est présente et a été relue ; cela ne vaut pas une recette réussie de ce cas.
- Relecture indépendante source : aucun défaut concret supplémentaire de sécurité/provenance trouvé sur ce périmètre ; ce résultat n’est pas une exécution SQL ni une preuve exhaustive de concurrence.
- Aucun journal de montant nul, solde, gain historique, distribution ou paiement fictif n’est injecté pour obtenir un succès.
