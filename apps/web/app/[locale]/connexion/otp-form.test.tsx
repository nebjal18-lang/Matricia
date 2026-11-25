import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/shared/lib/i18n/dictionaries", async () => await import("@/modules/shared/lib/i18n/dictionaries"));
vi.mock("@/modules/shared/lib/auth/otp", () => ({
  normalizeEmail: (value: string) => value.trim().toLowerCase(),
  normalizeOtp: (value: string) => value,
  applyOtpDigits: (current: string, index: number, raw: string) => `${current.slice(0, index)}${raw}${current.slice(index + 1)}`,
}));
vi.mock("@/modules/shared/ui/button", () => ({ Button: ({ children, variant, ...props }: ComponentPropsWithoutRef<"button"> & { variant?: string }) => <button data-variant={variant} {...props}>{children}</button> }));
vi.mock("@/modules/shared/ui/input", () => ({ Input: (props: ComponentPropsWithoutRef<"input">) => <input {...props} /> }));
vi.mock("@/modules/shared/ui/label", () => ({ Label: ({ children, ...props }: ComponentPropsWithoutRef<"label">) => <label {...props}>{children}</label> }));
vi.mock("./actions", () => ({ requestOtp: vi.fn(), completeEmailLogin: vi.fn(), completePasswordLogin: vi.fn() }));

import { OtpForm } from "./otp-form";

describe("OtpForm", () => {
  it("propose les connexions OTP et mot de passe sans exposer de compte", () => {
    const html = renderToStaticMarkup(<OtpForm locale="fr" />);
    expect(html).toContain("Code par courriel");
    expect(html).toContain("Mot de passe");
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("Admin");
  });

  it("rend le sélecteur de connexion en arabe", () => {
    const html = renderToStaticMarkup(<div dir="rtl" lang="ar"><OtpForm locale="ar" /></div>);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("رمز عبر البريد");
    expect(html).toContain("كلمة المرور");
  });

  it("rend le formulaire OTP dans le parcours d’inscription", () => {
    const html = renderToStaticMarkup(<OtpForm locale="fr" intent="registration" nextPath="/fr/organisation" />);
    expect(html).toContain("Recevoir mon code");
    expect(html).toContain('autoComplete="email"');
  });
});
