# FA14 — Compatibilité des recettes financières

Les correctifs de livre/mandat ne doivent pas être neutralisés pour conserver une ancienne fixture verte.

## 0364 : chaîne courante entièrement native

Le dossier courant crée réellement une proposition STANDARD, sa décision indépendante, l’acceptation explicite de simulation en développement et le clone actif avec preuve. Le livre STANDARD/EUR s’ouvre maintenant par `open_franchise_pnl_book_for_mandate_v1`, épinglé sur l’identifiant et l’empreinte de la version approuvée ; le test vérifie également l’invitation ACCEPTED et le clone exact. Le droit d’entrée contractuel en MAD n’est pas converti ni enregistré comme dette en EUR dans ce scénario.

Le flux paiement/capture, livraison indépendante, consommation, attribution canonique, preuves de coûts, double contrôle, rapprochement et incident adverse reste conservé. La journée courante n’étant pas terminée, le refus de clôture civile est attendu et testé.

L’ancien bloc historique ouvrait deux livres sans mandat puis insérait des revenus et clôtures initiaux pour provoquer des refus. Il n’est pas une preuve de bénéfice natif historique. À la demande du responsable, ce bloc est remplacé par une vraie assertion de frontière : le mandat effectivement accepté aujourd’hui ne peut clôturer octobre. Aucun revenu, clôture, allocation, solde ou paiement historique n’est injecté pour faire passer le test.

## 0362 et 0372 : métadonnées historiques initiales explicites

Une recette historique peut initialiser un master TEST non monétaire cohérent : acteurs déjà existants, franchise, territoire, version approuvée, décision indépendante antérieure à l’activation, invitation acceptée dans sa fenêtre, clone et preuve exacte. Cette donnée initiale n’est pas un parcours navigateur passé et ne prouve aucune signature juridique réelle. Le rattachement du livre utilise ensuite l’API publique ; aucune écriture directe du registre de liaison n’est permise.

0362 est la propriété Opérations ; son pin de chronologie initiale a été livré au responsable. 0372 conserve les scénarios de source, de frais, de contexte et de droits historiques ; son master historique ne contient aucun gain ni paiement fabriqué.

## Statut des preuves

Cette adaptation de 0364 est une modification de fixture, pas un nouveau résultat d’exécution. Le responsable exécute les recettes sur une cohorte SQL fraîche avec les migrations `20261103452800` à `20261103452840`. Le parcours historique positif capture→consommation→clôture→versement reste **non attesté**, tant qu’une histoire canonique réellement admissible ou un import historique gouverné n’existe pas. Ni une date de journal antérieure ni des tableaux de solde initiaux ne remplacent cette preuve.
