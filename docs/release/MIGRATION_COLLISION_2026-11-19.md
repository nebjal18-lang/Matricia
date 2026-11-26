# Réconciliation de la collision 20261118160000

L'audit a trouvé deux fichiers avec une même version. Le contenu SQL de chacun reste inchangé. La fonction d'administration démo prend désormais la version `20261118160100`, immédiatement après le reset Box conservé à `20261118160000`.

## État observé

Le 19 novembre, le registre de la base locale partagée indique `20261118160000 | reset_demo_box_network_v1`. Aucune mutation de cette base ni d'une base distante n'a été réalisée. Le replay neuf doit appliquer les deux versions distinctes.

## Environnement déjà migré

Avant application, comparer le nom et le contenu enregistré pour l'ancienne version avec les deux scripts, pas seulement son numéro. Si le registre correspond au reset Box, la migration admin renumérotée est une définition idempotente ajoutée normalement. Si l'ancien numéro désigne la migration admin, réparer l'identité historique vers `20261118160100` après sauvegarde et vérification du contenu, puis appliquer le reset Box sous son identité canonique. Si les deux scripts ont été exécutés manuellement, vérifier leurs définitions et enregistrer leurs identités distinctes ; ne pas inventer leur exécution à partir du seul numéro.

Toute identité inconnue ou empreinte divergente doit bloquer la migration. Aucune réparation distante automatique n'est effectuée par cette remédiation. Les nouvelles migrations de sécurité durcissent les fonctions ; elles ne remplacent pas la vérification de l'historique.

Le contrôle `pnpm migrations:validate`, inclus dans `verify:phase00`, refuse les collisions futures avant le replay.
