# Observation de révocation locale des sessions

Le 1er novembre 2026 à 02:00:43 UTC, le diagnostic `scripts/release/check-native-session-revocation.mjs` a créé une nouvelle fixture GoTrue locale, obtenu une véritable assurance AAL2, puis supprimé uniquement sa propre ligne courante dans `auth.sessions`. Aucun JWT utilisateur n'a été fabriqué et le jeton testé n'a pas été rafraîchi.

| Appel avec exactement le même access token | Avant suppression | Après suppression |
| --- | --- | --- |
| GoTrue `getUser(token)` | Accepté | Refusé, HTTP400 |
| RPC PostgREST staff AAL2 `get_client_identity_review_context_v1` | HTTP200 | **HTTP200** |

Il restait 3600 secondes de validité au JWT lors du contrôle. La suppression des sessions native seule ne suffit donc pas à garantir une révocation immédiate des autorisations RPC. Les droits et la validité de session doivent être revérifiés côté serveur ; cette observation ne certifie aucun correctif futur.

Toutes les données provenaient des nouveaux acteurs synthétiques de ce run ; nettoyage vérifié. Rapport : `artifacts/test-results/local-acceptance/native-session-revocation.json`, SHA256 `50f4e03948f9002474cc7bbfd1228e25576e0be68518c9fc82cfe1ca7ffe4c6e`. Aucun secret, jeton, profil ou contenu de réponse staff n'a été écrit dans le rapport.

## Contre-recette du correctif264020

Le 1er novembre à03:13:45 UTC, le mode strict a vérifié le correctif avec une nouvelle session GoTrue AAL2, sans refresh ni JWT fabriqué. Avant suppression de sa seule session, RPCstaff et profil propres étaient accessibles, et les deux PDF privés étaient réellement téléchargés avec les SHA attendus. Après suppression :

| Accès avec le même ancien jeton | Résultat |
| --- | --- |
| GoTrue getUser | Refus HTTP400 |
| RPCstaff protégée | Refus HTTP401 |
| Lecture REST du profil propre | Refus HTTP401 |
| PDF privé client-compliance | Refus Storage HTTP400 sémantique, aucun PDF rendu |
| PDF synthétique owner-unbound delivery-proofs | Refus Storage HTTP400 sémantique, aucun PDF rendu |

Statut `VERIFIED_TARGETED_RPC_SELF_AND_PRIVATE_STORAGE_REVOCATION`, nettoyage vérifié, sources avant/après identiques : `bc8d3fa7ebf8bc69395cb52dacc229fcbc445a871ef126cd18d92b9e72f3a436` (2165fichiers ; HEAD `dbf309cd4ec5c48212c43243203dd98150ee5114`). Empreinte du garde/RBAC réellement installé : `1fddb477c255bbf9433f4033fe622148da66e5e21a536b15ac8611fad74f8532`.

Snapshot conservé : `artifacts/test-results/local-acceptance/history/native-session-revocation-2026-11-01T03-13-45-997Z.json`, SHA256 `a5c6b7aba1586d173934c3d699fc0b50269162f3b3b72704809d3c42a9238bc4`. Le chemin non versionné contient le dernier diagnostic et ne conserve donc plus le rapport initial de02:00. Cette preuve porte sur ces accès ciblés ; elle ne certifie pas les URL signées déjà émises ni un déploiement distant.
