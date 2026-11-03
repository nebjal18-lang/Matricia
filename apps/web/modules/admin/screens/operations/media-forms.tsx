"use client";
import { useActionState, useState } from "react";
import { getSupabaseBrowserClient } from "@/modules/shared/lib/supabase/client";
import { requestMediaInvestigation, type SocialVerificationState } from "./social-verification-actions";
export function MediaAssetForm({jobId,channel,locale}:{jobId:string;channel:string;locale:"fr"|"ar"}){
 const ar=locale==="ar";const [pending,setPending]=useState(false);const [status,setStatus]=useState<"idle"|"success"|"error">("idle");
 return <form className="space-y-3" onSubmit={async event=>{event.preventDefault();const form=new FormData(event.currentTarget);const file=form.get("media");if(!(file instanceof File)||file.size<12||file.size>52428800||(file.type==="image/jpeg"&&file.size>8388608)||form.get("approval")!=="yes"){setStatus("error");return;}setPending(true);setStatus("idle");try{
  const digest=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());const sha256=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,"0")).join("");
  const metadata={jobId,sha256,mediaType:file.type,byteLength:file.size,publicUseApproved:true};
  const reserve=await fetch("/api/marketing/media-assets",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...metadata,action:"reserve"})});
  const result=await reserve.json() as {code?:string;path?:string;token?:string};if(!reserve.ok)throw new Error("RESERVATION_FAILED");
  if(result.code!=="MEDIA_ALREADY_REGISTERED"){
   if(result.code!=="MEDIA_UPLOAD_VERIFY_EXISTING"){
   if(!result.path||!result.token)throw new Error("UPLOAD_CONTRACT_INVALID");
   // Finalization also recovers a previous upload whose acknowledgement was lost.
   await getSupabaseBrowserClient().storage.from("marketing-media-source").uploadToSignedUrl(result.path,result.token,file,{contentType:file.type});
   }
   const final=await fetch("/api/marketing/media-assets",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...metadata,action:"finalize"})});if(!final.ok)throw new Error("VERIFICATION_FAILED");
  }
  setStatus("success");
 }catch{setStatus("error");}finally{setPending(false);}}}>
 <label className="block">{ar?"ملف معتمد: JPEG حتى 8 ميغابايت، MP4 حتى 50 ميغابايت":"Média approuvé : JPEG ≤8 Mio, MP4 ≤50 Mio"}<input type="file" name="media" required accept={channel==="REEL"?"video/mp4":"image/jpeg"} className="mt-1 block min-h-11 w-full"/></label>
 <label className="flex gap-3"><input type="checkbox" name="approval" value="yes" required className="mt-1 size-5 shrink-0"/><span>{ar?"أصرّح بالنشر العام لهذا الملف مع المحتوى المعتمد ومعرّف تتبع فريد. يحتفظ النظام بنسخة ثابتة وببصمة الملف.":"J’autorise la diffusion publique de ce fichier avec le contenu approuvé et un identifiant de suivi unique. Une copie immuable et son empreinte sont conservées."}</span></label>
 <button disabled={pending||status==="success"} className="min-h-11 rounded border px-4 disabled:opacity-50">{ar?"إيداع الوسائط والتحقق منها":"Déposer et vérifier le média"}</button><p role={status==="error"?"alert":"status"}>{status==="success"?(ar?"تم التحقق من الملف. يبقى النشر خاضعاً للموافقات والجدول.":"Fichier vérifié. La publication reste soumise aux consentements et au calendrier."):status==="error"?(ar?"فشل الإيداع أو التحقق. يمكن إعادة المحاولة بنفس الملف.":"Dépôt ou vérification échoué. Réessayez avec le même fichier."):pending?(ar?"جارٍ التحقق…":"Vérification en cours…"):""}</p>
 </form>;
}
export function MediaInvestigationForm({executionId,locale}:{executionId:string;locale:"fr"|"ar"}){
 const initial:SocialVerificationState={status:"idle"};const [state,action,pending]=useActionState(requestMediaInvestigation,initial);const ar=locale==="ar";
 return <form action={action} className="space-y-3"><input type="hidden" name="executionId" value={executionId}/><input type="hidden" name="locale" value={locale}/><label className="block">{ar?"سبب التحقيق":"Motif de l’investigation"}<textarea name="reason" required minLength={20} maxLength={1000} className="mt-1 block w-full rounded border bg-background p-2"/></label><button disabled={pending} className="min-h-11 rounded border px-4">{ar?"فتح تحقيق وإعادة التحقق دون إرسال":"Ouvrir l’investigation et revérifier sans envoi"}</button><p role={state.status==="error"?"alert":"status"}>{state.status==="success"?(ar?"تم تسجيل المهمة. لا تؤكد النشر ولا تسمح بإعادة الإرسال.":"Tâche enregistrée. Elle ne confirme pas une publication et n’autorise aucun renvoi."):state.status==="error"?(ar?"تعذر تسجيل الطلب.":"Demande non enregistrée."):""}</p></form>;
}
