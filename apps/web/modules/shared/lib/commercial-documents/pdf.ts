import {dirname,join} from "node:path";
import PdfPrinter from "pdfmake";
import {formatMinorDecimal} from "./money";
import type { ContentText, TDocumentDefinitions } from "pdfmake/interfaces";
// Resolve font assets through Node at runtime; Turbopack require.resolve returns a module id.
const runtimeRequire=process.getBuiltinModule("module").createRequire(join(process.cwd(),"package.json"));
export type BillingPdfSnapshot = { kind: "invoice" | "statement" | "credit_note"; number: string;originalInvoiceNumber?:string;replacementForInvoiceNumber?:string;cancellationCreditNumber?:string;reason?:string; issuer: { name: string; address: string; ice: string; version: string; legalForm?:string;ifNumber?:string;rcNumber?:string;contactEmail?:string }; recipient: string;recipientDetails?:string[]; currency: string; totalMinor: string; issuedOn: string; dueOn?: string; periodStart?: string; periodEnd?: string; sourceHash: string; lines: Array<{ label: string; amountMinor: string }> };
const fontRoot=dirname(runtimeRequire.resolve("@fontsource/noto-sans-arabic/package.json"));
const latinFont=join(fontRoot,"files/noto-sans-arabic-latin-400-normal.woff");
const arabicFont=join(fontRoot,"files/noto-sans-arabic-arabic-400-normal.woff");
export function localizedPdfText(value: string): ContentText {
  // Keep script runs in their embedded font, including mixed Arabic/Latin company names.
  const runs = value.match(/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\s]+|[^\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\s]+/gu) ?? [];
  // A shaping run must retain word spaces: pdfmake otherwise lays out each Arabic
  // word left-to-right, losing separation and word order. Nonbreaking spaces let
  // the embedded font shape the phrase together.
  return { text: runs.map((text) => {const arabic=/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(text);return {text:arabic?text.replace(/ /g,"\u00a0"):text,font:arabic?"Arabic":"Latin"};}) };
}
const content=localizedPdfText;
function amount(minor: string, currency: string): string {
  if (!/^\d+$/.test(minor)) throw new Error("BILLING_PDF_INVALID_AMOUNT");
  return `${formatMinorDecimal(minor,currency)} ${currency}`;
}
export async function renderBillingPdf(snapshot: BillingPdfSnapshot, locale: "fr" | "ar"): Promise<Buffer> {
  if (!/^[0-9a-f]{64}$/.test(snapshot.sourceHash) || !/^[A-Z]{3}$/.test(snapshot.currency)) throw new Error("BILLING_PDF_INVALID_SNAPSHOT");
  const ar=locale==="ar";
  const issuedAt=new Date(`${snapshot.issuedOn}T00:00:00.000Z`);
  if(!Number.isFinite(issuedAt.getTime()))throw new Error("BILLING_PDF_INVALID_SNAPSHOT");
  const definition: TDocumentDefinitions={
    pageSize:"A4",pageMargins:[40,40,40,45],defaultStyle:{font:"Latin",fontSize:11,alignment:ar?"right":"left"},
    info:{title:`${snapshot.kind} ${snapshot.number}`,author:snapshot.issuer.name,subject:`Immutable source ${snapshot.sourceHash}`,creationDate:issuedAt,modDate:issuedAt},
    content:[
      {...content(snapshot.kind==="invoice"?(ar?"فاتورة":"Facture"):snapshot.kind==="credit_note"?(ar?"إشعار دائن":"Avoir"):(ar?"كشف رسمي":"Relevé officiel")),fontSize:21,margin:[0,0,0,12]},
      content(snapshot.number),
      ...(snapshot.originalInvoiceNumber?[content(`${ar?"الفاتورة الأصلية":"Facture d’origine"}: ${snapshot.originalInvoiceNumber}`)]:[]),
      ...(snapshot.replacementForInvoiceNumber?[content(`${ar?"تحل محل الفاتورة":"Remplace la facture"}: ${snapshot.replacementForInvoiceNumber}`)]:[]),
      ...(snapshot.cancellationCreditNumber?[content(`${ar?"الإشعار الدائن للإلغاء":"Avoir d’annulation"}: ${snapshot.cancellationCreditNumber}`)]:[]),
      ...(snapshot.reason?[content(snapshot.reason)]:[]),
      content(snapshot.issuer.name),content(snapshot.issuer.address),content(`ICE: ${snapshot.issuer.ice}`),
      ...(snapshot.issuer.legalForm?[content(snapshot.issuer.legalForm)]:[]),
      ...(snapshot.issuer.ifNumber?[content(`IF: ${snapshot.issuer.ifNumber}`)]:[]),
      ...(snapshot.issuer.rcNumber?[content(`RC: ${snapshot.issuer.rcNumber}`)]:[]),
      ...(snapshot.issuer.contactEmail?[content(snapshot.issuer.contactEmail)]:[]),
      {...content(`${ar?"العميل":"Destinataire"}: ${snapshot.recipient}`),margin:[0,12,0,8]},
      ...(snapshot.recipientDetails??[]).map(value=>content(value)),
      content(`${ar?"تاريخ الإصدار":"Émis le"}: ${snapshot.issuedOn}`),
      ...(snapshot.dueOn?[content(`${ar?"تاريخ الاستحقاق":"Échéance"}: ${snapshot.dueOn}`)]:[]),
      ...(snapshot.periodStart?[content(`${ar?"الفترة":"Période"}: ${snapshot.periodStart} / ${snapshot.periodEnd}`)]:[]),
      {margin:[0,18,0,12],table:{headerRows:1,widths:ar?["auto","*"]:["*","auto"],body:([
        [content(ar?"البيان":"Désignation"),content(ar?"المبلغ":"Montant")],
        ...snapshot.lines.map((line)=>[content(line.label),content(amount(line.amountMinor,snapshot.currency))]),
        [content(ar?"الإجمالي":"Total"),content(amount(snapshot.totalMinor,snapshot.currency))],
      ]).map(row=>ar?row.reverse():row)}},
      content(`${ar?"بصمة النسخة الأصلية":"Empreinte de la source"}: ${snapshot.sourceHash}`),
      content(`${ar?"نسخة هوية المصدر":"Identité émetteur version"}: ${snapshot.issuer.version}`),
    ],footer:(page,pages)=>({text:`${page} / ${pages}`,alignment:"center",fontSize:9,font:"Latin"}),
  };
  return renderPdfDocument(definition);
}
/** Native embedded Latin/Arabic fonts for any private document, without billing semantics. */
export async function renderPdfDocument(definition:TDocumentDefinitions,maxBytes?:number):Promise<Buffer>{
  const prepared:TDocumentDefinitions={...definition,defaultStyle:{font:"Latin",...definition.defaultStyle}};
  const printer=new PdfPrinter({Latin:{normal:latinFont,bold:latinFont,italics:latinFont,bolditalics:latinFont},Arabic:{normal:arabicFont,bold:arabicFont,italics:arabicFont,bolditalics:arabicFont}});
  return new Promise((resolve,reject)=>{const doc=printer.createPdfKitDocument(prepared);const chunks:Buffer[]=[];let size=0;doc.on("data",(chunk:Buffer)=>{size+=chunk.length;if(maxBytes&&size>maxBytes){doc.destroy(new Error("DOCUMENT_PDF_TOO_LARGE"));return;}chunks.push(chunk);});doc.on("error",reject);doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.end();});
}
