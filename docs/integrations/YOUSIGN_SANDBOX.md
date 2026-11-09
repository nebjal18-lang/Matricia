# Transport YouSign sandbox : configuration et limites

Le transport effectue les appels HTTP YouSign v3 réels. Ses tests HTTP utilisent
un `fetch` contrôlé ; ils ne sont pas une recette du fournisseur. Aucune politique
juridique, approbation four-eyes, configuration de fournisseur ou clé n'est
créée par la migration `20261109100000_yousign_sandbox_transport.sql`.

## Activation contrôlée

Les noms de configuration serveur sont :

- `APP_ENV=staging` (ou `development`) ; un build Vercel utilise normalement
  `NODE_ENV=production`, ce qui ne transforme pas le staging en production métier ;
- `SIGNATURE_PROVIDER_MODE=EXTERNAL`, `SIGNATURE_PROVIDER_CODE=YOUSIGN` ;
- `YOUSIGN_ENVIRONMENT=sandbox` ;
- `YOUSIGN_API_KEY`, `YOUSIGN_WEBHOOK_SECRET` dans le coffre uniquement ;
- `YOUSIGN_WORKSPACE_ID`, UUID optionnel d'un workspace délibérément sélectionné.

L'endpoint est fixé dans l'adaptateur à `https://api-sandbox.yousign.app/v3`.
L'environnement de confiance de la base doit aussi être `STAGING` ou
`DEVELOPMENT`. La configuration versionnée du fournisseur doit être active,
porter exactement cet endpoint et supporter `SIMPLE`. Le workflow exige une
politique contractuelle courante, réellement proposée et approuvée par deux
personnes distinctes selon les commandes existantes, avec référence juridique
et référence de validation d'adaptateur. Installer le code et définir des flags
ne satisfait pas cette condition.

Ce transport implémente uniquement le niveau YouSign `electronic_signature`
correspondant à `SIMPLE`, avec authentification `otp_email`. Il ne met pas en
œuvre la validation cryptographique d'un certificat ou d'un jeton TSA. Une
politique qui exige un certificat, un horodatage de confiance, `ADVANCED` ou
`QUALIFIED` reste donc fermée. Ne pas affaiblir une politique existante pour
faire passer une recette. Le niveau par type de contrat reste une décision
juridique à fournir avant activation.

## Préparation exacte des signataires

Les documents sont téléchargés depuis le bucket privé
`signature-source-documents`, puis leur SHA-256 est recalculé et comparé au PDF
immuable lié à l'enveloppe. Les contrôles existants de versions, sources,
parties, mandats et pouvoirs restent exécutés par les RPC de domaine.

Le nom affiché d'un profil n'est pas découpé arbitrairement en prénom/nom et le
code ne place aucune signature par défaut sur du texte contractuel. Chaque
signataire prépare explicitement ses données et l'emplacement relu sur ce PDF :

`PUT /api/signatures/yousign/signers/{signerId}/configuration`

La requête nécessite une vraie session du signataire, la même origine et un
corps JSON avec `firstName`, `lastName`, `locale` (`fr` ou `en`) et `fields`.
Chaque champ comporte le `documentSha256` exact, `page` (à partir de 1), `x` et
`y`. Il ne prend pas d'email fourni par le client : celui-ci est résolu depuis le
compte Auth confirmé dont le hash est figé dans l'enveloppe. L'appartenance à
l'organisation et le propriétaire de l'identifiant signataire sont revérifiés.

Cette préparation est autorisée en `DRAFT` ou `READY_FOR_SIGNATURE`, avant la
première claim durable. Une tentative d'envoi déjà claimée, même incertaine,
gèle les données ; aucun changement de destinataire après cette étape. Les
identités, méthodes d'authentification et emplacements acceptés par YouSign sont
empreints et relus avant activation puis lors de l'extraction des preuves.
Une configuration absente bloque l'envoi sans email ni enveloppe externe créée.

La préparation est une API de recette/intégration ; aucun écran de saisie des
positions PDF n'est livré dans ce lot. L'acceptation navigateur complète de ce
parcours reste à produire, avec les vrais signataires et le PDF courant.

## Outbox, webhooks et preuves

Le consumer `consumeGovernedSignatureEnvelope` sélectionne le fournisseur à
partir de la base. L'ancien mock reste soumis à sa garde SQL existante. YouSign
utilise une claim transactionnelle avant tout POST externe, puis persiste
immédiatement les références du fournisseur. La recherche officielle par
`external_id[eq]` empêche une recréation aveugle. Aucun support implicite de
`Idempotency-Key` n'est supposé. Une erreur, un timeout ou une claim abandonnée
produit `RECONCILIATION_REQUIRED` et ne déclenche pas un nouveau POST au prochain
rejeu de l'Outbox. L'identifiant distant conservé doit être examiné avant toute
reprise : aucune commande automatique de reprise après résultat inconnu n'est
fournie dans ce lot.

Une activation acceptée retourne `SIGNATURE_AWAITING_VERIFIED_WEBHOOK`. Elle ne
crée pas un fait juridique `SENT` ou `SIGNED`. L'Outbox doit appeler le consumer
TypeScript pour les événements `SignatureEnvelopeReadyV1`,
`ContractSignatureRequestedV1` et `ContractAmendmentSignatureRequestedV1`.

Le callback est `POST /api/webhooks/yousign`. Il vérifie
`x-yousign-signature-256`, soit `sha256=` suivi du HMAC-SHA256 du corps brut.
L'en-tête `x-yousign-issued-at` n'entre pas dans ce HMAC ; il n'est pas utilisé
comme preuve de fraîcheur. Le `sandbox=true`, `event_time` et `event_id` doivent
appartenir au payload signé. Le body est borné à 128 Kio. Les événements traités
sont `signature_request.activated`, `signature_request.canceled`,
`signature_request.declined`, `signature_request.expired`, `signer.done` et
`signer.error` ; configurer l'abonnement sur ces événements.

L'inbox de domaine conserve l'unicité du `provider_event_id` et du nonce. La
tolérance de 300 secondes par défaut doit correspondre à la configuration SQL
du fournisseur. Les retries retardés au-delà de cette tolérance restent
fermés et nécessitent une réconciliation. Le traitement est synchrone : la
collecte de preuves peut dépasser la courte fenêtre de réponse initiale de
YouSign. Les retries et l'ordre des événements doivent être éprouvés en sandbox
avant une recette d'exploitation réussie. Aucune livraison webhook instantanée
n'est revendiquée.

Avant la dernière signature, le transport exige le statut distant `done`, tous
les signataires `signed`, les identifiants exacts et les empreintes initiales des
documents présentes dans les audits JSON YouSign. Il télécharge les vrais PDF
signés et audits JSON, les archive dans le nouveau bucket privé
`signature-provider-evidence`, lit effectivement chaque objet et recalcule son
hash. Les références et reçus sont immuables. Un digest du PDF d'audit n'est
jamais présenté comme certificat ou jeton d'horodatage. La transition de domaine
finale conserve les contrôles de source, parties, autorité et gouvernance.
Le paquet de domaine existant conserve son hash historique. Une liaison native
immuable séparée relie son identifiant au manifeste exact des fichiers signés et
audits privés, au hash du transport et au hash canonique de ce manifeste ; sa
création est auditée. Les parties peuvent lire ces empreintes via
`get_yousign_native_evidence_binding_v1`, sans exposer les fichiers privés.
Le snapshot technique de consentement référence les audits natifs par
signataire et hash : le transport vérifie les champs réels
`signature_request.sent_at`, `signer.consent_given_at` et
`signer.signature_process_completed_at`, dans cet ordre chronologique. Il
n'invente ni case juridique acceptée,
ni formulation de consentement ; l'appréciation juridique de cette preuve
relève de la politique indépendante approuvée.

## Contrat officiel consulté

- [Guide de création](https://developers.youtrust.com/docs/create-your-first-signature-request)
- [Créer un signataire](https://developers.youtrust.com/reference/post-signature_requests-signaturerequestid-signers-1)
- [Activer](https://developers.youtrust.com/reference/post-signature_requests-signaturerequestid-activate-1)
- [Annuler](https://developers.youtrust.com/reference/post-signature_requests-signaturerequestid-cancel-1)
- [Recherche par external_id](https://developers.youtrust.com/reference/get-signature_requests-1)
- [Protocole webhook](https://developers.youtrust.com/docs/use-webhooks-in-your-app)
- [Audit JSON par signataire](https://developers.youtrust.com/reference/get-signature_requests-signaturerequestid-signers-signerid-audit_trails-1)
- [Document individuel](https://developers.youtrust.com/reference/get-signature_requests-signaturerequestid-documents-documents-id-download-1)

## Validation locale reproductible

Le runner `node scripts/release/yousign-transport-acceptance.mjs
supabase_db_MatriciaV1Closure20261109` n'accepte qu'un nom de conteneur local
jetable explicite. Il réutilise le contrat canonique et l'archive FR/AR de la
fixture SQL 0241, puis ajoute une attestation propriétaire, une politique
four-eyes et des références de fournisseur **synthétiques** dans un rollback.
Il exerce claim, persistance des références, refus de changement, acceptation,
rejeu, callback SENT, signature partielle, refus du final sans fichiers,
transition finale et liaison immuable du manifeste. Ses 58 assertions locales
ne constituent ni visa juridique ni recette des vrais fichiers YouSign.
Les 21 assertions SQL séparées contrôlent aussi les ACL, JWT, RLS et refus.

Les limites d'exploitation restent explicites : les dates d'expiration des
pouvoirs/politiques ne sont pas encore projetées dans `expiration_date` de la
demande distante ; l'annulation native ne dispose pas encore d'un parcours UI
ou d'une reprise automatique après révocation. Le domaine bloque les effets
non autorisés mais une demande distante peut nécessiter une annulation depuis
YouSign et une réconciliation. Ce transport reste limité au sandbox.

Les références historiques `developers.yousign.com` redirigent vers ce domaine
de documentation. Aucun appel authentifié YouSign ni aucune signature réelle
n'a été réalisé par les tests de contrat locaux.
