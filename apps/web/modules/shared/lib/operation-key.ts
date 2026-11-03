"use client";
import { useState,useSyncExternalStore } from "react";
const subscribe=()=>()=>{};
export function useOperationKey(){const [value,setValue]=useState(()=>crypto.randomUUID()),hydrated=useSyncExternalStore(subscribe,()=>true,()=>false);return[hydrated?value:"",()=>setValue(crypto.randomUUID())]as const}
