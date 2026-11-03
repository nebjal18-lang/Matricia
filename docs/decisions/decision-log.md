# Journal des décisions

## 2026-11-02 — Délais de litige en jours ouvrables

Gold Master §19.1 prévoit des durées configurables en jours ouvrables ; le moteur utilisait des jours calendaires. La politique approuvée figée dans le contrat peut désormais définir un `business_calendar` versionné (`time_zone`, jours ISO travaillés, dates de fermeture). La politique résolue à l'ouverture fige ce calendrier ; une politique invalide ou une durée supérieure à 3 650 jours bloque l'ouverture avant toute réponse attendue.

En l'absence de calendrier configuré, le défaut technique explicite `STANDARD_WEEKDAYS_UTC_V1` compte du lundi au vendredi en UTC et ne déclare aucun jour férié national. Il constitue un défaut administrable selon §1.2, pas une validation juridique du calendrier applicable au contrat. Les calendriers territoriaux et fermetures propres aux services restent à faire approuver dans les modèles contractuels avant leur activation réelle. Les échéances historiques ne sont pas recalculées.

La réponse conserve séparément l'échéance de revue et, en cas de reconnaissance avec correction, l'échéance corrective. La version du calendrier utilisé est consultable avec le dossier. Les changements de fuseau et d'heure saisonnière conservent l'heure locale de départ.
