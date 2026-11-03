# Reconstruction du socle design — 2 novembre 2026

Reconstruction à partir du commit disponible 5366c32. Les commits précédents 0644f277 et fd8f809b sont absents de cet environnement : cette branche ne prétend pas restaurer intégralement leurs écrans, ni leurs preuves.

Corrections livrées : contrôles partagés de 44 px ; boutons à libellé multiligne ; cartes réorganisées sur mobile ; sélecteurs RTL et listes multiples natives de 128 px ; fermetures de fenêtres FR/AR de 44 px ; fenêtres bornées et défilables ; panneau latéral implicite adapté à la locale ; grilles et checklist Prestataire basées sur la largeur du contenu ; contrastes corail publics corrigés.

Aucune action métier, migration ou autorisation modifiée. Revue indépendante du source : ACK après correction des omissions Dialog/Sheet et des règles de grille Prestataire. Contrôle de syntaxe et diff effectués avant commit. Les anciennes recettes de navigateur ne valent pas pour cette reconstruction. La compilation locale a rencontré des problèmes de dépendances dans le nouveau worktree ; elle reste à revalider après installation propre. Le typage et les tests complets lancés localement ne sont pas déclarés verts dans ce bilan.

Cette branche contient des changements de design effectifs et distincts de la consolidation précédente. Aucun déploiement de production n’est demandé.
