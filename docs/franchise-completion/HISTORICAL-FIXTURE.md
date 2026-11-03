# Frontière de la preuve historique de bénéfice Franchisé

La fixture `0369_franchise_historical_canonical_profit.test.sql` ne prétend pas avoir clôturé un bénéfice positif historique. Elle apporte une preuve négative ciblée sur la raison pour laquelle une telle recette ne peut pas être fabriquée à partir des dossiers créés aujourd'hui.

## Ce que la fixture exécute

Le setup reprend les constructeurs natifs de `0364`, dans un espace UUID et des références `TEST369` distincts : capture DEMO explicitement non contractuelle, vrai journal comptable natif, lot de crédits lié au paiement, politiques fiscales et d'allocation revues indépendamment, mandat de démonstration, livre et bénéfice soumis à une politique d'admission indépendante. Aucun journal monétaire, revenu P&L, solde distribuable ou règlement n'est inséré directement. Aucune protection n'est désactivée et aucune horloge n'est modifiée.

Dix assertions nouvelles sont prévues : refus d'une réservation antidatée, refus d'un état opérationnel injecté directement, refus d'une consommation avec empreinte inventée, absence de lignes créées par ces tentatives, réservation actuelle inchangée, absence de consommation économique fictive, absence de solde distribuable inventé, chaîne canonique du véritable paiement DEMO présente, conservation exacte de ses 8 334 unités mineures nettes non affectées, refus de clôturer la journée civile courante.

**État au commit de rédaction : test SQL fourni au parent pour exécution ; aucun succès d'exécution n'est anticipé.**

## Limite établie dans le produit

`private.enforce_benefit_admission_v1`, installé par `20261031268060_benefit_admission_policies.sql`, est appelé après chaque insertion de `benefit_redemptions`. Il exige notamment un état initial `RESERVED`, un auteur autorisé avec AAL2, `created_at >= statement_timestamp()` et une réservation non expirée. Une insertion initiale réellement historique ne satisfait pas ces conditions. La protection indépendante des reçus refuse également une insertion directement `DELIVERED` ou `CONSUMED`.

D'autre part, la capture native actuelle utilise `clock_timestamp()` pour émettre le grant et le lot. Antidater seulement le paiement puis injecter une consommation antérieure à l'émission du lot ne constituerait pas une chronologie historique cohérente. L'archive locale de la précédente recette Client et la cohorte courante ne contenaient pas de faits de consommation économique historiques réutilisables lors de la recherche menée par le parent.

Une vraie clôture positive historique nécessite donc soit un dossier natif déjà constitué avant la fin de période, soit une fonctionnalité d'import historique gouverné disposant de son propre contrat de provenance, de validation indépendante et de rapprochement. Aucun tel import n'est inventé pour rendre le test vert. Les preuves distinctes de `0364` pour le financement courant, le reçu opérationnel indépendant, le rapprochement des coûts et l'état prêt restent valables dans leur périmètre ; elles ne certifient pas la clôture avant son échéance réelle.

## Point de revue transmis

L'examen de cette fixture a aussi identifié que l'ancienne route économique ne comparait pas explicitement le type et l'opérateur du livre avec ceux du mandat. Le défaut a été transmis au parent et à l'auditeur indépendant ; aucun livre IT rattaché à un mandat STANDARD n'est utilisé comme raccourci dans ce test.
