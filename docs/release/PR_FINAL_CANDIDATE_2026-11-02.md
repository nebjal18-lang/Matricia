# Corriger les lectures Admin et le contexte des organisations sans affaiblir les protections

La liste Organisations pouvait afficher une liste vide après un refus d’accès, confondre une panne Auth/RPC avec une session absente et rendre ses actions inaccessibles sur mobile. L’éditeur de rôles pouvait viser la première adhésion plutôt que l’organisation sélectionnée.

Le candidat distingue ces états, conserve le contexte exact, impose un choix en cas d’organisations multiples, ajoute les reprises FR/AR et corrige les contraintes de largeur communes. MFA/AAL2, RLS, contrôles serveur et workflows de gouvernance restent actifs. Base : `codex/bootstrap-foundation` à `1ebf3ea`, qui contient consolidation et design.

Validation : types/lint/build PASS ; 2 389 tests unitaires (dont 2 150 web), 18 scénarios publics et quatre scénarios Organisations natifs FR/AR PASS. 225 contrats SQL, 4 926 assertions PASS sur clone isolé de 417 migrations ; 56 contrats exclus ne sont pas présentés comme verts. Le scénario de crédits après expiration réelle reste ouvert.

**PR de revue technique, sans fusion ni production.** M02 reste incomplet, M03–M30 non fournis, et le gate de livraison refuse encore 74 conditions. Voir `docs/release/FINAL_CANDIDATE_2026-11-02.md` et les preuves expurgées associées. Ne pas approuver cette PR comme livraison client définitive sur la seule base de ces contrôles.
