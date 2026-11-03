"use client";
import { useEffect } from "react";
export function useUnsavedChanges(dirty:boolean,locale:"fr"|"ar"){
 useEffect(()=>{
  if(!dirty)return;
  const unload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
  const navigate=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const element=event.target instanceof Element?event.target.closest("a[href]"):null;
   if(!(element instanceof HTMLAnchorElement)||element.target==="_blank"||element.hasAttribute("download"))return;
   const next=new URL(element.href,window.location.href),current=new URL(window.location.href);
   if(next.origin!==current.origin||(next.pathname===current.pathname&&next.search===current.search))return;
   if(!window.confirm(locale==="ar"?"لديكم تعديلات غير محفوظة. هل تريدون مغادرة هذه الصفحة؟":"Des modifications ne sont pas enregistrées. Quitter cette page ?")){event.preventDefault();event.stopPropagation();}
  };
  window.addEventListener("beforeunload",unload);document.addEventListener("click",navigate,true);
  return()=>{window.removeEventListener("beforeunload",unload);document.removeEventListener("click",navigate,true);};
 },[dirty,locale]);
}
