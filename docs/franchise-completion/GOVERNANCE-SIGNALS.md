# Faits natifs de gouvernance — Gold §16.9

Le contrôle planifié collecte indépendamment les affectations de missions, exécutions du matching, propositions gouvernées de panel (avec leur motif d’autorisation), invitations de panel courantes et précédentes, décisions de qualification, revues de catalogue, déclarations de conflits d’intérêts et réaffectations. Les sources et leur manifeste sont figés avec le rapport natif journalier, mensuel et trimestriel ; les reprises ne créent pas une seconde observation pour le même rapport.

La vue membre fournit uniquement des nombres, durées, proportions et statuts de revue. Elle ne publie ni déclarations de conflits d’intérêts, ni identités de réviseurs, ni motifs internes. Les preuves privées exigent Admin/SuperAdmin, AAL2 et un objectif de consultation audité à chaque page. La pagination des sources est bornée à 25 par lecture UI (50 maximum serveur).

Les comptes de missions, le matching, les qualifications et les panels couvrent la bibliothèque mandatée. Les objets métier ne portent pas de binding territorial approuvé ; ce lot ne prétend donc pas les attribuer à un territoire ou à une personne. Le périmètre est explicite dans le schéma et l’interface : `MANDATED_LIBRARY_AGGREGATE_NO_TERRITORY_ATTRIBUTION`. Les déclarations de conflits restent limitées à la franchise exacte. Un rattachement territorial métier approuvé reste nécessaire pour certifier une comparaison territoriale.

Aucun seuil chiffré de favoritisme n’est donné par le Gold Master. Les seuils de concentration, rapidité de validation et baisse de diversité restent à faire approuver dans une politique gouvernée ; leur absence est affichée. Aucun score de risque, seuil local arbitraire ou verdict de culpabilité n’est produit. Une relance du matching est distinguée d’une proposition manuelle gouvernée. Une absence de missions ou de décision reste non mesurée pour les proportions/durées, sans zéro rassurant.

Une déclaration de conflit ou une incohérence chronologique déclenche une demande explicite d’examen humain `MATRICIA_REVIEW_REQUIRED`. Un responsable de mandat authentifié AAL2 peut également demander un examen motivé. Deux administrateurs indépendants hors organisation exploitante documentent puis approuvent/refusent la conclusion. Aucun flag ni conclusion ne change une commission, un mandat, une habilitation ou une sanction. Une conclusion approuvée demandant un examen complémentaire crée un dossier successeur et sa tâche réelle, liés immuablement à la première conclusion ; une reprise ne les duplique pas. La tâche administrative réelle est résolue par les commandes de workflow existantes après validation indépendante ; une résolution générique sans revue est refusée. L’absence de file active `RISK_FLAGS` produit un échec explicite et ne simule pas une mise en file.

La comparaison de concentration reste réservée à l’administration AAL2 et n’apparaît qu’avec au moins cinq autres franchises distinctes partageant modèle, méthode, type de rapport et période. Aucune identité de franchise de la cohorte n’est renvoyée.

## Raccordement de la page Performance (propriété parent)

```tsx
import { loadFranchiseGovernanceSignals } from "@/modules/franchise/data/governance-signals/repository";
import { FranchiseGovernanceSignalsPanel } from "@/modules/franchise/screens/performance/governance-signals-panel";
// Après résolution du même franchiseId autorisé que le panneau natif :
const signals = await loadFranchiseGovernanceSignals(franchiseId);
<FranchiseGovernanceSignalsPanel locale={locale} result={signals} returnPath={returnPath}/>
```

L’inspection administrative est découverte depuis la file centrale et la route `administration/gouvernance-franchise/signalements/[requestId]`. La page garde le rôle et AAL2 avant de présenter le formulaire ; aucune preuve n’est lue avant la saisie de l’objectif.

## Preuves et limites

- 26 tests Web ciblés exécutés, tous réussis : périmètre exact de réponse, panne Auth avec utilisateur caché, absence de rapport, absence de seuil/verdict, FR/AR, motif obligatoire avant inspection et contrats de proposition/décision distincts.
- Types Web et lint ciblé exécutés sans erreur.
- Le test SQL `0371_franchise_native_governance_signals.test.sql` utilise uniquement des préconditions historiques TEST annulées et les vraies fonctions de collecte/revue ; il ne certifie pas le parcours de saisie d’une déclaration de conflit ni une recette complète de mission. Le parent doit exécuter ce test sur sa prochaine base fraîche : aucun résultat SQL n’est anticipé.
- Pas de déploiement distant ni de changement de données réelles. Les seuils numériques approuvés et le rattachement territorial des objets restent des décisions/données métier manquantes, explicitement non certifiées.
