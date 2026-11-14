# L. Findings sécurité / permissions (lecture code)

Consolidé depuis [Findings sécurité code](2f2e6a04-371a-4e9c-a3ce-f76a762d5d3e) et [analyse sécurité/permissions](a2860a93-e606-4177-b67c-74be6ee041d8).  
**Aucun test d’exploitation actif** au-delà des probes HTTP déjà documentés (outbox, redirections). Distinguer BUG CONFIRMÉ (code) / RISQUE IDENTIFIÉ.

| ID audit | ID agent | Sévérité | Type | Fichier | Résumé | Impact |
|---|---|---|---|---|---|---|
| BUG-011 | MAT-SEC-01 / MAT-AUDIT-001 | Élevée | BUG CONFIRMÉ | `apps/web/app/[locale]/connexion/demo-policy.ts` | Sur `VERCEL_ENV` production/preview, seul `MATRICIA_DEMO_ACCESS_ENABLED=true` active la démo (sans exiger `APP_ENV≠production`) | Personas démo (dont admin) sur URL Vercel prod si flag erroné |
| BUG-012 | MAT-SEC-02 | Élevée | BUG CONFIRMÉ | `…/connexion/demo-actions.ts` | `connectDemoPersona` → `auth.admin.generateLink` derrière la même garde | Contournement login via service role |
| BUG-013 | MAT-SEC-03 / MAT-AUDIT-003 | Moyenne | BUG CONFIRMÉ | `apps/web/app/api/readiness/route.ts` | GET public + `getSupabaseAdminClient()` RPC readiness/health | Reconnaissance ops (DB, outbox, latences) |
| — | MAT-AUDIT-002 | Haute | BUG CONFIRMÉ | `packages/infrastructure/…/gateway-factory.ts` | DEMO non refusé si `NODE_ENV=production` mais `APP_ENV≠production` (selon chemins) | Intentions DEMO en build « prod » Next mal étiqueté |
| — | MAT-SEC-04 / 005 | Moyenne | RISQUE | webhook `payments/demo`, `env.ts` | Webhook DEMO hors garde `APP_ENV` dans la route ; DEMO OK en staging | Falsification paiements DEMO si secret faible |
| — | MAT-SEC-06 / AUDIT-004 | Moyenne | RISQUE | `api/workers/marketing-attribution` | `organizationId` dans le body ; auth = `CRON_SECRET` ; service role | Attribution cross-tenant si secret fuité |
| — | MAT-SEC-07 / AUDIT-007 | Moyenne | RISQUE | `api/payments/intents` | `organizationId` client ; mitigation attendue SQL `has_org_role` | IDOR **non prouvé** sans audit RPC |
| — | MAT-SEC-08 | Moyenne | RISQUE | `api/workers/*` (~15) | Un seul `CRON_SECRET` | Blast radius élevé |
| — | MAT-SEC-09 | Moyenne | RISQUE | `.env.local` | Présent localement, **gitignored** | Fuite hors Git (poste) |
| — | MAT-SEC-10 / AUDIT-008 | Faible | RISQUE | migration hints diagnostic | `using (true)` pour `authenticated` | Lecture mapping catalogue |
| — | MAT-SEC-11 | Faible | RISQUE | migration role_definitions | `using (true)` authenticated | Énumération rôles |
| — | MAT-SEC-12 | Faible | RISQUE | E2E `readFileSync(".env.local")` | Credentials locaux dans tests | Fuite CI / artefacts |
| — | MAT-AUDIT-006 | Moyenne | RISQUE | outbox `SignatureSimulationStepRequestedV1` | Pas de garde APP_ENV dans la route ; SQL refuse hors DEV/STAGING | Surface API + secret interne |
| — | MAT-AUDIT-009 | Faible | RISQUE | `/api/health` | Public, payload minimal | Fingerprinting |
| — | MAT-AUDIT-010 | Faible | RISQUE (design) | `/api/marketing/cta/[token]` | Public + admin RPC ; erreurs ingestion avalées | Abus limité si token fort |

## Contrôles sains observés

- Service role derrière `server-only` ; pas de fuite client observée.
- Logger avec redaction (`secret|token|Bearer…` → `[REDACTED]`).
- `.env.example` : placeholders vides (pas de secret matériel).
- Majorité des routes documents/finance : `getUser()` + RPC ; webhooks HMAC.

## Lien avec tests runtime de cet audit

- BUG-002/003 (signature-v41 / outbox 500) restent le **bloqueur runtime** prioritaire.
- Redirections anonymes 307 : cohérentes avec le modèle auth (T04–T06).
- Demo locale : attendue sous `APP_ENV=development` + flag — hors scope « prod Vercel » tant que le flag n’est pas activé.
