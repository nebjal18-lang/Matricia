# MAT-FINAL — lot 04, sauvegarde du besoin sans troncature silencieuse

| ID | État observé | Correction | Preuve et limite |
| --- | --- | --- | --- |
| D08 | Le récapitulatif montrait toutes les réponses, mais la composition des contraintes coupait le texte à 1 200 caractères. | Le texte complet reste dans le brouillon. Une alerte FR/AR bloque la confirmation, la connexion et la sauvegarde automatique ou manuelle si la limite est dépassée ; la personne peut modifier ses réponses. | Test de composant FR/AR : réponse longue visible, alerte et confirmation désactivée. La persistance distante après connexion reste non exécutée. |
| D14 | L'action serveur ajoutait une classification après validation, puis coupait de nouveau les contraintes à 1 200 caractères. | L'action refuse le dépassement avant tout RPC et ne perd aucune partie du texte à l'insu du client. Le contrôle côté UI inclut aussi cette classification. | Test de l'action serveur : dépassement causé par la classification, résultat VALIDATION et aucun RPC. Aucune migration de base. |
| D18 | Le chemin de sauvegarde long n'était pas couvert. | Tests ciblés de composant et d'action ajoutés. | Sélection Vitest : 102 fichiers, 838 tests PASS ; TypeScript et lint PASS. Exécution locale Node 24.11.0, différente de la cible Node 22. Aucun E2E authentifié ou base distante dans ce lot. |

Ces trois points restent **EN COURS** au sens complet du ticket #27. La limite de 1 200 caractères du contrat actuel demeure et le brouillon doit être raccourci avant sauvegarde. Le lot ne valide ni la CI du nouveau commit, ni le flux de production, ni les 376 points.
