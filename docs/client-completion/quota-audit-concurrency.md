# C09 — concurrence des quotas et journal d’audit

## Cause reproduite

Deux commandes `create_client_site`, avec des clés différentes, un vrai propriétaire AAL2 et une capacité de test de 1, produisaient une réussite et un interblocage PostgreSQL `40P01`.

La commande en attente conservait le verrou `KEY SHARE` pris par une clé étrangère vers son organisation après l’écriture de sa clé d’idempotence. La première commande détenait le verrou financier et attendait le verrou d’organisation `FOR UPDATE` demandé par le scellement d’audit. La seconde attendait ce verrou financier : cycle confirmé dans le journal PostgreSQL du conteneur de recette.

## Correction 34000

Le verrou d’organisation du **producteur commun du journal** utilise `FOR NO KEY UPDATE`. Il reste exclusif entre producteurs du même journal, protège contre suppression/changement de clé et devient compatible avec les clés étrangères des commandes en attente. Le verrou financier, le compteur de quota, les habilitations et les commandes restent inchangés. Aucun retry ne masque l’incident.

L’identité d’un événement était également attribuée avant l’attente du verrou du journal. Un identifiant inférieur retardé pouvait alors être sauté par le lecteur du dernier événement (`ORDER BY id DESC`). Le déclencheur attribue maintenant l’identifiant final après son verrou d’organisation ou de plateforme. Les trous de séquence sont normaux ; aucun identifiant existant, hash, référence ou événement historique n’est modifié. Le contenu du hash canonique et la sérialisation de plateforme sont préservés. Une séquence anormalement en retrait échoue explicitement au lieu de créer une branche.

## Preuves exécutées

- Avant correction, vrai HTTP Supabase/GoTrue AAL2 : `40P01` observé ; une seule création persistée.
- Après correction, **3 cohortes HTTP natives indépendantes** : pour chacune, une réussite, un refus `54000 / SUBSCRIPTION_QUOTA_EXCEEDED`, un seul site actif et refus `42501` pour l’organisation étrangère.
  Preuves : `work/client-browser-isolated/66866b92-d8f9-474d-a757-d88acab47788/quota-race/{before34000,three-cohorts}.json` dans le worktree de recette navigateur.
- `0341_quota_audit_lock_and_chain_order.test.sql` : **14 assertions réussies**, rollback intégral, garde de quota, ordre inversé des identités préallouées, chaîne linéaire et hashes recalculés, références historiques, interdiction UPDATE/DELETE, journal de plateforme et outbox.
- `0008_p03_audit_outbox.test.sql` : **17 assertions réussies**.
- `APP_ENV=development node supabase/tests/helpers/verify-quota-audit-concurrency.mjs matricia_refunds0332_local /tmp/client-quota-audit-concurrency` : **réussi**, deux sessions PostgreSQL distinctes, attente financière et `KEY SHARE` imposées, vrais appels métier, un refus de quota sans retry. Deux sessions inversent ensuite l’attribution préalable des identités ; les trois événements restent linéaires et leurs hashes canoniques valides.

Le dernier harness utilise des acteurs SQL synthétiques dans un conteneur explicitement désigné, sans réseau ni ports publics. Il n’atteste pas une identité GoTrue ; cette preuve est apportée séparément par les trois cohortes HTTP natives. Il conserve ses seules données de test dans le conteneur jetable pour investigation. Il ne lit aucun secret de l’application et n’accepte aucune URL de base distante.

## Limite

Cette migration empêche les nouvelles divergences décrites ; elle ne réécrit ni ne certifie les chaînes historiques d’une base distante qui n’a pas été examinée. La reprise globale des migrations et la recette intégrée sont réalisées par l’intégrateur.
