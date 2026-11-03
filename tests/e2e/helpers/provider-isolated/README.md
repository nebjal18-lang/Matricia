# Vérifications SQL locales annulées

`transaction.mjs` réutilise exclusivement une cible créée par le harness Client local : `loadOwnState` vérifie les labels de tous les conteneurs, le réseau Docker interne, l'absence de ports publiés et le token explicitement demandé. Il ne consulte aucune configuration de base distante. Un seul propriétaire doit utiliser la cible à la fois.

```sh
APP_ENV=development node tests/e2e/helpers/provider-isolated/transaction.mjs \
  --browser-root=/absolute/owned-browser-worktree \
  --target-token=<UUID-du-run-local-explicitement-retenu> \
  --migration=/absolute/repository/supabase/migrations/nom.sql \
  --test=/absolute/repository/supabase/tests/nom.test.sql \
  --output=/absolute/current-repository/work/provider-sql-run
```

Répéter `--migration` pour chaque migration requise, dans l'ordre. Un seul fichier pgTAP est exécuté par invocation : lancer une nouvelle transaction pour le fichier suivant, car le plan pgTAP est lié à la session. Les migrations sont encadrées par `BEGIN`/`COMMIT`, retirés pour les inclure dans l'unique transaction externe. Aucun `COMMIT` n'est envoyé à la base. Le test final et les migrations sont annulés ensemble ; l'empreinte de schéma avant/après doit être identique, chaque assertion doit passer, les cas sautés ne sont pas acceptés. Les fichiers de test qui désactivent les triggers sont refusés.

Le reçu décrit un test transactionnel sur un schéma local existant. Il ne remplace ni un rejeu complet sur une base neuve, ni la recette GoTrue/navigateur, ni une validation de staging ou de production. Les séquences PostgreSQL peuvent avancer malgré l'annulation ; leurs trous ne représentent aucune écriture métier persistée. Les journaux et états privés restent sous `work/`, ignoré par Git. Les recettes de restauration/suppression du harness initial gardent leurs propres gardes ; ce runner ne supprime aucun conteneur.
