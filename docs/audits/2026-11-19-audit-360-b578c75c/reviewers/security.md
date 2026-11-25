# Revue indépendante — security

Source : agent en worktree isolé au commit b578c75c. Texte de revue conservé comme preuve ; voir FINDINGS.md pour la consolidation, la gravité et les limites actualisées.

Je prends en compte le clone isolé et les résultats du coordinateur. J’ai identifié un horodatage partagé par deux migrations et trois versions absentes du registre local. Autre précision : les ACL SQL actuelles interdisent l’upsert direct des rôles plateforme au `service_role` ; elles bloquent donc l’escalade suggérée par le test avec doublures. Je ne la présenterai pas comme une exploitation confirmée.

Le contrôle MFA central passe en lecture seule : la même RPC est refusée à AAL1, autorisée à AAL2, puis refusée avec un identifiant de session inexistant. La base locale ne contient aucun membership d’organisation, ce qui empêche d’y prouver un ALLOW/DENY inter-tenant avec des acteurs existants. Je distingue cette lacune des contrôles serveur et RLS vérifiés dans le code.

La revue confirme un écart entre le coffre documentaire et son téléchargement : la RLS et la liste du coffre se limitent à Owner/Admin, mais la RPC de téléchargement autorise aussi Buyer/Member/Viewer sans vérifier de partage documentaire. La chaîne démo présente aussi un défaut de fermeture : un refus de persona laisse subsister la session déjà créée. Les contrôles HMAC des paiements et d’authentification/rejeu du scanner passent sur des requêtes locales synthétiques.

Audit terminé sur `b578c75c1c0f076c7fb46b0239d7ab5f2b0afc4c`, en lecture seule. Sources, index Git et données persistées inchangés ; aucun SQL distant exécuté. Les deux modifications staged du coordinateur sont absentes de ce worktree et ne sont pas couvertes.

**Quatre constats retenus. Aucun constat ci-dessous ne démontre une compromission de production. La preuve complète d’isolation inter-tenant reste ouverte.**

Le threat model couvre les frontières suivantes :

| Acteur / surface | Menace examinée | Frontière attendue |
|---|---|---|
| Anonyme : inscription, OTP, démo | Usurpation de courriel, session privilégiée | Auth native, identité vérifiée, MFA |
| Membre, autre organisation, prestataire concurrent | IDOR, accès documentaire, élévation de rôle | Membership actif, rôle et partage explicite |
| Upload / webhook externe | Fichier malveillant, événement forgé ou rejoué | Limites, signature, déduplication, scan |
| Serveur avec `service_role` | Contournement involontaire de RLS | Autorisation utilisateur avant accès privilégié |

1. **AUTH-01 — Élevée sur la configuration locale : l’inscription directe ne prouve pas la possession du courriel.**

   **Preuve.** [supabase/config.toml:175](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/supabase/config.toml:175) autorise l’inscription ; [supabase/config.toml:225](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/supabase/config.toml:225) désactive la confirmation. L’extraction locale limitée aux paramètres non secrets confirme `GOTRUE_DISABLE_SIGNUP=false` et `GOTRUE_MAILER_AUTOCONFIRM=true`.

   La politique des invitations accepte le courriel du JWT dans [supabase/migrations/20260911002100_email_invitations.sql:360](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/supabase/migrations/20260911002100_email_invitations.sql:360). Le garde d’acceptation vérifie `email_confirmed_at`, dans [supabase/migrations/20260911002500_identity_security_hardening.sql:168](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/supabase/migrations/20260911002500_identity_security_hardening.sql:168), mais l’autoconfirmation satisfait précisément cette condition.

   **Reproduction / impact.** Dans un environnement jetable, créer une invitation pour une adresse encore non inscrite, appeler directement `/auth/v1/signup` avec cette adresse, puis lister et accepter ses invitations. Cette chaîne permet de revendiquer une invitation sans accès à la boîte courriel. La configuration et les contrôles SQL sont confirmés ; cette exploitation avec création de compte n’a pas été exécutée.

   **Exigence.** Gold Master §10.1, règles AUTH et séparation des tenants ; `MAT-FUNC-001`.

   **Recommandation / test.** Imposer la vérification côté Auth, puis tester qu’une inscription directe reste inutilisable pour accepter une invitation avant validation réelle du courriel. La configuration Supabase hébergée reste à vérifier séparément.

2. **DOC-01 — Moyenne : le téléchargement élargit les permissions du coffre documentaire.**

   **Preuve.** La RLS réserve les documents Client à Owner/Admin, hors rôles centraux, dans [supabase/migrations/20260911002900_client_compliance_documents.sql:134](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/supabase/migrations/20260911002900_client_compliance_documents.sql:134). La projection du coffre applique cette même restriction dans [supabase/migrations/20261031212000_client_history_search.sql:24](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/supabase/migrations/20261031212000_client_history_search.sql:24).

   En revanche, la RPC `SECURITY DEFINER` autorise également `CLIENT_BUYER`, `CLIENT_MEMBER` et `CLIENT_VIEWER` dans [supabase/migrations/20260922150000_audit_fiscal_invitation_outbox_hardening.sql:489](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/supabase/migrations/20260922150000_audit_fiscal_invitation_outbox_hardening.sql:489), sans vérifier de binding ou de partage documentaire. La route télécharge ensuite avec le client privilégié dans [apps/web/app/api/client/documents/[documentId]/route.ts:60](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/apps/web/app/api/client/documents/[documentId]/route.ts:60).

   **Reproduction / impact.** L’introspection `READ ONLY` des définitions effectives confirme ces listes de rôles différentes. Avec une fixture `CLIENT_VIEWER` et l’UUID connu d’un document VERIFIED/CLEAN de son organisation, le SELECT documentaire et le coffre refusent l’accès, tandis que la RPC accepte son rôle. Cela expose des pièces de conformité hors des permissions établies du coffre. Aucun accès à une autre organisation n’est démontré.

   **Exigence.** Gold Master §§8.2, 8.5 et 24.1 ; `MAT-FUNC-028`.

   **Recommandation / test.** Aligner le téléchargement sur Owner/Admin, ou exiger un partage explicite vers un objet accessible. Ajouter Owner **ALLOW**, Viewer sans partage **DENY**, autre tenant **DENY**, partage révoqué **DENY**. L’exécution complète de cette matrice nécessite des fixtures absentes du snapshot local.

3. **DEMO-01 — Moyenne, impact élevé si un compte non démo est configuré : la validation du persona intervient après les effets Auth.**

   **Preuve.** Une adresse configurable quelconque est acceptée dans [apps/web/app/[locale]/connexion/demo-policy.ts:34](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/apps/web/app/[locale]/connexion/demo-policy.ts:34). Le chemin crée la session, élève son assurance, puis seulement valide le persona dans [apps/web/app/[locale]/connexion/demo-actions.ts:30](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/apps/web/app/[locale]/connexion/demo-actions.ts:30). Le refus redirige sans déconnexion. L’élévation peut supprimer les facteurs TOTP existants dans [apps/web/app/[locale]/connexion/demo-assurance.ts:39](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/apps/web/app/[locale]/connexion/demo-assurance.ts:39).

   **Reproduction / impact.** Exécution des fonctions sources avec doublures en mémoire : refus de persona → redirection `role-missing`, mais session toujours établie ; facteur vérifié supprimé avant validation. Si une adresse non synthétique est configurée, un accès public démo peut donc authentifier ce compte et remplacer sa MFA avant le refus.

   **Exigence.** Gold Master §§10.1, 23 et 24.1 : identité, données synthétiques et autorisation serveur.

   **Recommandation / test.** Valider les métadonnées administratives du compte synthétique avant toute génération de lien ou opération MFA ; fermer la session sur échec. Tester le refus d’un compte non démo avant tout effet Auth et la conservation de ses facteurs.

   **Contournement écarté.** Le fallback tente un upsert même après un refus SQL explicite dans [apps/web/app/[locale]/connexion/demo-authorization.ts:32](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/apps/web/app/[locale]/connexion/demo-authorization.ts:32). Toutefois, les ACL locales interdisent SELECT/INSERT/UPDATE de cette table au `service_role` : l’octroi direct n’est donc pas une escalade exploitable confirmée.

4. **MIG-01 — Moyenne : deux migrations des contrôles démo partagent la même version.**

   **Preuve.** Ces deux fichiers portent `20261118160000` :

   - [supabase/migrations/20261118160000_ensure_demo_admin_platform_role_v1.sql:4](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/supabase/migrations/20261118160000_ensure_demo_admin_platform_role_v1.sql:4)
   - [supabase/migrations/20261118160000_reset_demo_box_network_v1.sql:4](C:/Projects/Matricia/Matricia.worktrees/independent-audit-matricia-review/supabase/migrations/20261118160000_reset_demo_box_network_v1.sql:4)

   **Reproduction / impact.** L’inventaire donne **607 fichiers, 606 versions uniques**. L’introspection confirme une clé unique sur `schema_migrations.version` : les deux migrations ne peuvent pas être enregistrées distinctement sous cette version. Cela fragilise la traçabilité et le déploiement des contrôles démo. Aucun replay neuf n’a été lancé par ce reviewer ; son résultat exact reste à établir.

   **Exigence.** Migrations rejouables, gate SQL et contrôles démo cohérents avec le Gold Master.

   **Recommandation / test.** Régulariser avec une version unique selon l’historique réellement appliqué, puis prouver un replay complet sur une base isolée.

Les parcours sensibles suivis de bout en bout sont :

- **Documents Client et consultation prestataire** : identité → RPC → rôle/partage/scan → accès Storage privilégié → réponse privée.
- **Organisation et invitations** : création ou collision ICE → demande de rattachement → décision Owner/AAL2/CAS → membership ; acceptation d’invitation jusqu’au contrôle du courriel.
- **Démo Auth** : garde environnement → magic link → session native → MFA → validation du rôle → navigation.
- **Paiement/upload** : corps borné → signature ou réservation → inbox/scan → traitement privilégié.

Les points conformes vérifiés comprennent :

- MFA centrale : même RPC refusée à AAL1, autorisée à AAL2, puis refusée avec une session inexistante ; contrôles effectués en transaction `READ ONLY`.
- Démo refusée lorsque `APP_ENV` ou `VERCEL_ENV` vaut `production`.
- Sur le snapshot local : aucune table publique lisible par `anon/authenticated` sans RLS ; aucun `SECURITY DEFINER` public/privé sans `search_path` fixé ; aucun droit CREATE sur les schémas examinés pour ces rôles.
- Documents prestataire : contrôle de l’invitation, du partage non révoqué et du scan avant accès privilégié.
- HMAC paiement : événement valide accepté ; montant modifié et signature forgée refusés.
- Scanner HTTP local : mauvais bearer refusé avant scan ; requête valide acceptée ; nonce rejoué refusé.
- Suite d’intégration HTTP Outbox : **3/3 tests réussis**.
- Recherche ciblée de secrets dans 4 526 fichiers texte suivis : aucun secret réel identifié par les motifs utilisés ; candidats limités à des fixtures.

Les limites restantes sont explicites : snapshot local à **603 versions enregistrées**, trois versions de fichiers absentes du registre malgré certaines RPC déjà présentes ; aucun membership d’organisation disponible pour une preuve dynamique inter-tenant ; OTP expiré/réutilisé, concurrence et parcours documentaires complets non rejoués. La suite du coordinateur sur le clone isolé était encore en cours, et ses résultats ne sont pas revendiqués ici.

Les advisories Next signalées par le coordinateur restent des dépendances à examiner : aucune activation de `cacheComponents` ou de directive `use cache` trouvée dans le périmètre applicatif inspecté, donc aucune exploitation confirmée à ce titre.

