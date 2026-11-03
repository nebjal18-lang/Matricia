# Publication juridique

Les coordonnées ne sont jamais déduites de la marque Matricia. L’éditeur doit fournir et valider les paramètres publics suivants dans la configuration serveur :

- `LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_FORM`, `LEGAL_ENTITY_ADDRESS`, `LEGAL_REGISTRATION_ID`
- `LEGAL_PUBLICATION_DIRECTOR`
- `LEGAL_HOST_NAME`, `LEGAL_HOST_ADDRESS`
- `LEGAL_PRIVACY_EMAIL`
- `LEGAL_RETENTION_FR`, `LEGAL_RETENTION_AR` : formulation de conservation approuvée dans les deux langues
- `LEGAL_TERMS_APPROVAL_REFERENCE` : référence documentaire de validation des conditions et de la politique de confidentialité

`legalPublication().ready` reste faux tant qu’un champ manque. La présence des champs décrit la complétude de configuration ; elle ne remplace pas la validation juridique ni la recette client. Les valeurs sont publiques, sauf la référence interne qui ne s’affiche pas dans le site. Aucun secret ne doit figurer dans ces paramètres.

Les acceptations de l’inscription portent les versions `2026-10-31` de conditions et confidentialité. Toute modification de version nécessite un nouvel accord côté formulaire et la mise à jour de la validation SQL. Les reçus sont associés à l’adresse confirmée par OTP et la preuve est persistée après authentification. La rétention et l’archivage de cette preuve doivent être inclus dans la politique approuvée.

Les cookies publics ne portent plus de faux consentement de recontact local. Les paramètres de courriel et notification sont liés au compte depuis `/fr/notifications` ou `/ar/notifications`.

La page connectée `/[locale]/connexion/consentements`, accessible depuis la sécurité du compte, propose une réacceptation explicite et conserve chaque ancienne preuve. Le serveur enregistre un snapshot immuable des conditions, de la confidentialité et des informations publiées ; PostgreSQL calcule son SHA-256. Un texte ou une configuration modifié sous le même couple de versions est refusé (`LEGAL_TEXT_VERSION_COLLISION`) : modifier explicitement `TERMS_VERSION` et `PRIVACY_VERSION` après validation des textes concernés, puis déployer le même jeu FR/AR. Une instance ancienne ne peut pas rétablir une version dépassée. La réacceptation reste proposée ; aucune règle de blocage juridique global n’est déduite automatiquement. Les preuves initiales d’inscription sont conservées séparément et ne sont jamais antidatées.
