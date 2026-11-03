# Observation locale de restauration — périmètre limité

Cette observation est transmise par l’agent intégrateur pendant les travaux du 31 octobre 2026. Elle ne constitue pas un visa de restauration complète ni une validation staging.

- Dump PostgreSQL local : 7 252 280 octets ; SHA256 `3f5cf64364c819c546ed9d7c1450d80526532b63f8ed3e4f8e29450a0b39c502`.
- Cible distincte créée pour l’exercice : `matricia_delivery_restore_v3` ; base de développement source conservée.
- Restauration avec le compte fourni `supabase_admin`, propriétaires et ACL préservés : sortie 0 en 6,35 s.
- Extension dépendant de l’hôte `pg_cron` exclue explicitement de cette cible secondaire. Les 90 premiers fichiers SQL passent, puis la suite s’arrête sur `cron.job`. Les 174 fichiers ne sont donc pas déclarés réussis sur cette restauration.
- Une tentative d’instance distincte avec véritable extension hôte a été interrompue par saturation de stockage puis nettoyée. L’exercice complet reste à terminer sur une cible ayant les ressources requises.
- Storage privé : aller-retour synthétique de 41 octets, SHA256 `eeba84e26007de49f5c6ffb8fe44320b843a539783c3625102c8e95b58f0af6c`, accès public refusé, fixtures nettoyées. Il s’agit d’un test local d’accessibilité et d’intégrité, pas de la restauration d’un backup Storage hébergé.

Résultat honnête : restauration des objets applicatifs locale observée ; **restauration complète DB/extensions/Storage/files/staging non validée**. RPO/RTO staging non mesurés. Les preuves de l’intégrateur se trouvent dans son répertoire local ignoré `work/delivery-validation/` ; les dumps et credentials ne font pas partie de la remise Git.
