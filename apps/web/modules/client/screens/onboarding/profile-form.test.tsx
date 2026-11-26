import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ saveClientProfile: vi.fn() }));
import { ClientProfileForm } from "./profile-form";
import { getClientOnboardingMessages } from "./messages";

it.each(["fr", "ar"] as const)("%s prevents edits before hydration can preserve the profile input", locale => {
  const html = renderToStaticMarkup(<ClientProfileForm organizationId="11111111-1111-4111-8111-111111111111" locale={locale} idempotencyKey="profile-test" profile={null} messages={getClientOnboardingMessages(locale)} />);
  const fieldsets = html.match(/<fieldset\b[^>]*>/gu) ?? [];
  expect(fieldsets.length).toBeGreaterThan(0);
  expect(fieldsets.every(tag => tag.includes('disabled=""'))).toBe(true);
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/u);
});
