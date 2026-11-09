# Réparation du staging — 9 novembre 2026

Le candidat reste **non certifié pour la production**. Cette intervention corrige le staging et le code qui l’accompagne ; elle ne vaut ni validation juridique, ni recette fournisseur, ni autorisation de production.

## Configuration réellement appliquée

| Élément | État observé |
| --- | --- |
| Branche Git candidate | `codex/staging-repair-20261109`, issue de `version-2` au commit `4962ce7` |
| Domaine de staging | `https://matricia-staging.vercel.app`, domaine Vercel vérifié et associé à cette branche |
| Supabase staging | `vuwvkpfprixzysjfpgkw`, branche persistante `matricia-staging-20261109` |
| Isolation | Branche créée sans données ; zéro utilisateur, organisation et objet Storage avant reconstruction |
| Variables Vercel | 30 bindings propres à la branche Preview ; bindings existants Production et Development conservés |
| Auth | URL et callbacks FR/AR sur le staging ; OTP serveur et interface à 8 chiffres ; TOTP autorisé ; mot de passe minimum 12 caractères et réauthentification pour changement |
| Connexions | Clés publiques, service-role et connexions PostgreSQL propres à la branche ; références JWT vérifiées avant transfert direct dans le coffre Vercel |
| Secrets internes | Cron, webhook interne, invitations et authentification scanner générés directement en mémoire puis enregistrés dans les bindings Preview |
| Fournisseurs choisis | Resend, PayPal sandbox et YouSign sandbox ; aucune livraison ni opération externe activée sans credentials et recette |
| Production | Aucune écriture sur la base publique, aucun changement des valeurs des bindings Production et aucune promotion |

Les autres branches Preview historiques ne reçoivent pas automatiquement ces bindings. Le nouveau contrôle de build refuse un Preview qui n’annonce pas explicitement un staging et deux références Supabase distinctes, ou dont l’URL pointe vers une autre base. Il faut configurer un nouveau candidat avant son déploiement.

## Reconstruction réelle du schéma

Le pipeline initial de la nouvelle branche Supabase a échoué. Son historique de migrations ne correspondait pas au schéma réellement disponible : les tables natives de contrôle franchise étaient absentes malgré les versions déclarées. Une liaison GitHub historique différente a été constatée ; elle ne prouve pas à elle seule la cause de cette divergence.

Après contrôle de vacuité, seuls les objets applicatifs de cette nouvelle branche ont été reconstruits. Les services `auth`, `storage`, les extensions et les rôles Supabase ont été conservés. Les suppressions ont été fractionnées pour respecter le budget de verrous de la petite instance. Aucun reset du projet parent n’a été exécuté.

Les 575 migrations canoniques ont été exécutées et enregistrées avec leur source exacte. Contrôle effectué avant la migration YouSign : 686 tables publiques, 142 privées, 26 rôles de référence, 11 buckets et 28 politiques Storage. Trois empreintes de fonctions sensibles correspondent à la base locale canonique, dont le reçu final du lien franchise/prestataire. Le contrôle de seed de référence a réussi et l’environnement privé de la base est explicitement `STAGING`.

La migration additive `20261109100000_yousign_sandbox_transport.sql` a ensuite été appliquée, puis le raccordement des données YouSign à l’inventaire personnel a été complété : historique distant **577 migrations**, après la correction additive de confidentialité `20261109101000_yousign_subject_privacy_inventory.sql`. L’ancien échec du pipeline automatique ne doit pas être confondu avec une certification du nouveau schéma ou effacé comme preuve historique.

La campagne CI complète a détecté que le nouveau stockage natif n’était pas raccordé à l’inventaire DSR : le scénario 0243 refusait donc correctement de déclarer une réponse complète. Le correctif ajoute une vraie collecte des fichiers et sept projections personnelles limitées au signataire et à son organisation, sans information de l’autre signataire. Les fichiers restent `UNTRUSTED` avant revue ; les extractions déjà approuvées doivent être reproposées après le changement du hash de catalogue. Aucun visa ni statut CLEAN n’est créé automatiquement.

## Corrections du code

- Node 22 fixé dans le monorepo et les deux racines Vercel possibles ; `.node-version` versionné.
- Build automatique à chaque push : l’étape d’ignorance fondée sur le seul dernier commit est remplacée par une décision explicite de construire. Un push de plusieurs commits terminé par de la documentation ne peut plus ignorer les corrections précédentes.
- Refus des builds Preview connectés au backend public ; aucun changement de comportement des builds locaux et Production.
- Préflight reproductible : scopes, isolation, Auth/OTP, SMTP, secrets, fournisseurs, worker/ClamAV et migrations. Une valeur masquée reste un binding présent ; une observation inconnue reste `UNVERIFIED`.
- Worker : token scanner obligatoire avant démarrage, requêtes Supabase bornées, expiration des preuves de readiness à 60 secondes et coalescence des cycles/heartbeats.
- Image Docker Node 22/pnpm 10, utilisateur UID 1000, secrets exclus de l’image, configuration Railway et guide ClamAV privé.
- Transport YouSign v3 sandbox, claims durables, configuration de chaque signataire autorisée par son identité, dispatch Outbox, webhooks HMAC sur les octets bruts et archives privées immuables.
- PDF final vérifié contre le checksum fournisseur et les audits liés à la source ; consentement explicite daté vérifié séparément de la fin du processus de signature.
- Contrôles de gouvernance, droits actuels des parties, hash source, four-eyes et attestation indépendante conservés. La migration n’invente aucune politique juridique approuvée.

La signature est limitée à `SIMPLE` en sandbox. La préparation des noms et emplacements utilise l’API documentée ; aucun éditeur visuel de placement n’a été livré. Les issues distantes inconnues exigent une réconciliation humaine ; expiration et annulation natives ne sont pas certifiées. Voir [le contrat YouSign](../integrations/YOUSIGN_SANDBOX.md).

## Validation et preuves

Les résultats exacts sont conservés dans `docs/evidence/staging-repair-20261109.json` et dans les rapports de revue. Les suites ne simulent pas un succès externe : transport HTTP mocké pour les tests unitaires ; fixture SQL synthétique sous `ROLLBACK` pour les transitions gouvernées ; build avec bindings hermétiques sans credentials réels.

Commandes de contrôle :

```sh
pnpm test:tooling
pnpm --filter @matricia/worker test --maxWorkers=2
pnpm --filter @matricia/signature-v41 test --maxWorkers=2
node scripts/release/yousign-transport-acceptance.mjs supabase_db_MatriciaV1Closure20261109
pnpm staging:preflight --inventory /chemin/inventory-after-redacted.json --branch codex/staging-repair-20261109 --runtime /chemin/observed-runtime-nonsecret.json
pnpm build:vercel
```

Le runner SQL refuse les conteneurs qui ne correspondent pas au préfixe de base jetable de clôture. Le préflight est un contrôle de configuration, pas un visa de production.

## Restants qui exigent de vrais accès ou des décisions

| Sujet | À fournir ou valider |
| --- | --- |
| Resend et Auth SMTP | Clé Resend, expéditeur/domaines vérifiés, secret webhook et destinataires de recette ; SMTP Auth à configurer séparément |
| PayPal sandbox | Client, secret, webhook, certificat de vérification et monnaies autorisées ; puis capture, doublon, remboursement et réconciliation réels |
| YouSign sandbox | Clé, secret webhook et gouvernance indépendante ; puis signature reçue, audit et PDF natifs sur la sandbox réelle |
| Antivirus/worker | Hébergement worker et ClamAV privé, endpoint TLS, pin moteur et base de signatures à jour ; test CLEAN/EICAR/reprise |
| Réseau d’audit | Autoriser le domaine de staging et son Supabase dans les paramètres réseau du runtime pour la recette navigateur |
| Données de recette | Comptes des quatre rôles, deux personnes administratrices distinctes avec MFA AAL2, contenu et pièces de test ; aucune donnée cliente de production n’a été copiée |
| Métier et production | Tarifs publiables, politiques contractuelles, catalogue et textes FR/AR, CNDP/juridique/fiscalité, auditeur, restauration/pentest et autorisation de production distincte |

Le préflight final conserve des refus explicites pour les services sans credentials, la livraison volontairement désactivée et le worker non observé. Les secrets restent dans les coffres ; aucune valeur n’apparaît dans ces documents.
