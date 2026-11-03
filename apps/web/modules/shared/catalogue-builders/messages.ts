import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type BuilderMessages = {
  nav: string; back: string; language: string; eyebrow: string; title: string; description: string;
  selection: string; library: string; service: string; chooseLibrary: string; chooseService: string; open: string;
  noLibraries: string; noServices: string; unavailable: string; retry: string;
  questionTitle: string; questionDescription: string; questionKey: string; dataKey: string; labelFr: string; labelAr: string; helpFr: string; helpAr: string;
  answerType: string; sensitivity: string; required: string; requiredForQuote: string; changeReason: string; confirmQuestion: string; createQuestion: string; creatingQuestion: string; questionCreated: string;
  answerTypes: Record<"YES_NO" | "SHORT_TEXT" | "LONG_TEXT" | "INTEGER" | "DATE" | "MONEY", string>;
  sensitivities: Record<"PUBLIC" | "BUSINESS" | "CONFIDENTIAL" | "RESTRICTED", string>;
  ruleTitle: string; ruleDescription: string; ruleKey: string; predicateQuestionKey: string; expectedBoolean: string; ruleAction: string; actionTarget: string; priority: string; sensitiveRule: string; confirmRule: string; createRule: string; creatingRule: string; ruleCreated: string;
  ruleActions: Record<"BLOCK_PUBLICATION" | "BLOCK_RFQ" | "REQUIRE_QUESTION" | "SHOW_QUESTION" | "HIDE_QUESTION" | "CREATE_ANOMALY" | "CREATE_RISK" | "CREATE_RECOMMENDATION" | "REQUIRE_HUMAN_REVIEW", string>;
  formTitle: string; formDescription: string; formCode: string; catalogReleaseId: string; titleFr: string; titleAr: string; descriptionFr: string; descriptionAr: string; audience: string; engineVersion: string; policyVersion: string; formSensitive: string; sectionKey: string; sectionLabelFr: string; sectionLabelAr: string; sectionHelpFr: string; sectionHelpAr: string; confirmForm: string; createForm: string; creatingForm: string; formCreated: string;
  audiences: Record<"CLIENT" | "PROVIDER" | "FRANCHISE" | "INTERNAL", string>;
  releaseTitle: string; releaseDescription: string; selectedContext: string;
  createTitle: string; releaseKey: string; sourceHash: string; centralApproval: string; approvalYes: string; approvalNo: string;
  confirmCreate: string; create: string; creating: string;
  addTitle: string; releaseId: string; objectType: string; objectId: string; versionId: string; contentHash: string;
  sortOrder: string; rowVersion: string; confirmAdd: string; add: string; adding: string;
  submitTitle: string; confirmSubmit: string; submit: string; submitting: string;
  successCreated: string; successAdded: string; successSubmitted: string; resultRelease: string; resultVersion: string; resultStatus: string;
  objectTypes: Record<"LIBRARY" | "CATEGORY" | "SUBCATEGORY" | "SERVICE" | "SERVICE_SUBCATEGORY_LINK", string>;
  entityStatuses: Record<"DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "RETIRED" | "ARCHIVED", string>;
  releaseStatuses: Record<"APPROVED" | "IN_REVIEW", string>;
  errors: { validation: string; unauthenticated: string; forbidden: string; unavailable: string };
};

const fr: BuilderMessages = {
  nav: "Navigation du gestionnaire de releases catalogue", back: "Retour au tableau de bord", language: "العربية",
  eyebrow: "Catalogue versionné", title: "Gestion des releases catalogue", description: "Préparez une release auditable à partir des identifiants et versions approuvés.",
  selection: "Contexte de travail", library: "Bibliothèque", service: "Service ciblé", chooseLibrary: "Choisir une bibliothèque", chooseService: "Choisir un service", open: "Ouvrir le contexte",
  noLibraries: "Aucune bibliothèque administrable n’est accessible.", noServices: "Aucun service accessible dans cette bibliothèque.", unavailable: "Le Builder ne peut pas charger ce contexte.", retry: "Réessayer",
  questionTitle: "Créer une question versionnée", questionDescription: "Ajoutez une question réelle au service sélectionné. La version reste en brouillon jusqu’au workflow d’approbation.",
  questionKey: "Clé de question", dataKey: "Clé de donnée", labelFr: "Libellé français", labelAr: "Libellé arabe", helpFr: "Aide française (facultative)", helpAr: "Aide arabe (facultative)",
  answerType: "Type de réponse", sensitivity: "Sensibilité", required: "Obligatoire par défaut", requiredForQuote: "Obligatoire pour le devis", changeReason: "Motif du changement", confirmQuestion: "Je confirme les libellés FR/AR, le service ciblé et le niveau de sensibilité.", createQuestion: "Créer la question", creatingQuestion: "Création…", questionCreated: "Question DRAFT créée et auditée.",
  answerTypes: { YES_NO: "Oui / Non", SHORT_TEXT: "Texte court", LONG_TEXT: "Texte long", INTEGER: "Nombre entier", DATE: "Date", MONEY: "Montant" },
  sensitivities: { PUBLIC: "Public", BUSINESS: "Métier", CONFIDENTIAL: "Confidentiel", RESTRICTED: "Restreint" },
  ruleTitle: "Créer une règle booléenne versionnée", ruleDescription: "Créez un prédicat déterministe sur une question et une action typée. La règle reste DRAFT jusqu’à validation.", ruleKey: "Clé de règle", predicateQuestionKey: "Clé de la question évaluée", expectedBoolean: "Valeur attendue", ruleAction: "Action déclenchée", actionTarget: "Cible de l’action", priority: "Priorité", sensitiveRule: "Règle sensible", confirmRule: "Je confirme le prédicat, l’action, la cible et le niveau de sensibilité.", createRule: "Créer la règle", creatingRule: "Création…", ruleCreated: "Règle DRAFT créée, hashée et auditée.",
  ruleActions: { BLOCK_PUBLICATION: "Bloquer la publication", BLOCK_RFQ: "Bloquer la RFQ", REQUIRE_QUESTION: "Rendre une question obligatoire", SHOW_QUESTION: "Afficher une question", HIDE_QUESTION: "Masquer une question", CREATE_ANOMALY: "Créer une anomalie", CREATE_RISK: "Créer un risque", CREATE_RECOMMENDATION: "Créer une recommandation", REQUIRE_HUMAN_REVIEW: "Exiger une revue humaine" },
  formTitle: "Créer un questionnaire versionné", formDescription: "Créez un brouillon bilingue lié à une release éditable avec sa première section immuable.", formCode: "Code du questionnaire", catalogReleaseId: "Identifiant de la release catalogue", titleFr: "Titre français", titleAr: "Titre arabe", descriptionFr: "Description française", descriptionAr: "Description arabe", audience: "Audience", engineVersion: "Version du moteur", policyVersion: "Version de la politique", formSensitive: "Questionnaire sensible", sectionKey: "Clé de la première section", sectionLabelFr: "Libellé français de section", sectionLabelAr: "Libellé arabe de section", sectionHelpFr: "Aide française de section (facultative)", sectionHelpAr: "Aide arabe de section (facultative)", confirmForm: "Je confirme la release, les contenus FR/AR, l’audience et la sensibilité.", createForm: "Créer le questionnaire", creatingForm: "Création…", formCreated: "Questionnaire DRAFT et première section créés et audités.", audiences: { CLIENT: "Client", PROVIDER: "Sous-traitant", FRANCHISE: "Franchisé", INTERNAL: "Interne" },
  releaseTitle: "Workflow de publication", releaseDescription: "Préparez, complétez puis soumettez une publication auditée. Les versions et contrôles techniques sont vérifiés automatiquement.", selectedContext: "Contexte sélectionné",
  createTitle: "1. Créer le brouillon", releaseKey: "Clé de release", sourceHash: "Empreinte SHA-256 du bundle", centralApproval: "Approbation centrale requise", approvalYes: "Oui", approvalNo: "Non", confirmCreate: "Je confirme créer une release DRAFT pour cette bibliothèque.", create: "Créer la release", creating: "Création…",
  addTitle: "2. Ajouter le service approuvé", releaseId: "Publication en brouillon", objectType: "Type d’objet", objectId: "Objet", versionId: "Version approuvée", contentHash: "Intégrité du contenu", sortOrder: "Ordre", rowVersion: "Version courante", confirmAdd: "Je confirme l’ajout de cette version approuvée à la publication.", add: "Ajouter le service", adding: "Ajout…",
  submitTitle: "3. Soumettre la release", confirmSubmit: "Je confirme que l’arbre est complet et que les traductions arabes sont approuvées.", submit: "Soumettre pour validation", submitting: "Soumission…",
  successCreated: "Release DRAFT créée.", successAdded: "Élément ajouté à la release.", successSubmitted: "Release soumise avec succès.", resultRelease: "Release", resultVersion: "Nouvelle row version", resultStatus: "Statut",
  objectTypes: { LIBRARY: "Bibliothèque", CATEGORY: "Catégorie", SUBCATEGORY: "Sous-catégorie", SERVICE: "Service", SERVICE_SUBCATEGORY_LINK: "Lien service / sous-catégorie" },
  entityStatuses: { DRAFT: "Brouillon", IN_REVIEW: "En validation", APPROVED: "Approuvé", PUBLISHED: "Publié", RETIRED: "Retiré", ARCHIVED: "Archivé" },
  releaseStatuses: { APPROVED: "Approuvée", IN_REVIEW: "En validation" },
  errors: { validation: "Vérifiez les choix et confirmations.", unauthenticated: "Votre session a expiré.", forbidden: "Vous ne disposez pas des permissions catalogue requises.", unavailable: "La commande n’a pas abouti. Actualisez les publications disponibles puis réessayez." },
};

const ar: BuilderMessages = {
  nav: "التنقل في إدارة إصدارات الدليل", back: "العودة إلى لوحة التحكم", language: "Français",
  eyebrow: "دليل بإصدارات", title: "إدارة إصدارات الدليل", description: "حضّر إصداراً قابلاً للتدقيق انطلاقاً من المعرفات والنسخ المعتمدة.",
  selection: "سياق العمل", library: "المكتبة", service: "الخدمة المستهدفة", chooseLibrary: "اختر مكتبة", chooseService: "اختر خدمة", open: "فتح السياق",
  noLibraries: "لا توجد مكتبة إدارية متاحة.", noServices: "لا توجد خدمة متاحة في هذه المكتبة.", unavailable: "تعذر تحميل سياق المنشئ.", retry: "إعادة المحاولة",
  questionTitle: "إنشاء سؤال بإصدار", questionDescription: "أضف سؤالاً فعلياً إلى الخدمة المحددة. تبقى النسخة مسودة إلى حين إتمام مسار الاعتماد.",
  questionKey: "مفتاح السؤال", dataKey: "مفتاح البيانات", labelFr: "النص الفرنسي", labelAr: "النص العربي", helpFr: "المساعدة الفرنسية (اختيارية)", helpAr: "المساعدة العربية (اختيارية)",
  answerType: "نوع الإجابة", sensitivity: "درجة الحساسية", required: "إلزامي افتراضياً", requiredForQuote: "إلزامي لعرض السعر", changeReason: "سبب التغيير", confirmQuestion: "أؤكد النصين الفرنسي والعربي والخدمة المستهدفة ودرجة الحساسية.", createQuestion: "إنشاء السؤال", creatingQuestion: "جارٍ الإنشاء…", questionCreated: "تم إنشاء السؤال كمسودة وتدقيق العملية.",
  answerTypes: { YES_NO: "نعم / لا", SHORT_TEXT: "نص قصير", LONG_TEXT: "نص طويل", INTEGER: "عدد صحيح", DATE: "تاريخ", MONEY: "مبلغ" },
  sensitivities: { PUBLIC: "عام", BUSINESS: "مهني", CONFIDENTIAL: "سري", RESTRICTED: "مقيّد" },
  ruleTitle: "إنشاء قاعدة منطقية بإصدار", ruleDescription: "أنشئ شرطاً حتمياً على سؤال وإجراءً محدد النوع. تبقى القاعدة مسودة حتى اعتمادها.", ruleKey: "مفتاح القاعدة", predicateQuestionKey: "مفتاح السؤال المقيم", expectedBoolean: "القيمة المتوقعة", ruleAction: "الإجراء الناتج", actionTarget: "هدف الإجراء", priority: "الأولوية", sensitiveRule: "قاعدة حساسة", confirmRule: "أؤكد الشرط والإجراء والهدف ودرجة الحساسية.", createRule: "إنشاء القاعدة", creatingRule: "جارٍ الإنشاء…", ruleCreated: "تم إنشاء القاعدة كمسودة وحساب بصمتها وتدقيقها.",
  ruleActions: { BLOCK_PUBLICATION: "حظر النشر", BLOCK_RFQ: "حظر طلب العرض", REQUIRE_QUESTION: "جعل السؤال إلزامياً", SHOW_QUESTION: "إظهار سؤال", HIDE_QUESTION: "إخفاء سؤال", CREATE_ANOMALY: "إنشاء حالة شاذة", CREATE_RISK: "إنشاء خطر", CREATE_RECOMMENDATION: "إنشاء توصية", REQUIRE_HUMAN_REVIEW: "فرض مراجعة بشرية" },
  formTitle: "إنشاء استبيان بإصدار", formDescription: "أنشئ مسودة ثنائية اللغة مرتبطة بإصدار قابل للتعديل مع أول قسم ثابت.", formCode: "رمز الاستبيان", catalogReleaseId: "معرف إصدار الدليل", titleFr: "العنوان الفرنسي", titleAr: "العنوان العربي", descriptionFr: "الوصف الفرنسي", descriptionAr: "الوصف العربي", audience: "الجمهور", engineVersion: "إصدار المحرك", policyVersion: "إصدار السياسة", formSensitive: "استبيان حساس", sectionKey: "مفتاح القسم الأول", sectionLabelFr: "اسم القسم بالفرنسية", sectionLabelAr: "اسم القسم بالعربية", sectionHelpFr: "مساعدة القسم بالفرنسية (اختيارية)", sectionHelpAr: "مساعدة القسم بالعربية (اختيارية)", confirmForm: "أؤكد الإصدار والمحتوى الفرنسي والعربي والجمهور والحساسية.", createForm: "إنشاء الاستبيان", creatingForm: "جارٍ الإنشاء…", formCreated: "تم إنشاء الاستبيان كمسودة وقسمه الأول وتدقيقهما.", audiences: { CLIENT: "عميل", PROVIDER: "مقدم خدمة", FRANCHISE: "صاحب امتياز", INTERNAL: "داخلي" },
  releaseTitle: "مسار نشر الدليل", releaseDescription: "حضّر النشر وأكمله ثم أرسله للمراجعة. يتحقق الخادم تلقائياً من النسخ والضوابط التقنية.", selectedContext: "السياق المحدد",
  createTitle: "1. إنشاء المسودة", releaseKey: "مفتاح الإصدار", sourceHash: "بصمة SHA-256 للحزمة", centralApproval: "الموافقة المركزية مطلوبة", approvalYes: "نعم", approvalNo: "لا", confirmCreate: "أؤكد إنشاء إصدار DRAFT لهذه المكتبة.", create: "إنشاء الإصدار", creating: "جارٍ الإنشاء…",
  addTitle: "2. إضافة الخدمة المعتمدة", releaseId: "مسودة النشر", objectType: "نوع العنصر", objectId: "العنصر", versionId: "النسخة المعتمدة", contentHash: "سلامة المحتوى", sortOrder: "الترتيب", rowVersion: "النسخة الحالية", confirmAdd: "أؤكد إضافة هذه النسخة المعتمدة إلى النشر.", add: "إضافة الخدمة", adding: "جارٍ الإضافة…",
  submitTitle: "3. إرسال الإصدار", confirmSubmit: "أؤكد اكتمال الشجرة واعتماد الترجمات العربية.", submit: "إرسال للتحقق", submitting: "جارٍ الإرسال…",
  successCreated: "تم إنشاء إصدار DRAFT.", successAdded: "تمت إضافة العنصر إلى الإصدار.", successSubmitted: "تم إرسال الإصدار بنجاح.", resultRelease: "الإصدار", resultVersion: "رقم الصف الجديد", resultStatus: "الحالة",
  objectTypes: { LIBRARY: "المكتبة", CATEGORY: "الفئة", SUBCATEGORY: "الفئة الفرعية", SERVICE: "الخدمة", SERVICE_SUBCATEGORY_LINK: "رابط الخدمة والفئة الفرعية" },
  entityStatuses: { DRAFT: "مسودة", IN_REVIEW: "قيد المراجعة", APPROVED: "معتمد", PUBLISHED: "منشور", RETIRED: "مسحوب", ARCHIVED: "مؤرشف" },
  releaseStatuses: { APPROVED: "معتمد", IN_REVIEW: "قيد المراجعة" },
  errors: { validation: "تحقق من الاختيارات والتأكيدات.", unauthenticated: "انتهت صلاحية جلستك.", forbidden: "ليست لديك صلاحيات الدليل المطلوبة.", unavailable: "لم ينجح الأمر. حدّث قائمة المنشورات المتاحة ثم أعد المحاولة." },
};

export function getBuilderMessages(locale: Locale): BuilderMessages { return locale === "ar" ? ar : fr; }
