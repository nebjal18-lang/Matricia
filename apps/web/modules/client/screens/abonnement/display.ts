import type {SubscriptionDashboard} from "@/modules/shared/lib/subscriptions/model";
export type SubscriptionDateLabels=Record<string,string>;
/** Run on the server and serialize labels, since browser/Node tzdata can differ. */
export function subscriptionDateLabels(dashboard:SubscriptionDashboard,locale:"fr"|"ar"):SubscriptionDateLabels{
 const values=[...dashboard.plans.flatMap(p=>[p.validFrom,p.validTo]),dashboard.subscription?.currentPeriodEnd,dashboard.subscription?.pendingChangeEffectiveAt,...(dashboard.subscription?.cycles.flatMap(c=>[c.periodStart,c.periodEnd])??[]),...(dashboard.subscription?.transitions.map(t=>t.occurredAt)??[])];
 return Object.fromEntries(values.filter((v):v is string=>Boolean(v)).map(value=>[value,subscriptionDateLabel(value,locale)]));
}
export function subscriptionDateLabel(value:string,locale:"fr"|"ar"):string{
 const day=/^\d{4}-\d{2}-\d{2}$/.test(value),date=new Date(day?`${value}T12:00:00Z`:value);if(!Number.isFinite(date.getTime()))return locale==="fr"?"Date indisponible":"التاريخ غير متاح";
 return new Intl.DateTimeFormat(locale==="fr"?"fr-MA":"ar-MA",{dateStyle:"medium",...(day?{}:{timeStyle:"short"as const}),timeZone:day?"UTC":"Africa/Casablanca"}).format(date);
}
export function subscriptionIntervalLabel(value:string|null,locale:"fr"|"ar"){return value==="MONTHLY"?(locale==="fr"?"Mensuelle":"شهرية"):value==="ANNUAL"?(locale==="fr"?"Annuelle":"سنوية"):(locale==="fr"?"Non définie":"غير محددة");}
export function subscriptionReasonLabel(value:string,locale:"fr"|"ar"){
 const labels:Record<string,readonly[string,string]>={VERIFIED_ACTIVATED:["Organisation vérifiée et activée","تم التحقق من المؤسسة وتفعيلها"],VERIFIED_PAYMENT:["Paiement confirmé","دفع مؤكد"],UPGRADE_IMMEDIATE:["Surclassement immédiat","ترقية فورية"],DOWNGRADE_NEXT_CYCLE:["Déclassement au prochain cycle","تخفيض في الدورة القادمة"]};
 return Object.hasOwn(labels,value)?labels[value]![locale==="fr"?0:1]:(locale==="fr"?"Transition enregistrée — motif à consulter dans le dossier":"انتقال مسجل — يرجى مراجعة السبب في الملف");
}
