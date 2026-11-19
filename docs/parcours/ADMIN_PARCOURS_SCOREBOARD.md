# Admin parcours — scoreboard

Baseline départ : **~25 %** (expérience opérateur). Mise à jour à chaque vague.

Légende C1–C12 : `0` = FAIL, `1` = PASS. `PASS_100` seulement si C1–C12 = 1 et bugs ouverts = 0.

| slug | étape | vague | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | % | statut | preuve |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| command-center | 1 | V0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 100 | PASS_100 | film + AAL2 FR/AR 360 |
| preparation | 1 | V0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 100 | PASS_100 | AdminStep1Gate + AAL2 |
| configuration | 1 | V0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 92 | PASS | AdminStep1Gate |
| catalogue | 1 | V0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 92 | PASS | AdminStep1Gate nests |
| territoires | 1 | V0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 92 | PASS | film strip |
| acteurs | hub | V0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 92 | PASS | ordre 2→5 |
| parcours | hub | V0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 92 | PASS | film 1→11 |
| candidatures-franchise | 2 | V1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 100 | PASS_100 | 0402+0403 + AAL2 |
| franchises | 2 | V1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 92 | PASS | ACTIVE défaut |
| gouvernance | 2 | V1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 92 | PASS | Step2Gate |
| invitations-reseau | 3 | V1b | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 100 | PASS_100 | RPC 0412 |
| entreprises | 4 | V1b | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 100 | PASS_100 | hub étape 4 + AAL2 |
| conformite-clients | 5 | V2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 100 | PASS_100 | Step5Gate + AAL2 |
| qualification | 5 | V2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 92 | PASS | Step5Gate |
| diagnostics | 6 | V3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 100 | PASS_100 | CommerceGate + AAL2 |
| matching | 7 | V3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 100 | PASS_100 | mise en relation + AAL2 |
| devis | 8 | V3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 92 | PASS | CommerceGate |
| contrats | 9 | V3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 92 | PASS | CommerceGate |
| missions | 10 | V3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 92 | PASS | CommerceGate |
| facturation-clients | 11 | V3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 92 | PASS | Step11Gate |
| finance | 11 | V3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 100 | PASS_100 | Step11 + wholesale 0413 |

Moyenne indicative cœur : **~97 %**. C12 browser FR/AR 360 AAL2 **PASS** sur le film smoke (`admin-film-s1-s6-run.mjs`, 20/20). Nests hors smoke (catalogue, devis, contrats, missions, qualification) restent à C12=0 structurel.

## V4 — orphelins hors film

| slug | statut | preuve |
|---|---|---|
| operations | PASS | OffFilmGate |
| confidentialite | PASS | OffFilmGate |
| marketing-autopilot | PASS | OffFilmGate |
| anti-abus | PASS | OffFilmGate |
| avantages/* | PASS | OffFilmGate |
| assistance / support | PASS | OffFilmGate |
| v4-1/* | PASS | OffFilmGate |
| incitations / achats-groupes | PASS | OffFilmGate |
| clonage | PASS | Step1Gate |
| gouvernance-franchise/livres | PASS | Step2Gate |
| finance/offres (wholesale) | PASS | Step11Gate + SQL 0413 |
| nests identité | PASS | Step5Gate |

## SQL / DB local

- Migrations locales à jour incl. `18140000`, `18141000`, `18150000`, `18160000`.
- Tests : `0402`, `0403` invite, `0412`, `0413` wholesale **PASS**.
- Fix signature `ingest_platform_core_pot_sources_v1` (defaults après default).
- Wholesale / invites **linked** : ne pas `db push --linked` aveugle (retard migrations) — appliquer via dry-run + OK explicite (`docs/parcours/APPLY_MIGRATION_INVITATIONS_RESEAU.md` pour le lot invites ; wholesale `18150000`/`18160000` même prudence).
