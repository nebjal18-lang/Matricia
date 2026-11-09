/** Only the configured HTTPS CMI origin may receive a browser payment form. */
export function paymentFormActionPolicy(env: Readonly<Record<string,string|undefined>>):string {
  const self="form-action 'self'";
  if(env.PAYMENT_PROVIDER?.trim().toUpperCase()!=="CMI")return self;
  try{
    const url=new URL(env.CMI_GATEWAY_URL?.trim()??"");
    const allowed=(env.CMI_GATEWAY_ALLOWED_HOSTS??"").split(",").map(value=>value.trim().toLowerCase());
    if(url.protocol!=="https:"||url.username||url.password||!allowed.includes(url.hostname.toLowerCase()))return self;
    return `${self} ${url.origin}`;
  }catch{return self;}
}
