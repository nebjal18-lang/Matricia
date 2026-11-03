import Link from"next/link";
import{classifyCommandFailure}from"@/modules/shared/lib/auth/command-failure";
import{notFound}from"next/navigation";
import{z}from"zod";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{sensitivePageContext}from"@/modules/admin/ui/sensitive-page-context";
import{ReferralRewardQueuePanel}from"@/modules/admin/screens/referral-rewards/panel";
import{referralRewardQueueSchema}from"@/modules/admin/screens/referral-rewards/model";
import{referralRewardMessages}from"@/modules/admin/screens/referral-rewards/messages";
export default async function ReferralRewardsPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{page?:string}>}){
 const[{locale},query]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();
 const parsed=z.coerce.number().int().min(1).max(100000).safeParse(query.page??1);if(!parsed.success)notFound();const page=parsed.data,m=referralRewardMessages(locale);
 const context=await sensitivePageContext({locale,active:"finance",path:`finance/recompenses?page=${page}`,title:m.title,lead:m.lead,roles:["SUPER_ADMIN","MATRICIA_ADMIN","FINANCE_MANAGER","COMPLIANCE_MANAGER"]});
 if(context.status==="blocked")return context.view;
 const response=await context.access.client.rpc("list_admin_client_referral_reward_queue_v1",{p_page:page,p_limit:25});
 const data=response.error?null:referralRewardQueueSchema.safeParse(response.data),failure=response.error?classifyCommandFailure(response.error):null;
 const errorText=failure==="FORBIDDEN"?m.forbidden:failure==="MFA_REQUIRED"?m.mfa:failure==="UNAUTHENTICATED"?m.unauthenticated:m.unavailable;
 return context.wrap(<main className="client-page space-y-5"><Link className="min-h-11 underline" href={`/${locale}/administration/finance`}>{m.back}</Link>{data?.success?<ReferralRewardQueuePanel locale={locale} data={data.data} m={m}/>:<section className="admin-panel space-y-3"><p role="alert">{errorText}</p>{failure==="MFA_REQUIRED"?<Link className="underline" href={`/${locale}/securite/compte`}>{m.security}</Link>:failure==="UNAUTHENTICATED"?<Link className="underline" href={`/${locale}/connexion?next=${encodeURIComponent(context.selfPath)}`}>{m.unauthenticated}</Link>:null}<Link className="underline" href={`/${locale}/administration/finance/recompenses?page=${page}`}>{m.retry}</Link><p>{m.reference}</p></section>}</main>);
}
