import { z } from "zod";
const uuid = z.string().uuid();
export const qualificationReviewQuestion = z.object({
  id: uuid, labelFr: z.string(), labelAr: z.string(), answerType: z.string(),
  options: z.unknown(), required: z.boolean(), applicable: z.boolean(), answered: z.boolean(),
  value: z.unknown(), answeredAt: z.string().nullable(),
});
export const qualificationReviewSession = z.object({
  id: uuid, titleFr: z.string(), titleAr: z.string(), version: z.number().int().positive(),
  submittedAt: z.string(), locale: z.enum(["fr-MA", "ar-MA"]),
  engineScoreBasisPoints: z.number().int().min(0).max(10000),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/u), answerManifestHash: z.string().regex(/^[a-f0-9]{64}$/u),
  contextHash: z.string().regex(/^[a-f0-9]{64}$/u), questions: z.array(qualificationReviewQuestion),
});
export const qualificationReviewContext = z.object({
  qualificationId: uuid, organizationId: uuid, serviceId: uuid, libraryId: uuid,
  qualificationRowVersion: z.number().int().positive(),
  sessions: z.array(z.object({id:uuid,titleFr:z.string(),titleAr:z.string(),version:z.number().int().positive(),submittedAt:z.string(),available:z.boolean()})),
  total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.literal(20),
  selected: qualificationReviewSession.nullable(),
});
export type QualificationReviewContext = z.infer<typeof qualificationReviewContext>;
export type QualificationReviewSession = z.infer<typeof qualificationReviewSession>;
export type QualificationReviewQuestion = z.infer<typeof qualificationReviewQuestion>;
export type QualificationReviewReadResult = {status:"success";context:QualificationReviewContext}|{status:"error";reason:"UNAUTHENTICATED"|"MFA_REQUIRED"|"FORBIDDEN"|"UNAVAILABLE"|"VALIDATION"};
export function qualificationScorePercent(basis:number):string {
  if(!Number.isInteger(basis)||basis<0||basis>10000)throw new Error("INVALID_QUALIFICATION_SCORE");
  const fraction=String(basis%100).padStart(2,"0").replace(/0+$/u,"");
  return `${Math.trunc(basis/100)}${fraction?`.${fraction}`:""}`;
}
export function reviewAnswerText(question:QualificationReviewQuestion,locale:"fr"|"ar"):string {
  if(!question.answered)return locale==="ar"?"لم تُقدّم إجابة":"Aucune réponse déposée";
  const value=question.value;
  if(typeof value==="boolean")return locale==="ar"?(value?"نعم":"لا"):(value?"Oui":"Non");
  const options=Array.isArray(question.options)?question.options:[];
  const optionLabel=(selectedValue:string)=>{
    const selected=options.find((option:unknown)=>typeof option==="object"&&option!==null&&"value"in option&&option.value===selectedValue)as Record<string,unknown>|undefined;
    const label=selected?.[locale==="ar"?"label_ar":"label_fr"];
    return typeof label==="string"?label:selectedValue;
  };
  if(question.answerType==="MULTI_SELECT"&&Array.isArray(value)&&value.every(item=>typeof item==="string"))return value.map(optionLabel).join(locale==="ar"?"، ":", ");
  if(typeof value==="string"){
    if(["SINGLE_SELECT","MULTI_SELECT","SELECT","RADIO","DROPDOWN"].includes(question.answerType)){
      return optionLabel(value);
    }
    return value;
  }
  return JSON.stringify(value,null,2)??(locale==="ar"?"قيمة فارغة":"Valeur vide");
}

export function qualificationDecisionStates(current:string):string[]{
 if(["NOT_REQUESTED","PENDING"].includes(current))return["INFORMATION_REQUIRED","APPROVED","CONDITIONAL","REJECTED"];
 if(["APPROVED","CONDITIONAL"].includes(current))return["PENDING","SUSPENDED","EXPIRED"];
 if(["INFORMATION_REQUIRED","SUSPENDED","EXPIRED","REJECTED"].includes(current))return["PENDING"];
 return[];
}

/** Human scores are exact percentages, independent of the frozen engine score. */
export function humanQualificationScoreBps(value:string):number|null{
 const normalized=value.trim().replace(",",".");
 if(!/^(?:\d{1,2}(?:\.\d{1,2})?|100(?:\.0{1,2})?)$/u.test(normalized))return null;
 const[whole="0",fraction=""]=normalized.split(".");
 return Number(whole)*100+Number(fraction.padEnd(2,"0"));
}
