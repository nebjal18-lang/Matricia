# MATRICIA — GOLD MASTER PROMPT UNIQUE CODEX V4 FINAL — 2026-09-10

## PRIORITÉ ET RÈGLE DE PRÉCÉDENCE

Ce fichier remplace toutes les versions antérieures du prompt (V1, V2 et V3). En cas de contradiction, les sections **ADDENDUM GOLD MASTER — CATALOGUE MÉTIER, SERVICES ET 6 000 QUESTIONS** et **GÉNÉRATEUR DÉTERMINISTE INTÉGRÉ** ont priorité sur toute exigence antérieure de volume ou de contenu.

Tu dois développer Matricia V1 de bout en bout et ne pas laisser Codex inventer arbitrairement les bibliothèques ou les questions. La base de départ est déterministe : 10 bibliothèques, 40 grandes catégories, 80 sous-catégories, 200 services, 5 000 questions RFQ/devis, 700 questions diagnostic et 300 questions de qualification fournisseur. Tous ces contenus sont importés automatiquement, versionnés et ensuite administrables par les franchisés selon leurs permissions.

## DÉCISIONS MÉTIER LES PLUS RÉCENTES — PRIORITÉ ABSOLUE

Les règles suivantes ont priorité sur toute formulation ancienne résiduelle :

1. **Franchise IT** : opérateur/franchisé = **Hatim Ahmitech**.
2. **Droit d’entrée IT** : Hatim Ahmitech est totalement exempté : montant 0, aucun acompte, aucun étalement, aucune retenue sur gains au titre du droit d’entrée.
3. **Partage IT** : ce n’est pas un partage du chiffre d’affaires. Le **bénéfice distribuable IT** est partagé **50 % Hatim Ahmitech / 50 % Jalil-NEOXA** ; Mme Asma/Matricia = 0 % de cette distribution IT spécifique.
4. **Autres franchises** : sauf règle contractuelle versionnée plus spécifique, 50 % franchisé / 25 % Jalil-NEOXA / 25 % Mme Asma-Matricia sur la base distribuable définie.
5. **Pot Core + droits d’entrée (hors IT)** — décision Jalil 2026-11-12 : `CORE_SUBSCRIPTION_REVENUE` et les droits d’entrée franchise (ledger `franchise_entry_fee`, IT = 0) forment un **pot Matricia distinct** des P&L franchise. Ordre obligatoire : (a) encaissements HT acquis de ce pot ; (b) déduction marketing + charges d’exploitation clairement affectées à ce pot (versionnées, auditées, sans float) ; (c) le **reste distribuable** est partagé **50 % Jalil-NEOXA / 50 % Mme Asma-Matricia**. Ce pot ne modifie pas les parts IT 50/50 Hatim–Jalil ni les parts 50/25/25 des autres franchises. La TVA n’entre jamais dans ce pot comme revenu.
6. **Fiscalité Maroc** : intégrer un moteur fiscal marocain versionné. Pour les prestations soumises au taux normal, le taux de référence/démo est 20 %, mais aucun taux n’est codé en dur ; chaque ligne utilise une catégorie fiscale et une règle datée d’effet. Les factures doivent être capables de satisfaire les mentions et séries continues requises par le CGI 2026, sous réserve de validation finale par l’expert-comptable.
7. **Facturation sous-traitants** : la clôture mensuelle est automatique : pré-relevé → résolution des exceptions → relevé officiel → facture → PDF → envoi in-app/email → délai de paiement standard 7 jours → rappels → restriction financière si impayé. L’humain n’intervient que pour les exceptions/contestations.
8. **Contrôle franchisé** : chaque franchisé fait l’objet d’un contrôle continu sur acquisition, qualité de bibliothèque, réseau de sous-traitants, opérations, satisfaction, conformité et finance ; score, alertes, plan correctif, audit mensuel et supervision admin sont obligatoires. Un score/flag ne résilie jamais automatiquement une franchise.

Avant toute phase métier :

1. crée le fichier `scripts/matricia_catalog_build.py` avec le code intégré à la fin de ce prompt ;
2. exécute-le ;
3. vérifie le manifeste ;
4. importe la base en staging puis en tables versionnées ;
5. produit les traductions arabes et bloque la release tant qu'elles ne sont pas complètes ;
6. prouve par tests que chaque franchisé peut ajouter, modifier, dupliquer, réordonner, désactiver et archiver ses services/questions sans accès aux autres bibliothèques ;
7. n'affiche jamais les 6 000 questions en même temps au client : utilise préremplissage, conditions et questions manquantes par service.

---

# MATRICIA V1 — GOLD MASTER V4 ONE-SHOT PROMPT POUR CODEX

> **Mode d’emploi :** place ce fichier à la racine du dépôt Matricia, ouvre Codex depuis cette racine, puis donne à Codex l’instruction : **« Exécute intégralement le présent Gold Master Prompt jusqu’à la release V1. »**  
> Ce document est volontairement autonome. Il contient le contrat d’exécution, les règles de gouvernance, les exigences de qualité, le modèle métier et, en annexe, le cahier des charges complet. Il ne dépend d’aucune conversation antérieure.

---

# 0. IDENTITÉ DE LA MISSION

Tu es **l’orchestrateur principal, directeur technique, architecte produit et responsable de livraison** de Matricia V1. Tu ne dois pas produire une simple maquette, un squelette, une démonstration factice ou une liste de recommandations. Tu dois construire, dans le dépôt courant, une application complète, cohérente, testée, sécurisée, documentée et déployable.

La mission est considérée comme achevée uniquement lorsque :

1. les exigences `MAT-FUNC-001` à `MAT-FUNC-068` sont implémentées et vérifiées ;
2. tous les parcours Client, Sous-traitant, Franchisé et Administrateur sont réellement utilisables ;
3. toutes les données critiques sont persistées, autorisées par RLS, versionnées et auditées ;
4. les fonctionnalités de démonstration ne sont pas des façades : elles utilisent le même domaine, la même base et les mêmes règles que la production ;
5. les tests unitaires, d’intégration, SQL/RLS, contractuels, E2E, accessibilité, sécurité et performance passent ;
6. un clone propre peut installer, migrer, seed, tester, construire et lancer le projet ;
7. aucune ligne `TODO`, `FIXME`, `TBD`, `TO_DEFINE`, `TO_IMPLEMENT`, `PLACEHOLDER`, « à faire plus tard » ou bouton inactif ne subsiste dans le périmètre V1 ;
8. la matrice de traçabilité relie chaque exigence à du code, des tests et une preuve ;
9. les seuls éléments non activés sont ceux qui exigent matériellement des identifiants externes, une validation juridique ou une validation comptable ; leurs adaptateurs, simulateurs et tests doivent néanmoins être terminés.

Les fonctions 69 à 90 mentionnées dans les réflexions antérieures appartiennent à la **V2**. Ne les développe pas en V1, sauf infrastructure générique strictement nécessaire et sans exposer de fonctionnalité V2 dans l’interface.

---

# 1. CONTRAT D’AUTONOMIE

## 1.1 Ne pas interrompre le projet pour des décisions ordinaires

Tu ne demandes pas à l’utilisateur de choisir une bibliothèque technique, un nom de table, une structure de fichier, une couleur, un composant, une stratégie de test ou une convention de code. Tu prends la décision professionnelle la plus sûre, la documentes dans un ADR et avances.

Lorsqu’une valeur commerciale n’est pas définitivement arrêtée :

- utilise la valeur de démonstration fournie dans ce document ;
- rends la valeur modifiable, versionnée et auditable dans l’administration ;
- ne la code jamais en dur dans les composants ou les règles métier.

Lorsqu’un secret externe manque :

- implémente l’adaptateur réel ;
- implémente un adaptateur `demo` déterministe ;
- ajoute un simulateur de webhook ;
- ajoute les tests contractuels ;
- documente les variables dans `.env.example` ;
- poursuis jusqu’à une application totalement fonctionnelle en mode démonstration.

Lorsqu’un texte juridique ou fiscal définitif manque :

- construis le moteur de modèles, variables, versionnage, approbation et signature ;
- fournis un modèle de démonstration explicitement marqué `NON_CONTRACTUAL_DEMO` ;
- ne présente jamais ce texte comme validé juridiquement ;
- inscris l’activation réelle dans `docs/release/EXTERNAL_ACTIVATION_CHECKLIST.md` ;
- ne laisse aucun écran ou workflow vide.

## 1.2 Résolution autonome des ambiguïtés

Applique cet ordre de priorité :

1. décisions métier explicitement figées dans la section **Décisions non négociables** du présent prompt ;
2. exigence la plus spécifique du cahier des charges intégré ;
3. invariant de sécurité, d’intégrité financière ou de confidentialité ;
4. meilleure pratique professionnelle documentée par un ADR ;
5. défaut administrable et versionné.

En cas de contradiction réelle, choisis l’interprétation qui :

- protège le client sans condamner automatiquement le sous-traitant ;
- préserve l’intégrité comptable et l’historique ;
- maintient la séparation entre permission technique et droit économique ;
- réduit le risque de contournement, de double écriture ou de fuite inter-tenant ;
- reste configurable sans migration destructive.

Enregistre la décision dans `docs/decisions/decision-log.md`. Ne bloque pas le développement.

## 1.3 Définition stricte de « 100 % »

Dans ce projet, « 100 % » ne signifie jamais « cela semble terminé ». Cela signifie :

- exigence traçable ;
- écran existant ;
- action connectée au backend ;
- état de chargement, vide, succès, erreur et interdiction traité lorsque pertinent ;
- validation serveur ;
- permission/RLS ;
- audit ;
- notification et événement lorsque requis ;
- tests positifs et négatifs ;
- preuve de recette ;
- documentation.

Ne prétends pas avoir atteint 100 % si une seule de ces preuves manque.

---

# 2. BOOTSTRAP UNIQUE POUR RÉDUIRE LES TOKENS

Ce fichier est un prompt unique, mais il ne doit pas être recopié dans chaque sous-agent. Durant la première phase, transforme-le en mémoire de projet structurée.

## 2.1 Fichiers à créer immédiatement

Crée et maintiens :

```text
AGENTS.md
PLANS.md
.codex/agents/
.agents/skills/
docs/specs/sections/
docs/specs/context-index.json
docs/orchestration/
docs/traceability/
docs/decisions/
docs/progress/PROJECT_STATE.md
docs/progress/phase-ledger.json
scripts/context-pack.ts
scripts/validate-spec.ts
scripts/validate-traceability.ts
scripts/validate-catalog.ts
scripts/validate-no-placeholders.ts
scripts/validate-release.ts
```

`AGENTS.md` doit rester compact et contenir seulement les règles permanentes : architecture, commandes, interdictions, Definition of Done et protocole de handoff. Place les règles propres à un module dans des `AGENTS.md` ou `AGENTS.override.md` plus proches du code concerné lorsque cela réduit le contexte.

`PLANS.md` doit définir un format d’ExecPlan vivant : but, portée, invariants, jalons, décisions, risques, validation, journal d’avancement et résultats. Toute phase majeure doit avoir son ExecPlan mis à jour pendant l’exécution.

## 2.2 Skills locales à générer

Crée au minimum les skills suivantes sous `.agents/skills/<nom>/SKILL.md`. Chaque description doit préciser clairement quand la skill doit être chargée et quand elle ne doit pas l’être :

```text
matricia-domain-invariants
matricia-code-quality
matricia-supabase-rls
matricia-auth-organizations
matricia-client-compliance
matricia-provider-qualification
matricia-franchise-governance
matricia-library-catalog
matricia-question-rule-engine
matricia-diagnostics-opportunities
matricia-subscriptions-payments
matricia-boxes-benefits-credits
matricia-rfq-quotes-matching
matricia-contracts-missions
matricia-disputes-reassignment
matricia-provider-billing
matricia-franchise-finance
matricia-volume-procurement
matricia-admin-command-center
matricia-design-system
matricia-i18n-rtl-accessibility
matricia-demo-content
matricia-testing-security-release
```

Chaque skill doit contenir :

- les invariants du domaine ;
- les tables et interfaces principales ;
- les états et transitions ;
- les erreurs stables ;
- les tests obligatoires ;
- les fichiers propriétaires ;
- les références aux IDs d’exigences ;
- aucune répétition inutile du cahier complet.

## 2.3 Protocole de contexte

Implémente `scripts/context-pack.ts` afin de produire un paquet minimal pour une mission donnée à partir de :

- IDs `MAT-FUNC` ;
- IDs d’écrans ;
- domaine ;
- tables concernées ;
- contrats API ;
- transitions ;
- tests attendus.

Le fil principal conserve uniquement les décisions, l’état des phases et les résultats. Les journaux détaillés, sorties de tests, plans SQL et captures vont dans `artifacts/` ou `docs/evidence/`, puis les agents retournent une synthèse structurée avec chemins de fichiers. Ne pollue pas le contexte principal avec des milliers de lignes de logs.

## 2.4 Handoff obligatoire des agents

Chaque agent retourne un fichier JSON ou Markdown contenant au maximum les éléments utiles :

```yaml
mission_id:
requirements:
files_read:
files_changed:
migrations:
commands_run:
tests:
security_notes:
open_risks:
decisions:
evidence_paths:
recommended_merge_order:
```

Les agents n’incluent pas les logs complets dans leur message. Ils les déposent dans le dépôt.

---

# 3. ORCHESTRATION MULTI-AGENTS

Utilise autant d’agents spécialisés que le travail le justifie, mais jamais au prix de conflits de fichiers ou d’une qualité moindre. Les tâches de lecture, exploration, audit, tests et revue peuvent être fortement parallélisées. Les écritures sont séparées par domaine et worktree.

Si les agents personnalisés sont disponibles, crée leurs configurations. Sinon, utilise les types disponibles (`explorer`, `worker`, agent général) avec le contrat de rôle ci-dessous.

## 3.1 Agents obligatoires

### Direction, analyse et architecture

1. `program_orchestrator` — propriétaire du plan global, des dépendances et des gates.
2. `repo_explorer` — inventaire du dépôt, lecture seule.
3. `requirements_architect` — décomposition atomique du cahier, lecture seule hors docs.
4. `chief_architect` — architecture, ADR, frontières de modules.
5. `domain_modeler` — agrégats, invariants, value objects et state machines.
6. `database_architect` — PostgreSQL, migrations, index, contraintes, transactions.
7. `api_contract_architect` — commandes/requêtes, schémas, erreurs et OpenAPI.
8. `event_workflow_architect` — outbox, événements, retries, cron et idempotence.

### Identité, accès et sécurité

9. `auth_identity_agent` — OTP, mot de passe facultatif, sessions, organisations.
10. `rbac_rls_agent` — permissions, scopes et politiques RLS.
11. `security_architect` — threat model et secure-by-design.
12. `security_red_team` — audit offensif indépendant, lecture seule.
13. `privacy_data_agent` — classification, minimisation, rétention et export.

### Produit et métiers

14. `client_onboarding_agent` — inscription, conformité, questions et résultats client.
15. `provider_onboarding_agent` — inscription et validation société du sous-traitant.
16. `provider_qualification_agent` — qualifications par service, documents et capacité.
17. `franchise_governance_agent` — franchise, droits, frais d’entrée et invitations.
18. `library_catalog_agent` — bibliothèques, catégories, services et versionnage.
19. `question_engine_agent` — Question Builder, Rule Builder et simulation.
20. `diagnostics_agent` — scoring, anomalies, risques, recommandations et opportunités.
21. `rfq_matching_agent` — demandes, panel, équité, capacité et matching.
22. `quote_agent` — devis, versions, négociation, comparaison et feedback.
23. `contract_mission_agent` — contrats, avenants, missions, jalons et preuves.
24. `dispute_agent` — avertissement, contradictoire, décision et réaffectation.
25. `subscription_agent` — essai, plans, cycles, upgrade/downgrade.
26. `boxes_credits_agent` — avantages, Boxes, wallet et consommations.
27. `payments_agent` — CMI, PayPal, adaptateur demo et webhooks.
28. `provider_finance_agent` — commission, relevé, facture, paiement et recouvrement.
29. `franchise_finance_agent` — répartition IT Hatim/NEOXA 50/50 du bénéfice distribuable, autres franchises 50/25/25 et P&L.
30. `volume_procurement_agent` — SKU, contrats-cadres, pools et rebates.
31. `admin_command_center_agent` — supervision totale et files de travail.
32. `notifications_agent` — modèles FR/AR, préférences, digests et SLA.

### UX, contenu et qualité

33. `ux_information_architect` — navigation, parcours et réduction de complexité.
34. `luxury_design_system_agent` — design system, composants et dashboards.
35. `frontend_client_agent` — expérience Client.
36. `frontend_provider_agent` — expérience Sous-traitant.
37. `frontend_franchise_agent` — expérience Franchisé.
38. `frontend_admin_agent` — expérience Administrateur.
39. `i18n_rtl_accessibility_agent` — FR/AR, RTL, clavier, lecteurs d’écran.
40. `demo_data_agent` — seeds cohérents et scénarios.
41. `domain_content_agent` — contenu des dix bibliothèques.
42. `arabic_content_reviewer` — contrôle indépendant des textes arabes.

### Validation et livraison

43. `unit_integration_test_agent` — tests domaine/application/intégration.
44. `database_rls_test_agent` — pgTAP/SQL/RLS et concurrence.
45. `browser_e2e_agent` — Playwright, parcours et captures.
46. `accessibility_qa_agent` — axe, clavier, contrastes et RTL.
47. `performance_agent` — budgets, SQL, N+1 et charge.
48. `observability_agent` — logs, métriques, traces et alertes.
49. `code_quality_reviewer` — revue indépendante de maintenabilité.
50. `financial_integrity_auditor` — ledgers, allocations, idempotence.
51. `requirements_traceability_auditor` — couverture 68/68 et écrans.
52. `integration_manager` — fusion des branches et exécution des gates.
53. `release_manager` — décision finale de release, sans écrire le produit.
54. `documentation_curator` — documentation, runbooks et handoff.
55. `morocco_tax_compliance_agent` — moteur TVA/facturation Maroc 2026, catégories fiscales, numérotation et tests fiscaux ; toute hypothèse non validée reste configurable.
56. `franchise_performance_auditor` — contrôle continu des franchisés, KPI, favoritisme, plans correctifs et audit mensuel/trimestriel ; lecture indépendante pour les sanctions.
57. `billing_automation_auditor` — vérifie clôture mensuelle, relevés, factures, TVA, idempotence, relances, paiements partiels et exceptions.

## 3.2 Règles de parallélisme

- Travaille par vagues de tâches indépendantes.
- N’autorise jamais deux agents à écrire simultanément dans le même fichier ou la même migration.
- Une branche/worktree par domaine d’écriture : `feat/pXX-domain`.
- Les fichiers partagés (`package.json`, lockfile, schéma racine, tokens, route registry) ont un propriétaire unique par vague.
- Les agents d’audit ne modifient pas le code audité ; ils ouvrent des findings avec preuve.
- L’intégrateur fusionne en ordre de dépendance et relance toute la suite.
- Après trois échecs similaires, lance un agent de diagnostic racine indépendant plutôt que de répéter la même tentative.
- Attends les audits critiques avant de fermer une phase.

## 3.3 File ownership

Crée `docs/orchestration/file-ownership-map.csv` avec :

```text
wave,agent,paths,mode,dependencies,merge_order
```

Un agent ne modifie aucun chemin hors de son périmètre sans transfert explicite de propriété consigné.

---

# 4. DÉCISIONS MÉTIER NON NÉGOCIABLES

1. **Une entreprise = une organisation unique**, pouvant cumuler les rôles Client, Sous-traitant et Franchisé.
2. L’ICE est le premier identifiant de détection de doublon lorsqu’il existe ; un doublon déclenche rattachement/fusion contrôlée, jamais une duplication silencieuse.
3. Connexion principale par **code OTP envoyé par courriel** ; mot de passe facultatif.
4. L’essai client dure **30 jours calendaires après validation et activation**, sans carte ni moyen de paiement obligatoire.
5. Après l’essai, le client doit activer **Premium, Gold ou Platinum** pour lancer de nouvelles fonctions actives. Il garde l’accès à ses données, contrats, missions et obligations existantes.
6. Les abonnements offrent des **avantages spécifiques**, pas seulement une réduction en pourcentage.
7. Chaque plan combine : droits permanents + privilèges + Box + crédits mensuels + achat possible de crédits supplémentaires.
8. Les Boxes sont configurables par l’administration et personnalisables selon le plan.
9. Les crédits utilisent un ledger ; jamais de modification directe d’un solde.
10. Une bibliothèque utilise un moteur universel ; elle ne constitue pas une application séparée.
11. Il existe un franchisé actif maximum par bibliothèque/domaine.
12. Le franchisé prépare et maintient les questions, règles, anomalies, recommandations, opportunités et services de sa bibliothèque.
13. Chaque franchisé peut inviter ses clients et ses sous-traitants depuis son dashboard ; l’origine est traçable.
14. La franchise IT est confiée à **Hatim Ahmitech**. Hatim est **exempt de tout droit d’entrée de franchise IT**. Le bénéfice distribuable IT est partagé **50 % Hatim Ahmitech / 50 % Jalil-NEOXA**. Mme Asma/Matricia ne reçoit aucune part du bénéfice distribuable IT au titre de cette règle spécifique. Toute formulation antérieure différente concernant l’IT est annulée et ne doit pas être utilisée.
15. Pour les autres bibliothèques franchisées : **50 % franchisé, 25 % NEOXA/Jalil, 25 % Mme Asma/Matricia**, sur la base distribuable versionnée.
16. Tous les autres franchisés paient un droit d’entrée comptant ou par retenue sur leur part pendant six mois maximum.
17. Les sous-traitants sont validés au niveau société puis qualifiés séparément pour chaque service.
18. Ils fixent librement leur prix dans les consultations standards.
19. Ils ne sont pas exposés comme catalogue public et ne voient jamais les offres concurrentes.
20. Un sous-traitant peut activer le rôle Client et recevoir des offres d’autres sous-traitants sans créer un second compte.
21. Une organisation ne peut jamais répondre à sa propre demande.
22. Les échanges de consultation passent par Matricia ; les coordonnées directes sont protégées jusqu’à l’étape autorisée.
23. Le diagnostic suit : réponse → règle → anomalie → risque → recommandation → service → opportunité.
24. Lorsque le client clique « Demander des devis », Matricia complète le besoin jusqu’aux données `required_for_quote`, fige une version et lance le matching.
25. La cible est dix sous-traitants ou davantage lorsque le panel éligible le permet.
26. Les devis sont structurés, versionnés, comparables et libres en prix.
27. Les non-retenus reçoivent classement personnel et feedback anonymisé ; le nom et le prix exact du gagnant ne sont pas révélés par défaut.
28. Le contrat client–sous-traitant reprend la demande figée, le devis sélectionné, les clarifications, livrables, critères, délais, exclusions et clauses.
29. Une demande supplémentaire est un avenant ou un nouveau devis, jamais automatiquement une non-conformité.
30. Un signalement client déclenche d’abord un avertissement et une procédure contradictoire.
31. Si la non-conformité au contrat est confirmée : le sous-traitant paie la pénalité prévue, doit la commission Matricia prévue, perd la mission et celle-ci est réaffectée.
32. Cette décision et ses conséquences sont atomiques, idempotentes et auditées.
33. Matricia ne prélève pas dans le compte bancaire du sous-traitant.
34. Matricia envoie pré-relevé, relevé détaillé et facture ; le délai standard est sept jours configurables.
35. Un paiement partiel ne renouvelle pas l’échéance initiale.
36. Après échéance, le compte du sous-traitant est restreint pour les nouvelles opportunités, tout en conservant l’accès aux obligations en cours.
37. Les intérêts ou frais de retard ne sont appliqués que s’ils sont activés dans une règle contractuellement et juridiquement validée.
38. Les achats en volume utilisent des services/SKU standardisés, contrats-cadres, paliers, plusieurs fournisseurs, capacité virtuelle et paiement à la consommation lorsque possible.
39. Les droits techniques et les droits économiques sont stockés et évalués séparément.
40. Tous les taux, prix, crédits, délais, quotas, documents, formules et seuils commerciaux sont administrables et versionnés.

---

# 5. ARCHITECTURE TECHNIQUE CIBLE

## 5.1 Structure du dépôt

Construis un monorepo `pnpm` propre, avec une architecture de monolithe modulaire :

```text
apps/
  web/
  worker/
packages/
  domain/
  application/
  contracts/
  infrastructure/
  ui/
  forms/
  workflows/
  config/
  observability/
  testkit/
supabase/
  migrations/
  functions/
  seed/
tests/
  e2e/
  security/
  performance/
docs/
artifacts/
```

Utilise la version stable, non alpha, mutuellement compatible des outils disponibles au moment de l’exécution et verrouille les versions exactes dans le lockfile. Documente les choix dans les ADR. Ne migre pas vers une technologie expérimentale sans nécessité.

## 5.2 Stack attendue

- Next.js App Router + React + TypeScript strict.
- Supabase PostgreSQL, Auth, Storage privé, RLS, RPC/Edge Functions.
- Vercel pour l’application web.
- Resend pour les courriels, via une interface remplaçable.
- Couche `PaymentGateway` pour CMI, PayPal et adaptateur Demo.
- Zod pour les contrats de données et validations partagées.
- React Hook Form ou équivalent mature pour les formulaires complexes.
- Tests unitaires/intégration avec Vitest ou équivalent stable.
- Tests navigateur Playwright.
- Tests SQL/RLS avec pgTAP ou harness PostgreSQL équivalent.
- CI reproductible.

## 5.3 Frontières de modules

`packages/domain` : entités, value objects, invariants, transitions et événements métier ; aucune dépendance React, Next.js ou Supabase.

`packages/application` : commandes, requêtes, orchestration, autorisation, transactions et ports.

`packages/contracts` : schémas Zod, DTO, codes d’erreur, enveloppes d’événements et contrats API.

`packages/infrastructure` : Supabase, stockage, paiement, email, IA, PDF et observabilité.

`packages/ui` : composants visuels sans règle financière ou transition métier.

`packages/forms` : schémas, moteurs dynamiques, rendu et validation.

`packages/workflows` : state machines et transition guards.

L’UI ne modifie jamais directement une table critique. Toute mutation passe par un use case serveur autorisé.

## 5.4 Conventions de données

- UUID pour les identifiants.
- `timestamptz` UTC pour les instants ; affichage selon le fuseau utilisateur, par défaut `Africa/Casablanca`.
- Montants en unités monétaires mineures `bigint` + devise ISO 4217 ; aucun `float`.
- Pourcentages en points de base ou décimal exact ; aucun calcul flottant non déterministe.
- `row_version` ou mécanisme d’optimistic locking pour les objets éditables.
- `created_at`, `created_by`, `updated_at`, `updated_by`, `status`, `archived_at` lorsque pertinents.
- `organization_id`, `library_id`, `franchise_id` explicites pour le tenant/scope.
- JSONB réservé aux snapshots, payloads d’événements et données véritablement flexibles ; les relations métier principales restent normalisées.
- Contraintes SQL pour les invariants critiques ; ne repose pas uniquement sur le frontend.
- Index pour toutes les FK et requêtes fréquentes ; vérifie les plans.

## 5.5 Versionnage et immutabilité

Les objets publiés ou signés ne sont jamais écrasés :

- questionnaires/questions/règles ;
- services et SKU ;
- devis ;
- contrats et avenants ;
- décisions de litige ;
- factures et avoirs ;
- règles de commission, partage, plan, Box et coût en crédits.

Une correction crée une nouvelle version ou un avoir selon le domaine. Les snapshots utilisés pour un contrat ou une transaction restent accessibles.

## 5.6 Event Outbox et idempotence

Toute mutation importante écrit dans la même transaction :

1. l’état métier ;
2. l’audit ;
3. un événement `event_outbox`.

Chaque événement possède :

```text
event_id
aggregate_type
aggregate_id
event_type
schema_version
occurred_at
actor_id
organization_id
correlation_id
causation_id
idempotency_key
payload
status
attempt_count
next_attempt_at
```

Les consommateurs sont idempotents. Les webhooks externes sont vérifiés, dédupliqués par identifiant fournisseur et rejouables. Ajoute une dead-letter queue et une interface Admin pour les erreurs non résolues.

---

# 6. STANDARD DE CODE PROFESSIONNEL

## 6.1 TypeScript

Active au minimum :

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "useUnknownInCatchVariables": true,
  "noFallthroughCasesInSwitch": true
}
```

Interdictions :

- `any` non justifié ;
- `@ts-ignore` ;
- cast double pour contourner le typage ;
- chaînes libres pour statuts ou permissions ;
- valeurs magiques ;
- calculs financiers dans les composants ;
- accès à `process.env` hors module de configuration validé ;
- `console.log` non structuré ;
- dépendances circulaires ;
- code mort ;
- fonctions monolithiques non testables ;
- duplication métier.

## 6.2 Commandes et requêtes

Chaque commande métier possède :

- un nom explicite ;
- un schéma d’entrée ;
- une autorisation ;
- des préconditions ;
- une transaction ;
- un résultat typé ;
- des codes d’erreur stables ;
- l’audit ;
- les événements ;
- des tests.

Les requêtes ne contournent pas le scope organisation/bibliothèque/franchise.

## 6.3 Erreurs

Utilise une enveloppe stable :

```json
{
  "error": {
    "code": "STABLE_DOMAIN_CODE",
    "message": "localized safe message",
    "field_errors": {},
    "request_id": "uuid"
  }
}
```

La cause interne est journalisée sans PII ou secret. L’utilisateur reçoit une explication actionnable en français ou arabe.

## 6.4 Dépendances

Toute nouvelle dépendance doit :

- résoudre un besoin non couvert ;
- être maintenue et compatible ;
- ne pas dupliquer une dépendance existante ;
- être documentée dans l’ADR ou la PR ;
- passer l’audit des vulnérabilités et licences.

## 6.5 Qualité de commits

- commits atomiques ;
- message conventionnel et descriptif ;
- aucune énorme modification opaque ;
- migrations dans l’ordre ;
- tests dans le même lot que le comportement ;
- pas de refactor hors portée.

---

# 7. SPÉCIFICATION ATOMIQUE AVANT CODAGE

Avant d’implémenter les domaines, crée les registres complets ci-dessous. **Gate 0 : aucun code métier majeur ne démarre tant que ces registres ne contiennent plus aucun champ indéfini pour la phase concernée.**

## 7.1 Contrat d’écran

Chaque écran possède une fiche :

```yaml
screen_id:
route:
name_fr:
name_ar:
actors:
objective:
entry_conditions:
data_sources:
header:
widgets:
tables:
filters:
actions:
forms:
states: [loading, empty, success, error, forbidden]
responsive_behavior:
rtl_behavior:
permissions:
events:
audit:
analytics:
test_cases:
evidence:
```

Un écran de liste doit préciser colonnes, tri, filtres, pagination, actions de ligne, actions massives, export, états vides et permissions.

## 7.2 Contrat de formulaire

Ne crée pas mécaniquement un formulaire par écran. Identifie les vrais formulaires. Chaque formulaire possède :

```yaml
form_id:
screen_id:
purpose:
actors:
autosave:
versioned:
submit_command:
fields:
  - key:
    label_fr:
    label_ar:
    help_fr:
    help_ar:
    type:
    required_when:
    visible_when:
    editable_when:
    default_source:
    data_binding:
    validation:
    normalization:
    sensitive_classification:
    accepted_files:
    max_size:
    error_codes:
    audit_behavior:
    test_id:
form_level_rules:
success_behavior:
error_behavior:
tests:
```

Aucun formulaire publié ne doit avoir un champ sans label, type, validation, binding et règle de permission.

## 7.3 Matrice de permissions

Pour chaque combinaison applicable :

```text
permission_id,resource,action,role,scope,decision,conditions,rls_policy,server_guard,positive_test,negative_test,status
```

`decision` vaut explicitement `ALLOW` ou `DENY`. `scope` vaut explicitement `GLOBAL`, `OWN_ORGANIZATION`, `OWN_LIBRARY`, `OWN_FRANCHISE`, `ASSIGNED_CASE`, `OWN_RECORD`, ou une composition documentée.

Règle : deny by default. L’absence de ligne équivaut à `DENY`.

## 7.4 Contrat API/commande

Pour chaque opération :

```yaml
api_id:
domain:
operation:
transport:
input_schema:
output_schema:
authorization:
preconditions:
transactional:
idempotency:
state_transition:
audit_event:
outbox_events:
errors:
rate_limit:
tests:
```

Génère une documentation OpenAPI ou équivalente pour les endpoints publics/webhooks et une documentation des server actions/RPC internes.

## 7.5 Catalogue d’événements

Chaque événement possède un schéma versionné. Les producteurs, consommateurs, déduplication, retry, ordre et données sensibles sont explicités.

## 7.6 Catalogue des notifications

Chaque notification précise : événement, destinataires, canal, sujet FR/AR, corps FR/AR, CTA, variables, obligatoire/optionnelle, fenêtre de déduplication, préférence utilisateur, test et capture.

## 7.7 Catalogue des state machines

Chaque transition précise :

```text
machine,from,to,actor,command,preconditions,guards,transaction,side_effects,events,notifications,audit,rollback,idempotency,tests
```

Toute transition non listée est interdite.

## 7.8 Gate anti-placeholder

`pnpm spec:validate` doit échouer si l’un des registres contient :

```text
TO_DEFINE
TO_IMPLEMENT
TBD
TODO
FIXME
PLACEHOLDER
UNKNOWN
NOT_STARTED
```

`NOT_STARTED` reste autorisé uniquement dans le journal de phase avant le début d’une phase, jamais dans une spécification déclarée prête.

---

# 8. RBAC ET RLS — POLITIQUE DE BASE

## 8.1 Rôles centraux

```text
SUPER_ADMIN
MATRICIA_ADMIN
COMPLIANCE_MANAGER
FINANCE_MANAGER
DISPUTE_MANAGER
LIBRARY_MANAGER
SUPPORT_AGENT
READ_ONLY_AUDITOR
```

- `SUPER_ADMIN` : toutes les opérations, sauf contournement des invariants financiers ; toute action critique auditable.
- `MATRICIA_ADMIN` : exploitation globale sans accès aux secrets bruts ni suppression d’audit.
- `COMPLIANCE_MANAGER` : organisations, documents, anomalies, questions et validation ; aucun changement de revenu.
- `FINANCE_MANAGER` : plans, factures, paiements, allocations, rapprochements et reporting ; aucune modification de questionnaire ou décision de qualité.
- `DISPUTE_MANAGER` : incidents, preuves, décisions et réaffectations ; aucune modification des règles économiques historiques.
- `LIBRARY_MANAGER` : bibliothèques, services, questionnaires et publication ; pas de validation de paiement.
- `SUPPORT_AGENT` : assistance et questions assignées ; lecture minimale, aucune mutation financière/contractuelle.
- `READ_ONLY_AUDITOR` : lecture globale pseudonymisée lorsque possible, aucun secret et aucune mutation.

## 8.2 Rôles Client

```text
CLIENT_OWNER
CLIENT_ADMIN
CLIENT_BUYER
CLIENT_ACCOUNTING
CLIENT_MEMBER
CLIENT_VIEWER
```

- Owner : gestion de l’organisation, utilisateurs, abonnement, signatures et approbations.
- Admin : opérations internes sauf transfert de propriété et actions réservées au propriétaire.
- Buyer : besoins, RFQ, devis, sélection dans ses limites d’approbation.
- Accounting : factures, paiements, budgets et centres de coûts ; ne sélectionne pas un prestataire sans droit.
- Member : diagnostics, brouillons et tâches assignées.
- Viewer : lecture autorisée.

## 8.3 Rôles Sous-traitant

```text
PROVIDER_OWNER
PROVIDER_MANAGER
PROVIDER_SALES
PROVIDER_TECHNICIAN
PROVIDER_ACCOUNTING
PROVIDER_VIEWER
```

- Owner : profil, contrat partenaire, utilisateurs et décisions majeures.
- Manager : missions, capacité, équipes et réponses.
- Sales : consultations, questions et devis.
- Technician : jalons, checklists, preuves et livraisons assignées.
- Accounting : commissions, factures Matricia et paiements.
- Viewer : lecture limitée.

## 8.4 Rôles Franchisé

```text
FRANCHISE_OWNER
FRANCHISE_MANAGER
FRANCHISE_EXPERT
FRANCHISE_PROVIDER_MANAGER
FRANCHISE_ACCOUNTING
FRANCHISE_VIEWER
```

Tous sont limités à leur franchise/bibliothèque, sauf droit central explicite.

- Owner : gouvernance de sa franchise, utilisateurs et contrat.
- Manager : activité et CRM.
- Expert : contenu métier, questions, anomalies et recommandations.
- Provider Manager : qualification métier et réseau de sous-traitants.
- Accounting : revenus, part, droit d’entrée et relevés.
- Viewer : lecture.

## 8.5 RLS

- Deny by default sur chaque table exposée.
- Aucune politique basée uniquement sur une valeur envoyée par le navigateur.
- Le tenant est dérivé de la session et des memberships validés.
- Les vues sensibles n’exposent pas les coordonnées concurrentes, règles internes ou coûts fournisseurs.
- Les opérations financières et décisions sensibles utilisent des fonctions `security definer` minimales, avec vérification explicite du rôle et `search_path` sécurisé.
- Ajoute des tests tenant escape, IDOR, rôle forgé, accès direct Storage et escalade horizontale/verticale.

---

# 9. DESIGN SYSTEM LUXUEUX, CLAIR ET ACCESSIBLE

Le design doit être premium B2B, calme, lisible et crédible, pas une copie générique d’un template SaaS.

## 9.1 Tokens de départ

Utilise des variables CSS sémantiques et vérifie WCAG AA :

```text
Brand Midnight      #102A43
Brand Deep          #0B1F33
Champagne Accent    #A88442
Champagne Light     #C7AB72
Warm Ivory          #FAF9F6
Surface             #FFFFFF
Surface Muted       #F3F5F7
Text Primary        #17212B
Text Secondary      #52606D
Border              #D8DEE5
Success             #18794E
Warning             #A15C00
Danger              #B42318
Info                 #175CD3
```

Le doré est un accent, jamais une couleur de texte faible ou une décoration excessive. Pas de gradient criard, de glassmorphism lourd, de néon ou d’ombres massives.

## 9.2 Typographie et grille

- Police latine : Manrope ou police moderne équivalente, chargée proprement.
- Police arabe : Noto Sans Arabic ou équivalent professionnel.
- Échelle typographique cohérente ; titres courts et hiérarchie forte.
- Grille 12 colonnes desktop, 8 tablette, 4 mobile.
- Spacing fondé sur 4/8 px.
- Rayon principal 12 px ; ombres discrètes.
- Largeur de contenu adaptée aux dashboards, avec densité configurable.

## 9.3 Composants obligatoires

```text
AppShell, Sidebar, Topbar, CommandPalette, Breadcrumbs
Button, IconButton, Link, Tabs, SegmentedControl
Input, Textarea, Select, Combobox, Checkbox, Radio, Switch
DatePicker, MoneyInput, PercentageInput, PhoneInput, AddressInput
FileUpload, DocumentPreview, SignaturePanel
Card, KPI, DataTable, MobileCardList, Timeline, Stepper
StatusBadge, Alert, Banner, Toast, Modal, Drawer
Skeleton, EmptyState, ErrorState, ForbiddenState
Chart, ScoreGauge, ProgressBar, Calendar
QuestionRenderer, RuleBuilder, FormBuilder, BoxBuilder
QuoteComparison, ContractViewer, LedgerTable, AuditTimeline
```

Tous les composants supportent FR/AR, RTL, clavier, focus visible, textes longs et écrans 360 px.

## 9.4 Dashboards

### Client
Santé de l’entreprise, actions, essai/plan, Box/crédits, diagnostics, anomalies, opportunités, RFQ/devis, projets, contrats et calendrier.

### Sous-traitant
Opportunités, devis, missions, livraisons, incidents, qualifications, capacité, performance, factures Matricia et bouton Mode Client.

### Franchisé
Bibliothèque, questionnaires, anomalies, opportunités, sous-traitants, invitations, CRM, pipeline, activités, Boxes proposées, revenus, part et droit d’entrée.

### Administrateur
`À traiter aujourd’hui` en premier, puis clients, sous-traitants, franchisés, demandes, missions, finance, abonnements, Boxes, achats groupés, exceptions, sécurité et audit.

---

# 10. IDENTITÉ, AUTHENTIFICATION ET ORGANISATIONS

## 10.1 Authentification

- OTP courriel 6 chiffres, durée de démonstration 10 minutes, configurable.
- Un nouveau code invalide l’ancien.
- Limite de tentatives et rate limit par compte/IP.
- Mot de passe facultatif, robuste et géré par Supabase Auth.
- Sessions listables et révocables.
- MFA obligatoire/configurable pour les rôles centraux sensibles avant production.
- Audit des connexions et alertes d’activité inhabituelle sans enregistrer de secret.

## 10.2 Organisation unique et multi-rôles

Tables de base :

```text
organizations
organization_profiles
organization_roles
organization_users
organization_sites
organization_contacts
organization_identifiers
organization_role_profiles
join_requests
organization_merge_cases
```

Le profil commun contient identité juridique, adresse, contacts, représentant, secteur, effectif, sites et documents. Les profils spécialisés Client/Sous-traitant/Franchisé ne dupliquent pas ces données.

## 10.3 Activation d’un rôle supplémentaire

Un sous-traitant qui active Client :

- réutilise son organisation ;
- accepte les conditions Client ;
- complète uniquement les données manquantes ;
- obtient le dashboard Client ;
- conserve ses espaces et écritures séparées.

Le sélecteur de rôle ne mélange pas les permissions ni les comptabilités.

---

# 11. CLIENT — ONBOARDING, CONFORMITÉ ET RÉSULTAT

## 11.1 Parcours

```text
EMAIL_VERIFIED
→ PROFILE_IN_PROGRESS
→ DOCUMENTS_REQUIRED
→ UNDER_REVIEW
→ QUESTION_REQUIRED éventuel
→ RESPONSE_RECEIVED
→ VERIFIED
→ TRIAL_ACTIVE
```

## 11.2 Formulaires client

Au minimum :

- identité société : raison sociale, nom commercial, forme juridique, ICE, IF, RC, ville RC, date création, activité, secteur, effectif, site, téléphone, email ;
- adresse et établissements ;
- représentant : nom, prénom, fonction, email, téléphone, pouvoir, mandat éventuel ;
- documents : type, numéro, émetteur, émission, expiration, fichier ;
- déclaration sur l’exactitude et autorisation de représentation.

Les exigences documentaires sont configurées par type d’organisation et bibliothèque. Ne prétends pas vérifier un registre officiel si aucune API autorisée n’est disponible ; implémente le port, l’adaptateur Demo et le contrôle manuel.

## 11.3 Anomalies administratives

Le moteur compare formulaire, documents et sources autorisées. Types minimum :

```text
LEGAL_NAME_MISMATCH
LEGAL_FORM_MISMATCH
ICE_MISMATCH
IF_MISMATCH
RC_MISMATCH
ADDRESS_MISMATCH
REPRESENTATIVE_MISMATCH
MANDATE_MISSING
DOCUMENT_MISSING
DOCUMENT_EXPIRED
DOCUMENT_UNREADABLE
MANUAL_REVIEW_REQUIRED
```

Chaque anomalie a gravité, statut, blocage, preuve, question, réponse et décision. Un clic du système ne valide ni ne condamne sans règle explicite.

## 11.4 Résultat client

Le client reçoit :

- complétude ;
- état de chaque document ;
- anomalies ouvertes/résolues ;
- questions ;
- décision de validation ;
- actions requises ;
- date d’activation de l’essai.

---

# 12. ABONNEMENTS, BOXES, AVANTAGES ET CRÉDITS

## 12.1 Essai et plans

L’essai commence après `VERIFIED + ACTIVATED`. Aucun moyen de paiement requis.

Seed de démonstration, administrable :

```text
Premium  : 490 MAD/mois, 4 900 MAD/an, 250 crédits
Gold     : 990 MAD/mois, 9 900 MAD/an, 700 crédits, plan recommandé
Platinum : 1 990 MAD/mois, 19 900 MAD/an, 1 600 crédits
```

Ces montants sont des données demo, jamais des constantes métier.

## 12.2 Plan = cinq couches

```text
CORE_ENTITLEMENTS
+ PLAN_PRIVILEGES
+ CUSTOM_BOX
+ MONTHLY_CREDITS
+ OPTIONAL_EXTRA_CREDITS
```

Les entitlements incluent utilisateurs, sites, diagnostics, projets, rapports, priorité, approbations et support. Les quotas sont versionnés.

## 12.3 Moteur d’avantages

Types minimum :

```text
PLATFORM_FEATURE
SERVICE_UNIT
CREDIT_SERVICE
PRIORITY
QUOTA
ACCESS_RIGHT
SERVICE_SUBSIDY
CONSULTATION
REPORT
CUSTOM
```

Modes de réalisation :

```text
AUTOMATED_PLATFORM
MATRICIA_INTERNAL
DIRECT_PROVIDER
SUBCONTRACTOR_POOL
VOLUME_POOL
RFQ
```

Chaque avantage possède coût en crédits, valeur de référence, coût interne, bibliothèque, service, conditions, quotas, capacité, preuves et règle d’annulation.

## 12.4 Boxes

Supporte :

- Box fixe ;
- Box semi-personnalisable avec noyau + slots ;
- Box totalement personnalisable par budget de crédits ;
- Box grand compte ;
- Box multi-utilisateurs avec sous-enveloppes ;
- Box multi-bibliothèques ;
- recommandations automatiques basées sur anomalies.

Cycle d’un avantage :

```text
AVAILABLE → RESERVED → SCHEDULED → IN_PROGRESS → DELIVERED → CONSUMED
```

Alternatives : `CANCELLED`, `REFUNDED`, `EXPIRED`, `WAITLISTED`.

## 12.5 Wallet de crédits

Types d’écritures :

```text
SUBSCRIPTION_GRANT
EXTRA_PURCHASE
BONUS
PROMOTION
ADMIN_GRANT
RESERVATION
RELEASE
CONSUMPTION
REFUND
EXPIRATION
ADJUSTMENT
```

Conserve l’origine, le lot d’expiration, la bibliothèque éventuelle, la transaction de paiement et l’avantage. Consomme d’abord les crédits expirant le plus tôt, en respectant les restrictions de domaine.

Crédits abonnement : report demo 3 mois. Crédits achetés : validité demo 12 mois. Paramétrable et versionné.

## 12.6 Allocation économique

Sépare :

```text
CORE_SUBSCRIPTION_REVENUE
BENEFIT_POOL_REVENUE
UNALLOCATED_CREDIT_REVENUE
```

Le revenu des crédits achetés est alloué à la bibliothèque au moment de la consommation. Les crédits promotionnels ont une valeur de revenu nulle mais peuvent générer un coût de fulfillment.

La consommation ou activité attribuée à IT alimente le P&L IT. Après calcul du **bénéfice distribuable IT**, celui-ci est réparti **50 % Hatim Ahmitech / 50 % Jalil-NEOXA**. Mme Asma/Matricia reçoit 0 % de cette distribution IT spécifique. Une autre bibliothèque applique sa règle 50/25/25 sur sa base distribuable. La politique du revenu Core non attribuable aux bibliothèques reste une règle financière distincte, versionnée et configurable ; ne la confonds jamais avec le revenu ou le bénéfice IT/franchise.

## 12.7 Administration Boxes

Crée les écrans : catalogue avantages, création/version, Box Builder, matrice plan-avantages, packs de crédits, promotions, attribution manuelle, approbation des cadeaux, consommations, capacités, coûts fournisseurs, rentabilité, statistiques, versionnage et simulation « Voir comme ce client ».

Avant publication, simule trois scénarios de coût : faible, moyen, consommation 100 %. Alerte et approbation supérieure si le coût prévisionnel dépasse le revenu configuré.

---

# 13. BIBLIOTHÈQUES, SERVICES ET QUESTION ENGINE

## 13.1 Standard universel d’une bibliothèque

Chaque bibliothèque contient :

1. identité et version ;
2. catégories/sous-catégories ;
3. services/sous-services ;
4. questionnaire client ;
5. diagnostic/scoring ;
6. anomalies/risques/recommandations ;
7. documents client ;
8. qualification sous-traitant ;
9. matching ;
10. devis/comparaison ;
11. clauses/livrables/acceptation ;
12. commission/pénalités/crédits ;
13. avantages/Boxes ;
14. KPI, permissions et publication.

Un service ne peut être publié si un élément obligatoire est absent.

## 13.2 Question Engine

Types de questions :

```text
YES_NO
SINGLE_CHOICE
MULTIPLE_CHOICE
SHORT_TEXT
LONG_TEXT
INTEGER
DECIMAL
PERCENTAGE
MONEY
DATE
TIME
EMAIL
PHONE
URL
ADDRESS
RATING_5
RATING_10
FILE
IMAGE
TABLE
QUANTITY
```

Opérateurs :

```text
EQUALS, NOT_EQUALS, GREATER_THAN, GREATER_OR_EQUAL,
LESS_THAN, LESS_OR_EQUAL, IN, NOT_IN, CONTAINS,
IS_EMPTY, IS_NOT_EMPTY
```

Groupes : `AND`, `OR`, `NOT`.

Actions :

```text
SHOW_QUESTION
HIDE_QUESTION
CREATE_ANOMALY
CREATE_RISK
ADD_SCORE
SUBTRACT_SCORE
CREATE_RECOMMENDATION
CREATE_OPPORTUNITY
REQUIRE_DOCUMENT
BLOCK_DIAGNOSTIC
REQUEST_REVIEW
```

## 13.3 Banque centrale

Une question globale est créée une fois et réutilisée. Une réponse valide déjà connue est préremplie et non redemandée, sauf confirmation périodique. Les versions historiques restent liées aux diagnostics passés.

## 13.4 Qualité et publication

Le franchisé peut créer, dupliquer, importer CSV, tester et proposer une version. Les changements sensibles passent par approbation centrale.

`catalog:validate` vérifie :

- question non vide et traduite ;
- options valides ;
- aucune branche morte ;
- règles sans cycle infini ;
- score borné ;
- anomalie/risk/recommandation/service liés ;
- `required_for_quote` complet ;
- qualification provider ;
- critères d’acceptation ;
- coûts/credits/fulfillment ;
- absence de doublons sémantiques manifestes.

---

# 14. DIAGNOSTICS, ANOMALIES ET OPPORTUNITÉS

## 14.1 Diagnostic

Chaque session est attachée à une version de questionnaire, une organisation, un site, une bibliothèque et éventuellement un projet. Autosave, reprise, progression et confirmation des réponses existantes sont obligatoires.

## 14.2 Scoring

Formule de départ :

```text
SUM(answer_score × question_weight)
/
SUM(max_score × question_weight)
× 100
```

Seuils demo configurables :

```text
80–100 GOOD
60–79 ATTENTION
40–59 IMPORTANT
0–39 CRITICAL
```

Une anomalie bloquante reste visible et prioritaire quel que soit le score.

## 14.3 Résultat

Affiche score global, sous-scores, points forts, anomalies, risques, recommandations, opportunités, priorités, comparaison temporelle et actions. Les textes techniques disposent d’une version client simple.

## 14.4 Diagnostic continu

Chaque réponse peut avoir une durée de validité. Le système pose régulièrement quelques questions de confirmation plutôt que de refaire tout le diagnostic.

## 14.5 Opportunité

Une opportunité contient origine, anomalie, recommandation, service, niveau de solution, priorité, données connues et champs manquants. Le client peut ignorer, reporter ou demander des devis. Aucune prestation n’est commandée sans action/approbation.

---

# 15. SOUS-TRAITANTS — VALIDATION ET QUALIFICATION

## 15.1 Deux niveaux distincts

1. conformité de l’entreprise ;
2. qualification par service.

Un compte globalement actif peut être suspendu pour un service seulement.

## 15.2 Données

- identité commune ;
- représentant ;
- documents juridiques/fiscaux ;
- assurances ;
- agréments/licences/certifications ;
- compétences et services ;
- expérience, équipe, références et portfolio ;
- régions/rayon/remote ;
- capacité, disponibilité et délai ;
- taille de missions ;
- recours à la sous-traitance secondaire ;
- contact comptabilité ;
- contrat partenaire et règle de commission.

## 15.3 Qualification par service

États :

```text
NOT_REQUESTED
PENDING
INFORMATION_REQUIRED
APPROVED
CONDITIONAL
SUSPENDED
EXPIRED
REJECTED
```

Les conditions bloquantes sont explicites. Une certification expirée suspend uniquement les services qui en dépendent lorsque possible.

## 15.4 Performance

Mesure taux de réponse, qualité du devis, délais, conformité première livraison, corrections, satisfaction, incidents et situation financière envers Matricia. Le score influence le matching mais n’écrase jamais un filtre obligatoire.

---

# 16. FRANCHISÉS — GOUVERNANCE, INVITATIONS ET FINANCE

## 16.1 Exclusivité

Une contrainte garantit un seul franchisé actif par bibliothèque et territoire configuré.

## 16.2 Onboarding

```text
REGISTERED
→ COMPANY_REVIEW
→ DOCUMENT_REVIEW
→ CONTRACT_PENDING
→ ENTRY_FEE_SETUP
→ LIBRARY_ASSIGNED
→ ACTIVE
```

## 16.3 Frais d’entrée

Pour toutes les franchises soumises au droit d’entrée, **à l’exception explicite de la franchise IT confiée à Hatim Ahmitech**, modes :

```text
UPFRONT
INSTALLMENT
REVENUE_WITHHOLDING
```

Stocke montant, acompte, taux/montant de retenue, échéances, montant retenu et solde. Maximum six mois. À l’issue, un solde restant devient exigible selon la règle configurée et peut déclencher restriction, mise en demeure et suspension.

## 16.4 Obligations

Le franchisé :

- développe son domaine ;
- enrichit le catalogue ;
- prépare les questionnaires ;
- définit anomalies/recommandations/opportunités ;
- participe à la qualification métier ;
- invite clients et sous-traitants ;
- suit activité, qualité et capacité ;
- respecte les validations centrales sur finance, droit et sécurité.

## 16.5 Invitations et CRM

Invitation individuelle ou CSV, lien signé à expiration demo 30 jours, anti-spam et déduplication. Pipeline :

```text
SENT → OPENED → REGISTERED → PROFILE_STARTED → VERIFIED
→ DIAGNOSTIC_STARTED → OPPORTUNITY_CREATED → RFQ_STARTED → CONTRACT_SIGNED
```

L’organisation créée conserve `referred_by_franchise_id` sans donner au franchisé des droits sur les données hors de sa bibliothèque.

## 16.6 Droits économiques

IT : la franchise est opérée par `HATIM_AHMITECH`. Le **bénéfice distribuable IT** est partagé `HATIM_AHMITECH = 50 %`, `NEOXA_JALIL = 50 %`, `ASMA_MATRICIA = 0 %`. Hatim ne paie aucun droit d’entrée pour IT.

Le bénéfice distribuable IT est calculé par défaut comme : revenus HT IT effectivement encaissés et définitivement acquis − remboursements/avoirs IT − coûts directs des sous-traitants/fulfillment IT − coûts de contrats volume IT − frais de paiement directement attribuables − coûts marketing directs spécifiquement affectés à IT − autres coûts directs explicitement approuvés. **La TVA collectée n’est jamais un revenu ni un bénéfice.** Les coûts centraux partagés de la plateforme ne sont pas déduits par défaut du P&L IT ; ils alimentent le pot Core/charges ci-dessous, sauf règle d’allocation approuvée et versionnée qui les affecte explicitement à IT.

Autres franchises : `FRANCHISEE = 50 %`, `NEOXA = 25 %`, `ASMA_MATRICIA = 25 %` sur leur base distribuable versionnée.

**Pot Core + droits d’entrée (distinct des P&L franchise)** : `CORE_SUBSCRIPTION_REVENUE` + droits d’entrée encaissés (IT = 0) − marketing − charges d’exploitation versionnées affectées à ce pot = **reste distribuable plateforme**, partagé `NEOXA_JALIL = 50 %`, `ASMA_MATRICIA = 50 %`. Ne pas fusionner ce reste avec le bénéfice IT ni avec une base 50/25/25 franchise.

Conserve le snapshot de la règle économique et de la formule de coûts sur chaque clôture. Le pouvoir technique d’un admin ne modifie jamais ces droits.


## 16.7 Contrôle continu de la performance du franchisé

Implémente un moteur `franchise_performance_control` indépendant du simple reporting. Il doit mesurer le travail réellement fourni par chaque franchisé et alimenter son dashboard ainsi que le command center administrateur.

### Axes et poids par défaut, tous versionnés/configurables

| Axe | Poids démo |
|---|---:|
| Développement clients et réseau | 20 % |
| Qualité bibliothèque/questionnaires | 20 % |
| Gestion/qualité du réseau sous-traitants | 15 % |
| Performance RFQ/devis/missions | 20 % |
| Satisfaction et qualité client | 15 % |
| Conformité contractuelle et financière | 10 % |

Le score global est informatif et explicable ; aucune exigence bloquante ne peut être compensée par un bon score.

### KPI obligatoires

- invitations clients et sous-traitants envoyées, ouvertes, inscrites, vérifiées et converties ;
- diagnostics, anomalies, opportunités, RFQ, contrats et revenu générés par la franchise ;
- services actifs/incomplets/obsolètes ;
- questions sans règle, anomalies sans recommandation, recommandations sans service, services sans fournisseur qualifié ;
- taux d’abandon questionnaire et fraîcheur des contenus ;
- candidatures fournisseurs, délai de qualification, fournisseurs réellement actifs, capacité, documents/certifications expirants ;
- taux de réponse RFQ, nombre moyen d’offres exploitables, délai du premier devis ;
- livraisons à temps, conformité première livraison, corrections, incidents, réaffectations et satisfaction ;
- SLA du franchisé ;
- droit d’entrée, reversements et obligations financières lorsque applicables ;
- pour IT/Hatim, aucun KPI de droit d’entrée ne doit créer de dette ou retenue.

## 16.8 Score qualité de bibliothèque

Calcule un score séparé `library_quality_score` à partir de validations déterministes : couverture services, formulaires, questions, règles, traductions FR/AR, fournisseurs qualifiés, critères de devis/réception, versionnage et absence de chemins cassés. Génère les alertes mais ne supprime rien automatiquement.

## 16.9 Détection de favoritisme et anomalies de gouvernance

Crée des `risk_flags` explicables pour : concentration anormale des missions sur un fournisseur, interventions manuelles répétées dans le matching, validations anormalement rapides ou incohérentes, sous-traitants liés à des conflits d’intérêts déclarés, ou baisse forte de diversité du panel. Un flag déclenche `MATRICIA_REVIEW_REQUIRED`, jamais une sanction automatique.

## 16.10 États de santé franchise

```text
HEALTHY
ATTENTION
IMPROVEMENT_PLAN
UNDER_REVIEW
RESTRICTED
SUSPENDED
TERMINATION_REVIEW
```

Toute transition vers `RESTRICTED`, `SUSPENDED` ou `TERMINATION_REVIEW` requiert une décision humaine autorisée, un motif, des preuves, une version de règles, un audit et une notification.

## 16.11 Plan correctif

Si les seuils configurés sont franchis, Matricia peut générer automatiquement un plan de 30 jours comportant objectifs mesurables, propriétaire, date limite et progression. Exemples : recruter 5 fournisseurs qualifiés, compléter 12 services, réduire le délai RFQ, résoudre les anomalies critiques. Le franchisé peut commenter et fournir des preuves.

## 16.12 Audit mensuel et trimestriel

Génère automatiquement un rapport mensuel par franchise : acquisition, réseau, diagnostics, opportunités, devis, contrats, qualité, litiges, finance, obligations, score, variation vs période précédente et actions recommandées. Prépare également un audit trimestriel approfondi avec comparaison anonymisée. Les rapports sont versionnés et exportables.

## 16.13 Dashboards de contrôle

Le franchisé voit son score, les six sous-scores, objectifs, alertes et actions requises. L’administrateur voit tous les franchisés dans une matrice comparative avec score, clients, revenu, qualité, SLA, alertes et statut. Ajouter drill-down jusqu’aux preuves sources.

---

# 17. DEMANDES, MATCHING, RFQ ET DEVIS

## 17.1 Création de demande

Une opportunité ou un besoin libre devient un brouillon. Récupère toutes les réponses existantes, puis demande seulement les champs manquants. Le client confirme un récapitulatif versionné.

États :

```text
DRAFT
INFORMATION_REQUIRED
READY
MATCHING
RFQ_OPEN
QUOTES_RECEIVED
CLIENT_REVIEW
PROVIDER_SELECTED
CONTRACT_PENDING
CONTRACTED
```

Alternatives : `CANCELLED`, `EXPIRED`, `NO_PROVIDER_AVAILABLE`.

## 17.2 Matching

Filtres éliminatoires :

```text
company_verified
service_approved
documents_valid
financial_status_ok
quality_status_ok
region_match
capacity_available
required_certifications_valid
not_same_organization
```

Score demo versionné :

```text
service fit 30
quality 20
availability 15
historical delay 10
experience 10
fair rotation 10
satisfaction 5
```

Explique l’inclusion/exclusion. Le franchisé peut superviser selon ses permissions ; toute modification manuelle est auditée.

## 17.3 Consultation équitable

- aucune offre concurrente visible au sous-traitant ;
- question privée ou clarification officielle diffusée à tous ;
- deadline commune ;
- coordonnées protégées ;
- au moins tous les fournisseurs éligibles jusqu’à la cible de panel configurée ;
- raisons de refus collectées.

## 17.4 Devis

Champs communs :

- solution ;
- lignes de prix HT, TVA, TTC, devise ;
- coût ponctuel/récurrent ;
- démarrage et durée ;
- livrables ;
- inclus/exclus ;
- corrections ;
- garantie ;
- prérequis client ;
- modalités de paiement ;
- validité ;
- options ;
- pièces jointes.

Le service peut ajouter des champs dynamiques. Après soumission, toute modification crée V2 avec motif.

## 17.5 Comparaison et feedback

Normalise prix, délai, contenu, coûts récurrents, garanties, exclusions et score technique. L’IA peut résumer, jamais décider seule. Le client sélectionne selon son workflow d’approbation.

Les non-retenus voient position et axes d’amélioration anonymisés.

---

# 18. CONTRATS, MISSIONS, LIVRAISON ET RÉCEPTION

## 18.1 Contrat

Assemble : parties, demande, clarifications, devis sélectionné, livrables, prix, paiements, calendrier, critères d’acceptation, corrections, hors périmètre, retards, non-conformité, pénalités, résiliation, réaffectation, confidentialité, données, propriété intellectuelle et litige.

La signature enregistre utilisateur, rôle, version, hash, instant et preuve technique.

## 18.2 Mission

États principaux :

```text
WAITING_START
IN_PROGRESS
DELIVERED
CLIENT_REVIEW
COMPLETED
```

Les missions peuvent avoir jalons, dépendances, responsables, checklists, preuves et validations intermédiaires.

## 18.3 Livraison

Le sous-traitant fournit description, livrables, fichiers/liens, checklist et preuves obligatoires. Sans preuve requise, la livraison est bloquée.

Le client choisit :

- accepter ;
- signaler une non-conformité liée à un critère/livrable ;
- demander une prestation supplémentaire.

La réception est objective, critère par critère.

## 18.4 Avenant

Workflow :

```text
REQUESTED → PRICED → ACCEPTED → SIGNED → ACTIVE
```

Le contrat initial reste intact. Prix, délai et livrables supplémentaires sont explicités.

---

# 19. INCIDENTS, NON-CONFORMITÉ ET RÉAFFECTATION

## 19.1 Signalement

Le client doit sélectionner l’obligation contractuelle, expliquer et joindre des preuves. Le signalement crée `WARNING_LEVEL_1`, pas une sanction.

Le sous-traitant répond : reconnaître/corriger/contester/hors périmètre.

Defaults configurables : réponse 48 heures ; urgence 24 heures ; correction standard 5 jours ouvrables ; revue Matricia cible 2 jours ouvrables.

## 19.2 Décisions

```text
COMPLIANT
MINOR_CORRECTION
OUT_OF_SCOPE
CLIENT_ABUSE
MUTUAL_AGREEMENT
NON_COMPLIANT_CONFIRMED
```

Chaque décision exige motif, preuves, auteur et version.

## 19.3 Conséquences atomiques

`NON_COMPLIANT_CONFIRMED` exécute dans une transaction/reprise idempotente :

1. crée la pénalité contractuelle ;
2. crée la commission Matricia due selon la règle ;
3. retire le sous-traitant de la mission ;
4. met à jour sa performance ;
5. crée la réaffectation `R1` ;
6. notifie les parties ;
7. écrit audit/outbox.

Aucun double clic ou retry ne crée deux pénalités ou deux commissions.

## 19.4 Réaffectation

La nouvelle mission est liée à l’originale (`R1`, `R2`). Le client ne ressaisit rien. Le remplaçant accepte un tarif cadre ou émet un nouveau devis et signe un nouveau contrat. Si le coût est supérieur, accord client obligatoire. Le delta est calculé ; sa récupération auprès du prestataire défaillant n’est appliquée que si une clause validée le permet.

---

# 20. FINANCE SOUS-TRAITANTS

## 20.1 Flux séparés

- abonnement Client → Matricia ;
- prestation → Client vers Sous-traitant ;
- commission/pénalité → Sous-traitant vers Matricia.

## 20.2 Déclaration d’encaissement

Le sous-traitant déclare mission, facture client, montant, date, mode, référence et preuve. Le client peut confirmer ou contester. Le taux de commission est le snapshot du contrat.

## 20.3 Cycle mensuel

```text
COMMISSION_ACCRUAL
→ PRE_STATEMENT
→ LINE_DISPUTE éventuelle
→ BILLING_PERIOD_CLOSED
→ STATEMENT
→ INVOICE
→ DUE
```

La facture et le relevé sont des documents distincts. La facture émise est immuable ; correction par avoir/nouvelle facture.

## 20.4 Paiement

Formulaire : facture, montant, date, mode, référence, justificatif. Validation comptable et allocation à une ou plusieurs factures.

États :

```text
ISSUED
PARTIALLY_PAID
PAID
OVERDUE
DISPUTED_PARTIALLY
PAYMENT_PLAN
COLLECTION
```

Le solde restant conserve l’échéance d’origine. À J+8 demo après émission/échéance standard : `FINANCIAL_RESTRICTED`. Le prestataire ne reçoit plus de nouvelles opportunités.

## 20.5 Ledger financier

Pour les allocations internes et distributions, implémente un journal en partie double ou un mécanisme équivalent démontrablement équilibré :

```text
ledger_accounts
journal_entries
journal_lines
```

Une écriture est équilibrée par devise. Les factures/paiements conservent leurs propres objets métier mais sont rapprochables au ledger.


## 20.6 Moteur fiscal Maroc 2026 — obligatoire

Créer un module central `morocco_tax_engine`. Ne jamais coder `* 1.20`, `tax = 20` ou une logique fiscale dans un composant React.

### Modèle de données minimal

```text
tax_jurisdictions
tax_categories
tax_rates
tax_rate_versions
tax_rules
tax_exemptions
withholding_tax_rules
invoice_tax_lines
credit_note_tax_lines
tax_adjustments
```

Chaque règle possède au minimum : `jurisdiction`, `tax_code`, `rate`, `effective_from`, `effective_to`, `priority`, `conditions`, `legal_reference`, `status`, `approved_by`, `version`.

### Règle de référence V1

Pour les prestations/services entrant dans le taux normal marocain, utilise **20 %** comme taux de référence/démonstration en vigueur, tout en le résolvant exclusivement par le moteur fiscal. Certains services, exemptions, retenues ou situations peuvent avoir un autre traitement : la plateforme doit les supporter sans changement de code. La configuration fiscale de production doit être validée par l’expert-comptable marocain.

### Catégories fiscales minimales

```text
PROVIDER_COMMISSION
CLIENT_SUBSCRIPTION
CREDIT_PACK
BOX_BENEFIT
VOLUME_SERVICE
FRANCHISE_ENTRY_FEE
FRANCHISE_REVENUE_OR_PROFIT_DISTRIBUTION
PENALTY
CREDIT_NOTE
OTHER_SERVICE
```

`PENALTY` reste fiscalement/comptablement distincte d’une prestation et ne reçoit pas automatiquement le même traitement TVA.

### Calcul

Calcule la TVA **ligne par ligne**, puis les totaux : `line_net`, `tax_rate_snapshot`, `tax_amount`, `line_gross`. Utilise des décimales monétaires exactes et une stratégie d’arrondi documentée. La TVA collectée n’est jamais incluse dans `distributable_revenue` ni dans le `distributable_profit` IT.

### Facture Maroc — modèle capable de porter les mentions requises

Le modèle et le PDF doivent supporter au minimum : émetteur (raison sociale, adresse, ICE, IF, RC lorsque applicable), destinataire (raison sociale, adresse et identifiants disponibles), numéro de facture, série continue, date d’émission, période/référence, désignation des biens/travaux/services, quantité/unité lorsque pertinente, montant HT, taux et montant de TVA par ligne/catégorie, total TVA, total TTC, devise, conditions/date de paiement, références contractuelles et informations de règlement. Les champs légalement obligatoires définitifs sont activés via configuration validée par l’expert-comptable.

La numérotation doit être atomique, monotone selon la série configurée et résistante à la concurrence. Une facture émise est immuable ; toute correction passe par avoir/nouvelle facture tout en conservant la chaîne d’audit.

### Références de conformité

Documente dans `docs/compliance/morocco-tax-2026.md` la base de configuration à partir du **Code Général des Impôts 2026** du Ministère de l’Économie et des Finances, notamment les règles de TVA et obligations de facturation/comptabilité pertinentes. Ne transforme jamais une hypothèse comptable en vérité codée : marque ce qui exige validation professionnelle.

## 20.7 Clôture mensuelle et facturation sous-traitant 100 % automatisées

La plateforme doit exécuter la facturation périodique sans qu’un employé fabrique manuellement les relevés/factures ordinaires.

### Éligibilité d’une ligne

Une transaction entre dans la clôture seulement si `invoice_eligible = true`, selon des règles explicites : mission/encaissement confirmé ou événement de commission prévu au contrat, taux de commission snapshot disponible, absence de blocage fiscal/exception, et absence de contestation bloquante sur cette ligne. Une non-conformité confirmée peut générer une commission/pénalité éligible selon la règle spéciale du contrat.

### Pipeline automatique

```text
ACCRUALS_OPEN
→ PRE_STATEMENT_GENERATED
→ PRE_STATEMENT_SENT
→ LINE_DISPUTE_WINDOW
→ EXCEPTIONS_RESOLVED_OR_CARRIED
→ BILLING_PERIOD_LOCKED
→ OFFICIAL_STATEMENT_GENERATED
→ TAX_CALCULATED
→ INVOICE_NUMBER_RESERVED_ATOMICALLY
→ INVOICE_ISSUED
→ PDF_ARCHIVED
→ IN_APP_NOTIFICATION_SENT
→ EMAIL_SENT
→ PAYMENT_DUE_TASK_CREATED
```

Le job est idempotent et peut reprendre après panne sans dupliquer relevé, facture, ligne, notification ou numéro.

### Pré-relevé

Le sous-traitant voit avant clôture : missions, encaissements confirmés, base commissionnable, taux snapshot, commission HT, pénalité/ajustement séparé, statut, liens vers contrat/mission. Il peut contester une ligne précise. Les lignes non contestées restent clôturables.

### Relevé officiel + facture

Génère **deux documents distincts** :
1. relevé officiel détaillé ;
2. facture Matricia correspondante.

Le relevé explique le calcul. La facture porte les totaux fiscaux. Les deux sont stockés comme documents versionnés/immuables après émission.

### Échéance et relances

Délai standard Matricia : **7 jours calendaires**, configurable par contrat/règle. Génère les rappels par défaut J+4, J+6, J+7 et passage `OVERDUE` à J+8 si le solde exigible subsiste. Un paiement partiel réduit uniquement `balance_due` et ne repousse jamais automatiquement `due_at`.

Si un plan de paiement a été explicitement approuvé, les échéances du plan gouvernent seulement le montant couvert par ce plan.

### Restriction financière

À l’impayé selon la règle active : `FINANCIAL_RESTRICTED`. Bloque les **nouvelles opportunités/RFQ** du sous-traitant mais conserve l’accès aux missions existantes, factures, paiements, litiges et obligations. La réactivation est automatique après paiement intégral si aucun autre motif de restriction ne subsiste.

### Exception queue

Les dossiers impossibles à facturer automatiquement sont placés dans `BILLING_EXCEPTION` avec raison structurée : paiement non confirmé, règle fiscale manquante, taux de commission absent, contestation, incohérence de montant, document invalide, etc. La présence de quelques exceptions ne doit jamais bloquer la clôture des autres fournisseurs propres.

### Dashboard admin clôture

Afficher : fournisseurs éligibles, prêts à facturer, exceptions, contestations, montants HT/TVA/TTC, factures générées, emails délivrés, échéances, impayés. Permettre relance/retry idempotent et résolution guidée des exceptions, jamais édition sauvage d’une facture émise.

---

# 21. ACHATS GROUPÉS, SKU ET POOLS

## 21.1 Analyse de volume

Le système détecte la demande historique et suggère des services standardisables. Un franchisé propose une négociation ; Finance/Matricia approuve l’engagement.

## 21.2 SKU

Chaque SKU définit périmètre, quantité, inclus/exclus, délai, corrections, checklist, preuves, critères d’acceptation, coût, crédits et version.

Exemple `WEB-STARTER-V1` : 5 pages, 1 langue, responsive, formulaire, HTTPS, SEO de base, accès admin, 2 corrections et délai configuré.

## 21.3 Contrat-cadre

Supporte paliers, minimum, maximum, capacité mensuelle, SLA, prix, paiement à la consommation, rebate, qualité, pénalités et sortie.

Modèle demo recommandé : forecast 100, engagement minimum 30, plafond négocié 150, 12 mois, paiement à la consommation.

## 21.4 Pool

États des unités/capacités :

```text
AVAILABLE
RESERVED
COMMITTED
CONSUMED
RELEASED
EXPIRED
```

Plusieurs fournisseurs, allocation pondérée par capacité/qualité/région/part contractuelle. Aucune survente silencieuse. Alertes de stock faible et forecast d’épuisement.

---

# 22. ADMINISTRATION CENTRALE

## 22.1 Navigation

```text
Vue générale
  Dashboard exécutif
  À traiter aujourd’hui
  Exceptions
Entreprises
  Clients
  Sous-traitants
  Franchisés
Business
  Bibliothèques
  Questionnaires
  Diagnostics
  Opportunités
  Demandes/RFQ
  Devis
  Contrats
  Missions
  Litiges
Abonnements
  Plans
  Avantages
  Boxes
  Crédits
  Promotions
  Consommations
Achats groupés
  Opportunités volume
  Négociations
  Contrats-cadres
  Pools
  Capacités
Finance
  Abonnements
  Commissions
  Factures
  Paiements
  Avoirs
  Impayés
  Franchises
  P&L bibliothèques
Administration
  Utilisateurs
  Permissions
  Notifications
  Audit
  Configuration
```

## 22.2 À traiter aujourd’hui

Ce bloc est toujours premier. Il regroupe validations, anomalies, questions, litiges, factures, exceptions, documents, pools et tâches dépassant le SLA, triés par gravité puis échéance.

## 22.3 Contrôle total sans contournement d’invariant

L’administrateur peut superviser, attribuer et configurer, mais :

- une facture signée/émise n’est pas éditée ;
- un ledger n’est pas modifié par une simple requête ;
- une décision critique nécessite motif ;
- les partages économiques ne dérivent pas des permissions ;
- toute exception manuelle est auditée et, selon seuil, approuvée par un second rôle.

## 22.4 P&L par bibliothèque

Affiche revenus attribués, commissions, consommations de crédits, coûts fournisseurs, achats volume, remboursements, avoirs, marge, bénéfice distribuable et distributions. IT montre **50 % Hatim / 50 % NEOXA sur le bénéfice distribuable IT, 0 % Asma**, avec détail complet des coûts retenus ; les autres appliquent leur règle active 50/25/25.

---

# 23. DONNÉES DE DÉMONSTRATION OBLIGATOIRES

Toutes les données sont synthétiques et réinitialisables. Aucun identifiant réel, aucune adresse personnelle réelle et aucun secret dans Git.

## 23.1 Comptes

```text
superadmin@demo.matricia.local        SUPER_ADMIN
asma.admin@demo.matricia.local        MATRICIA_ADMIN
jalil.neoxa@demo.matricia.local       FRANCHISE_OWNER + CLIENT_OWNER + PROVIDER_OWNER
```

Ajoute les sept rôles administratifs spécialisés avec comptes demo. Le mot de passe vient de `DEMO_DEFAULT_PASSWORD` et n’est jamais codé en dur.

## 23.2 Volumes minimum

- 30 entreprises clientes ;
- 10 franchises ;
- 12 sous-traitants par bibliothèque, soit 120 ;
- 60 RFQ ;
- au moins 360 devis ;
- 35 contrats ;
- 24 missions actives ;
- 8 incidents ;
- 50 factures ;
- 5 contrats-cadres volume ;
- paiements complets, partiels, échéanciers, retards et restrictions ;
- plans Trial, Expired, Premium, Gold et Platinum ;
- Boxes et wallets ;
- tous les états majeurs.

## 23.3 Dix bibliothèques

```text
IT     Informatique, cybersécurité et data
COM    Communication, marketing et création
ACC    Comptabilité, fiscalité et finance
LEGAL  Juridique, conformité et gouvernance
HR     Ressources humaines et formation
INS    Assurance et gestion des risques
LOG    Achats, logistique et supply chain
BTP    BTP, immobilier et maintenance
QHSE   Qualité, HSE et certifications
SALES  Commercial, vente et expérience client
```

Pour chacune, minimum :

- 6 catégories ;
- 15 services complets ;
- 70 questions diagnostic client ;
- 30 questions de qualification fournisseur ;
- 25 anomalies ;
- 25 risques ;
- 25 recommandations ;
- 15 opportunités/services associés ;
- 10 avantages Boxes ;
- FR `fr-MA` et arabe `ar-MA` ;
- formulaire client, devis, qualification, documents, checklist, preuves, acceptation, matching, coûts et crédits.

La quantité minimale ne suffit pas : le contenu doit être non dupliqué, cohérent, intelligible et relié au service. Le contenu juridique/fiscal/assurance est marqué demo et soumis à validation professionnelle avant production.

---

# 24. SÉCURITÉ ET CONFIDENTIALITÉ

## 24.1 Contrôles obligatoires

- RLS deny-by-default ;
- séparation stricte des tenants ;
- vérification serveur de toutes les permissions ;
- CSP et en-têtes sécurisés ;
- validation/normalisation des entrées ;
- prévention XSS, injection SQL, CSRF selon transport ;
- webhooks signés et idempotents ;
- secrets serveur uniquement ;
- URL Storage signées à durée courte ;
- contrôle MIME et extension ;
- limite de taille administrable ;
- adaptateur de scan antivirus/quarantaine ;
- aucune PII ou preuve sensible dans les logs ;
- rate limiting ;
- protection brute force OTP ;
- détection de comportements abusifs sans sanction automatique ;
- journal d’audit append-only ;
- export des données et workflow de suppression/archivage ;
- backups et restauration testée.

## 24.2 Threat model

Couvre au minimum : tenant escape, IDOR, escalade de rôle, fournisseur voyant un concurrent, franchisé voyant une autre bibliothèque, manipulation de taux, double paiement, double pénalité, falsification de webhook, accès document, injection dans PDF/email, upload malveillant, contournement de suspension, réutilisation OTP et fuite de secret.

## 24.3 Red team

Le red team produit des preuves reproductibles. Zéro finding `Critical` ou `High` ouvert avant release. Les findings Medium sur surfaces sensibles doivent être corrigés ou formellement acceptés avec mitigation et propriétaire.

---

# 25. TESTS, PERFORMANCE ET OBSERVABILITÉ

## 25.1 Tests

- unitaires sur value objects, invariants, scoring, allocations et transitions ;
- propriété/mutation sur ledgers et state machines critiques ;
- intégration des use cases ;
- SQL contraintes/index/migrations ;
- RLS positif/négatif pour chaque rôle/scope critique ;
- contract tests paiement/email/storage ;
- concurrence : double clic, webhook doublé, worker retry, fermeture de période simultanée ;
- E2E desktop/mobile FR/AR ;
- accessibilité automatisée et manuelle ;
- visual regression pour dashboards clés ;
- performance et plans SQL.

Cibles : 100 % des branches des règles financières et transitions critiques, au moins 95 % de la couche application critique et 90 % global, sans tests artificiels uniquement destinés au chiffre.

## 25.2 Scénarios E2E minimum

1. client normal de l’OTP à la mission terminée ;
2. anomalie administrative puis correction ;
3. essai expiré puis Gold et réactivation ;
4. Box Gold, réservation, livraison et consommation ;
5. achat de crédits supplémentaires ;
6. sous-traitant qualifié puis devis/missions ;
7. sous-traitant active le rôle Client ;
8. organisation empêchée de répondre à elle-même ;
9. feedback anonymisé non retenu ;
10. demande hors périmètre transformée en avenant ;
11. non-conformité confirmée et réaffectation ;
12. double confirmation sans double pénalité ;
13. commission normale sur encaissement ;
14. facture, paiement partiel et restriction ;
15. échéancier approuvé ;
16. franchisé hors IT avec droit d’entrée ;
17. retenue sur six mois et solde ;
18. répartition 50/25/25 ;
19. IT : bénéfice distribuable partagé 50 % Hatim Ahmitech / 50 % Jalil-NEOXA, Hatim exempt de droit d’entrée ;
20. invitation franchisé ;
21. création/publication questionnaire et simulation ;
22. pool volume et stock faible ;
23. webhook paiement doublé ;
24. document obligatoire expiré ;
25. doublon ICE et rattachement ;
26. tentative d’accès inter-tenant bloquée.

## 25.3 Performance

Budgets staging contrôlé : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. API internes courantes p95 ciblé < 500 ms hors fournisseurs externes. Pagination serveur, virtualisation, requêtes indexées, cache sûr et absence de N+1.

## 25.4 Observabilité

Logs JSON avec `request_id`, `correlation_id`, acteur, agrégat et code d’erreur, sans PII sensible. Métriques pour outbox, jobs, webhooks, paiements, erreurs, latence, taux de conversion, échecs RLS et pools. Health/readiness endpoints, traces sur workflows critiques et alertes documentées.

---

# 26. PHASES D’EXÉCUTION ET GATES

## Phase 00 — Reconnaissance et extraction du présent prompt

- inspecte le dépôt ;
- crée AGENTS/PLANS/skills/agents/context index ;
- décompose l’annexe en sections ;
- crée les matrices ;
- crée l’ExecPlan global ;
- réalise threat model initial ;
- ne détruis aucun code correct existant.

**Gate :** inventaire, architecture proposée, ownership et matrices initialisées.

## Phase 01 — Spécifications atomiques

Complète écrans, formulaires, permissions, API, événements, notifications et state machines pour les premières phases. Aucune valeur indéfinie.

**Gate :** `pnpm spec:validate` vert.

## Phase 02 — Socle monorepo, CI, design tokens, configuration et observabilité

**Gate :** install/lint/typecheck/test/build minimal vert.

## Phase 03 — Base, migrations, outbox, audit, ledgers et RLS

**Gate :** reset DB, migrations, RLS et tests de contraintes verts.

## Phase 04 — Auth, organisation unique et multi-rôles

**Gate :** OTP demo/réel, sessions, rattachement, rôle Client/Sous-traitant/Franchisé.

## Phase 05 — Onboarding et conformité Client

**Gate :** parcours complet avec anomalies/questions/résultat et début de trial.

## Phase 06 — Bibliothèques, services, Question/Rule Builder

**Gate :** une bibliothèque complète publiable via admin et simulation sans code spécifique.

## Phase 07 — Diagnostics, scoring, anomalies, recommandations et opportunités

**Gate :** diagnostic réel → opportunité exploitable.

## Phase 08 — Essai, plans, paiements, Boxes, avantages et crédits

**Gate :** Trial → Gold → Box → achat crédits → consommation, avec ledgers.

## Phase 09 — Sous-traitants et qualification par service

**Gate :** fournisseur validé/qualifié, capacité et restrictions.

## Phase 10 — Franchises, invitations, CRM, frais d’entrée, contrôle de performance et gouvernance

**Gate :** Hatim/IT 50-50 bénéfice + exemption droit d’entrée, franchise standard 50/25/25, invitation/pipeline, score de contrôle, plan correctif et audit mensuel.

## Phase 11 — Demandes, matching, RFQ, questions et devis

**Gate :** panel éligible, offres isolées, comparaison et sélection.

## Phase 12 — Contrats, signatures, missions, jalons et livraisons

**Gate :** mission normale terminée avec preuves et réception.

## Phase 13 — Litiges, pénalités et réaffectation

**Gate :** hors périmètre et non-conformité confirmée testés, idempotence prouvée.

## Phase 14 — Fiscalité Maroc, facturation automatique sous-traitants et recouvrement

**Gate :** moteur fiscal Maroc versionné, pré-relevé/relevé/facture automatiques, série de facture atomique, TVA par ligne, paiement partiel, restriction, échéancier et exceptions testés.

## Phase 15 — Revenus franchises, allocations abonnements/crédits et P&L

**Gate :** IT 50/50 du bénéfice distribuable Hatim/NEOXA avec exemption du droit d’entrée, autres 50/25/25, calcul des coûts traçable et écritures équilibrées.

## Phase 16 — Centrale d’achat et pools volume

**Gate :** SKU, contrat-cadre, pool, réservation, consommation et rebate.

## Phase 17 — Administration complète, automatisations, notifications et reporting

**Gate :** command center et toutes les files/actions opérationnelles.

## Phase 18 — Contenu et seeds des dix domaines

Travaille en agents parallèles par bibliothèque, puis audits croisés contenu/FR/AR.

**Gate :** seuils minimum, validation catalogue, aucun placeholder.

## Phase 19 — Hardening, audits indépendants et release

Exécute sécurité, QA navigateur, accessibilité, performance, intégrité financière, traçabilité, clean clone et déploiement de staging.

**Gate final :** toutes les conditions de la section Definition of Done.

## Boucle de chaque phase

```text
SPECIFY → IMPLEMENT → TEST → REVIEW → RED TEAM → FIX → RETEST → INTEGRATE → VERIFY
```

Le `release_manager` refuse la phase si un contrôleur indépendant n’a pas signé son rapport.

---

# 27. COMMANDES DE QUALITÉ À FOURNIR

Le projet final expose au minimum :

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:db
pnpm test:rls
pnpm test:e2e
pnpm test:a11y
pnpm test:security
pnpm test:performance
pnpm build
pnpm db:reset
pnpm db:seed
pnpm catalog:validate
pnpm spec:validate
pnpm traceability:validate
pnpm no-placeholders
pnpm release:validate
```

Adapte les noms si nécessaire, mais offre un équivalent documenté et une commande agrégée `pnpm verify`.

---

# 28. DEFINITION OF DONE FINALE

La release V1 n’est autorisée que si :

- `MAT-FUNC-001..068 = VERIFIED` ;
- chaque écran canonique a route, permissions, états et tests ;
- chaque formulaire a un schéma complet ;
- chaque permission critique a un test ALLOW et DENY ;
- chaque mutation critique a audit/outbox/idempotence ;
- toutes les migrations passent sur base vide ;
- seed complet et déterministe ;
- zéro placeholder ou bouton décoratif ;
- zéro erreur TypeScript/lint/build ;
- zéro test flaky ;
- zéro High/Critical sécurité ;
- zéro P0/P1/P2 produit ouvert ;
- FR et arabe RTL utilisables ;
- mobile 360 px utilisable ;
- factures/contrats/ledgers immuables selon règles ;
- doubles webhooks/clics/decisions ne dupliquent rien ;
- dashboards Client/Sous-traitant/Franchisé/Admin complets ;
- les dix domaines ont leur contenu et données demo ;
- la release se reconstruit depuis un clone propre ;
- les runbooks de déploiement, backup et restauration sont testés ;
- les seuls éléments restants sont explicitement `EXTERNAL_PENDING`, avec adaptateur et tests déjà finis.

---

# 29. LIVRABLES FINAUX

Crée au minimum :

```text
README.md
AGENTS.md
PLANS.md
docs/architecture/ARCHITECTURE.md
docs/architecture/ADRs/
docs/api/OPENAPI.*
docs/data/DATA_DICTIONARY.md
docs/security/THREAT_MODEL.md
docs/security/SECURITY_REPORT.md
docs/quality/TEST_REPORT.md
docs/quality/PERFORMANCE_REPORT.md
docs/traceability/REQUIREMENTS_COVERAGE.md
docs/release/FINAL_HANDOFF.md
docs/release/DEPLOYMENT_RUNBOOK.md
docs/release/BACKUP_RESTORE_RUNBOOK.md
docs/release/EXTERNAL_ACTIVATION_CHECKLIST.md
docs/demo/DEMO_ACCOUNTS.md
artifacts/screenshots/
artifacts/test-results/
```

`FINAL_HANDOFF.md` explique les commandes, comptes demo, principaux parcours, architecture, environnements, secrets nécessaires et preuves. Il ne masque aucun élément externe non activé.

---

# 30. FORMAT DE TON COMPTE RENDU FINAL

À la fin, réponds avec :

1. statut global ;
2. fonctionnalités livrées ;
3. commandes de vérification exécutées et résultats ;
4. comptes demo ;
5. liens/chemins vers rapports et captures ;
6. éléments `EXTERNAL_PENDING` uniquement ;
7. hash/commit de release.

Ne termine pas par une proposition de travailler plus tard. Ne demande pas « quelle est la prochaine étape ». La prochaine étape est toujours la phase suivante jusqu’à la release.

---

# 31. DÉMARRAGE IMMÉDIAT

Commence maintenant :

1. lis intégralement ce fichier ;
2. inspecte le dépôt ;
3. lance en parallèle `repo_explorer`, `requirements_architect`, `security_architect` et `ux_information_architect` en lecture seule ;
4. crée l’ExecPlan et la structure de mémoire/skills ;
5. lance Phase 00 puis continue automatiquement jusqu’à Phase 19 ;
6. n’arrête pas le chantier sur une simple réussite visuelle ;
7. garde le fil principal propre et stocke toutes les preuves dans le dépôt.

---

# 31 BIS. REGISTRE OBLIGATOIRE DES 68 FONCTIONS V1

Les 68 lignes ci-dessous sont des exigences obligatoires. Crée dès la Phase 00 une matrice avec les colonnes `status`, `implementation_refs`, `test_refs`, `evidence`, `owner` et `release_signoff`. Aucune ligne ne peut être fusionnée avec une autre ni marquée vérifiée sans preuve.

| ID | Fonction | Spécification minimale obligatoire |
|---|---|---|
| `MAT-FUNC-001` | Passeport Matricia unique | Organisation unique multi-rôles; données communes réutilisées. |
| `MAT-FUNC-002` | Santé globale | Score global + scores bibliothèques + anomalies + évolution. |
| `MAT-FUNC-003` | Assistant IA | Assistant contextuel; aucune sanction/transaction critique autonome. |
| `MAT-FUNC-004` | Détection proactive | Changements de profil déclenchent suggestions/réévaluations. |
| `MAT-FUNC-005` | Diagnostic continu | Questions expirantes et revalidation légère. |
| `MAT-FUNC-006` | Actions requises | File universelle de tâches utilisateur. |
| `MAT-FUNC-007` | Inbox universelle | Messagerie liée aux objets métier. |
| `MAT-FUNC-008` | Assistant création besoin | Texte libre → service → questions manquantes. |
| `MAT-FUNC-009` | Solutions multiples | Essential/Standard/Advanced pour une même anomalie. |
| `MAT-FUNC-010` | Bundles multi-bibliothèques | Ensembles de services pour projet transversal. |
| `MAT-FUNC-011` | Mode Projet | Projet avec budget, tâches, contrats et progression. |
| `MAT-FUNC-012` | Budget annuel | Budget par année/bibliothèque/site/projet. |
| `MAT-FUNC-013` | Comparateur intelligent | Comparaison normalisée de devis. |
| `MAT-FUNC-014` | Complétude devis | Score + blocage champs obligatoires. |
| `MAT-FUNC-015` | Feedback non retenus | Classement personnel + amélioration anonymisée. |
| `MAT-FUNC-016` | Réputation multidimensionnelle | Qualité/délai/conformité/réponse/satisfaction/finance. |
| `MAT-FUNC-017` | Badges | Badges calculés et versionnés. |
| `MAT-FUNC-018` | Matching évolutif | Règles explicables et historisées. |
| `MAT-FUNC-019` | Rotation équitable | Éviter monopolisation lorsque candidats équivalents. |
| `MAT-FUNC-020` | Capacité provider | AVAILABLE/LIMITED/FULL/PAUSED. |
| `MAT-FUNC-021` | Calendrier central | Échéances devis, missions, factures, documents. |
| `MAT-FUNC-022` | Jalons | Phases de mission validables. |
| `MAT-FUNC-023` | Preuves de réalisation | Preuves obligatoires par service. |
| `MAT-FUNC-024` | Checklists | Checklist versionnée par service. |
| `MAT-FUNC-025` | Réception objective | Validation critère par critère. |
| `MAT-FUNC-026` | Avenant rapide | Demande supplémentaire → prix/délai/livrables. |
| `MAT-FUNC-027` | Versionnage complet | Historique immuable des objets critiques. |
| `MAT-FUNC-028` | Coffre-fort documentaire | Documents privés, versionnés, réutilisables. |
| `MAT-FUNC-029` | Expirations | Rappels et suspension ciblée. |
| `MAT-FUNC-030` | Centre financier unifié | Vue consolidée multi-rôles, ledgers séparés. |
| `MAT-FUNC-031` | Prévision commissions | Accruals estimés avant facturation. |
| `MAT-FUNC-032` | Rapprochement paiements | Allocation plusieurs factures/paiements. |
| `MAT-FUNC-033` | Wallet crédits | Ledger crédits complet. |
| `MAT-FUNC-034` | Récompenses | Règles bonus paramétrables. |
| `MAT-FUNC-035` | Parrainage | Liens et conversion traçables. |
| `MAT-FUNC-036` | CRM franchisé | Prospects/clients/providers et activité. |
| `MAT-FUNC-037` | Pipeline franchisé | Étapes de conversion standardisées. |
| `MAT-FUNC-038` | Relances automatiques | Rappels par règles et délais. |
| `MAT-FUNC-039` | Modèles communication | Templates FR/AR versionnés. |
| `MAT-FUNC-040` | Bibliothèque modèles | Clonage de questionnaires/clauses/checklists. |
| `MAT-FUNC-041` | IA qualité questionnaires | Ambiguïté, doublons, donnée déjà connue. |
| `MAT-FUNC-042` | Détection doublons | Questions/services/anomalies similaires. |
| `MAT-FUNC-043` | Simulation questionnaire | Sandbox sans statistiques réelles. |
| `MAT-FUNC-044` | Analyse abandons | Taux par section/question. |
| `MAT-FUNC-045` | Benchmark anonymisé | Agrégats avec seuil minimal de groupe. |
| `MAT-FUNC-046` | Historique évolution | Snapshots scores/anomalies. |
| `MAT-FUNC-047` | ROI recommandations | Résultats seulement si base mesurable. |
| `MAT-FUNC-048` | Fournisseurs favoris | Favori réutilisable sous contrôle éligibilité. |
| `MAT-FUNC-049` | Commander similaire | Cloner une ancienne demande dans une nouvelle. |
| `MAT-FUNC-050` | Prestations récurrentes | Cycles mensuels/trimestriels/annuels. |
| `MAT-FUNC-051` | Multi-sites | Site_id dans diagnostics/demandes/missions/budgets. |
| `MAT-FUNC-052` | Approvals multi-utilisateurs | Workflow d’approbation paramétrable. |
| `MAT-FUNC-053` | Centres de coûts | Rattachement dépenses/projets. |
| `MAT-FUNC-054` | Mobile | Parcours critiques utilisables sur smartphone. |
| `MAT-FUNC-055` | Autosave | Brouillons sauvegardés et conflits gérés. |
| `MAT-FUNC-056` | Progression | Étapes/complétude réelles. |
| `MAT-FUNC-057` | Préremplissage | Réutiliser données vérifiées/récentes. |
| `MAT-FUNC-058` | Aide contextuelle | Aide, exemple, pourquoi demandé. |
| `MAT-FUNC-059` | FR/AR | Traductions natives et RTL. |
| `MAT-FUNC-060` | Langage simplifié | Texte technique + version client. |
| `MAT-FUNC-061` | Accessibilité | Clavier, focus, contraste, labels. |
| `MAT-FUNC-062` | Centre économies | Économies seulement sur bases vérifiables. |
| `MAT-FUNC-063` | Préférences notifications | Immédiat/digest/disabled par catégorie. |
| `MAT-FUNC-064` | Résumé franchisé | Digest quotidien configurable. |
| `MAT-FUNC-065` | Résumé exécutif admin | À traiter aujourd’hui avant KPI. |
| `MAT-FUNC-066` | Moteur exceptions | Cas hors workflow vers file admin. |
| `MAT-FUNC-067` | Protection contournement | Contacts masqués et échanges internes avant sélection. |
| `MAT-FUNC-068` | Détection abus | Risk flags sans sanction automatique. |

---

# ANNEXE A — CAHIER DES CHARGES SOURCE DE VÉRITÉ

La totalité du texte ci-dessous constitue le cahier des charges métier intégré. Il complète le contrat d’exécution ci-dessus. En cas de répétition, applique la règle la plus spécifique et les décisions non négociables de ce Gold Master Prompt.


**MATRICIA**

**Cahier des charges maître - Version 1**

*Spécifications fonctionnelles, techniques, financières, administratives et d’exploitation*

**Document de référence pour le développement complet de la plateforme**

| **Élément**              | **Décision V1**                                                                                                   |
|--------------------------|-------------------------------------------------------------------------------------------------------------------|
| Périmètre produit        | Fonctions MAT-FUNC-001 à MAT-FUNC-068. Les fonctions 069 à 090 sont réservées à la V2.                            |
| Profils                  | Client, Sous-traitant, Franchisé, Administrateur Matricia; une organisation peut cumuler plusieurs rôles.         |
| Essai client             | 30 jours gratuits après validation/activation, sans obligation de moyen de paiement.                              |
| Abonnements              | Premium, Gold, Platinum obligatoires après essai pour les nouvelles fonctions actives.                            |
| Boxes & crédits          | Avantages spécifiques, Boxes personnalisables et wallet de crédits avec achat de crédits supplémentaires.         |
| Franchise IT             | Hatim Ahmitech opère la franchise IT sans droit d’entrée ; bénéfice distribuable IT : 50 % Hatim / 50 % Jalil-NEOXA ; 0 % Asma. |
| Autres franchises        | 50 % franchisé, 25 % NEOXA/Jalil, 25 % Mme Asma/Matricia sur la base de revenu distribuable définie.              |
| Pot Core + droits d’entrée | Après marketing/charges versionnées du pot : 50 % Jalil-NEOXA / 50 % Mme Asma ; distinct des P&L franchise. |
| Sous-traitants           | Devis libres, qualification par service, commission Matricia facturée séparément, délai de paiement 7 jours.      |
| Non-conformité confirmée | Pénalité contractuelle + commission Matricia due + retrait de mission + réaffectation.                            |
| Stack cible              | Next.js/TypeScript + Vercel; Supabase PostgreSQL/Auth/Storage/RLS; Resend; adaptateur de paiement multi-provider. |

| **Statut du document -** Les montants, crédits, taux de commission, délais, pénalités, prix de plans et règles commerciales doivent être paramétrables/versionnés dans l’administration. Les textes juridiques et règles fiscales devront être validés avant mise en production. |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# Table des matières structurée

1.  0\. Principes directeurs et décisions figées

2.  1\. Architecture générale A à Z

3.  2\. Acteurs, organisations, rôles et permissions

4.  3\. Authentification et sécurité d’accès

5.  4\. Onboarding et validation du client

6.  5\. Abonnement client, Premium/Gold/Platinum, Boxes et crédits

7.  6\. Bibliothèques, services et standard de création

8.  7\. Moteur universel de questionnaires et diagnostics

9.  8\. Anomalies, risques, recommandations et opportunités

10. 9\. Demande de devis, matching et RFQ

11. 10\. Onboarding, conformité et qualification des sous-traitants

12. 11\. Devis, comparaison, feedback et sélection

13. 12\. Contrats, missions, jalons et livraisons

14. 13\. Non-conformité, litiges, pénalités et réaffectation

15. 14\. Facturation des sous-traitants et recouvrement

16. 15\. Franchise - onboarding, droits, obligations et revenus

17. 16\. Invitations et CRM des franchisés

18. 17\. Centrale d’achat, contrats volume et pools de services

19. 18\. Administration centrale Matricia

20. 19\. Moteur Avantages & Boxes - administration

21. 20\. Finance consolidée et P&L par bibliothèque

22. 21\. Données et schéma Supabase

23. 22\. API, Edge Functions, Event Outbox et idempotence

24. 23\. State Machines maîtresses

25. 24\. Notifications, automatisations et SLA

26. 25\. Sécurité, RLS, audit et conservation

27. 26\. UX/UI, design system, mobile et FR/AR

28. 27\. Reporting, KPI et exports

29. 28\. Spécifications MAT-FUNC-001 à MAT-FUNC-068

30. 29\. Catalogue des écrans

31. 30\. Scénarios E2E et critères d’acceptation

32. 31\. Déploiement et configuration initiale

33. 32\. Paramètres à valider juridiquement/comptablement/commercialement

# Schéma maître de la plateforme - A à Z

Le schéma maître ci-dessous relie les acteurs, les flux client, sous-traitant, franchisé, administration, diagnostics, devis, contrats, finance, abonnements, Boxes, crédits et achats en volume. La version PDF séparée permet un zoom vectoriel très important.

<img src="media/image1.png" style="width:6.77165in;height:1.08229in" />

| **Règle de lecture -** Les flux économiques sont séparés des permissions techniques. Le fait d’être administrateur ne crée aucun droit économique; inversement, un droit économique sur une bibliothèque ne donne pas automatiquement accès à toutes les fonctions centrales. |
|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 0. Principes directeurs et décisions figées

| **ID**              | **Décision**                                                                                                                         |
|---------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| ORG-UNIQUE          | Une entreprise correspond à une seule organisation. Les rôles CLIENT, SUBCONTRACTOR et FRANCHISEE sont cumulables.                   |
| AUTH-OTP            | OTP courriel comme méthode principale; mot de passe facultatif.                                                                      |
| TRIAL-30            | Essai client de 30 jours démarrant après validation/activation; aucun moyen de paiement obligatoire pendant l’essai.                 |
| PLAN-3              | Après l’essai, le client doit souscrire Premium, Gold ou Platinum pour continuer les nouvelles fonctions actives.                    |
| BOX-CREDIT          | Chaque plan combine avantages permanents, Box personnalisable selon le niveau et crédits; achat de crédits supplémentaires possible. |
| RFQ-FREEPRICE       | Les sous-traitants fixent librement leurs prix lors des consultations standards.                                                     |
| PROVIDER-HIDDEN     | Les coordonnées directes des sous-traitants sont protégées pendant la consultation; les échanges passent par Matricia.               |
| NONCONFORMITY       | Le signalement client crée un avertissement/contradictoire; seule la non-conformité confirmée déclenche sanction.                    |
| DEFAULT-CONSEQ      | Faute confirmée: pénalité contractuelle + commission Matricia due + retrait + réaffectation.                                         |
| PROVIDER-INVOICE    | Matricia n’accède pas au compte bancaire du sous-traitant; elle émet relevé + facture; délai standard 7 jours.                       |
| PARTIAL-PAY         | Un paiement partiel ne renouvelle pas l’échéance initiale.                                                                           |
| IT-5050             | Bénéfice distribuable IT : 50 % Hatim Ahmitech / 50 % Jalil-NEOXA ; franchise IT exemptée de droit d’entrée.                         |
| FRANCHISE-SPLIT     | Autres franchises: 50 % franchisé / 25 % NEOXA / 25 % Asma-Matricia sur base distribuable.                                           |
| FRANCHISE-FEE       | Droit d’entrée obligatoire pour les franchises ordinaires ; **exception : Hatim Ahmitech ne paie aucun droit d’entrée pour IT**. Paiement comptant ou retenue sur gains sur 6 mois maximum pour les autres. |
| FRANCHISE-QUESTIONS | Chaque franchisé maintient les questionnaires de diagnostic de sa bibliothèque.                                                      |
| VOLUME              | Les services standardisables peuvent être négociés en volume, de préférence avec engagement minimum et paiement à la consommation.   |
| V1-SCOPE            | MAT-FUNC-001 à 068 en V1. 069 à 090 hors V1.                                                                                         |

# 1. Architecture générale A à Z

- Frontend: application web responsive Next.js/TypeScript déployée sur Vercel.

- Backend: Supabase PostgreSQL, Auth, Storage privé, Row Level Security, fonctions/Edge Functions.

- Courriels transactionnels: Resend avec templates versionnés FR/AR.

- Paiements: couche d’abstraction permettant CMI, PayPal ou tout autre prestataire futur; les webhooks serveur sont la source de vérité.

- Event Outbox: toutes les mutations importantes émettent un événement durable; workers/cron traitent notifications et automatisations avec retry/idempotence.

- Administration: interface unique de contrôle des organisations, bibliothèques, questionnaires, finance, Boxes, achats volume, sécurité et audit.

| **Couche**   | **Composants**                                                        | **Exigences**                                                      |
|--------------|-----------------------------------------------------------------------|--------------------------------------------------------------------|
| Présentation | Next.js, design system, responsive, FR/AR RTL                         | Aucun écran métier critique ne dépend d’un desktop.                |
| Identité     | Supabase Auth + organizations + roles                                 | OTP prioritaire; multi-rôles; séparation organisation/utilisateur. |
| Métier       | Libraries, diagnostics, RFQ, contracts, missions, finance, franchises | Workflow par state machine; versionnage; idempotence.              |
| Données      | PostgreSQL + Storage                                                  | FK, indexes, contraintes, RLS, archivage, audit.                   |
| Intégrations | Paiements, Resend, éventuelles API société                            | Adaptateurs; webhooks signés; erreurs récupérables.                |
| Opérations   | Cron, Event Outbox, Exceptions                                        | Pas de logique critique seulement dans le navigateur.              |

# 2. Acteurs, organisations, rôles et permissions

Le modèle d’identité sépare l’entreprise (organisation), les utilisateurs et les rôles fonctionnels. Une entreprise peut acheter et vendre des services sans créer plusieurs comptes.

## Acteurs

- Client: entreprise acheteuse et utilisatrice des diagnostics/abonnements.

- Sous-traitant: entreprise qualifiée pour répondre aux demandes et exécuter des missions.

- Franchisé: opérateur exclusif d’une bibliothèque, responsable de son expertise métier et de son réseau.

- Administrateur Matricia: gouvernance, conformité, finance, bibliothèques, litiges et sécurité.

## Écrans / parcours

| **ID écran** | **Nom**                      | **But principal**                                    |
|--------------|------------------------------|------------------------------------------------------|
| ORG-001      | Passeport organisation       | Identité juridique et rôles de l’entreprise.         |
| ORG-002      | Utilisateurs                 | Inviter, désactiver et attribuer des rôles internes. |
| ORG-003      | Rôles Matricia               | Activer Client/Sous-traitant/Franchisé.              |
| ORG-004      | Demande rejoindre entreprise | Éviter les doublons ICE.                             |
| ORG-005      | Fusion doublons Admin        | Fusion contrôlée sans perdre l’historique.           |

## Données et champs

| **Bloc**     | **Champs obligatoires / données**                                                                       |
|--------------|---------------------------------------------------------------------------------------------------------|
| Organisation | raison_sociale, nom_commercial, ICE, IF, RC, forme_juridique, adresse, secteur, effectif, pays, statut. |
| Utilisateur  | nom, prénom, email, téléphone, locale, statut, last_login.                                              |
| Membership   | organization_id, user_id, role_id, périmètre site/bibliothèque/franchise.                               |
| Rôle         | code, permissions, scope, statut, version.                                                              |

## Règles métier

- ICE unique lorsqu’il est disponible; un doublon déclenche une procédure de rattachement ou une exception admin.

- Un changement de rôle ne duplique aucune donnée juridique.

- Les droits sont évalués par ROLE + ORGANIZATION + LIBRARY + FRANCHISE + RESOURCE + ACTION.

- Les droits économiques ne sont jamais déduits des rôles techniques.

## Machine d’état

| **État**     | **Description / transition**                       |
|--------------|----------------------------------------------------|
| ACTIVE       | Organisation utilisable.                           |
| UNDER_REVIEW | Contrôle administratif en cours.                   |
| SUSPENDED    | Restrictions selon motif.                          |
| ARCHIVED     | Ancienne organisation conservée pour l’historique. |

## Tables principales

- organizations

- organization_roles

- organization_users

- organization_sites

- organization_contacts

- role_definitions

- permission_definitions

- role_permissions

- organization_join_requests

## API / fonctions backend

| **Fonction**       | **Responsabilité**                               |
|--------------------|--------------------------------------------------|
| createOrganization | Créer l’organisation avec anti-doublon.          |
| addRole            | Activer un rôle métier.                          |
| inviteUser         | Inviter un utilisateur.                          |
| requestJoin        | Demander à rejoindre une organisation existante. |
| mergeOrganizations | Fusion administrative idempotente.               |

## Événements / automatisations

| **Événement**        | **Actions**                                   |
|----------------------|-----------------------------------------------|
| ORGANIZATION_CREATED | Créer audit et actions d’onboarding.          |
| ROLE_ADDED           | Créer profil spécialisé associé.              |
| JOIN_REQUEST_CREATED | Notifier les propriétaires.                   |
| ORGANIZATION_MERGED  | Réindexer les relations, archiver le doublon. |

## Erreurs et exceptions à traiter

- Deux ICE identiques avec orthographes de raison sociale différentes.

- Utilisateur invité dans deux organisations.

- Fusion demandée alors que les deux organisations ont des factures ou contrats actifs.

## Critères d’acceptation

34. Une société sous-traitante peut activer le rôle Client sans ressaisie.

35. Un utilisateur de l’organisation A ne peut pas lire l’organisation B.

36. La fusion ne modifie pas les références historiques des factures et contrats.

# 3. Authentification et sécurité d’accès

La connexion doit être rapide, principalement sans mot de passe, tout en conservant un niveau de sécurité adapté aux comptes financiers et administratifs.

## Acteurs

- Tous les utilisateurs.

- Administrateurs pour révocation de sessions et sécurité.

## Écrans / parcours

| **ID écran** | **Nom**                | **But principal**                         |
|--------------|------------------------|-------------------------------------------|
| AUTH-001     | Connexion courriel     | Saisie de l’adresse email.                |
| AUTH-002     | OTP                    | Code 6 chiffres.                          |
| AUTH-003     | Mot de passe optionnel | Créer ou utiliser un mot de passe.        |
| AUTH-004     | Sessions               | Voir/révoquer les sessions.               |
| AUTH-005     | Sécurité admin         | Contrôles renforcés pour rôles sensibles. |

## Données et champs

| **Bloc**     | **Champs obligatoires / données**                             |
|--------------|---------------------------------------------------------------|
| OTP          | email, code, expires_at, attempts, used_at, request_ip.       |
| Session      | user_id, device, created_at, last_seen, revoked_at.           |
| Mot de passe | géré par Supabase Auth; jamais stocké dans les tables métier. |

## Règles métier

- OTP court et à usage unique; nouveau code invalide l’ancien.

- Rate limit sur demandes et tentatives.

- Retour de paiement ou lien email ne crée jamais une session sans validation Auth.

- Les rôles sensibles peuvent nécessiter MFA futur sans refonte du modèle.

## Machine d’état

| **État**    | **Description / transition**  |
|-------------|-------------------------------|
| UNVERIFIED  | Email non vérifié.            |
| VERIFIED    | Email validé.                 |
| LOCKED_TEMP | Trop de tentatives.           |
| DISABLED    | Compte utilisateur désactivé. |

## Tables principales

- auth_events

- user_sessions

- security_events

## API / fonctions backend

| **Fonction**  | **Responsabilité**             |
|---------------|--------------------------------|
| requestOtp    | Envoyer OTP après rate-limit.  |
| verifyOtp     | Valider code et créer session. |
| setPassword   | Créer mot de passe facultatif. |
| revokeSession | Révoquer une session.          |

## Événements / automatisations

| **Événement**   | **Actions**                    |
|-----------------|--------------------------------|
| OTP_REQUESTED   | Envoi Resend.                  |
| OTP_FAILED      | Incrément sécurité/rate limit. |
| LOGIN_SUCCESS   | Audit de connexion.            |
| SESSION_REVOKED | Déconnexion ciblée.            |

## Erreurs et exceptions à traiter

- Email inexistant mais invitation active.

- OTP expiré ou déjà utilisé.

- Utilisateur désactivé tentant de se connecter.

## Critères d’acceptation

37. Le client peut toujours se connecter par OTP même s’il a oublié son mot de passe.

38. Un OTP ne peut être réutilisé.

39. Un compte désactivé ne reçoit pas de session.

# 4. Onboarding et validation du client

Le client est validé administrativement avant activation. Matricia détecte les incohérences, génère des questions et produit un résultat de conformité distinct du diagnostic métier.

## Acteurs

- Client Owner/Admin.

- MATRICIA_COMPLIANCE / MATRICIA_ADMIN.

## Écrans / parcours

| **ID écran** | **Nom**                   | **But principal**          |
|--------------|---------------------------|----------------------------|
| CL-001       | Création compte           | Email/OTP.                 |
| CL-004       | Organisation              | Identité de la société.    |
| CL-006       | Représentant              | Pouvoir de représentation. |
| CL-007       | Documents                 | Téléversement et statut.   |
| CL-008       | Anomalies administratives | Voir divergences.          |
| CL-009       | Questions Matricia        | Répondre/corriger.         |
| ADM-004      | Validation client         | Revue administrateur.      |
| CL-010       | Résultat validation       | Statut final.              |

## Données et champs

| **Bloc**     | **Champs obligatoires / données**                                              |
|--------------|--------------------------------------------------------------------------------|
| Identité     | raison sociale, ICE, IF, RC, forme juridique, date création, secteur, adresse. |
| Représentant | nom, prénom, fonction, email, téléphone, qualité, pouvoir.                     |
| Document     | type, numéro, émetteur, date émission, expiration, fichier, statut.            |
| Anomalie     | type, champ, valeur saisie, valeur document, sévérité, blocking.               |
| Question     | objet, texte, délai, document attendu, réponse, statut.                        |

## Règles métier

- Les documents obligatoires sont définis par une matrice paramétrable selon le type d’organisation.

- Une anomalie CRITICAL+BLOCKING empêche VERIFIED indépendamment du score.

- Les questions peuvent être automatiques ou manuelles.

- Le client voit ce qu’il doit corriger sans avoir accès aux notes internes de conformité.

- Le compteur d’essai ne démarre qu’après VERIFIED + activation.

## Machine d’état

| **État**            | **Description / transition**      |
|---------------------|-----------------------------------|
| PROFILE_IN_PROGRESS | Profil non complet.               |
| DOCUMENTS_REQUIRED  | Pièces manquantes.                |
| UNDER_REVIEW        | Contrôle en cours.                |
| QUESTION_REQUIRED   | Réponse client obligatoire.       |
| RESPONSE_RECEIVED   | Réponse reçue.                    |
| VERIFIED            | Entreprise validée.               |
| REJECTED            | Refus motivé.                     |
| SUSPENDED           | Compte restreint post-validation. |

## Tables principales

- client_profiles

- document_requirements

- documents

- document_versions

- compliance_checks

- administrative_anomalies

- compliance_questions

- compliance_responses

## API / fonctions backend

| **Fonction**             | **Responsabilité**             |
|--------------------------|--------------------------------|
| evaluateCompliance       | Comparer données et documents. |
| createComplianceQuestion | Créer une action au client.    |
| resolveAnomaly           | Résoudre avec audit.           |
| verifyOrganization       | Activer client et essai.       |
| rejectOrganization       | Refuser avec motif.            |

## Événements / automatisations

| **Événement**                | **Actions**                  |
|------------------------------|------------------------------|
| DOCUMENT_UPLOADED            | Relancer contrôles.          |
| ANOMALY_DETECTED             | Créer action + notification. |
| COMPLIANCE_RESPONSE_RECEIVED | Notifier Compliance.         |
| ORGANIZATION_VERIFIED        | Démarrer essai 30 jours.     |

## Erreurs et exceptions à traiter

- Document illisible.

- Document remplacé pendant une revue.

- Adresse différente mais justificativement valide.

- ICE non vérifiable via source externe.

## Critères d’acceptation

40. Une incohérence ICE bloque la validation.

41. Une question acceptée ferme l’anomalie correspondante.

42. L’essai commence uniquement après validation.

# 5. Abonnement client, Premium/Gold/Platinum, Boxes et crédits

Après 30 jours, le client doit s’abonner à Premium, Gold ou Platinum. La valeur repose sur des avantages spécifiques, des Boxes personnalisables et un wallet de crédits, pas seulement sur des remises.

## Acteurs

- Client Owner/Admin/Accounting selon permissions.

- MATRICIA_ADMIN / FINANCE / Subscription Manager.

- Franchisés pour proposer des avantages de leur bibliothèque.

## Écrans / parcours

| **ID écran** | **Nom**              | **But principal**                 |
|--------------|----------------------|-----------------------------------|
| CL-041       | Abonnement           | État, renouvellement, historique. |
| CL-042       | Comparer les plans   | Premium/Gold/Platinum.            |
| CL-043       | Ma Box               | Choisir les slots/avantages.      |
| CL-044       | Mes crédits          | Solde et historique.              |
| CL-045       | Acheter crédits      | Packs supplémentaires.            |
| ADM-031A     | Dashboard Boxes      | Usage/coût/rentabilité.           |
| ADM-031D     | Box Builder          | Créer versions de Box.            |
| ADM-031E     | Plans                | Configurer droits/crédits.        |
| ADM-031G     | Packs crédits        | Créer packs.                      |
| ADM-031I     | Attribution manuelle | Bonus/geste commercial.           |

## Données et champs

| **Bloc**           | **Champs obligatoires / données**                                                              |
|--------------------|------------------------------------------------------------------------------------------------|
| Plan               | code, prix mensuel, prix annuel, devise, core_features, credit_grant, box_id, limits, version. |
| Box                | type FIXED/SEMI/CUSTOM, slots, budget crédits, règles, version.                                |
| Avantage           | type, library_id, service_id, coût crédits, coût interne, quota, fulfillment, plans.           |
| Wallet             | organization_id, currency_type=credits, ledger balance.                                        |
| Transaction crédit | type, quantity, source, expires_at, library_scope, redemption_id.                              |
| Pack               | quantité, prix, validité, bonus, plans autorisés.                                              |

## Règles métier

- TRIAL_EXPIRED conserve l’accès aux obligations/historique mais bloque les nouvelles fonctions actives.

- Les prix et volumes de crédits sont paramétrables/versionnés.

- Le wallet est un ledger; aucun changement direct de solde.

- Les crédits sont réservés avant consommation et remboursés selon règle en cas d’annulation.

- Gold est le plan recommandé commercialement; Premium plus guidé, Platinum plus personnalisable.

- Une promotion peut accorder des crédits fléchés par bibliothèque.

- Les avantages consommés gardent la version active au moment de la réservation.

## Machine d’état

| **État**      | **Description / transition**  |
|---------------|-------------------------------|
| TRIAL_ACTIVE  | Essai en cours.               |
| TRIAL_EXPIRED | Nouvelles fonctions bloquées. |
| ACTIVE        | Plan payé actif.              |
| PAST_DUE      | Incident de renouvellement.   |
| SUSPENDED     | Plan suspendu selon règles.   |
| CANCELLED     | Abonnement terminé.           |

## Tables principales

- subscription_plans

- subscription_plan_versions

- subscriptions

- plan_entitlements

- box_definitions

- box_versions

- box_slots

- customer_boxes

- benefit_definitions

- benefit_versions

- credit_wallets

- credit_transactions

- credit_packages

- credit_purchases

- benefit_redemptions

## API / fonctions backend

| **Fonction**         | **Responsabilité**                    |
|----------------------|---------------------------------------|
| startTrial           | Créer trial_started_at/trial_ends_at. |
| activateSubscription | Activer après webhook vérifié.        |
| buildCustomerBox     | Valider slots/règles.                 |
| grantMonthlyCredits  | Créer transaction SUBSCRIPTION_GRANT. |
| reserveCredits       | Réserver atomiquement.                |
| consumeCredits       | Consommer après preuve/livraison.     |
| purchaseCredits      | Créer commande + webhook.             |
| upgradePlan          | Appliquer version et droits.          |
| downgradePlan        | Planifier changement futur.           |

## Événements / automatisations

| **Événement**     | **Actions**                            |
|-------------------|----------------------------------------|
| TRIAL_ENDING      | Rappels J-10/J-5/J-2/J-1.              |
| TRIAL_EXPIRED     | Créer action Choisir un plan.          |
| SUBSCRIPTION_PAID | Activer droits + Box + crédits.        |
| CREDIT_EXPIRING   | Notifier avant expiration.             |
| BENEFIT_RESERVED  | Réserver capacité/stock si nécessaire. |

## Erreurs et exceptions à traiter

- Webhook paiement doublé.

- Crédits suffisants dans deux onglets concurrents.

- Downgrade avec avantage déjà réservé.

- Plan mis à jour alors qu’un client est sur ancienne version.

## Critères d’acceptation

43. Aucune carte n’est exigée pendant l’essai.

44. À J30 sans plan, le client ne peut pas lancer une nouvelle RFQ.

45. Le client Gold peut construire une Box selon les règles actives.

46. Un achat de crédits est crédité une seule fois même si le webhook arrive plusieurs fois.

# 6. Bibliothèques, services et standard de création

Chaque domaine est une bibliothèque dynamique créée avec le même moteur. Une bibliothèque contient catégories, services, formulaires, règles, qualifications, contrats et économie.

## Acteurs

- Franchisé de la bibliothèque.

- LIBRARY_MANAGER / Admin central.

## Écrans / parcours

| **ID écran** | **Nom**         | **But principal**             |
|--------------|-----------------|-------------------------------|
| ADM-017      | Bibliothèques   | Lister/créer/versionner.      |
| FR-002       | Ma bibliothèque | Vue franchisé.                |
| FR-003       | Services        | Créer/mettre à jour.          |
| FR-004       | Catégories      | Arborescence.                 |
| ADM-018      | Services        | Contrôle central.             |
| ADM-020      | Versionnage     | Publier une nouvelle version. |

## Données et champs

| **Bloc**           | **Champs obligatoires / données**                                                                                  |
|--------------------|--------------------------------------------------------------------------------------------------------------------|
| Bibliothèque       | code, nom FR/AR, slug, description, owner_franchise_id, status, version.                                           |
| Catégorie          | library_id, parent_id, nom, ordre, actif.                                                                          |
| Service            | category_id, code, description, type prestation, plans, credit_eligible, qualification rules, acceptance criteria. |
| Paramètres service | required_for_quote, documents client, documents provider, quote_fields, matching_weights, incident SLA.            |

## Règles métier

- 1 franchisé actif maximum par bibliothèque.

- Une bibliothèque est publiée seulement si les composants minimum sont configurés.

- Les services sont versionnés; les anciennes missions conservent l’ancienne définition.

- Le franchisé peut éditer le métier; les changements financiers/juridiques sensibles requièrent approbation centrale.

## Machine d’état

| **État**    | **Description / transition** |
|-------------|------------------------------|
| DRAFT       | Création.                    |
| CONFIGURING | Éléments incomplets.         |
| TEST        | Simulation.                  |
| ACTIVE      | Visible/utilisable.          |
| PAUSED      | Plus de nouvelles demandes.  |
| ARCHIVED    | Historique seulement.        |

## Tables principales

- libraries

- library_versions

- categories

- services

- service_versions

- service_documents

- service_quote_fields

- service_acceptance_criteria

- service_matching_profiles

## API / fonctions backend

| **Fonction**                | **Responsabilité**       |
|-----------------------------|--------------------------|
| createLibrary               | Créer structure.         |
| validateLibraryCompleteness | Contrôler publication.   |
| publishLibraryVersion       | Publier version.         |
| createService               | Créer service.           |
| cloneServiceTemplate        | Dupliquer depuis modèle. |

## Événements / automatisations

| **Événement**     | **Actions**                      |
|-------------------|----------------------------------|
| LIBRARY_PUBLISHED | Indexer services/questionnaires. |
| SERVICE_UPDATED   | Créer nouvelle version.          |
| SERVICE_PAUSED    | Empêcher nouvelles demandes.     |

## Erreurs et exceptions à traiter

- Suppression d’un service utilisé par des contrats actifs.

- Deux services doublons.

- Franchisé tente de modifier une règle financière protégée.

## Critères d’acceptation

47. Une nouvelle bibliothèque peut être créée sans nouveau code métier.

48. Un service archivé reste visible dans les anciens contrats.

49. La publication est bloquée si le service n’a pas de formulaire de devis minimal.

# 7. Moteur universel de questionnaires et diagnostics

Un moteur unique sert tous les franchisés. Il standardise les types de questions, conditions, scoring, anomalies, recommandations et opportunités.

## Acteurs

- Franchisé/Expert métier.

- Library Manager.

- Client pour répondre.

## Écrans / parcours

| **ID écran** | **Nom**              | **But principal**                 |
|--------------|----------------------|-----------------------------------|
| FR-005       | Questionnaires       | Lister versions.                  |
| FR-006       | Créer questionnaire  | Définir sections.                 |
| FR-007       | Question Builder     | Question + options + résultat.    |
| FR-008       | Rule Builder         | Conditions/actions.               |
| FR-013       | Simulation           | Tester faux client.               |
| CL-016       | Questionnaire client | Répondre avec autosave.           |
| CL-017       | Résultats            | Scores/anomalies/recommandations. |

## Données et champs

| **Bloc**  | **Champs obligatoires / données**                                               |
|-----------|---------------------------------------------------------------------------------|
| Question  | code, type, texte FR/AR, help, required flags, weight, source GLOBAL/LIBRARY.   |
| Option    | value stable, label FR/AR, score.                                               |
| Condition | operator, field/question ref, value, group AND/OR/NOT.                          |
| Action    | SHOW/HIDE/ANOMALY/RISK/SCORE/RECOMMENDATION/OPPORTUNITY/REQUIRE_DOCUMENT/BLOCK. |
| Réponse   | session, question_version, value, answered_at, source, expires_at.              |
| Score     | model_version, library_score, subscores, global contribution.                   |

## Règles métier

- Types V1: YES_NO, SINGLE_CHOICE, MULTIPLE_CHOICE, SHORT_TEXT, LONG_TEXT, INTEGER, DECIMAL, PERCENTAGE, MONEY, DATE, TIME, EMAIL, PHONE, URL, ADDRESS, RATING_5, RATING_10, FILE, IMAGE, TABLE, QUANTITY.

- Les valeurs internes sont standardisées et indépendantes des traductions.

- Une question globale déjà répondue et encore valide n’est pas reposée.

- Une règle peut déclencher plusieurs actions.

- Le mode simulation n’alimente jamais les statistiques réelles.

- Toute modification publiée crée une nouvelle version.

## Machine d’état

| **État**   | **Description / transition**     |
|------------|----------------------------------|
| DRAFT      | Questionnaire modifiable.        |
| TEST       | Simulation.                      |
| PUBLISHED  | Utilisé pour nouvelles sessions. |
| SUPERSEDED | Ancienne version conservée.      |
| ARCHIVED   | Historique.                      |

## Tables principales

- question_banks

- questionnaires

- questionnaire_versions

- question_sections

- questions

- question_versions

- question_options

- question_rules

- rule_conditions

- rule_actions

- diagnostic_sessions

- diagnostic_answers

- score_models

- score_snapshots

## API / fonctions backend

| **Fonction**          | **Responsabilité**                          |
|-----------------------|---------------------------------------------|
| createQuestion        | Créer question standardisée.                |
| evaluateRules         | Évaluer conditions de manière déterministe. |
| resolveKnownValue     | Préremplir une donnée connue.               |
| saveDiagnosticAnswer  | Autosave + validation.                      |
| completeDiagnostic    | Calcul scores/résultats.                    |
| simulateQuestionnaire | Exécuter sans impact métier.                |

## Événements / automatisations

| **Événement**           | **Actions**                                |
|-------------------------|--------------------------------------------|
| ANSWER_SAVED            | Réévaluer règles dépendantes.              |
| ANOMALY_CREATED         | Créer recommandation/opportunité si règle. |
| DIAGNOSTIC_COMPLETED    | Créer snapshot + rapport.                  |
| QUESTIONNAIRE_PUBLISHED | Nouvelles sessions sur nouvelle version.   |

## Erreurs et exceptions à traiter

- Boucle de dépendance entre questions.

- Condition invalide après suppression d’une option.

- Deux sessions concurrentes du même diagnostic.

- Question requise cachée par une règle contradictoire.

## Critères d’acceptation

50. Le franchisé peut créer une question sans coder.

51. Une réponse NO peut créer automatiquement anomalie + recommandation + opportunité.

52. Modifier une question ne change pas un diagnostic déjà terminé.

# 8. Anomalies, risques, recommandations et opportunités

Le diagnostic doit produire une valeur exploitable: anomalies, risques, recommandations et opportunités directement convertibles en demandes de devis.

## Acteurs

- Client.

- Franchisé.

- Admin Matricia.

## Écrans / parcours

| **ID écran** | **Nom**               | **But principal**      |
|--------------|-----------------------|------------------------|
| CL-018       | Mes anomalies         | Priorités et détails.  |
| CL-019       | Recommandations       | Solutions proposées.   |
| CL-020       | Opportunités          | Services actionnables. |
| FR-009       | Définitions anomalies | Créer/maintenir.       |
| FR-010       | Risques               | Modèles de risque.     |
| FR-011       | Recommandations       | Associer services.     |
| FR-012       | Opportunités          | Suivre conversion.     |

## Données et champs

| **Bloc**       | **Champs obligatoires / données**                                      |
|----------------|------------------------------------------------------------------------|
| Anomalie       | definition_id, severity, detected_by_rule, evidence, status, blocking. |
| Risque         | impact, probabilité, criticité, description.                           |
| Recommandation | service_id, texte simple/technique, priorité.                          |
| Opportunité    | service_id, solution_level, source_anomaly, status, client_decision.   |

## Règles métier

- Sévérités standard: INFO/MINOR/IMPORTANT/CRITICAL.

- Une anomalie peut créer plusieurs recommandations.

- Une recommandation peut proposer Essential/Standard/Advanced.

- Le client garde le contrôle pour demander des devis.

- Une opportunité non utilisée ne crée aucune mission ni dépense.

## Machine d’état

| **État**            | **Description / transition** |
|---------------------|------------------------------|
| DETECTED            | Créée par diagnostic.        |
| ACKNOWLEDGED        | Vue par client.              |
| OPPORTUNITY_CREATED | Service associé.             |
| CONVERTED           | RFQ créée.                   |
| RESOLVED            | Anomalie corrigée.           |
| DISMISSED           | Masquée avec motif.          |

## Tables principales

- anomaly_definitions

- detected_anomalies

- risk_definitions

- detected_risks

- recommendation_definitions

- recommendations

- solution_levels

- opportunities

- opportunity_service_links

## API / fonctions backend

| **Fonction**                        | **Responsabilité**            |
|-------------------------------------|-------------------------------|
| createOpportunityFromRecommendation | Créer opportunité.            |
| resolveAnomaly                      | Clôturer avec preuve/réponse. |
| recalculateHealth                   | Mettre à jour score santé.    |
| convertOpportunityToRequest         | Préremplir la demande.        |

## Événements / automatisations

| **Événement**       | **Actions**                     |
|---------------------|---------------------------------|
| ANOMALY_DETECTED    | Notifier si important/critique. |
| OPPORTUNITY_CREATED | Afficher dans dashboard.        |
| ANOMALY_RESOLVED    | Recalcul santé/historique.      |

## Erreurs et exceptions à traiter

- Même anomalie déclenchée par plusieurs questions.

- Service lié désactivé après détection.

- Anomalie critique résolue sans preuve alors qu’une preuve est exigée.

## Critères d’acceptation

53. Le client voit pourquoi l’opportunité existe.

54. Le bouton Demander des devis préremplit la demande avec les réponses déjà connues.

# 9. Demande de devis, matching et RFQ

Une opportunité doit devenir un dossier de consultation structuré avant d’être envoyé à plusieurs sous-traitants qualifiés.

## Acteurs

- Client Buyer/Admin.

- Sous-traitants éligibles.

- Franchisé de la bibliothèque.

- Admin Matricia.

## Écrans / parcours

| **ID écran** | **Nom**               | **But principal**              |
|--------------|-----------------------|--------------------------------|
| CL-022       | Compléter opportunité | Questions manquantes.          |
| CL-023       | Demande de devis      | Récapitulatif et confirmation. |
| ADM-022      | Matching              | Voir inclus/exclus.            |
| ST-013       | Opportunités reçues   | Accepter/décliner.             |
| ST-014       | Détail consultation   | Lire cahier de besoin.         |
| ST-015       | Questions client      | Clarifications.                |
| ADM-021      | Demandes              | Supervision consultations.     |

## Données et champs

| **Bloc**            | **Champs obligatoires / données**                                                                      |
|---------------------|--------------------------------------------------------------------------------------------------------|
| Demande             | organization_id, site_id, library_id, service_id, description, urgency, desired_date, budget_optional. |
| Required quote data | question refs, documents, deliverables, criteria.                                                      |
| Matching candidate  | provider_id, hard_filter_result, score, reason, rotation component.                                    |
| RFQ                 | deadline, invited_count, status, version, confidentiality settings.                                    |

## Règles métier

- Les informations required_for_quote doivent être complètes avant RFQ_OPEN.

- Filtres éliminatoires: société vérifiée, service qualifié, documents/certifications valides, finance/qualité OK, région, capacité.

- Cible 10+ sous-traitants lorsque le panel le permet; si moins, tous les éligibles peuvent être invités.

- Les coordonnées directes sont masquées avant sélection sauf règle spécifique.

- Toute modification substantielle après ouverture crée une nouvelle version/clarification officielle.

## Machine d’état

| **État**              | **Description / transition** |
|-----------------------|------------------------------|
| DRAFT                 | Demande en préparation.      |
| INFORMATION_REQUIRED  | Données manquantes.          |
| READY                 | Prête.                       |
| MATCHING              | Calcul candidats.            |
| RFQ_OPEN              | Consultation ouverte.        |
| QUOTES_RECEIVED       | Offres reçues.               |
| CLIENT_REVIEW         | Comparaison.                 |
| PROVIDER_SELECTED     | Gagnant choisi.              |
| CONTRACT_PENDING      | Contrat à générer.           |
| CONTRACTED            | Contrat signé.               |
| NO_PROVIDER_AVAILABLE | Exception.                   |

## Tables principales

- service_requests

- request_answers

- request_documents

- matching_runs

- matching_candidates

- rfqs

- rfq_providers

- rfq_clarifications

## API / fonctions backend

| **Fonction**                  | **Responsabilité**                   |
|-------------------------------|--------------------------------------|
| prepareRequestFromOpportunity | Créer draft prérempli.               |
| validateQuoteReadiness        | Contrôler champs/documents.          |
| runMatching                   | Filtres + score versionné.           |
| openRfq                       | Inviter fournisseurs.                |
| publishClarification          | Diffuser réponse officielle.         |
| closeRfq                      | Clôturer selon sélection/expiration. |

## Événements / automatisations

| **Événement**        | **Actions**            |
|----------------------|------------------------|
| REQUEST_READY        | Lancer matching.       |
| RFQ_OPENED           | Notifier panel.        |
| RFQ_DEADLINE_NEAR    | Rappel fournisseurs.   |
| NO_MATCHING_PROVIDER | Créer exception admin. |

## Erreurs et exceptions à traiter

- Aucun fournisseur éligible.

- Un fournisseur devient suspendu après invitation mais avant soumission.

- Le client modifie un paramètre qui change le prix après plusieurs devis reçus.

## Critères d’acceptation

55. La RFQ n’est pas envoyée avec des champs obligatoires manquants.

56. L’admin peut expliquer pourquoi chaque fournisseur a été exclu.

57. Un fournisseur suspendu financièrement ne peut pas soumettre de nouvelle offre.

# 10. Onboarding, conformité et qualification des sous-traitants

La validation du sous-traitant combine conformité société et qualification métier par service. Être “IT” ne suffit pas pour tous les services IT.

## Acteurs

- Provider Owner/Manager.

- Franchisé/Expert métier.

- Compliance Matricia.

## Écrans / parcours

| **ID écran** | **Nom**            | **But principal**               |
|--------------|--------------------|---------------------------------|
| ST-001       | Inscription        | OTP et rôle Provider.           |
| ST-002       | Profil société     | Données entreprise.             |
| ST-003       | Documents          | Assurances/agréments/documents. |
| ST-004       | Compétences        | Services demandés.              |
| ST-005       | Qualifications     | Questionnaires par service.     |
| ST-006       | Certifications     | Échéances et preuves.           |
| ST-007       | Références         | Projets/clients.                |
| ST-008       | Capacité           | Disponibilité.                  |
| ST-009       | Zones              | Régions/rayon.                  |
| ST-010       | Contrat partenaire | Signature.                      |
| ADM-009      | Qualification      | Décision service par service.   |

## Données et champs

| **Bloc**              | **Champs obligatoires / données**                                   |
|-----------------------|---------------------------------------------------------------------|
| Profil                | activité, équipe, années, zones, capacité, disponibilité.           |
| Qualification service | service_id, questionnaire_version, score, mandatory_checks, status. |
| Certification         | nom, organisme, numéro, date, expiration, fichier.                  |
| Assurance             | type, police, couverture, expiration.                               |
| Référence             | secteur, service, année, description, preuve, verified flag.        |

## Règles métier

- Conformité société et qualification service sont séparées.

- Une certification expirée peut suspendre seulement les services concernés.

- Capacité FULL/PAUSED retire le fournisseur du matching sans désactiver son compte.

- Le contrat partenaire doit être signé avant nouvelles RFQ.

- Le fournisseur peut activer le rôle Client avec le même Passeport organisation.

## Machine d’état

| **État**                  | **Description / transition**                |
|---------------------------|---------------------------------------------|
| PROFILE_INCOMPLETE        | Données manquantes.                         |
| UNDER_REVIEW              | Conformité société.                         |
| QUALIFICATION_IN_PROGRESS | Services en contrôle.                       |
| PARTIALLY_QUALIFIED       | Certains services actifs.                   |
| ACTIVE                    | Au moins un service actif et contrat signé. |
| FINANCIAL_RESTRICTED      | Pas de nouvelles opportunités.              |
| QUALITY_RESTRICTED        | Restrictions qualité.                       |
| COMPLIANCE_RESTRICTED     | Documents/conformité.                       |
| SUSPENDED                 | Compte global suspendu.                     |
| TERMINATED                | Relation terminée.                          |

## Tables principales

- provider_profiles

- provider_services

- provider_qualifications

- provider_qualification_answers

- provider_certifications

- provider_insurances

- provider_references

- provider_capacity

- provider_regions

- partner_contracts

## API / fonctions backend

| **Fonction**                 | **Responsabilité**           |
|------------------------------|------------------------------|
| submitProviderProfile        | Soumettre conformité.        |
| evaluateServiceQualification | Règles par service.          |
| approveService               | Activer service.             |
| suspendService               | Suspendre ciblé.             |
| updateCapacity               | Mettre à jour disponibilité. |
| activateClientRole           | Ajouter rôle Client.         |

## Événements / automatisations

| **Événement**                 | **Actions**            |
|-------------------------------|------------------------|
| CERTIFICATION_EXPIRING        | Rappels J-60/J-30/J-7. |
| SERVICE_APPROVED              | Éligible matching.     |
| SERVICE_SUSPENDED             | Retirer du matching.   |
| PROVIDER_FINANCIAL_RESTRICTED | Bloquer nouvelles RFQ. |

## Erreurs et exceptions à traiter

- Société conforme mais certification obligatoire absente.

- Fournisseur déclare expérience supérieure à l’âge de la société.

- Une qualification est modifiée pendant une consultation active.

## Critères d’acceptation

58. Le fournisseur peut être APPROVED pour Web et REJECTED pour Pentest.

59. Une assurance expirée suspend uniquement les services dépendants.

60. Le fournisseur sous restriction financière ne reçoit aucune nouvelle consultation.

# 11. Devis, comparaison, feedback et sélection

Les devis sont standardisés pour permettre une comparaison réellement utile tout en laissant le sous-traitant fixer librement son prix.

## Acteurs

- Sous-traitant Sales/Owner.

- Client Buyer/Admin.

- Franchisé supervision.

## Écrans / parcours

| **ID écran** | **Nom**       | **But principal**                     |
|--------------|---------------|---------------------------------------|
| ST-016       | Créer devis   | Formulaire standard + champs service. |
| ST-017       | Prévisualiser | Voir rendu client.                    |
| ST-018       | Mes devis     | Versions/statuts.                     |
| CL-025       | Devis reçus   | Liste.                                |
| CL-026       | Comparateur   | Comparaison normalisée.               |
| CL-027       | Sélection     | Choisir offre.                        |
| ST-019       | Feedback      | Classement après clôture.             |

## Données et champs

| **Bloc** | **Champs obligatoires / données**                         |
|----------|-----------------------------------------------------------|
| Prix     | HT, TVA, TTC, devise, lignes, coûts récurrents/ponctuels. |
| Contenu  | solution, livrables, inclus, exclusions, options.         |
| Temps    | démarrage, durée, planning, validité.                     |
| Qualité  | garantie, corrections, prérequis, SLA.                    |
| Version  | version_number, supersedes_id, change_reason.             |

## Règles métier

- Prix libre en consultation standard.

- Les champs obligatoires peuvent varier par service.

- Un devis soumis est immuable; toute modification crée V2.

- Les autres fournisseurs ne voient jamais les offres concurrentes.

- Le client peut demander une révision; le fournisseur peut maintenir/refuser/réviser.

- Le feedback non retenu affiche classement et axes d’amélioration sans identité/prix exact du gagnant par défaut.

## Machine d’état

| **État**           | **Description / transition** |
|--------------------|------------------------------|
| DRAFT              | Modifiable.                  |
| SUBMITTED          | Offre officielle.            |
| REVISION_REQUESTED | Client demande révision.     |
| REVISED            | Nouvelle version.            |
| SELECTED           | Retenue.                     |
| NOT_SELECTED       | Non retenue.                 |
| WITHDRAWN          | Retirée.                     |
| EXPIRED            | Validité terminée.           |

## Tables principales

- quotes

- quote_versions

- quote_items

- quote_options

- quote_attachments

- quote_comparison_snapshots

- quote_feedback

## API / fonctions backend

| **Fonction**         | **Responsabilité**                           |
|----------------------|----------------------------------------------|
| validateQuote        | Vérifier complétude.                         |
| submitQuote          | Figer version.                               |
| requestQuoteRevision | Créer demande.                               |
| compareQuotes        | Normaliser critères.                         |
| selectQuote          | Verrouiller sélection et déclencher contrat. |
| generateFeedback     | Créer feedback anonymisé.                    |

## Événements / automatisations

| **Événement**   | **Actions**                          |
|-----------------|--------------------------------------|
| QUOTE_SUBMITTED | Notifier client.                     |
| QUOTE_SELECTED  | Notifier gagnant et générer contrat. |
| RFQ_CLOSED      | Notifier non retenus + feedback.     |

## Erreurs et exceptions à traiter

- TVA incohérente avec TTC.

- Devis V1 sélectionné alors que V2 existe.

- Un fournisseur tente de modifier prix par message sans nouvelle version.

## Critères d’acceptation

61. Le devis ne peut pas être envoyé sans les champs bloquants.

62. Le client peut comparer prix, délai, livrables, garanties et coûts récurrents côte à côte.

63. Le fournisseur non retenu voit son classement sans données confidentielles du gagnant.

# 12. Contrats, missions, jalons et livraisons

Le devis retenu devient un contrat versionné, puis une mission suivie par jalons, checklists et preuves de réalisation.

## Acteurs

- Client signataire.

- Sous-traitant signataire/exécutant.

- Matricia comme plateforme de génération/traçabilité.

## Écrans / parcours

| **ID écran** | **Nom**         | **But principal**           |
|--------------|-----------------|-----------------------------|
| CL-028       | Contrats        | Liste et documents.         |
| CL-029       | Signature       | Acceptation version exacte. |
| ST-020       | Missions        | Missions actives.           |
| ST-021       | Jalons          | Progression.                |
| ST-022       | Checklists      | Obligations.                |
| ST-023       | Livraison       | Preuves.                    |
| CL-031       | Jalons client   | Validation.                 |
| CL-032       | Livraison reçue | Revue.                      |
| CL-033       | Acceptation     | Réception.                  |
| CL-035       | Avenant         | Demande supplémentaire.     |

## Données et champs

| **Bloc**    | **Champs obligatoires / données**                                                                             |
|-------------|---------------------------------------------------------------------------------------------------------------|
| Contrat     | parties, request_snapshot, quote_version, clauses, price, dates, corrections, penalties, IP, confidentiality. |
| Jalon       | titre, ordre, due_at, owner, deliverables, validation_required.                                               |
| Checklist   | service_template_version, items, proof_required.                                                              |
| Livraison   | version, description, files, URLs, proof set.                                                                 |
| Acceptation | criterion_id, status compliant/noncompliant/na, comment, evidence.                                            |

## Règles métier

- Le contrat final est immuable; modification par avenant.

- La version exacte du devis retenu est incorporée.

- Les livrables et critères d’acceptation servent plus tard au moteur de non-conformité.

- Les demandes supplémentaires passent par change_request/avenant.

- Une livraison peut être bloquée si une preuve obligatoire manque.

## Machine d’état

| **État**          | **Description / transition** |
|-------------------|------------------------------|
| DRAFT             | Contrat généré.              |
| PENDING_SIGNATURE | À signer.                    |
| ACTIVE            | Signé par les parties.       |
| AMENDED           | Avenant actif.               |
| COMPLETED         | Mission terminée.            |
| TERMINATED        | Résiliation.                 |

## Tables principales

- contracts

- contract_versions

- contract_items

- contract_signatures

- change_requests

- contract_amendments

- missions

- mission_milestones

- service_checklist_templates

- mission_checklist_items

- deliverables

- delivery_versions

- delivery_proofs

- acceptance_checklists

## API / fonctions backend

| **Fonction**     | **Responsabilité**                |
|------------------|-----------------------------------|
| generateContract | Assembler demande+devis+clauses.  |
| signContract     | Enregistrer preuve/version.       |
| createMission    | Créer mission et jalons.          |
| submitMilestone  | Soumettre jalon.                  |
| submitDelivery   | Valider preuves et créer version. |
| acceptDelivery   | Clôturer mission.                 |
| createAmendment  | Créer avenant à signer.           |

## Événements / automatisations

| **Événement**      | **Actions**                               |
|--------------------|-------------------------------------------|
| CONTRACT_SIGNED    | Créer mission + commission rule snapshot. |
| MILESTONE_DUE      | Rappels.                                  |
| DELIVERY_SUBMITTED | Créer action client.                      |
| DELIVERY_ACCEPTED  | Clôturer et calculer métriques.           |

## Erreurs et exceptions à traiter

- Une partie signe une ancienne version alors qu’une nouvelle existe.

- Jalon supprimé après démarrage.

- Preuve obligatoire manquante.

- Avenant change le prix mais pas la commission snapshot attendue.

## Critères d’acceptation

64. Le contrat affiche exactement les livrables et exclusions acceptés.

65. Une demande supplémentaire ne modifie jamais silencieusement le contrat original.

66. La livraison conserve toutes ses versions et preuves.

# 13. Non-conformité, litiges, pénalités et réaffectation

Le système protège à la fois le client et le sous-traitant. Un signalement n’est pas une condamnation; la sanction intervient seulement après confirmation de non-conformité contractuelle.

## Acteurs

- Client.

- Sous-traitant.

- DISPUTE_MANAGER / Admin.

- Franchisé comme premier niveau opérationnel selon permissions.

## Écrans / parcours

| **ID écran** | **Nom**                 | **But principal**                       |
|--------------|-------------------------|-----------------------------------------|
| CL-034       | Signaler non-conformité | Sélection critère contractuel + preuve. |
| ST-025       | Incident                | Voir avertissement/répondre.            |
| ADM-026      | Litiges                 | File de traitement.                     |
| ADM-027      | Décision incident       | Comparer contrat/preuves.               |
| ADM-028      | Réaffectation           | Créer R1/R2.                            |

## Données et champs

| **Bloc**         | **Champs obligatoires / données**                                           |
|------------------|-----------------------------------------------------------------------------|
| Incident         | mission_id, category, contract_item_id, description, evidence, severity.    |
| Avertissement    | level, sent_at, response_due_at.                                            |
| Réponse provider | recognize/correct/dispute/out_of_scope, comment, evidence.                  |
| Décision         | COMPLIANT/MINOR_CORRECTION/OUT_OF_SCOPE/NON_COMPLIANT/CLIENT_ABUSE, reason. |
| Pénalité         | rule_id, amount, beneficiary, status.                                       |
| Réaffectation    | original_mission_id, sequence, new_request_id, cost_delta.                  |

## Règles métier

- Le client doit rattacher la plainte à une obligation/livrable ou expliquer précisément.

- Premier déclenchement: avertissement automatique, pas mise en demeure.

- Réponse standard fournisseur: 48h; urgent: 24h; valeurs configurables.

- Correction standard: 5 jours ouvrables, configurable par service.

- Demande hors périmètre = aucune sanction; proposition d’avenant.

- NON_COMPLIANT confirmé déclenche pénalité + commission Matricia due + retrait + réaffectation.

- Le nouveau prestataire produit un nouveau devis/contrat ou utilise un tarif cadre.

- Un surcoût de remplacement n’est pas automatiquement pris en charge par Matricia; accord client et règles contractuelles.

## Machine d’état

| **État**                | **Description / transition** |
|-------------------------|------------------------------|
| REPORTED                | Signalement.                 |
| WARNING_SENT            | Avertissement envoyé.        |
| PROVIDER_RESPONSE       | Réponse reçue.               |
| CORRECTION_REQUIRED     | Correction.                  |
| UNDER_MATRICIA_REVIEW   | Contestation.                |
| OUT_OF_SCOPE            | Demande supplémentaire.      |
| RESOLVED                | Conforme/corrigé.            |
| NON_COMPLIANT_CONFIRMED | Faute confirmée.             |
| REASSIGNED              | Mission transférée.          |

## Tables principales

- incidents

- incident_evidence

- warnings

- incident_responses

- incident_decisions

- penalties

- reassignments

- replacement_requests

## API / fonctions backend

| **Fonction**              | **Responsabilité**                      |
|---------------------------|-----------------------------------------|
| reportNonCompliance       | Créer incident + avertissement.         |
| respondIncident           | Enregistrer réponse.                    |
| decideIncident            | Décision avec permission.               |
| confirmNonCompliance      | Transaction atomique/idempotente.       |
| createReassignment        | Cloner le dossier utile sans ressaisie. |
| calculateReplacementDelta | Calculer surcoût.                       |

## Événements / automatisations

| **Événement**            | **Actions**                           |
|--------------------------|---------------------------------------|
| NON_COMPLIANCE_REPORTED  | Notifier fournisseur + SLA.           |
| NON_COMPLIANCE_CONFIRMED | Créer pénalité/commission/retrait/R1. |
| CORRECTION_DUE           | Rappels.                              |
| REASSIGNMENT_CREATED     | Lancer matching.                      |

## Erreurs et exceptions à traiter

- Double clic de confirmation créant deux pénalités.

- Client réclame une fonctionnalité non incluse.

- Prestataire corrige après la date mais avant décision.

- Nouveau fournisseur plus cher que le contrat initial.

## Critères d’acceptation

67. Une faute ne peut être confirmée sans motif et audit.

68. Une demande hors périmètre ne dégrade pas le fournisseur.

69. La confirmation de faute crée une seule pénalité et une seule commission même en retry.

70. Le client ne ressaisit pas son besoin lors de R1.

# 14. Facturation des sous-traitants et recouvrement

Matricia facture au sous-traitant ses commissions et, le cas échéant, pénalités. Le sous-traitant paie Matricia; la plateforme n’accède pas à son compte bancaire.

## Acteurs

- Sous-traitant Accounting/Owner.

- MATRICIA_FINANCE.

## Écrans / parcours

| **ID écran** | **Nom**           | **But principal**          |
|--------------|-------------------|----------------------------|
| ST-028       | Finance           | Solde et prévisions.       |
| ST-029       | Pré-relevé        | Opérations avant facture.  |
| ST-030       | Factures Matricia | Factures/relevés.          |
| ST-031       | Déclarer paiement | Référence + preuve.        |
| ST-032       | Échéancier        | Demande.                   |
| ST-033       | Commissions       | Historique.                |
| ADM-032      | Facturation       | Clôtures/factures.         |
| ADM-035      | Impayés           | Restrictions/recouvrement. |
| ADM-036      | Avoirs            | Corrections.               |
| ADM-037      | Recouvrement      | Dossiers.                  |

## Données et champs

| **Bloc**           | **Champs obligatoires / données**                         |
|--------------------|-----------------------------------------------------------|
| Commission accrual | mission, base, rate, amount, reason NORMAL/DEFAULT, date. |
| Statement line     | transaction, commission, penalty, adjustment.             |
| Invoice            | number, issue_date, due_date, HT, taxes, total, balance.  |
| Payment            | amount, date, method, reference, proof, verified status.  |
| Allocation         | payment_id, invoice_id, amount.                           |
| Payment plan       | balance, installments, approval.                          |

## Règles métier

- Pré-relevé avant clôture pour transparence.

- Contestation d’une ligne ne bloque pas automatiquement toutes les autres.

- Facture émise est immuable; correction par avoir + nouvelle facture si nécessaire.

- Échéance standard 7 jours paramétrable/versionnée.

- Paiement partiel ne renouvelle pas l’échéance.

- J+8: OVERDUE puis restriction des nouvelles opportunités.

- Échéancier uniquement s’il est approuvé.

- Intérêts/frais de retard seulement si une règle juridiquement validée est activée.

## Machine d’état

| **État**       | **Description / transition** |
|----------------|------------------------------|
| ACCRUED        | Commission calculée.         |
| PRE_STATEMENT  | Visible.                     |
| INVOICED       | Facturée.                    |
| PARTIALLY_PAID | Solde restant.               |
| PAID           | Réglée.                      |
| OVERDUE        | Échue.                       |
| PAYMENT_PLAN   | Échéancier actif.            |
| FORMAL_NOTICE  | Mise en demeure.             |
| COLLECTION     | Recouvrement.                |

## Tables principales

- commission_rules

- commission_accruals

- billing_periods

- statements

- statement_lines

- invoices

- invoice_lines

- credit_notes

- payments

- payment_allocations

- payment_proofs

- payment_plans

- payment_installments

- formal_notices

- collection_cases

## API / fonctions backend

| **Fonction**         | **Responsabilité**            |
|----------------------|-------------------------------|
| accrueCommission     | Créer commission idempotente. |
| generatePreStatement | Préparer période.             |
| closeBillingPeriod   | Verrouiller lignes.           |
| generateInvoice      | Numéro unique.                |
| declarePayment       | Créer paiement pending.       |
| verifyPayment        | Valider et allouer.           |
| requestPaymentPlan   | Créer demande.                |
| markOverdue          | Restreindre si nécessaire.    |

## Événements / automatisations

| **Événement**    | **Actions**                            |
|------------------|----------------------------------------|
| INVOICE_ISSUED   | Email + 7 jours.                       |
| PAYMENT_REMINDER | J+4/J+6/J+7.                           |
| INVOICE_OVERDUE  | J+8 restriction.                       |
| PAYMENT_VERIFIED | Réactiver si aucune autre restriction. |

## Erreurs et exceptions à traiter

- Paiement supérieur au solde.

- Un virement couvre plusieurs factures.

- Avoir après paiement complet.

- Facture générée deux fois sur la même période.

## Critères d’acceptation

71. Le sous-traitant voit le calcul mission par mission.

72. Un paiement partiel de 6 000 sur 10 000 laisse 4 000 dus à la date initiale.

73. La restriction bloque uniquement les nouvelles opportunités et conserve l’accès aux obligations existantes.

# 15. Franchise - onboarding, droits, obligations et revenus

Chaque bibliothèque a au maximum un franchisé. Le franchisé exploite son domaine, développe les questionnaires et le réseau, tout en respectant la gouvernance financière et centrale.

## Acteurs

- Franchisé Owner/Manager/Expert/Accounting.

- MATRICIA_ADMIN/FINANCE/LIBRARY_MANAGER.

- NEOXA/Jalil et Mme Asma pour droits économiques définis.

## Écrans / parcours

| **ID écran** | **Nom**             | **But principal**     |
|--------------|---------------------|-----------------------|
| FR-001       | Dashboard           | KPI bibliothèque.     |
| FR-002       | Ma bibliothèque     | Contrôle métier.      |
| FR-015       | Sous-traitants      | Qualification métier. |
| FR-023       | Invitations         | Développer réseau.    |
| FR-028       | Revenus             | Part économique.      |
| FR-031       | Droit d’entrée      | Solde/retention.      |
| ADM-012      | Franchisés          | Contrôle central.     |
| ADM-014      | Contrat franchise   | Version/signature.    |
| ADM-016      | Répartition revenus | Calculs/paiements.    |

## Données et champs

| **Bloc**     | **Champs obligatoires / données**                                    |
|--------------|----------------------------------------------------------------------|
| Franchise    | library_id, organization_id, territory, start/end, status.           |
| Contrat      | version, rights, obligations, revenue rule, entry fee rule.          |
| Entry fee    | amount, mode, upfront, withholding_pct, six_month_deadline, balance. |
| Revenue rule | library_id, effective dates, shares, distribution base.              |
| Allocation   | transaction, distributable_revenue, franchisee/neoxa/asma shares.    |

## Règles métier

- Un seul franchisé actif par bibliothèque.

- IT : franchisé/opérateur Hatim Ahmitech, droit d’entrée = 0, aucun prélèvement de droit de franchise ; bénéfice distribuable IT partagé 50 % Hatim Ahmitech / 50 % Jalil-NEOXA, 0 % Asma au titre de cette règle.

- Autres: 50 % franchisé / 25 % NEOXA / 25 % Asma-Matricia.

- Le droit d’entrée peut être payé comptant ou retenu sur la part du franchisé pendant 6 mois maximum.

- Si solde après 6 mois, il devient exigible selon délai contractuel; défaut peut mener restriction/suspension.

- Le franchisé est responsable de la qualité et mise à jour des questionnaires de sa bibliothèque.

- Les changements financiers/juridiques requièrent validation centrale.

## Machine d’état

| **État**             | **Description / transition** |
|----------------------|------------------------------|
| REGISTERED           | Candidat.                    |
| COMPANY_REVIEW       | Conformité société.          |
| CONTRACT_PENDING     | Contrat.                     |
| ENTRY_FEE_SETUP      | Mode paiement.               |
| LIBRARY_ASSIGNED     | Bibliothèque réservée.       |
| ACTIVE               | Franchise active.            |
| FINANCIAL_RESTRICTED | Défaut financier.            |
| SUSPENDED            | Suspension.                  |
| TERMINATED           | Fin.                         |

## Tables principales

- franchises

- franchise_users

- franchise_roles

- franchise_contracts

- franchise_entry_fees

- franchise_revenue_rules

- franchise_revenue_transactions

- franchise_allocations

- franchise_statements

## API / fonctions backend

| **Fonction**             | **Responsabilité**                   |
|--------------------------|--------------------------------------|
| createFranchise          | Créer avec contrainte d’exclusivité. |
| setupEntryFee            | Configurer paiement.                 |
| allocateFranchiseRevenue | Appliquer règle versionnée.          |
| withholdEntryFee         | Retenir sur part franchisé.          |
| closeFranchisePeriod     | Générer relevé.                      |
| suspendFranchise         | Appliquer restrictions.              |

## Événements / automatisations

| **Événement**               | **Actions**                      |
|-----------------------------|----------------------------------|
| FRANCHISE_ACTIVATED         | Ouvrir dashboard/permissions.    |
| ENTRY_FEE_WITHHELD          | Réduire solde.                   |
| ENTRY_FEE_6M_REACHED        | Créer balance due si nécessaire. |
| FRANCHISE_REVENUE_ALLOCATED | Mettre à jour P&L/relevés.       |

## Erreurs et exceptions à traiter

- Deux franchisés actifs sur la même bibliothèque.

- Règle 50/25/25 modifiée rétroactivement.

- Allocation IT appliquant par erreur 25 % à Asma.

- Franchisé sans gains suffisants pendant 6 mois.

## Critères d’acceptation

74. Une transaction IT alimente d’abord le P&L IT ; seule la clôture du bénéfice distribuable IT déclenche une distribution 50 % Hatim Ahmitech / 50 % Jalil-NEOXA, sans part Asma dans cette distribution spécifique.

75. Une transaction hors IT applique la règle 50/25/25 en vigueur à sa date.

76. Le droit d’entrée restant est visible et auditable.

# 16. Invitations et CRM des franchisés

Le franchisé doit pouvoir développer activement son réseau et suivre l’origine des clients et sous-traitants amenés à Matricia.

## Acteurs

- Franchisé Owner/Manager.

- Client/Sous-traitant invité.

- Admin central.

## Écrans / parcours

| **ID écran** | **Nom**               | **But principal**            |
|--------------|-----------------------|------------------------------|
| FR-023       | Invitations           | Liste/statuts.               |
| FR-024       | Inviter client        | Formulaire.                  |
| FR-025       | Inviter sous-traitant | Formulaire.                  |
| FR-026       | CRM                   | Prospects et activité.       |
| FR-027       | Pipeline              | Conversions.                 |
| ADM-012      | Vue franchisés        | Comparer acquisition réseau. |

## Données et champs

| **Bloc**   | **Champs obligatoires / données**                                                   |
|------------|-------------------------------------------------------------------------------------|
| Invitation | type, contact_name, company, email, phone, language, library_id, token, expires_at. |
| Referral   | source_franchise_id, invitation_id, target_organization_id, conversion_stage.       |
| CRM lead   | status, last_activity, next_action, owner_user_id.                                  |

## Règles métier

- Lien unique traçable, expiration par défaut 30 jours.

- Import CSV possible avec validation et anti-spam.

- L’origine de l’inscription ne doit jamais être perdue.

- Une invitation n’accorde pas automatiquement de commission économique supplémentaire si aucune règle ne le prévoit.

- Les relances doivent respecter les préférences et limites d’envoi.

## Machine d’état

| **État**        | **Description / transition** |
|-----------------|------------------------------|
| SENT            | Envoyée.                     |
| OPENED          | Lien ouvert.                 |
| REGISTERED      | Compte créé.                 |
| PROFILE_STARTED | Profil commencé.             |
| VERIFIED        | Organisation validée.        |
| ACTIVE          | Client/provider actif.       |
| EXPIRED         | Lien expiré.                 |

## Tables principales

- franchise_invitations

- referrals

- franchise_leads

- franchise_pipeline_events

## API / fonctions backend

| **Fonction**               | **Responsabilité**      |
|----------------------------|-------------------------|
| sendInvitation             | Créer token + message.  |
| importInvitationsCsv       | Valider et créer lot.   |
| trackInvitationOpen        | Mettre OPENED.          |
| linkReferral               | Rattacher organisation. |
| scheduleInvitationReminder | Relance contrôlée.      |

## Événements / automatisations

| **Événement**      | **Actions**          |
|--------------------|----------------------|
| INVITATION_SENT    | Email.               |
| INVITATION_OPENED  | Mettre KPI.          |
| REFERRAL_VERIFIED  | Mettre conversion.   |
| INVITATION_EXPIRED | Option régénération. |

## Erreurs et exceptions à traiter

- Email déjà associé à une organisation existante.

- Même prospect invité par deux franchisés.

- Lot CSV contenant des doublons ou emails invalides.

## Critères d’acceptation

77. Le franchisé sait combien d’invitations deviennent clients validés.

78. L’origine d’un compte invité est retrouvable après plusieurs mois.

79. Un import CSV n’envoie pas deux invitations identiques dans le même lot.

# 17. Centrale d’achat, contrats volume et pools de services

Matricia peut agréger la demande afin de négocier des tarifs de volume avec plusieurs sous-traitants, puis distribuer ces unités dans les Boxes et crédits.

## Acteurs

- Franchisé propose.

- Finance/Admin approuve.

- Sous-traitants qualifiés soumissionnent.

- Clients consomment les avantages.

## Écrans / parcours

| **ID écran** | **Nom**               | **But principal**         |
|--------------|-----------------------|---------------------------|
| ADM-VOL-001  | Dashboard volume      | Demande, capacité, coûts. |
| ADM-VOL-002  | Analyse demande       | Historique/forecast.      |
| ADM-VOL-003  | Créer négociation     | SKU/volume.               |
| ADM-VOL-004  | Offres fournisseurs   | Paliers/capacité.         |
| ADM-VOL-005  | Contrats-cadres       | Prix/SLA.                 |
| ADM-VOL-006  | Pools                 | Stock virtuel.            |
| ADM-VOL-007  | Réservations          | Affectations clients.     |
| ADM-VOL-008  | Rentabilité           | Coût réel/marge.          |
| FR-035       | Proposer achat volume | Proposition franchisé.    |

## Données et champs

| **Bloc**    | **Champs obligatoires / données**                                            |
|-------------|------------------------------------------------------------------------------|
| SKU         | code, version, livrables, exclusions, SLA, corrections, acceptance criteria. |
| Négociation | forecast, minimum_commitment, max_volume, period, payment_model.             |
| Offer       | provider, price_tiers, capacity_monthly, SLA, rebate.                        |
| Framework   | selected providers, allocated share, term, penalty, quality thresholds.      |
| Pool        | contracted, available, reserved, committed, consumed.                        |
| Reservation | customer, benefit, units, provider allocation, expiry.                       |

## Règles métier

- Préférer forecast 100 + engagement minimum plus faible + paiement à la consommation plutôt que prépayer aveuglément 100 unités.

- Un service doit être standardisé en SKU avant achat volume.

- Plusieurs fournisseurs peuvent partager le pool pour réduire le risque.

- Le stock virtuel empêche de promettre plus d’unités que la capacité contractuelle sauf overbooking explicitement autorisé.

- Le coût total inclut corrections/incidents/support, pas seulement prix facial.

- Les paliers et rebates sont versionnés et appliqués selon le contrat.

## Machine d’état

| **État**         | **Description / transition** |
|------------------|------------------------------|
| DEMAND_DETECTED  | Potentiel volume.            |
| ANALYZING        | Forecast.                    |
| NEGOTIATING      | Appel d’offres volume.       |
| FRAMEWORK_ACTIVE | Contrat-cadre.               |
| POOL_ACTIVE      | Unités disponibles.          |
| LOW_STOCK        | Renégociation recommandée.   |
| CLOSED           | Fin période.                 |

## Tables principales

- service_skus

- volume_opportunities

- volume_negotiations

- volume_negotiation_suppliers

- volume_supplier_offers

- volume_price_tiers

- framework_agreements

- framework_agreement_versions

- service_inventory_pools

- service_inventory_transactions

- service_reservations

- provider_capacity_commitments

- volume_rebates

- volume_forecasts

- volume_profitability_snapshots

## API / fonctions backend

| **Fonction**             | **Responsabilité**                       |
|--------------------------|------------------------------------------|
| detectVolumeOpportunity  | Analyser demande historique.             |
| openVolumeNegotiation    | Inviter fournisseurs.                    |
| compareVolumeOffers      | Comparer coût/qualité/capacité.          |
| activateFramework        | Créer contrat-cadre.                     |
| reserveServiceUnit       | Réserver unité.                          |
| allocateProviderFromPool | Choisir provider selon capacité/qualité. |
| consumeServiceUnit       | Décrémenter après livraison.             |
| calculateVolumeRebate    | Créer avoir/rebate si seuil.             |

## Événements / automatisations

| **Événement**            | **Actions**              |
|--------------------------|--------------------------|
| POOL_LOW                 | Alerter admin.           |
| SERVICE_UNIT_RESERVED    | Bloquer unité.           |
| SERVICE_UNIT_CANCELLED   | Libérer selon règle.     |
| VOLUME_THRESHOLD_REACHED | Appliquer palier/rebate. |

## Erreurs et exceptions à traiter

- Fournisseur volume suspendu alors qu’il a des réservations.

- Pool épuisé mais avantage Box encore visible.

- Réservation client annulée après allocation fournisseur.

- Rebate calculé deux fois.

## Critères d’acceptation

80. Un avantage VOLUME_POOL réserve une unité atomiquement.

81. Le dashboard montre disponible/réservé/engagé/consommé.

82. Le système peut répartir 100 unités entre plusieurs fournisseurs.

# 18. Administration centrale Matricia

L’administration est le cockpit opérationnel. Elle doit permettre la gestion totale sans accès direct à la base de données.

## Acteurs

- Super Admin.

- Matricia Admin.

- Compliance.

- Finance.

- Dispute Manager.

- Library Manager.

- Support.

- Auditeur lecture seule.

## Écrans / parcours

| **ID écran** | **Nom**               | **But principal**         |
|--------------|-----------------------|---------------------------|
| ADM-001      | Dashboard exécutif    | Priorités + KPI.          |
| ADM-002      | À traiter aujourd’hui | Actions triées.           |
| ADM-003      | Clients               | Validation/suivi.         |
| ADM-007      | Sous-traitants        | Conformité/qualification. |
| ADM-012      | Franchisés            | Contrats/droits/revenus.  |
| ADM-017      | Bibliothèques         | Catalogue.                |
| ADM-021      | Demandes              | RFQ.                      |
| ADM-024      | Contrats              | Contrats actifs.          |
| ADM-025      | Missions              | Suivi.                    |
| ADM-026      | Litiges               | Décisions.                |
| ADM-029      | Abonnements           | Plans.                    |
| ADM-031A     | Boxes & Avantages     | Catalogue/rentabilité.    |
| ADM-032      | Facturation           | Finance provider.         |
| ADM-038      | Exceptions            | Cas anormaux.             |
| ADM-039      | Risk Flags            | Abus potentiels.          |
| ADM-040      | Audit                 | Traçabilité.              |
| ADM-044      | Configuration         | Paramètres versionnés.    |

## Données et champs

| **Bloc**      | **Champs obligatoires / données**                                               |
|---------------|---------------------------------------------------------------------------------|
| Dashboard     | counters, SLA breaches, overdue, expiring docs, pool alerts, trial expirations. |
| Action item   | type, priority, resource, assignee, due_at, blocking.                           |
| Configuration | key, value, scope, effective_from/to, version, approval_required.               |

## Règles métier

- La page d’accueil commence par les actions prioritaires, pas seulement des graphiques.

- Toute action sensible est soumise à permission et audit.

- Les paramètres commerciaux/juridiques ne sont pas hardcodés.

- Un admin financier ne peut pas modifier un questionnaire; un expert bibliothèque ne peut pas modifier une facture.

- Les exceptions et risk flags nécessitent revue humaine; aucun risk flag ne sanctionne seul.

## Machine d’état

| **État**        | **Description / transition** |
|-----------------|------------------------------|
| NORMAL          | Aucune action urgente.       |
| ACTION_REQUIRED | Actions dans SLA.            |
| SLA_BREACH      | Dépassement.                 |
| EXCEPTION       | Cas hors workflow normal.    |

## Tables principales

- action_items

- admin_priority_items

- system_settings

- setting_versions

- exceptions

- risk_flags

- audit_logs

## API / fonctions backend

| **Fonction**          | **Responsabilité**                                     |
|-----------------------|--------------------------------------------------------|
| getExecutiveDashboard | Agrégats prioritaires.                                 |
| assignAction          | Affecter responsabilité.                               |
| resolveException      | Clôturer avec motif.                                   |
| reviewRiskFlag        | Confirmer/rejeter signal.                              |
| updateSetting         | Créer nouvelle version.                                |
| impersonationRequest  | Option support contrôlée si retenue, toujours auditée. |

## Événements / automatisations

| **Événement**     | **Actions**                                    |
|-------------------|------------------------------------------------|
| EXCEPTION_CREATED | Créer action admin.                            |
| SLA_BREACH        | Escalader.                                     |
| RISK_FLAG_CREATED | Créer revue sans sanction.                     |
| SETTING_PUBLISHED | Appliquer à nouvelles opérations selon portée. |

## Erreurs et exceptions à traiter

- Admin tente d’éditer une facture émise.

- Paramètre change pendant une transaction.

- Action critique sans assignee.

- Exception auto-résolue à tort après retry.

## Critères d’acceptation

83. Mme Asma peut voir immédiatement clients à valider, litiges, impayés, Boxes et revenus.

84. Aucune opération critique n’exige une modification SQL manuelle.

85. Les rôles admin sont réellement cloisonnés.

# 19. Moteur Avantages & Boxes - administration

Le moteur commercial permet de construire les offres Premium, Gold et Platinum, attribuer des avantages, piloter les coûts et connecter les Boxes aux services standard, RFQ ou pools de volume.

## Acteurs

- Subscription Manager.

- Finance.

- Franchise Manager pour propositions.

- Admin/Super Admin pour validation sensible.

## Écrans / parcours

| **ID écran** | **Nom**                | **But principal**             |
|--------------|------------------------|-------------------------------|
| ADM-031B     | Catalogue avantages    | Créer/rechercher.             |
| ADM-031C     | Créer avantage         | Coût/éligibilité/fulfillment. |
| ADM-031D     | Box Builder            | Slots/budget/règles.          |
| ADM-031F     | Matrice Plan↔Avantages | Éligibilités.                 |
| ADM-031G     | Packs de crédits       | Achat à la carte.             |
| ADM-031H     | Promotions             | Bonus/campagnes.              |
| ADM-031I     | Attribution manuelle   | Geste commercial.             |
| ADM-031J     | Consommations          | Réservations/livraisons.      |
| ADM-031K     | Capacités              | Stocks/providers.             |
| ADM-031L     | Coûts fournisseurs     | Tarifs internes.              |
| ADM-031M     | Rentabilité            | Simulations.                  |
| ADM-031O     | Versions               | Historique.                   |
| ADM-031P     | Simulation             | Voir comme client.            |

## Données et champs

| **Bloc**     | **Champs obligatoires / données**                                                                          |
|--------------|------------------------------------------------------------------------------------------------------------|
| Avantage     | type, plan eligibility, library, service, credit_cost, internal_cost, reference_value, quota, fulfillment. |
| Box          | plan_version, slots, mandatory items, optional items, credit budget, rollover policy.                      |
| Promotion    | audience, dates, bonus credits, library scope, max uses.                                                   |
| Grant manuel | client, avantage/crédits, reason, expires_at, approval level.                                              |
| Rentabilité  | subscription revenue, benefit pool, expected usage, expected cost, worst case.                             |

## Règles métier

- Types: PLATFORM_FEATURE, SERVICE_UNIT, CREDIT_SERVICE, PRIORITY, QUOTA, ACCESS_RIGHT, SERVICE_SUBSIDY, CONSULTATION, REPORT, CUSTOM.

- Fulfillment: AUTOMATED_PLATFORM, MATRICIA_INTERNAL, DIRECT_PROVIDER, SUBCONTRACTOR_POOL, VOLUME_POOL, RFQ.

- Une Box peut être FIXED, SEMI_CUSTOM ou CUSTOM.

- Gold doit pouvoir utiliser des slots; Platinum un catalogue plus large; Premium plus guidé.

- Les cadeaux admin importants nécessitent workflow d’approbation configurable.

- Une Box non rentable peut être bloquée ou nécessiter Super Admin.

- La consommation d’un avantage garde le cost snapshot et la version.

## Machine d’état

| **État**     | **Description / transition**  |
|--------------|-------------------------------|
| DRAFT        | Avantage/Box en préparation.  |
| UNDER_REVIEW | Validation.                   |
| ACTIVE       | Disponible.                   |
| PAUSED       | Plus de nouvelles sélections. |
| RETIRED      | Historique seulement.         |

## Tables principales

- benefit_definitions

- benefit_versions

- benefit_eligibility_rules

- benefit_prerequisites

- benefit_fulfillment_rules

- benefit_provider_rates

- benefit_capacity

- box_definitions

- box_versions

- box_slots

- box_slot_options

- plan_entitlements

- plan_box_rules

- customer_boxes

- customer_box_selections

- benefit_redemptions

- manual_benefit_grants

- benefit_grant_approvals

- box_profitability_snapshots

- benefit_usage_metrics

## API / fonctions backend

| **Fonction**        | **Responsabilité**            |
|---------------------|-------------------------------|
| createBenefit       | Créer avantage.               |
| simulateBenefitCost | Simuler coûts.                |
| publishBenefit      | Publier version.              |
| createBoxVersion    | Créer Box.                    |
| validateBox         | Contrôler rentabilité/règles. |
| grantManualBenefit  | Attribuer avec approval.      |
| redeemBenefit       | Réserver crédits/capacité.    |
| completeRedemption  | Consommer après preuve.       |

## Événements / automatisations

| **Événement**                  | **Actions**                        |
|--------------------------------|------------------------------------|
| BENEFIT_PUBLISHED              | Visible selon audience.            |
| BOX_PUBLISHED                  | Applicable aux nouvelles périodes. |
| BENEFIT_CAPACITY_LOW           | Alerte.                            |
| BOX_PROFITABILITY_RISK         | Alerte finance.                    |
| MANUAL_GRANT_APPROVAL_REQUIRED | Créer action approbateur.          |

## Erreurs et exceptions à traiter

- Avantage sans fournisseur disponible.

- Crédit débité deux fois.

- Box modifiée alors que période client en cours.

- Promotion attribuée deux fois au même client.

- Pool volume épuisé.

## Critères d’acceptation

86. L’admin peut ajouter un avantage à Gold sans déploiement de code.

87. Le système calcule le coût prévisionnel d’une Box avant publication.

88. Une consommation VOLUME_POOL réduit correctement le stock et le wallet.

# 20. Finance consolidée et P&L par bibliothèque

La plateforme doit séparer clairement les flux juridiques/comptables tout en fournissant une vue consolidée. Les montants ci-dessous sont des catégories de ledger, pas une écriture comptable définitive.

| **Flux**                 | **Payeur**                 | **Bénéficiaire / traitement**                               | **Ledger séparé**                |
|--------------------------|----------------------------|-------------------------------------------------------------|----------------------------------|
| Abonnement client        | Client                     | Matricia selon plan; allocation interne Core/Benefit Pool   | subscription_ledger              |
| Crédits achetés          | Client                     | Revenu non alloué jusqu’à consommation selon moteur interne | credit_revenue_ledger            |
| Prestation standard RFQ  | Client                     | Sous-traitant selon contrat Client↔Sous-traitant            | client_provider_payment_tracking |
| Commission Matricia      | Sous-traitant              | Matricia / franchise économique selon règle                 | provider_commission_ledger       |
| Pénalité                 | Sous-traitant              | Selon clause/beneficiary                                    | penalty_ledger                   |
| Revenu franchise hors IT | Transaction attribuée      | 50% franchisé / 25% NEOXA / 25% Asma-Matricia               | franchise_allocation_ledger      |
| Bénéfice distribuable IT | P&L IT après coûts directs admissibles | 50% Hatim Ahmitech / 50% Jalil-NEOXA / 0% Asma             | franchise_profit_distribution_ledger |
| Droit d’entrée franchise | Franchisé                  | Selon contrat franchise                                     | franchise_entry_fee_ledger       |
| Coût fulfillment Box     | Matricia/structure définie | Sous-traitant/pool/internal                                 | benefit_cost_ledger              |

## 20.1 Allocation économique des abonnements et crédits

- Chaque version de plan peut définir core_allocation_pct et benefit_pool_allocation_pct.

- Le CORE_SUBSCRIPTION_REVENUE correspond à l’accès plateforme et ne doit pas être arbitrairement attribué à une bibliothèque simplement parce qu’un avantage y est consommé.

- Le BENEFIT_POOL_REVENUE est alloué aux bibliothèques selon la valeur économique des consommations réelles de la période.

- Les crédits achetés sont enregistrés comme revenu non alloué dans le moteur interne puis alloués lors de leur consommation. Cette logique technique doit être validée comptablement avant production.

- Les crédits promotionnels ont revenue_value=0 mais peuvent avoir fulfillment_cost\>0; ils constituent donc un coût promotionnel et non un faux revenu de franchise.

## 20.2 P&L par bibliothèque

| **Indicateur**            | **Définition**                                                        |
|---------------------------|-----------------------------------------------------------------------|
| Gross attributed revenue  | Revenu interne attribué à la bibliothèque.                            |
| Refunds / credit notes    | Remboursements et avoirs liés.                                        |
| Provider fulfillment cost | Coût payé au sous-traitant/pool pour les avantages.                   |
| Volume cost               | Coût de consommation des contrats-cadres.                             |
| Distributable revenue     | Base économique après règles/ajustements définis.                     |
| Franchise shares          | Répartition selon rule_id versionné.                                  |
| Operating KPI             | Marge, coût moyen, taux utilisation, conversion anomalie→RFQ→contrat. |

# 21. Données et schéma Supabase

## Identity

- users

- organizations

- organization_roles

- organization_users

- organization_sites

- organization_contacts

- organization_join_requests

## Compliance

- documents

- document_versions

- document_requirements

- compliance_checks

- administrative_anomalies

- compliance_questions

- compliance_responses

## Subscriptions

- subscription_plans

- subscription_plan_versions

- subscriptions

- subscription_invoices

- subscription_payments

- plan_entitlements

## Benefits & Credits

- benefit_definitions

- benefit_versions

- benefit_rules

- box_definitions

- box_versions

- box_slots

- customer_boxes

- benefit_redemptions

- credit_wallets

- credit_transactions

- credit_packages

- credit_purchases

- credit_reservations

## Libraries

- libraries

- library_versions

- categories

- services

- service_versions

## Question Engine

- question_banks

- questionnaires

- questionnaire_versions

- question_sections

- questions

- question_versions

- question_options

- question_rules

- rule_conditions

- rule_actions

- diagnostic_sessions

- diagnostic_answers

- score_snapshots

## Opportunities

- recommendations

- opportunities

- service_requests

- request_documents

## Providers

- provider_profiles

- provider_services

- provider_qualifications

- provider_capacity

- provider_regions

- provider_metrics

- provider_badges

## RFQ & Quotes

- rfqs

- rfq_providers

- rfq_clarifications

- quotes

- quote_versions

- quote_items

- quote_feedback

## Contracts

- contracts

- contract_versions

- contract_items

- contract_signatures

- change_requests

- contract_amendments

## Missions

- missions

- mission_milestones

- service_checklist_templates

- mission_checklist_items

- deliverables

- delivery_proofs

- acceptance_checklists

## Incidents

- incidents

- warnings

- incident_responses

- incident_evidence

- incident_decisions

- penalties

- reassignments

## Provider Finance

- commission_rules

- commission_accruals

- billing_periods

- statements

- statement_lines

- invoices

- invoice_lines

- credit_notes

- payments

- payment_allocations

- payment_plans

- payment_installments

- formal_notices

- collection_cases

## Franchise

- franchises

- franchise_users

- franchise_contracts

- franchise_entry_fees

- franchise_revenue_rules

- franchise_revenue_transactions

- franchise_allocations

- franchise_statements

## Volume

- service_skus

- volume_opportunities

- volume_negotiations

- volume_supplier_offers

- volume_price_tiers

- framework_agreements

- service_inventory_pools

- service_inventory_transactions

- volume_rebates

## Platform

- notifications

- notification_preferences

- message_templates

- threads

- messages

- action_items

- exceptions

- risk_flags

- audit_logs

- event_outbox

- system_settings

## 21.1 Colonnes transversales recommandées

| **Champ**       | **Type indicatif**   | **Règle**                               |
|-----------------|----------------------|-----------------------------------------|
| id              | uuid                 | PK générée serveur.                     |
| created_at      | timestamptz          | UTC.                                    |
| updated_at      | timestamptz          | UTC; trigger.                           |
| created_by      | uuid                 | Utilisateur/système.                    |
| status          | enum/text            | État validé par state machine.          |
| organization_id | uuid                 | FK lorsque ressource organisationnelle. |
| library_id      | uuid                 | FK lorsque scope bibliothèque.          |
| version         | integer              | Pour objets versionnés.                 |
| archived_at     | timestamptz nullable | Soft archive.                           |
| idempotency_key | text unique nullable | Mutation sensible.                      |

# 22. API, Edge Functions, Event Outbox et idempotence

## Identity

- POST /organizations

- POST /organizations/{id}/roles

- POST /organizations/{id}/users/invite

- POST /organization-join-requests

## Compliance

- POST /compliance/evaluate

- POST /compliance/questions

- POST /compliance/responses

- POST /compliance/verify

## Subscriptions

- POST /subscriptions/start-trial

- POST /subscriptions/activate

- POST /subscriptions/change-plan

- POST /credits/purchase

- POST /credits/reserve

- POST /benefits/redeem

## Diagnostics

- POST /diagnostics

- POST /diagnostics/{id}/answers

- POST /diagnostics/{id}/complete

- POST /questionnaires/{id}/simulate

## RFQ

- POST /requests

- POST /requests/{id}/match

- POST /rfqs

- POST /quotes

- POST /quotes/{id}/select

## Contracts/Missions

- POST /contracts/generate

- POST /contracts/{id}/sign

- POST /missions/{id}/deliver

- POST /missions/{id}/accept

- POST /amendments

## Incidents

- POST /incidents

- POST /incidents/{id}/response

- POST /incidents/{id}/decision

- POST /incidents/{id}/confirm-default

## Finance

- POST /commissions/accrue

- POST /billing/close-period

- POST /invoices/generate

- POST /payments/declare

- POST /payments/{id}/verify

- POST /payment-plans

## Franchise

- POST /franchises

- POST /franchises/{id}/entry-fee

- POST /franchise-revenue/allocate

- POST /franchise-invitations

## Volume

- POST /volume/opportunities

- POST /volume/negotiations

- POST /framework-agreements

- POST /service-pools/{id}/reserve

| **Idempotence -** Toutes les mutations financières, de pénalité, de facture, de réservation de crédits et de consommation de pool doivent accepter une idempotency_key et être protégées par une contrainte unique ou un verrou transactionnel. |
|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

## 22.1 Event Outbox

| **Champ**                     | **Rôle**                       |
|-------------------------------|--------------------------------|
| event_id                      | UUID unique                    |
| event_type                    | Catalogue contrôlé             |
| aggregate_type / aggregate_id | Ressource source               |
| payload                       | JSON minimal nécessaire        |
| status                        | PENDING/PROCESSING/DONE/FAILED |
| attempt_count                 | Retry                          |
| next_attempt_at               | Backoff                        |
| idempotency_key               | Anti-double traitement         |

# 23. State Machines maîtresses

| **Objet**          | **Transitions principales**                                                                                                                                |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Client compliance  | PROFILE_IN_PROGRESS → DOCUMENTS_REQUIRED → UNDER_REVIEW → QUESTION_REQUIRED → RESPONSE_RECEIVED → VERIFIED / REJECTED / SUSPENDED                          |
| Subscription       | TRIAL_ACTIVE → TRIAL_EXPIRED → ACTIVE → PAST_DUE → SUSPENDED / CANCELLED                                                                                   |
| Diagnostic         | DRAFT → IN_PROGRESS → COMPLETED → SUPERSEDED                                                                                                               |
| Opportunity        | DETECTED → CLIENT_ACCEPTED → RFQ_READY → CONVERTED → CLOSED                                                                                                |
| Service request    | DRAFT → INFORMATION_REQUIRED → READY → MATCHING → RFQ_OPEN → QUOTES_RECEIVED → CLIENT_REVIEW → PROVIDER_SELECTED → CONTRACT_PENDING → CONTRACTED           |
| Quote              | DRAFT → SUBMITTED → REVISION_REQUESTED → REVISED → SELECTED / NOT_SELECTED / WITHDRAWN / EXPIRED                                                           |
| Contract           | DRAFT → PENDING_SIGNATURE → ACTIVE → AMENDED → COMPLETED / TERMINATED                                                                                      |
| Mission            | WAITING_START → IN_PROGRESS → DELIVERED → CLIENT_REVIEW → COMPLETED; ou chemin incident                                                                    |
| Incident           | REPORTED → WARNING_SENT → PROVIDER_RESPONSE → CORRECTION_REQUIRED / UNDER_MATRICIA_REVIEW → RESOLVED / OUT_OF_SCOPE / NON_COMPLIANT_CONFIRMED → REASSIGNED |
| Invoice            | DRAFT → ISSUED → PARTIALLY_PAID / PAID / OVERDUE → PAYMENT_PLAN / FORMAL_NOTICE / COLLECTION                                                               |
| Franchise          | REGISTERED → COMPANY_REVIEW → CONTRACT_PENDING → ENTRY_FEE_SETUP → LIBRARY_ASSIGNED → ACTIVE → FINANCIAL_RESTRICTED / SUSPENDED / TERMINATED               |
| Benefit redemption | AVAILABLE → RESERVED → SCHEDULED → IN_PROGRESS → DELIVERED → CONSUMED; alternatives CANCELLED/REFUNDED/EXPIRED                                             |
| Volume unit        | AVAILABLE → RESERVED → COMMITTED → CONSUMED; ou RELEASED                                                                                                   |

- Toute transition doit être validée serveur.

- Chaque transition a un acteur autorisé, des préconditions, des effets secondaires et un événement.

- Une transition impossible retourne une erreur métier explicite et n’écrit aucune donnée partielle.

# 24. Notifications, automatisations et SLA

| **Domaine**      | **Déclencheur / échéance**        | **Action par défaut**                              |
|------------------|-----------------------------------|----------------------------------------------------|
| Essai            | J-10 / J-5 / J-2 / J-1 / J0       | Notification + email; à J0 passage TRIAL_EXPIRED.  |
| Documents        | J-60 / J-30 / J-7 / expiration    | Rappel; suspension ciblée si document obligatoire. |
| RFQ              | Mi-période / veille deadline      | Rappel fournisseurs ayant accepté mais non soumis. |
| Mission          | Avant jalon / retard              | Rappel puis exception si SLA dépassé.              |
| Incident         | 48h réponse standard / 24h urgent | Rappels et escalade admin.                         |
| Correction       | 5 jours ouvrables par défaut      | Rappel + revue Matricia si dépassé.                |
| Facture provider | J+4 / J+6 / J+7 / J+8             | Rappels puis OVERDUE + restriction J+8.            |
| Crédits          | Avant expiration                  | Notifier solde expirant.                           |
| Franchise fee    | Mensuel + fin 6e mois             | Retenue/relevé; balance due si restant.            |
| Admin            | Quotidien                         | Résumé exécutif / actions prioritaires.            |
| Franchisé        | Quotidien selon préférence        | Résumé nouveaux clients/diagnostics/RFQ/finance.   |

## 24.1 Modèle de notification

| **Champ**     | **Exigence**                                           |
|---------------|--------------------------------------------------------|
| template_code | Stable et versionné.                                   |
| event_type    | Événement source.                                      |
| locale        | fr-MA / ar-MA.                                         |
| subject/body  | Variables contrôlées.                                  |
| CTA           | Lien interne signé/autorisé.                           |
| priority      | INFO/NORMAL/IMPORTANT/CRITICAL.                        |
| mandatory     | Les alertes critiques ne peuvent pas être désactivées. |
| channels      | IN_APP, EMAIL; SMS/WhatsApp préparés mais optionnels.  |

# 25. Sécurité, RLS, audit et conservation

- RLS obligatoire sur toutes les tables exposées au client.

- Les policies doivent vérifier organization_id + membership + rôle + scope bibliothèque/franchise.

- Les devis d’un fournisseur ne sont jamais lisibles par les fournisseurs concurrents.

- Les fichiers sont privés; accès par signed URL temporaire après contrôle de permission.

- Les secrets et clés de paiement restent côté serveur.

- Les webhooks de paiement sont vérifiés cryptographiquement selon le provider.

- Rate limiting sur OTP, invitations, uploads et opérations sensibles.

- Validation serveur stricte des entrées; aucun prix, score ou commission critique n’est accepté tel quel depuis le navigateur.

- Audit obligatoire pour contrats, devis, paiements, pénalités, commissions, allocations franchise, permissions et publication de questionnaires.

- Les objets sensibles ne sont pas supprimés; annulation/archivage/avoir selon type.

- Sauvegardes et stratégie de reprise définies avant production.

- Les données en arabe et français suivent les mêmes règles d’accès.

## 25.1 Audit log

| **Champ**                 | **Description**                          |
|---------------------------|------------------------------------------|
| actor_user_id             | Utilisateur ou compte système.           |
| organization_id           | Contexte.                                |
| action                    | Code d’action stable.                    |
| resource_type/resource_id | Objet concerné.                          |
| before / after            | Snapshot minimal JSON.                   |
| timestamp                 | UTC.                                     |
| source                    | WEB/API/CRON/WEBHOOK/SYSTEM.             |
| request_id                | Corrélation.                             |
| ip/device                 | Si approprié et conforme aux politiques. |

# 26. UX/UI, design system, mobile et FR/AR

| **Composant** | **Règle**                                                                          |
|---------------|------------------------------------------------------------------------------------|
| Navigation    | Sidebar desktop; navigation adaptée mobile; actions requises toujours accessibles. |
| Formulaires   | Autosave, stepper, progression réelle, aide contextuelle, erreurs près du champ.   |
| Tables        | Filtres, recherche, export; sur mobile transformation en cards/accordéons.         |
| Statuts       | Texte + icône; vert/orange/rouge/bleu sans dépendre uniquement de la couleur.      |
| Upload        | Glisser-déposer desktop, caméra/fichier mobile, progression et statut analyse.     |
| RTL           | Composants bidirectionnels; ar-MA natif.                                           |
| Accessibilité | Labels, focus visible, clavier, contraste, messages d’erreur explicites.           |
| Langage       | technical_text interne + client_friendly_text lorsque nécessaire.                  |
| Sauvegarde    | Debounce + version de brouillon; prévention des écrasements entre onglets.         |

## 26.1 Design system minimum

- Button

- Input

- Select

- Checkbox

- Radio

- DatePicker

- FileUpload

- DataTable

- Card

- StatusBadge

- ProgressBar

- Alert

- Drawer

- Modal

- Tabs

- Timeline

- Stepper

- EmptyState

- Skeleton

- MoneyField

- CreditBalance

- ApprovalBanner

# 27. Reporting, KPI et exports

| **Audience**  | **Rapports minimum**                                                                                  |
|---------------|-------------------------------------------------------------------------------------------------------|
| Client        | Diagnostic global, évolution, anomalies, opportunités, contrats, budgets, économies documentées.      |
| Sous-traitant | Taux réponse, devis, conversion, délai, qualité, incidents, commissions, factures.                    |
| Franchise     | Invitations, acquisition, diagnostics, opportunités, contrats, P&L, droit d’entrée, réseau providers. |
| Bibliothèque  | Clients analysés, anomalies, RFQ, conversion, revenu attribué, coût Box, volume, satisfaction.        |
| Finance       | Abonnements, crédits, commissions, factures, paiements, avoirs, overdue, allocations franchise.       |
| Admin         | SLA, exceptions, risk flags, documents expirants, essais expirants, capacités et pools.               |

- Exports PDF pour documents de présentation et dossiers.

- Exports Excel/CSV pour analyse et comptabilité opérationnelle.

- Les exports respectent exactement les permissions de l’utilisateur.

- Les métriques utilisent des snapshots/version afin de rester reproductibles.

# 28. Spécifications MAT-FUNC-001 à MAT-FUNC-068

| **MAT-FUNC** | **Fonction**                   | **Spécification V1**                                                 |
|--------------|--------------------------------|----------------------------------------------------------------------|
| 001          | Passeport Matricia unique      | Organisation unique multi-rôles; données communes réutilisées.       |
| 002          | Santé globale                  | Score global + scores bibliothèques + anomalies + évolution.         |
| 003          | Assistant IA                   | Assistant contextuel; aucune sanction/transaction critique autonome. |
| 004          | Détection proactive            | Changements de profil déclenchent suggestions/réévaluations.         |
| 005          | Diagnostic continu             | Questions expirantes et revalidation légère.                         |
| 006          | Actions requises               | File universelle de tâches utilisateur.                              |
| 007          | Inbox universelle              | Messagerie liée aux objets métier.                                   |
| 008          | Assistant création besoin      | Texte libre → service → questions manquantes.                        |
| 009          | Solutions multiples            | Essential/Standard/Advanced pour une même anomalie.                  |
| 010          | Bundles multi-bibliothèques    | Ensembles de services pour projet transversal.                       |
| 011          | Mode Projet                    | Projet avec budget, tâches, contrats et progression.                 |
| 012          | Budget annuel                  | Budget par année/bibliothèque/site/projet.                           |
| 013          | Comparateur intelligent        | Comparaison normalisée de devis.                                     |
| 014          | Complétude devis               | Score + blocage champs obligatoires.                                 |
| 015          | Feedback non retenus           | Classement personnel + amélioration anonymisée.                      |
| 016          | Réputation multidimensionnelle | Qualité/délai/conformité/réponse/satisfaction/finance.               |
| 017          | Badges                         | Badges calculés et versionnés.                                       |
| 018          | Matching évolutif              | Règles explicables et historisées.                                   |
| 019          | Rotation équitable             | Éviter monopolisation lorsque candidats équivalents.                 |
| 020          | Capacité provider              | AVAILABLE/LIMITED/FULL/PAUSED.                                       |
| 021          | Calendrier central             | Échéances devis, missions, factures, documents.                      |
| 022          | Jalons                         | Phases de mission validables.                                        |
| 023          | Preuves de réalisation         | Preuves obligatoires par service.                                    |
| 024          | Checklists                     | Checklist versionnée par service.                                    |
| 025          | Réception objective            | Validation critère par critère.                                      |
| 026          | Avenant rapide                 | Demande supplémentaire → prix/délai/livrables.                       |
| 027          | Versionnage complet            | Historique immuable des objets critiques.                            |
| 028          | Coffre-fort documentaire       | Documents privés, versionnés, réutilisables.                         |
| 029          | Expirations                    | Rappels et suspension ciblée.                                        |
| 030          | Centre financier unifié        | Vue consolidée multi-rôles, ledgers séparés.                         |
| 031          | Prévision commissions          | Accruals estimés avant facturation.                                  |
| 032          | Rapprochement paiements        | Allocation plusieurs factures/paiements.                             |
| 033          | Wallet crédits                 | Ledger crédits complet.                                              |
| 034          | Récompenses                    | Règles bonus paramétrables.                                          |
| 035          | Parrainage                     | Liens et conversion traçables.                                       |
| 036          | CRM franchisé                  | Prospects/clients/providers et activité.                             |
| 037          | Pipeline franchisé             | Étapes de conversion standardisées.                                  |
| 038          | Relances automatiques          | Rappels par règles et délais.                                        |
| 039          | Modèles communication          | Templates FR/AR versionnés.                                          |
| 040          | Bibliothèque modèles           | Clonage de questionnaires/clauses/checklists.                        |
| 041          | IA qualité questionnaires      | Ambiguïté, doublons, donnée déjà connue.                             |
| 042          | Détection doublons             | Questions/services/anomalies similaires.                             |
| 043          | Simulation questionnaire       | Sandbox sans statistiques réelles.                                   |
| 044          | Analyse abandons               | Taux par section/question.                                           |
| 045          | Benchmark anonymisé            | Agrégats avec seuil minimal de groupe.                               |
| 046          | Historique évolution           | Snapshots scores/anomalies.                                          |
| 047          | ROI recommandations            | Résultats seulement si base mesurable.                               |
| 048          | Fournisseurs favoris           | Favori réutilisable sous contrôle éligibilité.                       |
| 049          | Commander similaire            | Cloner une ancienne demande dans une nouvelle.                       |
| 050          | Prestations récurrentes        | Cycles mensuels/trimestriels/annuels.                                |
| 051          | Multi-sites                    | Site_id dans diagnostics/demandes/missions/budgets.                  |
| 052          | Approvals multi-utilisateurs   | Workflow d’approbation paramétrable.                                 |
| 053          | Centres de coûts               | Rattachement dépenses/projets.                                       |
| 054          | Mobile                         | Parcours critiques utilisables sur smartphone.                       |
| 055          | Autosave                       | Brouillons sauvegardés et conflits gérés.                            |
| 056          | Progression                    | Étapes/complétude réelles.                                           |
| 057          | Préremplissage                 | Réutiliser données vérifiées/récentes.                               |
| 058          | Aide contextuelle              | Aide, exemple, pourquoi demandé.                                     |
| 059          | FR/AR                          | Traductions natives et RTL.                                          |
| 060          | Langage simplifié              | Texte technique + version client.                                    |
| 061          | Accessibilité                  | Clavier, focus, contraste, labels.                                   |
| 062          | Centre économies               | Économies seulement sur bases vérifiables.                           |
| 063          | Préférences notifications      | Immédiat/digest/disabled par catégorie.                              |
| 064          | Résumé franchisé               | Digest quotidien configurable.                                       |
| 065          | Résumé exécutif admin          | À traiter aujourd’hui avant KPI.                                     |
| 066          | Moteur exceptions              | Cas hors workflow vers file admin.                                   |
| 067          | Protection contournement       | Contacts masqués et échanges internes avant sélection.               |
| 068          | Détection abus                 | Risk flags sans sanction automatique.                                |

# 29. Catalogue des écrans

## Client

| **ID** | **Écran**                 | **Droits minimum / objectif**                                         |
|--------|---------------------------|-----------------------------------------------------------------------|
| CL-001 | Connexion                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-002 | OTP                       | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-003 | Mot de passe              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-004 | Création organisation     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-005 | Identité société          | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-006 | Représentant              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-007 | Documents                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-008 | Anomalies administratives | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-009 | Questions Matricia        | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-010 | Résultat validation       | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-011 | Dashboard                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-012 | Santé entreprise          | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-013 | Actions requises          | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-014 | Inbox                     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-015 | Diagnostics               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-016 | Questionnaire             | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-017 | Résultats                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-018 | Anomalies                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-019 | Recommandations           | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-020 | Opportunités              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-021 | Demande directe           | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-022 | Compléter opportunité     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-023 | Demande de devis          | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-024 | Questions fournisseurs    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-025 | Devis reçus               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-026 | Comparateur               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-027 | Sélection                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-028 | Contrats                  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-029 | Signature                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-030 | Missions                  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-031 | Jalons                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-032 | Livraison                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-033 | Acceptation               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-034 | Non-conformité            | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-035 | Avenant                   | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-036 | Projets                   | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-037 | Budget                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-038 | Centres de coûts          | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-039 | Documents                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-040 | Calendrier                | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-041 | Abonnement                | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-042 | Plans                     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-043 | Ma Box                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-044 | Mes crédits               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-045 | Acheter crédits           | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-046 | Paiement                  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-047 | Factures abonnement       | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-048 | Profil                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-049 | Utilisateurs              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-050 | Sites                     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-051 | Sécurité                  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| CL-052 | Notifications             | Voir selon rôle; mutations serveur + audit selon le workflow associé. |

## Sous-traitant

| **ID** | **Écran**              | **Droits minimum / objectif**                                         |
|--------|------------------------|-----------------------------------------------------------------------|
| ST-001 | Inscription            | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-002 | Profil société         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-003 | Documents              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-004 | Compétences            | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-005 | Qualifications         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-006 | Certifications         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-007 | Références             | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-008 | Capacité               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-009 | Zones                  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-010 | Contrat partenaire     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-011 | Dashboard              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-012 | Actions requises       | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-013 | Opportunités reçues    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-014 | Détail consultation    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-015 | Questions client       | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-016 | Créer devis            | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-017 | Prévisualisation       | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-018 | Mes devis              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-019 | Feedback devis         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-020 | Missions               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-021 | Jalons                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-022 | Checklists             | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-023 | Livraisons             | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-024 | Corrections            | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-025 | Incidents              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-026 | Mes achats             | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-027 | Passer en mode Client  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-028 | Finance                | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-029 | Pré-relevé             | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-030 | Factures Matricia      | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-031 | Déclarer paiement      | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-032 | Échéancier             | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-033 | Historique commissions | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-034 | Documents              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-035 | Performance            | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-036 | Qualifications         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-037 | Calendrier             | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ST-038 | Inbox                  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |

## Franchisé

| **ID** | **Écran**                         | **Droits minimum / objectif**                                         |
|--------|-----------------------------------|-----------------------------------------------------------------------|
| FR-001 | Dashboard                         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-002 | Ma bibliothèque                   | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-003 | Services                          | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-004 | Catégories                        | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-005 | Questionnaires                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-006 | Créer questionnaire               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-007 | Question Builder                  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-008 | Rule Builder                      | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-009 | Anomalies                         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-010 | Risques                           | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-011 | Recommandations                   | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-012 | Opportunités                      | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-013 | Simulation                        | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-014 | Versions                          | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-015 | Sous-traitants                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-016 | Qualification                     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-017 | Services autorisés                | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-018 | Performance réseau                | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-019 | Demandes                          | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-020 | Devis                             | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-021 | Missions                          | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-022 | Incidents                         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-023 | Invitations                       | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-024 | Inviter client                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-025 | Inviter sous-traitant             | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-026 | CRM                               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-027 | Pipeline                          | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-028 | Revenus                           | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-029 | Pré-relevé                        | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-030 | Répartition                       | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-031 | Droit d’entrée                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-032 | Paiements                         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-033 | KPI                               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-034 | Utilisateurs                      | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| FR-035 | Permissions / propositions volume | Voir selon rôle; mutations serveur + audit selon le workflow associé. |

## Administrateur

| **ID**   | **Écran**                   | **Droits minimum / objectif**                                         |
|----------|-----------------------------|-----------------------------------------------------------------------|
| ADM-001  | Dashboard exécutif          | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-002  | Actions aujourd’hui         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-003  | Clients                     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-004  | Validation client           | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-005  | Anomalies client            | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-006  | Questions client            | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-007  | Sous-traitants              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-008  | Validation provider         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-009  | Qualification               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-010  | Documents                   | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-011  | Restrictions                | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-012  | Franchisés                  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-013  | Validation franchisé        | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-014  | Contrat franchise           | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-015  | Droit d’entrée              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-016  | Répartition revenus         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-017  | Bibliothèques               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-018  | Services                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-019  | Questionnaires              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-020  | Versionnage                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-021  | Demandes                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-022  | Matching                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-023  | Devis                       | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-024  | Contrats                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-025  | Missions                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-026  | Litiges                     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-027  | Décision incident           | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-028  | Réaffectations              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-029  | Abonnements                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-030  | Crédits                     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031A | Dashboard Boxes & Avantages | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031B | Catalogue avantages         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031C | Créer avantage              | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031D | Box Builder                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031E | Premium/Gold/Platinum       | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031F | Matrice plan/avantages      | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031G | Packs crédits               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031H | Promotions                  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031I | Attribution manuelle        | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031J | Consommations               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031K | Capacités                   | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031L | Coûts fournisseurs          | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031M | Rentabilité                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031N | Statistiques                | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031O | Versions                    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-031P | Simulation                  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-032  | Facturation                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-033  | Commissions                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-034  | Paiements                   | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-035  | Impayés                     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-036  | Avoirs                      | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-037  | Recouvrement                | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-038  | Exceptions                  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-039  | Risk Flags                  | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-040  | Audit                       | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-041  | Utilisateurs                | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-042  | Permissions                 | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-043  | Modèles communication       | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-044  | Configuration               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |

## Achats volume

| **ID**      | **Écran**           | **Droits minimum / objectif**                                         |
|-------------|---------------------|-----------------------------------------------------------------------|
| ADM-VOL-001 | Dashboard volume    | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-VOL-002 | Analyse demande     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-VOL-003 | Créer négociation   | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-VOL-004 | Offres fournisseurs | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-VOL-005 | Contrats-cadres     | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-VOL-006 | Pools               | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-VOL-007 | Réservations        | Voir selon rôle; mutations serveur + audit selon le workflow associé. |
| ADM-VOL-008 | Rentabilité         | Voir selon rôle; mutations serveur + audit selon le workflow associé. |

## 29.1 Gabarit obligatoire de spécification pour chaque écran

| **Élément**  | **Contenu exigé**                                         |
|--------------|-----------------------------------------------------------|
| Purpose      | Objectif exact et acteur cible.                           |
| Route        | URL/route et paramètres.                                  |
| Permissions  | VIEW/CREATE/EDIT/SUBMIT/APPROVE/etc.                      |
| Data sources | Tables/vues/RPC utilisées.                                |
| Fields       | Nom, type, obligatoire, validation, aide, préremplissage. |
| Actions      | Boutons et effets serveur.                                |
| Conditions   | Affichage/blocage dynamique.                              |
| Errors       | Messages utilisateur et code métier.                      |
| Events       | Événements outbox émis.                                   |
| Audit        | Actions devant être journalisées.                         |
| Mobile       | Comportement spécifique.                                  |
| Acceptance   | Tests Given/When/Then.                                    |

# 30. Scénarios E2E et critères d’acceptation

| **ID**                              | **Scénario / résultat attendu**                                                                                                 |
|-------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| E2E-01 Client normal                | Inscription → validation → essai → Gold → diagnostic → opportunité → RFQ → devis → contrat → mission → livraison → acceptation. |
| E2E-02 Client anomalie admin        | ICE/document divergent → question → correction → validation → essai.                                                            |
| E2E-03 Sous-traitant                | Inscription → qualification Web approuvée → RFQ → devis → sélection → mission → commission → facture → paiement.                |
| E2E-04 Sous-traitant devient client | Provider existant active CLIENT → demande Communication sans recréer organisation.                                              |
| E2E-05 Demande hors périmètre       | Client demande plus après livraison → avenant; aucun warning qualité final.                                                     |
| E2E-06 Non-conformité confirmée     | Signalement → avertissement → contestation → décision → pénalité + commission → retrait → R1.                                   |
| E2E-07 Paiement partiel             | Facture 10k → paiement 6k → solde 4k → J+8 overdue si non réglé.                                                                |
| E2E-08 Échéancier                   | Provider demande plan → admin approuve → installments suivis.                                                                   |
| E2E-09 Franchisé hors IT            | Droit d’entrée retenu sur part; revenu 50/25/25.                                                                                |
| E2E-10 IT                           | Activité IT → P&L IT → calcul bénéfice distribuable → 50 % Hatim Ahmitech / 50 % Jalil-NEOXA / 0 % Asma ; aucun droit d’entrée Hatim. |
| E2E-10A IT coût direct              | Revenu IT + coûts directs/avoirs/TVA → bénéfice distribuable calculé exactement ; TVA exclue ; partage 50/50 seulement après clôture.      |
| E2E-10B Franchise contrôle          | Franchisé sous seuil → risk flag + plan correctif ; aucune suspension automatique sans décision humaine autorisée.                         |
| E2E-10C Facturation Maroc           | Commission HT → règle fiscale effective → TVA → TTC ; facture à série continue, immuable, puis avoir correctif sans réécriture.             |
| E2E-10D Clôture mensuelle           | Plusieurs fournisseurs → factures automatiques pour dossiers propres, exception isolée pour dossier litigieux, aucun doublon au retry.      |
| E2E-11 Box Gold                     | Abonnement actif → slots → crédits → réservation → consommation.                                                                |
| E2E-12 Achat crédits                | Pack acheté → webhook → wallet → consommation dans Communication → allocation interne.                                          |
| E2E-13 Volume                       | WEB-STARTER pool → réservation → fournisseur → livraison → unité CONSUMED.                                                      |
| E2E-14 Trial expired                | J30 sans plan → blocage nouvelle RFQ; accès contrats historiques conservé; paiement Gold réactive.                              |
| E2E-15 Webhook doublé               | Même transaction externe reçue deux fois → une seule écriture.                                                                  |
| E2E-16 Double décision              | Double clic confirm default → une seule pénalité/commission/réaffectation.                                                      |
| E2E-17 Document expiré en mission   | Alerte + restriction futures; mission existante non supprimée automatiquement.                                                  |
| E2E-18 Pool épuisé                  | Avantage VOLUME_POOL indisponible ou liste attente; aucun surbooking silencieux.                                                |
| E2E-19 Duplication ICE              | Nouvel utilisateur avec ICE existant → rejoindre organisation; pas de doublon silencieux.                                       |
| E2E-20 Permission                   | Franchise Accounting ne peut pas modifier questionnaire; Expert ne peut pas modifier revenu split.                              |

# 30B. GATES BLOQUANTS AJOUTÉS PAR LA MISE À JOUR V4

La release est interdite si l’un des contrôles suivants échoue :

- une référence active affirme encore que NEOXA est franchisé IT ou reçoit 100 % du revenu IT ;
- Hatim Ahmitech se voit générer un droit d’entrée, un échéancier ou une retenue de franchise IT ;
- le partage 50/50 IT est appliqué avant calcul du bénéfice distribuable ;
- la TVA est incluse dans le bénéfice distribuable ou revenu distribuable ;
- un taux de TVA est codé en dur dans UI/domaine au lieu du moteur fiscal ;
- une facture sous-traitant ordinaire exige une création manuelle alors que toutes les données sont éligibles ;
- un retry de clôture génère une facture/numéro/notification dupliqué ;
- un paiement partiel repousse automatiquement l’échéance ;
- une simple baisse de score franchisé déclenche automatiquement résiliation/suspension sans revue autorisée ;
- le dashboard admin ne permet pas de contrôler performance franchisés + facturation + fiscalité + exceptions.

---

# 31. Déploiement et configuration initiale

## 31.1 Environnements

| **Environnement** | **Usage**                                    |
|-------------------|----------------------------------------------|
| LOCAL             | Développement développeur.                   |
| DEV               | Intégrations et tests automatiques.          |
| STAGING           | Recette fonctionnelle avec données fictives. |
| PRODUCTION        | Utilisateurs réels.                          |

## 31.2 Assistant de configuration initiale

89. Société Matricia et informations légales.

90. Utilisateurs Super Admin et Finance.

91. Prestataires de paiement et clés.

92. Plans Premium/Gold/Platinum.

93. Crédits, Boxes et avantages initiaux.

94. Bibliothèques V1.

95. Franchisés et règles économiques.

96. Sous-traitants initiaux et qualifications.

97. Questionnaires et règles.

98. Modèles de contrats.

99. Templates notifications FR/AR.

100. Paramètres financiers et SLA.

101. Jeux de tests E2E.

102. Validation sécurité/RLS.

103. Publication.

## 31.3 Gate de mise en production

- Tous les E2E critiques verts.

- RLS auditée.

- Webhooks paiement testés avec replay/doublon.

- Sauvegarde/restauration testée.

- Contrats juridiques validés.

- Facturation/TVA validées par comptabilité.

- Plans/Boxes rentabilité simulée.

- Questionnaires V1 publiés.

- Support/admin formés.

# 32. Paramètres à valider juridiquement, comptablement et commercialement

| **Catégorie**         | **À confirmer avant production**                                                                                   | **Le système doit déjà supporter**                  |
|-----------------------|--------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------|
| Juridique             | Clauses Client↔Sous-traitant, partenaire Matricia, franchise, pénalités, non-contournement, surcoût réaffectation. | Templates versionnés + règles paramétrables.        |
| Comptabilité Maroc    | Mentions facture, TVA, traitement pénalités/avoirs/revenus crédits/allocations.                                    | Ledgers séparés + tax fields + documents immuables. |
| Commercial            | Prix Premium/Gold/Platinum, crédits mensuels, prix packs, Box content.                                             | Admin configurable sans code.                       |
| Commission providers  | Taux par service/provider/bibliothèque.                                                                            | commission_rules versionnées.                       |
| Franchise entry fee   | Montant, acompte, % retenue, délai final après 6 mois.                                                             | franchise_entry_fees.                               |
| Allocation abonnement | % Core vs Benefit Pool et méthode de valorisation consommation.                                                    | plan version + allocation engine.                   |
| Volume                | Premiers SKU, minimum commitments, prix négociés.                                                                  | service_skus + framework agreements.                |
| SLA                   | Délais exacts par service pour incident/correction/devis.                                                          | automation_rules / service SLA.                     |

# Annexe A - Catalogue d’événements métier

| **\#** | **Event type**               |
|--------|------------------------------|
| 1      | ORGANIZATION_CREATED         |
| 2      | ORGANIZATION_VERIFIED        |
| 3      | ROLE_ADDED                   |
| 4      | PROFILE_UPDATED              |
| 5      | DOCUMENT_UPLOADED            |
| 6      | DOCUMENT_EXPIRING            |
| 7      | DOCUMENT_EXPIRED             |
| 8      | ANOMALY_DETECTED             |
| 9      | COMPLIANCE_RESPONSE_RECEIVED |
| 10     | TRIAL_STARTED                |
| 11     | TRIAL_ENDING                 |
| 12     | TRIAL_EXPIRED                |
| 13     | SUBSCRIPTION_PAID            |
| 14     | SUBSCRIPTION_CHANGED         |
| 15     | CREDITS_GRANTED              |
| 16     | CREDITS_PURCHASED            |
| 17     | BENEFIT_RESERVED             |
| 18     | BENEFIT_CONSUMED             |
| 19     | DIAGNOSTIC_STARTED           |
| 20     | ANSWER_SAVED                 |
| 21     | DIAGNOSTIC_COMPLETED         |
| 22     | OPPORTUNITY_CREATED          |
| 23     | REQUEST_CREATED              |
| 24     | REQUEST_READY                |
| 25     | MATCHING_COMPLETED           |
| 26     | RFQ_OPENED                   |
| 27     | RFQ_DEADLINE_NEAR            |
| 28     | QUOTE_SUBMITTED              |
| 29     | QUOTE_SELECTED               |
| 30     | RFQ_CLOSED                   |
| 31     | CONTRACT_CREATED             |
| 32     | CONTRACT_SIGNED              |
| 33     | AMENDMENT_SIGNED             |
| 34     | MISSION_STARTED              |
| 35     | MILESTONE_DUE                |
| 36     | DELIVERY_SUBMITTED           |
| 37     | DELIVERY_ACCEPTED            |
| 38     | NON_COMPLIANCE_REPORTED      |
| 39     | WARNING_SENT                 |
| 40     | INCIDENT_RESPONSE_RECEIVED   |
| 41     | NON_COMPLIANCE_CONFIRMED     |
| 42     | REASSIGNMENT_CREATED         |
| 43     | COMMISSION_ACCRUED           |
| 44     | PRE_STATEMENT_READY          |
| 45     | INVOICE_ISSUED               |
| 46     | PAYMENT_DECLARED             |
| 47     | PAYMENT_VERIFIED             |
| 48     | INVOICE_OVERDUE              |
| 49     | PAYMENT_PLAN_APPROVED        |
| 50     | FORMAL_NOTICE_SENT           |
| 51     | FRANCHISE_CREATED            |
| 52     | FRANCHISE_ACTIVATED          |
| 53     | FRANCHISE_INVITATION_SENT    |
| 54     | ENTRY_FEE_WITHHELD           |
| 55     | ENTRY_FEE_6M_REACHED         |
| 56     | FRANCHISE_REVENUE_ALLOCATED  |
| 57     | VOLUME_OPPORTUNITY_DETECTED  |
| 58     | FRAMEWORK_ACTIVATED          |
| 59     | SERVICE_UNIT_RESERVED        |
| 60     | SERVICE_UNIT_CONSUMED        |
| 61     | POOL_LOW                     |
| 62     | EXCEPTION_CREATED            |
| 63     | RISK_FLAG_CREATED            |
| 64     | SLA_BREACH                   |

# Annexe B - Paramètres qui ne doivent jamais être hardcodés

| **Paramètre**                    | **Stockage recommandé**                                                    |
|----------------------------------|----------------------------------------------------------------------------|
| Prix plans mensuels/annuels      | system_settings / table métier versionnée avec effective_from/effective_to |
| Nombre de crédits par plan       | system_settings / table métier versionnée avec effective_from/effective_to |
| Prix packs crédits               | system_settings / table métier versionnée avec effective_from/effective_to |
| Règles de rollover/expiration    | system_settings / table métier versionnée avec effective_from/effective_to |
| Avantages et coûts crédits       | system_settings / table métier versionnée avec effective_from/effective_to |
| Core/Benefit Pool allocation     | system_settings / table métier versionnée avec effective_from/effective_to |
| Commission par provider/service  | system_settings / table métier versionnée avec effective_from/effective_to |
| Nombre cible de fournisseurs RFQ | system_settings / table métier versionnée avec effective_from/effective_to |
| Poids matching                   | system_settings / table métier versionnée avec effective_from/effective_to |
| Seuils score diagnostics         | system_settings / table métier versionnée avec effective_from/effective_to |
| Documents obligatoires           | system_settings / table métier versionnée avec effective_from/effective_to |
| SLA incidents/corrections        | system_settings / table métier versionnée avec effective_from/effective_to |
| Délai de paiement provider       | system_settings / table métier versionnée avec effective_from/effective_to |
| Relances factures                | system_settings / table métier versionnée avec effective_from/effective_to |
| Frais/intérêts de retard         | system_settings / table métier versionnée avec effective_from/effective_to |
| Pénalités                        | system_settings / table métier versionnée avec effective_from/effective_to |
| Droit d’entrée franchise         | system_settings / table métier versionnée avec effective_from/effective_to |
| % de retenue droit d’entrée      | system_settings / table métier versionnée avec effective_from/effective_to |
| Revenue split hors IT            | system_settings / table métier versionnée avec effective_from/effective_to |
| Règle spéciale IT                | system_settings / table métier versionnée avec effective_from/effective_to |
| Minimum group size benchmark     | system_settings / table métier versionnée avec effective_from/effective_to |
| Capacité/stock Box               | system_settings / table métier versionnée avec effective_from/effective_to |
| Paliers volume                   | system_settings / table métier versionnée avec effective_from/effective_to |
| Overbooking autorisé ou non      | system_settings / table métier versionnée avec effective_from/effective_to |
| Templates FR/AR                  | system_settings / table métier versionnée avec effective_from/effective_to |
| Règles promotionnelles           | system_settings / table métier versionnée avec effective_from/effective_to |
| Seuils approval crédits cadeaux  | system_settings / table métier versionnée avec effective_from/effective_to |

# Annexe C - Format obligatoire des User Stories / Tickets de développement

| **Template -** Chaque ticket de développement doit référencer un écran, une fonction MAT-FUNC et une règle métier de ce cahier. Aucun comportement critique ne doit être inventé dans le ticket. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

| **Champ**     | **Exemple**                                                              |
|---------------|--------------------------------------------------------------------------|
| ID            | DEV-CL-023-001                                                           |
| Titre         | Confirmer une demande de devis                                           |
| Actor         | CLIENT_BUYER                                                             |
| Preconditions | Organisation VERIFIED, abonnement actif ou trial autorisé, request READY |
| Given         | Client possède une opportunité avec required_for_quote complété          |
| When          | Il clique Confirmer et demander des devis                                |
| Then          | RFQ créée, matching déclenché, audit écrit, event REQUEST_READY émis     |
| Tables        | service_requests, matching_runs, event_outbox, audit_logs                |
| Permissions   | SUBMIT on own organization request                                       |
| Errors        | MISSING_REQUIRED_DATA, SUBSCRIPTION_REQUIRED, NO_ELIGIBLE_PROVIDER       |
| Tests         | Unit + integration + RLS + E2E mobile                                    |

# Conclusion - base du cahier des charges final

Ce document transforme les décisions métier prises pour Matricia en architecture exécutable : objets, écrans, règles, state machines, tables, API, événements, finance, franchises, Boxes, crédits, achats volume, sécurité et tests. Dans l’exécution du présent Gold Master Prompt, Codex doit compléter immédiatement le contenu métier réel de chaque bibliothèque — questions, anomalies, risques, recommandations, services, avantages et SKU — puis le valider par les gates de catalogue. Seuls les textes juridiques/fiscaux destinés à la production et les secrets externes peuvent rester `EXTERNAL_PENDING`, avec moteurs, adaptateurs demo et tests déjà terminés.

| **V1 -** Le périmètre V1 couvre MAT-FUNC-001 à MAT-FUNC-068. Les idées 069 à 090 restent volontairement réservées à la deuxième version de la plateforme. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------|


---

# FIN DU GOLD MASTER PROMPT

Exécute maintenant la mission selon le contrat ci-dessus.


---

# ADDENDUM GOLD MASTER — CATALOGUE MÉTIER, SERVICES ET 6 000 QUESTIONS

Cet addendum est **normatif**. Il remplace toute instruction antérieure qui demandait seulement à Codex « d’inventer au moins 900 questions » ou « 15 services par bibliothèque ». Codex doit utiliser la base déterministe fournie par `matricia_catalog_build.py`, l’importer, la traduire en arabe, la tester, puis permettre aux franchisés de la faire évoluer sans modifier le code.

## 1. Résultat obligatoire

La V1 démarre avec :

- 10 bibliothèques actives ;
- 40 grandes catégories ;
- 80 sous-catégories ;
- 200 services actifs ;
- 5 000 questions de cadrage permettant de rendre les demandes chiffrables, soit 25 par service ;
- 700 questions de diagnostic client, soit 70 par bibliothèque ;
- 300 questions de qualification fournisseur, soit 30 par bibliothèque ;
- 6 000 questions au total avant toute création supplémentaire par les franchisés ;
- 212 liens service–sous-catégorie, car certains services peuvent être classés dans plusieurs sous-catégories ;
- une bibliothèque supplémentaire « Opérations, productivité et transformation » fournie comme modèle optionnel mais non activée dans les dix bibliothèques initiales.

Le validateur de release échoue si ces minimums ne sont pas atteints, si un identifiant est dupliqué, si un lien pointe vers un service absent, si une traduction obligatoire manque ou si un placeholder apparaît.

## 2. Bibliothèques initiales

1. `IT` — Informatique, cybersécurité et data.
2. `COM` — Communication, marketing et création.
3. `ACC` — Comptabilité, fiscalité et finance.
4. `LEGAL` — Juridique, conformité et gouvernance.
5. `HR` — Ressources humaines et formation.
6. `INS` — Assurance et gestion des risques.
7. `LOG` — Achats, logistique et supply chain.
8. `BTP` — BTP, immobilier et maintenance.
9. `QHSE` — Qualité, HSE et certifications.
10. `SALES` — Commercial, vente et expérience client.

La liste est une configuration initiale, pas une limite structurelle. Un Super Admin peut créer une onzième bibliothèque et lui affecter un franchisé sans migration du code.

## 3. Hiérarchie de contenu

```text
BIBLIOTHÈQUE
  └── GRANDE CATÉGORIE
       └── SOUS-CATÉGORIE
            └── SERVICE
                 ├── QUESTIONS DIAGNOSTIC
                 ├── QUESTIONS POUR PRÉPARER LE DEVIS/RFQ
                 ├── QUESTIONS DE QUALIFICATION FOURNISSEUR
                 ├── DOCUMENTS REQUIS
                 ├── LIVRABLES
                 ├── PREUVES
                 ├── CRITÈRES D’ACCEPTATION
                 ├── RÈGLES DE MATCHING
                 ├── CLAUSES ET INCIDENTS
                 ├── AVANTAGES/BOXES/CRÉDITS
                 └── ACHATS EN VOLUME/SKU ÉVENTUELS
```

Un service possède une sous-catégorie principale et peut avoir plusieurs sous-catégories secondaires. L’interface client n’affiche pas de doublon : un même service garde un ID unique.

## 4. Objet Bibliothèque

Champs minimums :

```text
id uuid
code text unique
slug text unique
name_fr text
name_ar text
description_fr text
description_ar text
icon_key text
cover_asset_id uuid nullable
status enum(DRAFT, IN_REVIEW, ACTIVE, PAUSED, ARCHIVED)
current_version_id uuid
franchise_id uuid nullable
sort_order integer
published_at timestamptz nullable
created_by uuid
created_at timestamptz
updated_at timestamptz
archived_at timestamptz nullable
```

Actions franchisé autorisées dans sa bibliothèque : modifier les contenus non sensibles, proposer une nouvelle version, gérer l’ordre d’affichage, catégories, sous-catégories, services et questionnaires.

Actions réservées au central : affecter/changer le franchisé, modifier les règles économiques, publier un changement sensible, suspendre la bibliothèque, modifier les droits globaux.

## 5. Objets Catégorie et Sous-catégorie

Chaque objet est versionné et possède : code, nom FR/AR, description FR/AR, ordre, statut, bibliothèque, parent, icône et règles de visibilité.

Le franchisé peut :

- ajouter une catégorie ou sous-catégorie ;
- renommer ;
- déplacer ;
- réordonner par glisser-déposer ;
- fusionner après simulation des impacts ;
- archiver ;
- restaurer une version ;
- importer/exporter.

Une catégorie utilisée historiquement ne peut pas être supprimée physiquement.

## 6. Objet Service

Champs minimums :

```text
id uuid
library_id uuid
primary_subcategory_id uuid
code text unique
slug text
name_fr text
name_ar text
short_description_fr text
short_description_ar text
long_description_fr text
long_description_ar text
service_type enum
status enum(DRAFT, IN_REVIEW, ACTIVE, PAUSED, ARCHIVED)
current_version_id uuid
unit_label_fr text
unit_label_ar text
credit_eligible boolean
volume_eligible boolean
recurring_eligible boolean
trial_eligible boolean
rfq_required boolean
fixed_fulfillment_allowed boolean
base_currency text
sort_order integer
created_by uuid
published_at timestamptz nullable
archived_at timestamptz nullable
```

Chaque version de service stocke aussi :

- livrables standards ;
- exclusions standards ;
- critères de réception ;
- preuves obligatoires ;
- nombre/règles de correction ;
- documents client nécessaires ;
- documents fournisseur nécessaires ;
- règles de qualification ;
- règles de matching ;
- modèle de devis ;
- champs `required_for_quote` ;
- SLA par défaut ;
- clauses de bibliothèque/service ;
- règles d’incident ;
- disponibilité dans les plans et Boxes ;
- coût en crédits ;
- coûts fournisseurs ;
- SKU et contrats volume éventuels.

## 7. Contrôle total du nombre de services

Aucun nombre de services n’est codé en dur. Le franchisé autorisé dispose de :

- `+ Nouveau service` ;
- `Dupliquer ce service` ;
- `Importer des services` ;
- `Modifier` ;
- `Déplacer` ;
- `Mettre en pause` ;
- `Archiver` ;
- `Proposer la publication` ;
- `Comparer les versions` ;
- `Restaurer une version`.

Le franchisé peut passer de 20 à 50 services ou revenir à 18 services actifs. Les anciens diagnostics, demandes, devis, contrats et factures continuent à référencer la version historique.

### Suppression

- Service jamais publié et jamais référencé : suppression physique autorisée pour son auteur.
- Service publié ou utilisé : uniquement archivage.
- Archivage avec missions actives : interdit ; proposer une date de fin et conserver l’accès aux dossiers en cours.
- Service avec contrats récurrents : migration ou extinction contrôlée obligatoire.

## 8. Objet Question

Une question ne se résume pas à un texte. Elle contient :

```text
id uuid
question_key text unique
scope enum(GLOBAL, LIBRARY, CATEGORY, SUBCATEGORY, SERVICE)
phase enum(PROFILE, COMPLIANCE, DIAGNOSTIC, RFQ, PROVIDER_QUALIFICATION,
           QUOTE, DELIVERY, ACCEPTANCE, INCIDENT, FOLLOW_UP)
library_id uuid nullable
service_id uuid nullable
section_id uuid
current_version_id uuid
status enum(DRAFT, IN_REVIEW, ACTIVE, PAUSED, ARCHIVED)
created_by uuid
```

Chaque version contient :

```text
label_fr text
label_ar text
help_fr text
help_ar text
why_we_ask_fr text
why_we_ask_ar text
answer_type enum
required boolean
required_for_quote boolean
required_for_publication boolean
data_key text
options jsonb
validation_schema jsonb
visibility_rule jsonb
default_value jsonb nullable
prefill_source jsonb nullable
sensitivity enum(PUBLIC, BUSINESS, CONFIDENTIAL, RESTRICTED)
weight numeric
max_score numeric
anomaly_links jsonb
risk_links jsonb
recommendation_links jsonb
opportunity_links jsonb
document_requirement_links jsonb
sort_order integer
change_reason text
```

## 9. Types de questions

Supporter au minimum :

```text
YES_NO
SINGLE_CHOICE
MULTIPLE_CHOICE
SHORT_TEXT
LONG_TEXT
INTEGER
DECIMAL
PERCENTAGE
MONEY
CURRENCY
DATE
DATE_RANGE
TIME
EMAIL
PHONE
URL
ADDRESS
GEO_AREA
RATING_5
RATING_10
QUANTITY
UNIT_VALUE
FILE
MULTI_FILE
IMAGE
TABLE
REPEATER
CONTACT
ORGANIZATION
PRODUCT_LIST
SITE_LIST
MILESTONE_LIST
BUDGET_BREAKDOWN
```

Les types structurés utilisent un schéma JSON versionné. Par exemple `TABLE` doit définir colonnes, types, validations, minimum et maximum de lignes.

## 10. Les 25 questions RFQ par service

Chaque service initial reçoit :

### Questions universelles

1. objectif métier ;
2. situation actuelle ;
3. périmètre quantitatif ;
4. sites/localisation ;
5. parties prenantes ;
6. livrables ;
7. documents/données disponibles ;
8. dépendances/intégrations ;
9. contraintes réglementaires, sécurité ou confidentialité ;
10. calendrier et jalons ;
11. budget ;
12. critères d’acceptation ;
13. support/formation/maintenance ;
14. modalités de paiement souhaitées ;
15. contraintes particulières.

### Questions propres au service

16 à 20 : cinq dimensions métier propres au service, inscrites dans le blueprint.

### Questions propres au type de prestation

21 à 25 : cinq questions adaptées à l’archétype Audit, Implémentation, Logiciel, Création, Service récurrent, Juridique, Finance, RH, Assurance, Achats, Construction, Formation ou Étude.

Le formulaire final ne doit pas systématiquement montrer 25 questions d’un seul coup. Le moteur :

- préremplit les données connues ;
- masque les questions non pertinentes ;
- affiche les sections progressivement ;
- autorise le franchisé à rendre une question facultative ou conditionnelle ;
- calcule la complétude ;
- interdit l’envoi si un champ bloquant manque.

## 11. Questions diagnostic et qualification

Chaque bibliothèque initiale possède :

- 10 questions de maturité transversales ;
- 3 questions de diagnostic par service, soit 60 ;
- total diagnostic : 70 ;
- 10 questions de qualification fournisseur transversales ;
- 1 question structurée de compétence/références/capacité par service, soit 20 ;
- total qualification : 30.

La base peut être enrichie sans limite. Le franchisé peut ajouter un diagnostic spécialisé ou un questionnaire distinct par secteur, taille, type juridique, site ou plan d’abonnement.

## 12. CRUD Questions par le franchisé

Écrans :

```text
FR-Q-001 Liste des questionnaires
FR-Q-002 Constructeur de questionnaire
FR-Q-003 Banque de questions
FR-Q-004 Éditeur de question
FR-Q-005 Éditeur d’options
FR-Q-006 Rule Builder
FR-Q-007 Scoring/anomalies/recommandations
FR-Q-008 Prévisualisation client
FR-Q-009 Simulation complète
FR-Q-010 Comparaison de versions
FR-Q-011 Import/export
FR-Q-012 Historique et audit
```

Actions :

- créer ;
- modifier ;
- dupliquer ;
- réordonner ;
- déplacer de section ;
- lier/délier à plusieurs services ;
- convertir en question globale ;
- rendre conditionnelle ;
- ajouter une option ;
- modifier la validation ;
- ajouter une traduction ;
- mettre en pause ;
- archiver ;
- restaurer ;
- tester ;
- soumettre pour approbation ;
- publier selon permission.

Une question utilisée n’est jamais supprimée physiquement. Une nouvelle version est créée à chaque modification publiée.

## 13. Rule Builder

Opérateurs : égal, différent, supérieur, inférieur, dans liste, contient, vide, non vide, correspondance regex contrôlée, date avant/après, changement depuis réponse précédente.

Groupes : `AND`, `OR`, `NOT`, groupes imbriqués.

Actions :

- afficher/masquer question ou section ;
- rendre obligatoire/facultatif ;
- calculer score ;
- créer anomalie/risque ;
- créer recommandation ;
- créer opportunité ;
- associer un niveau de solution ;
- demander un document ;
- exiger contrôle humain ;
- bloquer la publication ou l’envoi RFQ ;
- suggérer un service complémentaire ;
- lancer un diagnostic enfant ;
- définir la durée de validité de la réponse.

Le moteur refuse les cycles infinis, références absentes et branches mortes. Les familles standardisées utilisent `template_key` afin que les répétitions volontaires (objectif, calendrier, budget, réception, etc.) soient reconnues comme des modèles partagés et non comme des doublons accidentels.

## 14. Gouvernance et approbations

Le franchisé peut publier directement les changements ordinaires si son contrat/permission l’autorise. Approbation centrale obligatoire pour :

- règle financière ou crédit ;
- avantage Box ;
- commission ;
- pénalité ;
- clause contractuelle ;
- texte juridique/réglementaire présenté comme obligatoire ;
- anomalie bloquant un client ;
- règle pouvant suspendre un sous-traitant ;
- modification importante du scoring ;
- suppression/fusion ayant un impact historique ;
- contrat-cadre ou engagement de volume.

Chaque approbation possède auteur, examinateur, comparaison avant/après, commentaire, date et preuve d’audit.

## 15. Cycle de publication

```text
DRAFT
→ LOCAL_TEST
→ FRANCHISE_REVIEW
→ CENTRAL_REVIEW si nécessaire
→ APPROVED
→ SCHEDULED
→ PUBLISHED
→ SUPERSEDED ou ARCHIVED
```

Un questionnaire déjà commencé reste attaché à sa version. La publication d’une V2 n’altère jamais un diagnostic V1 en cours ou terminé.

## 16. Import automatique

Codex doit :

1. extraire `matricia_catalog_build.py` depuis le prompt ou utiliser le fichier livré ;
2. exécuter le script ;
3. vérifier le manifeste ;
4. générer les traductions arabes par lots et les auditer ;
5. charger les CSV/JSONL dans des tables de staging ;
6. exécuter des contrôles de doublons et de références ;
7. publier une version `MATRICIA_GOLD_MASTER_BASELINE_V1` ;
8. conserver la source et le hash de chaque fichier ;
9. rendre l’opération idempotente ;
10. permettre un reset complet des données de démonstration sans supprimer les configurations de production.

## 17. Traductions FR/AR

La source fournie est française. Avant release :

- chaque bibliothèque, catégorie, sous-catégorie, service, question, aide, option, anomalie, risque et recommandation possède une version arabe ;
- un agent traduction produit les textes ;
- un second agent vérifie sens, terminologie, RTL et absence de texte français résiduel ;
- le validateur bloque si un champ arabe obligatoire est vide ;
- les contenus juridiques/fiscaux/HSE/assurance sont marqués `EXPERT_REVIEW_REQUIRED` jusqu’à validation métier.

## 18. APIs/commandes minimales

```text
POST   /catalog/libraries
PATCH  /catalog/libraries/:id
POST   /catalog/libraries/:id/publish
POST   /catalog/categories
PATCH  /catalog/categories/:id
POST   /catalog/subcategories
PATCH  /catalog/subcategories/:id
POST   /catalog/services
PATCH  /catalog/services/:id
POST   /catalog/services/:id/duplicate
POST   /catalog/services/:id/archive
POST   /catalog/services/:id/restore
POST   /catalog/services/:id/publish
GET    /catalog/services/:id/impact
POST   /catalog/questions
PATCH  /catalog/questions/:id
POST   /catalog/questions/:id/duplicate
POST   /catalog/questions/:id/archive
POST   /catalog/questions/:id/publish
POST   /catalog/questions/bulk-import
GET    /catalog/questions/export
POST   /catalog/questionnaires/:id/simulate
POST   /catalog/questionnaires/:id/validate
POST   /catalog/change-requests/:id/approve
POST   /catalog/change-requests/:id/reject
POST   /catalog/baseline/import
GET    /catalog/baseline/manifest
```

Toutes les mutations utilisent validation serveur, permissions, audit et idempotence lorsque nécessaire.

## 19. Écrans administrateur central

```text
ADM-CAT-001 Vue globale des 10 bibliothèques
ADM-CAT-002 Santé du catalogue
ADM-CAT-003 Changements en attente
ADM-CAT-004 Comparaison avant/après
ADM-CAT-005 Contrôle des traductions
ADM-CAT-006 Doublons et incohérences
ADM-CAT-007 Services sans fournisseur
ADM-CAT-008 Services sans questionnaire complet
ADM-CAT-009 Questions sans action/règle
ADM-CAT-010 Publication et rollback
ADM-CAT-011 Import/export
ADM-CAT-012 Audit catalogue
```

Indicateurs : nombre de services actifs, questions, diagnostics, formulaires incomplets, services sans sous-traitant, taux de conversion par question, taux d’abandon, questions jamais affichées, doublons, traductions manquantes et contenu à revoir.

## 20. Expérience client

Le client ne navigue pas dans une liste plate de 200 services et ne répond pas à 6 000 questions.

Matricia :

- utilise son Passeport entreprise ;
- pose d’abord les questions globales ;
- affiche une bibliothèque adaptée ;
- utilise les règles conditionnelles ;
- ne pose que les questions pertinentes ;
- sauvegarde automatiquement ;
- indique la progression ;
- explique pourquoi une question est demandée ;
- préremplit les réponses connues ;
- transforme les résultats en anomalies, recommandations et opportunités ;
- au clic « Demander des devis », affiche uniquement les questions RFQ encore manquantes pour le service choisi.

## 21. Recherche, filtres et performance

Le catalogue doit permettre recherche plein texte et filtres par : bibliothèque, catégorie, sous-catégorie, service, type, statut, auteur, traduction, plan, crédit, volume, date et version.

Index obligatoires sur codes, statuts, relations, version courante et recherche textuelle. Les 6 000 instances de questions ne doivent pas être chargées dans le navigateur. Utiliser pagination/virtualisation et requêtes ciblées.

## 22. Tests obligatoires

- Import initial idempotent.
- Comptages exacts du manifeste.
- Aucun identifiant dupliqué.
- Aucun service sans catégorie/sous-catégorie.
- Aucune sous-catégorie sans service primaire ou secondaire.
- 25 questions RFQ par service initial.
- 70 questions diagnostic et 30 qualification par bibliothèque.
- Création d’un nouveau service par franchisé.
- Ajout, modification, duplication et archivage d’une question.
- Blocage de suppression d’une question utilisée.
- Version historique conservée après publication V2.
- Changement sensible envoyé au central.
- RLS : un franchisé ne modifie pas une autre bibliothèque.
- Super Admin voit et restaure une version.
- Arabe complet et affichage RTL.
- Simulation sans effet sur les statistiques réelles.
- Import CSV invalide rejeté ligne par ligne avec rapport.
- Formulaire RFQ bloqué tant que les questions obligatoires pertinentes ne sont pas complètes.
- Ancien devis/contrat inchangé après modification du service.
- Performance acceptable avec 6 000 questions et croissance à 50 000.

## 23. Definition of Done spécifique

Le module Catalogue n’est terminé que lorsque :

1. les 10 bibliothèques et 200 services sont visibles et navigables ;
2. les 6 000 questions sont importées ;
3. les formulaires RFQ sont réellement générés par service ;
4. le franchisé peut ajouter, modifier, dupliquer, réordonner, désactiver et archiver ;
5. le franchisé peut changer le nombre de services actifs ;
6. le versionnage et l’audit fonctionnent ;
7. la validation centrale fonctionne pour les changements sensibles ;
8. toutes les traductions FR/AR requises sont présentes ;
9. les tests de sécurité, RLS, performance et E2E passent ;
10. aucun `TODO`, `TO_DEFINE`, écran vide ou bouton inactif n’existe.

## 24. Limite honnête et mécanisme d’extension

Les 6 000 questions constituent une base de production très large et bien supérieure au minimum demandé. Elles ne peuvent pas représenter littéralement toutes les questions imaginables dans toutes les futures variantes de mission. La couverture réellement complète repose donc sur deux éléments réunis :

1. une base initiale étendue, structurée et importée automatiquement ;
2. un moteur sans limite permettant au franchisé d’ajouter, corriger, retirer, versionner et tester les contenus de son domaine.

Codex ne doit jamais remplacer cette base par du contenu générique improvisé sans traçabilité.


---

# GÉNÉRATEUR DÉTERMINISTE INTÉGRÉ

Crée exactement le script suivant sous `scripts/matricia_catalog_build.py`, adapte uniquement le chemin de sortie au dépôt, puis exécute-le. Ne modifie pas silencieusement la liste de référence ; toute amélioration ultérieure passe par une nouvelle version auditée.

```python
from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Iterable

OUT = Path('/mnt/data/Matricia_Catalogue_Metier_V1')
OUT.mkdir(parents=True, exist_ok=True)


def slug(value: str) -> str:
    value = value.lower().strip().replace('&', ' et ').replace('œ', 'oe').replace('æ', 'ae')
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip('_')


@dataclass
class Category:
    library_code: str
    code: str
    name_fr: str
    description_fr: str
    order: int


@dataclass
class Service:
    library_code: str
    category_code: str
    code: str
    name_fr: str
    service_type: str
    unit_label_fr: str
    focus_terms: list[str]
    volume_eligible: bool
    recurring_eligible: bool
    credit_eligible: bool
    order: int


# The service catalog is deliberately explicit. Questions are generated deterministically
# from this curated blueprint; Codex must not invent a different baseline silently.
LIBRARIES: list[dict[str, Any]] = [
    {
        'code': 'IT',
        'name_fr': 'Informatique, cybersécurité et data',
        'description_fr': "Stratégie numérique, infrastructures, logiciels, cybersécurité, données, automatisation et support.",
        'categories': [
            ('IT-GOV', 'Stratégie et gouvernance SI'),
            ('IT-INFRA', 'Infrastructure, réseau et télécom'),
            ('IT-CYBER', 'Cybersécurité et continuité'),
            ('IT-CLOUD', 'Cloud et collaboration'),
            ('IT-DEV', 'Développement Web, mobile et logiciels'),
            ('IT-DATA', 'Data, BI et intelligence artificielle'),
            ('IT-SUPPORT', 'Support, maintenance et infogérance'),
            ('IT-IOT', 'IoT, vidéosurveillance et systèmes connectés'),
        ],
        'services': [
            ('IT-GOV', 'IT-AUDIT-SI', 'Audit du système d’information et feuille de route', 'AUDIT', 'utilisateurs, sites et applications', ['cartographie du SI', 'gouvernance', 'risques prioritaires', 'budget numérique', 'feuille de route']),
            ('IT-GOV', 'IT-ARCHI', 'Architecture et urbanisation du système d’information', 'ADVISORY', 'applications et flux', ['architecture actuelle', 'flux de données', 'interopérabilité', 'dette technique', 'architecture cible']),
            ('IT-INFRA', 'IT-NETWORK', 'Conception et installation réseau LAN/Wi-Fi', 'IMPLEMENTATION', 'sites, zones et points réseau', ['couverture Wi-Fi', 'points réseau', 'débits attendus', 'segmentation', 'câblage']),
            ('IT-INFRA', 'IT-FIREWALL', 'Déploiement de pare-feu et sécurisation réseau', 'IMPLEMENTATION', 'sites et connexions', ['pare-feu existant', 'VPN', 'filtrage', 'haute disponibilité', 'journalisation']),
            ('IT-INFRA', 'IT-VOIP', 'Téléphonie IP, centre d’appels et communications unifiées', 'IMPLEMENTATION', 'postes, numéros et sites', ['nombre de postes', 'numéros existants', 'files d’appels', 'enregistrement', 'intégration CRM']),
            ('IT-CYBER', 'IT-CYBER-AUDIT', 'Audit de cybersécurité', 'AUDIT', 'utilisateurs, actifs et sites', ['périmètre d’audit', 'normes visées', 'vulnérabilités', 'gestion des accès', 'plan de remédiation']),
            ('IT-CYBER', 'IT-PENTEST', 'Test d’intrusion Web, mobile ou infrastructure', 'AUDIT', 'applications, IP et environnements', ['cibles autorisées', 'type de test', 'fenêtre de tir', 'règles d’engagement', 'rapport de preuve']),
            ('IT-CYBER', 'IT-SOC-MDR', 'Supervision SOC/MDR et réponse aux incidents', 'MANAGED_SERVICE', 'postes, serveurs et journaux', ['sources de logs', 'couverture 24/7', 'temps de réponse', 'EDR/XDR', 'escalade incident']),
            ('IT-CYBER', 'IT-BACKUP', 'Sauvegarde, restauration et archivage', 'IMPLEMENTATION', 'Go/To, postes, serveurs et sites', ['volume de données', 'fréquence', 'rétention', 'RPO/RTO', 'tests de restauration']),
            ('IT-CYBER', 'IT-BCP-DRP', 'Plan de continuité et plan de reprise informatique', 'ADVISORY', 'processus et systèmes critiques', ['processus critiques', 'RTO', 'RPO', 'sites de repli', 'exercices de crise']),
            ('IT-CLOUD', 'IT-CLOUD-MIG', 'Migration vers le cloud', 'IMPLEMENTATION', 'applications, serveurs et données', ['workloads à migrer', 'cloud cible', 'dépendances', 'fenêtre de migration', 'réversibilité']),
            ('IT-CLOUD', 'IT-M365', 'Déploiement Microsoft 365 ou Google Workspace', 'IMPLEMENTATION', 'comptes et domaines', ['nombre de comptes', 'messagerie actuelle', 'domaines', 'migration de fichiers', 'sécurité des identités']),
            ('IT-DEV', 'IT-WEB-SHOWCASE', 'Création de site Web vitrine', 'CREATIVE_TECH', 'pages, langues et formulaires', ['nombre de pages', 'langues', 'identité visuelle', 'contenus', 'hébergement et domaine']),
            ('IT-DEV', 'IT-ECOMMERCE', 'Création de boutique e-commerce', 'CREATIVE_TECH', 'produits, commandes et langues', ['catalogue produits', 'paiement', 'livraison', 'stock', 'intégrations ERP']),
            ('IT-DEV', 'IT-WEB-APP', 'Développement d’application Web métier', 'SOFTWARE_PROJECT', 'utilisateurs, modules et workflows', ['rôles utilisateurs', 'modules', 'workflows', 'intégrations', 'données à migrer']),
            ('IT-DEV', 'IT-MOBILE-APP', 'Développement d’application mobile', 'SOFTWARE_PROJECT', 'plateformes, utilisateurs et écrans', ['iOS/Android', 'fonctionnalités', 'mode hors ligne', 'notifications', 'publication stores']),
            ('IT-DEV', 'IT-ERP-CRM', 'Implémentation ou intégration ERP/CRM', 'SOFTWARE_PROJECT', 'utilisateurs, modules et entités', ['processus métier', 'modules', 'reprise des données', 'interfaces', 'formation']),
            ('IT-DATA', 'IT-BI', 'Data warehouse et tableaux de bord BI', 'DATA_PROJECT', 'sources, indicateurs et utilisateurs', ['sources de données', 'KPI', 'fréquence de rafraîchissement', 'qualité des données', 'droits d’accès']),
            ('IT-DATA', 'IT-AI-AUTO', 'Automatisation IA, assistants et chatbots', 'AI_PROJECT', 'processus, documents et utilisateurs', ['cas d’usage', 'sources de connaissance', 'actions automatisées', 'validation humaine', 'confidentialité']),
            ('IT-IOT', 'IT-CCTV-IOT', 'Vidéosurveillance, contrôle d’accès et IoT', 'IMPLEMENTATION', 'caméras, portes, capteurs et sites', ['zones à couvrir', 'rétention vidéo', 'accès distant', 'détection intelligente', 'alimentation et réseau']),
        ],
    },
    {
        'code': 'COM',
        'name_fr': 'Communication, marketing et création',
        'description_fr': "Stratégie de marque, contenus, acquisition, communication digitale, audiovisuel et événements.",
        'categories': [
            ('COM-STRAT', 'Stratégie marketing et marque'),
            ('COM-DESIGN', 'Identité visuelle et design'),
            ('COM-CONTENT', 'Contenus et rédaction'),
            ('COM-DIGITAL', 'Marketing digital et réseaux sociaux'),
            ('COM-ADS', 'Publicité et acquisition'),
            ('COM-AV', 'Photo, vidéo et motion design'),
            ('COM-PR', 'Relations publiques et influence'),
            ('COM-EVENT', 'Événementiel, impression et signalétique'),
        ],
        'services': [
            ('COM-STRAT', 'COM-MKT-STRAT', 'Stratégie marketing globale', 'ADVISORY', 'marchés, segments et offres', ['objectifs marketing', 'segments cibles', 'positionnement', 'canaux', 'indicateurs']),
            ('COM-STRAT', 'COM-BRAND', 'Plateforme de marque et stratégie de branding', 'CREATIVE_STRATEGY', 'marques et gammes', ['raison d’être', 'positionnement', 'promesse', 'personnalité', 'architecture de marque']),
            ('COM-STRAT', 'COM-NAMING', 'Naming de marque, produit ou service', 'CREATIVE_STRATEGY', 'noms et territoires', ['univers lexical', 'marchés linguistiques', 'disponibilité souhaitée', 'contraintes juridiques', 'critères de sélection']),
            ('COM-DESIGN', 'COM-VISUAL-ID', 'Identité visuelle et charte graphique', 'CREATIVE', 'supports et déclinaisons', ['logo existant', 'univers visuel', 'supports prioritaires', 'formats', 'charte attendue']),
            ('COM-DESIGN', 'COM-GRAPHIC', 'Création graphique et supports commerciaux', 'CREATIVE', 'visuels et formats', ['type de support', 'dimensions', 'quantités', 'contenus fournis', 'contraintes d’impression']),
            ('COM-CONTENT', 'COM-COPY', 'Rédaction Web, commerciale et institutionnelle', 'CONTENT', 'pages, articles et langues', ['ton éditorial', 'cibles', 'volumes de mots', 'SEO', 'sources disponibles']),
            ('COM-CONTENT', 'COM-CONTENT-PLAN', 'Stratégie éditoriale et calendrier de contenu', 'CONTENT_STRATEGY', 'canaux et publications', ['canaux', 'fréquence', 'thématiques', 'formats', 'processus de validation']),
            ('COM-DIGITAL', 'COM-SOCIAL-STRAT', 'Stratégie réseaux sociaux', 'ADVISORY', 'réseaux et audiences', ['plateformes', 'audiences', 'objectifs', 'ligne éditoriale', 'indicateurs']),
            ('COM-DIGITAL', 'COM-COMMUNITY', 'Community management', 'MANAGED_SERVICE', 'comptes et publications', ['réseaux', 'fréquence', 'modération', 'réponses clients', 'reporting']),
            ('COM-DIGITAL', 'COM-SEO', 'Référencement naturel SEO', 'MANAGED_SERVICE', 'sites, pages et mots-clés', ['site cible', 'marchés', 'mots-clés', 'contenus', 'SEO technique']),
            ('COM-DIGITAL', 'COM-EMAIL', 'E-mail marketing et automatisation', 'CAMPAIGN', 'contacts et scénarios', ['taille base', 'consentements', 'scénarios', 'outil actuel', 'objectifs de conversion']),
            ('COM-ADS', 'COM-DIGITAL-ADS', 'Campagnes publicitaires digitales', 'CAMPAIGN', 'campagnes, audiences et budgets', ['plateformes publicitaires', 'budget média', 'cibles', 'créatifs', 'conversion']),
            ('COM-ADS', 'COM-MEDIA', 'Plan média et achat d’espace', 'CAMPAIGN', 'supports et périodes', ['zone', 'audience', 'budget', 'supports', 'mesure d’impact']),
            ('COM-AV', 'COM-PHOTO', 'Photographie corporate, produit ou immobilière', 'CREATIVE_PRODUCTION', 'photos, produits et lieux', ['type de shooting', 'nombre de produits', 'lieux', 'retouches', 'droits d’usage']),
            ('COM-AV', 'COM-VIDEO', 'Production vidéo corporate ou publicitaire', 'CREATIVE_PRODUCTION', 'vidéos et durées', ['objectif', 'durée', 'scénario', 'lieux', 'formats de diffusion']),
            ('COM-AV', 'COM-MOTION', 'Motion design et animation', 'CREATIVE_PRODUCTION', 'séquences et durées', ['style graphique', 'durée', 'voix-off', 'langues', 'formats']),
            ('COM-PR', 'COM-PR', 'Relations presse et relations publiques', 'MANAGED_SERVICE', 'campagnes et médias', ['messages clés', 'porte-parole', 'médias cibles', 'calendrier', 'gestion de crise']),
            ('COM-PR', 'COM-INFLUENCE', 'Marketing d’influence', 'CAMPAIGN', 'créateurs et contenus', ['cible', 'plateformes', 'nombre de créateurs', 'formats', 'droits de réutilisation']),
            ('COM-EVENT', 'COM-EVENT', 'Conception et communication événementielle', 'EVENT', 'participants, jours et lieux', ['type d’événement', 'participants', 'lieu', 'programme', 'prestations techniques']),
            ('COM-EVENT', 'COM-PRINT-SIGN', 'Impression, PLV et signalétique', 'PRODUCTION', 'unités, formats et sites', ['supports', 'dimensions', 'quantités', 'matières', 'installation']),
        ],
    },
    {
        'code': 'ACC',
        'name_fr': 'Comptabilité, fiscalité et finance',
        'description_fr': "Tenue comptable, fiscalité, pilotage financier, trésorerie, financement et transformation de la fonction finance.",
        'categories': [
            ('ACC-BOOK', 'Comptabilité et clôture'),
            ('ACC-TAX', 'Fiscalité et déclarations'),
            ('ACC-CTRL', 'Contrôle de gestion et performance'),
            ('ACC-CASH', 'Trésorerie et recouvrement'),
            ('ACC-FIN', 'Financement et modélisation'),
            ('ACC-AUDIT', 'Audit et due diligence'),
            ('ACC-SYS', 'Systèmes et digitalisation finance'),
            ('ACC-SPECIAL', 'Opérations comptables spécialisées'),
        ],
        'services': [
            ('ACC-BOOK', 'ACC-BOOKKEEPING', 'Tenue comptable externalisée', 'OUTSOURCING', 'écritures, comptes et mois', ['volume de pièces', 'logiciel', 'périodicité', 'plan comptable', 'mode de transmission']),
            ('ACC-BOOK', 'ACC-CLEANUP', 'Rattrapage et régularisation comptable', 'PROJECT', 'mois, écritures et comptes', ['périodes en retard', 'volume de pièces', 'écarts connus', 'logiciel', 'date de clôture']),
            ('ACC-BOOK', 'ACC-CLOSE', 'Clôture mensuelle et annuelle', 'OUTSOURCING', 'entités et périodes', ['calendrier de clôture', 'réconciliations', 'provisions', 'immobilisations', 'reporting attendu']),
            ('ACC-BOOK', 'ACC-FS', 'Préparation des états financiers', 'PROJECT', 'entités et exercices', ['référentiel', 'période', 'balances disponibles', 'annexes', 'date limite']),
            ('ACC-TAX', 'ACC-VAT', 'Déclarations de TVA', 'OUTSOURCING', 'déclarations et périodes', ['régime TVA', 'fréquence', 'volume factures', 'opérations internationales', 'crédits TVA']),
            ('ACC-TAX', 'ACC-CORP-TAX', 'Déclarations fiscales et impôt sur les sociétés', 'OUTSOURCING', 'entités et exercices', ['régime fiscal', 'résultat comptable', 'réintégrations', 'incitations', 'échéances']),
            ('ACC-TAX', 'ACC-TAX-REVIEW', 'Revue fiscale et diagnostic de conformité', 'AUDIT', 'taxes et exercices', ['impôts concernés', 'années', 'contrôles antérieurs', 'risques identifiés', 'documents disponibles']),
            ('ACC-TAX', 'ACC-TAX-AUDIT', 'Assistance lors d’un contrôle fiscal', 'ADVISORY', 'notifications et exercices', ['avis reçu', 'périmètre', 'délais', 'montants en jeu', 'pièces demandées']),
            ('ACC-CTRL', 'ACC-BUDGET', 'Budget annuel et prévisions', 'ADVISORY', 'centres, scénarios et mois', ['horizon', 'centres de coûts', 'hypothèses', 'scénarios', 'format de restitution']),
            ('ACC-CTRL', 'ACC-MGMT-CONTROL', 'Mise en place du contrôle de gestion', 'ADVISORY', 'processus et indicateurs', ['modèle économique', 'axes analytiques', 'KPI', 'fréquence', 'outils']),
            ('ACC-CTRL', 'ACC-COSTING', 'Calcul des coûts et rentabilité par produit', 'ADVISORY', 'produits, activités et centres', ['méthode actuelle', 'charges directes', 'inducteurs', 'volumes', 'marges attendues']),
            ('ACC-CASH', 'ACC-TREASURY', 'Gestion et prévision de trésorerie', 'ADVISORY', 'comptes et semaines', ['comptes bancaires', 'horizon', 'encaissements', 'décaissements', 'alertes']),
            ('ACC-CASH', 'ACC-COLLECTION', 'Optimisation du recouvrement client', 'MANAGED_SERVICE', 'factures et clients', ['balance âgée', 'processus de relance', 'litiges', 'outils', 'objectifs DSO']),
            ('ACC-CASH', 'ACC-INVOICING', 'Mise en place de la facturation et des contrôles', 'IMPLEMENTATION', 'factures et utilisateurs', ['types de factures', 'workflow', 'taxes', 'numérotation', 'intégrations']),
            ('ACC-FIN', 'ACC-FIN-MODEL', 'Modèle financier et business plan', 'ADVISORY', 'années et scénarios', ['horizon', 'sources de revenus', 'charges', 'investissements', 'scénarios']),
            ('ACC-FIN', 'ACC-FUNDING', 'Préparation d’un dossier de financement', 'ADVISORY', 'banques et montants', ['montant recherché', 'usage des fonds', 'garanties', 'prévisions', 'documents juridiques']),
            ('ACC-AUDIT', 'ACC-AUDIT-PREP', 'Préparation à l’audit financier', 'AUDIT_SUPPORT', 'entités et cycles', ['auditeur', 'périmètre', 'PBC list', 'réconciliations', 'deadline']),
            ('ACC-AUDIT', 'ACC-DUE-DIL', 'Due diligence financière', 'AUDIT', 'entités et années', ['objectif transaction', 'période', 'data room', 'qualité des résultats', 'dette nette']),
            ('ACC-SYS', 'ACC-SOFTWARE', 'Choix et déploiement d’un logiciel comptable', 'IMPLEMENTATION', 'utilisateurs et entités', ['processus', 'utilisateurs', 'fonctionnalités', 'migration', 'intégrations']),
            ('ACC-SPECIAL', 'ACC-INVENTORY', 'Inventaire physique et valorisation des stocks', 'PROJECT', 'références, sites et unités', ['nombre de références', 'sites', 'méthode de comptage', 'valorisation', 'écarts historiques']),
        ],
    },
    {
        'code': 'LEGAL',
        'name_fr': 'Juridique, conformité et gouvernance',
        'description_fr': "Droit des affaires, contrats, gouvernance, conformité, propriété intellectuelle et prévention des litiges.",
        'categories': [
            ('LEGAL-CORP', 'Droit des sociétés et gouvernance'),
            ('LEGAL-CONTRACT', 'Contrats commerciaux'),
            ('LEGAL-LABOR', 'Droit du travail'),
            ('LEGAL-IP', 'Propriété intellectuelle et numérique'),
            ('LEGAL-COMP', 'Conformité réglementaire et éthique'),
            ('LEGAL-DISPUTE', 'Précontentieux et contentieux'),
            ('LEGAL-REAL', 'Immobilier et baux'),
            ('LEGAL-TRANS', 'Transactions et partenariats'),
        ],
        'services': [
            ('LEGAL-CORP', 'LEGAL-CREATE', 'Création et structuration de société', 'LEGAL_ADVISORY', 'associés et entités', ['forme juridique', 'associés', 'capital', 'activité', 'gouvernance']),
            ('LEGAL-CORP', 'LEGAL-CORP-SECRETARY', 'Secrétariat juridique annuel', 'MANAGED_SERVICE', 'entités et actes', ['assemblées', 'modifications', 'registres', 'mandats', 'calendrier']),
            ('LEGAL-CORP', 'LEGAL-GOV', 'Mise en place de la gouvernance et délégations', 'LEGAL_ADVISORY', 'organes et décisions', ['organes de gouvernance', 'délégations', 'seuils', 'comités', 'reporting']),
            ('LEGAL-CONTRACT', 'LEGAL-CONTRACT-DRAFT', 'Rédaction de contrat commercial', 'LEGAL_SERVICE', 'contrats et parties', ['objet', 'parties', 'prix', 'responsabilités', 'droit applicable']),
            ('LEGAL-CONTRACT', 'LEGAL-CONTRACT-REVIEW', 'Revue et négociation de contrat', 'LEGAL_SERVICE', 'contrats et versions', ['document source', 'enjeux', 'clauses critiques', 'deadline', 'pouvoir de négociation']),
            ('LEGAL-CONTRACT', 'LEGAL-GTC', 'Conditions générales de vente ou d’utilisation', 'LEGAL_SERVICE', 'canaux et offres', ['modèle de vente', 'clients', 'paiement', 'livraison', 'réclamations']),
            ('LEGAL-LABOR', 'LEGAL-EMPLOYMENT', 'Contrats de travail et documents RH', 'LEGAL_SERVICE', 'salariés et modèles', ['types de contrats', 'catégories', 'rémunération', 'confidentialité', 'mobilité']),
            ('LEGAL-LABOR', 'LEGAL-HR-DISPUTE', 'Assistance en conflit ou procédure disciplinaire', 'LEGAL_ADVISORY', 'salariés et incidents', ['faits', 'preuves', 'chronologie', 'mesures prises', 'urgence']),
            ('LEGAL-IP', 'LEGAL-TRADEMARK', 'Dépôt et protection de marque', 'LEGAL_SERVICE', 'marques et classes', ['signe', 'territoires', 'classes', 'recherche antérieure', 'propriétaire']),
            ('LEGAL-IP', 'LEGAL-IP-CONTRACT', 'Contrats de propriété intellectuelle et licences', 'LEGAL_SERVICE', 'œuvres, logiciels et territoires', ['actifs', 'droits cédés', 'territoire', 'durée', 'rémunération']),
            ('LEGAL-IP', 'LEGAL-PRIVACY', 'Conformité données personnelles et politique de confidentialité', 'COMPLIANCE', 'traitements et sites', ['données collectées', 'finalités', 'sous-traitants', 'consentements', 'transferts']),
            ('LEGAL-COMP', 'LEGAL-COMPLIANCE-AUDIT', 'Audit de conformité réglementaire', 'COMPLIANCE', 'réglementations et processus', ['secteur', 'textes applicables', 'licences', 'contrôles', 'risques']),
            ('LEGAL-COMP', 'LEGAL-ETHICS', 'Code éthique, anticorruption et dispositif d’alerte', 'COMPLIANCE', 'entités et salariés', ['risques d’intégrité', 'cadeaux', 'tiers', 'canal d’alerte', 'enquêtes']),
            ('LEGAL-COMP', 'LEGAL-LICENSE', 'Obtention ou renouvellement d’agrément/licence', 'LEGAL_SERVICE', 'autorisations et sites', ['autorité', 'activité', 'conditions', 'documents', 'deadline']),
            ('LEGAL-DISPUTE', 'LEGAL-DEBT-RECOVERY', 'Recouvrement amiable et juridique', 'LEGAL_SERVICE', 'débiteurs et créances', ['montants', 'échéances', 'preuves', 'relances', 'solvabilité']),
            ('LEGAL-DISPUTE', 'LEGAL-PRE-LITIGATION', 'Mise en demeure et stratégie précontentieuse', 'LEGAL_ADVISORY', 'litiges et parties', ['faits', 'contrat', 'preuves', 'préjudice', 'objectif']),
            ('LEGAL-DISPUTE', 'LEGAL-LITIGATION', 'Coordination et suivi d’un contentieux', 'LEGAL_SERVICE', 'dossiers et audiences', ['juridiction', 'étape', 'avocat', 'preuves', 'échéances']),
            ('LEGAL-REAL', 'LEGAL-LEASE', 'Rédaction ou revue de bail commercial', 'LEGAL_SERVICE', 'locaux et parties', ['local', 'durée', 'loyer', 'charges', 'travaux']),
            ('LEGAL-TRANS', 'LEGAL-SHA', 'Pacte d’associés ou convention de partenariat', 'LEGAL_SERVICE', 'associés et décisions', ['répartition capital', 'gouvernance', 'sortie', 'financement', 'non-concurrence']),
            ('LEGAL-TRANS', 'LEGAL-FRANCHISE', 'Contrat et structuration de franchise', 'LEGAL_SERVICE', 'franchisés et territoires', ['concept', 'droits d’entrée', 'redevances', 'territoire', 'assistance']),
        ],
    },
    {
        'code': 'HR',
        'name_fr': 'Ressources humaines et formation',
        'description_fr': "Organisation RH, recrutement, compétences, performance, formation, administration du personnel et climat social.",
        'categories': [
            ('HR-STRAT', 'Stratégie et organisation RH'),
            ('HR-REC', 'Recrutement et intégration'),
            ('HR-PERF', 'Performance, compétences et carrière'),
            ('HR-COMP', 'Rémunération et avantages'),
            ('HR-ADMIN', 'Administration RH et paie'),
            ('HR-TRAIN', 'Formation et développement'),
            ('HR-REL', 'Relations sociales et engagement'),
            ('HR-DIGI', 'SIRH et digitalisation RH'),
        ],
        'services': [
            ('HR-STRAT', 'HR-AUDIT', 'Audit RH et plan d’action', 'AUDIT', 'salariés et sites', ['organisation RH', 'effectifs', 'processus', 'risques sociaux', 'priorités']),
            ('HR-STRAT', 'HR-WORKFORCE', 'Planification des effectifs et emplois', 'ADVISORY', 'postes et années', ['prévisions activité', 'effectifs', 'compétences', 'turnover', 'scénarios']),
            ('HR-STRAT', 'HR-JOB-DESC', 'Fiches de poste et référentiel métiers', 'PROJECT', 'postes et familles', ['organigramme', 'missions', 'responsabilités', 'compétences', 'indicateurs']),
            ('HR-REC', 'HR-RECRUIT', 'Recrutement de profils', 'RECRUITMENT', 'postes et candidats', ['poste', 'niveau', 'localisation', 'rémunération', 'date de prise de poste']),
            ('HR-REC', 'HR-EXEC-SEARCH', 'Chasse de cadres et dirigeants', 'RECRUITMENT', 'postes et marchés', ['mandat', 'profil cible', 'entreprises cibles', 'confidentialité', 'package']),
            ('HR-REC', 'HR-ONBOARD', 'Parcours d’intégration des nouveaux salariés', 'PROJECT', 'postes et sites', ['étapes', 'responsables', 'documents', 'formation', 'période d’essai']),
            ('HR-PERF', 'HR-PERFORMANCE', 'Système d’évaluation de la performance', 'IMPLEMENTATION', 'salariés et cycles', ['objectifs', 'compétences', 'fréquence', 'workflow', 'calibration']),
            ('HR-PERF', 'HR-COMPETENCY', 'Référentiel de compétences et gestion des carrières', 'PROJECT', 'métiers et niveaux', ['familles métiers', 'niveaux', 'compétences', 'mobilité', 'succession']),
            ('HR-PERF', 'HR-SUCCESSION', 'Plans de succession et hauts potentiels', 'ADVISORY', 'postes clés et talents', ['postes critiques', 'critères', 'talents', 'plans de développement', 'gouvernance']),
            ('HR-COMP', 'HR-COMP-BEN', 'Politique de rémunération et avantages', 'ADVISORY', 'postes et salariés', ['grilles actuelles', 'benchmark', 'bonus', 'avantages', 'équité interne']),
            ('HR-COMP', 'HR-PAYROLL', 'Externalisation ou sécurisation de la paie', 'OUTSOURCING', 'bulletins et salariés', ['effectif', 'variables', 'outil', 'calendrier', 'contrôles']),
            ('HR-ADMIN', 'HR-ADMIN', 'Administration du personnel externalisée', 'OUTSOURCING', 'salariés et actes', ['contrats', 'absences', 'dossiers salariés', 'attestations', 'reporting']),
            ('HR-ADMIN', 'HR-TIME', 'Gestion du temps, absences et planning', 'IMPLEMENTATION', 'salariés et sites', ['horaires', 'équipes', 'badges', 'règles absence', 'intégration paie']),
            ('HR-TRAIN', 'HR-TRAIN-NEEDS', 'Analyse des besoins de formation', 'ADVISORY', 'salariés et métiers', ['objectifs', 'écarts compétences', 'populations', 'budget', 'priorités']),
            ('HR-TRAIN', 'HR-TRAIN-DELIVERY', 'Conception et animation de formation', 'TRAINING', 'participants et sessions', ['thème', 'niveau', 'participants', 'format', 'évaluation']),
            ('HR-REL', 'HR-ENGAGEMENT', 'Enquête d’engagement et climat social', 'SURVEY', 'salariés et sites', ['population', 'anonymat', 'thèmes', 'communication', 'plan d’action']),
            ('HR-REL', 'HR-RELATIONS', 'Gestion des relations sociales', 'ADVISORY', 'sites et instances', ['instances', 'accords', 'conflits', 'calendrier', 'priorités']),
            ('HR-REL', 'HR-DISCIPLINE', 'Processus disciplinaire et gestion des dossiers sensibles', 'ADVISORY', 'dossiers et salariés', ['faits', 'preuves', 'règles internes', 'chronologie', 'mesures']),
            ('HR-DIGI', 'HR-HRIS', 'Choix et déploiement d’un SIRH', 'IMPLEMENTATION', 'salariés, modules et utilisateurs', ['modules', 'effectif', 'intégrations', 'migration', 'droits']),
            ('HR-DIGI', 'HR-OUTSOURCING', 'Direction RH externalisée', 'MANAGED_SERVICE', 'salariés et mois', ['périmètre', 'présence souhaitée', 'processus', 'reporting', 'gouvernance']),
        ],
    },
    {
        'code': 'INS',
        'name_fr': 'Assurance et gestion des risques',
        'description_fr': "Cartographie des risques, conception des couvertures, appels d’offres assureurs et gestion des sinistres.",
        'categories': [
            ('INS-RISK', 'Audit et cartographie des risques'),
            ('INS-PROP', 'Biens et pertes d’exploitation'),
            ('INS-LIAB', 'Responsabilités'),
            ('INS-PEOPLE', 'Protection des personnes'),
            ('INS-SPEC', 'Risques spécialisés'),
            ('INS-FLEET', 'Flotte, transport et logistique'),
            ('INS-CLAIM', 'Sinistres et prévention'),
            ('INS-PROGRAM', 'Programme d’assurance et appels d’offres'),
        ],
        'services': [
            ('INS-RISK', 'INS-RISK-AUDIT', 'Audit global des risques assurables', 'RISK_AUDIT', 'sites et risques', ['activités', 'sites', 'sinistres', 'valeurs exposées', 'tolérance au risque']),
            ('INS-RISK', 'INS-MAP', 'Cartographie et plan de traitement des risques', 'RISK_AUDIT', 'processus et risques', ['processus critiques', 'probabilité', 'impact', 'contrôles', 'priorités']),
            ('INS-PROP', 'INS-PROPERTY', 'Assurance multirisque des biens', 'INSURANCE_PLACEMENT', 'sites et valeurs', ['bâtiments', 'contenu', 'stocks', 'protections', 'historique sinistres']),
            ('INS-PROP', 'INS-BI', 'Assurance pertes d’exploitation', 'INSURANCE_PLACEMENT', 'sites et mois', ['marge brute', 'période indemnisation', 'dépendances', 'plan de continuité', 'scénario majeur']),
            ('INS-LIAB', 'INS-GL', 'Responsabilité civile exploitation', 'INSURANCE_PLACEMENT', 'activités et CA', ['activités', 'chiffre d’affaires', 'territoires', 'clients', 'sinistres']),
            ('INS-LIAB', 'INS-PRO-LIAB', 'Responsabilité civile professionnelle', 'INSURANCE_PLACEMENT', 'missions et CA', ['services rendus', 'contrats', 'limites souhaitées', 'territoires', 'réclamations']),
            ('INS-LIAB', 'INS-PRODUCT', 'Responsabilité produits', 'INSURANCE_PLACEMENT', 'produits et marchés', ['produits', 'volumes', 'pays', 'traçabilité', 'rappels']),
            ('INS-LIAB', 'INS-DNO', 'Responsabilité des dirigeants', 'INSURANCE_PLACEMENT', 'dirigeants et entités', ['structure', 'gouvernance', 'actionnariat', 'litiges', 'levées de fonds']),
            ('INS-PEOPLE', 'INS-HEALTH', 'Assurance santé collective', 'INSURANCE_PLACEMENT', 'salariés et ayants droit', ['effectif', 'population', 'garanties', 'réseau', 'budget']),
            ('INS-PEOPLE', 'INS-LIFE', 'Décès, invalidité et prévoyance collective', 'INSURANCE_PLACEMENT', 'salariés et catégories', ['catégories', 'capitaux', 'invalidité', 'bénéficiaires', 'budget']),
            ('INS-PEOPLE', 'INS-WORK-ACC', 'Accidents du travail et risques professionnels', 'INSURANCE_PLACEMENT', 'salariés et métiers', ['métiers', 'effectifs', 'sites', 'sinistres', 'mesures prévention']),
            ('INS-SPEC', 'INS-CYBER', 'Assurance cyber', 'INSURANCE_PLACEMENT', 'utilisateurs et CA', ['données', 'contrôles cyber', 'incidents', 'chiffre d’affaires', 'limites']),
            ('INS-SPEC', 'INS-CONSTRUCTION', 'Tous risques chantier et responsabilité décennale', 'INSURANCE_PLACEMENT', 'chantiers et montants', ['nature chantier', 'budget', 'durée', 'intervenants', 'garanties']),
            ('INS-SPEC', 'INS-CREDIT', 'Assurance-crédit clients', 'INSURANCE_PLACEMENT', 'clients et encours', ['encours', 'pays', 'concentration', 'impayés', 'politique crédit']),
            ('INS-FLEET', 'INS-FLEET', 'Assurance flotte automobile', 'INSURANCE_PLACEMENT', 'véhicules et conducteurs', ['parc', 'usage', 'conducteurs', 'sinistres', 'franchises']),
            ('INS-FLEET', 'INS-CARGO', 'Assurance transport de marchandises', 'INSURANCE_PLACEMENT', 'expéditions et valeurs', ['marchandises', 'modes', 'routes', 'valeurs', 'incoterms']),
            ('INS-CLAIM', 'INS-CLAIMS', 'Gestion et optimisation des sinistres', 'CLAIMS_MANAGEMENT', 'sinistres et polices', ['type sinistre', 'date', 'montant', 'preuves', 'avancement']),
            ('INS-CLAIM', 'INS-PREVENTION', 'Plan de prévention et réduction des sinistres', 'RISK_ADVISORY', 'sites et actions', ['risques dominants', 'sinistres', 'contrôles', 'investissements', 'KPI']),
            ('INS-PROGRAM', 'INS-POLICY-AUDIT', 'Audit des polices et garanties existantes', 'AUDIT', 'polices et entités', ['polices', 'exclusions', 'limites', 'franchises', 'doublons']),
            ('INS-PROGRAM', 'INS-TENDER', 'Appel d’offres assureurs et renouvellement', 'PROCUREMENT', 'polices et assureurs', ['échéance', 'périmètre', 'sinistralité', 'marché', 'objectifs']),
        ],
    },
    {
        'code': 'LOG',
        'name_fr': 'Achats, logistique et supply chain',
        'description_fr': "Sourcing, achats, fournisseurs, stocks, entrepôts, transport, import-export et continuité d’approvisionnement.",
        'categories': [
            ('LOG-PROC', 'Stratégie achats et sourcing'),
            ('LOG-SUP', 'Gestion des fournisseurs'),
            ('LOG-SPEND', 'Dépenses et performance achats'),
            ('LOG-INV', 'Stocks et prévisions'),
            ('LOG-WH', 'Entrepôts et opérations'),
            ('LOG-TRANS', 'Transport et distribution'),
            ('LOG-TRADE', 'Import-export et douane'),
            ('LOG-DIGI', 'Digitalisation et résilience supply chain'),
        ],
        'services': [
            ('LOG-PROC', 'LOG-PROC-AUDIT', 'Audit de la fonction achats', 'AUDIT', 'catégories et fournisseurs', ['organisation', 'dépenses', 'processus', 'contrats', 'gouvernance']),
            ('LOG-PROC', 'LOG-SOURCING-STRAT', 'Stratégie de sourcing et catégories', 'ADVISORY', 'catégories et marchés', ['catégories', 'enjeux', 'marché fournisseurs', 'risques', 'objectifs']),
            ('LOG-PROC', 'LOG-SUPPLIER-SEARCH', 'Recherche et présélection de fournisseurs', 'SOURCING', 'fournisseurs et pays', ['produit/service', 'spécifications', 'pays', 'quantités', 'certifications']),
            ('LOG-PROC', 'LOG-TENDER', 'Gestion d’appel d’offres fournisseurs', 'PROCUREMENT', 'lots et soumissionnaires', ['cahier des charges', 'lots', 'critères', 'calendrier', 'négociation']),
            ('LOG-SUP', 'LOG-SUP-QUAL', 'Qualification et homologation fournisseurs', 'AUDIT', 'fournisseurs et sites', ['critères', 'documents', 'audit', 'échantillons', 'risque']),
            ('LOG-SUP', 'LOG-SUP-PERF', 'Évaluation et performance fournisseurs', 'ADVISORY', 'fournisseurs et KPI', ['qualité', 'délai', 'coût', 'service', 'plans d’action']),
            ('LOG-SUP', 'LOG-CONTRACT-NEG', 'Négociation et optimisation des contrats achats', 'ADVISORY', 'contrats et catégories', ['contrats', 'volumes', 'prix', 'SLA', 'clauses de sortie']),
            ('LOG-SPEND', 'LOG-SPEND-ANALYSIS', 'Analyse des dépenses et économies', 'DATA_PROJECT', 'transactions et catégories', ['sources', 'période', 'codification', 'fournisseurs', 'objectifs économies']),
            ('LOG-SPEND', 'LOG-E-PROC', 'Mise en place d’un processus e-procurement', 'IMPLEMENTATION', 'utilisateurs et workflows', ['processus', 'catalogues', 'approbations', 'budgets', 'intégrations']),
            ('LOG-INV', 'LOG-INVENTORY-OPT', 'Optimisation des niveaux de stock', 'ADVISORY', 'références et sites', ['historique', 'lead times', 'service cible', 'saisonnalité', 'contraintes stockage']),
            ('LOG-INV', 'LOG-FORECAST', 'Prévision de la demande et S&OP', 'DATA_PROJECT', 'références et mois', ['historique ventes', 'promotions', 'horizon', 'granularité', 'processus S&OP']),
            ('LOG-WH', 'LOG-WH-DESIGN', 'Conception ou optimisation d’entrepôt', 'ENGINEERING', 'm², références et flux', ['surface', 'flux', 'volumes', 'équipements', 'contraintes bâtiment']),
            ('LOG-WH', 'LOG-WMS', 'Choix et déploiement WMS', 'IMPLEMENTATION', 'utilisateurs, sites et références', ['processus', 'volumes', 'matériels', 'intégrations', 'migration']),
            ('LOG-WH', 'LOG-PICKING', 'Optimisation préparation de commandes', 'ADVISORY', 'commandes et lignes', ['profils commandes', 'layout', 'méthodes', 'temps', 'erreurs']),
            ('LOG-TRANS', 'LOG-TRANS-TENDER', 'Appel d’offres transporteurs', 'PROCUREMENT', 'routes et expéditions', ['routes', 'volumes', 'fréquence', 'SLA', 'contraintes marchandises']),
            ('LOG-TRANS', 'LOG-ROUTE', 'Optimisation des tournées et du dernier kilomètre', 'DATA_PROJECT', 'livraisons et véhicules', ['adresses', 'fenêtres', 'véhicules', 'capacités', 'KPI']),
            ('LOG-TRADE', 'LOG-CUSTOMS', 'Assistance douane et conformité import-export', 'ADVISORY', 'produits et déclarations', ['produits', 'pays', 'codes douaniers', 'incoterms', 'documents']),
            ('LOG-TRADE', 'LOG-IMPORT', 'Organisation d’opérations import-export', 'MANAGED_SERVICE', 'expéditions et conteneurs', ['origine/destination', 'marchandises', 'volumes', 'délais', 'assurance']),
            ('LOG-DIGI', 'LOG-SC-DIGITAL', 'Digitalisation et tableau de bord supply chain', 'DATA_PROJECT', 'sources et KPI', ['systèmes', 'KPI', 'fréquence', 'alertes', 'utilisateurs']),
            ('LOG-DIGI', 'LOG-BCP', 'Plan de continuité supply chain', 'RISK_ADVISORY', 'fournisseurs et scénarios', ['fournisseurs critiques', 'single source', 'stocks sécurité', 'alternatives', 'scénarios']),
        ],
    },
    {
        'code': 'BTP',
        'name_fr': 'BTP, immobilier et maintenance',
        'description_fr': "Études, construction, rénovation, installations techniques, gestion immobilière et maintenance des actifs.",
        'categories': [
            ('BTP-STUDY', 'Études et conception'),
            ('BTP-COST', 'Économie de la construction'),
            ('BTP-WORK', 'Construction et rénovation'),
            ('BTP-MEP', 'Lots techniques'),
            ('BTP-SAFE', 'Sécurité et systèmes spéciaux'),
            ('BTP-ENERGY', 'Énergie et durabilité'),
            ('BTP-FM', 'Facility management et maintenance'),
            ('BTP-REAL', 'Immobilier, inspection et aménagement'),
        ],
        'services': [
            ('BTP-STUDY', 'BTP-FEAS', 'Étude de faisabilité immobilière ou chantier', 'ENGINEERING', 'm² et sites', ['objectif projet', 'terrain/bâtiment', 'programme', 'budget', 'contraintes']),
            ('BTP-STUDY', 'BTP-ARCH', 'Conception architecturale', 'DESIGN_ENGINEERING', 'm², niveaux et espaces', ['programme', 'surface', 'style', 'réglementation', 'niveau de détail']),
            ('BTP-STUDY', 'BTP-STRUCT', 'Étude de structure', 'ENGINEERING', 'm² et éléments', ['type structure', 'plans', 'charges', 'sol', 'normes']),
            ('BTP-STUDY', 'BTP-GEO', 'Étude géotechnique', 'ENGINEERING', 'sondages et parcelles', ['site', 'surface', 'projet', 'sondages', 'accès']),
            ('BTP-STUDY', 'BTP-MEP-DESIGN', 'Études électricité, plomberie et CVC', 'ENGINEERING', 'm² et systèmes', ['usage bâtiment', 'puissance', 'besoins eau', 'climatisation', 'plans']),
            ('BTP-COST', 'BTP-QS', 'Métré, estimation et bordereau de prix', 'ENGINEERING', 'lots et m²', ['plans disponibles', 'lots', 'niveau précision', 'base prix', 'deadline']),
            ('BTP-COST', 'BTP-PM', 'Maîtrise d’œuvre et gestion de projet chantier', 'PROJECT_MANAGEMENT', 'lots, mois et sites', ['périmètre', 'planning', 'intervenants', 'budget', 'reporting']),
            ('BTP-WORK', 'BTP-GC', 'Construction tous corps d’état', 'CONSTRUCTION', 'm² et lots', ['plans', 'surface', 'lots', 'délai', 'conditions site']),
            ('BTP-WORK', 'BTP-RENOV', 'Rénovation de bâtiment ou local', 'CONSTRUCTION', 'm² et espaces', ['état existant', 'travaux', 'occupation', 'finitions', 'délai']),
            ('BTP-WORK', 'BTP-FITOUT', 'Aménagement intérieur et fit-out', 'CONSTRUCTION', 'm² et postes', ['usage', 'plans', 'mobilier', 'finitions', 'contraintes exploitation']),
            ('BTP-MEP', 'BTP-ELEC', 'Installation et mise à niveau électrique', 'CONSTRUCTION', 'points et puissances', ['puissance', 'tableaux', 'points', 'mise à la terre', 'tests']),
            ('BTP-MEP', 'BTP-PLUMB', 'Plomberie, sanitaires et réseaux d’eau', 'CONSTRUCTION', 'points et réseaux', ['plans', 'points', 'pression', 'évacuation', 'équipements']),
            ('BTP-MEP', 'BTP-HVAC', 'Climatisation, ventilation et traitement d’air', 'CONSTRUCTION', 'zones et kW', ['surfaces', 'occupation', 'température', 'qualité air', 'équipements']),
            ('BTP-SAFE', 'BTP-FIRE', 'Détection et protection incendie', 'CONSTRUCTION', 'zones et équipements', ['usage', 'surface', 'risques', 'système existant', 'évacuation']),
            ('BTP-SAFE', 'BTP-SECURITY', 'Contrôle d’accès, alarme et sûreté bâtiment', 'CONSTRUCTION', 'portes, zones et utilisateurs', ['zones', 'portes', 'badges', 'intégrations', 'supervision']),
            ('BTP-ENERGY', 'BTP-SOLAR', 'Installation solaire photovoltaïque', 'ENERGY_PROJECT', 'kWc et sites', ['consommation', 'toiture', 'puissance', 'autoconsommation', 'raccordement']),
            ('BTP-ENERGY', 'BTP-ENERGY-AUDIT', 'Audit énergétique de bâtiment', 'AUDIT', 'sites et compteurs', ['factures énergie', 'surface', 'équipements', 'horaires', 'objectifs']),
            ('BTP-FM', 'BTP-MAINT', 'Contrat de maintenance multi-technique', 'MANAGED_SERVICE', 'sites et équipements', ['inventaire actifs', 'fréquence', 'SLA', 'astreinte', 'pièces']),
            ('BTP-REAL', 'BTP-INSPECTION', 'Inspection technique et diagnostic bâtiment', 'AUDIT', 'm² et éléments', ['objectif', 'pathologies', 'plans', 'accès', 'rapport attendu']),
            ('BTP-REAL', 'BTP-LANDSCAPE', 'Aménagement paysager, piscine et extérieurs', 'CONSTRUCTION', 'm² et zones', ['terrain', 'style', 'végétation', 'arrosage', 'équipements']),
        ],
    },
    {
        'code': 'QHSE',
        'name_fr': 'Qualité, HSE et certifications',
        'description_fr': "Systèmes de management, audits, sécurité au travail, environnement, sécurité alimentaire et préparation aux certifications.",
        'categories': [
            ('QHSE-QMS', 'Qualité et processus'),
            ('QHSE-ENV', 'Environnement'),
            ('QHSE-OHS', 'Santé et sécurité au travail'),
            ('QHSE-FOOD', 'Sécurité alimentaire'),
            ('QHSE-LAB', 'Laboratoires et métrologie'),
            ('QHSE-AUDIT', 'Audits et amélioration'),
            ('QHSE-DOC', 'Documentation et digitalisation'),
            ('QHSE-CERT', 'Préparation aux certifications'),
        ],
        'services': [
            ('QHSE-QMS', 'QHSE-ISO9001', 'Mise en place ISO 9001', 'COMPLIANCE_PROJECT', 'processus et sites', ['périmètre', 'processus', 'documentation', 'indicateurs', 'certification cible']),
            ('QHSE-QMS', 'QHSE-PROCESS', 'Cartographie et optimisation des processus', 'ADVISORY', 'processus et départements', ['processus', 'interfaces', 'irritants', 'KPI', 'outils']),
            ('QHSE-QMS', 'QHSE-SUPPLIER-QUALITY', 'Qualité fournisseurs', 'COMPLIANCE_PROJECT', 'fournisseurs et familles', ['critères', 'contrôles', 'non-conformités', 'audits', 'KPI']),
            ('QHSE-ENV', 'QHSE-ISO14001', 'Mise en place ISO 14001', 'COMPLIANCE_PROJECT', 'sites et aspects', ['aspects environnementaux', 'obligations', 'objectifs', 'déchets', 'urgence']),
            ('QHSE-ENV', 'QHSE-ENV-AUDIT', 'Audit environnemental', 'AUDIT', 'sites et impacts', ['activités', 'émissions', 'rejets', 'déchets', 'autorisations']),
            ('QHSE-ENV', 'QHSE-WASTE', 'Plan de gestion des déchets', 'ADVISORY', 'flux et tonnes', ['types déchets', 'quantités', 'stockage', 'prestataires', 'traçabilité']),
            ('QHSE-OHS', 'QHSE-ISO45001', 'Mise en place ISO 45001', 'COMPLIANCE_PROJECT', 'sites et salariés', ['dangers', 'évaluation risques', 'consultation', 'incidents', 'objectifs']),
            ('QHSE-OHS', 'QHSE-SAFETY-AUDIT', 'Audit santé et sécurité au travail', 'AUDIT', 'sites et postes', ['activités', 'dangers', 'EPI', 'formations', 'incidents']),
            ('QHSE-OHS', 'QHSE-RISK-ASSESS', 'Évaluation des risques professionnels', 'AUDIT', 'postes et unités', ['unités de travail', 'tâches', 'exposition', 'mesures', 'priorités']),
            ('QHSE-OHS', 'QHSE-HSE-PLAN', 'Plan HSE chantier ou site', 'COMPLIANCE_PROJECT', 'sites et intervenants', ['projet', 'effectifs', 'risques', 'sous-traitants', 'urgence']),
            ('QHSE-FOOD', 'QHSE-HACCP', 'Mise en place HACCP', 'COMPLIANCE_PROJECT', 'produits et lignes', ['produits', 'diagrammes', 'dangers', 'CCP', 'traçabilité']),
            ('QHSE-FOOD', 'QHSE-ISO22000', 'Mise en place ISO 22000', 'COMPLIANCE_PROJECT', 'sites et produits', ['périmètre', 'PRP', 'HACCP', 'fournisseurs', 'certification']),
            ('QHSE-FOOD', 'QHSE-FOOD-AUDIT', 'Audit hygiène et sécurité alimentaire', 'AUDIT', 'sites et zones', ['activité', 'zones', 'produits', 'nettoyage', 'contrôles']),
            ('QHSE-LAB', 'QHSE-ISO17025', 'Préparation ISO/IEC 17025 laboratoire', 'COMPLIANCE_PROJECT', 'méthodes et équipements', ['portée', 'méthodes', 'compétences', 'métrologie', 'essais aptitude']),
            ('QHSE-LAB', 'QHSE-METROLOGY', 'Gestion de métrologie et étalonnage', 'MANAGED_SERVICE', 'équipements et fréquences', ['inventaire', 'criticité', 'tolérances', 'fréquence', 'prestataires']),
            ('QHSE-AUDIT', 'QHSE-INTERNAL-AUDIT', 'Audit interne de système de management', 'AUDIT', 'processus et jours', ['référentiel', 'périmètre', 'sites', 'auditeurs', 'planning']),
            ('QHSE-AUDIT', 'QHSE-CAPA', 'Gestion des non-conformités et CAPA', 'IMPLEMENTATION', 'incidents et processus', ['sources', 'workflow', 'analyse causes', 'délais', 'efficacité']),
            ('QHSE-DOC', 'QHSE-DOC-MGMT', 'Système documentaire qualité/HSE', 'IMPLEMENTATION', 'documents et utilisateurs', ['documents', 'approbations', 'versions', 'diffusion', 'outil']),
            ('QHSE-CERT', 'QHSE-INTEGRATED', 'Système intégré Qualité-Environnement-Sécurité', 'COMPLIANCE_PROJECT', 'référentiels et sites', ['référentiels', 'processus communs', 'documentation', 'audits', 'certification']),
            ('QHSE-CERT', 'QHSE-CERT-PREP', 'Préparation et accompagnement à la certification', 'COMPLIANCE_PROJECT', 'sites et audits', ['référentiel', 'organisme', 'date cible', 'écarts', 'pré-audit']),
        ],
    },
    {
        'code': 'SALES',
        'name_fr': 'Commercial, vente et expérience client',
        'description_fr': "Stratégie commerciale, acquisition, CRM, canaux, performance des ventes, service client et expérience client.",
        'categories': [
            ('SALES-STRAT', 'Stratégie commerciale et marché'),
            ('SALES-PROC', 'Processus et performance de vente'),
            ('SALES-CRM', 'CRM et automatisation commerciale'),
            ('SALES-LEAD', 'Prospection et génération de leads'),
            ('SALES-TEAM', 'Organisation et compétences commerciales'),
            ('SALES-CHANNEL', 'Canaux, partenaires et export'),
            ('SALES-CX', 'Expérience et fidélisation client'),
            ('SALES-SERVICE', 'Service client et centres de contact'),
        ],
        'services': [
            ('SALES-STRAT', 'SALES-AUDIT', 'Audit commercial', 'AUDIT', 'équipes, canaux et offres', ['organisation', 'pipeline', 'conversion', 'outils', 'priorités']),
            ('SALES-STRAT', 'SALES-GTM', 'Stratégie go-to-market', 'ADVISORY', 'marchés, segments et offres', ['marché', 'segments', 'proposition de valeur', 'canaux', 'lancement']),
            ('SALES-STRAT', 'SALES-MARKET-RESEARCH', 'Étude de marché et segmentation clients', 'RESEARCH', 'segments et zones', ['objectif', 'marché', 'géographie', 'méthode', 'décisions attendues']),
            ('SALES-STRAT', 'SALES-PRICING', 'Stratégie de prix et politique commerciale', 'ADVISORY', 'offres et segments', ['coûts', 'concurrence', 'élasticité', 'remises', 'gouvernance']),
            ('SALES-PROC', 'SALES-PROCESS', 'Conception du processus de vente', 'IMPLEMENTATION', 'étapes et équipes', ['cycle de vente', 'étapes', 'critères', 'approbations', 'KPI']),
            ('SALES-PROC', 'SALES-PIPELINE', 'Mise en place du pipeline et prévisions commerciales', 'IMPLEMENTATION', 'opportunités et équipes', ['étapes', 'probabilités', 'forecast', 'revues', 'outils']),
            ('SALES-PROC', 'SALES-TENDER', 'Réponse aux appels d’offres commerciaux', 'MANAGED_SERVICE', 'dossiers et lots', ['dossier', 'deadline', 'exigences', 'références', 'prix']),
            ('SALES-CRM', 'SALES-CRM-IMPL', 'Choix et déploiement CRM', 'IMPLEMENTATION', 'utilisateurs et pipelines', ['processus', 'utilisateurs', 'données', 'intégrations', 'automatisations']),
            ('SALES-CRM', 'SALES-SALES-AUTO', 'Automatisation commerciale et séquences', 'IMPLEMENTATION', 'contacts et scénarios', ['sources leads', 'séquences', 'canaux', 'règles', 'mesure']),
            ('SALES-LEAD', 'SALES-LEADGEN', 'Génération de leads B2B/B2C', 'CAMPAIGN', 'leads et marchés', ['cible', 'volume', 'canaux', 'critères qualité', 'coût cible']),
            ('SALES-LEAD', 'SALES-TELEMARKETING', 'Téléprospection et prise de rendez-vous', 'MANAGED_SERVICE', 'contacts et rendez-vous', ['cible', 'script', 'volume appels', 'qualification', 'planning']),
            ('SALES-LEAD', 'SALES-SCRIPTS', 'Scripts, argumentaires et outils d’aide à la vente', 'CONTENT', 'offres et équipes', ['offres', 'objections', 'personas', 'canaux', 'formats']),
            ('SALES-TEAM', 'SALES-ORG', 'Organisation et dimensionnement de la force de vente', 'ADVISORY', 'commerciaux et territoires', ['effectif', 'territoires', 'portefeuilles', 'objectifs', 'rémunération']),
            ('SALES-TEAM', 'SALES-TRAIN', 'Formation et coaching commercial', 'TRAINING', 'participants et sessions', ['niveau', 'compétences', 'produits', 'format', 'évaluation']),
            ('SALES-TEAM', 'SALES-KAM', 'Programme grands comptes et key account management', 'ADVISORY', 'comptes et responsables', ['comptes stratégiques', 'potentiel', 'plans de compte', 'gouvernance', 'KPI']),
            ('SALES-CHANNEL', 'SALES-CHANNEL', 'Réseau de distributeurs et partenaires', 'ADVISORY', 'partenaires et territoires', ['modèle canal', 'territoires', 'marges', 'contrats', 'animation']),
            ('SALES-CHANNEL', 'SALES-EXPORT', 'Développement commercial à l’export', 'ADVISORY', 'pays et marchés', ['pays cibles', 'offre', 'réglementation', 'partenaires', 'budget']),
            ('SALES-CX', 'SALES-CX-MAP', 'Cartographie du parcours et expérience client', 'RESEARCH', 'parcours et segments', ['segments', 'points de contact', 'irritants', 'données', 'priorités']),
            ('SALES-CX', 'SALES-LOYALTY', 'Programme de fidélité et rétention', 'IMPLEMENTATION', 'clients et avantages', ['base clients', 'comportements', 'récompenses', 'canaux', 'économie programme']),
            ('SALES-SERVICE', 'SALES-CUSTOMER-SERVICE', 'Mise en place ou optimisation du service client', 'IMPLEMENTATION', 'agents et canaux', ['volumes contacts', 'canaux', 'SLA', 'outils', 'qualité']),
        ],
    },
]

# Add a 10th domain that was intentionally separated from QHSE/BTP.
LIBRARIES.insert(5, {
    'code': 'OPS',
    'name_fr': 'Opérations, productivité et transformation',
    'description_fr': "Excellence opérationnelle, organisation, processus, productivité, digitalisation et pilotage de la transformation.",
    'categories': [
        ('OPS-STRAT', 'Stratégie opérationnelle'),
        ('OPS-PROC', 'Processus et organisation'),
        ('OPS-LEAN', 'Lean et amélioration continue'),
        ('OPS-PMO', 'Gestion de projets et PMO'),
        ('OPS-PROD', 'Production et planification'),
        ('OPS-SERVICE', 'Opérations de services'),
        ('OPS-DIGI', 'Digitalisation des opérations'),
        ('OPS-CHANGE', 'Conduite du changement'),
    ],
    'services': [
        ('OPS-STRAT', 'OPS-AUDIT', 'Diagnostic de performance opérationnelle', 'AUDIT', 'processus, sites et équipes', ['objectifs', 'processus', 'coûts', 'délais', 'goulots']),
        ('OPS-STRAT', 'OPS-OPERATING-MODEL', 'Conception du modèle opérationnel cible', 'ADVISORY', 'fonctions et sites', ['organisation', 'rôles', 'gouvernance', 'processus', 'indicateurs']),
        ('OPS-PROC', 'OPS-PROCESS-MAP', 'Cartographie et refonte des processus', 'ADVISORY', 'processus et activités', ['périmètre', 'acteurs', 'entrées/sorties', 'irritants', 'contrôles']),
        ('OPS-PROC', 'OPS-SOP', 'Création de procédures et modes opératoires', 'CONTENT_PROJECT', 'procédures et postes', ['processus', 'niveau de détail', 'supports', 'validation', 'formation']),
        ('OPS-PROC', 'OPS-ORG-DESIGN', 'Organisation, rôles et responsabilités', 'ADVISORY', 'postes et équipes', ['organigramme', 'charges', 'responsabilités', 'interfaces', 'dimensionnement']),
        ('OPS-LEAN', 'OPS-LEAN', 'Programme Lean et réduction des gaspillages', 'TRANSFORMATION', 'lignes et processus', ['flux', 'gaspillages', 'temps', 'qualité', 'équipes']),
        ('OPS-LEAN', 'OPS-SIX-SIGMA', 'Projet Six Sigma et réduction de variabilité', 'TRANSFORMATION', 'processus et défauts', ['CTQ', 'données', 'défauts', 'capabilité', 'objectifs']),
        ('OPS-LEAN', 'OPS-5S', 'Déploiement 5S et management visuel', 'IMPLEMENTATION', 'zones et équipes', ['zones', 'standards', 'audits', 'matériel', 'animation']),
        ('OPS-PMO', 'OPS-PMO', 'Mise en place d’un PMO', 'IMPLEMENTATION', 'projets et chefs de projet', ['portefeuille', 'méthodologie', 'gouvernance', 'outils', 'reporting']),
        ('OPS-PMO', 'OPS-PROJECT-RECOVERY', 'Redressement de projet en difficulté', 'PROJECT_MANAGEMENT', 'projets et lots', ['situation', 'retards', 'budget', 'risques', 'décisions']),
        ('OPS-PROD', 'OPS-PRODUCTION-PLAN', 'Planification et ordonnancement de production', 'ADVISORY', 'références et lignes', ['capacités', 'demandes', 'gammes', 'stocks', 'contraintes']),
        ('OPS-PROD', 'OPS-OEE', 'Amélioration du rendement et TRS/OEE', 'TRANSFORMATION', 'machines et lignes', ['disponibilité', 'performance', 'qualité', 'arrêts', 'données']),
        ('OPS-PROD', 'OPS-MAINT-EXCELLENCE', 'Excellence maintenance et fiabilité', 'TRANSFORMATION', 'équipements et sites', ['criticité', 'pannes', 'préventif', 'pièces', 'GMAO']),
        ('OPS-SERVICE', 'OPS-SERVICE-DESIGN', 'Conception et optimisation d’opérations de services', 'ADVISORY', 'dossiers et équipes', ['parcours', 'volumes', 'SLA', 'ressources', 'qualité']),
        ('OPS-SERVICE', 'OPS-BACKOFFICE', 'Optimisation du back-office', 'TRANSFORMATION', 'transactions et équipes', ['types de dossiers', 'volumes', 'délais', 'erreurs', 'automatisation']),
        ('OPS-DIGI', 'OPS-RPA', 'Automatisation RPA des processus', 'AUTOMATION', 'processus et robots', ['tâches', 'volumes', 'applications', 'exceptions', 'ROI']),
        ('OPS-DIGI', 'OPS-BPM', 'Déploiement BPM et workflows', 'IMPLEMENTATION', 'processus et utilisateurs', ['workflows', 'règles', 'formulaires', 'intégrations', 'SLA']),
        ('OPS-DIGI', 'OPS-KPI', 'Tableau de bord opérationnel et KPI', 'DATA_PROJECT', 'indicateurs et sources', ['KPI', 'sources', 'fréquence', 'alertes', 'utilisateurs']),
        ('OPS-CHANGE', 'OPS-CHANGE', 'Conduite du changement', 'CHANGE_MANAGEMENT', 'populations et sites', ['transformation', 'impacts', 'parties prenantes', 'communication', 'adoption']),
        ('OPS-CHANGE', 'OPS-TRAIN-COACH', 'Formation et coaching des équipes opérationnelles', 'TRAINING', 'participants et sessions', ['compétences', 'niveau', 'format', 'mise en pratique', 'évaluation']),
    ],
})

# Ensure exactly ten libraries. OPS replaces the original sales count issue by making 11; drop none? We now have IT,COM,ACC,LEGAL,HR,OPS,INS,LOG,BTP,QHSE,SALES = 11.
# The original Matricia brief requires 10. Keep SALES and remove OPS from the production baseline; OPS services can be imported later as an optional library.
OPTIONAL_LIBRARY = LIBRARIES.pop(5)


MACRO_CATEGORY_MAP: dict[str, list[tuple[str, str, list[str]]]] = {
    'IT': [
        ('IT-MACRO-GOV', 'Stratégie, gouvernance et architecture', ['IT-GOV']),
        ('IT-MACRO-INFRA', 'Infrastructure, cloud et communications', ['IT-INFRA', 'IT-CLOUD']),
        ('IT-MACRO-CYBER', 'Cybersécurité, sauvegarde et continuité', ['IT-CYBER']),
        ('IT-MACRO-DIGITAL', 'Applications, données et systèmes connectés', ['IT-DEV', 'IT-DATA', 'IT-SUPPORT', 'IT-IOT']),
    ],
    'COM': [
        ('COM-MACRO-BRAND', 'Stratégie, marque et positionnement', ['COM-STRAT']),
        ('COM-MACRO-CONTENT', 'Design, contenus et production créative', ['COM-DESIGN', 'COM-CONTENT', 'COM-AV']),
        ('COM-MACRO-ACQ', 'Marketing digital, acquisition et fidélisation', ['COM-DIGITAL', 'COM-ADS']),
        ('COM-MACRO-INFLUENCE', 'Relations publiques, influence et événements', ['COM-PR', 'COM-EVENT']),
    ],
    'ACC': [
        ('ACC-MACRO-ACCOUNTING', 'Comptabilité, clôture et fiscalité', ['ACC-BOOK', 'ACC-TAX']),
        ('ACC-MACRO-PERF', 'Performance, coûts et trésorerie', ['ACC-CTRL', 'ACC-CASH']),
        ('ACC-MACRO-FIN', 'Financement, audit et transaction', ['ACC-FIN', 'ACC-AUDIT']),
        ('ACC-MACRO-SYSTEMS', 'Systèmes financiers et opérations spécialisées', ['ACC-SYS', 'ACC-SPECIAL']),
    ],
    'LEGAL': [
        ('LEGAL-MACRO-CORP', 'Sociétés, gouvernance et partenariats', ['LEGAL-CORP', 'LEGAL-TRANS']),
        ('LEGAL-MACRO-CONTRACT', 'Contrats commerciaux et droit du travail', ['LEGAL-CONTRACT', 'LEGAL-LABOR']),
        ('LEGAL-MACRO-COMP', 'Propriété intellectuelle et conformité', ['LEGAL-IP', 'LEGAL-COMP']),
        ('LEGAL-MACRO-DISPUTE', 'Litiges, recouvrement et immobilier', ['LEGAL-DISPUTE', 'LEGAL-REAL']),
    ],
    'HR': [
        ('HR-MACRO-ORG', 'Stratégie RH et organisation', ['HR-STRAT']),
        ('HR-MACRO-TALENT', 'Recrutement, intégration et talents', ['HR-REC', 'HR-PERF']),
        ('HR-MACRO-REWARD', 'Rémunération, administration et paie', ['HR-COMP', 'HR-ADMIN']),
        ('HR-MACRO-DEV', 'Formation, relations sociales et digital RH', ['HR-TRAIN', 'HR-REL', 'HR-DIGI']),
    ],
    'INS': [
        ('INS-MACRO-RISK', 'Audit des risques et protection des actifs', ['INS-RISK', 'INS-PROP']),
        ('INS-MACRO-LIAB', 'Responsabilités et protection des personnes', ['INS-LIAB', 'INS-PEOPLE']),
        ('INS-MACRO-SPECIAL', 'Risques spécialisés, flotte et transport', ['INS-SPEC', 'INS-FLEET']),
        ('INS-MACRO-PROGRAM', 'Prévention, sinistres et programme d’assurance', ['INS-CLAIM', 'INS-PROGRAM']),
    ],
    'LOG': [
        ('LOG-MACRO-PROC', 'Achats, sourcing et fournisseurs', ['LOG-PROC', 'LOG-SUP']),
        ('LOG-MACRO-PLAN', 'Dépenses, stocks et planification', ['LOG-SPEND', 'LOG-INV']),
        ('LOG-MACRO-OPS', 'Entrepôts, transport et distribution', ['LOG-WH', 'LOG-TRANS']),
        ('LOG-MACRO-TRADE', 'Commerce international, digitalisation et résilience', ['LOG-TRADE', 'LOG-DIGI']),
    ],
    'BTP': [
        ('BTP-MACRO-DESIGN', 'Études, conception et économie de la construction', ['BTP-STUDY', 'BTP-COST']),
        ('BTP-MACRO-WORK', 'Construction, rénovation et lots techniques', ['BTP-WORK', 'BTP-MEP']),
        ('BTP-MACRO-SAFE', 'Sécurité, énergie et durabilité', ['BTP-SAFE', 'BTP-ENERGY']),
        ('BTP-MACRO-ASSET', 'Maintenance, immobilier et aménagement', ['BTP-FM', 'BTP-REAL']),
    ],
    'QHSE': [
        ('QHSE-MACRO-QE', 'Qualité, processus et environnement', ['QHSE-QMS', 'QHSE-ENV']),
        ('QHSE-MACRO-HS', 'Santé, sécurité et sécurité alimentaire', ['QHSE-OHS', 'QHSE-FOOD']),
        ('QHSE-MACRO-LAB', 'Laboratoires, métrologie et audits', ['QHSE-LAB', 'QHSE-AUDIT']),
        ('QHSE-MACRO-CERT', 'Documentation et certifications', ['QHSE-DOC', 'QHSE-CERT']),
    ],
    'SALES': [
        ('SALES-MACRO-STRAT', 'Stratégie de marché et processus commercial', ['SALES-STRAT', 'SALES-PROC']),
        ('SALES-MACRO-ACQ', 'CRM, automatisation et acquisition', ['SALES-CRM', 'SALES-LEAD']),
        ('SALES-MACRO-ORG', 'Organisation commerciale, canaux et export', ['SALES-TEAM', 'SALES-CHANNEL']),
        ('SALES-MACRO-CX', 'Expérience, fidélisation et service client', ['SALES-CX', 'SALES-SERVICE']),
    ],
}

SUBCATEGORY_TO_MACRO = {
    sub: macro_code
    for lib_groups in MACRO_CATEGORY_MAP.values()
    for macro_code, _macro_name, subs in lib_groups
    for sub in subs
}


SECONDARY_SERVICE_SUBCATEGORIES: dict[str, list[str]] = {
    'IT-SOC-MDR': ['IT-SUPPORT'],
    'IT-M365': ['IT-SUPPORT'],
    'IT-ERP-CRM': ['IT-SUPPORT'],
    'COM-COPY': ['COM-DIGITAL'],
    'ACC-INVOICING': ['ACC-SYS'],
    'LEGAL-PRIVACY': ['LEGAL-IP'],
    'HR-PAYROLL': ['HR-ADMIN'],
    'INS-CYBER': ['INS-RISK'],
    'LOG-WMS': ['LOG-DIGI'],
    'BTP-SECURITY': ['BTP-FM'],
    'QHSE-CAPA': ['QHSE-QMS'],
    'SALES-CRM-IMPL': ['SALES-PROC'],
}


TYPE_PROFILES: dict[str, dict[str, Any]] = {
    'AUDIT': {'deliverables': 'rapport de diagnostic, constats, priorités et plan d’action', 'proof': 'rapport signé et restitution', 'recurring': False},
    'ADVISORY': {'deliverables': 'analyse, recommandations, feuille de route et ateliers', 'proof': 'livrables validés et compte rendu', 'recurring': False},
    'LEGAL_ADVISORY': {'deliverables': 'analyse juridique, options, risques et recommandations', 'proof': 'note ou avis validé', 'recurring': False},
    'LEGAL_SERVICE': {'deliverables': 'document juridique versionné, commentaires et version finale', 'proof': 'document final et validation du client', 'recurring': False},
    'COMPLIANCE': {'deliverables': 'diagnostic, registre, politiques et plan de mise en conformité', 'proof': 'dossier de conformité et preuves', 'recurring': False},
    'COMPLIANCE_PROJECT': {'deliverables': 'système documenté, preuves de déploiement et préparation audit', 'proof': 'documents, enregistrements et audit blanc', 'recurring': False},
    'IMPLEMENTATION': {'deliverables': 'solution installée, configurée, testée et documentée', 'proof': 'PV de tests, documentation et réception', 'recurring': False},
    'SOFTWARE_PROJECT': {'deliverables': 'application, code, documentation, tests et déploiement', 'proof': 'recette fonctionnelle et accès livrés', 'recurring': False},
    'AI_PROJECT': {'deliverables': 'cas d’usage, prototype, intégrations, garde-fous et documentation', 'proof': 'tests, mesures et validation métier', 'recurring': False},
    'DATA_PROJECT': {'deliverables': 'modèle de données, pipelines, tableaux de bord et documentation', 'proof': 'contrôles qualité et validation KPI', 'recurring': False},
    'CREATIVE_TECH': {'deliverables': 'design, réalisation, intégration, mise en ligne et accès', 'proof': 'site fonctionnel et recette', 'recurring': False},
    'CREATIVE_STRATEGY': {'deliverables': 'territoires créatifs, recommandations et sélection finale', 'proof': 'présentation et validation', 'recurring': False},
    'CREATIVE': {'deliverables': 'concepts, fichiers sources et déclinaisons finales', 'proof': 'fichiers livrés aux formats convenus', 'recurring': False},
    'CONTENT': {'deliverables': 'contenus rédigés, relus et livrés aux formats convenus', 'proof': 'contenus validés', 'recurring': False},
    'CONTENT_STRATEGY': {'deliverables': 'ligne éditoriale, calendrier, formats et gouvernance', 'proof': 'plan éditorial validé', 'recurring': True},
    'CREATIVE_PRODUCTION': {'deliverables': 'production, fichiers maîtres et exports multi-formats', 'proof': 'fichiers et droits d’usage', 'recurring': False},
    'CAMPAIGN': {'deliverables': 'plan de campagne, paramétrage, créations, diffusion et reporting', 'proof': 'rapports plateforme et bilan', 'recurring': True},
    'EVENT': {'deliverables': 'concept, planning, coordination, exécution et bilan', 'proof': 'PV, photos et bilan', 'recurring': False},
    'PRODUCTION': {'deliverables': 'produits conformes, BAT et livraison/installation', 'proof': 'BAT et bon de livraison', 'recurring': False},
    'MANAGED_SERVICE': {'deliverables': 'service récurrent, SLA, rapports et support', 'proof': 'rapports périodiques et tickets', 'recurring': True},
    'OUTSOURCING': {'deliverables': 'opérations exécutées, contrôles et reporting périodique', 'proof': 'rapports et pièces de contrôle', 'recurring': True},
    'PROJECT': {'deliverables': 'livrables du projet, planning, contrôles et clôture', 'proof': 'livrables et PV', 'recurring': False},
    'AUDIT_SUPPORT': {'deliverables': 'dossier préparé, réponses et suivi des demandes', 'proof': 'liste PBC clôturée', 'recurring': False},
    'RECRUITMENT': {'deliverables': 'shortlist, évaluations, entretiens et accompagnement', 'proof': 'candidats présentés et décisions', 'recurring': False},
    'TRAINING': {'deliverables': 'supports, sessions, évaluations et attestations', 'proof': 'feuilles de présence et évaluations', 'recurring': False},
    'SURVEY': {'deliverables': 'questionnaire, collecte, analyse et plan d’action', 'proof': 'rapport agrégé et restitution', 'recurring': False},
    'INSURANCE_PLACEMENT': {'deliverables': 'analyse, consultation du marché, comparaison et proposition de couverture', 'proof': 'comparatif et documents de souscription', 'recurring': True},
    'RISK_AUDIT': {'deliverables': 'cartographie des risques, évaluation et plan de traitement', 'proof': 'rapport et matrice des risques', 'recurring': False},
    'RISK_ADVISORY': {'deliverables': 'plan de prévention, procédures et indicateurs', 'proof': 'plan validé et preuves de mise en œuvre', 'recurring': False},
    'CLAIMS_MANAGEMENT': {'deliverables': 'dossier sinistre, échanges, suivi et bilan d’indemnisation', 'proof': 'dossier complet et décision', 'recurring': True},
    'PROCUREMENT': {'deliverables': 'dossier de consultation, analyse des offres et recommandation', 'proof': 'comparatif et décision', 'recurring': False},
    'SOURCING': {'deliverables': 'longlist, shortlist, vérifications et recommandations', 'proof': 'fiches fournisseurs', 'recurring': False},
    'ENGINEERING': {'deliverables': 'études, plans, notes de calcul et estimations', 'proof': 'documents approuvés', 'recurring': False},
    'DESIGN_ENGINEERING': {'deliverables': 'esquisses, plans, rendus et dossier de conception', 'proof': 'plans validés', 'recurring': False},
    'PROJECT_MANAGEMENT': {'deliverables': 'planning, coordination, contrôle budget/qualité et reporting', 'proof': 'rapports et PV', 'recurring': True},
    'CONSTRUCTION': {'deliverables': 'travaux exécutés, essais, DOE et réception', 'proof': 'PV, photos et DOE', 'recurring': False},
    'ENERGY_PROJECT': {'deliverables': 'étude, équipements, installation, tests et mise en service', 'proof': 'mesures et PV de mise en service', 'recurring': False},
    'RESEARCH': {'deliverables': 'méthodologie, collecte, analyse et rapport', 'proof': 'rapport et base anonymisée', 'recurring': False},
}


COMMON_RFQ_QUESTIONS = [
    ('OBJECTIVE', 'Objectif', 'Quel est l’objectif principal attendu pour le service « {service} » ?', 'LONG_TEXT', True, 'Décrivez le résultat métier recherché et la raison de la demande.'),
    ('CURRENT_STATE', 'Situation actuelle', 'Quelle est votre situation actuelle concernant « {service} » ?', 'LONG_TEXT', True, 'Décrivez les outils, prestataires, pratiques ou solutions déjà en place.'),
    ('SCOPE', 'Périmètre', 'Quel est le périmètre quantitatif exact à prendre en charge ({unit}) ?', 'TABLE', True, 'Indiquez les volumes, sites, utilisateurs, unités ou lots concernés.'),
    ('LOCATIONS', 'Localisation', 'Quels sites, villes ou zones géographiques sont concernés par « {service} » ?', 'TABLE', True, 'Ajoutez chaque site et précisez si une intervention sur place est nécessaire.'),
    ('STAKEHOLDERS', 'Parties prenantes', 'Quels utilisateurs, équipes, décideurs ou tiers participeront au projet ?', 'TABLE', True, 'Indiquez les rôles, responsabilités et interlocuteurs de validation.'),
    ('DELIVERABLES', 'Livrables', 'Quels livrables attendez-vous précisément du prestataire ?', 'TABLE', True, 'Sélectionnez les livrables attendus et ajoutez les éléments spécifiques.'),
    ('DOCUMENTS', 'Documents disponibles', 'Quels documents, données, plans, contrats, accès ou contenus pouvez-vous fournir ?', 'FILE', False, 'Joignez les éléments disponibles et indiquez ceux qui seront fournis plus tard.'),
    ('DEPENDENCIES', 'Dépendances', 'Quelles dépendances, intégrations, autorisations ou contributions internes peuvent influencer la mission ?', 'LONG_TEXT', False, 'Mentionnez les autres projets, systèmes, fournisseurs ou validations nécessaires.'),
    ('COMPLIANCE', 'Contraintes', 'Quelles contraintes réglementaires, de confidentialité, de sécurité, de marque ou de fonctionnement doivent être respectées ?', 'LONG_TEXT', True, 'Indiquez les normes internes et obligations particulières.'),
    ('TIMELINE', 'Calendrier', 'Quelle est la date de démarrage souhaitée et quelles sont les échéances ou étapes impératives ?', 'TABLE', True, 'Ajoutez les jalons, dates de validation et date finale attendue.'),
    ('BUDGET', 'Budget', 'Quelle enveloppe budgétaire ou fourchette avez-vous prévue pour cette mission ?', 'MONEY', False, 'La réponse peut rester confidentielle et sert à proposer une solution adaptée.'),
    ('ACCEPTANCE', 'Réception', 'Selon quels critères objectifs considérerez-vous la prestation comme conforme et terminée ?', 'LONG_TEXT', True, 'Définissez les résultats, tests, formats et validations attendus.'),
    ('SUPPORT', 'Accompagnement', 'Avez-vous besoin de formation, transfert de compétences, support ou maintenance après livraison ?', 'MULTIPLE_CHOICE', False, 'Précisez la durée, les populations et le niveau de support.'),
    ('PAYMENT', 'Modalités', 'Quelles modalités de facturation, d’acompte ou de paiement souhaitez-vous proposer ?', 'SINGLE_CHOICE', False, 'Le prestataire pourra accepter ou proposer une variante dans son devis.'),
    ('SPECIAL', 'Contraintes particulières', 'Existe-t-il une contrainte, un risque ou une attente particulière non couverte par les questions précédentes ?', 'LONG_TEXT', False, 'Ajoutez toute information utile à un devis fiable.'),
]


FOCUS_QUESTION_TEMPLATES = [
    ('F1', 'Spécification métier', 'Décrivez précisément vos exigences concernant « {focus} » pour le service « {service} ».', 'LONG_TEXT', True),
    ('F2', 'État existant', 'Quel est l’état actuel de « {focus} » et quelles difficultés rencontrez-vous ?', 'LONG_TEXT', True),
    ('F3', 'Volumes', 'Quels volumes, fréquences, niveaux ou capacités sont attendus pour « {focus} » ?', 'TABLE', True),
    ('F4', 'Qualité attendue', 'Quels standards, niveaux de qualité ou indicateurs souhaitez-vous appliquer à « {focus} » ?', 'LONG_TEXT', False),
    ('F5', 'Limites', 'Quelles limites, exclusions ou contraintes doivent être prises en compte pour « {focus} » ?', 'LONG_TEXT', False),
]


TYPE_EXTRA_QUESTION_GROUPS = {
    'AUDIT': [
        ('X1', 'Méthode d’audit', 'Souhaitez-vous un audit documentaire, des entretiens, des tests sur site, des échantillonnages ou une combinaison de ces méthodes ?', 'MULTIPLE_CHOICE', True),
        ('X2', 'Référentiel', 'Quel référentiel, norme, politique interne ou niveau de maturité doit servir de base à l’évaluation ?', 'LONG_TEXT', False),
        ('X3', 'Échantillonnage', 'Quels sites, périodes, dossiers, actifs ou populations doivent obligatoirement être inclus dans l’échantillon ?', 'TABLE', True),
        ('X4', 'Restitution', 'Quel niveau de détail attendez-vous dans le rapport, la restitution et le plan d’action ?', 'SINGLE_CHOICE', True),
        ('X5', 'Indépendance', 'Existe-t-il des exigences d’indépendance, de confidentialité ou de qualification des auditeurs ?', 'LONG_TEXT', False),
    ],
    'IMPLEMENTATION': [
        ('X1', 'Environnement cible', 'Dans quel environnement la solution doit-elle être installée ou déployée ?', 'LONG_TEXT', True),
        ('X2', 'Compatibilité', 'Quelles contraintes de compatibilité avec l’existant doivent être respectées ?', 'LONG_TEXT', True),
        ('X3', 'Fenêtre d’intervention', 'Quelles fenêtres d’intervention, interruptions maximales ou périodes interdites faut-il respecter ?', 'TABLE', True),
        ('X4', 'Recette', 'Quels tests de recette, performances ou contrôles doivent être exécutés avant acceptation ?', 'TABLE', True),
        ('X5', 'Exploitation', 'Qui exploitera la solution après livraison et quels accès, manuels ou transferts sont nécessaires ?', 'LONG_TEXT', True),
    ],
    'SOFTWARE': [
        ('X1', 'Utilisateurs et rôles', 'Listez les profils utilisateurs, leurs droits et les actions principales de chacun.', 'TABLE', True),
        ('X2', 'Fonctionnalités prioritaires', 'Classez les fonctionnalités en indispensable, importante et souhaitable.', 'TABLE', True),
        ('X3', 'Intégrations', 'Quelles API, bases, logiciels, moyens de paiement ou services tiers doivent être intégrés ?', 'TABLE', True),
        ('X4', 'Données', 'Quelles données doivent être créées, importées, migrées, conservées ou supprimées ?', 'TABLE', True),
        ('X5', 'Exigences non fonctionnelles', 'Précisez les exigences de performance, disponibilité, sécurité, traçabilité, appareils et navigateurs.', 'LONG_TEXT', True),
    ],
    'CREATIVE': [
        ('X1', 'Audience', 'Décrivez les audiences, personas et réactions recherchées.', 'LONG_TEXT', True),
        ('X2', 'Références créatives', 'Fournissez des références appréciées et refusées, avec les raisons.', 'FILE', False),
        ('X3', 'Identité existante', 'Quels éléments de marque, chartes, logos, contenus ou gabarits doivent être respectés ?', 'FILE', True),
        ('X4', 'Formats de livraison', 'Listez les formats, dimensions, résolutions, variantes et fichiers sources requis.', 'TABLE', True),
        ('X5', 'Droits d’usage', 'Précisez les territoires, durées, médias et droits d’utilisation ou de modification nécessaires.', 'LONG_TEXT', True),
    ],
    'MANAGED': [
        ('X1', 'SLA', 'Quels horaires de service, délais de réponse, délais de résolution et niveaux de priorité sont attendus ?', 'TABLE', True),
        ('X2', 'Volumétrie récurrente', 'Indiquez les volumes mensuels, saisonnalités, pics et croissance prévisible.', 'TABLE', True),
        ('X3', 'Gouvernance', 'Quelle fréquence de comité, reporting et revue de performance souhaitez-vous ?', 'TABLE', True),
        ('X4', 'Escalade', 'Définissez les contacts, niveaux d’escalade et situations nécessitant une alerte immédiate.', 'TABLE', True),
        ('X5', 'Réversibilité', 'Quelles obligations de restitution des données, documents, accès et connaissances sont attendues en fin de contrat ?', 'LONG_TEXT', True),
    ],
    'LEGAL': [
        ('X1', 'Cadre juridique', 'Quels pays, juridictions, autorités ou règles internes sont concernés ?', 'LONG_TEXT', True),
        ('X2', 'Parties', 'Identifiez toutes les parties, bénéficiaires, représentants et relations juridiques concernées.', 'TABLE', True),
        ('X3', 'Historique', 'Décrivez la chronologie, les engagements antérieurs et les documents déjà signés ou échangés.', 'LONG_TEXT', True),
        ('X4', 'Niveau de risque', 'Quels risques, montants, responsabilités ou conséquences souhaitez-vous prioritairement limiter ?', 'LONG_TEXT', True),
        ('X5', 'Validation', 'Qui doit réviser, négocier, approuver et signer le livrable juridique ?', 'TABLE', True),
    ],
    'FINANCE': [
        ('X1', 'Périodes', 'Quelles périodes, entités, devises et référentiels doivent être couverts ?', 'TABLE', True),
        ('X2', 'Volumétrie financière', 'Indiquez les volumes de transactions, factures, comptes, déclarations ou lignes à traiter.', 'TABLE', True),
        ('X3', 'Systèmes sources', 'Quels logiciels, fichiers, banques ou systèmes contiennent les données nécessaires ?', 'TABLE', True),
        ('X4', 'Contrôles', 'Quels contrôles, rapprochements, validations ou pistes d’audit sont obligatoires ?', 'LONG_TEXT', True),
        ('X5', 'Restitution', 'Quels états, analyses, annexes, formats et fréquences de reporting sont attendus ?', 'TABLE', True),
    ],
    'HR': [
        ('X1', 'Population', 'Quelles populations, postes, niveaux, contrats ou établissements sont concernés ?', 'TABLE', True),
        ('X2', 'Politique existante', 'Quelles politiques, pratiques, outils ou accords existent déjà ?', 'LONG_TEXT', True),
        ('X3', 'Données RH', 'Quelles données individuelles ou agrégées seront disponibles et quelles restrictions de confidentialité s’appliquent ?', 'LONG_TEXT', True),
        ('X4', 'Adoption', 'Quels managers, représentants, salariés ou instances doivent être consultés et accompagnés ?', 'TABLE', True),
        ('X5', 'Mesure', 'Quels indicateurs permettront d’évaluer l’efficacité de la prestation RH ?', 'LONG_TEXT', True),
    ],
    'INSURANCE': [
        ('X1', 'Expositions', 'Décrivez les activités, valeurs, personnes, territoires et événements exposés au risque.', 'TABLE', True),
        ('X2', 'Historique sinistres', 'Fournissez l’historique des sinistres, réclamations et mesures correctives disponibles.', 'TABLE', True),
        ('X3', 'Couvertures actuelles', 'Joignez les polices, garanties, plafonds, franchises et exclusions actuellement en vigueur.', 'FILE', True),
        ('X4', 'Couverture cible', 'Quels capitaux, limites, franchises, extensions et niveaux de service recherchez-vous ?', 'TABLE', True),
        ('X5', 'Échéances', 'Quelles dates de renouvellement, obligations contractuelles ou urgences doivent être respectées ?', 'TABLE', True),
    ],
    'PROCUREMENT': [
        ('X1', 'Spécifications', 'Quelles spécifications techniques, fonctionnelles, qualité et conformité doivent être respectées ?', 'LONG_TEXT', True),
        ('X2', 'Volumes et paliers', 'Quels volumes minimum, prévisionnels, maximum et paliers tarifaires sont envisagés ?', 'TABLE', True),
        ('X3', 'Marché fournisseur', 'Quels fournisseurs, pays, marques ou technologies sont imposés, préférés ou exclus ?', 'TABLE', False),
        ('X4', 'Critères de sélection', 'Comment pondérer prix, qualité, délai, capacité, risque, durabilité et service ?', 'TABLE', True),
        ('X5', 'Contrat et logistique', 'Quelles conditions de livraison, paiement, garantie, pénalité et réversibilité sont attendues ?', 'LONG_TEXT', True),
    ],
    'CONSTRUCTION': [
        ('X1', 'État du site', 'Décrivez l’état actuel du terrain, bâtiment, réseaux et accès au chantier.', 'LONG_TEXT', True),
        ('X2', 'Plans et métrés', 'Quels plans, relevés, métrés, études et diagnostics sont disponibles ?', 'FILE', True),
        ('X3', 'Matériaux et finitions', 'Précisez les matériaux, marques, gammes, niveaux de finition et équivalences autorisées.', 'TABLE', True),
        ('X4', 'Phasage chantier', 'Quelles phases, contraintes d’occupation, horaires, coactivités et mesures de sécurité s’appliquent ?', 'TABLE', True),
        ('X5', 'Réception et garanties', 'Quels essais, DOE, garanties, réserves et délais de levée sont exigés ?', 'LONG_TEXT', True),
    ],
    'TRAINING': [
        ('X1', 'Population apprenante', 'Indiquez le nombre de participants, leurs profils, niveaux et prérequis.', 'TABLE', True),
        ('X2', 'Objectifs pédagogiques', 'Quelles compétences observables doivent être acquises à l’issue de la formation ?', 'LONG_TEXT', True),
        ('X3', 'Modalités', 'Quel format, rythme, lieu, langue, durée et calendrier souhaitez-vous ?', 'TABLE', True),
        ('X4', 'Évaluation', 'Quels tests, mises en situation, attestations ou indicateurs d’impact sont attendus ?', 'TABLE', True),
        ('X5', 'Personnalisation', 'Quels cas internes, outils, documents ou scénarios doivent être intégrés aux supports ?', 'LONG_TEXT', False),
    ],
    'RESEARCH': [
        ('X1', 'Population étudiée', 'Définissez les populations, segments, zones et critères d’inclusion de l’étude.', 'TABLE', True),
        ('X2', 'Méthodologie', 'Quelles méthodes qualitatives, quantitatives, documentaires ou terrain sont souhaitées ?', 'MULTIPLE_CHOICE', True),
        ('X3', 'Échantillon', 'Quel niveau de précision, taille d’échantillon et représentativité sont nécessaires ?', 'TABLE', True),
        ('X4', 'Données sources', 'Quelles données internes, bases externes ou accès terrain sont disponibles ?', 'FILE', False),
        ('X5', 'Décisions attendues', 'Quelles décisions concrètes le rapport doit-il permettre de prendre ?', 'LONG_TEXT', True),
    ],
}

TYPE_TO_EXTRA_GROUP = {
    'AUDIT': 'AUDIT', 'RISK_AUDIT': 'AUDIT',
    'IMPLEMENTATION': 'IMPLEMENTATION', 'ENERGY_PROJECT': 'IMPLEMENTATION',
    'SOFTWARE_PROJECT': 'SOFTWARE', 'AI_PROJECT': 'SOFTWARE', 'DATA_PROJECT': 'SOFTWARE', 'CREATIVE_TECH': 'SOFTWARE',
    'CREATIVE': 'CREATIVE', 'CREATIVE_STRATEGY': 'CREATIVE', 'CREATIVE_PRODUCTION': 'CREATIVE', 'CONTENT': 'CREATIVE', 'CONTENT_STRATEGY': 'CREATIVE', 'CAMPAIGN': 'CREATIVE', 'EVENT': 'CREATIVE', 'PRODUCTION': 'CREATIVE',
    'MANAGED_SERVICE': 'MANAGED', 'OUTSOURCING': 'MANAGED', 'CLAIMS_MANAGEMENT': 'MANAGED',
    'LEGAL_ADVISORY': 'LEGAL', 'LEGAL_SERVICE': 'LEGAL', 'COMPLIANCE': 'LEGAL',
    'PROJECT': 'IMPLEMENTATION', 'COMPLIANCE_PROJECT': 'IMPLEMENTATION', 'AUDIT_SUPPORT': 'AUDIT',
    'ADVISORY': 'AUDIT', 'RISK_ADVISORY': 'AUDIT',
    'RECRUITMENT': 'HR', 'SURVEY': 'HR',
    'TRAINING': 'TRAINING',
    'INSURANCE_PLACEMENT': 'INSURANCE',
    'PROCUREMENT': 'PROCUREMENT', 'SOURCING': 'PROCUREMENT',
    'ENGINEERING': 'CONSTRUCTION', 'DESIGN_ENGINEERING': 'CONSTRUCTION', 'PROJECT_MANAGEMENT': 'CONSTRUCTION', 'CONSTRUCTION': 'CONSTRUCTION',
    'RESEARCH': 'RESEARCH',
}


COMMON_RFQ_OPTIONS = {
    'SUPPORT': ['FORMATION', 'TRANSFERT_COMPETENCES', 'SUPPORT', 'MAINTENANCE', 'ACCOMPAGNEMENT', 'AUCUN'],
    'PAYMENT': ['ACOMPTE_SOLDE', 'PAR_JALONS', 'MENSUEL', 'A_LA_LIVRAISON', 'A_NEGOCIER'],
}

TYPE_EXTRA_OPTIONS = {
    ('AUDIT', 'X1'): ['REVUE_DOCUMENTAIRE', 'ENTRETIENS', 'SUR_SITE', 'TESTS', 'ECHANTILLONNAGE'],
    ('RESEARCH', 'X2'): ['ENTRETIENS', 'QUESTIONNAIRE', 'ETUDE_DOCUMENTAIRE', 'OBSERVATION', 'ANALYSE_DONNEES'],
}


LIBRARY_DIAGNOSTIC_COMMON = [
    ('MATURITY', 'Quel est le niveau de formalisation actuel de vos pratiques dans la bibliothèque « {library} » ?', 'SINGLE_CHOICE', ['INEXISTANT', 'INFORMEL', 'PARTIEL', 'FORMALISE', 'MESURE_ET_AMELIORE']),
    ('OWNER', 'Un responsable clairement identifié pilote-t-il ce domaine ?', 'YES_NO', ['YES', 'NO', 'UNKNOWN']),
    ('BUDGET', 'Un budget annuel est-il défini et suivi pour ce domaine ?', 'YES_NO', ['YES', 'NO', 'PARTIAL']),
    ('KPI', 'Disposez-vous d’indicateurs réguliers pour mesurer la performance de ce domaine ?', 'YES_NO', ['YES', 'NO', 'PARTIAL']),
    ('RISKS', 'Les risques majeurs de ce domaine sont-ils identifiés, évalués et suivis ?', 'YES_NO', ['YES', 'NO', 'PARTIAL']),
    ('DOCUMENTATION', 'Les politiques, procédures et responsabilités sont-elles documentées et à jour ?', 'YES_NO', ['YES', 'NO', 'PARTIAL']),
    ('TOOLS', 'Les outils utilisés répondent-ils aux besoins et communiquent-ils correctement entre eux ?', 'SINGLE_CHOICE', ['YES', 'PARTIAL', 'NO', 'UNKNOWN']),
    ('SKILLS', 'Les équipes disposent-elles des compétences et ressources nécessaires ?', 'SINGLE_CHOICE', ['YES', 'PARTIAL', 'NO', 'UNKNOWN']),
    ('INCIDENTS', 'Avez-vous connu des incidents, retards, pertes ou réclamations significatifs dans ce domaine au cours des 12 derniers mois ?', 'YES_NO', ['YES', 'NO']),
    ('PRIORITY', 'Souhaitez-vous faire de ce domaine une priorité d’amélioration dans les 12 prochains mois ?', 'SINGLE_CHOICE', ['HIGH', 'MEDIUM', 'LOW', 'NO']),
]


PROVIDER_COMMON = [
    ('LEGAL', 'Votre entreprise est-elle administrativement active et autorisée à fournir les prestations de cette bibliothèque ?', 'YES_NO'),
    ('INSURANCE', 'Disposez-vous d’une assurance responsabilité professionnelle adaptée aux services proposés ?', 'YES_NO'),
    ('TEAM', 'Décrivez la taille, les rôles et l’expérience de l’équipe affectable à cette bibliothèque.', 'TABLE'),
    ('REFERENCES', 'Fournissez au moins trois références comparables réalisées récemment.', 'TABLE'),
    ('CAPACITY', 'Quelle capacité mensuelle pouvez-vous garantir sans dégrader la qualité ?', 'QUANTITY'),
    ('REGIONS', 'Dans quelles régions pouvez-vous intervenir sur site et à distance ?', 'MULTIPLE_CHOICE'),
    ('SLA', 'Quels délais de réponse, démarrage, correction et support pouvez-vous garantir ?', 'TABLE'),
    ('QUALITY', 'Quel processus de contrôle qualité appliquez-vous avant livraison ?', 'LONG_TEXT'),
    ('SUBCONTRACTING', 'Recourez-vous à de la sous-traitance secondaire et, si oui, comment la contrôlez-vous ?', 'LONG_TEXT'),
    ('SECURITY', 'Comment protégez-vous les informations, documents et accès confiés par les clients ?', 'LONG_TEXT'),
]


def library_rows() -> list[dict[str, Any]]:
    rows = []
    for i, lib in enumerate(LIBRARIES, 1):
        rows.append({
            'code': lib['code'],
            'name_fr': lib['name_fr'],
            'description_fr': lib['description_fr'],
            'order': i,
            'status': 'ACTIVE',
            'version': 1,
            'franchisee_can_edit': True,
            'central_approval_for_sensitive_changes': True,
        })
    return rows


def category_rows() -> list[dict[str, Any]]:
    rows = []
    for lib in LIBRARIES:
        for i, (code, name, subcodes) in enumerate(MACRO_CATEGORY_MAP[lib['code']], 1):
            rows.append({
                'library_code': lib['code'],
                'code': code,
                'name_fr': name,
                'description_fr': f"Grande catégorie {name} de la bibliothèque {lib['name_fr']}.",
                'order': i,
                'status': 'ACTIVE',
                'version': 1,
                'franchisee_can_edit': True,
                'subcategories_json': json.dumps(subcodes, ensure_ascii=False),
            })
    return rows


def subcategory_rows() -> list[dict[str, Any]]:
    rows = []
    for lib in LIBRARIES:
        for i, (code, name) in enumerate(lib['categories'], 1):
            rows.append({
                'library_code': lib['code'],
                'macro_category_code': SUBCATEGORY_TO_MACRO[code],
                'code': code,
                'name_fr': name,
                'description_fr': f"Sous-catégorie {name} de la bibliothèque {lib['name_fr']}.",
                'order': i,
                'status': 'ACTIVE',
                'version': 1,
                'franchisee_can_edit': True,
                'delete_policy': 'ARCHIVE_IF_REFERENCED',
            })
    return rows


def service_rows() -> list[dict[str, Any]]:
    rows = []
    for lib in LIBRARIES:
        for i, (cat, code, name, stype, unit, focus) in enumerate(lib['services'], 1):
            profile = TYPE_PROFILES.get(stype, {'deliverables': 'livrables convenus, documentation et validation', 'proof': 'preuves de réalisation et réception', 'recurring': False})
            svc = Service(
                library_code=lib['code'],
                category_code=cat,
                code=code,
                name_fr=name,
                service_type=stype,
                unit_label_fr=unit,
                focus_terms=focus,
                volume_eligible=stype in {'CREATIVE', 'CONTENT', 'CREATIVE_PRODUCTION', 'PRODUCTION', 'MANAGED_SERVICE', 'OUTSOURCING', 'TRAINING', 'RECRUITMENT', 'IMPLEMENTATION'},
                recurring_eligible=bool(profile.get('recurring')),
                credit_eligible=stype not in {'LEGAL_ADVISORY', 'LEGAL_SERVICE', 'INSURANCE_PLACEMENT'},
                order=i,
            )
            d = asdict(svc)
            d['macro_category_code'] = SUBCATEGORY_TO_MACRO[cat]
            d['subcategory_code'] = cat
            d['secondary_subcategory_codes_json'] = json.dumps(SECONDARY_SERVICE_SUBCATEGORIES.get(code, []), ensure_ascii=False)
            d.update({
                'description_fr': f"Prestation structurée de {name.lower()} comprenant cadrage, exécution, contrôle, documentation et réception.",
                'standard_deliverables_fr': profile['deliverables'],
                'standard_proof_fr': profile['proof'],
                'status': 'ACTIVE',
                'version': 1,
                'franchisee_can_create': True,
                'franchisee_can_edit': True,
                'franchisee_delete_policy': 'ARCHIVE_IF_REFERENCED',
                'central_approval_flags': json.dumps(['FINANCIAL_RULES', 'CONTRACT_CLAUSES', 'LEGAL_TEXT', 'PENALTIES', 'SCORING_BLOCKERS'], ensure_ascii=False),
            })
            d['focus_terms'] = json.dumps(d['focus_terms'], ensure_ascii=False)
            rows.append(d)
    return rows



def service_subcategory_link_rows(services: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for svc in services:
        rows.append({
            'service_code': svc['code'],
            'library_code': svc['library_code'],
            'subcategory_code': svc['subcategory_code'],
            'link_type': 'PRIMARY',
            'status': 'ACTIVE',
        })
        for sub in json.loads(svc['secondary_subcategory_codes_json']):
            rows.append({
                'service_code': svc['code'],
                'library_code': svc['library_code'],
                'subcategory_code': sub,
                'link_type': 'SECONDARY',
                'status': 'ACTIVE',
            })
    return rows


def qrow(**kwargs: Any) -> dict[str, Any]:
    base = {
        'question_id': kwargs.pop('question_id'),
        'template_key': kwargs.pop('template_key', ''),
        'library_code': kwargs.pop('library_code'),
        'category_code': kwargs.pop('category_code', ''),
        'service_code': kwargs.pop('service_code', ''),
        'phase': kwargs.pop('phase'),
        'section': kwargs.pop('section'),
        'order': kwargs.pop('order'),
        'label_fr': kwargs.pop('label_fr'),
        'help_fr': kwargs.pop('help_fr', ''),
        'answer_type': kwargs.pop('answer_type'),
        'required': kwargs.pop('required', False),
        'required_for_quote': kwargs.pop('required_for_quote', False),
        'options_json': json.dumps(kwargs.pop('options', []), ensure_ascii=False),
        'validation_json': json.dumps(kwargs.pop('validation', {}), ensure_ascii=False),
        'condition_json': json.dumps(kwargs.pop('condition', {}), ensure_ascii=False),
        'data_key': kwargs.pop('data_key'),
        'weight': kwargs.pop('weight', 1),
        'max_score': kwargs.pop('max_score', 10),
        'anomaly_code': kwargs.pop('anomaly_code', ''),
        'risk_code': kwargs.pop('risk_code', ''),
        'recommendation_code': kwargs.pop('recommendation_code', ''),
        'opportunity_service_code': kwargs.pop('opportunity_service_code', ''),
        'sensitivity': kwargs.pop('sensitivity', 'BUSINESS'),
        'modifiable_by_franchisee': True,
        'deletion_policy': 'ARCHIVE_IF_REFERENCED',
        'requires_central_approval': kwargs.pop('requires_central_approval', False),
        'status': 'ACTIVE',
        'version': 1,
        'origin': 'MATRICIA_GOLD_MASTER_BASELINE',
    }
    base.update(kwargs)
    return base


def generate_rfq_questions() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for lib in LIBRARIES:
        for cat, scode, sname, stype, unit, focus_terms in lib['services']:
            # 15 universal questions + five service-specific focus questions + five type-specific questions = 25 per service.
            selected_common = COMMON_RFQ_QUESTIONS
            order = 1
            for suffix, section, label, atype, req, help_text in selected_common:
                rows.append(qrow(
                    question_id=f"Q-RFQ-{scode}-{suffix}", template_key=f"RFQ_COMMON_{suffix}", library_code=lib['code'], category_code=cat,
                    service_code=scode, phase='RFQ', section=section, order=order,
                    label_fr=label.format(service=sname, unit=unit), help_fr=help_text,
                    answer_type=atype, required=req, required_for_quote=req,
                    data_key=f"rfq.{slug(scode)}.{suffix.lower()}",
                    options=COMMON_RFQ_OPTIONS.get(suffix, []),
                    validation={'min_length': 10} if atype == 'LONG_TEXT' and req else {},
                ))
                order += 1
            for idx, focus in enumerate(focus_terms[:5]):
                suffix, section, label, atype, req = FOCUS_QUESTION_TEMPLATES[idx]
                rows.append(qrow(
                    question_id=f"Q-RFQ-{scode}-{suffix}", template_key=f"RFQ_FOCUS_{idx+1}", library_code=lib['code'], category_code=cat,
                    service_code=scode, phase='RFQ', section=section, order=order,
                    label_fr=label.format(focus=focus, service=sname),
                    help_fr=f"Cette réponse permet aux sous-traitants de chiffrer correctement la composante « {focus} ».",
                    answer_type=atype, required=req, required_for_quote=req,
                    data_key=f"rfq.{slug(scode)}.focus_{idx+1}",
                    validation={'min_length': 5} if atype == 'LONG_TEXT' and req else {},
                ))
                order += 1
            group = TYPE_TO_EXTRA_GROUP.get(stype, 'AUDIT')
            for suffix, section, label, atype, req in TYPE_EXTRA_QUESTION_GROUPS[group]:
                rows.append(qrow(
                    question_id=f"Q-RFQ-{scode}-{suffix}", template_key=f"RFQ_TYPE_{group}_{suffix}", library_code=lib['code'], category_code=cat,
                    service_code=scode, phase='RFQ', section=section, order=order,
                    label_fr=label,
                    help_fr=f"Question spécialisée pour cadrer et chiffrer correctement le service « {sname} ».",
                    answer_type=atype, required=req, required_for_quote=req,
                    data_key=f"rfq.{slug(scode)}.{suffix.lower()}",
                    options=TYPE_EXTRA_OPTIONS.get((group, suffix), []),
                    validation={'min_length': 5} if atype == 'LONG_TEXT' and req else {},
                ))
                order += 1
    return rows


def generate_diagnostic_questions() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for lib in LIBRARIES:
        # 10 library-level questions.
        for i, (suffix, label, atype, options) in enumerate(LIBRARY_DIAGNOSTIC_COMMON, 1):
            anomaly = f"ANOM-{lib['code']}-BASE-{suffix}"
            risk = f"RISK-{lib['code']}-BASE-{suffix}"
            rec = f"REC-{lib['code']}-BASE-{suffix}"
            rows.append(qrow(
                question_id=f"Q-DIAG-{lib['code']}-BASE-{i:02d}", template_key=f"DIAG_COMMON_{suffix}", library_code=lib['code'], phase='DIAGNOSTIC',
                section='Diagnostic général', order=i, label_fr=label.format(library=lib['name_fr']),
                help_fr='Répondez selon la situation réelle de votre entreprise.', answer_type=atype,
                required=True, data_key=f"diagnostic.{lib['code'].lower()}.base_{suffix.lower()}", options=options,
                weight=2 if suffix in {'RISKS','INCIDENTS','MATURITY'} else 1, anomaly_code=anomaly, risk_code=risk,
                recommendation_code=rec, requires_central_approval=suffix in {'RISKS'},
            ))
        # 3 questions per service = 60, giving exactly 70 per library.
        order = 11
        for cat, scode, sname, stype, unit, focus_terms in lib['services']:
            diag_defs = [
                ('EXISTS', f"Disposez-vous actuellement d’un dispositif ou processus formalisé pour « {sname} » ?", 'SINGLE_CHOICE', ['YES','PARTIAL','NO','UNKNOWN']),
                ('PERFORMANCE', f"Comment évaluez-vous la performance actuelle de « {sname} » ?", 'RATING_5', []),
                ('ISSUES', f"Quels problèmes, retards, incidents ou insatisfactions rencontrez-vous concernant « {sname} » ?", 'LONG_TEXT', []),
            ]
            for suffix, label, atype, options in diag_defs:
                anomaly = f"ANOM-{scode}-{suffix}"
                risk = f"RISK-{scode}-{suffix}"
                rec = f"REC-{scode}-{suffix}"
                rows.append(qrow(
                    question_id=f"Q-DIAG-{scode}-{suffix}", template_key=f"DIAG_SERVICE_{suffix}", library_code=lib['code'], category_code=cat,
                    service_code=scode, phase='DIAGNOSTIC', section='Diagnostic par service', order=order,
                    label_fr=label, help_fr=f"La réponse peut générer une recommandation liée au service « {sname} ».",
                    answer_type=atype, required=(suffix != 'ISSUES'), data_key=f"diagnostic.{slug(scode)}.{suffix.lower()}",
                    options=options, weight=2 if suffix in {'EXISTS','PERFORMANCE'} else 1,
                    anomaly_code=anomaly, risk_code=risk, recommendation_code=rec,
                    opportunity_service_code=scode,
                ))
                order += 1
    return rows


def generate_provider_questions() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for lib in LIBRARIES:
        # 10 common questions.
        order = 1
        for suffix, label, atype in PROVIDER_COMMON:
            rows.append(qrow(
                question_id=f"Q-PROV-{lib['code']}-BASE-{suffix}", template_key=f"PROV_COMMON_{suffix}", library_code=lib['code'], phase='PROVIDER_QUALIFICATION',
                section='Qualification générale', order=order, label_fr=label,
                help_fr=f"Cette information est utilisée pour qualifier le sous-traitant dans la bibliothèque « {lib['name_fr']} ».",
                answer_type=atype, required=True, data_key=f"provider.{lib['code'].lower()}.base_{suffix.lower()}",
                required_for_quote=False, requires_central_approval=suffix in {'LEGAL','INSURANCE','SECURITY'},
            ))
            order += 1
        # One service-specific experience question per service = 20, total 30/library.
        for cat, scode, sname, stype, unit, focus_terms in lib['services']:
            rows.append(qrow(
                question_id=f"Q-PROV-{scode}-EXPERIENCE", template_key="PROV_SERVICE_EXPERIENCE", library_code=lib['code'], category_code=cat,
                service_code=scode, phase='PROVIDER_QUALIFICATION', section='Qualification par service', order=order,
                label_fr=f"Présentez votre expérience, vos références, votre équipe et votre capacité pour le service « {sname} ».",
                help_fr=f"Joignez des preuves et indiquez le volume maximal que vous pouvez réaliser en {unit}.",
                answer_type='TABLE', required=True, data_key=f"provider.{slug(scode)}.experience_capacity",
            ))
            order += 1
    return rows


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    fields: list[str] = []
    seen = set()
    for row in rows:
        for k in row:
            if k not in seen:
                seen.add(k)
                fields.append(k)
    with path.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    with path.open('w', encoding='utf-8') as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + '\n')


def validate(libs, cats, svcs, rfq, diag, prov) -> list[str]:
    errors: list[str] = []
    if len(libs) != 10:
        errors.append(f'Expected 10 libraries, got {len(libs)}')
    if len(svcs) != 200:
        errors.append(f'Expected 200 services, got {len(svcs)}')
    if len(rfq) != 5000:
        errors.append(f'Expected 5000 RFQ questions, got {len(rfq)}')
    if len(diag) != 700:
        errors.append(f'Expected 700 diagnostic questions, got {len(diag)}')
    if len(prov) != 300:
        errors.append(f'Expected 300 provider questions, got {len(prov)}')
    all_ids = [r['question_id'] for r in [*rfq, *diag, *prov]]
    dups = [k for k, c in Counter(all_ids).items() if c > 1]
    if dups:
        errors.append(f'Duplicate question IDs: {dups[:10]}')
    svc_codes = {s['code'] for s in svcs}
    for row in [*rfq, *diag, *prov]:
        if row['service_code'] and row['service_code'] not in svc_codes:
            errors.append(f"Question {row['question_id']} points to unknown service {row['service_code']}")
    if any('TO_DEFINE' in json.dumps(r, ensure_ascii=False) for r in [*rfq, *diag, *prov]):
        errors.append('TO_DEFINE placeholder detected')
    return errors


def build_readme(counts: dict[str, int]) -> str:
    return f"""# Catalogue métier Matricia V1 — base Gold Master

Ce dossier remplace l'exigence vague « créer au moins 900 questions » par une base déterministe et importable.

## Contenu validé

- Bibliothèques : **{counts['libraries']}**
- Grandes catégories : **{counts['categories']}**
- Sous-catégories : **{counts['subcategories']}**
- Services actifs : **{counts['services']}**
- Questions de cadrage RFQ/devis : **{counts['rfq_questions']}**
- Questions de diagnostic : **{counts['diagnostic_questions']}**
- Questions de qualification sous-traitant : **{counts['provider_questions']}**
- Total questions : **{counts['total_questions']}**

Chaque service contient exactement 25 questions de cadrage pour rendre une demande chiffrable. Chaque bibliothèque contient 70 questions de diagnostic et 30 questions de qualification fournisseur.

## Gouvernance franchisé

Le franchisé peut :

- créer, dupliquer, modifier, réordonner, désactiver ou archiver une question ;
- créer, modifier, déplacer, désactiver ou archiver un service ;
- ajouter ou retirer des catégories ;
- importer/exporter CSV/JSON ;
- prévisualiser et simuler un questionnaire ;
- publier une nouvelle version selon ses permissions.

Une question ou un service déjà utilisé n'est jamais supprimé physiquement : il est archivé et sa version historique reste attachée aux diagnostics, demandes, devis et contrats existants. Les changements financiers, juridiques, bloquants ou contractuels exigent une approbation centrale Matricia.

## Fichiers

- `libraries.csv`
- `categories.csv`
- `subcategories.csv`
- `services.csv`
- `service_subcategory_links.csv`
- `questions_rfq.csv`
- `questions_diagnostic.csv`
- `questions_provider_qualification.csv`
- `questions_all.jsonl`
- `catalog_manifest.json`
- `optional_library_operations.json` (bibliothèque supplémentaire proposée mais non activée dans les dix de base)

## Important

Cette base est très étendue, mais aucun catalogue fini ne peut anticiper toutes les variantes futures de chaque métier. Le moteur CRUD/versionné est donc obligatoire. Avant production, les contenus juridiques, fiscaux, assurance, HSE et réglementaires doivent être revus par les experts du domaine concerné.
"""


def main() -> None:
    libs = library_rows()
    cats = category_rows()
    subcats = subcategory_rows()
    svcs = service_rows()
    svc_links = service_subcategory_link_rows(svcs)
    rfq = generate_rfq_questions()
    diag = generate_diagnostic_questions()
    prov = generate_provider_questions()
    errors = validate(libs, cats, svcs, rfq, diag, prov)
    if len(subcats) != 80:
        errors.append(f'Expected 80 subcategories, got {len(subcats)}')
    if errors:
        raise SystemExit('\n'.join(errors))

    write_csv(OUT / 'libraries.csv', libs)
    write_csv(OUT / 'categories.csv', cats)
    write_csv(OUT / 'subcategories.csv', subcats)
    write_csv(OUT / 'services.csv', svcs)
    write_csv(OUT / 'service_subcategory_links.csv', svc_links)
    write_csv(OUT / 'questions_rfq.csv', rfq)
    write_csv(OUT / 'questions_diagnostic.csv', diag)
    write_csv(OUT / 'questions_provider_qualification.csv', prov)
    write_jsonl(OUT / 'questions_all.jsonl', [*rfq, *diag, *prov])
    (OUT / 'optional_library_operations.json').write_text(json.dumps(OPTIONAL_LIBRARY, ensure_ascii=False, indent=2), encoding='utf-8')

    counts = {
        'libraries': len(libs),
        'categories': len(cats),
        'subcategories': len(subcats),
        'services': len(svcs),
        'service_subcategory_links': len(svc_links),
        'rfq_questions': len(rfq),
        'diagnostic_questions': len(diag),
        'provider_questions': len(prov),
        'total_questions': len(rfq) + len(diag) + len(prov),
    }
    by_library: dict[str, dict[str, int]] = {}
    for lib in libs:
        code = lib['code']
        by_library[code] = {
            'categories': sum(1 for x in cats if x['library_code'] == code),
            'subcategories': sum(1 for x in subcats if x['library_code'] == code),
            'services': sum(1 for x in svcs if x['library_code'] == code),
            'rfq_questions': sum(1 for x in rfq if x['library_code'] == code),
            'diagnostic_questions': sum(1 for x in diag if x['library_code'] == code),
            'provider_questions': sum(1 for x in prov if x['library_code'] == code),
        }
    manifest = {
        'catalog_version': '1.0.0',
        'generated_by': 'Matricia Gold Master baseline generator',
        'counts': counts,
        'by_library': by_library,
        'rules': {
            'franchisee_service_crud': True,
            'franchisee_question_crud': True,
            'delete_semantics': 'SOFT_DELETE_ARCHIVE_IF_REFERENCED',
            'versioning_required': True,
            'central_approval_for_sensitive_changes': True,
            'arabic_translation_required_before_production': True,
        },
    }
    (OUT / 'catalog_manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / 'README.md').write_text(build_readme(counts), encoding='utf-8')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()

```

## MANIFESTE DE RÉFÉRENCE

```json
{
  "catalog_version": "1.0.0",
  "generated_by": "Matricia Gold Master baseline generator",
  "counts": {
    "libraries": 10,
    "categories": 40,
    "subcategories": 80,
    "services": 200,
    "service_subcategory_links": 212,
    "rfq_questions": 5000,
    "diagnostic_questions": 700,
    "provider_questions": 300,
    "total_questions": 6000
  },
  "by_library": {
    "IT": {
      "categories": 4,
      "subcategories": 8,
      "services": 20,
      "rfq_questions": 500,
      "diagnostic_questions": 70,
      "provider_questions": 30
    },
    "COM": {
      "categories": 4,
      "subcategories": 8,
      "services": 20,
      "rfq_questions": 500,
      "diagnostic_questions": 70,
      "provider_questions": 30
    },
    "ACC": {
      "categories": 4,
      "subcategories": 8,
      "services": 20,
      "rfq_questions": 500,
      "diagnostic_questions": 70,
      "provider_questions": 30
    },
    "LEGAL": {
      "categories": 4,
      "subcategories": 8,
      "services": 20,
      "rfq_questions": 500,
      "diagnostic_questions": 70,
      "provider_questions": 30
    },
    "HR": {
      "categories": 4,
      "subcategories": 8,
      "services": 20,
      "rfq_questions": 500,
      "diagnostic_questions": 70,
      "provider_questions": 30
    },
    "INS": {
      "categories": 4,
      "subcategories": 8,
      "services": 20,
      "rfq_questions": 500,
      "diagnostic_questions": 70,
      "provider_questions": 30
    },
    "LOG": {
      "categories": 4,
      "subcategories": 8,
      "services": 20,
      "rfq_questions": 500,
      "diagnostic_questions": 70,
      "provider_questions": 30
    },
    "BTP": {
      "categories": 4,
      "subcategories": 8,
      "services": 20,
      "rfq_questions": 500,
      "diagnostic_questions": 70,
      "provider_questions": 30
    },
    "QHSE": {
      "categories": 4,
      "subcategories": 8,
      "services": 20,
      "rfq_questions": 500,
      "diagnostic_questions": 70,
      "provider_questions": 30
    },
    "SALES": {
      "categories": 4,
      "subcategories": 8,
      "services": 20,
      "rfq_questions": 500,
      "diagnostic_questions": 70,
      "provider_questions": 30
    }
  },
  "rules": {
    "franchisee_service_crud": true,
    "franchisee_question_crud": true,
    "delete_semantics": "SOFT_DELETE_ARCHIVE_IF_REFERENCED",
    "versioning_required": true,
    "central_approval_for_sensitive_changes": true,
    "arabic_translation_required_before_production": true
  }
}
```

---

# ADDENDUM OBLIGATOIRE V1 — MATRICIA MARKETING AUTOPILOT

## Statut
Ce module fait désormais partie du périmètre V1 obligatoire. Il doit être construit comme un moteur marketing automatisé à faible intervention humaine. L'objectif n'est pas de reproduire une agence média complète mais de fournir huit fonctions à très fort impact, directement reliées au catalogue, aux diagnostics, aux anomalies, aux services, aux sous-traitants, aux franchisés et aux conversions Matricia.

## Principe d'autonomie
Après configuration initiale du Brand Kit et consentement explicite de connexion/publication, le système doit pouvoir fonctionner en mode `AUTOPILOT` avec intervention humaine minimale.

Modes :
- `MANUAL`: génération uniquement, publication manuelle.
- `ASSISTED`: génération + programmation, validation humaine requise.
- `AUTOPILOT`: génération + contrôles + programmation + publication automatique des contenus à faible risque selon politique approuvée.

Le mode par défaut lors de la première connexion doit être `ASSISTED`. Le propriétaire du compte peut activer `AUTOPILOT` une fois les comptes sociaux connectés et les règles de marque validées.

Aucun contenu ne doit être auto-publié s'il contient une allégation non vérifiée, un prix non approuvé, une certification expirée, une donnée personnelle/client, une promesse réglementaire ou une exception détectée.

## MARKETING-001 — Brand Kit automatisé

### Objectif
Créer une source unique de vérité de marque pour chaque sous-traitant, franchisé et Matricia central.

### Écran
`Marketing > Brand Kit`

### Champs
- raison sociale / nom commercial
- logo principal
- logo secondaire / monochrome
- couleurs principales et secondaires
- police préférée ou famille typographique autorisée
- slogan
- proposition de valeur
- ton : professionnel, premium, technique, pédagogique, dynamique, commercial, sobre
- langues : FR / AR / EN optionnel
- secteurs et services prioritaires
- zones géographiques
- CTA principal
- URL Matricia trackée
- photos autorisées
- vidéos autorisées
- certifications/agréments utilisables en marketing avec dates de validité
- mentions obligatoires/interdites
- mots/expressions interdits
- hashtags approuvés

### Automatisation
Le système doit préremplir le Brand Kit avec les données déjà présentes dans le Passeport Matricia, le profil sous-traitant et la bibliothèque. L'utilisateur ne renseigne que les éléments absents.

### Tables
`brand_kits`, `brand_assets`, `brand_claims`, `brand_restrictions`, `brand_kit_versions`.

### Règles
- aucune publication sans Brand Kit au moins `READY`;
- toute certification utilisée doit être `VALID` à la date de publication;
- toute modification publiée est versionnée.

## MARKETING-002 — Générateur automatique 1 service = 3 contenus

### Objectif
À partir d'un service, d'une anomalie, d'une opportunité, d'un badge ou d'une réussite, générer automatiquement :
1. un post LinkedIn B2B;
2. un post Facebook/Instagram;
3. un script Reel vertical 20–30 secondes.

### Sources autorisées
- catalogue de services;
- réponses et statistiques agrégées/anonymisées;
- anomalies fréquentes;
- recommandations;
- données de profil du fournisseur;
- badges/performance vérifiée;
- offres/promotions actives;
- Brand Kit.

### Sortie structurée
Chaque contenu doit avoir :
- titre interne;
- hook;
- corps;
- CTA;
- hashtags;
- langue;
- cible;
- service_id;
- library_id;
- provider_id/franchise_id;
- landing_url trackée;
- claims utilisés;
- score de risque;
- date d'expiration si contenu lié à une promotion/certification.

### Tables
`marketing_content`, `marketing_content_versions`, `marketing_content_sources`.

### Règle d'autonomie
Le moteur doit générer des lots de contenu sans demande manuelle individuelle. Une tâche hebdomadaire peut produire automatiquement le lot de la semaine pour chaque compte en mode `AUTOPILOT`.

## MARKETING-003 — Templates commerciaux standardisés

### Templates V1 obligatoires
1. `PROBLEM_SOLUTION`
2. `EXPERT_TIP`
3. `PROVIDER_INTRO`
4. `BEFORE_AFTER`
5. `SERVICE_OF_MONTH`
6. `SUCCESS_CASE`

### Chaque template doit définir
- structure du hook;
- structure du corps;
- nombre de caractères cible par réseau;
- médias requis;
- CTA autorisés;
- claims interdits;
- règles de traduction;
- règles de répétition;
- fréquence maximale.

### Gestion
Les franchisés peuvent proposer/adapter les templates de leur bibliothèque. Matricia central garde les règles de conformité et peut verrouiller des portions du template.

### Tables
`marketing_templates`, `marketing_template_versions`, `marketing_template_library_links`.

## MARKETING-004 — Calendrier mensuel automatique

### Objectif
Créer automatiquement un calendrier de contenu à partir des services prioritaires, anomalies, opportunités et performances.

### Valeurs initiales configurables
Par mois et par compte :
- 8 posts LinkedIn/Facebook/Instagram;
- 4 Reels/scripts;
- jours et heures suggérés;
- alternance de templates;
- limite de répétition d'un même service.

### États
`DRAFT`, `GENERATED`, `VALIDATED_BY_RULES`, `SCHEDULED`, `PUBLISHED`, `FAILED`, `SKIPPED`.

### Automatisation
Le 25 de chaque mois, générer le calendrier du mois suivant pour les comptes actifs.

En mode `AUTOPILOT`, si tous les contenus passent les contrôles et qu'aucune exception n'existe, ils sont automatiquement programmés.

En mode `ASSISTED`, une seule approbation globale du calendrier est proposée au propriétaire au lieu d'approuver chaque publication une par une.

### Tables
`marketing_calendars`, `marketing_calendar_items`, `marketing_schedule_rules`.

## MARKETING-005 — Publication sociale automatisée contrôlée

### Objectif
Connecter les comptes sociaux compatibles et publier/programmer le contenu sans travail manuel répétitif.

### Architecture
Créer une abstraction `social_provider` avec adaptateurs :
- LinkedIn;
- Meta (Facebook/Instagram);
- autres providers futurs sans modification du coeur métier.

### Tables
`social_connections`, `social_accounts`, `social_publication_jobs`, `social_publication_results`.

### Règles de sécurité
- OAuth/credentials chiffrés côté serveur;
- permissions minimales;
- révocation possible;
- retry idempotent;
- aucune double publication;
- audit de chaque tentative.

### Autopilot
Le système publie automatiquement uniquement si :
`brand_check = PASS`
`claims_check = PASS`
`privacy_check = PASS`
`certification_check = PASS`
`promotion_check = PASS`
`risk_score <= configured_threshold`
`social_connection = ACTIVE`
`autopilot_enabled = true`.

Sinon : créer `MARKETING_EXCEPTION` et ne pas publier.

## MARKETING-006 — Tracking automatique CTA → lead → devis → contrat

### Objectif
Chaque contenu doit être relié au pipeline commercial Matricia.

### Chaque lien publicitaire doit inclure
- `campaign_id`
- `content_id`
- `provider_id` ou `franchise_id`
- `library_id`
- `service_id`
- source/réseau
- medium
- UTM normalisées

### Événements
`CONTENT_VIEWED` si disponible via provider;
`CTA_CLICKED`;
`LANDING_VIEWED`;
`REGISTRATION_STARTED`;
`DIAGNOSTIC_STARTED`;
`OPPORTUNITY_CREATED`;
`RFQ_STARTED`;
`CONTRACT_SIGNED`.

### Table
`marketing_attribution_events`, `marketing_leads`, `marketing_conversion_paths`.

### Attribution V1
Utiliser une attribution configurable, default `LAST_NON_DIRECT_CLICK`, tout en conservant tout le chemin multi-touch.

### Dashboard
Afficher par campagne : impressions/vues si disponibles, clics, leads, diagnostics, RFQ, contrats et valeur économique attribuée.

## MARKETING-007 — Campagnes générées à partir des anomalies réelles

### Objectif
Transformer automatiquement les anomalies fréquentes et besoins réels observés dans Matricia en campagnes pertinentes.

### Processus hebdomadaire
1. agréger les anomalies par bibliothèque, secteur, taille et région;
2. appliquer seuil de confidentialité/k-anonymity configurable;
3. détecter les thèmes en croissance;
4. créer une `campaign_suggestion`;
5. sélectionner les services correspondants;
6. générer les contenus via les templates;
7. programmer en mode AUTOPILOT si politique l'autorise.

### Exemple
`ABSENCE_BACKUP` fréquente → campagne pédagogique sauvegarde → CTA diagnostic → service `IT_BACKUP`.

### Règles
- jamais exposer l'identité d'un client;
- jamais publier une statistique issue d'un groupe trop petit;
- toute statistique publiée doit avoir une source agrégée et un snapshot.

### Tables
`marketing_trend_snapshots`, `campaign_suggestions`, `marketing_campaigns`, `marketing_campaign_targets`.

## MARKETING-008 — Dashboard performance minimal et actionnable

### KPIs V1 obligatoires
- contenus générés;
- contenus publiés;
- publications échouées;
- impressions/vues si provider disponible;
- clics;
- leads;
- diagnostics démarrés;
- opportunités créées;
- demandes de devis;
- contrats signés;
- revenu/valeur attribuée lorsque calculable;
- coût marketing si connu.

### Vues
- par fournisseur;
- par franchisé;
- par bibliothèque;
- par service;
- par réseau;
- par campagne;
- par période.

### Action automatique
Chaque semaine, le système doit produire une courte recommandation :
- `KEEP`
- `INCREASE_FREQUENCY`
- `REDUCE_FREQUENCY`
- `CHANGE_TEMPLATE`
- `CHANGE_SERVICE_FOCUS`
- `PAUSE_CAMPAIGN`

L'autopilot peut appliquer automatiquement les ajustements de fréquence et rotation de templates à faible risque. Les changements de budget publicitaire payant restent hors périmètre V1 et nécessitent une future phase.

## Moteur de conformité marketing obligatoire

Créer un pipeline avant publication :
`GENERATE → SOURCE_CHECK → BRAND_CHECK → CLAIMS_CHECK → PRIVACY_CHECK → CERTIFICATION_CHECK → DUPLICATE_CHECK → RISK_SCORE → SCHEDULE/PUBLISH`.

### Contrôles
- aucun nom/client sans consentement;
- aucun chiffre non traçable;
- aucune certification expirée;
- aucune promotion expirée;
- aucun prix non validé;
- aucune promesse de résultat absolu;
- aucune donnée privée;
- détection de répétition excessive;
- contenu compatible FR/AR et RTL si applicable.

## Gestion des exceptions marketing

Créer `marketing_exceptions` avec :
- type;
- content_id;
- severity;
- reason;
- automatic_resolution_possible;
- status;
- assigned_to;
- resolution.

En mode AUTOPILOT, le système doit continuer à publier les autres contenus valides et n'envoyer à l'humain que les exceptions bloquées.

## Agents Codex supplémentaires obligatoires

Ajouter aux agents du projet :
- `marketing-automation-agent`: implémentation du moteur;
- `marketing-content-agent`: templates et génération;
- `marketing-compliance-agent`: contrôle claims/privacy/certifications;
- `social-integration-agent`: connecteurs sociaux et idempotence;
- `marketing-analytics-agent`: attribution et dashboard;
- `marketing-autopilot-auditor`: audit indépendant des règles automatiques.

Ils doivent travailler en parallèle sur des périmètres de fichiers distincts sous supervision de l'intégrateur.

## Données de démonstration marketing

Créer au minimum :
- 10 Brand Kits, un par bibliothèque/franchise;
- 20 Brand Kits sous-traitants;
- 50 campagnes démo;
- 300 contenus générés;
- 100 éléments programmés;
- événements de clic/lead/diagnostic/RFQ/contrat;
- cas de publication réussie, échouée, bloquée pour claim, certification expirée et donnée privée;
- dashboards remplis avec données cohérentes.

## Tests obligatoires

- génération déterministe de structure;
- respect du Brand Kit;
- non-publication si certification expirée;
- non-publication si claim non vérifié;
- non-publication si donnée personnelle détectée;
- absence de double publication après retry;
- attribution CTA correcte;
- isolation RLS entre franchises/fournisseurs;
- calendrier généré automatiquement;
- autopilot programme uniquement les contenus PASS;
- FR/AR;
- responsive mobile;
- audit logs;
- failover provider social simulé.

## Critère de complétude

Le module Marketing Autopilot n'est pas considéré terminé tant que :
- les 8 fonctions sont développées;
- le mode AUTOPILOT fonctionne en environnement demo;
- les contrôles empêchent toute publication à risque;
- le calendrier mensuel est généré sans intervention humaine;
- les contenus peuvent être programmés et publiés via adaptateur réel ou mock contractuel;
- chaque CTA est traçable jusqu'au pipeline Matricia;
- les dashboards ont des données de démonstration;
- tous les tests obligatoires sont verts;
- aucun TODO/FIXME/placeholder V1 n'existe dans ce module.


============================================================
MATRICIA DESIGN AUTHORITY — VERSION A
============================================================
The official and mandatory visual direction for Matricia V1 is VERSION A — MODERNE & PROFESSIONNELLE.
Use clean white/light-neutral backgrounds, deep Matricia navy, vivid professional blue accents, generous whitespace, clean grids, subtle borders/shadows, refined cards, thin modern icons, strong hierarchy and maximum clarity. Avoid excessive gradients, glassmorphism, neon, clutter, generic AI-purple styling and decorative effects that reduce readability.
Apply one shared Design System to Public, Client, Sous-traitant, Franchisé and Administration. Responsive desktop/tablet/mobile, critical flows usable at 360px, native Arabic RTL, accessible labels/focus/contrast, and status conveyed by text + icon + color. No page is complete until Design QA validates Version A consistency, responsive behavior, FR/AR RTL, accessibility and absence of placeholder UI.
