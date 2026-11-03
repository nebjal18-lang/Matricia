import type {Metadata} from "next";
import {randomUUID} from "node:crypto";
import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {z} from "zod";
import {isLocale} from "@/modules/shared/lib/i18n/locale";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {connexionHref} from "@/modules/shared/lib/auth/connexion-href";
import {readAllPages} from "@/modules/shared/lib/data/read-pages";
import {ReferralClaimForm} from "./claim-form";
import {claimMessages} from "./messages";
export const metadata:Metadata={robots:{index:false,follow:false}};
export default async function ReferralClaimPage({params}:{params:Promise<{locale:string;code:string}>}){
 const {locale,code:rawCode}=await params;
 const code=rawCode.toUpperCase();
 if(!isLocale(locale)||!/^[A-Z0-9][A-Z0-9_-]{7,63}$/u.test(code))notFound();
 const client=await getSupabaseServerClient(),auth=await client.auth.getUser();
 const next=`/${locale}/invitation/${code}`;
 if(!auth.data.user&&!auth.error)redirect(connexionHref(locale,{next}));
 const m=claimMessages(locale);let organizations:{id:string;name:string}[]=[];let unavailable=!!auth.error;
 if(auth.data.user&&!unavailable){
  const members=await readAllPages((from,to)=>client.from("organization_memberships").select("id,organization_id,organizations!inner(display_name)").eq("user_id",auth.data.user!.id).eq("status","ACTIVE").order("id").range(from,to));
  const parsed=z.array(z.object({id:z.string().uuid(),organization_id:z.string().uuid(),organizations:z.object({display_name:z.string()})})).safeParse(members.data);
  if(members.error||!parsed.success)unavailable=true;
  else if(parsed.data.length){
   const ids=parsed.data.map(member=>member.id);
   const roles=await readAllPages((from,to)=>client.from("organization_member_roles").select("membership_id").in("membership_id",ids).in("role_code",["CLIENT_OWNER","CLIENT_ADMIN"]).is("revoked_at",null).order("membership_id").order("role_code").order("library_id",{nullsFirst:true}).order("franchise_id",{nullsFirst:true}).range(from,to));
   const validated=z.array(z.object({membership_id:z.string().uuid()})).safeParse(roles.data);
   if(roles.error||!validated.success)unavailable=true;
   else {const allowed=new Set(validated.data.map(role=>role.membership_id));organizations=parsed.data.filter(member=>allowed.has(member.id)).map(member=>({id:member.organization_id,name:member.organizations.display_name}));}
  }
 }
 return <main id="contenu-principal" className="mx-auto w-full max-w-2xl space-y-6 px-4 py-12"><h1 className="text-3xl font-semibold">{m.title}</h1><p>{m.lead}</p>{unavailable?<p role="alert">{m.unavailable}</p>:organizations.length?<ReferralClaimForm locale={locale} code={code} organizations={organizations} idempotencyKey={randomUUID()} m={m}/>:<p>{m.noOrganization}</p>}<nav className="flex flex-wrap gap-5"><Link className="min-h-11 underline" href={`/${locale}/organisation?${new URLSearchParams({role:"client",next})}`}>{m.create}</Link><Link className="min-h-11 underline" href={`/${locale}/client/accueil`}>{m.resume}</Link></nav></main>;
}
