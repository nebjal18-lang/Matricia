# G. Preuves et scripts

## Fichiers de preuves

| Fichier | Description |
|---|---|
| `preuves/AUDIT-HOME-FR.png` | Accueil FR (viewport étroit) |
| `preuves/AUDIT-PROVIDER-QUALIF.png` | Rail navigation prestataire |
| Logs terminal Next | `Module not found` / `Export doesn't exist` `@matricia/signature-v41` |
| Probe HTTP | Scripts one-shot PowerShell dans la session d’audit (non versionnés comme suite) |

## Reproduction rapide

```text
1. Démarrer : corepack pnpm --filter @matricia/web dev  (port 5173)
2. Vérifier link : Test-Path apps/web/node_modules/@matricia/signature-v41
3. Ouvrir /fr — doit être 200
4. POST /api/internal/outbox {} — attendre 401 (aujourd’hui 500 = BUG-003)
5. /fr/connexion → Sous-traitant → choisir org → Afficher
```

## Scripts projet utiles (préparés dans le repo, non rejoués intégralement ici)

- `pnpm test:e2e:public`
- `pnpm test:e2e:authenticated`
- `pnpm test:e2e:workflows`

Statut dans cet audit : **préparés / non exécutés** (runtime instable).

## Données sensibles

Aucun mot de passe, token ou cookie n’est inclus dans ce dossier.
