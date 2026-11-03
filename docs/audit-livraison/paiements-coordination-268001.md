# Coordination des paiements et réception durable

Les migrations 268001/268002 rendent la tentative potentiellement payable durable avant le premier appel PSP. Un abonnement ne possède qu’une tentative non résolue, sous verrou financier. Le premier retour seul autorise createIntent. La même clé retrouve la préparation sans autoriser un POST incertain, même après expiration de la rétention d’idempotence du fournisseur. Un ordre enregistré reprend par GET. Seul le premier passage à CAPTURE_REQUESTED autorise la capture ; une répétition demande une revue native.

La fondation 268020 fournit un mapping POSTING approuvé par deux responsables financiers distincts pour la version vendue, la devise et l’environnement exacts. Les comptes de trésorerie et d’attente sont figés avant PSP. L’installation de 268001 ne nécessite pas ces helpers ; leur absence ferme les nouvelles créations. Aucune configuration réelle n’est créée par ces migrations.

Les callbacks sont vérifiés puis leur fait structuré et leurs preuves sont conservés dans une inbox privée avant résolution du type d’achat. Le registre SQL tranche entre SUBSCRIPTION et CREDIT_PACK ; aucun champ du navigateur n’en décide. Une course avec la registration conserve un reçu et une commande Outbox reprise/DLQ. Le consommateur relit la preuve durable ; l’ACK SQL exige un vrai reçu correspondant et signifie uniquement que le fait a été routé.

Un ancien ordre réellement payé reste conservé si l’abonnement ne peut plus l’accepter. Le cash utilise son contexte comptable figé puis l’activation s’exécute dans une sous-transaction : une erreur métier ne supprime ni reçu ni journal d’attente. Sans configuration historique, PENDING_LEDGER_CONFIGURATION conserve la preuve sans comptes inventés. Une capture supplémentaire ne crée pas de deuxième cycle et exige un rapprochement. Aucun remboursement automatique n’est supposé.

Les événements négatifs signés reçus avant leur capture sont rapprochés par gateway/environnement/captureId exacts. Le dernier état par litige est utilisé ; WON résout son litige sans effacer un autre remboursement/renversement. Ces faits bloquent de nouveaux droits avant leur routage, tout en conservant l’encaissement. Cela ajoute seulement des faits adverses connus aux contrôles financiers existants ; absence d’abonnement, vrais essais et sources manuelles ne deviennent pas des demandes de paiement.

## Revue native et exploitation

POST /api/payments/native-review exige une origine autorisée, une session et un contexte SQL AAL2 autorisant la préparation exacte. Le GET OAuth/TLS PayPal vérifie ID, intention CAPTURE, une seule unité, digest de facture propre au produit, montant/devise et au plus une capture complète. Une observation native est conservée avant toute importation. Un hash de réponse n’est jamais présenté comme une signature de webhook.

Seul VOIDED natif frais libère une tentative sans reçu capturé. CREATED/APPROVED reste payable. Pour une création sans ID enregistré, un opérateur peut fournir l’ID trouvé sur le compte marchand : le serveur relit sa facture exacte avant rattachement. Cette revue ne crée pas d’ordre, ne capture rien et n’envoie aucun remboursement.

Une capture native d’abonnement peut être enregistrée au journal d’attente sans activation inventée. Le webhook signé ultérieur rapproche ce reçu et réutilise le premier journal et sa corrélation. Sans confirmation, le rapprochement reste explicite. Administration → Opérations expose tentatives, reçus non appliqués, faits en attente de routage et observations natives dont l’import a échoué ; réception et journal d’attente ne sont pas présentés comme activation.

Les packs utilisent /api/payments/credit-packs/intents et /api/payments/credit-packs/paypal/capture. Leurs références et clés PayPal sont séparées des abonnements ; les anciennes références d’abonnement restent stables. Les commandes SQL 268020/268022 et les données serveur réservées font autorité.

## Preuves et limites

La recette SQL cible le clone local matricia_delivery_ice_concurrency, emploie des identités/preuves de service synthétiques explicitement annoncées et de vraies politiques à quatre yeux ; chaque fichier finit par ROLLBACK. Elle vérifie coordination, deux encaissements pour un cycle, absence de doublon au rejeu, preuves natives distinctes, réutilisation du journal, inbox, refus d’ACK mensonger et autorisations. Les tests HTTP contrôlent l’absence d’appel PSP après ambiguïté ou refus de périmètre. Les corps HTTP et réponses natives sont limités pendant leur lecture.

Cela ne constitue pas une recette PSP réelle. Compte marchand/scopes/paramètres de staging et mappings POSTING/fiscaux réellement approuvés restent nécessaires. Aucun PSP réel, débit, remboursement ou déploiement production n’a été exécuté. Aucun taux fiscal ni compte réel n’a été inventé. CMI demeure fermé quand son contrat/environnement n’est pas vérifié. Une absence de preuve native d’annulation garde la tentative bloquée pour investigation ; elle n’autorise pas un deuxième ordre.
