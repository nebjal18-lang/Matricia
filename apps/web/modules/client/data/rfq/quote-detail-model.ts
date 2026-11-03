export type ClientOfferLine = {
  id: string;
  label: string;
  quantity: string;
  unitCode: string;
  taxLabel: string;
  totalMinor: string;
};

export type ClientOfferDocument = {
  id: string;
  fileName: string;
  kind: "pdf" | "xlsx" | "docx" | "file";
  href: string;
};

export type ClientOfferPoint = {
  id: "scope" | "timeline" | "exclusions" | "terms";
  hint: string;
  action: "review" | "compare";
};

export type ClientOfferFlag = {
  id: string;
  text: string;
  tone: "clarify" | "confirm" | "info";
};

export type ClientOfferDetail = {
  quoteId: string;
  quoteVersionId: string;
  displayedVersionNumber?:number;
  revisionInProgress?:boolean;
  publishedVersions?:{id:string;version:number;submittedAt:string}[];
  requestId: string;
  rfqId: string;
  label: string;
  description: string;
  currency: string;
  inclusions: string[];
  deliverables: string[];
  delays: string[];
  conditions: string[];
  exclusions: string[];
  lines: ClientOfferLine[];
  optionPriceBasis?:"EXCLUDING_TAX"|null;
  options?:{id:string;label:string;amountMinor:string}[];
  documents: ClientOfferDocument[];
  points: ClientOfferPoint[];
  flags: ClientOfferFlag[];
  comparisonHref: string;
  askHref: string;
  documentsHref: string;
};

export function formatTaxRate(basisPoints: number): string {
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) return "—";
  const whole = Math.trunc(basisPoints / 100);
  const fraction = basisPoints % 100;
  return fraction === 0 ? `${whole} %` : `${whole},${String(fraction).padStart(2, "0")} %`;
}

export function formatExactQuantity(value: string): string {
  if (!/^\d+(?:\.\d+)?$/u.test(value)) return value;
  return value.replace(/(?:\.0+|(\.\d*?)0+)$/u, "$1").replace(/\.$/u, "");
}

export function documentKind(fileName: string): ClientOfferDocument["kind"] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "xlsx";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "docx";
  return "file";
}

export function offerLabel(index: number, locale: "fr" | "ar"): string {
  const letter = String.fromCharCode(65 + Math.max(0, index));
  return locale === "ar" ? `العرض ${letter}` : `Offre ${letter}`;
}

export function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter((item) => item.length > 0).slice(0, 20);
}

export function localizedText(locale: "fr" | "ar", fr: string, ar: string | null): string {
  const arabic = ar?.trim();
  return locale === "ar" && arabic ? arabic : fr;
}
