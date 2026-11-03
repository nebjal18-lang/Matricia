La sauvegarde d’un service hérité sans lien principal ouvrait un brouillon invalide tant que son parent ne changeait pas. La correction crée le lien PRIMARY DRAFT exact par la commande native, avec autorisation, rejeu, audit et outbox ; versions publiées et approbations indépendantes conservées. Les conteneurs de tableaux défilants deviennent aussi accessibles au clavier.

Base : fusion utilisateur de la PR12, a362abc1. Aucun changement déjà fusionné n’est réappliqué. Aucun merge ni déploiement de production par cet assistant.

Validation : replay neuf559migrations/74fichiersSQL/2833assertions PASS,664tables publiques toutesRLS. Régression0378 RED avant correction puis20assertionsPASS ; revue indépendante favorable. Build strictC3b433PASS. Dernier delta focus :117tests+lint PASS, sans nouveau build optimisé ni recette navigateur complète.

Recette finale partielle et explicitement gelée : OTP/TOTPFRAR et régularisation native2services PASS ; publication bloquée par CATALOG_SCHEDULE_CONFLICT ; dépôt Finance non confirmé (RESERVED/PENDING). Matrice C3 :37PASS/6FAIL/2interrompues ; les6défauts de focus sont corrigés dans le dernier delta mais non rejoués. CI GitHub n’a pas démarré pour facturation ; APIcréationPR Forbidden.

Détails et preuves : docs/franchise-completion/REPORT.md et TRACEABILITY.md. Cette branche doit être revue avant toute fusion ; elle ne constitue pas une certification de livraison de production.
