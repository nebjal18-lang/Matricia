# Invitations du réseau — correction FA06

Source : version fusionnée `df67da4`, distincte des anciennes branches de travail. Le faux succès était reproductible dans `screens/network/actions.ts` : création du prospect, puis activité « Invitation envoyée », sans jeton ni commande de remise. L’import recommençait chaque ligne avec une nouvelle clé aléatoire. Le consumer par défaut observait `FranchiseProspectSavedV1` sans envoyer de message.

## Workflow implémenté

- Commande atomique de demande d’envoi, pour une personne ou un lot de 50 lignes au maximum. AAL2, rôle d’écriture exact, mandat et territoire courants actifs, confirmation de possibilité de contact, plafond de 100 invitations par mandat et par jour. Les contrôles et verrous serveur sont conservés. Un CSV invalide annule tout le lot ; les doublons d’adresse normalisés sont comptés explicitement.
- Identifiants stables dérivés de la clé du lot et de l’adresse. Lien unique valable 30 jours, jeton HMAC SHA-256 séparé par finalité, empreinte privée seulement. Aucun jeton brut dans les tables, l’outbox ou les journaux. La clé `APP_ENCRYPTION_KEY` existante doit être configurée de manière sécurisée, avec au moins 32 octets ; une absence ou une rotation incompatible échoue explicitement.
- `FranchiseNetworkInvitationRequestedV1` est traité par un consumer dédié. Il vérifie l’événement effectivement persisté, charge le destinataire canonique, utilise l’adaptateur email existant et sa clé fournisseur stable, puis confirme la remise à la commande SQL. Le worker refuse un simple accusé `TERMINAL_OBSERVABILITY`. Une panne ou une perte de réponse garde une reprise cohérente ; aucun faux `SENT` n’est créé.
- Le mode de test est marqué `NON_CONTRACTUAL_DEMO`, sans email réel. L’adaptateur le refuse en production et la base le refuse si son environnement propriétaire n’est pas lié à `DEVELOPMENT` ou `STAGING`. En mode réel, `SENT` signifie **acceptation par le fournisseur d’email**, sans certification de réception.
- La page FR/AR `/[locale]/rejoindre-reseau` conserve le lien après connexion et changement de langue. L’ouverture est une action explicite. La lecture exige le jeton et l’email confirmé du destinataire ; le choix présente seulement ses organisations actives autorisées. Le rattachement exige AAL2, confirmation et contrôle serveur du rôle Client ou Provider dans l’organisation choisie.
- L’origine est conservée dans un referral immuable. L’acceptation ne crée ni organisation, ni membre, ni rôle, ni qualification, ni droit économique. Une autre invitation ne peut pas écraser l’origine d’une organisation déjà rattachée. Le lien CRM historique est également protégé contre ce remplacement.
- Le formulaire montre la demande en file et ses doublons, jamais une promesse d’email envoyé. Un suivi paginé présente les états réels et distingue refus, incident, session expirée et résultat vide. L’expiration de sa projection est calculée avec l’horloge PostgreSQL. L’ancien code CRM `SENT` est nommé « Prospect enregistré » ; il ne prouve plus une remise email.

L’invitation d’adhésion `OrganizationEmailInvitationRequestedV1` n’a pas été réutilisée : elle ajouterait des membres et des rôles dans l’organisation opératrice, ce qui ne correspond pas à l’acquisition de clients ou de prestataires indépendants. Les approbations centrales des mandats et qualifications restent des workflows indépendants.

## Fichiers et vérifications

Migrations `20261103453000_franchise_network_invitations.sql` et `20261103453100_franchise_network_delivery_environment_guard.sql` ; test SQL `0363_franchise_network_invitations.test.sql` : 41 assertions prévues, sans désactivation de trigger/RLS, avec identités `example.invalid` et rollback final. **Son exécution est à effectuer dans le rejeu SQL isolé d’intégration ; elle n’est pas déclarée réussie à ce checkpoint.**

Vérifications exécutées sur le code du lot : Web **128 tests PASS** (8 fichiers, dont ancienne route d’outbox), puis **4 tests d’interface destinataire PASS** (groupe distinct), worker dispatcher **21 PASS**, types et lint ciblé réussis, garde des exports serveur **1 847 fichiers PASS**. [Journaux](evidence/invitations/).

Les tests couvrent notamment le hash seul transmis à la base, les reprises CSV stables, le rejet sans confirmation, la MFA, les erreurs Auth, les résultats discordants, l’email refusé, le rejeu après acceptation externe mais échec de persistance, les modes de simulation, l’accusé de consumer et le refus de faux états vides.

## Limites de recette à conserver

Aucun email n’a été envoyé à une personne réelle. La recette navigateur authentifiée et l’intégration de l’adaptateur hébergé restent à exécuter ; les tests unitaires ne certifient pas le fournisseur distant. La base de test doit recevoir une liaison propriétaire d’environnement avant simulation, jamais un paramètre utilisateur de production. La rotation de clé invalide volontairement les anciens jetons non réconciliés ; il faut traiter ces invitations avant rotation.

Ce lot corrige l’invitation et sa provenance. Il ne revendique pas la certification juridique du contact ni un mécanisme de relance commerciale : les reprises techniques du même envoi sont idempotentes et les réinvitations après expiration sont bornées, tandis qu’une relance distincte doit respecter les préférences et sa politique approuvée.
