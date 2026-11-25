# B. Matrice des tests

Légende statut : RÉUSSI | ÉCHOUÉ | BLOQUÉ | NON EXÉCUTÉ | NON APPLICABLE

| ID | Fonction | Rôle | Organisation | Préconditions | Attendu | Observé | Statut | Preuve | Bug |
|---|---|---|---|---|---|---|---|---|---|
| T01 | Accueil FR | Visiteur | — | Serveur local | 200 + hero Matricia | 200, hero FR, CTA analyser | RÉUSSI | `preuves/AUDIT-HOME-FR.png` | — |
| T02 | Accueil AR | Visiteur | — | Serveur local | 200 | HTTP 200 | RÉUSSI | Probe HTTP | — |
| T03 | Connexion page | Visiteur | — | — | Formulaire OTP + démo | Présent (session antérieure) | RÉUSSI | Snapshot browser | — |
| T04 | Accès protégé anonyme sous-traitant | Anonyme | — | Cookies absents | 307 → connexion | 307 `/fr/connexion?next=…` | RÉUSSI | Probe HTTP | — |
| T05 | Accès protégé anonyme client | Anonyme | — | — | 307 | 307 | RÉUSSI | Probe HTTP | — |
| T06 | Accès protégé anonyme admin | Anonyme | — | — | 307 | 307 | RÉUSSI | Probe HTTP | — |
| T07 | Login démo Sous-traitant | Provider | multi | Bouton démo | Espace prestataire | `/sous-traitant/qualification`, email démo | RÉUSSI | Snapshot + email `demo.prestataire@matricia.test` | — |
| T08 | Garde multi-org sans sélection | Provider | aucune | Login démo | Message choisir org | « Choisissez une organisation » | RÉUSSI | Snapshot | — |
| T09 | Afficher organisation | Provider | Assurance… | Select + Afficher | Session conservée + dossier | Avant fix CSS : redirect connexion ; après CSS : OK | ÉCHOUÉ puis RÉUSSI | Session + URL org | BUG-001 |
| T10 | Consultations liste | Provider | org UUID | org sélectionnée | Liste ou vide explicite | « Aucune consultation… » + pagination 0 | RÉUSSI | Snapshot | — |
| T11 | Devis liste | Provider | org UUID | — | Liste ou vide | « Aucun devis enregistré » | RÉUSSI | Snapshot | — |
| T12 | Tableau de bord provider | Provider | org | — | Priorités / parcours | Contenu métier + overlay erreur module | ÉCHOUÉ (UI bloquée) | Overlay Next | BUG-003 |
| T13 | Outbox sans auth | Anonyme | — | POST `{}` | 401 UNAUTHORIZED | 500 (module signature) | ÉCHOUÉ | Terminal + HTTP | BUG-003 |
| T14 | Login démo Client | Client | — | Bouton Client | Espace client | BLOQUÉ (runtime overlay) | BLOQUÉ | — | BUG-003 |
| T15 | Login démo Franchisé | Franchise | — | Bouton Franchisé | Accueil franchise | BLOQUÉ | BLOQUÉ | — | BUG-003 |
| T16 | Login démo Admin | Admin | — | Bouton Admin | Command center | BLOQUÉ | BLOQUÉ | — | BUG-003 |
| T17 | Déconnexion | Provider | — | Menu compte | Retour connexion | Page crash « couldn’t load » | ÉCHOUÉ | Snapshot | BUG-005 |
| T18 | Cycle RFQ→mission→clôture multi-rôles | Multi | — | 4 sessions | Flux complet | Non démarré | NON EXÉCUTÉ | — | — |
| T19 | Isolation cross-org API | Multi | A vs B | 2 orgs | Refus serveur | Non exécuté | NON EXÉCUTÉ | — | — |
| T20 | Franchise publique | Visiteur | — | `/fr/franchise` | 200 | 200 | RÉUSSI | Probe HTTP | — |
| T21 | Titre document espaces | Provider | — | Page connectée | Titre unique métier | `Matricia \| Matricia` | ÉCHOUÉ | Snapshot title | BUG-004 |
| T22 | Menu compte fermé non cliquable | Provider | — | CSS | Logout invisible | Avant : visible ; après fix : `display:none` | ÉCHOUÉ puis RÉUSSI | CDP computed style | BUG-001 |
