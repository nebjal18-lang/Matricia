import {casablancaLocalToIso} from "@/modules/shared/lib/geo/casablanca-time";
function localLabel(instant:number){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Casablanca",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(instant);
 const value=(type:string)=>parts.find(part=>part.type===type)?.value??"";
 return`${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}
/** Refuse a non-existent or ambiguous Moroccan wall-clock time. */
export function parseBenefitSchedule(value:string):string|null{
 const proposed=casablancaLocalToIso(value);if(!proposed)return null;
 const instant=Date.parse(proposed);if(localLabel(instant)!==value)return null;
 if(localLabel(instant-3600000)===value||localLabel(instant+3600000)===value)return null;
 return proposed;
}
export function defaultBenefitSchedule(instant:number){return localLabel(instant+300000);}
