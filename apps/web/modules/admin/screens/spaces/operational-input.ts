import{z}from"zod";
const uuid=z.string().uuid();
export function validOperationalSpaceInput(form:FormData):boolean{
 const t=(key:string)=>String(form.get(key)??"").trim();
 if(t("view")==="consultation"){
  const send=["SEND","SUBMIT"].includes(t("decision"));
  return z.object({id:uuid,providers:z.array(uuid).max(500).refine((values)=>!send||values.length>0),note:z.string().trim().min(3).max(2000),context:z.string().max(10000),channel:z.literal("platform"),due:z.string().refine((value)=>!value&&!send||/^\d{4}-\d{2}-\d{2}$/u.test(value)&&Number.isFinite(Date.parse(value)))}).safeParse({id:t("resourceId")||t("itemId"),providers:form.getAll("providerIds").map(String),note:t("note"),context:t("context"),channel:t("channel"),due:t("dueAt")}).success;
 }
 if(t("view")==="reutilisation")return z.object({document:uuid,target:uuid,organization:uuid,destination:z.enum(["SERVICE_REQUEST","CONTRACT_VERSION","MISSION","COMPLIANCE_CASE"]),purpose:z.string().min(3).max(500)}).safeParse({document:t("documentId"),target:t("targetId"),organization:t("organizationId"),destination:t("destination"),purpose:t("purpose")}).success;
 return true;
}
