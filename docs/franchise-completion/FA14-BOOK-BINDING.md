# FA14 — Livre financier et mandat approuvé

## Cause et correction

L’ancienne ouverture acceptait type, opérateur et règle financière du demandeur et imposait un seul livre par organisation/bibliothèque. Le routage économique ne prouvait pas que le livre et le mandat portaient les mêmes conditions, une invitation effectivement acceptée et une chronologie cohérente approbation/activation. Deux territoires pouvaient donc partager un mauvais livre ; un libellé IT pouvait masquer des conditions STANDARD.

Ces migrations non appliquées sont ordonnées après les correctifs monétaires existants et avant le contrôle continu ; aucune migration appliquée n’a été modifiée. Les migrations `20261103452800`, `20261103452810`, `20261103452820`, `20261103452830` et `20261103452840` ajoutent un registre immuable et vérifié à l’insertion, l’ouverture explicite par mandat approuvé, les gardes de routage/clôture/distribution/frais, un sélecteur borné et la preuve du mode d’exécution des frais. La contrainte historique organisation/bibliothèque est remplacée par la clé exacte mandat/règle/devise. La recherche ciblée des migrations n’a trouvé aucun `ON CONFLICT (library_id, franchise_organization_id)` de commande financière dépendant de l’ancienne contrainte.

L’API historique n’accepte qu’un candidat approuvé non ambigu. Un livre ancien incompatible ou ambigu reste inchangé et exige un rapprochement explicite. L’API ne redistribue ni ne réécrit les écritures, soldes ou clôtures. Le verrou d’échéancier porte sur la franchise, pour éviter une double dette concurrente à travers deux livres ou règles. Les protections AAL2, habilitations, RLS, audit, outbox, idempotence et rapprochement des revenus/coûts subsistent.

L’activation clone le mandat. Le registre conserve la version approuvée et suit uniquement son clone démontré par la preuve d’activation et les mêmes conditions, une invitation effectivement acceptée et une chronologie cohérente approbation/activation. L’expiration ou la résiliation actuelle ne supprime pas l’éligibilité d’une période historique réellement couverte ; elle bloque les nouvelles allocations. Les contrôles de financement adverse restent requis pour un nouveau paiement.

## Parcours de régularisation

Page FR/AR : `/administration/gouvernance-franchise/livres?franchiseId=…`.

Le responsable financier ou super administrateur vérifie son second facteur puis choisit bibliothèque, organisation, territoire, version de mandat et règle compatibles. Les références et empreintes sont transmises par champs cachés, contrôlées de nouveau par PostgreSQL ; aucune saisie technique n’est demandée. Un reçu ne vaut succès que s’il correspond exactement au mandat demandé. Les états session expirée, MFA, refus de rôle, changement de contexte, rapprochement nécessaire et incident sont distincts.

Les devises proposées proviennent du contrat et, pour la récupération, des livres réellement existants cohérents. Le montant, le mode et la durée d’échéancier suivent les termes approuvés ; comptant signifie une échéance à la date de départ. Le droit d’entrée demeure dans sa devise contractuelle ; aucune conversion FX n’est inventée. Une dette d’entrée en production exige la preuve juridique exacte, même si l’ouverture structurelle a précédé l’activation. Sans cette preuve, la transaction échoue. Les échéanciers de développement/staging sans signature sont explicitement `NON_CONTRACTUAL_DEMO`, avec environnement enregistré par le serveur. Les anciens échéanciers sans preuve restent à état inconnu : aucune certification rétroactive.

Le tableau de bord expose `bookBindingReviewRequired` et, par livre, `franchiseId` et `bindingReviewRequired`. Une réponse antérieure dépourvue du champ donne `null`, jamais un faux « contrôle réussi ». Les échéanciers exposent aussi `executionMode` et `executionEnvironment`, inconnus pour les anciennes données.

## Vérifications et limites

- Tests ciblés repository + action + rendu FR/AR : **39 PASS**, y compris les projections de preuve juridique après extension.
- ESLint ciblé des nouveaux fichiers du parcours et du repository : PASS. TypeScript strict ciblé sur les nouveaux fichiers et leurs dépendances : PASS (`tsc --noEmit --project /tmp/franchise-book-types.json`).
- Le typecheck global sur la base de travail initiale s’arrête sur la syntaxe préexistante de `app/[locale]/franchise/recherche/page.test.tsx` (lignes 10 et 30). Il ne constitue donc pas un typecheck global réussi.
- SQL `0372_franchise_book_mandate_basis.test.sql` fourni pour la cohorte locale fraîche du responsable : **pas encore exécuté à l’écriture de cette note**. Il couvre les divergences de type/opérateur/règle/parts, l’ambiguïté, AAL2, les écritures directes refusées, le registre immuable, les frais pré-activation et le refus production sans signature, le clone réel et l’isolation du sélecteur/projection.
- La fixture historique de 0372 initialise uniquement des métadonnées TEST explicitement non contractuelles, sans argent ni faux parcours navigateur passé. Elle démontre la conservation d’éligibilité historique, pas un bénéfice distribué.
- `0369` confirme les frontières d’import historique sans désactiver les gardes ; le responsable a constaté **10 PASS** après correction du rôle de fixture. Aucun profit historique positif fictif n’est revendiqué.
- Relecture indépendante source par le propriétaire Opérations : aucun contournement MFA/tenant ni perte de droits historiques détecté sur le périmètre ciblé ; sa réserve sur la date de fin d’une règle financière a été corrigée dans la source et le sélecteur, avec assertion SQL dédiée. Cette relecture n’est ni une exécution SQL ni un audit exhaustif de concurrence.
- Aucun déploiement, appel de fournisseur réel, message à une personne ou modification de production effectué par ce lot.
