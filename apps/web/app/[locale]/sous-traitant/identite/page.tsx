import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ClientProfileForm } from "@/modules/client/screens/onboarding/profile-form";
import { getClientOnboardingMessages } from "@/modules/client/screens/onboarding/messages";
import { saveProviderLegalProfile } from "@/modules/provider/screens/identity/actions";
import { providerIdentityMessages } from "@/modules/provider/screens/identity/messages";
import { providerLegalIdentitySchema } from "@/modules/provider/screens/identity/model";
import { ProviderIdentitySubmitForm } from "@/modules/provider/screens/identity/submit-form";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { providerContextReadState } from "@/modules/provider/data/spaces/organization-context";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { ProviderReadState } from "@/modules/provider/ui/provider-read-state";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { OrganizationIdentityBlock } from "@/modules/shared/ui/organization-identity";

export default async function ProviderIdentityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") {
    redirect(
      connexionHref(locale, {
        next: `/${locale}/sous-traitant/identite${
          query.organizationId ? `?organizationId=${encodeURIComponent(query.organizationId)}` : ""
        }`,
      }),
    );
  }

  const m = providerIdentityMessages(locale);
  const contextState = providerContextReadState(space, query.organizationId);
  const result =
    !contextState && space.selectedOrganizationId
      ? await (
          await getSupabaseServerClient()
        ).rpc("get_my_provider_legal_identity_v1", {
          p_organization_id: space.selectedOrganizationId,
        })
      : null;
  const parsed = providerLegalIdentitySchema.safeParse(result?.data);
  const data = !result?.error && parsed.success ? parsed.data : null;
  const failure =
    contextState ?? (result?.error?.code === "42501" ? "forbidden" : "unavailable");
  const queryString = space.selectedQuery;
  const route = `/${locale}/sous-traitant/identite${queryString}`;
  const qualification = `/${locale}/sous-traitant/qualification${queryString}`;
  const profileCopy = getClientOnboardingMessages(locale);

  return (
    <ProviderAppShell
      locale={locale}
      organizations={space.organizations}
      selectedQuery={queryString}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="company"
      languagePath={route}
      title={m.title}
      lead={m.lead}
      sceneHero
    >
      {!data ? (
        <ProviderReadState locale={locale} state={failure} retryHref={route} />
      ) : (
        <div className="client-stack">
          <header className="client-card mat-hero" data-tone="mint">
            <h2>{data.legal_name}</h2>
            <p>{m.privacy}</p>
            <div className="mat-status-row" role="status">
              <span
                className="admin-status"
                data-tone={
                  data.currently_verified
                    ? "ok"
                    : data.submission?.profile_version === data.profile_version
                      ? "sky"
                      : "warn"
                }
              >
                {data.currently_verified
                  ? m.verified
                  : data.submission?.profile_version === data.profile_version
                    ? m.sent
                    : m.draft}
              </span>
              <span className="admin-status" data-tone="violet">
                {m.version} {data.profile_version || m.noProfile}
              </span>
              {data.ice ? (
                <span className="admin-status" data-tone="neutral" dir="ltr">
                  ICE {data.ice}
                </span>
              ) : null}
            </div>
            <Link href={`${qualification}#documents`} className="client-text-link min-h-11">
              {m.documents}
            </Link>
          </header>

          {data.profile ? (
            <OrganizationIdentityBlock
              locale={locale}
              idPrefix="provider-self-identity"
              identity={{
                legalName: data.legal_name,
                displayName: data.legal_name,
                countryCode: data.profile.registered_address?.country_code ?? "MA",
                legalForm: data.profile.legal_form,
                incorporationDate: data.profile.incorporation_date,
                activity: data.profile.activity,
                sector: data.profile.sector,
                registeredCity: data.profile.registered_city,
                registeredAddress: data.profile.registered_address ? {...data.profile.registered_address, postal_code: data.profile.registered_address.postal_code ?? null} : null,
                identifiers: {
                  ICE: data.ice,
                  IF: data.profile.if_number,
                  RC: data.profile.rc_number,
                },
                representative: data.profile.representative,
              }}
            />
          ) : null}

          <section className="client-card" data-tone="sky">
            <header>
              <h2>{m.profile}</h2>
            </header>
            {data.case_status === "VERIFIED" ||
            data.case_status === "SUSPENDED" ||
            data.case_status === "UNDER_REVIEW" ||
            data.case_status === "RESPONSE_RECEIVED" ? (
              <>
                <p>{m.revision}</p>
                <Link
                  href={`/${locale}/sous-traitant/messages${queryString}`}
                  className="client-text-link min-h-11"
                >
                  {m.contact}
                </Link>
              </>
            ) : (
              <ClientProfileForm
                organizationId={data.organization_id}
                locale={locale}
                idempotencyKey={randomUUID()}
                profile={data.profile}
                messages={{
                  ...profileCopy,
                  profileErrors: { ...profileCopy.profileErrors, generic: m.saveError },
                }}
                saveAction={saveProviderLegalProfile}
                expectedProfileVersion={data.profile_version}
              />
            )}
          </section>

          <section className="client-card" data-tone="peach">
            <header>
              <h2>{m.review}</h2>
            </header>
            {!data.profile_version || !data.provider_profile_ready ? (
              <Link href={qualification} className="client-text-link min-h-11">
                {m.qualification}
              </Link>
            ) : data.submission?.profile_version === data.profile_version ? (
              <p role="status">{m.already}</p>
            ) : (
              <ProviderIdentitySubmitForm
                organizationId={data.organization_id}
                locale={locale}
                version={data.profile_version}
                requestKey={randomUUID()}
              />
            )}
          </section>
        </div>
      )}
    </ProviderAppShell>
  );
}
