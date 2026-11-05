# Déploiement et retour arrière

État de validation distante : **À EXÉCUTER sur staging autorisé**. Aucune commande de ce document n’autorise une modification de production.

1. Identifier le SHA candidat, versions Node/pnpm, migrations et providers requis ; vérifier `release:structure`, puis les preuves du manifeste de livraison.
2. Lire la politique réseau et l’identité de chaque cible ; confirmer project ref Supabase, projets/équipes Vercel/Railway et classe d’environnement. Inspecter uniquement noms/statuts de bindings. Refuser une cible inconnue ou production pendant la recette.
3. Installer depuis le lockfile gelé. Fournir l’URL publique HTTPS et la configuration de l’environnement via le coffre de l’hébergeur ; aucune clé dans le Git, les logs ou le manifeste de preuve.
4. Sauvegarder et vérifier l’existant avant migrations. Les migrations appliquées restent immuables ; exécuter les nouvelles migrations additives sur staging, seed déterministe uniquement si la cible de recette l’autorise.
5. Déployer web depuis `apps/web` et worker selon `railway.json`. Contrôler les méthodes HTTP, secrets et fréquences de `apps/web/vercel.json`, les limites de durée et le réseau antivirus. Éviter les consumers concurrents pendant les scénarios de concurrence SQL.
6. Vérifier santé technique et dépendances nécessaires ; effectuer une vraie chaîne OTP, document scanné, effet Outbox, cron, paiement sandbox et publication sandbox dans leur périmètre contractuel. Un HTTP `ready` partiel ou un simple log ne certifie pas l’effet fournisseur.
7. Rejouer recettes FR/AR mobile/bureau, autorisations et budgets de performance ; rattacher les artefacts au SHA effectivement déployé, pas uniquement au SHA local.
8. Exercer le retour à l’artefact web/worker précédent. Ne pas réappliquer aveuglément un ancien schéma : définir avec le propriétaire données la compatibilité, les migrations correctrices et le sort des écritures créées entre versions. Vérifier reprise des files et absence de doublons.
9. Après validation et autorisation distincte de production, appliquer la procédure approuvée avec responsable, fenêtre, seuils de rollback et supervision. Consigner le résultat réel ; ne pas accorder de visa en avance.

## Build Vercel préconfiguré

Le dépôt fournit la configuration Next.js native aux trois emplacements : racine du dépôt, `apps/web` et, pour un projet existant ciblant la bibliothèque, `packages/domain`. Chaque configuration fixe le framework, la commande de compilation, l’installation avec lockfile gelé et la sortie réelle Next ; les quinze crons restent identiques.

- Racine : `pnpm run build:vercel` compile uniquement `@matricia/web`, sortie `apps/web/.next`. Next/React/React DOM sont déclarés à la racine aux mêmes versions que l’application pour permettre leur détection par l’adaptateur Vercel.
- Application : `pnpm run build`, sortie `.next`.
- Compatibilité domaine : la configuration lance le même build web depuis le workspace, puis expose sa véritable sortie `.next`, ses fichiers publics et ses dépendances via des liens relatifs. Le helper vérifie les collisions avant toute modification et préserve les dépendances de la bibliothèque. Seul un ancien dossier `.next`, artefact de build, peut être remplacé. Le script métier `domain build` reste `tsc --noEmit`.

Comme tout build de ce monorepo, l’hébergeur doit rendre accessibles les fichiers workspace hors du sous-répertoire choisi et fournir les variables d’environnement de l’application. Aucun secret n’est enregistré dans ces configurations. Le build complet nécessite une cible TypeScript ES2020 pour les calculs BigInt exacts des questionnaires.

Validation locale : build complet sous Node22/pnpm10, packaging avec l’adaptateur officiel `@vercel/next` depuis les trois emplacements ; fonctions serveur, API, assets et routes préservés. Les essais de packaging utilisent des copies jetables et ne déploient rien. Preuve : `docs/evidence/vercel-autobuild.json`. La vérification du déploiement distant reste distincte.
