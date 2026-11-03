# Corrections des erreurs de l’environnement cloud — 2026-10-31

Périmètre : checkout local à partir de `dbf309c`, sans modification des services hébergés.

## Corrections

- Restauration additive du hash canonique serveur du journal financier, régressé par le durcissement de l’outbox. Signature RPC, autorisations, verrouillage, chaîne d’audit et clé d’outbox conservés. Tests ajoutés : hash client forgé, clé absente, réordonnancement, hash persisté et clé d’outbox.
- Fixtures fiscales transactionnelles distinctes des règles DEMO retirées. La contrainte interdisant `ACTIVE/DEMO` reste en place et possède un test négatif explicite. Test du trigger hébergé compatible avec son absence dans Supabase local.
- Tokens TypeScript alignés sur la palette CSS actuelle ; comparaison des valeurs résolues des aliases et contrastes AA maintenue.
- États React actualisés dans les actions et callbacks concernés ; annulation des découvertes obsolètes, changement d’organisation, pagination des filtres et clés d’idempotence préservés.
- Préférences navigateur compatibles avec l’hydratation, JSON invalide et stockage indisponible ; aucun faux message de succès lors d’un échec d’enregistrement.
- ESLint corrigé sans désactiver les règles ; images rendues par Next Image et attentes de tests adaptées aux URL optimisées.
- URL HTTPS de validation dans la CI ; options Chromium système et vidéo désactivable explicitement pour les runners cloud.
- `scripts/start-local-supabase.sh` : Docker local imposé, exceptions proxy limitées aux hôtes locaux, template public lisible par Kong, correction de la seule sonde loopback BusyBox, contrôles Auth/REST/DB/outbox, clés locales conservées en mémoire et fichier ignoré protégé. Une configuration `.env.local` existante est préservée.

## Vérifications

- Installation gelée répétable ; typage, lint, build Next, phase 00, frontières de 14 packages et absence de marqueurs incomplets validés.
- Vitest : **1 265 tests réussis** dans les workspaces, dont **1 110 tests web** (277 fichiers) et 54 tests worker.
- Rejeu de **233 migrations** et du seed dans une instance PostgreSQL jetable distincte, sans réinitialiser la base existante.
- pgTAP : **174 fichiers, 3 833 assertions**, plus **4 scénarios de concurrence** réussis sur cette base neuve.
- Playwright : **18 tests réussis**, FR/AR, mobile 360 px et bureau ; navigation/accessibilité publiques et régressions des préférences.
- Auth local : email OTP reçu dans la boîte locale, code vérifié, session authentifiée émise ; compte de test supprimé. Aucun code ni jeton affiché.
- Auth et RPC REST de readiness : HTTP 200, base disponible. Démarrage réutilisable exécuté et répété avec succès.
- Revue indépendante en lecture seule : aucun défaut bloquant ; recommandations de couverture fiscale, contrôle REST et fixation du daemon local intégrées.

## Limites

Ces preuves concernent le développement local. Les intégrations Vercel/Railway/Supabase hébergées demandent leurs accès propres ; aucun déploiement ni changement de production n’a été effectué. Les parcours métier authentifiés complets et les fournisseurs externes ne sont pas certifiés par les 18 E2E publics de cette correction. La commande `test:integration` ne contient aucun test et n’est pas comptée comme preuve.
