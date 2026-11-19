# Admin parcours — bug log

Statuts : `OPEN` | `FIXED` | `VERIFIED`. Une vague ne se ferme que si tous ses bugs sont `VERIFIED`.

| id | vague | page | sévérité | code | description | statut |
|---|---|---|---|---|---|---|
| BUG-001 | V1 | franchises | high | UI_DB_MISMATCH | Annuaire « actifs » vs RPC tous statuts | VERIFIED |
| BUG-002 | V1 | candidatures-franchise | high | UI_DB_MISMATCH | Email invite hors transaction / hors outbox | VERIFIED |
| BUG-003 | V1 | candidatures-franchise | high | TEST_GAP | 0402 sans ALLOW AAL2 / jamais ACTIVE | VERIFIED |
| BUG-004 | V0 | parcours | high | NO_GATE | Hub omet étapes 1–2, 3–4, 11 | VERIFIED |
| BUG-005 | V3 | finance | high | JARGON_BLOCK | AAL2, ledger, wallet, RLS, idempotency_key visibles | VERIFIED |
| BUG-006 | V4 | operations | high | JARGON_BLOCK | Outbox, dead-letter, RPC, payloads | VERIFIED |
| BUG-007 | V1b | invitations-reseau | critical | NO_BRIDGE | Pas de supervision invitations réseau admin | VERIFIED |
| BUG-008 | V0 | directory | medium | JARGON_BLOCK | sandbox, Event Outbox, RLS, DSR | VERIFIED |
| BUG-009 | V2 | acteurs boards | medium | JARGON_BLOCK | CTA « Afficher les fixtures » | VERIFIED |
| BUG-010 | V3 | matching | medium | JARGON_BLOCK | Titre Matching / RFQ non métier | VERIFIED |
| BUG-011 | global | shell | medium | A11Y | landmarks main imbriqués / 3 recettes header | VERIFIED |
| BUG-012 | V0 | space-journey | medium | NO_NEXT | Acteurs spaces next = null | VERIFIED |
