# Matricia V1

Plateforme multi-tenant de diagnostic, conformité et mise en relation de services professionnels. Le périmètre et les règles d’autorité sont définis par le Gold Master V4 FINAL et `AGENTS.md`.

## Prérequis

- Node.js 22.13 ou supérieur
- Corepack avec pnpm 10.17.1
- Supabase CLI (installé dans le workspace)
- Docker Desktop pour les resets et tests PostgreSQL locaux

## Installation et développement

```powershell
corepack pnpm install
corepack pnpm dev
```

L’application web est dans `apps/web`, le processeur asynchrone dans `apps/worker`, les modules partagés dans `packages` et les migrations dans `supabase`.

## Environnement cloud local

Après l’installation gelée (`corepack pnpm install --frozen-lockfile`), lancer :

```bash
export COREPACK_HOME=/workspace/.cache/corepack
mkdir -p "$COREPACK_HOME/bin"
corepack enable --install-directory "$COREPACK_HOME/bin"
export PATH="$COREPACK_HOME/bin:$PATH"
bash scripts/start-local-supabase.sh
corepack pnpm dev
```

Le helper utilise uniquement le daemon Docker local, conserve les données et génère les paramètres du Supabase local dans `.env.local` uniquement si ce fichier n’existe pas. Il démarre PostgreSQL, Auth avec TOTP, Storage privé, l’API et la boîte email de test, puis exige leurs contrôles de santé. Les services lourds optionnels restent exclus pour limiter le stockage Docker `vfs`. Aucun secret hébergé n’est nécessaire pour ce workflow.

Après des recettes MFA locales, les observations auditées peuvent rester en attente si le worker n’est pas lancé. La commande `E2E_LOCAL_ISOLATED=1 E2E_LOCAL_PROJECT_ID=Matricia APP_ENV=development node --experimental-strip-types scripts/drain-local-observations.mjs` traite uniquement ces observations via le vrai poller et son consommateur HTTP, dans le Docker local vérifié. Elle démarre temporairement le web si le port 5173 est libre, exige l’accusé de consommation et arrête son serveur ; elle refuse les autres événements métier. Pour les autres files, démarrer le worker configuré et suivre les contrôles d’exploitation.

Le rejeu depuis une base applicative neuve se lance avec `APP_ENV=development node scripts/validate-local-migration-replay.mjs --with-sql`. Il utilise les images Docker locales, applique les migrations officielles Auth et Storage puis les migrations de l’application, dans un conteneur temporaire sans réseau et sans port publié. Il nettoie ses conteneurs et écrit les résultats privés sous `work/isolated-replay/`. Prévoir au moins 4 Gio libres. Cette commande ne remplace ni les tests de concurrence, ni une restauration ou une recette de staging. Les recettes avec OTP, MFA et sessions réelles sont documentées dans [LOCAL_ACCEPTANCE.md](docs/release/LOCAL_ACCEPTANCE.md).

Pour un build de validation local : `NEXT_PUBLIC_APP_URL=https://matricia.example corepack pnpm build`. L’URL HTTPS de déploiement réelle reste requise pour publier l’application.

Avec Chromium système, les tests navigateur peuvent utiliser `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Si le runner n’a pas le FFmpeg Playwright, `PLAYWRIGHT_VIDEO=off` désactive uniquement les vidéos ; traces, captures et assertions restent actives. Voir `docs/evidence/cloud-error-corrections-2026-10-31.md` pour les validations et leurs limites.

## Gates courants

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm verify:phase00
corepack pnpm no-placeholders
```

Les tests SQL/RLS exigent une instance PostgreSQL Supabase locale ou development/staging explicitement autorisée. Aucun environnement de production ne doit être modifié sans autorisation explicite.

## Configuration

Copier les noms requis depuis `.env.example` vers `.env.local`. Ne jamais committer, afficher ou journaliser les valeurs de `.env.local`. L’état vérifié des phases se trouve dans `docs/progress/PROJECT_STATE.md`.
