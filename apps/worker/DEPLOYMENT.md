# Worker et scanner de staging

Le worker existant expose `/health`, `/readiness` et le scanner authentifié
`POST /scan`. Il consomme les événements documentaires avec ClamAV natif et
transmet les autres événements au consumer web authentifié. Un second serveur
scanner n’est pas nécessaire.

## Image et déploiement

Le Dockerfile se construit **depuis la racine du monorepo** :

```sh
docker build -f apps/worker/Dockerfile -t matricia-worker .
```

L’image utilise Node 22.23.4 et pnpm 10.17.1. Le build conserve explicitement les
dépendances de développement : `start` exécute TypeScript avec `tsx` et les
packages workspace exportent leurs sources. L’image s’exécute avec l’utilisateur
non privilégié `node`. `.dockerignore` exclut les fichiers d’environnement, clés
et installations locales ; seules les sources worker/observability sont copiées.

`railway.json` sélectionne ce Dockerfile et son healthcheck `/readiness`. Déployer
ce service dans **un environnement staging distinct**, avec son propre Supabase,
son consumer web et ses secrets. Le statut READY de l’image ne certifie pas le
traitement d’une file ni une livraison de notification.

## Bindings serveur requis

| Service worker | Contrat |
| --- | --- |
| `APP_ENV` | `staging` ; n’autorise pas un mock interdit par `NODE_ENV=production`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Origine HTTPS du projet de staging isolé. |
| `SUPABASE_PROJECT_REF` | Référence de 20 caractères correspondant exactement à cette origine. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur du staging, jamais envoyée au navigateur. |
| `WORKER_DISPATCH_URL` | URL HTTPS de `/api/internal/outbox` sur le web de staging. |
| `WORKER_DISPATCH_ALLOWED_HOSTS` | Hôte exact de cette URL, sans wildcard ni schéma. |
| `INTERNAL_WEBHOOK_SECRET` | Même secret d’au moins 32 caractères sur le worker et le consumer web. |
| `MALWARE_SCANNER_TOKEN` | Secret distinct d’au moins 32 caractères, sans espace, partagé avec le web. Son absence interdit le démarrage. |
| `PORT` | Injecté par l’hébergeur ; 8080 par défaut. |

Générer les secrets dans le coffre de l’hébergeur. Ne pas les copier dans une
commande enregistrée, un journal, une URL, Git ou ce document. La clé scanner
sert aussi à authentifier les réponses HMAC ; elle doit être identique aux deux
extrémités. Garder `INTERNAL_WEBHOOK_SECRET` et `MALWARE_SCANNER_TOKEN` distincts.

## ClamAV natif sur le réseau privé

Déployer un service **ClamAV réel** dans le même réseau privé que le worker.
Utiliser une image officielle `clamav/clamav` à version et digest immuables,
maintenir les bases de signatures à jour avec `freshclam` et conserver son volume
de données. Dimensionner mémoire et CPU pour le chargement des bases. Le port TCP
3310 ne doit pas être publié sur Internet ; autoriser seulement le worker.

| Binding worker | Contrat |
| --- | --- |
| `CLAMAV_HOST` | Nom DNS privé du service ClamAV. |
| `CLAMAV_ALLOWED_HOSTS` | Ce nom exact ; aucune wildcard. |
| `CLAMAV_PORT` | Port TCP natif ; 3310 par défaut. |
| `CLAMAV_NETWORK_MODE` | `PRIVATE` pour un service distant du même réseau privé. |
| `CLAMAV_ENGINE_VERSION` | Version exacte attestée par la commande native `VERSION` du service installé, correspondant à l’image retenue. |
| `CLAMAV_MAX_DATABASE_AGE_HOURS` | 48 par défaut ; plage acceptée 1–168 heures. |
| `CLAMAV_TIMEOUT_MS` | 15000 par défaut ; le scan HTTP utilise au plus 12000. |

La readiness demande un `PING` natif et un `VERSION` vérifié, avec numéro de base
positif et date canonique suffisamment récente. Le scan vérifie cette attestation
avant et après `INSTREAM`. Un changement d’image nécessite d’aligner la version
attendue ; une simple connexion TCP ou un `INSTREAM OK` ne suffit pas à déclarer
le service opérationnel. Aucun override ne doit transformer une base périmée ou
une version inattendue en résultat CLEAN.

## Exposition HTTP et configuration web

Exposer uniquement le port HTTP du worker derrière le TLS de l’hébergeur, avec
une origine HTTPS stable de staging. Le web Vercel ne rejoint pas directement le
réseau privé ClamAV ; il appelle le worker public `/scan` avec le bearer dédié,
le nonce, le hash et la vérification HMAC existants.

| Service web de staging | Contrat |
| --- | --- |
| `MALWARE_SCANNER_URL` | URL HTTPS stable et complète du worker, terminée par `/scan`. |
| `MALWARE_SCANNER_ALLOWED_HOSTS` | Hôte exact du worker, sans schéma ni wildcard. |
| `MALWARE_SCANNER_TOKEN` | Même secret que le worker. |
| `DELIVERY_PROOF_SCANNER_MODE` | `EXTERNAL` pour les preuves de livraison externes. |
| `INTERNAL_WEBHOOK_SECRET` | Même secret que le dispatcher worker. |
| `CRON_SECRET` | Secret dédié des routes cron web ; distinct du bearer scanner. |

Le worker valide ses bindings avant d’écouter. Les appels Supabase disposent
d’une limite réseau de 30 secondes qui reste active pendant la lecture du corps
de réponse. Le dispatcher web dispose de sa propre limite de 10 secondes. Un lot
Outbox peut néanmoins contenir plusieurs appels consécutifs : à chaque lecture
de readiness, les derniers résultats antivirus et Outbox expirent après 60
secondes, y compris pendant un lot encore en cours. Les codes
`ANTIVIRUS_CHECK_STALE` et `OUTBOX_POLL_STALE` distinguent un succès trop ancien
d’un échec explicite. Un cycle normal en cours ne dégrade donc pas immédiatement
la readiness ; un ancien succès ne la maintient pas indéfiniment. Les heartbeats
antivirus/scanner relisent cet état avant leur envoi. `/health` reste un contrôle
de vie du processus, distinct de la readiness des dépendances.

Les ticks de polling concurrents partagent une seule promesse de cycle et un seul
heartbeat de fin ; un lot long ne crée pas une rafale de callbacks en attente.
Un timer distinct peut publier les heartbeats toutes les 15 secondes pendant ce
lot. Les publications concurrentes partagent elles aussi une seule tâche de
publication en cours ; elles utilisent toujours la fraîcheur observée au moment
de la lecture, sans renouveler un ancien succès Outbox expiré.

Les emails ne s’activent pas avec le seul nom `EMAIL_PROVIDER`. L’adaptateur web
exige `EMAIL_DELIVERY_MODE=EXTERNAL`, `EMAIL_LIVE_DELIVERY_ENABLED=true`, une
allowlist explicite de destinataires et soit Resend configuré, soit le fournisseur
HTTP configuré et allowlisté. Le SMTP des OTP Supabase est une configuration
séparée. Ne pas remplacer ces gardes par un alias qui activerait implicitement
une livraison réelle.

## Recette native avant validation

1. Vérifier qu’un token absent ou court refuse le démarrage, puis que la readiness
   reste 503 avant les premiers cycles et lorsque ClamAV est indisponible.
2. Vérifier version exacte et fraîcheur de base ; arrêter ClamAV, périmer la base
   et changer la version attendue pour contrôler les refus et la reprise.
3. Tester une requête `/scan` sans authentification, un mauvais bearer, un hash
   différent et le rejeu d’un nonce : aucun ne doit retourner CLEAN.
4. Envoyer un fichier propre et le fichier de test antivirus EICAR par le vrai
   protocole signé ; conserver les reçus CLEAN et INFECTED avec le hash et
   l’attestation d’engine/base. EICAR est un fichier de test, jamais une pièce KYC.
5. Contrôler la persistance des résultats, la quarantaine et les refus inter-tenant
   des documents client, prestataire, livraisons, messages, coûts et fichiers DSR.
6. Vérifier les heartbeats `MATRICIA_WORKER`, `CLAMAV` et `SCANNER_HTTP`, la reprise
   après indisponibilité, les retries/DLQ et le rejeu sans doublons.

Les ZIP restent refusés par `ARCHIVE_SCAN_CAPABILITY_REQUIRED` : ce protocole ne
prouve pas l’inspection des archives ni leurs limites d’expansion. Ne pas déclarer
les ZIP supportés parce qu’un bucket les accepte. Un hébergement, un endpoint ou
une clé renseignés ne constituent pas une preuve de cette recette.
