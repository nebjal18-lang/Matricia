# Appliquer les migrations admin parcours (18 nov)

## Fichiers (dans l’ordre)

1. `supabase/migrations/20261118140000_admin_network_invitations_supervision_v1.sql`  
   → RPC lecture seule `get_admin_network_invitations_supervision_v1`  
   → test `supabase/tests/0412_admin_network_invitations_supervision.test.sql`

2. `supabase/migrations/20261118141000_admin_franchise_invite_audit_outbox_v1.sql`  
   → invite candidature émet `audit_events` + `event_outbox` (`FranchiseApplicationInvitedV1`)  
   → reste **REGISTERED** seulement (jamais ACTIVE)  
   → tests `0402` (étendu) + `0403`

## Option A — SQL Editor (recommandé si le remote a un retard de migrations)

1. Ouvrir le SQL Editor du projet Supabase (dev / non-prod).
2. Exécuter le fichier `…140000…` puis `…141000…`.
3. Vérifier :
   - `select proname from pg_proc where proname = 'get_admin_network_invitations_supervision_v1';`
   - `select proname from pg_proc where proname = 'open_franchise_application_invite_v1';`

## Option B — CLI liée (pousse **toutes** les migrations en retard)

Dry-run du 2026-11-18 : **25** migrations en attente (pas seulement celle-ci), de `20261109090000_…` jusqu’à `20261118140000_…`.

```bash
npx supabase db push --linked --dry-run
# si revue OK sur TOUTES les migrations listées :
npx supabase db push --linked
```

Ne pas lancer l’option B en production sans revue explicite de toute la file.

## Après application

- Page admin : `/fr/administration/invitations-reseau`
- Rôles : SUPER_ADMIN, MATRICIA_ADMIN, COMPLIANCE_MANAGER + AAL2
