# Messagerie — preuve transactionnelle locale

Le reçu `0352-after-receipt.json` décrit **68 assertions réussies**, les sept migrations supplémentaires, leurs empreintes et l'empreinte de schéma identique avant/après. Aucun COMMIT envoyé ; transaction entière annulée sur la cible locale explicitement détenue. Ce n'est pas un rejeu neuf ni une recette navigateur/GoTrue ou un certificat de production.

La sélection du devis et la RFQ fermée sont un setup historique cohérent de test (`CLOSED` avec `closed_at`) ; ce test ne prétend pas exécuter cette sélection. La signature utilise seulement le mock de développement gouverné de0338. Première ouverture après contrat, envoi et affectation/révocation sont les véritables commandes sous `SET ROLE authenticated`.

Avant42040, le même scénario refusant une lecture par `CLIENT_VIEWER` dans l'organisation Provider échoue réellement : lecture permise et une conversation découverte. Les deux assertions restent inchangées après correction ; elles passent avec les66 autres. Les reçus et journaux avant/après sont conservés, avec zéro cas sauté.

Le commentaire du test source a ensuite été précisé pour distinguer setup historique et commandes effectivement exécutées ; cette clarification a une empreinte distincte de celle du reçu. Elle ne modifie ni instruction SQL ni assertion. Les journaux ne contiennent que des acteurs et données synthétiques explicitement locaux.
