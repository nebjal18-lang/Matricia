"use client";

import type { EmailOtpLength } from "@/modules/shared/lib/auth/otp-config";
import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { OtpForm } from "../../connexion/otp-form";

export function InscriptionConsent({ locale, nextPath, otpLength = 6 }: { locale: Locale; nextPath: string; otpLength?: EmailOtpLength }) {
  const [accepted, setAccepted] = useState(false);
  const fr = locale === "fr";
  return (
    <div className="mt-6">
      <label className="flex items-start gap-3 text-sm leading-6">
        <input type="checkbox" className="mt-1 size-4" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
        <span>
          {fr ? "J’accepte les" : "أوافق على"}{" "}
          <Link className="underline" href={`/${locale}/conditions`}>{fr ? "Conditions d’utilisation" : "شروط الاستخدام"}</Link>
          {fr ? " et la " : " و "}
          <Link className="underline" href={`/${locale}/confidentialite`}>{fr ? "Politique de confidentialité" : "سياسة الخصوصية"}</Link>
          {fr ? " de Matricia." : " لدى ماتريسيا."}
        </span>
      </label>
      {accepted ? (
        <div className="mt-6">
          <OtpForm otpLength={otpLength} locale={locale} nextPath={nextPath} intent="registration" consentAccepted={accepted} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-600">{fr ? "Acceptez les conditions pour continuer par code sécurisé." : "اقبلوا الشروط للمتابعة برمز آمن."}</p>
      )}
    </div>
  );
}
