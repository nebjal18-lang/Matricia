/** Bound payment request bodies while reading, including chunked requests without Content-Length. */
export async function readPaymentJson(request:Request,maximumBytes:number):Promise<{ok:true;body:unknown}|{ok:false;status:400|413}> {
  const rawLength=request.headers.get("content-length");
  if(rawLength!==null){const n=Number(rawLength);if(!Number.isSafeInteger(n)||n<0||n>maximumBytes)return{ok:false,status:413};}
  if(!request.body)return{ok:false,status:400};
  const reader=request.body.getReader();const parts:Uint8Array[]=[];let size=0;
  try{for(;;){const{value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximumBytes){await reader.cancel();return{ok:false,status:413};}parts.push(value);}
    return{ok:true,body:JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(parts)))};
  }catch{return{ok:false,status:400};}finally{reader.releaseLock();}
}
export function paymentOriginAllowed(request:Request,appUrl:string):boolean {
  const supplied=request.headers.get("origin");if(!supplied)return false;
  try{return new URL(supplied).origin===new URL(appUrl).origin;}catch{return false;}
}
export const paymentResponseHeaders={"cache-control":"no-store"} as const;
