# Gouvernance et finance — prérequis et reprise précis

L’action financière pouvait transformer un échec Auth en session absente, puis confondre un rôle manquant et un second facteur manquant sous le même refus générique SQL. Le tableau de gouvernance transformait aussi un refus `42501` du snapshot en incident technique. Un rôle plateforme sans droit de lecture pouvait enfin suffire à afficher un tableau vide comme autorisé.

Les commandes relisent maintenant les prérequis via `loadMyPlatformAccess`, avec les listes exactes des RPC SQL :

- Décision de gouvernance : `SUPER_ADMIN` ou `MATRICIA_ADMIN`, exigence du compte satisfaite. La décision indépendante, le périmètre et la version restent contrôlés par PostgreSQL.
- Droit d’entrée, clôture et règlement : `SUPER_ADMIN` ou `FINANCE_MANAGER`, exigence du compte satisfaite et assurance AAL2 explicite, même si une politique de compte n’impose pas MFA. Le rôle manquant reste un refus d’habilitation ; aucun appel de mutation n’est émis avant satisfaction des prérequis.
- Acceptation historique d’une invitation de mandat : aucune obligation plateforme supplémentaire n’est inventée. L’authentification et les exigences de mode/mandat restent contrôlées par la commande SQL existante. Les formulaires modernes d’activation ne sont pas remplacés.

La lecture conserve les lecteurs plateforme réellement autorisés (`SUPER_ADMIN`, `MATRICIA_ADMIN`, `FINANCE_MANAGER`, `LIBRARY_MANAGER`, `READ_ONLY_AUDITOR`) et distingue `MFA_REQUIRED`, `FORBIDDEN`, `QUERY_FAILED` et `UNAUTHENTICATED`. Un membre franchisé sans exigence plateforme peut toujours consulter son périmètre sous ses règles RLS actuelles ; la correction ne lui impose pas arbitrairement AAL2. Aucun droit serveur n’est élargi.

Les retours d’action présentent un lien direct vers la configuration ou la vérification du second facteur et conservent le retour de gouvernance. Le composant accepte le `returnPath` exact du parent pour conserver organisation et mandat en cas de sélection multiple ; à défaut, il conserve l’organisation financière connue. Une session réellement expirée propose la reconnexion. Un incident technique n’est pas présenté comme un refus ou une déconnexion.

Vérifications exécutées : **26 tests PASS** dans trois fichiers (10 commandes, 11 lectures, 5 contrôles d’interface), types et lint ciblé réussis. [Journaux](evidence/governance-access/). Les tests distinguent Auth 503/401, rôle interdit/MFA manquante, exigence financière AAL2 explicite, refus indépendant après prérequis satisfaits, lecture franchisée autorisée, snapshot indisponible et lien de reprise FR/AR avec organisation/mandat.

Les migrations financières et protections RLS/MFA n’ont pas été assouplies par ce lot. La confirmation navigateur sur le candidat intégré appartient à la recette d’intégration.
