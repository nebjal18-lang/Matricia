# Administration — corrections du 3 novembre 2026

Base : `nebjal18-lang/Matricia`, branche par défaut `codex/audit-final-2026-09-15`, commit `d481bb63a2e39af1a5dd1f6bf4383fc1c1e14432`.
Branche de correction : `codex/admin-corrections-20261103`.

## Défauts corrigés

- La file de traitement trie par gravité puis échéance, conformément au Gold Master §22.2. Une tâche LOW du jour ne passe plus avant une alerte CRITICAL en retard. Les compteurs du jour gardent le fuseau Africa/Casablanca.
- La file « À traiter aujourd’hui » est ouverte et présentée avant l’annuaire. Son identifiant est distinct de celui du panel. Les raccourcis des tâches ouvrent leur carte exacte, en conservant le contexte organisation.
- La fiche entreprise ne déduit plus la conformité de l’absence de litige. Les rôles Client/Provider et l’identité canonique doivent être vérifiés ; un snapshot Client périmé prévaut sur l’ancien libellé VERIFIED. Un litige indépendant n’invalide pas une conformité prouvée.
- La fiche ne présente plus une inscription comme prouvée sans source. La présence d’un diagnostic brouillon, d’une demande ou d’une mission n’est plus une preuve de parcours terminé ; les étapes montrent le nombre d’enregistrements disponibles.
- Activité, IF et RC proviennent du profil légal disponible. Le pays est identifié séparément. Une donnée absente est signalée comme indisponible.
- Seules les adhésions INVITED sont comptées comme invitations. Les rôles de toutes les adhésions sont visibles. Les liens de gestion des membres définissent à la fois le contexte `organizationId` et le filtre d’annuaire `org`, sans reprendre des filtres étrangers.
- Les abonnements ne sont plus comptés comme Boxes actives. Les états et fins de période sont nommés explicitement. Les compteurs de dossiers sont libellés selon leurs sources réelles : demandes, litiges, diagnostics et missions.

## Validation

Les nouveaux tests couvrent FR/AR, identité inconnue/périmée, organisation multirôle, litige indépendant, diagnostic brouillon, tâche critique en retard, minuit à Casablanca, adhésions suspendues/révoquées, profil légal et liens filtrés. Un test de composition de page vérifie la file ouverte avant l’annuaire sans recherche.

- Suite Admin : 94 fichiers, 567 tests PASS, aucun test ignoré.
- TypeScript web et lint web : PASS, avec contrôle lint ciblé des derniers fichiers modifiés.
- Validateur Server Actions : 1 951 fichiers source contrôlés.
- Chromium : 8 scénarios du menu administrateur FR/AR à 375, 390, 768 et 1 440 px. Ce sont des tests de géométrie et de clavier synthétiques, sans session Admin native.
- Revue indépendante en lecture seule : aucun défaut bloquant résiduel repéré dans le lot ; les deux remarques sur les liens membres et le volet fermé ont été corrigées puis revues.

Compilation Next complète : PASS, avec vérification TypeScript et génération des pages. Les variables publiques Supabase et l’URL HTTPS du site étant absentes du nouveau checkout, cette vérification emploie des adresses locales et une valeur de compilation synthétique ; elle ne valide aucune connexion Supabase ni aucun déploiement.

## Limites et suite

Ce lot corrige les défauts d’affichage, de priorité et de navigation identifiés. Il ne constitue pas une recette complète de toute l’administration. Aucune migration SQL, modification de RLS, commande financière, donnée distante ou configuration de production n’a été modifiée.

La recette authentifiée avec une vraie session Admin AAL2 et la vérification des RPC sur une base de test restent à réaliser. Les exécuteurs de confidentialité/effacement et exports volumineux déjà signalés dans `docs/audit-livraison/ADMIN_DELIVERY_STATUS_2026-11-01.md` ne sont pas déclarés terminés par ce lot. Les indicateurs Boxes/crédits de la fiche exigent une projection autoritative avant d’afficher une valeur.
