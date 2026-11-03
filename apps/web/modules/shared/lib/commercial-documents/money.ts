/** Exact ISO-currency decimal serialization for immutable commercial documents. */
export function formatMinorDecimal(value:string,currency:string):string{
 if(!/^\d+$/.test(value)||!/^[A-Z]{3}$/.test(currency))throw new Error("INVALID_DOCUMENT_AMOUNT");
 const options=new Intl.NumberFormat("fr-MA",{style:"currency",currency}).resolvedOptions(),digits=options.maximumFractionDigits??options.minimumFractionDigits??2;
 const scale=BigInt(10)**BigInt(digits),amount=BigInt(value),whole=amount/scale;
 return digits?`${whole}.${(amount%scale).toString().padStart(digits,"0")}`:whole.toString();
}

/** Exact signed presentation, including zero/three-decimal currencies and the locale's sign position. */
export function formatSignedMinorLocalized(value:string,currency:string,locale:"fr"|"ar"):string{
 if(!/^-?\d+$/u.test(value)||!/^[A-Z]{3}$/u.test(currency))throw new Error("INVALID_DOCUMENT_AMOUNT");
 const amount=BigInt(value),absolute=amount<BigInt(0)?-amount:amount,tag=locale==="ar"?"ar-MA":"fr-MA",formatter=new Intl.NumberFormat(tag,{style:"currency",currency}),digits=formatter.resolvedOptions().maximumFractionDigits??2,scale=BigInt(10)**BigInt(digits);
 const integer=new Intl.NumberFormat(tag,{maximumFractionDigits:0}).format(absolute/scale),digitFormatter=new Intl.NumberFormat(tag,{useGrouping:false,maximumFractionDigits:0});
 const fraction=(absolute%scale).toString().padStart(digits,"0").replace(/\d/gu,digit=>digitFormatter.format(Number(digit)));
 return formatter.formatToParts(amount<BigInt(0)?-0:0).map(part=>part.type==="integer"?integer:part.type==="fraction"?fraction:part.value).join("");
}
