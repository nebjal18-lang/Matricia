import{z}from"zod";
export const quoteCommercialTermsSchema=z.object({source_locale:z.enum(["fr","ar"]),payment_terms:z.string().trim().min(3).max(2000),maintenance_terms:z.string().trim().max(2000)}).strict();
/** These are the author's words. Changing the interface language never translates them. */
export function readQuoteCommercialTerms(sla:unknown){const outer=z.object({commercial_terms_v1:quoteCommercialTermsSchema}).safeParse(sla);return outer.success?outer.data.commercial_terms_v1:null;}
