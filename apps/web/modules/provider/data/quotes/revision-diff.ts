import type { QuotePrefill } from "@/modules/provider/screens/devis/prefill";
export type QuoteRevisionDifference={field:keyof QuotePrefill|`line:${number}`;before:string;after:string};
const fields=["currency","paymentTerms","maintenanceTerms","solution","deliverables","inclusions","exclusions","prerequisites","warranty","correctionTerms","proposedStartDate","durationDays","validUntil"]as const;
const lineText=(line:QuotePrefill["lines"][number]|undefined,currency:string|undefined,locale:"fr"|"ar")=>{
 if(!line)return "—";const ar=locale==="ar";
 const units:Record<string,[string,string]>={DAY:["jour","يوم"],JOUR:["jour","يوم"],HOUR:["heure","ساعة"],HEURE:["heure","ساعة"],MONTH:["mois","شهر"],MOIS:["mois","شهر"],FORFAIT:["forfait","حزمة"],UNIT:["unité","وحدة"]};
 const recurrence:Record<string,[string,string]>={MONTH:["mensuel","شهري"],QUARTER:["trimestriel","ربع سنوي"],YEAR:["annuel","سنوي"]};
 return `${line.label} · ${line.quantity} ${units[line.unitCode]?.[ar?1:0]??line.unitCode} · ${line.unitPrice} ${currency??""} · ${line.itemKind==="ONE_TIME"?(ar?"مرة واحدة":"ponctuel"):(ar?"متكرر":"récurrent")} ${recurrence[line.recurrenceInterval]?.[ar?1:0]??""} · ${ar?"نسخة القاعدة الضريبية":"règle fiscale"}: ${line.taxRuleVersionId}`;
};
/** Compares immutable persisted values, never a mutable browser draft or floating-point totals. */
export function compareQuoteRevisions(before:QuotePrefill,after:QuotePrefill,locale:"fr"|"ar"="fr"):QuoteRevisionDifference[]{
 const changes:QuoteRevisionDifference[]=[];
 for(const field of fields)if((before[field]??"")!==(after[field]??""))changes.push({field,before:before[field]??"",after:after[field]??""});
 for(let index=0;index<Math.max(before.lines.length,after.lines.length);index++)if(JSON.stringify(before.lines[index])!==JSON.stringify(after.lines[index]))changes.push({field:`line:${index+1}`,before:lineText(before.lines[index],before.currency,locale),after:lineText(after.lines[index],after.currency,locale)});
 const pricing=(value:QuotePrefill["optionPriceBasis"])=>value==="EXCLUDING_TAX"?(locale==="ar"?"دون الضريبة، خارج الإجمالي الأساسي":"Hors taxes, hors total de base"):(locale==="ar"?"قاعدة ضريبية غير مثبتة":"Base fiscale non établie");
 if((before.optionPriceBasis??null)!==(after.optionPriceBasis??null))changes.push({field:"optionPriceBasis",before:pricing(before.optionPriceBasis),after:pricing(after.optionPriceBasis)});
 const optionText=(snapshot:QuotePrefill)=>(snapshot.options??[]).map(option=>`${option.label} · ${option.price} ${snapshot.currency??""} · ${pricing(snapshot.optionPriceBasis)}`).join("\n");
 if(JSON.stringify(before.options??[])!==JSON.stringify(after.options??[]))changes.push({field:"options",before:optionText(before),after:optionText(after)});
 const originals=(snapshot:QuotePrefill)=>(snapshot.attachments??[]).map(({documentVersionId,title})=>({documentVersionId,title}));
 const attachmentText=(snapshot:QuotePrefill)=>originals(snapshot).map(item=>`${item.title} · ${locale==="ar"?"مرجع الملف":"Référence du fichier"}: ${item.documentVersionId}`).join("\n");
 if(JSON.stringify(originals(before))!==JSON.stringify(originals(after)))changes.push({field:"attachments",before:attachmentText(before),after:attachmentText(after)});
 return changes;
}
