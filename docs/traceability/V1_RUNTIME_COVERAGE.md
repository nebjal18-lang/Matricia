# Recette des 68 fonctions V1

Cette matrice distingue les tests reperes des comportements executes. Aucun pourcentage global de couverture ne peut etre deduit du nombre de fichiers ou du taux de reussite. Les visas historiques restent dans le registre de couverture et ne sont pas renouveles ici.

La source machine est [V1_RUNTIME_COVERAGE.json](./V1_RUNTIME_COVERAGE.json). Les preuves indiquees sont partielles : elles ne ferment pas toute une exigence.

| Exigence | Fonction | Contrat du Gold Master | Preuve actuelle | Tests navigateur reperes |
|---|---|---|---|---|
| MAT-FUNC-001 | Passeport Matricia unique | Organisation unique multi-rôles; données communes réutilisées. | [Partielle](../../artifacts/test-results/e2e-local-auth-20261122-passed.json) | 1 |
| MAT-FUNC-002 | Santé globale | Score global + scores bibliothèques + anomalies + évolution. | [Partielle](../../artifacts/test-results/local-acceptance/client-journey.json) | 1 |
| MAT-FUNC-003 | Assistant IA | Assistant contextuel; aucune sanction/transaction critique autonome. | [Partielle](../../artifacts/test-results/local-acceptance/functional-controls-proof.json) | 1 |
| MAT-FUNC-004 | Détection proactive | Changements de profil déclenchent suggestions/réévaluations. | [Partielle : modification activité et réévaluation FR/AR](../../artifacts/test-results/local-acceptance/functional-controls-proof.json) | 1 |
| MAT-FUNC-005 | Diagnostic continu | Questions expirantes et revalidation légère. | [Partielle : expiration et confirmation réelles](../../artifacts/test-results/local-acceptance/history/questionnaire-revalidation-c5a081b484c9663aab682f18e8e51f6a31a9df881e86dbd9aca3ac3314f008e6.json) | 1 |
| MAT-FUNC-006 | Actions requises | File universelle de tâches utilisateur. | [Partielle : quatre rôles, lecture et isolation](../../artifacts/test-results/local-acceptance/history/universal-actions-6317ec21d00d335a4c2eeff42ee9ef38bbe793c64cd4b83386ae5406898e9bef.json) | 1 |
| MAT-FUNC-007 | Inbox universelle | Messagerie liée aux objets métier. | [Partielle](../../artifacts/test-results/local-acceptance/final-core.json) | 1 |
| MAT-FUNC-008 | Assistant création besoin | Texte libre → service → questions manquantes. | [Partielle](../../artifacts/test-results/local-acceptance/client-journey.json) | 0 |
| MAT-FUNC-009 | Solutions multiples | Essential/Standard/Advanced pour une même anomalie. | [Partielle : trois niveaux et décisions](../../artifacts/test-results/local-acceptance/history/solution-decisions-37c78a142cb9f47a9247162818699185b49d77fd86cd6dee663e14804a4d465e.json) | 1 |
| MAT-FUNC-010 | Bundles multi-bibliothèques | Ensembles de services pour projet transversal. | [Partielle : ensembles et parcours guidé](../../artifacts/test-results/local-acceptance/history/solution-bundles-93f2f93b0ead91b3164cdfd87c77dff433eff8025cf9ea18e99742470738682b.json) | 0 |
| MAT-FUNC-011 | Mode Projet | Projet avec budget, tâches, contrats et progression. | [Partielle](../../artifacts/test-results/local-acceptance/functional-controls.json) | 2 |
| MAT-FUNC-012 | Budget annuel | Budget par année/bibliothèque/site/projet. | [Partielle](../../artifacts/test-results/local-acceptance/functional-controls.json) | 1 |
| MAT-FUNC-013 | Comparateur intelligent | Comparaison normalisée de devis. | [Partielle](../../artifacts/test-results/local-acceptance/final-core.json) | 1 |
| MAT-FUNC-014 | Complétude devis | Score + blocage champs obligatoires. | [Partielle](../../artifacts/test-results/local-acceptance/p23-quotes.json) | 3 |
| MAT-FUNC-015 | Feedback non retenus | Classement personnel + amélioration anonymisée. | A examiner | 1 |
| MAT-FUNC-016 | Réputation multidimensionnelle | Qualité/délai/conformité/réponse/satisfaction/finance. | [Partielle : événements, décision humaine et consultation](../../artifacts/test-results/local-acceptance/history/provider-reputation-ca562e40014838ebf06b162808df8de092ec7c6274a250ba761018dec61f78f4.json) | 1 |
| MAT-FUNC-017 | Badges | Badges calculés et versionnés. | [Partielle : événements, décision humaine et consultation](../../artifacts/test-results/local-acceptance/history/provider-reputation-ca562e40014838ebf06b162808df8de092ec7c6274a250ba761018dec61f78f4.json) | 1 |
| MAT-FUNC-018 | Matching évolutif | Règles explicables et historisées. | [Partielle](../../artifacts/test-results/local-acceptance/final-core.json) | 1 |
| MAT-FUNC-019 | Rotation équitable | Éviter monopolisation lorsque candidats équivalents. | [Partielle](../../artifacts/test-results/local-acceptance/final-core.json) | 1 |
| MAT-FUNC-020 | Capacité provider | AVAILABLE/LIMITED/FULL/PAUSED. | [Partielle](../../artifacts/test-results/local-acceptance/final-core.json) | 2 |
| MAT-FUNC-021 | Calendrier central | Échéances devis, missions, factures, documents. | [Partielle](../../artifacts/test-results/local-acceptance/functional-controls-proof.json) | 2 |
| MAT-FUNC-022 | Jalons | Phases de mission validables. | [Partielle](../../artifacts/test-results/local-acceptance/linked-commercial.json) | 2 |
| MAT-FUNC-023 | Preuves de réalisation | Preuves obligatoires par service. | [Partielle](../../artifacts/test-results/local-acceptance/linked-commercial.json) | 1 |
| MAT-FUNC-024 | Checklists | Checklist versionnée par service. | [Partielle](../../artifacts/test-results/local-acceptance/linked-commercial.json) | 2 |
| MAT-FUNC-025 | Réception objective | Validation critère par critère. | [Partielle](../../artifacts/test-results/local-acceptance/linked-commercial.json) | 2 |
| MAT-FUNC-026 | Avenant rapide | Demande supplémentaire → prix/délai/livrables. | [Partielle : avenants activés en DEV et intégrés aux missions](../../artifacts/test-results/local-acceptance/history/amendment-activation-0222c22dfc831c797944ffae604236b2bb55045e0b64d3b034bbefbe6a36b82d.json) | 2 |
| MAT-FUNC-027 | Versionnage complet | Historique immuable des objets critiques. | [Partielle : avenants activés en DEV et intégrés aux missions](../../artifacts/test-results/local-acceptance/history/amendment-activation-0222c22dfc831c797944ffae604236b2bb55045e0b64d3b034bbefbe6a36b82d.json) | 0 |
| MAT-FUNC-028 | Coffre-fort documentaire | Documents privés, versionnés, réutilisables. | [Partielle](../../artifacts/test-results/local-acceptance/linked-commercial.json) | 3 |
| MAT-FUNC-029 | Expirations | Rappels et suspension ciblée. | A examiner | 1 |
| MAT-FUNC-030 | Centre financier unifié | Vue consolidée multi-rôles, ledgers séparés. | A examiner | 1 |
| MAT-FUNC-031 | Prévision commissions | Accruals estimés avant facturation. | A examiner | 1 |
| MAT-FUNC-032 | Rapprochement paiements | Allocation plusieurs factures/paiements. | A examiner | 1 |
| MAT-FUNC-033 | Wallet crédits | Ledger crédits complet. | [Partielle](../../artifacts/test-results/local-acceptance/benefit-fulfillment.json) | 1 |
| MAT-FUNC-034 | Récompenses | Règles bonus paramétrables. | [Partielle : approbation et émission Finance](../../artifacts/test-results/local-acceptance/history/referral-rewards-7e6dadf6e76d32a6164634bbbb087616a27bedcd5645390c19ffe2d8d28e4997.json) | 1 |
| MAT-FUNC-035 | Parrainage | Liens et conversion traçables. | [Partielle : approbation et émission Finance](../../artifacts/test-results/local-acceptance/history/referral-rewards-7e6dadf6e76d32a6164634bbbb087616a27bedcd5645390c19ffe2d8d28e4997.json) | 1 |
| MAT-FUNC-036 | CRM franchisé | Contacts et activités. | [Partielle : parcours réel FR/AR](../../artifacts/test-results/local-acceptance/history/franchise-crm-f9a20140232a3aae96ee23ed63e36ac7e5d3d5a6d86e66ad4f1ee684e123a33a.json) | 1 |
| MAT-FUNC-037 | Pipeline franchisé | Étapes de conversion standardisées. | [Partielle : parcours réel FR/AR](../../artifacts/test-results/local-acceptance/history/franchise-crm-f9a20140232a3aae96ee23ed63e36ac7e5d3d5a6d86e66ad4f1ee684e123a33a.json) | 1 |
| MAT-FUNC-038 | Relances automatiques | Rappels par règles et délais. | [Partielle : règles, consentement et file native](../../artifacts/test-results/local-acceptance/history/franchise-followups-283effbb13eda70dbe98ff5aabb5d679a82d484b5023181ba2486bb81b5ac931.json) | 1 |
| MAT-FUNC-039 | Modèles communication | Templates FR/AR versionnés. | [Partielle : prévisualisation et activation indépendante](../../artifacts/test-results/local-acceptance/history/notification-templates-0017cd43c6c9244702c6c1c7b79ab0ef09802bf9286d22fb2b21d209dee800e3.json) | 2 |
| MAT-FUNC-040 | Bibliothèque modèles | Clonage de questionnaires/clauses/checklists. | A examiner | 1 |
| MAT-FUNC-041 | IA qualité questionnaires | Ambiguïté, doublons, donnée déjà connue. | [Partielle : qualité et revue humaine](../../artifacts/test-results/local-acceptance/history/question-quality-310071763618624f1e804f3581e7e5d6da712d7e41a1eee063c4600f0649544f.json) | 1 |
| MAT-FUNC-042 | Détection doublons | Questions/services/anomalies similaires. | [Partielle : qualité et revue humaine](../../artifacts/test-results/local-acceptance/history/question-quality-310071763618624f1e804f3581e7e5d6da712d7e41a1eee063c4600f0649544f.json) | 1 |
| MAT-FUNC-043 | Simulation questionnaire | Sandbox sans statistiques réelles. | [Partielle : simulation franchisé](../../artifacts/test-results/local-acceptance/history/questionnaire-simulation-ebb64f5b983ed9b85be6756a341ec570c3fb2ead85aa377b6c9cc0e42440070b.json) | 1 |
| MAT-FUNC-044 | Analyse abandons | Taux par section/question. | A examiner | 0 |
| MAT-FUNC-045 | Benchmark anonymisé | Agrégats avec seuil minimal de groupe. | A examiner | 1 |
| MAT-FUNC-046 | Historique évolution | Snapshots scores/anomalies. | [Partielle : historique et explications](../../artifacts/test-results/local-acceptance/history/diagnostic-history-bfe25e1e52ab7412949e5d63dcbd56956de4381eb793a319afb5bf6576790733.json) | 1 |
| MAT-FUNC-047 | ROI recommandations | Résultats seulement si base mesurable. | A examiner | 1 |
| MAT-FUNC-048 | Fournisseurs favoris | Éligibilité revalidée à chaque utilisation. | [Partielle : favoris et capacité courante](../../artifacts/test-results/local-acceptance/history/provider-favorites-8507a4e02c66d34e1caea498df95b272799f9399bfad0f53822e44e23d170943.json) | 1 |
| MAT-FUNC-049 | Commander similaire | Cloner une ancienne demande dans une nouvelle. | [Partielle](../../artifacts/test-results/local-acceptance/history/recurring-requests-950cfcdebd956fa95407af9998d06c3bffaed1704e799d80694464fea4d79ef0.json) | 2 |
| MAT-FUNC-050 | Prestations récurrentes | Cycles mensuels/trimestriels/annuels. | [Partielle](../../artifacts/test-results/local-acceptance/history/recurring-requests-950cfcdebd956fa95407af9998d06c3bffaed1704e799d80694464fea4d79ef0.json) | 2 |
| MAT-FUNC-051 | Multi-sites | Site_id dans diagnostics/demandes/missions/budgets. | [Partielle](../../artifacts/test-results/local-acceptance/functional-controls.json) | 1 |
| MAT-FUNC-052 | Approvals multi-utilisateurs | Workflow d’approbation paramétrable. | A examiner | 1 |
| MAT-FUNC-053 | Centres de coûts | Rattachement dépenses/projets. | [Partielle](../../artifacts/test-results/local-acceptance/functional-controls.json) | 2 |
| MAT-FUNC-054 | Mobile | Parcours critiques utilisables sur smartphone. | [Partielle](../../artifacts/test-results/local-acceptance/p24-p26.json) | 3 |
| MAT-FUNC-055 | Autosave | Brouillons sauvegardés et conflits gérés. | [Partielle](../../artifacts/test-results/local-acceptance/client-journey.json) | 1 |
| MAT-FUNC-056 | Progression | Étapes/complétude réelles. | [Partielle : progression réelle des projets](../../artifacts/test-results/local-acceptance/history/functional-controls-05101261c7142bc87835df6b93636422e0da02360d0b90feaf846ffe88fd7694.json) | 2 |
| MAT-FUNC-057 | Préremplissage | Réutiliser données récentes. | [Partielle : parcours réel FR/AR](../../artifacts/test-results/local-acceptance/history/questionnaire-assistance-c14a5b86c77af5f9adc4683624f4fe3178d9aa49724cb41e4fd7379db7832333.json) | 1 |
| MAT-FUNC-058 | Aide contextuelle | Aide, exemple et pourquoi demandé. | [Partielle : parcours réel FR/AR](../../artifacts/test-results/local-acceptance/history/questionnaire-assistance-c14a5b86c77af5f9adc4683624f4fe3178d9aa49724cb41e4fd7379db7832333.json) | 1 |
| MAT-FUNC-059 | FR/AR | Traductions natives et RTL. | [Partielle](../../artifacts/test-results/local-acceptance/p24-p26.json) | 3 |
| MAT-FUNC-060 | Langage simplifié | Texte technique + version client. | [Partielle : historique et explications](../../artifacts/test-results/local-acceptance/history/diagnostic-history-bfe25e1e52ab7412949e5d63dcbd56956de4381eb793a319afb5bf6576790733.json) | 2 |
| MAT-FUNC-061 | Accessibilité | Clavier, focus, contraste, labels. | [Partielle](../../artifacts/test-results/local-acceptance/p24-p26.json) | 2 |
| MAT-FUNC-062 | Centre économies | Économies seulement sur bases vérifiables. | [Partielle](../../artifacts/test-results/local-acceptance/benefit-fulfillment.json) | 1 |
| MAT-FUNC-063 | Préférences notifications | Immédiat/digest/disabled par catégorie. | [Partielle](../../artifacts/test-results/local-acceptance/functional-controls.json) | 2 |
| MAT-FUNC-064 | Résumé franchisé | Digest quotidien configurable. | [Partielle](../../artifacts/test-results/local-acceptance/functional-controls.json) | 2 |
| MAT-FUNC-065 | Résumé administrateur | Priorités, compteurs et accès contextuel aux dossiers. | [Partielle : triage réel FR/AR desktop/360](../../artifacts/test-results/local-acceptance/history/admin-summary-25cc29edd7fafa90a8e68ad4f2e932162381065d2825f75b11bf9ce14debb093.json) | 1 |
| MAT-FUNC-066 | Moteur exceptions | Cas hors workflow vers file admin. | [Partielle](../../artifacts/test-results/local-acceptance/history/admin-decisions-ecc7893381a15bb13c7ab3bea96f75af7b18ada92a4e7ea5ecb0a7484bfb2d8c.json) | 2 |
| MAT-FUNC-067 | Protection contournement | Contacts masqués et échanges internes avant sélection. | A examiner | 1 |
| MAT-FUNC-068 | Détection abus | Risk flags sans sanction automatique. | [Partielle](../../artifacts/test-results/local-acceptance/history/admin-decisions-ecc7893381a15bb13c7ab3bea96f75af7b18ada92a4e7ea5ecb0a7484bfb2d8c.json) | 2 |

## Scenarios minimum du Gold Master 25.2

Le rapprochement de chaque scenario avec une execution complete reste a terminer.

- **GM25.2-01** : client normal de l’OTP à la mission terminée ;
- **GM25.2-02** : anomalie administrative puis correction ;
- **GM25.2-03** : essai expiré puis Gold et réactivation ;
- **GM25.2-04** : Box Gold, réservation, livraison et consommation ;
- **GM25.2-05** : achat de crédits supplémentaires ;
- **GM25.2-06** : sous-traitant qualifié puis devis/missions ;
- **GM25.2-07** : sous-traitant active le rôle Client ;
- **GM25.2-08** : organisation empêchée de répondre à elle-même ;
- **GM25.2-09** : feedback anonymisé non retenu ;
- **GM25.2-10** : demande hors périmètre transformée en avenant ;
- **GM25.2-11** : non-conformité confirmée et réaffectation ;
- **GM25.2-12** : double confirmation sans double pénalité ;
- **GM25.2-13** : commission normale sur encaissement ;
- **GM25.2-14** : facture, paiement partiel et restriction ;
- **GM25.2-15** : échéancier approuvé ;
- **GM25.2-16** : franchisé hors IT avec droit d’entrée ;
- **GM25.2-17** : retenue sur six mois et solde ;
- **GM25.2-18** : répartition 50/25/25 ;
- **GM25.2-19** : IT : bénéfice distribuable partagé 50 % Hatim Ahmitech / 50 % Jalil-NEOXA, Hatim exempt de droit d’entrée ;
- **GM25.2-20** : invitation franchisé ;
- **GM25.2-21** : création/publication questionnaire et simulation ;
- **GM25.2-22** : pool volume et stock faible ;
- **GM25.2-23** : webhook paiement doublé ;
- **GM25.2-24** : document obligatoire expiré ;
- **GM25.2-25** : doublon ICE et rattachement ;
- **GM25.2-26** : tentative d’accès inter-tenant bloquée.
