"use client";

import { useActionState } from "react";
import { Button } from "@/modules/shared/ui/button";
import { useOperationKey } from "@/modules/shared/lib/operation-key";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { submitMissionFeedback, type MissionActionState } from "./actions";
import type { MissionFeedbackFacts } from "./feedback-facts";

const idle: MissionActionState = { status: "idle" };
const criteria = [
  ["COMMUNICATION", "Communication", "التواصل"],
  ["PROFESSIONALISM", "Professionnalisme", "الاحتراف"],
  ["VALUE", "Valeur", "القيمة"],
] as const;

export function MissionFeedbackPanel({
  locale,
  missionId,
  missionStatus,
  facts,
}: {
  locale: Locale;
  missionId: string;
  missionStatus: string;
  facts: MissionFeedbackFacts | null;
}) {
  const fr = locale === "fr";
  if (missionStatus !== "COMPLETED") {
    return <section className="client-card" aria-labelledby="mission-feedback-title"><h2 id="mission-feedback-title">{fr ? "Noter la prestation" : "تقييم الخدمة"}</h2><p role="status">{fr ? "La notation s’ouvre lorsque la mission est terminée, après la réception du livrable." : "يفتح التقييم عند اكتمال المهمة، بعد استلام التسليم."}</p></section>;
  }
  if (!facts || facts.status === "blocked") {
    const reason = facts?.status === "blocked" ? facts.reason : "UNAVAILABLE";
    const text = reason === "NO_ACCEPTANCE"
      ? (fr ? "La notation attend une réception enregistrée sur le livrable accepté." : "ينتظر التقييم استلاماً مسجلاً على التسليم المقبول.")
      : reason === "NO_CHECKLIST"
        ? (fr ? "La notation attend la checklist de mission. Elle n’a pas été publiée sur ce dossier." : "ينتظر التقييم قائمة تحقق المهمة. لم تُنشر على هذا الملف.")
        : (fr ? "La notation est momentanément indisponible. Réessayez." : "التقييم غير متاح مؤقتاً. أعيدوا المحاولة.");
    return <section className="client-card" aria-labelledby="mission-feedback-title"><h2 id="mission-feedback-title">{fr ? "Noter la prestation" : "تقييم الخدمة"}</h2><p role="status">{text}</p></section>;
  }
  return <FeedbackForm locale={locale} missionId={missionId} quality={facts.quality} compliance={facts.compliance} />;
}

function FeedbackForm({ locale, missionId, quality, compliance }: { locale: Locale; missionId: string; quality: number; compliance: number }) {
  const fr = locale === "fr";
  const [state, action, pending] = useActionState(submitMissionFeedback, idle);
  const [key] = useOperationKey();
  const percent = (bps: number) => {
    const whole = Math.trunc(bps / 100);
    const decimals = String(Math.abs(bps % 100)).padStart(2, "0");
    return decimals === "00" ? `${whole}` : `${whole},${decimals}`;
  };
  return <section className="client-card" aria-labelledby="mission-feedback-title"><h2 id="mission-feedback-title">{fr ? "Noter la prestation" : "تقييم الخدمة"}</h2><p>{fr ? "La qualité et la conformité viennent de la réception et de la checklist. Vous notez la communication, le professionnalisme et la valeur, de 1 à 5." : "تُؤخذ الجودة والامتثال من الاستلام وقائمة التحقق. تقيّمون التواصل والاحتراف والقيمة من 1 إلى 5."}</p><p dir="ltr">{fr ? "Qualité" : "الجودة"} {percent(quality)} % · {fr ? "Conformité" : "الامتثال"} {percent(compliance)} %</p><form action={action} className="mt-4 space-y-4"><input type="hidden" name="locale" value={locale} /><input type="hidden" name="missionId" value={missionId} /><input type="hidden" name="idempotencyKey" value={key} />{criteria.map(([name, french, arabic]) => <fieldset key={name}><legend>{fr ? french : arabic}</legend><div className="flex flex-wrap gap-3">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="inline-flex min-h-11 items-center gap-2"><input type="radio" name={name} value={value} required /><span dir="ltr">{value}</span></label>)}</div></fieldset>)}<Button disabled={pending || !key} className="min-h-11">{pending ? (fr ? "Enregistrement…" : "جارٍ الحفظ…") : (fr ? "Enregistrer la note" : "حفظ التقييم")}</Button>{state.status === "success" ? <p role="status">{fr ? "La note est enregistrée." : "تم حفظ التقييم."}</p> : null}{state.status === "error" ? <p role="alert">{state.reason === "VALIDATION" ? (fr ? "Vérifiez les trois notes." : "تحققوا من التقييمات الثلاثة.") : state.reason === "NOT_READY" ? (fr ? "La mission n’est pas encore notée : la réception ou la checklist a changé. Rechargez la page." : "لا يمكن تقييم المهمة بعد: تغيّر الاستلام أو قائمة التحقق. أعيدوا تحميل الصفحة.") : state.reason === "FORBIDDEN" ? (fr ? "Votre rôle ne permet pas de noter cette prestation." : "دوركم لا يسمح بتقييم هذه الخدمة.") : (fr ? "La note n’a pas été enregistrée. Rechargez la page avant de réessayer." : "لم يُحفظ التقييم. أعيدوا تحميل الصفحة قبل المحاولة.")}</p> : null}</form></section>;
}
