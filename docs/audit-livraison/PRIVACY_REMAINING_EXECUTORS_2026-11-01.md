# Privacy : développements internes restants et dépendances réelles

Le lot 267050 refuse FULFILLED pour OPPOSITION, CONSENT_WITHDRAWAL et OTHER. ERASURE reste refusé par sa garde existante. Une référence de dossier, un accusé d’Outbox ou une restriction marketing ne constitue pas l’exécution de ces droits. L’interface affiche l’action/revue requise, n’offre plus cette fausse clôture et ne décrit pas une référence libre comme un export généré. SQL0258 : **7/7 PASS/ROLLBACK** ; rendu FR/AR : **2 tests PASS**.

## Droits sans exécuteur typé complet

| Droit | Déjà disponible | Développement réellement manquant |
|---|---|---|
| OPPOSITION | Demande, identité, motif, revue ; restriction MARKETING distincte et prouvée si demandée explicitement. | Périmètre d’opposition confirmé, lien aux traitements/finalités applicables, décision motivée sur les bases maintenues, adaptateurs métier pour les effets retenus puis preuve et remise. Une opposition ne doit pas devenir automatiquement une opposition à toutes les activités de toutes les organisations. |
| CONSENT_WITHDRAWAL | Registre `consent_records` et commande `record_privacy_consent`, préférences et consentements marketing propres à leurs domaines. | Sélection de la version réellement consentie pour ce sujet/org/finalité, commande de retrait authentifiée avec provenance, lien à la demande et raccord aux consommateurs concernés. Le registre privacy et `marketing_consents` ne sont pas une même autorité interchangeable ; un simple enregistrement WITHDRAWN ne démontre pas que ces consommateurs l’appliquent. Les traitements obligatoires conservent leur base propre. |
| OTHER | Dossier et instruction humaine. | Intention/portée explicites permettant de définir la réponse ou l’effet attendu ; commande ou réponse privée réellement produite, revue appropriée, preuve de remise. Aucun effet ne peut être déduit du seul code OTHER. |

Ces manques sont du **DÉVELOPPEMENT_RESTANT**, pas une simple validation juridique externe. Les demandes restent en revue ; aucun consentement ou effet n’est fabriqué.

## Effacement complet gouverné

Les deux exécuteurs actuels sont volontairement bornés : `USER_PROFILE_DISPLAY_NAME_ONLY` et `CLIENT_ASSISTANCE_TEXT_ONLY`, liés à `privacy_retention_execution_approvals_v1` et `privacy_retention_execution_jobs_v1`. Ils ne suppriment ni le compte Auth, ni toutes les réponses/documents, ni les copies privées et externes. Leur réussite ne satisfait donc pas ERASURE.

Pour rendre l’effacement complet opérable, il manque :

1. Un inventaire de **dispositions**, distinct de l’inventaire de divulgation ALL : source/champs/versions effectivement visés, acteur et organisation exacts, suppression/anonymisation/archivage/conservation légale, politique/version/hash et exceptions motivées revues. Une colonne non exportable n’est pas automatiquement une colonne supprimable.
2. Des commandes par domaine pour les données facultatives : profils/Auth et sessions, réponses/questionnaires/activité, messages et assistance, notifications/traces marketing, fichiers personnels, exports DSR et copies de travail. Les profils partagés et objets réutilisés doivent conserver la portée des autres personnes/organisations.
3. Une disposition explicite des captures et réponses DSR contenant elles-mêmes des données personnelles : elles sont actuellement immuables. Une voie de purge gouvernée doit conserver les hashes/receipts minimaux sans garder indéfiniment leurs corps, avec contrôles de politique et de gel ; aucun retrait arbitraire des triggers d’historique.
4. Un worker idempotent de suppression des **octets Storage** et copies privées, lié au manifeste exact, aux hashes/versions et aux gels. Supprimer une ligne `storage.objects` ne prouve pas la suppression S3. Les objets partagés, remplacés, sous obligation de conservation ou référencés par un tiers ne doivent pas disparaître sur une simple correspondance d’auteur.
5. Le suivi des systèmes externes, sauvegardes et répliques : commandes disponibles du processeur, reçus/provenances vérifiés ou exclusion/rétention juridique approuvée et datée. Une case « exécuté » ou un hash saisi ne constitue pas un reçu.
6. Une preuve globale de couverture et de remise, distinguant effets réalisés, exceptions légales et actions en attente. Les ledgers financiers/crédits, contrats/signatures et audits obligatoires ne sont pas réécrits. Leur conservation doit être expliquée par une politique/exclusion réelle, sans prétendre que toutes les données ont disparu.

**Dépendances de politique réelles :** responsable du traitement et périmètre approuvés, finalités/catégories, durées et événements déclencheurs, obligations financières/contractuelles, gels/contentieux, droits des tiers, traitement des sauvegardes et accords avec les processeurs. Les durées et approbations applicables ne sont pas disponibles et ne sont pas inventées. Le code des commandes/workers ci-dessus reste néanmoins à développer sous refus fermé avant toute activation.

## Exports au-delà des bornes synchrones

Les refus sont explicites : l’export historique refuse plus de 10 000 messages par collection ou 16 MiB ; l’assembleur financier personnel 261000 refuse plus de 20 000 enregistrements ou 12 Mo ; ALL 267010 refuse plus de 20 000 enregistrements cumulés ou 16 MiB. Les snapshots Admin utilisent aussi des budgets explicites. Aucun CSV ou ALL tronqué n’est déclaré réussi.

Il manque un véritable job de gros export :

- Autorisation et scope/inventaire/hash figés ; matérialisation protégée des lignes à une coupe cohérente avant la pagination du worker. Relire les tables vivantes page par page ne garantit pas le même snapshot.
- Projection financière paginable conservant les 26 sélections personnelles, les nombres exacts et l’isolation sujet/org ; le mapper actuel construit un tableau JSON borné en mémoire et ne peut pas être appelé tel quel pour dépasser sa limite.
- Stockage privé de fragments, hashes/manifestes et volumes exacts ; lease/reprise/DLQ, annulation et expiration, protection des traces/PII. Aucun token Auth ni secret ne doit entrer dans ces artefacts.
- Revue indépendante des exclusions et des fichiers réellement remis, téléchargement/accusé de toutes les parties avant clôture, et purge gouvernée des copies de travail. Les mécanismes de remise 267100 sont réutilisables mais ne constituent pas à eux seuls un assembleur asynchrone.

Le volume contractuel doit décider si ce job est bloquant pour le candidat. Il demeure un manque interne tant qu’il n’est pas livré ; ce n’est ni une panne de credentials ni une approbation juridique manquante.

### Mise à jour 267070

Le socle de dispositions, revue indépendante, contrôle des gels, preuves natives et remise/ACK est maintenant développé et testé en transaction annulée : voir `DSR_ERASURE_DISPOSITIONS_2026-11-01.md`. L’effacement ERASURE n’est plus une fermeture libre : il exige la couverture actuelle prouvée. Le worker physique267120 et les commandes des autres domaines restent des développements internes ; leur absence laisse le rapport explicitement partiel. Le chantier batch267080 réutilisera le rowset financier267060 dans une coupe MVCC unique.
