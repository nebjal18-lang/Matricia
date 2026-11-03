# Gates et observations de recette

État arrêté le 1er novembre 2026. Ce document distingue les outils disponibles, les observations réellement obtenues et les preuves encore absentes. Les résultats d'une source antérieure ne valident pas le candidat courant. Aucun environnement hébergé ni procès-verbal client n'est approuvé ici.

## Commandes et portée

| Commande | Ce qu'elle vérifie | Limite |
| --- | --- | --- |
| `pnpm verify:phase00` | Catalogue, spécification, traçabilité et exports des modules Next `use server` | Analyse structurelle, sans parcours utilisateur |
| `pnpm verify` | Lint, types, unitaires, intégration, outils, phase00 et build | N'exécute pas DB, navigateur, performance, restauration ou fournisseurs |
| `pnpm test:db` | SQL et concurrence via le harnais local/staging autorisé | Pas de certification de la base hébergée ; privilèges pgTAP temporaires dans les transactions des tests |
| `pnpm test:tooling` | Gates, mesure de performance, preuve de recette et isolation du harnais SQL | Ne remplace pas l'exécution des gates |
| `pnpm test:e2e:public` | Navigation publique avec vrai navigateur | Pas de mutations authentifiées |
| `pnpm test:e2e:authenticated` | Routes et contrôles authentifiés avec états sécurisés | Les états et fixtures nécessaires doivent exister |
| `pnpm test:e2e:workflows` | Parcours disposant de fixtures sécurisées | Exige des mutations et un nettoyage réels |
| `pnpm test:e2e:local-delivery` | Runner local hermétique, phases séquentielles et preuves explicites | Développement Docker uniquement ; aucun agrément staging/client |
| `pnpm test:a11y` | Contrôles automatisés présents dans la suite authentifiée | Ne certifie pas à lui seul WCAG AA, clavier complet ou lecteur d'écran |
| `pnpm test:performance -- <plan>` | LCP ≤ 2 500 ms, CLS ≤ 0,1 et INP mesuré après interaction ≤ 200 ms | Mesure synthétique, pas RUM ; l'absence de métrique/interactions échoue |
| `pnpm test:performance:api -- <plan>` | GET métier en lecture, 20–100 mesures, p95 < 500 ms, réponse limitée | Ne mesure pas les commandes ni les intégrations externes |
| `pnpm test:performance:catalog -- <plan>` | Lecture paginée complète de catalogues 6 000 et 50 000 sur staging vérifié | Le budget configuré doit être figé et approuvé ; aucun résultat de performance n'a été produit ici |
| `node scripts/audit-interactions.mjs --check --runtime-proof <preuve>` | Inventaire et preuve d'interactions liée aux sources | Un inventaire statique ne constitue pas une recette |
| `pnpm release:checks -- <checks>` | Exécute lint/types/unit/integration/database/build demandés, compte les assertions, écrit des résumés liés au SHA | Ces six contrôles ne couvrent pas les seize gates de livraison |
| `pnpm release:prepare` | Crée un manifeste vierge, sans succès ni signature préremplis | Ne délivre aucune autorisation |
| `pnpm release:structure` | Structure du dossier de livraison | Explicitement sans autorisation de livraison |
| `pnpm release:validate` | Manifeste complet, SHA courant, sources propres, preuves hachées et approbations | Doit échouer tant que les conditions externes ou signatures manquent |

Le workflow CI courant exécute qualité/build, une base locale éphémère distincte et le navigateur public. Le workflow manuel protégé `staging-acceptance.yml` exige les liaisons d'un projet staging vérifié puis exécute les recettes authentifiées ; il ne lance pas automatiquement toutes les performances, la restauration et les validations fournisseurs.

Le manifeste strict exige seize contrôles : lint, typecheck, unit, integration, database, build, e2ePublic, e2eAuthenticated, e2eWorkflows, accessibility, performance, performanceApi, performanceCatalog, security, externalIntegrations et backupRestore. Les six derniers contrôles spécifiques performance/sécurité/intégrations/restauration doivent prouver le staging. Il exige également les 76 exigences du registre au même SHA, sans réserve bloquante, et cinq approbations : qualité indépendante, sécurité indépendante, juridique/comptabilité, réception client et remise exploitation. Aucune de ces approbations n'est réputée acquise par une recette locale.

## Composition de la recette locale

| Phase | Cas attendus | Segment |
| --- | ---: | --- |
| ui-auth | 4 | OTP e-mail réel à six chiffres, consentement, MFA admin et retour profond FR/AR |
| route-smoke | 16 | Routes quatre rôles et refus de portée |
| p05-onboarding | 28 | Écrans et actions P05 disponibles |
| v1-critical | 24 | Parcours critiques V1 |
| client-journey | 6 | Mêmes identités inscrites en UI → profil → trois pièces privées → revue humaine synthétique à deux personnes → essai → évaluation publiée → diagnostic → opportunité → demande |
| p23-quotes | 4 | Prestataire qualifié, identité revue, devis et ancre juridique immuable |
| final-core | 4 | Noyau commercial historique ciblé, périmètre déclaré |
| p24-p26 | 64 | Recette de routes étendue |
| Commercial lié (`linked-commercial`) | 8 | 8/8 PASS local à 05:22:54 UTC ; mêmes demandes issues de l'inscription réelle et du diagnostic jusqu'aux livraisons acceptées, signature mock DEV explicite |
| Avantages (`benefit-fulfillment`) | 6 | Préparé, NON EXÉCUTÉ : Auth réel FR/AR4 puis deux cadeaux gouvernés, réservations, exécutions et réceptions UI indépendantes, consommation unique et preuve comptable |
| Total technique préparé | 164 | Somme des phases ; aucun succès global des 164 cas revendiqué |

Le runner interdit les skips, retries/flaky et comptes incomplets. Il vérifie une empreinte des sources avant/après, les preuves de mutations et le nettoyage. La chaîne requête → RFQ → devis → contrat → signature → mission → livraison → acceptation doit conserver les mêmes identifiants métier pour être déclarée de bout en bout. Les nouvelles remises DSR et les approbations éditoriales centrales ne sont pas automatiquement couvertes par ces 164 cas préparés.

## Observations disponibles

| Preuve | Observation réellement obtenue | Statut pour le candidat courant |
| --- | --- | --- |
| `artifacts/test-results/local-acceptance/ui-auth.json` | 4/4 PASS, zéro skip/flaky, vrai Mailpit OTP6, deux consentements, deux sessions admin MFA ; nettoyage réussi | Observation antérieure, à rejouer après gel |
| Ancien smoke16 | 10 PASS / 6 FAIL ; corrections des assertions de redirection/navigation ajoutées ensuite | Remplacé par le rejeu ci-dessous |
| `artifacts/test-results/local-acceptance/route-smoke.json`, 01:34:13 UTC | **16/16 PASS**, zéro échec/skip/flaky, fixtures neutralisées et états Auth supprimés | Même arbre application/recettes que Client6 PASS ; routes quatre rôles et refus de portée locaux |
| Ancien prototype Client | 0/2 PASS, POST diagnostic 500 FR/AR ; nettoyage réussi | Diagnostic seulement ; source modifiée pendant ce run |
| Client6 lié, observation du 1er novembre à 01:11 UTC | 4 PASS / 2 FAIL, zéro skip/flaky, nettoyage vérifié. Six PDF privés, deux revues canoniques et deux activations VERIFIED/TRIAL réelles ; AAL1 et auto-approbation refusés | Diagnostics score50 IMPORTANT réellement persistés. Le détail fermé masquait son propre contrôle ; correction UX préparée ensuite. Conversion non validée par ce run |
| `artifacts/test-results/local-acceptance/client-journey.json`, 01:30:43 UTC | **6/6 PASS**, zéro échec/skip/flaky, nettoyage vérifié. Même inscription UI FR/AR → conformité/essai → évaluation publiée5000 → diagnostic50.00 IMPORTANT → opportunité acceptée → deux demandes UI de125050centimes ; deux conversions SDK supplémentaires, rejeu/CAS et isolation vérifiés | Segment local Client validé sur l'empreinte source ci-dessous ; ne prouve pas encore RFQ→contrat→livraison ni staging |
| Commercial lié, sixième essai à 03:57:45 UTC | Client6 **6/6 PASS**, puis échec SDK `create_mission` `22023` ; nettoyage vérifié, deux PDF sources synthétiques conservés privés | Échec historique du chargement de checklist ; correctif268040 éprouvé par la création de mission au septième essai. Aucun succès lié8/8 revendiqué ; rapport historique exact et SHA dans `LINKED_COMMERCIAL_RECIPE.md` |
| Commercial lié, septième essai à 05:10:32 UTC | Client6 **6/6 PASS**, mission FR et livraison/jalon acceptés par vraies commandes ; échec de l'assertion du nom d'audit après réception, nettoyage vérifié | La recette attendait `delivery.accepted` au lieu de `delivery.decided` ; correctif479c8d7 à rejouer. AR, UI finales et sondes Storage finales non validées ; rapport historique exact et SHA dans `LINKED_COMMERCIAL_RECIPE.md` |
| Commercial lié, huitième essai à 05:22:54 UTC | **8/8 PASS**, zéro échec/skip/flaky, deux chaînes FR/AR avec identifiants liés et lectures UI Client/Provider, PDF canoniques et sondes Storage natives ; nettoyage vérifié | Segment local validé sur l'arbre `4dabb112…`, avec catalogue/qualification Provider historiques explicites et signatures de simulation DEV. Staging et signature contractuelle non validés ; archive et empreintes exactes dans `LINKED_COMMERCIAL_RECIPE.md` |
| Helpers release | 33/33 PASS observés avant les derniers ajouts ; test AST Next 1/1 PASS séparément | Pas une exécution globale récente de `test:tooling` |
| Transport HTTP outbox | 3/3 PASS, accusé de consommation obligatoire | Observation ciblée, pas validation de fournisseurs |
| Audit indépendant production | 317 dépendances, zéro vulnérabilité de toute sévérité ; Next 16.4.1, React 19.2.6, Zod 4.6.6 installés | Valable pour les dépendances observées, pas une certification de sécurité applicative |
| Restauration locale précédente | Dump DB restauré avec propriétaires/ACL ; extension hôte cron exclue. Objet Storage testé séparément | Restauration complète coordonnée NON VALIDÉE |
| Performance navigateur/API/catalogue | Aucun benchmark exécuté par ce lot | NON EXÉCUTÉ |
| Staging, fournisseurs réels, remise, PV | Conditions et preuves externes manquantes | REQUIREMENTS_MISSING ; PV non signé |

Empreintes des preuves observées, sans informations d'authentification :

| Preuve | SHA-256 |
| --- | --- |
| ui-auth | `4ac1939212d6da2bc6377ef14ab5e37a7965ca0cd19777ddf8162951467166e3` |
| ancien smoke16 (empreinte historique) | `95bef616464d920d3365d7b475c5cf59a0519eeb4fbb47dc7be7dcc7b4c16031` |
| Smoke16 PASS à 01:34:13 UTC | `3df20b1e02a5a5d189a3cba7933b82989b7585f519a25dd7f78d35b7d054ace7` |
| ancien client-journey (empreinte historique) | `5a6928524706bd48b2d254ff13addd17558b6b33ffb4c90ea58286eeb6b1b1fa` |
| Client6 à 01:11 UTC (empreinte historique) | `829dd91feb00ab434631b8465e015cb5a38563cf3ecdc145707b534c0ffdf424` |
| Client6 PASS à 01:30:43 UTC | `eefe67fa55749d6215682018bb456fdb08660df578e99edd1ffa840f17f3a7d2` |
| Arbre application/recettes du Client6 PASS (2 066 fichiers) | `62e0a21ea746d4ff119bd32598dd1e7611f2bc7526d6a1bb77c3eda44276e189` |
| audit production indépendant | `3c42a53c4c38238d1669f744f0cd48c9cebea2dfd942eab1f95843e93fbdfa6a` |

Les résultats SQL/build annoncés par les autres propriétaires restent consignés dans leurs preuves et le rapport global. Ils ne sont pas recomptés ici comme exécutions indépendantes.
