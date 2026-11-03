# Recette navigateur Prestataire — preuves et limites

Cette recette utilise exclusivement une pile locale isolée, des comptes réels de
test authentifiés par GoTrue OTP/TOTP et des documents synthétiques marqués TEST.
Aucune connexion, modification ou disponibilité de Supabase/Vercel/Railway en
production n'est certifiée ici. Aucun déploiement de production n'a été effectué.

Le dernier runtime optimisé vérifié correspond au commit
`5b8b0f738137abee19f6552aef538e906d04f24a`, arbre `apps/web`
`ef4b62c67a4d8ad5a6403e6a4568bd9dc1774c75`. Les mutations antérieures gardent
leur candidat réel ; la matrice finale relit leurs dossiers, sans prétendre les
avoir recréés sur ce dernier commit. Le manifeste global associe les fichiers
publiés à leur taille et leur SHA-256. Les secrets, sessions, clés TOTP, leases de
scan et sauvegardes restent exclus de Git.

## Parcours réellement exécutés

| Domaine | Preuve | Résultat et attribution |
|---|---|---|
| Acteurs et protections initiales | [recette initiale](candidate-one/README.md), [rôles](candidate-one/entry-boundaries.json), [AAL1](candidate-one/reviewer-aal1-boundary.json) | e929 : quinze acteurs distincts, sept invitations natives, OTP et TOTP AAL2 ; 20 contrôles de droits, plus le contre-test séparé AAL1 refusé avec session AAL2 originale conservée. Aucun rôle Client ni essai pour le Provider pendant les parcours métier. |
| Identité, coffre, questionnaire | [identité](candidate-one/identity-reviewed.json), [questionnaire](candidate-one/questionnaire/summary.json) | e929 : 18 étapes natives au total, trois PDF réels et hashes, revue indépendante, questions conditionnelles, refus serveur, hors ligne/reprise et réponses libres conservées FR/AR. |
| Qualification indépendante | [régression RLS](candidate-one/qualification-review-rls-regression.json), [revue corrigée](candidate-two/qualification-reviewed.json) | Trois prérequis de partenariat e929 conservés avec leur attribution et leur reçu initial ; deux décisions réelles sur 894 : sélection explicite du dépôt original, vraies questions/réponses et score moteur figé, score humain distinct, un service approuvé et l'autre à compléter ; auto-approbation refusée. La lecture générale des sessions d'autres acteurs reste fermée. |
| Origine de la consultation | [provenance RFQ](candidate-two/rfq-provenance.json) | Prérequis historiques SQL TEST limités au Client/à la demande et aux références fiscales ; invitation disponible après la qualification Provider réelle. Aucun devis ni qualification Provider injecté. L'onboarding de ce Client historique n'est pas certifié. |
| Consultation et devis | [7 étapes](candidate-two/quotes/summary.json) | 894 : invitation acceptée, un devis mixte ponctuel/récurrent avec option, montants mineurs exacts et règle fiscale TEST gouvernée, brouillon hors ligne/reprise, PDF et pièce privée CLEAN, publication avec confirmation. Brouillon interdit au Client et pièces interdites au tiers. |
| Révision | [3 étapes](candidate-two/quote-revision/summary.json) | 894 : demande réelle du Client, V2 privée puis republiée ; V1 et son historique immuables et lisibles, sans divulgation du brouillon V2. |
| Contrat et mission | [5 étapes](candidate-two/contract-mission/summary.json) | 894 : sélection exacte de V2, PDF FR/AR et hashes, callbacks SDK mock SIMPLE gouvernés, contrat puis mission natifs, affectation du technicien par le propriétaire. Signature NON_CONTRACTUAL_DEMO, sans certification de signature juridique réelle. |
| Livraison et isolement | [6 étapes](candidate-two/delivery/summary.json) | 894 : dépôt V1, quarantaine, scan TEST des octets connus, refus Client motivé, correction V2 puis acceptation indépendante ; second livrable accepté ; rejet V1 conservé. Technicien non affecté puis révoqué refusé en lecture, téléchargement et dépôt. |
| Messagerie privée | [4 étapes](candidate-two/messaging/summary.json) | 894 : vrai fil canonique, texte et PDF privé, publication après scan natif, téléchargement exact Client, refus du tiers, réponse Client après mission terminée, contexte AR et textes libres conservés. |
| Finance courante | [4 étapes et limites](candidate-final/finance-current/summary.json), [fiscalité TEST](candidate-final/finance-current/commission-tax-test-policy.json), [date future et compteurs](candidate-final/finance-current/future-date-and-posting-counters.json) | 5e06 : déclaration réelle du 3 novembre reprise avec la même intention et le même PDF après correction de F13 ; confirmation Client et Finance distincte ; auto-approbation et Finance prématurée refusées. Commission à facturer enregistrée nativement ; date future refusée 22023 et compteurs inchangés. Politique de clôture proposée/approuvée à quatre yeux, scheduler et refus de clôture prématurée réels. Aucun mouvement d'argent exécuté. |
| Mode Client gouverné | [reproduction](candidate-final/mode-client/summary.json), [4 étapes finales](candidate-final/mode-client-final/summary.json) | Activation après tous les parcours Provider seuls : demande propriétaire et décision indépendante AAL2, même organisation/membership, auto-approbation refusée. Retour effectif à l'espace Provider sur 706, sans nouveau compte ni nouvel octroi dans la recette finale. |
| Liens, langue et file Admin | [contre-exemple SPA](candidate-final/navigation-before/document-locale-reproduction.json), [3 étapes finales](candidate-final/navigation-final/summary.json) | 706 : vrai clic SPA FR→AR→FR, même `performance.timeOrigin`, `html.lang/dir` corrects et dossier conservé ; marque/accueil restent Provider après double rôle ; file Admin et recherche réelles rétablies tandis que SELECT général organisations = 0. |
| Build final | [reçu](candidate-final/build.json), [journal](candidate-final/build.log) | 5b8b0f : build webpack optimisé complet, TypeScript exécuté, serveur local démarré ; aucun déploiement de production. |
| Garde du harnais | [15 tests](candidate-final/helper-guard-tests.json) | 15 PASS : cibles, source de restauration, ACL, provenance, migrations immuables et refus des environnements non autorisés. |

Les reçus FAILED conservés sont des reproductions antérieures nommées et attribuées,
pas des succès. Les reçus positifs finaux se trouvent dans les dossiers `*-final`
ou les sous-dossiers explicitement nommés après correction. Les versions
`build5e06`, `build5dab` et les mesures `contrast-before`/`contrast-after5dab`
restent des preuves de leur candidat respectif.

## Matrice finale et accessibilité

La [matrice finale](candidate-final/matrix/summary.json) passe **232/232 pages**
(29 routes, dont cinq vrais détails, × FR/AR × 375/390/768/1440), sans erreur
JavaScript ni débordement horizontal détecté. Elle conserve le même dossier,
les menus clavier/toucher et le contexte d'organisation. Les 232 captures sont
jointes ; les résultats axe complets sont disponibles dans l'archive
[raw-summary.json.gz](candidate-final/matrix/raw-summary.json.gz), avec hash du
JSON décompressé dans le résumé.

Les [huit contrôles de menu finaux](candidate-final/account-menu-final/summary.json)
passent : trois actions atteignables au hit-test, ordre Tab et ouverture/fermeture
clavier/toucher à chaque largeur et dans les deux langues. La relecture de la
mission ordinaire vérifie le RPC `signed_scope_pending=false` et l’absence de la
notice en FR/AR ; aucun avenant signé n’a été injecté pour cette capture.

Les **256 scans axe** menus fermés/ouverts n'ont aucune violation automatisée,
mais ont **256 occurrences incomplètes de color-contrast**. Aucune règle n'est
exclue. Les [huit mesures de glyphes finales](candidate-final/contrast-final/contrast-measured.json)
portent sur 56 textes sélectionnés : 48 bornes conservatrices satisfaisantes,
6 mesures de glyphes opaques satisfaisantes et 2 cibles non rendues/non mesurées.
Les quatre cas du libellé arabe corrigé passent de 4,1842 avant correction à
12,5138 après correction (seuil 4,5). Cela ne certifie pas tout le contraste ni
la conformité WCAG complète. Les captures avant/après sont conservées.

Le dernier delta produit ne change que deux renderers de `workbenches.tsx`.
La [reprise ciblée E19](candidate-final/quote-status-localized/summary.json) sur
`5b8b0f738137abee19f6552aef538e906d04f24a` passe **8/8 détails devis**, FR/AR
aux quatre largeurs : badge et vérification utilisent « Sélectionné » / « مختار »,
aucun `SELECTED` visible, même devis révisé V2 et même organisation, trois textes
libres conservés sans traduction, zéro erreur JavaScript ou débordement. Le
[build706](candidate-final/build706.json), la matrice232/256 et les autres reçus706
restent attribués à706. La capture706 montrant `SELECTED` est conservée comme
reproduction ; les huit nouvelles captures montrent la correction. La matrice232
n'a pas été rejouée sur5b8b0f et aucun parcours métier n'a été recréé pour ce delta.

## Limites qui empêchent une clôture totale

- La déclaration du 3 novembre appartient au mois de novembre. Le pré-relevé
  réellement généré porte sur octobre et n'a donc aucune ligne pour cette
  déclaration. Celle-ci attend le cutoff du 30 novembre puis la fenêtre de
  contestation réelle. Aucune date ni ledger n'a été réécrit. Facture clôturée,
  plan de paiement et allocation ne sont pas certifiés par ce navigateur ; les
  tests SQL historiques indépendants doivent rester distingués de ces gestes.
- Les signatures et scans exécutés sont des mécanismes TEST explicitement bornés.
  Fournisseur contractuel de signature, antivirus de production, mouvements
  bancaires, validation fiscale professionnelle et informations légales
  approuvées nécessitent leur propre validation réelle.
- Le cas de nouvel avenant signé en attente de préparation n'a pas été joué dans
  ce navigateur. La mission native vérifiée est le cas ordinaire ; les preuves
  SQL/unitaires de l'avenant restent des preuves distinctes.
- Le mode Client prouve la gouvernance et les liens après double rôle, sans
  refaire ni certifier ici toute la recette Client ou contourner ses prérequis.
- Les incompletes de contraste axe restent explicitement indéterminés hors des
  textes sélectionnés mesurés. Deux cibles non rendues ne sont pas mesurées.
  Aucun certificat WCAG global n'est revendiqué.

Les commandes finales exactes et résultats mesurés figurent dans
`candidate-final/commands.json` et `candidate-final/acceptance-summary.json`.
