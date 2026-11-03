# Coût nul — dépôt et examen documentaire Finance

Ce lot fournit l’interface et les adaptateurs navigateur pour une absence de frais prouvée. Il ne transforme jamais une donnée absente en zéro et n’écrit aucun journal financier. L’admission, le rapprochement et la validation indépendante restent dans les commandes serveur du lot Finance.

## Intégration

Importer `FinanceCostProofPanel` depuis `modules/admin/screens/pnl/finance-cost-proof-panel`. Le parent fournit `locale`, le chemin protégé courant `returnPath`, et un `workspace` discriminé :

- succès : `targets` autorisés `{id,component,label}`, `canUpload` calculé côté serveur, éventuellement des propositions initiales ;
- erreur : raison explicite `UNAUTHENTICATED`, `MFA_REQUIRED`, `FORBIDDEN`, `QUERY_FAILED` ou `INVALID_RESPONSE`.

Les propositions initiales ne sont pas considérées comme un état actuel : la sélection d’un dossier charge réellement `get_finance_cost_documents_v1`, avec pages de vingt documents/propositions et `has_more`. Une réponse de l’ancien dossier ne remplace jamais celle du nouveau. Une panne de lecture est distincte d’une liste vide. Plusieurs dossiers exigent un choix explicite ; aucun UUID ou hash n’est demandé au membre.

## Contrat et comportement

1. Le membre choisit une cible autorisée et un fichier PDF/JPEG/PNG d’au plus 10 Mio. Le navigateur calcule le SHA-256 des octets et réserve l’intention avec `reserve_finance_cost_document_v1`.
2. La clé de reprise UUIDv8 dépend de l’acteur, de la cible, du composant et des métadonnées réelles du fichier. Une nouvelle tentative du même fichier après interruption ou recharge retrouve cette intention sans stocker de secret ni de fichier dans le navigateur.
3. Le fichier est envoyé au bucket privé `finance-cost-proofs`, sans écrasement. Un conflit Storage409 conduit toujours à une nouvelle vérification serveur des octets via POST `/api/finance/cost-proofs/uploads/{id}`. Le dépôt reste non confirmé si cette étape échoue.
4. Les états `PENDING`, `CLEAN`, `REJECTED` et `ERROR` demeurent distincts. La lecture automatique est bornée ; une reprise manuelle reste disponible. Un contrôle de sécurité propre ne constitue pas une approbation de contenu financier.
5. Une pièce propre permet de soumettre `propose_credit_economic_zero_cost_v1`, avec sa référence immuable et une justification libre. Aucun montant ni booléen de vérification du client ne fait preuve.
6. Un autre responsable autorisé télécharge la pièce via GET `/api/finance/cost-proofs/{id}`. Le navigateur contrôle les octets, le type et le hash reçu ; le serveur conserve le reçu d’accès audité obligatoire avant la décision.
7. L’approbation ou le refus appelle `decide_credit_economic_cost_v1`, sur la source attendue exacte et avec motif. Les capacités de décision viennent du serveur. Le membre n’est jamais déclaré approbateur de son propre dépôt.

Le texte libre, les noms de dossiers et les noms de fichiers restent inchangés en français comme en arabe ; les libellés d’interface et les états sont localisés, avec RTL.

## Vérification effectuée

- **52 tests dans trois fichiers**, incluant vrais octets de `File`, SHA-256, mauvais format/taille, clé de reprise, perte de réponse, Storage409, réponses de cible étrangère, scan non propre, erreurs de droits/MFA, exactitude du téléchargement, pagination et requêtes obsolètes A→B.
- Rendu serveur FR/AR : vrai champ fichier, choix du dossier, lecture seule, chargement sans faux vide, erreur distincte, liens MFA/connexion avec reprise et absence d’URL externe.
- ESLint ciblé et graphe TypeScript isolé réussis ; `git diff --check` propre.

Preuves et commandes : `evidence/zero-cost-ui/checks.json`. Les exécutions SQL du coffre et le parcours navigateur avec scanner sont à vérifier dans l’intégration du parent. Ces 52 tests ne sont ni une recette hébergée ni une preuve de paiement ou de clôture réelle.
