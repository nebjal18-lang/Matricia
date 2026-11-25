# Remise de l’administration — configuration initiale

Le client renseigne sa plateforme dans `/fr/administration/configuration` ou `/ar/administration/configuration`. Le menu Paramètres, l’accueil Admin et les opérations donnent accès au même espace. Les paramètres métier spécialisés restent accessibles depuis les étapes Offre et contrats, puis Équipe et sécurité.

## Préparation par l’équipe technique

Avant le premier accès : déployer le candidat, appliquer les migrations additives dans l’environnement autorisé, initialiser `APP_ENCRYPTION_KEY` dans le coffre de l’hébergement et conserver les paramètres Supabase exclusivement côté serveur. La clé du coffre doit être sauvegardée dans le gestionnaire de secrets ; son remplacement sans migration des données rend les anciens credentials illisibles.

Préparer le SMTP de Supabase Auth et ses URLs de retour pour que les administrateurs puissent recevoir leur premier code. Resend pour les notifications applicatives ne configure pas le SMTP Auth. Préparer deux comptes administrateurs distincts avec un second facteur vérifié et attribuer leurs habilitations par le processus autorisé. Aucun compte partagé ni mot de passe par défaut n’est créé par la configuration.

Le worker et ClamAV doivent être hébergés, accessibles et à jour avant de connecter l’antivirus. L’hébergeur fixe les hôtes scanner autorisés ; un formulaire ne peut pas autoriser arbitrairement un nouvel hôte réseau.

## Parcours du client

1. **Votre entreprise** : saisir l’identité, l’adresse, les coordonnées, la langue, la monnaie et le fuseau. Enregistrer une version ; une autre personne habilitée l’approuve. L’email de contact actif devient le destinataire des demandes publiques. Les identités légales des organisations et les mentions des factures restent dans leurs dossiers et règles dédiés.
2. **Services connectés** : renseigner Resend, PayPal, YouSign et l’antivirus. Les champs secrets sont toujours vides après une réponse. Un champ secret vide conserve la clé de la version source indiquée ; saisir une nouvelle valeur la remplace. Les clés enregistrées ne sont jamais réaffichées.
3. Enregistrer, tester la connexion, puis faire examiner la version exacte par le second administrateur. Un test réussi est daté et limité dans le temps. Un brouillon conserve la configuration active ; une désactivation empêche le retour aux anciennes variables d’hébergement.
4. **Offre et contrats** : ouvrir les écrans existants pour les plans, prix, packs, taxes, clauses FR/AR, commissions, catalogue et politiques de signature. Les brouillons et approbations de ces écrans ne sont pas remplacés par l’activation des credentials.
5. **Équipe et sécurité** : gérer les utilisateurs, rôles, invitations et seconds facteurs. Les décisions sensibles peuvent requérir des personnes différentes selon leur politique.
6. Réaliser une recette métier avec un client, un prestataire, un franchisé et un administrateur avant la mise en service autorisée.

## Connexions et preuves attendues

| Service | Informations et contrôle | Recette complémentaire |
| --- | --- | --- |
| Resend | Clé, expéditeur, domaine vérifié, secret webhook et destinataires autorisés ; vérification du domaine par l’API | Email reçu et webhook de livraison vérifié ; Auth SMTP reste indépendant |
| PayPal | Environnement, client/secret, webhook, certificat PayPal et monnaies effectivement prises en charge ; OAuth et certificat vérifiés | Paiement, doublon, remboursement et rapprochement réels dans l’environnement autorisé |
| YouSign | Environnement, clé, secret webhook et espace facultatif ; lecture de l’API ; création de la version technique après revue | Attestation indépendante et politique approuvée, signataires explicitement préparés, signature native avec PDF et audit |
| Antivirus | Endpoint HTTPS autorisé et token ; contrôle du protocole de scan signé avec un document de test | Fichier sain, EICAR, panne/reprise et preuves privées réelles |

Les routes de webhooks sont `/api/webhooks/email/resend`, `/api/webhooks/payments/paypal` et `/api/webhooks/yousign`. Elles doivent être enregistrées chez les fournisseurs ; conserver les secrets dans leurs champs dédiés, jamais dans une URL ou un motif.

En staging, PayPal et YouSign utilisent leur sandbox. Le connecteur YouSign live accepte uniquement un environnement de production concordant entre serveur et base. Les niveaux pris en charge sont explicitement limités à SIMPLE. Une nouvelle version de credentials crée une nouvelle configuration technique ; elle n’hérite pas automatiquement des attestations d’un autre compte. Les enveloppes anciennes nécessitent une réconciliation appropriée après rotation.

Le compteur des cinq configurations actives indique leur activation technique. Il ne vaut ni certificat juridique, ni preuve de livraison externe, ni autorisation de production. Les étapes liées affichées « À vérifier » doivent faire l’objet d’une recette dans leur écran.

## En cas de blocage

- **Coffre non initialisé** : intervention de l’équipe technique avant saisie des clés.
- **Connexion refusée** : vérifier clé, environnement, expéditeur, accès réseau et service, puis relancer le test. Un reçu ancien ne remplace pas un nouvel échec.
- **Version remplacée** : actualiser, examiner la version courante et proposer une nouvelle version. Aucun écrasement silencieux.
- **Approbation indépendante requise** : utiliser le compte de l’autre administrateur, avec son second facteur.
- **Service désactivé ou erreur de coffre** : l’application bloque les nouvelles opérations concernées ; elle ne réactive pas des credentials historiques.

Aucune valeur secrète dans ce guide. Les résultats de tests et la décision de remise sont consignés séparément pour le candidat exact.
