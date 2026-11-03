# Finance Sous-traitant — code et contre-recette locale

Source : `7e01276`, branche `codex/provider-finance-20261102`. Aucun déploiement ni modification de base distante. Les encaissements Client vers Prestataire sont séparés des règlements de commissions à Matricia.

## Comportements livrés

- Un fichier réellement envoyé et analysé accompagne chaque déclaration. Une déclaration ne crée ni cash ni extinction de dette. L'encaissement exige une confirmation ou contestation du Client ; un membre de la société Prestataire ne peut pas confirmer pour le Client. Finance AAL2 indépendante décide ensuite. Seule Finance indépendante effectue les allocations.
- Un pré-relevé contradictoire précède la clôture automatique. Les lignes contestées et les conséquences inversées sont exclues de l'émission. Politique de clôture approuvée par deux acteurs, fiscalité validée, identité juridique et séries d'émission approuvées sont requises. Les trois anciens constructeurs de relevés/factures ordinaires sont interdits aux rôles runtime ; l'aperçu readonly reste disponible.
- Un échéancier exige une décision Finance AAL2 indépendante. Seules les échéances respectées couvrent l'exigible ; un paiement partiel ne décale pas l'échéance originale. La collection ne peut pas déclarer en défaut un plan respecté. Un même paiement peut compléter la même facture par plusieurs allocations immuables, sans surallocation ni duplication dans un lot.
- Les décisions et leur audit sont immuables : reprise identique sans nouvel audit, choix opposé rejeté explicitement. Les avoirs conservent la fiscalité canonique de la facture ; le paramètre historique de TVA envoyé par un navigateur ne la remplace jamais.
- Les conséquences finales d'un litige utilisent sa version contractuelle figée, même si la mission a changé de version. Un montant fixe est présenté comme tel, sans afficher un calcul base×taux fictif. Une pénalité due au Client reste une exception gouvernée, sans devenir revenu Matricia ni créer un mandat de collecte inventé. Une inversion après émission exige un avoir distinct et conserve les originaux.
- Les tentatives de clôture et d'ingestion sont mémorisées séparément des ledgers. Une exception ancienne ne bloque pas les autres fournisseurs ou conséquences lorsque le worker traite des lots limités.
- Les références et devises des factures liées sont chargées indépendamment de leur page visible. Une indisponibilité Auth/transport reste un incident avec reprise, sans fausse déconnexion ni résultat vide. Les formulaires et explications sont disponibles en FR/AR. Le Client confirme dans son propre contexte d'organisation et son propre cadre de navigation.

## Preuves du checkpoint40000–40930

Chaque fichier SQL est exécuté séparément dans une unique transaction annulée sur la cible locale explicitement possédée, schéma de base458 et correctif37000. Migrations40000–40930 appliquées seulement à l'intérieur de cette transaction. Aucun COMMIT envoyé ; empreintes du schéma avant/après identiques. Cette preuve ne vaut pas rejeu intégral sur une base neuve.

| Fichier | Résultat | Preuve |
|---|---|---|
|0347_provider_independent_finance|45/45 PASS|[Reçu](evidence/finance/independent-final-45.json)|
|0347_provider_monthly_closing|56/56 PASS|[Reçu](evidence/finance/monthly-final-56.json)|
|0168_provider_credit_notes_collection|16/16 PASS|[Reçu](evidence/finance/legacy0168-final-16.json)|
|0210_provider_durable_payment_intents|13/13 PASS|[Reçu](evidence/finance/legacy0210-final-13.json)|

Commande réellement utilisée, un seul fichier par invocation : `APP_ENV=development node /workspace/provider-identity/work/identity-proof/run-rollback.mjs --browser-root=/workspace/client-browser-verification --migration=<chaque fichier40000…40930> --test=<fichier SQL> --output=<work/run>`. Le runner vérifie la propriété de la cible, refuse les contournements de triggers et n'envoie aucun COMMIT.

Web : `pnpm --filter @matricia/web exec vitest run <9 fichiers Finance/Provider/Admin/PDF> --maxWorkers=2` : **42 tests PASS**. Worker : `pnpm --filter @matricia/worker exec vitest run src/provider-billing.test.ts --maxWorkers=1` : **2 tests PASS**. `pnpm --filter @matricia/web typecheck` : **PASS**. ESLint ciblé des12 fichiers TypeScript modifiés : **PASS sans avertissement**. Les traces unitaires/types/lint sont conservées avec les reçus. Le build et le navigateur intégrés sont conduits par root, sans annoncer ici un résultat non reçu.

## Traçabilité de la contre-revue indépendante

| Constat | Correction | Preuve ciblée |
|---|---|---|
|Échéancier auto-approuvé/AAL1 et rejeu refusé|40500, rôles composites refusés, reprise avant contrôles d'état|0347 indépendant|
|Allocation partielle impossible à compléter|40600, unicité par lot/facture, garde des cumuls|0347 indépendant, deux allocations et reprises|
|Émission directe hors contradictoire|40700 et40920, trois ABI de fabrication révoquées|0347 mensuel, appels natifs Finance refusés|
|Avoir auto-émis et collection d'un plan respecté|40500, Finance AAL2 indépendante et exigible réel|0347 indépendant/mensuel|
|Décisions opposées produisant faux succès/audit|40800, conflit explicite et reprise sans audit supplémentaire|0347 indépendant/mensuel|
|Version courante de mission au lieu du contrat du litige|40900, source figée sur dispute_cases|0347 mensuel, litigeV1/missionV2|
|Pénalité Client transformée en revenu Matricia|40900, exception et bénéficiaire préservé|0347 mensuel, Client penalty/commission séparées|
|Starvation sous panne|40900 et40930, ordre de dernière tentative persisté|0347 indépendant/mensuel, appels bornés à1|
|Devise et numéro de facture hors première page|Références chargées par lots, aucun défaut MAD|repository.test.tsx,51 factures et TND FR/AR|
|Auth503 traité comme déconnexion|Classification d'incident dans reads/actions|repository/actions tests, aucune mutation|
|Montant fixe affiché comme calcul au taux|Snapshot de calcul et libellé de montant fixe|workspace-panel.test.tsx FR/AR|

Les deux signaux retirés par la revue restent documentés : le mode de paiement est réinjecté depuis l'intention persistée ; `p_tax_minor` est volontairement consultatif et ignoré par le moteur fiscal canonique. Aucun contrôle fiscal n'a été abaissé pour satisfaire ces signalements.

## F12 : règle économique issue du contrat signé

La contre-revue F01–F11 est favorable sur `7bc38fc` et les130 assertions ci-dessus : les hashes des migrations/tests ont été recalculés indépendamment. Un constat autonome F12 a ensuite été reproduit : une décision acceptait des montants et un booléen fournis par son opérateur sans clause économique correspondante. Le [reçu de reproduction58](evidence/finance/f12-reproduced-before40940-58.json) documente ce défaut antérieur ; ses deux dernières assertions prouvent un comportement vulnérable, jamais un critère de réussite futur. La [source exacte de reproduction](evidence/finance/f12-reproduction-source.sql) est conservée pour sa provenance, hors de la suite de tests.

`eb3a9bf` ajoute40940 : résolveur du modèle approuvé et signé, garde de décision indépendante AAL2, projection de lecture, rejet des conséquences historiques non autorisées et revalidation des pré-relevés avant facturation. Le [contrat de données](DISPUTE_ECONOMICS.md) décrit les champs, prérequis et limites sans définir de règle commerciale ou juridique réelle.

| Recette40000–40940 | Résultat | Preuve |
|---|---|---|
|0356_provider_dispute_economic_authority|76/76 PASS|[Reçu](evidence/finance/f12-signed-authority-final-76.json)|
|0347_provider_monthly_closing|56/56 PASS|[Reçu](evidence/finance/monthly-with40940-final-56.json)|
|0047_p10_provider_billing_reconciliation|33/33 PASS|[Reçu](evidence/finance/legacy0047-with40940-33.json)|

Le modèle positif est explicitement TEST, proposé et approuvé par des acteurs distincts puis signé via le flux DEV-mock réel. Une décision native prend ses700+700 de ce modèle, malgré une devise et des montants falsifiés par le caller ; elle accepte aussi un objet de règle vide. Sans clause économique de l'obligation exacte, elle crée une exception et aucune conséquence financière. Le bridge et la clôture refusent aussi une conséquence historique et une ancienne ligne de pré-relevé, sans réécrire le montant immuable. La pénalité Client reste séparée et nécessite son mandat propre. Les lectures étrangères sont refusées. Ces reçus sont chacun annulés et leurs empreintes restaurées ; aucune preuve juridique de production n'est revendiquée.

La suite historique0047 a été alignée sur les ACL plus strictes, l'unicité par lot et le déplacement des écritures dans la revue indépendante ; aucune garde n'a été abaissée. L'interface d'exception FR/AR a été rejouée :6 tests PASS et ESLint sans avertissement. Les45/16/13 assertions du checkpoint précédent sont conservées avec leurs hashes40000–40930 ; elles ne sont pas présentées comme un nouveau rejeu40940. La contre-revue indépendante F12 est favorable sur `e558d6e` ; la recette de l'UI Admin intégrée reste à valider par root.

## Contre-test de transition sur appel

La contre-revue40940 a identifié une condition héritée qui n'appliquait les effets de non-conformité qu'à une première décision. Le scénario natif première décision `COMPLIANT`, appel recevable du Client puis `NON_COMPLIANT_CONFIRMED` finissait ainsi sans conséquence, retrait ni R1. Le [reçu avant40950](evidence/finance/f12-appeal-reproduced-before40950-failed85.json) conserve les **quatre échecs de reproduction** ; il ne représente pas une recette réussie. La source test est identique à celle du contre-test final.

`e558d6e` ajoute40950 : les effets canoniques s'appliquent lors de la transition vers la non-conformité depuis une issue différente. Les décisions antérieures sont conservées, l'indépendance/AAL2 et l'autorité économique signée demeurent requises. Le rejeu ne crée ni seconde conséquence ni seconde R1 ni second audit de la même décision.

| Recette40000–40950 | Résultat | Preuve |
|---|---|---|
|0356_provider_dispute_economic_authority, dont le parcours mensuel et l'appel natif|85/85 PASS|[Reçu final](evidence/finance/f12-signed-authority-final40950-85.json)|

Cette transaction finale a été entièrement annulée et l'empreinte du schéma restaurée. La contre-revue indépendante est favorable sur `e558d6e` : sources40940/40950 et parcours0356 relus,16 SHA du reçu final recalculés et concordants, aucun reliquat concret trouvé. Le relecteur n'a exécuté lui-même aucun SQL : les85 assertions restent les preuves de l'auteur. Les reçus76/56/33 précédents sont des checkpoints40940 explicites. L'UI de décision et la recette navigateur intégrées ne sont pas certifiées par ce verdict backend.

## Conditions externes encore nécessaires

Scanner de production, éditeur légal/numérotation et paramètres fiscaux approuvés, transport email et exécution hébergée des workers ne sont pas certifiés par ces tests locaux. Les données, documents et signatures synthétiques des fixtures sont explicitement de test. Les pénalités dont le bénéficiaire est le Client attendent un mandat de collecte approuvé ; elles restent visibles en exception et ne sont pas facturées comme revenu Matricia. Aucune recette locale ne remplace ces décisions réelles ni la contre-revue finale du code intégré.
