# Dossier de remise V1

État : **NON SIGNÉ — réception finale non accordée**. Ce dossier décrit les conditions et procédures ; il ne certifie pas à lui seul leur exécution.

## Version et périmètre

La référence de livraison est le SHA complet dans le manifeste `RELEASE_MANIFEST_PATH`, validé avec `pnpm release:validate`. Les 68 fonctions et 8 exigences Marketing restent suivies individuellement dans `docs/traceability/REQUIREMENTS_COVERAGE.md`. Aucune fonction 069–090 ne peut être ajoutée pour contourner un défaut V1.

## Commandes

- Installation : Node ≥22.13, Corepack et pnpm 10.17.1 ; `corepack pnpm install --frozen-lockfile`.
- Développement local : `bash scripts/start-local-supabase.sh`, puis `corepack pnpm dev` ; ne jamais réinitialiser une base existante pour une recette sans conservation autorisée.
- Qualité reproductible : `corepack pnpm verify` ; bases et E2E sont exécutés séparément sur les cibles autorisées.
- Intégration HTTP : `corepack pnpm test:integration` (serveur loopback réel et dispatcher Outbox, pas une recette SQL distante).
- Recette navigateur publique : `corepack pnpm test:e2e:public` ; authentifiée : `test:e2e:authenticated` ; workflows : `test:e2e:workflows`. Les deux dernières exigent les fichiers de session générés, jamais committés. Tout test ignoré, flaky ou attendu en échec bloque le runner.
- Mesure : `corepack pnpm test:performance <plan-staging.json>` et le gate catalogue documenté dans `docs/evidence/p06/CATALOG_LOAD_GATE.md`.
- Préparation de la preuve : `corepack pnpm release:prepare`, puis collecte et validation décrites dans `RELEASE_EVIDENCE.md`.
- `release:structure` vérifie le bootstrap sans autoriser de livraison. `release:validate` est le gate strict ; un échec est attendu tant que les preuves et visas requis manquent.

## Remise à l’exploitant

Transmettre les accès nominatifs via le coffre sécurisé retenu ; aucun token, mot de passe, code OTP, dump brut ni session navigateur dans cette documentation. Vérifier le transfert effectif des projets Supabase/Vercel/Railway, domaines/DNS, facturation des hébergeurs et comptes fournisseurs. Inventorier les rôles administratifs et retirer les accès temporaires.

Fournir le guide des quatre espaces, les scénarios de recette et données synthétiques, le modèle de support/SLA, l’escalade incident et les procédures de déploiement/retour arrière/restauration. L’équipe de reprise doit exécuter une reconstruction et un exercice d’incident avec la documentation, pas seulement en confirmer la réception.

## Conditions externes non substituables

L’identité juridique, les textes FR/AR, règles fiscales, prix publiables, niveau/fournisseur de signature, comptes OAuth/paiement, CNDP et approbations de production sont confirmés par les responsables habilités. Leur état est consigné dans `EXTERNAL_ACTIVATION_CHECKLIST.md` et dans les preuves du candidat. L’équipe technique ne fabrique ni signature client ni validation comptable.

## Réception

Le procès-verbal est préparé dans `CLIENT_ACCEPTANCE.md`. Sa signature intervient après recette observée du candidat et clôture des P0/P1/P2 convenus. La publication et l’autorisation de production restent distinctes des tests locaux.
