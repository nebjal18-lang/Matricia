# B. Matrice des tests — 4 espaces

| ID | Espace | Fonction | Rôle | Attendu | Observé | Statut | Bug |
|---|---|---|---|---|---|---|---|
| C-01 | Client | Dashboard | demo.client | Accueil métier cohérent | Widgets « Indisponible » + alerte rôle | ÉCHOUÉ | ESP-003 |
| C-02 | Client | Diagnostics | demo.client | Liste / vide explicite | Vide OK, actions présentes | RÉUSSI (partiel) | ESP-002 titre |
| C-03 | Client | 15 routes clés | demo.client | 200 + contenu | 200 partout ; titres « Matricia » | ÉCHOUÉ (titres) | ESP-002 |
| C-04 | Client | Hydratation shell | demo.client | Pas d’erreur React | Overlay hydration ClientAppShell | ÉCHOUÉ | ESP-004 |
| C-05 | Client | Calculer santé globale | demo.client | Feedback / résultat | Clic sans changement visible | ANOMALIE | ESP-006 |
| ST-01 | Sous-traitant | Dashboard | demo.prestataire | Accueil prestataire | Contenu + états vides OK | RÉUSSI | — |
| ST-02 | Sous-traitant | Qualification+org | demo.prestataire | Dossier | 200, h1 OK | RÉUSSI | ESP-002 |
| ST-03 | Sous-traitant | Consultations/devis/missions… | demo.prestataire | 200 | 200 | RÉUSSI | ESP-002 |
| ST-04 | Sous-traitant | Facturation | demo.prestataire | Accès métier | Alerte rôle interdit | ÉCHOUÉ | ESP-005 |
| FR-01 | Franchise | Accueil | demo.franchise | Cockpit bibliothèque | Accès non autorisé | ÉCHOUÉ | ESP-001 |
| FR-02 | Franchise | 9 modules | demo.franchise | Accès ou NO_MANDATE clair + candidature | forbid=true partout | ÉCHOUÉ | ESP-001 |
| FR-03 | Franchise | +organizationId URL | demo.franchise | Contexte org | Toujours interdit | ÉCHOUÉ | ESP-001 |
| AD-01 | Admin | Command center | demo.admin | Vue d’ensemble | Charge, KPIs | RÉUSSI | ESP-002 |
| AD-02 | Admin | Organisations | demo.admin | Liste filtrable | 7 résultats, filtres, export | RÉUSSI | ESP-007 |
| AD-03 | Admin | Demandes | demo.admin | File métier | Page lourde (~1300 nœuds a11y) | RÉUSSI (perf risque) | ESP-008 |
| X-01 | Tous | Titre document | tous | Titre page \| Matricia | Toujours « Matricia » | ÉCHOUÉ | ESP-002 |
