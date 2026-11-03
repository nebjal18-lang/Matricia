# Autorité économique d'une décision de litige

Aucun montant ni texte juridique n'est fourni par cette migration. Les règles réelles doivent être proposées dans un modèle contractuel, approuvées indépendamment, copiées dans la version du contrat et acceptées par les deux parties via la signature gouvernée existante.

Le champ optionnel `clauses.dispute_economics_v1` du modèle `TEMPLATE` porte ce contrat de données :

```typescript
type DisputeEconomicsV1 = {
  schema_version: 1;
  currency: string; // devise ISO de la version contractuelle
  obligations: Record<string, {
    penalty_minor: string; // entier non négatif exact, borné au bigint PostgreSQL
    commission_minor: string;
    penalty_beneficiary: "CLIENT";
    commission_beneficiary: "MATRICIA";
  }>;
};
```

Chaque clé d'obligation doit correspondre exactement à un `contract_items.item_key` signé. Le résolveur V1 accepte uniquement des montants fixes explicites ; il ne déduit aucun taux ou montant du texte libre, du prix de mission, d'une commission d'encaissement, d'un booléen « clause validée » ou d'un hash envoyé au moment de la décision. Une nouvelle méthode de calcul exige un contrat de données versionné et sa validation propre. Le montant zéro est une règle explicite ; l'absence de règle n'est jamais présentée comme un montant zéro.

Le résolveur vérifie l'égalité intégrale des clauses copiées avec celles du modèle approuvé, ses métadonnées et son hash, l'indépendance du proposant et de l'approbateur, la date d'approbation avant le scellement, l'applicabilité au service/bibliothèque/pays et la devise du contrat. La signature historique exige les mêmes enveloppes complètes, paquets de preuve, signataires et preuves des deux parties que le vérificateur existant ; une version ultérieure du contrat ne retire pas cette provenance historique. Ce vérificateur historique ne sert jamais à admettre une nouvelle signature ou mission.

`decide_mission_dispute` conserve AAL2 et refuse les membres des deux sociétés. Pour `NON_COMPLIANT_CONFIRMED`, il remplace la partie économique envoyée par l'opérateur par le résultat canonique du résolveur. Sans autorité, la décision métier, le retrait et la réaffectation restent possibles, mais aucune conséquence financière n'est créée : une exception `APPROVED_SIGNED_ECONOMIC_RULE_REQUIRED` est auditée avec la décision. Une décision non punitive peut être inversée sur un appel recevable : les effets canoniques s'appliquent alors à cette transition et créent une seule R1. Le rejeu retourne le reçu existant après transition d'état.

Le RPC `get_mission_dispute_economic_context_v1` permet aux lecteurs financiers autorisés du dossier d'afficher le montant canonique ou cette absence de prérequis. `caller_amounts_accepted` vaut toujours `false`.

Le bridge revalide aussi les conséquences historiques : type, montant, devise, débiteur et bénéficiaire doivent correspondre à la règle signée. Les pré-relevés déjà chargés sont contrôlés à nouveau avant facturation. Les sources immuables déjà présentes sont conservées et mises en exception ; aucune correction ne les transforme rétroactivement en autorité contractuelle. Une créance déjà facturée sans autorité exige une revue et un avoir gouverné ; les originaux ne sont jamais réécrits.

Une pénalité contractuellement due au Client reste séparée de la commission Matricia. La présence d'une clause ne donne pas à Matricia un mandat de collecte : sans mandat approuvé, la pénalité reste en exception et n'est pas comptabilisée comme son revenu.
