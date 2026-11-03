# Vérification du parcours Sous-traitant

Source Client préservée : `7e01276818e8af11cf18f616615721f1662951fe`. Branche dédiée : `codex/provider-completion-20261102`. Produit final gelé au commit `5b8b0f738137abee19f6552aef538e906d04f24a`, arbre `apps/web` `ef4b62c67a4d8ad5a6403e6a4568bd9dc1774c75`. Les commits suivants portent tests, preuves et documentation ; ils ne constituent pas une nouvelle version de l'interface.

## Contrôles exécutés

Toutes les commandes pnpm utilisent Node24 et pnpm10.17.1 via `PATH=/workspace/.cache/corepack/bin:$PATH COREPACK_HOME=/workspace/.cache/corepack corepack pnpm`.

| Commande / périmètre | Résultat réellement observé | Preuve |
|---|---|---|
| `pnpm --filter @matricia/web typecheck` sur le produit gelé | PASS, contrôles TypeScript actifs | [log](evidence/integration/web-final-delivery-types.log) |
| `pnpm --filter @matricia/web lint` au checkpoint intégré, puis ESLint des fichiers modifiés après ce contrôle | PASS, aucun avertissement ; derniers changements Auth/notifications vérifiés | [lint complet](evidence/integration/web-lint.log), [dernier lot](evidence/integration/web-final-delivery-scoped-lint.log) |
| `pnpm --filter @matricia/web exec vitest run --maxWorkers=2 --exclude '**/*pdf.test.*' --exclude '**/draft-pdf.test.*' --exclude 'modules/client/screens/boxes/member/actions.test.ts'` | **2 980 PASS**,1skip opt-in ; source gelée | [log final](evidence/integration/web-final-delivery-2980.log) |
| Vitest isolé `--maxWorkers=1` : les4 fichiers PDF et `client/screens/boxes/member/actions.test.ts` | **30 PASS** :25PDF +5MFA, exclus du groupe précédent | [log](evidence/integration/pdf-and-mfa-30.log) |
| `pnpm --filter @matricia/worker exec vitest run --maxWorkers=1` | **104 PASS** | [log](evidence/integration/worker-tests.log) |
| `pnpm --filter @matricia/worker build` | PASS | [log](evidence/integration/worker-build.log) |
| `pnpm server-actions:validate` | PASS,1 832 sources contrôlées | [log](evidence/integration/server-actions-final-1832.log) |
| `node --test tests/e2e/helpers/provider-browser/*.test.mjs tests/e2e/helpers/provider-isolated/*.test.mjs` | **20 PASS** | [log](evidence/integration/browser-guards-final-20.log) |
| `APP_ENV=development node scripts/validate-local-migration-replay.mjs --test=<nom>` pour les56 fichiers explicitement listés par le reçu | **507 migrations,56 fichiers,2 067 assertions PASS**, nettoyage PASS | [reçu complet](evidence/integration/sql-replay-final-507-2067.json) |
| Contrôle de sécurité de la base neuve après les tests |649 tables publiques,0sansRLS ; pgTAP non exécutable par les rôles API | même reçu |
| `git diff --check` et contrôle des591 fichiers modifiés au checkpoint | PASS ; aucun fichier `.env.local`/`.private.*` suivi, aucun motif de clé Supabase/GitHub/Vercel trouvé ; contrôle de motifs, pas certificat universel d'absence de secret | contrôle effectué par root, sans afficher de valeur |

Les anciens échecs ne sont pas remplacés par une annonce verte : passage Web initial8échecs puis1timeout sous charge, groupes ciblés et confirmation globale ; bootstrap SQL sans espace disque avant toute migration ; fixtures fiscales aux dates UTC/MA incohérentes ; test d'archivage fournissant une preuve vide désormais légitimement refusée. Les reçus échoués correspondants sont conservés dans `evidence/integration/`. Aucune durée de test, garde de preuve ou règle métier n'a été abaissée. Les entrées fiscales utilisent leurs dates civiles explicites, en gardant la connexion canonique UTC pour les empreintes de signature.

Le dernier0355 passe204assertions : objets Storage TEST20octets, vrais liens de livraison et callback de scan natif TEST ; aucune suppression de `proof_required`. Une intention valide est préparée avant archivage puis refusée après retrait signé. Les scans SQL synthétiques ne prouvent ni octets physiques ni antivirus externe ; la recette navigateur vérifie séparément les vrais fichiers, octets et empreintes.

Le test legacy0210 qui désactive les triggers n'est pas utilisé dans ce rejeu strict ; les scénarios natifs0353/0355/b/c couvrent les avenants avec leurs protections actives. Les56 noms et hashes sont énumérés dans le reçu. Ce n'est pas une exécution de tous les tests SQL historiques du dépôt. `concurrencyIncluded:false` est conservé : les contre-tests transactionnels/rejeux ne constituent pas un nouveau test concurrent de tout le lot Provider.

## Recettes navigateur et provenance

La pile de test Provider est distincte du source canonique et de l'ancienne pile SQL Client. Quinze vrais acteurs GoTrue OTP/TOTP, organisations, invitations et affectations de test ; aucun JWT utilisateur fabriqué. Les secrets, sessions et réservations locales restent dans les dossiers ignorés.

- `e929f99` : entrée/identité/questionnaire/capacité avec vrais fichiers ;40pages FR/AR aux largeurs375/390/768/1440,8menus et20frontières de rôles/AAL1. Le blocage de revue est reproduit sans être classé réussi.
- `8941517` : revue du dépôt original corrigée, devis7étapes, révision3, contrat/mission5, livraison refusV1→correctionV2→acceptation/révocation6, messages privés4 ; [preuves et42 empreintes vérifiées](evidence/browser/candidate-two/manifest.json). Signature SIMPLE DEV-mock gouvernée, non juridique ; scanner connu TEST uniquement.
- `5e06b32` : F13, vraie date marocaine refusée comme future avant40960 puis acceptée après correction, avec la même intention et le même PDF. Confirmation Client et revue Finance indépendantes ; données fiscales et comptes référentiels explicitement TEST, sans journal ni solde injecté. Le vrai lendemain reste refusé. La clôture du mois courant attend son cutoff et sa fenêtre contradictoire : aucune facture historique artificielle n'est utilisée pour simuler le passage du temps.
- `706cd89` : build complet et232pages/256scans axe sans violation,8menus et3étapes de navigation/recherche passent. Vrai clic SPA FR→AR→FR avec `performance.timeOrigin` identique, html.lang/dir corrects ; recherche Admin réelle avec0organisation générale lisible. Contraste :48bornes conformes+6glyphes opaques conformes/56cibles,2nonmesurées ; pas de certification WCAG globale.
- `5b8b0f7` : dernier build complet avec TypeScript ; seules deux expressions d'affichage Devis changent après706.8contrôles ciblés FR/AR×4largeurs passent : libellés approuvés, absence de codeSELECTED visible, même V2/organisation et textes libres français inchangés. La matrice232reste attribuée à706 ; elle n'est pas prétendue rejouée sur5b8. [Index final](evidence/browser/README.md),454fichiers du manifeste vérifiés par root, archive brute axe256scans relue sans violation ni cas dupliqué.

Les scans axe initiaux n'ont aucune violation automatique, mais des contrôles color-contrast restent incomplets à cause des gradients ; ils ne constituent pas une certification WCAG complète. Les mesures visuelles complémentaires et leurs limites doivent garder une attribution explicite.

## Cibles et limites

L'ancienne pile locale Client e3 a été sauvegardée en archive privée de11Mo puis nettoyée avec contrôle du token, des4labels, du réseau interne et de l'absence de port publié. Ce backup de test n'a pas fait l'objet d'une nouvelle restauration ; aucun résultat de restauration commerciale n'en est déduit. Source canonique f59 et pile Provider b9 conservés. Aucun daemon partagé, autre pile ou environnement distant modifié.

Le rejeu neuf utilise son propre conteneur sans réseau ni port publié et s'autonettoie. Une réserve de8Gio est désormais requise pour les couches temporaires VFS, après preuve d'épuisement de l'ancienne réserve4Gio.

Supabase/Vercel/Railway hébergés, service de mail, fournisseur réel de signature, scanner réel et paiement externe ne sont pas certifiés par ces tests locaux. Les données légales/commerciales approuvées et décisions manquantes sont listées dans [le rapport](REPORT.md). Aucun déploiement ou merge de production ; l'API GitHub renvoie Forbidden pour la création distante de PR, son [corps prêt à relire](PULL_REQUEST.md) et la branche sont conservés.
