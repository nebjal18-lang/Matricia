# Intégrations runtime — état vérifié

Date de vérification : 2026-09-15.

Ce document décrit uniquement les contrats de configuration. Il ne contient aucune valeur de secret.

## Courriel transactionnel

Le worker de notifications échoue fermé par défaut. Deux adaptateurs sont disponibles :

- Resend natif, avec `RESEND_API_KEY`, `RESEND_FROM_EMAIL` et éventuellement `RESEND_FROM_NAME` ;
- fournisseur HTTP générique strictement allowlisté, avec `EMAIL_PROVIDER_ENDPOINT`, `EMAIL_PROVIDER_ENDPOINT_ALLOWLIST` et `EMAIL_PROVIDER_TOKEN`.

Les deux exigent `EMAIL_DELIVERY_MODE=EXTERNAL`, `EMAIL_LIVE_DELIVERY_ENABLED=true` et une destination autorisée par `EMAIL_RECIPIENT_ALLOWLIST`. Le mode `DEMO` est interdit lorsque `NODE_ENV=production`. L'idempotence logique est transmise au fournisseur. Une réponse fournisseur sans identifiant valide reste un échec réessayable : elle n'est jamais présentée comme livrée.

## Event Outbox

Les événements `DocumentUploadedV1` sont consommés par le worker de scan documentaire. Les autres événements sont envoyés à `/api/internal/outbox`, qui est désormais explicitement identifié comme consommateur terminal `TERMINAL_OBSERVABILITY`.

Ce consommateur :

- authentifie la requête avec `INTERNAL_WEBHOOK_SECRET` ;
- valide strictement l'enveloppe et sa taille ;
- écrit uniquement les métadonnées minimales de corrélation dans le journal structuré ;
- n'écrit jamais le payload métier dans les logs ;
- répond `OUTBOX_EVENT_OBSERVED`, sans prétendre avoir exécuté un effet métier.

Tout nouvel effet asynchrone métier doit être implémenté comme consommateur dédié avant que l'événement correspondant puisse être considéré traité par cet effet. Le terminal d'observabilité ne remplace ni une notification, ni un paiement, ni une signature.

## URL publique et SEO

L'URL canonique est résolue dans cet ordre : `NEXT_PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, puis `VERCEL_URL`. En production, seules les URL HTTPS sans identifiants intégrés sont acceptées. Une configuration absente ou invalide fait échouer la construction des métadonnées au lieu de publier des liens `localhost`.

## Signature électronique

`@matricia/signature-v41` définit le contrat `SignatureProvider` et une garde de readiness. Le mock fourni est limité au développement, au niveau `SIMPLE`, et est refusé en production.

Une mise en service réelle reste une décision externe : sélectionner un fournisseur compatible avec le niveau juridique requis au Maroc, obtenir ses identifiants et implémenter son adaptateur. La garde attend uniquement les noms de configuration `SIGNATURE_PROVIDER_MODE` et `SIGNATURE_PROVIDER_CODE`; elle ne résout, n'affiche et ne journalise aucun secret. Aucun adaptateur réel n'est simulé dans le dépôt.


### Source PDFs for contracts and amendments (259500)

The authenticated `/api/signatures/contracts/{contractId}/documents?locale=fr|ar&contractVersionId={versionId}` and `/api/signatures/amendments/{amendmentId}/documents?locale=fr|ar` routes archive both localizations from frozen, recomposed sources. They use the private `signature-source-documents` bucket, deterministic embedded fonts, exact minor-unit amounts, no overwrite, actual HTTP readback/hash verification, atomic service-only registration and a final caller access check. Real READY requires both verified localized artifacts and the exact PDF declared on the envelope. These are source PDFs, never a signed-document or certificate claim. Read [the source-document contract](../../apps/web/modules/shared/lib/signature-documents/README.md) for RPCs, limits and separate validation evidence.

Unclassified legacy artifacts are not assigned an inferred language. Existing signature binding hashes remain unchanged. The governed SIMPLE mock remains explicitly noncontractual in trusted DEVELOPMENT/STAGING; real provider/level/legal approval and native evidence requirements remain closed until supplied and validated.


### DSR file scanning (267100/267110)

`GET/POST /api/workers/privacy-file-scans` is a separate authenticated cron (one leased file, five-minute interval, `PRIVACY_FILE_SCANNER` heartbeat). It verifies private bucket/path/upload ID, byte size/hash and durable completion with lease/CAS. Unknown checksums remainNULL when no bytes are read. RPC5s, Storage10s, native scanner20s and heartbeat5s stay within the60s route budget. Unauthorized traffic cannot renew liveness. JSON/CSV bytes retain the MIME validated by the domain upload API and pass to the existing pinned/TLS/HMAC scanner; they receive no invented sandbox CLEAN.

ZIP remains explicitly blocked by both worker and HTTP gateway with `ARCHIVE_SCAN_CAPABILITY_REQUIRED`. A bare ClamAV INSTREAM OK does not prove archives were inspected, encrypted entries rejected, or expansion limits handled. No ENV boolean asserts that capability. Files remain retained and retries/dead letters are durable; reviewed PDF/JSON/CSV files are the current alternative. An actual native archive capability protocol plus encrypted/oversized archive recipe is still required to enable ZIP. AV CLEAN never approves redaction or completes a DSR delivery.

Operations consume the domain's active-queue projection, expose only status/count/age, alert on active DEAD_LETTER/lag/missing scanner and separate HISTORICAL_ERROR. An unavailable DSR counter shows an explicit unavailable card without hiding the other operational panels. Inventory events DsrAll… are terminal observations of SQL/audit facts, never purge/delivery/email commands.


### Admission from actual subscription funding (268000)

Payment/cycle history is immutable. New paid entitlements use the exact currently funded cycle and its immutable plan version, not the mutable subscription plan pointer. Funding binds event/intent/org/amount/currency/reference/hash/period/cycle number/activation result and the balanced source journal. The trusted deployment is read privately. DEMO/SANDBOX can fund simulation only in their matching explicit DEVELOPMENT/STAGING context; they cannot become production rights after a metadata promotion. A genuine LIVE source remains real after infrastructure promotion. Missing/unverifiable sources fail closed for new paid effects without relabelling accounting history.

The approved active trial branch remains independent. Onboarding without an active subscription does not acquire an invented block. Current-period boundaries are checked. New request insertion and RFQ admission share the same financial/identity/funding guard; other financial holds are preserved. Credit lots and independent ADMIN_GRANT/BONUS/PROMOTION rights are handled separately by268010, including provenance of rollover credits.

Legacy UPGRADE_IMMEDIATE is refused with SUBSCRIPTION_UPGRADE_CHECKOUT_REQUIRED because no approved differential/proration checkout exists. DOWNGRADE_NEXT_CYCLE records a future choice without adding present entitlements. Current funding review uses SUBSCRIPTION_CURRENT_FUNDING_REQUIRED. The read-only get_client_subscription_funding_v1 projection identifies the actual funded plan and reports an explicit review state. No new money or proration policy is invented.

Before a new order or capture, the subscription must be activatable and clear of financial/identity holds. Already paid, authorized PayPal capture retries return their exact recorded activation receipt without another provider call. These preflight checks do not constitute a claim that multi-order asynchronous capture reconciliation is complete; any additional concurrency/reconciliation work must be tested separately.

Validation: source-function hashes compared MAIN/clone before the counterexample (the clone was first brought to259000). The same real SQL v2 fixture chain DEMO→intent→balanced journal→cycle showed rights=true after PROD retag before268000, false afterwards. 0245 passes37 assertions on the disposable clone with ROLLBACK, including canonical LIVE-provider fixtures, periods, funded plan, upgrades, replay, genuine trial evidence and onboarding. This uses synthetic trusted SQL callback fixtures, not an actual external capture or production activation. MAIN was neither retagged nor modified during these proofs.
