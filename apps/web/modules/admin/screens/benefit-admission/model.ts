import {z} from "zod";
export const uuid=z.string().uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/u),quantity=z.string().regex(/^[1-9]\d{0,18}$/u).refine(v=>BigInt(v)<=BigInt("9223372036854775807"));
const names={id:uuid,name_fr:z.string(),name_ar:z.string(),version:z.number().int()};
export const sourcesSchema=z.object({items:z.array(z.object({...names,status:z.string(),fulfillment_mode:z.string(),quota:z.string().nullable()})).max(25),page:z.number(),total:z.number(),has_next:z.boolean()});
export const boxesSchema=z.object({items:z.array(z.object({...names,content_hash:hash})).max(25),page:z.number(),total:z.number(),has_next:z.boolean()});
export const quotaScope=z.enum(["NONE","GLOBAL_VERSION","ORGANIZATION_VERSION","ORGANIZATION_SUBSCRIPTION_PERIOD"]);
export const policySchema=z.object({id:uuid,version:z.number(),content_hash:hash,quota_scope:quotaScope,quota_units:z.string().nullable(),capacity_units:z.string().nullable(),allowed_country_codes:z.array(z.string()),required_box_version_ids:z.array(uuid),effective_from:z.string(),effective_until:z.string().nullable(),reason:z.string(),reference:z.string(),fulfillment_evidence_kind:z.literal("HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1"),decision:z.enum(["APPROVE","REJECT"]).nullable(),can_review:z.boolean()});
export const contextSchema=z.object({benefit_version_id:uuid,name_fr:z.string(),name_ar:z.string(),source_hash:hash,head_id:uuid.nullable(),source:z.object({quota:z.string().nullable(),capacity_rule:z.record(z.string(),z.unknown()),eligibility_rule:z.record(z.string(),z.unknown()),fulfillment_mode:z.string()}),policies:z.array(policySchema).max(25),page:z.number(),total:z.number(),has_next:z.boolean()});
export type BenefitAdmissionContext=z.infer<typeof contextSchema>;
export const evidenceKind="HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1";
export function utcPolicyDate(raw:string):string{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(raw))throw new Error("INVALID_POLICY_DATE");
 const date=new Date(`${raw}:00Z`);if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,16)!==raw)throw new Error("INVALID_POLICY_DATE");return date.toISOString();
}
export function policyProposalArgs(context:BenefitAdmissionContext,form:FormData,boxIds:string[]){
 const scope=quotaScope.parse(form.get("quotaScope")),limit=scope==="NONE"?null:quantity.parse(form.get("quotaUnits"));
 if(scope==="NONE"&&String(form.get("quotaUnits")??"").trim())throw new Error("CONTRADICTORY_QUOTA_UNITS");
 const capacityMode=z.enum(["UNLIMITED","GLOBAL_CONCURRENT_UNITS"]).parse(form.get("capacityMode"));
 if(capacityMode==="UNLIMITED"&&String(form.get("capacityUnits")??"").trim())throw new Error("CONTRADICTORY_CAPACITY_UNITS");
 if(form.get("humanEvidence")!=="yes")throw new Error("BENEFIT_HUMAN_DELEGATION_CONFIRMATION_REQUIRED");
 const countries=z.array(z.string().regex(/^[A-Z]{2}$/u)).max(50).parse(String(form.get("countries")??"").split(/[\s,;]+/u).filter(Boolean));
 return {p_benefit_version_id:context.benefit_version_id,p_expected_source_hash:context.source_hash,p_expected_head_id:context.head_id,p_quota_scope:scope,p_quota_units:limit,p_capacity_units:capacityMode==="UNLIMITED"?null:quantity.parse(form.get("capacityUnits")),p_allowed_country_codes:[...new Set(countries)].sort(),p_required_box_version_ids:[...new Set(z.array(uuid).max(100).parse(boxIds))].sort(),p_effective_from:utcPolicyDate(String(form.get("from")??"")),p_effective_until:form.get("until")?utcPolicyDate(String(form.get("until"))):null,p_reason:z.string().trim().min(10).max(2000).parse(form.get("reason")),p_reference:z.string().trim().min(8).max(1000).parse(form.get("reference")),p_fulfillment_evidence_kind:evidenceKind};
}
export function benefitAdmissionError(message:string,locale:"fr"|"ar"){
 const tr=(fr:string,ar:string)=>locale==="ar"?ar:fr;
 if(message.includes("LEGACY_RULE_UNSUPPORTED"))return tr("Cette configuration historique contient une règle non interprétée. Créez une nouvelle version d’avantage avec les formes typées prises en charge ; aucune règle n’est ignorée.","يتضمن الإعداد القديم قاعدة غير مفسرة. أنشئوا نسخة ميزة بقواعد مدعومة ومحددة النوع؛ لا يتم تجاهل أي قاعدة.");
 if(message.includes("AUTOMATION_NOT_CONFIGURED"))return tr("Cet avantage exige un effet automatique de plateforme sans exécuteur natif disponible. La preuve humaine ne remplace pas cet effet.","تتطلب الميزة أثرا آليا للمنصة دون منفذ أصلي متاح. الإثبات البشري لا يعوض هذا الأثر.");
 if(/STALE|MISMATCH/u.test(message))return tr("La source, la politique ou la réservation a changé. Actualisez et faites une nouvelle revue.","تغير المصدر أو السياسة أو الحجز. حدّثوا وأجروا مراجعة جديدة.");
 if(message.includes("INDEPENDENT"))return tr("Une autre personne Finance habilitée doit décider.","يجب أن يقرر شخص مخول آخر من المالية.");
 if(message.includes("QUOTA_EXCEEDED"))return tr("Le quota de cette version est atteint. Une politique revue ou une libération réelle est nécessaire.","بلغ حد هذه النسخة. تلزم سياسة مراجعة أو تحرير فعلي.");
 if(message.includes("CAPACITY_UNAVAILABLE"))return tr("La capacité concurrente disponible est insuffisante.","السعة المتزامنة المتاحة غير كافية.");
 if(message.includes("ELIGIBILITY"))return tr("Les conditions de pays ou de Box acquise ne sont pas remplies.","شروط البلد أو الباقة المكتسبة غير مستوفاة.");
 if(message.includes("SUBSCRIPTION_PERIOD"))return tr("Une période d’abonnement réellement financée est nécessaire pour cette règle.","تتطلب هذه القاعدة فترة اشتراك ممولة فعليا.");
 return tr("Opération indisponible. Vérifiez la saisie, l’authentification renforcée Finance et les droits, puis actualisez.","العملية غير متاحة. تحققوا من الإدخال ومصادقة المالية المعززة والصلاحيات ثم حدّثوا.");
}
