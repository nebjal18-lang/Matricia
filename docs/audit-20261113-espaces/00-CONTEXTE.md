# Audit strict — 4 espaces connectés

| Champ | Valeur |
|---|---|
| Date | 2026-11-13 |
| Mode | **AUDIT UNIQUEMENT** — aucune correction pendant cette passe |
| Application | Matricia local `http://127.0.0.1:5173` |
| Branche / SHA | `version-2` @ `676883e` (+ correctifs locaux non poussés éventuels) |
| Espaces | Client · Sous-traitant · Franchise · Administration |
| Accès | Boutons démo connexion |
| Exigence | **Très strict** : pas de RÉUSSI sans observation ; pas de « semble OK » |
| Référence | WCAG 2.2 AA (échantillonnage) · Gold Master V1 · AGENTS.md |

## Méthode

1. Session démo isolée par rôle (login → parcours nav → logout).
2. Pour chaque route critique : HTTP/statut UI, erreurs overlay, états vides, actions.
3. Lecture code complémentaire (agents) pour permissions / stubs.
4. Statuts : RÉUSSI / ÉCHOUÉ / BLOQUÉ / NON EXÉCUTÉ.
5. Constats : BUG CONFIRMÉ / ANOMALIE À CONFIRMER / RISQUE / AMÉLIORATION.
