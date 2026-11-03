import type { QuotePrefill } from "@/modules/provider/screens/devis/prefill";
export type QuoteRevisionDifference={field:keyof QuotePrefill|`line:${number}`;before:string;after:string};
const fields=["currency","solution","deliverables","inclusions","exclusions","prerequisites","warranty","correctionTerms","proposedStartDate","durationDays","validUntil"]as const;
const lineText=(line:QuotePrefill["lines"][number]|undefined,currency:string|undefined,locale:"fr"|"ar")=>{
 if(!line)return "—";const ar=locale==="ar";
 const units:Record<string,[string,string]>={DAY:["jour","يوم"],JOUR:["jour","يوم"],HOUR:["heure","ساعة"],HEURE:["heure","ساعة"],MONTH:["mois","شهر"],MOIS:["mois","شهر"],FORFAIT:["forfait","حزمة"],UNIT:["unité","وحدة"]};
 const recurrence:Record<string,[string,string]>={MONTH:["mensuel","شهري"],QUARTER:["trimestriel","ربع سنوي"],YEAR:["annuel","سنوي"]};
 return `${line.label} · ${line.quantity} ${units[line.unitCode]?.[ar?1:0]??line.unitCode} · ${line.unitPrice} ${currency??""} · ${line.itemKind==="ONE_TIME"?(ar?"مرة واحدة":"ponctuel"):(ar?"متكرر":"récurrent")} ${recurrence[line.recurrenceInterval]?.[ar?1:0]??""} · ${ar?"نسخة القاعدة الضريبية":"règle fiscale"}: ${line.taxRuleVersionId}`;
};
/** Compares immutable persisted values, never a mutable browser draft or floating-point totals. */
export function compareQuoteRevisions(before:QuotePrefill,after:QuotePrefill,locale:"fr"|"ar"="fr"):QuoteRevisionDifference[]{
 const changes:QuoteRevisionDifference[]=[];
 for(const field of fields)if(before[field]!==after[field])changes.push({field,before:before[field]??"",after:after[field]??""});
 for(let index=0;index<Math.max(before.lines.length,after.lines.length);index++)if(JSON.stringify(before.lines[index])!==JSON.stringify(after.lines[index]))changes.push({field:`line:${index+1}`,before:lineText(before.lines[index],before.currency,locale),after:lineText(after.lines[index],after.currency,locale)});
 return changes;
}
