# Revue indépendante — architecture

Source : agent en worktree isolé au commit b578c75c. Texte de revue conservé comme preuve ; voir FINDINGS.md pour la consolidation, la gravité et les limites actualisées.

J’intègre les résultats du coordinateur sans relancer les suites globales. Je vais examiner les quatre fichiers de tests en échec et distinguer les régressions applicatives, les défauts de montage des tests et les problèmes de portabilité Windows des outils de preuve.

Deux lacunes des garde-fous sont confirmées sans accès distant : le résolveur du runner SQL accepte une cible arbitraire sans vérifier son identité non-production ; le validateur du manifeste accepte un fichier de configuration comme preuve d’approbation, sans en contrôler le contenu. Les trois tests ciblés du transport HTTP Outbox passent, dont le refus de publication en l’absence d’accusé du consumer.

Les échecs remontés par le coordinateur correspondent à des problèmes de montage ou d’attentes de tests : contexte Router absent, libellé désormais traduit, et attentes contradictoires sur HTTP 403. Ils bloquent néanmoins la validation de la suite actuelle.

Le contrôle du gate SQL révèle aussi qu’une suite filtrée peut produire un résumé de release `passed` : le collecteur accepte un résultat positif même s’il ne porte que sur un fichier parmi les 383 présents. Cette vérification a été faite avec des entrées simulées en mémoire, sans connexion à une base.

Le rapport final séparera ces défauts des preuves encore attendues pour le rollback et la restauration sur staging. Les sources et l’index Git restent inchangés.

**Avis défavorable à la clôture qualité/release de ce candidat.** Deux défauts prioritaires touchent la sécurité du runner SQL et la fiabilité de sa preuve de release. Aucun changement applicatif, fichier de preuve ou index Git n’a été modifié.

Base vérifiée : `b578c75c1c0f076c7fb46b0239d7ab5f2b0afc4c`, worktree propre. Les modifications staged du coordinateur dans [demo-franchise-applications.ts](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/modules/admin/data/spaces/demo-franchise-applications.ts) et [franchise/data/crm/repository.ts](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/modules/franchise/data/crm/repository.ts) sont absentes ici : elles ne sont pas couvertes par cet avis.

Audit fondé sur les règles permanentes, les skills qualité/release et les sections ciblées du Gold Master, notamment §§5–7, 24–28 et 31 bis. Aucune lecture intégrale du catalogue.

**Findings confirmés, par priorité**

1. **P1 — Le runner SQL ne vérifie pas réellement que sa cible est non-production.**  
   Références : [scripts/run-db-tests.mjs:15](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/run-db-tests.mjs:15), [ligne 608](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/run-db-tests.mjs:608), [ligne 267](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/run-db-tests.mjs:267).  
   **Preuve reproductible :** évaluer uniquement le résolveur avec `APP_ENV=staging` et `DIRECT_URL=postgresql://production-db.invalid/matricia`. Résultat observé en mémoire : cible acceptée, **zéro lecture des métadonnées**, zéro connexion. Tout hostname autre que `db.*.supabase.co` emprunte ce retour anticipé. Le runner appelle ensuite un nettoyage comportant verrous exclusifs, désactivation de triggers d’immutabilité et suppressions de fixtures.  
   **Impact :** un mauvais binding peut orienter ces opérations vers une base réelle ; `APP_ENV` ne constitue pas une preuve de son identité.  
   **Exigence :** interdiction des mutations production non autorisées ; GM §24.  
   **Recommandation/test :** vérifier l’identité effective de la base avant toute écriture ; refuser cible inconnue, production et incohérences URL/project-ref. Tester ces refus avec `APP_ENV` trompeur.

2. **P1 — Une suite SQL filtrée peut être présentée comme un check release complet.**  
   Références : [scripts/run-db-tests.mjs:613](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/run-db-tests.mjs:613), [scripts/release/run-checks.mjs:27](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/release/run-checks.mjs:27), [scripts/release/manifest.mjs:60](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/release/manifest.mjs:60).  
   **Preuve reproductible :** le collecteur transmet l’environnement, donc `DB_TEST_PATTERN=^0001_` sélectionne un seul fichier. Une simulation du script avec la sortie `DB tests passed: 1 files, 1 assertions, 4 concurrency scenarios` produit effectivement `status: passed`. Le checkout contient **383 fichiers SQL de test** ; leur couverture complète n’est pas contrôlée dans ce résumé.  
   **Impact :** omission silencieuse de tests RLS/finance dans une preuve censée certifier le candidat.  
   **Exigence :** GM §§25–28, preuves complètes et reproductibles.  
   **Recommandation/test :** interdire les filtres en mode release et comparer la liste/empreinte des suites exécutées à l’inventaire attendu. Un sous-ensemble doit produire une preuve explicitement partielle.

3. **P2 — Le manifeste contrôle l’intégrité des approbations, mais pas leur cohérence.**  
   Références : [scripts/release/manifest.mjs:19](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/release/manifest.mjs:19), [ligne 36](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/release/manifest.mjs:36), [ligne 56](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/release/manifest.mjs:56), [scripts/release/manifest.test.mjs:42](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/release/manifest.test.mjs:42).  
   **Preuve reproductible :** un manifeste construit en mémoire avec l’auteur comme reviewer des exigences et une référence inexistante passe la validation de forme. Pour les cinq approbations, référencer les octets et le SHA256 du manifeste npm produit **zéro erreur d’approbation**. Le test existant accepte lui-même `{}` comme artefact d’approbation. Les checks techniques invalides restent, eux, rejetés.  
   **Impact :** un document étranger ou un visa incohérent peut satisfaire cette partie du contrôle automatique. Cela ne prouve pas une release complète frauduleusement acceptée : les autres contrôles subsistent et l’authenticité humaine est prévue séparément.  
   **Exigence :** GM §26, indépendance et visa documenté.  
   **Recommandation/test :** contrôler au minimum décision, candidat, identité du signataire et correspondance avec les métadonnées du visa ; rejeter document quelconque, mauvais SHA et auto-revue d’exigence.

4. **P2 — Le web n’applique pas plusieurs options TypeScript obligatoires.**  
   Référence : [apps/web/tsconfig.json:2](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/tsconfig.json:2).  
   **Preuve reproductible :** résolution des configurations avec l’API TypeScript : `strict=true`, mais `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` et `noFallthroughCasesInSwitch` sont tous désactivés pour le web ; ils sont actifs à la racine et dans le worker. Le web n’étend pas la configuration racine.  
   **Impact :** le typecheck PASS communiqué ne prouve pas le respect du standard demandé pour la principale application.  
   **Exigence :** GM §6.1.  
   **Recommandation/test :** hériter des options communes et vérifier les options effectives des applications dans le validateur structurel.

5. **P2 — L’architecture des packages reste largement déclarative et le gate ne le révèle pas.**  
   Références : [packages/application/src/index.ts:1](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/packages/application/src/index.ts:1), [packages/contracts/src/index.ts:1](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/packages/contracts/src/index.ts:1), [packages/application/package.json:1](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/packages/application/package.json:1), [scripts/validate-boundaries.ts:45](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/validate-boundaries.ts:45).  
   **Preuve reproductible :** application et contrats contiennent chacun un seul type ; forms et workflows sont également minimaux. Aucun des 1 543 fichiers applicatifs TS/TSX examinés hors tests ne référence les packages application, contrats, domaine, configuration ou workflows par leur nom workspace. Plusieurs packages autorisent `--passWithNoTests`. Le validateur annonce néanmoins « frontières et gates validées pour 14 packages » et ne parcourt pas les applications.  
   **Impact :** cette sortie verte ne certifie ni les frontières réelles du web ni la couche de use cases/contrats annoncée. Cela ne signifie pas que les fonctions métier sont absentes : une partie est portée par SQL et les modules web.  
   **Exigence :** GM §§5.3 et 6.2.  
   **Recommandation/test :** documenter l’architecture réellement retenue et contrôler ses dépendances effectives, y compris celles des applications.

6. **P2 — Des erreurs métier distinctes sont effacées à la frontière serveur.**  
   Références : [apps/web/modules/admin/screens/incitations/actions.ts:2](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/modules/admin/screens/incitations/actions.ts:2), [actions.test.ts:13](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/modules/admin/screens/incitations/actions.test.ts:13).  
   **Preuve reproductible :** exécution isolée du helper avec un RPC simulant successivement `42501` puis `23505` : réponse identique `{status:"error"}`, sans code ni référence de requête. Les deux tests voisins couvrent les succès.  
   **Impact :** permission refusée, conflit et panne deviennent indiscernables pour l’interface et le support.  
   **Exigence :** GM §§6.2–6.3 : résultat typé, codes stables, diagnostic actionnable.  
   **Recommandation/test :** conserver une erreur sûre et discriminée, corrélée aux logs ; couvrir refus, conflit, validation et indisponibilité.

7. **P2 — La pagination de transport charge malgré tout l’historique entier.**  
   Références : [apps/web/modules/shared/lib/data/read-pages.ts:4](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/modules/shared/lib/data/read-pages.ts:4), [provider/data/billing/workspace.ts:13](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/modules/provider/data/billing/workspace.ts:13), [franchise/data/crm/repository.ts:73](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/modules/franchise/data/crm/repository.ts:73).  
   **Preuve reproductible :** callback synthétique de 100 000 lignes : **201 appels séquentiels**, 100 000 lignes accumulées avant retour. La facturation applique cette collecte à huit ensembles ; le CRM effectue ensuite des recherches répétées dans les collections pour chaque prospect.  
   **Impact :** coût réseau, mémoire et transformation croissant avec tout l’historique, même pour afficher une page. Aucun dépassement réel du p95 n’a été mesuré ici.  
   **Exigence :** GM §25.3 : pagination serveur et budgets de performance.  
   **Recommandation/test :** pagination fonctionnelle, périodes/filtres bornés et agrégats serveur ; vérifier qu’un affichage de page conserve un nombre borné de requêtes lorsque l’historique augmente.

8. **P2 — Les objectifs de couverture ne sont pas des gates exécutables.**  
   Références : [apps/web/vitest.config.ts:5](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/vitest.config.ts:5), [package.json:17](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/package.json:17), [scripts/release/run-checks.mjs:19](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/release/run-checks.mjs:19).  
   **Preuve reproductible :** aucune collecte ni aucun seuil de couverture dans les manifests/configurations et workflows examinés ; le collecteur vérifie le nombre de tests passés, pas les branches couvertes.  
   **Impact :** des milliers de tests verts ne démontrent pas les objectifs requis pour les règles financières et transitions critiques.  
   **Exigence :** GM §25.1 : couverture mesurée, notamment des branches critiques, sans tests artificiels.  
   **Recommandation/test :** produire les mesures et les rattacher au candidat ; faire échouer le gate sur les seuils prescrits.

9. **P2 — Les six échecs unitaires transmis correspondent à des contrats de tests désynchronisés.**  
   Références : [access-readiness.test.tsx:75](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/modules/franchise/screens/access-readiness.test.tsx:75), [mandate-choices.test.tsx:10](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/modules/franchise/data/library/mandate-choices.test.tsx:10), [provider-dossier.test.tsx:12](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/modules/franchise/data/network/provider-dossier.test.tsx:12), [connected-space.test.ts:14](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/modules/shared/lib/account-security/connected-space.test.ts:14).  
   **Causes vérifiées sur source :**
   - les rendus statiques des sélecteurs ne fournissent pas le contexte requis par `useRouter` ;
   - le dossier provider attend `AVAILABLE`, alors que le rendu traduit le statut ;
   - le test connected-space attend une reconnexion sur 403, tandis que le [classificateur:6](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/apps/web/modules/shared/lib/auth/read-failure.ts:6) et son propre test exigent `UNAVAILABLE`.
   
   **Impact :** suite actuellement rouge ; ces échecs ne démontrent pas à eux seuls une panne utilisateur.  
   **Exigence :** GM §§25–28, tests cohérents et verts.  
   **Recommandation/test :** rétablir les fixtures Router et les attentes métier/localisation convenues, puis rejouer ces quatre fichiers sous Node 22 supporté.

10. **P2 — Les preuves tooling ne sont pas reproductibles sur Windows sans prérequis supplémentaires.**  
    Références : [scripts/release/manifest.test.mjs:53](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/release/manifest.test.mjs:53), [scripts/prepare-vercel-web-output.mjs:49](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/prepare-vercel-web-output.mjs:49), [scripts/release/no-placeholders.test.mjs:18](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/scripts/release/no-placeholders.test.mjs:18).  
    **Preuve :** les deux `EPERM` communiqués correspondent aux créations de symlinks ; le troisième échec compare un chemin Windows à une regex imposant `/`.  
    **Impact :** les 3 échecs tooling ne prouvent pas trois défauts applicatifs ni une défaillance du déploiement Linux. Ils empêchent cependant la reproduction locale annoncée.  
    **Exigence :** GM §§5.2 et 28.  
    **Recommandation/test :** documenter l’environnement canonique et les prérequis symlink ; normaliser les chemins des assertions, sans supprimer le test de protection contre la sortie du checkout.

**Contrôles locaux et points conformes**

- Validateurs frontières, traçabilité et marqueurs incomplets : **PASS**. Leur portée limitée est décrite ci-dessus.
- Intégration HTTP Outbox ciblée : **3/3 PASS**, sans skip. Les tests exécutent le vrai dispatcher/poller sur loopback et vérifient rejet HTTP, conservation de l’identité au retry et refus d’un ACK manquant.
- Test ciblé du résumé navigateur : **1/1 PASS**.
- Le runner navigateur strict refuse effectivement rapports vides, skipped, flaky et échecs attendus.
- Le manifeste vérifie SHA candidat, fraîcheur, hash des artefacts et confinement des chemins après résolution des symlinks.
- Le registre contient bien les **68 fonctions V1** : cinq déclarées `VERIFIED`, 63 `IN_PROGRESS`. Ce décompte de statuts ne constitue pas une recertification des cinq fonctions.
- Le dossier de remise indique explicitement son absence de signature ; les runbooks ne présentent pas une restauration locale comme une restauration staging certifiée.
- Le test Storage natif est conditionnel et ignoré sans activation explicite. Son skip ne doit pas devenir une preuve Storage positive ; le collecteur release rejette les skips.

**Limites et preuves encore nécessaires**

Les résultats globaux suivants viennent du coordinateur ; je n’ai pas relancé ces suites ni inspecté leurs logs dans ce checkout : typecheck PASS ; web 6 failed / 4 186 passed / 1 skipped ; worker 183 passed ; tooling 100/103. L’environnement communiqué est Windows/Node 24.11, tandis que les manifests déclarent Node 22.

Aucune certification distante de déploiement, rollback, restauration DB+Storage+files, RPO/RTO ou performance staging n’est accordée. Ces preuves restent explicitement attendues dans les [runbooks de déploiement](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/docs/release/DEPLOYMENT_RUNBOOK.md:3) et de [restauration](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-a81a109f/docs/release/BACKUP_RESTORE_RUNBOOK.md:3). Aucune fuite tenant, corruption financière ou panne de production n’a été démontrée par cet audit statique.

**Ordre de correction recommandé :** sécuriser la cible SQL et empêcher la certification d’une suite filtrée ; rétablir les gates rouges dans l’environnement supporté ; renforcer les visas et la configuration TypeScript ; traiter ensuite frontières effectives, erreurs, volumétrie et couverture. Les preuves de staging devront être rattachées au nouveau candidat après corrections.

