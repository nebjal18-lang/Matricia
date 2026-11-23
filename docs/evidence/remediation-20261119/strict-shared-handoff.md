# ARCH-01 ? handoff shared

P?rim?tre : modules/shared, hors read-pages*, display* et account-security/connected-space.test.ts. Aucun fichier de ces exclusions, autre module, configuration TypeScript, package ou lockfile modifi?. Pas de d?ploiement. Ce constat ne vaut pas validation globale de la phase.

## Contrats centraux ? int?grer

- classifyAuthReadFailure : name et status acceptent explicitement undefined comme AuthError Supabase (commit cb36e5f7).
- OtpLengthEnv, PublicSupabaseInput et PreviewEnvironment : champs d'environnement optionnels acceptant explicitement undefined ; la configuration DEMO omet demoWebhookSecret en son absence (cb36e5f7).
- resolveConnectedSpace : organizationId optionnel accepte explicitement undefined ; AuthorizedOrganizationMembership.displayName aussi.
- Benefit et Box : les propri?t?s facultatives ?mises par les projections de catalogue acceptent explicitement undefined ; DisputeDetail.evidenceOptions et la retraite facultative des livrables de mission suivent la m?me s?mantique.
- AdminProcessStrip.blocker et MissionAmendmentExecution.returnPath acceptent explicitement undefined. Les options des composants externes sont transmises uniquement lorsqu'elles sont d?finies.

Les consommateurs ne doivent pas ajouter de conversions locales compensant ces contrats. Les relations, champs index?s, adresses et fixtures sont v?rifi?s avant acc?s ; les configurations r?seau et projections restent ? ?chec ferm?.

## V?rifications

Node v22.21.1, d?pendances locales au worktree, installation pnpm --frozen-lockfile --offline --ignore-scripts. Compilation compl?te apps/web avec tsc --noEmit --incremental false --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noImplicitOverride --noFallthroughCasesInSwitch --pretty false : **0 diagnostic dans modules/shared** ; sortie globale 2, 667 diagnostics hors modules/shared dans ce checkout, ? traiter par leurs propri?taires. Le journal int?gr? de r?f?rence est docs/evidence/remediation-20261119/integrated-types-01.log dans le checkout principal. Refaire la compilation apr?s int?gration des autres branches.

ESLint sur tous les fichiers shared modifi?s : r?ussi. Vitest cibl? : 11 suites, 129 tests r?ussis ; second groupe : 6 suites r?ussies, 58 tests r?ussis et une suite exclue comportant 1 ?chec sur 11. Dans account-security/connected-space.test.ts, le cas 403 attend UNAUTHENTICATED alors que classifyAuthReadFailure renvoie UNAVAILABLE ; cette suite appartient au root et n'a pas ?t? modifi?e. Les 63 tests du premier commit ?taient ?galement r?ussis. git diff --check : r?ussi.

Ce travail ne constitue ni un audit ind?pendant, ni une validation de release, ni un r?sultat de build ou d'E2E global. Les propri?taires doivent int?grer les commits et revalider le diagnostic complet et le test 403 dans l'?tat int?gr?.
