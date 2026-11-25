# Design métier — accueil Client (tranche 1) — 2026-11-25

## Changements

- Menu mobile branché aussi sur `ClientDashboardHome` (shell dédié, pas seulement `ClientAppShell`)
- Slogan décoratif retiré du hero ; remplacé par la prochaine action concrète issue du centre d’actions
- Compteurs d’avancement (demandes / devis / missions) cliquables vers les listes correspondantes
- Script décoratif « décisions » retiré pour laisser l’action « Ouvrir »

## Tests

- `modules/client/screens/dashboard.test.tsx` — 1 pass

## Restant à vérifier en session authentifiée

| Écran | Blocage |
| --- | --- |
| Client comparateur mobile critère-à-critère | Compte client de recette + devis réels |
| Client mission (jalon / livrable / réception) | Mission active de démo |
| Client finances (séparation factures / crédits) | Données finance de démo |
| Prestataire qualification / devis / documents | Compte sous-traitant |
| Franchisé bibliothèque / revue / pilotage | Compte franchisé + mandat |
| Admin file décisions (captures menu) | Compte admin |

Les compositions Provider (`provider-home-treat`) et Admin (`command-work-items`) existent déjà côté produit ; captures et raffinements CSS après login recette.
