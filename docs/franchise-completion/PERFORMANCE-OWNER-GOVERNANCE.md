# Responsable du plan correctif

La proposition historique reste immuable. Un administrateur indépendant, authentifié AAL2 et extérieur à l’organisation exploitante, choisit un membre actif OWNER/MANAGER dans le mandat exact. Un second administrateur indépendant approuve ou refuse l’affectation avec motif. Chaque affectation approuvée crée une nouvelle version ; la proposition et le responsable figé lors de l’approbation initiale du plan restent conservés.

Le plan sans responsable, ou dont le responsable a perdu ses droits, bloque l’avancement et l’achèvement. Un autre manager disponible ne devient jamais automatiquement responsable. L’administration peut alors proposer et faire valider une réaffectation ; les listes de candidats et l’historique sont bornés et paginés. Les noms libres ne sont pas traduits.

La page d’administration `gouvernance-franchise/plans/[id]/responsable` reste accessible aux administrateurs indépendants qui n’ont aucun rôle franchisé. Une tâche centrale réelle suit le plan jusqu’à sa clôture gouvernée. Son auteur de configuration de mandat est référencé dans le champ historique obligatoire `created_by`, et son contexte précise `actor_origin=SYSTEM` ; cela ne représente pas une action humaine de cet auteur. Si aucune file centrale active n’est configurée, le contrôle échoue explicitement et le rapport/plan ne certifie pas une mise en file inexistante. Le compteur d’échec rend le contrôle non sain jusqu’à correction et reprise.

Approuver le plan exige une affectation approuvée et un responsable actuellement habilité. Déclarer 100 % d’avancement ne prouve pas l’achèvement : tous les objectifs doivent être atteints ensemble dans le dernier rapport natif du même type et du même modèle, postérieur à l’approbation. Une amélioration ancienne suivie d’une dégradation, ou des améliorations réparties entre différents rapports, ne permettent pas de clôturer. Le rapport ayant effectivement permis une clôture est figé dans une preuve privée immuable liée à l’événement. Aucune assignation, alerte ou clôture ne modifie automatiquement le mandat, les commissions ou les droits financiers.

## Vérifications

- 39 tests Web ciblés exécutés : 39 réussites, dont garde Admin/AAL2 avant lecture, destinataire nommé FR/AR, motifs libres, erreurs Auth distinctes, reçus vérifiés et navigation vers le plan.
- Lint ciblé exécuté sans erreur.
- `0373_franchise_control_plan_owner_governance.test.sql` prépare uniquement des préconditions TEST sous transaction annulée ; les propositions, décisions et suivis testés passent par les RPC publiques. Exécution SQL réservée à la base fraîche d’intégration du parent ; aucune réussite SQL anticipée.
- Migration additive `20261103454500` ; aucune migration déjà appliquée n’est réécrite.
