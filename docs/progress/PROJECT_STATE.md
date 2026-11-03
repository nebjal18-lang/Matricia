## 2026-11-02 — Corrections de l’audit complet M01–M30

- Audit complet reçu après l’instantané ci-dessous : les trente identifiants sont maintenant traités dans le code et documentés dans `docs/audit-20261102/REPORT.md`. Branche dédiée `codex/audit-m01-m30-20261102`, base `39552d7` préservée, consolidation/fusion amont `1ebf3ea`. Le déploiement audité précède cette fusion selon le demandeur ; son SHA exact reste inconnu et son URL est refusée CONNECT403. Aucun projet distant substitué.
- Causes corrigées : schéma Favoris, relation qualification objet/null, tenant/mandat, états lecture/Auth/refus/MFA/partiel, workflows Admin, diagnostic fondé sur réponses réelles, Besoin FR/AR, navigation/session, menu compte et contrôles de fichier du portefeuille. Lecteur de factures minimal gardé, ACL privées inchangées.
- Types/lint/build PASS  ; 2 712 tests PASS et un Storage opt-in ignoré ; intégration 3 PASS, outillage 31 PASS. 418 migrations sur clone neuf et23 assertions SQL PASS,608 tables RLS, nettoyage vérifié ; aucune migration partagée ou distante appliquée.
- Native local GoTrue/TOTP AAL2 : 176 contrôles satisfaits, dont168 sans incident technique et8 états facture partiels attendus ; quatre acteurs/trois organisations propres. Reprise finale Admin 8 PASS : menu borné/Tab/recherche/organisation/rôle public, vraie déconnexion et lien protégé refusé. Recette publique 8 PASS aux largeurs 375/390/768/1440 FR/AR après correction mobile.16 acteurs / 12 organisations sur quatre cohortes neutralisés, audit immuable conservé.
- Revues indépendantes croisées réalisées. M14 reste bloqué par200 services / 79 catégories AR approuvés manquants ; M21 par l’identité légale approuvée ; M22 par les limites/conditions commerciales. Recettes métier liées, mandat signé et facture positive/mixte ne sont pas certifiés par la readiness. Registres/PV et visas de lancement non approuvés ; garde V1 REFUSÉ (74 conditions dans l’instantané préparatoire,5/76 VERIFIED).
- Code poussé sur la branche dédiée ; PR préparée, création API refusée `POST https://api.github.com/graphql: Forbidden`. Pas de fusion ni de production. Commandes, captures, provenance des builds et réserves : `docs/audit-20261102/CHECKS.md` et `docs/evidence/audit30-candidate-20261102.json`.
- Prochaine étape : revue de la branche et des contenus approuvés, accès non-production sécurisé, application contrôlée de la nouvelle lecture puis recettes métier positives et visas réels. L’entrée suivante conserve l’historique antérieur à la fourniture de M02–M30.

## 2026-11-02 — Candidat unifié : lectures Admin et contexte d’organisation

- Branche dédiée `codex/final-corrections-20261102`, base réelle `1ebf3ea` de `codex/bootstrap-foundation` ; cette base contient déjà consolidation et design via PR #8. Modifications existantes préservées ; aucune fusion distante ni production effectuée par cette mission.
- États refus/absence/panne distingués, Auth503 centralisé, signaux Next préservés, MFA exigée ; périmètre organisation exact et choix explicite avant édition multi-organisations. Largeur mobile des grilles/tableaux et menus d’action corrigée.
- Types/lint/build PASS ; 2 150 tests web, 102 worker et 137 bibliothèques PASS, un Storage opt-in ignoré. 18 tests publics et 4 parcours Organisations réels FR/AR à 360/1 280 px PASS, vraies sessions GoTrue/TOTP AAL2, recherche/menu/fiche propres vérifiés ; Admin RPC valide, compte ordinaire refusé42501.
- Clone neuf : 417 migrations, 225 contrats sans référence aux contournements PASS / 4 926 assertions ; 608 tables sous RLS et pgTAP fermé aux rôles API. 56 exclusions maintenues ; suite globale non certifiée. Nettoyage clone et 14 acteurs/sept organisations propres vérifié, serveur arrêté.
- M01 vérifié sur le candidat local actuel ; M02 incomplet et M03–M30 non fournis, aucune clôture inventée. La recette temporelle de crédits après expiration réelle reste ouverte.
- Gate livraison REFUSÉ (74 conditions, 5/76 VERIFIED). PR préparée, création API refusée (`Forbidden`, domaine api.github.com non autorisé). Bilan : `docs/release/FINAL_CANDIDATE_2026-11-02.md` ; preuve : `docs/evidence/final-candidate-20261102.json`. Candidat de revue, pas un visa client définitif.

## 2026-11-01 — Recette commerciale FR/AR et nouvelles protections vérifiées

- Le candidat reste **en intégration et non approuvé pour livraison externe**. Les nouveaux lots financiers, la configuration réelle des Boxes et leurs automatismes, puis le rejeu global et la restauration coordonnée doivent encore être figés et vérifiés ensemble. La traçabilité reste 5/76 VERIFIED.
- SDK8 : **8/8 tests PASS, aucun échec, ignoré ou instable**, terminé le 1er novembre à 05:22:54 UTC. Les deux chaînes FR/AR utilisent les vraies commandes : demande, RFQ, devis, contrat, PDF canoniques privés, signature SIMPLE de développement gouvernée, mission et réceptions. Les interfaces Client/Prestataire et les sondes Storage vérifient le refus de suppression d’une preuve liée, son SHA inchangé et l’accès refusé au Prestataire révoqué mais conservé au Client. Nettoyage vérifié, source inchangée pendant l’essai. Rapport SHA256 `0eeac251e8c253faf20881295d2b1516c2cf807e608a09df6e25a33e3560be8a`, archive `artifacts/test-results/local-acceptance/history/linked-commercial-2026-11-01T05-22-54-021Z.json`. Cette preuve locale ne remplace pas un fournisseur de signature contractuel ni la recette du staging.
- Instantané SDK8 des contrôles globaux : **2 155 assertions unitaires exécutées PASS** (1 918 web, 100 worker, 137 bibliothèques), typage et lint globaux PASS. Le test Storage opt-in non activé dans la suite groupée reste identifié séparément ; les essais natifs Storage sont consignés dans leurs propres rapports. De nouveaux lots ont été intégrés après cet instantané : une validation finale demeure nécessaire.
- Avantages 268030/061 : parcours effectif réservation → planification → démarrage → rapport → réception indépendante → consommation, avec idempotence, CAS, preuve canonique et admission approuvée. **37 assertions SQL PASS/ROLLBACK** sur base principale locale et clone ; **12 tests web PASS**, revue indépendante incorporée. Un compte rendu humain n’est pas un fichier scanné ni une activation automatique. La recette navigateur spécifique reste en préparation.
- DSR : périmètre de compte sans adhésion vérifié (8 assertions), restriction marketing exécutée et attestée par les traitements réels (33 assertions), notifications optionnelles effectivement bloquées sans bloquer les communications obligatoires (14 assertions). Un reçu de fichier ou une référence libre ne vaut pas preuve d’effacement complet. Les compléments de clôture des autres demandes restent en intégration.
- Confidentialité catalogue : les coûts et règles internes sont retirés de la lecture directe des rôles API ; les projections Client restent liées à son organisation et à ses versions réellement détenues. **17 assertions SQL PASS** pour ce lot. La configuration/attribution native d’une Box reste à prouver dans sa propre recette.
- Accès externes revérifiés : runtime cloud toujours révision 1, réseau restreint sans domaines Supabase/Vercel autorisés. Le brouillon sauvegardé doit être activé dans les paramètres cloud. Supabase DEV seul est autorisé ; aucune cible distincte staging Vercel ni référence Railway n’est fournie. Les décisions de signature, d’identité légale complète, CNDP et fiscales restent requises. Contrôle de 3 021 fichiers révisables : aucun des tokens de gestion autorisés ni token GitHub/Supabase/Vercel de forme réelle détecté ; les fichiers de credentials locaux restent hors Git.

## 2026-11-01 — Rejeu complet local et révocation native vérifiés

- Le candidat reste **non livrable au client et non figé** : le nouveau lot DSR ALL/fichiers, la recette commerciale liée et les vérifications finales restent en cours. La traçabilité demeure 5/76 VERIFIED ; aucun visa n'est déduit d'un test local.
- Sur la source intégrée avant DSR267 : **377 migrations, 259 fichiers SQL et 5 843 assertions PASS** dans une base PostgreSQL neuve, isolée sans réseau ; 550/550 tables publiques sous RLS, pgTAP non exécutable par les rôles API, nettoyage vérifié. Les onze échecs du précédent diagnostic ont été corrigés sans désactiver les gardes. Preuve : `work/isolated-replay/e0bed532-2d8b-448b-8c15-4c66b8ae96b9/summary.json`.
- Instantané de qualité intégré : 1 939 assertions unitaires réellement exécutées PASS (1 725 web, 92 worker, 122 bibliothèques), typage et lint globaux PASS, 23 tests des outils PASS sans ignoré, Server Actions contrôlées sur 1 486 fichiers. Le test Storage opt-in ignoré dans la suite web a été exécuté séparément par son propriétaire avec de vrais octets Supabase locaux ; il n'est pas compté parmi les 1 939. Ces résultats devront être actualisés après DSR267 et les nouveaux correctifs.
- Sécurité 264000/010/020/021/022 : annuaire des vrais comptes sans adhésion, décisions globales à quatre yeux MFA, sessions liées à GoTrue pour REST/RLS/Storage, preuves liées protégées après perte d'adhésion et contre deux ordres de course suppression/liaison, autorisation catalogue avant recherche. 0034/0134/0244 : 32+62+22 assertions PASS sur la base locale, transactions annulées.
- Révocation native réelle : même JWT AAL2, sans rafraîchissement, encore valide 3 599 s ; après suppression de sa session, RPC et profil répondent 401 et les deux accès Storage privés refusent les octets. Nettoyage et source inchangée vérifiés. Rapport `artifacts/test-results/local-acceptance/native-session-revocation.json`, SHA256 `a5c6b7aba1586d173934c3d699fc0b50269162f3b3b72704809d3c42a9238bc4`. Voir `docs/release/ACCOUNT_ACCESS_AND_SESSION_ENFORCEMENT.md`.
- Navigateur : Client6 et smoke16 avaient passé sur une source antérieure ; ils ne certifient pas le candidat courant. La recette commerciale liée a passé AuthUI4 puis identifié une fixture AAL1 révoquée après TOTP ; sa session de test est corrigée via GoTrue réel, sans assouplir l'application. La chaîne entière et la conservation physique des preuves après refus API restent à exécuter.
- Intégrations : transport privé FR/AR des PDF sources vérifié localement (upload, conflit, download SHA, refus public, suppression/absence) ; routes canoniques complètes à recetter. La restauration coordonnée LAB n'est pas encore verte après le premier échec par saturation disque ; nouveau protocole borné préparé, aucun visa de restauration annoncé.
- GitHub revérifié : HEAD et origin/codex/bootstrap-foundation = `dbf309cd4ec5c48212c43243203dd98150ee5114`. Les lots locaux sont conservés sur les branches de domaine et dans l'intégration, sans déploiement ni push de production.
- Accès externes : brouillon cloud réseau sauvegardé, activation non effectuée (runtime révision1). Supabase DEV autorisé seulement ; Vercel reste sans cible staging distincte validée et Railway sans références. Fournisseur/niveau de signature, identité légale complète, décisions CNDP/fiscales, recettes de staging, remise et PV signé restent externes. La marque Matricia ne remplace pas ces décisions. Aucun secret dans Git ou les journaux.

## 2026-10-31 — Livraison complète : intégration et nouvelle recette en cours

- État du nouveau candidat : **non livrable, non figé**. Les résultats historiques ci-dessous ne valident pas les modifications de ce lot. Le backlog de référence contient 87 tickets (`docs/audit-livraison/backlog-livraison-2026-10-31.json`). Aucune exigence n’est déclarée signée par ces seuls développements.
- Développements intégrés : contexte des organisations et mandats, assistance Client avec retrait du consentement, documents privés scannés, dossiers Prestataire et PDF FR/AR, constructeurs Franchisé, décisions Admin avec effets bornés et preuves, remboursements PayPal avec rapprochement sans nouvel ordre ambigu, reçus email vérifiés, Outbox avec accusés de consommation et supervision sous panne. Des compléments sont encore en développement, notamment factures/avoirs Client et parcours complets de protection des données.
- Dernier instantané assemblé vérifié : **1 445 tests unitaires**, dont 1 259 web et 69 worker ; typage global, 3 tests d’intégration HTTP réels, 16 tests des outils de preuve, frontières des 14 packages et contrôles structurels passent. Les contrôles devront être relancés après les compléments suivants.
- Rejeu indépendant : **261 migrations applicatives** passent sur PostgreSQL isolé sans réseau, après les migrations officielles Auth (70) et Storage (68). Les migrations ajoutées ensuite et la suite SQL complète restent à revérifier. Les régressions détectées sont renvoyées aux auteurs ; le bootstrap pgTAP de ce laboratoire a été aligné sur celui de la CLI, sans modifier les droits runtime de la base principale.
- Recette réelle locale : OTP GoTrue, TOTP AAL2, administrateur sans organisation, deux organisations et deux mandats, refus RLS, Storage et nettoyage passent. Le nouveau smoke navigateur a échoué, notamment sur un décalage ICU serveur/navigateur ; correction par libellés de dates calculés côté serveur intégrée, nouvelle recette à exécuter. Le parcours UI OTP a révélé une longueur de code imposée à tort : correction en cours selon le défaut Gold Master à six chiffres configurable.
- Build : le deuxième essai compile et type correctement, mais échoue au chargement du module PDF (résolution des polices transformée par Turbopack). Correction et nouvelle compilation encore requises ; aucun build vert du candidat courant n’est annoncé.
- Environnement : Storage privé et TOTP local activés ; redémarrage sans reset et sans perte des données. Instructions réutilisables et domaines Supabase/Vercel sauvegardés dans le brouillon de configuration, **publication de l’environnement encore nécessaire**. GitHub vérifié : branche distante `codex/bootstrap-foundation` et HEAD local identiques à `dbf309cd4ec5c48212c43243203dd98150ee5114`, corrections conservées dans le travail local.
- Hors production : les API Supabase/Vercel sont refusées par le proxy avant authentification. Railway n’a pas de cible fournie ; fournisseur/niveau de signature, identité légale complète, politique fiscale validée, restauration staging et procès-verbal client restent sans validation externe. Aucun déploiement, signature ou visa client n’a été inventé. Les tokens restent hors Git et hors journaux.

## 2026-10-31 — Corrections du workflow cloud et contrôles locaux verts

- Correction de la régression d’idempotence financière par migration additive, fixtures fiscales alignées sur les règles validées, états React/hydratation, tokens CSS/TypeScript, lint et URL de build CI.
- Vérifications : 1 265 tests unitaires ; 233 migrations rejouées sur une base jetable neuve ; 174 fichiers SQL, 3 833 assertions et 4 scénarios de concurrence ; 18 E2E publics/cookies FR/AR mobile/bureau ; typage, lint, build et gates de phase 00 validés.
- Supabase local : démarrage reproductible via `bash scripts/start-local-supabase.sh`, Auth/REST/DB/outbox sains et parcours OTP réel vérifié sans divulgation de secrets. La base existante est conservée.
- Revue indépendante des corrections réalisée et recommandations intégrées. Preuve : `docs/evidence/cloud-error-corrections-2026-10-31.md`.
- Prochaine étape : reprendre la validation des parcours métier authentifiés et des intégrations hébergées avec les accès de développement appropriés. Cette correction n’est pas un visa de release V1.

## 2026-10-31 — Parcours authentifié des espaces, 16 tests verts

- Le parcours sandbox `authenticated-route-smoke` ouvre, avec un compte réel, en français et en arabe, à 360 px et sur ordinateur : diagnostics, questionnaires, devis, missions, facturation, crédits et notifications (Client) ; qualification, devis, missions, facturation et marketing (Prestataire) ; performance, relances, questionnaires, résumé et marketing (Franchisé) ; command center, parcours et organisations (Administration).
- Un compte sans le rôle est renvoyé hors de la finance d’administration, et le nom de l’autre organisation de test n’apparaît pas dans son espace. Les comptes de test ont été supprimés à la fin. Résultat : 16/16, aucun test ignoré. Preuve : `artifacts/test-results/authenticated-route-smoke-summary.json`.
- Corrections trouvées par ce parcours : les dates de mission et du command center s’affichent à l’heure du Maroc, donc le serveur et le navigateur rendent le même texte. Les clés des formulaires de mission ne sont plus tirées au hasard pendant l’affichage. La lecture des services prestataire nomme les liens exacts entre les tables, ce qui permet d’ouvrir la qualification même sans service déclaré.
- Ce n’est pas un visa des 63 fonctions. Le compte d’administration de ce bac à sable n’a pas le rôle Finance, Super Admin ni gestion marketing : ces trois pages d’administration lui restent fermées, comme prévu. La publication sur un vrai réseau social et l’audit indépendant restent ouverts.

## 2026-10-08 — Régions d’intervention prestataire, retour diagnostic, affichage de l’accueil

- Accueil public : rendu corrigé (hero en une seule image, voile, cartes, boutons, pied de page arabe), vérifié en FR/AR à 390, 1200, 1440 et 1920 px, sans débordement horizontal.
- RFQ-REGION-001 : formulaire des 12 régions officielles dans `/sous-traitant/qualification` (FR/AR, motif obligatoire, `aria-live`). RPC `declare_provider_regions` : contrôle des droits, idempotence, historique immuable `provider_region_versions`, mise à jour du profil de matching, audit et outbox `ProviderRegionsDeclaredV1`. Migration `20261008100000_provider_intervention_regions.sql` **non appliquée** ; pgTAP `0172` écrit, **non exécuté**.
- PUB-DIAG-004 : le retour vers l’enregistrement du diagnostic est conservé via `/organisation` (liste blanche, pas de redirection ouverte).
- Vérification : `tsc` 0 erreur ; Vitest 277 fichiers, 1110 tests verts ; ESLint 0 erreur sur les fichiers modifiés ; `next build` vert (avec une URL publique `https`, comme l’exige la production).
- Le 2026-10-08, l’utilisateur a appliqué `20261008100000_provider_intervention_regions.sql` et `20260929110000_restore_account_security_mfa.sql` dans l’éditeur SQL Supabase. Contrôle en lecture seule : exigence MFA `aal2` rétablie (sécurité du compte et rôles plateforme), table `provider_region_versions` avec RLS et trigger d’immutabilité, RPC exécutable par `authenticated` et pas par `anon`, aucun insert direct, 12 régions, opération d’idempotence autorisée.
- pgTAP exécutés sur cette base, chacun dans une transaction annulée : `0170` 14/14, `0171` 14/14, `0172` 10/10. Dans `0171`, le contrôle du worker appelait pgTAP sous le rôle `authenticated`, qui n’a pas accès au schéma `extensions`. Il capture désormais le refus `42501`, puis vérifie après `reset role`, comme les autres tests.
- **Toujours non prêt** : fichier `20260929110000_restore_account_security_mfa.sql` à ajouter à Git. E2E authentifiés (dont `p29-marketing-workspaces.spec.ts`, non suivi dans Git) à lancer. Intégrations externes non prouvées. Audit indépendant absent.
- **Prochaine étape** : déclarer les régions d’un vrai compte prestataire via l’écran, puis vérifier qu’il entre dans le matching d’une demande de la même région. Lancer ensuite les E2E authentifiés.

## 2026-09-29 - Marketing : espaces Prestataire et Franchisé, suivi de conversion, fréquence hebdomadaire

- Nouveaux écrans `/sous-traitant/marketing` et `/franchise/marketing` (FR/AR, entrée « Marketing » dans la navigation). Ils montrent Brand Kit, consentements, campagnes, contrôle des contenus, calendrier assisté, validations, programmation et performance de la seule organisation sélectionnée. L'organisation doit figurer parmi celles que l'utilisateur peut gérer, sinon accès refusé. La revue des preuves et les templates restent réservés à l'administration.
- Validation globale du calendrier ASSISTED ouverte aux propriétaires Client, Prestataire et Franchisé (avant : Client seulement). Le serveur contrôle toujours consentement, conformité, risque, audit et outbox.
- Brand Kit prérempli : dernière version du Brand Kit si elle existe, sinon nom de l'organisation, services du prestataire ou bibliothèque du franchisé, et lien HTTPS vers le diagnostic.
- Filtres de performance : noms de bibliothèque, service, organisation, franchise, contenu et réseau à la place des UUID ; les acteurs deviennent « Vous » ou « Membre N ».
- Suivi de conversion : un clic sur un CTA pose un cookie signé (HMAC, HttpOnly, Secure, 30 jours) et enregistre `CTA_CLICKED`. Ensuite, l'inscription (`REGISTRATION_STARTED`), le diagnostic public (`DIAGNOSTIC_STARTED`), l'opportunité (`OPPORTUNITY_CREATED`), la demande (`RFQ_STARTED`) et la signature de contrat (`CONTRACT_SIGNED`) sont reliés au contenu cliqué via `ingest_marketing_attribution_event_v1`. Consentement MARKETING_ANALYTICS obligatoire, clé d'idempotence déterministe, aucun identifiant du navigateur n'est cru. En cas d'échec, le parcours métier continue.
- Recommandation hebdomadaire appliquée : worker `/api/workers/marketing-frequency` (cron lundi 04:45). Seules les campagnes AUTOPILOT changent, d'un cran au plus par semaine (bornes 1 à 50). Les recommandations « pause » et « changer de template » attendent une décision humaine. Chaque décision est enregistrée dans un registre immuable, auditée et publiée dans l'outbox.
- Script de démonstration `scripts/provision-marketing-demo.mjs` : 10 Brand Kits franchisés, 20 prestataires, 50 campagnes, 300 contenus, 100 publications programmées, avec cas publiés, échoués, sautés, bloqués et consentement analytique retiré. En simulation par défaut, `--apply` requis, development/staging uniquement. **Non exécuté.** Aucune connexion sociale n'a de credential : rien ne peut partir sur un vrai réseau.
- Migration `20260929100000_marketing_workspaces_funnel.sql` (additive) : appliquée le 2026-09-29 par l'utilisateur dans l'éditeur SQL Supabase. Contrôle en lecture seule : registre présent, RLS forcée, worker autorisé, utilisateur refusé, validation ASSISTED ouverte aux propriétaires Prestataire et Franchisé. Test pgTAP `0171` écrit, **non exécuté** (pas de base locale).
- Vérification : `tsc` sans erreur dans le code source (seule erreur dans `.next/dev/types`, fichier généré). Vitest : 275 fichiers, 1103 tests verts. ESLint sur les fichiers modifiés : 0 erreur.
- **Toujours non prêt** : pgTAP `0171` à exécuter, E2E authentifié marketing (FR/AR, 360 px) absent, audit indépendant absent, franchises de démo en statut CONTRACT_PENDING (le filtre « Franchise » de la démo reste vide).
- **Prochaine étape** : exécuter `0171`, lancer le script de démo en simulation puis avec `--apply` sur development, puis écrire l'E2E marketing authentifié.

## 2026-09-28 — Besoin → demande → matching conforme au Gold Master V4

- La demande créée depuis un besoin reprend les réponses du besoin. Le serveur calcule si les informations obligatoires pour les devis sont réunies. Sinon, la demande passe en « Informations requises » et le client ne complète que ce qui manque. Chaque complément crée une nouvelle version immuable, figée avant le matching.
- Région choisie parmi les 12 régions officielles (FR/AR). Date limite choisie avec un sélecteur, en heure du Maroc. Panel de 10 prestataires au minimum.
- L’essai de 30 jours bloque les nouvelles demandes dès sa date de fin, même sans traitement planifié.
- Le diagnostic public revient directement à l’étape d’enregistrement après connexion.
- Vérification : `tsc` sans erreur dans le code source (seule erreur dans `.next/dev/types`, fichier généré). Vitest : 269 fichiers, 1080 tests verts. Test SQL `0170` écrit mais **non exécuté**.
- Migration `20260928120000_need_request_quote_completeness.sql` appliquée le 2026-09-28 par l’utilisateur dans l’éditeur SQL Supabase : les 5 fonctions sont présentes. Test pgTAP `0170` pas encore exécuté.
- **Prochaine étape** : exécuter le test pgTAP `0170`. Ajouter un écran pour que les prestataires ou l’administration renseignent les régions d’intervention (RFQ-REGION-001).

## 2026-09-28 — Administration : plus d’UUID, de JSON ni d’empreinte à saisir

- Command center : l’action contrôlée se demande en choisissant un dossier ouvert. Le serveur relit le dossier sous RLS, en déduit l’organisation et la ressource, et calcule l’empreinte SHA-256 et le résumé. Les identifiants envoyés par le navigateur sont ignorés.
- L’accès support est accordé au responsable du dossier, pour 15, 30 ou 60 minutes. Avant, une date `datetime-local` échouait à la validation.
- Finance (box) : avantages autorisés en cases à cocher. Achats groupés : fournisseur choisi dans une liste.
- Quatre tests périmés alignés sur le comportement réel (Finance franchisé présente, bouton inventé retiré).
- Vérification : `tsc` sans erreur dans le code source. La seule erreur restante est dans `.next/dev/types`, un fichier généré par le serveur de dev. Vitest : 267 fichiers, 1071 tests verts.
- **Toujours non prêt** : pas d’E2E, pas de SQL/RLS relancé, pas d’audit indépendant, pas d’essai navigateur du Command center.

## 2026-09-28 — Besoin public : une étape à la fois

- Le formulaire n’affiche plus toutes les sections ensemble. L’ordre est : description, compréhension du besoin, questions, compléments, puis récapitulatif.
- Le libellé technique `TOKEN_OVERLAP_V1` n’est plus montré à l’utilisateur.
- **Toujours non prêt** pour le reste du prompt maître.

## 2026-09-28 — Franchise publique : plus de promesse d’exclusivité

- La page ne dit plus « territoire exclusif ». Elle dit que le territoire est celui prévu au contrat versionné, en français et en arabe.
- Les parts internes (Hatim, NEOXA, Asma) n’étaient pas sur cette page.
- **Toujours non prêt** pour le reste du prompt maître.

## 2026-09-28 — Page Professionnels : plusieurs métiers, catégories repliées

- Le hero ne montre plus la photo d’artisan. Il liste les domaines réels du catalogue (informatique, juridique, comptabilité, etc.).
- Les services d’un domaine sont groupés par catégorie. Seule la première catégorie est ouverte.
- L’exemple d’activité cite plusieurs métiers, plus seulement la menuiserie.
- **Toujours non prêt** pour le reste du prompt maître.

## 2026-09-28 — Prédiagnostic public : plus de chiffres inventés

- Sans priorité, une seule carte s’affiche. Les 92 %, 83 %, 71 % et « 44 / 48 réponses » sont retirés.
- Si le navigateur refuse le brouillon, une seule reprise s’affiche : réessayer, continuer sans sauvegarde locale, ou se reconnecter. Les trois pannes simultanées sont retirées.
- Le secteur « Santé, éducation & social » est retiré : le contrat `save_public_diagnostic_intake` ne l’accepte pas. Un ancien brouillon est enregistré comme « Autre activité ».
- **Toujours non prêt** pour le reste du prompt maître.

## 2026-09-28 — Navigation publique unique et hero allégé

- FR et AR partagent les mêmes destinations, dans le même ordre : Comment ça marche, Entreprises, Professionnels, Franchise, Abonnements, À propos. Le contact reste dans le pied de page.
- Le hero n’affiche plus le slogan, les trois valeurs, le script ni les bandeaux posés sur la photo. Le voile du titre suit le sens d’écriture (`to inline-end`).
- Preuve : `vitest run public-navigation public-pages-mockup-alignment` — 2 fichiers, 12 tests, vert.
- **Toujours non prêt.** Le reste du prompt maître (diagnostic, espaces, admin, E2E, SQL) n’est pas traité.

## 2026-09-28 — Correction publique ciblée (contact, abonnements, besoin)

- Branche `codex/audit-final-2026-09-15`, HEAD `a1e5752`. Aucun déploiement. Les changements locaux non commités sont conservés.
- Contact : suppression du bloc « États d’envoi (exemples) / Exemple illustratif » et de la carte « Nous écrire directement — Via le formulaire ci-dessus ». Le succès reste celui renvoyé par l’action serveur.
- Abonnements : les cartes n’affichent plus la même liste de fonctions. Prix et crédits viennent de `get_public_subscription_plans` (unités mineures, `formatMinor`). Prix nul ou plans indisponibles : « Tarif communiqué avant souscription », sans cartes Essentiel / Premium / Organisation inventées.
- Besoin public : les deux sections numérotées 3 sont devenues 3, 4 et 5. Faute « nous pourrez » corrigée. Le découpage en six étapes distinctes n’est pas fait.
- Preuve : `vitest run abonnements/page.test public-pages-mockup-alignment` — 2 fichiers, 10 tests, vert.
- **Non prêt.** Inventaire complet des routes, RBAC, E2E et P0 non exécuté. Détail : `docs/corrections-integrales/ACCEPTANCE_REPORT.md`.

## 2026-09-21 — Registre des 71 lignes encore ouvertes

- Les 63 lignes `MAT-FUNC` `IN_PROGRESS` ne pointent plus vers la matrice générique. Chacune cite une implémentation, un test et la preuve atomique qui existe. Le motif `PENDING` nomme l’écart restant : visa indépendant, et E2E métier quand il manque encore.
- Les 8 lignes Marketing étaient déjà rattachées à leur code. Elles restent `IN_PROGRESS` pour le même motif.
- Compteur inchangé : **5/76 `VERIFIED`**. `validate-traceability` passe. Aucun visa n’a été inventé.

## 2026-09-21 — Audit final après corrections

- Base locale et base de développement alignées sur `20260921250000`. La table d’avis de marque manquante en local a été recréée depuis `20260913018700`, puis les 33 migrations en attente ont été appliquées. `row_version` est qualifié dans les mises à jour jointes du catalogue (`42702`).
- Contrats SQL ajustés aux politiques de lecture franchise additives, au refus de consultation porté par le helper, et au plan réel des soumissions catalogue.
- Preuve : suite SQL distante **171 fichiers, 3 786 assertions**, 4 scénarios de concurrence. Contrats `0160`–`0169` verts en local (139 assertions). `validate-release` passe. Dry-run distant : à jour.
- **Non signable.** Couverture inchangée : **5/76 `VERIFIED`, 71 `IN_PROGRESS`**. Pas de visa indépendant, pas d’E2E-01 exécuté. Paiement sandbox, SMTP/OTP et worker/ClamAV distants restent non prouvés. L’arbre n’est pas gelé.

## 2026-09-21 — Restauration clôture prestataire et politique litige

- `20260921120000` avait réécrit, après coup, le tableau de clôture et le balayage d’exceptions. `20260921240000` rétablit les corps de `20260921220000` (`OVERDUE`, `blocks_new_opportunities`) et remplace la politique `dispute_cases_franchise_library_read` par `franchise_supervises_dispute`.
- Le contrat `0161` compte 31 politiques de lecture franchise et compare la capacité sans casse. Le contrat `0163` appelle `extensions.throws_ok` sans changer de rôle avant la fonction pgTAP. Le parcours mission client n’utilise plus l’état `todo` scanné comme marqueur incomplet.
- Preuve développement : `0161`, `0163`, `0167`, `0168`, `0169` (52 assertions) et les 4 scénarios de concurrence. `validate-release` passe (catalogue, spec, traçabilité, marqueurs).
- Lot 9 : **non clos**. 5/76 `VERIFIED`. Pas de visa indépendant, pas d’E2E-01. Les preuves externes du checklist (paiement sandbox, SMTP, worker, ClamAV) restent en échec.

## 2026-09-21 — Pages publiques : composition calée sur les 19 PNG

- Accueil FR : hero pleine largeur, cartes flottantes sur photo à droite, titre navy/violet, 7 étapes, résultats 2×2 + ruban, FAQ + bandeau violet. Accueil AR (maquette 17) : photo à gauche, titre corail, note latérale, cycle numéroté, sans FAQ/résultats FR. Nav AR : الرئيسية، كيف تعمل، لمن، موارد، من نحن، اتصل بنا.
- 404 : illustration chemin/arche/panneaux (plus une photo). Connexion : overlay titre+chapeau sur photo et bandeau navy. Contact : colonne photo pleine hauteur. À propos, franchise, professionnels, abonnements, services : hero photo qui déborde à droite.
- Ce n’est **pas** un clone photographique des PNG : portraits Figma, fleur vs logo M, diagnostic maquette 18 en 4/9 vs produit 8 questions. Design Authority A reste le CSS produit. Preuve : tests accueil/nav/alignement.
- Lot 9 : **non clos**.



## 2026-09-21 — Lecture de la facture d’abonnement client

- Le cycle payé s’ouvre sur `/client/abonnement/cycles/[cycleId]` (montant exact, plan, période, référence de paiement). Le hash de preuve reste côté serveur. Le lien « Voir la facture » ne renvoie plus au coffre documents.
- Preuve : migration `20260921230000`, contrat SQL `0169`, rendu `subscription-invoice.test.tsx`.
- Marketing 001–008, adaptateurs LinkedIn/Meta et paiement PayPal d’abonnement étaient déjà implémentés. Ils restent `IN_PROGRESS`. Pas de visa indépendant, pas d’exécution E2E-01, pas de `VERIFIED`.

## 2026-09-21 — Avoirs, échéanciers et recouvrement prestataire

- ADM-036 : `issue_provider_credit_note` (finance seulement). Journal `PROVIDER_CREDIT_NOTE` inverse les comptes de la facture. Le solde est dérivé (`total − allocations − avoirs`). La facture n’est jamais `UPDATE`. Un avoir après paiement complet est possible tant que la somme des avoirs ≤ total.
- ADM-037 / ST-032 : `request_provider_payment_plan` (prestataire ou finance, 2 à 12 échéances = solde), `decide_provider_payment_plan` (finance). Un plan `APPROVED` passe le statut dérivé à `PAYMENT_PLAN` et lève le gel J+8. `open_provider_collection_case` défait le plan (`DEFAULTED`) ; `advance_provider_collection_case` ajoute OPEN → FORMAL_NOTICE → COLLECTION → CLOSED sans muter le dossier.
- UI Admin (avoir, décision d’échéancier, recouvrement) et échéancier prestataire (demande). Sorties finance : libellé `PAYMENT_PLAN`.
- Preuves : migration `20260921220000`, contrat SQL `0168`, vitest actions/facturation.
- Lot 9 : **non clos**. Pas de visa indépendant, pas d’E2E-01, pas de `VERIFIED`.

## 2026-09-21 — Restriction J+8 prestataire (nouvelles opportunités)

- ADM-035 / critère 73 : une facture Matricia échue (`due_on < current_date` et solde > 0) ajoute `OVERDUE_INVOICE` à `provider_service_eligibility_snapshot`. Matching et invitation RFQ excluent le prestataire. Les missions déjà ouvertes ne sont pas mutées ; `financial_status` n’est pas réécrit (une restriction FINANCIAL imposée n’est pas effacée au paiement).
- Le règlement intégral (allocations = total) lève le gel sans nouvelle date d’échéance. Un paiement partiel ne prolonge pas `due_on`.
- Clôture admin : `blocks_new_opportunities` sur les factures échues. Facturation prestataire : alerte FR/AR si `paymentStatus=OVERDUE`.
- Preuves : migration `20260921210000`, contrat SQL `0167`, vitest clôture / facturation.
- Lecture facture client et paiement d’abonnement : livrés ensuite (sections du 21 septembre). Restent hors signature : visa Lot 9, E2E-01, `VERIFIED`.

## 2026-09-21 — Packs, promotions, paramètres, demande volume, coffre

- ADM-031G/H : brouillon et activation AAL2 des packs et promotions. L’attribution appelle `issue_credits` (`EXTRA_PURCHASE` / `PROMOTION`), sans second ledger. Le plafond bonus actif `CREDIT_PROMOTION_MAX_BONUS` borne la création et l’attribution.
- ADM-044 : trois paramètres versionnés seulement (`DOCUMENT_EXPIRY_WARNING_DAYS`, `VOLUME_RESERVATION_DEFAULT_TTL_HOURS`, `CREDIT_PROMOTION_MAX_BONUS`). Pas d’éditeur libre.
- ADM-VOL-002 : `list_admin_volume_demand` compare 12 mois de réservations au forecast négocié.
- ADM-010 : `list_admin_document_vault` agrège les métadonnées client et prestataire, sans chemin de stockage. L’alerte d’expiration n’existe que si le paramètre est actif.
- Preuves : migration `20260921170000`, contrat SQL `0166`, tests UI catalogue et demande.
- Toujours hors signature : visa indépendant, E2E-01, promotion `VERIFIED`. Adaptateurs LinkedIn/Meta déjà présents, restent `IN_PROGRESS`. Pas de PDF fictif ni de connexion en tant que client.

## 2026-09-21 — Client : RFQ existante + site questionnaire/mission

- `open_service_request_rfq` refuse maintenant via `private.client_may_open_new_service_request` (`CLIENT_REQUEST_NOT_ENTITLED`, 42501). Matching et `mark_ready` inchangés. Rotation 90 jours et éligibilité courante conservées.
- `start_questionnaire_session` : 7e argument `p_site_id` défaut `null` (une seule signature PostgREST). Audience CLIENT + site ACTIVE de l’organisation, sinon `SITE_NOT_APPLICABLE` / `SITE_SCOPE_DENIED`. Hash d’idempotence sans `site_id` si null (rejeu des clés 6 arguments). UI `/client/questionnaires` transmet le site du portefeuille.
- `missions.site_id` hérité de la demande contractée (`create_mission` après le wrapper checklist 0191) + rattrapage des missions existantes. FK composite vers `client_sites(id, organization_id)`.
- Preuves : migration `20260921160000`, contrat SQL `0165`, 0025 signature 7 arguments, vitest start/site/panel.
- Lot 9 : **non clos**. Pas de visa indépendant, pas d’E2E-01, pas de `VERIFIED` de couverture.

## 2026-09-21 — Client : blocage SQL des nouvelles demandes (reliquat lots 3/5/7)

- Le blocage n’est plus seulement UI : `private.client_may_open_new_service_request` refuse une **nouvelle** demande si abonnement hors `TRIAL_ACTIVE`/`ACTIVE`, essai `TRIAL_EXPIRED` sans Gold `ACTIVE`, ou anomalie `DOCUMENT_EXPIRED` encore `OPEN`/`QUESTIONED`. Statut d’abonnement inconnu = pas de blocage inventé (tests P07).
- Appliqué dans `create_service_request` et `clone_request_core` (`CLIENT_REQUEST_NOT_ENTITLED`, 42501). Conversion besoin/opportunité inchangée : elles appellent déjà `create_service_request`. Pause/fin de plan récurrent non concernées.
- UI : `/client/demandes/nouvelle` et `/demandes/recurrence` masquent création/clonage/génération ; historique, pause et fin restent. `42501` → `FORBIDDEN` côté actions. Document expiré : Casablanca `YYYY-MM-DD`, mission non détruite. L’ouverture RFQ et le `site_id` de session sont traités par la migration `20260921160000`.
- Preuves : migration `20260921150000` (évite la collision volume `20260921140000` / `0163`), contrat SQL `0164`, vitest entitlement / actions / récurrence.
- Lot 9 : **non clos**. Pas de visa indépendant, pas d’E2E-01, pas de `VERIFIED` de couverture.

## 2026-09-21 — Activation pool volume (ADM-VOL-006)

- Commande `activate_framework_pool` : AAL2 + `begin_volume_command` (le même jeton d’idempotence que le brouillon). DRAFT → `FRAMEWORK_ACTIVE`, puis pool `POOL_ACTIVE` borné par `maximum_units`. Engagement fournisseur facultatif. Un seul pool ouvert par version.
- Écran Achats groupés : formulaire d’activation distinct du brouillon. Réserve / allocation / consommation inchangées.
- Preuves : migration `20260921140000`, contrat SQL `0163`, test UI négociations.

## 2026-09-21 — Administration Boxes / P&L / clôture / exceptions / volume

- ADM-031 : commandes versionnées `create_benefit_version`, `create_box_version` (slots), `activate_*` (AAL2, coût plein > attendu ⇒ référence d’approbation), `link_plan_box_rule`, dashboard `list_admin_boxes_dashboard` + `issue_credits` / wallet. Écran Finance `#boxes` / `#credits` (FR/AR, pas d’impersonnation client : simulation = matrice plan↔Box).
- P&L bibliothèques : `list_admin_pnl_dashboard` + clôture via `close_franchise_profit_period` (règles IT 50/50 et STANDARD 50/25/25 inchangées).
- Clôture fournisseur : `list_admin_provider_closure_dashboard` + `issue_provider_statement`. Sweep `sweep_admin_exceptions` → file `EXCEPTIONS` (`BILLING_EXCEPTION`, payables non relevés, matching FAILED/NO_CANDIDATE, LOW_STOCK, PAST_DUE).
- Volume : `create_framework_agreement_draft` + dashboard enrichi (contrats, SKU, rentabilité agrégée).
- Corrections TS : `PersonRow`/`RequestRow`/`MessageRow` exportés ; `QuotePreview` garde `invitation` nulle.
- Preuves : migration `20260921120000`, contrat SQL `0162`, tests UI Boxes + mock command center.

## 2026-09-21 — Lots 1 / 4 / 8 / 9 Client (onboarding, contrats, sécurité, preuves)

- Lot 1 : ICE déjà connu → `ACCESS_REQUESTED` sans doublon ; après création Client, CTA vers `/client/onboarding`. Parcours conformité : documents = étape 2, essai seulement après `VERIFIED` + essai actif. Résultat de validation affiché. Essai expiré → réactivation Gold. Le SQL d’activation d’essai n’a pas été modifié (`MAT-FUNC-001` conservé).
- Lot 4 restant : signature et envoi à la signature sur `/client/contrats` (plus seulement dans le panneau missions), avec `revalidatePath` contrats/missions. Approbations multi-personnes `business_approval_requests` sur `/client/actions` via `decide_business_approval` (AAL2 + rôles de la politique versionnée, aucun paiement autonome).
- Lot 3 reliquat : barre de progression réelle sur `/besoin` (étapes 1–5, pourcentage entier) ; clonage visible depuis `/client/demandes` vers `clone_service_request` (`/demandes/recurrence`).
- Lot 5 / 7 reliquat : document expiré → alerte mission (mission non détruite) ; coffre : seuls les documents non expirés sont liables à une demande/mission.
- Lot 7 original (coffre/finances/Box) : pages déjà dans le shell ; **nouvelle RFQ bloquée en SQL et UI** si abonnement `TRIAL_EXPIRED` / `SUSPENDED` / `PAST_DUE` / `CANCELLED`, essai expiré sans Gold actif, ou document expiré non résolu ; historique conservé. Coffre, crédits, Box, récompenses inchangés.
- Lot 8 : invitation membre déjà dans l’écran sécurité ; lien préférences notifs (`IMMEDIATE` / `DIGEST` / `DISABLED` par catégorie) vers `/notifications` (déjà `ClientAppShell` via `ConnectedAppShell`).
- Lot 9 : **non clos**. Pas de visa indépendant, pas d’E2E-01 bout-en-bout exécuté ici, `REQUIREMENTS_COVERAGE` non passé en `VERIFIED`. FR/AR et 360 px des nouveaux panneaux couverts par rendu statique + typecheck ciblé.

## 2026-09-21 — Lot 2 Client (bilan, décisions, assistance 002–006, 009–010, 046)

- Bilan et évolution sur le même parcours : bandeau de continuité sur `/client/diagnostics` (dernier score par bibliothèque, delta entier) et delta du run ouvert, sans overlay illustratif.
- Recommandations groupées par constat, libellés FR/AR `Conseil / Accompagné / Piloté` (GUIDANCE/ASSISTED/MANAGED). Comparaison Essentielle/Standard/Avancée via `/diagnostics/solutions?anomalyId=` — les deux vocabulaires restent distincts.
- Questions expirées/expirantes et réévaluations de profil affichées sur le bilan (comptes du questionnaire sélectionné et des candidats assistance), sans charger le corpus 6 000.
- Assistance contextuelle incrustée bilan / besoin / devis / jalon : suggestions à confirmer ou rejeter, aucune action critique autonome. Bundles : lancement d’un besoin confirmé (`/besoin?q=`), pas de commande silencieuse.
- Conversion opportunité → demande : `RFQ_READY` pointe vers `/client/demandes/nouvelle?opportunityId=`. `start_questionnaire_session` inchangé (pas de `site_id`).
- Preuves : helpers journey, AssistanceCue, board continuité, messages FR/AR.

## 2026-09-21 — Lot 6 Client (portefeuille 011, 012, 021, 051, 053)

- Sites : création versionnée `create_client_site` depuis `/client/portefeuille` (code, noms FR/AR, adresse, code région). Affichés sur projets et budgets.
- Budgets : alertes de consommation en points de base entiers (attention 80 %, enveloppe 100 %, dépassement si net > approuvé). Montants exacts, y compris restant négatif.
- Calendrier : libellés FR/AR des sources (devis, jalons, factures, documents). Progression projet sans virgule flottante.
- Demandes : `site_id` transmis dans le payload de conversion (besoin ou opportunité). Préremplissage depuis `diagnostic_runs.site_id` quand le bilan en a un. Zone géographique (`regionCode`) distincte du site d’entreprise.
- Preuves : tests consommation/progress/site RPC, panneau portefeuille, formulaire demande avec sites.
- Écart assumé : `start_questionnaire_session` ne prend pas encore `site_id` ; `missions` n’a pas de colonne `site_id` (héritage via la demande). Lot 2 pourra brancher le site au démarrage du questionnaire.

## 2026-09-20 — Lot 7 Client (comparaison et sélection de devis)

- Comparaison Client : score de complétude en points de base entiers, livrables/garanties de la version figée, pas d’identité prestataire. Pondération locale d’analyse sans score automatique.
- Sélection : motif obligatoire + confirmation humaine. RPC `select_quote_and_notify` enregistre la décision, appelle `select_quote`, puis publie un retour anonymisé (`publish_not_selected_feedback`) aux non retenus sans gagnant ni coordonnées.
- Démo : colonnes illustratives sans bouton de sélection réelle. Messagerie interne uniquement avant choix.
- Preuves : contrat SQL 0160, tests complétude/action/formulaire comparaison.

## 2026-09-20 — Lot 5 Client (demande/RFQ depuis besoin confirmé)

- Conversion atomique `create_service_request_from_need_intake` : intake verrouillé, service publié résolu par code métier, questionnaire CLIENT publié de la même bibliothèque, empreintes catalogue/questionnaire serveur, table `public_need_intake_conversions` insert-only (intake inchangé).
- Aucune ouverture automatique de consultation (`mark_ready` / matching / `open_rfq` restent des actions humaines distinctes). Idempotence par replay de conversion + clé `intake_id`.
- `/client/demandes/nouvelle?intakeId=&serviceCode=` prépare le brouillon ; `/besoin` propose « Créer une demande de devis » après enregistrement d’un service confirmé.
- Preuves : contrat SQL 0159, formulaire sans UUID internes, action besoin vs opportunité, extraction du code service depuis le snapshot.

## 2026-09-20 — Lot 3 Client (assistant besoin MAT-FUNC-008)

- Parcours `/besoin` : texte libre borné classé vers des services publiés (`TOKEN_OVERLAP_V1`), confirmation humaine obligatoire, questions discriminantes manquantes, sans création silencieuse de besoin/RFQ.
- Authentifié : `discover_assistance_scope` (lecture seule, max 20 services / 50 questions) enrichi des libellés FR/AR ; données fraîches `prefill_fact_versions` réutilisées et à confirmer.
- Public : classement borné sur la projection des 200 services (aucune question du corpus 6 000 chargée). Brouillon autosauvegardé localement (7 jours) ; l’enregistrement compte reste une action distincte.
- Correction TS prestataire : documents de consultation typés `ConsultationPackDocument` (plus de `doc.id` sur une union démo).
- Prochaine étape : Lot 5 — demandes/RFQ (conversion brouillon confirmé → consultation, versions catalogue conservées).

## 2026-09-20 — Lot 0 Client (shell Gold Master)

- Espace Client : pages hors chrome rentrées dans `ClientAppShell` (portefeuille, favoris, récurrence, assistance, solutions, achats groupés, onboarding, nouveau litige).
- Nav Gold Master : 9 liens maquette + Pilotage (À traiter, Contrats, Portefeuille, Crédits & Boxes, Favoris).
- Routes nouvelles : `/client/actions` (CL-013 / MAT-FUNC-006), `/client/contrats` (CL-028), `/client/recherche` (bandeau global demandes/missions/contrats/documents/messages).
- Preuves : tests nav/recherche + four-spaces + accueil Client verts. Typecheck web : seules des erreurs prestataire préexistantes (`workbenches.tsx`) restent hors Lot 0.
- Prochaine étape : Lot 3 — assistant besoin `MAT-FUNC-008` (texte libre → service → questions manquantes) + préremplissage/autosave.

## 2026-09-19 — Restructuration modulaire par espace (5 vagues)

- Architecture cible livrée : **un module par espace** sous `apps/web/modules/`. Les routes `app/[locale]/…` restent des coquilles Next.js (page/layout/loading/error) et délèguent aux écrans du module.
  - `modules/client` — 143 fichiers (data 23, screens 118) : tableau de bord, diagnostics, demandes, missions, finances, documents, onboarding…
  - `modules/provider` — 65 fichiers (data 22, screens 41) : qualification, devis, missions, facturation, réputation, planning
  - `modules/franchise` — 37 fichiers (data 14, screens 23) : accueil, CRM, relances, digest, gouvernance
  - `modules/admin` — 112 fichiers (data 27, screens 85) : command-center, clients, providers, finance, catalogue, opérations…
  - `modules/shared` — 191 fichiers : cockpit/shell, UI, i18n, supabase, auth, notifications, contrats, fiscalité…
  - `modules/public` — 30 fichiers : catalogue public, parcours besoin/fournisseur, site
- `lib/` et `components/` vidés puis retirés. Alias `@/` résolu en tests via `apps/web/vitest.config.ts`.
- Preuves : typecheck PASS, ESLint PASS, **816 tests web verts (200 fichiers)**, `release:validate` + `traceability:validate` (76 exigences) PASS.
- Prochaine étape : extraire les pages publiques restantes vers `modules/public/screens` si le site public doit suivre le même contrat que les 4 espaces.

## 2026-09-18 — Correction UX des tableaux de bord (structure et affichage)

- Déduplication du déroulement Client et Prestataire : suppression des rangées de gros CTA qui doublonnaient le hero et les actions groupées (« Exprimer un besoin » affiché 3 fois), et des liens Messages/Notifications/Profil qui doublonnaient la nav courte dans la barre de recherche.
- `CockpitActionGroups` : pastille « · » remplacée par une tuile or « ↗ » (`cockpit-action-tile`, miroir RTL) avec chevron dédié.
- `admin-experience.css` : cartes KPI resserrées (min-height 8,5rem → 6,5rem) avec teintes de fond par tonalité (critique/attention/ok) ; process strip en 2 colonnes sur mobile puis `auto-fit` desktop (fini la colonne unique interminable) ; flux d’activité plus compact. CSS mort (`client-primary-actions`, `provider-primary-actions`) retiré.
- `admin-module-chrome.test.tsx` réécrit en JSX (corrige `react/no-children-prop` et le typage `children` requis).
- Preuves : 813+54+4 tests unitaires verts, typecheck/ESLint propres, smoke démo 18/18 routes saines, captures avant/après dans `artifacts/test-results/dashboard-review/`.

## 2026-09-18 — Audit global des portails (cahier des charges Gold Master V4)

- Portails structurels : `catalog:validate` (10 bibliothèques, 200 services, 6000 questions), `spec:validate` (7 registres, 68 fonctions, 63 agents), `traceability:validate` (76 exigences cohérentes), `no-placeholders` et `release:validate` verts.
- Typecheck tous packages vert ; ESLint vert ; tests unitaires 871 verts (199 fichiers web, 11 worker, 1 ui) ; tests SQL/RLS **159/159 verts** sur la base development ; smoke runtime démo **18/18 routes saines** (4 personas, 360 px) via `tests/e2e/helpers/demo-spaces-smoke-run.mjs`.
- Corrections appliquées pendant l’audit : état `ProcessStep` `"todo"` renommé `"pending"` (24 fichiers, 42 occurrences — faux positif du validateur anti-placeholder) ; `react/no-children-prop` dans `admin-module-chrome.test.tsx` ; test SQL `0156` aligné sur le durcissement MFA (claims `aal:"aal2"` pour les rôles plateforme) ; dérive de migration comblée — `20260916120000_admin_supervision_projection` vérifiée présente sur development et enregistrée dans `schema_migrations`.
- Écart assumé vs Definition of Done release : 5/68 exigences `VERIFIED`, 63 `IN_PROGRESS` (implémentation existante, preuves atomiques à compléter) — voir `docs/traceability/REQUIREMENTS_COVERAGE.md`. P01 reste ouverte (contrats atomiques exhaustifs).

## 2026-09-18 — Alignement cockpit SIP des espaces connectés

- Espace franchisé aligné sur le cockpit SIP (hero, KPI, actions groupées, flux d’activité) : nouvel accueil protégé `franchise/accueil` composé sur `loadFranchiseCrm` (prospects, relances, alertes, objectifs, scores) — aucune donnée inventée, aucun faux zéro (`lib/franchise-home/view-model`).
- Modules `franchise/digest`, `franchise/performance`, `franchise/relances` migrés de l’ancien chrome (`bg-muted/40`) vers `AdminModuleChrome` ; retour des quatre modules vers l’accueil de l’espace. La page publique `/franchise` (candidature) reste inchangée et publique.
- Hub de modules : route `franchise-home` enregistrée avec libellés FR/AR. Client, Sous-traitant et Administration étaient déjà alignés (aucun changement).
- Preuves : `lib/franchise-home/view-model.test.ts`, `franchise/accueil/messages.test.ts`, `franchise/cockpit-alignment.test.tsx` ; 48 tests verts, typecheck et ESLint ciblés propres.
- Validation runtime (2026-09-18) : persona démo `franchise` provisionné sur l’environnement development via `scripts/provision-demo-franchise-persona.mjs` (déterministe, idempotent, identifiants uniquement dans `.env.local`) — franchise ACTIVE « Franchisé · Démo Matricia » (bibliothèque COM, territoire SOUSS versionné), 3 prospects (1 relance en retard), 1 objectif actif, 1 snapshot + 2 alertes ouvertes (1 CRITICAL) adossés à une métrique démo `DEMO_CLIENT_NETWORK`.
- Accès démo étendu : quatrième persona « Franchisé » sur `/connexion` (`demo-access.tsx`, `demo-actions.ts`, destination `franchise/accueil`, FR/AR, tests mis à jour — 9 tests verts).
- Revue visuelle `tests/e2e/helpers/franchise-cockpit-review-run.mjs` : connexion réelle par le bouton démo puis 20 captures (5 modules × FR/AR × 360 px/desktop) dans `artifacts/test-results/franchise-cockpit/` — statut 200 partout, aucun débordement horizontal, aucune erreur navigateur ; KPI alimentés par les données réelles (1 relance en retard, 3 prospects, 2 alertes, 1 objectif) et RTL arabe conforme.
- Prochaine étape : étendre le smoke E2E sandbox (`authenticated-route-smoke.spec.ts`) à la route `franchise/accueil`.

## 2026-09-16 — Site public 10/10 (compose + polish)

- Inventaire `docs/PUBLIC_SITE_VALIDATION.md` (spec 1–14). Nav commune Entreprises/Professionnels/Comment ça marche/Offres/Franchise + CTA Analyser. Accueil : titre cible, 6 étapes, domaines catalogue → `/besoin?library=`, FAQ confiance.
- Page Entreprises, pages légales (`mentions-legales`, `confidentialite`, `conditions`), footer cohérent, franchise candidature conditionnelle, contact motifs adaptés, offres sans débit (`plan=` conservé).
- Handoff : brouillons locaux vs compte distingués ; proxy public étendu. Preuves : `page.test.tsx`, `public-navigation.test.tsx`, `entreprises/page.test.tsx`, `public-legal/documents.test.ts`.
- Re-score A–D ≥ 9/10. Gaps volontaires : branches prédiagnostic déclaratives ; conversion brouillon→RFQ Lot 3.

## 2026-09-16 — Tableau de bord Prestataire 10/10 (compose + polish)

- Inventaire `docs/PROVIDER_DASHBOARD_VALIDATION.md`. Accueil provider-shaped sur `tableau-de-bord` (rôles PROVIDER_*), stages nouveau/qualifié/bloqué avec blockers service≠suspension générale, KPI sans faux zéro (`lib/provider-home`), planning agrégé, shell `provider-shell` sur qualification/devis/facturation/planning.
- Hub : `provider-planning`. Preuves unitaires view-model. Re-score A–D ≥ 9/10. Gap volontaire : litiges UI provider non inventé.

## 2026-09-16 — Tableau de bord Client 10/10 (compose + polish)

- Même méthode que l’Admin : inventaire `docs/CLIENT_DASHBOARD_VALIDATION.md`, composition sans faux zéros (`lib/client-home`), accueil parcours Analyser→Payer, file situations, KPI cliquables, stages nouveau/actif/équipe, shell `client-shell`, hub `client/finances` (Matricia vs prestataires séparé).
- Preuves : `lib/client-home/view-model.test.ts`, hub route `client-finances`, nav courte FR/AR.
- Re-score A–D ≥ 9/10. Gap volontaire : pas d’invention d’encaissement prestataire côté Client.

## 2026-09-16 — Admin supervision 10/10 (compose + polish)

- Sprint 0–5 fermés : inventaire `docs/ADMIN_SUPERVISION_VALIDATION.md`, projection RPC `list_admin_supervision_projection` / `get_admin_organization_fiche`, UI pilotage enrichie, fiche entreprise, parcours RFQ→devis→missions→diagnostics, shell UX commun (`AdminProcessStrip`, `AdminModuleChrome`).
- Routes hub : `administration/parcours`, `administration/entreprises` (+ fiche `[organizationId]`).
- Preuves : unit `admin-supervision/repository.test.ts`, `admin-process-strip.test.tsx`, SQL `0156_admin_supervision_projection.test.sql`, smoke routes protégées étendues.
- Re-score A/B/C/D ≥ 9/10 (détail dans la matrice de validation). Aucun workflow fictif ajouté ; lecture Admin only via security definer.
- Prochaine étape : appliquer la migration `20260916120000` sur l’environnement de développement, puis smoke Admin démo runtime.

## 2026-09-14 — Refonte publique, aperçu local

- Direction visuelle reprise suite au rejet utilisateur : blanc/bleu électrique, photographie illustrative originale, titre client/talents/réussite partagée, cartes flottantes et mouvement désactivable. La direction sombre à anneaux a été remplacée.
- Accueil : studio interactif de trois projets illustratifs, liens vers les expertises complémentaires, parcours de confiance, entrées Client/Sous-traitant et Franchise.
- Catalogue public : projection des 200 services du CSV de référence (aucune question chargée), recherche multi-mots insensible aux accents, filtre bibliothèque, état vide, 200 fiches avec métadonnées et sitemap. Ce catalogue de référence statique ne remplace pas la publication organisationnelle.
- FR/AR et RTL pour l'interface ; les noms/descriptions de services issus du catalogue source restent en français, signalés et balisés lang=fr.
- Preuves : 4 E2E desktop/360 px FR/AR verts avec axe WCAG A/AA, studio, pause des animations, filtrage, fiches et recherche vide. ESLint ciblé vert. Captures dans artifacts/test-results/playwright/public-experience-*.
- Pas de changement base de données, ni déploiement de cette refonte. Validation visuelle utilisateur encore attendue ; aucune note de satisfaction ou validation globale V1 inférée.
- Visuel et prompt : docs/progress/public-experience-visual.md.

Dernière mise à jour : 2026-09-12 15:50 America/Toronto

Phase de contrôle active : **PHASE 01 — contrats atomiques en cours**

Travaux engagés : **PHASES 01, 03, 05 et 06 — en cours; PHASES 02 et 04 signées GREEN**

## État prouvé

- Gold Master V4 FINAL et `AGENTS.md` sont les autorités actives.
- PHASE 00 est GREEN au commit `32cfd89` après visa indépendant : inventaire, 63 agents, index des 76 exigences, plans, Marketing et context-pack ciblé sont conformes.
- Inventaire PHASE 00, ExecPlan P00–P19, index de contexte, architecture, threat model et carte d’ownership sont présents.
- Les 57 agents du corps principal et les 6 agents obligatoires Marketing possèdent 63 configurations TOML projet.
- Catalogue validé : 10 bibliothèques, 40 catégories, 80 sous-catégories, 200 services, 212 liaisons et 6 000 questions.
- Les sept registres bootstrap ont des références nominales cohérentes; P01 reste ouverte car ils ne couvrent pas encore atomiquement les 76 exigences.
- Traçabilité enregistrée pour MAT-FUNC-001..068 et MARKETING-001..008. Aucune exigence n’est déclarée `VERIFIED` sans preuve.
- Monorepo pnpm, Next.js App Router, worker et packages TypeScript strict sont opérationnels.
- PHASE 02 est GREEN au commit `d92d8f0` après réaudit indépendant : installation figée, frontières de modules, lint, typecheck, 74 tests, build, logger expurgé, Worker et Design A sont conformes sans finding P0/P1/P2.
- PHASE 04 est GREEN après visa indépendant : connexion OTP PKCE, invitations courriel, rôles cumulables, sessions, mot de passe facultatif, MFA TOTP et saga d'audit Auth sont implémentés en FR/AR RTL.
- `.env.local` est ignoré par Git; aucune valeur secrète n’est consignée.

## Supabase development/staging

Projet distant Matricia contrôlé en environnement applicatif `development`; la CLI Supabase est liée au projet vérifié. Après dry-run propre, les migrations `20260912013000`, `13100`, `13200`, `13300`, `13400`, `13600`, `13700`, `13900`, `14000`, `14100` et `14200` sont confirmées appliquées avec succès à distance. Les statuts déjà confirmés de `12800` et `12900` restent acquis; aucun statut supplémentaire n'est revendiqué ici.

1. extensions et référentiels versionnés;
2. identité, organisations, memberships et RBAC;
3. idempotence, audit et Event Outbox;
4. ledger financier immuable et équilibré;
5. ledger de crédits immuable;
6. rôles et règles économiques de référence;
7. support pgTAP de test;
8. RPC financières/crédits atomiques;
9. scellement sérialisé de la chaîne d’audit;
10. claim Outbox `SKIP LOCKED`, retry et dead-letter;
11. durcissement des invariants et privilèges;
12. hash canonique serveur pour l’idempotence;
13. restriction d’accès runtime au schéma d’extensions.
14. workflows identité P04 : profil, OTP limité, ICE, rattachement, invitations, sessions;
15. sonde readiness DB/Outbox à privilège minimal;
16. rechargement explicite du schéma API;
17. correction additive de la sonde sur le schéma Outbox immuable.
18. révocation complète des ACL runtime dangereuses, grants minimaux et readiness hors dead-letter.
19. demandes idempotentes de rôles cumulables, interdiction des rôles plateforme, approbation centrale des rôles `OWNER` transverses et refus de l'auto-approbation.
20. refus explicite et idempotent d'invitation, statut `DECLINED`, blocage de l'auto-invitation et du contournement des rôles `OWNER` transverses.
21. onboarding Client versionné, décision centrale et essai initial de 30 jours;
22. documents de conformité privés, questions/réponses, gates de soumission et transitions;
23. scan documentaire serveur, matrice versionnée, anomalies ciblées et RPC minimale du worker.
24. catalogue W1 : hiérarchie et versions immuables, releases gouvernées,
    audiences/fenêtres canoniques, attestation AR, worker à lease/retry/dead-letter,
    audit, Outbox et RLS restrictive.
25. persistance Question/Rule Engine : questionnaires/règles versionnés, snapshots,
    réponses validées, calculs décimaux exacts, idempotence, audit et Outbox;
26. API Client catalogue : lectures RPC authentifiées, snapshot de release exact,
    visibilité fail-closed et pagination keyset;
27. compatibilité additive des anciens writers de versions catalogue;
28. snapshots catalogue historiques explicites préservés avec FK intra-bibliothèque;
29. lifecycle catalogue durci par capabilities transactionnelles à usage unique,
    MFA fail-closed, items scellés et récupération rollback contrôlée.
30. import baseline transactionnel et idempotent, commandes de hiérarchie/services,
    compatibilités legacy fail-closed et contrat strict des questions publiables.
31. commandes Question Builder : création, nouvelle version de brouillon, duplication,
    archivage/restauration, scope GLOBAL central AAL2, audit et Event Outbox;
32. interface Question Builder réelle : création DRAFT bilingue FR/AR et RTL par
    service, sensibilité, exigences devis, identité idempotente persistée et retours accessibles;
33. commandes Rule Builder : création et nouvelle version DRAFT immuable,
    concurrence optimiste, hash canonique serveur, MFA sensible, audit et Event Outbox;
34. interface Rule Builder FR/AR RTL : prédicat booléen déterministe, action typée,
    priorité, sensibilité, confirmation et identité idempotente persistée;
35. création Questionnaire Builder : version DRAFT bilingue liée à une release
    éditable, première section immuable, idempotence, MFA sensible, audit et Outbox.
36. composition Questionnaire Builder : sections suivantes ordonnées, ajout de
    questions et règles approuvées/publiées, concurrence optimiste, snapshot
    canonique, MFA sensible, audit et Outbox.
37. gate de charge catalogue GET-only, borné et fail-closed avec scénarios 6k/50k
    et sortie de métriques nettoyée; harness local 6/6 vert, exécution distante à prouver.
38. RFQ et matching explicable : demandes versionnées, éligibilité, invitations,
    sélection idempotente, audit, Outbox et RLS restrictive;
39. devis et comparaison : révisions exactes, comparaison normalisée sans float,
    sélection d'une version précise, audit et isolation inter-tenant;
40. contrats et missions : snapshots contractuels, signatures, jalons, livrables,
    acceptation et transitions gouvernées;
41. qualification Sous-traitant : capacités, preuves, décisions versionnées et
    contrôle d'éligibilité;
42. facturation Sous-traitant : factures, événements payables, règlements et
    rapprochements adossés aux écritures immuables;
43. litiges et réaffectation : preuves, médiation, décision et transfert contrôlé;
44. achats groupés : pools, engagements, consommation et allocation fournisseur;
45. gouvernance et finance franchise : territoires, mandats, exception IT,
    allocations et distributions immuables;
46. abonnements : plans versionnés, cycles, essais et transitions idempotentes;
47. command center Administration : supervision, approbations et commandes
    opérationnelles à privilège minimal.
48. diagnostics/opportunités : résultats et scores exacts, snapshots, anomalies,
    recommandations, recomputation et transitions contrôlées vers RFQ;
49. Boxes/crédits : avantages versionnés, wallets sûrs, lots FIFO expirables,
    réservation/libération/consommation et suppression de l'auto-attribution;
50. notifications : templates FR/AR versionnés, préférences immédiat/digest,
    alertes critiques obligatoires, inbox, déduplication, retry et dead-letter.
51. Marketing Autopilot : consentements append-only, Brand Kit et contenus FR/AR
    versionnés, approbation humaine, orchestration Outbox, fréquence, attribution et KPI;
52. CRM/performance franchise : pipeline, activités immuables, objectifs et snapshots
    KPI versionnés, scores exacts et alertes explicables sans sanction automatique;
53. moteur fiscal Maroc : catégories FR/AR, règles datées/versionnées sans taux
    hardcodé, validation/approbation, calcul exact et raccord facturation compatible.
54. moteur Question/Rule avancé : AST AND/OR/NOT borné, quinze opérateurs,
    détection des cycles, actions typées, scoring exact et simulation reproductible.
55. durcissements indépendamment réaudités : AUTOPILOT et consentement owner-only,
    PII CRM isolées, ownership CRM intra-tenant, KPI bornés/uniques et réponses
    numériques canoniques évaluées de manière identique aux raccourcis.
56. sessions questionnaires : snapshot immuable, reprise, soumission reproductible,
    abandon/expiration, réponses privées et évaluation par le moteur avancé;
57. portefeuille Client : projets, tâches, budgets annuels exacts, centres de coûts,
    allocations tenant-bound et calendrier central;
58. Provider : feedback réellement anonymisé, réputation versionnée à six dimensions,
    badges sous décision humaine et favoris revalidés;
59. récompenses/parrainage/ROI : règles et plafonds versionnés, ledger crédits,
    double contrôle AAL2, preuves durables, baselines approuvées et calculs exacts.
60. IA assistée et qualité : analyses bornées et déterministes, revue humaine,
    qualité/similarité bilingue, provenance, minimisation PII et rétention contrôlée;
61. solutions et benchmark : bundles inter-bibliothèques versionnés selon les
    niveaux `ESSENTIAL`, `STANDARD` et `ADVANCED`, benchmarks anonymisés sous
    politique de confidentialité et registre de métriques faisant autorité;
62. RFQ récurrentes : clonage avec provenance immuable, plans mensuels,
    trimestriels ou annuels, snapshots publiés et génération bornée sans
    invitation ni dépense autonome;
63. digest franchise : synthèse FR/AR configurable sans PII, agrégats CRM/KPI,
    jobs idempotents avec lease, retry/dead-letter et notification versionnée;
64. durcissements P1/P2 issus de l'audit : budget de confidentialité benchmark
    scellé contre les oracles par différence, autorisations par rôle et ACL à
    privilège minimal, révocation fail-closed, verrous de concurrence partagés,
    entrées d'assistance minimisées et absence d'expiration artificielle pour une
    entrée vide.
65. durcissements finaux `11900`–`12400` : valeur benchmark liée exactement à
    sa preuve, sa version de registre et sa politique source; scope exact par
    franchise dans les organisations multi-franchises; purge automatique bornée
    des entrées d'assistance avec minimisation CIN/passeport; scope canonique
    d'idempotence du digest et corrélation d'audit non-PII stable au replay.
66. durcissements `12500`–`12600` : cycle autonome et borné de purge des entrées
    d'assistance, contrôle strict des leases, retry/dead-letter et minimisation PII;
    sélection du scheduler digest bornée avant composition, dernière configuration
    seulement, ordre déterministe et absence de famine entre lots.

Preuves actuelles :

- 123 migrations locales/distantes `20260910000100`..`20260912012600` appliquées sur development, avec `20260912012300` intentionnellement absente;
- lint SQL public/private sans erreur de schéma lors du dernier contrôle distant;
- `pnpm test:db` vert le 2026-09-12 pour les fichiers `0001`..`0092` : 92 fichiers, 2 397 assertions et quatre scénarios à deux connexions couvrant Outbox, journal, crédits et chaîne audit;
- tests négatifs RLS inter-tenant, immutabilité, équilibre/devise, crédits, idempotence, audit et Outbox.

Docker local reste indisponible sur cet hôte; la reconstruction propre doit être prouvée par le job CI Supabase avant signature P03.
Le workflow GitHub Actions contient bien un job de replay Supabase vierge, mais les
deux jobs du dernier run n'ont reçu aucun runner : GitHub les refuse actuellement
avec l'annotation `account is locked due to a billing issue`. Cette contrainte de
compte externe empêche la preuve CI tant qu'elle n'est pas levée; elle ne vaut pas
échec des migrations locales ou development.

## Gates exécutés les 2026-09-11 et 2026-09-12

- `pnpm verify:phase00` : vert — catalogue 10/200/6000, 7 registres bootstrap, 68 fonctions, 8 exigences Marketing conformes à l’addendum et 63 agents.
- `pnpm lint` : vert.
- `pnpm typecheck` : vert.
- Tests Web : vert — 76 fichiers, 313 tests.
- Tests Worker : vert — 11 fichiers, 54 tests; typecheck strict vert.
- `pnpm test:db` : vert pour `0001`..`0092` — 92 fichiers et 2 397 assertions, plus quatre scénarios génériques à deux connexions. Sessions, portefeuille Client, réputation Provider, rewards/referral/ROI, IA assistée/qualité, bundles/benchmarks, RFQ récurrentes et digest franchise sont appliqués, durcis et couverts sur Supabase development.
- E2E catalogue authentifié réel : 4/4 en FR/AR à 360 px, navigation clavier,
  axe, recherche discriminante et RPC de publication/lecture réelles; crash/reaper
  `SCHEDULED` et `PUBLISHING` prouvés, zéro résidu actif ou artefact local.
- E2E P05 authentifiés : 28/28 exactement, zéro skip/flaky/unexpected, FR/AR, 360 px et desktop; cleanup distant vérifié et preuve sanitizée persistée.
- E2E des nouvelles routes Marketing, CRM franchise et Fiscalité : 12/12
  scénarios anonymes réels, FR/AR, mobile 360 px et desktop, RTL/LTR, clavier,
  absence d’overflow et axe; les ALLOW/DENY authentifiés restent à prouver avec
  des fixtures dédiées Franchise Manager et administrateur fiscal AAL2.
- `pnpm build` : vert — routes identité, organisation, invitations, rôles, sécurité et santé compilées.
- `pnpm release:validate` : vert — uniquement gates structurels et absence de placeholders dans le périmètre contrôlé; ce n’est pas une signature de release.

## Audits et écarts

- Les réaudits P00/P01 ont identifié puis fait corriger les métriques d’inventaire, la force des validateurs, le signoff positif et le context-pack structuré. Le réaudit final indépendant au commit `32cfd89` est PASS; P00 est fermée GREEN.
- Le second réaudit P03 a détecté des droits `TRUNCATE` runtime hérités, un seed absent et la prise en compte des dead-letters en readiness. La migration additive 018, le test ACL et `supabase/seed.sql` corrigent ces écarts; seul le replay CI vierge et le nouveau visa restent requis.
- Les réaudits P02 ont imposé redaction PII, readiness réelle, Worker exécutable, TypeScript renforcé et palette navy/bleu vif. Ces écarts sont corrigés et le visa indépendant final au commit `d92d8f0` est PASS; P02 est fermée GREEN.
- Le réaudit indépendant du lot Marketing/CRM/Fiscalité/Rule Engine a fermé 7/7
  findings : trois P1 d’autorisation/isolation/évaluation canonique et quatre P2
  d’intégrité KPI, ownership CRM, accessibilité et localisation FR/AR.
- Le signoff sécurité indépendant du lot backend `09000`–`09900` est GREEN :
  confidentialité feedback/Outbox historique, preuves réputation, audience/wallet,
  double contrôle Referral, baseline durable, portefeuille et anti-oracles sont fermés,
  sans finding P0/P1/P2 ouvert.
- Le lot backend `10000`–`12600` intègre les durcissements P1/P2 d'audit sur
  la confidentialité des benchmarks, les autorisations de l'assistance et du digest,
  la minimisation PII, la concurrence des publications/générations et les ACL des
  helpers. Les compléments `11900`–`12400` lient la valeur à sa provenance
  benchmark, ferment le scope exact franchise et l'idempotence du digest, et
  automatisent la purge PII avec corrélation d'audit stable. Les tests
  `12500` et `12600` ajoutent l'exécution autonome de purge avec lease/retry et le
  bornage du scheduler digest avant composition. Les tests `0074`..`0092`
  couvrent ces correctifs dans le gate DB vert.
- P01 ne couvre pas encore les contrats atomiques de toutes les phases.
- P04 est GREEN : OTP, organisations, invitations courriel, rôles, sessions, mot de passe facultatif, MFA TOTP, AAL2 et saga d'audit Auth durable ont passé le visa indépendant sans P0/P1/P2.
- P05 dispose des migrations appliquées `024`, `026` et `029`–`03550` : profils, documents privés, questionnaires, matrice/anomalies, scan serveur, activation et essai 30 jours. Interfaces, Worker, concurrence et E2E authentifiés sont prouvés. ClamAV staging réel et replay vierge restent requis; P05 demeure `IN_PROGRESS`.
- P06 est en cours : catalogue W1, persistance Question/Rule W2, API Client,
  lifecycle immuable et E2E authentifié sont appliqués/verts. Le baseline development
  est importé et vérifié : 10 bibliothèques, 40 catégories, 80 sous-catégories,
  200 services, 212 liens, 220 questionnaires et 6 000 questions; releases et
  traductions restent volontairement `DRAFT/PENDING`. La suite globale atteint
  41 fichiers/981 assertions et les concurrences hiérarchie/services sont vertes.
  Les commandes serveur du Question Builder sont appliquées et testées; l’interface
  de création de questions DRAFT est livrée en FR/AR RTL avec contrat strict. La
  création et le versionnage DRAFT des règles sont appliqués avec hash canonique,
  MFA sensible, audit et Outbox. L’interface Rule Builder booléenne est branchée
  sur la commande réelle. La création de questionnaires, les sections suivantes
  et l’ajout gouverné de questions/règles aux snapshots sont appliqués et testés.
  Le gate de charge 6k/50k est implémenté et testé localement, mais sa preuve
  distante reste requise. Les opérateurs avancés, la validation/simulation, les
  sessions et les fondations IA assistée de qualité/similarité sont appliqués et
  couverts en base; leur intégration complète aux parcours et le visa indépendant
  restent requis avant GREEN.
- Les fondations et interfaces P07–P18 progressent en lots indépendants : RFQ/devis,
  contrats/missions Client et Sous-traitant, qualification/facturation Provider,
  litiges/réaffectation, achats groupés, franchise, abonnements, administration,
  diagnostics/opportunités, Boxes/crédits, Notifications, Marketing Autopilot,
  CRM/performance franchise et moteur fiscal Maroc sont branchés côté données et
  disposent maintenant de routes Web FR/AR pour les trois derniers domaines. Les
  fondations de bundles `ESSENTIAL`/`STANDARD`/`ADVANCED`, benchmark anonymisé,
  clonage/récurrence RFQ et digest franchise sont également appliquées et testées.
  Les E2E multi-rôles,
  audits indépendants et la traçabilité atomique restent requis avant GREEN.
- La couverture MAT-FUNC-001..068 et MARKETING-001..008 reste partielle : les
  fondations de plusieurs domaines sont présentes, mais la traçabilité atomique,
  les parcours E2E et les audits indépendants restent requis avant de déclarer
  chaque exigence `VERIFIED`.
- Le registre atomique strict compte actuellement 1 exigence `PROVEN`, 67
  `PARTIAL`, 0 `MISSING` et 0 `BLOCKED`; il contient exactement 68 IDs uniques.
- Vercel et Railway ne sont pas configurés. Aucune production n’a été modifiée ou autorisée.

## Prochaine exécution

1. Intégrer et valider les interfaces Client RFQ/devis, qualification et facturation Sous-traitant, contrats/missions, litiges et command center.
2. Intégrer aux parcours P06/P07/P10 l'IA assistée, les opérateurs avancés, la
   validation/simulation, les sessions, les bundles/benchmarks, la récurrence RFQ
   et le digest franchise; prouver les E2E associés et la charge distante 6k/50k.
3. Compléter la traçabilité atomique P01 et les parcours E2E/RLS des fondations P07–P17.
4. Obtenir un replay DB vierge CI et prouver ClamAV réel en staging.
5. Continuer P07..P19 selon `PLANS.md`, sans sauter de gate.

## Checkpoint UI 2026-09-12

- Assistance diagnostique bornee, decisions de solutions, benchmarks anonymises,
  RFQ recurrentes et digest franchise disposent maintenant de routes Web FR/AR,
  RTL, responsive 360 px et d''actions branchees sur les RPC finales.
- Les decisions humaines restent obligatoires; aucune invitation, depense ou action
  metier critique autonome n''est declenchee par ces interfaces.
- Les montants de solutions restent en unites mineures exactes et sont affiches avec
  `BigInt`, sans conversion flottante.
- Gate Web apres integration : lint vert, TypeScript strict vert, build Next.js vert,
  94 fichiers de tests et 365 tests verts.
- Restent requis avant GREEN : E2E authentifie multi-role FR/AR a 360 px, audit
  independant, charge distante 6k/50k et preuves SQL/RLS contractuelles associees.

## Checkpoint local intégré 2026-09-12

- Le lot fonctionnel Web V1 raccorde désormais les parcours RFQ/devis et comparaison,
  contrats/missions et réceptions, qualification/facturation/réputation Sous-traitant,
  litiges/réaffectation, achats groupés Client/Admin, abonnements et paiement de
  démonstration, diagnostics/opportunités et assistance, portefeuille et crédits,
  récompenses/parrainage/ROI, notifications, ainsi que gouvernance et finance
  franchise. La navigation partagée n'expose que les routes fonctionnelles selon
  l'espace et le rôle, avec libellés FR/AR et direction RTL.
- Les décisions sensibles restent humaines et autorisées côté serveur : versions,
  signatures, avenants, jalons, preuves, réception et acceptation sont conservés
  dans les snapshots contractuels; les écritures financières et de crédits passent
  par les RPC/ledgers immuables, avec montants exacts en unités mineures.
- La règle franchise IT est exposée sans droit d'entrée et avec distribution 50 %
  Hatim Ahmitech / 50 % Jalil-NEOXA / 0 % Mme Asma-Matricia. Les autres franchises
  utilisent la règle versionnée 50 % / 25 % / 25 % sur base distribuable.
- Les migrations `20260912012700` à `20260912013400` sont présentes localement :
  autorisation RPC Question/Rule, portée des références documentaires, lecture des
  récurrences, éligibilité Provider à la réaffectation, activation de paiement,
  consommation des avantages après livraison, agrégats Admin des achats groupés et
  alignement des rôles RPC d'assistance. Seules `12800` et `12900` sont confirmées
  appliquées à distance. `13000`–`13400` sont désormais également confirmées
  appliquées sur Supabase Matricia development après dry-run propre et liaison CLI
  vérifiée; aucun déploiement de production n'a été tenté. Le statut distant de
  `12700` n'est pas revendiqué dans ce checkpoint.
- Le paiement de démonstration dispose d'intentions et d'un webhook idempotent; le
  secret local reste exclusivement dans `.env.local`, ignoré par Git. L'assistance
  minimise les PII avant RPC et conserve provenance, version et revue humaine.
- Les tests globaux, SQL/RLS et E2E sont volontairement différés à la fin du cycle
  de développement demandé. Le présent checkpoint ne déclare donc aucun nouveau
  module GREEN ni aucune exigence supplémentaire `VERIFIED`; les résultats de tests
  antérieurs consignés ci-dessus restent historiques et ne valent pas visa de ce lot.
- Prochaine action : confirmer séparément le statut distant de `12700`, puis exécuter
  les gates globaux, E2E multi-rôles FR/AR/RTL et audits indépendants.

## Checkpoint local d'intégration 2026-09-12

- Le module Catalogue/Publications expose l'historique des releases versionnées et
  le rollback gouverné, avec contrôle AAL2 pour l'action sensible, audit serveur,
  libellés FR/AR et RTL. La navigation partagée publie son lien uniquement pour les
  rôles plateforme `SUPER_ADMIN`, `MATRICIA_ADMIN` et `LIBRARY_MANAGER`, alignés sur
  l'autorisation du dépôt serveur.
- Le module CRM/Performance Franchise expose les activités et événements de pipeline
  immuables ainsi que les snapshots KPI versionnés. Les montants et valeurs `bigint`
  ou `numeric` restent des chaînes exactes; les objectifs et alertes demeurent en
  lecture seule tant qu'aucune RPC de mutation autorisée n'existe.
- Contrôle d'intégration Web : `pnpm --filter @matricia/web typecheck` vert et
  `pnpm --filter @matricia/web lint` vert. L'horodatage des expirations de crédits est
  isolé dans un module `server-only` pour préserver la pureté du rendu React.
- Aucun test global, SQL/RLS ou E2E n'a été lancé dans ce checkpoint, conformément au
  différé de fin de développement. Aucun changement de production ou secret n'est inclus.

## Checkpoint local Public et SEO 2026-09-12

- Les routes publiques FR/AR réelles couvrent désormais l'accueil, Services,
  Franchise, À propos et Contact sous un layout commun. Header, footer, navigation
  clavier, reflow 360 px, direction RTL et bascule de langue sont partagés; Contact
  propose uniquement des CTA fonctionnels vers Services et Connexion, sans faux
  formulaire ni collecte publique de données personnelles.
- Le proxy évite le refresh Supabase uniquement pour les chemins publics allowlistés.
  Connexion conserve le contrôle de session; Catalogue authentifié, Client,
  Sous-traitant, Franchise métier, Administration, Notifications, Organisation et
  Sécurité restent fail-closed. Le chemin public `/franchise` n'ouvre aucune de ses
  sous-routes métier.
- Aucune RPC catalogue exécutable par `anon` n'existe : la vitrine utilise donc une
  projection statique bornée au manifeste vérifié `1.0.0`, soit 10 bibliothèques et
  200 services. Les 6 000 questions et tous les brouillons restent exclus.
- Chaque route publique possède ses métadonnées FR/AR, canonical, hreflang, Open
  Graph et Twitter. `robots.txt` utilise une allowlist publique et interdit les
  espaces privés/auth; le sitemap contient exactement 10 URL localisées. Connexion
  est `noindex`; le manifeste et la carte sociale sont présents.
- Le même lot finalise l'évolution versionnée des diagnostics et l'historique des
  allocations de facturation Sous-traitant. Les montants et reliquats restent des
  chaînes entières exactes, sans conversion flottante ni mutation de ledger.
- Gates d'intégration : `pnpm --filter @matricia/web typecheck` vert,
  `pnpm --filter @matricia/web lint` vert et `git diff --check` vert. Aucun E2E n'a
  été lancé; la revue visuelle réelle à 360 px et la validation crawler de la carte
  sociale restent à effectuer en fin de développement.

## Checkpoint local Administration V1 2026-09-12

- La navigation partagée expose désormais, uniquement selon les rôles plateforme
  autorisés par chaque dépôt serveur, les consoles Clients/Conformité,
  Sous-traitants/Facturation, Finance, Gouvernance Franchise/Litiges et
  Notifications/Audit/Outbox.
- Admin Clients applique la séparation quatre-yeux aux décisions de conformité,
  revues documentaires et acceptations de réponses. Le réaudit statique des
  migrations additives locales `20260912013700` et `20260912013900` est PASS : la
  projection est minimisée, AAL2 est vérifié côté PostgreSQL et Server Actions, et
  les preuves quatre-yeux sont durables et fail-closed. Ces migrations ne sont ni
  désormais confirmées appliquées sur Supabase Matricia development après dry-run
  propre. Le présent checkpoint ne remplace pas les tests SQL/RLS de fin de cycle.
- Admin Finance conserve les montants en unités mineures exactes et les
  rapprochements idempotents. Admin Providers conserve les preuves, décisions
  versionnées et écritures financières via les RPC métier. Gouvernance expose les
  territoires, mandats, distributions et réaffectations, dont la règle IT exacte.
- Admin Operations expose en lecture seule un journal d'audit expurgé aux seuls
  rôles `SUPER_ADMIN`, `MATRICIA_ADMIN` et `READ_ONLY_AUDITOR`. Aucun payload,
  metadata, IP, user-agent ou identifiant utilisateur/organisation n'est chargé.
  Aucun retry, replay ou traitement de dead-letter n'est proposé.
- La migration 138 de projection agrégée Outbox/livraisons a été refusée par le
  contrôle de sécurité faute d'une autorisation utilisateur explicite pour
  l'élargissement `SECURITY DEFINER`; elle n'a pas été créée ni appliquée. Ces
  données restent fail-closed dans l'interface et aucune RLS n'a été assouplie.
- Les tests globaux, SQL/RLS et E2E restent volontairement différés à la fin du
  développement. Aucun changement de production, liaison distante ou secret ne
  fait partie de ce checkpoint.

## Checkpoint local Messagerie, Relances et Analytique 2026-09-12

- La messagerie interne sécurisée, les relances Franchise et l'analytique agrégée
  d'abandon des questionnaires disposent de routes FR/AR raccordées à la navigation
  selon les memberships et rôles strictement autorisés par leurs repositories/RLS.
- Les migrations `20260912014000`, `20260912014100` et `20260912014200` sont
  confirmées appliquées sur Supabase Matricia development, CLI liée, après dry-run
  propre. Les migrations `13600`, `13700` et `13900` sont également confirmées
  appliquées dans le même environnement.
- Les relances conservent consentement, heures calmes, plafonds versionnés,
  séparation de l'approbateur et traitement Worker. L'analytique reste agrégée et
  soumise au seuil de confidentialité; la messagerie demeure limitée aux
  participants autorisés des objets métier.
- Aucun test E2E ou global supplémentaire n'est exécuté dans ce lot et aucune
  production n'est modifiée.

## Checkpoint Paiements CMI/PayPal 2026-09-12

- Les migrations `20260912014300`, `20260912014400` et `20260912014500` sont
  confirmées appliquées sur Supabase Matricia development. Elles couvrent les
  intentions et webhooks CMI/PayPal, le journal financier équilibré, la correction
  d'ambiguïté du numéro de cycle et l'ACL de lecture minimale du `service_role`.
- Le test SQL/RLS `0097_real_payment_gateways.test.sql` est PASS avec 20 assertions.
  Le harness PostgreSQL confirme également les 4 scénarios de concurrence : Outbox,
  journal financier idempotent, crédits idempotents et chaîne d'audit concurrente.
- Les parcours CMI et PayPal sont raccordés à l'interface réelle. CMI utilise une
  confirmation POST signée; PayPal enchaîne approbation, capture serveur idempotente
  puis activation exclusivement après webhook `PAYMENT.CAPTURE.COMPLETED` vérifié.
  Aucun secret n'est exposé au navigateur ou aux logs.
- La migration `20260912013800_admin_operations_projection.sql` est désormais
  préparée localement pour réaudit, mais n'est pas appliquée sur l'environnement
  development ni sur aucun environnement distant.
- Aucun environnement, secret ou donnée de production n'a été lu ou modifié dans
  ce checkpoint.

## Checkpoint de clôture technique V1 — 2026-09-12

- Supabase development est synchronisé jusqu'à la migration additive `20260912015500`;
  le dry-run final retourne `upToDate=true`. Les migrations 153 à 155 refusent les
  rôles plateforme révoqués, imposent AAL2 pour la projection Operations et calculent
  l'éligibilité RFQ depuis les preuves Provider versionnées, temporelles et propres au
  service. Aucun environnement de production n'a été modifié.
- Gate PostgreSQL/RLS globale : 100 fichiers, 2 507 assertions et 4 scénarios de
  concurrence PASS. Le réaudit sécurité indépendant final ne relève aucun P0/P1/P2.
- Gates monorepo : lint PASS, TypeScript strict PASS, tests unitaires/intégration PASS
  (Web 115 fichiers/436 tests; Worker 11 fichiers/54 tests), build Next.js/Worker PASS,
  `release:validate` structurel PASS et aucun marqueur incomplet détecté.
- E2E additionnels V1 : 20/20 PASS, zéro skip, avec fixtures development neutralisées;
  FR/AR, RTL/LTR, 360 px et desktop, axe WCAG A/AA, clavier/focus, reflow, refus anon et
  séparation Client/Sous-traitant/Franchisé. Les crashes Litiges et Notifications
  découverts pendant ces E2E ont été corrigés sans élargir les droits RLS.
- Command Center localise désormais les codes métier en FR/AR, priorise la file du jour
  et conserve la revue humaine. Diagnostics raccorde Assistance et Évolution sans copie
  métier hardcodée. Le module de paiement se construit sous Turbopack avec ses imports
  TypeScript résolus depuis les sources.
- Limites de déclaration : les gates techniques de ce checkpoint sont vertes, mais la
  matrice atomique reste honnêtement à 1 `PROVEN` et 67 `PARTIAL`; le registre formel
  `REQUIREMENTS_COVERAGE.md` reste à 0/76 `VERIFIED` et P01 demeure ouverte jusqu'aux
  contrats atomiques, preuves et visas indépendants exhaustifs. Ce checkpoint ne
  revendique donc pas une V1 Gold Master terminée à 100 %.
- Risques externes restant à fermer avant release staging signée : replay vierge CI
  actuellement empêché par le runner GitHub/facturation, ClamAV réel en staging, audit
  manuel lecteur d'écran, déclencheur périodique service-role du scheduler et preuves
  atomiques/signoffs des exigences restantes. Aucun déploiement production n'est autorisé.

## Checkpoint d'intégration final — 2026-09-12

- Portfolio Client : commit `b91de14`, 468/468 tests Web et P22 4/4. Actions
  universelles : 7/7. Questionnaires/Diagnostics : 4/4.
- Provider Quotes : 21 tests PASS; devise persistée, sélection multi-organisation
  explicite et fiscalité autoritative. La migration additive
  `20260912015600_quote_tax_authority_hardening.sql` est appliquée uniquement sur
  Supabase development. Le visa indépendant de la migration 156 est PASS sans
  finding P0/P1/P2; l'autorité runtime est prouvée par 19/19 assertions incluant
  les appels directs au RPC public sous rôle authentifié.
- Gate DB globale : 101 fichiers, 2 526 assertions et 4 scénarios de concurrence
  PASS. E2E critiques : 20/20 PASS; le runner isole, protège et nettoie ses états
  authentifiés.
- Typecheck et lint Web PASS. Le dry-run Supabase final retourne
  `upToDate=true`. Le lint DB global ne remonte pour la migration 156 aucune
  nouvelle anomalie; ses alertes restantes sont des dettes historiques hors 156.
- Aucun environnement de production n'a été modifié. La couverture atomique reste
  honnêtement à 1 `PROVEN` et 67 `PARTIAL`; ce checkpoint ne revendique pas une
  V1 terminée à 100 %.

## Checkpoint final de vérification V1 — 2026-09-13

- Les lots consolidés correspondent aux commits `b9d8e69`, `7ba354b`, `59e7491`
  et `d6c6cd5`. Les Actions universelles sont PASS sur 8/8 parcours E2E et le lot
  Provider Quotes P23 est PASS sur 4/4 parcours FR/AR, 360 px et desktop.
- La migration additive
  `20260912015700_provider_quote_exact_amount_projection.sql` projette les montants
  `bigint` en `TEXT` sans conversion flottante. Elle est appliquée uniquement sur
  Supabase development; le dry-run lié final retourne `upToDate=true` sans migration,
  seed ni rôle en attente. Le test DB `0102` est PASS sur 9/9 assertions et les 4
  scénarios de concurrence sont PASS.
- Gate global consolidé : Web 126 fichiers/480 tests PASS; Worker 11 fichiers/54
  tests PASS; lint, TypeScript strict, build, `release:validate`,
  `traceability:validate`, `spec:validate` et `git diff --check` PASS.
- Le P1 qui masquait la soumission d'un devis `DRAFT`/`REVISED` lorsque sa règle
  fiscale historique n'était plus active est fermé et audité sans finding P0/P1/P2.
  La création d'une nouvelle révision reste fail-closed sans règle fiscale active.
- La couverture formelle reste honnêtement à 1/76 exigences `VERIFIED` et 1/68
  fonctions MAT prouvées. Ce checkpoint confirme les gates exécutés, mais ne
  revendique pas une V1 Gold Master terminée à 100 %.
- Aucun environnement, secret ou donnée de production n'a été lu ou modifié; aucun
  déploiement production n'est autorisé par ce checkpoint.

## Checkpoint V4.1 incremental upgrade - 2026-09-13

- Baseline V4 preserved on branch `upgrade/v4.1`; implementation used only additive
  migrations 16300 through 17000 plus corrective 16901. Supabase development is
  synchronized and the final linked dry-run returns `upToDate=true`.
- P0: cash flows A/B/C, electronic signature, privacy/CNDP, procurement/AP, AI FinOps,
  actual Box margins, bank-account antifraud and Matricia own payments are implemented.
- P1: treasury, suppliers, third parties, contract lifecycle, probative communications,
  dispute governance, security/resilience, restore evidence, jobs/DLQ, organization exit,
  catalogue findings, franchise controls, marketing safety and Admin V4.1 are implemented.
- Gates: DB/RLS 116 files and 2915 assertions PASS; 4 concurrency scenarios PASS;
  Web 128 files/489 tests PASS; Worker 11 files/54 tests PASS; 20/20 V4.1 E2E PASS;
  lint, strict TypeScript, build and structural validators PASS.
- Next.js is 16.3.3; the final production dependency audit reports no known
  vulnerabilities. `.env.local` remains ignored and untracked.
- Technical development/staging status is GREEN. Catalogue human review, CNDP/legal
  formalities, real provider certification, production restore/security drills and
  production authorization remain `REQUIRED_NOT_COMPLETED`. No production change occurred.

## Checkpoint V4.1 admin-managed external validation - 2026-09-13

- Migration additive `20260913017100_v41_admin_external_validations.sql` appliquée sur
  Supabase development/staging; dry-run final `upToDate=true`.
- Le tableau de bord Admin V4.1 permet désormais la saisie et la validation des neuf
  familles de preuves externes : CNDP, signature, trois revues catalogue, restauration,
  test d'intrusion et autorisation Production.
- Commandes AAL2 idempotentes, validation à quatre yeux, concurrence optimiste,
  RLS restrictive, preuves/décisions immuables, audit et Event Outbox sont actifs.
- Gates : DB/RLS 117 fichiers et 2931 assertions PASS; 4 scénarios de concurrence
  PASS; Web 128 fichiers/490 tests PASS; lint, TypeScript strict et build PASS;
  E2E V4.1 21 scénarios sur desktop et 360 px, soit 42/42 PASS.
- Les preuves restent non approuvées tant qu'elles ne sont pas réellement saisies et
  validées par deux administrateurs distincts. Aucun déploiement Production n'a eu lieu.

## Checkpoint MAT-FUNC-026 — activation complète des avenants — 2026-09-13

- Migrations additives `20260913017200` et corrective de compatibilité `17201`
  appliquées uniquement sur Supabase development/staging; dry-run final
  `upToDate=true`.
- Un avenant passe désormais de DRAFT à PENDING_SIGNATURE, exige les signatures AAL2
  distinctes Client et Sous-traitant, puis crée une nouvelle version contractuelle
  immutable. Parties, clauses et items sont snapshotés; les deltas ADD/REPLACE/REMOVE
  sont appliqués sans modifier l'historique; la mission active est rattachée à la
  nouvelle version.
- Interfaces FR/AR et responsive ajoutées aux espaces Client et Sous-traitant.
  Mutations idempotentes, RLS restrictive, concurrence, audit et Event Outbox actifs.
- Gates : DB/RLS 118 fichiers, 2946 assertions et 4 scénarios de concurrence PASS;
  lint, TypeScript strict, build et absence de placeholders PASS.
- Aucun environnement de production n'a été modifié. Prochain lot : coffre documentaire
  transversal et réutilisation contrôlée conformité/RFQ/contrat/mission.

## Checkpoint MAT-FUNC-012/021/025 — coffre documentaire transversal — 2026-09-13

- Migration additive `20260913017300_secure_client_document_reuse.sql` appliquée
  uniquement sur Supabase development/staging; dry-run final `upToDate=true`.
- Les documents Client vérifiés, scannés CLEAN et non expirés peuvent être liés
  sans copie binaire à une demande, une version contractuelle ou une mission de la
  même organisation. Les liaisons et révocations sont immuables, AAL2,
  idempotentes, auditées et publiées via Event Outbox.
- L'interface Client FR/AR `/client/documents` permet de créer et révoquer les
  liaisons; elle est responsive, accessible au clavier et exposée uniquement aux
  rôles Client Owner/Admin.
- Gates : DB/RLS 119 fichiers, 2 961 assertions et 4 scénarios de concurrence PASS;
  lint, TypeScript strict, build et synchronisation Supabase PASS.
- Aucun environnement de production n'a été modifié. Prochain lot : audit ciblé
  puis fermeture des écarts UI encore réels dans CRM, récompenses, IA et règles.

## Checkpoint Admin incitations — récompenses, badges et parrainage — 2026-09-13

- Migration additive `20260913017400_admin_badge_policy_versions.sql` appliquée
  uniquement sur Supabase development/staging. Les politiques de badges sont
  désormais créées en versions immuables avec AAL2, idempotence, audit et Outbox.
- La route FR/AR `/administration/incitations` administre les versions de règles
  de récompense/parrainage, les politiques de badges, les évaluations sur snapshots
  de réputation et les décisions humaines publication/révocation.
- Les crédits restent attribués exclusivement par le moteur et le ledger immuable;
  l'interface ne modifie aucun solde directement.
- Gates : DB/RLS 120 fichiers, 2 968 assertions et 4 scénarios de concurrence PASS;
  lint, TypeScript strict et build PASS. Aucun environnement de production modifié.

## Checkpoint clonage gouverné avec provenance — 2026-09-13

- Migration additive `20260913017500_content_clone_provenance.sql` appliquée
  uniquement sur Supabase development/staging; historique synchronisé.
- L'administration peut cloner questionnaires, ensembles de clauses et checklists
  de service sans altérer les sources. Chaque clone conserve une provenance immutable,
  crée une nouvelle identité/version brouillon et émet audit plus Event Outbox.
- L'interface FR/AR `/administration/clonage` expose les trois opérations avec motif,
  idempotence, autorisation restrictive et validation des identifiants.
- Gates : DB/RLS 121 fichiers, 2 979 assertions et 4 scénarios de concurrence PASS;
  lint, TypeScript strict et build PASS. Aucun environnement de production modifié.

## Checkpoint autosauvegarde questionnaire résiliente — 2026-09-13

- L'autosauvegarde Client conserve le délai de 800 ms, renouvelle les identités de
  commande et synchronise désormais les versions optimistes renvoyées par le serveur.
- Une saisie effectuée hors ligne reste dans l'onglet, passe en file d'attente et est
  renvoyée automatiquement au retour du réseau; un conflit propose explicitement de
  recharger la version serveur sans écrasement silencieux.
- Messages FR/AR, états accessibles et commandes tactiles 44 px minimum sont fournis.
- Gates : Web 128 fichiers/491 tests PASS; lint, TypeScript strict et build PASS.

## Checkpoint centres de coûts transversaux — 2026-09-13

- Migration additive `20260913017600_typed_cost_center_financial_links.sql`
  appliquée uniquement sur Supabase development/staging.
- Les allocations relient désormais un centre de coûts aux projets, tâches, contrats,
  missions, jalons, factures Provider côté Client, documents et RFQ. Chaque référence
  est validée dans le tenant; une facture ne peut pas être surallouée.
- L'interface Portefeuille FR/AR expose le type et l'identifiant de la source; les
  montants restent en unités mineures côté serveur, avec idempotence, audit et Outbox.
- Gates : DB/RLS 122 fichiers, 2 989 assertions et 4 scénarios de concurrence PASS;
  lint, TypeScript strict et build PASS. Aucun environnement de production modifié.

## Checkpoint moteur transversal anti-abus — 2026-09-13

- Migration additive `20260913017700_transversal_abuse_detection.sql` appliquée
  uniquement sur Supabase development/staging.
- Les règles anti-abus sont versionnées par type d'événement; les signaux ne conservent
  que des empreintes et un contexte expurgé. Le moteur applique fenêtre, vélocité et
  seuils ALLOW/REVIEW/BLOCK puis ouvre une file de revue humaine.
- L'interface FR/AR `/administration/anti-abus` permet de créer les versions et de
  statuer avec AAL2, preuve, RLS restrictive, historique immutable, audit et Outbox.
- Le Command Center existant couvre déjà les approbations multi-objets transversales
  avec ressource typée, double contrôle et nombre d'approbations configurable.
- Gates : DB/RLS 123 fichiers, 3 001 assertions et 4 scénarios de concurrence PASS;
  lint, TypeScript strict et build PASS. Aucun environnement de production modifié.

## Checkpoint préremplissage transversal et fraîcheur — 2026-09-13

- Migration additive `20260913017800_versioned_prefill_freshness.sql` appliquée
  uniquement sur Supabase development/staging.
- Cinq politiques de fraîcheur versionnées couvrent profil, organisation, site,
  réponse antérieure et document. Les faits sont versionnés et immutables.
- Les questionnaires proposent désormais les valeurs fraîches compatibles par
  `data_key`, tenant, acteur et sensibilité; toute suggestion doit être confirmée
  avant d'être persistée ou comptée comme réponse.
- Gates ciblés : 10 assertions SQL/RLS PASS; Web 128 fichiers/491 tests PASS;
  lint, TypeScript strict et build PASS. Aucun environnement de production modifié.

## Checkpoint livrables scannés et Marketing Autopilot exécutable — 2026-09-13

- Les migrations additives `20260913017900_delivery_proof_trusted_scan.sql` et
  `20260913018000_marketing_publication_worker.sql` sont appliquées uniquement
  sur Supabase development/staging.
- Les preuves de livrable conservent désormais leur empreinte SHA-256 réelle,
  reçoivent un verdict immuable d'un scanner `service_role`, et aucun livrable
  ne peut être accepté ou rejeté tant que les preuves de sa version courante ne
  sont pas toutes `CLEAN`. L'UI Client expose ce blocage en FR/AR.
- Le Marketing Autopilot dispose d'un worker protégé par `CRON_SECRET`, d'un
  mode sandbox sans réseau et d'adaptateurs réels LinkedIn et Meta
  Facebook/Instagram/Reels. Les credentials ne transitent que par une référence
  `env://`; consentement, autorisation de marque, kill-switch et contenu sont
  revérifiés au claim puis avant journalisation. Retry borné, idempotence, audit
  et Event Outbox sont actifs.
- Gates : DB/RLS 126 fichiers, 3 030 assertions et 4 scénarios de concurrence
  PASS; monorepo 129 fichiers Web/495 tests, 11 fichiers Worker/54 tests et
  packages partagés PASS; lint, TypeScript strict et builds PASS; aucun
  placeholder applicatif; catalogue 10 bibliothèques/200 services/6 000
  questions valide.
- E2E authentifiés development : V1 critique 20 PASS, questionnaires/diagnostics
  4 PASS, portefeuille 4 PASS, Action Center 8 PASS, devis Provider 4 PASS,
  catalogue 5 PASS avec 1 scénario explicitement ignoré par le runner. Tous les
  jeux de données temporaires ont été neutralisés.
- Aucun environnement de production n'a été modifié. Les activations live des
  providers sociaux restent désactivées jusqu'à configuration des credentials
  acquis et autorisation opérationnelle explicite.

## Checkpoint calendrier Marketing et intégrité sandbox — 2026-09-13

- Les migrations additives `20260913018100_marketing_calendar_scheduler.sql` et
  `20260913018200_marketing_scheduling_sandbox_integrity.sql` sont appliquées
  uniquement sur Supabase development; le dry-run final confirme la cible à jour.
- Le calendrier M+1 est généré de façon idempotente le 25 pour les règles actives.
  En mode AUTOPILOT, seuls les contenus approuvés, non expirés, consentis et sans
  exception bloquante sont planifiés; ASSISTED reste soumis à validation humaine.
- La planification manuelle rattache chaque publication au calendrier versionné
  obligatoire et sérialise la limite hebdomadaire. Le mode sandbox produit
  `SANDBOXED` et ne crée plus aucune preuve de publication réelle.
- Les endpoints cron protégés par `CRON_SECRET` acceptent GET/POST; la
  configuration Vercel programme le calendrier mensuel et le worker de publication.
- Gates : DB/RLS 128 fichiers, 3 051 assertions et 4 scénarios de concurrence PASS;
  Web 130 fichiers/502 tests PASS; lint, TypeScript strict et build PASS.
  Aucun environnement de production n'a été modifié.

## Checkpoint gouvernance Marketing et reprise worker — 2026-09-13

- Les migrations additives `20260913018300_marketing_schedule_rule_commands.sql`
  et `20260913018400_marketing_worker_lease_policy_hardening.sql` sont appliquées
  uniquement sur Supabase development; replay local complet 001–184 PASS.
- Les règles de calendrier sont versionnées, validées par timezone IANA et créneaux
  stricts, activées par verrou optimiste et protégées par idempotence, audit et Outbox.
  L'approbation globale ASSISTED est réservée au rôle `CLIENT_OWNER`.
- Le worker récupère les claims expirés avec une lease de cinq minutes. Les blocages
  de politique créent une exception dédupliquée, un audit et un événement Outbox.
  Les dix familles de conformité sont obligatoires et les scopes sociaux sont bornés
  au provider et au canal avant toute publication.
- L'interface Marketing FR/AR RTL expose comptes sociaux, versions de règles,
  calendrier, publications et exceptions, avec création, activation et approbation
  globale branchées aux commandes serveur.
- Gates : DB/RLS 130 fichiers, 3 079 assertions et 4 scénarios de concurrence PASS;
  Web 130 fichiers/507 tests PASS; lint, TypeScript strict et build PASS.
  Aucun environnement de production n'a été modifié.

## Checkpoint intégrité at-most-once Marketing — 2026-09-13

- Migration additive `20260913018500_marketing_publication_attempt_integrity.sql`
  appliquée uniquement sur Supabase development; le dry-run final confirme la cible
  distante à jour.
- Chaque claim est lié à une lease et à une clé fournisseur SHA-256 unique par
  tentative. Les attempts sont immuables; les anciens RPC sans lease échouent fermés.
  Seul `PROVIDER_HTTP_429` autorise un retry borné avec une nouvelle clé. Toute
  réponse réseau, timeout ou 5xx ambiguë exige une réconciliation probante avant
  publication, échec ou remise en file.
- Les quotas sont sérialisés par organisation et provider. Les preuves de consentement,
  d'autorisation, de conformité, de contenu et de sécurité sont figées au claim.
  Timeout, quota, policy, pénurie calendrier et réconciliation sont audités et émis
  par Event Outbox; les workers exécutent les balayages timeout et pénurie.
- Gates : replay local migrations 001–185 PASS; DB/RLS 131 fichiers, 3 110 assertions
  et 4 scénarios de concurrence PASS; Web 132 fichiers/521 tests PASS; lint,
  TypeScript strict et build PASS; E2E authentifiés FR/AR à 360 px et desktop 24/24
  PASS avec fixtures development neutralisées. Audit indépendant : MERGEABLE,
  aucun P0/P1 bloquant dans ce périmètre.
- Aucun environnement de production n'a été modifié. La publication live reste
  désactivée jusqu'à l'injection KMS/Vault des credentials acquis et aux essais
  fournisseurs; le `container_id` Meta ambigu requiert une revue/réconciliation
  humaine et n'est jamais republié automatiquement.

## Checkpoint MARKETING-007 — tendances hebdomadaires — 2026-09-13

- Migration additive `20260913018600_marketing_weekly_trends.sql` appliquée
  uniquement sur Supabase development; le dry-run final confirme la cible à jour.
- L'agrégateur hebdomadaire calcule les volumes et croissances en anomalies
  distinctes, applique avant agrégation le consentement Marketing Analytics, les
  seuils de confidentialité et de croissance versionnés, puis crée les snapshots
  et suggestions sans exposer de PII.
- Le worker est protégé par `CRON_SECRET`, paginé à 500 groupes et reprend après
  interruption grâce à un checkpoint privé durable, un verrou advisory et un
  verrou de ligne. Les mutations sont idempotentes, auditées et émises via Outbox.
- Gates : DB/RLS 132 fichiers, 3 150 assertions et 4 scénarios de concurrence
  PASS; Web 133 fichiers/526 tests PASS; lint, TypeScript strict et build PASS. Réaudit indépendant :
  GO/MERGEABLE, 0 P0 et 0 P1. `MARKETING-007` reste `IN_PROGRESS` jusqu'à l'E2E
  authentifié et à la preuve d'exécution planifiée.
- L'audit atomique consolidé confirme honnêtement 1/76 exigence `VERIFIED`; les
  autres exigences disposent d'implémentations partielles mais attendent encore
  leur preuve atomique et leur visa indépendant. Aucun environnement de production
  n'a été modifié.

## Checkpoint V4.1 — compléments 187–192 — 2026-09-13

- Six migrations additives couvrent Marketing/CTA et approbations, preuves Client/
  Provider, notifications et schedulers, réputation/badges/checklists, ainsi que le
  centre financier/coûts/économies/ROI. Aucun reset ni changement production.
- Gates locales finales : Web 149 fichiers/621 tests PASS; TypeScript strict PASS;
  lint PASS; aucun marqueur incomplet. SQL 0133/0135 PASS (64 assertions), 0134
  PASS (61), 0136 PASS (33 + 4 concurrences) et 0137 PASS (64) sur bases fraîches.
- Les migrations 187–192 ont été appliquées manuellement sur Supabase development,
  puis inscrites dans l'historique CLI. Le correctif additif 193 normalise la portée
  d'idempotence des revues Marketing et a été appliqué automatiquement.
- Tests development : 0133 PASS (33), 0134 PASS (61), 0135 PASS (34), 0136 PASS
  (33), 0137 PASS (64), 0138 PASS (8), plus 4 scénarios de concurrence. Les E2E
  authentifiés sans skip et la configuration des fournisseurs externes restent les
  seules preuves opérationnelles de ce checkpoint; aucune production n'a été touchée.

## Checkpoint accès de validation multi-espaces — 2026-09-13

- La connexion par mot de passe optionnelle complète désormais l'OTP principal en
  FR/AR, avec erreurs non énumérantes et redirection vers le tableau de bord.
- Quatre identités isolées ont été créées et authentifiées sur Supabase development
  pour les espaces Administration, Client, Sous-traitant et Franchisé. Les rôles
  attendus ont été vérifiés; les secrets temporaires ont été remis uniquement via le
  presse-papiers local et ne sont ni loggés, ni documentés, ni commités.
- Le hub récupère les rôles plateforme par le RPC de sécurité borné au compte, sans
  ouvrir de lecture directe sur la table centrale. Les actions Admin sensibles restent
  soumises à AAL2/MFA.
- Gates : Web 150 fichiers/623 tests PASS; TypeScript strict PASS; lint sans erreur;
  build production PASS. GitHub et le déploiement Vercel autorisé ont été mis à jour
  au commit `67835bc`.

## Checkpoint E2E authentifié sans skip — 2026-09-13

- Le gate P05 authentifié a été rejoué sur Supabase development avec deux tenants,
  une identité centrale AAL2, la même identité AAL1 et une identité sans rôle.
- Résultat Playwright : 28/28 PASS, zéro skip, zéro flaky et zéro échec, en FR/AR,
  sur Chromium 360 px et desktop. Les refus anonymes, l'isolation inter-tenant et
  l'obligation MFA centrale sont prouvés.
- Toutes les fixtures Auth, données et stockage ont été neutralisées; les preuves
  d'audit immuables sont conservées et le rapport expurgé est enregistré sous
  `docs/evidence/p05/authenticated-e2e-last-run.json`.

## Checkpoint configuration Vercel et diagnostic runtime — 2026-09-14

- Le périmètre Vercel Matricia a été corrigé localement puis les variables Production
  manquantes ont été créées sans écraser les secrets existants : environnement,
  référence Supabase, chiffrement, webhook interne, signature CTA, paiement DEMO et
  garde-fous Marketing sandbox. Aucun secret n'a été affiché ou commité.
- Le déploiement Production `c3e9ea8` est READY; accueil, connexion et health répondent
  HTTP 200. Web : 150 fichiers/624 tests PASS, TypeScript strict et build PASS.
- Le diagnostic readiness distingue maintenant PostgreSQL `up` du backlog Outbox
  `down` (`OUTBOX_BACKLOG`) au lieu de signaler faussement la base indisponible.
- Blocages externes vérifiés : le jeton Supabase Management fourni retourne HTTP 403
  et ne voit pas le projet, empêchant la configuration Auth URL/SMTP; le worker
  Railway/ClamAV n'est pas configuré, donc 542 événements Outbox restent en attente.

## Checkpoint Railway Worker/ClamAV et Outbox — 2026-09-14

- Le projet Railway `Matricia` et ses services production `matricia-worker` et
  `clamav` ont été créés après autorisation explicite. ClamAV utilise l'image
  officielle épinglée `clamav/clamav:1.4.6-debian13-slim` et reste accessible
  uniquement sur le réseau privé Railway.
- Le worker est configuré avec build/start ciblés, healthcheck `/health`, secrets
  injectés sans affichage, Supabase service role, dispatch HTTPS borné à
  `matricia.vercel.app` et liaison ClamAV privée.
- Un récepteur Outbox interne authentifié, validé et borné à 128 Kio est déployé
  sur Vercel. Tests ciblés 3/3 PASS, TypeScript strict Worker/Web PASS et build
  Next.js production PASS.
- Déploiements Railway Worker et ClamAV : `SUCCESS`. Le backlog Outbox est passé
  de 542 à 0 et `https://matricia.vercel.app/api/readiness` répond HTTP 200 avec
  PostgreSQL et Outbox `up`. Aucun secret n'est documenté ou commité.

## Checkpoint design premium public — 2026-09-14

- La Home et les parcours publics diagnostic, besoin, fournisseur, connexion,
  contact, franchise et à-propos utilisent désormais le système visuel premium
  centralisé et la signature Réponse → Priorité → Action, sans réintroduire de
  catalogue public ni changer une règle métier.
- Les parcours FR/AR conservent route, paramètres et brouillons; les contrôles
  radio, champs libres et menu mobile ont été renforcés pour le clavier et les
  technologies d'assistance.
- Gates : lint et TypeScript strict PASS; build Next.js PASS; Web 151 fichiers/
  627 tests PASS; UI 4/4 PASS; E2E public ciblé 26/26 PASS. Les captures réelles
  avant/après et le rapport sont dans `docs/design-premium/`.
- Les espaces authentifiés n'ont pas été inspectés visuellement pendant cette
  passe faute de compte de test explicitement autorisé. Aucun déploiement ni
  changement de base ou de production n'a été effectué.

## Correctif inscription publique — 2026-09-14

- L'en-tête, la connexion et l'entrée fournisseur exposent maintenant une
  inscription explicite Client ou Sous-traitant. Le mode inscription autorise
  la création Auth par OTP; le mode connexion continue d'interdire toute
  création implicite afin d'éviter l'énumération et les comptes accidentels.
- Après validation du courriel, le nouveau compte reprend sur le passeport
  organisation avec le rôle Client ou Provider prérempli, sans accorder de rôle
  plateforme ni contourner les contrôles d'organisation.
- Gates : lint et TypeScript strict PASS; Web 151 fichiers/629 tests PASS;
  build Next.js PASS; E2E design et inscription 24/24 PASS.

## Checkpoint corrections publiques et espaces connectés — 2026-09-15

- Les parcours publics diagnostic, besoin précis, fournisseur, abonnements, contact et authentification sont raccordés jusqu'au dossier autorisé, avec reprise FR/AR et écritures serveur idempotentes.
- Les espaces Client et Sous-traitant ont reçu les corrections P0 : contexte d'organisation serveur, diagnostics et demandes sans identifiants techniques, devis multiligne exact, qualification documentaire privée et facturation métier. Navigation, Franchise et Administration ont été harmonisées sans affaiblir RLS, AAL2, approbations ou règles financières.
- Migrations additives `194` à `199` et `202` à `206` appliquées sur Supabase development ; dry-run distant final `upToDate: true`.
- Gates : workspace 910 tests PASS, TypeScript strict PASS, lint PASS, build PASS ; Playwright public final 34/34 PASS ; E2E cœur authentifié ciblé 2/2 PASS ; SQL 149 fichiers / 3 488 assertions / 4 scénarios de concurrence PASS ; catalogue 10/200/6000 et absence de placeholders validés.
- Les résidus (primitive documentaire de preuve de paiement, quelques statuts avancés, revue visuelle authentifiée exhaustive et traçabilité Gold Master `1/76 VERIFIED` avec P01 ouverte) sont explicitement consignés dans `docs/corrections-public-dashboards/PROGRESS.md`. Aucun déploiement production n'a été effectué pendant cette passe.

## Checkpoint audit final et fermeture P1 ciblée — 2026-09-15

- Le déploiement observé a été réconcilié avec `codex/bootstrap-foundation` au SHA `b4050fc3`; la branche d'audit part exactement de ce point. Les onze matrices et rapports demandés sont maintenus sous `docs/`.
- Home, navigation, diagnostic, besoin précis, services et entrée Prestataire utilisent le catalogue canonique 10/200 sans charger les 6 000 questions. Brouillons, reprise OTP, validation serveur, FR/AR, clavier et responsive 360–1440 ont été renforcés.
- Qualification Prestataire, capacité `PAUSED`, explications de matching et historique Client sont raccordés. La preuve de paiement Prestataire est désormais archivée dans un objet privé, immuable et tenant-safe avant liaison transactionnelle au ledger.
- Le formulaire Contact déclenche désormais une notification support idempotente lorsqu'elle est configurée, sans perdre la demande ni annoncer faussement une livraison; Railway utilise `/readiness` au lieu du simple liveness `/health`.
- Migrations additives `205` à `207` appliquées uniquement sur Supabase development; dry-run final `upToDate=true`. La 207 impose un verdict antivirus immuable CLEAN avant toute écriture comptable de paiement prestataire. Aucune production n'a été modifiée.
- Gates : build PASS; TypeScript et lint PASS; 910 tests unitaires/intégration PASS; 154 fichiers SQL / 3 590 assertions PASS et 311/311 RPC avec indice DENY; 0154/0155 ciblés et 4 concurrences PASS avec preuves machine, tandis que le replay complet Outbox reste à refaire sans worker development concurrent. E2E publics 34/34 PASS, smoke routes 8/8, E2E authentifiés 3/3 couvrant MAT-FUNC-007/013/018/019 avec fixtures entièrement neutralisées. Traçabilité indépendante actuelle : 5/68 MAT-FUNC V1 VERIFIED.
- Release non signable à ce checkpoint : P01 et traçabilité `5/76 VERIFIED` (5/68 MAT-FUNC V1), MAT-FUNC-020 E2E rouge, smoke authentifié 16 scénarios non exécuté, 336 validations runtime des matrices, paramètres Auth hébergés et intégrations externes réelles (signature, paiements sandbox, SMTP, scanner/social) restent à prouver. Ces points sont consignés dans `docs/RELEASE_CHECKLIST.md` et `docs/DECISIONS_REQUIRED.md`.

## Checkpoint Client — 2026-11-02

- Source fusionnée `codex/bootstrap-foundation` au SHA `a237ae1`, corrections dans `codex/client-completion-20261102`. Aucun environnement distant ni production modifié. La branche de travail est poussée ; la création automatique de PR est refusée par l’accès API GitHub, et son corps/comparatif sont préparés.
- Les 26 chantiers Client sont tracés dans `docs/client-completion/REPORT.md` : questionnaires conditionnels et reprise, contexte d’organisation, devis/mission/litiges, quotas, approbations et reprise exacte, changements payés, packs, Box/membres/exécutions/retours, historique, portefeuille, parrainage/récompenses, ROI/économies, notifications et FR/AR.
- Contrôles techniques réussis : types, lint, build Next avec contrôles activés ; Web 2 639 tests hors PDF, groupe PDF 10/10 réussi séparément ; packages 137, worker 102, intégration 3 et tooling 31. Les derniers changements ont leurs régressions ciblées ; les décomptes recouvrants ne sont pas additionnés.
- Rejeu strict final : 458 migrations, 34 fichiers SQL, 904 assertions réussies, 623 tables publiques avec RLS, pgTAP fermé aux rôles API, nettoyage réussi. Concurrence native : trois cohortes GoTrue, une création et un refus de quota 54000 par paire, aucun interblocage ni double création. Le scellement d’audit garde une chaîne linéaire.
- Une pile navigateur a été reconstruite depuis le schéma canonique dans `template0` après découverte d’une dérive de restauration dans le clone initial. Comparaison finale : 3 915 objets, aucune différence de définition ou d’ACL. Aucun trigger de l’ancien clone n’a été retiré pour obtenir cette équivalence.
- Contre-recette canonique Owner : 220/220 pages FR/AR à 360/375/390/768/1440, 22 refus Administration/organisation étrangère, 14 frontières publiques et navigation clavier/tactile réussis, sans débordement, erreur JavaScript ou panne métier. Portefeuille natif 5/5 et questionnaire conditionnel/hors ligne 11/11 réussis. Buyer payé DEMO : 8/8 contrôles réussis (3→0→3, clavier/tactile et refus hors périmètre). Axe : 32/32 scans FR/AR, aucune violation ni exclusion ; la légende corrigée a 32/32 mesures de glyphes ≥5,1597:1 ; zones non rendues/masquées non mesurées et absence de certificat WCAG global explicites.
- Revue indépendante des corrections R1–R12 : causes et sources examinées, résultats attribués à leurs exécutants et limites explicites. Les preuves et commandes sont conservées sous `docs/client-completion/`.
- Livraison commerciale globale non certifiée : fournisseur/niveaux de signature, règles et contenus approuvés, traductions de catalogue et recette hébergée manquent. `release:validate` reste refusé par 73 conditions globales ; P01 et les registres `5/76 VERIFIED` ne sont pas fermés artificiellement. La recette technique ciblée Client est close. La prochaine étape demandée est le Sous-traitant complet, sur une branche issue de ce lot, avec régression des flux partagés Client/Provider et certification externe toujours séparée.

## 2026-11-02 — Sous-traitant, intégration et recette en cours

- Source explicite : Client final `7e01276`, branche `codex/provider-completion-20261102`. Le checkpoint Client est poussé ; ses modifications sont conservées. Aucun déploiement ni fusion de production.
- Lots intégrés : qualification/questionnaire/coffre/capacité/identité commune, devis versionnés/options HT facultatives/pièces privées, contexte/équipe/messagerie, contrats/livraisons/affectations/avenants ADD, première facturation gouvernée40000–40400. Les registres et reçus sous `docs/provider-completion/` distinguent chaque preuve de ses extensions encore en cours.
- Vérifications d'étape réellement réussies : Entrée44 SQL ; Identité28 SQL ; Devis41 SQL ; messagerie68 SQL ; litiges69 SQL. Chaque reçu transactionnel indique les fichiers/empreintes et un ROLLBACK sans COMMIT. Le premier rejeu neuf Livraison459 migrations/62 assertions est une preuve antérieure aux extensions. Ces nombres ne sont pas additionnés en certification intégrée.
- Premier `pnpm typecheck` intégré réussi. `pnpm lint` a terminé avec4 avertissements Finance, corrections demandées au propriétaire ; ni ce contrôle ni les reçus d'étape ne valent contrôle du candidat final. Les correctifs Client/Provider d'état de lecture et les gardes du runner ont leurs tests ciblés.
- Revue indépendante : défauts réels supplémentaires relevés sur reprises après panne, rôles composites, facturation/échéanciers/avoirs, bénéficiaire et provenance des pénalités, exécution des retraits/remplacements signés. Leurs auteurs implémentent les contre-tests ; le lot n'est pas déclaré clos sur une simple annonce.
- Recette navigateur : nouvelle cible locale Provider distincte de la cible SQL Client, droits comparés au source canonique458,15 vrais acteurs GoTrue OTP/TOTP AAL2, organisations/invitations natives. Build et gestes métier complets encore à exécuter. Aucun JWT utilisateur fabriqué, aucune preuve de signature juridique ou d'antivirus externe revendiquée.
- Prochaines étapes : finir40500+ Finance et41700+ Livraison, contre-revue et rejeu intégré, build/navigateur FR/AR, sauvegarde de tous les commits/preuves et préparation PR. Les dépendances externes restent identifiées dans le rapport Client ; les barrières globales de release ne sont pas passées artificiellement.

## 2026-11-02 — Sous-traitant, candidat consolidé8941517

- La branche conserve Client final7e01276. Lots complémentaires intégrés : revue questionnaire38400, contre-corrections Finance40500–40950, moteur opérationnel signé41950/41960 et planning individuel. Les décisions financières ne prennent plus de montants ni de validation juridique fournis par l'opérateur ; une clause approuvée et effectivement signée est l'autorité. L'appel qui inverse une première décision déclenche ses effets une fois.
- Recettes natives d'étape : qualification reviewer40, litiges intégrés79 avec46 migrations Provider, générations signées170/remplacement avant mission27/retrait avant mission18/legacy129. Chaque reçu porte ses sources/hashes, rollback sans COMMIT et empreintes identiques. Les reçus antérieurs ne sont pas additionnés en certificat global. Les revues indépendantes FinanceF01–F12, LivraisonL01–L08 et rootR09/R10 sont consignées dans docs/provider-completion/.
- Premier contrôle Web global :2939PASS/8échecs/1skip. Les échecs étaient quatre délaisPDF parallèles et quatre attentes de tests lues pendant l'intégration ; les groupes ciblés PDF/options16 et navigation/pages15 passent ensuite, sans augmenter de délai. Rejeu global hors PDF et lint encore en cours ; TypeScript intégré a réussi. Les fixtures SQL historiques sont adaptées à la nouvelle revue obligatoire, sans retrait des assertions ni bypass de protection.
- Candidat navigateur8941517 (arbre apps/web e709d635bfc02c3297ec356689b24364243a67ea) :15 migrations nouvelles appliquées, anciens SHA inchangés, toutes tables publiques RLS, pgTAP fermé aux rôles API. Nouveau build compilation+TypeScript réussis, fin de build et chaîne métier native en cours. Le réviseur AAL2 lit les vraies réponses via projection bornée, tandis que son SELECT général reste à0.
- Déjà constatés sur candidat précédent :40 pages FR/AR375/390/768/1440,8menus,20frontières de rôles/MFA réussis ;64scans axe sans violation automatique mais contrôle color-contrast incomplet, sans certification WCAG. Identité/documents/questionnaire/capacité exécutés avec acteurs GoTrue et fichiersTEST privés réels ; aucun utilisateurJWT fabriqué, antivirus externe ou signature juridique de production revendiqué.
- GitHub : branche poussée et confirmée jusqu'àea2b18f ; derniers commits en cours de consolidation avant nouvelle poussée. PR distante toujours non créée après refus GraphQL observé précédemment. Aucune fusion ni production. Le rapport exhaustif du périmètre est docs/provider-completion/REPORT.md ; la recette intégrée finale et les prérequis externes restent explicitement ouverts.

## 2026-11-03 — Sous-traitant, réalisation et recette technique ciblée terminées

- Client final7e01276 conservé, branche `codex/provider-completion-20261102`. Dernier produit vérifié5b8b0f738137abee19f6552aef538e906d04f24a, arbre apps/web ef4b62c67a4d8ad5a6403e6a4568bd9dc1774c75. Les commits ultérieurs concernent preuves/documentation. Aucune fusion, production ou réapplication de l'environnement publié.
- Périmètre E01–E17/D01–D19 implémenté et tracé dans docs/provider-completion/REPORT.md : entrée/identité/questionnaires, revue indépendante, documents, capacité, devis/révisions/PDF/options, contrats/avenants/missions/livraisons/affectations, finance, litiges, messagerie, équipe, contexte, rôleClient et FR/AR.
- Contre-revues R/F/L ont corrigé des causes réelles supplémentaires : accès de revue sans élargir SELECT privé ; faux vide de fileAdmin ; exceptions puis générations signées immuables ; lecture/exécution séparées ; reçus de reprise ; décisions économiques issues du modèle approuvé et signé ; date marocaine refusée sousUTC ;2contextes notifications omis ; incidentAuth conservé technique ; lien du double rôle, contrasteAR et langue/dir du document lors des vraies navigationsSPA ;2statutsDevis traduits sans toucher les textes libres.
- Validation finale :507migrations,56fichiersSQL,2067assertions PASS,649tables publiques/0sansRLS/pgTAPnonexécutableAPI, nettoyagePASS. Web2980PASS +30PDF/MFAisolés distinctsPASS et1skip opt-in ; worker104PASS ; types, lint, builds et exports server-actions1832sourcesPASS. Le reçu global ne prétend pas rejouer tous les anciens tests ni inclure une nouvelle campagne de concurrence.
- Navigateur natif :15acteursGoTrueOTP/TOTPAAL2 ; identité/coffre/questionnaire/capacité, qualification, devis7/révision3/contrat-mission5/livraison6/messages4, finance4avecfenêtre intacte, double rôle4 et navigation/recherche3. Les gestes gardent leur véritable candidat e929→894→5e06→706, sans les réétiqueter artificiellement. Matrice706 :232/232pages, FR/AR375/390/768/1440,256scansaxe/0violation,8menus/0JS/0débordement. Delta final5b8Devis :8/8contrôles ciblés, mêmeV2/organisation/textes libres.454fichiers de preuve et archiveaxe brute vérifiés par root.
- Contraste mesuré : libelléAR4,1842→12,5138:1 ;54/56cibles conformes,2nonmesurées. Les256incomplets axe liés aux gradients restent explicitement non résolus globalement ; aucun certificatWCAG universel.
- Limites réelles : clôture/facture/paiement/allocation du mois courant non joués avant le30novembre et sa contradiction ; signature juridique, scanner réel, mouvement bancaire, validation fiscale professionnelle, informations légales, email/PSP/workerhébergé/restaurationstaging non certifiés. Pas de faux solde, mock de réussite ou donnéesTEST publiées en production. Registre global5/76 et autres barrières release non fermés artificiellement.
- Ancienne pileClient e3 sauvegardée privée11Mo puis4conteneurs nettoyés avec garde ; chaque replay neuf s'autonettoie. Source f59 et cohorteProviderb9 conservées ; app/gateway de recette arrêtés proprement, pas de service de production touché. Code/preuves/descriptionPR préparés, GitHubAPIcréationPR refusée ; branche et comparatif permettent la revue sans merge autorisé.


## 2026-11-03 — Finance et Franchisé livrés, recette finale partielle figée

- Source initialedf67da4 conservée après Client/Prestataire. PR12 fusionnée par l’utilisateur en a362abc1 ; l’assistant n’a ni fusionné ni déployé en production. Complément depuis cette fusion : codex/franchise-publication-validation-20261103.
- Correctifs : mandat/ACLcatalogue natifs, organisation/territoire explicites, lecteurs exacts et erreurs distinctes, constructeurs/versionnage/UUID/livrablesFRAR, invitations/relances durables, six axes/rapports et plans indépendants, binding économique des livres, coûts nets/documents privés/coûts nuls et reprise vers dépense réelle, calendrier et replays financiers. PRIMARY manquant réparé par sauvegarde DRAFT native, jamais publication directe.
- Rejeu final neuf :559migrations,74fichiersSQL,2833assertions PASS ;664tables publiques/0sansRLS/pgTAPnonexécutableAPI, nettoyagePASS. Web801PASS sur candidat834 ; deltas117PASS (groupes recouvrants), worker158PASS ; types/lint et build strictC3b433 PASS,31tooling/3intégration/5gardes d’outillage PASS.
- NavigateurC3 : OTP→TOTP→AAL2 et retour exact FR/AR PASS ;10étapes éditoriales natives et régularisation de2anciens services PASS. Publication non exécutée :23P01 CATALOG_SCHEDULE_CONFLICT, aucune release annulée pour faire passer. Finance :RESERVED/PENDING, dépôt final non confirmé, pas de scanCLEAN/approbation réelle certifiés.
- Matrice finale arrêtée à la demande de clôture rapide :43visites,37PASS/6FAIL et2interrompues. Les6échecs concernent le focus des tableaux ; correctif commun8ad97dd2 et117tests+lint PASS. Ce dernier delta n’a pas eu de nouvelle recette navigateur/build optimisé. La couverture finale192 n’est pas certifiée.
- Dernier arbreapp865af1bcf3bd0904b9c941c90a024c5f988492b7 ; build strictb433/appTreec318 et état final distincts, sans réétiquetage des preuves. Voir docs/franchise-completion/REPORT.md, TRACEABILITY.md et evidence/browser/CLOSURE.json.
- Limites : CI du compte GitHub encore bloquée par facturation après fusion, APIcréationPR Forbidden ; scanner physique, intégrations/staging hébergés, signature juridique, données légales/conditions validées, seuils de gouvernance et distribution historique positive non certifiés. Aucun100%global V1 ni procès-verbal client revendiqué. Aucun contrôle supplémentaire en cours.


## 2026-11-03 — Reprise ciblée : publication, dépôt financier et visuel finalisés

- Publication réelle PUBLISHED après régularisation560 à deux administrateurs natifsAAL2 ; auto-approbation refusée, claim/complete sous bail et rejeu sans doublon, anciennes versions/hashes conservés.
- Même PDF privé repris après alignement Origin du runtime : UPLOADED,816octets/hash vérifiés,1upload,0rapprochement ; scannerERROR et refus55000 de coût nul maintiennent la sécurité faute de moteur réel.
- Focus12cas FR/AR375/390 PASS enDEV, clavier réel et0axe/0JS. Pas de nouvelle campagne optimisée192 ni de déploiementprod.
- AdminCalendrier560 exploitable FR/AR ; dates sérialisées serveur contre divergenceTZdata ;56testsWeb et28SQL PASS, revue indépendante favorable. Reçus finaux dans docs/franchise-completion/evidence/browser.
