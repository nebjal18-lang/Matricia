# Restrictions : effet réel, portée et remise

267025 permet à une personne sans adhésion d’exercer ses droits de compte sans lui créer de rattachement artificiel. La demande doit déjà être vérifiée ; son hash doit correspondre exactement à l’organisation et à l’utilisateur authentifié AAL2. Le périmètre non membre est limité au contrôleur plateforme réellement configuré ou à une portée personnelle précédemment prouvée. Une confirmation ne crée aucun lien à un tenant arbitraire. Les scopes immuables permettent ensuite à l’opérateur de retrouver la personne sans énumérer les utilisateurs Auth.

267030 remplace le faux FULFILLED par un effet contrôlé. Le titulaire confirme explicitement APPLY ou LIFT et ses finalités dans son organisation de demande. Le responsable Conformité prépare une proposition immuable ; une autre personne habilitée confirme la portée et les références. Une approbation ne constitue pas une application. L’application vérifie les habilitations après verrou, le scope courant, les hashes et les consommateurs installés, puis écrit un effet append-only ordonné par séquence. Une nouvelle clé ne réexécute pas la proposition ; rejouer un ancien APPLY après LIFT renvoie sa preuve historique sans le réactiver.

Le lot Int 267040 contrôle quatre familles de consommateurs réels : nouvelles touches marketing, collecte des faits à partir des sources métier (deux chemins), attribution/reprise des faits et notifications marketing facultatives (création et pré-transport). Les définitions de code, leurs dépendances et leurs raccords sont vérifiés ; une empreinte différente interdit d’attester une application. Le calcul des définitions PostgreSQL utilise un search_path canonique identique à la capture de leurs hashes. Aucun registre immuable n’a été modifié pour contourner ce contrôle.

La portée reste précise : les touches prennent l’organisation de la campagne ; les faits et conversions prennent celle de la source métier ; les messages prennent celle du message et le destinataire exact. Les autres sujets/organisations, les sources métier originales et les historiques sont préservés. Les communications obligatoires de sécurité/légales ne sont pas reclassées arbitrairement comme marketing. Il ne s’agit jamais d’un effacement.

La preuve privée communiquée expose l’effet, les références et ses limites sans identifier les autres responsables par leur UUID. Son hash couvre les octets UTF-8. Le titulaire ouvre cette preuve puis accuse exactement sa version/hash ; ce n’est qu’ensuite qu’un responsable peut clôturer RESTRICTION. Changer la portée, les gardes ou l’effet courant rend une ancienne preuve insuffisante pour une nouvelle clôture.

## Preuves exécutées

- SQL0253 : **8/8 PASS/ROLLBACK** ; compte sans adhésion, vrai périmètre contrôleur, vraie réponse ACCOUNT, refus autre sujet/AAL1/demande non vérifiée/tenant arbitraire.
- SQL0252 : **33/33 PASS/ROLLBACK** avec les vraies gardes267040 ; quatre yeux, aucun effet à l’approbation, dérive de code refusée sans toucher le registre, isolation sujet/org, touches et reprises bloquées, source métier légitime persistée sans collecte marketing, remise privée/accusé puis vraie FULFILLED, levée et rejeu ancien sans réactivation.
- Int0257 : **14/14 PASS/ROLLBACK** ; création et transport marketing refusés, état SKIPPED et lease libérée, audit sans SENT, messages obligatoires et autres périmètres préservés. Ces résultats sont ceux de l’auteur du lot Int et doivent accompagner son commit.
- Dix tests unitaires du modèle ; TypeScript et lint ciblé PASS. Revue indépendante en lecture sans contournement démontré ; elle ne remplace pas les recettes exécutées.

## Limites explicites

- Aucun port d’IA facultative externe n’existe actuellement dans le runtime. OPTIONAL_AI peut être demandé et reste en revue ; son application est refusée et ne peut satisfaire FULFILLED. Il n’est pas couvert par le marketing.
- ERASURE reste fermé tant qu’une couverture d’effacement, les politiques, les gels et les obligations de conservation ne sont pas prouvés. Les journaux et contrats ne sont pas supprimés par cette fonctionnalité.
- Les autres types de droits nécessitent leurs effets/preuves propres ; un consentement retiré ne sera pas déduit d’une restriction marketing. La fermeture des faux FULFILLED correspondants fait l’objet du delta suivant.
- La recette navigateur avec sessions natives, la configuration juridique réelle et les effets d’un déploiement intégré restent distincts de ces fixtures locales synthétiques.
