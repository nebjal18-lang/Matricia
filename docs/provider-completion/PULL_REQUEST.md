# Compléter le parcours Sous-traitant et fiabiliser les flux partagés Client

Le prestataire était bloqué à la qualification et rencontrait des erreurs de contexte, de lecture ou de reprise. Cette branche issue du Client final `7e01276` raccorde identité, questionnaire et revue indépendante, coffre privé, capacité, consultations et devis révisés, contrats, livraisons versionnées, affectations, messagerie et finance gouvernée en FR/AR. Elle corrige aussi la reprise après panne, les rôles composites, les périmètres signés ADD/REPLACE/REMOVE, l’origine contractuelle des décisions monétaires, les dates civiles, la navigation du double rôle et la langue du document pendant une navigation SPA.

Les corrections préservent MFA/AAL2, RLS, validation indépendante, audit/outbox et historiques immuables. Aucun montant juridique ou tarif de production n’est inventé ; les données et signatures de recette sont explicitement limitées au test.

Validation :

- Base neuve : 507 migrations, 56 fichiers SQL, 2 067 assertions ; 649 tables publiques avec RLS et pgTAP fermé aux rôles API.
- Web : 2 980 tests plus 30 tests PDF/MFA isolés, un test opt-in ignoré. Worker : 104 tests. Types, lint et builds complets réussis.
- Navigateur : parcours natifs, 232 pages sur 29 routes FR/AR aux quatre largeurs et 256 scans axe sans violation sur `706cd89`. Dernier changement `5b8b0f7` limité à deux libellés Devis : build et huit contrôles ciblés réussis.
- Les 256 occurrences de contrôles de contraste incomplets ne sont pas masquées : 54 cibles mesurées conformes et deux non mesurées ; aucune certification WCAG globale.

[Rapport exhaustif](REPORT.md), [commandes et résultats](VALIDATION.md), [contre-revues](independent-review.md), [captures et provenance](evidence/browser/README.md).

La facture du mois courant et son règlement attendent la date réelle de clôture et le délai contradictoire ; ils ne sont pas déclarés réussis dans le navigateur. Signature juridique, données légales/fiscales approuvées et recette des intégrations hébergées restent nécessaires avant lancement. Aucune fusion ni mise en production dans cette mission.

Base explicite de revue : `codex/client-completion-20261102` au commit `7e01276`, pour isoler le lot Sous-traitant ; source globale conservée `codex/bootstrap-foundation`. La création distante de PR peut être bloquée par l’accès API GitHub ; ce corps prêt à relire ne prouve pas qu’une PR existe.
