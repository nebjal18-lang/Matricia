import { z } from "zod";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
const id=z.string().uuid();
export const mandateChoicesSchema=z.object({complete:z.literal(true),items:z.array(z.object({id,organization_id:id,library_id:id,territory_code:z.string().min(1),territory_fr:z.string(),territory_ar:z.string(),library_code:z.string().min(1),library_fr:z.string().min(1),library_ar:z.string().min(1),roles:z.array(z.object({code:z.string(),label_fr:z.string().min(1),label_ar:z.string().min(1)})).min(1)})).max(1000)});
export function mandateChoiceOptions(value:z.infer<typeof mandateChoicesSchema>,locale:Locale){return value.items.map(item=>{
 const territory=(locale==="ar"?item.territory_ar:item.territory_fr).trim()||(locale==="ar"?"اسم النطاق غير متوفر":"Nom du territoire non renseigné");
 const library=locale==="ar"?item.library_ar:item.library_fr;
 const roles=item.roles.map(role=>locale==="ar"?role.label_ar:role.label_fr).join(locale==="ar"?"، ":", ");
 return{id:item.id,organizationId:item.organization_id,libraryId:item.library_id,label:`${territory} (${item.territory_code}) · ${library} · ${roles}`};
});}
