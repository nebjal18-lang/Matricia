import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ advanceReferral: vi.fn(), calculateRoi: vi.fn(), createReferralLink: vi.fn(), decideBaseline: vi.fn(), submitBaseline: vi.fn(), recordSavings: vi.fn() }));
import { BaselineSubmissionForm, ConversionForm, ReferralLinkForm, RoiForm, SavingsForm } from "./value-forms";
import { getValueMessages } from "./messages";
import { evidenceSourceLabel } from "./value-forms-labels";
import { audienceTypeLabel, conversionStageLabel } from "./value-display-labels";

describe("I18N-02 business labels retain submitted codes", () => {
  it.each(["fr", "ar"] as const)("renders every option and transition in %s", locale => {
    const props = { locale, organizationId: "org", keyValue: "key", m: getValueMessages(locale), documents: [] };
    const referral = renderToStaticMarkup(<ReferralLinkForm {...props} />);
    for (const code of ["CLIENT", "PROVIDER"]) expect(referral).toContain(`value="${code}">${audienceTypeLabel(locale, code)}</option>`);
    for (const stage of ["PROFILE_STARTED", "VERIFIED", "ACTIVE"] as const) {
      const html = renderToStaticMarkup(<ConversionForm {...props} id="conversion" rowVersion={1} toStage={stage} />);
      expect(html).toContain(`name="toStage" value="${stage}"`);
      expect(html).toContain(conversionStageLabel(locale, stage));
      expect(html).not.toContain(`→ ${stage}`);
    }
    const forms = [
      <BaselineSubmissionForm key="baseline" {...props} context={{ organization_id: "org", subjects: [], documents: [] }} />,
      <RoiForm key="roi" {...props} baselines={[]} recommendations={[]} />,
      <SavingsForm key="savings" {...props} baselines={[]} />,
    ];
    for (const form of forms) {
      const html = renderToStaticMarkup(form);
      for (const source of ["INVOICE", "CONTRACT", "ACCOUNTING_EXPORT", "METER_READING", "SIGNED_REPORT", "AUDITED_IMPORT"]) {
        expect(html).toContain(`value="${source}">${evidenceSourceLabel(locale, source)}</option>`);
        expect(evidenceSourceLabel(locale, source)).not.toMatch(/\?/);
      }
    }
  });
});
