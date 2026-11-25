# H. Limites

1. Environnement **local uniquement** — ne prouve pas le déploiement Vercel/staging.
2. Runtime cassé en cours d’audit (signature-v41) → personas Client/Franchisé/Admin non rejoués en fin de session.
3. Pas d’accès SQL interactif ni de scan CVE dépendances dans cette passe.
4. Pas de lecteur d’écran ; axe-core non lancé.
5. Pas de test de charge ; pas de paiement/sandbox YouSign réellement exercé.
6. Les agents d’exploration code peuvent lister des risques additionnels ; les bugs numérotés ici sont ceux **reproduits ou lus avec preuve** dans cette session.
7. Correctif CSS BUG-001 déjà présent localement : l’état « avant » a été observé puis corrigé sur demande utilisateur antérieure — distinguer code déployé vs working tree.
