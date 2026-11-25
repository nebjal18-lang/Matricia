# Matricia — décisions réellement requises

Les travaux indépendants continuent; cette liste ne contient que les choix externes ou métier impossibles à inventer.

## DR-001 — fournisseur de signature électronique

- État : modèle, niveaux de signature, preuves et mock de développement présents. Le 9 novembre 2026, le demandeur a retenu **Yousign en sandbox**, avec un lien vers l’espace de gestion des clés. Ce choix ne constitue ni une activation, ni une preuve de signature.
- Décision/validation restante : niveau de signature attendu par type de contrat, politique de webhook, exigences de certification et preuve d’intégration de l’adaptateur Yousign. Les clés doivent être configurées dans le gestionnaire de secrets, sans copie dans Git ou les rapports.
- Option sûre en attendant : maintenir la signature réelle désactivée et échouer fermé; ne jamais présenter le mock comme une signature réelle.
- Impact : bloque la preuve P0 de contractualisation électronique en production, sans bloquer les corrections UX indépendantes.

## DR-002 — publication commerciale des prix d'abonnement

- État : plans et gestion d'abonnement existent; aucune autorisation métier nouvelle de publier des montants ne doit être déduite du code.
- Décision requise : confirmer les plans/avantages et tarifs publiables.
- Option sûre en attendant : présenter uniquement les avantages validés sans prix inventé ni faux bouton de paiement.

## DR-003 — comptes et sandbox des fournisseurs externes

- État : adaptateurs CMI/PayPal, email, social, scanner et marketing existent; une variable locale ne prouve pas l'activation ni la conformité d'un compte externe.
- Décision/coordination requise : comptes sandbox autorisés, domaines vérifiés, scopes, webhooks et destinataires de test.
- Option sûre en attendant : modes sandbox/démo avec garde production fermée.

## DR-004 — validations externes de gouvernance et de release

- État : le code admin prévoit les validations CNDP traitement/transfert, la revue experte du catalogue FR/AR et des mappings, ainsi que les preuves de restauration, pentest et préparation incident.
- Décision/coordination requise : responsables habilités, références de validation et preuves datées; autorisation de production distincte après checklist verte.
- Option sûre en attendant : conserver les capacités concernées non publiées ou fail-closed, sans inventer une approbation.
- Impact : ne bloque pas les tests de développement, mais empêche de signer la release production comme complète.
