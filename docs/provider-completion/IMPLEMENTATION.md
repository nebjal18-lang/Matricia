# Parcours Sous-traitant — développement en cours

Source explicite : `codex/client-completion-20261102`, commit `7e01276`.
Branche d'intégration : `codex/provider-completion-20261102`.
Les corrections Client sont conservées. Aucune fusion ou mise en production autorisée dans cette mission.

| Domaine | Propriétaire / worktree | Migrations | Test SQL |
|---|---|---|---|
| Qualification, questionnaire, coffre, capacité | provider_audit_entry / provider-entry | 38000–38999 | 0345 |
| Devis, fiscalité, options et pièces, révisions | provider_quotes / provider-quotes | 39000–39999 | 0346 |
| Facturation, revue indépendante, échéanciers et clôture | provider_audit_delivery / provider-finance | 40000–40999 | 0347 |
| Contrats, avenants, livraisons et affectations | provider_delivery / provider-delivery | 41000–41999 | 0348 |
| Contexte, messagerie, équipe, navigation et traductions | provider_context / provider-context | 42000–42999 | 0349 |
| Identité commune et revue Provider | client_browser_finish / provider-identity | 43000–43999 | 0350 |
| Preuves contradictoires, jours ouvrables et intégration | root / provider-completion | 44000–44999 | 0351 |

Les numéros de migration ci-dessus portent le préfixe `202611020`.
Chaque domaine possède ses fichiers ; `nested-screens.tsx`, `ProviderAppShell` et les branchements de navigation appartiennent au domaine contexte. Les tests et décisions indépendantes précéderont toute clôture. Ce document n'est pas une attestation de réussite.
