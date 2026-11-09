# YouSign : configuration technique et activation gouvernée

Le connecteur prend en charge la signature SIMPLE sur deux endpoints fixes :

| Déploiement de confiance | Configuration | Endpoint |
| --- | --- | --- |
| DEVELOPMENT / STAGING | sandbox | https://api-sandbox.yousign.app/v3 |
| PRODUCTION | live | https://api.yousign.app/v3 |

Une variable d’application ne peut pas modifier l’étiquette de confiance de la base. Le runtime relit celle-ci avant de construire l’adaptateur ; chaque opération vérifie aussi sa configuration fournisseur, sa politique, son document exact, ses parties et les pouvoirs actuels des signataires.

## Parcours administrateur

1. Dans Configuration, renseigner l’environnement YouSign, la clé API et le secret webhook. L’espace fournisseur est optionnel. Les clés restent dans l’enveloppe chiffrée et ne sont jamais réaffichées.
2. Enregistrer puis tester la connexion. Ce contrôle ne crée aucune signature et ne prouve aucune validité juridique.
3. Une autre personne administratrice avec AAL2 examine et approuve la révision exacte. Cette activation crée une configuration technique SIMPLE sélectionnable dans Administration → Signatures.
4. Faire fournir l’attestation indépendante de l’adaptateur et du périmètre juridique par le processus existant. L’activation des clés ne crée ni attestation, ni politique contractuelle, ni visa juridique.
5. Proposer puis faire approuver la politique de signature correspondant exactement au fournisseur, à l’environnement, à l’émetteur et au type de document. Les noms, emplacements et pouvoirs des signataires doivent être préparés explicitement avant envoi.
6. Exécuter une recette fournisseur autorisée et conserver le webhook, l’audit et le PDF natifs avant tout visa de livraison.

Les webhooks doivent porter le drapeau sandbox authentifié correspondant à l’environnement. Le HMAC porte sur les octets bruts. Un accusé HTTP d’activation ne devient jamais une preuve de signature.

## Rotation et désactivation

Chaque nouvelle révision de clés crée une version technique fournisseur distincte. Elle n’hérite jamais implicitement de l’attestation d’un ancien compte. Un premier brouillon ou refus ne coupe pas les opérations gouvernées existantes. Dès qu’une première révision YouSign a été activée dans Configuration, la version fournisseur d’une enveloppe doit être liée à la révision actuellement active. Une rotation ou désactivation bloque les anciennes enveloppes avant tout appel fournisseur ; une réconciliation explicite est nécessaire.

## Limites de la preuve

Les tests HTTP sont synthétiques. La recette SQL native utilise des acteurs, attestations et objets de Storage synthétiques dans une transaction annulée ; elle ne constitue pas une certification du fournisseur ni une validation juridique. Aucun endpoint réel de production n’a été appelé pendant ce développement.

SIMPLE est le seul niveau pris en charge. Les politiques exigeant ADVANCED, QUALIFIED, un certificat PDF ou un horodatage qualifié restent refusées. L’éditeur visuel de placement n’est pas inclus ; les coordonnées sont préparées par l’API existante. Les issues distantes inconnues exigent une réconciliation avant reprise.

## Rejeu local strict

```sh
node scripts/release/yousign-live-acceptance.mjs supabase_db_MatriciaV1Closure20261109 matricia_staging_full_validation_20261109
```

Le runner exige un conteneur de clôture et une base locale nommée explicitement pour validation. Il refuse les URLs, une base publique ou une cible hébergée, ne lit aucune clé et annule toutes les fixtures.
