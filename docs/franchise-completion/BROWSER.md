# Recette navigateur Franchisé — journal et provenance

## Préparation sur la version fusionnée

Source exacte : `df67da46f48def7cf804855ab985a28dec4aab6e`, arbre `apps/web` `ef4b62c67a4d8ad5a6403e6a4568bd9dc1774c75`. Base locale isolée réutilisée après contrôle des labels, du réseau interne et de l’absence de ports Docker publiés. Une sauvegarde privée avant mutation a été créée ; sa restauration n’est pas déclarée testée.

Deux nouveaux acteurs de test ont été créés via GoTrue, authentifiés par OTP puis TOTP AAL2, avec organisations créées par `create_or_request_organization`. Ils utilisent exclusivement des adresses `@example.invalid`. Aucun JWT utilisateur, rôle de franchise ou preuve de signature n’a été fabriqué. Les auteurs et réviseurs de gouvernance sont des acteurs natifs distincts déjà présents dans la cohorte de test.

La proposition du premier mandat et son approbation indépendante ont utilisé les commandes publiques. L’auto-approbation a été refusée avec `42501`. L’organisation étant encore `PENDING`, une tentative contractuelle renvoie l’erreur ambiguë `FRANCHISE_ACTIVATION_MFA_REQUIRED` malgré AAL2 ; la signature n’a pas été atteinte, ni certifiée. Cette cause a été transmise au propriétaire du code.

Absence de mandat : les captures FR et AR à 390 px montrent l’explication exacte, l’action de candidature, `lang/dir` corrects et aucun débordement. Les tentatives de navigation à froid en serveur de développement ont aussi dépassé le délai initial de 30 secondes : les résumés restent partiels/en échec, sans transformer ces tentatives en recette réussie ni en mesure de performance de production.

Les binaires Playwright gérés n’étaient pas installés ; les essais suivants utilisent le Chromium système existant `/usr/bin/chromium`. Les clés machine locales anon/service arrivaient à expiration au bout de huit heures et ont été renouvelées dans la seule cohorte possédée. Les utilisateurs ont conservé leur identité et leur MFA.

Preuves : [préparation](evidence/browser/preparation.json), [résumé partiel initial](evidence/browser/baseline/summary.json), [activation non exécutée et garde reproduite](evidence/browser/activation/first-summary.json). Les captures ne contiennent ni code privé d’invitation ni session.

Vérification des gardes des outils : `node --test tests/e2e/helpers/franchise-final-safety.test.mjs` : **4 tests PASS**. Une invocation production, une invocation sans coordination et une source implicite sont refusées.

## Recette finale

La recette du candidat intégré sera ajoutée avec son commit, son arbre applicatif et les migrations exactes. Ce journal de préparation ne certifie ni les intégrations hébergées, ni une signature juridique, ni le parcours complet.

## Candidat intermédiaire optimisé `79a97ad`

Le build complet, avec TypeScript actif, passe sur `79a97ad97220c5e4b61a9b8a3d889b1043ea6dba` (arbre applicatif `8fcc61239df657e3e16110acc09625418e7ed888`). Les 507 migrations historiques ont conservé leurs empreintes ; les 26 nouvelles migrations appliquées par l’intégration donnent 533 migrations. L’outil de recette a adopté le reçu vérifié sans rejouer le DDL. Ce contrôle n’est pas un rejeu vierge ni une recette hébergée.

L’organisation de test a été activée par une demande administrative sensible, deux approbateurs indépendants du demandeur et l’exécution native de la décision. L’auto-approbation est refusée. Cette opération ne certifie pas les identifiants légaux et ne signe aucun contrat.

La première activation de mandat a ensuite réussi dans la vraie interface, en mode **NON_CONTRACTUAL_DEMO** explicitement confirmé. Une tentative contractuelle AAL2 a été refusée pour absence de mandat signé. Le retour au workspace présente cependant un refus réel : le rôle Owner et le mandat Franchisé actifs ne disposent pas encore de la délégation `catalog_library_mandates` pour leur organisation. `franchise_catalog_scope` vaut vrai, mais le reader catalogue exige aussi `CATALOG_VIEW_DRAFT` et renvoie `42501`. Aucune ligne de permission n’a été insérée manuellement pour masquer cette précondition. Le résumé d’activation reste donc partiel, et la matrice principale attend le raccordement gouverné du catalogue.

Les contrôles indépendants de cette précondition passent : **huit pages globales**, Notifications, Organisation, Sécurité et Sessions, en FR/AR à 390 px ; navigation de retour Franchisé, `lang/dir` corrects, aucun débordement et aucune erreur JavaScript. Ces huit contrôles concernent rôle, navigation et disposition, sans mutation des facteurs ou des sessions.

Preuves : [build et empreinte du journal](evidence/browser/core-build/build.json), [schéma adopté](evidence/browser/core-build/schema-adoption.json), [activation partielle](evidence/browser/activation-core/first-summary.json), [cause de refus catalogue reproduite](evidence/browser/catalog-scope-reproduction.json), [huit pages globales](evidence/browser/global-core/summary.json).

Les outils disposent désormais de **quatre tests de garde PASS**, dont un refus d’arrêter le PostgREST possédé sans coordination supplémentaire explicite. Aucun arrêt de service de recette n’a encore été exécuté à cette étape.


## Rétablissement catalogue `e57dcc5` et constats intermédiaires

Le frontend optimisé reste exactement celui de `79a97ad` ; le commit `e57dcc50f51c63c66c09ac68670e3e11f1d9d91d` ajoute la réparation de délégation catalogue, avec un reçu de schéma de 533 vers 534 migrations et un arbre applicatif inchangé. La commande gouvernée `reconcile_franchise_catalog_mandate_v1` a accordé le premier périmètre à partir du mandat activé. Son rejeu ne crée aucune délégation ni événement supplémentaire. Le reader natif du propriétaire retrouve ensuite les deux services réels. Le second mandat a été approuvé indépendamment puis activé dans la vraie interface après cette réparation. La recette reste explicitement en mode de démonstration non contractuelle.

Le contrôle initial du retour après la seconde activation attendait insuffisamment la navigation : sa capture et son résumé sont conservés sous `second-*-as-recorded`. Une visite de lecture, sans rejouer l’activation, confirme ensuite la vraie page Gouvernance. L’assertion de navigation attend désormais le chemin cible.

La navigation intermédiaire compte 21 scénarios, dont 19 réussites et deux échecs conservés. Les huit menus FR/AR aux quatre largeurs passent les tests de superposition, de tabulation et de clic tactile. La navigation FR→AR→FR du détail reste dans le même document et conserve organisation, mandat et détail. Un autre locataire ne lit aucune franchise et reçoit `42501` au RPC ; les six pages sensibles testées affichent un refus. Les huit vérifications de navigation globale répètent les huit pages globales déjà recensées ; elles ne représentent pas huit comportements supplémentaires.

Deux options de mandat portent encore le même libellé `FRANCHISEE` : c’est un défaut produit reproduit. L’autre échec cherchait le champ global sur une largeur de 390 px où il est masqué. Une recette ciblée à sa largeur visible de 1440 px prouve ensuite le véritable envoi de recherche : deux résultats autorisés pour `TEST`, puis zéro résultat pour un terme absent, avec conservation du mandat et aucune erreur JavaScript. Cette reprise ne transforme pas l’essai initial en réussite. La découverte de la recherche sur mobile sera vérifiée sur le prochain candidat.

Deux autres défauts natifs bloquent l’édition, sans succès simulé : le payload bilingue des livrables est rejeté par le validateur SQL historique qui n’accepte que des chaînes ; aucune ligne de service n’a été créée. Plusieurs clés d’idempotence dérivées écrasent aussi la version UUID avec un caractère refusé par le validateur. Le même brouillon de test sera repris après correction du contrat et du générateur, sans supprimer les livrables bilingues ni contourner le schéma.

La connexion OTP réelle prouve un défaut de proxy : GoTrue vérifie le code avec HTTP 200, puis le POST Server Action vers la page Connexion est intercepté par une redirection HTTP 307 vers le lien profond, avant le contrôle MFA natif. Le navigateur reste sur la connexion en erreur. Le diagnostic transport retourne HTTP 200 aussi bien depuis Node que depuis Chromium ; aucune désactivation CSP ou TLS n’a été utilisée. La reprise OTP→TOTP→lien profond reste en échec sur ce candidat et attend le correctif GET/HEAD du proxy. Cette vérification utilise un code généré par le GoTrue local pour un acteur `@example.invalid` ; elle ne certifie pas l’acheminement d’e-mail.

Preuves : [raccordement catalogue et rejeu](evidence/browser/catalog-recovery/summary.json), [schéma 534](evidence/browser/schema-upgrades/e57dcc50f51c/schema-adoption.json), [seconde activation et retour relu](evidence/browser/activation-core/second-summary.json), [navigation intermédiaire](evidence/browser/navigation/summary.json), [recherche ciblée](evidence/browser/navigation-search-core-e57dcc5/summary.json), [contrats éditoriaux rejetés](evidence/browser/editorial/contract-mismatch.json), [OTP vérifié et POST intercepté](evidence/browser/otp-core/summary.json).

## Commandes réellement exécutées pour ce lot

Les commandes suivantes utilisent uniquement la cohorte locale possédée, avec ses secrets conservés sous `work/` et hors Git. Le candidat est toujours explicite ; aucune variable externe de production n’est chargée.

```sh
node --test tests/e2e/helpers/franchise-final-safety.test.mjs
APP_ENV=development node tests/e2e/helpers/franchise-final-runtime.mjs --coordinated --production --candidate=79a97ad97220c5e4b61a9b8a3d889b1043ea6dba
APP_ENV=development node tests/e2e/helpers/franchise-final-adopt-schema.mjs --coordinated --candidate=e57dcc50f51c63c66c09ac68670e3e11f1d9d91d --receipt=docs/franchise-completion/evidence/sql/catalog-bridge-schema-534.json
APP_ENV=development node tests/e2e/helpers/franchise-final-reconcile-catalog.mjs --coordinated --candidate=e57dcc50f51c63c66c09ac68670e3e11f1d9d91d
APP_ENV=development node tests/e2e/helpers/franchise-final-matrix.mjs --coordinated --smoke --candidate=e57dcc50f51c63c66c09ac68670e3e11f1d9d91d
APP_ENV=development node tests/e2e/helpers/franchise-final-matrix.mjs --coordinated --phase=core --candidate=e57dcc50f51c63c66c09ac68670e3e11f1d9d91d
APP_ENV=development node tests/e2e/helpers/franchise-final-navigation.mjs --coordinated --candidate=e57dcc50f51c63c66c09ac68670e3e11f1d9d91d
APP_ENV=development node tests/e2e/helpers/franchise-final-navigation.mjs --coordinated --only=search --candidate=e57dcc50f51c63c66c09ac68670e3e11f1d9d91d
APP_ENV=development node tests/e2e/helpers/franchise-final-otp-core.mjs --coordinated --candidate=e57dcc50f51c63c66c09ac68670e3e11f1d9d91d
```

Le résultat du build typé est PASS ; les quatre gardes d’outillage sont PASS. Les tentatives navigateur et commandes rejetées gardent leur résultat d’origine. La matrice complète et la recette ciblée du candidat suivant sont consignées séparément ; aucun contrôle hébergé, scanner antivirus réel, signature contractuelle, restauration ou clôture du mois courant n’est déclaré réussi par ces essais intermédiaires.


L’inspection visuelle des captures ajoute deux constats que le seul contrôle de débordement ne pouvait détecter : le contexte de l’en-tête recouvre les actions à 375 px en arabe ; le tableau Services compresse ses colonnes en lettres verticales à 390 px. Les actions du menu de compte restent elles-mêmes au-dessus du contenu. Ces défauts de lisibilité sont transmis pour le prochain candidat et ne sont pas présentés comme une recette visuelle réussie. Voir [constats et captures exactes](evidence/browser/visual-findings-core.json).


## Matrice complète du candidat intermédiaire

Les **192 visites prévues ont toutes été exécutées** : 24 routes × FR/AR × 375, 390, 768 et 1440 px. Résultat : **176 PASS, 16 FAIL**. Les échecs concernent les huit visites Bibliothèque (`definition-list`) et les huit visites Services (`definition-list` et `aria-prohibited-attr`). Aucun HTTP non 200, refus de workspace inattendu, débordement horizontal du document ou erreur JavaScript n’est relevé dans cette matrice. Les deux défauts visuels de lisibilité restent néanmoins présents et sont documentés séparément.

Axe n’a aucune règle exclue ; les résultats incomplets sont conservés, et une absence de violation automatisée ne constitue pas une certification intégrale d’accessibilité. Les 192 captures ne sont pas produites : les captures sont ciblées sur 390 px, l’accueil aux autres largeurs et les vrais échecs. Voir [totaux](evidence/browser/matrix-core-e57dcc5/totals.json) et [détails complets](evidence/browser/matrix-core-e57dcc5/summary.json).
