"use client";
import{useState,useTransition}from"react";
import type{Locale}from"@/modules/shared/lib/i18n/locale";
import type{ConversationPage}from"./model";
import{loadAdminConversationPage}from"./actions";
export function AdminConversationMessages({threadId,locale,initial}:{threadId:string;locale:Locale;initial?:ConversationPage|null}){
 const[page,setPage]=useState(initial);const[error,setError]=useState(!initial);const[pending,start]=useTransition();const ar=locale==="ar";
 const older=()=>start(async()=>{const result=await loadAdminConversationPage(threadId,page?.nextCursor);if(result.status==="error"){setError(true);return;}setError(false);setPage({ ...result.page,messages:[...result.page.messages,...(page?.messages??[])]});});
 return <div>{error?<p role="alert">{ar?"المحادثة غير متاحة ضمن صلاحياتكم أو تعذر تحميلها.":"Conversation inaccessible avec vos droits ou indisponible."}</p>:null}{page?.hasMore?<button disabled={pending}onClick={older}>{ar?"تحميل الرسائل السابقة":"Charger les messages précédents"}</button>:null}<ul className="client-feed">{page?.messages.map((m)=><li key={m.id}><article><strong>{m.senderAlias}</strong><time>{m.createdAt}</time><p className="whitespace-pre-wrap">{m.body}</p>{m.attachments.length?<ul>{m.attachments.map((a)=><li key={a.id}>{a.name} · {a.scanStatus}{a.downloadReady?<a className="admin-soft-cta"href={`/api/admin/messages/attachments/${a.id}`}>{ar?"تحميل الوثيقة":"Télécharger la pièce"}</a>:null}</li>)}</ul>:null}</article></li>)}{page&&!page.messages.length?<li>{ar?"لا توجد رسالة مسجلة.":"Aucun message enregistré."}</li>:null}</ul></div>;
}
