# Revue indépendante — product

Source : agent en worktree isolé au commit b578c75c. Texte de revue conservé comme preuve ; voir FINDINGS.md pour la consolidation, la gravité et les limites actualisées.

Created isolated worktree for branch `agents/independent-audit-matricia-report`

Je vais examiner le registre V1, les routes et les parcours inter-acteurs en lecture seule, puis relier les 68 exigences aux fichiers et tests disponibles. Je distinguerai les constats confirmés, les déclarations documentaires et les preuves manquantes, en signalant la limite des deux modifications staged du coordinateur.

J’applique les skills d’audit indépendant, d’invariants métier et de qualité Matricia. Le worktree est propre et pointe exactement sur le HEAD demandé ; les deux modifications staged annoncées ne sont donc pas incluses dans cette revue.

L’inventaire trouve 222 fichiers de pages et 70 handlers HTTP, avec des routes dynamiques qui couvrent plusieurs écrans métier. Le registre de traçabilité contient bien 68 lignes V1, mais seulement 5 portent le statut documentaire « VERIFIED ». Je vérifie les transitions réelles derrière les pages, en particulier celles des overlays de démonstration, qui ne prouvent pas une persistance métier.

Deux incohérences sont confirmées dans les sources : sous flag démo, la liste des demandes client remplace les résultats persistés par des cartes dont plusieurs liens reviennent à la liste ; la file des candidatures franchise affiche aussi des identifiants synthétiques face à des actions prévues pour la base. Je vérifie leurs conséquences exactes et le traitement des besoins sans service identifié. Les dépendances ne sont pas installées ici ; je peux exécuter les contrôles Node en lecture seule, mais pas les tests de l’application.

Les contrôles locaux confirment trois limites précises : aucun des cinq liens de demandes démo n’ouvre une fiche demande ; un code de service absent de la projection embarquée est rejeté par le helper de classification ; avec 1 200 caractères de contraintes, une réponse pourtant saisie est supprimée de la charge sauvegardée. Le registre atomique ne décrit par ailleurs que deux écrans : son existence ne suffit pas à établir une couverture des parcours.

La cartographie des 68 fonctions est prête. Les sources couvrent les quatre espaces et la chaîne demande → consultation → devis → contrat → mission, mais aucune exécution de cette chaîne n’a été établie dans cette revue. Les écarts les plus importants touchent l’entrée commerciale et la fiabilité du film démo ; je les sépare des preuves runtime manquantes et des résultats historiques déclarés dans la documentation.

**La couverture structurelle est étendue, mais la conformité V1 complète n’est pas démontrée sur ce HEAD.** L’examen confirme cinq incohérences de parcours et un écart de spécification. Aucun score global ni PASS runtime de l’application n’est attribué.

Base vérifiée : `b578c75c1c0f076c7fb46b0239d7ab5f2b0afc4c`. Worktree propre avant et après audit ; aucune écriture effectuée. Les modifications staged du coordinateur dans [demo-franchise-applications.ts][demo-applications] et [franchise/data/crm/repository.ts][crm] sont absentes : les conclusions concernant ces fichiers devront être confrontées à son diff.

Autorité utilisée : [Gold Master, registre 31 bis][gold31], annexe §28 et sections ciblées sur les acteurs, parcours, démonstrations et modèle économique. Les documents de [refonte][refonte] et [PROJECT_STATE.md][state] ont été traités comme des déclarations.

**Inventaire des routes et capacités**

222 fichiers de pages et 70 handlers HTTP sont présents. Ce décompte porte sur les fichiers sources : les paramètres, locales et routes génériques produisent davantage d’URL.

| Famille | Pages | Capacités et routes principales |
|---|---:|---|
| Public | 18 | Accueil, diagnostic/résultat, besoin, fournisseur, entreprises, services et guide par code, franchise, abonnements, contact, pages légales |
| Partagé | 20 | Connexion, organisations/rôles/rattachements, invitations, sécurité, actions, messagerie, notifications, confidentialité, catalogue connecté |
| Client | 39 | Onboarding, diagnostics/questionnaires, demandes/offres/comparaison/récurrence, contrats, missions/jalons, litiges, portefeuille, documents, abonnement/Boxes/crédits/avantages/finances |
| Sous-traitant | 37 | Identité, société, qualification/services/certifications, consultations, devis/révisions, contrats, missions, documents, messages, litiges, facturation, réputation, planning, mode Client |
| Franchise | 37 | Candidature/invitation, bibliothèque/services/questions/questionnaires/règles, réseau, validations, demandes, qualité/performance, relances/digest, gouvernance/périmètre, documents, finance |
| Administration | 71 | Acteurs, conformité, candidatures/mandats, parcours, catalogue, finance, confidentialité, opérations, marketing, exceptions, anti-abus |

La navigation reconnaît les quatre espaces et les rôles cumulables dans [workspace-navigation.ts][navigation]. Les routes génériques sont délimitées par les [17 espaces admin][admin-nav] et les résolveurs de vues [Sous-traitant][provider-views] et [Franchise][franchise-views]. **Une URL reconnue ne prouve toutefois ni son alimentation persistée ni l’exécution de ses actions.**

**Constats confirmés**

1. **Élevée — Un besoin enregistré sans service précis n’a pas de reprise exploitable dans le parcours proposé.**  
   Dans [apps/web/modules/public/ui/journey/need-flow.tsx:727][need727], un succès efface le brouillon local ; la redirection vers une nouvelle demande dépend d’un `serviceCode`. Sans code, [la suite proposée:942][need942] mène à la liste des demandes. Celle-ci charge les demandes métier, tandis que l’enregistrement crée un intake `DRAFT_REVIEW` dans [20260915020200_public_need_intake.sql:65][intake65]. Le lecteur de reprise exige ensuite un code de service dans [need-context.ts:108][need-context108].  
   **Reproduction :** confirmer un besoin « Sans service précis », l’enregistrer avec une organisation Client, suivre « Voir mes demandes » : aucune conversion n’est créée par cette branche ; aucune liste de reprise des intakes n’a été retrouvée dans les routes examinées.  
   **Impact :** rupture de l’entrée commerciale pour les besoins non classés. **Exigences :** MAT-FUNC-008, §17.1 et refonte sans catalogue. **Recommandation/test :** exposer une reprise durable et une qualification humaine ; tester sauvegarde → rechargement → qualification → demande en FR/AR.

2. **Moyenne — Un nouveau service publié reste exclu de l’assistant s’il manque dans la projection embarquée.**  
   [apps/web/modules/public/data/need-intent/model.ts:20][need-model20] construit la liste admissible depuis le JSON embarqué ; [la classification:52][need-model52] rejette tout code absent. Les candidats pourtant lus depuis les versions publiées en base sont filtrés par ce même helper dans [besoin/actions.ts:193][need-actions193].  
   **Preuve locale exécutée :** `IT-AUDIT-SI` est accepté ; `IT-AUDIT-NEW-V1` retourne `null`. Ce second cas reproduit le comportement d’un code ajouté après génération de la projection ; il ne prétend pas qu’un tel service existe actuellement en base distante.  
   **Impact :** publier un service depuis l’espace métier ne suffit pas à le rendre découvrable. **Exigences :** MAT-FUNC-008, §13 et obligation d’ajout/publication par le franchisé. **Recommandation/test :** aligner découverte et validation sur les publications courantes ; tester un nouveau code sans reconstruction du frontend.

3. **Moyenne, démo/staging — La liste des demandes masque les objets persistés et comporte des liens circulaires.**  
   [apps/web/modules/client/screens/spaces/boards.tsx:364][boards364] remplace systématiquement `rows` par `demo.requests` lorsque le flag démo est actif, alors que [la page:26][requests26] a chargé des demandes réelles et calculé leur pagination.  
   **Preuve locale exécutée :** cinq lignes démo, trois liens vers la liste elle-même, aucun lien vers une fiche demande. Le gate dépend de l’environnement et du flag, sans sélection de l’organisation dans [demo-scenario.ts:8][demo-gate].  
   **Impact :** filtres, total, pagination et contenu peuvent représenter des populations différentes ; « Ouvrir » ne permet pas de suivre le dossier affiché. **Exigences :** §23, §25.2, MAT-FUNC-008/056 et absence de workflow fictif. **Recommandation/test :** utiliser des fixtures persistées avec leurs identifiants ; vérifier liste → fiche → offres sur le même dossier, flag activé.

4. **Moyenne, démo — La candidature affichée `CONTRACT_PENDING` ne peut pas être approuvée depuis sa carte.**  
   [apps/web/app/[locale]/administration/candidatures-franchise/page.tsx:129][applications129] remplace la file persistée par les dossiers synthétiques. Sous ce flag, [les chargements d’approbations et invitations:147][applications147] retournent explicitement des tableaux vides. Or [review-forms.tsx:92][review92] ne rend l’approbation qu’en présence des deux objets.  
   **Reproduction statique déterministe :** flag actif → dossier synthétique `CONTRACT_PENDING` → `approval=null`, `invitationId=null` → aucun formulaire d’approbation. Les autres commandes de revue appellent bien des RPC persistés ; elles ne constituent pas un moteur d’overlay.  
   **Impact :** le film d’onboarding franchise s’arrête avant l’activation. **Exigences :** §16.2, §23, parcours réseau MAT-FUNC-036/037. **Recommandation/test :** fixture complète candidature → mandat → approbation → invitation → activation. **Limite :** réévaluer avec la modification staged du coordinateur.

5. **Moyenne — Des réponses déjà recueillies sont supprimées silencieusement lors de la sauvegarde du besoin.**  
   [apps/web/modules/public/ui/journey/need-flow.tsx:745][need745] concatène contraintes, tags et réponses puis tronque l’ensemble à 1 200 caractères. La classification est encore ajoutée puis retronquée dans [besoin/actions.ts:113][need-actions113]. La conversion tente pourtant de réutiliser ces réponses via [parse_need_intake_answers:8][parse8].  
   **Preuve locale exécutée sur l’expression source :** contraintes de 1 200 caractères + réponse `site.count: 3` → longueur sauvegardée 1 200 ; réponse absente.  
   **Impact :** ressaisie ou contexte incomplet après un enregistrement annoncé réussi. **Exigences :** MAT-FUNC-008/055/057, §17.1. **Recommandation/test :** conserver séparément les réponses structurées ; tester les tailles limites, plusieurs réponses et la conservation intégrale après conversion.

6. **Moyenne — Le registre atomique ne cartographie pas les capacités livrées.**  
   [docs/specs/registries/screens.yaml:3][screens3] ne contient que deux écrans, le [registre des formulaires][forms] un formulaire et celui des [API][apis] deux opérations. Cela ne satisfait pas le contrat par écran imposé au [§7.1:607][gold607].  
   **Preuve reproductible :** compter `screen_id`, `form_id`, `api_id` dans ces trois registres : **2 / 1 / 2**, face aux 222 fichiers de pages et aux routes génériques. Le validateur annonce lui-même une initialisation cohérente et maintient P01 ouverte.  
   **Impact :** impossible d’utiliser ces registres comme preuve exhaustive des entrées, actions, transitions et tests. **Exigences :** §7 et registre 31 bis. **Recommandation/test :** réconcilier routes, capacités, contrats et preuves ; contrôler les éléments non référencés dans les deux sens. Ce constat documentaire ne signifie pas que les capacités non décrites sont absentes du code.

**Parcours inter-acteurs**

| Chaîne | Conclusion de cette revue |
|---|---|
| Public → besoin → OTP → intake → demande | Raccordement présent lorsque le service est identifié ; ruptures F1, F2 et perte de contexte F5 |
| Client → matching/RFQ → consultation Sous-traitant → devis → comparaison | Routes, dépôts et tests présents ; continuité perturbée par F3 sous flag démo |
| Sélection → contrat/signature → mission → preuve → réception/avenant/litige | Surfaces et contrats repérés ; aucune exécution complète établie ici |
| Franchise → invitation/prospect → qualification → consultation | CRM, pipeline et relances présents ; diff staged CRM non examiné |
| Admin → candidature → mandat → approbation → invitation → franchise | Branche persistée présente ; branche démo bloquée par F4 |

**Matrice compacte des 68 fonctions**

`S` = références d’implémentation et de tests présentes. `G` = preuve atomique/visa restant ouvert dans le registre ; le texte précise le comportement à établir, sans conclure à une absence de code. `Vdoc` = ancien statut documentaire VERIFIED, **non renouvelé par cet audit**. Tous les tests ci-dessous restent non exécutés ici.

Les contrôles retrouvent exactement **68 lignes : 5 Vdoc et 63 G**, sans fonction V2. Les références couvrent les domaines ; elles ne remplacent pas une revue détaillée de chaque implémentation.

| Identifiant | Nom | Domaine / source ; test pertinent | Statut / preuve à établir |
|---|---|---|---|
| MAT-FUNC-001 | Passeport Matricia unique | Identité [actions.ts][org-actions] ; [p04-identity.spec.ts][e04] | S/Vdoc ; multi-rôles non rejoué |
| MAT-FUNC-002 | Santé globale | Diagnostics [repository.ts][diag] ; [0054_p07_diagnostics_opportunities.test.sql][t54] | S/G ; scores et évolution |
| MAT-FUNC-003 | Assistant IA | Assistance [repository.ts][ai] ; [0074_assisted_intelligence_quality.test.sql][t74] | S/G ; contexte et limites d’action |
| MAT-FUNC-004 | Détection proactive | Assistance [repository.ts][ai] ; [0079_assisted_intelligence_runtime_hardening.test.sql][t79] | S/G ; déclenchement après changement |
| MAT-FUNC-005 | Diagnostic continu | Sessions [repository.ts][sessions] ; [0025_p06_question_engine_persistence.test.sql][t25] | S/G ; expiration/revalidation |
| MAT-FUNC-006 | Actions requises | Actions [repository.ts][actions] ; [p22-universal-actions.spec.ts][e-actions] | S/G ; cycle des tâches multi-acteurs |
| MAT-FUNC-007 | Inbox universelle | Messagerie [server-repository.ts][messaging] ; [final-core-product.spec.ts][e-core] | S/Vdoc ; échanges liés aux objets |
| MAT-FUNC-008 | Assistant création besoin | Public [need-flow.tsx][need] ; [need-flow.test.tsx][need-test] | S/G ; F1, F2, F5 |
| MAT-FUNC-009 | Solutions multiples | Solutions [repository.ts][solutions] ; [0075_solution_bundles_benchmarks.test.sql][t75] | S/G ; trois niveaux, même anomalie |
| MAT-FUNC-010 | Bundles multi-bibliothèques | Solutions [repository.ts][solutions] ; [0085_benchmark_registry_and_bundle_concurrency.test.sql][t85] | S/G ; conversion transversale |
| MAT-FUNC-011 | Mode Projet | Portefeuille [server-repository.ts][portfolio] ; [p22-client-portfolio.spec.ts][e-portfolio] | S/G ; tâches/budget/contrats/progression |
| MAT-FUNC-012 | Budget annuel | Portefeuille [server-repository.ts][portfolio] ; [0070_client_portfolio_integrity_hardening.test.sql][t70] | S/G ; axes année/bibliothèque/site/projet |
| MAT-FUNC-013 | Comparateur intelligent | RFQ [server-repository.ts][rfq] ; [final-core-product.spec.ts][e-core] | S/Vdoc ; comparaison non rejouée |
| MAT-FUNC-014 | Complétude devis | Devis [quote-panel.tsx][quote-panel] ; [mat-func-014-provider-quote-mandatory-fields.spec.ts][e14] | S/G ; omissions réellement bloquantes |
| MAT-FUNC-015 | Feedback non retenus | Réputation [repository.ts][reputation] ; [0066_provider_reputation_badges_favorites.test.sql][t66] | S/G ; retour personnel anonymisé |
| MAT-FUNC-016 | Réputation multidimensionnelle | Réputation [repository.ts][reputation] ; [0066_provider_reputation_badges_favorites.test.sql][t66] | S/G ; alimentation des dimensions |
| MAT-FUNC-017 | Badges | Réputation [repository.ts][reputation] ; [0066_provider_reputation_badges_favorites.test.sql][t66] | S/G ; calcul/version/réévaluation |
| MAT-FUNC-018 | Matching évolutif | RFQ [server-repository.ts][rfq] ; [final-core-product.spec.ts][e-core] | S/Vdoc ; historique explicable |
| MAT-FUNC-019 | Rotation équitable | RFQ [server-repository.ts][rfq] ; [0155_matching_rotation_behavioral.test.sql][t155] | S/Vdoc ; rotation non rejouée |
| MAT-FUNC-020 | Capacité provider | Qualification [repository.ts][qualification] ; [0046_p09_provider_qualification.test.sql][t46] | S/G ; effet des quatre états |
| MAT-FUNC-021 | Calendrier central | Portefeuille [server-repository.ts][portfolio] ; [0065_client_projects_budgets_calendar.test.sql][t65] | S/G ; toutes les échéances attendues |
| MAT-FUNC-022 | Jalons | Missions [model.ts][missions] ; [0045_p08_contracts_missions_core.test.sql][t45] | S/G ; validation des phases |
| MAT-FUNC-023 | Preuves de réalisation | Missions [model.ts][missions] ; [0125_delivery_proof_trusted_scan.test.sql][t125] | S/G ; preuve obligatoire par service |
| MAT-FUNC-024 | Checklists | Missions [model.ts][missions] ; [0104_contract_mission_checklist_snapshot.test.sql][t104] | S/G ; snapshot/version par service |
| MAT-FUNC-025 | Réception objective | Client [actions.ts][mission-actions] ; [0045_p08_contracts_missions_core.test.sql][t45] | S/G ; acceptation critère par critère |
| MAT-FUNC-026 | Avenant rapide | Missions [model.ts][missions] ; [0118_contract_amendment_activation.test.sql][t118] | S/G ; demande → accord → activation |
| MAT-FUNC-027 | Versionnage complet | Contrats [model.ts][missions] ; [0003_immutable_ledgers.test.sql][t3] | S/G ; ensemble des objets critiques |
| MAT-FUNC-028 | Coffre-fort documentaire | Documents [server-repository.ts][vault] ; [p05-client-compliance.spec.ts][e05] | S/G ; version/réutilisation |
| MAT-FUNC-029 | Expirations | Qualification [repository.ts][qualification] ; [0056_p17_notifications_preferences_delivery.test.sql][t56] | S/G ; rappel et suspension ciblée |
| MAT-FUNC-030 | Centre financier unifié | Client [page.tsx][client-finance] ; [0004_financial_rpcs.test.sql][t4] | S/G ; consolidation multi-rôles |
| MAT-FUNC-031 | Prévision commissions | Facturation [repository.ts][billing] ; [0047_p10_provider_billing_reconciliation.test.sql][t47] | S/G ; estimation avant émission |
| MAT-FUNC-032 | Rapprochement paiements | Facturation [repository.ts][billing] ; [0047_p10_provider_billing_reconciliation.test.sql][t47] | S/G ; allocation plusieurs-à-plusieurs |
| MAT-FUNC-033 | Wallet crédits | Wallet [repository.ts][wallet] ; [0055_p08_boxes_credits_security.test.sql][t55] | S/G ; cycle métier complet |
| MAT-FUNC-034 | Récompenses | Récompenses [repository.ts][rewards] ; [0067_rewards_referrals_roi_savings.test.sql][t67] | S/G ; règle → attribution visible |
| MAT-FUNC-035 | Parrainage | Parrainage [repository.ts][rewards] ; [0073_referral_conversion_anti_oracle.test.sql][t73] | S/G ; lien → conversion attribuée |
| MAT-FUNC-036 | CRM franchisé | CRM [repository.ts][crm] ; [0059_p10_franchise_crm_performance.test.sql][t59] | S/G ; parcours complet ; limite staged |
| MAT-FUNC-037 | Pipeline franchisé | CRM [repository.ts][crm] ; [0059_p10_franchise_crm_performance.test.sql][t59] | S/G ; transitions ; F4 en amont |
| MAT-FUNC-038 | Relances automatiques | Relances [repository.ts][followups] ; [0383_franchise_followup_lease_retry_dead_letter.test.sql][t383] | S/G ; déclenchement et reprise |
| MAT-FUNC-039 | Modèles communication | Notifications [repository.ts][notifications] ; [0056_p17_notifications_preferences_delivery.test.sql][t56] | S/G ; sélection FR/AR versionnée |
| MAT-FUNC-040 | Bibliothèque modèles | Catalogue [repository.ts][builder] ; [0039_p06_question_builder_commands.test.sql][t39] | S/G ; questionnaires/clauses/checklists |
| MAT-FUNC-041 | IA qualité questionnaires | Assistance [repository.ts][ai] ; [0074_assisted_intelligence_quality.test.sql][t74] | S/G ; ambiguïté/doublon/donnée connue |
| MAT-FUNC-042 | Détection doublons | Assistance [repository.ts][ai] ; [0074_assisted_intelligence_quality.test.sql][t74] | S/G ; questions/services/anomalies |
| MAT-FUNC-043 | Simulation questionnaire | Catalogue [repository.ts][builder] ; [0061_p06_question_rule_advanced_engine.test.sql][t61] | S/G ; simulation hors statistiques |
| MAT-FUNC-044 | Analyse abandons | Analytique [repository.ts][abandonment] ; [0384_questionnaire_abandonment_analytics.test.sql][t384] | S/G ; taux question/section |
| MAT-FUNC-045 | Benchmark anonymisé | Solutions [repository.ts][solutions] ; [0088_benchmark_verified_value_binding.test.sql][t88] | S/G ; base et groupe admissibles |
| MAT-FUNC-046 | Historique évolution | Évolution [repository.ts][evolution] ; [0054_p07_diagnostics_opportunities.test.sql][t54] | S/G ; snapshots comparables |
| MAT-FUNC-047 | ROI recommandations | ROI [repository.ts][rewards] ; [0067_rewards_referrals_roi_savings.test.sql][t67] | S/G ; mesure avant/après |
| MAT-FUNC-048 | Fournisseurs favoris | Réputation [repository.ts][reputation] ; [0068_provider_feedback_privacy_hardening.test.sql][t68] | S/G ; rééligibilité à la réutilisation |
| MAT-FUNC-049 | Commander similaire | Récurrence [repository.ts][recurring] ; [0076_rfq_clone_recurring_services.test.sql][t76] | S/G ; nouveau brouillon indépendant |
| MAT-FUNC-050 | Prestations récurrentes | Récurrence [repository.ts][recurring] ; [0080_rfq_recurring_runtime_hardening.test.sql][t80] | S/G ; exécution des cycles |
| MAT-FUNC-051 | Multi-sites | Portefeuille [server-repository.ts][portfolio] ; [0165_client_site_and_rfq_open_entitlement.test.sql][t165] | S/G ; propagation du site |
| MAT-FUNC-052 | Approvals multi-utilisateurs | Approbations [load.ts][approvals] ; [0327_client_commitment_approvals.test.sql][t327] | S/G ; politique → décision → reprise |
| MAT-FUNC-053 | Centres de coûts | Portefeuille [server-repository.ts][portfolio] ; [0122_typed_cost_center_financial_links.test.sql][t122] | S/G ; rattachements de dépenses |
| MAT-FUNC-054 | Mobile | [globals.css][css] ; [refonte-sans-catalogue-public.spec.ts][e-refonte] | S/G ; parcours critiques à 360 px |
| MAT-FUNC-055 | Autosave | Sessions [repository.ts][sessions] ; [0025_p06_question_engine_persistence.test.sql][t25] | S/G ; reprise/conflits ; F5 |
| MAT-FUNC-056 | Progression | Client [boards.tsx][boards] ; [need-flow.test.tsx][need-test] | S/G ; progression réelle ; F3 |
| MAT-FUNC-057 | Préremplissage | Besoin [actions.ts][need-actions] ; [0124_versioned_prefill_freshness.test.sql][t124] | S/G ; fraîcheur/réemploi ; F5 |
| MAT-FUNC-058 | Aide contextuelle | Public [need-flow.tsx][need] ; [need-flow.test.tsx][need-test] | S/G ; aide/exemple/pourquoi |
| MAT-FUNC-059 | FR/AR | [locale.ts][locale] ; [mat-func-059-bilingual-routes-smoke.spec.ts][e59] | S/G ; traduction native et RTL |
| MAT-FUNC-060 | Langage simplifié | Diagnostics [repository.ts][diag] ; [public-experience.spec.ts][e-public] | S/G ; restitution technique/client |
| MAT-FUNC-061 | Accessibilité | UI [index.ts][ui] ; [p05-client-compliance.spec.ts][e05] | S/G ; clavier/focus/labels/contraste |
| MAT-FUNC-062 | Centre économies | Économies [repository.ts][rewards] ; [0067_rewards_referrals_roi_savings.test.sql][t67] | S/G ; économies vérifiables |
| MAT-FUNC-063 | Préférences notifications | Notifications [repository.ts][notifications] ; [0056_p17_notifications_preferences_delivery.test.sql][t56] | S/G ; application par catégorie |
| MAT-FUNC-064 | Résumé franchisé | Digest [repository.ts][digest] ; [0077_franchise_daily_digest.test.sql][t77] | S/G ; configuration → livraison |
| MAT-FUNC-065 | Résumé exécutif admin | Admin [page.tsx][command-center] ; [0053_p17_admin_command_center.test.sql][t53] | S/G ; travail prioritaire avant KPI |
| MAT-FUNC-066 | Moteur exceptions | Actions [repository.ts][actions] ; [0053_p17_admin_command_center.test.sql][t53] | S/G ; cas hors flux → résolution |
| MAT-FUNC-067 | Protection contournement | Messagerie [server-repository.ts][messaging] ; [0154_messaging_comparison_functional.test.sql][t154] | S/G ; parcours avant/après sélection |
| MAT-FUNC-068 | Détection abus | Admin [page.tsx][anti-abuse] ; [0123_transversal_abuse_detection.test.sql][t123] | S/G ; signal → examen humain |

Pour MAT-FUNC-052, la cartographie ci-dessus retient les approbations métier plus récentes effectivement présentes ; la ligne historique du registre cite surtout les demandes de rôles et le command center.

**Points conformes vérifiés et limites stratégiques**

- Le dépôt possède bien les quatre espaces, une navigation multi-rôles et des dépôts métier distincts. Les tests de comparaison/matching examinés contiennent des assertions sur les objets métier, au-delà de la présence d’un titre.
- Le gate démo exclut explicitement les environnements de production. Les défauts F3/F4 concernent son fonctionnement autorisé en développement/staging/test ; aucune activation en production n’est alléguée.
- Les constantes consultées dans [packages/legal-v41/src/index.ts:72][economics72] distinguent bien IT — Hatim/Jalil 50/50, entrée nulle, Asma 0 — et pot Core/entrée Jalil/Asma 50/50. Cela vérifie la représentation de ces règles, **pas leur application comptable de bout en bout**.
- La vision est cohérente : diagnostic → besoin structuré → consultation → exécution, enrichie par l’expertise des franchises et les abonnements/avantages/crédits. Sa démonstration commerciale est fragilisée précisément aux raccordements F1–F5. Des écrans remplis par overlay ne prouvent ni conversion ni activité du réseau.
- La refonte a installé une entrée guidée, mais la projection embarquée conserve un rôle de filtre d’admissibilité. L’autonomie éditoriale des franchisés et la découverte commerciale restent donc insuffisamment raccordées.

Les métriques nécessaires pour juger la stratégie ne sont pas établies par cette revue : conversion diagnostic/besoin → demande, devenir des besoins non classés, délai de qualification, panel éligible et réponses aux consultations, sélection → contrat → réception, récurrence, conversion essai → abonnement, rétention et contribution par bibliothèque/pot Core. Les volumes démo ne permettent aucune conclusion commerciale sur ces points.

**Contrôles exécutés**

- [node --experimental-strip-types scripts/validate-traceability.ts][validate-trace] : sortie 0 ; références présentes, cinq statuts VERIFIED. Le script compte aussi huit exigences marketing, non auditées ici.
- [node --experimental-strip-types scripts/validate-spec.ts][validate-spec] : sortie 0 ; initialisation reconnue, P01 explicitement ouverte.
- Exécution en mémoire des helpers purs et de l’expression de sérialisation : résultats reproductibles décrits en F2/F3/F5 ; inventaire des routes et registres.
- Git : HEAD inchangé, aucun diff staged ou non staged.

**Limites :** dépendances absentes ; aucun test Vitest, SQL/RLS, navigateur ou parcours applicatif exécuté. Node disponible : 24.11.0, contre 22.x déclaré par le projet. Aucune base distante, donnée réelle ou intégration externe sollicitée. Les preuves historiques n’ont pas été renouvelées sur ce HEAD, et les deux modifications staged du coordinateur restent hors examen.

[gold31]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:2308
[gold607]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:607
[refonte]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/docs/refonte-sans-catalogue
[state]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/docs/progress/PROJECT_STATE.md
[navigation]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/auth/workspace-navigation.ts:12
[admin-nav]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/admin/data/spaces/admin-nav.ts
[provider-views]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/provider/data/spaces/nested-views.ts
[franchise-views]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/franchise/data/spaces/nested-views.ts
[demo-applications]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/admin/data/spaces/demo-franchise-applications.ts
[need727]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/public/ui/journey/need-flow.tsx:727
[need942]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/public/ui/journey/need-flow.tsx:942
[intake65]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/migrations/20260915020200_public_need_intake.sql:65
[need-context108]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/client/screens/demandes/need-context.ts:108
[need-model20]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/public/data/need-intent/model.ts:20
[need-model52]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/public/data/need-intent/model.ts:52
[need-actions193]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/app/[locale]/(public)/besoin/actions.ts:193
[boards364]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/client/screens/spaces/boards.tsx:364
[requests26]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/app/[locale]/client/demandes/page.tsx:26
[demo-gate]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/client/data/home/demo-scenario.ts:8
[applications129]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/app/[locale]/administration/candidatures-franchise/page.tsx:129
[applications147]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/app/[locale]/administration/candidatures-franchise/page.tsx:147
[review92]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/admin/screens/franchise-applications/review-forms.tsx:92
[need745]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/public/ui/journey/need-flow.tsx:745
[need-actions113]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/app/[locale]/(public)/besoin/actions.ts:113
[parse8]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/migrations/20260928120000_need_request_quote_completeness.sql:8
[screens3]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/docs/specs/registries/screens.yaml:3
[forms]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/docs/specs/registries/forms.yaml
[apis]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/docs/specs/registries/apis.yaml
[economics72]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/packages/legal-v41/src/index.ts:72
[validate-trace]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/scripts/validate-traceability.ts
[validate-spec]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/scripts/validate-spec.ts
[org-actions]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/app/[locale]/organisation/actions.ts
[diag]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/diagnostics-opportunities/repository.ts
[ai]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/assisted-intelligence/repository.ts
[sessions]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/questionnaire-sessions/repository.ts
[actions]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/action-center/repository.ts
[messaging]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/internal-messaging/server-repository.ts
[need]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/public/ui/journey/need-flow.tsx
[need-test]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/public/ui/journey/need-flow.test.tsx
[solutions]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/solution-insights/repository.ts
[portfolio]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/client/data/portfolio/server-repository.ts
[rfq]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/client/data/rfq/server-repository.ts
[quote-panel]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/provider/screens/devis/quote-panel.tsx
[reputation]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/provider/data/reputation/repository.ts
[qualification]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/provider/data/qualification/repository.ts
[missions]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/contracts-missions/model.ts
[mission-actions]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/client/screens/missions/actions.ts
[vault]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/client/data/documents/server-repository.ts
[client-finance]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/app/[locale]/client/finances/page.tsx
[billing]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/provider/data/billing/repository.ts
[wallet]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/credits-wallet/repository.ts
[rewards]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/rewards-referrals-roi/repository.ts
[crm]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/franchise/data/crm/repository.ts
[followups]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/franchise/data/followups/repository.ts
[notifications]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/notifications/repository.ts
[builder]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/catalogue-builder/repository.ts
[abandonment]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/questionnaire-abandonment-analytics/repository.ts
[evolution]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/diagnostics-evolution/repository.ts
[recurring]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/client/data/recurring/repository.ts
[approvals]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/client/screens/approbations/load.ts
[css]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/app/globals.css
[boards]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/client/screens/spaces/boards.tsx
[need-actions]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/app/[locale]/(public)/besoin/actions.ts
[locale]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/shared/lib/i18n/locale.ts
[ui]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/packages/ui/src/index.ts
[digest]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/modules/franchise/data/digest/repository.ts
[command-center]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/app/[locale]/administration/command-center/page.tsx
[anti-abuse]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/apps/web/app/[locale]/administration/anti-abus/page.tsx
[e04]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/tests/e2e/p04-identity.spec.ts
[e05]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/tests/e2e/p05-client-compliance.spec.ts
[e-actions]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/tests/e2e/p22-universal-actions.spec.ts
[e-core]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/tests/e2e/final-core-product.spec.ts
[e-portfolio]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/tests/e2e/p22-client-portfolio.spec.ts
[e14]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/tests/e2e/mat-func-014-provider-quote-mandatory-fields.spec.ts
[e-refonte]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/tests/e2e/refonte-sans-catalogue-public.spec.ts
[e59]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/tests/e2e/mat-func-059-bilingual-routes-smoke.spec.ts
[e-public]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/tests/e2e/public-experience.spec.ts
[t3]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0003_immutable_ledgers.test.sql
[t4]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0004_financial_rpcs.test.sql
[t25]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0025_p06_question_engine_persistence.test.sql
[t39]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0039_p06_question_builder_commands.test.sql
[t45]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0045_p08_contracts_missions_core.test.sql
[t46]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0046_p09_provider_qualification.test.sql
[t47]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0047_p10_provider_billing_reconciliation.test.sql
[t53]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0053_p17_admin_command_center.test.sql
[t54]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0054_p07_diagnostics_opportunities.test.sql
[t55]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0055_p08_boxes_credits_security.test.sql
[t56]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0056_p17_notifications_preferences_delivery.test.sql
[t59]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0059_p10_franchise_crm_performance.test.sql
[t61]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0061_p06_question_rule_advanced_engine.test.sql
[t65]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0065_client_projects_budgets_calendar.test.sql
[t66]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0066_provider_reputation_badges_favorites.test.sql
[t67]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0067_rewards_referrals_roi_savings.test.sql
[t68]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0068_provider_feedback_privacy_hardening.test.sql
[t70]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0070_client_portfolio_integrity_hardening.test.sql
[t73]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0073_referral_conversion_anti_oracle.test.sql
[t74]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0074_assisted_intelligence_quality.test.sql
[t75]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0075_solution_bundles_benchmarks.test.sql
[t76]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0076_rfq_clone_recurring_services.test.sql
[t77]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0077_franchise_daily_digest.test.sql
[t79]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0079_assisted_intelligence_runtime_hardening.test.sql
[t80]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0080_rfq_recurring_runtime_hardening.test.sql
[t85]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0085_benchmark_registry_and_bundle_concurrency.test.sql
[t88]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0088_benchmark_verified_value_binding.test.sql
[t104]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0104_contract_mission_checklist_snapshot.test.sql
[t118]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0118_contract_amendment_activation.test.sql
[t122]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0122_typed_cost_center_financial_links.test.sql
[t123]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0123_transversal_abuse_detection.test.sql
[t124]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0124_versioned_prefill_freshness.test.sql
[t125]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0125_delivery_proof_trusted_scan.test.sql
[t154]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0154_messaging_comparison_functional.test.sql
[t155]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0155_matching_rotation_behavioral.test.sql
[t165]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0165_client_site_and_rfq_open_entitlement.test.sql
[t327]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0327_client_commitment_approvals.test.sql
[t383]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0383_franchise_followup_lease_retry_dead_letter.test.sql
[t384]: C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-report/supabase/tests/0384_questionnaire_abandonment_analytics.test.sql

