# D. Rapport UX/UI et accessibilité

## Conditions d’observation

- Navigateur : Chromium embarqué Cursor (MCP browser)
- Viewport : étroit (comportement mobile/tablette) — **émulation**, pas appareil physique
- Locales : FR (principal), AR HTTP seulement
- WCAG 2.2 AA : contrôles manuels partiels ; **pas** de lecteur d’écran ; axe non exécuté (runtime dégradé)

## Constats

| Écran | Problème | Conséquence | Amélioration | Type |
|---|---|---|---|---|
| Shell prestataire | Menu compte fermé visible/cliquable (BUG-001) | Déconnexion accidentelle | CSS `[open]` only | Défaut interaction |
| Pages connectées | Overlay erreur Turbopack plein écran (BUG-002) | Blocage total des clics | Réparer module signature | Défaut affichage bloquant |
| Qualification / Devis | Titre `Matricia \| Matricia` | Confusion onglet / SEO faible | Metadata par route | Présentation |
| Accueil | Hero lisible, CTA primaire rouge claire | OK | — | — |
| Consultations vides | État vide explicite + étapes préparatoires | Compréhensible | — | — |
| Tableau de bord | Boutons carousel disabled sans label accessible clair (`button` sans name) | Navigation clavier opaque | `aria-label` | Accessibilité |
| Connexion | Boutons démo présents en development | OK pour tests ; risque si exposé en prod | Vérifier `demo-policy` en preview/prod | Risque config |
| Images scènes | Warning width/height | Layout shift potentiel | `width/height: auto` CSS | Présentation |

## Accessibilité — vérifié

- Skip link « Aller au contenu principal » présent sur accueil (snapshot).
- Formulaires connexion : labels présents (`Adresse courriel professionnelle`).
- Langue FR/AR links avec `aria-current` sur shell.

## Accessibilité — non vérifié

- Parcours clavier complet, pièges modales, contraste mesuré, zoom 200 %, lecteur d’écran.

## Responsive

- Sur viewport étroit, la nav prestataire se présente en grille multi-colonnes dans le rail (capture `AUDIT-PROVIDER-QUALIF.png`) — lisible mais dense ; à retester à 360 / 768 / 1280 px une fois BUG-002 levé.
