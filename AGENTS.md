# Matricia — règles permanentes des agents

## Autorité et périmètre

- La seule source d’autorité est `Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md` (Gold Master V4 FINAL). Ignorer toute version antérieure ; en cas de doute ou conflit, le relire et appliquer sa règle la plus spécifique.
- V1 comprend obligatoirement `MAT-FUNC-001` à `MAT-FUNC-068`, implémentées et prouvées. `MAT-FUNC-069` à `MAT-FUNC-090` sont hors périmètre V1.
- La direction obligatoire est **Design Authority Version A — Moderne & Professionnelle**, appliquée par un design system partagé à tous les espaces.
- Ne modifier aucun environnement de production, donnée de production ou secret de production sans autorisation explicite.

## Architecture, données et sécurité

- Utiliser TypeScript strict, des modules par domaine, des contrats explicites et une architecture professionnelle maintenable. Aucune logique métier critique dans l’UI.
- Utiliser Supabase/PostgreSQL avec RLS restrictive par défaut, autorisation serveur et isolation multi-tenant systématique : aucune donnée d’une organisation ne doit être lisible ou modifiable par une autre.
- Ne jamais afficher, logger, documenter ni committer une clé, un token, un mot de passe ou un secret. `.env.local` est strictement interdit dans Git ; seules les clés documentées sans valeurs vont dans `.env.example`.
- Représenter les montants en unités mineures ou décimaux exacts : jamais de `float`. Les TVA/règles marocaines passent par un moteur fiscal daté, administrable et versionné — jamais hardcodé.
- Les ledgers financiers et de crédits sont immuables ; ne jamais modifier directement un solde. Toute mutation financière sensible est transactionnelle, idempotente, auditée et émet ses événements via l’Event Outbox.
- Auditer toute action sensible et versionner devis, contrats, questionnaires, catalogues et règles financières/fiscales.

## Produit et qualité

- Livrer FR et AR avec RTL natif ; les parcours critiques doivent fonctionner à partir de 360 px et respecter accessibilité (clavier, libellés, contraste, lecteurs d’écran).
- Aucun `TODO`, `FIXME`, `TBD`, placeholder, bouton inactif, écran vide, formulaire incomplet ou workflow V1 fictif dans le périmètre livré.
- Les tests unitaires, intégration, SQL/RLS, E2E, accessibilité et sécurité sont obligatoires. Prévoir un audit indépendant de qualité, sécurité/red team et tests avant de fermer une phase.
- Mettre à jour `PROJECT_STATE.md` (emplacement défini par le Gold Master) après chaque phase verte, avec traçabilité, résultats de tests et prochaine étape.

## Catalogue et collaboration

- Employer les skills pertinents et charger le contexte de manière ciblée. Ne jamais charger les 6 000 questions du catalogue si la tâche ne l’exige pas ; filtrer à la bibliothèque, au service ou au sous-ensemble utile.
- Pour l’expérience commerciale, appliquer la refonte guidée documentée dans `docs/refonte-sans-catalogue/` : le catalogue reste un référentiel interne, jamais une étape imposée au client ou au fournisseur.
- Travailler en multi-agents seulement pour des périmètres indépendants, avec une branche/worktree par domaine. Un seul propriétaire en écriture par fichier, migration et fichier partagé ; les agents d’audit restent indépendants du code audité.

## Règles franchise et pot plateforme

- Franchise IT : Hatim Ahmitech, droit d’entrée nul ; partage du bénéfice distribuable IT à 50 % Hatim Ahmitech / 50 % Jalil-NEOXA. Mme Asma/Matricia : 0 % pour cette distribution IT.
- Les autres franchises suivent les règles contractuelles versionnées du Gold Master ; à défaut : 50 % franchisé / 25 % Jalil-NEOXA / 25 % Mme Asma-Matricia, sur une base distribuable versionnée.
- Pot distinct Core + droits d’entrée (hors IT) : après marketing et charges versionnées affectées à ce pot, le reste est partagé 50 % Jalil-NEOXA / 50 % Mme Asma-Matricia. Ce pot ne remplace pas les parts franchise ci-dessus. Détail : `docs/finance/REGLE_ECONOMIQUE_PARTENARIAT_CORE_ENTREE_V1.md`.
