# Registre des constats

Commit b578c75c1c0f076c7fb46b0239d7ab5f2b0afc4c, état de travail incluant deux corrections staged préexistantes. Généré 2026-11-19T13:52:10.385Z.

36 constats : 10 de gravité haute, 25 moyenne, 1 faible. Deux constats sont des risques conditionnels explicitement qualifiés (SEC-03, DEP-01). Aucun Critical ni compromission de production démontrés ; cela ne certifie pas leur absence.

Les gravités expriment l'impact plausible dans le périmètre précis. Un constat source, un diagnostic propriétaire et une reproduction native ne sont pas interchangeables. Les causes connexes sont regroupées ; ne pas compter les échecs de tests comme autant de failles.

| ID | Gravité / priorité | Constat | Niveau de preuve |
|---|---|---|---|
| [FIN-01](#fin-01) | Haute / P1 | Le pot Core reconnaît un revenu sans rapprochement avec le journal | SQL natif, contraintes validées sous authenticated |
| [FIN-02](#fin-02) | Haute / P1 | La clôture du pot Core échoue lors de la vérification différée | SQL natif et ACL effectives vérifiées |
| [FIN-03](#fin-03) | Haute / P1 | Les périodes chevauchantes accumulent deux fois les mêmes droits | Code + diagnostic SQL avec validation propriétaire |
| [FIN-04](#fin-04) | Haute / P1 | Les sources remboursées ne sont pas revalidées avant distribution Core | Analyse source et définitions SQL |
| [FIN-05](#fin-05) | Moyenne / P2 | Les reprises Core et volume vérifient trop tôt l'état modifié | Diagnostic SQL + analyse source |
| [FIN-06](#fin-06) | Moyenne / P2 | Le formatter monétaire fusionne deux montants bigint distincts | Exécution de la fonction source importée |
| [DATE-01](#date-01) | Moyenne / P2 | Le décalage fixe UTC+1 peut afficher un autre jour civil | Exécution source contre Intl/Africa/Casablanca |
| [SEC-01](#sec-01) | Moyenne / P2 | Le téléchargement documentaire autorise un Viewer exclu du coffre | Matrice SQL ALLOW/DENY, sessions synthétiques et RLS actives |
| [SEC-02](#sec-02) | Moyenne / P2 | La démo valide le persona après la session et les effets MFA | Source + doubles en mémoire |
| [SEC-03](#sec-03) | Moyenne / P2 | L'autoconfirmation locale ne prouve pas la possession du courriel | Configuration locale inspectée |
| [REL-01](#rel-01) | Haute / P1 | Le runner SQL accepte une cible arbitraire sans identité non-production | Source + exécution du résolveur en mémoire |
| [REL-02](#rel-02) | Haute / P1 | Un sous-ensemble SQL peut satisfaire un check de release complet | Exécution du parseur de preuves en mémoire |
| [REL-03](#rel-03) | Haute / P1 | Deux migrations partagent le même identifiant | Inventaire + historique SQL |
| [REL-04](#rel-04) | Haute / P1 | Le build et la vérification TypeScript à froid échouent | Build réel + typecheck sans incrémental |
| [REL-05](#rel-05) | Moyenne / P2 | Lint, tests web et tooling ne sont pas verts | Exécutions et lecture des causes |
| [REL-06](#rel-06) | Moyenne / P2 | Le contenu des visas n'est pas validé | Validation en mémoire |
| [REL-07](#rel-07) | Moyenne / P2 | Les preuves atomiques et la couverture exigée restent incomplètes | Inventaire et configuration |
| [ARCH-01](#arch-01) | Moyenne / P2 | Le web n'hérite pas de plusieurs options strictes requises | Options effectives TypeScript calculées |
| [ARCH-02](#arch-02) | Moyenne / P2 | Les packages de domaine et le contrôle de frontières restent largement déclaratifs | Analyse source et validateur |
| [ARCH-03](#arch-03) | Moyenne / P2 | La pagination de transport charge toujours tout l'historique | Fonction source exécutée avec transport synthétique |
| [ARCH-04](#arch-04) | Moyenne / P2 | Des erreurs métier différentes deviennent indiscernables | Exécution du helper avec RPC simulées |
| [PROD-01](#prod-01) | Haute / P1 | Le besoin sans service précis n'a pas de reprise exploitable | Chemin de code complet inspecté |
| [PROD-02](#prod-02) | Haute / P1 | La restauration du besoin perd l'organisation explicite | Source + évaluation déterministe des helpers |
| [PROD-03](#prod-03) | Moyenne / P2 | Les réponses du besoin sont tronquées silencieusement | Expression de sérialisation exécutée en mémoire |
| [PROD-04](#prod-04) | Moyenne / P2 | La projection embarquée exclut les nouveaux services publiés | Helper source exécuté en mémoire |
| [DEMO-01](#demo-01) | Moyenne / P2 | Les overlays démo masquent le réel et coupent des parcours | Source + helpers purs |
| [UX-01](#ux-01) | Moyenne / P2 | L'inscription fournisseur impose la classification avant de continuer | Source + observation navigateur |
| [UX-02](#ux-02) | Moyenne / P2 | Changer de langue abandonne le détail et la version d'une offre | Construction des liens sur source |
| [A11Y-01](#a11y-01) | Moyenne / P2 | Le CTA financier blanc sur corail est sous AA | Source + calcul de contraste |
| [A11Y-02](#a11y-02) | Moyenne / P2 | Le suivi mission combine un texte très clair et un champ blanc | Source + calcul de contraste |
| [A11Y-03](#a11y-03) | Moyenne / P2 | Les recherches connectées suppriment leur indicateur de focus | Analyse de cascade CSS |
| [A11Y-04](#a11y-04) | Moyenne / P2 | Le menu multiespace exclut summary de sa navigation personnalisée | Analyse du focus selector et du gestionnaire Tab |
| [I18N-01](#i18n-01) | Moyenne / P2 | Les services arabes du fournisseur portent lang=fr | Source et contenu localisé inspectés |
| [I18N-02](#i18n-02) | Moyenne / P2 | Des codes métier internes sont exposés sans traduction | Analyse des libellés de formulaires |
| [UX-03](#ux-03) | Faible / P3 | La navigation française déborde à 1024px | Navigateur réel, reproduction ciblée |
| [DEP-01](#dep-01) | Moyenne / P2 | Next.js 16.4.1 est inclus dans deux plages d'avis de sécurité | Audit npm + avis primaires vérifiés |

<a id="fin-01"></a>

## FIN-01 — Le pot Core reconnaît un revenu sans rapprochement avec le journal

- Domaine : Finance. Gravité : **Haute** ; priorité proposée : **P1**.
- État : Non-conformité confirmée. Preuve : SQL natif, contraintes validées sous authenticated.
- Sources : [supabase/migrations/20261112200000_platform_core_pot_finance.sql:220](<../../../supabase/migrations/20261112200000_platform_core_pot_finance.sql:220>).
- Preuves : [evidence/core-pot-post-probe.json](./evidence/core-pot-post-probe.json), [probes/core-pot-post.sql](./probes/core-pot-post.sql).

**Reproduction / contrôle :** Exécuter la sonde sur la copie isolée avec un acteur Finance AAL2 synthétique.

**Observé :** Un journal équilibré de dépense de 100, sans crédit de revenu, alimente le pot de 10 000 unités mineures. bug1_reproduced=true ; contraintes contrôlées sous authenticated ; rollback vérifié.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Bénéfice distribuable calculé depuis une entrée qui ne correspond pas à un encaissement HT acquis.

**Correction recommandée :** Dériver montant et catégorie depuis une source canonique vérifiée, rapprocher journal/lignes/date/devise et interdire la réutilisation économique.

**Critère de non-régression :** Rejeter journal de dépense, montant majoré, TVA présentée comme revenu et même journal réutilisé avec une autre référence.

**Portée et limites :** Acteur Finance autorisé ; aucun accès non autorisé, commit conservé ou versement réel démontré.

<a id="fin-02"></a>

## FIN-02 — La clôture du pot Core échoue lors de la vérification différée

- Domaine : Finance. Gravité : **Haute** ; priorité proposée : **P1**.
- État : Non-conformité confirmée. Preuve : SQL natif et ACL effectives vérifiées.
- Sources : [supabase/migrations/20261112200000_platform_core_pot_finance.sql:135](<../../../supabase/migrations/20261112200000_platform_core_pot_finance.sql:135>), [supabase/migrations/20261112200000_platform_core_pot_finance.sql:433](<../../../supabase/migrations/20261112200000_platform_core_pot_finance.sql:433>), [supabase/migrations/20261112200000_platform_core_pot_finance.sql:441](<../../../supabase/migrations/20261112200000_platform_core_pot_finance.sql:441>).
- Preuves : [evidence/core-pot-probe.json](./evidence/core-pot-probe.json).

**Reproduction / contrôle :** Exécuter la sonde core-pot sous authenticated puis SET CONSTRAINTS ALL IMMEDIATE sans changer le rôle.

**Observé :** 42501 permission denied for function platform_core_pot_access depuis assert_platform_core_pot_allocation_total. Le trigger est INVOKER ; authenticated n'a pas EXECUTE sur le helper RLS, également confirmé dans la base locale originale.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** La clôture ne peut pas atteindre normalement la validation différée de la transaction, malgré un rôle Finance et AAL2.

**Correction recommandée :** Rendre les contrôles de lecture et de contraintes cohérents avec le moindre privilège, sans ouvrir arbitrairement tous les helpers privés.

**Critère de non-régression :** Tester clôture par vraie RPC avec rôle SQL authenticated, validation différée et lecture autorisée ; anonyme et rôle métier insuffisant restent refusés.

**Portée et limites :** La sonde force l'évaluation avant rollback, pas un paiement. Le propriétaire DB n'est pas un substitut valable au rôle applicatif.

<a id="fin-03"></a>

## FIN-03 — Les périodes chevauchantes accumulent deux fois les mêmes droits

- Domaine : Finance. Gravité : **Haute** ; priorité proposée : **P1**.
- État : Non-conformité confirmée. Preuve : Code + diagnostic SQL avec validation propriétaire.
- Sources : [supabase/migrations/20261112200000_platform_core_pot_finance.sql:281](<../../../supabase/migrations/20261112200000_platform_core_pot_finance.sql:281>).
- Preuves : [evidence/core-pot-owner-constraints-diagnostic-probe.json](./evidence/core-pot-owner-constraints-diagnostic-probe.json), [probes/core-pot-owner-constraints-diagnostic.sql](./probes/core-pot-owner-constraints-diagnostic.sql).

**Reproduction / contrôle :** Sur deux intervalles contenant le même revenu du 14 novembre, appeler close_platform_core_pot_period avec des clés différentes.

**Observé :** Source unique 10 000 ; deux versions initiales de clôture ; droits ACCRUAL cumulés 20 000.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Double droit distribuable latent après résolution du blocage ACL.

**Correction recommandée :** Interdire les chevauchements distincts et sérialiser les clôtures à l'échelle du livre ; les corrections doivent versionner le même intervalle.

**Critère de non-régression :** Tests séquentiels et concurrents de chevauchement, réouverture et conservation des montants.

**Portée et limites :** La variante de diagnostic valide les contraintes comme propriétaire DB : elle ne prouve PAS une double distribution native persistée. FIN-02 bloque actuellement cette persistance.

<a id="fin-04"></a>

## FIN-04 — Les sources remboursées ne sont pas revalidées avant distribution Core

- Domaine : Finance. Gravité : **Haute** ; priorité proposée : **P1**.
- État : Non-conformité confirmée. Preuve : Analyse source et définitions SQL.
- Sources : [supabase/migrations/20261113100000_platform_core_pot_ingest_sources_v1.sql:35](<../../../supabase/migrations/20261113100000_platform_core_pot_ingest_sources_v1.sql:35>), [supabase/migrations/20261031268023_subscription_refund_frozen_posting_accounts.sql:27](<../../../supabase/migrations/20261031268023_subscription_refund_frozen_posting_accounts.sql:27>), [supabase/migrations/20261112200000_platform_core_pot_finance.sql:281](<../../../supabase/migrations/20261112200000_platform_core_pot_finance.sql:281>).
- Preuves : [reviewers/finance.md](./reviewers/finance.md).

**Reproduction / contrôle :** Suivre classification d'un abonnement, ingestion Core, remboursement canonique puis construction d'une clôture.

**Observé :** Le remboursement invalide le financement en SOURCE_REVIEW_REQUIRED ; ingestion/clôture/payout Core ne rapprochent pas cette invalidation ni une contre-écriture obligatoire.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Un revenu remboursé peut rester dans la base distribuable si aucune correction n'est enregistrée.

**Correction recommandée :** Rapprocher les événements défavorables et bloquer la distribution non rapprochée ; contre-écritures immuables et correction de clôture.

**Critère de non-régression :** Remboursement avant ingestion, après ingestion, après clôture et avant payout.

**Portée et limites :** Chaîne de remboursement complète non rejouée ; risque financier établi par l'absence de revalidation, pas perte monétaire observée.

<a id="fin-05"></a>

## FIN-05 — Les reprises Core et volume vérifient trop tôt l'état modifié

- Domaine : Finance. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Diagnostic SQL + analyse source.
- Sources : [supabase/migrations/20261112200000_platform_core_pot_finance.sql:318](<../../../supabase/migrations/20261112200000_platform_core_pot_finance.sql:318>), [supabase/migrations/20261112200000_platform_core_pot_finance.sql:392](<../../../supabase/migrations/20261112200000_platform_core_pot_finance.sql:392>), [supabase/migrations/20260912006600_volume_procurement_pools.sql:278](<../../../supabase/migrations/20260912006600_volume_procurement_pools.sql:278>).
- Preuves : [evidence/core-pot-owner-constraints-diagnostic-probe.json](./evidence/core-pot-owner-constraints-diagnostic-probe.json), [reviewers/finance.md](./reviewers/finance.md).

**Reproduction / contrôle :** Rejouer la même clôture ; examiner aussi les gardes d'allocation/consommation complète et de payout intégral.

**Observé :** La clôture identique retourne 22000 IDEMPOTENCY_PAYLOAD_MISMATCH ; volume et payout vérifient état/solde avant de rechercher leur résultat canonique.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Erreur de reprise après réponse réseau perdue ; incertitude pour l'appelant.

**Correction recommandée :** Empreinte stable des paramètres métier ; autoriser puis rechercher la réponse canonique avant les gardes dépendant des effets antérieurs.

**Critère de non-régression :** Rejeux identiques après allocation/consommation complètes, payout total et clôture, y compris deux sessions.

**Portée et limites :** Clôture : variante propriétaire de FIN-03. Volume/payout : ordre de code confirmé, mutations correspondantes non exécutées.

<a id="fin-06"></a>

## FIN-06 — Le formatter monétaire fusionne deux montants bigint distincts

- Domaine : Finance. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Exécution de la fonction source importée.
- Sources : [apps/web/modules/shared/lib/format/display.ts:32](<../../../apps/web/modules/shared/lib/format/display.ts:32>).
- Preuves : [evidence/source-probes.json](./evidence/source-probes.json).

**Reproduction / contrôle :** Appeler formatMinorAmount avec les chaînes 9007199254740992 et 9007199254740993.

**Observé :** Les deux entrées affichent 90.071.992.547.409,92 MAD ; la seconde perd un centime.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Présentation financière inexacte aux limites bigint.

**Correction recommandée :** Formater depuis une représentation entière/décimale exacte, sans conversion par Number.

**Critère de non-régression :** FR/AR, valeurs négatives, limites bigint et décimales applicables à chaque devise.

**Portée et limites :** Défaut d'affichage ; aucune altération de ledger démontrée.

<a id="date-01"></a>

## DATE-01 — Le décalage fixe UTC+1 peut afficher un autre jour civil

- Domaine : Données. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Exécution source contre Intl/Africa/Casablanca.
- Sources : [apps/web/modules/shared/lib/format/display.ts:16](<../../../apps/web/modules/shared/lib/format/display.ts:16>).
- Preuves : [evidence/source-probes.json](./evidence/source-probes.json), [reviewers/finance-final.md](./reviewers/finance-final.md).

**Reproduction / contrôle :** Formater 2026-03-01T23:30:00Z.

**Observé :** Application : 2 mars 00:30 ; Intl Africa/Casablanca : 1 mars 23:30, tzdata 2026e ; confirmé indépendamment avec tzdata 2025b.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Mauvaise heure et parfois mauvaise date dans les listes et suivis.

**Correction recommandée :** Utiliser le fuseau IANA requis et maîtriser la cohérence SSR/client sans substituer un offset permanent.

**Critère de non-régression :** Tester changements de décalage et limites de jour/période, plusieurs années.

**Portée et limites :** Affichage seulement ; aucune dérive du calcul SQL des échéances n'est démontrée.

<a id="sec-01"></a>

## SEC-01 — Le téléchargement documentaire autorise un Viewer exclu du coffre

- Domaine : Sécurité. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Matrice SQL ALLOW/DENY, sessions synthétiques et RLS actives.
- Sources : [supabase/migrations/20260922150000_audit_fiscal_invitation_outbox_hardening.sql:489](<../../../supabase/migrations/20260922150000_audit_fiscal_invitation_outbox_hardening.sql:489>), [apps/web/app/api/client/documents/[documentId]/route.ts:60](<../../../apps/web/app/api/client/documents/[documentId]/route.ts:60>).
- Preuves : [evidence/document-authorization-probe.json](./evidence/document-authorization-probe.json), [probes/document-authorization.sql](./probes/document-authorization.sql).

**Reproduction / contrôle :** Exécuter la sonde document-authorization avec Owner A, Viewer A et Owner B, sans binding documentaire.

**Observé :** Owner A : SELECT 1/RPC autorisée ; Viewer A : SELECT 0/RPC autorisée ; autre tenant : SELECT 0/RPC refusée 42501.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Une pièce de conformité peut être autorisée hors de la politique de lecture du coffre pour le même tenant.

**Correction recommandée :** Aligner permissions de coffre et téléchargement ou exiger un partage explicite lié à un objet accessible.

**Critère de non-régression :** Owner ALLOW, Viewer sans partage DENY, autre tenant DENY, partage révoqué DENY.

**Portée et limites :** Document et scan sont des métadonnées synthétiques ; aucun objet Storage ni transfert binaire HTTP. Aucune fuite inter-tenant démontrée.

<a id="sec-02"></a>

## SEC-02 — La démo valide le persona après la session et les effets MFA

- Domaine : Sécurité. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Source + doubles en mémoire.
- Sources : [apps/web/app/[locale]/connexion/demo-actions.ts:30](<../../../apps/web/app/[locale]/connexion/demo-actions.ts:30>), [apps/web/app/[locale]/connexion/demo-assurance.ts:39](<../../../apps/web/app/[locale]/connexion/demo-assurance.ts:39>), [apps/web/app/[locale]/connexion/demo-policy.ts:34](<../../../apps/web/app/[locale]/connexion/demo-policy.ts:34>).
- Preuves : [reviewers/security.md](./reviewers/security.md).

**Reproduction / contrôle :** Configurer un compte ne satisfaisant pas le persona, puis suivre l'ordre d'exécution avec doubles sans serveur Auth réel.

**Observé :** Session et assurance MFA sont manipulées avant le refus de persona ; le refus ne ferme pas explicitement la session.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Mauvaise configuration d'un compte non synthétique : effets Auth/MFA avant l'autorisation attendue.

**Correction recommandée :** Valider identité synthétique et persona avant tout effet Auth ; fermer les sessions établies en cas d'échec.

**Critère de non-régression :** Refus avant génération de lien/MFA ; facteurs existants inchangés ; production toujours refusée.

**Portée et limites :** Environnement démo autorisé seulement ; pas d'attaque Auth native ni de compromission de production démontrée. Le fallback d'upsert de rôles n'a pas été retenu comme escalade exploitable.

<a id="sec-03"></a>

## SEC-03 — L'autoconfirmation locale ne prouve pas la possession du courriel

- Domaine : Sécurité. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Risque conditionnel. Preuve : Configuration locale inspectée.
- Sources : [supabase/config.toml:175](<../../../supabase/config.toml:175>), [supabase/config.toml:225](<../../../supabase/config.toml:225>), [supabase/migrations/20260911002500_identity_security_hardening.sql:168](<../../../supabase/migrations/20260911002500_identity_security_hardening.sql:168>).
- Preuves : [reviewers/security.md](./reviewers/security.md).

**Reproduction / contrôle :** Examiner inscription directe et acceptation d'invitation sur un environnement jetable.

**Observé :** Signup activé et confirmation désactivée localement ; les contrôles d'invitation utilisent le courriel confirmé/JWT.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Le réglage de développement ne doit pas être repris tel quel pour une recette d'identité ou un environnement hébergé.

**Correction recommandée :** Vérifier la configuration Auth de chaque environnement et lier la recette à une possession réelle du courriel.

**Critère de non-régression :** Inscription directe avec une adresse invitée mais non possédée : acceptation refusée avant vérification réelle.

**Portée et limites :** Exploitation non exécutée ; la configuration locale de développement n'est pas une preuve de mauvaise configuration production.

<a id="rel-01"></a>

## REL-01 — Le runner SQL accepte une cible arbitraire sans identité non-production

- Domaine : Release. Gravité : **Haute** ; priorité proposée : **P1**.
- État : Non-conformité confirmée. Preuve : Source + exécution du résolveur en mémoire.
- Sources : [scripts/run-db-tests.mjs:15](<../../../scripts/run-db-tests.mjs:15>), [scripts/run-db-tests.mjs:608](<../../../scripts/run-db-tests.mjs:608>), [scripts/run-db-tests.mjs:267](<../../../scripts/run-db-tests.mjs:267>).
- Preuves : [reviewers/architecture.md](./reviewers/architecture.md).

**Reproduction / contrôle :** Évaluer le résolveur seul avec APP_ENV=staging et une URL fictive non Supabase, sans connexion.

**Observé :** La cible arbitraire est acceptée ; les nettoyages ultérieurs du runner peuvent effectuer des écritures privilégiées.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Une erreur de binding peut orienter une recette mutante vers une base réelle.

**Correction recommandée :** Vérifier la cible effective avant toute écriture, refuser environnement inconnu et incohérences d'identité ; séparer les modes locaux/hosted.

**Critère de non-régression :** Tests de refus avec APP_ENV trompeur, pooler et project-ref incohérents.

**Portée et limites :** Aucune connexion à la cible fictive ou à une production n'a été tentée.

<a id="rel-02"></a>

## REL-02 — Un sous-ensemble SQL peut satisfaire un check de release complet

- Domaine : Release. Gravité : **Haute** ; priorité proposée : **P1**.
- État : Non-conformité confirmée. Preuve : Exécution du parseur de preuves en mémoire.
- Sources : [scripts/run-db-tests.mjs:613](<../../../scripts/run-db-tests.mjs:613>), [scripts/release/run-checks.mjs:27](<../../../scripts/release/run-checks.mjs:27>), [scripts/release/manifest.mjs:60](<../../../scripts/release/manifest.mjs:60>).
- Preuves : [reviewers/architecture.md](./reviewers/architecture.md), [evidence/db-filtered-concurrency.json](./evidence/db-filtered-concurrency.json).

**Reproduction / contrôle :** Fournir au parseur le résumé positif d'un seul fichier avec DB_TEST_PATTERN actif.

**Observé :** Le check peut devenir passed sans comparer les fichiers exécutés aux 383 attendus.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Preuve incomplète présentée comme certification SQL complète.

**Correction recommandée :** Refuser les filtres en release ; vérifier liste, empreinte et nombre attendus des suites.

**Critère de non-régression :** Une recette filtrée doit toujours être PARTIAL et ne peut pas autoriser la release.

**Portée et limites :** Le run filtré de cet audit est explicitement limité à quatre fichiers et quatre scénarios de concurrence ; il ne remplace jamais le run complet.

<a id="rel-03"></a>

## REL-03 — Deux migrations partagent le même identifiant

- Domaine : Release. Gravité : **Haute** ; priorité proposée : **P1**.
- État : Non-conformité confirmée. Preuve : Inventaire + historique SQL.
- Sources : [supabase/migrations/20261118160000_ensure_demo_admin_platform_role_v1.sql:1](<../../../supabase/migrations/20261118160000_ensure_demo_admin_platform_role_v1.sql:1>), [supabase/migrations/20261118160000_reset_demo_box_network_v1.sql:1](<../../../supabase/migrations/20261118160000_reset_demo_box_network_v1.sql:1>).
- Preuves : [evidence/inventory.json](./evidence/inventory.json).

**Reproduction / contrôle :** Regrouper les fichiers par préfixe de version et examiner la clé de schema_migrations.

**Observé :** 607 fichiers, 606 versions uniques ; deux fichiers 20261118160000, une seule version enregistrable.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Replay et état de déploiement non reproductibles sans régularisation.

**Correction recommandée :** Régulariser selon l'historique réellement appliqué, sans réécrire aveuglément une migration déjà déployée.

**Critère de non-régression :** Unicité automatique des versions et replay CLI intégral sur base neuve.

**Portée et limites :** Aucun reset de la base partagée ; un replay CLI complet neuf n'est pas certifié.

<a id="rel-04"></a>

## REL-04 — Le build et la vérification TypeScript à froid échouent

- Domaine : Release. Gravité : **Haute** ; priorité proposée : **P1**.
- État : Non-conformité confirmée. Preuve : Build réel + typecheck sans incrémental.
- Sources : [apps/web/modules/franchise/data/digest/repository.ts:35](<../../../apps/web/modules/franchise/data/digest/repository.ts:35>).
- Preuves : [evidence/build-local.json](./evidence/build-local.json), [evidence/build-local.log](./evidence/build-local.log), [evidence/typecheck-clean.json](./evidence/typecheck-clean.json), [evidence/typecheck-clean.log](./evidence/typecheck-clean.log).

**Reproduction / contrôle :** Sous Node22, fournir uniquement les paramètres Supabase locaux en mémoire puis lancer build et tsc --noEmit --incremental false.

**Observé :** Compilation Next réussie, puis TS2589 sur le scope générique digest. Le typecheck incrémental initial passait.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Candidat non construisible dans les conditions contrôlées ; le cache peut masquer le défaut.

**Correction recommandée :** Simplifier le contrat de la requête typée sans any de contournement ; inclure un typecheck propre dans la recette.

**Critère de non-régression :** Build et tsc à froid depuis installation propre, avec conservation des types des filtres.

**Portée et limites :** L'échec initial sans variables est séparé de cet échec de code ; aucun secret n'a été écrit.

<a id="rel-05"></a>

## REL-05 — Lint, tests web et tooling ne sont pas verts

- Domaine : Qualité. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Exécutions et lecture des causes.
- Sources : [apps/web/modules/franchise/ui/franchise-access-state.tsx:82](<../../../apps/web/modules/franchise/ui/franchise-access-state.tsx:82>), [apps/web/modules/admin/ui/admin-side-group.tsx:19](<../../../apps/web/modules/admin/ui/admin-side-group.tsx:19>), [tests/e2e/public/diagnostic-need-integrity.spec.ts:80](<../../../tests/e2e/public/diagnostic-need-integrity.spec.ts:80>), [scripts/release/no-placeholders.test.mjs:18](<../../../scripts/release/no-placeholders.test.mjs:18>).
- Preuves : [evidence/lint.log](./evidence/lint.log), [evidence/unit.log](./evidence/unit.log), [evidence/tooling.log](./evidence/tooling.log), [evidence/e2e-integrity-report.json](./evidence/e2e-integrity-report.json), [evidence/continuation-report.json](./evidence/continuation-report.json).

**Reproduction / contrôle :** Exécuter les commandes consignées et lire les causes, pas seulement les comptes.

**Observé :** Lint : 6 erreurs/15 warnings. Web : 6 échecs/4186 succès/1 skip. Tooling : 3 échecs/103. E2E AR attend une traduction absente alors que le libellé arabe existe.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Gates rouges et contrats de tests désynchronisés ; les erreurs Hooks restent un défaut réel de structure.

**Correction recommandée :** Corriger les Hooks conditionnels et fixtures Router, acter le contrat 403, actualiser les attentes de traduction ; documenter Windows/symlinks.

**Critère de non-régression :** Suites initiales vertes sans supprimer assertions ; garder la sonde séparée de continuation FR→AR.

**Portée et limites :** Les six échecs unitaires ne sont pas six pannes utilisateur ; les deux échecs E2E AR ne prouvent pas une régression de traduction.

<a id="rel-06"></a>

## REL-06 — Le contenu des visas n'est pas validé

- Domaine : Release. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Validation en mémoire.
- Sources : [scripts/release/manifest.mjs:19](<../../../scripts/release/manifest.mjs:19>), [scripts/release/manifest.mjs:36](<../../../scripts/release/manifest.mjs:36>), [scripts/release/manifest.test.mjs:42](<../../../scripts/release/manifest.test.mjs:42>).
- Preuves : [reviewers/architecture.md](./reviewers/architecture.md).

**Reproduction / contrôle :** Référencer un fichier quelconque avec son bon hash comme artefact d'approbation.

**Observé :** Les contrôles d'intégrité/confinement passent sans vérifier décision, candidat ou cohérence du signataire.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Des pièces étrangères peuvent satisfaire cette partie du gate automatique.

**Correction recommandée :** Valider le schéma et la cohérence du visa, le candidat et l'indépendance attendue.

**Critère de non-régression :** Rejeter document quelconque, mauvais candidat et auto-revue incompatible.

**Portée et limites :** Les autres contrôles techniques du manifeste subsistent ; aucune release frauduleuse complète n'est démontrée.

<a id="rel-07"></a>

## REL-07 — Les preuves atomiques et la couverture exigée restent incomplètes

- Domaine : Qualité. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Inventaire et configuration.
- Sources : [docs/specs/registries/screens.yaml:3](<../../../docs/specs/registries/screens.yaml:3>), [apps/web/vitest.config.ts:5](<../../../apps/web/vitest.config.ts:5>), [scripts/release/run-checks.mjs:19](<../../../scripts/release/run-checks.mjs:19>).
- Preuves : [evidence/phase00.log](./evidence/phase00.log), [evidence/inventory.json](./evidence/inventory.json), [reviewers/product.md](./reviewers/product.md), [reviewers/architecture.md](./reviewers/architecture.md).

**Reproduction / contrôle :** Compter les contrats de registres, comparer aux routes et examiner les collecteurs de couverture.

**Observé :** Deux écrans atomiques, un formulaire et deux API dans les registres initiaux ; pas de seuil de couverture exécutable ; 5/68 statuts historiques VERIFIED.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Les gates de structure ne démontrent pas la couverture exhaustive des 68 fonctions ou des branches critiques.

**Correction recommandée :** Réconcilier les contrats et mesurer la couverture utile ; lier preuves et visas au candidat.

**Critère de non-régression :** Détection des routes/actions non référencées ; seuils du Gold Master sur les branches critiques.

**Portée et limites :** Les sorties de phase00 disent explicitement que P01 reste ouverte. Présence de code distincte d'une preuve d'acceptation.

<a id="arch-01"></a>

## ARCH-01 — Le web n'hérite pas de plusieurs options strictes requises

- Domaine : Architecture. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Options effectives TypeScript calculées.
- Sources : [apps/web/tsconfig.json:2](<../../../apps/web/tsconfig.json:2>).
- Preuves : [evidence/source-probes.json](./evidence/source-probes.json).

**Reproduction / contrôle :** Résoudre les configurations via l'API TypeScript.

**Observé :** strict=true, mais noUncheckedIndexedAccess/exactOptionalPropertyTypes/noImplicitOverride/noFallthroughCasesInSwitch=false dans le web, true à la racine et au worker.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Le typecheck web ne garantit pas le standard TypeScript annoncé.

**Correction recommandée :** Centraliser les options et traiter explicitement les incompatibilités révélées.

**Critère de non-régression :** Contrôler les options résolues de toutes les applications en CI.

**Portée et limites :** Aucune activation d'option ou correction applicative effectuée pendant l'audit.

<a id="arch-02"></a>

## ARCH-02 — Les packages de domaine et le contrôle de frontières restent largement déclaratifs

- Domaine : Architecture. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Analyse source et validateur.
- Sources : [packages/application/src/index.ts:1](<../../../packages/application/src/index.ts:1>), [packages/contracts/src/index.ts:1](<../../../packages/contracts/src/index.ts:1>), [scripts/validate-boundaries.ts:45](<../../../scripts/validate-boundaries.ts:45>).
- Preuves : [reviewers/architecture.md](./reviewers/architecture.md).

**Reproduction / contrôle :** Examiner les exports, imports workspace réels et surfaces parcourues par le validateur.

**Observé :** Application/contrats/forms/workflows sont minimaux ; le gate des packages ne vérifie pas les dépendances effectives du web.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Écart entre architecture cible et architecture contrôlée, risque de couplage et dette de maintenance.

**Correction recommandée :** Documenter l'architecture réellement retenue puis migrer par use cases et contrôler aussi les applications.

**Critère de non-régression :** Tests de frontières avec imports interdits depuis apps et preuve des contrats utilisés.

**Portée et limites :** Le métier n'est pas déclaré absent : beaucoup de règles sont implémentées en SQL et modules web.

<a id="arch-03"></a>

## ARCH-03 — La pagination de transport charge toujours tout l'historique

- Domaine : Performance. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Fonction source exécutée avec transport synthétique.
- Sources : [apps/web/modules/shared/lib/data/read-pages.ts:2](<../../../apps/web/modules/shared/lib/data/read-pages.ts:2>), [apps/web/modules/provider/data/billing/workspace.ts:13](<../../../apps/web/modules/provider/data/billing/workspace.ts:13>), [apps/web/modules/franchise/data/crm/repository.ts:73](<../../../apps/web/modules/franchise/data/crm/repository.ts:73>).
- Preuves : [evidence/source-probes.json](./evidence/source-probes.json).

**Reproduction / contrôle :** Appeler readAllPages sur un transport synthétique de 100000 lignes.

**Observé :** 201 appels séquentiels et 100000 lignes accumulées avant retour ; plusieurs ensembles sont chargés ainsi pour un workspace.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Coût réseau et mémoire proportionnel à tout l'historique pour afficher une page.

**Correction recommandée :** Pagination métier côté serveur, bornes de période, agrégats et index adaptés.

**Critère de non-régression :** Nombre de requêtes et volume retourné bornés lorsque l'historique croît.

**Portée et limites :** Pas de mesure réelle du p95 ni de test de charge production.

<a id="arch-04"></a>

## ARCH-04 — Des erreurs métier différentes deviennent indiscernables

- Domaine : Architecture. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Exécution du helper avec RPC simulées.
- Sources : [apps/web/modules/admin/screens/incitations/actions.ts:2](<../../../apps/web/modules/admin/screens/incitations/actions.ts:2>), [apps/web/modules/admin/screens/incitations/actions.test.ts:13](<../../../apps/web/modules/admin/screens/incitations/actions.test.ts:13>).
- Preuves : [reviewers/architecture.md](./reviewers/architecture.md).

**Reproduction / contrôle :** Faire retourner 42501 puis 23505 à la dépendance RPC du helper.

**Observé :** Réponse identique status:error sans code sûr discriminant ni référence de requête.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** L'interface et le support confondent refus, conflit et indisponibilité.

**Correction recommandée :** Conserver un résultat typé avec code stable et corrélation, sans détails sensibles.

**Critère de non-régression :** Succès, validation, refus, conflit et indisponibilité distingués.

**Portée et limites :** Exemple inspecté, pas affirmation que toutes les commandes du dépôt ont ce défaut.

<a id="prod-01"></a>

## PROD-01 — Le besoin sans service précis n'a pas de reprise exploitable

- Domaine : Produit. Gravité : **Haute** ; priorité proposée : **P1**.
- État : Non-conformité confirmée. Preuve : Chemin de code complet inspecté.
- Sources : [apps/web/modules/public/ui/journey/need-flow.tsx:727](<../../../apps/web/modules/public/ui/journey/need-flow.tsx:727>), [apps/web/modules/client/screens/demandes/need-context.ts:108](<../../../apps/web/modules/client/screens/demandes/need-context.ts:108>), [supabase/migrations/20260915020200_public_need_intake.sql:65](<../../../supabase/migrations/20260915020200_public_need_intake.sql:65>).
- Preuves : [reviewers/product.md](./reviewers/product.md).

**Reproduction / contrôle :** Suivre la branche sans serviceCode après enregistrement : effacement local, intake DRAFT_REVIEW puis lien vers la liste des demandes.

**Observé :** La conversion dépend d'un code service ; aucune file de reprise des intakes non classés n'a été trouvée dans les routes inspectées.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Rupture de l'entrée commerciale pour un besoin que le client ne sait pas classifier.

**Correction recommandée :** Conserver une reprise durable, exposer une qualification humaine et la conversion liée au même intake.

**Critère de non-régression :** Sauvegarde/rechargement/qualification/conversion sans service précis en FR/AR.

**Portée et limites :** Enregistrement authentifié de bout en bout non exécuté ; constat source, pas abandon commercial mesuré.

<a id="prod-02"></a>

## PROD-02 — La restauration du besoin perd l'organisation explicite

- Domaine : Produit. Gravité : **Haute** ; priorité proposée : **P1**.
- État : Non-conformité confirmée. Preuve : Source + évaluation déterministe des helpers.
- Sources : [apps/web/modules/public/ui/journey/need-flow.tsx:196](<../../../apps/web/modules/public/ui/journey/need-flow.tsx:196>).
- Preuves : [reviewers/design.md](./reviewers/design.md).

**Reproduction / contrôle :** Initialiser l'organisation B avec deux organisations autorisées, puis restaurer sans brouillon.

**Observé :** Le fallback blank omet initialOrganizationId ; le composeur peut choisir la première organisation A.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Préparation d'une demande dans une organisation différente du contexte choisi, sans fuite hors des memberships démontrée.

**Correction recommandée :** Conserver l'organisation explicite et ne jamais la remplacer silencieusement par un ancien brouillon ou un défaut.

**Critère de non-régression :** Deux organisations : stockage vide, invalide, expiré et ancien brouillon ; refus de soumettre tant que le contexte n'est pas confirmé.

**Portée et limites :** Pas de création réelle de demande dans la mauvaise organisation pendant l'audit.

<a id="prod-03"></a>

## PROD-03 — Les réponses du besoin sont tronquées silencieusement

- Domaine : Produit. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Expression de sérialisation exécutée en mémoire.
- Sources : [apps/web/modules/public/ui/journey/need-flow.tsx:745](<../../../apps/web/modules/public/ui/journey/need-flow.tsx:745>), [apps/web/app/[locale]/(public)/besoin/actions.ts:113](<../../../apps/web/app/[locale]/(public)/besoin/actions.ts:113>).
- Preuves : [reviewers/product.md](./reviewers/product.md).

**Reproduction / contrôle :** Combiner 1200 caractères de contraintes avec une réponse structurée puis appliquer l'expression source.

**Observé :** La charge sauvegardée s'arrête à 1200 caractères et la réponse site.count est absente.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Perte de préremplissage et ressaisie malgré succès affiché.

**Correction recommandée :** Stocker séparément champs libres, classification et réponses structurées ; validation de taille explicite.

**Critère de non-régression :** Conservation exacte aux tailles limites et lors de la conversion en demande.

**Portée et limites :** Preuve en mémoire et chemin source ; pas d'enregistrement persistant de données utilisateur.

<a id="prod-04"></a>

## PROD-04 — La projection embarquée exclut les nouveaux services publiés

- Domaine : Produit. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Helper source exécuté en mémoire.
- Sources : [apps/web/modules/public/data/need-intent/model.ts:20](<../../../apps/web/modules/public/data/need-intent/model.ts:20>), [apps/web/modules/public/data/need-intent/model.ts:52](<../../../apps/web/modules/public/data/need-intent/model.ts:52>), [apps/web/app/[locale]/(public)/besoin/actions.ts:193](<../../../apps/web/app/[locale]/(public)/besoin/actions.ts:193>).
- Preuves : [reviewers/product.md](./reviewers/product.md).

**Reproduction / contrôle :** Passer un code connu puis un nouveau code au helper de classification.

**Observé :** Le nouveau code est rejeté même si la découverte amont pourrait le lire depuis une publication DB.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** L'autonomie de publication ne suffit pas à rendre un nouveau service découvrable sans reconstruire la projection.

**Correction recommandée :** Aligner validation et découverte sur le catalogue publié versionné courant.

**Critère de non-régression :** Publier un nouveau code en test et l'utiliser sans rebuild frontend.

**Portée et limites :** Aucun nouveau service créé en base partagée ; exemple de code nouveau synthétique.

<a id="demo-01"></a>

## DEMO-01 — Les overlays démo masquent le réel et coupent des parcours

- Domaine : Produit. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Source + helpers purs.
- Sources : [apps/web/modules/client/screens/spaces/boards.tsx:364](<../../../apps/web/modules/client/screens/spaces/boards.tsx:364>), [apps/web/app/[locale]/administration/candidatures-franchise/page.tsx:129](<../../../apps/web/app/[locale]/administration/candidatures-franchise/page.tsx:129>), [apps/web/modules/admin/screens/franchise-applications/review-forms.tsx:92](<../../../apps/web/modules/admin/screens/franchise-applications/review-forms.tsx:92>).
- Preuves : [reviewers/product.md](./reviewers/product.md).

**Reproduction / contrôle :** Activer le gate démo dans une lecture source et comparer listes, liens et dépendances d'approbation.

**Observé :** Demandes persistées remplacées par cinq cartes sans lien vers une fiche demande ; candidature synthétique CONTRACT_PENDING sans invitation/approval nécessaires.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Film de démonstration non équivalent à une chaîne persistée et navigation circulaire.

**Correction recommandée :** Fixtures synthétiques persistées et reliées ; couche d'affichage ne remplaçant pas les identifiants métier actionnables.

**Critère de non-régression :** Liste→fiche→devis et candidature→approbation→invitation→activation sur les mêmes identifiants.

**Portée et limites :** Démo désactivée dans les sondes navigateur ; défaut source en développement/staging, pas activation en production alléguée. Le diff staged candidatures ne modifie que son type de territoire.

<a id="ux-01"></a>

## UX-01 — L'inscription fournisseur impose la classification avant de continuer

- Domaine : Design. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Source + observation navigateur.
- Sources : [apps/web/app/[locale]/(public)/fournisseur/provider-taxonomy-selector.tsx:82](<../../../apps/web/app/[locale]/(public)/fournisseur/provider-taxonomy-selector.tsx:82>), [apps/web/app/[locale]/(public)/fournisseur/provider-taxonomy-selector.tsx:312](<../../../apps/web/app/[locale]/(public)/fournisseur/provider-taxonomy-selector.tsx:312>).
- Preuves : [reviewers/design.md](./reviewers/design.md), [evidence/screenshots/fr-fournisseur-360.png](./evidence/screenshots/fr-fournisseur-360.png).

**Reproduction / contrôle :** Renseigner seulement la description d'activité, sans sélectionner de service ni ouvrir le champ non répertorié.

**Observé :** hasIntent ignore activity ; le lien de continuation reste aria-disabled et hors Tab.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Entrée annoncée guidée, mais catalogue/classification imposés à un fournisseur qui sait seulement décrire son activité.

**Correction recommandée :** Autoriser la poursuite d'une description suffisante et faire qualifier la classification ensuite.

**Critère de non-régression :** Description libre seule, services suggérés facultatifs et reprise sans perte du texte.

**Portée et limites :** Le choix explicite d'un service peut rester un raccourci, pas une condition imposée.

<a id="ux-02"></a>

## UX-02 — Changer de langue abandonne le détail et la version d'une offre

- Domaine : Design. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Construction des liens sur source.
- Sources : [apps/web/app/[locale]/client/demandes/[requestId]/offres/[quoteId]/page.tsx:52](<../../../apps/web/app/[locale]/client/demandes/[requestId]/offres/[quoteId]/page.tsx:52>), [apps/web/modules/client/ui/client-app-shell.tsx:22](<../../../apps/web/modules/client/ui/client-app-shell.tsx:22>).
- Preuves : [reviewers/design.md](./reviewers/design.md).

**Reproduction / contrôle :** Construire le shell de détail sans languagePath et suivre son lien de langue.

**Observé :** Le fallback reconstruit la liste requests, sans identifiants demande/offre/version.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Perte de contexte dans une décision commerciale.

**Correction recommandée :** Transmettre chemin complet et paramètres sûrs.

**Critère de non-régression :** FR→AR→FR avec organisation, demande, offre et version conservées.

**Portée et limites :** Pas de session Client navigateur disponible pour un clic authentifié réel.

<a id="a11y-01"></a>

## A11Y-01 — Le CTA financier blanc sur corail est sous AA

- Domaine : Accessibilité. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Source + calcul de contraste.
- Sources : [apps/web/modules/client/ui/client-experience.css:2518](<../../../apps/web/modules/client/ui/client-experience.css:2518>), [apps/web/modules/client/screens/spaces/boards.tsx:653](<../../../apps/web/modules/client/screens/spaces/boards.tsx:653>).
- Preuves : [reviewers/design.md](./reviewers/design.md).

**Reproduction / contrôle :** Calculer blanc sur #f86b71 utilisé par la déclaration du CTA Paiements.

**Observé :** Rapport 2,864:1 : sous 4,5:1 pour texte normal et sous 3:1 pour grand texte.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Lecture difficile du libellé.

**Correction recommandée :** Utiliser une paire de tokens AA pour tous les états.

**Critère de non-régression :** Contrastes normal/hover/focus sur le rendu connecté.

**Portée et limites :** Calcul source, rendu connecté effectif non capturé ; les 56 scans publics ne couvrent pas ce composant.

<a id="a11y-02"></a>

## A11Y-02 — Le suivi mission combine un texte très clair et un champ blanc

- Domaine : Accessibilité. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Source + calcul de contraste.
- Sources : [apps/web/app/[locale]/client/missions/[missionId]/page.tsx:47](<../../../apps/web/app/[locale]/client/missions/[missionId]/page.tsx:47>), [apps/web/modules/client/ui/client-experience.css:3232](<../../../apps/web/modules/client/ui/client-experience.css:3232>).
- Preuves : [reviewers/design.md](./reviewers/design.md).

**Reproduction / contrôle :** Suivre le thème follow et les variables de texte du champ de recherche.

**Observé :** #f6f4fb sur blanc : 1,091:1 dans la combinaison de styles inspectée ; thème sombre imposé au suivi.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Texte saisi presque illisible et incohérence de surfaces.

**Correction recommandée :** Associer explicitement couleur de texte et surface conformément aux tokens Version A.

**Critère de non-régression :** Recherche et composants du suivi en FR/AR, focus et saisie longue.

**Portée et limites :** Constat de déclaration CSS ; vérifier la cascade calculée dans une session mission avant sign-off.

<a id="a11y-03"></a>

## A11Y-03 — Les recherches connectées suppriment leur indicateur de focus

- Domaine : Accessibilité. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Analyse de cascade CSS.
- Sources : [apps/web/modules/client/ui/client-experience.css:2007](<../../../apps/web/modules/client/ui/client-experience.css:2007>).
- Preuves : [reviewers/design.md](./reviewers/design.md).

**Reproduction / contrôle :** Comparer .client-shell-search input et le focus global.

**Observé :** outline:none plus spécifique que la règle globale ; aucun remplacement local identifié.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Position clavier non signalée sur les shells réutilisant ce style.

**Correction recommandée :** Indicateur focus-visible ou focus-within explicite, sans supprimer la visibilité.

**Critère de non-régression :** Tab/Shift+Tab dans Client, Provider et Franchise FR/AR.

**Portée et limites :** Contrôle clavier des recherches authentifiées non réalisé.

<a id="a11y-04"></a>

## A11Y-04 — Le menu multiespace exclut summary de sa navigation personnalisée

- Domaine : Accessibilité. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Analyse du focus selector et du gestionnaire Tab.
- Sources : [apps/web/modules/public/ui/site/public-navigation.tsx:22](<../../../apps/web/modules/public/ui/site/public-navigation.tsx:22>), [apps/web/modules/public/ui/site/public-navigation.tsx:58](<../../../apps/web/modules/public/ui/site/public-navigation.tsx:58>), [apps/web/modules/public/ui/site/public-navigation.tsx:102](<../../../apps/web/modules/public/ui/site/public-navigation.tsx:102>).
- Preuves : [reviewers/design.md](./reviewers/design.md).

**Reproduction / contrôle :** Avec plusieurs espaces, ouvrir le menu mobile et examiner les cibles retenues pour chaque Tab.

**Observé :** Le sélecteur ne comprend que liens/boutons, pas summary ; les boutons des details fermés ne sont pas filtrés comme invisibles.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Changement d'espace inaccessible ou focus inefficace dans ce cas.

**Correction recommandée :** Conserver l'ordre natif ou filtrer toutes les cibles visibles, incluant summary.

**Critère de non-régression :** Compte multiespace, menu à 360px, Tab/Shift+Tab/Escape et retour du focus.

**Portée et limites :** Menu anonyme FR/AR fonctionne dans les sondes ; cela ne valide pas le cas multiespace.

<a id="i18n-01"></a>

## I18N-01 — Les services arabes du fournisseur portent lang=fr

- Domaine : Accessibilité. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Source et contenu localisé inspectés.
- Sources : [apps/web/app/[locale]/(public)/fournisseur/provider-taxonomy-selector.tsx:231](<../../../apps/web/app/[locale]/(public)/fournisseur/provider-taxonomy-selector.tsx:231>).
- Preuves : [reviewers/design.md](./reviewers/design.md).

**Reproduction / contrôle :** Examiner listes et sélections arabes alimentées par les noms approuvés.

**Observé :** lang=fr imposé à plusieurs libellés alors que les textes peuvent être arabes.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Prononciation incorrecte par les technologies d'assistance.

**Correction recommandée :** Déclarer la langue du texte effectif.

**Critère de non-régression :** Résultats, sélection et tags arabes avec lecteur d'écran.

**Portée et limites :** Pas de session NVDA/VoiceOver ; les noms arabes du besoin dans la sonde de continuation, eux, portent bien lang=ar.

<a id="i18n-02"></a>

## I18N-02 — Des codes métier internes sont exposés sans traduction

- Domaine : Design. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Non-conformité confirmée. Preuve : Analyse des libellés de formulaires.
- Sources : [apps/web/modules/client/screens/recompenses/value-forms.tsx:10](<../../../apps/web/modules/client/screens/recompenses/value-forms.tsx:10>).
- Preuves : [reviewers/design.md](./reviewers/design.md).

**Reproduction / contrôle :** Examiner options et actions des formulaires de récompenses.

**Observé :** CLIENT/PROVIDER, PROFILE_STARTED/VERIFIED/ACTIVE et codes de justificatifs sont utilisés comme libellés.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Compréhension réduite, particulièrement en arabe.

**Correction recommandée :** Dissocier valeurs internes et libellés FR/AR adaptés au rôle.

**Critère de non-régression :** Toutes les options et transitions affichées dans les deux langues.

**Portée et limites :** Exemple ciblé, pas décompte exhaustif de tous les textes non traduits.

<a id="ux-03"></a>

## UX-03 — La navigation française déborde à 1024px

- Domaine : Design. Gravité : **Faible** ; priorité proposée : **P3**.
- État : Non-conformité confirmée. Preuve : Navigateur réel, reproduction ciblée.
- Sources : [apps/web/modules/public/ui/site/public-navigation.tsx:85](<../../../apps/web/modules/public/ui/site/public-navigation.tsx:85>).
- Preuves : [evidence/targeted-browser.json](./evidence/targeted-browser.json), [evidence/screenshots/fr-home-1024-targeted.png](./evidence/screenshots/fr-home-1024-targeted.png).

**Reproduction / contrôle :** Ouvrir /fr puis /fr/diagnostic à 1024px.

**Observé :** Largeur de contenu 1046 puis 1026 pour un viewport de 1024 ; navigation desktop et CTA dépassent.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Défilement horizontal et CTA en bord de fenêtre sur tablette/desktop étroit.

**Correction recommandée :** Adapter le breakpoint de navigation ou son encombrement, sans masquer le contenu utile.

**Critère de non-régression :** Aucun débordement à 360/390/768/1024/1440 en FR/AR.

**Portée et limites :** Pas de débordement documenté à 360 dans les pages publiques contrôlées ; les éléments décoratifs hors cadre ne sont pas tous des défauts.

<a id="dep-01"></a>

## DEP-01 — Next.js 16.4.1 est inclus dans deux plages d'avis de sécurité

- Domaine : Sécurité. Gravité : **Moyenne** ; priorité proposée : **P2**.
- État : Risque conditionnel. Preuve : Audit npm + avis primaires vérifiés.
- Sources : [package.json:64](<../../../package.json:64>), [apps/web/package.json:35](<../../../apps/web/package.json:35>).
- Preuves : [evidence/dependencies.log](./evidence/dependencies.log), [evidence/inventory.json](./evidence/inventory.json).

**Reproduction / contrôle :** Exécuter pnpm audit et vérifier les deux advisories officiels.

**Observé :** GHSA-mfr8-8qww-v76h et GHSA-vc7v-qv4w-wrv8, gravité modérée, correctif annoncé 16.4.5.

**Attendu :** préserver les invariants et exigences du Gold Master applicables à ce domaine.

**Impact :** Dette de sécurité de dépendance ; préconditions d'exploitation à contrôler.

**Correction recommandée :** Planifier une mise à jour compatible et ses tests ; ne pas modifier les versions pendant cet audit.

**Critère de non-régression :** Build, caches, isolation par locale/tenant et régression applicative après mise à jour.

**Portée et limites :** Aucun cacheComponents/use cache/unstable_cache applicatif trouvé dans le périmètre inspecté ; exploitation non démontrée.
