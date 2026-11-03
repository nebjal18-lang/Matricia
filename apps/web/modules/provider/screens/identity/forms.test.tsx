import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { ClientProfileForm } from "@/modules/client/screens/onboarding/profile-form";
import { getClientOnboardingMessages } from "@/modules/client/screens/onboarding/messages";
import { saveProviderLegalProfile } from "./actions";
import { ProviderIdentitySubmitForm } from "./submit-form";
import { providerIdentityMessages } from "./messages";
const id = "a3500000-0000-4000-8000-000000000001";
describe("Provider legal identity FR/AR", () => {
  it.each(["fr","ar"] as const)("offers the canonical complete labelled profile in %s", locale => { const html=renderToStaticMarkup(<ClientProfileForm organizationId={id} locale={locale} idempotencyKey={id} profile={null} messages={getClientOnboardingMessages(locale)} saveAction={saveProviderLegalProfile} expectedProfileVersion={2}/>);for(const field of ["ifNumber","rcNumber","addressLine1","representativeFirstName","representativeLastName","representativePower","accuracyConfirmed","representationAuthorized"])expect(html).toContain(`name="${field}"`);expect(html).toContain('name="expectedProfileVersion" value="2"');expect(html).not.toContain('name="trial'); });
  it.each(["fr","ar"] as const)("requires an explicit confirmation for the exact version in %s", locale => { const html=renderToStaticMarkup(<ProviderIdentitySubmitForm organizationId={id} locale={locale} requestKey={id} version={2}/>);expect(html).toContain('name="confirmed"');expect(html).toContain('required');expect(html).toContain('name="organizationId"');expect(html).toContain(providerIdentityMessages(locale).review);expect(providerIdentityMessages(locale).errors.FORBIDDEN).toBeTruthy();expect(providerIdentityMessages(locale).privacy).not.toContain("Client Owner"); });
});
