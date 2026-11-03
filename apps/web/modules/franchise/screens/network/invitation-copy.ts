import type { Locale } from "@/modules/shared/lib/i18n/locale";

const copy = {
  fr: {
    explanation: "La demande crée une invitation traçable valable 30 jours et la place dans la file d’envoi. Le succès de ce formulaire ne confirme pas la remise d’un email. Aucun rôle ni droit économique n’est accordé.",
    queued: "Demandes d’envoi enregistrées", skipped: "Contacts déjà invités ou doublons ignorés", phone: "Téléphone du contact (facultatif)",
    language: "Langue de l’invitation", permission: "Je confirme pouvoir contacter ces destinataires dans le cadre de mon mandat.",
    mfa: "Un second facteur est requis pour demander l’envoi. Ouvrez la sécurité du compte, puis reprenez cette page.",
    session: "Votre session a expiré. Reconnectez-vous avant de demander un envoi.",
    unavailable: "La signature des liens d’invitation n’est pas configurée. Aucun envoi n’a été demandé.",
    rate: "La limite d’invitations de ce mandat est atteinte. Réessayez après la fenêtre de limitation.",
    submit: "Demander l’envoi de l’invitation", csv: "Demander l’envoi du lot", security: "Sécurité du compte",
  },
  ar: {
    explanation: "ينشئ الطلب دعوة قابلة للتتبّع صالحة لمدة 30 يوماً ويضعها في قائمة الإرسال. نجاح هذا النموذج لا يؤكّد تسليم البريد. لا تُمنح أي صلاحية أو حقوق مالية.",
    queued: "طلبات الإرسال المسجّلة", skipped: "جهات سبق دعوتها أو تكرارات تم تجاهلها", phone: "هاتف جهة الاتصال (اختياري)",
    language: "لغة الدعوة", permission: "أؤكّد إمكانية التواصل مع هؤلاء المستلمين في إطار تفويضي.",
    mfa: "يلزم عامل تحقق ثانٍ لطلب الإرسال. افتحوا أمان الحساب ثم عودوا إلى هذه الصفحة.",
    session: "انتهت جلستكم. سجّلوا الدخول قبل طلب الإرسال.",
    unavailable: "لم تُضبط حماية روابط الدعوات. لم يُطلب إرسال أي بريد.",
    rate: "تم بلوغ حد الدعوات لهذا التفويض. أعيدوا المحاولة بعد انتهاء فترة الحد.",
    submit: "طلب إرسال الدعوة", csv: "طلب إرسال الدفعة", security: "أمان الحساب",
  },
} as const;

export const networkInvitationCopy = (locale: Locale) => copy[locale];
