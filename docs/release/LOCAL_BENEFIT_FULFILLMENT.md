# Recette locale des avantages

Statut : **PRÉPARÉE, NON EXÉCUTÉE**. Ce segment distinct ne modifie pas les résultats archivés de la chaîne commerciale SDK8.

Commande dans le créneau PRIMARY/MAIN figé, avec les variables Docker locales de `LOCAL_ACCEPTANCE.md` :

```sh
E2E_LOCAL_ISOLATED=1 E2E_LOCAL_PROJECT_ID=Matricia APP_ENV=development \
PATH=/workspace/.cache/corepack/bin:$PATH COREPACK_HOME=/workspace/.cache/corepack \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium PLAYWRIGHT_VIDEO=off \
node tests/e2e/helpers/local-delivery-acceptance-run.mjs --step benefit-fulfillment
```

Préconditions : socle Client de conformité réelle, crédits manuels gouvernés268050, financement canonique268010, admission Provider268060, corrélation des décisions268063 et exécution/réception Root268030/061 intégrés et appliqués localement. Le binding d'environnement privé doit être DEVELOPMENT. Aucun build, migration, autre navigateur ou fixture P05 ne doit être concurrent.

Le segment exige six cas sans skip/retry : quatre Auth UI FR/AR avec OTP et MFA natifs, puis deux parcours UI avantages. Les deux Clients inscrits sont activés par les vraies commandes de conformité, avec six PDF privés et deux reviewers distincts. Les rôles FINANCE_MANAGER des deux reviewers et MATRICIA_ADMIN du seul opérateur sont un bootstrap de fixture déclaré ; aucune adhésion Client n'est attribuée à l'opérateur.

Les commandes SDK créent et activent un avantage synthétique unique, proposent sa politique de rapport humain et la font approuver par un autre Finance. Elles créent deux portefeuilles Client, proposent deux cadeaux de20crédits, refusent l'auto-approbation, puis approuvent/exécutent chaque cadeau indépendamment avec revenu nul et rejeu sans second lot. Les deux réservations coûtent chacune5crédits et ont une admission persistée ; aucun statut métier n'est semé directement.

Chaque scénario FR/AR effectue dans les vraies interfaces : planifier, démarrer, déposer un rapport, demander un complément depuis le Client indépendant, corriger le rapport, confirmer la réception, puis consommer une seule fois depuis l'opérateur. La date utilise le vrai format à la minute en heure marocaine, avec attente réelle bornée si la minute suivante est nécessaire. Les pages sont rechargées ; le second Client authentifié ne peut pas lire le dossier du premier.

La vérification finale relit les reçus et mouvements persistés, le rejeu de la consommation UI, l'unique exécution de chaque cadeau, le revenu nul et les paires audit/outbox exactes des politiques, cadeaux et réceptions. Le lecteur comptable privé doit reconnaître les vrais hashes et les deux acteurs distincts. Ce lecteur prouve une réception d'un rapport opérationnel de test ; il n'atteste ni fichier de service ni antivirus, ni prestation réelle livrée au client.

Le nettoyage retire les seuls rôles ajoutés, retire du catalogue le seul avantage créé par la fixture, neutralise ses événements globaux en attente, puis archive/bannit les organisations et comptes propres avec les helpers existants. Les faits financiers, rapports et reçus immuables restent historiques, sans réécriture de solde. Les cookies, secrets MFA et traces privées temporaires sont supprimés. Le nettoyage en échec empêche tout PASS.

Résumé distinct : `artifacts/test-results/local-acceptance/benefit-fulfillment.json`, puis manifeste haché du runner. Aucun résultat ni signature client n'est prérempli.
