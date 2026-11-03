"use client";
import {useId,useState,useTransition} from "react";
import {Button} from "@/modules/shared/ui/button";
import {Input} from "@/modules/shared/ui/input";
import {searchAllocationTargets} from "./target-search-action";
import type {AllocationTarget} from "@/modules/client/data/portfolio/allocation-targets";
/** Search/pagination are server scoped. The selected object survives searches. */
export function AllocationTargetSearch({organizationId,locale,initial,children,label}:{organizationId:string;locale:"fr"|"ar";initial:AllocationTarget[];children:React.ReactNode;label:string}){
 const id=useId(),[query,setQuery]=useState(""),[targets,setTargets]=useState(initial),[next,setNext]=useState<string|null>(null),[selected,setSelected]=useState("MANUAL"),[chosen,setChosen]=useState<AllocationTarget|null>(null),[error,setError]=useState<string|null>(null),[pending,start]=useTransition();
 const search=(more:boolean)=>start(async()=>{
  const result=await searchAllocationTargets({organizationId,query,after:more?next:null});
  if(result.status==="error"){setError(result.reason);return}
  setError(null);setTargets(previous=>more?[...previous,...result.targets]:result.targets);setNext(result.next);
 });
 const displayed=chosen&&!targets.some(item=>item.type===chosen.type&&item.id===chosen.id)?[chosen,...targets]:targets;
 return <fieldset className="grid min-w-0 gap-2"><legend>{label}</legend>
  <label htmlFor={`${id}-query`}>{locale==="ar"?"البحث في الملفات المسموح بها":"Rechercher un dossier autorisé"}</label>
  <div className="flex flex-wrap gap-2"><Input id={`${id}-query`} value={query} onChange={event=>setQuery(event.target.value)} maxLength={160}/><Button type="button" variant="outline" disabled={pending} onClick={()=>search(false)}>{locale==="ar"?"بحث":"Rechercher"}</Button></div>
  {error?<p role="alert">{error==="FORBIDDEN"?(locale==="ar"?"لا تسمح صلاحياتكم بهذا البحث.":"Vos habilitations ne permettent pas cette recherche."):(locale==="ar"?"تعذر البحث. أعيدوا المحاولة.":"La recherche a échoué. Réessayez.")}</p>:null}
  <label htmlFor={`${id}-choice`}>{label}</label><select id={`${id}-choice`} name="referenceChoice" value={selected} onChange={event=>{setSelected(event.target.value);setChosen(displayed.find(item=>`${item.type}:${item.id}`===event.target.value)??null)}} className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3">
   <option value="MANUAL">{locale==="ar"?"تسجيل يدوي مبرر":"Saisie manuelle justifiée"}</option>{children}{displayed.map(item=><option key={`${item.type}:${item.id}`} value={`${item.type}:${item.id}`}>{locale==="ar"?item.labelAr:item.labelFr}</option>)}
  </select>
  {next?<Button type="button" variant="outline" disabled={pending} onClick={()=>search(true)}>{locale==="ar"?"عرض المزيد":"Afficher les suivants"}</Button>:null}
  <p role="status" aria-live="polite">{pending?(locale==="ar"?"جارٍ البحث…":"Recherche…"):locale==="ar"?`${targets.length} ملفاً محملاً. ابحثوا للوصول إلى ملفات أخرى.`:`${targets.length} dossiers chargés. Recherchez pour accéder aux autres dossiers.`}</p>
 </fieldset>;
}
