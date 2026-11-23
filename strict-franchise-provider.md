# Handoff ARCH-01 — franchise / provider

État : correction partielle, phase non verte. Ne pas considérer ARCH-01 comme terminé.

- Contrats locaux : les filtres du catalogue, certaines données et propriétés UI acceptent explicitement `undefined` lorsque leurs appelants et leur logique le traitent comme une absence. La lecture de la bibliothèque utilise directement la bibliothèque validée au lieu d'indexer un tableau artificiel.
- Tests : suppression d'accès indexés non garantis et représentation explicite de valeurs absentes dans les fixtures.
- Vérification : quatre fichiers de tests ciblés, 18 tests réussis. `git diff --check` réussi.
- La commande `tsc --noEmit --incremental false --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noImplicitOverride --noFallthroughCasesInSwitch` dans `apps/web` a échoué ; 317 lignes diagnostiques appartenaient aux chemins franchise/provider/client/sous-traitant lors de cette exécution, avant les derniers ajustements de contrats locaux. Le diagnostic complet est dans le fichier temporaire `matricia-strict-franchise-provider.log` du profil utilisateur. Les fichiers exclus et les consommateurs de read-pages restent à leur propriétaire.
- Tests élargis : 19 fichiers réussis, 7 échoués ; 144 tests réussis, 33 échoués. Les échecs observés signalent `Invalid hook call` avec les dépendances réutilisées. Le lint ciblé n'a pas démarré : `eslint-config-next` introuvable dans cette installation. Node détecté : 24.11.0, pas Node 22.
- À poursuivre : reprendre le diagnostic strict après intégration des contrats centraux et des corrections read-pages, corriger toutes les erreurs restantes du périmètre et les avertissements unused demandés, rétablir un environnement Node 22 / dépendances cohérent, puis relancer TypeScript, lint et tests appropriés. Aucun tsconfig, package ou lockfile modifié.
