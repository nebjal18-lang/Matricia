# Consolidation Matricia — 1er novembre 2026

**État : version de revue technique, application non validée pour livraison définitive.** Le périmètre a été figé après le signalement du temps écoulé. Les développements inachevés sont conservés séparément et ne sont pas présentés comme livrés. Aucun déploiement ni push de production n’a été effectué.

## Vérifications acquises

| Contrôle | Résultat et portée |
| --- | --- |
| Compilation complète | PASS sur le code consolidé ; cible de métadonnées HTTPS localhost, sans déploiement. |
| Typage et lint globaux | PASS. |
| Tests unitaires | 2 315 assertions exécutées PASS : 2 076 web, 102 worker, 137 bibliothèques. Un test Storage opt-in n’est pas activé dans cette suite. |
| Storage opt-in | Exécuté séparément : 1/1 PASS avec objets synthétiques locaux, upload/download/SHA/refus public/suppression. |
| Rejeu isolé neuf | 416 migrations exécutées sur cet instantané, avant le garde033 ci-dessous ; 280 contrats SQL, dont 265 PASS et **15 FAIL**, 6 146 assertions observées. Le rejeu global est donc FAILED. |
| Sécurité runtime du laboratoire | 608 tables publiques, toutes sous RLS ; pgTAP non exécutable par les rôles API ; nettoyage du laboratoire PASS. |
| Parcours commercial SDK8 | 8/8 PASS, sans échec/ignoré/instable : deux chaînes FR/AR jusqu’à réception, PDF privés, contrôles Storage et accès après révocation. Cette preuve concerne l’empreinte SDK8, antérieure aux derniers lots ; la signature reste simulée en développement. |
| Contrôles structurels | Catalogue, phase00, exports Server Actions, absence de marqueurs et structure release PASS sur l’instantané contrôlé. Traçabilité inchangée : 5/76 VERIFIED, aucun visa inventé. |
| GitHub | Branche demandée revérifiée : `origin/codex/bootstrap-foundation` et HEAD initial à `dbf309cd4ec5c48212c43243203dd98150ee5114`. |

Preuve du rejeu : `work/isolated-replay/fa9eafb8-ba8f-4ec8-b6de-248aa1d9e13e/summary.json`. Journaux de consolidation : `/tmp/matricia-consolidation-final-{build,types,lint,unit}.log` et `/tmp/matricia-consolidation-native-storage.log`. Rapport SDK8 SHA256 : `0eeac251e8c253faf20881295d2b1516c2cf807e608a09df6e25a33e3560be8a`.

## Principaux développements consolidés

- Organisations, contexte actif et mandats : droits relus, absence de repli silencieux vers une autre organisation, révocation de session effective sur REST/RLS/Storage, preuve liée protégée contre suppression et perte d’adhésion.
- Client/Prestataire : demandes, devis, contrats/PDF, signature de développement gouvernée, missions/livrables/réception ; exécution du service historique signé malgré une seconde publication et l’archivage ultérieur du catalogue.
- Argent : montants entiers exacts, cadeaux à quatre yeux, origine de financement canonique, admissions/quota/capacité et courses FEFO, préparation PSP durable et inbox de callbacks, attribution fiscale et allocations natives. La réconciliation finale et la clôture sûre restent des points de contrôle ci-dessous.
- Boxes : configuration native avec règle approuvée, budget/slots/tenant/MFA et conservation de version ; offre/prix/report figés avant PSP ; états de paiement en attente distingués d’une confirmation. Les nouvelles règles retirées ne peuvent pas entrer dans une nouvelle promesse.
- Crédits mensuels : exécuteur SERVICE avec source de paiement/cycle/mois, leases, idempotence et reprise à quatre yeux. Ce lot a 36 assertions SQL locales ciblées ; il n’a pas été installé dans la base partagée.
- Données personnelles : périmètre vérifié, restrictions marketing appliquées aux consommateurs, fichiers privés relus/accusés, lecteur financier paginé exact et borné avant agrégation, gouvernance d’effacement et refus de fausses clôtures partielles. Les effets réellement développés sont distingués des adaptateurs manquants.

Le dernier garde financier033 (`f5d1ef7`) est intégré séparément : **68/68 assertions SQL PASS/ROLLBACK sur clone**, dont le vrai refus de clôture avec revenu natif mais sans coûts/frais réconciliés. Il ne crée aucun payout ni coût par défaut et n’est pas installé sur la base partagée. Le rejeu global ci-dessus précède ce garde SQL ; il ne certifie pas tout le candidat final.

Les résultats ciblés par domaine sont détaillés dans [Client](client-avancement-2026-11-01.md), [Admin](ADMIN_DELIVERY_STATUS_2026-11-01.md), [crédits automatiques](credits-abonnement-worker-268081.md) et [lecteur financier DSR](DSR_FINANCIAL_BATCH_READER_2026-11-01.md). Un test ciblé vert ne remplace pas le rejeu global ci-dessus.

## Quinze contrats SQL encore en échec

| Contrat | Premier refus observé |
| --- | --- |
| 0097, 0183, 0184, 0187, 0202, 0205, 0225, 0245, 0249, 0254, 0262 | `BOX_CHECKOUT_POLICY_REQUIRED` |
| 0246 | `APPROVED_PAYMENT_POSTING_MAPPING_REQUIRED` |
| 0104 | `CONTRACT_SERVICE_SOURCE_INCOHERENT` |
| 0217 | `SC_SERVICE_REQUIRED` |
| 0218 | `ECONOMIC_CAPTURE_JOURNAL_MISMATCH` |

Ces scénarios doivent être diagnostiqués et réalignés sur les préconditions réelles ou corrigés lorsqu’ils révèlent un défaut produit. Les gardes ne doivent pas être désactivées pour obtenir du vert. Aucun de ces quinze contrats n’est déclaré validé.

## Blocages internes avant livraison

1. Fermer ces quinze contrats et refaire la recette sur un candidat figé.
2. Paiements : rattachement adverse exact au paiement/environnement ; résolution du croisement OPEN inbox → WON canonique ; callback d’un plan vendu puis retiré ; réconciliation des historiques sans ancre commerciale prouvée.
3. Boxes : sous-enveloppes multi-utilisateurs, multi-bibliothèques/recommandations, conservation des droits sur un avantage vendu puis retiré, politiques d’admission figées avant vente, agrégation/pagination des grands wallets et achat de packs utilisable de bout en bout.
4. Finance : frais/coûts effectivement prouvés, inversions économiques de remboursement, allocation finale du pool, clôture et console. Le chantier032 et l’interface d’achat026 sont isolés WIP ; aucune marge/coût nul n’est inventé.
5. Protection des données : attribution des grants SERVICE dans les exports personnels, capture et remise multipartie complète, suppression physique et inventaire des versions/copies/sauvegardes, adaptateurs Auth/questionnaires/messages/processeurs. La capacité native de pseudonymisation Auth a été testée sur un compte synthétique, mais son adaptateur applicatif et son canal de remise après fermeture ne sont pas développés.
6. Exécuter les nouvelles interfaces/avantages en navigateur FR/AR, les recettes complètes accessibilité/performance et la restauration coordonnée. La restauration d’un clone de travail n’est pas un certificat de restauration de l’application.

WIP physique Provider conservé sur branche dans `09be4c3`, non intégré. Les brouillons batch/Admin et économiques/Franchisé restent hors des migrations du candidat.

## Accès externes et application en base

Le réseau cloud actif reste en révision1, sans accès aux API Supabase/Vercel ajoutées au brouillon sauvegardé ; celui-ci doit être activé dans les paramètres cloud. Supabase DEV seul est autorisé. Les références Railway, une cible Vercel distincte hors production, le fournisseur/niveau de signature, l’identité légale complète et les décisions CNDP/fiscales restent à fournir/valider. Le staging, la restauration hébergée, la remise et le PV client ne sont pas signés.

Le code Git et la base partagée ne sont pas uniformément synchronisés : les derniers lots ont été validés sur clones ou dans des transactions entièrement annulées. Ne pas appliquer aveuglément toutes les migrations déjà passées ; un plan différentiel vérifié est requis.

**Correctif de remboursement301fa66 : non appliqué à la base partagée.** Deux examens automatiques l’ont refusé, malgré les preuves sur clone, faute d’accord explicite sur la cible locale partagée `postgres` de `supabase_db_Matricia`, port54322 publié sur toutes les interfaces. Une question précise est pendante auprès de l’utilisateur ; sa frustration sur le délai ne constitue pas cette approbation. Aucune nouvelle tentative ni application indirecte de ce correctif n’est autorisée sans réponse.

Les credentials restent hors Git et ne sont pas recopiés dans ce rapport.

Branche locale de revue prévue : `codex/consolidation-client-20261101`. Le dossier de travail et l’index initial sont conservés ; cette branche est un instantané du travail consolidé, pas une publication distante.
