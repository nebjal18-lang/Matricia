# Sécurité, données et finance

## Verdict

**NO-GO production** tant que les constats de gravité haute et les permissions contradictoires ne sont pas résolus puis revérifiés. Aucune compromission de production ou fuite entre organisations n'a été démontrée. Le refus inter-tenant documenté ci-dessous ne certifie pas toute la matrice RLS.

## Frontières et preuves

| Frontière | Vérifié | Limite |
|---|---|---|
| Anonyme → espaces protégés | 12 redirections FR/AR vers connexion | Pas une matrice complète d'API/rôles |
| Tables publiques → RLS | 681/681 activées dans le snapshot | Activation ≠ exactitude des policies |
| Document → rôle/tenant | Owner SELECT+RPC autorisés ; Viewer SELECT refusé mais RPC autorisée ; autre tenant refusé | Métadonnées/scan synthétiques, pas de binaire Storage |
| Core → journal | Journal dépense 100 accepté comme revenu Core 10 000 | Finance autorisé, rollback, pas de virement |
| Core → clôture différée | Erreur native 42501 confirmée | Aucun commit conservé |
| Core → période/rejeu | Diagnostic de droits doublés et idempotence incorrecte | Validation des contraintes en propriétaire ; risque latent, pas double versement natif démontré |
| Concurrence | Outbox/journal/crédit/audit : quatre scénarios à deux connexions PASS | Pas toutes les state machines |
| Dépendances | Deux avis Next modérés identifiés | Préconditions Cache Components non trouvées ; exploitation non confirmée |

## Invariants économiques

Les trois flux sont bien représentés séparément dans le schéma/règles : IT 50 % Hatim / 50 % Jalil / 0 % Asma et entrée nulle ; STANDARD 50/25/25 sauf contrat spécifique ; reste du pot Core+entrées hors IT 50/50 Jalil/Asma après déductions affectées. Les stocks/ledgers ciblés ont des protections d'immutabilité et les montants économiques utilisent bigint/décimaux. Ces points structurels ne valident pas le rapprochement économique réel de FIN-01 à FIN-05.

Le test du pot Core 0386 passe ses 24 assertions surtout structurelles et de fragments SQL, tandis que les sondes natives trouvent un défaut de provenance et un blocage ACL. La présence des mots idempotency/audit/outbox dans une fonction ne prouve pas leur bon comportement.

## Risques retenus

- [FIN-01](./FINDINGS.md#fin-01) — Haute : Le pot Core reconnaît un revenu sans rapprochement avec le journal. Preuve : SQL natif, contraintes validées sous authenticated.
- [FIN-02](./FINDINGS.md#fin-02) — Haute : La clôture du pot Core échoue lors de la vérification différée. Preuve : SQL natif et ACL effectives vérifiées.
- [FIN-03](./FINDINGS.md#fin-03) — Haute : Les périodes chevauchantes accumulent deux fois les mêmes droits. Preuve : Code + diagnostic SQL avec validation propriétaire.
- [FIN-04](./FINDINGS.md#fin-04) — Haute : Les sources remboursées ne sont pas revalidées avant distribution Core. Preuve : Analyse source et définitions SQL.
- [FIN-05](./FINDINGS.md#fin-05) — Moyenne : Les reprises Core et volume vérifient trop tôt l'état modifié. Preuve : Diagnostic SQL + analyse source.
- [FIN-06](./FINDINGS.md#fin-06) — Moyenne : Le formatter monétaire fusionne deux montants bigint distincts. Preuve : Exécution de la fonction source importée.
- [DATE-01](./FINDINGS.md#date-01) — Moyenne : Le décalage fixe UTC+1 peut afficher un autre jour civil. Preuve : Exécution source contre Intl/Africa/Casablanca.
- [SEC-01](./FINDINGS.md#sec-01) — Moyenne : Le téléchargement documentaire autorise un Viewer exclu du coffre. Preuve : Matrice SQL ALLOW/DENY, sessions synthétiques et RLS actives.
- [SEC-02](./FINDINGS.md#sec-02) — Moyenne : La démo valide le persona après la session et les effets MFA. Preuve : Source + doubles en mémoire.
- [SEC-03](./FINDINGS.md#sec-03) — Moyenne : L'autoconfirmation locale ne prouve pas la possession du courriel. **Risque conditionnel**, pas exploitation confirmée.
- [DEP-01](./FINDINGS.md#dep-01) — Moyenne : Next.js 16.4.1 est inclus dans deux plages d'avis de sécurité. **Risque conditionnel**, pas exploitation confirmée.

### Avis de dépendance

Next 16.4.1 figure dans les plages affectées ; les avis officiels annoncent le correctif 16.4.5 : [GHSA-mfr8-8qww-v76h](https://github.com/vercel/next.js/security/advisories/GHSA-mfr8-8qww-v76h), [GHSA-vc7v-qv4w-wrv8](https://github.com/vercel/next.js/security/advisories/GHSA-vc7v-qv4w-wrv8). Le scan n'est pas une preuve d'exploitation. Aucune mise à jour n'a été appliquée dans cette mission d'audit.

## Menaces résiduelles et conformité

OTP expiré/réutilisé, tous rôles révoqués, matrices Storage réelles, signatures externes, paiements doublés du PSP réel, restauration de fichiers et tests de charge adversariaux ne sont pas certifiés. Les contrôles HMAC/scanner synthétiques et la MFA en lecture seule sont rapportés par le reviewer, avec leurs limites dans [reviewers/security.md](./reviewers/security.md).

Aucune opinion juridique ou comptable finale : l'audit vérifie des invariants logiciels et le référentiel fourni, pas la validité courante de tous les taux/textes réglementaires marocains. Les validations professionnelles externes restent nécessaires.

## Isolation

Database de test : matricia_audit_20261119_b578c75c, séparée de postgres local partagé. Restauration du snapshot sans pg_cron ; trois migrations existantes et le hook propre à la base appliqués uniquement au clone dans une seconde phase de diagnostic. Les sondes reviennent à zéro organisation ; aucun flux externe réel.

Revues indépendantes : [reviewers/security.md](./reviewers/security.md), [reviewers/finance.md](./reviewers/finance.md), [reviewers/finance-acl.md](./reviewers/finance-acl.md), [reviewers/finance-final.md](./reviewers/finance-final.md).
