# Dépôt financier : diagnostic du refus de la recette locale

Base examinée : `c7806afb`. Le dépôt de test existant est resté `RESERVED` / `PENDING` ; cette réservation ne prouve ni le téléversement validé ni une analyse antivirus réussie.

La reprise navigateur a reproduit le refus HTTP `403` avec le corps `{"code":"REQUEST_ORIGIN_DENIED"}`. Le navigateur et son API utilisaient `http://127.0.0.1:19273`, tandis que `NEXT_PUBLIC_APP_URL` du runtime de recette valait `https://matricia.test.invalid`. Même si le navigateur déclare `Sec-Fetch-Site: same-origin`, l'origine configurée doit correspondre exactement. Le contrôle produit reste inchangé ; la correction consiste à aligner la configuration du seul runtime local avant la reprise du même dépôt.

Deux tests de non-régression ciblés ont été ajoutés :

- La route refuse cette incohérence avant tout accès au transfert, puis accepte de déléguer le même identifiant lorsque la configuration locale est alignée. Le reçu demeure `PENDING` dans ce test.
- Le navigateur conserve le premier refus comme échec. Lors de la reprise du même fichier, il réutilise la même clé idempotente, le même chemin privé et la même URL de validation ; un conflit Storage `409` exige toujours la validation serveur des octets. Aucun reçu `CLEAN` n'est fabriqué.

Vérifications exécutées :

```sh
pnpm --filter @matricia/web exec vitest run 'app/api/finance/cost-proofs/uploads/[uploadId]/route.test.ts' modules/shared/lib/finance-cost-proofs/browser-upload.test.ts --maxWorkers=1
pnpm --filter @matricia/web exec eslint 'app/api/finance/cost-proofs/uploads/[uploadId]/route.test.ts' modules/shared/lib/finance-cost-proofs/browser-upload.test.ts
```

Résultats : 29 tests réussis dans deux fichiers ; ESLint réussi. Ce nombre inclut les tests existants de ces fichiers. La reprise réelle et ses reçus navigateur sont consignés séparément par la recette. Ces tests ne certifient pas la présence d'un moteur antivirus réel, une revue indépendante, un coût nul ou un déploiement hébergé.
