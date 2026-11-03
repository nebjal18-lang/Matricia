import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { ClientProfileForm } from "@/modules/client/screens/onboarding/profile-form";
import { getClientOnboardingMessages } from "@/modules/client/screens/onboarding/messages";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { providerContextReadState } from "@/modules/provider/data/spaces/organization-context";
import { ProviderReadState } from "@/modules/provider/ui/provider-read-state";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { saveProviderLegalProfile } from "@/modules/provider/screens/identity/actions";
import { providerLegalIdentitySchema } from "@/modules/provider/screens/identity/model";
import { providerIdentityMessages } from "@/modules/provider/screens/identity/messages";
import { ProviderIdentitySubmitForm } from "@/modules/provider/screens/identity/submit-form";
export default async function ProviderIdentityPage({ params, searchParams }: { params: Promise<{locale: string}>; searchParams: Promise<{organizationId?: string}> }) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/identite${query.organizationId ? `?organizationId=${encodeURIComponent(query.organizationId)}` : ""}` }));
  const m = providerIdentityMessages(locale), contextState = providerContextReadState(space, query.organizationId);
  const result = !contextState && space.selectedOrganizationId ? await (await getSupabaseServerClient()).rpc("get_my_provider_legal_identity_v1", {p_organization_id: space.selectedOrganizationId}) : null;
  const parsed = providerLegalIdentitySchema.safeParse(result?.data), data = !result?.error && parsed.success ? parsed.data : null;
  const failure = contextState ?? (result?.error?.code === "42501" ? "forbidden" : "unavailable");
  const queryString = space.selectedQuery, route = `/${locale}/sous-traitant/identite${queryString}`, qualification = `/${locale}/sous-traitant/qualification${queryString}`, profileCopy = getClientOnboardingMessages(locale);
  return <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={queryString} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="qualify" languagePath={route} title={m.title} lead={m.lead}>
    {!data ? <ProviderReadState locale={locale} state={failure} retryHref={route}/> : <div className="client-stack">
      <section className="client-card client-stack"><h2>{data.legal_name}</h2><p><bdi>ICE {data.ice}</bdi></p><p>{m.privacy}</p><p role="status">{data.currently_verified ? m.verified : data.submission?.profile_version === data.profile_version ? m.sent : m.draft}</p><dl><div><dt>{m.version}</dt><dd>{data.profile_version || m.noProfile}</dd></div>{data.submission ? <div><dt>{m.submitted}</dt><dd>{data.submission.profile_version}</dd></div> : null}</dl><Link href={`${qualification}#documents`} className="client-text-link min-h-11">{m.documents}</Link></section>
      <section className="client-card client-stack"><h2>{m.profile}</h2>{data.case_status === "VERIFIED" || data.case_status === "SUSPENDED" || data.case_status === "UNDER_REVIEW" || data.case_status === "RESPONSE_RECEIVED" ? <><p>{m.revision}</p><Link href={`/${locale}/sous-traitant/messages${queryString}`} className="client-text-link min-h-11">{m.contact}</Link></> : <ClientProfileForm organizationId={data.organization_id} locale={locale} idempotencyKey={randomUUID()} profile={data.profile} messages={{...profileCopy, profileErrors: {...profileCopy.profileErrors, generic: m.saveError}}} saveAction={saveProviderLegalProfile} expectedProfileVersion={data.profile_version}/>}</section>
      <section className="client-card client-stack"><h2>{m.review}</h2>{!data.profile_version || !data.provider_profile_ready ? <Link href={qualification} className="client-text-link min-h-11">{m.qualification}</Link> : data.submission?.profile_version === data.profile_version ? <p role="status">{m.already}</p> : <ProviderIdentitySubmitForm organizationId={data.organization_id} locale={locale} version={data.profile_version} requestKey={randomUUID()}/>}</section>
    </div>}
  </ProviderAppShell>;
}
