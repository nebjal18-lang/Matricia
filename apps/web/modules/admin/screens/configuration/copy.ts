import type { ConfigurationSection } from "./view-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
const common = {
  fr: {
    title: "Configuration de votre plateforme", lead: "Renseignez votre entreprise, connectez vos services et suivez les validations avant la mise en service.",
    progress: "Configurations actives", progressHint: "Ce compteur concerne les cinq configurations ci-dessous. Il ne certifie ni la livraison, ni la conformité, ni une opération fournisseur réussie.",
    environment: "Environnement", stepsLabel: "Étapes de configuration", company: "Votre entreprise", integrations: "Services connectés", business: "Offre et contrats", team: "Équipe et sécurité", review: "Mise en service",
    active: "Active", draft: "À faire approuver", rejected: "Refusée", retired: "Désactivée", missing: "À renseigner", noVersion: "Aucune configuration enregistrée.",
    save: "Enregistrer pour approbation", saving: "Enregistrement…", saveHint: "Une nouvelle version est enregistrée. La version active reste utilisée jusqu’à l’approbation indépendante.",
    secretsHint: "Les clés enregistrées ne sont jamais réaffichées. Laissez un champ secret vide pour conserver la clé de la version indiquée. Saisissez une nouvelle clé pour la remplacer.",
    secretCleared: "Les champs secrets sont vidés après chaque réponse. Ressaisissez uniquement les nouvelles clés non encore enregistrées.", secretSaved: "Clé déjà enregistrée", secretMissing: "Clé à renseigner", secretReplace: "Nouvelle clé, facultative si déjà enregistrée", reason: "Motif de la modification", reasonHelp: "Indiquez ce qui change et pourquoi (10 caractères minimum).",
    reviewTitle: "Versions et validations", current: "Version actuellement utilisée", pending: "Cette version attend une autre personne habilitée.",
    test: "Tester la connexion", tested: "Connexion vérifiée", testFailed: "Connexion non validée", notTested: "Connexion à tester", staleTest: "Vérification à renouveler", testHint: "Ce test contrôle l’accès au service. Il ne déclenche ni paiement, ni signature, ni livraison d’email.",
    checkedAt: "Test effectué le", validUntil: "Vérification valable jusqu’au", approve: "Approuver et activer", reject: "Refuser cette version", disable: "Désactiver cette version", decisionReason: "Motif de la décision", confirmReview: "J’ai vérifié les paramètres affichés et les résultats du test de cette version.",
    superseded: "Cette proposition a été remplacée. Examinez la version la plus récente de ce service.", ownRevision: "Vous avez proposé cette version. Un autre administrateur habilité doit l’approuver.", probeRequired: "Un test de connexion réussi et encore valide est obligatoire avant l’activation.", noDelivery: "Une configuration active ne prouve pas qu’une opération réelle a été exécutée.", readOnly: "Vos habilitations permettent uniquement la consultation.", refresh: "Actualiser les états", connectedServices: "Connecter vos services", companyHint: "Ces informations sont conservées dans la configuration de la plateforme. Les identités légales des organisations restent gérées dans leurs dossiers dédiés.",
    businessHint: "Renseignez puis faites approuver les contenus dans les modules correspondants. Leur présence et leur validation ne sont pas certifiées par ce compteur.",
    teamHint: "Préparez les comptes des personnes qui administreront la plateforme. Deux administrateurs distincts avec second facteur sont nécessaires pour les activations soumises à une revue indépendante.",
    launchHint: "La mise en service exige aussi une recette réelle et les validations métier. Les liens ci-dessous ouvrent leurs écrans de travail ; les consulter ne les marque pas comme terminés.",
    unknown: "À vérifier dans le module", awaitingChecks: "Validation de mise en service encore requise", successSave: "Version enregistrée. Une approbation indépendante reste nécessaire.", successTest: "Résultat du test enregistré. Consultez l’état de cette version.", successApprove: "Décision enregistrée. L’état affiché est relu depuis le serveur.", successDisable: "Désactivation enregistrée.", failure: "L’opération n’a pas pu être confirmée. Vos informations non secrètes sont conservées ; relisez l’état puis réessayez.",
    forbidden: "Votre session ou votre habilitation ne permet pas cette opération. Vérifiez votre second facteur.", invalid: "Vérifiez les champs obligatoires et leurs formats.", stale: "Cette configuration a changé. Actualisez l’écran avant de proposer une nouvelle version.", encryption: "Le coffre de configuration doit être initialisé par l’équipe technique avant l’enregistrement des clés.", testError: "Le service n’a pas confirmé la connexion. Vérifiez les identifiants, le mode et l’accès réseau, puis relancez le test.", otherAdmin: "Cette activation nécessite la décision d’un autre administrateur habilité.",
  },
  ar: {
    title: "إعداد منصتكم", lead: "أدخلوا بيانات شركتكم واربطوا الخدمات وتابعوا الاعتمادات قبل بدء التشغيل.",
    progress: "الإعدادات المفعلة", progressHint: "يخص هذا المؤشر الإعدادات الخمسة أدناه فقط. ولا يثبت التسليم أو المطابقة أو نجاح عملية فعلية لدى المزوّد.",
    environment: "البيئة", stepsLabel: "مراحل الإعداد", company: "شركتكم", integrations: "الخدمات المتصلة", business: "العروض والعقود", team: "الفريق والأمن", review: "بدء التشغيل",
    active: "مفعلة", draft: "بانتظار الاعتماد", rejected: "مرفوضة", retired: "معطلة", missing: "بانتظار البيانات", noVersion: "لم يُحفظ أي إعداد بعد.",
    save: "حفظ للمراجعة والاعتماد", saving: "جارٍ الحفظ…", saveHint: "تُحفظ نسخة جديدة. وتبقى النسخة المفعلة مستخدمة حتى اعتماد النسخة الجديدة من شخص مستقل.",
    secretsHint: "لا تُعرض المفاتيح المحفوظة مجدداً. اتركوا الحقل السري فارغاً للاحتفاظ بمفتاح النسخة المحددة، أو أدخلوا مفتاحاً جديداً لاستبداله.",
    secretCleared: "تُفرغ الحقول السرية بعد كل استجابة. أعيدوا إدخال المفاتيح الجديدة التي لم تُحفظ بعد فقط.", secretSaved: "المفتاح محفوظ", secretMissing: "المفتاح مطلوب", secretReplace: "مفتاح جديد، اختياري إذا كان محفوظاً", reason: "سبب التعديل", reasonHelp: "وضحوا ما تغير والسبب، بعشرة أحرف على الأقل.",
    reviewTitle: "النسخ والاعتمادات", current: "النسخة المستخدمة حالياً", pending: "هذه النسخة بانتظار مراجعة شخص آخر مؤهل.",
    test: "اختبار الاتصال", tested: "تم التحقق من الاتصال", testFailed: "لم يُعتمد الاتصال", notTested: "الاتصال يحتاج إلى اختبار", staleTest: "يلزم تجديد التحقق", testHint: "يتحقق الاختبار من الوصول إلى الخدمة، ولا ينفذ دفعة أو توقيعاً أو تسليم بريد.",
    checkedAt: "تاريخ الاختبار", validUntil: "التحقق صالح حتى", approve: "اعتماد وتفعيل", reject: "رفض هذه النسخة", disable: "تعطيل هذه النسخة", decisionReason: "سبب القرار", confirmReview: "راجعت الإعدادات المعروضة ونتائج اختبار هذه النسخة.",
    superseded: "استُبدل هذا الاقتراح. راجعوا أحدث نسخة من إعداد هذه الخدمة.", ownRevision: "أنتم أصحاب اقتراح هذه النسخة. يجب أن يعتمدها مسؤول آخر مؤهل.", probeRequired: "يلزم اختبار اتصال ناجح لا تزال صلاحيته سارية قبل التفعيل.", noDelivery: "لا يثبت تفعيل الإعداد تنفيذ عملية فعلية.", readOnly: "تسمح صلاحياتكم بالقراءة فقط.", refresh: "تحديث الحالات", connectedServices: "ربط الخدمات", companyHint: "تُحفظ هذه المعلومات في إعداد المنصة. وتبقى الهويات القانونية للمنظمات في ملفاتها المخصصة.",
    businessHint: "أدخلوا المحتويات ثم اطلبوا اعتمادها في الوحدات المخصصة. ولا يثبت هذا المؤشر وجودها أو اعتمادها.",
    teamHint: "جهّزوا حسابات المسؤولين عن المنصة. تتطلب عمليات التفعيل ذات المراجعة المستقلة مسؤولين مختلفين مع عامل مصادقة ثانٍ.",
    launchHint: "يتطلب بدء التشغيل أيضاً اختباراً فعلياً واعتمادات مهنية. تفتح الروابط أدناه شاشات العمل، ولا يؤدي فتحها إلى اعتبار العمل مكتملاً.",
    unknown: "يلزم التحقق في الوحدة", awaitingChecks: "اعتماد بدء التشغيل لا يزال مطلوباً", successSave: "حُفظت النسخة. وما زالت المراجعة المستقلة مطلوبة.", successTest: "حُفظت نتيجة الاختبار. راجعوا حالة هذه النسخة.", successApprove: "سُجل القرار. تُقرأ الحالة المعروضة مجدداً من الخادم.", successDisable: "سُجل التعطيل.", failure: "تعذر تأكيد العملية. تُحفظ المعلومات غير السرية؛ راجعوا الحالة ثم أعيدوا المحاولة.",
    forbidden: "لا تسمح الجلسة أو الصلاحية بهذه العملية. تحققوا من عامل المصادقة الثاني.", invalid: "تحققوا من الحقول الإلزامية وصيغها.", stale: "تغير هذا الإعداد. حدّثوا الشاشة قبل اقتراح نسخة جديدة.", encryption: "يجب أن يهيئ الفريق التقني خزنة الإعداد قبل حفظ المفاتيح.", testError: "لم تؤكد الخدمة الاتصال. تحققوا من المفاتيح ووضع التشغيل والوصول إلى الشبكة ثم أعيدوا الاختبار.", otherAdmin: "يتطلب هذا التفعيل قرار مسؤول آخر مؤهل.",
  },
};
export function configurationCopy(locale: Locale) { return common[locale]; }
export function sectionCopy(section: ConfigurationSection, locale: Locale) {
  const values: Record<ConfigurationSection, [string, string, string, string]> = {
    COMPANY: ["Identité et coordonnées", "الهوية وبيانات الاتصال", "Informations de votre entreprise et langue par défaut.", "بيانات شركتكم واللغة الافتراضية."],
    RESEND: ["Email · Resend", "البريد الإلكتروني · Resend", "Expéditeur, destinataires de recette et accès au service de notification. L’email de connexion nécessite aussi le SMTP Auth.", "المرسل ومستلمو الاختبار والوصول إلى خدمة الإشعارات. ويتطلب بريد تسجيل الدخول أيضاً إعداد SMTP للمصادقة."],
    PAYPAL: ["Paiement · PayPal", "الدفع · PayPal", "Compte de paiement et vérification des notifications. Choisissez explicitement test ou production.", "حساب الدفع والتحقق من الإشعارات. حددوا صراحة وضع الاختبار أو الإنتاج."],
    YOUSIGN: ["Signature · YouSign", "التوقيع · YouSign", "Accès au fournisseur de signature. Les politiques contractuelles et les pouvoirs des signataires se valident séparément.", "الوصول إلى مزوّد التوقيع. تعتمد السياسات التعاقدية وصلاحيات الموقّعين بصورة مستقلة."],
    SCANNER: ["Documents · Antivirus", "المستندات · مكافحة الفيروسات", "Service d’analyse des fichiers. Le moteur et ses signatures doivent aussi être opérationnels.", "خدمة فحص الملفات. ويجب أن يعمل المحرك وقاعدة توقيعاته بصورة سليمة أيضاً."],
  };
  const v = values[section]; return { title: v[locale === "fr" ? 0 : 1], lead: v[locale === "fr" ? 2 : 3] };
}
export function environmentLabel(environment: string, locale: Locale) {
  const labels: Record<string, [string, string]> = { DEVELOPMENT: ["Développement", "التطوير"], STAGING: ["Préproduction", "ما قبل الإنتاج"], PRODUCTION: ["Production", "الإنتاج"] };
  return labels[environment]?.[locale === "fr" ? 0 : 1] ?? (locale === "fr" ? "Non configuré" : "غير مهيأة");
}
export function actionMessage(status: string, reason: string | undefined, intent: string, locale: Locale) {
  const c = configurationCopy(locale);
  if (status === "idle") return "";
  if (status === "success") return intent === "save" ? c.successSave : intent === "test" ? c.successTest : intent === "disable" ? c.successDisable : c.successApprove;
  if (/AAL2|MFA|FORBIDDEN|DENIED|UNAUTHENTICATED/u.test(reason ?? "")) return c.forbidden;
  if (/ENCRYPTION/u.test(reason ?? "")) return c.encryption;
  if (/STALE|CONFLICT|SOURCE_CHANGED/u.test(reason ?? "")) return c.stale;
  if (/INDEPENDENT|SELF_APPROVAL/u.test(reason ?? "")) return c.otherAdmin;
  if (/PROBE|CONNECT|PROVIDER/u.test(reason ?? "")) return c.testError;
  if (/VALIDATION|INVALID|REQUIRED|MISSING/u.test(reason ?? "")) return c.invalid;
  return c.failure;
}
