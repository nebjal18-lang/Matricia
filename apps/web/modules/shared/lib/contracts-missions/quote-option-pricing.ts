import {z} from "zod";
/** Optional scope is priced before tax and cannot silently change a commitment. */
export const QUOTE_OPTION_PRICING_V1={basis:"EXCLUDING_TAX",included_in_base_total:false,activation:"NEW_TAXED_QUOTE_VERSION"} as const;
export function readQuoteOptionPricing(value:unknown):"EXCLUDING_TAX"|null {
 const parsed=z.object({quote_options_pricing_v1:z.object({basis:z.literal("EXCLUDING_TAX"),included_in_base_total:z.literal(false),activation:z.literal("NEW_TAXED_QUOTE_VERSION")}).strict()}).safeParse(value);
 return parsed.success?parsed.data.quote_options_pricing_v1.basis:null;
}
