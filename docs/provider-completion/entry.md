# Sous-traitant — entrée, qualification et pièces

Base préservée : `7e01276`. Autorité : AGENTS.md et Gold Master V4 FINAL §§15/17, MAT-FUNC-020/027/028/055. Aucun accès à une base distante, aucune approbation ni donnée commerciale publiée créée.

## Résultat

- Questionnaire Provider réel via `/[locale]/sous-traitant/questionnaires`, utilisant les sessions, sauvegardes et soumissions versionnées existantes. Bibliothèques limitées aux services demandés, audience vérifiée aux commandes Provider, rôles de lecture/édition conservés. Le moteur et l’éditeur Client gardent leurs paramètres par défaut.
- Réutilisation des justificatifs Provider propres, privés et du même tenant dans les questions documentaires ; aucune preuve en quarantaine proposée.
- Éligibilité calculée avec la version documentaire courante par famille. Les obligations de service historiques restent applicables ; la version courante doit aussi porter explicitement le service concerné. Un renouvellement propre limité à B ne certifie pas A. Les autres contrôles d’identité, de finance, de décision humaine et de scan demeurent.
- Capacité et délai lus depuis le même choix effectif service/global que l’éligibilité SQL. Motifs, conditions, expiration et version de qualification visibles.
- Coffre filtré avant pagination sur familles courantes, certifications/références paginées, historique immuable accessible depuis chaque pièce. Complétude fondée sur les pièces légales, fiscales et assurance vérifiées et propres.
- Upload rejouable : clé stable, réservation et chemin conservés, hash lié à la réservation, aucun remplacement d’objet lié.
- Rayon et taille de missions déclarés dans un historique immuable avec CAS, idempotence, audit et outbox. Ces déclarations ne donnent aucune approbation et ne changent pas les règles de matching.
- Liens qualification vers identité commune (autre lot) et questionnaire ; ancres document/capacité restaurées ; lecteurs sans contrôles de mutation actifs.

## Migrations et recette

`20261102038000_provider_entry_evidence_and_replay.sql`, `20261102038100_provider_questionnaire_evidence.sql`, `20261102038200_provider_work_scope_declarations.sql`, `20261102038300_provider_current_evidence_applicability.sql`.

`supabase/tests/0345_provider_entry_acceptance.test.sql` est transactionnel et autonome. Les commandes utilisent SET ROLE : questionnaire Provider complet, réservation/hash/rejeu, scan synthétique explicite via claim/complete, revue humaine AAL2, reprise des justificatifs historiques, portée par service, lecteur/étranger, RLS, immutabilité et CAS. Aucun trigger désactivé. Un verdict de fixture SQL n’est pas une certification d’antivirus externe.

## Vérifications à la remise initiale

- 17 fichiers / 97 tests ciblés réussis (qualification, moteur et UI questionnaires Client, pages de lecture et boards).
- Après les derniers ajouts : 3 fichiers / 22 tests réussis, incluant les liens Provider FR/AR et la lecture seule. Ces nombres se recouvrent et ne doivent pas être additionnés.
- `git diff --check` réussi.
- Lint ciblé et complémentaire terminés : code 0, aucun avertissement. Typecheck complet final : code 0 après correction du contrat de copie localisée, sans changement des clés ni textes Client.
- Replay SQL sur la cible isolée e3 sous verrou : **44/44 assertions PASS**, migrations 38000/38100/38200/38300 dans une unique transaction annulée, `commitSent=false`, empreinte de schéma avant/après identique. Aucun Docker supplémentaire créé par ce lot. Preuves : [receipt](evidence/entry/receipt.json), [transcription SQL](evidence/entry/sql-output.txt).
- Le premier essai SQL a révélé uniquement des erreurs de fixture (trois UUID mal formés, puis correlation_id requis absent sur les appels questionnaire), corrigées sans retirer ni affaiblir de garde ou assertion métier.
- Revue indépendante : renouvellement propre réservé à B ne valide pas A ; Admin non membre AAL2 lit les déclarations, Provider étranger lit zéro ligne sans erreur de permission.

## Prérequis réels

Des questionnaires Provider publiés et approuvés dans les bibliothèques concernées doivent exister. En leur absence, l’interface donne l’état explicite et renvoie vers l’équipe de qualification. La qualification, les pièces et l’identité restent des décisions humaines selon leurs permissions/MFA ; ce lot ne les fabrique pas. La publication d’identité commune est livrée séparément par le propriétaire du lot identité.

## Revue du dépôt soumis et file du réviseur

La recette navigateur a démontré un blocage supplémentaire : le réviseur indépendant ne pouvait lire les réponses privées d'un autre acteur.38400 ajoute une projection de revue bornée, sans SELECT général des sessions/réponses, et exige la consultation auditée du contexte exact lors de la décision. Sur8941517, le navigateur a exécuté le choix explicite du dépôt original, affiché ses2 vraies réponses et le score figé, saisi un score humain distinct et approuvé A ; B reste en demande de complément, l'auto-approbation est refusée42501. Les libellés des options fournies sont FR/AR ; aucun texte libre n'est traduit.

La file Admin avait aussi un faux vide dû à sa jointure sur organizations sous RLS.38410 conserve la file invoker et résout seulement les noms des profils visibles via la projection Admin bornée existante.0358=19 assertions et contre0357=40 réussissent sur les47 migrations intégrées. Le contrôle visuel de cette dernière migration est encore à consigner avant clôture. Preuves : [revue des questionnaires](../recette/provider-qualification-review-2026-11-02.md), [file Admin](../recette/admin-provider-queue-2026-11-02.md), [rapport consolidé](REPORT.md).
