# M21 / M22 — informations légales et offres publiques

Base : `39552d7`. Branche de travail : `codex/legal-offers-m21-m22-20261102`.

## M21 — données externes à fournir

Statut : **BLOCKED_DATA** pour une publication définitive. L’interface explique désormais les éléments manquants dans les deux langues ; elle ne déduit aucune identité de la marque Matricia ni aucun hébergeur de la présence d’un outil technique.

| Donnée à fournir et valider par l’éditeur | Configuration existante |
| --- | --- |
| Raison sociale | `LEGAL_ENTITY_NAME` |
| Forme juridique | `LEGAL_ENTITY_FORM` |
| Siège social | `LEGAL_ENTITY_ADDRESS` |
| Immatriculation | `LEGAL_REGISTRATION_ID` |
| Responsable de publication | `LEGAL_PUBLICATION_DIRECTOR` |
| Nom de l’hébergeur | `LEGAL_HOST_NAME` |
| Adresse de l’hébergeur | `LEGAL_HOST_ADDRESS` |
| Contact pour les données personnelles | `LEGAL_PRIVACY_EMAIL` |
| Durées de conservation approuvées FR/AR | `LEGAL_RETENTION_FR`, `LEGAL_RETENTION_AR` |
| Référence de validation des conditions et de la confidentialité | `LEGAL_TERMS_APPROVAL_REFERENCE` |

Sur les quatre pages, seuls les champs absents de la configuration sont signalés comme manquants. La référence interne d’approbation n’est jamais affichée. Une adresse ou une durée non fournie n’est pas remplacée par une valeur supposée. Une configuration complète ne constitue pas une conclusion de conformité juridique.

Le contenu de `documents.ts`, les versions des conditions/confidentialité, le snapshot de consentement et les mécanismes d’acceptation restent inchangés. Les liens Contact/Cookies/FR/AR restent disponibles ; le tableau de confidentialité est contenu et accessible au clavier à 360 px.

La levée du blocage exige les données publiques exactes et leur validation par l’éditeur. Leur absence ne justifie pas d’inventer une entreprise, une adresse, un numéro ou une approbation.

## M22 — offre lisible sans conditions inventées

La projection publique existante `get_public_subscription_plans` reste la seule source des formules, devises, montants en unités mineures et crédits mensuels. Un tableau compare ces données exactes. Aucun prix de démonstration n’est ajouté dans le code et aucun montant nul n’est présenté automatiquement comme une offre gratuite.

Une réponse valide sans formule publiée est distinguée d’une panne de lecture. Une panne propose une nouvelle tentative ; elle ne devient pas une prétendue approbation d’un modèle de vente sur devis. Le contact permet de demander des conditions écrites sans acheter ni activer un plan.

Le périmètre est expliqué : fonctionnalités et quotas à confirmer, essai Client de 30 jours après vérification et activation sans moyen de paiement obligatoire, absence de conversion automatique, Box/crédits et frais de prestation distincts. Premium, Gold et Platinum sont mentionnés pour l’après-essai, sans laisser croire que Gold est l’unique formule possible.

**Données encore nécessaires :** la projection actuelle ne publie pas les quotas ni le détail versionné des privilèges/Box de chaque formule. Ils restent explicitement à confirmer dans l’offre écrite avant souscription. Ce correctif améliore la comparaison et l’orientation ; il ne certifie pas des limites commerciales manquantes ou une souscription de bout en bout. Aucun changement de paiement, de prix, de quota, de règle d’essai, de migration ou de consentement n’est réalisé.

## Validation du lot

Les trois suites ciblées passent : **23 tests**, couvrant le rendu serveur FR/AR, les données absentes et fournies, la confidentialité de la référence d’approbation, les prix exacts, la différence publication vide/panne, et la conservation des signaux Next. Le typecheck web et le lint des cinq fichiers TypeScript modifiés passent également. Aucun serveur ou accès à la base n’est lancé pour cette validation. La recette navigateur et l’audit indépendant relèvent de la validation du candidat intégré.
