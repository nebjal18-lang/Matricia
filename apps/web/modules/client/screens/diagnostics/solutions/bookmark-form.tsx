"use client";
import { useActionState } from "react";
import { saveBookmark, type BookmarkState } from "./bookmark-action";
export function BookmarkForm({locale,id,saved}:{locale:"fr"|"ar";id:string;saved:boolean}) {
 const[state,action,pending]=useActionState(saveBookmark,{status:'idle'}as BookmarkState);
 return <form action={action}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={id}/><input type="hidden" name="saved" value={saved?'false':'true'}/><button className="diag-conn-btn-outline" disabled={pending}>{locale==='fr'?(saved?'Retirer des éléments enregistrés':'Enregistrer pour plus tard'):(saved?'إزالة من المحفوظات':'حفظ لوقت لاحق')}</button>{state.status==='error'?<p role="alert">{locale==='fr'?'Impossible de modifier la sélection. Réessayez.':'تعذر تعديل الاختيار. حاولوا مجدداً.'}</p>:state.status==='success'?<p role="status">{locale==='fr'?'Sélection enregistrée sur votre compte.':'تم حفظ الاختيار في حسابكم.'}</p>:null}</form>;
}
