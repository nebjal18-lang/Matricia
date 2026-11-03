import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { IdentityError } from "./model";
const fr = {
  title: "Identité juridique de votre entreprise", lead: "Complétez le profil commun de votre organisation, ajoutez les pièces puis soumettez la version exacte à une revue indépendante.",
  privacy: "Les données du représentant sont réservées aux responsables Provider autorisés et à l’équipe conformité. Ce parcours n’active aucun rôle ni essai Client.",
  profile: "Profil juridique versionné", documents: "Ajouter les pièces légale, fiscale et d’assurance", qualification: "Compléter le profil et les pièces de qualification", review: "Soumettre à la revue indépendante", confirm: "Je confirme l’exactitude du profil et des pièces déposées pour cette version.", pending: "Soumission…", sent: "Version transmise. L’équipe conformité doit vérifier les pièces et l’identité courante ; aucune validation automatique n’est effectuée.",
  verified: "L’identité courante et ses pièces ont été vérifiées par un responsable indépendant.", draft: "Profil à compléter puis à soumettre.", submitted: "Version soumise", version: "Version actuelle", noProfile: "Aucune version juridique n’a encore été enregistrée.",
  revision: "Cette identité commune est déjà validée dans un autre parcours. Pour modifier ses données juridiques ou ses identifiants, demandez une révision contrôlée à l’équipe conformité.", contact: "Contacter l’équipe conformité", already: "Cette version a été soumise. Une nouvelle version conserve l’historique et exige une nouvelle revue.",
  saveError: "La version n’a pas pu être enregistrée. Rechargez le dossier, vérifiez vos droits et demandez une révision contrôlée si les identifiants ou un profil déjà validé doivent changer.",
  errors: { VALIDATION: "Vérifiez les champs et confirmez la version à soumettre.", UNAUTHENTICATED: "Votre session a expiré. Reconnectez-vous.", FORBIDDEN: "Votre rôle ne permet pas cette action dans cette organisation.", CONFLICT: "Le dossier a changé. Rechargez et vérifiez sa version courante.", DOCUMENTS_REQUIRED: "Complétez le profil Provider et déposez les trois pièces requises depuis la qualification avant de soumettre.", FAILED: "La soumission n’a pas pu être confirmée. Rechargez le dossier avant de réessayer." } satisfies Record<IdentityError, string>,
};
const ar: typeof fr = {
  title: "الهوية القانونية لمؤسستكم", lead: "أكملوا الملف المشترك للمؤسسة وأضيفوا الوثائق ثم أرسلوا النسخة المحددة إلى مراجعة مستقلة.",
  privacy: "تقتصر بيانات الممثل على مسؤولي مقدم الخدمة المخولين وفريق الامتثال. لا يفعّل هذا المسار أي دور أو فترة تجريبية للعميل.",
  profile: "الملف القانوني بنسخه المحفوظة", documents: "إضافة الوثائق القانونية والضريبية والتأمينية", qualification: "إكمال ملف التأهيل ووثائقه", review: "إرسال إلى المراجعة المستقلة", confirm: "أؤكد صحة الملف والوثائق المودعة لهذه النسخة.", pending: "جارٍ الإرسال…", sent: "أُرسلت النسخة. يجب على فريق الامتثال مراجعة الوثائق والهوية الحالية دون أي تحقق تلقائي.",
  verified: "تحقق مسؤول مستقل من الهوية الحالية ووثائقها.", draft: "يلزم إكمال الملف ثم إرساله.", submitted: "النسخة المرسلة", version: "النسخة الحالية", noProfile: "لم تُحفظ أي نسخة قانونية بعد.",
  revision: "تم التحقق من هذه الهوية المشتركة في مسار آخر. لتغيير بياناتها القانونية أو معرّفاتها، اطلبوا مراجعة خاضعة للضوابط من فريق الامتثال.", contact: "التواصل مع فريق الامتثال", already: "أُرسلت هذه النسخة. تحفظ النسخة الجديدة السجل وتتطلب مراجعة جديدة.",
  saveError: "تعذر حفظ النسخة. أعيدوا تحميل الملف وتحققوا من صلاحياتكم، واطلبوا مراجعة خاضعة للضوابط عند تغيير المعرفات أو ملف سبق التحقق منه.",
  errors: { VALIDATION: "تحققوا من الحقول وأكدوا النسخة المطلوب إرسالها.", UNAUTHENTICATED: "انتهت الجلسة. أعيدوا تسجيل الدخول.", FORBIDDEN: "دوركم لا يتيح هذا الإجراء في المؤسسة المحددة.", CONFLICT: "تغير الملف. أعيدوا تحميل النسخة الحالية ومراجعتها.", DOCUMENTS_REQUIRED: "أكملوا ملف مقدم الخدمة وأودعوا الوثائق الثلاث المطلوبة من مسار التأهيل قبل الإرسال.", FAILED: "تعذر تأكيد الإرسال. أعيدوا تحميل الملف قبل المحاولة مجدداً." },
};
export function providerIdentityMessages(locale: Locale) { return locale === "ar" ? ar : fr; }
