# Reprise native du contrôle — ambiguïté du dédoublonnage

Le rejeu SQL après les migrations additives de contrôle échouait : les deux franchises étaient comptées en échec, sans création de rapport. L’appel owner direct de la projection puis du générateur, dans la même fixture TEST et une transaction annulée, a isolé l’erreur PostgreSQL `42702` : `column reference "objectives" is ambiguous`.

Le sous-select de dédoublonnage contenait à la fois la variable PL/pgSQL `objectives` et la colonne historique `p.objectives`. Le générateur ne pouvait donc pas compiler cette expression. La migration additive `20261103454350_franchise_control_objective_variable.sql` renomme les seules références à la variable en `v_objectives`. Les colonnes historiques, les délais et les protections ne changent pas.

Le journal avant correction est conservé. La preuve de reprise attend le rejeu natif `0365` par l’intégrateur, seul propriétaire DDL de cette cohorte ; elle n’est pas encore déclarée réussie dans ce commit. Aucun catch public n’a été retiré, aucune ACL ou protection désactivée.
