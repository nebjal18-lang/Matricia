# Coffre Finance et coût nul réellement documenté

Ce lot complète le rapprochement économique Franchisé. Il conserve le coût positif dérivé d’un journal HT et ajoute une preuve documentaire explicite de coût nul. Les nouvelles pièces appartiennent à une capture vérifiée ou une réception de prestation réelle ; elles ne sont pas des documents d’identité réutilisés comme exonération.

## Parcours et frontières

1. `list_finance_cost_reconciliation_targets_v1` fournit des cibles réelles FR/AR, vingt par page, avec une capacité `canUpload` calculée par les rôles et l’assurance courants. Aucun identifiant libre n’est demandé à l’utilisateur.
2. Finance AAL2 réserve une identité de fichier, puis envoie ses octets dans le bucket privé `finance-cost-proofs`. La réservation fige l’auteur, la cible, le nom, la taille, le MIME et le SHA-256. Un conflit Storage ne vaut jamais validation des octets.
3. Le serveur autorise cette réservation avec la session native avant de lire le moindre objet avec ses droits de service. Il télécharge, vérifie taille, empreinte et signature MIME, puis confirme l’envoi. La page peut annoncer un vrai état d’attente si le scanner n’a pas fini.
4. Le consommateur sous bail télécharge à nouveau l’objet et utilise l’adaptateur antivirus signé existant. Seuls les résultats de ce serveur de confiance peuvent rendre une pièce CLEAN. Une erreur, un bail périmé ou des octets manquants ne produisent aucun succès implicite. Les tentatives sont bornées et la reprise explicite conserve les résultats antérieurs.
5. L’approbateur distinct récupère le fichier par l’API privée. Le serveur vérifie ses octets avant de créer un reçu de récupération, puis retourne le fichier sans cache ni URL publique. Aucun SELECT Storage authentifié direct n’est accordé pour ce bucket.
6. Le proposant ne peut pas approuver son propre dossier. L’auteur du fichier, l’opérateur, le réceptionnaire et les membres concernés ne peuvent pas agir comme approbateurs indépendants. Le hash de la proposition et le reçu serveur du bon document sont obligatoires. Un choix opposé à une décision conservée échoue.
7. Le rapprochement inscrit deux faits analytiques prouvés, PSP et réalisation. Une gratuité confirmée n’engendre aucun journal nul ni aucune entrée de caisse. Le délai réel de clôture reste requis même si les coûts sont prêts.
8. Une révocation indépendante bloque les nouvelles opérations. Le remplacement d’une preuve nulle par une autre preuve nulle ajoute une version de source et d’attribution, sans supprimer l’historique ni modifier une écriture financière.

Les absences de session, de second facteur et d’habilitation sont distinguées. Les pannes Auth, Storage et scanner restent des incidents techniques ; elles ne deviennent ni déconnexion automatique, ni coût nul, ni preuve vide réussie.

## Intégration partagée à effectuer par le propriétaire root

Le lot fournit les nouvelles routes et `scanOneFinanceCostDocument`. Pour le dispatcher partagé, ajouter :

```ts
if (eventType === "FinanceCostDocumentUploadedV1") return "FINANCE_COST_SCAN";
```

Dans le consommateur outbox serveur, après validation habituelle de l’enveloppe et de son authentification :

```ts
if (parsed.data.eventType === "FinanceCostDocumentUploadedV1") {
  const upload = z.string().uuid().safeParse(parsed.data.payload.upload_id);
  if (!upload.success) return Response.json({ code: "FINANCE_COST_SCAN_PAYLOAD_INVALID" }, { status: 400, headers });
  const scanned = await scanOneFinanceCostDocument(getSupabaseAdminClient(), upload.data);
  return Response.json({ outcome: scanned.code, eventId: parsed.data.id }, {
    status: scanned.ok ? 202 : 503,
    headers: { ...headers, "x-matricia-outbox-consumer": "FINANCE_COST_SCAN" },
  });
}
```

L’import est `@/modules/shared/lib/finance-cost-proofs/scan-consumer`. Un scan ciblé ne renvoie pas un faux « aucune tâche » lorsque le document est simplement en attente, occupé, en reprise différée ou en erreur. L’ACK n’est possible qu’après un verdict terminal natif CLEAN ou REJECTED. Une tournée sans cible peut, elle, constater une vraie file vide.

La route de drain `GET/POST /api/workers/finance-cost-scans` exige le secret de cron existant et traite une pièce. Les paramètres de déploiement et l’activation périodique hébergée restent à vérifier par l’intégration. Aucun secret ne figure dans ce dossier.

La page serveur Finance peut charger :

```ts
client.rpc("list_finance_cost_reconciliation_targets_v1", {
  p_locale: locale, p_page: 1, p_search: null,
});
```

Réponse : `{targets: [{id, component, label}], canUpload, page, page_size: 20, has_more}`. Les propositions ZERO et leurs documents sont chargés séparément par le panneau, cible par cible, via `get_finance_cost_documents_v1` ; chaque liste est bornée à vingt éléments et expose `has_more`. Les coûts positifs restent dans leur parcours de rapprochement de journaux.

## Vérifications de l’auteur

- Tests serveur, consommateur et routes : **30 PASS, quatre fichiers**, incluant octets réels, hash, chemin, identité d’acteur, panne Auth distincte, absence de service read avant autorisation, origine, refus des champs de preuve fournis par le navigateur, baux, analyse indisponible, ACK et budget de réponse.
- Typecheck Web : **PASS** sur le lot serveur, ses quatre fichiers de tests et les routes finales ; lint ciblé **PASS**. Les contrôles d’intégration sur le code final et le panneau UI ont leurs propres reçus.
- SQL `0370` : **recette à exécuter par root** sur sa cible isolée ou son rejeu neuf. Le test utilise des commandes natives, des métadonnées Storage et des verdicts explicitement TEST pour le contrat DB, sans désactiver de trigger. Les contrôles d’octets et le protocole réel de scanner sont des preuves d’adaptateur distinctes. Aucun succès SQL ou navigateur n’est anticipé dans cette section.

Le test `0370` couvre notamment la pièce non analysée, le SHA nul interdit pour CLEAN, un bail incorrect, l’auto-approbation, la récupération serveur obligatoire, les claims MFA absents/nuls, les rôles composites en lecture seule, les cibles réelles, les deux coûts nuls indépendants, l’absence de journal inventé, la révocation et la nouvelle version de preuve.

## Portée de certification

Ce code n’établit ni une règle commerciale de gratuité, ni un tarif, ni une approbation fiscale ou juridique. Il met en œuvre la revue indépendante du justificatif réellement fourni. Les captures de développement et les tests SQL ne certifient pas un antivirus de production, une signature juridique, une connexion à un hébergeur ou un virement bancaire. Les fichiers et comptes utilisés pour les tests restent explicitement de test.
