import { z } from "zod";
import type { FranchiseServiceCommand } from "./workspace-model";
export const serviceDetailsSchema={
 serviceOptionsPresent:z.literal("yes").optional(),serviceType:z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,79}$/).optional(),unitLabelFr:z.string().trim().min(1).max(120).optional(),unitLabelAr:z.string().trim().min(1).max(120).optional(),baseCurrency:z.string().regex(/^[A-Z]{3}$/).optional(),sortOrder:z.coerce.number().int().min(0).max(100000).optional(),
 longDescriptionFr:z.string().trim().max(20000).optional(),longDescriptionAr:z.string().trim().max(20000).optional(),deliverablesFr:z.string().max(30000).optional(),deliverablesAr:z.string().max(30000).optional(),fulfillmentConfig:z.string().max(100000).optional(),visibilityRules:z.string().max(100000).optional(),
 creditEligible:z.literal("yes").optional(),volumeEligible:z.literal("yes").optional(),recurringEligible:z.literal("yes").optional(),trialEligible:z.literal("yes").optional(),rfqRequired:z.literal("yes").optional(),fixedFulfillmentAllowed:z.literal("yes").optional(),sensitive:z.literal("yes").optional(),
};
type DetailsInput=z.infer<z.ZodObject<typeof serviceDetailsSchema>>;
export function serviceDetails(input:DetailsInput,existing:FranchiseServiceCommand|null,short:{fr:string;ar:string}){
 try{
  const record=(raw:string|undefined,fallback:Record<string,unknown>)=>raw===undefined?{...fallback}:z.record(z.string(),z.unknown()).parse(JSON.parse(raw));
  const fulfillment=record(input.fulfillmentConfig,existing?.fulfillmentConfig??{schema_version:1});
  if(input.deliverablesFr!==undefined||input.deliverablesAr!==undefined){const fr=(input.deliverablesFr??"").split("\n").map(s=>s.trim()).filter(Boolean);const ar=(input.deliverablesAr??"").split("\n").map(s=>s.trim()).filter(Boolean);if(fr.length!==ar.length||fr.length>50||[...fr,...ar].some(s=>s.length>500))return null;const legacy=Array.isArray(fulfillment.deliverables)&&fulfillment.deliverables.some(item=>typeof item!=="object"||item===null||!("label_fr"in item)||!("label_ar"in item));if(fr.length>0||!legacy)fulfillment.deliverables=fr.map((label_fr,index)=>({label_fr,label_ar:ar[index]!}));}
  const flag=(name:"creditEligible"|"volumeEligible"|"recurringEligible"|"trialEligible"|"rfqRequired"|"fixedFulfillmentAllowed"|"sensitive",fallback:boolean)=>input.serviceOptionsPresent?input[name]==="yes":existing?.[name]??fallback;
  return{serviceType:input.serviceType??existing?.serviceType??"ADVISORY",unitLabelFr:input.unitLabelFr??existing?.unitLabelFr??"unité",unitLabelAr:input.unitLabelAr??existing?.unitLabelAr??"وحدة",baseCurrency:input.baseCurrency??existing?.baseCurrency??"MAD",sortOrder:input.sortOrder??existing?.sortOrder??1,longDescriptionFr:input.longDescriptionFr||existing?.longDescriptionFr||short.fr,longDescriptionAr:input.longDescriptionAr||existing?.longDescriptionAr||short.ar,fulfillmentConfig:fulfillment,visibilityRules:record(input.visibilityRules,existing?.visibilityRules??{schema_version:1}),creditEligible:flag("creditEligible",false),volumeEligible:flag("volumeEligible",false),recurringEligible:flag("recurringEligible",false),trialEligible:flag("trialEligible",false),rfqRequired:flag("rfqRequired",true),fixedFulfillmentAllowed:flag("fixedFulfillmentAllowed",false),sensitive:flag("sensitive",false)};
 }catch{return null;}
}
