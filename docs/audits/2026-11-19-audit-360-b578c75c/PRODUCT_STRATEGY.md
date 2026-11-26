# Produit, vision et stratégie

## Lecture d'ensemble

La proposition est cohérente : transformer une difficulté d'entreprise en besoin structuré, obtenir des réponses comparables, contractualiser et suivre l'exécution. Les franchises apportent expertise locale et gouvernance ; abonnements, avantages et crédits structurent l'accès. Ce constat porte sur la logique produit, pas sur une traction commerciale mesurée.

Les 222 pages et quatre espaces couvrent une surface large. Le problème prioritaire observé est la continuité entre ces surfaces et la vérité des données, pas le manque d'écrans supplémentaires.

## Raccordements les plus fragiles

| Raccordement | Constat | Conséquence |
|---|---|---|
| Besoin libre → qualification | PROD-01, UX-01 | Un utilisateur doit encore savoir classifier ou risque de perdre une reprise exploitable |
| Contexte → demande | PROD-02, PROD-03 | Organisation ou réponses peuvent changer/perdre leur fidélité |
| Publication → découverte | PROD-04 | Un nouveau service ne devient pas automatiquement admissible dans la projection |
| Démo → vraie activité | DEMO-01, SEC-02 | Cartes/identifiants et effets Auth ne garantissent pas une chaîne métier réelle |
| Activité → finance | FIN-01 à FIN-05 | Montants/règles affichés ne suffisent pas à prouver un revenu distribuable exact |
| Parcours → preuve d'acceptation | REL-02, REL-06, REL-07 | Couverture, visas et complétude doivent être liés au candidat réel |

## Évaluation par axe, sans note artificielle

| Axe | Appréciation étayée | Preuve manquante |
|---|---|---|
| Compréhension de la promesse | Entrée publique lisible, diagnostic/besoin présents en FR/AR | Étude utilisateurs et conversion réelle |
| Activation | Parcours guidés présents, mais reprise non classée et multi-organisation à corriger | Activation native jusqu'à première valeur |
| Offre/demande | Mécanismes de qualification/matching présents | Liquidité par service/territoire, délai et qualité des réponses |
| Confiance | RLS et contrôles centraux présents ; divergence documentaire confirmée | Matrice complète des rôles et preuves d'intégrations réelles |
| Viabilité économique | Trois pots/droits représentés distinctement | Rapprochement fiable, coûts de service, récurrence et contribution observées |
| Capacité opérationnelle | Administration et automatisations larges | Volume d'exceptions, taux de reprise, capacité de support sous charge |

Aucun CAC, LTV, revenu, taux de conversion, rentabilité ou part de marché n'est inventé. Les volumes démo ne valent pas métriques commerciales.

## Métriques à instrumenter avant de décider d'élargir

1. Taux et délai diagnostic/besoin → première demande exploitable, avec cohorte des besoins non classés.
2. Abandon et ressaisie par étape, langue, appareil et nombre d'organisations.
3. Couverture des besoins par fournisseurs éligibles, réponses reçues et délai au premier devis pertinent.
4. Comparaison → sélection → contrat → réception, sur un même identifiant de chaîne.
5. Récurrence, conversion essai→abonnement, rétention et usage réellement consommé des avantages/crédits.
6. Coût humain de conformité, qualification, exception, litige et recouvrement.
7. Revenu HT acquis rapproché, avoirs/remboursements, coûts affectés et contribution par bibliothèque/pot, sans double allocation.

Ces événements doivent être consent-aware, versionnés et reliés aux objets, sans PII inutile dans les logs. Les noms et formules doivent être validés avant d'utiliser un tableau de bord pour une décision économique.

## Expériences proposées

- **Continuité du besoin non classé** : cohorte synthétique puis pilote autorisé ; mesurer reprise et conversion, vérifier absence de perte d'information.
- **Qualification fournisseur sans catalogue imposé** : description libre, suggestions facultatives, qualification différée ; comparer compréhension et complétion, sans modifier les règles d'éligibilité.
- **Démonstration honnête** : une chaîne persistée, des identifiants stables et des intégrations simulées explicitement nommées ; tester chaque passage d'acteur.
- **Périmètre pilote maîtrisé** : choisir quelques services V1 représentatifs, sans retirer l'obligation des 68 fonctions pour une release V1 complète. La limitation d'un pilote doit être annoncée et n'est pas un visa V1.

Ne pas engager une expansion V2 ou ajouter des modules pour masquer une rupture de parcours V1. D'abord fiabilité des chaînes, puis mesure de la valeur, enfin élargissement sur preuves.

Analyse indépendante, matrice 68 et références détaillées : [reviewers/product.md](./reviewers/product.md).
