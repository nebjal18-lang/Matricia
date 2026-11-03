const numeric=new Set(["INTEGER","DECIMAL","PERCENTAGE","QUANTITY","RATING_5","RATING_10"]);
export function ruleListValues(raw:string,answerType:string|undefined):unknown[]{
 return raw.split(",").map(v=>v.trim()).filter(Boolean).map((value)=>{
  if(numeric.has(answerType??"")){const parsed=Number(value);return Number.isFinite(parsed)?parsed:value;}
  if(answerType==="YES_NO"){if(["true","yes","oui","1","نعم"].includes(value.toLowerCase()))return true;if(["false","no","non","0","لا"].includes(value.toLowerCase()))return false;}
  return value;
 });
}
export function newRuleAction(type:string,firstQuestionId:string|undefined):{type:string;[key:string]:unknown}{
 if(type==="SCORE")return{type,dimension:"",delta_basis_points:0};
 if(type==="SET_VALIDITY_DAYS")return{type,duration_days:1};
 if(["SHOW","HIDE","REQUIRED","OPTIONAL"].includes(type))return{type,target:firstQuestionId??""};
 return{type};
}
