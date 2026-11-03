# Rapprochement documentaire Finance — accès administrateur et reprise

La route réelle est `/{locale}/administration/finance/rapprochements-couts`. Un lien visible « Examiner les justificatifs de coûts » est ajouté à l’index Finance dans les deux langues. Le retour vers Finance, la recherche et la pagination sont des liens fonctionnels.

## Périmètre et autorisation

La page passe par le cadre administrateur protégé. Le DAL `loadAdminFinanceCostTargets` exige un rôle de lecture Finance autorisé et une assurance satisfaite avant d’appeler la projection native `list_finance_cost_reconciliation_targets_v1`. La base reste l’autorité des dossiers éligibles et de `canUpload`. Les combinaisons auditeur/Finance restent en lecture seule ; une capacité d’écriture contradictoire reçue du serveur est rejetée.

Une session absente, un second facteur requis, un rôle refusé, un schéma non appliqué et une panne technique sont distincts. Le lien profond reprend la recherche et la page après authentification. Une erreur ne devient pas une liste vide. Une recherche invalide propose un vrai retour à la recherche. La pagination est bornée à vingt dossiers et conserve le terme saisi ; la limite supérieure demande d’affiner la recherche plutôt que produire un lien invalide ou dissimuler des résultats.

Le panneau reçoit seulement les cibles autorisées et leurs libellés métier, puis relit les pièces et propositions du dossier choisi. Aucun UUID libre n’est demandé.

## Reprise d’une analyse documentaire

Pour une pièce déjà envoyée en erreur, le membre habilité renseigne un motif, puis utilise `retry_finance_cost_document_scan_v1`. Le navigateur appelle ensuite POST `/api/finance/cost-proofs/uploads/{id}` sur **le même document**, afin de faire revalider les octets et déclencher la reprise native. Il n’envoie aucun verdict ni nouveau fichier.

Une reprise effectivement enregistrée suivie d’une panne de transfert demeure un état partiel explicite : le motif et l’événement ne sont pas perdus, mais aucun résultat CLEAN n’est prétendu. Les refus d’auteur, de rôle, de MFA ou de bail actif restent des refus. Le bouton sur les documents historiques dépend de `can_retry` calculé côté serveur ; son absence ne vaut jamais autorisation. Les anciennes preuves et décisions ne sont pas supprimées.

## Vérifications de l’auteur

- Groupe ciblé : **126 tests dans sept fichiers**, dont les 52 tests UI précédents et 24 tests d’adaptateur backend existants. Les nouveaux scénarios couvrent le DAL, la page SSR FR/AR, les droits/MFA, les incidents, la pagination, la reprise et les réponses partielles. Ces nombres ne s’additionnent pas à une suite Web qui les contient déjà.
- ESLint ciblé : PASS. Graphe TypeScript isolé : PASS. `git diff --check` : PASS.
- Commandes et résultats exacts : `evidence/zero-cost-route/checks.json`.

Aucun test SQL, scanner réel ou parcours navigateur hébergé n’est revendiqué par ce lot UI. L’intégration finale doit vérifier ces parcours sur les migrations et adaptateurs correspondants ; une absence d’antivirus ne doit produire aucune preuve de sécurité fictive.
