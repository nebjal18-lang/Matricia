# Activation externe — registre d’approbations

Statut initial : **NON VALIDÉ**. Remplir les références effectives dans le manifeste du candidat ; aucune ligne ci-dessous n’est une approbation.

| Domaine | À fournir par le responsable habilité | Preuve de fermeture |
|---|---|---|
| Identité légale / CGU / confidentialité | Identité éditeur/hébergeur, finalités, destinataires/transferts, durées et procédures CNDP applicables ; textes FR/AR versionnés | Approbation juridique + acceptation serveur liée à la version |
| Fiscalité / factures / tarifs | Règles et périodes validées, séries/mentions/avoirs, prix publiables et répartition contractuelle | Visa comptable/juridique sur documents générés ; aucune règle DEMO active dans les flux réels |
| Signature | Niveau par type de document, fournisseur, sandbox, scopes et dossier probatoire | Signature/refus/expiration/replay en sandbox et validation du niveau légal |
| PayPal / CMI | Comptes sandbox autorisés, devises, webhooks et domaines ; production désactivée avant autorisation | Intention/capture/échec/remboursement/événements dupliqués et rapprochement observés |
| Email / OTP | Domaine vérifié, SMTP Auth, restrictions des destinataires, remise/bounce et consentements | OTP et messages réellement reçus ; états exacts, lien CTA sûr, bounce/reprise testés |
| IA | Fournisseur et domaine autorisés, quotas, confidentialité, format FR/AR | Réponse réelle conforme, refus, quota, timeout et failover s’il est vendu |
| Réseaux sociaux | Comptes OAuth/scopes/consentements, domaines et sandbox | Publication identifiée, succès ambigu réconcilié, révocation/expiration et chaîne d’attribution vérifiées |
| Web/worker/scanner | SHA Vercel/Railway, réseau privé et bindings via coffre | Cron, Outbox, EICAR, panne/reprise, heartbeat/DLQ et alerte testés |
| Continuité / support | RPO/RTO, sauvegardes, responsabilité et escalade/SLA | Restauration DB+Storage+files indépendante, retour arrière et exercice d’incident |
| Réception client | Périmètre des 68 fonctions et 8 Marketing, profils et données de recette | Procès-verbal du candidat, risques résiduels explicitement acceptés et autorisation séparée de production |

La mise à disposition d’un compte/accès est un prérequis de développement. La validation finale de l’intégration se fait après le raccordement : ne pas créer une dépendance circulaire entre accès et recette finale.
