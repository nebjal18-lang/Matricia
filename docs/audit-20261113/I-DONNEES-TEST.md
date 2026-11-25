# I. État des données de test

| Objet | Action | Statut fin d’audit |
|---|---|---|
| Session démo `demo.prestataire@matricia.test` | Login / logout | Session invalidée / page crash ; cookies locaux navigateur audit |
| Org `1d49fa48-…` (Assurance…) | Lecture qualification | Aucune mutation métier volontaire |
| Org `359e4bb1-…` (Communication…) | Changement contexte Afficher | Lecture seule |
| Comptes / RFQ / missions créés | — | **Aucun** objet métier nouveau créé |
| Paiements / emails | — | Aucun |

**Nettoyage** : aucun enregistrement métier à purger. Les cookies du navigateur d’audit peuvent être effacés manuellement.
