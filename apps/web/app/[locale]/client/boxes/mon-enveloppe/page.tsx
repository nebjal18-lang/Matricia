import{notFound,redirect}from"next/navigation";
import{z}from"zod";
import{isLocale}from"@/modules/shared/lib/i18n/locale";
import{connexionHref}from"@/modules/shared/lib/auth/connexion-href";
import{resolveClientSpace}from"@/modules/client/data/spaces/context";
import{ClientAppShell}from"@/modules/client/ui/client-app-shell";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{WorkspaceFailure}from"@/modules/shared/ui/workspace-failure";
import{MemberBoxPanel}from"@/modules/client/screens/boxes/member/panel";
import{memberBoxWorkspaceSchema}from"@/modules/client/screens/boxes/member/model";
import{memberBoxMessages}from"@/modules/client/screens/boxes/member/messages";
export default async function MemberBoxPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{organizationId?:string;after?:string}>}){
 const[{locale},query]=await Promise.all([params,searchParams]);if(!isLocale(locale))notFound();
 const parsed=z.object({organizationId:z.string().uuid().optional(),after:z.string().uuid().optional()}).safeParse(query);if(!parsed.success)notFound();
 const space=await resolveClientSpace({locale,organizationId:parsed.data.organizationId});
 const next=`/${locale}/client/boxes/mon-enveloppe${parsed.data.organizationId?`?organizationId=${parsed.data.organizationId}`:""}`;
 if(space.status==="unauthenticated")redirect(connexionHref(locale,{next}));
 const c=await getSupabaseServerClient(),response=await c.rpc("get_my_box_workspace_v1",{p_organization_id:space.selectedOrganizationId,p_after:parsed.data.after??null,p_limit:25});
 const data=memberBoxWorkspaceSchema.safeParse(response.data),m=memberBoxMessages(locale);
 return <ClientAppShell locale={locale}selectedQuery={space.selectedQuery}selectedOrganizationId={space.selectedOrganizationId}userEmail={space.userEmail}organizationName={space.organizationName}active="memberBoxes"title={m.title}lead={m.lead}kicker="Matricia"><main className="client-page">{response.error||!data.success||data.data.organization_id!==space.selectedOrganizationId?<WorkspaceFailure locale={locale}reason={response.error?.code==="42501"?"FORBIDDEN":"UNAVAILABLE"}returnPath={next}supportReference="CLIENT-MEMBER-BOX"/>:<MemberBoxPanel locale={locale}data={data.data}/>}</main></ClientAppShell>;
}
