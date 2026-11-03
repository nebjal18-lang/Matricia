import{getServerTimestamp}from"@/modules/shared/lib/time/server-clock";
import{notFound,redirect}from"next/navigation";
import{z}from"zod";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{connexionHref}from"@/modules/shared/lib/auth/connexion-href";
import{resolveClientSpace}from"@/modules/client/data/spaces/context";
import{ClientAppShell}from"@/modules/client/ui/client-app-shell";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{WorkspaceFailure}from"@/modules/shared/ui/workspace-failure";
import{BenefitLifecyclePanel}from"@/modules/client/screens/boxes/lifecycle/panel";
import{lifecycleSchema}from"@/modules/client/screens/boxes/lifecycle/model";
import{lifecycleMessages}from"@/modules/client/screens/boxes/lifecycle/messages";
export default async function BenefitLifecyclePage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{organizationId?:string;after?:string;waitAfter?:string;offerAfter?:string}>}){
 const[{locale},query]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();const p=z.object({organizationId:z.string().uuid().optional(),after:z.string().uuid().optional(),waitAfter:z.string().uuid().optional(),offerAfter:z.string().uuid().optional()}).safeParse(query);if(!p.success)notFound();
 const space=await resolveClientSpace({locale,organizationId:p.data.organizationId}),next=`/${locale}/client/avantages/execution${space.selectedQuery}`;if(space.status==="unauthenticated")redirect(connexionHref(locale,{next}));
 const c=await getSupabaseServerClient(),r=await c.rpc("get_client_benefit_lifecycle_v1",{p_organization_id:space.selectedOrganizationId,p_after:p.data.after??null,p_wait_after:p.data.waitAfter??null,p_offer_after:p.data.offerAfter??null}),data=lifecycleSchema.safeParse(r.data),m=lifecycleMessages(locale);
 return <ClientAppShell locale={locale}selectedQuery={space.selectedQuery}selectedOrganizationId={space.selectedOrganizationId}userEmail={space.userEmail}organizationName={space.organizationName}active="memberBoxes"title={m.title}lead={m.lead}kicker="Matricia"><main className="client-page">{r.error||!data.success||data.data.organization_id!==space.selectedOrganizationId?<WorkspaceFailure locale={locale}reason={r.error?.code==="42501"?"FORBIDDEN":"UNAVAILABLE"}returnPath={next}supportReference="CLIENT-BENEFIT-EXECUTION"/>:<BenefitLifecyclePanel data={data.data}locale={locale}now={getServerTimestamp()}/>}</main></ClientAppShell>;
}
