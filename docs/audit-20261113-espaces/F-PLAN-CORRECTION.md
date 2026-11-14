# F. Plan de correction (ordre strict)

| Ordre | ID | Action | Critère d’acceptation |
|---|---|---|---|
| 1 | ESP-002 | Retirer `title.absolute` root ; template locale seul | Chaque page a un titre métier distinct |
| 2 | ESP-001 | Seed / rattachement mandat franchise démo + UX NO_MANDATE | Accueil franchise charge le cockpit OU candidature explicite sans faux « interdit » |
| 3 | ESP-003 | Corriger droits/projection dashboard client pour membres client | Plus d’alerte rôle sur ses propres widgets ; Indisponible seulement si panne réelle |
| 4 | ESP-004 | Stabiliser hydratation ClientAppShell (date/locale/random) | 0 overlay hydration sur diagnostics/accueil |
| 5 | ESP-005 | Aligner rôles facturation démo prestataire | Page facturation lisible sans FORBIDDEN |
| 6 | ESP-012 / AUD-01–02 | CSS org-switch comme menu compte (`[open]` only) | CDP : panneau org masqué si fermé |
| 7 | ESP-013 / AUD-07 | Distinguer erreur réseau vs review paiement | État `error` + message |
| 8 | ESP-014 / AUD-09–10 | Passer `organizations` au shell devis | Sélecteur multi-org visible |
| 9 | ESP-015 / ADM-01–03 | Gardes export = mêmes règles que pages sensibles | 401/403/MFA cohérents |
| 10 | ESP-016 / FRA-04–05 | Préserver `NO_MANDATE` + CTA candidature | Plus de faux « non autorisé » |
| 11 | ESP-006–011 + FRA/ADM shell | Feedback santé, filtres, Suspense, shells manquants | Tests ciblés verts |
| 12 | — | Recette E2E authentifiée 4 rôles + 1 parcours transverse | Matrice sans ÉCHOUÉ P0/P1 |
