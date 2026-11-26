# Revue indépendante — design

Source : agent en worktree isolé au commit b578c75c. Texte de revue conservé comme preuve ; voir FINDINGS.md pour la consolidation, la gravité et les limites actualisées.

Created isolated worktree for branch `agents/independent-audit-matricia-review-2a97d7de`

Je vais auditer les sources dans ce périmètre, sans modifier l’application ni lancer de navigateur ou de serveur. Je vérifierai le commit, les règles et les composants partagés, puis distinguerai les défauts confirmés dans le code des points à vérifier visuellement.

J’applique les skills design system, i18n/RTL/accessibilité et Web Interface Guidelines. Le HEAD correspond bien à `b578c75…` et le worktree est propre : les deux modifications staged du coordinateur ne sont donc pas incluses dans cet audit.

Les tokens partagés utilisent bien l’accent bleu de la Version A. Les primitives de modales prévoient une fermeture nommée et un défilement interne. Je vérifie maintenant leur utilisation dans les parcours, notamment les menus mobiles, la conservation du contexte et les messages destinés aux utilisateurs.

Deux défauts sont confirmés dans les sources : les champs de recherche des espaces connectés suppriment l’outline sans remplacement local, et la restauration du besoin perd l’organisation fournie par l’URL lorsqu’aucun brouillon n’existe. Je vérifie aussi le contraste d’un CTA corail. Les dépendances locales sont absentes ; je ne vais pas les installer dans ce worktree d’audit.

Le calcul donne un contraste de **2,864:1** pour le CTA blanc sur corail, sous les seuils AA du texte normal comme du grand texte. Deux autres écarts sont confirmés : les noms de services arabes sont déclarés en français au lecteur d’écran, et le menu public mobile omet le bouton « Changer d’espace » de son parcours Tab personnalisé.

La revue est terminée et Git reste inchangé. Le rapport distinguera les défauts prouvés par le code et les calculs, les points conformes vérifiés dans les sources, et les contrôles navigateur restants pour le coordinateur, notamment le rendu à 360 px, les superpositions et le focus réel.

Audit source effectué sur `b578c75c1c0f076c7fb46b0239d7ab5f2b0afc4c`. **La conformité UX/UI n’est pas acquise sur ce HEAD.** Aucun rendu navigateur n’a été observé.

Référentiel : Gold Master V4 FINAL, exigences V1 uniquement, notamment MAT-FUNC-054 à 061, §9, §26 et [Design Authority Version A](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:8203).

Constats confirmés dans les sources :

1. **UX-01 — Élevée : le besoin perd l’organisation sélectionnée à la restauration.**  
   [apps/web/modules/public/ui/journey/need-flow.tsx:196](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/modules/public/ui/journey/need-flow.tsx:196).  
   L’initialisation utilise `initialOrganizationId`, mais le fallback après lecture du stockage appelle `blank(initialNeed, initialClassification)` sans cet identifiant. Le composeur choisit ensuite la première organisation autorisée, ligne 307. **Preuve locale exécutée sur les fonctions extraites du fichier :** organisation initiale B → restauration sans brouillon `""` → organisation sélectionnée A.  
   **Impact :** préparer une demande pour une autre organisation que celle affichée par le contexte d’entrée ; aucune fuite interorganisation démontrée. **Exigences :** MAT-FUNC-055/057, reprise du contexte. **Recommandation/test :** conserver l’organisation explicitement sélectionnée ; tester deux organisations, stockage vide, expiré et contenant un ancien brouillon.

2. **UX-02 — Moyenne : changer de langue quitte le détail d’une offre.**  
   [apps/web/app/[locale]/client/demandes/[requestId]/offres/[quoteId]/page.tsx:52](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/app/[locale]/client/demandes/[requestId]/offres/[quoteId]/page.tsx:52).  
   La page ne fournit pas `languagePath`. Le [fallback du shell](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/modules/client/ui/client-app-shell.tsx:22) reconstruit uniquement la destination du menu `requests`. **Reproduction :** ouvrir une offre avec `versionId`, puis utiliser le sélecteur FR/AR : destination construite vers la liste des demandes, sans demande, offre ni version. La chaîne de construction a été vérifiée localement.  
   **Impact :** perte du dossier et de la version consultée. **Exigences :** MAT-FUNC-059, navigation conservant l’état. **Recommandation/test :** transmettre le chemin complet et vérifier FR→AR→FR avec organisation, identifiants et paramètres conservés.

3. **UX-03 — Moyenne : CTA financier corail sous les seuils de contraste AA.**  
   [apps/web/modules/client/ui/client-experience.css:2518](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7ab5f2b0afc4c/apps/web/modules/client/ui/client-experience.css:2518).  
   Le CTA utilise du blanc sur `--mat-coral: #f86b71`. Il est effectivement utilisé pour « Paiements » dans [apps/web/modules/client/screens/spaces/boards.tsx:653](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/modules/client/screens/spaces/boards.tsx:653). **Calcul WCAG exécuté : 2,864:1**, inférieur à 4,5:1 et même à 3:1.  
   **Impact :** libellé difficile à lire. **Exigence :** MAT-FUNC-061. **Recommandation/test :** employer une combinaison sémantique AA ; vérifier les états normal, survol et focus.

4. **UX-04 — Moyenne : le suivi mission impose un thème sombre avec recherche presque blanche sur blanc.**  
   [apps/web/app/[locale]/client/missions/[missionId]/page.tsx:47](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/app/[locale]/client/missions/[missionId]/page.tsx:47).  
   `theme="follow"` impose les couleurs définies dans [apps/web/modules/client/ui/client-experience.css:3232](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/modules/client/ui/client-experience.css:3232) : fond sombre et `--client-ink: #f6f4fb`. Le champ de recherche conserve son fond blanc et utilise cette couleur d’encre. **Contraste calculé : 1,091:1.**  
   **Impact :** texte saisi presque illisible et rupture avec les surfaces claires obligatoires de la Version A. **Exigences :** Version A, MAT-FUNC-061. **Recommandation/test :** rétablir les tokens de surface/texte cohérents ; contrôler recherche et composants du suivi mission.

5. **UX-05 — Moyenne : absence d’indicateur de focus sur les recherches Client/Prestataire/Franchise.**  
   [apps/web/modules/client/ui/client-experience.css:2007](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/modules/client/ui/client-experience.css:2007).  
   `.client-shell-search input` applique `outline: none`, sans remplacement. Sa spécificité `(0,1,1)` dépasse celle du focus global `*:focus-visible`, `(0,1,0)`. Aucun remplacement `focus-within` n’a été trouvé dans les feuilles concernées.  
   **Reproduction :** atteindre la recherche par Tab dans ces shells. **Impact :** position du clavier non signalée. **Exigence :** MAT-FUNC-061. **Recommandation/test :** ajouter un indicateur explicite au champ ou au conteneur ; vérifier Tab/Shift+Tab en FR et AR.

6. **UX-06 — Moyenne : le parcours Tab du menu public mobile exclut « Changer d’espace ».**  
   [apps/web/modules/public/ui/site/public-navigation.tsx:58](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/modules/public/ui/site/public-navigation.tsx:58).  
   Le gestionnaire annule chaque Tab et reconstruit les cibles avec `a[href],button:not([disabled])`, ligne 102. Le changement d’espace utilise un `<summary>`, ligne 22, donc exclu ; les boutons contenus dans ses détails fermés restent sélectionnés par la requête.  
   **Reproduction ciblée :** compte ayant plusieurs espaces, menu mobile ouvert, navigation uniquement au clavier. **Impact :** commande de changement d’espace inaccessible par ce parcours ; risque de focus bloqué sur les boutons cachés. **Exigences :** MAT-FUNC-054/061. **Recommandation/test :** conserver l’ordre natif ou gérer toutes les cibles réellement visibles, dont `summary`. Le comportement final reste à confirmer au navigateur.

7. **UX-07 — Moyenne : la description d’activité seule ne permet pas l’inscription fournisseur.**  
   [apps/web/app/[locale]/(public)/fournisseur/provider-taxonomy-selector.tsx:82](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/app/[locale]/%28public%29/fournisseur/provider-taxonomy-selector.tsx:82).  
   `hasIntent` ignore `activity` : il exige un service sélectionné ou l’ouverture et la saisie de « service non répertorié ». Le CTA d’inscription est retiré du parcours clavier et neutralisé ligne 312. **Évaluation locale exécutée :** description d’activité renseignée, aucun service → `hasIntent=false`.  
   **Impact :** l’entrée présentée comme guidée impose une classification ou une déclaration « non répertoriée ». **Exigence :** règle de refonte sans catalogue imposé du [AGENTS.md](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/AGENTS.md). **Recommandation/test :** permettre de poursuivre depuis une description suffisante et réaliser la classification ensuite.

8. **UX-08 — Moyenne : les noms de services arabes sont annoncés comme français.**  
   [apps/web/app/[locale]/(public)/fournisseur/provider-taxonomy-selector.tsx:231](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/app/[locale]/%28public%29/fournisseur/provider-taxonomy-selector.tsx:231).  
   Les listes et sélections imposent `lang="fr"` aux lignes 231, 257 et 275, alors que le modèle fournit des noms arabes approuvés. Le sous-ensemble IT vérifié contient bien 20 noms de services arabes.  
   **Impact :** mauvaise langue de prononciation pour les technologies d’assistance. **Exigences :** MAT-FUNC-059/061. **Recommandation/test :** utiliser la langue effective du libellé ; contrôler les listes, résultats de recherche et éléments sélectionnés avec un lecteur d’écran.

9. **UX-09 — Moyenne : des formulaires Client exposent des codes internes non traduits.**  
   [apps/web/modules/client/screens/recompenses/value-forms.tsx:10](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/modules/client/screens/recompenses/value-forms.tsx:10).  
   Les options présentent directement `CLIENT`/`PROVIDER` ; la ligne 11 construit le bouton avec `PROFILE_STARTED`, `VERIFIED` ou `ACTIVE`. Les formulaires de mesure affichent aussi `ACCOUNTING_EXPORT`, `SIGNED_REPORT`, etc.  
   **Reproduction :** ouvrir les formulaires correspondants dans les détails des récompenses, en FR puis AR. **Impact :** vocabulaire technique anglais à interpréter pour réaliser une action métier. **Exigences :** MAT-FUNC-059/060. **Recommandation/test :** conserver les codes comme valeurs internes et afficher des libellés FR/AR ; tester toutes les options et transitions.

Points conformes vérifiés, à portée source :

- Tokens partagés bleu/navy et import du socle commun dans les quatre espaces connectés ; contrastes calculés satisfaisants pour blanc/bleu **6,702:1**, navy/blanc **15,644:1**, texte secondaire/blanc **5,305:1**.
- Synchronisation de `lang`/`dir` prévue au démarrage et aux navigations ; propriétés logiques et adaptation RTL présentes.
- Labels explicites sur les recherches et champs OTP ; messages d’authentification associés aux champs et annoncés.
- États indisponible/interdit/organisation manquante différenciés dans [WorkspaceFailure](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/modules/shared/ui/workspace-failure.tsx:10), avec actions de reprise.
- Primitives Dialog/Sheet : fermeture nommée, hauteur bornée et défilement interne ; leur intégration réelle et le retour du focus ne sont pas validés ici.
- Accueil relié directement au diagnostic et au besoin libre ; reprise locale et expiration prévues. Aucun chargement des 6 000 questions.
- Cinq contrôles locaux de `safeReturnPath` réussis : chemin local conservé ; URL externe, traversée, mauvaise locale et caractère de contrôle rejetés.

Checklist navigateur destinée au coordinateur :

- Reproduire UX-01 sans soumettre : deux organisations, URL sélectionnant la seconde, stockage vide puis ancien brouillon.
- Vérifier le changement de langue sur une offre et une version précises.
- À **360 px**, puis avec zoom : cinq espaces, textes longs FR/AR, menus compte, recherche, actions requises et tables denses.
- Contrôler les recherches au clavier, le menu public multiespace, Escape et le retour du focus.
- Vérifier le suivi mission, les CTA corail et les contrastes sur photos/voiles : ces derniers exigent le rendu réel.
- Tester panne réseau et session expirée : message explicite, reprise du contexte, absence d’écran technique générique.
- Contrôler les superpositions et le dock franchise avec clavier virtuel et zone de sécurité ; aucune collision visuelle n’est affirmée par cet audit.

Limites : aucun navigateur, serveur, accès distant ou mutation de données. Les dépendances locales sont absentes : suites Vitest/axe/E2E non exécutées ; les contrôles effectués sont des lectures, assertions Node en mémoire et calculs de contraste. Les modifications staged du coordinateur dans [demo-franchise-applications.ts](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/modules/admin/data/spaces/demo-franchise-applications.ts) et [franchise/data/crm/repository.ts](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review-2a97d7de/apps/web/modules/franchise/data/crm/repository.ts) ne sont pas incluses.

**Sources et Git préservés :** worktree propre, diff index et hors index vides ; aucun livrable écrit.

