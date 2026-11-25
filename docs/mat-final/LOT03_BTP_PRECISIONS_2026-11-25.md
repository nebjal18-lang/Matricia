# MAT-FINAL — lot 03, précisions métier avant choix d'un service

Point de départ : le parcours public du lot 02 transmettait les huit réponses mais, tant qu'aucun service n'était confirmé, l'étape « Questions et précisions » masquait aussi localisation, délai et contraintes. Le scénario BTP ne demandait ni volume de devis à relancer ni chantier et période pour mesurer les coûts.

| ID | État observé | Changement et contrôle | Limite |
| --- | --- | --- | --- |
| D06 | Les questions de service étaient conditionnées à une classification, mais tous les champs de contexte l'étaient également. | Les champs généraux sont accessibles avant choix du service. Deux questions complémentaires apparaissent seulement si les réponses déclarées concernent le suivi commercial manuel et/ou le coût des chantiers BTP. | Le moteur adaptatif complet par secteur, taille et domaine reste ouvert. |
| D07 | Le besoin avait des aides générales ; pas d'indication de période ni de réponse inconnue pour les deux lacunes du scénario. | Les deux questions ont aide FR/AR, période attendue et possibilité explicite de répondre « je ne sais pas ». | Les aides des 200 prestations ne sont pas auditées dans ce lot. |
| D08 | Un ancien brouillon du lot 02 pouvait ne pas porter les nouveaux indicateurs de questions. | La reprise ajoute ces indicateurs sans effacer les réponses ou modifications déjà présentes. | Une preuve de reprise après connexion sur base distante manque. |
| D14 | Le besoin sans service ne permettait pas de saisir la plupart des précisions utiles. | Les réponses aux deux questions sont conservées dans le brouillon et le récapitulatif, avec libellés localisés. Aucun service ni marge n'est calculé automatiquement. | La création de demande authentifiée et l'association au site ne sont pas validées. |
| D18 | Les tests du lot 02 s'arrêtaient à l'arrivée dans le besoin. | La recette traverse maintenant l'étape de questions sans service, saisit et relit les deux réponses après actualisation, puis contrôle le récapitulatif. | La matrice de 100 scénarios et les 200 fiches service restent ouvertes. |

Preuves locales du lot 03 : `vitest` ciblé 56/56 PASS ; Playwright 6/6 nouveaux parcours et 4/4 régressions du besoin, FR/AR ordinateur/360 px, PASS ; TypeScript, lint et build synthétique PASS. URL Supabase factice, aucune soumission ou écriture de production. Node local 24.11.0, gate Node 22 non équivalent.

CI du commit précédent `11496bb0` : `quality` et `browser-public` PASS, `database` FAIL dans `0043_p07_rfq_matching_foundation.test.sql`, SQLSTATE 42501 à la ligne 111 (`session_replication_role=replica`). Aucun changement de privilège ou contournement des triggers n'est revendiqué. Le présent lot n'a pas encore de verdict CI distinct.

Tous les IDs ci-dessus restent **EN COURS** au sens complet du ticket #27. Aucun visa de release.
