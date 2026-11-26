# Handoff — remédiation design, FR/AR, montants et dates

## Complément DATE-01 après intégration de d490d036

Le test global sous Node 22.23.5 a révélé une attente périmée dans le premier lot : le 14 novembre 2026 à 22:24 UTC correspond à **22:24** à Casablanca, et non 23:24. Node 22.23.5 utilise ICU 78.3/tzdb 2026e ; le Node 24.11.0 initial utilisait ICU 77.1/tzdb 2025b. La reproduction native donne respectivement 22:24 et 23:24 pour le même instant.

Ce n'est pas une tolérance de test : [IANA tzdb 2026c](https://lists.iana.org/hyperkitty/list/tz%40iana.org/message/7NCXIR252EF7HEZMD7ZGWBEER4RNPZDI/) a introduit le retour à UTC le 20 septembre 2026 à 02:00 heure civile, soit 01:00 UTC. Les [règles IANA 2026e](https://github.com/eggert/tz/blob/2026e/africa) conservent cette transition. L'ancienne assertion 23:24 est remplacée par des résultats exacts pour novembre, les limites de jour et les instants de part et d'autre des trois transitions 2026.

Le helper utilise désormais [une table de 72 transitions IANA versionnée](../../../apps/web/modules/shared/lib/format/display-casablanca-data.ts), identique côté SSR et navigateur. Elle conserve l'historique, dont l'ancien temps local −00:30:20, les transitions Ramadan et la transition de septembre 2026. Ce n'est pas un offset permanent : l'offset est sélectionné selon l'instant dans les données IANA. Les mois, chiffres latins et ponctuations FR/AR sont stabilisés dans le helper pour empêcher aussi les divergences CLDR lors de l'hydratation.

Provenance : TZif Africa/Casablanca distribué par le projet Python [tzdata 2026.5](https://pypi.org/project/tzdata/2026.5/), fondé sur IANA 2026e. Wheel SHA-256 `b683bd1b6659ddcd810ff02ad09ba821d4bf1065072805063eb35c49617905ac`. Données horaires IANA dans le domaine public. Le [générateur](../../../tests/remediation/generate-display-timezone.mjs) vérifie le checksum, lit les transitions TZif 64 bits et refuse un footer comportant une règle récurrente non prise en charge. Aucune dépendance ni configuration ajoutée.

Preuves du complément :

- **20 tests display réussis sous Node 22.23.5 et Node 24.11.0** ; test explicite interdisant tout recours à Intl.DateTimeFormat pour le rendu civil.
- **432 comparaisons exactes réussies** contre l'Intl natif indépendant Node 22.23.5/ICU 78.3/tzdb 2026e : 72 transitions × avant/à/après × FR/AR, via [verify-display-iana.mjs](../../../tests/remediation/verify-display-iana.mjs).
- **2 tests Chromium FR/AR réussis sous chacun des deux Node** : mêmes chaînes exactes dans le helper Node et le helper navigateur, y compris septembre/novembre 2026 et mars 2027. Les oracles attendus sont des fixtures civiles explicites, pas l'Intl potentiellement périmé de la machine.
- TypeScript ciblé, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch` : réussi sous Node 22. ESLint ciblé : réussi.
- Revue indépendante du premier lot, suggestion P3 traitée : deux cas `unauthenticated` FR/AR ajoutés au test UX-02 ; le `next` de connexion conserve demande, offre, organisation et version. Les identifiants restent ceux du findings.json canonique.

Reproduction (remplacer `node22` par le chemin de l'exécutable Node 22.23.5) :

```text
node22 node_modules/vitest/vitest.mjs run --config apps/web/vitest.config.ts apps/web/modules/shared/lib/format/display.test.ts
node22 tests/remediation/verify-display-iana.mjs
node22 --test --test-name-pattern=DATE-01 tests/remediation/design-browser.test.mjs
node tests/remediation/generate-display-timezone.mjs <tzdata-2026.5-py2.py3-none-any.whl>
```

Maintenance : surveiller les nouvelles publications IANA ; toute évolution de Casablanca doit mettre à jour volontairement le snapshot, son checksum/générateur et les fixtures, puis repasser l'oracle indépendant. Les lignes ci-dessous décrivent le premier lot ; sa limite concernant la dépendance aux tzdata de l'hôte est levée par ce complément. La validation globale, la revue indépendante et le déploiement restent au coordinateur.

## Premier lot — état au commit d490d036

Date : 19 novembre 2026. Base du worktree : `b578c75c`.
Source audit lue seulement : `C:/Projects/Matricia/Matricia/docs/audits/2026-11-19-audit-360-b578c75c/findings.json` et revue design associée.

## Corrections livrées

| Constat | Correction | Preuve de non-régression |
|---|---|---|
| FIN-06 | Division/reste BigInt, groupement et chiffres localisés via Intl ; précision conservée jusqu'aux limites bigint signées. Décimales ISO de la devise (JPY 0, MAD 2, KWD 3). Les nombres JS non entiers ou non sûrs sont explicitement refusés : transmettre une chaîne ou un bigint. | Tests FR/AR des deux valeurs 9007199254740992/9007199254740993, limites signées, négatifs dont −1 unité mineure, zéro et devises. |
| DATE-01 | `Africa/Casablanca` remplace UTC+1 fixe. | Tests 2025/2026, minuit et instants immédiatement avant/après les transitions 2026 ; comparaison Node/Chromium FR/AR. |
| A11Y-01 | Le CTA financier utilise la paire blanc/bleu du design system ; contour explicite au focus. | Contraste calculé dans Chromium ≥ 4,5, normal/survol ; focus clavier visible. |
| A11Y-02 | Suppression de la surcharge sombre du thème follow : surfaces et encre héritent du socle clair Version A. | Texte saisi sur surface réelle ≥ 4,5 ; saisie longue FR/AR. |
| A11Y-03 | Contour `focus-within` de 3 px sur la recherche partagée. | Tab/Shift+Tab avec les CSS Client, Provider et Franchise, FR/AR. |
| A11Y-04 | La liste des cibles inclut summary, exclut les descendants de details fermés, éléments masqués/inertes et tabIndex négatifs. | Composant réel monté dans Chromium : multiespace à 360 px, ouverture summary avec Enter, Tab/Shift+Tab, bouclage, Escape et retour au déclencheur. |
| UX-02 | Chemin complet fourni au shell sur succès et erreur ; organisation/version encodées, paramètres répétés ignorés ; retour de connexion conservé. | Test de la page serveur avec doubles de lecture : FR→AR→FR, demande/offre/version/organisation, encodage et tableaux de paramètres. |
| UX-03 | Navigation desktop reportée à xl/1280 px, entrée compte alignée sur ce seuil. | 40 combinaisons : FR/AR × 360/390/768/1024/1440 × anonyme/multiespace × accueil/diagnostic ; aucune largeur scrollable excessive ni cible visible hors viewport. |
| I18N-02 | Libellés métier FR/AR pour audiences, transitions et six types de justificatifs ; valeurs des formulaires inchangées. | Rendu des formulaires et de toutes les options/transitions dans les deux langues. |

## Fichiers et ownership

- [CSS Client](../../../apps/web/modules/client/ui/client-experience.css).
- [Navigation publique](../../../apps/web/modules/public/ui/site/public-navigation.tsx) et [CSS public](../../../apps/web/app/[locale]/(public)/experience.css).
- [Page offre](../../../apps/web/app/[locale]/client/demandes/[requestId]/offres/[quoteId]/page.tsx).
- [Formulaires](../../../apps/web/modules/client/screens/recompenses/value-forms.tsx) et [libellés ajoutés](../../../apps/web/modules/client/screens/recompenses/value-forms-labels.ts).
- [Formatage](../../../apps/web/modules/shared/lib/format/display.ts).
- Tests propres : [montants/dates](../../../apps/web/modules/shared/lib/format/display.test.ts), [formulaires](../../../apps/web/modules/client/screens/recompenses/value-forms-remediation.test.tsx), [contexte offre](../../../apps/web/modules/client/ui/offer-language-remediation.test.tsx), [Chromium isolé](../../../tests/remediation/design-browser.test.mjs).

Aucun consommateur supplémentaire réservé ou modifié. Aucun changement de permissions, de ledger ou de mutation métier. Aucun accès DB, aucune réinitialisation Supabase, aucun déploiement. Audit original, PLANS, PROJECT_STATE, manifests, lockfiles et tsconfig préservés. Les deux jonctions node_modules pointent vers les dépendances du main, en lecture pour ces vérifications.

## Commandes et résultats

Depuis la racine du worktree, sous PowerShell :

```powershell
pnpm.cmd exec vitest run --config apps/web/vitest.config.ts apps/web/modules/shared/lib/format/display.test.ts apps/web/modules/public/ui/site/public-navigation.test.tsx apps/web/modules/client/screens/recompenses apps/web/modules/client/ui/offer-language-remediation.test.tsx
node --test tests/remediation/design-browser.test.mjs
pnpm.cmd --filter @matricia/web exec eslint modules/shared/lib/format/display.ts modules/shared/lib/format/display.test.ts modules/public/ui/site/public-navigation.tsx modules/client/screens/recompenses/value-forms.tsx modules/client/screens/recompenses/value-forms-labels.ts modules/client/screens/recompenses/value-forms-remediation.test.tsx modules/client/ui/offer-language-remediation.test.tsx 'app/[locale]/client/demandes/[requestId]/offres/[quoteId]/page.tsx'
pnpm.cmd --filter @matricia/web exec tsc --noEmit --incremental false --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noImplicitOverride --noFallthroughCasesInSwitch
git diff --check
```

- Vitest : **41 tests réussis, 6 fichiers**, y compris les tests voisins de récompenses existants.
- Chromium : **8 tests réussis**, 40 configurations responsive ; ressources réseau bloquées, routage/auth simulés, composant navigation et CSS réels.
- ESLint ciblé : réussi, aucune erreur.
- Contrôle strict : **aucun diagnostic dans les fichiers possédés**, mais **789 diagnostics hors ownership** dans ce worktree basé sur le commit audit. Corrections locales : absence de propriété versionId quand indéfinie, contrat explicitement optionnel des props de formulaire/navigation, précision Intl typée.
- `git diff --check` : réussi.
- Runtime : Node 24.11.0, ICU 77.1, tzdata 2025b. Les commandes pnpm signalent que le projet attend Node 22.

## Limites et intégration

Ces preuves couvrent le composant navigation isolé et la cascade des styles concernés, pas une session métier authentifiée complète ni toutes les pages publiques avec leurs images/polices. Les lectures du détail d'offre sont remplacées par des doubles dans les tests ; aucune mutation financière n'est exercée.

À reprendre par le coordinateur : checks globaux après intégration des autres lots, exécution sous Node 22, build applicatif, parcours authentifiés offre/mission, contrôle lecteur d'écran et revue arabe indépendante. Ce lot ne prononce pas de sign-off V1 ni de fermeture de phase. Aucun test DB nécessaire pour ces changements d'affichage ; un éventuel test DB ultérieur doit utiliser un clone réservé.

La correction de date dépend des données IANA/ICU du runtime. L'accord exact Node/Chromium a été vérifié ici ; maintenir les runtimes et tzdata à jour. Ne pas réintroduire un offset fixe ou masquer une divergence d'hydratation. Le formatage monétaire ne convertit jamais le montant en Number ; les consommateurs de grands montants doivent conserver leur chaîne/bigint avant cet appel.
