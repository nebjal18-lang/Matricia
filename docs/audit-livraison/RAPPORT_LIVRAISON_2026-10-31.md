# Audit de préparation à la livraison définitive — Matricia

**Date : 31 octobre 2026. Référence de code : HEAD `dbf309cd4ec5c48212c43243203dd98150ee5114` + corrections locales présentes dans l’arbre de travail.**

## Verdict

**La livraison définitive de toute la V1 au client n’est pas encore justifiable.** Le socle local est solide et plusieurs moteurs métier sont avancés. La faiblesse dominante est la continuité entre des écrans parfois très finis visuellement, les commandes métier réellement exécutées et la preuve que le résultat est obtenu. Certains écrans annoncent encore des sauvegardes, scores, statuts ou actions qu’ils ne réalisent pas.

Ce rapport recense **87 éléments de travail : 70 P1 et 17 P2**, couvrant corrections, développements, raccordements, activation, recette, exploitation et remise. **Ce ne sont pas 87 vulnérabilités ni 87 fonctionnalités absentes.** Un même chantier peut fermer plusieurs exigences V1. Les 68 fonctions et les 8 exigences Marketing ont leur propre matrice de fermeture, sans fusion ni extension vers les fonctions 069–090 hors périmètre V1.

Les erreurs de compilation et de tests corrigées auparavant restent corrigées. Cet audit examine les comportements et la préparation à la livraison que ces tests ne couvrent pas entièrement. Le verdict n’autorise aucune intervention en production.

## Méthode, preuves et limites

- Six revues indépendantes en lecture seule : Client/Public, Prestataire, Franchisé, Administration/Sécurité, Marketing/Intégrations/Exploitation, Couverture V1/Release. Les agents n’ont modifié aucun fichier produit. La synthèse ajoute uniquement les livrables de cet audit.
- Lecture des consignes `AGENTS.md`, du Gold Master V4 ciblé, des compétences métier et des chaînes route→composant→action→repository/RPC→effet. Pas de chargement du catalogue complet de 6 000 questions.
- Relecture croisée des preuves historiques : un test ancien ou une présence dans une matrice n’est pas traité comme certification du futur candidat.
- Commandes de ce tour : `release:validate`, inventaire d’interactions `--check`, métadonnées SQL locales et requêtes HTTP locales non mutantes. Le gate de release retourne 0 **avec seulement 5/76 signatures**, car il certifie la structure, pas la livraison.
- Surface locale mesurée : **461 tables publiques, toutes avec RLS activée ; 446 fonctions publiques SECURITY DEFINER ; 467 politiques**. Cette surface importante exige une matrice de permissions par cas ; RLS activée ne signifie pas autorisation exhaustive prouvée.
- Inventaire statique courant : **204 routes, dont 161 pages et 26 handlers ; 253 actions ; 1 333 interactions ; 525 éléments de dette heuristique de validation runtime**. Les 525 ne sont pas 525 défauts démontrés. Les anciens totaux 107 routes/614 interactions sont historiques.
- Vérification locale directe : `/api/readiness` renvoie HTTP 200 et `ready` ; `/api/workers/marketing-content` renvoie HTTP 405 alors que le cron Vercel appelle cette route par GET. La première réponse ne prouve pas que tous les workers externes tournent.
- Les **1 265 tests unitaires, 174 fichiers SQL/3 833 assertions/4 scénarios de concurrence, 233 migrations sur base neuve et 18 E2E publics/cookies** restent les acquis de la correction précédente sur ce code ; ils n’ont pas été recomptés comme nouveaux tests de cet audit. Des preuves authentifiées historiques existent également, mais sont datées et incomplètes pour le candidat final.
- Aucun compte, secret ou service distant Supabase/Vercel/Railway n’a été inspecté pour établir son état réel. Aucune configuration distante manquante n’est déduite de sa seule absence dans Git. Aucun paiement, déploiement, campagne, email ou mutation métier de production n’a été déclenché.
- Revue de code ciblée et contrôles locaux : **ce n’est ni un pentest complet ni une certification juridique/WCAG ou une recette exhaustive de chaque combinaison de données**. Aucun P0 exploitable n’a été reproduit ; des défauts P1 de livraison sont pourtant confirmés.

## Sens des priorités et des travaux

- **P1 : nécessaire avant une réception définitive du périmètre concerné.** Cela inclut un parcours bloqué, une information métier trompeuse, une protection/configuration dangereuse ou une preuve de mise en service indispensable. P1 n’est pas une note de vulnérabilité.
- **P2 : mise au même niveau de qualité et d’utilisabilité avant la remise complète.** Ces points restent à fermer quand le workflow est vendu au client ; ils ne doivent pas être transformés en faux PASS.
- **Correction / raccordement / développement** : du code ou un contrat doit changer.
- **Activation / validation externe** : utiliser et prouver les adaptateurs déjà présents avec des accès et décisions habilités, plutôt que les réécrire.
- **Recette / gouvernance / exploitation** : obtenir une preuve et une procédure réelles. Une case cochée ou un document créé ne suffit pas.

## Écarts de niveau entre les domaines

| Domaine | Niveau réel observé | Écart principal avant livraison |
|---|---|---|
| Socle local et base | Typage/build/tests verts, migrations/RLS/ledgers et nombreux contrats réels | Gates de release trop structurels, preuve métier incomplète et absence de candidat figé |
| Site public | Navigation et présentation plus homogènes, E2E FR/AR récents | Acceptations serveur, textes juridiques et portée des préférences à terminer |
| Client | Questionnaires, portefeuille, crédits, RFQ/comparaison et coffre backend réels | Assistance humaine, solutions, progression, documents et évolution multi-organisation inégaux |
| Prestataire | Devis/versions/calculs/éligibilité, régions, missions et facturation backend présents | Preuve de paiement incompatible avec le scan, pièces/PDF, contexte organisation et statuts de détail |
| Franchisé | Gouvernance/finance/mandats/CRM/commandes catalogue réels | Constructeurs visuels, règles simulées, messagerie, soldes tronqués et KPI trompeurs |
| Administration | Vraies décisions dédiées, MFA/AAL2, audit et supervision présents | Actions génériques non exécutées, faux badges de sécurité, annuaire/exports et privacy inaboutis |
| Marketing | Campagnes/calendriers/attribution et adaptateurs sociaux réels | Cron de génération inopérant, robustesse des publications, provider IA et validation distante |
| Exploitation | Logs corrélés, quelques healthchecks/readiness et runbooks | Détection DLQ/heartbeat, commandes de reprise, métriques/alertes et restauration démontrée |

## Travaux à traiter en premier

1. **Contexte métier exact** : `CLI-01/02`, `PRE-02`, `FRA-05`, `ADM-05`. Un utilisateur multi-organisation doit toujours consulter et modifier le dossier affiché ; ne pas confondre cette erreur de sélection avec une fuite RLS vers un non-membre non démontrée.
2. **Argent et documents fiables** : `PRE-01/03/04/05/06`, `FRA-06`, `PAY-01/02/03`, `SEC-01`. Aucun paiement neuf ne doit échouer par raccordement manquant, aucun solde ne doit dépendre d’une limite de liste et aucun export ne doit interpréter une donnée comme formule.
3. **Effets réels et honnêteté des écrans** : `CLI-04/05/06/07/09`, `FRA-01/02/03/04/07/10/11`, `ADM-01/02/03/08`. Remplacer les mises en scène par l’état métier et l’action effectifs ; les fonctions obligatoires ne se ferment pas en retirant seulement leurs boutons.
4. **Automatisations réellement opérantes** : `MKT-01/02/03`, `OPS-01/02/03/04`, `EML-02`. Chaque événement et chaque cron doivent aboutir à l’effet attendu, y compris sous panne ou réponse ambiguë.
5. **Conditions légales et contractuelles** : `PUB-01/02`, `ADM-06`, `SIG-01`, `EXT-03`. Les données légales, règles comptables, niveaux de signature et autorisations ne peuvent pas être inventés par l’équipe technique.
6. **Preuves bloquantes de réception** : `QA-01/02/03`, `REL-01/02/06/08`, `EXT-01/02/04/05`. Le nombre de tests verts ne ferme pas les parcours non exécutés.

## Ce qui est déjà développé et doit être conservé

- Auth OTP locale vérifiée, MFA plateforme rétabli, contrôle de rôles actifs et AAL2 côté serveur ; ne pas refaire l’authentification depuis zéro.
- Isolation RLS, montants en unités mineures, ledgers immuables, idempotence, versions et outbox sur de nombreux workflows.
- Questionnaires : saisie structurée, complétude réelle, autosave, conflits et données versionnées ; c’est le raccordement de certains résumés qui est faux.
- RFQ, comparaison de devis, matching explicable et rotation ; certaines fonctions ont des visas historiques utiles à rejouer.
- Qualification/régions/capacité, contrats/missions/livrables, facturation/rapprochement/réputation : modèles et RPC présents, avec défauts d’interface/intégration identifiés ci-dessous.
- Gouvernance Franchisé, règles IT 50/50/0 et droit d’entrée nul, mandats versionnés, P&L/clôtures/allocations et commandes catalogue réelles.
- Paiements PayPal/CMI, email Resend/générique et réseaux LinkedIn/Meta possèdent de vrais adaptateurs ; leurs limites et leur activation ne doivent pas être confondues avec une absence totale de code.

## Backlog détaillé

Chaque ligne du CSV correspond au ticket détaillé ci-dessous. Responsable = rôle proposé, pas affectation nominative. Les dépendances décrivent un ordre utile de fermeture, sans estimation de délai inventée.
## Public et identité — 4 éléments
### PUB-01 · P1 · Prouver réellement l’acceptation des CGU

**Nature :** Raccordement. **Responsable proposé :** Backend identité + responsable juridique.

**Constat :** Le consentement d’inscription est un état React ; l’action OTP ne reçoit ni acceptation ni version du texte.

**À faire :** Valider côté serveur l’acceptation requise, sa version/langue et sa date ; prévoir la réacceptation des évolutions applicables.

**Recette de fermeture :** Tentative d’inscription sans acceptation refusée ; inscription valide liée à une preuve auditable du texte exact. Le login OTP d’un compte existant ne requiert pas une nouvelle acceptation à chaque connexion.

**Preuves :** [apps/web/app/[locale]/(public)/inscription/inscription-consent.tsx:8](/workspace/matricia/apps/web/app/[locale]/(public)/inscription/inscription-consent.tsx:8) ; [apps/web/app/[locale]/connexion/actions.ts:16](/workspace/matricia/apps/web/app/[locale]/connexion/actions.ts:16).

**Dépendances :** PUB-02.

### PUB-02 · P1 · Finaliser les textes et obligations juridiques

**Nature :** Validation externe. **Responsable proposé :** Client + juridique / DPO + produit.

**Constat :** Mentions éditeur/hébergeur génériques, CGU centrées sur le site public et politique de conservation générale ; conformité aux traitements réels non prouvée.

**À faire :** Faire approuver identité légale, contacts, CGU métier, conditions contractuelles, politique de confidentialité, destinataires/transferts, durées et formalités CNDP applicables.

**Recette de fermeture :** Versions approuvées correspondant aux services et sous-traitants réellement utilisés, publiées FR/AR ; responsabilités et références de validation consignées.

**Preuves :** [apps/web/modules/public/data/legal/documents.ts:23](/workspace/matricia/apps/web/modules/public/data/legal/documents.ts:23) ; [apps/web/modules/public/data/legal/documents.ts:64](/workspace/matricia/apps/web/modules/public/data/legal/documents.ts:64) ; [apps/web/modules/public/data/legal/documents.ts:79](/workspace/matricia/apps/web/modules/public/data/legal/documents.ts:79) ; [docs/DECISIONS_REQUIRED.md:25](/workspace/matricia/docs/DECISIONS_REQUIRED.md:25).

### PUB-03 · P2 · Relier les préférences de recontact aux communications

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** serviceMessages est seulement enregistré dans localStorage ; aucun expéditeur ne consomme cette préférence alors que le libellé parle d’acceptation de recontact.

**À faire :** Relier les consentements pertinents aux préférences du compte et à la chaîne d’envoi, ou préciser strictement la portée locale du réglage.

**Recette de fermeture :** Refus respecté par le canal et le compte concernés ; changement tracé sans confondre cookies nécessaires et communications commerciales.

**Preuves :** [apps/web/modules/public/data/legal/cookie-preferences.tsx:6](/workspace/matricia/apps/web/modules/public/data/legal/cookie-preferences.tsx:6) ; [apps/web/modules/public/data/legal/cookie-preferences.tsx:62](/workspace/matricia/apps/web/modules/public/data/legal/cookie-preferences.tsx:62).

**Dépendances :** PUB-01.

### PUB-04 · P2 · Restaurer le lien profond après reconnexion

**Nature :** Correction. **Responsable proposé :** Identité + frontend transversal.

**Constat :** La redirection du proxy vers connexion ne conserve pas systématiquement next et ses filtres.

**À faire :** Utiliser un retour local validé, préservant dossier, organisation, langue et paramètres autorisés pendant OTP/MFA.

**Recette de fermeture :** Session expirée depuis un dossier : retour au même dossier après connexion ; redirection externe malveillante refusée.

**Preuves :** [apps/web/modules/shared/lib/supabase/proxy.ts:74](/workspace/matricia/apps/web/modules/shared/lib/supabase/proxy.ts:74).

## Client — 12 éléments
### CLI-01 · P1 · Appliquer le contexte d’organisation aux diagnostics

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Le hub charge diagnostics, sessions et besoins des organisations accessibles sans filtrer uniformément sur l’organisation sélectionnée.

**À faire :** Passer un contexte autorisé explicite aux loaders, historique, dernier diagnostic, intakes et liens ; refuser le scope invalide.

**Recette de fermeture :** Compte membre de A et B : la vue A ne contient que A, et toutes ses actions restent sur A. Aucune fuite vers un non-membre n’est démontrée ici.

**Preuves :** [apps/web/app/[locale]/client/diagnostics/page.tsx:26](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/page.tsx:26) ; [apps/web/app/[locale]/client/diagnostics/page.tsx:55](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/page.tsx:55) ; [apps/web/modules/shared/lib/diagnostics-opportunities/server-repository.ts:1](/workspace/matricia/apps/web/modules/shared/lib/diagnostics-opportunities/server-repository.ts:1).

### CLI-02 · P1 · Comparer les bonnes séries d’évolution

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Les points sont regroupés par bibliothèque seulement ; deux entreprises d’une même bibliothèque peuvent alimenter un même delta.

**À faire :** Filtrer par organisation et regrouper selon organisation, bibliothèque et base/version de comparaison compatible.

**Recette de fermeture :** Deux entreprises aux scores opposés ne sont jamais comparées entre elles ; les changements de version non comparables sont explicités.

**Preuves :** [apps/web/modules/shared/lib/diagnostics-evolution/repository.ts:13](/workspace/matricia/apps/web/modules/shared/lib/diagnostics-evolution/repository.ts:13) ; [apps/web/modules/shared/lib/diagnostics-evolution/repository.ts:61](/workspace/matricia/apps/web/modules/shared/lib/diagnostics-evolution/repository.ts:61).

**Dépendances :** CLI-01.

### CLI-03 · P1 · Rendre la synthèse d’évolution fidèle

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Des points historiques sont présentés comme des dimensions ; le texte de trajectoire positive est constant, même en dégradation.

**À faire :** Calculer les dernières dimensions comparables et produire progression, stabilité, dégradation ou données insuffisantes.

**Recette de fermeture :** Jeux de données couvrant les quatre situations ; aucun verdict positif constant.

**Preuves :** [apps/web/app/[locale]/client/diagnostics/evolution/page.tsx:42](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/evolution/page.tsx:42) ; [apps/web/app/[locale]/client/diagnostics/evolution/page.tsx:69](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/evolution/page.tsx:69) ; [apps/web/app/[locale]/client/diagnostics/evolution/page.tsx:110](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/evolution/page.tsx:110).

**Dépendances :** CLI-02.

### CLI-04 · P1 · Calculer progression et prochaines actions

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Le hub affiche progressPct:65 pour toute session ; ses tâches sont proposées systématiquement. Le questionnaire possède déjà une complétude réelle.

**À faire :** Réutiliser answeredCount/questionCount et dériver les tâches de l’état réel du dossier.

**Recette de fermeture :** Sessions à 0 %, partielles et complètes affichées correctement ; aucune tâche déjà terminée ni prochaine action sans objet.

**Preuves :** [apps/web/app/[locale]/client/diagnostics/page.tsx:93](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/page.tsx:93) ; [apps/web/app/[locale]/client/diagnostics/page.tsx:104](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/page.tsx:104) ; [apps/web/modules/client/screens/questionnaires/questionnaire-panel.tsx:40](/workspace/matricia/apps/web/modules/client/screens/questionnaires/questionnaire-panel.tsx:40).

**Dépendances :** CLI-01.

### CLI-05 · P1 · Terminer la demande d’assistance humaine

**Nature :** Développement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Zone de dépôt sans input, sauvegarde sans handler, consentement précoché non persisté et envoi remplacé par un lien /client/messages absent. Le panneau IA voisin ne constitue pas une demande à un expert.

**À faire :** Livrer demande persistée/versionnée, pièces privées scannées, brouillon, consentement, envoi, accusé, affectation, conversation et historique ; utiliser la vraie messagerie.

**Recette de fermeture :** Création/reprise/envoi FR/AR jusqu’à réception par le conseiller ; erreurs, révocation et accès étranger refusé.

**Preuves :** [apps/web/app/[locale]/client/diagnostics/assistance/page.tsx:111](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/assistance/page.tsx:111) ; [apps/web/app/[locale]/client/diagnostics/assistance/page.tsx:128](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/assistance/page.tsx:128) ; [apps/web/app/[locale]/client/diagnostics/assistance/page.tsx:132](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/assistance/page.tsx:132).

**Dépendances :** PUB-01.

### CLI-06 · P1 · Rendre les solutions réellement interactives

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Filtres à option unique et reset sans effet, contrôles focusables sous aria-hidden ; Enregistrer pour plus tard ne persiste pas.

**À faire :** Brancher filtres/réinitialisation sur les résultats et enregistrer la sélection autorisée ; corriger la sémantique accessible.

**Recette de fermeture :** Le résultat change avec les filtres ; sauvegarde retrouvée après rechargement ; parcours clavier et lecteur d’écran cohérent.

**Preuves :** [apps/web/app/[locale]/client/diagnostics/solutions/page.tsx:100](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/solutions/page.tsx:100) ; [apps/web/app/[locale]/client/diagnostics/solutions/page.tsx:153](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/solutions/page.tsx:153).

### CLI-07 · P1 · Afficher les vraies propriétés d’une solution

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Un score est affiché comme Horizon typique ; Très compatible est constant ; la priorité présentée est un titre générique.

**À faire :** Relier délai/horizon, compatibilité expliquée et priorité sélectionnée à leurs données métier ; utiliser inconnu si indisponible.

**Recette de fermeture :** Solutions ayant scores/délais/priorités différents : chaque valeur a la bonne unité et la bonne provenance.

**Preuves :** [apps/web/app/[locale]/client/diagnostics/solutions/page.tsx:94](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/solutions/page.tsx:94) ; [apps/web/app/[locale]/client/diagnostics/solutions/page.tsx:112](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/solutions/page.tsx:112) ; [apps/web/app/[locale]/client/diagnostics/solutions/page.tsx:122](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/solutions/page.tsx:122).

**Dépendances :** CLI-06.

### CLI-08 · P1 · Brancher recherche et filtres des demandes

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Les contrôles q/statut du tableau ne filtrent pas la liste ; la page ne lit que organizationId.

**À faire :** Recherche et filtres serveur, codes de statut stables, pagination et conservation des paramètres.

**Recette de fermeture :** Terme et statut modifient réellement les résultats ; retour arrière et langue conservent la sélection ; total fiable.

**Preuves :** [apps/web/modules/client/screens/spaces/boards.tsx:382](/workspace/matricia/apps/web/modules/client/screens/spaces/boards.tsx:382) ; [apps/web/app/[locale]/client/demandes/page.tsx:1](/workspace/matricia/apps/web/app/[locale]/client/demandes/page.tsx:1).

### CLI-09 · P1 · Ouvrir et qualifier réellement les documents du coffre

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Tous les liens Ouvrir renvoient à la même page ; un document non expiré est marqué Partagé sans vérifier ses liaisons.

**À faire :** Utiliser l’API privée existante pour aperçu/téléchargement et distinguer privé, partagé, révoqué, expiré, en scan ou indisponible.

**Recette de fermeture :** Document CLEAN autorisé ouvert ; autre tenant/document non autorisé refusé ; révocation change immédiatement l’état et l’accès.

**Preuves :** [apps/web/app/[locale]/client/documents/page.tsx:31](/workspace/matricia/apps/web/app/[locale]/client/documents/page.tsx:31) ; [apps/web/app/[locale]/client/documents/page.tsx:42](/workspace/matricia/apps/web/app/[locale]/client/documents/page.tsx:42) ; [apps/web/app/api/client/documents/[documentId]/route.ts:35](/workspace/matricia/apps/web/app/api/client/documents/[documentId]/route.ts:35).

### CLI-10 · P1 · Ne plus présenter une panne comme un dossier vide

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Demandes, Documents et Finances convertissent plusieurs erreurs de chargement en tableaux vides.

**À faire :** États typés vide/interdit/indisponible/partiel, reprise et message actionnable ; conserver les sections saines.

**Recette de fermeture :** Panne PostgREST, refus de permission et vraie absence de données produisent trois états distincts.

**Preuves :** [apps/web/app/[locale]/client/demandes/page.tsx:21](/workspace/matricia/apps/web/app/[locale]/client/demandes/page.tsx:21) ; [apps/web/app/[locale]/client/documents/page.tsx:19](/workspace/matricia/apps/web/app/[locale]/client/documents/page.tsx:19) ; [apps/web/app/[locale]/client/finances/page.tsx:19](/workspace/matricia/apps/web/app/[locale]/client/finances/page.tsx:19).

### CLI-11 · P2 · Terminer le centre financier Client

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Le hub reconnaît des documents par regex sur type/nom et reste moins structuré que les domaines factures/paiements/crédits existants.

**À faire :** Alimenter factures, paiements, avoirs, échéances et soldes depuis les objets financiers autorisés ; distinguer Matricia et prestations directes.

**Recette de fermeture :** Même dossier consulté depuis mission, facture et centre financier : montants/devise/statuts identiques ; jamais une classification par simple nom de fichier.

**Preuves :** [apps/web/app/[locale]/client/finances/page.tsx:33](/workspace/matricia/apps/web/app/[locale]/client/finances/page.tsx:33) ; [apps/web/modules/client/screens/spaces/boards.tsx:627](/workspace/matricia/apps/web/modules/client/screens/spaces/boards.tsx:627).

### CLI-12 · P2 · Paginer et rechercher dans tout l’historique Client

**Nature :** Amélioration. **Responsable proposé :** Équipe produit / développement.

**Constat :** Les listes RFQ, versions, diagnostics et documents sont plafonnées ; la recherche sur l’échantillon peut perdre des dossiers anciens.

**À faire :** Pagination/recherche serveur, compteurs exhaustifs et accès direct par ID sous RLS.

**Recette de fermeture :** Entreprise dépassant 500 demandes et les plafonds documentaires : un ancien dossier reste trouvable et ouvrable.

**Preuves :** [apps/web/modules/client/data/rfq/server-repository.ts:9](/workspace/matricia/apps/web/modules/client/data/rfq/server-repository.ts:9) ; [apps/web/modules/client/data/documents/server-repository.ts:30](/workspace/matricia/apps/web/modules/client/data/documents/server-repository.ts:30).

## Prestataire — 11 éléments
### PRE-01 · P1 · Rendre la déclaration de paiement compatible avec le scan

**Nature :** Correction. **Responsable proposé :** Facturation + documents + worker.

**Constat :** Le formulaire calcule un hash et appelle record_provider_payment sans upload réservé ; la fonction finale exige une preuve du même acteur et CLEAN. Le chemin admin appelle aussi trop tôt après upload.

**À faire :** Réservation, upload privé, scan asynchrone, attente visible, reprise idempotente et rapprochement ; rattacher la bonne preuve au règlement.

**Recette de fermeture :** Preuve neuve, infectée, scanner indisponible, scan CLEAN, retry et double clic ; aucune déclaration réussie avant scan fiable.

**Preuves :** [apps/web/modules/provider/screens/facturation/actions.ts:34](/workspace/matricia/apps/web/modules/provider/screens/facturation/actions.ts:34) ; [apps/web/modules/admin/screens/providers/actions.ts:61](/workspace/matricia/apps/web/modules/admin/screens/providers/actions.ts:61) ; [supabase/migrations/20260915020700_provider_payment_proof_trusted_scan.sql:176](/workspace/matricia/supabase/migrations/20260915020700_provider_payment_proof_trusted_scan.sql:176).

### PRE-02 · P1 · Unifier le contexte multi-organisation Prestataire

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Qualification, missions, facturation et réputation prennent la première adhésion ; le planning peut mélanger devis de B et missions de A.

**À faire :** Passer l’organisation autorisée sélectionnée dans chaque repository/action/lien, à l’image du repository des devis.

**Recette de fermeture :** Compte A+B avec données divergentes : qualification, missions, planning, paiements et réputation suivent tous la sélection.

**Preuves :** [apps/web/app/[locale]/sous-traitant/qualification/page.tsx:19](/workspace/matricia/apps/web/app/[locale]/sous-traitant/qualification/page.tsx:19) ; [apps/web/modules/provider/data/qualification/repository.ts:43](/workspace/matricia/apps/web/modules/provider/data/qualification/repository.ts:43) ; [apps/web/modules/provider/data/missions/repository.ts:11](/workspace/matricia/apps/web/modules/provider/data/missions/repository.ts:11) ; [apps/web/modules/provider/data/billing/repository.ts:28](/workspace/matricia/apps/web/modules/provider/data/billing/repository.ts:28).

### PRE-03 · P1 · Terminer l’examen des pièces de qualification

**Nature :** Raccordement. **Responsable proposé :** Qualification + documents + sécurité.

**Constat :** Les versions privées existent, mais les écrans prestataire et examinateur ne chargent que les métadonnées ; parcours de téléchargement/scan correspondant non retrouvé.

**À faire :** Consultation privée autorisée, quarantaine/scan, historique des versions et accès examinateur avant validation.

**Recette de fermeture :** Pièce valide/EICAR, expiration, rejet et remplacement ; examinateur lit la bonne version ; accès étranger refusé.

**Preuves :** [apps/web/modules/provider/data/qualification/repository.ts:9](/workspace/matricia/apps/web/modules/provider/data/qualification/repository.ts:9) ; [apps/web/app/[locale]/sous-traitant/qualification/certifications/page.tsx:56](/workspace/matricia/apps/web/app/[locale]/sous-traitant/qualification/certifications/page.tsx:56) ; [apps/web/modules/admin/data/providers/repository.ts:82](/workspace/matricia/apps/web/modules/admin/data/providers/repository.ts:82).

### PRE-04 · P1 · Livrer les relevés et factures PDF immuables

**Nature :** Développement. **Responsable proposé :** Finance + PDF + juridique/comptabilité.

**Constat :** Montants et document_hash existent ; raccordement PDF stocké/téléchargeable non retrouvé ; le détail annonce systématiquement aucun document.

**À faire :** Générer deux documents distincts relevé officiel/facture, mentions/numérotation approuvées, stockage privé immuable, téléchargement et envoi.

**Recette de fermeture :** Clôture → relevé → facture PDF → envoi/téléchargement → avoir ; hash vérifiable et original jamais modifié.

**Preuves :** [apps/web/modules/provider/data/billing/repository.ts:38](/workspace/matricia/apps/web/modules/provider/data/billing/repository.ts:38) ; [apps/web/modules/provider/screens/spaces/workbenches.tsx:585](/workspace/matricia/apps/web/modules/provider/screens/spaces/workbenches.tsx:585) ; [supabase/migrations/20260912006300_provider_billing_reconciliation.sql:198](/workspace/matricia/supabase/migrations/20260912006300_provider_billing_reconciliation.sql:198).

**Dépendances :** PRE-01; EXT-03.

### PRE-05 · P1 · Afficher le vrai dossier de facture

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Livrables vides mais Tous acceptés constant ; MAD affiché pour toute devise ; régime normal et étapes terminées inconditionnels.

**À faire :** Charger lignes, pièces, relevé, réception, régime fiscal, règlements et historique ; calculer chaque statut depuis ces faits.

**Recette de fermeture :** Factures dans les devises supportées, paiement partiel, avoir, litige, absence de preuve et livraison refusée rendent les bons états.

**Preuves :** [apps/web/modules/provider/screens/spaces/workbenches.tsx:593](/workspace/matricia/apps/web/modules/provider/screens/spaces/workbenches.tsx:593) ; [apps/web/modules/provider/screens/spaces/workbenches.tsx:600](/workspace/matricia/apps/web/modules/provider/screens/spaces/workbenches.tsx:600) ; [apps/web/modules/provider/screens/spaces/workbenches.tsx:610](/workspace/matricia/apps/web/modules/provider/screens/spaces/workbenches.tsx:610).

**Dépendances :** PRE-04.

### PRE-06 · P1 · Convertir correctement les échéances Maroc/UTC

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** datetime-local est interprété par new Date dans le fuseau serveur ; le préremplissage tronque l’UTC. Sous serveur UTC, 18 h saisies deviennent 19 h au Maroc dans le cas vérifié.

**À faire :** Conversion explicite Africa/Casablanca ↔ UTC, identité de l’instant conservée à la révision.

**Recette de fermeture :** Tests serveur UTC et autre fuseau, période Ramadan et hors Ramadan ; saisie 18 h retrouvée 18 h après réouverture.

**Preuves :** [apps/web/modules/provider/screens/devis/quote-panel.tsx:84](/workspace/matricia/apps/web/modules/provider/screens/devis/quote-panel.tsx:84) ; [apps/web/modules/provider/screens/devis/actions.ts:50](/workspace/matricia/apps/web/modules/provider/screens/devis/actions.ts:50) ; [apps/web/modules/provider/screens/devis/prefill.ts:28](/workspace/matricia/apps/web/modules/provider/screens/devis/prefill.ts:28).

### PRE-07 · P1 · Ouvrir un ancien dossier par son ID

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Détail facture recherché dans les 50 dernières, missions limitées à 100 et documents aux dernières versions ; un lien autorisé ancien peut être introuvable.

**À faire :** Requêtes de détail directes par ID et scope validé ; pagination séparée pour les listes.

**Recette de fermeture :** 51e facture, 101e mission et ancienne version documentaire accessibles au bon membre et refusées à l’étranger.

**Preuves :** [apps/web/modules/provider/data/billing/repository.ts:40](/workspace/matricia/apps/web/modules/provider/data/billing/repository.ts:40) ; [apps/web/modules/provider/screens/spaces/nested-screens.tsx:239](/workspace/matricia/apps/web/modules/provider/screens/spaces/nested-screens.tsx:239).

**Dépendances :** PRE-02.

### PRE-08 · P2 · Ne pas annoncer un devis sauvé ou valide avant de l’être

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Brouillon enregistré et cinq coches sans blocage sont constants ; la date de création provient de l’échéance de consultation.

**À faire :** Dériver enregistrement, contrôles et dates du formulaire/snapshot réel, avec états serveur et local distincts.

**Recette de fermeture :** Brouillon vide, save échoué, taxe absente ou devis expiré : aucun succès/coché mensonger.

**Preuves :** [apps/web/modules/provider/screens/spaces/workbenches.tsx:264](/workspace/matricia/apps/web/modules/provider/screens/spaces/workbenches.tsx:264) ; [apps/web/modules/provider/screens/spaces/workbenches.tsx:279](/workspace/matricia/apps/web/modules/provider/screens/spaces/workbenches.tsx:279) ; [apps/web/modules/provider/screens/spaces/workbenches.tsx:324](/workspace/matricia/apps/web/modules/provider/screens/spaces/workbenches.tsx:324).

### PRE-09 · P2 · Montrer les vraies révisions de devis

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** L’historique fabrique seulement version précédente/courante, y compris deux v1 ; légende de différences sans comparaison des versions.

**À faire :** Charger toutes versions immuables, auteurs/dates/motifs et différences exactes prix/lignes/conditions.

**Recette de fermeture :** v1→v2→v3 : trois versions réelles, comparaison correcte et offre acceptée inchangée.

**Preuves :** [apps/web/modules/provider/screens/spaces/workbenches.tsx:379](/workspace/matricia/apps/web/modules/provider/screens/spaces/workbenches.tsx:379).

### PRE-10 · P2 · Aligner régions, modalités et capacité

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Les modalités sur site/distanciel viennent de capacityStatus et les zones de libraryLabel ; les régions déclarées ne sont pas réutilisées partout.

**À faire :** Employer les vrais champs versionnés pour régions, modalités et disponibilité ; cohérence home/paramètres/qualification/matching.

**Recette de fermeture :** Modifier régions et capacité : même information sur les quatre surfaces ; FULL n’est pas présenté disponible.

**Preuves :** [apps/web/modules/provider/screens/spaces/settings-board.tsx:67](/workspace/matricia/apps/web/modules/provider/screens/spaces/settings-board.tsx:67) ; [apps/web/modules/provider/screens/spaces/settings-board.tsx:88](/workspace/matricia/apps/web/modules/provider/screens/spaces/settings-board.tsx:88) ; [apps/web/modules/provider/data/home/repository.ts:134](/workspace/matricia/apps/web/modules/provider/data/home/repository.ts:134).

### PRE-11 · P2 · Compléter le planning Prestataire

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Échéance de consultation affichée comme échéance de devis ; factures absentes ; certains liens de jalon/document perdent organizationId.

**À faire :** Distinguer chaque nature d’événement, intégrer échéances financières/documentaires et préserver le scope.

**Recette de fermeture :** Échéances consultation/devis/jalon/facture/renouvellement distinctes et ouverture du bon objet en A ou B.

**Preuves :** [apps/web/modules/provider/data/planning/events.ts:87](/workspace/matricia/apps/web/modules/provider/data/planning/events.ts:87) ; [apps/web/modules/provider/data/planning/events.ts:109](/workspace/matricia/apps/web/modules/provider/data/planning/events.ts:109) ; [apps/web/app/[locale]/sous-traitant/planning/page.tsx:35](/workspace/matricia/apps/web/app/[locale]/sous-traitant/planning/page.tsx:35).

**Dépendances :** PRE-02; PRE-06.

## Franchisé — 14 éléments
### FRA-01 · P1 · Relier la fiche fournisseur à la bonne organisation

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Faits constants actif/capacité haute/zone nationale/disponible ; prochaine relance utilisée comme début de relation ; qualifications globales affichées sans lien au fournisseur choisi.

**À faire :** Pont explicite prospect CRM→organisation prestataire→qualifications/régions/capacités/documents ; états inconnus honnêtes.

**Recette de fermeture :** Deux prestataires aux caractéristiques opposées : aucune qualification, pièce ou disponibilité mélangée.

**Preuves :** [apps/web/modules/franchise/screens/spaces/boards.tsx:308](/workspace/matricia/apps/web/modules/franchise/screens/spaces/boards.tsx:308) ; [apps/web/modules/franchise/screens/spaces/boards.tsx:338](/workspace/matricia/apps/web/modules/franchise/screens/spaces/boards.tsx:338) ; [apps/web/modules/franchise/data/operations/repository.ts:58](/workspace/matricia/apps/web/modules/franchise/data/operations/repository.ts:58).

### FRA-02 · P1 · Rendre la sauvegarde des constructeurs effective

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Autosave et horodatage récent affichés sans lien à une sauvegarde ; Enregistrer brouillon est un lien ; draftSaved reste vrai.

**À faire :** Brancher vraie mutation de brouillon, suivi modifié/en cours/sauvé/erreur, horodatage et protection de sortie.

**Recette de fermeture :** Modifier/sauver/recharger conserve la valeur ; panne réseau ne produit jamais un succès et préserve la saisie.

**Preuves :** [apps/web/modules/franchise/screens/library/constructors.tsx:86](/workspace/matricia/apps/web/modules/franchise/screens/library/constructors.tsx:86) ; [apps/web/modules/franchise/screens/library/constructors.tsx:187](/workspace/matricia/apps/web/modules/franchise/screens/library/constructors.tsx:187) ; [apps/web/modules/franchise/screens/library/constructors.tsx:533](/workspace/matricia/apps/web/modules/franchise/screens/library/constructors.tsx:533).

### FRA-03 · P1 · Finir la composition des questionnaires

**Nature :** Développement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Première question sélectionnée automatiquement, recherche/plus non branchés, réordonner renvoie à la fiche et propriétés readOnly ; la création partagée existe sans édition complète de composition.

**À faire :** Sélection, ajout/retrait, ordre, sections/options, traductions, validations, versionnage, archive/restauration et publication.

**Recette de fermeture :** Créer trois questions, réordonner et traduire, soumettre/refuser/corriger/publier ; ancienne version reproductible et autre mandat refusé.

**Preuves :** [apps/web/modules/franchise/screens/library/constructors.tsx:217](/workspace/matricia/apps/web/modules/franchise/screens/library/constructors.tsx:217) ; [apps/web/modules/franchise/screens/library/constructors.tsx:240](/workspace/matricia/apps/web/modules/franchise/screens/library/constructors.tsx:240) ; [apps/web/modules/franchise/screens/library/constructors.tsx:275](/workspace/matricia/apps/web/modules/franchise/screens/library/constructors.tsx:275) ; [apps/web/modules/franchise/screens/library/constructors.tsx:306](/workspace/matricia/apps/web/modules/franchise/screens/library/constructors.tsx:306).

**Dépendances :** FRA-02.

### FRA-04 · P1 · Faire piloter l’éditeur de règles par le vrai moteur

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Conditions/choix/branches et résultats visuels fixes ou déduits de la longueur/position ; le vrai sandbox RPC séparé n’accepte qu’une réponse dans ce formulaire.

**À faire :** Éditer l’AST/actions/groupes réels ; simuler plusieurs réponses/contextes et afficher le chemin, les sorties et les erreurs du moteur.

**Recette de fermeture :** Deux scénarios d’une même règle produisent deux branches exactes ; cycles/conditions invalides rejetés ; aucune statistique de production modifiée.

**Preuves :** [apps/web/modules/franchise/screens/library/constructors.tsx:349](/workspace/matricia/apps/web/modules/franchise/screens/library/constructors.tsx:349) ; [apps/web/modules/franchise/screens/library/constructors.tsx:417](/workspace/matricia/apps/web/modules/franchise/screens/library/constructors.tsx:417) ; [apps/web/modules/franchise/screens/library/constructors.tsx:495](/workspace/matricia/apps/web/modules/franchise/screens/library/constructors.tsx:495) ; [apps/web/modules/franchise/screens/library/sandbox-form.tsx:38](/workspace/matricia/apps/web/modules/franchise/screens/library/sandbox-form.tsx:38).

**Dépendances :** FRA-03.

### FRA-05 · P1 · Appliquer le mandat choisi à toutes les données

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Bibliothèque sélectionnée par organisation, mais CRM/gouvernance/relances/finance chargés globalement ; première franchise utilisée pour certains résumés.

**À faire :** Contexte franchise/organisation/bibliothèque autorisé explicite dans tous les loaders, agrégats et actions ; pas de repli silencieux.

**Recette de fermeture :** Compte multi-mandat A+B : chaque liste, solde, KPI et mutation suit le mandat sélectionné.

**Preuves :** [apps/web/modules/franchise/data/library/workspace.ts:172](/workspace/matricia/apps/web/modules/franchise/data/library/workspace.ts:172) ; [apps/web/modules/franchise/screens/library/page-helper.ts:82](/workspace/matricia/apps/web/modules/franchise/screens/library/page-helper.ts:82) ; [apps/web/modules/franchise/data/spaces/live.ts:120](/workspace/matricia/apps/web/modules/franchise/data/spaces/live.ts:120).

### FRA-06 · P1 · Calculer les soldes sur l’historique complet

**Nature :** Correction. **Responsable proposé :** Finance + backend SQL.

**Constat :** Soldes dérivés côté TypeScript d’au plus 2 000 écritures de distribution et 500 de droit d’entrée ; exactitude arithmétique mais historique incomplet.

**À faire :** Agrégats SQL autorisés exhaustifs ; pagination indépendante des mouvements et totaux serveur.

**Recette de fermeture :** 2 501 mouvements sur plusieurs livres : égalité avec la somme SQL exhaustive ; pagination sans effet sur les soldes.

**Preuves :** [apps/web/modules/franchise/data/governance/repository.ts:43](/workspace/matricia/apps/web/modules/franchise/data/governance/repository.ts:43) ; [apps/web/modules/franchise/data/governance/repository.ts:61](/workspace/matricia/apps/web/modules/franchise/data/governance/repository.ts:61).

**Dépendances :** FRA-05.

### FRA-07 · P1 · Réparer la définition et le grain des KPI

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Missions terminées=toutes missions, capacité=taux de prospects qualifiés, volume par service non agrégé, identifiants candidat/prospect comparés, nombre d’alertes présenté comme note qualité.

**À faire :** Brancher les mesures versionnées existantes ; expliciter grain, période, filtre mandat, dénominateurs et provenance.

**Recette de fermeture :** Une mission terminée+une annulée comptent une ; fournisseur qualifié FULL non disponible ; graphique d’attribution retrouve l’organisation réelle.

**Preuves :** [apps/web/modules/franchise/screens/spaces/boards.tsx:882](/workspace/matricia/apps/web/modules/franchise/screens/spaces/boards.tsx:882) ; [apps/web/modules/franchise/screens/spaces/boards.tsx:891](/workspace/matricia/apps/web/modules/franchise/screens/spaces/boards.tsx:891) ; [apps/web/modules/franchise/screens/spaces/boards.tsx:900](/workspace/matricia/apps/web/modules/franchise/screens/spaces/boards.tsx:900) ; [apps/web/modules/franchise/screens/spaces/boards.tsx:917](/workspace/matricia/apps/web/modules/franchise/screens/spaces/boards.tsx:917).

**Dépendances :** FRA-01; FRA-05.

### FRA-08 · P1 · Signaler les lectures partielles ou indisponibles

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Erreurs/schémas invalides convertis en []/null dans workspace, opérations et page-helper ; risque de zéros trompeurs.

**À faire :** Propager indisponible/interdit/partiel/vide avec codes non sensibles et reprise ; ne pas inventer des données de remplacement.

**Recette de fermeture :** Panne CRM ou bibliothèque : section explicitement indisponible, autres sections préservées et aucun faux zéro.

**Preuves :** [apps/web/modules/franchise/data/library/workspace.ts:198](/workspace/matricia/apps/web/modules/franchise/data/library/workspace.ts:198) ; [apps/web/modules/franchise/screens/library/page-helper.ts:94](/workspace/matricia/apps/web/modules/franchise/screens/library/page-helper.ts:94) ; [apps/web/modules/franchise/data/operations/repository.ts:48](/workspace/matricia/apps/web/modules/franchise/data/operations/repository.ts:48).

### FRA-09 · P1 · Accéder à tout le catalogue par pagination ciblée

**Nature :** Amélioration. **Responsable proposé :** Équipe produit / développement.

**Constat :** Plafonds 200 questions/400 versions/800 liens/100 questionnaires sans pagination serveur ; certaines questions/versions deviennent inaccessibles.

**À faire :** Recherche/filtrage serveur par service et questionnaire, compteurs exhaustifs et chargement à la demande.

**Recette de fermeture :** 600 questions dans une bibliothèque : chacune trouvable/éditable ; versions sélectionnées chargées correctement, sans gros chargement global.

**Preuves :** [apps/web/modules/franchise/data/library/workspace.ts:178](/workspace/matricia/apps/web/modules/franchise/data/library/workspace.ts:178) ; [apps/web/modules/franchise/data/library/workspace.ts:184](/workspace/matricia/apps/web/modules/franchise/data/library/workspace.ts:184).

**Dépendances :** FRA-03.

### FRA-10 · P1 · Finir la messagerie Franchisé

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Nouveau message est un span, fils sans sélection, non-lus fabriqués et conversation détaillée explicitement non branchée ; activités CRM affichées comme messages.

**À faire :** Réutiliser la vraie messagerie : participants/fils, lecture/envoi, pièces autorisées, non-lus exacts ; séparer activité et conversation.

**Recette de fermeture :** Envoyer/répondre/changer de fil/recharger ; compteurs exacts et membre d’un autre mandat refusé.

**Preuves :** [apps/web/modules/franchise/screens/spaces/boards.tsx:1522](/workspace/matricia/apps/web/modules/franchise/screens/spaces/boards.tsx:1522) ; [apps/web/modules/franchise/screens/spaces/boards.tsx:1563](/workspace/matricia/apps/web/modules/franchise/screens/spaces/boards.tsx:1563) ; [apps/web/modules/franchise/data/spaces/live.ts:227](/workspace/matricia/apps/web/modules/franchise/data/spaces/live.ts:227).

**Dépendances :** FRA-05.

### FRA-11 · P1 · Empêcher le mélange de données réelles et de démonstration

**Nature :** Correction. **Responsable proposé :** Sécurité + frontend Franchisé.

**Constat :** Un flag seul autorise l’overlay de faux documents/messages/renouvellements dans les sections réelles vides, sans garde production.

**À faire :** Démonstration par données seedées dans un bac isolé et marqué ; interdiction d’overlay fictif en production et sous panne.

**Recette de fermeture :** Compte réel vide reste vide même si le flag est mal configuré ; configuration de production refuse le mode démonstration dangereux.

**Preuves :** [apps/web/modules/franchise/data/spaces/demo.ts:3](/workspace/matricia/apps/web/modules/franchise/data/spaces/demo.ts:3) ; [apps/web/modules/franchise/data/spaces/live.ts:609](/workspace/matricia/apps/web/modules/franchise/data/spaces/live.ts:609).

### FRA-12 · P1 · Séparer renouvellements documentaires et relances CRM

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Les renouvellements viennent de nextFollowupAt plutôt que des dates documentaires ; documents à jour affiché de façon constante.

**À faire :** Relier les expirations des documents/certifications/contrats versionnés ; conserver un calendrier CRM distinct.

**Recette de fermeture :** Changer une relance ne change pas une expiration ; document expiré jamais présenté à jour.

**Preuves :** [apps/web/modules/franchise/data/spaces/live.ts:218](/workspace/matricia/apps/web/modules/franchise/data/spaces/live.ts:218) ; [apps/web/modules/franchise/screens/spaces/boards.tsx:362](/workspace/matricia/apps/web/modules/franchise/screens/spaces/boards.tsx:362) ; [apps/web/modules/franchise/screens/spaces/boards.tsx:1448](/workspace/matricia/apps/web/modules/franchise/screens/spaces/boards.tsx:1448).

**Dépendances :** FRA-01.

### FRA-13 · P2 · Terminer la file de validation et les commentaires

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Filtres sans traitement, dates/commentaires absents et timeline fixe malgré un vrai workflow central de décision.

**À faire :** Charger demandes/décisions/auteur/date/motif, commentaires de refus et différences de versions ; vrais filtres persistants.

**Recette de fermeture :** Refus commenté→correction→resoumission→approbation, visible sur le bon élément avec historique exact.

**Preuves :** [apps/web/modules/franchise/screens/library/validations-workbench.tsx:83](/workspace/matricia/apps/web/modules/franchise/screens/library/validations-workbench.tsx:83) ; [apps/web/modules/franchise/screens/library/validations-workbench.tsx:122](/workspace/matricia/apps/web/modules/franchise/screens/library/validations-workbench.tsx:122) ; [apps/web/modules/franchise/screens/library/validations-workbench.tsx:156](/workspace/matricia/apps/web/modules/franchise/screens/library/validations-workbench.tsx:156).

**Dépendances :** FRA-03; FRA-04.

### FRA-14 · P2 · Ouvrir les documents et relevés détaillés

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Les documents renvoient à la liste courante, l’historique d’accès est non branché et le résumé financier ne propose pas d’ouverture/téléchargement du relevé.

**À faire :** Fiche et aperçu/téléchargement privé, version/empreinte/montants/preuves et historique d’accès ; relier les détails existants de GovernancePanel.

**Recette de fermeture :** Relevé déterminé ouvert/exporté avec bonne clôture/empreinte ; accès expiré ou étranger refusé et journalisé.

**Preuves :** [apps/web/modules/franchise/data/spaces/live.ts:209](/workspace/matricia/apps/web/modules/franchise/data/spaces/live.ts:209) ; [apps/web/modules/franchise/screens/spaces/boards.tsx:1334](/workspace/matricia/apps/web/modules/franchise/screens/spaces/boards.tsx:1334) ; [apps/web/modules/franchise/screens/spaces/boards.tsx:1466](/workspace/matricia/apps/web/modules/franchise/screens/spaces/boards.tsx:1466).

**Dépendances :** FRA-06.

## Administration et sécurité — 10 éléments
### ADM-01 · P1 · Exécuter réellement les actions admin approuvées

**Nature :** Développement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Plusieurs écrans génériques créent une demande ; l’approbation émet AdminActionAuthorizedV1, mais aucun exécuteur applicatif n’a été retrouvé pour appliquer les changements organisation/rôles.

**À faire :** Exécuteurs allowlistés, typés, versionnés et idempotents ; états d’exécution et erreurs ; support borné réellement appliqué aux politiques concernées.

**Recette de fermeture :** Demande→approbateur distinct→modification effective→audit/outbox ; replay sans doublon et refus auto-approbation/stale/hors scope.

**Preuves :** [apps/web/modules/admin/screens/spaces/org-actions.ts:12](/workspace/matricia/apps/web/modules/admin/screens/spaces/org-actions.ts:12) ; [apps/web/modules/admin/screens/spaces/actor-actions.ts:14](/workspace/matricia/apps/web/modules/admin/screens/spaces/actor-actions.ts:14) ; [supabase/migrations/20260912007100_admin_command_center.sql:88](/workspace/matricia/supabase/migrations/20260912007100_admin_command_center.sql:88) ; [supabase/migrations/20260912007100_admin_command_center.sql:93](/workspace/matricia/supabase/migrations/20260912007100_admin_command_center.sql:93).

**Dépendances :** OPS-01.

### ADM-02 · P1 · Conserver tous les paramètres des actions admin

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Destinataires, échéance/canal de consultation et destination/contexte de réutilisation documentaire sont collectés mais absents du résumé générique persisté.

**À faire :** Contrats spécifiques par action, données complètes validées et hash canonique serveur ; relire les ressources autorisées avant exécution.

**Recette de fermeture :** Chaque champ nécessaire est retrouvé dans la demande approuvée et l’effet final ; IDs et valeurs falsifiés rejetés.

**Preuves :** [apps/web/modules/admin/screens/spaces/space-actions.ts:17](/workspace/matricia/apps/web/modules/admin/screens/spaces/space-actions.ts:17) ; [apps/web/modules/admin/screens/spaces/special-boards.tsx:156](/workspace/matricia/apps/web/modules/admin/screens/spaces/special-boards.tsx:156) ; [apps/web/modules/admin/screens/spaces/special-boards.tsx:271](/workspace/matricia/apps/web/modules/admin/screens/spaces/special-boards.tsx:271).

**Dépendances :** ADM-01.

### ADM-03 · P1 · Afficher l’état réel MFA et sessions du compte examiné

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** MFA Activée/isolation Conforme constants sans champ MFA chargé ; lien Sessions de la fiche vise les sessions de l’administrateur courant.

**À faire :** Projection autorisée MFA/session/révocation ; état inconnu si non observable ; séparer mes sessions et supervision du membre.

**Recette de fermeture :** Comptes sans MFA, enrôlé et non vérifiable affichés distinctement ; contrôle du bon membre et absence d’attestation artificielle.

**Preuves :** [apps/web/modules/admin/screens/spaces/actor-boards.tsx:127](/workspace/matricia/apps/web/modules/admin/screens/spaces/actor-boards.tsx:127) ; [apps/web/modules/admin/screens/spaces/actor-boards.tsx:240](/workspace/matricia/apps/web/modules/admin/screens/spaces/actor-boards.tsx:240) ; [apps/web/modules/admin/screens/spaces/actor-boards.tsx:297](/workspace/matricia/apps/web/modules/admin/screens/spaces/actor-boards.tsx:297) ; [apps/web/modules/admin/data/spaces/actors-repository.ts:9](/workspace/matricia/apps/web/modules/admin/data/spaces/actors-repository.ts:9).

### SEC-01 · P1 · Neutraliser les formules dans les exports CSV

**Nature :** Correction. **Responsable proposé :** Sécurité + exports.

**Constat :** Échappement CSV syntaxique sans neutralisation des préfixes de formule ; un nom =1+1 peut être interprété par un tableur. Aucune exfiltration ni commande n’a été reproduite.

**À faire :** Encodeur partagé protégeant =,+,-,@, tabulations/retours de contrôle, guillemets et CR/LF ; application à tous les exports.

**Recette de fermeture :** Jeu malveillant ouvert dans Excel/LibreOffice comme texte, données Unicode et colonnes conservées.

**Preuves :** [apps/web/app/[locale]/administration/entreprises/export/route.ts:7](/workspace/matricia/apps/web/app/[locale]/administration/entreprises/export/route.ts:7) ; [apps/web/app/[locale]/administration/export/[space]/route.ts:15](/workspace/matricia/apps/web/app/[locale]/administration/export/[space]/route.ts:15) ; [apps/web/app/[locale]/administration/utilisateurs/export/route.ts:15](/workspace/matricia/apps/web/app/[locale]/administration/utilisateurs/export/route.ts:15).

### ADM-04 · P1 · Rendre tous les utilisateurs administrables

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** L’annuaire agrège les membres des 16 premières organisations ; la fiche d’un utilisateur est recherchée dans ce sous-ensemble.

**À faire :** Projection utilisateurs paginée côté serveur, recherche directe par ID, totaux et export complet contrôlé.

**Recette de fermeture :** Au moins 20 organisations : membres de la dernière trouvables, fiche ouvrable et export complet.

**Preuves :** [apps/web/modules/admin/data/spaces/actors-repository.ts:27](/workspace/matricia/apps/web/modules/admin/data/spaces/actors-repository.ts:27) ; [apps/web/modules/admin/data/spaces/actors-repository.ts:63](/workspace/matricia/apps/web/modules/admin/data/spaces/actors-repository.ts:63).

### ADM-05 · P1 · Projeter les rôles réels, pas le nom de l’organisation

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Le type est déduit par regex du nom et utilisé pour filtrer Clients, incompatible avec une organisation multi-rôles.

**À faire :** Lire les rôles/capacités/statuts métier et autoriser plusieurs rôles simultanés.

**Recette de fermeture :** Organisation Client+Prestataire visible dans les deux vues ; changer son nom ne change jamais ses droits ni sa classification.

**Preuves :** [apps/web/modules/admin/data/spaces/directory.ts:104](/workspace/matricia/apps/web/modules/admin/data/spaces/directory.ts:104) ; [apps/web/modules/admin/data/spaces/actors-repository.ts:88](/workspace/matricia/apps/web/modules/admin/data/spaces/actors-repository.ts:88).

### ADM-06 · P1 · Livrer le workflow opérationnel de protection des données

**Nature :** Raccordement. **Responsable proposé :** Privacy + sécurité + juridique + exploitation.

**Constat :** RPC DSR/rétention et modèle de preuve présents ; UI surtout compteurs/preuves, aucune chaîne applicative complète trouvée ; gate privacy non branché.

**À faire :** Demandes accès/export/rectification/suppression, vérification identité, décision, exécution et preuves ; SLA, gel légal, rétention et gate de mise en service.

**Recette de fermeture :** Demande réelle de test→export protégé ou disposition effective→preuve ; refus étranger, retrait et conservation légale vérifiés.

**Preuves :** [supabase/migrations/20260913016500_v41_privacy_governance.sql:318](/workspace/matricia/supabase/migrations/20260913016500_v41_privacy_governance.sql:318) ; [supabase/migrations/20260913016500_v41_privacy_governance.sql:330](/workspace/matricia/supabase/migrations/20260913016500_v41_privacy_governance.sql:330) ; [apps/web/modules/admin/screens/v4-1/module/overview-panel.tsx:6](/workspace/matricia/apps/web/modules/admin/screens/v4-1/module/overview-panel.tsx:6).

**Dépendances :** PUB-02.

### ADM-07 · P2 · Filtrer les files avec des codes stables FR/AR

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Les onglets écrivent le libellé traduit dans vue puis comparent aux statuts bruts ; Qualifié ne correspond pas à APPROVED.

**À faire :** Mapping explicite code métier↔libellé et conservation du code pendant le changement de langue.

**Recette de fermeture :** Même jeu de données : mêmes résultats/totaux en FR/AR pour chaque onglet, états composés compris.

**Preuves :** [apps/web/modules/admin/screens/spaces/queue-kit.tsx:74](/workspace/matricia/apps/web/modules/admin/screens/spaces/queue-kit.tsx:74) ; [apps/web/modules/admin/screens/spaces/queue-kit.tsx:80](/workspace/matricia/apps/web/modules/admin/screens/spaces/queue-kit.tsx:80) ; [apps/web/modules/admin/data/spaces/space-data.ts:344](/workspace/matricia/apps/web/modules/admin/data/spaces/space-data.ts:344).

### ADM-08 · P2 · Montrer la vraie chronologie et les vrais échanges

**Nature :** Raccordement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Historique des décisions=spec.pipeline statique ; conversation=row.cells, non messages du dossier.

**À faire :** Charger événements auditables, messages autorisés, acteur/date/motif/pièces et pagination ; vide honnête.

**Recette de fermeture :** Nouvelle décision et message apparaissent sur le bon dossier dans l’ordre correct ; aucune donnée hors scope.

**Preuves :** [apps/web/modules/admin/screens/spaces/queue-kit.tsx:336](/workspace/matricia/apps/web/modules/admin/screens/spaces/queue-kit.tsx:336) ; [apps/web/modules/admin/screens/spaces/queue-kit.tsx:486](/workspace/matricia/apps/web/modules/admin/screens/spaces/queue-kit.tsx:486).

### ADM-09 · P2 · Rendre exports et listes exhaustifs et cohérents

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Snapshot limité à 120 ; export recharge sans paramètres de sélection, recherche ni pagination de ce chemin.

**À faire :** Recherche/pagination serveur, export du périmètre annoncé, filtres conservés et export complet asynchrone si nécessaire.

**Recette de fermeture :** Plus de 120 dossiers : totaux, sélection et export concordants ; erreurs de permission/panne explicites, pas CSV vide réussi.

**Preuves :** [apps/web/modules/admin/data/spaces/space-data.ts:36](/workspace/matricia/apps/web/modules/admin/data/spaces/space-data.ts:36) ; [apps/web/app/[locale]/administration/export/[space]/route.ts:7](/workspace/matricia/apps/web/app/[locale]/administration/export/[space]/route.ts:7).

**Dépendances :** SEC-01.

## Marketing et intégrations — 10 éléments
### MKT-01 · P1 · Raccorder la génération marketing au cron

**Nature :** Correction. **Responsable proposé :** Marketing + backend + DevOps.

**Constat :** Vercel Cron appelle GET /api/workers/marketing-content ; GET répond systématiquement 405, confirmé par requête locale pendant cet audit.

**À faire :** Aligner méthode/planificateur et ajouter un test de contrat entre crons configurés et handlers exposés.

**Recette de fermeture :** Invocation identique au cron réclame une campagne, génère les trois contenus et persiste le résultat ; appel non autorisé toujours refusé.

**Preuves :** [apps/web/vercel.json:13](/workspace/matricia/apps/web/vercel.json:13) ; [apps/web/app/api/workers/marketing-content/route.ts:29](/workspace/matricia/apps/web/app/api/workers/marketing-content/route.ts:29).

### MKT-02 · P1 · Respecter le budget temporel des publications

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Worker 60 s, lot séquentiel jusqu’à 10 ; appels fournisseur jusqu’à 20 s et deux appels pour Instagram/Reels.

**À faire :** Budget temporel avant claim, lot adaptatif ou worker persistant ; reprise des leases sans duplication.

**Recette de fermeture :** Dix réponses lentes : pas d’arrêt brutal ni de jobs injustement laissés en lease ; bornes et reprise prouvées.

**Preuves :** [apps/web/app/api/workers/marketing-publications/route.ts:7](/workspace/matricia/apps/web/app/api/workers/marketing-publications/route.ts:7) ; [apps/web/app/api/workers/marketing-publications/route.ts:43](/workspace/matricia/apps/web/app/api/workers/marketing-publications/route.ts:43) ; [apps/web/modules/shared/lib/marketing-autopilot/publisher.ts:10](/workspace/matricia/apps/web/modules/shared/lib/marketing-autopilot/publisher.ts:10).

### MKT-03 · P1 · Réconcilier les succès sociaux ambigus

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Un HTTP de création réussi sans identifiant est classé retryable ; nouvel envoi possible sans idempotence fournisseur.

**À faire :** État succès ambigu/réconciliation, conservation identifiants intermédiaires et résolution opérateur avant tout nouvel envoi.

**Recette de fermeture :** 201 sans ID et coupure après publication : jamais un deuxième post automatique ; résolution traçable.

**Preuves :** [apps/web/modules/shared/lib/marketing-autopilot/publisher.ts:26](/workspace/matricia/apps/web/modules/shared/lib/marketing-autopilot/publisher.ts:26) ; [apps/web/modules/shared/lib/marketing-autopilot/publisher.ts:38](/workspace/matricia/apps/web/modules/shared/lib/marketing-autopilot/publisher.ts:38).

**Dépendances :** OPS-03.

### MKT-04 · P1 · Raccorder le fournisseur IA de production retenu

**Nature :** Développement. **Responsable proposé :** IA + sécurité + intégrations.

**Constat :** Le provider générique n’accepte que des IP publiques littérales ; domaines DNS autorisés rejetés ; un seul provider de production configurable.

**À faire :** Prérequis de démarrage : fournisseur choisi et accès sandbox autorisé, à obtenir au lot 0. Puis implémenter l’adaptateur ou une passerelle compatible, les domaines HTTPS avec protections SSRF/DNS adaptées, et plusieurs fournisseurs seulement si failover promis. La validation finale des comptes relève d’EXT-02 après ce raccordement.

**Recette de fermeture :** Appel sandbox sur domaine réel, sorties FR/AR valides, quotas/timeout et panne testés ; aucun fallback démo silencieux en production.

**Preuves :** [apps/web/modules/shared/lib/marketing-autopilot/provider-orchestrator.ts:17](/workspace/matricia/apps/web/modules/shared/lib/marketing-autopilot/provider-orchestrator.ts:17).

### PAY-01 · P1 · Autoriser l’organisation avant l’effet de paiement externe

**Nature :** Correction. **Responsable proposé :** Paiements + sécurité.

**Constat :** createIntent fournisseur est exécuté après authentification mais avant la RPC qui autorise l’organisation.

**À faire :** Autoriser/réserver une intention durable côté serveur avant PayPal/CMI ; gérer panne et réconciliation après préparation.

**Recette de fermeture :** Utilisateur hors organisation refusé sans appel fournisseur ; aucune commande externe orpheline après panne DB.

**Preuves :** [apps/web/app/api/payments/intents/route.ts:26](/workspace/matricia/apps/web/app/api/payments/intents/route.ts:26).

### PAY-02 · P1 · Fermer le paiement DEMO en production

**Nature :** Correction. **Responsable proposé :** Paiements + sécurité + DevOps.

**Constat :** Configuration DEMO et webhook DEMO instanciables sans garde production analogue à celle de l’email. Configuration dangereuse, fraude non reproduite.

**À faire :** Garde production explicite lors du chargement de configuration, de la création et du webhook ; sandbox distinct.

**Recette de fermeture :** Production refuse DEMO même si le flag/secret a été configuré par erreur ; tests négatifs de configuration et de webhook.

**Preuves :** [packages/infrastructure/src/payments/gateway-factory.ts:29](/workspace/matricia/packages/infrastructure/src/payments/gateway-factory.ts:29) ; [apps/web/app/api/webhooks/payments/demo/route.ts:6](/workspace/matricia/apps/web/app/api/webhooks/payments/demo/route.ts:6).

### PAY-03 · P1 · Terminer le cycle après-paiement

**Nature :** Développement. **Responsable proposé :** Paiements + finance + exploitation.

**Constat :** Contrat fournisseur centré sur PAYMENT_SUCCEEDED ; remboursement/chargeback applicatifs non retrouvés malgré tables correspondantes.

**À faire :** Remboursements partiels/complets, contestations, annulations, réconciliation et écritures correctrices ; commandes opérateur autorisées.

**Recette de fermeture :** Paiement→remboursements successifs, événements dupliqués/désordonnés ; abonnement/crédits/ledger cohérents, aucune modification de l’original.

**Preuves :** [packages/infrastructure/src/payments/contracts.ts:27](/workspace/matricia/packages/infrastructure/src/payments/contracts.ts:27) ; [packages/infrastructure/src/payments/contracts.ts:40](/workspace/matricia/packages/infrastructure/src/payments/contracts.ts:40).

**Dépendances :** PAY-01; EXT-01.

### SIG-01 · P1 · Brancher la signature conforme au niveau contractuel requis

**Nature :** Développement et décision. **Responsable proposé :** Contrats + intégrations + juridique.

**Constat :** Contrat de provider et mock de développement présents ; aucun adaptateur fournisseur concret enregistré retrouvé. Consentement interne existant ne prouve pas une certification externe.

**À faire :** Faire décider le niveau par type de document, choisir fournisseur puis implémenter envoi/signataires/webhooks/expiration/annulation et dossier probatoire.

**Recette de fermeture :** Signature sandbox bout en bout avec refus/expiration/replay ; contrôle du hash exact et récupération des preuves ; validation juridique du niveau.

**Preuves :** [packages/signature-v41/src/provider.ts:56](/workspace/matricia/packages/signature-v41/src/provider.ts:56) ; [packages/signature-v41/src/mock-provider.ts:15](/workspace/matricia/packages/signature-v41/src/mock-provider.ts:15) ; [docs/DECISIONS_REQUIRED.md:5](/workspace/matricia/docs/DECISIONS_REQUIRED.md:5).

**Dépendances :** EXT-03.

### EML-01 · P2 · Conserver les liens d’action dans les emails Resend

**Nature :** Correction. **Responsable proposé :** Équipe produit / développement.

**Constat :** Le worker fournit ctaPath ; le provider générique le conserve, mais Resend n’envoie que job.body.

**À faire :** URL absolue autorisée et rendu email FR/AR avec CTA contextualisé vers le bon objet.

**Recette de fermeture :** Message reçu comportant lien sûr et retour au dossier après authentification ; URL externe injectée rejetée.

**Preuves :** [apps/web/modules/shared/lib/notification-delivery/adapter.ts:79](/workspace/matricia/apps/web/modules/shared/lib/notification-delivery/adapter.ts:79) ; [apps/web/modules/shared/lib/notification-delivery/adapter.ts:107](/workspace/matricia/apps/web/modules/shared/lib/notification-delivery/adapter.ts:107).

**Dépendances :** PUB-04.

### EML-02 · P1 · Distinguer acceptation fournisseur et remise email

**Nature :** Raccordement et activation. **Responsable proposé :** Notifications + DevOps.

**Constat :** L’acceptation fournisseur est nommée DELIVERED ; aucun webhook de remise/bounce retrouvé. La remise SMTP hébergée n’a pas été inspectée.

**À faire :** États accepté/remis/rebond/échec, webhooks ou mécanisme équivalent, suppression des destinataires invalides et configuration des domaines/SMTP Auth.

**Recette de fermeture :** Message de test réellement reçu ; bounce contrôlé et retry idempotent ; aucun succès de remise déclaré sur seule réponse 202.

**Preuves :** [apps/web/modules/shared/lib/notification-delivery/adapter.ts:142](/workspace/matricia/apps/web/modules/shared/lib/notification-delivery/adapter.ts:142).

**Dépendances :** EXT-02.

## Exploitation — 5 éléments
### OPS-01 · P1 · Distinguer événements observés et effets métier exécutés

**Nature :** Raccordement. **Responsable proposé :** Backend domaines + worker.

**Constat :** Le consommateur terminal accuse plusieurs événements comme TERMINAL_OBSERVABILITY, puis le poller les marque publiés ; cela ne réalise pas une signature, une action admin ou un autre effet externe.

**À faire :** Inventaire événement→effet→consommateur ; brancher ceux exigeant un effet externe, préserver les événements simplement informatifs et les effets déjà synchrones en SQL.

**Recette de fermeture :** Chaque effet externe nécessaire possède un accusé autoritatif et un E2E ; un log seul ne ferme jamais son exécution.

**Preuves :** [apps/web/app/api/internal/outbox/route.ts:147](/workspace/matricia/apps/web/app/api/internal/outbox/route.ts:147) ; [apps/worker/src/poller.ts:12](/workspace/matricia/apps/worker/src/poller.ts:12).

### OPS-02 · P1 · Découpler l’Outbox non documentaire de ClamAV

**Nature :** Correction. **Responsable proposé :** Worker + sécurité documents.

**Constat :** worker-cycle retourne avant pollOutbox si antivirus indisponible ; invitations et effets indépendants sont aussi arrêtés.

**À faire :** Cycles/files indépendants ; documents bloqués tant que non CLEAN, effets non documentaires maintenus.

**Recette de fermeture :** ClamAV arrêté : aucun document accepté, invitations continuent ; reprise du scan idempotente et observable.

**Preuves :** [apps/worker/src/worker-cycle.ts:25](/workspace/matricia/apps/worker/src/worker-cycle.ts:25).

### OPS-03 · P1 · Faire de la supervision un vrai outil d’exploitation

**Nature :** Développement. **Responsable proposé :** Équipe produit / développement.

**Constat :** Dashboard explicitement sans retry/replay, tableau antivirus ni moteur de restauration ; plusieurs liens donnent une promesse plus large que la projection actuelle.

**À faire :** Inspection expurgée, reprise idempotente, réconciliation succès ambigu, historique et approbations sensibles, ou runbooks opérateur réellement testés pour chaque geste promis.

**Recette de fermeture :** Incident de job, DLQ, scan bloqué et succès fournisseur ambigu traités sans SQL improvisé ni duplication.

**Preuves :** [apps/web/modules/admin/screens/operations/operations-dashboard.tsx:23](/workspace/matricia/apps/web/modules/admin/screens/operations/operations-dashboard.tsx:23) ; [apps/web/modules/admin/screens/operations/operations-dashboard.tsx:39](/workspace/matricia/apps/web/modules/admin/screens/operations/operations-dashboard.tsx:39).

**Dépendances :** OPS-01; OPS-04.

### OPS-04 · P1 · Superviser worker, crons et files au-delà de la DB

**Nature :** Développement. **Responsable proposé :** DevOps + observabilité.

**Constat :** Readiness observe DB et âge du backlog <24 h mais exclut DLQ ; pas de heartbeat des workers/crons/scanners. HTTP ready n’atteste pas tous les automatismes.

**À faire :** Fraîcheur par job, ancienneté/taille/DLQ par domaine, état des dépendances nécessaires, SLO et alertes testées.

**Recette de fermeture :** Worker/cron arrêté et DLQ synthétique : détection et alerte dans le délai convenu ; diagnostic distingue dégradation et panne critique.

**Preuves :** [supabase/migrations/20260911001800_least_privilege_acl_and_readiness.sql:16](/workspace/matricia/supabase/migrations/20260911001800_least_privilege_acl_and_readiness.sql:16) ; [apps/web/app/api/readiness/route.ts:10](/workspace/matricia/apps/web/app/api/readiness/route.ts:10).

### OPS-05 · P1 · Connecter métriques, traces et alertes de service

**Nature :** Activation et mesure. **Responsable proposé :** DevOps + support.

**Constat :** Logger structuré et readiness présents ; export de métriques/traces non retrouvé dans le dépôt. Existence éventuelle chez l’hébergeur non inspectée.

**À faire :** Configurer collecte erreurs/latences/jobs/webhooks/paiements, corrélation, rétention, accès, tableaux SLO et escalade.

**Recette de fermeture :** Incident synthétique observable de bout en bout, alerte reçue et acquittée ; absence de PII/secrets dans traces.

**Preuves :** [packages/observability/src/index.ts:1](/workspace/matricia/packages/observability/src/index.ts:1) ; [Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:2074](/workspace/matricia/Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:2074).

**Dépendances :** OPS-04.

## Activation et conformité — 5 éléments
### EXT-01 · P1 · Valider PayPal et CMI sur les comptes sandbox autorisés

**Nature :** Activation et recette. **Responsable proposé :** Intégrations + finance + client.

**Constat :** Vrais adaptateurs et signatures présents ; leur présence ne prouve ni configuration ni parcours de paiement distant du candidat.

**À faire :** Comptes autorisés, domaines/webhooks, devises, captures, événements rejoués et rapprochement ; séparer paiements Matricia et factures de prestation directe.

**Recette de fermeture :** Création/capture/échec/replay/duplication documentés sur le SHA candidat ; montants exacts côté serveur.

**Preuves :** [docs/INTEGRATION_MATRIX.md:1](/workspace/matricia/docs/INTEGRATION_MATRIX.md:1) ; [packages/infrastructure/src/payments/contracts.ts:27](/workspace/matricia/packages/infrastructure/src/payments/contracts.ts:27).

**Dépendances :** PAY-01; PAY-02.

### EXT-02 · P1 · Valider les fournisseurs email, IA et réseaux sociaux

**Nature :** Activation et recette. **Responsable proposé :** Marketing + intégrations + client.

**Constat :** Adaptateurs email et social réels présents ; accès, scopes, domaines, quotas, consentements et livraisons distantes non certifiés par cet audit local.

**À faire :** Raccorder les comptes approuvés via paramètres sécurisés, réaliser sandbox, expiration/révocation OAuth, panne/reprise et preuves d’attribution.

**Recette de fermeture :** Email reçu, génération FR/AR et publication identifiée ; chaîne CTA→lead→devis→contrat réelle ; retrait des accès respecté.

**Preuves :** [docs/INTEGRATION_MATRIX.md:1](/workspace/matricia/docs/INTEGRATION_MATRIX.md:1) ; [docs/specs/sections/marketing-autopilot.md:1](/workspace/matricia/docs/specs/sections/marketing-autopilot.md:1).

**Dépendances :** MKT-01; MKT-02; MKT-03; MKT-04.

### EXT-03 · P1 · Faire approuver règles fiscales, documents et tarifs

**Nature :** Validation externe. **Responsable proposé :** Client + expert-comptable + juridique.

**Constat :** Le moteur versionné et les gardes fiscales existent ; une fixture VALIDATED de test ne constitue pas une approbation comptable. Signature et prix publiables requièrent décision habilitée.

**À faire :** Experts comptable/juridique valident catégories, périodes, mentions/séries, avoirs, clauses, plans et prix publiables ; versions et preuves activées par le workflow approprié.

**Recette de fermeture :** Factures/avoirs/contrats produits relus et signés par responsables ; aucune règle DEMO active sur les flux financiers réels.

**Preuves :** [docs/DECISIONS_REQUIRED.md:5](/workspace/matricia/docs/DECISIONS_REQUIRED.md:5) ; [docs/DECISIONS_REQUIRED.md:13](/workspace/matricia/docs/DECISIONS_REQUIRED.md:13) ; [supabase/migrations/20260922150000_audit_fiscal_invitation_outbox_hardening.sql:10](/workspace/matricia/supabase/migrations/20260922150000_audit_fiscal_invitation_outbox_hardening.sql:10).

### EXT-04 · P1 · Prouver l’exploitation Vercel, Railway et antivirus

**Nature :** Activation et recette. **Responsable proposé :** DevOps + sécurité.

**Constat :** Manifestes et worker présents ; tests locaux ne prouvent ni déploiement du bon SHA, réseau privé, cron ou scan distant.

**À faire :** Vérifier environnements isolés, secrets/permissions sans divulgation, migrations, URLs, schedules, budgets, EICAR et reprise après panne.

**Recette de fermeture :** Bon artefact en staging, web/worker/scanner disponibles ; fichier infecté bloqué ; file reprise et rollback de déploiement exercé.

**Preuves :** [apps/web/vercel.json:1](/workspace/matricia/apps/web/vercel.json:1) ; [railway.json:1](/workspace/matricia/railway.json:1) ; [apps/worker/src/worker-config.ts:37](/workspace/matricia/apps/worker/src/worker-config.ts:37).

**Dépendances :** PRE-01; PRE-03; MKT-01; OPS-02; OPS-04.

### EXT-05 · P1 · Restaurer réellement base, fichiers et files

**Nature :** Recette d’exploitation. **Responsable proposé :** DevOps + sécurité + support.

**Constat :** Runbook et modèle de preuve existent mais précisent REQUIRED_NOT_COMPLETED tant qu’une restauration n’est pas exécutée.

**À faire :** Sauvegarde DB/Storage/config, restauration sur cible isolée, contrôles hashes/RLS/finance et reprise des files ; mesurer RPO/RTO et approuver les responsabilités de support.

**Recette de fermeture :** Exercice indépendant daté, fichiers privés récupérés, règles/ledgers intègres, files sans doublon et retour au service prouvé.

**Preuves :** [docs/runbooks/V4_1_CONTINUITY_AND_RESTORE.md:3](/workspace/matricia/docs/runbooks/V4_1_CONTINUITY_AND_RESTORE.md:3).

**Dépendances :** OPS-03; OPS-05.

## Qualité transversale — 8 éléments
### QA-01 · P1 · Valider chaque chaîne métier avec de vraies mutations

**Nature :** Recette. **Responsable proposé :** QA + propriétaires de domaine.

**Constat :** Les succès unitaires/SQL et les smokes de pages ne prouvent pas les chaînes complètes. Certaines specs dites E2E lisent du code ou injectent des mocks.

**À faire :** Conserver ces protections à leur niveau et ajouter navigateur→action réelle→RPC→DB→effet : Client, Prestataire, Franchisé, Admin, financier et marketing.

**Recette de fermeture :** Parcours de bout en bout sur candidat : données persistées, audit/outbox et effet attendu, refus mauvais rôle/tenant, retry/double clic, panne et reprise.

**Preuves :** [tests/e2e/p28-financial-value-center.spec.ts:2](/workspace/matricia/tests/e2e/p28-financial-value-center.spec.ts:2) ; [tests/e2e/p27-automation-runtime.spec.ts:9](/workspace/matricia/tests/e2e/p27-automation-runtime.spec.ts:9) ; [tests/e2e/v4-1-critical-flows.spec.ts:45](/workspace/matricia/tests/e2e/v4-1-critical-flows.spec.ts:45).

### QA-02 · P1 · Unifier la recette authentifiée et interdire les faux succès

**Nature :** Recette et outillage. **Responsable proposé :** QA + plateforme.

**Constat :** Des specs ignorent les tests sans storageState et certaines attentes H1 sont obsolètes ; runners stricts existent mais le lancement officiel n’est pas unifié.

**À faire :** Fixtures de développement sûres et reproductibles, runner unique sans skip silencieux et attentes synchronisées au produit.

**Recette de fermeture :** Fixtures absentes font échouer la recette de livraison ; tous rôles, deux organisations/mandats et tests ALLOW/DENY exécutés et comptés.

**Preuves :** [tests/e2e/p21-questionnaires-diagnostics.spec.ts:6](/workspace/matricia/tests/e2e/p21-questionnaires-diagnostics.spec.ts:6) ; [tests/e2e/p21-questionnaires-diagnostics.spec.ts:31](/workspace/matricia/tests/e2e/p21-questionnaires-diagnostics.spec.ts:31) ; [tests/e2e/p29-marketing-workspaces.spec.ts:37](/workspace/matricia/tests/e2e/p29-marketing-workspaces.spec.ts:37) ; [tests/e2e/helpers/p24-p26-completion-run.mjs:303](/workspace/matricia/tests/e2e/helpers/p24-p26-completion-run.mjs:303).

**Dépendances :** QA-01.

### QA-03 · P1 · Réaliser un pentest et la matrice d’autorisation du candidat

**Nature :** Recette sécurité. **Responsable proposé :** Auditeur sécurité indépendant + équipes.

**Constat :** 461 tables locales ont RLS, mais cela ne prouve pas chaque permission positive/négative ni la résistance complète aux attaques. Aucun exploit P0 reproduit dans la présente revue.

**À faire :** Compléter ALLOW/DENY par action/acteur/objet, IDOR/tenant, sessions/MFA, uploads/URLs, exports, webhooks/replay, abus et secrets ; revue indépendante.

**Recette de fermeture :** Rapport indépendant sur le staging candidat, constats corrigés/retestés et risques résiduels acceptés explicitement.

**Preuves :** [docs/RPC_SECURITY_TEST_MATRIX.md:1](/workspace/matricia/docs/RPC_SECURITY_TEST_MATRIX.md:1) ; [docs/security/THREAT_MODEL.md:1](/workspace/matricia/docs/security/THREAT_MODEL.md:1) ; [AGENTS.md:23](/workspace/matricia/AGENTS.md:23).

**Dépendances :** SEC-01; PAY-01; PAY-02; PRE-03.

### UX-01 · P2 · Harmoniser le standard d’interaction des quatre espaces

**Nature :** Amélioration. **Responsable proposé :** Design system + frontend + produit.

**Constat :** Le public et certains formulaires réels sont plus cohérents que les fiches/constructeurs utilisant contrôles décoratifs, badges fixes ou renvois de page.

**À faire :** Standard partagé de navigation, tableaux, filtres, formulaires, chargement, vide, interdit, erreur, succès et actions autorisées ; appliquer les vrais états à toutes les surfaces.

**Recette de fermeture :** Aucun bouton sans effet, lien circulaire présenté comme action, autosave fictif ou badge factuel constant dans le périmètre livré ; revue UX avec données réalistes.

**Preuves :** [apps/web/modules/franchise/screens/library/constructors.tsx:86](/workspace/matricia/apps/web/modules/franchise/screens/library/constructors.tsx:86) ; [apps/web/modules/admin/screens/spaces/queue-kit.tsx:486](/workspace/matricia/apps/web/modules/admin/screens/spaces/queue-kit.tsx:486) ; [docs/design/README.md:1](/workspace/matricia/docs/design/README.md:1).

**Dépendances :** CLI-05; CLI-06; FRA-02; ADM-08.

### UX-02 · P2 · Terminer la langue métier FR/AR et les formats

**Nature :** Amélioration. **Responsable proposé :** Contenu FR/AR + frontend.

**Constat :** Plusieurs écrans connectés montrent codes techniques, identifiants ou états anglais ; certains formats/dimensions ne sont pas réellement localisés.

**À faire :** Dictionnaires communs statuts/erreurs/dimensions, dates au fuseau métier, monnaies exactes, aide pourquoi/exemple et termes compréhensibles ; documents et emails inclus.

**Recette de fermeture :** Recette native FR/AR de tous états, messages longs et fuseaux ; aucun code anglais incompréhensible utilisé comme libellé utilisateur.

**Preuves :** [apps/web/modules/provider/screens/spaces/workbenches.tsx:443](/workspace/matricia/apps/web/modules/provider/screens/spaces/workbenches.tsx:443) ; [apps/web/modules/provider/screens/spaces/settings-board.tsx:92](/workspace/matricia/apps/web/modules/provider/screens/spaces/settings-board.tsx:92) ; [apps/web/modules/client/screens/diagnostics/journey.ts:34](/workspace/matricia/apps/web/modules/client/screens/diagnostics/journey.ts:34) ; [apps/web/modules/client/screens/abonnement/subscription-panel.tsx:32](/workspace/matricia/apps/web/modules/client/screens/abonnement/subscription-panel.tsx:32).

**Dépendances :** PRE-06.

### UX-03 · P1 · Certifier les parcours connectés en mobile et accessibilité

**Nature :** Recette accessibilité. **Responsable proposé :** QA accessibilité + UX + utilisateurs pilotes.

**Constat :** Les 18 E2E frais couvrent public/cookies ; ils ne certifient pas les mutations des quatre espaces. Des contrôles focusables sous aria-hidden existent.

**À faire :** Matrice 360/390/tablette/bureau, RTL, clavier/focus, erreurs, zoom 200 % et lecteur d’écran ; audits axe par écran critique, pas seulement dernière page du smoke.

**Recette de fermeture :** Toutes les mutations critiques réalisables sans souris, sans débordement global ni perte de contexte, FR/AR et erreurs comprises.

**Preuves :** [apps/web/app/[locale]/client/diagnostics/solutions/page.tsx:100](/workspace/matricia/apps/web/app/[locale]/client/diagnostics/solutions/page.tsx:100) ; [tests/e2e/authenticated-route-smoke.spec.ts:171](/workspace/matricia/tests/e2e/authenticated-route-smoke.spec.ts:171) ; [Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:2023](/workspace/matricia/Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:2023).

**Dépendances :** UX-01; UX-02; QA-02.

### PERF-01 · P1 · Mesurer charge, requêtes et Web Vitals au volume cible

**Nature :** Recette performance. **Responsable proposé :** Performance + backend + QA.

**Constat :** Outil catalogue 6 000/50 000 questions présent ; aucune mesure actuelle de charge liée au candidat ni instrumentation navigateur trouvée. Plusieurs listes sont tronquées.

**À faire :** Mesures réelles staging, pagination/indexation/N+1/cache et budgets par route/API ; corriger seulement les goulots mesurés.

**Recette de fermeture :** LCP≤2,5 s, INP≤200 ms, CLS≤0,1 ; p95 API courantes visé<500 ms hors fournisseurs, selon Gold Master ; 6k/50k questions utilisables.

**Preuves :** [scripts/performance/catalog-load-gate.mjs:1](/workspace/matricia/scripts/performance/catalog-load-gate.mjs:1) ; [docs/evidence/p06/CATALOG_LOAD_GATE.md:3](/workspace/matricia/docs/evidence/p06/CATALOG_LOAD_GATE.md:3) ; [Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:2070](/workspace/matricia/Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:2070).

**Dépendances :** CLI-12; PRE-07; FRA-09; ADM-04.

### ARC-01 · P2 · Centraliser les contrats et services réellement partagés

**Nature :** Amélioration. **Responsable proposé :** Architecture + responsables de domaine.

**Constat :** Packages application/contracts/forms/workflows très minces tandis que la logique est surtout répartie entre modules web et SQL ; doubles projections et formats dérivent.

**À faire :** Prioriser les contrats contexte organisation, date, monnaie, erreurs, état de sauvegarde, téléchargement et CSV ; améliorer les frontières sans réécrire les moteurs valides.

**Recette de fermeture :** Une correction de contrat partagée se propage à tous les espaces ; tests de frontière et de comportement, aucune logique financière critique transférée dans le navigateur.

**Preuves :** [packages/application/src/index.ts:1](/workspace/matricia/packages/application/src/index.ts:1) ; [packages/contracts/src/index.ts:1](/workspace/matricia/packages/contracts/src/index.ts:1) ; [packages/workflows/src/index.ts:1](/workspace/matricia/packages/workflows/src/index.ts:1) ; [docs/architecture/ARCHITECTURE.md:14](/workspace/matricia/docs/architecture/ARCHITECTURE.md:14).

**Dépendances :** CLI-01; PRE-02; FRA-05.

## Livraison — 8 éléments
### REL-01 · P1 · Créer un vrai gate de livraison distinct du bootstrap

**Nature :** Outillage. **Responsable proposé :** QA release + DevOps.

**Constat :** release:validate passe avec 5/76 VERIFIED ; il ne lance que quatre validateurs structurels.

**À faire :** Gate strict exigeant périmètre V1 signé, preuves du SHA, tests requis sans skip, intégrations et validations applicables closes ; garder bootstrap pour le développement.

**Recette de fermeture :** Candidat avec fonction obligatoire non prouvée, suite vide ou recette échouée refusé ; candidat complet produit un manifeste vérifiable.

**Preuves :** [scripts/validate-release.ts:3](/workspace/matricia/scripts/validate-release.ts:3) ; [scripts/validate-traceability.ts:24](/workspace/matricia/scripts/validate-traceability.ts:24).

**Dépendances :** QA-01; QA-02.

### REL-02 · P1 · Faire contrôler les parcours par la CI

**Nature :** Outillage. **Responsable proposé :** DevOps + QA.

**Constat :** CI actuelle : qualité et SQL seulement ; aucun job navigateur/authentifié/accessibilité/performance ni contrat cron.

**À faire :** Jobs hermétiques et staging contrôlé, fixtures, E2E de mutations, axe, budgets et artefacts associés au commit candidat.

**Recette de fermeture :** PR cassant un cron GET, une mutation UI ou un scope multi-org fait échouer la CI ; résultats exécutés et non simplement collectés.

**Preuves :** [.github/workflows/ci.yml:12](/workspace/matricia/.github/workflows/ci.yml:12).

**Dépendances :** QA-01; QA-02; MKT-01.

### REL-03 · P1 · Supprimer le succès d’une suite d’intégration vide

**Nature :** Outillage. **Responsable proposé :** QA + plateforme.

**Constat :** test:integration vise tests/integration absent avec --passWithNoTests ; le zéro test ne valide rien.

**À faire :** Définir la vraie suite d’intégration et y brancher les tests utiles existants ou manquants ; échec lorsque la sélection attendue est vide.

**Recette de fermeture :** Commande de livraison exécute un nombre non nul connu de tests et expose les échecs ; aucun double comptage des pgTAP.

**Preuves :** [package.json:17](/workspace/matricia/package.json:17).

### REL-04 · P1 · Compléter les contrats des workflows critiques

**Nature :** Spécification et recette. **Responsable proposé :** Produit + analyse fonctionnelle + QA.

**Constat :** Registres atomiques au stade bootstrap : 2 écrans, 1 formulaire, 2 opérations API pour 161 pages et 26 handlers.

**À faire :** Contrats canoniques réutilisables : champs, permissions, états, transitions, erreurs, traduction, aide, idempotence et recette ; couvrir les workflows plutôt que créer des fichiers vides.

**Recette de fermeture :** Chaque action critique possède contrat et tests de succès/refus/reprise ; aucune ambiguïté sur son effet attendu.

**Preuves :** [docs/specs/registries/screens.yaml:3](/workspace/matricia/docs/specs/registries/screens.yaml:3) ; [docs/specs/registries/forms.yaml:3](/workspace/matricia/docs/specs/registries/forms.yaml:3) ; [docs/specs/registries/apis.yaml:3](/workspace/matricia/docs/specs/registries/apis.yaml:3).

### REL-05 · P1 · Fermer la dette de validation des interactions

**Nature :** Recette et inventaire. **Responsable proposé :** QA + frontend.

**Constat :** Scan actuel : 204 routes, 253 actions, 1 333 interactions, 525 éléments à valider au runtime. Il s’agit d’une heuristique, pas de 525 bugs.

**À faire :** Trier les exclusions, remplacer couverture parent par assertions d’effet réel pour les actions métier, puis tenir les matrices à jour.

**Recette de fermeture :** Chaque interaction livrée est testée, justifiée comme décorative ou retirée ; double clic, panne et expiration de session couverts.

**Preuves :** [scripts/audit-interactions.mjs:63](/workspace/matricia/scripts/audit-interactions.mjs:63) ; [scripts/audit-interactions.mjs:240](/workspace/matricia/scripts/audit-interactions.mjs:240).

**Dépendances :** QA-01; REL-04.

### REL-06 · P1 · Réconcilier les preuves et signer les exigences V1

**Nature :** Gouvernance. **Responsable proposé :** Release manager + auditeurs indépendants.

**Constat :** Registre 5 signatures historiques/76 exigences ; autres implémentations référencées mais visas ouverts. TEST_MATRIX, phase-ledger et PROJECT_STATE se contredisent.

**À faire :** Manifeste unique lié au SHA ; reclasser historiques, rattacher preuves fraîches et visa indépendant pour les 68 fonctions et 8 Marketing.

**Recette de fermeture :** Aucune fonction déclarée VERIFIED par simple existence de code ; statut/documentation cohérents et résultats reproductibles.

**Preuves :** [docs/traceability/REQUIREMENTS_COVERAGE.md:3](/workspace/matricia/docs/traceability/REQUIREMENTS_COVERAGE.md:3) ; [docs/progress/phase-ledger.json:4](/workspace/matricia/docs/progress/phase-ledger.json:4) ; [docs/TEST_MATRIX.md:17](/workspace/matricia/docs/TEST_MATRIX.md:17) ; [docs/progress/PROJECT_STATE.md:1](/workspace/matricia/docs/progress/PROJECT_STATE.md:1).

**Dépendances :** REL-01; REL-05.

### REL-07 · P1 · Préparer une remise client réellement exploitable

**Nature :** Livraison et transfert. **Responsable proposé :** Produit + DevOps + support + client.

**Constat :** Dossier final canonique absent ou dispersé ; README/runbooks/modeles partiels ne constituent pas une passation opérée.

**À faire :** Consolider manuel métier, guides rôles/admin, API/dictionnaire données, installation/configuration sans secrets, déploiement/rollback, backup, support/SLA et formation.

**Recette de fermeture :** Équipe repreneuse reconstruit un environnement, traite un incident et restaure une sauvegarde avec la documentation ; accès remis par canal sécurisé.

**Preuves :** [Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:2250](/workspace/matricia/Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:2250) ; [README.md:1](/workspace/matricia/README.md:1) ; [docs/runbooks/V4_1_CONTINUITY_AND_RESTORE.md:3](/workspace/matricia/docs/runbooks/V4_1_CONTINUITY_AND_RESTORE.md:3).

**Dépendances :** EXT-05; OPS-03.

### REL-08 · P1 · Signer un candidat figé et une recette métier complète

**Nature :** Recette client. **Responsable proposé :** Responsable livraison + client.

**Constat :** L’arbre inclut les corrections locales non committées ; les preuves historiques et locales ne certifient pas encore une version de livraison distante.

**À faire :** Geler le candidat après corrections, rejouer les gates, staging réaliste, recette par profils, PV de réception et autorisation distincte de production ; définir support et rollback.

**Recette de fermeture :** Zéro blocage de parcours convenu, exigences V1 et preuves approuvées, accès/formation remis et release exacte identifiable.

**Preuves :** [docs/RELEASE_CHECKLIST.md:1](/workspace/matricia/docs/RELEASE_CHECKLIST.md:1) ; [Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:2219](/workspace/matricia/Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md:2219).

**Dépendances :** REL-01; REL-02; REL-06; REL-07; EXT-04.

## Couverture de toutes les exigences obligatoires

Le registre donne **5 `VERIFIED` et 71 `IN_PROGRESS` sur 76 exigences**. Cinq fonctions signées historiquement : MAT-FUNC-001, 007, 013, 018 et 019. Les 63 autres fonctions et les 8 exigences Marketing ont du code référencé et restent à prouver/faire viser : **cela ne signifie pas qu’elles sont absentes ni réalisées à 5/76**. Les défauts précis sont décrits dans le backlog ; les autres points ci-dessous sont des recettes de fermeture.

La matrice CSV `recette-76-exigences-2026-10-31.csv` contient une ligne par exigence, son nom, son statut exact dans le registre, sa fermeture attendue et les tickets liés. Une fermeture doit toujours être rejouée sur le candidat final et visée indépendamment.

| Fonctions couvertes | Fermeture métier attendue | Tickets associés |
|---|---|---|
| 001 Passeport Matricia unique ; 028 Coffre-fort documentaire ; 051 Multi-sites ; 052 Approvals multi-utilisateurs | Passeport, coffre, sites et approbations : identité multi-rôles, réutilisation privée et validité des documents, approbation par acteurs distincts, scope de l’organisation choisi. | PUB-01; CLI-09; PRE-02; ADM-05; QA-01 |
| 002 Santé globale ; 003 Assistant IA ; 004 Détection proactive ; 005 Diagnostic continu | Profil→scores/anomalies/suggestions réels ; changement→réévaluation ; expiration/revalidation ; aucune décision financière ou sanction critique autonome. | CLI-01; CLI-02; CLI-04; CLI-05; MKT-04; QA-01 |
| 006 Actions requises ; 007 Inbox universelle | Action réellement exécutable et bonne transition ; messagerie persistée liée au bon objet, participants et non-lus exacts. | CLI-04; CLI-05; FRA-10; ADM-01; QA-01 |
| 008 Assistant création besoin ; 009 Solutions multiples ; 010 Bundles multi-bibliothèques | Besoin libre→classification justifiée→questions manquantes→demande persistée ; alternatives et bundles réellement sélectionnables et traçables. | CLI-06; CLI-07; CLI-08; QA-01 |
| 011 Mode Projet ; 012 Budget annuel ; 021 Calendrier central ; 053 Centres de coûts | Créer/modifier projet, site, budget, tâches, centre de coûts ; rattachements exacts, contraintes financières et calendrier complet. | PRE-11; CLI-11; QA-01 |
| 013 Comparateur intelligent ; 014 Complétude devis ; 015 Feedback non retenus | Comparaison de vraies versions ; complétude bloquante ; retour anonymisé aux non retenus sans exposer les concurrents. | PRE-08; PRE-09; QA-01 |
| 016 Réputation multidimensionnelle ; 017 Badges | Événements fiables→scores multidimensionnels versionnés→évaluation badge→décision autorisée, avec explication. | FRA-01; FRA-07; QA-01 |
| 018 Matching évolutif ; 019 Rotation équitable ; 020 Capacité provider | Éligibilité/rotation explicables ; scénarios AVAILABLE/LIMITED/FULL/PAUSED et régions réelles réexécutés ; aucun favori ne contourne les règles. | PRE-02; PRE-10; FRA-01; QA-01 |
| 022 Jalons ; 023 Preuves de réalisation ; 024 Checklists ; 025 Réception objective ; 026 Avenant rapide | Contrat exact→jalons→preuve privée CLEAN→critères figés→réception partielle/refus/correction→avenant prix/délai/version, audit et idempotence. | SIG-01; PRE-03; PRE-04; QA-01 |
| 027 Versionnage complet ; 029 Expirations ; 050 Prestations récurrentes | Anciennes versions reproductibles et non modifiables ; rappels/restrictions ciblés ; cycles récurrents déclenchés sans doublon et après reprise. | PRE-07; PRE-09; FRA-12; OPS-01; QA-01 |
| 030 Centre financier unifié ; 031 Prévision commissions ; 032 Rapprochement paiements ; 033 Wallet crédits | Soldes sur historique complet et ledgers séparés ; estimations→factures ; paiements partiels/multiples/allocation ; crédits accordés/réservés/consommés/expirés/corrigés. | CLI-11; PRE-01; PRE-04; PRE-05; FRA-06; PAY-03; QA-01 |
| 034 Récompenses ; 035 Parrainage ; 047 ROI recommandations ; 062 Centre économies | Attributions uniques ; conversions observables ; baseline et résultat validés ; calculs exacts sans gain inventé. | QA-01; REL-06 |
| 036 CRM franchisé ; 037 Pipeline franchisé ; 038 Relances automatiques ; 064 Résumé franchisé | Prospect→organisation réelle→qualification→conversion ; activité persistée, relance/digest réellement envoyés, retry/annulation et scope mandat. | FRA-01; FRA-05; FRA-10; FRA-12; EML-01; EML-02; QA-01 |
| 039 Modèles communication ; 040 Bibliothèque modèles ; 063 Préférences notifications | Templates FR/AR versionnés utilisés dans les envois, clonage indépendant, préférence de canal/moment réellement respectée. | FRA-03; PUB-03; EML-01; EML-02; QA-01 |
| 041 IA qualité questionnaires ; 042 Détection doublons ; 043 Simulation questionnaire ; 044 Analyse abandons | Revue qualité/doublons explicable avec décision humaine ; branches simulées par moteur réel ; début/reprise/abandon mesurés par section/question. | FRA-03; FRA-04; QA-01 |
| 045 Benchmark anonymisé ; 046 Historique évolution | Benchmark avec seuil minimal d’anonymat ; évolutions de snapshots comparables d’une même organisation et aucune conclusion constante. | CLI-02; CLI-03; QA-03 |
| 048 Fournisseurs favoris ; 049 Commander similaire ; 067 Protection contournement ; 068 Détection abus | Favoris/clonage sous éligibilité actuelle ; contacts masqués jusqu’au bon état ; signaux d’abus et refus de contournement, sans sanction automatique inventée. | QA-01; QA-03 |
| 054 Mobile ; 055 Autosave ; 056 Progression ; 057 Préremplissage | Mutations critiques à 360 px ; vrai autosave et conflits entre sessions ; complétude réelle ; préremplissage provenant de données vérifiées/récentes. | CLI-04; FRA-02; PRE-08; UX-01; UX-03; QA-01 |
| 058 Aide contextuelle ; 059 FR/AR ; 060 Langage simplifié ; 061 Accessibilité | Aide pourquoi/exemple ; terminologie FR/AR de tous les états/documents/emails ; clavier, focus, zoom et lecteur d’écran sur les parcours connectés. | UX-01; UX-02; UX-03 |
| 065 Résumé exécutif admin ; 066 Moteur exceptions | File du jour fondée sur données réelles ; exception→décision autorisée→effet exécuté→retour audité ; erreur et concurrence traitées. | ADM-01; ADM-02; ADM-08; OPS-03; OPS-04; QA-01 |

| Marketing | Fermeture attendue | Tickets associés |
|---|---|---|
| MARKETING-001 Brand Kit automatisé | Marque/services réels→préremplissage→correction/version→utilisation dans les contenus. | MKT-04; EXT-02; QA-01 |
| MARKETING-002 Générateur automatique 1 service = 3 contenus | Un service→trois contenus FR/AR persistés et conformes ; sources/allégations/confidentialité et corrections vérifiées. | MKT-01; MKT-04; EXT-02; QA-01 |
| MARKETING-003 Templates commerciaux standardisés | Six templates couverts, responsive et FR/AR ; erreurs et validation des sorties finales. | UX-02; UX-03; QA-01 |
| MARKETING-004 Calendrier mensuel automatique | Calendrier sur données réelles→approbation→programmation, changements/annulation/retry sans doublon. | MKT-01; MKT-02; QA-01 |
| MARKETING-005 Publication sociale automatisée contrôlée | OAuth/scopes/consentement→publication identifiée→retrait/expiration/reprise et réconciliation sans duplication. | MKT-02; MKT-03; EXT-02; QA-01 |
| MARKETING-006 Tracking automatique CTA → lead → devis → contrat | Vraie chaîne click→inscription→diagnostic→RFQ→contrat, attribution vérifiable et retrait respecté. | PUB-01; EXT-02; QA-01 |
| MARKETING-007 Campagnes générées à partir des anomalies réelles | Anomalie vérifiée→campagne autorisée→contenu→résultat ; aucune source de campagne inventée. | MKT-01; MKT-04; QA-01 |
| MARKETING-008 Dashboard performance minimal et actionnable | KPIs réels→recommandation fréquence/template/pause→décision/action autorisée→effet prouvé. | MKT-02; MKT-03; OPS-04; QA-01 |

## Ordre de réalisation recommandé

| Lot | Résultat à obtenir | Dépendances et preuve de sortie |
|---|---|---|
| 0 — Référence de travail | Périmètre V1, contrats critiques, statuts et données de recette réconciliés | Manifeste de candidat, aucune promesse ajoutée aux fonctions 069–090 ; décisions externes prises assez tôt |
| 1 — Fiabilité des données et garde-fous | Organisation/mandat exacts, soldes exhaustifs, dates justes, exports sûrs, production protégée du mode DEMO | Tests multi-organisations, volumes supérieurs aux limites et cas financiers négatifs |
| 2 — Chaînes Client/Prestataire | Assistance/documents, besoin/devis/contrat/mission/preuve/paiement et factures réellement raccordés | Navigateurs→serveur→DB→effets ; identité du dossier et versions conservées |
| 3 — Franchisé et Administration | Constructeurs/règles, vraie messagerie, décisions exécutées, vrais KPI/historiques | Création→refus→correction→approbation→publication/exécution ; deuxième mandat refusé |
| 4 — Marketing et exploitation | Crons, providers, publication robuste, worker, reprise/DLQ et surveillance | Panne/timeout/succès ambigu/EICAR/replay ; aucun effet externe fermé par un simple log |
| 5 — Qualité transversale | FR/AR, mobile, accessibilité, performances et tests/gates cohérents | Travaux à mener en parallèle des lots 1–4 ; budgets mesurés et interactions critiques réellement testées |
| 6 — Staging et réception | Fournisseurs/obligations activés, restauration/rollback, recette et remise client | Toutes les preuves sur le même SHA, visas indépendants, PV client, support et autorisation de production distincte |

## Recette finale minimale à signer

1. **Client** : inscription/consentement/OTP → organisation/site → documents conformes → questionnaire avec reprise/conflit → diagnostic/évolution → solution/besoin → demande → comparaison → contrat → mission/jalons → preuve scannée → réception/refus/correction → justificatifs et centre financier.
2. **Prestataire** : inscription → documents privés → qualification par service → capacité/régions → éligibilité → invitation → devis/révisions/échéance → contrat → mission/livrables → facturation → preuve de règlement CLEAN → rapprochement → réputation.
3. **Franchisé** : mandat/bibliothèque → service/questionnaire/règles → simulation → revue/refus/correction/publication → invitation/CRM/conversion/relances → réseau/matching → P&L/clôture/allocation/relevé. IT et standard vérifiés séparément ; achats volume jusqu’à liquidation/annulation selon les rôles concernés.
4. **Administration** : file réelle → analyse du bon dossier → demande complète → approbateur distinct si nécessaire → effet métier réel → audit ; comptes/permissions/suspension/restrictions, exceptions, export, vie privée et support réellement borné.
5. **Marketing** : données de marque/service → trois contenus → contrôle → calendrier → publication externe autorisée → CTA/lead/devis/contrat → KPI et décision de fréquence/pause ; retry et succès ambigu sans doublon.
6. **Transversal** : chaque rôle autorisé et insuffisant, membre de A+B et tiers étranger, FR/AR, 360 px/bureau, clavier/lecteur d’écran, session expirée, erreurs réseau, concurrence, doublons et vieux documents/versions.
7. **Exploitation** : panne worker/cron/scanner/fournisseur → alerte → reprise contrôlée ; restauration DB et fichiers privés sur autre cible ; vérification financière/RLS et respect RPO/RTO convenus.

## Conditions de livraison définitive

- Les travaux P1 et les exigences de qualité P2 du périmètre convenu sont fermés par des résultats observables, pas par suppression des symptômes ou marquage manuel de statut.
- Aucun écran ne prétend une action, un score, un état de sécurité, une sauvegarde ou un effet externe non prouvé.
- Les 68 fonctions V1 et les 8 Marketing ont leur contrat, test pertinent, preuve associée au candidat et visa applicable. Les signatures historiques sont réévaluées si les chemins ont changé.
- Tests techniques, tests SQL, E2E métier et fournisseurs distants sont identifiés séparément ; aucune suite vide ou ignorée n’est un PASS de livraison.
- Le client valide données légales, fiscalité, signature, tarifs et comptes externes ; accès/secrets remis uniquement par un canal sécurisé.
- Le candidat peut être installé, migré, sauvegardé, restauré, mis à jour et exploité par l’équipe de reprise ; staging et retour arrière testés.
- Recette client et visas indépendants terminés, problèmes résiduels documentés, responsables/SLA/support convenus et production autorisée séparément.

Une estimation de délai fiable nécessite l’affectation des lots, les décisions fournisseurs/juridiques et la première recette verticale. Un pourcentage global de maturité ou une date de livraison ferme serait arbitraire avec les preuves actuelles.
