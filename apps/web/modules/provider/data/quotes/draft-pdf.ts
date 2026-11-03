import type {Content,TDocumentDefinitions} from "pdfmake/interfaces";
import {localizedPdfText,renderPdfDocument} from "@/modules/shared/lib/commercial-documents/pdf";
import {formatMinorDecimal} from "@/modules/shared/lib/commercial-documents/money";
import type {ProviderQuoteInvitation} from "./model";
import type {QuotePrefill} from "@/modules/provider/screens/devis/prefill";

/** An authorized work copy of an actual stored version; never a signature or invoice. */
export async function renderProviderQuoteDraftPdf(source:{invitation:ProviderQuoteInvitation;prefill:QuotePrefill;organizationName:string},locale:"fr"|"ar"):Promise<Buffer> {
 const {invitation,prefill,organizationName}=source,q=invitation.quote,ar=locale==="ar",t=localizedPdfText;
 if(!q?.currentVersionId||!q.createdAt||q.subtotalMinor===null||q.taxMinor===null||q.totalMinor===null||q.currency!==invitation.currency||!prefill.lines.length)throw new Error("QUOTE_DRAFT_SOURCE_REQUIRED");
 if(BigInt(q.subtotalMinor)+BigInt(q.taxMinor)!==BigInt(q.totalMinor))throw new Error("QUOTE_DRAFT_AMOUNTS_INVALID");
 const date=new Date(q.createdAt);if(!Number.isFinite(date.getTime()))throw new Error("QUOTE_DRAFT_DATE_INVALID");
 const amount=(minor:string)=>`${formatMinorDecimal(minor,invitation.currency)} ${invitation.currency}`;
 const title=ar?"مسودة عرض — نسخة عمل غير تعاقدية":"BROUILLON DE DEVIS — COPIE DE TRAVAIL NON CONTRACTUELLE";
 const heading=(text:string):Content=>({...t(text),bold:true,fontSize:13,margin:[0,12,0,4]});
 const content:Content[]=[{...t(title),fontSize:17,bold:true,margin:[0,0,0,15]},t(organizationName),t(`${ar?"نسخة محفوظة":"Version enregistrée"}: ${q.versionNumber}`),t(`${ar?"مرجع النسخة":"Référence de version"}: ${q.currentVersionId}`),t(invitation.description),heading(ar?"الحل المقترح":"Solution proposée"),t(prefill.solution)];
 const headers=[ar?"البيان":"Désignation",ar?"الكمية والوحدة":"Quantité et unité",ar?"سعر الوحدة":"Prix unitaire"];
 const rows:Content[][]=[headers.map(t),...prefill.lines.map(line=>[t(line.label),t(`${line.quantity} ${line.unitCode}`),t(`${line.unitPrice} ${invitation.currency}`)])];
 content.push({margin:[0,12,0,10],table:{headerRows:1,widths:ar?[100,100,"*"]:["*",100,100],body:rows.map(row=>ar?row.reverse():row)}},t(`${ar?"دون الضرائب":"Hors taxes"}: ${amount(q.subtotalMinor)}`),t(`${ar?"الضرائب":"Taxes"}: ${amount(q.taxMinor)}`),t(`${ar?"الإجمالي الأساسي":"Total de base"}: ${amount(q.totalMinor)}`));
 const sections:[string,string][]=[[ar?"التسليمات":"Livrables",prefill.deliverables],[ar?"المشمول":"Inclusions",prefill.inclusions],[ar?"المستثنى":"Exclusions",prefill.exclusions],[ar?"المتطلبات":"Prérequis",prefill.prerequisites],[ar?"الضمان":"Garantie",prefill.warranty],[ar?"التصحيح":"Corrections",prefill.correctionTerms],[ar?"شروط الدفع":"Modalités de paiement",prefill.paymentTerms??""],[ar?"الصيانة":"Maintenance",prefill.maintenanceTerms??""]];
 for(const[label,value]of sections)if(value)content.push(heading(label),t(value));
 content.push(heading(ar?"التخطيط والصلاحية":"Planning et validité"),t(`${prefill.proposedStartDate} · ${prefill.durationDays} ${ar?"أيام":"jours"}`),t(prefill.validUntil));
 if(prefill.options?.length){content.push(heading(ar?"خيارات غير مشمولة في الإجمالي الأساسي":"Options hors total de base"));for(const option of prefill.options)content.push(t(`${option.label}: ${option.price} ${invitation.currency} ${prefill.optionPriceBasis==="EXCLUDING_TAX"?(ar?"دون الضريبة":"HT"):(ar?"يجب توضيح المعالجة الضريبية":"base fiscale à clarifier")}`));}
 if(prefill.attachments?.length){content.push(heading(ar?"مرفقات مرتبطة بالنسخة":"Pièces liées à la version"));for(const attachment of prefill.attachments)content.push(t(attachment.title));}
 content.push(heading(ar?"سبب النسخة":"Motif de version"),t(prefill.changeReason));
 const definition:TDocumentDefinitions={pageSize:"A4",pageMargins:[35,35,35,40],defaultStyle:{font:"Latin",fontSize:10,alignment:ar?"right":"left"},watermark:{text:ar?"مسودة":"BROUILLON",font:ar?"Arabic":"Latin",color:"gray",opacity:0.12},info:{title,author:organizationName,creationDate:date,modDate:date,subject:q.currentVersionId},content,footer:(page,pages)=>({text:`${page} / ${pages}`,font:"Latin",fontSize:8,alignment:"center"})};
 return renderPdfDocument(definition,10*1024*1024);
}
